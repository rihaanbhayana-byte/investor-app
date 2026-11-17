-- =====================================================================
-- Seedwise: thumbs up / down on AI answers  (run once in the Supabase SQL Editor)
-- Safe to run more than once.
-- =====================================================================
create table if not exists public.ai_feedback (
  id bigint generated always as identity primary key,
  feature text not null,                       -- e.g. coach, explain, matcher, strategy
  helpful boolean not null,
  confidence_level text,                       -- the confidence we showed: high / medium / low
  note text,                                   -- optional short context (never personal data)
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_feedback_feature_idx on public.ai_feedback (feature, created_at);

-- Only the backend (secret key) reads or writes this table. No public access.
alter table public.ai_feedback enable row level security;
