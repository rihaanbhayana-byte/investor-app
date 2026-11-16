"""Investor App API. Run locally from the backend folder:  uvicorn app.main:app --reload"""
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import analytics, db, risk

app = FastAPI(title="Investor App API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DISCLAIMER = (
    "Educational estimates based on past prices since 2016, a strong period for stocks. "
    "Future returns may be lower. Not financial advice."
)

RiskLevel = Literal["conservative", "moderate", "aggressive"]


class RiskRequest(BaseModel):
    answers: dict[str, str]
    horizon_years: int = Field(ge=1, le=50)


class ProjectionRequest(BaseModel):
    risk_level: RiskLevel
    initial_amount: float = Field(ge=0, le=10_000_000)
    monthly_contribution: float = Field(ge=0, le=1_000_000)
    years: int = Field(ge=1, le=50)


def load_portfolio(risk_level):
    found = db.select("model_portfolios", {"select": "risk_level,name,description", "risk_level": f"eq.{risk_level}"})
    if not found:
        raise HTTPException(404, "Portfolio not found")
    holdings = db.select("portfolio_holdings", {
        "select": "symbol,weight,securities(name,sector)",
        "risk_level": f"eq.{risk_level}",
        "order": "weight.desc",
    })
    result = found[0]
    result["holdings"] = [
        {
            "symbol": h["symbol"],
            "weight": float(h["weight"]),
            "name": h["securities"]["name"],
            "sector": h["securities"]["sector"],
        }
        for h in holdings
    ]
    return result


def weights_of(portfolio):
    return {h["symbol"]: h["weight"] for h in portfolio["holdings"]}


@app.get("/")
def health():
    return {"status": "ok"}


@app.get("/questions")
def get_questions():
    return risk.public_questions()


@app.post("/risk-profile")
def get_risk_profile(request: RiskRequest):
    try:
        return risk.score_answers(request.answers, request.horizon_years)
    except ValueError as error:
        raise HTTPException(400, str(error))


@app.get("/portfolios/{risk_level}")
def get_portfolio(risk_level: RiskLevel):
    portfolio = load_portfolio(risk_level)
    months, returns = analytics.portfolio_returns(weights_of(portfolio))
    return {
        **portfolio,
        "history_from": months[0],
        "history_to": months[-1],
        "stats": analytics.summarize(returns),
        "disclaimer": DISCLAIMER,
    }


@app.post("/projection")
def get_projection(request: ProjectionRequest):
    portfolio = load_portfolio(request.risk_level)
    _, returns = analytics.portfolio_returns(weights_of(portfolio))
    yearly = analytics.project(returns, request.initial_amount, request.monthly_contribution, request.years)
    return {
        "risk_level": request.risk_level,
        "portfolio_name": portfolio["name"],
        "final": yearly[-1],
        "yearly": yearly,
        "disclaimer": DISCLAIMER,
    }


@app.get("/stocks")
def get_stocks():
    securities = db.select("securities", {"select": "symbol,name,asset_type,sector", "order": "symbol"})
    series = analytics.monthly_closes([s["symbol"] for s in securities])
    for security in securities:
        closes = series.get(security["symbol"], [])
        security["latest_price"] = closes[-1][1] if closes else None
        security["return_1y"] = round(closes[-1][1] / closes[-13][1] - 1, 4) if len(closes) >= 13 else None
    return securities


@app.get("/stocks/{symbol}")
def get_stock(symbol: str):
    symbol = symbol.upper()
    found = db.select("securities", {"select": "symbol,name,asset_type,sector", "symbol": f"eq.{symbol}"})
    if not found:
        raise HTTPException(404, f"{symbol} is not in our list")
    closes = analytics.monthly_closes([symbol]).get(symbol, [])
    returns = analytics.returns_from_closes(closes) if len(closes) > 1 else []
    fundamentals = db.select("fundamentals", {
        "select": "fiscal_year,revenue,net_income,total_assets,total_liabilities,eps",
        "symbol": f"eq.{symbol}",
        "order": "fiscal_year",
    })
    return {
        **found[0],
        "prices": [{"month": m, "close": c} for m, c in closes],
        "stats": analytics.summarize(returns) if len(returns) >= 12 else None,
        "fundamentals": fundamentals,
        "disclaimer": DISCLAIMER,
    }


# =====================================================================
# AI Coach
# =====================================================================
import json  # noqa: E402

from . import ai  # noqa: E402


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=30)
    plan: dict | None = None


def tool_list_stocks():
    keys = ("symbol", "name", "asset_type", "sector", "latest_price", "return_1y")
    return [{k: s[k] for k in keys} for s in get_stocks()]


def tool_get_stock(symbol):
    data = get_stock(symbol)
    prices = data["prices"]
    return {
        "symbol": data["symbol"],
        "name": data["name"],
        "type": data["asset_type"],
        "sector": data["sector"],
        "latest_price": prices[-1] if prices else None,
        "price_1_year_ago": prices[-13] if len(prices) >= 13 else None,
        "first_price_in_data": prices[0] if prices else None,
        "stats_since_2016": data["stats"],
        "financials_last_4_years": data["fundamentals"][-4:],
    }


def tool_get_portfolio(risk_level):
    p = get_portfolio(risk_level)
    return {k: p[k] for k in ("name", "description", "holdings", "stats", "history_from", "history_to")}


def tool_run_projection(risk_level, initial_amount, monthly_contribution, years):
    result = get_projection(ProjectionRequest(
        risk_level=risk_level,
        initial_amount=initial_amount,
        monthly_contribution=monthly_contribution,
        years=years,
    ))
    return {
        "portfolio": result["portfolio_name"],
        "final_year": result["final"],
        "method": "5,000 simulations replaying monthly returns since 2016. low = 10th percentile, high = 90th percentile.",
    }


TOOL_FUNCTIONS = {
    "list_stocks": tool_list_stocks,
    "get_stock": tool_get_stock,
    "get_portfolio": tool_get_portfolio,
    "run_projection": tool_run_projection,
}

LEVELS = ["conservative", "moderate", "aggressive"]

TOOL_SPECS = [
    {"type": "function", "function": {
        "name": "list_stocks",
        "description": "List every stock and fund in the app with its latest price and 1-year return.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_stock",
        "description": "Get one ticker's stats since 2016 (average yearly return, volatility, biggest drop, best and worst 12 months) and its last 4 years of company financials.",
        "parameters": {"type": "object", "properties": {"symbol": {"type": "string", "description": "Ticker, e.g. AAPL"}}, "required": ["symbol"]},
    }},
    {"type": "function", "function": {
        "name": "get_portfolio",
        "description": "Get a model portfolio's holdings and historical stats.",
        "parameters": {"type": "object", "properties": {"risk_level": {"type": "string", "enum": LEVELS}}, "required": ["risk_level"]},
    }},
    {"type": "function", "function": {
        "name": "run_projection",
        "description": "Simulate how money could grow in a model portfolio. Returns low, median and high final values and total money put in.",
        "parameters": {"type": "object", "properties": {
            "risk_level": {"type": "string", "enum": LEVELS},
            "initial_amount": {"type": "number"},
            "monthly_contribution": {"type": "number"},
            "years": {"type": "integer", "minimum": 1, "maximum": 50},
        }, "required": ["risk_level", "initial_amount", "monthly_contribution", "years"]},
    }},
]


@app.post("/chat")
def chat(request: ChatRequest):
    system = ai.COACH_PROMPT
    if request.plan:
        system += "\n\nThe user's current plan: " + json.dumps(request.plan)[:2000]
    messages = [{"role": "system", "content": system}] + [m.model_dump() for m in request.messages]
    try:
        reply = ai.run_with_tools(messages, TOOL_SPECS, TOOL_FUNCTIONS)
    except Exception as error:
        raise HTTPException(503, f"The AI coach is unavailable right now: {error}")
    return {"reply": reply}


# =====================================================================
# AI: read a goal written in plain words
# =====================================================================
from datetime import date  # noqa: E402

GOAL_OPTIONS = ["Grow my wealth", "Retirement", "Buying a home", "Education", "A big purchase"]

GOAL_PROMPT = """Extract an investing plan from the user's description. Reply with JSON only, using these keys:
"goal": one of OPTIONS (pick the closest),
"initial_amount": US dollars they can invest now (0 if not mentioned),
"monthly_contribution": US dollars per month (convert weekly x 52 / 12, yearly / 12; 0 if not mentioned),
"years": whole number of years until they need the money (1 to 50; if they give a target age, work it out; if unknown, 10),
"summary": one friendly sentence saying what you understood.
OPTIONS: """ + json.dumps(GOAL_OPTIONS)


class GoalText(BaseModel):
    text: str = Field(min_length=5, max_length=1000)


def _number(value, default=0.0):
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        return default


@app.post("/parse-goal")
def parse_goal(request: GoalText):
    messages = [{"role": "system", "content": GOAL_PROMPT}, {"role": "user", "content": request.text}]
    try:
        try:
            reply = ai.complete(messages, temperature=0, json_mode=True)
        except RuntimeError:
            reply = ai.complete(messages, temperature=0)  # some models don't support JSON mode
        data = ai.parse_json(reply.get("content") or "")
    except Exception as error:
        raise HTTPException(503, f"Could not read your goal: {error}")
    return {
        "goal": data.get("goal") if data.get("goal") in GOAL_OPTIONS else GOAL_OPTIONS[0],
        "initial_amount": round(_number(data.get("initial_amount"))),
        "monthly_contribution": round(_number(data.get("monthly_contribution"))),
        "years": int(min(50, max(1, _number(data.get("years"), 10)))),
        "summary": str(data.get("summary", ""))[:300],
    }


# =====================================================================
# AI: explain a stock in plain words
# =====================================================================
EXPLAIN_PROMPT = """You explain stocks and funds to complete beginners using ONLY the data provided.
Write 4 to 6 short bullet points covering: what it is; how the price has grown since 2016; how bumpy the ride
has been (volatility and biggest drop); and for companies, whether revenue is growing, whether it is profitable,
and how its debts compare with its assets.
Use simple words and round numbers, and say what each number means. Do not recommend buying or selling.
Finish with the line: "Educational only, not financial advice." """

_explain_cache = {}


@app.get("/explain-stock/{symbol}")
def explain_stock(symbol: str):
    key = (symbol.upper(), date.today().isoformat())
    if key in _explain_cache:
        return {"explanation": _explain_cache[key]}
    data = tool_get_stock(symbol)
    messages = [
        {"role": "system", "content": EXPLAIN_PROMPT},
        {"role": "user", "content": json.dumps(data, default=str)},
    ]
    try:
        text = ai.complete(messages, temperature=0.3).get("content") or ""
    except Exception as error:
        raise HTTPException(503, f"The AI explainer is unavailable right now: {error}")
    _explain_cache[key] = text
    return {"explanation": text}


# =====================================================================
# Calculators
# =====================================================================
import re  # noqa: E402

from fastapi import Query  # noqa: E402


def clean_symbol(symbol):
    symbol = symbol.strip().upper()
    if not re.fullmatch(r"[A-Z.]{1,6}", symbol):
        raise HTTPException(400, f"'{symbol}' is not a valid ticker")
    return symbol


@app.get("/time-machine")
def time_machine(symbol: str, amount: float = Query(1000, gt=0, le=10_000_000), start: str = "2016-01"):
    symbol = clean_symbol(symbol)
    names = {s["symbol"]: s["name"] for s in db.select("securities", {"select": "symbol,name", "symbol": f"in.({symbol},VOO)"})}
    if symbol not in names:
        raise HTTPException(404, f"{symbol} is not in our list")
    series = analytics.monthly_closes([symbol, "VOO"])
    closes = [c for c in series.get(symbol, []) if c[0] >= start]
    if len(closes) < 2:
        raise HTTPException(400, "Not enough price history after that date.")
    sp500 = dict(series.get("VOO", []))
    first_month, first_price = closes[0]
    sp500_start = sp500.get(first_month)
    points = []
    for month, price in closes:
        point = {"month": month, "value": round(amount * price / first_price, 2)}
        if sp500_start and month in sp500:
            point["sp500_value"] = round(amount * sp500[month] / sp500_start, 2)
        points.append(point)
    final = points[-1]["value"]
    years = (len(closes) - 1) / 12
    return {
        "symbol": symbol,
        "name": names[symbol],
        "amount": amount,
        "start_month": first_month,
        "end_month": closes[-1][0],
        "final_value": final,
        "gain": round(final - amount, 2),
        "total_return": round(final / amount - 1, 4),
        "annual_return": round((final / amount) ** (1 / years) - 1, 4),
        "sp500_final_value": points[-1].get("sp500_value"),
        "series": points,
        "disclaimer": DISCLAIMER,
    }


class GoalCalcRequest(BaseModel):
    target: float = Field(gt=0, le=100_000_000)
    years: int = Field(ge=1, le=50)
    initial_amount: float = Field(ge=0, le=10_000_000)
    risk_level: RiskLevel


@app.post("/goal-calculator")
def goal_calculator(request: GoalCalcRequest):
    portfolio = load_portfolio(request.risk_level)
    _, returns = analytics.portfolio_returns(weights_of(portfolio))
    result = analytics.required_monthly(returns, request.initial_amount, request.target, request.years)
    return {"portfolio_name": portfolio["name"], **result, "disclaimer": DISCLAIMER}


@app.get("/compare")
def compare(symbols: str):
    wanted = list(dict.fromkeys(clean_symbol(s) for s in symbols.split(",") if s.strip()))[:4]
    if len(wanted) < 2:
        raise HTTPException(400, "Pick at least two different stocks.")
    series = analytics.monthly_closes(wanted)
    missing = [s for s in wanted if s not in series]
    if missing:
        raise HTTPException(404, f"Not in our list: {', '.join(missing)}")
    by_month = {s: dict(series[s]) for s in wanted}
    months = sorted(set.intersection(*(set(m) for m in by_month.values())))
    rows = [{"month": m, **{s: round(100 * by_month[s][m] / by_month[s][months[0]], 2) for s in wanted}} for m in months]
    stats = {
        s: analytics.summarize(analytics.returns_from_closes([(m, by_month[s][m]) for m in months]))
        for s in wanted
    }
    return {"symbols": wanted, "series": rows, "stats": stats, "disclaimer": DISCLAIMER}


# =====================================================================
# Any US stock: search and live data
# =====================================================================
from . import live  # noqa: E402

_live_cache = {}


def live_stock_data(symbol):
    symbol = clean_symbol(symbol.replace("-", "."))
    key = (symbol, date.today().isoformat())
    if key in _live_cache:
        return _live_cache[key]
    match = live.find(symbol)
    try:
        closes = live.monthly_prices(symbol)
    except Exception as error:
        raise HTTPException(502, f"Could not fetch prices for {symbol}: {error}")
    if len(closes) < 2:
        raise HTTPException(404, f"No price data found for {symbol}")
    returns = analytics.returns_from_closes(closes)
    data = {
        "symbol": symbol,
        "name": match["name"].title() if match else symbol,
        "asset_type": "stock",
        "sector": "Live data",
        "prices": [{"month": m, "close": c} for m, c in closes],
        "stats": analytics.summarize(returns) if len(returns) >= 12 else None,
        "fundamentals": live.fundamentals(match["cik"]) if match else [],
        "disclaimer": DISCLAIMER,
        "live": True,
    }
    _live_cache[key] = data
    return data


@app.get("/search")
def search_stocks(q: str = Query(min_length=1, max_length=30)):
    try:
        results = live.search(q)
    except Exception as error:
        raise HTTPException(502, f"Search is unavailable right now: {error}")
    ours = {s["symbol"] for s in db.select("securities", {"select": "symbol"})}
    return [{**r, "in_app": r["symbol"] in ours} for r in results]


@app.get("/live-stock/{symbol}")
def get_live_stock(symbol: str):
    return live_stock_data(symbol)


# Let the AI Coach and "Explain it" use live data for stocks outside our list
_stored_stock = tool_get_stock


def tool_get_stock(symbol):
    try:
        return _stored_stock(symbol)
    except HTTPException as error:
        if error.status_code != 404:
            raise
    data = live_stock_data(symbol)
    prices = data["prices"]
    return {
        "symbol": data["symbol"],
        "name": data["name"],
        "type": "stock (live data, not in our saved list)",
        "latest_price": prices[-1],
        "price_1_year_ago": prices[-13] if len(prices) >= 13 else None,
        "first_price_in_data": prices[0],
        "stats_since_2016": data["stats"],
        "financials_last_4_years": data["fundamentals"][-4:],
    }


TOOL_FUNCTIONS["get_stock"] = tool_get_stock


# =====================================================================
# Practice portfolio: $10,000 of play money, real prices
# =====================================================================
import time  # noqa: E402
from datetime import datetime, timedelta, timezone  # noqa: E402

from fastapi import Depends, Header  # noqa: E402

START_CASH = 10_000.0
_user_cache = {}


def current_user(authorization: str | None = Header(default=None)):
    """Check the Supabase login token the website sends, and return the user's id."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Please log in to use the practice portfolio.")
    token = authorization.split(" ", 1)[1].strip()
    cached = _user_cache.get(token)
    if cached and cached[1] > time.time():
        return cached[0]
    user = db.get_user(token)
    if not user or not user.get("id"):
        raise HTTPException(401, "Your login has expired. Please log in again.")
    _user_cache[token] = (user["id"], time.time() + 300)
    return user["id"]


def latest_prices(symbols):
    """{symbol: (price, "YYYY-MM-DD")} using the newest daily close we have."""
    symbols = sorted(set(symbols))
    if not symbols:
        return {}
    since = (date.today() - timedelta(days=14)).isoformat()
    rows = db.select("daily_prices", {
        "select": "symbol,date,close",
        "symbol": f"in.({','.join(symbols)})",
        "date": f"gte.{since}",
        "order": "date",
    })
    prices = {r["symbol"]: (float(r["close"]), r["date"]) for r in rows}
    missing = [s for s in symbols if s not in prices]
    if missing:
        for symbol, closes in analytics.monthly_closes(missing).items():
            prices[symbol] = (closes[-1][1], closes[-1][0])
    return prices


def price_on(symbol, day):
    """Closing price on (or just before) a given date."""
    since = (date.fromisoformat(day) - timedelta(days=10)).isoformat()
    rows = db.select("daily_prices", {
        "select": "close",
        "symbol": f"eq.{symbol}",
        "and": f"(date.gte.{since},date.lte.{day})",
        "order": "date.desc",
    })
    return float(rows[0]["close"]) if rows else None


def practice_account(user_id):
    rows = db.admin("GET", "practice_accounts", {"select": "user_id,started_at", "user_id": f"eq.{user_id}"})
    if rows:
        return rows[0]
    return db.admin("POST", "practice_accounts", json={"user_id": user_id}, prefer="return=representation")[0]


def practice_state(user_id):
    account = practice_account(user_id)
    trades = db.admin("GET", "practice_trades", {
        "select": "id,symbol,side,shares,price,created_at",
        "user_id": f"eq.{user_id}",
        "order": "created_at",
    }) or []

    cash, positions = START_CASH, {}
    for t in trades:
        shares, price = float(t["shares"]), float(t["price"])
        p = positions.setdefault(t["symbol"], {"shares": 0.0, "cost": 0.0})
        if t["side"] == "buy":
            cash -= shares * price
            p["shares"] += shares
            p["cost"] += shares * price
        else:
            average = p["cost"] / p["shares"] if p["shares"] else 0.0
            cash += shares * price
            p["shares"] -= shares
            p["cost"] -= average * shares
            if p["shares"] < 1e-6:
                p["shares"], p["cost"] = 0.0, 0.0

    held = [s for s, p in positions.items() if p["shares"] > 0]
    prices = latest_prices(held + ["VOO"])
    names = {s["symbol"]: s["name"] for s in db.select("securities", {"select": "symbol,name"})}
    holdings = []
    for symbol in held:
        p = positions[symbol]
        price = prices.get(symbol, (None,))[0] or 0.0
        value = p["shares"] * price
        holdings.append({
            "symbol": symbol,
            "name": names.get(symbol, symbol),
            "shares": round(p["shares"], 6),
            "average_cost": round(p["cost"] / p["shares"], 2),
            "price": price,
            "value": round(value, 2),
            "gain": round(value - p["cost"], 2),
            "gain_pct": round(value / p["cost"] - 1, 4) if p["cost"] else 0.0,
        })
    holdings.sort(key=lambda h: -h["value"])
    total = cash + sum(h["value"] for h in holdings)

    started = account["started_at"][:10]
    voo_start = price_on("VOO", started)
    voo_now = prices.get("VOO", (None,))[0]
    sp500_value = round(START_CASH * voo_now / voo_start, 2) if voo_start and voo_now else None

    return {
        "start_cash": START_CASH,
        "started_at": account["started_at"],
        "cash": round(cash, 2),
        "invested": round(total - cash, 2),
        "total": round(total, 2),
        "gain": round(total - START_CASH, 2) + 0.0,
        "gain_pct": round(total / START_CASH - 1, 4) + 0.0,
        "sp500_value": sp500_value,
        "prices_as_of": prices.get("VOO", (None, None))[1],
        "holdings": holdings,
        "trades": [
            {**t, "shares": float(t["shares"]), "price": float(t["price"]), "name": names.get(t["symbol"], t["symbol"])}
            for t in reversed(trades[-30:])
        ],
        "trade_count": len(trades),
    }


@app.get("/practice")
def get_practice(user_id: str = Depends(current_user)):
    return practice_state(user_id)


class TradeRequest(BaseModel):
    symbol: str
    side: Literal["buy", "sell"]
    dollars: float = Field(gt=0, le=1_000_000)
    sell_all: bool = False


@app.post("/practice/trade")
def practice_trade(request: TradeRequest, user_id: str = Depends(current_user)):
    symbol = clean_symbol(request.symbol)
    if not db.select("securities", {"select": "symbol", "symbol": f"eq.{symbol}"}):
        raise HTTPException(400, f"{symbol} isn't in our list. Practice trading works with our 36 stocks and funds.")
    price = latest_prices([symbol]).get(symbol, (None,))[0]
    if not price:
        raise HTTPException(400, f"No price available for {symbol} right now.")
    state = practice_state(user_id)

    if request.side == "buy":
        if request.dollars > state["cash"] + 0.005:
            raise HTTPException(400, f"You only have ${state['cash']:,.2f} of play money left.")
        shares = request.dollars / price
        message = f"Bought ${request.dollars:,.2f} of {symbol}"
    else:
        owned = next((h["shares"] for h in state["holdings"] if h["symbol"] == symbol), 0.0)
        if owned <= 0:
            raise HTTPException(400, f"You don't own any {symbol} yet.")
        shares = owned if request.sell_all else min(owned, request.dollars / price)
        message = f"Sold ${shares * price:,.2f} of {symbol}"

    shares = round(shares, 6)
    if shares <= 0:
        raise HTTPException(400, "That amount is too small.")
    db.admin("POST", "practice_trades", json={
        "user_id": user_id, "symbol": symbol, "side": request.side, "shares": shares, "price": price,
    })
    return {**practice_state(user_id), "message": f"{message} at ${price:,.2f} a share."}


@app.post("/practice/reset")
def practice_reset(user_id: str = Depends(current_user)):
    practice_account(user_id)
    db.admin("DELETE", "practice_trades", {"user_id": f"eq.{user_id}"})
    db.admin("PATCH", "practice_accounts", {"user_id": f"eq.{user_id}"},
             json={"started_at": datetime.now(timezone.utc).isoformat()})
    return practice_state(user_id)


# =====================================================================
# Crash test: replay a real market drop on a model portfolio
# =====================================================================
CRASHES = {
    "covid": {
        "title": "The COVID crash",
        "when": "2020",
        "start": "2019-12",
        "end": "2021-06",
        "intro": "In early 2020 a new virus spread around the world. Countries locked down and markets fell faster than ever before.",
        "events": {
            "2020-02": "Virus fears spread. Markets start to wobble.",
            "2020-03": "Lockdowns begin. Stocks fall fast.",
            "2020-04": "Governments and central banks step in with huge support.",
            "2020-08": "The S&P 500 is back above its pre-crash high.",
            "2020-11": "Vaccine news lifts markets further.",
        },
    },
    "bear2022": {
        "title": "The 2022 bear market",
        "when": "2022",
        "start": "2021-12",
        "end": "2024-03",
        "intro": "Prices were rising fast, so interest rates went up quickly. Both stocks and bonds fell for most of the year.",
        "events": {
            "2022-01": "High inflation. Interest rates are about to rise.",
            "2022-03": "The US central bank starts raising rates.",
            "2022-06": "Stocks officially enter a bear market (down 20%).",
            "2022-10": "Markets hit their low point for the year.",
            "2023-06": "Excitement about AI lifts big tech stocks.",
            "2024-01": "The S&P 500 sets a new record high.",
        },
    },
    "dip2018": {
        "title": "The late-2018 drop",
        "when": "2018",
        "start": "2018-08",
        "end": "2019-08",
        "intro": "Worries about rising interest rates and a US-China trade war pushed stocks down at the end of 2018.",
        "events": {
            "2018-10": "Rate and trade-war worries hit stocks.",
            "2018-12": "One of the worst Decembers for stocks in decades.",
            "2019-01": "Markets bounce back quickly.",
            "2019-04": "The S&P 500 is back near its old high.",
        },
    },
}


@app.get("/crash-test")
def crash_test(
    event: Literal["covid", "bear2022", "dip2018"] = "covid",
    risk_level: RiskLevel = "moderate",
    amount: float = Query(10_000, gt=0, le=10_000_000),
):
    crash = CRASHES[event]
    portfolio = load_portfolio(risk_level)
    months, returns = analytics.portfolio_returns(weights_of(portfolio))
    if crash["start"] not in months:
        raise HTTPException(400, "Not enough price history for this event.")
    i0 = months.index(crash["start"])
    i1 = months.index(crash["end"]) if crash["end"] in months else len(months) - 1
    window = months[i0:i1 + 1]

    stayed = [amount]
    for k in range(i0, i1):
        stayed.append(stayed[-1] * (1 + returns[k]))
    bottom = min(range(len(stayed)), key=lambda j: stayed[j])
    extra = round(amount * 0.2, 2)
    panic = [v if j <= bottom else stayed[bottom] for j, v in enumerate(stayed)]
    buy_more = [v if j <= bottom else v / stayed[bottom] * (stayed[bottom] + extra) for j, v in enumerate(stayed)]
    recovered = next((window[j] for j in range(bottom + 1, len(stayed)) if stayed[j] >= amount), None)

    voo = dict(analytics.monthly_closes(["VOO"]).get("VOO", []))
    voo_start = voo.get(window[0])

    series = []
    for j, month in enumerate(window):
        row = {"month": month, "stayed": round(stayed[j], 2), "panic": round(panic[j], 2), "buy_more": round(buy_more[j], 2)}
        if voo_start and month in voo:
            row["sp500"] = round(amount * voo[month] / voo_start, 2)
        row["event"] = crash["events"].get(month)
        series.append(row)

    return {
        "event": event,
        "title": crash["title"],
        "when": crash["when"],
        "intro": crash["intro"],
        "portfolio_name": portfolio["name"],
        "amount": amount,
        "extra": extra,
        "bottom_month": window[bottom],
        "bottom_value": round(stayed[bottom], 2),
        "max_drop": round(stayed[bottom] / amount - 1, 4),
        "recovered_month": recovered,
        "months_to_recover": (window.index(recovered) - bottom) if recovered else None,
        "end_month": window[-1],
        "final": {"stayed": round(stayed[-1], 2), "panic": round(panic[-1], 2), "buy_more": round(buy_more[-1], 2)},
        "series": series,
        "note": "Uses month-end prices, so the real drops inside each month were even bigger. " + DISCLAIMER,
    }


# =====================================================================
# Strategy lab: describe a strategy in words, the AI turns it into rules,
# and we test the rules on real prices since 2016
# =====================================================================
STRATEGY_PROMPT = """Turn the user's investing strategy into rules for a simple monthly backtest.
Reply with JSON only, using these keys:
"name": a short name for the strategy (max 6 words),
"symbol": ONE ticker from ALLOWED. "S&P 500" means VOO, "Nasdaq" or "tech fund" means QQQ, "bonds" means BND,
          "whole US market" means VTI, "international" means VXUS. Default "VOO".
"initial": dollars invested at the start (0 if not mentioned),
"monthly": dollars invested every month (100 if no amounts at all are mentioned, otherwise 0 if not mentioned),
"dip_drop_pct": buy extra when the price is at least this % below its 12-month high (null if not mentioned),
"dip_extra": extra dollars to invest in those months (null if not mentioned; if dip_drop_pct is set but no amount, use 2 x monthly),
"stop_loss_pct": sell everything if the price falls this % below its peak since buying (null if not mentioned),
"start_year": a year from 2016 to 2024 (default 2016),
"summary": one plain sentence restating exactly the rules you will test,
"not_supported": a short note about any part of the request you could not model, or "".
ALLOWED: """

VERDICT_PROMPT = """You explain backtest results to a complete beginner. Using ONLY the JSON data given, write 3 short
bullet points: how the strategy did, how it compared with simple monthly investing in the same fund, and one lesson.
Use round numbers. Mention that past results don't guarantee future ones. Do not tell the user to buy or sell anything."""


class StrategyRequest(BaseModel):
    text: str = Field(min_length=5, max_length=600)


def _optional_number(value, low, high):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return min(high, max(low, number)) if number > 0 else None


@app.post("/strategy-test")
def strategy_test(request: StrategyRequest):
    allowed = [s["symbol"] for s in db.select("securities", {"select": "symbol", "order": "symbol"})]
    messages = [
        {"role": "system", "content": STRATEGY_PROMPT + json.dumps(allowed)},
        {"role": "user", "content": request.text},
    ]
    try:
        try:
            reply = ai.complete(messages, temperature=0, json_mode=True)
        except RuntimeError:
            reply = ai.complete(messages, temperature=0)
        rules = ai.parse_json(reply.get("content") or "")
    except Exception as error:
        raise HTTPException(503, f"The AI couldn't read that strategy right now: {error}")

    symbol = str(rules.get("symbol") or "VOO").upper()
    if symbol not in allowed:
        raise HTTPException(400, f"The strategy uses {symbol}, which isn't in our list. Try one of: VOO, QQQ, VTI, BND, AAPL, MSFT...")
    initial = _optional_number(rules.get("initial"), 0, 10_000_000) or 0.0
    monthly = _optional_number(rules.get("monthly"), 0, 1_000_000) or 0.0
    if initial == 0 and monthly == 0:
        monthly = 100.0
    dip_drop = _optional_number(rules.get("dip_drop_pct"), 1, 90)
    dip_extra = _optional_number(rules.get("dip_extra"), 0, 1_000_000) or (2 * monthly if dip_drop else 0.0)
    stop_loss = _optional_number(rules.get("stop_loss_pct"), 1, 90)
    start_year = int(_optional_number(rules.get("start_year"), 2016, 2024) or 2016)

    closes = [c for c in analytics.monthly_closes([symbol]).get(symbol, []) if c[0] >= f"{start_year}-01"]
    if len(closes) < 13:
        raise HTTPException(400, "Not enough price history to test that.")
    strategy_rows, events = analytics.backtest(closes, initial, monthly, dip_drop, dip_extra, stop_loss)
    simple_rows, _ = analytics.backtest(closes, initial, monthly)

    def summary(rows):
        final, put_in = rows[-1]["value"], rows[-1]["put_in"]
        return {"final": final, "put_in": put_in, "profit": round(final - put_in, 2),
                "profit_per_100": round(100 * (final / put_in - 1), 2) if put_in else 0.0}

    result = {
        "rules": {
            "name": str(rules.get("name") or "My strategy")[:60],
            "symbol": symbol,
            "initial": initial,
            "monthly": monthly,
            "dip_drop_pct": dip_drop,
            "dip_extra": dip_extra if dip_drop else None,
            "stop_loss_pct": stop_loss,
            "start": closes[0][0],
            "summary": str(rules.get("summary") or "")[:300],
            "not_supported": str(rules.get("not_supported") or "")[:300],
        },
        "strategy": summary(strategy_rows),
        "simple": summary(simple_rows),
        "series": [
            {"month": s["month"], "strategy": s["value"], "simple": b["value"], "put_in": s["put_in"]}
            for s, b in zip(strategy_rows, simple_rows)
        ],
        "events": events[:40],
        "event_count": len(events),
        "disclaimer": DISCLAIMER,
    }
    try:
        verdict = ai.complete([
            {"role": "system", "content": VERDICT_PROMPT},
            {"role": "user", "content": json.dumps({k: result[k] for k in ("rules", "strategy", "simple", "event_count")})},
        ], temperature=0.3).get("content") or ""
    except Exception:
        verdict = ""
    result["verdict"] = verdict
    return result
