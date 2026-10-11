// =====================================================================
// AI Spin & Share — host-actions Edge Function
//
// Protects every privileged action with a host bearer token (the SHA-256
// hash configured as VITE_HOST_HASH in the frontend + HOST_HASH here) and
// runs with the service-role key, so students can never call it.
//
// Deploy:
//   supabase functions deploy host-actions --no-verify-jwt
//   supabase secrets set HOST_HASH=<the same SHA-256 hex as VITE_HOST_HASH>
//
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const HOST_HASH = Deno.env.get("HOST_HASH") ?? "";

const ALLOWED_STATUS = ["visible", "hidden"];

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405);

  // ---- Host authentication -------------------------------------------------
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const tokenHash = await sha256Hex(token);
  if (!HOST_HASH || tokenHash !== HOST_HASH) {
    return json({ ok: false, message: "Unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, message: "Invalid JSON" }, 400);
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const action = String(body.action ?? "");

  try {
    switch (action) {
      // Full moderation list (includes hidden items for the host UI).
      case "list": {
        const sessionId = String(body.session_id ?? "");
        const { data, error } = await db
          .from("submissions")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ ok: true, submissions: data });
      }

      // Hide / restore one submission.
      case "set_moderation": {
        const id = String(body.id ?? "");
        const status = String(body.status ?? "");
        if (!ALLOWED_STATUS.includes(status)) return json({ ok: false, message: "Invalid status" }, 400);
        const { data, error } = await db
          .from("submissions")
          .update({ moderation_status: status })
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return json({ ok: true, submission: data });
      }

      // Update session configuration.
      case "update_config": {
        const sessionId = String(body.session_id ?? "");
        const patch: Record<string, unknown> = {};
        if (typeof body.allow_repeat_participation === "boolean") patch.allow_repeat_participation = body.allow_repeat_participation;
        if (typeof body.registration_url === "string") patch.registration_url = body.registration_url || null;
        const { data, error } = await db.from("game_sessions").update(patch).eq("id", sessionId).select().single();
        if (error) throw error;
        return json({ ok: true, session: data });
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
          .insert({ name: "AI Spin & Share", status: "active", allow_repeat_participation: true })
          .select()
          .single();
        if (error) throw error;
        return json({ ok: true, session: data });
      }

      // Permanent deletion — the host explicitly confirms in the UI.
      case "delete_session": {
        const sessionId = String(body.session_id ?? "");
        await db.from("submissions").delete().eq("session_id", sessionId);
        await db.from("game_sessions").delete().eq("id", sessionId);
        return json({ ok: true });
      }

      default:
        return json({ ok: false, message: "Unknown action" }, 400);
    }
  } catch (e) {
    return json({ ok: false, message: e instanceof Error ? e.message : "Host action failed" }, 500);
  }
});