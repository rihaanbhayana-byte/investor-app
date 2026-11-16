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
