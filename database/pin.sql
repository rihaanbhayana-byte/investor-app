-- =====================================================================
-- Seedwise: 6-digit PIN for quick unlock (run once in the Supabase SQL Editor). Safe to run more than once.
-- Only a salted hash of the PIN is stored. Row Level Security is on with NO policies,
-- so the browser can never read this table; only the backend (secret key) can.
-- =====================================================================
create table if not exists public.user_pins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pin_hash text not null,                -- pbkdf2-sha256, 200,000 rounds, random salt
  failed_attempts int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.user_pins enable row level security;
revoke all on public.user_pins from anon, authenticated;

-- ---------------------------------------------------------------------
-- Log in with PIN: devices that are allowed to log in with the PIN.
-- Each device keeps a long random key; only its hash is stored here.
-- Removing the PIN (or 5 wrong tries) removes every device too.
-- ---------------------------------------------------------------------
create table if not exists public.pin_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_pins (user_id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists pin_devices_user_idx on public.pin_devices (user_id);

alter table public.pin_devices enable row level security;
revoke all on public.pin_devices from anon, authenticated;
