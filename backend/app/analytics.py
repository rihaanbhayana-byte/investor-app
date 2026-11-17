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
    # Measured odds: the share of the simulated futures that ends above what was put in
    put_in = initial + monthly * 12 * years
    result[-1]["odds"] = {
        "paths": paths,
        "more_than_put_in": round(float(np.mean(balances > put_in)), 3),
        "more_than_put_in_after_inflation": round(float(np.mean(balances / (1 + INFLATION) ** years > put_in)), 3),
        "doubled": round(float(np.mean(balances > 2 * put_in)), 3) if put_in else 0.0,
    }
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


def required_monthly(returns, initial, target, years, paths=5000, seed=42):
    """How much to save each month to reach a target, across 5,000 simulated futures."""
    rng = np.random.default_rng(seed)
    months = years * 12
    growth = 1 + rng.choice(returns, size=(paths, months), replace=True)
    start_growth = np.prod(growth, axis=1)                    # what $1 invested today becomes
    later = np.cumprod(growth[:, ::-1], axis=1)[:, ::-1]      # growth from month m to the end
    per_dollar_monthly = np.concatenate([later[:, 1:], np.ones((paths, 1))], axis=1).sum(axis=1)
    needed = np.maximum(0, (target - initial * start_growth) / per_dollar_monthly)
    return {
        "monthly_for_50_percent": round(float(np.percentile(needed, 50)), 2),
        "monthly_for_75_percent": round(float(np.percentile(needed, 75)), 2),
        "monthly_for_90_percent": round(float(np.percentile(needed, 90)), 2),
        "monthly_without_growth": round(max(0.0, (target - initial) / months), 2),
    }


# ---------------------------------------------------------------------
# Strategy lab: replay a simple rule-based strategy month by month
# ---------------------------------------------------------------------
def backtest(closes, initial, monthly, dip_drop=None, dip_extra=0.0, stop_loss=None):
    """closes = [("YYYY-MM", price), ...]. Returns month-by-month values and the events that fired.

    Rules:
    - invest `initial` in the first month and `monthly` every month
    - dip_drop: if the price is at least dip_drop % below its highest price of the last 12 months, invest dip_extra more
    - stop_loss: if the price falls stop_loss % below its peak since buying, sell everything to cash.
      Keep adding monthly money to cash, and buy back in once the price climbs back above the sale price.
    """
    shares = cash = put_in = 0.0
    peak = None
    out_of_market = False
    sale_price = None
    rows, events = [], []
    for i, (month, price) in enumerate(closes):
        add = (initial if i == 0 else 0.0) + monthly
        high_12m = max(p for _, p in closes[max(0, i - 12): i + 1])
        if dip_drop and i > 0 and price <= high_12m * (1 - dip_drop / 100):
            add += dip_extra
            if dip_extra:
                events.append({"month": month, "type": "dip",
                               "text": f"Price was {round((1 - price / high_12m) * 100)}% below its 12-month high, so ${dip_extra:,.0f} extra went in."})
        put_in += add
        if out_of_market:
            cash += add
            if price >= sale_price:
                shares, cash = cash / price, 0.0
                out_of_market, peak = False, price
                events.append({"month": month, "type": "buy_back", "text": "Price climbed back above the sale price, so everything was invested again."})
        else:
            shares += add / price
            peak = price if peak is None else max(peak, price)
            if stop_loss and price <= peak * (1 - stop_loss / 100):
                cash, shares = cash + shares * price, 0.0
                out_of_market, sale_price = True, price
                events.append({"month": month, "type": "stop_loss",
                               "text": f"Price fell {round((1 - price / peak) * 100)}% from its peak, so everything was sold to cash."})
        rows.append({"month": month, "value": round(shares * price + cash, 2), "put_in": round(put_in, 2)})
    return rows, events
