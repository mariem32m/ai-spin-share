import { supabase, isSupabaseConfigured, DEMO_STORE_KEY, ENV_REGISTRATION_URL, MIN_SUBMIT_INTERVAL_MS, callHostAction } from "./supabase";
import type { Submission, GameSession, ChallengeType, ModerationStatus, SessionConfigUpdate } from "./types";
import { CHALLENGE_TYPES } from "./types";

export type StoreMode = "supabase" | "demo";

export interface NewSubmissionInput {
  session_id: string;
  student_name: string;
  challenge_type: ChallengeType;
  answer: string;
}

export interface RealtimePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  submission: Submission;
}

export interface SessionInfo {
  mode: StoreMode;
  session: GameSession;
}

/* ==================================================================
 * Demo-mode helpers (localStorage). Data stays on the current device
 * and clearly does NOT synchronize across devices.
 * ================================================================== */

const demoSubsKey = (sessionId: string) => `${DEMO_STORE_KEY}:subs:${sessionId}`;
const DEMO_SESSION_KEY = `${DEMO_STORE_KEY}:session`;
const DEMO_RATE_KEY = `${DEMO_STORE_KEY}:lastSubmit`;

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** Reads any localStorage key or returns a fallback, safely. */
function readStore(key: string, fallback: string | null): string | null {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage full / unavailable — demo mode degrades gracefully */
  }
}

function demoDefaultSession(generation: number): GameSession {
  return {
    id: `demo-session-${generation}`,
    name: "AI Spin & Share",
    status: "active",
    allow_repeat_participation: true,
    registration_url: ENV_REGISTRATION_URL || null,
    created_at: new Date().toISOString(),
    ended_at: null,
  };
}

function loadDemoSession(): GameSession {
  const raw = readStore(DEMO_SESSION_KEY, null);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as GameSession;
      if (parsed && parsed.id) return parsed;
    } catch {
      /* corrupted — fall through to a fresh session */
    }
  }
  const session = demoDefaultSession(1);
  writeStore(DEMO_SESSION_KEY, JSON.stringify(session));
  return session;
}

function loadDemoSubmissions(sessionId: string): Submission[] {
  const raw = readStore(demoSubsKey(sessionId), null);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as Submission[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveDemoSubmissions(sessionId: string, subs: Submission[]): void {
  writeStore(demoSubsKey(sessionId), JSON.stringify(subs));
}

/** Tiny emitter so the same tab hears demo-mode "realtime" changes. */
const demoListeners = new Set<(p: RealtimePayload) => void>();

function emitDemo(payload: RealtimePayload): void {
  demoListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      /* ignore listener errors */
    }
  });
}

// Cross-tab demo sync: when another tab writes submissions, refetch
// and broadcast the full list to every subscriber.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key || !e.key.startsWith(DEMO_STORE_KEY)) return;
    const session = loadDemoSession();
    const subs = loadDemoSubmissions(session.id);
    refetchHints.forEach((fn) => {
      try {
        fn(subs);
      } catch {
        /* ignore */
      }
    });
  });
}

/** Secondary listeners that receive a full list refetch signal. */
const refetchHints = new Set<(subs: Submission[]) => void>();

/* ==================================================================
 * Rate limiting (same device). Real server-side protection should be
 * added in Supabase with an Edge Function — see README.
 * ================================================================== */

export function checkSubmitRateLimit(): boolean {
  const last = Number(readStore(DEMO_RATE_KEY, "0") ?? 0);
  const now = Date.now();
  if (now - last < MIN_SUBMIT_INTERVAL_MS) return false;
  writeStore(DEMO_RATE_KEY, String(now));
  return true;
}

/* ==================================================================
 * Public store API
 * ================================================================== */

export interface Store {
  mode: StoreMode;
  /** Resolve the active session (creating one if needed). */
  ensureSession(): Promise<SessionInfo>;
  getSubmissions(sessionId: string): Promise<Submission[]>;
  /** Host-only full list (includes hidden items) via the Edge Function. */
  hostList(sessionId: string): Promise<Submission[]>;
  submit(input: NewSubmissionInput): Promise<Submission>;
  setModeration(id: string, status: ModerationStatus): Promise<void>;
  updateConfig(config: SessionConfigUpdate): Promise<GameSession>;
  resetSession(): Promise<GameSession>;
  deleteSessionData(sessionId: string): Promise<void>;
  subscribe(sessionId: string, onPayload: (p: RealtimePayload) => void, onList?: (subs: Submission[]) => void): () => void;
}

export const store: Store = isSupabaseConfigured
  ? supabaseStore()
  : demoStore();

/* ---------------- Cached session resolution ----------------
 * Single source of truth for the active session; reused by every page
 * so they all point at the same session.
 * ------------------------------------------------------------ */

let sessionPromise: Promise<SessionInfo> | null = null;

export function resolveSession(): Promise<SessionInfo> {
  if (!sessionPromise) sessionPromise = store.ensureSession();
  return sessionPromise;
}

/** Invalidate the cached session (after reset / config changes). */
export function invalidateSession(): void {
  sessionPromise = null;
}

/* ---------------- Supabase-backed store ---------------- */

function supabaseStore(): Store {
  const db = supabase as NonNullable<typeof supabase>;

  async function ensureSession(): Promise<SessionInfo> {
    const { data, error } = await db
      .from("game_sessions")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }

    if (data) {
      return { mode: "supabase", session: data as GameSession };
    }

    // No active session — create a default one.
    const { data: created, error: insertError } = await db
      .from("game_sessions")
      .insert({
        name: "AI Spin & Share",
        status: "active",
        allow_repeat_participation: true,
        registration_url: ENV_REGISTRATION_URL || null,
      })
      .select("*")
      .single();

    if (insertError) throw new Error(insertError.message);
    return { mode: "supabase", session: created as GameSession };
  }

  async function getSubmissions(sessionId: string): Promise<Submission[]> {
    const { data, error } = await db
      .from("submissions")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Submission[];
  }

  async function hostList(sessionId: string): Promise<Submission[]> {
    const res = await callHostAction("list", { session_id: sessionId });
    return (res.submissions as Submission[]) ?? [];
  }

  async function submit(input: NewSubmissionInput): Promise<Submission> {
    if (!checkSubmitRateLimit()) {
      throw new Error("RATE_LIMITED");
    }
    const { data, error } = await db
      .from("submissions")
      .insert({
        session_id: input.session_id,
        student_name: input.student_name,
        challenge_type: input.challenge_type,
        answer: input.answer,
        moderation_status: "visible",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Submission;
  }

  async function setModeration(id: string, status: ModerationStatus): Promise<void> {
    // Moderation is privileged: run it through the host Edge Function
    // (verify_token = host hash). Public users cannot update rows.
    await callHostAction("set_moderation", { id, status });
  }

  async function updateConfig(config: SessionConfigUpdate): Promise<GameSession> {
    const { mode, session } = await ensureSession();
    void mode;
    const res = await callHostAction("update_config", { session_id: session.id, ...config });
    invalidateSession();
    return res.session as GameSession;
  }

  async function resetSession(): Promise<GameSession> {
    const { session } = await ensureSession();
    await callHostAction("reset_session", { session_id: session.id });
    invalidateSession();
    const fresh = await ensureSession();
    return fresh.session;
  }

  async function deleteSessionData(sessionId: string): Promise<void> {
    await callHostAction("delete_session", { session_id: sessionId });
    invalidateSession();
  }

  function subscribe(sessionId: string, onPayload: (p: RealtimePayload) => void): () => void {
    const channel = db
      .channel(`subs:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const rec = (payload.new ?? payload.old) as Submission | undefined;
          if (!rec) return;
          const eventType = (payload.eventType ?? "UPDATE").toUpperCase() as RealtimePayload["eventType"];
          onPayload({ eventType, submission: rec });
        },
      )
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }

  return {
    mode: "supabase",
    ensureSession,
    getSubmissions,
    hostList,
    submit,
    setModeration,
    updateConfig,
    resetSession,
    deleteSessionData,
    subscribe,
  };
}

/* ---------------- Demo (localStorage) store ---------------- */

function demoStore(): Store {
  async function ensureSession(): Promise<SessionInfo> {
    return { mode: "demo", session: loadDemoSession() };
  }

  function persistSession(session: GameSession): void {
    writeStore(DEMO_SESSION_KEY, JSON.stringify(session));
  }

  async function getSubmissions(sessionId: string): Promise<Submission[]> {
    return loadDemoSubmissions(sessionId)
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  async function hostList(sessionId: string): Promise<Submission[]> {
    return loadDemoSubmissions(sessionId)
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  async function submit(input: NewSubmissionInput): Promise<Submission> {
    if (!checkSubmitRateLimit()) {
      throw new Error("RATE_LIMITED");
    }
    const sub: Submission = {
      id: randomId(),
      session_id: input.session_id,
      student_name: input.student_name.trim(),
      challenge_type: input.challenge_type,
      answer: input.answer.trim(),
      moderation_status: "visible",
      created_at: new Date().toISOString(),
    };
    const subs = loadDemoSubmissions(input.session_id);
    subs.push(sub);
    saveDemoSubmissions(input.session_id, subs);
    emitDemo({ eventType: "INSERT", submission: sub });
    return sub;
  }

  async function setModeration(id: string, status: ModerationStatus): Promise<void> {
    const session = loadDemoSession();
    const subs = loadDemoSubmissions(session.id).map((s) => (s.id === id ? { ...s, moderation_status: status } : s));
    saveDemoSubmissions(session.id, subs);
    const updated = subs.find((s) => s.id === id);
    if (updated) {
      refetchHints.forEach((fn) => fn(subs));
    }
  }

  async function updateConfig(config: SessionConfigUpdate): Promise<GameSession> {
    const session = loadDemoSession();
    const next: GameSession = { ...session };
    if (typeof config.allow_repeat_participation === "boolean") next.allow_repeat_participation = config.allow_repeat_participation;
    if (config.registration_url !== undefined) next.registration_url = config.registration_url;
    persistSession(next);
    invalidateSession();
    return next;
  }

  async function resetSession(): Promise<GameSession> {
    const old = loadDemoSession();
    // Archive old submissions under an "archived" marker untouched
    // (localStorage history), then open a fresh session.
    const next: GameSession = {
      ...old,
      id: `demo-session-${Date.now()}`,
      status: "active",
      created_at: new Date().toISOString(),
      ended_at: null,
    };
    persistSession(next);
    invalidateSession();
    refetchHints.forEach((fn) => fn([]));
    return next;
  }

  async function deleteSessionData(sessionId: string): Promise<void> {
    try {
      localStorage.removeItem(demoSubsKey(sessionId));
    } catch {
      /* ignore */
    }
    refetchHints.forEach((fn) => fn([]));
  }

  function subscribe(sessionId: string, onPayload: (p: RealtimePayload) => void, onList?: (subs: Submission[]) => void): () => void {
    const payloadListener = (p: RealtimePayload) => {
      if (!p.submission || p.submission.session_id !== sessionId) return;
      onPayload(p);
    };
    const listListener = (subs: Submission[]) => {
      if (onList) onList(subs);
    };
    demoListeners.add(payloadListener);
    if (onList) refetchHints.add(listListener);
    return () => {
      demoListeners.delete(payloadListener);
      if (onList) refetchHints.delete(listListener);
    };
  }

  return {
    mode: "demo",
    ensureSession,
    getSubmissions,
    hostList,
    submit,
    setModeration,
    updateConfig,
    resetSession,
    deleteSessionData,
    subscribe,
  };
}

/* ==================================================================
 * Validation helpers (shared by form + submission)
 * ================================================================== */

export function validateSubmission(input: {
  student_name: string;
  answer: string;
  challenge_type: string;
}): { ok: boolean; error?: "name_empty" | "name_long" | "answer_empty" | "answer_long" | "bad_challenge" } {
  const name = input.student_name.trim();
  const answer = input.answer.trim();
  if (!name) return { ok: false, error: "name_empty" };
  if (name.length > 50) return { ok: false, error: "name_long" };
  if (!answer) return { ok: false, error: "answer_empty" };
  if (answer.length > 500) return { ok: false, error: "answer_long" };
  if (!CHALLENGE_TYPES.includes(input.challenge_type as ChallengeType)) {
    return { ok: false, error: "bad_challenge" };
  }
  return { ok: true };
}

/** Safely format a timestamp for a locale. */
export function formatTimestamp(iso: string, lang: "en" | "ar"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}