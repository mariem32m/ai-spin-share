import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when both Supabase credentials are configured. */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;

/** Prefix used for demo-mode localStorage keys. */
export const DEMO_STORE_KEY = "aispinshare:demo:v1";

/** Session id used in demo mode. */
export const DEMO_SESSION_ID = "demo-session";

/** Host moderation hash from env (SHA-256) or empty when not configured. */
export const HOST_HASH = (import.meta.env.VITE_HOST_HASH as string | undefined) ?? "";

/** Env-provided official registration URL (fallback for demo sessions). */
export const ENV_REGISTRATION_URL =
  (import.meta.env.VITE_REGISTRATION_URL as string | undefined) ?? "";

/** Min ms between submissions from one device. */
export const MIN_SUBMIT_INTERVAL_MS = Number(
  (import.meta.env.VITE_MIN_SUBMIT_INTERVAL_MS as string | undefined) ?? "10000",
);

/** Public base URL for share links / QR (falls back to current origin). */
export function publicBaseUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Full student join URL. */
export function studentJoinUrl(): string {
  return `${publicBaseUrl()}/play`;
}

/**
 * Call the server-side host action (Supabase Edge Function) for
 * privileged management: moderation, session reset, config, deletion.
 * The SHA-256 host hash is sent as a bearer token — never a password.
 * In demo mode host actions run locally, so this is never called.
 */
export async function callHostAction(
  action: "list" | "set_moderation" | "reset_session" | "update_config" | "delete_session",
  args: Record<string, unknown>,
): Promise<{ ok: true } & Record<string, unknown>> {
  if (!isSupabaseConfigured || !url) {
    throw new Error("Host actions require the Supabase Edge Function. See README.");
  }
  if (!HOST_HASH) {
    throw new Error("Configure VITE_HOST_HASH to enable host actions.");
  }
  const fnUrl = `${url}/functions/v1/host-actions`;
  const res = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HOST_HASH}`,
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