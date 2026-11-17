-- =====================================================================
-- Seedwise: watchlist (run once in the Supabase SQL Editor). Safe to run more than once.
-- Each person stars stocks they want to follow. Only they can see or change their list.
-- =====================================================================
create table if not exists public.watchlist (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  symbol text not null references public.securities (symbol) on delete cascade,
  added_price numeric,                         -- price when starred, to show "since you added it"
  added_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

alter table public.watchlist enable row level security;

drop policy if exists "own watchlist" on public.watchlist;
create policy "own watchlist" on public.watchlist
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- keep lists a sensible size
create or replace function public.watchlist_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.watchlist where user_id = new.user_id) >= 50 then
    raise exception 'Your watchlist is full (50 stocks). Remove one to add another.';
  end if;
  return new;
end $$;
drop trigger if exists watchlist_limit on public.watchlist;
create trigger watchlist_limit before insert on public.watchlist
  for each row execute function public.watchlist_limit();
