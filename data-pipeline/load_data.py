"""
Investor App - data loader

Downloads daily prices (Alpaca) and yearly company financials (SEC EDGAR)
for every symbol in the `securities` table, and saves them to Supabase.

First run: loads history since 2016. Later runs: only fetch what is new.

Usage:
    python data-pipeline/load_data.py                 # prices + financials
    python data-pipeline/load_data.py --prices        # prices only
    python data-pipeline/load_data.py --fundamentals  # financials only
"""

import argparse
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

# ------------------------------------------------------------------
# Settings (read from the .env file locally, or GitHub secrets later)
# ------------------------------------------------------------------
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def require(name):
    value = os.getenv(name, "").strip()
    if not value:
        sys.exit(f"Missing {name}. Add it to your .env file.")
    return value


SUPABASE_URL = require("SUPABASE_URL").rstrip("/")
SUPABASE_SECRET_KEY = require("SUPABASE_SECRET_KEY")
ALPACA_KEY_ID = require("ALPACA_KEY_ID")
ALPACA_SECRET_KEY = require("ALPACA_SECRET_KEY")
SEC_USER_AGENT = require("SEC_USER_AGENT")

HISTORY_START = date(2016, 1, 1)
YEARS_OF_FUNDAMENTALS = 10

DB_HEADERS = {"apikey": SUPABASE_SECRET_KEY, "Content-Type": "application/json"}
ALPACA_HEADERS = {"APCA-API-KEY-ID": ALPACA_KEY_ID, "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY}
SEC_HEADERS = {"User-Agent": SEC_USER_AGENT}

http = requests.Session()


# ------------------------------------------------------------------
# Database helpers (Supabase REST API)
# ------------------------------------------------------------------
def db_get(table, params):
    r = http.get(f"{SUPABASE_URL}/rest/v1/{table}", headers=DB_HEADERS, params=params, timeout=30)
    if r.status_code >= 300:
        sys.exit(f"Reading {table} failed ({r.status_code}): {r.text}")
    return r.json()


def db_upsert(table, rows, conflict_columns):
    """Insert rows, or update them if they already exist."""
    headers = {**DB_HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"}
    for i in range(0, len(rows), 1000):
        r = http.post(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers=headers,
            params={"on_conflict": conflict_columns},
            json=rows[i:i + 1000],
            timeout=60,
        )
        if r.status_code >= 300:
            sys.exit(f"Saving to {table} failed ({r.status_code}): {r.text}")


def db_update(table, match, values):
    params = {column: f"eq.{value}" for column, value in match.items()}
    headers = {**DB_HEADERS, "Prefer": "return=minimal"}
    r = http.patch(f"{SUPABASE_URL}/rest/v1/{table}", headers=headers, params=params, json=values, timeout=30)
    if r.status_code >= 300:
        sys.exit(f"Updating {table} failed ({r.status_code}): {r.text}")


# ------------------------------------------------------------------
# Prices from Alpaca
# ------------------------------------------------------------------
def latest_price_date(symbol):
    rows = db_get("daily_prices", {"select": "date", "symbol": f"eq.{symbol}", "order": "date.desc", "limit": 1})
    return date.fromisoformat(rows[0]["date"]) if rows else None


def fetch_bars(symbol, start, end, feed="sip"):
    """Daily bars, adjusted for splits and dividends."""
    url = "https://data.alpaca.markets/v2/stocks/bars"
    params = {
        "symbols": symbol,
        "timeframe": "1Day",
        "start": start.isoformat(),
        "end": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "adjustment": "all",
        "feed": feed,
        "limit": 10000,
    }
    bars = []
    while True:
        r = http.get(url, headers=ALPACA_HEADERS, params=params, timeout=30)
        if r.status_code == 429:  # too many requests: wait and retry
            time.sleep(5)
            continue
        if r.status_code == 403 and feed == "sip":  # plan does not allow SIP: use IEX instead
            return fetch_bars(symbol, start, end, feed="iex")
        if r.status_code >= 300:
            raise RuntimeError(f"Alpaca error {r.status_code}: {r.text}")
        data = r.json()
        bars.extend((data.get("bars") or {}).get(symbol, []))
        token = data.get("next_page_token")
        if not token:
            return bars
        params["page_token"] = token


def load_prices(symbols):
    # Free plan: data must be at least 15 minutes old
    end = datetime.now(timezone.utc) - timedelta(minutes=20)
    for symbol in symbols:
        last = latest_price_date(symbol)
        start = last - timedelta(days=5) if last else HISTORY_START
        try:
            bars = fetch_bars(symbol, start, end)
        except RuntimeError as error:
            print(f"  {symbol}: skipped ({error})")
            continue
        rows = [
            {
                "symbol": symbol,
                "date": bar["t"][:10],
                "open": bar["o"],
                "high": bar["h"],
                "low": bar["l"],
                "close": bar["c"],
                "volume": int(bar["v"]),
            }
            for bar in bars
        ]
        if rows:
            db_upsert("daily_prices", rows, "symbol,date")
        print(f"  {symbol}: {len(rows)} days saved")


# ------------------------------------------------------------------
# Yearly financials from SEC EDGAR
# ------------------------------------------------------------------
CONCEPTS = {
    "revenue": [
        "Revenues",
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
        "SalesRevenueNet",
    ],
    "net_income": ["NetIncomeLoss"],
    "total_assets": ["Assets"],
    "eps": ["EarningsPerShareDiluted", "EarningsPerShareBasic"],
}


def annual_values(us_gaap, tags):
    """Return {year: value} from annual 10-K reports, trying each tag in order."""
    result = {}
    for tag in tags:
        units = us_gaap.get(tag, {}).get("units", {})
        entries = units.get("USD") or units.get("USD/shares") or []
        latest = {}  # year -> (filed date, value), keeping the most recent filing
        for entry in entries:
            if entry.get("form") not in ("10-K", "10-K/A") or entry.get("fp") != "FY":
                continue
            end = date.fromisoformat(entry["end"])
            if "start" in entry:  # flows like revenue must cover a full year
                days = (end - date.fromisoformat(entry["start"])).days
                if not 350 <= days <= 380:
                    continue
            year = end.year
            if year not in latest or entry["filed"] > latest[year][0]:
                latest[year] = (entry["filed"], entry["val"])
        for year, (_, value) in latest.items():
            result.setdefault(year, value)
    return result


def total_liabilities(us_gaap):
    liabilities = annual_values(us_gaap, ["Liabilities"])
    if liabilities:
        return liabilities
    # Some companies only report "liabilities + equity", so subtract equity
    total = annual_values(us_gaap, ["LiabilitiesAndStockholdersEquity"])
    equity = annual_values(us_gaap, [
        "StockholdersEquity",
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ])
    return {year: total[year] - equity[year] for year in total if year in equity}


def fill_missing_ciks(stocks):
    """Look up each company's SEC ID number (CIK) and save it."""
    r = http.get("https://www.sec.gov/files/company_tickers.json", headers=SEC_HEADERS, timeout=30)
    r.raise_for_status()
    lookup = {row["ticker"].upper(): str(row["cik_str"]).zfill(10) for row in r.json().values()}
    for stock in stocks:
        if stock.get("cik"):
            continue
        cik = lookup.get(stock["symbol"].replace(".", "-"))
        if cik:
            db_update("securities", {"symbol": stock["symbol"]}, {"cik": cik})
            stock["cik"] = cik
        else:
            print(f"  {stock['symbol']}: no SEC ID found")


def load_fundamentals(stocks):
    fill_missing_ciks(stocks)
    first_year = date.today().year - YEARS_OF_FUNDAMENTALS
    for stock in stocks:
        if not stock.get("cik"):
            continue
        url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{stock['cik']}.json"
        r = http.get(url, headers=SEC_HEADERS, timeout=60)
        time.sleep(0.2)  # SEC allows max 10 requests per second
        if r.status_code != 200:
            print(f"  {stock['symbol']}: skipped (SEC returned {r.status_code})")
            continue
        us_gaap = r.json().get("facts", {}).get("us-gaap", {})
        series = {name: annual_values(us_gaap, tags) for name, tags in CONCEPTS.items()}
        series["total_liabilities"] = total_liabilities(us_gaap)
        years = sorted({year for values in series.values() for year in values if year >= first_year})
        rows = [
            {"symbol": stock["symbol"], "fiscal_year": year, **{name: series[name].get(year) for name in series}}
            for year in years
        ]
        if rows:
            db_upsert("fundamentals", rows, "symbol,fiscal_year")
        print(f"  {stock['symbol']}: {len(rows)} years saved")


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Load prices and financials into Supabase.")
    parser.add_argument("--prices", action="store_true", help="only load prices")
    parser.add_argument("--fundamentals", action="store_true", help="only load financials")
    args = parser.parse_args()
    load_all = not args.prices and not args.fundamentals

    securities = db_get("securities", {"select": "symbol,asset_type,cik", "order": "symbol"})
    print(f"Found {len(securities)} securities.")

    if args.prices or load_all:
        print("Loading daily prices from Alpaca...")
        load_prices([s["symbol"] for s in securities])

    if args.fundamentals or load_all:
        print("Loading yearly financials from SEC EDGAR...")
        load_fundamentals([s for s in securities if s["asset_type"] == "stock"])

    print("Done.")


if __name__ == "__main__":
    main()
    