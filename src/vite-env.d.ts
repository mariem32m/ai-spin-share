/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_PUBLIC_BASE_URL?: string;
  readonly VITE_REGISTRATION_URL?: string;
  readonly VITE_HOST_HASH?: string;
  readonly VITE_MIN_SUBMIT_INTERVAL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}