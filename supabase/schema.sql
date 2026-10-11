-- =====================================================================
-- AI Spin & Share — Supabase schema
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Game sessions (one active at a time; history is kept after resets)
-- ---------------------------------------------------------------------
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'AI Spin & Share',
  status text not null default 'active' check (status in ('active', 'ended')),
  allow_repeat_participation boolean not null default true,
  registration_url text,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

-- ---------------------------------------------------------------------
-- Student submissions
-- ---------------------------------------------------------------------
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  student_name text not null check (char_length(student_name) between 1 and 50),
  challenge_type text not null
    check (challenge_type in ('ai_is', 'my_ai_story', 'if_i_built_ai')),
  answer text not null check (char_length(answer) between 1 and 500),
  moderation_status text not null default 'visible'
    check (moderation_status in ('visible', 'hidden')),
  created_at timestamptz not null default now()
);

create index if not exists submissions_session_created_idx
  on public.submissions (session_id, created_at desc);
create index if not exists submissions_moderation_idx
  on public.submissions (moderation_status);

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- Public students can ONLY:
--   * select the active session(s)
--   * select VISIBLE submissions (hidden ones are never exposed publicly)
--   * insert one submission (with hard length checks)
-- Public users CANNOT update, hide, restore, reset or delete anything.
-- All moderation/administration goes through the `host-actions` Edge
-- Function, which uses the service-role key + host bearer token.
-- ---------------------------------------------------------------------
alter table public.game_sessions enable row level security;
alter table public.submissions enable row level security;

drop policy if exists "public read active sessions" on public.game_sessions;
create policy "public read active sessions"
  on public.game_sessions for select to anon, authenticated
  using (true);

drop policy if exists "public read visible submissions" on public.submissions;
create policy "public read visible submissions"
  on public.submissions for select to anon, authenticated
  using (moderation_status = 'visible');

drop policy if exists "public insert submissions" on public.submissions;
create policy "public insert submissions"
  on public.submissions for insert to anon, authenticated
  with check (
    char_length(student_name) between 1 and 50
    and char_length(answer) between 1 and 500
    and challenge_type in ('ai_is', 'my_ai_story', 'if_i_built_ai')
  );

-- NOTE: No update/delete policies exist for public roles.

-- ---------------------------------------------------------------------
-- Realtime: broadcast submissions so the wall updates live.
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.submissions;