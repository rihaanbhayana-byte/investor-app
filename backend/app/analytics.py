"""Return, risk and projection math."""
import numpy as np

from . import db

INFLATION = 0.025  # assumed yearly inflation, for "today's dollars"


def monthly_closes(symbols):
    """{symbol: [("YYYY-MM", close), ...]}, oldest first."""
    rows = db.select("monthly_prices", {
        "select": "symbol,date,close",
        "symbol": f"in.({','.join(symbols)})",
        "order": "symbol,date",
    })
    series = {}
    for row in rows:
        series.setdefault(row["symbol"], []).append((row["date"][:7], float(row["close"])))
    return series


def returns_from_closes(closes):
    prices = np.array([price for _, price in closes])
    return prices[1:] / prices[:-1] - 1


def portfolio_returns(weights):
    """Monthly returns of a portfolio rebalanced each month. weights = {"VTI": 0.45, ...}"""
    series = monthly_closes(list(weights))
    by_month = {symbol: dict(series.get(symbol, [])) for symbol in weights}
    months = sorted(set.intersection(*(set(m) for m in by_month.values())))
    if len(months) < 13:
        raise ValueError("Not enough price history for this portfolio yet.")
    total = np.zeros(len(months) - 1)
    for symbol, weight in weights.items():
        prices = np.array([by_month[symbol][m] for m in months])
        total += weight * (prices[1:] / prices[:-1] - 1)
    return months, total


def summarize(returns):
    growth = np.concatenate([[1.0], np.cumprod(1 + returns)])
    drawdowns = growth / np.maximum.accumulate(growth) - 1
    rolling_12m = [np.prod(1 + returns[i:i + 12]) - 1 for i in range(len(returns) - 11)]
    years = len(returns) / 12
    return {
        "annual_return": round(float(growth[-1] ** (1 / years) - 1), 4),
        "annual_volatility": round(float(np.std(returns, ddof=1) * np.sqrt(12)), 4),
        "max_drawdown": round(float(drawdowns.min()), 4),
        "best_12_months": round(float(max(rolling_12m)), 4),
        "worst_12_months": round(float(min(rolling_12m)), 4),
        "years_of_data": round(years, 1),
    }


def project(returns, initial, monthly, years, paths=5000, seed=42):
    """Monte Carlo: build 5,000 possible futures from random months of real history."""
    rng = np.random.default_rng(seed)
    draws = rng.choice(returns, size=(paths, years * 12), replace=True)
    balances = np.full(paths, float(initial))
    result = [_year_row(0, balances, initial, monthly)]
    for month in range(years * 12):
        balances = balances * (1 + draws[:, month]) + monthly
        if (month + 1) % 12 == 0:
            result.append(_year_row((month + 1) // 12, balances, initial, monthly))
    return result


def _year_row(year, balances, initial, monthly):
    low, median, high = np.percentile(balances, [10, 50, 90])
    return {
        "year": year,
        "low": round(float(low), 2),
        "median": round(float(median), 2),
        "high": round(float(high), 2),
        "contributed": round(initial + monthly * 12 * year, 2),
        "median_in_todays_dollars": round(float(median) / (1 + INFLATION) ** year, 2),
    }
