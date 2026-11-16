-- Practice portfolio: $10,000 of play money per user.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.practice_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  started_at timestamptz not null default now()
);

create table if not exists public.practice_trades (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null references public.securities (symbol),
  side text not null check (side in ('buy', 'sell')),
  shares numeric(18, 6) not null check (shares > 0),
  price numeric(14, 4) not null check (price > 0),
  created_at timestamptz not null default now()
);

create index if not exists practice_trades_user_idx on public.practice_trades (user_id, created_at);

-- Row level security: users may READ only their own rows.
-- There are deliberately no insert/update/delete policies, so nobody can write
-- trades from the browser. Only the backend (secret key) can, and it always
-- uses the real latest price.
alter table public.practice_accounts enable row level security;
alter table public.practice_trades enable row level security;

drop policy if exists "read own practice account" on public.practice_accounts;
create policy "read own practice account" on public.practice_accounts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "read own practice trades" on public.practice_trades;
create policy "read own practice trades" on public.practice_trades
  for select to authenticated using ((select auth.uid()) = user_id);

grant select on public.practice_accounts, public.practice_trades to authenticated;
