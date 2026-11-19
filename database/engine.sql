-- Seedwise portfolio engine: the 26 index funds it can choose from.
-- Run once in Supabase (SQL Editor). Safe to run again: funds already there are left alone.
-- Then run the "Nightly data refresh" workflow once in GitHub so it loads their prices since 2016.

insert into public.securities (symbol, name, asset_type, sector) values
  ('VTI', 'Vanguard Total Stock Market ETF', 'etf', 'US stocks'),
  ('VOO', 'Vanguard S&P 500 ETF', 'etf', 'US stocks'),
  ('VTV', 'Vanguard Value ETF', 'etf', 'US stocks'),
  ('VUG', 'Vanguard Growth ETF', 'etf', 'US stocks'),
  ('VB', 'Vanguard Small-Cap ETF', 'etf', 'US stocks'),
  ('QQQ', 'Invesco QQQ Trust', 'etf', 'US stocks'),
  ('SCHD', 'Schwab US Dividend Equity ETF', 'etf', 'US stocks'),
  ('VIG', 'Vanguard Dividend Appreciation ETF', 'etf', 'US stocks'),
  ('VXUS', 'Vanguard Total International Stock ETF', 'etf', 'International'),
  ('VEA', 'Vanguard FTSE Developed Markets ETF', 'etf', 'International'),
  ('VWO', 'Vanguard FTSE Emerging Markets ETF', 'etf', 'International'),
  ('XLK', 'Technology Select Sector SPDR', 'etf', 'US stocks'),
  ('XLV', 'Health Care Select Sector SPDR', 'etf', 'US stocks'),
  ('XLF', 'Financial Select Sector SPDR', 'etf', 'US stocks'),
  ('XLE', 'Energy Select Sector SPDR', 'etf', 'US stocks'),
  ('XLP', 'Consumer Staples Select Sector SPDR', 'etf', 'US stocks'),
  ('XLU', 'Utilities Select Sector SPDR', 'etf', 'US stocks'),
  ('VNQ', 'Vanguard Real Estate ETF', 'etf', 'Real assets'),
  ('IAU', 'iShares Gold Trust', 'etf', 'Real assets'),
  ('BND', 'Vanguard Total Bond Market ETF', 'etf', 'Bonds'),
  ('BNDX', 'Vanguard Total International Bond ETF', 'etf', 'Bonds'),
  ('VGSH', 'Vanguard Short-Term Treasury ETF', 'etf', 'Bonds'),
  ('VGIT', 'Vanguard Intermediate-Term Treasury ETF', 'etf', 'Bonds'),
  ('VCIT', 'Vanguard Intermediate-Term Corporate Bond ETF', 'etf', 'Bonds'),
  ('VTIP', 'Vanguard Short-Term Inflation-Protected Securities ETF', 'etf', 'Bonds'),
  ('TLT', 'iShares 20+ Year Treasury Bond ETF', 'etf', 'Bonds')
on conflict (symbol) do nothing;
