"""Fetch data for any US stock on demand (not stored in our database)."""
import os
from datetime import date, datetime, timedelta, timezone

import requests

from . import db  # noqa: F401  (loads the .env file)

ALPACA_HEADERS = {
    "APCA-API-KEY-ID": os.environ.get("ALPACA_KEY_ID", ""),
    "APCA-API-SECRET-KEY": os.environ.get("ALPACA_SECRET_KEY", ""),
}
SEC_HEADERS = {"User-Agent": os.environ.get("SEC_USER_AGENT", "Investor App contact@example.com")}

_http = requests.Session()
_tickers = None


def all_tickers():
    """Every company listed with the SEC (about 10,000), downloaded once and kept in memory."""
    global _tickers
    if _tickers is None:
        r = _http.get("https://www.sec.gov/files/company_tickers.json", headers=SEC_HEADERS, timeout=30)
        r.raise_for_status()
        _tickers = [
            {"symbol": row["ticker"].upper().replace("-", "."), "name": row["title"], "cik": str(row["cik_str"]).zfill(10)}
            for row in r.json().values()
        ]
    return _tickers


def find(symbol):
    return next((t for t in all_tickers() if t["symbol"] == symbol), None)


def search(query, limit=20):
    q = query.strip().upper()
    if not q:
        return []
    by_symbol = sorted((t for t in all_tickers() if t["symbol"].startswith(q)), key=lambda t: (t["symbol"] != q, len(t["symbol"])))
    by_name = [t for t in all_tickers() if q in t["name"].upper() and not t["symbol"].startswith(q)]
    return [{"symbol": t["symbol"], "name": t["name"]} for t in (by_symbol + by_name)[:limit]]


def monthly_prices(symbol):
    """Monthly closing prices since 2016, adjusted for splits and dividends."""
    end = datetime.now(timezone.utc) - timedelta(minutes=20)
    params = {
        "symbols": symbol, "timeframe": "1Month", "start": "2016-01-01",
        "end": end.strftime("%Y-%m-%dT%H:%M:%SZ"), "adjustment": "all", "feed": "sip", "limit": 10000,
    }
    url = "https://data.alpaca.markets/v2/stocks/bars"
    r = _http.get(url, headers=ALPACA_HEADERS, params=params, timeout=30)
    if r.status_code == 403:
        params["feed"] = "iex"
        r = _http.get(url, headers=ALPACA_HEADERS, params=params, timeout=30)
    r.raise_for_status()
    bars = (r.json().get("bars") or {}).get(symbol, [])
    return [(b["t"][:7], float(b["c"])) for b in bars]


CONCEPTS = {
    "revenue": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
                "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet"],
    "net_income": ["NetIncomeLoss"],
    "total_assets": ["Assets"],
    "total_liabilities": ["Liabilities"],
    "eps": ["EarningsPerShareDiluted", "EarningsPerShareBasic"],
}


def _annual(us_gaap, tags):
    result = {}
    for tag in tags:
        units = us_gaap.get(tag, {}).get("units", {})
        latest = {}
        for e in units.get("USD") or units.get("USD/shares") or []:
            if e.get("form") not in ("10-K", "10-K/A") or e.get("fp") != "FY":
                continue
            end = date.fromisoformat(e["end"])
            if "start" in e and not 350 <= (end - date.fromisoformat(e["start"])).days <= 380:
                continue
            if end.year not in latest or e["filed"] > latest[end.year][0]:
                latest[end.year] = (e["filed"], e["val"])
        for year, (_, value) in latest.items():
            result.setdefault(year, value)
    return result


def fundamentals(cik, years=10):
    r = _http.get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json", headers=SEC_HEADERS, timeout=60)
    if r.status_code != 200:
        return []
    us_gaap = r.json().get("facts", {}).get("us-gaap", {})
    series = {name: _annual(us_gaap, tags) for name, tags in CONCEPTS.items()}
    first = date.today().year - years
    all_years = sorted({y for values in series.values() for y in values if y >= first})
    return [{"fiscal_year": y, **{name: series[name].get(y) for name in series}} for y in all_years]
