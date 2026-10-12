-- =====================================================================
-- Single active session guarantee
--
-- Session creation now happens through the host-actions Edge Function
-- (`ensure_session`, service role). This partial unique index makes that
-- create idempotent even under concurrent requests: at most one row may
-- have status = 'active' at any time.
-- =====================================================================

create unique index if not exists game_sessions_single_active_idx
  on public.game_sessions ((status)) where status = 'active';
