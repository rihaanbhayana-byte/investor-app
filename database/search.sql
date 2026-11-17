-- =====================================================================
-- Seedwise: search any US stock or ETF  (run once in the Supabase SQL Editor)
-- Safe to run more than once.
-- =====================================================================

-- 1. Fuzzy text search (finds "nvidea" -> NVIDIA)
create extension if not exists pg_trgm with schema extensions;

-- 2. Mark our 36 hand-picked stocks as "featured".
--    Stocks that users add later by searching get featured = false.
alter table public.securities add column if not exists featured boolean not null default true;

-- 3. Every US-listed stock and ETF (about 12,000), filled weekly by the nightly data job
create table if not exists public.symbols (
  symbol text primary key,
  name text not null,
  asset_type text not null check (asset_type in ('stock', 'etf')),
  exchange text,
  cik text,
  updated_at timestamptz not null default now()
);

create index if not exists symbols_name_trgm on public.symbols using gin (name extensions.gin_trgm_ops);
create index if not exists symbols_symbol_trgm on public.symbols using gin (symbol extensions.gin_trgm_ops);

alter table public.symbols enable row level security;
drop policy if exists "public read" on public.symbols;
create policy "public read" on public.symbols for select to anon, authenticated using (true);
grant select on public.symbols to anon, authenticated;

-- 4. The search the website calls as you type: best matches first.
--    Exact ticker > ticker starting with what you typed > name match (typos allowed);
--    our featured stocks get a small boost.
create or replace function public.search_symbols(q text, max_results int default 8)
returns table (symbol text, name text, asset_type text, exchange text, featured boolean, in_app boolean)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with input as (
    select upper(trim(q)) as uq, trim(q) as raw
  ),
  everything as (
    select s.symbol, s.name, s.asset_type, s.exchange from public.symbols s
    union all
    -- our own stocks, even before the symbol list has been loaded
    select sec.symbol, sec.name, sec.asset_type, null from public.securities sec
    where not exists (select 1 from public.symbols s2 where s2.symbol = sec.symbol)
  ),
  scored as (
    select e.*,
           coalesce(sec.featured, false) as featured,
           sec.symbol is not null as in_app,
           (case when e.symbol = i.uq then 100
                 when e.symbol like i.uq || '%' then 60 - length(e.symbol)
                 else 0 end
            + 45 * greatest(similarity(e.name, i.raw), word_similarity(i.raw, e.name))
            + case when e.name ilike '%' || i.raw || '%' then 15 else 0 end
            + case when sec.featured then 12 else 0 end) as score
    from everything e
    cross join input i
    left join public.securities sec on sec.symbol = e.symbol
    where length(i.raw) > 0
      and (e.symbol like i.uq || '%'
           or (length(i.raw) >= 2 and (e.name ilike '%' || i.raw || '%'
                                       or word_similarity(i.raw, e.name) > case when length(i.raw) <= 4 then 0.6 else 0.45 end)))
  )
  select symbol, name, asset_type, exchange, featured, in_app
  from scored
  order by score desc, length(symbol), symbol
  limit least(greatest(max_results, 1), 20);
$$;

grant execute on function public.search_symbols(text, int) to anon, authenticated;
