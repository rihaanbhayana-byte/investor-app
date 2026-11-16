-- =====================================================
-- Investor App: database schema (Step 3)
-- =====================================================

-- 1. One profile per signed-up user
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

-- 2. A user's investment plan: goal, amounts, risk answers
create table if not exists public.investment_plans (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal text not null,
  horizon_years int not null check (horizon_years between 1 and 50),
  initial_amount numeric(14,2) not null check (initial_amount >= 0),
  monthly_contribution numeric(14,2) not null default 0 check (monthly_contribution >= 0),
  risk_answers jsonb,
  risk_score int,
  risk_level text check (risk_level in ('conservative','moderate','aggressive')),
  created_at timestamptz not null default now()
);

-- 3. Stocks and ETFs we track
create table if not exists public.securities (
  symbol text primary key,
  name text not null,
  asset_type text not null check (asset_type in ('stock','etf')),
  sector text,
  cik text
);

-- 4. Daily prices (filled by the nightly data job)
create table if not exists public.daily_prices (
  symbol text not null references public.securities(symbol) on delete cascade,
  date date not null,
  open numeric(14,4),
  high numeric(14,4),
  low numeric(14,4),
  close numeric(14,4) not null,
  volume bigint,
  primary key (symbol, date)
);

-- 5. Yearly company financials (from SEC EDGAR)
create table if not exists public.fundamentals (
  symbol text not null references public.securities(symbol) on delete cascade,
  fiscal_year int not null,
  revenue numeric(20,2),
  net_income numeric(20,2),
  total_assets numeric(20,2),
  total_liabilities numeric(20,2),
  eps numeric(12,4),
  primary key (symbol, fiscal_year)
);

-- 6. Model portfolios and what is in them
create table if not exists public.model_portfolios (
  risk_level text primary key check (risk_level in ('conservative','moderate','aggressive')),
  name text not null,
  description text
);

create table if not exists public.portfolio_holdings (
  risk_level text not null references public.model_portfolios(risk_level) on delete cascade,
  symbol text not null references public.securities(symbol),
  weight numeric(5,4) not null check (weight > 0 and weight <= 1),
  primary key (risk_level, symbol)
);

-- =====================================================
-- Security: turn on Row Level Security for every table
-- =====================================================
alter table public.profiles enable row level security;
alter table public.investment_plans enable row level security;
alter table public.securities enable row level security;
alter table public.daily_prices enable row level security;
alter table public.fundamentals enable row level security;
alter table public.model_portfolios enable row level security;
alter table public.portfolio_holdings enable row level security;

-- Users can only see and edit their own profile and plans
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id);

drop policy if exists "own plans" on public.investment_plans;
create policy "own plans" on public.investment_plans
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Market data and model portfolios are readable by everyone
drop policy if exists "public read" on public.securities;
create policy "public read" on public.securities for select to anon, authenticated using (true);
drop policy if exists "public read" on public.daily_prices;
create policy "public read" on public.daily_prices for select to anon, authenticated using (true);
drop policy if exists "public read" on public.fundamentals;
create policy "public read" on public.fundamentals for select to anon, authenticated using (true);
drop policy if exists "public read" on public.model_portfolios;
create policy "public read" on public.model_portfolios for select to anon, authenticated using (true);
drop policy if exists "public read" on public.portfolio_holdings;
create policy "public read" on public.portfolio_holdings for select to anon, authenticated using (true);

grant select on public.securities, public.daily_prices, public.fundamentals,
  public.model_portfolios, public.portfolio_holdings to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.investment_plans to authenticated;

-- =====================================================
-- Automatically create a profile when someone signs up
-- =====================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =====================================================
-- Starter data: 5 ETFs + 31 well-known stocks
-- =====================================================
insert into public.securities (symbol, name, asset_type, sector) values
  ('VTI',  'Vanguard Total Stock Market ETF',        'etf',   'US stocks'),
  ('VOO',  'Vanguard S&P 500 ETF',                   'etf',   'US stocks'),
  ('QQQ',  'Invesco QQQ Trust',                      'etf',   'US tech-heavy stocks'),
  ('VXUS', 'Vanguard Total International Stock ETF', 'etf',   'International stocks'),
  ('BND',  'Vanguard Total Bond Market ETF',         'etf',   'US bonds'),
  ('AAPL', 'Apple Inc.',                  'stock', 'Technology'),
  ('MSFT', 'Microsoft Corp.',             'stock', 'Technology'),
  ('NVDA', 'NVIDIA Corp.',                'stock', 'Technology'),
  ('ADBE', 'Adobe Inc.',                  'stock', 'Technology'),
  ('CRM',  'Salesforce Inc.',             'stock', 'Technology'),
  ('INTC', 'Intel Corp.',                 'stock', 'Technology'),
  ('AMD',  'Advanced Micro Devices Inc.', 'stock', 'Technology'),
  ('GOOGL','Alphabet Inc. Class A',       'stock', 'Communication Services'),
  ('META', 'Meta Platforms Inc.',         'stock', 'Communication Services'),
  ('NFLX', 'Netflix Inc.',                'stock', 'Communication Services'),
  ('DIS',  'Walt Disney Co.',             'stock', 'Communication Services'),
  ('AMZN', 'Amazon.com Inc.',             'stock', 'Consumer Discretionary'),
  ('TSLA', 'Tesla Inc.',                  'stock', 'Consumer Discretionary'),
  ('HD',   'Home Depot Inc.',             'stock', 'Consumer Discretionary'),
  ('NKE',  'Nike Inc.',                   'stock', 'Consumer Discretionary'),
  ('MCD',  'McDonald''s Corp.',           'stock', 'Consumer Discretionary'),
  ('PG',   'Procter & Gamble Co.',        'stock', 'Consumer Staples'),
  ('KO',   'Coca-Cola Co.',               'stock', 'Consumer Staples'),
  ('PEP',  'PepsiCo Inc.',                'stock', 'Consumer Staples'),
  ('WMT',  'Walmart Inc.',                'stock', 'Consumer Staples'),
  ('COST', 'Costco Wholesale Corp.',      'stock', 'Consumer Staples'),
  ('JPM',  'JPMorgan Chase & Co.',        'stock', 'Financials'),
  ('V',    'Visa Inc.',                   'stock', 'Financials'),
  ('MA',   'Mastercard Inc.',             'stock', 'Financials'),
  ('JNJ',  'Johnson & Johnson',           'stock', 'Health Care'),
  ('UNH',  'UnitedHealth Group Inc.',     'stock', 'Health Care'),
  ('LLY',  'Eli Lilly and Co.',           'stock', 'Health Care'),
  ('XOM',  'Exxon Mobil Corp.',           'stock', 'Energy'),
  ('CVX',  'Chevron Corp.',               'stock', 'Energy'),
  ('BA',   'Boeing Co.',                  'stock', 'Industrials'),
  ('CAT',  'Caterpillar Inc.',            'stock', 'Industrials')
on conflict (symbol) do nothing;

insert into public.model_portfolios (risk_level, name, description) values
  ('conservative', 'Steady Saver',     'Mostly bonds for stability, with some stocks for growth.'),
  ('moderate',     'Balanced Builder', 'A mix of stocks and bonds for steady long-term growth.'),
  ('aggressive',   'Growth Seeker',    'Mostly stocks for higher long-term growth, with bigger ups and downs.')
on conflict (risk_level) do nothing;

insert into public.portfolio_holdings (risk_level, symbol, weight) values
  ('conservative', 'BND',  0.60), ('conservative', 'VTI', 0.30), ('conservative', 'VXUS', 0.10),
  ('moderate',     'BND',  0.35), ('moderate',     'VTI', 0.45), ('moderate',     'VXUS', 0.20),
  ('aggressive',   'BND',  0.10), ('aggressive',   'VTI', 0.55), ('aggressive',   'VXUS', 0.20),
  ('aggressive',   'QQQ',  0.15)
on conflict (risk_level, symbol) do nothing;
