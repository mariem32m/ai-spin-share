/**
 * PUBLIC build-time defaults — safe to commit to the repository.
 *
 * These are the Supabase *client* connection values plus the deployed public
 * URL. The Supabase anon (publishable) key is designed to be public: it is
 * shipped inside the JavaScript bundle served to every visitor, so it is not
 * a secret. What actually protects the data is Row Level Security plus the
 * `host-actions` Edge Function — not hiding this key.
 *
 * NEVER put the service_role key, the database password, an access token, or
 * any real secret in this file or anywhere else in the frontend.
 *
 * A platform environment variable (e.g. Vercel `VITE_SUPABASE_URL`) always
 * takes precedence, so these defaults can be overridden without code changes.
 */

/** Supabase project URL (public). */
export const PUBLIC_SUPABASE_URL = "https://igbtbcnjecksafvdanip.supabase.co";

/**
 * Supabase anon/publishable key (public by design). Restricts nothing on its
 * own: with RLS enabled, anon can only INSERT survey answers and can never
 * read them back.
 */
export const PUBLIC_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnYnRiY25qZWNrc2FmdmRhbmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3ODczNTMsImV4cCI6MjEwNzM2MzM1M30.XYZYu75xbXdBAoS4JzkRJr7-O2FKZl5A5mTTfvf9gNU";

/** Deployed public base URL used for the QR / share link (public). */
export const PUBLIC_BASE_URL = "https://ai-spin-share.vercel.app";

/** Minimum milliseconds between two submissions from the same device. */
export const PUBLIC_MIN_SUBMIT_INTERVAL_MS = "10000";
