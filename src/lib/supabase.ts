import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY,
  PUBLIC_BASE_URL,
  PUBLIC_MIN_SUBMIT_INTERVAL_MS,
} from "./publicConfig";

// Platform env vars override the committed public defaults (see publicConfig).
// The committed defaults apply to PRODUCTION builds only, so local dev and
// unit tests stay in demo mode unless a local .env explicitly opts into live.
const prodDefaults = import.meta.env.PROD;
const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || (prodDefaults ? PUBLIC_SUPABASE_URL : "");
const anonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (prodDefaults ? PUBLIC_SUPABASE_ANON_KEY : "");

/** True when both Supabase credentials are configured. */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;

/** Prefix used for demo-mode localStorage keys. */
export const DEMO_STORE_KEY = "aiyourseyes:demo:v1";

/** Session id used in demo mode. */
export const DEMO_SESSION_ID = "demo-session";

/** Host moderation hash from env (SHA-256) or empty when not configured. */
export const HOST_HASH = (import.meta.env.VITE_HOST_HASH as string | undefined) ?? "";

/** Min ms between submissions from one device. */
export const MIN_SUBMIT_INTERVAL_MS = Number(
  (import.meta.env.VITE_MIN_SUBMIT_INTERVAL_MS as string | undefined) || PUBLIC_MIN_SUBMIT_INTERVAL_MS,
);

/** Public base URL for share links / QR (env → prod default → origin). */
export function publicBaseUrl(): string {
  const configured =
    (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined) ||
    (import.meta.env.PROD ? PUBLIC_BASE_URL : "");
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/* ------------------------------------------------------------------
 * Host authentication
 *
 * Privileged dashboard operations run through the `host-actions` Edge
 * Function. Two ways to authenticate, both stronger than the anon key:
 *
 * 1. Legacy host-password hash (`VITE_HOST_HASH`). NOTE: because this
 *    value is embedded in the public JS bundle, it is not a secret on
 *    its own — it only gates the dashboard UI.
 * 2. A real Supabase Auth session (organizer account, email allow-listed
 *    as `HOST_EMAILS` on the Edge Function). The password never enters
 *    the bundle. Prefer this in production.
 * ------------------------------------------------------------------ */

let hostHostUserEmail: string | null = null;

/** Current Supabase Auth access token after organizer sign-in, or null. */
let hostSessionToken: string | null = null;

/**
 * Resolve the organizer bearer token, refreshing from the persisted Supabase
 * Auth session when the in-memory cache is empty (e.g. after a page reload).
 * Returns null when the organizer is not signed in.
 */
async function currentHostToken(): Promise<string | null> {
  if (hostSessionToken) return hostSessionToken;
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session?.access_token) {
      hostSessionToken = session.access_token;
      hostHostUserEmail = session.user?.email ?? hostHostUserEmail;
      return hostSessionToken;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Email of the signed-in organizer (for showing in the dashboard). */
export function organizerEmail(): string | null {
  return hostHostUserEmail;
}

/** Sign in the organizer with a real Supabase Auth account. */
export async function signInOrganizer(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  hostHostUserEmail = data.user?.email ?? null;
  hostSessionToken = data.session?.access_token ?? null;
  if (!hostSessionToken) throw new Error("Sign-in returned no session.");
}

/** Sign out the organizer and drop the cached token. */
export async function signOutOrganizer(): Promise<void> {
  hostHostUserEmail = null;
  hostSessionToken = null;
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Bearer token for privileged host actions: the Supabase Auth JWT when an
 * organizer is signed in (cache or persisted session), otherwise the
 * configured host hash (legacy fallback).
 */
export async function hostBearerToken(): Promise<string> {
  return (await currentHostToken()) ?? HOST_HASH;
}

/** Full student join URL. */
export function studentJoinUrl(): string {
  return `${publicBaseUrl()}/survey`;
}

/** Survey landing URL (public welcome together with join URL). */
export function surveyWelcomeUrl(): string {
  return publicBaseUrl();
}

/**
 * Call the server-side host action (Supabase Edge Function) for
 * privileged management: reading survey responses, moderation, session
 * reset, config, deletion. The SHA-256 host hash is sent as a bearer
 * token — never a password. In demo mode host actions run locally, so
 * this is never called.
 */
export async function callHostAction(
  action: "survey_list" | "list" | "set_moderation" | "reset_session" | "update_config" | "delete_session",
  args: Record<string, unknown>,
): Promise<{ ok: true } & Record<string, unknown>> {
  if (!isSupabaseConfigured || !url) {
    throw new Error("Host actions require the Supabase Edge Function. See README.");
  }
  // A signed-in organizer (Supabase Auth JWT, cached or persisted) or the
  // configured legacy host hash.
  const bearer = await hostBearerToken();
  if (!bearer) {
    throw new Error("Sign in as an organizer or configure VITE_HOST_HASH to enable host actions.");
  }
  const fnUrl = `${url}/functions/v1/host-actions`;
  const res = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({ action, ...args }),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      /* keep statusText */
    }
    throw new Error(`Host action failed (${res.status}): ${detail}. Deploy supabase/functions/host-actions.`);
  }
  return (await res.json()) as { ok: true } & Record<string, unknown>;
}

/**
 * Call a PUBLIC (unauthenticated) Edge Function action. The only such action
 * is `ensure_session`: it resolves or lazily creates the single active survey
 * session so students can submit even before the organizer opens the
 * dashboard. It exposes no response data.
 */
export async function callPublicAction(
  action: "ensure_session",
  args: Record<string, unknown> = {},
): Promise<{ ok: true } & Record<string, unknown>> {
  if (!isSupabaseConfigured || !url) {
    throw new Error("Supabase is not configured.");
  }
  const res = await fetch(`${url}/functions/v1/host-actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...args }),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      /* keep statusText */
    }
    throw new Error(`Action failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as { ok: true } & Record<string, unknown>;
}