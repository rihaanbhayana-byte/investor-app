-- =====================================================================
-- Seedwise: profile settings (run once in the Supabase SQL Editor). Safe to run more than once.
-- Adds the "weekly email" switch from the Profile page.
-- =====================================================================
alter table public.profiles add column if not exists weekly_email boolean not null default false;
alter table public.profiles add column if not exists last_email_at timestamptz;

-- people who signed up before the profile trigger existed get a profile row too
insert into public.profiles (id, full_name)
select u.id, u.raw_user_meta_data ->> 'full_name' from auth.users u
on conflict (id) do nothing;
