import {
  supabase,
  isSupabaseConfigured,
  DEMO_STORE_KEY,
  MIN_SUBMIT_INTERVAL_MS,
  callHostAction,
  callPublicAction,
} from "./supabase";
import type { GameSession, NewSurveyInput, SurveySubmission } from "./types";
import { SURVEY_QUESTIONS, FINAL_QUESTION } from "./questions";
import type { SurveyQuestionKey } from "./questions";

export type StoreMode = "supabase" | "demo";

export interface RealtimePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  submission: SurveySubmission;
}

export interface SessionInfo {
  mode: StoreMode;
  session: GameSession;
}

/* ==================================================================
 * Demo-mode helpers (localStorage). Data stays on the current device
 * and clearly does NOT synchronize across devices.
 * ================================================================== */

const demoSurveysKey = (sessionId: string) => `${DEMO_STORE_KEY}:surveys:${sessionId}`;
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
    name: "AI Through Your Eyes",
    status: "active",
    allow_repeat_participation: true,
    registration_url: null,
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

function loadDemoSurveys(sessionId: string): SurveySubmission[] {
  const raw = readStore(demoSurveysKey(sessionId), null);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as SurveySubmission[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveDemoSurveys(sessionId: string, subs: SurveySubmission[]): void {
  writeStore(demoSurveysKey(sessionId), JSON.stringify(subs));
}

/** Tiny emitter so listeners hear demo-mode "realtime" changes. */
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

// Cross-tab demo sync: when another tab writes surveys, refetch and
// broadcast the full list to every subscriber.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key || !e.key.startsWith(DEMO_STORE_KEY)) return;
    const session = loadDemoSession();
    const surveys = loadDemoSurveys(session.id);
    refetchHints.forEach((fn) => {
      try {
        fn(surveys);
      } catch {
        /* ignore */
      }
    });
  });
}

/** Secondary listeners that receive a full list refetch signal. */
const refetchHints = new Set<(subs: SurveySubmission[]) => void>();

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
  /** Create one survey submission. Public students may call this. */
  submitSurvey(input: NewSurveyInput): Promise<SurveySubmission>;
  /** Host-only full response list, via the protected Edge Function in live mode. */
  listSurveys(sessionId: string): Promise<SurveySubmission[]>;
  resetSession(): Promise<GameSession>;
  deleteSessionData(sessionId: string): Promise<void>;
  subscribe(sessionId: string, onPayload: (p: RealtimePayload) => void, onList?: (subs: SurveySubmission[]) => void): () => void;
}

export const store: Store = isSupabaseConfigured ? supabaseStore() : demoStore();

/* ---------------- Cached session resolution ----------------
 * Single source of truth for the active session; reused by every page
 * so they all point at the same session.
 * ------------------------------------------------------------ */

let sessionPromise: Promise<SessionInfo> | null = null;

export function resolveSession(): Promise<SessionInfo> {
  if (!sessionPromise) sessionPromise = store.ensureSession();
  return sessionPromise;
}

/** Invalidate the cached session (after reset). */
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

    // No active session — create a default one through the Edge Function
    // (service role). Public clients have no INSERT policy on game_sessions,
    // so session creation must be server-side and is idempotent.
    const res = await callPublicAction("ensure_session");
    return { mode: "supabase", session: res.session as GameSession };
  }

  async function submitSurvey(input: NewSurveyInput): Promise<SurveySubmission> {
    if (!checkSubmitRateLimit()) {
      throw new Error("RATE_LIMITED");
    }
    const nickname = input.nickname.trim() || null;
    const payload = {
      session_id: input.session_id,
      nickname,
      question_1_answer: input.answers.question_1_answer,
      question_2_answer: input.answers.question_2_answer,
      question_3_answer: input.answers.question_3_answer,
      question_4_answer: input.answers.question_4_answer,
      question_5_answer: input.answers.question_5_answer,
      ai_track_expectations: input.ai_track_expectations.trim(),
    };

    // Insert WITHOUT `.select()` (return=minimal). Survey responses have no
    // public SELECT policy, so asking PostgREST to return the inserted row
    // would be rejected by RLS. The organizer reads rows through the
    // protected Edge Function instead, so we only need the client-side
    // record for the immediate UI.
    const { error } = await db.from("survey_submissions").insert(payload);
    if (error) throw new Error(error.message);

    return {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
      session_id: input.session_id,
      nickname,
      ...input.answers,
      ai_track_expectations: payload.ai_track_expectations,
      created_at: new Date().toISOString(),
    } as SurveySubmission;
  }

  async function listSurveys(sessionId: string): Promise<SurveySubmission[]> {
    const res = await callHostAction("survey_list", { session_id: sessionId });
    return (res.surveys as SurveySubmission[]) ?? [];
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
    // NOTE: survey submissions are private (no public SELECT policy), so the
    // dashboard reads them through the protected Edge Function and polls for
    // updates. This subscription is a no-op that keeps the Store surface
    // uniform; demo mode uses its own event bus below.
    void sessionId;
    void onPayload;
    return () => undefined;
  }

  return {
    mode: "supabase",
    ensureSession,
    submitSurvey,
    listSurveys,
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

  async function submitSurvey(input: NewSurveyInput): Promise<SurveySubmission> {
    if (!checkSubmitRateLimit()) {
      throw new Error("RATE_LIMITED");
    }
    const sub: SurveySubmission = {
      id: randomId(),
      session_id: input.session_id,
      nickname: input.nickname.trim() || null,
      question_1_answer: input.answers.question_1_answer as string,
      question_2_answer: input.answers.question_2_answer as string,
      question_3_answer: [...(input.answers.question_3_answer as string[])],
      question_4_answer: input.answers.question_4_answer as string,
      question_5_answer: [...(input.answers.question_5_answer as string[])],
      ai_track_expectations: input.ai_track_expectations.trim(),
      created_at: new Date().toISOString(),
    };
    const all = loadDemoSurveys(input.session_id);
    all.push(sub);
    saveDemoSurveys(input.session_id, all);
    emitDemo({ eventType: "INSERT", submission: sub });
    return sub;
  }

  async function listSurveys(sessionId: string): Promise<SurveySubmission[]> {
    return loadDemoSurveys(sessionId).slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  async function resetSession(): Promise<GameSession> {
    const old = loadDemoSession();
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
      localStorage.removeItem(demoSurveysKey(sessionId));
    } catch {
      /* ignore */
    }
    refetchHints.forEach((fn) => fn([]));
  }

  function subscribe(sessionId: string, onPayload: (p: RealtimePayload) => void, onList?: (subs: SurveySubmission[]) => void): () => void {
    const payloadListener = (p: RealtimePayload) => {
      if (!p.submission || p.submission.session_id !== sessionId) return;
      onPayload(p);
    };
    const listListener = (subs: SurveySubmission[]) => {
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
    submitSurvey,
    listSurveys,
    resetSession,
    deleteSessionData,
    subscribe,
  };
}

/* ==================================================================
 * Validation (shared by the form and any submission path)
 * ================================================================== */

export type SurveyValidationError =
  | "missing_answer"
  | "bad_answer"
  | "expectations_empty"
  | "expectations_long"
  | "nickname_long";

const optionIds = (key: SurveyQuestionKey) => SURVEY_QUESTIONS.find((q) => q.key === key)?.options.map((o) => o.id) ?? [];

export function validateSurveySubmission(input: {
  answers: Record<SurveyQuestionKey, string | string[]>;
  ai_track_expectations: string;
  nickname: string;
}): { ok: true } | { ok: false; error: SurveyValidationError; questionKey?: SurveyQuestionKey; extra?: string } {
  const nickname = input.nickname.trim();
  if (nickname.length > 50) return { ok: false, error: "nickname_long" };

  for (const q of SURVEY_QUESTIONS) {
    const value = input.answers[q.key];
    const validIds = optionIds(q.key);
    if (q.multiSelect) {
      const arr = Array.isArray(value) ? value : [];
      if (arr.length === 0) return { ok: false, error: "missing_answer", questionKey: q.key };
      if (arr.some((id) => !validIds.includes(id))) return { ok: false, error: "bad_answer", questionKey: q.key };
    } else {
      const v = typeof value === "string" ? value : "";
      if (!v) return { ok: false, error: "missing_answer", questionKey: q.key };
      if (!validIds.includes(v)) return { ok: false, error: "bad_answer", questionKey: q.key };
    }
  }

  const text = input.ai_track_expectations.trim();
  if (!text) return { ok: false, error: "expectations_empty" };
  const max = FINAL_QUESTION.maxLength;
  if (text.length > max) return { ok: false, error: "expectations_long", extra: String(max) };

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