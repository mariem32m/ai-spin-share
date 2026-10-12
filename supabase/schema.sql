-- =====================================================================
-- AI Through Your Eyes — Supabase schema
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Game sessions (one active at a time; history is kept after resets)
-- ---------------------------------------------------------------------
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'AI Through Your Eyes',
  status text not null default 'active' check (status in ('active', 'ended')),
  allow_repeat_participation boolean not null default true,
  registration_url text,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Guarantee at most ONE active session at a time (session creation goes
-- through the host-actions Edge Function, which relies on this constraint).
create unique index if not exists game_sessions_single_active_idx
  on public.game_sessions ((status)) where status = 'active';

-- ---------------------------------------------------------------------
-- Survey submissions (the questionnaire answers)
--
-- Stores one row per completed survey. Answers are stored as option ids
-- (language-independent). Questions 3 and 5 accept multiple selections
-- and are stored as text[] arrays.
-- ---------------------------------------------------------------------
create table if not exists public.survey_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  nickname text check (nickname is null or char_length(nickname) between 1 and 50),
  question_1_answer text not null check (question_1_answer in (
    'new_to_ai', 'basic_concepts', 'use_tools_only', 'understands_ml', 'built_project'
  )),
  question_2_answer text not null check (question_2_answer in (
    'almost_every_day', 'sometimes', 'once_or_twice', 'not_yet'
  )),
  question_3_answer text[] not null
    check (
      cardinality(question_3_answer) between 1 and 5
      and question_3_answer <@ array[
        'answer_and_generate', 'analyze_and_patterns', 'vision_and_language',
        'predictions_decisions', 'all_of_the_above'
      ]
    ),
  question_4_answer text not null check (question_4_answer in (
    'always_correct', 'usually_but_mistakes', 'sometimes_biased', 'not_sure'
  )),
  question_5_answer text[] not null
    check (
      cardinality(question_5_answer) between 1 and 8
      and question_5_answer <@ array[
        'machine_learning', 'deep_learning', 'generative_ai', 'ai_agents',
        'computer_vision', 'nlp', 'building_projects', 'exploring'
      ]
    ),
  ai_track_expectations text not null check (char_length(ai_track_expectations) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists survey_submissions_session_created_idx
  on public.survey_submissions (session_id, created_at desc);

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- Students (public anon role) can ONLY insert one survey submission.
-- They can NOT read survey answers — responses are private organizer
-- data and are only readable through the `host-actions` Edge Function
-- (service-role key + host bearer token).
-- ---------------------------------------------------------------------
alter table public.survey_submissions enable row level security;

drop policy if exists "public insert survey submissions" on public.survey_submissions;
create policy "public insert survey submissions"
  on public.survey_submissions for insert to anon, authenticated
  with check (
    (nickname is null or char_length(nickname) between 1 and 50)
    and question_1_answer in (
      'new_to_ai', 'basic_concepts', 'use_tools_only', 'understands_ml', 'built_project'
    )
    and question_2_answer in (
      'almost_every_day', 'sometimes', 'once_or_twice', 'not_yet'
    )
    and cardinality(question_3_answer) between 1 and 5
    and question_3_answer <@ array[
      'answer_and_generate', 'analyze_and_patterns', 'vision_and_language',
      'predictions_decisions', 'all_of_the_above'
    ]
    and question_4_answer in (
      'always_correct', 'usually_but_mistakes', 'sometimes_biased', 'not_sure'
    )
    and cardinality(question_5_answer) between 1 and 8
    and question_5_answer <@ array[
      'machine_learning', 'deep_learning', 'generative_ai', 'ai_agents',
      'computer_vision', 'nlp', 'building_projects', 'exploring'
    ]
    and char_length(ai_track_expectations) between 1 and 500
  );

-- NOTE: No select/update/delete policies exist for survey_submissions.

-- ---------------------------------------------------------------------
-- Student submissions (legacy spin-every game — kept for reference)
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
-- (survey_submissions intentionally NOT in realtime: responses are
-- private and the dashboard polls the protected Edge Function instead.)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.submissions;