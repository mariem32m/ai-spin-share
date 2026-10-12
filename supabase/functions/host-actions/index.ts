// =====================================================================
// AI Through Your Eyes — host-actions Edge Function
//
// Protects every privileged action with host authentication and runs
// with the service-role key, so students can never call it directly.
//
// Two host authentication modes (either authorizes):
//
//   1. Legacy host bearer hash — the SHA-256 hex configured in the
//      frontend as VITE_HOST_HASH and here as the HOST_HASH secret.
//   2. Supabase Auth organizer account — the client presents a real
//      user JWT; the user's email must be in the HOST_EMAILS allow-list
//      (comma-separated). This is the recommended production mode: the
//      organizer's password never leaves the browser session.
//
// Reading survey responses is privileged: the public anon key has NO SELECT
// policy on survey_submissions, so the dashboard fetches the list here.
//
// Deploy:
//   supabase functions deploy host-actions --no-verify-jwt
//   supabase secrets set HOST_HASH=<hex>   (optional, legacy mode)
//   supabase secrets set HOST_EMAILS=name@example.com (optional, account mode)
//   supabase secrets set ALLOWED_ORIGINS=https://your-app.vercel.app (optional;
//     when unset the request Origin is reflected, which is safe as no cookies
//     are used)
//
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const HOST_HASH = Deno.env.get("HOST_HASH") ?? "";
const HOST_EMAILS = Deno.env.get("HOST_EMAILS") ?? "";

const ALLOWED_STATUS = ["visible", "hidden"];

// Optional comma-separated allow-list, e.g. "https://ai-spin-share.vercel.app".
// When unset, the caller's Origin is reflected (safe here: no cookies are
// used, and privileged actions still require a valid JWT/host hash).
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (ALLOWED_ORIGINS.length === 0) {
    headers["Access-Control-Allow-Origin"] = origin ?? "*";
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hostEmails(): string[] {
  return HOST_EMAILS.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Return true when the presented bearer token is authorized to manage
 * host data. Checks the legacy host hash, then a Supabase Auth JWT whose
 * user email is allow-listed via HOST_EMAILS.
 */
async function isAuthorized(token: string): Promise<boolean> {
  if (!token) return false;

  // 1) Legacy host-password hash.
  if (HOST_HASH && (await sha256Hex(token)) === HOST_HASH) return true;

  // 2) Supabase Auth organizer account (safe default: disabled until
  //    HOST_EMAILS is configured).
  const allowed = hostEmails();
  if (allowed.length === 0) return false;

  const auth = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user || !data.user.email) return false;
  return allowed.includes(data.user.email.toLowerCase());
}

function json(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  // CORS preflight.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  /** Response helper that always attaches CORS headers. */
  const out = (body: unknown, status = 200) => json(body, status, origin);

  if (req.method !== "POST") return out({ ok: false, message: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return out({ ok: false, message: "Invalid JSON" }, 400);
  }

  const action = String(body.action ?? "");

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- Host authentication -------------------------------------------------
  // `ensure_session` is the one PUBLIC action: it just resolves (or lazily
  // creates) the single active session so students can submit before the host
  // has opened the dashboard. It exposes no response data. Everything else
  // requires host authentication.
  if (action !== "ensure_session") {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!(await isAuthorized(token))) {
      return out({ ok: false, message: "Unauthorized" }, 401);
    }
  }

  try {
    switch (action) {
      // PUBLIC: resolve the active session, creating a default one if none
      // exists. Idempotent; a partial unique index guarantees at most one
      // active session.
      case "ensure_session": {
        const { data, error } = await db
          .from("game_sessions")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data) return out({ ok: true, session: data });

        const { data: created, error: insertError } = await db
          .from("game_sessions")
          .insert({ name: "AI Through Your Eyes", status: "active", allow_repeat_participation: true })
          .select()
          .single();
        if (insertError) {
          // Lost a race — re-read the winner.
          const { data: again } = await db
            .from("game_sessions")
            .select("*")
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (again) return out({ ok: true, session: again });
          throw insertError;
        }
        return out({ ok: true, session: created });
      }

      // Full private survey response list for the organizer dashboard.
      // Public users can never reach this action (host bearer required) nor
      // read the table directly (no SELECT policy).
      case "survey_list": {
        const sessionId = String(body.session_id ?? "");
        const { data, error } = await db
          .from("survey_submissions")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return out({ ok: true, surveys: data });
      }

      // Full moderation list (includes hidden items for the host UI).
      case "list": {
        const sessionId = String(body.session_id ?? "");
        const { data, error } = await db
          .from("submissions")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return out({ ok: true, submissions: data });
      }

      // Hide / restore one submission.
      case "set_moderation": {
        const id = String(body.id ?? "");
        const status = String(body.status ?? "");
        if (!ALLOWED_STATUS.includes(status)) return out({ ok: false, message: "Invalid status" }, 400);
        const { data, error } = await db
          .from("submissions")
          .update({ moderation_status: status })
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return out({ ok: true, submission: data });
      }

      // Update session configuration.
      case "update_config": {
        const sessionId = String(body.session_id ?? "");
        const patch: Record<string, unknown> = {};
        if (typeof body.allow_repeat_participation === "boolean") patch.allow_repeat_participation = body.allow_repeat_participation;
        if (typeof body.registration_url === "string") patch.registration_url = body.registration_url || null;
        const { data, error } = await db.from("game_sessions").update(patch).eq("id", sessionId).select().single();
        if (error) throw error;
        return out({ ok: true, session: data });
      }

      // Start a brand-new session (archive the old one — history kept).
      case "reset_session": {
        const sessionId = String(body.session_id ?? "");
        await db
          .from("game_sessions")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("id", sessionId);
        const { data, error } = await db
          .from("game_sessions")
          .insert({ name: "AI Through Your Eyes", status: "active", allow_repeat_participation: true })
          .select()
          .single();
        if (error) throw error;
        return out({ ok: true, session: data });
      }

      // Permanent deletion — the host explicitly confirms in the UI.
      case "delete_session": {
        const sessionId = String(body.session_id ?? "");
        await db.from("survey_submissions").delete().eq("session_id", sessionId);
        await db.from("submissions").delete().eq("session_id", sessionId);
        await db.from("game_sessions").delete().eq("id", sessionId);
        return out({ ok: true });
      }

      default:
        return out({ ok: false, message: "Unknown action" }, 400);
    }
  } catch (e) {
    return out({ ok: false, message: e instanceof Error ? e.message : "Host action failed" }, 500);
  }
});