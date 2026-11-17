"""Investor App API. Run locally from the backend folder:  uvicorn app.main:app --reload"""
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import analytics, confidence, db, guardrails, risk

app = FastAPI(title="Investor App API", version="1.0.0")


# Turn unexpected crashes into a readable error. This must be added BEFORE the CORS
# middleware, so the browser still receives the CORS header and can show the message
# (otherwise it only says "Failed to fetch").
@app.middleware("http")
async def readable_errors(request, call_next):
    try:
        return await call_next(request)
    except Exception as error:  # noqa: BLE001
        print(f"ERROR on {request.url.path}: {error!r}")
        return JSONResponse(status_code=500, content={"detail": f"Server error: {error}"})


app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def ai_rate_limit(request: Request):
    """Guardrail layer 1: every AI endpoint uses this, so one visitor can't use up the free AI quota."""
    message = guardrails.rate_limited(guardrails.client_ip(request))
    if message:
        raise HTTPException(429, message)


def screen_or_reject(text, check_topic=True):
    """For single-text AI features: clean the text, and reject it with a friendly 400 if a guardrail blocks it."""
    clean, notices, blocked = guardrails.screen_input(text, check_topic=check_topic)
    if blocked:
        messages = {
            "off_topic": "That doesn't look like an investing question. Try describing a money goal or strategy.",
            "harmful": "Sorry, I can't help with that.",
            "injection": "That request can't be processed. Please describe your goal in plain words.",
            "crisis": guardrails.CANNED["crisis"],
        }
        raise HTTPException(400, messages[blocked["type"]])
    return clean

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
    months, returns = analytics.portfolio_returns(weights_of(portfolio))
    yearly = analytics.project(returns, request.initial_amount, request.monthly_contribution, request.years)
    final, odds = yearly[-1], yearly[-1]["odds"]
    chance = odds["more_than_put_in"]
    level = "high" if chance >= 0.85 else "medium" if chance >= 0.65 else "low"
    years = request.years
    insight = confidence.insight(
        level,
        f"{round(chance * 100)}% of futures end above what you put in",
        f"Share of {odds['paths']:,} simulated futures, each built from random real months of "
        f"{portfolio['name']} returns ({months[0]} to {months[-1]}, {len(returns)} months).",
        value=chance,
        why=[
            f"In the likely case you'd have about ${final['median']:,.0f} after {years} year{'s' if years != 1 else ''}, from ${final['contributed']:,.0f} put in.",
            f"In a bad case (1 future in 10) you'd have about ${final['low']:,.0f}.",
            f"{round(odds['more_than_put_in_after_inflation'] * 100)}% of futures stay ahead of what you put in even after 2.5% yearly inflation.",
            "Short plans are less certain: there's less time to recover from a crash." if years < 5 else "",
        ],
        based_on=[f"{len(returns)} months of real {portfolio['name']} returns ({months[0]} to {months[-1]})",
                  f"{odds['paths']:,} simulated futures"],
        assumptions=["Future months behave like random months since 2016 (a strong decade for stocks).",
                     "2.5% yearly inflation", "No fees or taxes"],
    )
    return {
        "risk_level": request.risk_level,
        "portfolio_name": portfolio["name"],
        "final": final,
        "yearly": yearly,
        "insight": insight,
        "disclaimer": DISCLAIMER,
    }


def featured_securities(columns="symbol,name,asset_type,sector"):
    """Our 36 hand-picked stocks. Stocks users add by searching are stored too, but aren't listed here."""
    try:
        return db.select("securities", {"select": columns, "featured": "is.true", "order": "symbol"})
    except Exception:
        # search.sql hasn't been run yet, so there is no "featured" column: every stored stock is one of ours
        return db.select("securities", {"select": columns, "order": "symbol"})


@app.get("/stocks")
def get_stocks():
    securities = featured_securities()
    series = analytics.monthly_closes([s["symbol"] for s in securities])
    for security in securities:
        closes = series.get(security["symbol"], [])
        security["latest_price"] = closes[-1][1] if closes else None
        security["return_1y"] = round(closes[-1][1] / closes[-13][1] - 1, 4) if len(closes) >= 13 else None
    return securities


@app.get("/stocks/{symbol}")
def get_stock_page(symbol: str, request: Request):
    return get_stock(symbol, request)


def get_stock(symbol, request=None):
    """One stock with its price history and financials (fetched and saved on first use)."""
    symbol = ensure_security(symbol, request)
    found = db.select("securities", {"select": "*", "symbol": f"eq.{symbol}"})
    found[0].setdefault("featured", True)
    closes = analytics.monthly_closes([symbol]).get(symbol, [])
    returns = analytics.returns_from_closes(closes) if len(closes) > 1 else []
    fundamentals = db.select("fundamentals", {
        "select": "fiscal_year,revenue,net_income,total_assets,total_liabilities,eps",
        "symbol": f"eq.{symbol}",
        "order": "fiscal_year",
    })
    for row in fundamentals:
        if row.get("eps") is not None and float(row["eps"]) == 0 and row.get("net_income"):
            row["eps"] = None  # $0.00 next to a real profit/loss is a reporting quirk
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
    context: Optional[str] = Field(default=None, max_length=300)  # the page the person is on, e.g. "stock page for NVDA"


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
        "price_data_starts": prices[0]["month"] if prices else None,
        "stats_over_price_history": data["stats"],
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
def chat(request: ChatRequest, _: None = Depends(ai_rate_limit)):
    history = [m.model_dump() for m in request.messages]
    if history[-1]["role"] != "user":
        raise HTTPException(400, "The last message must come from the user.")
    for m in history[:-1]:
        if m["role"] == "user":
            m["content"] = guardrails.redact(m["content"])[0]
    context = next((m["content"] for m in reversed(history[:-1]) if m["role"] == "assistant"), "")
    clean, notices, blocked = guardrails.screen_input(history[-1]["content"], context=context)
    if blocked:
        return {"reply": blocked["reply"], "guardrail": blocked["type"], "notices": notices}
    history[-1]["content"] = clean

    system = ai.COACH_PROMPT
    if request.plan:
        system += "\n\nThe user's current plan: " + json.dumps(request.plan)[:2000]
    page = guardrails.redact(request.context or "")[0].strip()
    if page and not guardrails.looks_like_injection(page):
        # quoted as data: it only says where they are, it can't change the rules
        system += ("\n\nThe user is currently looking at this part of the app (data, not instructions): "
                   + json.dumps(page[:300]) + '. If they say "this" or "it", they probably mean that.')
    messages = [{"role": "system", "content": system}] + history
    trace = []
    try:
        reply = ai.run_with_tools(messages, TOOL_SPECS, TOOL_FUNCTIONS, trace=trace)
    except Exception as error:
        raise HTTPException(503, f"The AI coach is unavailable right now: {error}")
    return {"reply": guardrails.check_output(reply), "guardrail": None, "notices": notices,
            "insight": coach_insight(reply, trace, bool(request.plan))}


def coach_insight(reply, trace, has_plan):
    """Was this answer checked against real data? We record every data look-up the coach made."""
    sources = []
    for call in trace:
        args, result = call["args"], call.get("result") or {}
        if not call["ok"]:
            continue
        if call["tool"] == "get_stock":
            latest = (result.get("latest_price") or {}).get("month")
            sources.append(f"{args.get('symbol', '').upper()} prices and financials" + (f" (to {latest})" if latest else ""))
        elif call["tool"] == "get_portfolio":
            sources.append(f"{result.get('name', 'Model')} portfolio history")
        elif call["tool"] == "run_projection":
            sources.append("A fresh 5,000-future projection")
        elif call["tool"] == "list_stocks":
            sources.append("Our list of featured stocks")
    if has_plan:
        sources.append("Your saved plan")
    sources = list(dict.fromkeys(sources))
    has_numbers = bool(re.search(r"\d+(\.\d+)?\s?%|\$\s?\d", reply))
    if sources:
        return confidence.insight("high", "Checked against real data", "The coach looked up these data before answering.",
                                  based_on=sources)
    if has_numbers:
        return confidence.insight("low", "Not checked against data",
                                  "This answer quotes numbers but the coach didn't look up any data. Treat them as rough.",
                                  why=["Ask \"use real data\" or name a stock to get checked numbers."])
    return confidence.insight("medium", "General explanation", "No numbers to check: this is a general explanation.")


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
def parse_goal(request: GoalText, _: None = Depends(ai_rate_limit)):
    text = screen_or_reject(request.text)
    messages = [{"role": "system", "content": GOAL_PROMPT}, {"role": "user", "content": text}]
    try:
        try:
            reply = ai.complete(messages, temperature=0, json_mode=True)
        except RuntimeError:
            reply = ai.complete(messages, temperature=0)  # some models don't support JSON mode
        data = ai.parse_json(reply.get("content") or "")
    except Exception as error:
        raise HTTPException(503, f"Could not read your goal: {error}")
    result = {
        "goal": data.get("goal") if data.get("goal") in GOAL_OPTIONS else GOAL_OPTIONS[0],
        "initial_amount": round(_number(data.get("initial_amount"))),
        "monthly_contribution": round(_number(data.get("monthly_contribution"))),
        "years": int(min(50, max(1, _number(data.get("years"), 10)))),
        "summary": str(data.get("summary", ""))[:300],
    }
    return {**result, **goal_reader_check(text, result)}


GOAL_WORDS = {  # words that show the person named this goal themselves
    "Grow my wealth": ["wealth", "grow", "rich", "invest", "save", "saving"],
    "Retirement": ["retire", "pension", "old age"],
    "Buying a home": ["house", "home", "apartment", "flat", "deposit", "mortgage", "condo"],
    "Education": ["college", "university", "school", "education", "tuition", "degree"],
    "A big purchase": ["car", "vehicle", "wedding", "purchase", "travel", "trip", "holiday", "vacation", "laptop"],
}


def goal_reader_check(text, result):
    """Check the AI's reading against the person's own words: which numbers did they actually type?"""
    said = confidence.numbers_in(text)
    lower = text.lower()
    ages = bool(re.search(r"\b(age|aged|years old|when i'?m|retire at|by \d{2}\b)", lower))
    sources = {
        "initial_amount": confidence.source_of(result["initial_amount"], said),
        "monthly_contribution": confidence.source_of(
            result["monthly_contribution"], said,
            conversions=(lambda n: n * 52 / 12, lambda n: n / 12, lambda n: n * 26 / 12)),
        "years": confidence.source_of(result["years"], said, default=10),
    }
    if sources["years"] == "ai_guess" and ages:
        sources["years"] = "worked_out"
    keywords = GOAL_WORDS.get(result["goal"], [])
    sources["goal"] = "said_it" if any(w in lower for w in keywords) else "ai_guess"
    from_words = sum(1 for v in sources.values() if v in ("said_it", "worked_out"))
    guessed = [k for k, v in sources.items() if v == "ai_guess"]
    nice = {"goal": "goal", "initial_amount": "starting amount", "monthly_contribution": "monthly amount", "years": "timeline"}
    return {
        "sources": sources,
        "source_labels": {k: confidence.SOURCE_LABELS[v] for k, v in sources.items()},
        "insight": confidence.insight(
            confidence.level_from(from_words / 4),
            f"{from_words} of 4 details came from your words",
            "Code checks each number the AI filled in against the numbers you actually typed.",
            value=from_words / 4,
            why=[f"The AI guessed your {nice[k]}: please check it." for k in guessed]
                + [f"Your {nice[k]} wasn't mentioned, so it starts at {'10 years' if k == 'years' else '$0'}." for k, v in sources.items() if v == "not_said"],
            based_on=["Only the sentence you typed"],
            assumptions=["Weekly amounts are turned into monthly ones (x 52 / 12)."] if sources["monthly_contribution"] == "worked_out" else [],
        ),
    }


# =====================================================================
# AI: explain a stock in plain words
# =====================================================================
EXPLAIN_PROMPT = """You explain stocks and funds to complete beginners using ONLY the data provided.
Write 4 to 6 short bullet points covering: what it is; how the price has changed since the data starts
(use "price_data_starts" for the year, never assume 2016); how bumpy the ride has been (volatility and biggest
drop); and for companies, whether revenue is growing, whether it is profitable, and how its debts compare with
its assets.
Number rules:
- Ratios such as 0.075 or -0.42 are fractions: always write them as rounded percentages (8%, -42%). Never show raw decimals.
- Round money to whole dollars or to millions/billions ($9.1 billion), and percentages to whole numbers.
- Volatility is the typical size of a year's ups and downs around the average return, not how much value is lost
  each year. Explain it like: "a volatility of 42% means that in a typical year the price could end roughly 42% above
  or below its usual path, so it is a bumpy ride."
- If a financial value is 0 or missing, say the data isn't available instead of quoting it.
Use simple words and say what each number means. Do not recommend buying or selling.
Do not use headings; just bullet points.
Finish with the line: "Educational only, not financial advice." """

_explain_cache = {}


@app.get("/explain-stock/{symbol}")
def explain_stock(symbol: str, _: None = Depends(ai_rate_limit)):
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
    _explain_cache[key] = {"explanation": text, "insight": explain_insight(text, data)}
    return _explain_cache[key]


def explain_insight(text, data):
    """Fact-check the explanation: do the percentages it quotes match the real data?"""
    stats = data.get("stats_over_price_history") or {}
    first, last, year_ago = data.get("first_price_in_data"), data.get("latest_price"), data.get("price_1_year_ago")
    truths = [stats.get(k) for k in ("annual_return", "annual_volatility", "max_drawdown", "best_12_months", "worst_12_months", "total_return")]
    if first and last:
        truths.append(last["close"] / first["close"] - 1)
    if year_ago and last:
        truths.append(last["close"] / year_ago["close"] - 1)
    facts = data.get("financials_last_4_years") or []
    for a, b in zip(facts, facts[1:]):
        if a.get("revenue") and b.get("revenue"):
            truths.append(b["revenue"] / a["revenue"] - 1)
    matched, total = confidence.fact_check(text, truths)
    years = [f["fiscal_year"] for f in facts if f.get("fiscal_year")]
    based_on = [f"{data['symbol']} monthly prices, {first['month']} to {last['month']}" if first and last else ""]
    if years:
        based_on.append(f"SEC filings for fiscal years {years[0]} to {years[-1]}")
    if total == 0:
        return confidence.insight("medium", "No percentages to check", "Code compares every percentage in the answer with the real data.",
                                  based_on=based_on)
    share = matched / total
    return confidence.insight(
        confidence.level_from(share, high=0.9, medium=0.6),
        f"{matched} of {total} percentages match the data",
        "Code compares every percentage in the answer with values calculated from the price data and filings (within 1.5 points).",
        value=share,
        why=[] if matched == total else ["Some numbers didn't match exactly: they may be rounded or worked out another way. Check the chart."],
        based_on=based_on,
    )


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
def time_machine(request: Request, symbol: str, amount: float = Query(1000, gt=0, le=10_000_000), start: str = "2016-01"):
    symbol = ensure_security(symbol, request)
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
def compare(symbols: str, request: Request):
    wanted = list(dict.fromkeys(clean_symbol(s) for s in symbols.split(",") if s.strip()))[:4]
    wanted = [ensure_security(s, request) for s in wanted]
    if len(wanted) < 2:
        raise HTTPException(400, "Pick at least two different stocks.")
    series = analytics.monthly_closes(wanted)
    missing = [s for s in wanted if s not in series]
    if missing:
        raise HTTPException(404, f"Not in our list: {', '.join(missing)}")
    by_month = {s: dict(series[s]) for s in wanted}
    months = sorted(set.intersection(*(set(m) for m in by_month.values())))
    if len(months) < 2:
        raise HTTPException(400, "These stocks don't share enough price history to compare.")
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
        "price_data_starts": prices[0]["month"],
        "stats_over_price_history": data["stats"],
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
            "average_cost": round(p["cost"] / p["shares"], 4),  # keep precision; the page rounds once
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
def practice_trade(request: TradeRequest, http_request: Request, user_id: str = Depends(current_user)):
    symbol = ensure_security(request.symbol, http_request)
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
"symbol": ONE US stock or ETF ticker. Prefer ALLOWED; any other real US ticker the user names is fine. "S&P 500" means VOO, "Nasdaq" or "tech fund" means QQQ, "bonds" means BND,
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


class StrategyRules(BaseModel):
    """Rules the person edited by hand: re-running with these skips the AI completely."""
    name: Optional[str] = Field(default=None, max_length=60)
    symbol: str = Field(min_length=1, max_length=8)
    initial: float = Field(default=0, ge=0, le=10_000_000)
    monthly: float = Field(default=0, ge=0, le=1_000_000)
    dip_drop_pct: Optional[float] = Field(default=None, ge=1, le=90)
    dip_extra: Optional[float] = Field(default=None, ge=0, le=1_000_000)
    stop_loss_pct: Optional[float] = Field(default=None, ge=1, le=90)
    start_year: int = Field(default=2016, ge=2016, le=2024)
    summary: Optional[str] = Field(default=None, max_length=300)


class StrategyRequest(BaseModel):
    text: str = Field(min_length=5, max_length=600)
    rules: Optional[StrategyRules] = None


def _optional_number(value, low, high):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return min(high, max(low, number)) if number > 0 else None


@app.post("/strategy-test")
def strategy_test(request: StrategyRequest, http_request: Request, _: None = Depends(ai_rate_limit)):
    text = screen_or_reject(request.text)
    edited_by_user = request.rules is not None
    if edited_by_user:
        rules = request.rules.model_dump()
        if rules["initial"] == 0 and rules["monthly"] == 0:
            raise HTTPException(400, "Add a starting amount or a monthly amount to test.")
    else:
        allowed = [s["symbol"] for s in featured_securities("symbol")]
        messages = [
            {"role": "system", "content": STRATEGY_PROMPT + json.dumps(allowed)},
            {"role": "user", "content": text},
        ]
        try:
            try:
                reply = ai.complete(messages, temperature=0, json_mode=True)
            except RuntimeError:
                reply = ai.complete(messages, temperature=0)
            rules = ai.parse_json(reply.get("content") or "")
        except Exception as error:
            raise HTTPException(503, f"The AI couldn't read that strategy right now: {error}")

    try:
        symbol = ensure_security(str(rules.get("symbol") or "VOO"), http_request)
    except HTTPException as error:
        raise HTTPException(400, f"The strategy uses a ticker we couldn't find ({error.detail}) Try a US ticker like VOO, QQQ or AAPL.")
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
    result["insight"] = strategy_insight(text, rules, result, events, closes, edited_by_user)
    result["rules"]["edited"] = edited_by_user
    try:
        verdict = ai.complete([
            {"role": "system", "content": VERDICT_PROMPT},
            {"role": "user", "content": json.dumps({k: result[k] for k in ("rules", "strategy", "simple", "event_count")})},
        ], temperature=0.3).get("content") or ""
    except Exception:
        verdict = ""
    result["verdict"] = verdict
    return result


# =====================================================================
# Stock personality map (machine learning: k-means clustering)
# =====================================================================
from . import ml  # noqa: E402

_map_cache = {}


@app.get("/stock-map")
def stock_map(k: int = Query(4, ge=3, le=5)):
    today = f"{date.today().isoformat()}-k{k}"
    if today in _map_cache:
        return _map_cache[today]
    securities = featured_securities()
    series = analytics.monthly_closes([s["symbol"] for s in securities])
    stats = {}
    for s in securities:
        closes = series.get(s["symbol"], [])
        if len(closes) >= 25:
            stats[s["symbol"]] = analytics.summarize(analytics.returns_from_closes(closes))
    clusters, cluster_of, inertia, fit_of, overall = ml.stock_map(stats, k=k)
    clear = sum(1 for f in fit_of.values() if f["fit"] == "clear")
    map_insight = confidence.insight(
        "high" if overall >= 0.5 else "medium" if overall >= 0.25 else "low",
        f"Map quality: silhouette {overall:.2f}",
        "Silhouette score runs from -1 to 1: how much closer each stock is to its own group than to the next group. "
        "Above 0.5 = clear groups, 0.25-0.5 = fair, below 0.25 = groups overlap.",
        value=max(0.0, overall),
        why=[f"{clear} of {len(fit_of)} stocks clearly belong to their group; the rest sit between two groups."],
        based_on=[f"Monthly prices for {len(stats)} stocks since 2016"],
        assumptions=["Stocks are compared on 3 numbers only: yearly return, swings and biggest drop."],
    )
    info = {s["symbol"]: s for s in securities}
    result = {
        "points": [
            {
                **info[symbol],
                "annual_return": stats[symbol]["annual_return"],
                "annual_volatility": stats[symbol]["annual_volatility"],
                "max_drawdown": stats[symbol]["max_drawdown"],
                "cluster": cluster_of[symbol],
                **fit_of[symbol],
            }
            for symbol in sorted(stats)
        ],
        "insight": map_insight,
        "clusters": clusters,
        "method": (
            f"k-means clustering (k = {k}) on three numbers per stock from real monthly prices since 2016: "
            "average yearly return, volatility and biggest drop. The numbers are standardised first, "
            "and the algorithm finds the groups by itself."
        ),
        "inertia": inertia,
        "disclaimer": DISCLAIMER,
    }
    for key in [c for c in _map_cache if not c.startswith(date.today().isoformat())]:
        _map_cache.pop(key)  # forget yesterday's maps
    result["k"] = k
    _map_cache[today] = result
    return result


def strategy_insight(text, raw_rules, result, events, closes, edited_by_user=False):
    """Two measured things: did the AI read the rules from your words, and how much evidence is there?"""
    r = result["rules"]
    if edited_by_user:  # the person set every rule themselves: nothing was guessed
        text = " ".join(str(v) for v in (r["symbol"], r["initial"], r["monthly"], r.get("dip_drop_pct"),
                                         r.get("dip_extra"), r.get("stop_loss_pct"), r["start"][:4]) if v)
        raw_rules = {**raw_rules, "dip_extra": r.get("dip_extra"), "monthly": r["monthly"] or None}
    said = confidence.numbers_in(text)
    lower = text.lower()
    sources = {"symbol": "said_it" if r["symbol"].lower() in lower else "ai_guess"}
    for key in ("initial", "monthly", "dip_drop_pct", "dip_extra", "stop_loss_pct"):
        if r.get(key):
            sources[key] = confidence.source_of(r[key], said)
    if r["monthly"] == 100 and not raw_rules.get("monthly") and not raw_rules.get("initial"):
        sources["monthly"] = "ai_guess"
    if r.get("dip_extra") and not raw_rules.get("dip_extra"):
        sources["dip_extra"] = "ai_guess"  # we assumed 2x the monthly amount
    year = r["start"][:4]
    sources["start"] = "said_it" if year in text else "not_said"
    names = {"symbol": "what to buy", "initial": "starting amount", "monthly": "monthly amount", "dip_drop_pct": "dip size",
             "dip_extra": "extra on a dip", "stop_loss_pct": "sell-off level", "start": "start date"}
    guessed = [names[k] for k, v in sources.items() if v == "ai_guess"]
    read_level = "high" if not guessed else "medium" if len(guessed) == 1 else "low"

    triggers = sum(1 for e in events if e["type"] in ("dip", "stop_loss"))
    has_rule = bool(r.get("dip_drop_pct") or r.get("stop_loss_pct"))
    months = len(closes)
    if not has_rule:
        evidence, ev_label = ("high" if months >= 60 else "medium"), f"{months} months tested"
    elif triggers >= 8 and months >= 60:
        evidence, ev_label = "high", f"Rules fired {triggers} times in {months} months"
    elif triggers >= 3:
        evidence, ev_label = "medium", f"Rules fired only {triggers} times in {months} months"
    else:
        evidence, ev_label = "low", f"Rules fired just {triggers} time{'s' if triggers != 1 else ''}: too few to judge"
    gap = result["strategy"]["profit"] - result["simple"]["profit"]
    close_call = abs(gap) < 0.02 * max(result["simple"]["put_in"], 1)
    rank = {"low": 0, "medium": 1, "high": 2}
    overall = min(read_level, evidence, key=rank.get)
    return {
        **confidence.insight(
            overall, ev_label + (" · AI guessed " + ", ".join(guessed) if guessed else ""),
            "Two checks: code compares each rule with the numbers you typed, and counts how often your rules actually "
            "fired in the test. Few firings = luck can explain the result.",
            why=[
                f"Your strategy ended ${abs(gap):,.0f} {'ahead of' if gap >= 0 else 'behind'} simply investing every month."
                + (" That's within 2% of what you put in: too close to call." if close_call else ""),
                f"The AI guessed: {', '.join(guessed)}. Check the rules above." if guessed else ("You set every rule yourself." if edited_by_user else "Every rule came from your own words."),
            ],
            based_on=[f"{r['symbol']} monthly prices, {closes[0][0]} to {closes[-1][0]} ({months} months)"],
            assumptions=["Trades happen at month-end prices, with no fees or taxes.", "The past doesn't promise the future."],
        ),
        "rule_sources": sources,
    }


# =====================================================================
# Match my interests: the AI connects hobbies and brands to companies
# =====================================================================
MATCH_PROMPT = """You help complete beginners see which companies they already know.
The user describes their interests, hobbies or favourite brands. Pick 3 to 6 companies from the LIST that
are genuinely connected to those interests. Reply with JSON only:
{"matches": [{"symbol": "...", "reason": "one short sentence linking the interest to how this company makes money"}],
 "fund_tip": "one short sentence suggesting a broad fund from the LIST (VOO, VTI or QQQ) as a simpler way to own many of these at once",
 "no_match_note": "" }
Rules: only use symbols from the LIST. Never say buy or sell. If nothing in the LIST fits, return an empty
matches list and explain kindly in no_match_note.
LIST: """


def _safe(fn, *args):
    try:
        return fn(*args)
    except Exception as error:  # one failed run shouldn't sink the other
        return str(error)


class MatchRequest(BaseModel):
    text: str = Field(min_length=3, max_length=400)


@app.post("/match-interests")
def match_interests(request: MatchRequest, _: None = Depends(ai_rate_limit)):
    text = screen_or_reject(request.text, check_topic=False)
    stocks = get_stocks()
    listing = [{"symbol": s["symbol"], "name": s["name"], "sector": s["sector"]} for s in stocks]
    messages = [
        {"role": "system", "content": MATCH_PROMPT + json.dumps(listing)},
        {"role": "user", "content": text},
    ]
    def one_run(temperature):
        try:
            reply = ai.complete(messages, temperature=temperature, json_mode=True)
        except RuntimeError:
            reply = ai.complete(messages, temperature=temperature)
        return ai.parse_json(reply.get("content") or "")

    # Ask twice, independently (different randomness). Picks that come up both times are strong matches:
    # this is "self-consistency", a measured signal, unlike asking the AI how sure it is.
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(2) as pool:
        runs = list(pool.map(lambda t: _safe(one_run, t), (0.2, 0.9)))
    good_runs = [r for r in runs if isinstance(r, dict)]
    if not good_runs:
        raise HTTPException(503, f"The AI couldn't answer right now: {runs[0]}")
    data = good_runs[0]

    by_symbol = {s["symbol"]: s for s in stocks}
    votes, reasons = {}, {}
    for run in good_runs:
        for m in run.get("matches") or []:
            symbol = str(m.get("symbol", "")).upper()
            if symbol in by_symbol:  # unknown or made-up tickers are dropped
                votes[symbol] = votes.get(symbol, 0) + 1
                reasons.setdefault(symbol, str(m.get("reason") or "")[:200])
    order = sorted(votes, key=lambda s: -votes[s])
    runs_n = len(good_runs)
    matches = [{**by_symbol[s], "reason": reasons[s], "votes": votes[s], "runs": runs_n,
                "match": "Strong match" if votes[s] == runs_n and runs_n > 1 else "Possible match"} for s in order][:6]
    agreed = sum(1 for m in matches if m["votes"] == runs_n)
    share = agreed / len(matches) if matches else 0.0
    insight = confidence.insight(
        confidence.level_from(share, high=0.7, medium=0.4),
        f"{agreed} of {len(matches)} picks agreed by both AI runs" if runs_n > 1 else "Single AI run",
        "We ask the AI twice, independently. Picks that come up both times are strong matches; picks from only one run are possible matches.",
        value=share,
        why=["Liking a brand isn't a reason to invest on its own: check how the company actually makes money."],
        based_on=["Your description", f"Names and industries of our {len(stocks)} featured stocks"],
        assumptions=["Only our featured stocks are suggested. Search to find any other company."],
    )
    return {
        "matches": matches,
        "insight": insight,
        "fund_tip": str(data.get("fund_tip") or "")[:250],
        "no_match_note": str(data.get("no_match_note") or "")[:250],
        "disclaimer": "Educational only, not financial advice. Liking a brand isn't a reason to invest on its own.",
    }


# =====================================================================
# Portfolio Doctor: grade the practice portfolio and explain why
# =====================================================================
TARGET_VOLATILITY = {"conservative": 0.07, "moderate": 0.11, "aggressive": 0.16}

DOCTOR_PROMPT = """You are a friendly investing coach for complete beginners. You get the facts about a
PRACTICE portfolio (play money) as JSON, including a grade that was already calculated. Using ONLY these facts,
reply with JSON only:
{"headline": "one encouraging sentence summing up the portfolio (max 20 words)",
 "tips": ["3 short, specific tips that each mention real numbers from the facts"]}
Holdings with "is_fund": true are funds (ETFs) that hold hundreds of companies: never call them a single stock.
Match your tone to the grade: do not praise diversification if a check about it says "ok" or "warn".
Never tell the user to buy or sell a specific stock. You may suggest ideas like adding a broad fund or spreading money out."""


class DoctorRequest(BaseModel):
    risk_level: RiskLevel | None = None


@app.post("/practice/doctor")
def practice_doctor(request: DoctorRequest, user_id: str = Depends(current_user), _: None = Depends(ai_rate_limit)):
    state = practice_state(user_id)
    total = state["total"]
    holdings = state["holdings"]
    if not holdings:
        raise HTTPException(400, "Make a few practice trades first, then ask the doctor for a check-up.")

    info = {s["symbol"]: s for s in db.select("securities", {"select": "symbol,asset_type,sector"})}
    weights = {h["symbol"]: h["value"] / total for h in holdings}
    cash_share = state["cash"] / total
    invested_share = 1 - cash_share
    funds = [h["symbol"] for h in holdings if info.get(h["symbol"], {}).get("asset_type") == "etf"]
    single = [h for h in holdings if h["symbol"] not in funds]
    invested = sum(h["value"] for h in holdings)
    # Concentration is measured against the money that is actually invested, not the whole account,
    # otherwise a mostly-cash portfolio looks "well spread" just because every holding is small.
    fund_share = sum(h["value"] for h in holdings if h["symbol"] in funds) / invested if invested else 0.0
    biggest_single = max(single, key=lambda h: h["value"]) if single else None
    biggest_single_share = biggest_single["value"] / invested if biggest_single else 0.0

    sectors = {}
    for h in single:
        sector = info.get(h["symbol"], {}).get("sector") or "Other"
        sectors[sector] = sectors.get(sector, 0.0) + h["value"] / invested
    top_sector, top_sector_share = max(sectors.items(), key=lambda x: x[1]) if sectors else (None, 0.0)

    invested_weights = {h["symbol"]: h["value"] / invested for h in holdings} if invested else {}
    history = None
    if invested_weights:
        months, returns = analytics.portfolio_returns(invested_weights)
        if len(returns) >= 24:
            stats = analytics.summarize(returns)
            history = {
                "volatility": round(stats["annual_volatility"] * invested_share, 4),
                "worst_12_months": round(stats["worst_12_months"] * invested_share, 4),
                "annual_return": round(stats["annual_return"] * invested_share, 4),
            }

    # ---- deterministic score: the AI explains it, but doesn't decide it ----
    score, checks = 100, []

    def check(name, status, detail, penalty=0):
        nonlocal score
        score -= penalty
        checks.append({"name": name, "status": status, "detail": detail})

    if fund_share >= 0.5:
        check("Diversification", "good", f"{fund_share:.0%} of your invested money is in broad funds, which each hold many companies.")
    elif funds:
        check("Diversification", "ok", f"Only {fund_share:.0%} of your invested money is in funds; the rest rides on a few companies.", 10)
    elif len(holdings) >= 5:
        check("Diversification", "ok", f"{len(holdings)} different stocks, but no broad fund yet.", 15)
    else:
        check("Diversification", "warn", f"Only {len(holdings)} stock(s) and no fund, so one bad result hurts a lot.", 25)

    if biggest_single_share > 0.7:
        check("Biggest bet", "warn", f"{biggest_single['symbol']} is {biggest_single_share:.0%} of your invested money: almost everything rides on one company.", 30)
    elif biggest_single_share > 0.4:
        check("Biggest bet", "warn", f"{biggest_single['symbol']} is {biggest_single_share:.0%} of your invested money.", 15)
    elif biggest_single_share > 0.25:
        check("Biggest bet", "ok", f"{biggest_single['symbol']} is {biggest_single_share:.0%} of your invested money.", 10)
    else:
        check("Biggest bet", "good", "No single company is more than 25% of your invested money.")

    if top_sector and top_sector_share > 0.5:
        check("Industries", "warn", f"{top_sector_share:.0%} of your invested money is in one industry ({top_sector}).", 10)
    elif top_sector and top_sector_share > 0.35:
        check("Industries", "ok", f"{top_sector_share:.0%} of your invested money is in {top_sector}.", 5)
    else:
        check("Industries", "good", "Your single stocks are spread across industries.")

    if cash_share > 0.6:
        check("Cash", "warn", f"{cash_share:.0%} is still in cash, so most of your money isn't growing.", 25)
    elif cash_share > 0.3:
        check("Cash", "ok", f"{cash_share:.0%} is still in cash, so it isn't growing.", 10)
    else:
        check("Cash", "good", f"Only {cash_share:.0%} is sitting in cash.")

    level = request.risk_level
    if history and level:
        target = TARGET_VOLATILITY[level]
        ratio = history["volatility"] / target
        if ratio > 1.5:
            check("Matches your plan", "warn", f"It swings about {history['volatility']:.0%} a year, a lot more than a {level} plan (~{target:.0%}).", 15)
        elif ratio < 0.5:
            # if it's only calm because of idle cash, the Cash check already covers that
            check("Matches your plan", "ok", f"It's calmer ({history['volatility']:.0%} swings) than your {level} plan allows.", 0 if cash_share > 0.3 else 5)
        else:
            check("Matches your plan", "good", f"Its swings (~{history['volatility']:.0%} a year) suit a {level} plan.")

    score = max(0, score)
    grade = "A" if score >= 90 else "B" if score >= 75 else "C" if score >= 60 else "D" if score >= 45 else "F"

    facts = {
        "grade": grade,
        "score": score,
        "total_value": total,
        "cash_share": round(cash_share, 3),
        "holdings": [{"symbol": h["symbol"], "share_of_account": round(h["value"] / total, 3), "is_fund": h["symbol"] in funds} for h in holdings],
        "top_industry": top_sector,
        "top_industry_share": round(top_sector_share, 3),
        "history_since_2016": history,
        "risk_level_of_plan": level,
        "checks": checks,
    }
    headline, tips = "", []
    try:
        try:
            reply = ai.complete([{"role": "system", "content": DOCTOR_PROMPT}, {"role": "user", "content": json.dumps(facts)}], temperature=0.3, json_mode=True)
        except RuntimeError:
            reply = ai.complete([{"role": "system", "content": DOCTOR_PROMPT}, {"role": "user", "content": json.dumps(facts)}], temperature=0.3)
        data = ai.parse_json(reply.get("content") or "")
        headline = str(data.get("headline") or "")[:200]
        tips = [str(t)[:240] for t in (data.get("tips") or [])][:3]
    except Exception:
        tips = [c["detail"] for c in checks if c["status"] != "good"][:3]

    # fact-check the AI's tips against the portfolio's real numbers
    truths = [cash_share, top_sector_share, invested_share] + [h["value"] / total for h in holdings] + [h["value"] / invested for h in holdings if invested]
    truths += list((history or {}).values()) + [c for c in (biggest_single_share, fund_share)]
    matched, quoted = confidence.fact_check(" ".join(tips), truths)
    based = [f"Your {len(holdings)} holding{'s' if len(holdings) != 1 else ''} and cash, at the latest prices"]
    if history and invested_weights:
        based.append(f"{len(returns)} months of price history for this mix ({months[0]} to {months[-1]})")
    insight = confidence.insight(
        "high", "Fixed rules, not AI",
        "The grade comes from 5 fixed checks, so the same portfolio always gets the same grade. The AI only writes the tips."
        + (f" {matched} of {quoted} percentages in the tips match your portfolio." if quoted else ""),
        why=[f"{c['name']}: {c['detail']}" for c in checks if c["status"] != "good"][:3] or ["Every check passed."],
        based_on=based,
        assumptions=([f"It's compared with your {risk.NAMES[level]} plan."] if level else
                     ["You have no saved plan, so it isn't checked against a personality. Build a plan to add that check."])
                    + ([] if history else ["Not enough shared price history to judge how bumpy this mix is."]),
    )
    return {**facts, "headline": headline, "tips": tips, "insight": insight, "disclaimer": "Practice only. Educational, not financial advice."}



# =====================================================================
# Guardrails panel: what protects the AI, and how often each layer fired
# =====================================================================
@app.get("/guardrails")
def guardrail_info():
    return {
        "layers": [
            {"name": "Rate limit", "detail": "Each visitor can make 15 AI requests a minute and 300 a day."},
            {"name": "Personal data filter", "detail": "Card numbers, SSNs, emails, phone numbers and passwords are removed before the AI sees them."},
            {"name": "Prompt-injection block", "detail": "Attempts to override or reveal the AI's instructions are refused."},
            {"name": "Topic check", "detail": "A fast AI classifier keeps the coach on investing and money, and refuses harmful requests."},
            {"name": "Crisis support", "detail": "Messages about self-harm get support resources instead of an answer."},
            {"name": "Grounded answers", "detail": "The AI must look up real data with tools before quoting any number."},
            {"name": "Output check", "detail": "Answers that sound like promises or buy/sell orders get a caution note."},
        ],
        "counts_since_restart": dict(guardrails.stats),
    }



# =====================================================================
# Any US stock or ETF: fetched from Alpaca + SEC the first time someone
# uses it, then saved, so every tool works with it and the nightly job keeps it fresh.
# =====================================================================
import threading  # noqa: E402
from collections import defaultdict, deque  # noqa: E402

_add_lock = threading.Lock()
_added_by_visitor = defaultdict(deque)
NEW_STOCKS_PER_DAY = 40  # per visitor, so nobody can drain the free Alpaca quota


def _is_stored(symbol):
    return bool(db.select("securities", {"select": "symbol", "symbol": f"eq.{symbol}"}))


def ensure_security(symbol, request=None):
    """Make sure `symbol` is in our database. Returns the cleaned ticker, or raises a friendly 404/429."""
    symbol = clean_symbol(str(symbol).replace("-", "."))
    if _is_stored(symbol):
        return symbol
    if request is not None:
        hits, now = _added_by_visitor[guardrails.client_ip(request)], time.time()
        while hits and now - hits[0] > 86400:
            hits.popleft()
        if len(hits) >= NEW_STOCKS_PER_DAY:
            raise HTTPException(429, "You've added a lot of new stocks today. Please try again tomorrow.")
    with _add_lock:
        if _is_stored(symbol):  # someone else added it while we waited
            return symbol
        try:
            listed = db.select("symbols", {"select": "symbol,name,asset_type,cik", "symbol": f"eq.{symbol}"})
        except Exception:
            listed = []  # search.sql not run yet: fall back to the SEC list
        info = listed[0] if listed else None
        if not info:
            match = live.find(symbol)
            if match:
                info = {"symbol": symbol, "name": match["name"].title(), "asset_type": "stock", "cik": match["cik"]}
        if not info:
            raise HTTPException(404, f"We couldn't find {symbol}. Check the ticker and try again.")
        try:
            bars = live.daily_bars(symbol)
        except Exception as error:
            raise HTTPException(502, f"Couldn't fetch prices for {symbol} right now: {error}")
        if len(bars) < 20:
            raise HTTPException(404, f"{symbol} doesn't have enough price history yet.")

        row = {"symbol": symbol, "name": info["name"], "asset_type": info["asset_type"], "sector": None,
               "cik": info.get("cik"), "featured": False}
        upsert = "resolution=merge-duplicates,return=minimal"
        try:
            db.admin("POST", "securities", params={"on_conflict": "symbol"}, json=row, prefer=upsert)
        except RuntimeError as error:
            if "featured" not in str(error):
                raise
            raise HTTPException(503, "Run database/search.sql in Supabase to turn on searching any stock.")
        prices = [{"symbol": symbol, "date": b["t"][:10], "open": b["o"], "high": b["h"], "low": b["l"],
                   "close": b["c"], "volume": int(b["v"])} for b in bars]
        for i in range(0, len(prices), 1000):
            db.admin("POST", "daily_prices", params={"on_conflict": "symbol,date"}, json=prices[i:i + 1000], prefer=upsert)
        if info["asset_type"] == "stock" and info.get("cik"):
            try:
                facts = [{"symbol": symbol, **f} for f in live.fundamentals(info["cik"])]
                if facts:
                    db.admin("POST", "fundamentals", params={"on_conflict": "symbol,fiscal_year"}, json=facts, prefer=upsert)
            except Exception:
                pass  # financials are a bonus; prices are what the tools need
    if request is not None:
        _added_by_visitor[guardrails.client_ip(request)].append(time.time())
    return symbol


@app.get("/quote/{symbol}")
def quote(symbol: str, request: Request):
    """Latest price for any US stock or ETF (adds it to our database on first use)."""
    symbol = ensure_security(symbol, request)
    info = db.select("securities", {"select": "*", "symbol": f"eq.{symbol}"})[0]
    price, as_of = latest_prices([symbol]).get(symbol, (None, None))
    if not price:
        raise HTTPException(404, f"No recent price for {symbol}.")
    return {"symbol": symbol, "name": info["name"], "asset_type": info["asset_type"],
            "featured": info.get("featured", True), "price": price, "as_of": as_of}



# =====================================================================
# Feedback on AI answers (thumbs up / down) and a summary for the write-up
# =====================================================================
FEATURES = ("coach", "explain", "matcher", "strategy", "goal_reader", "personality", "projection", "doctor", "stock_map")


class FeedbackRequest(BaseModel):
    feature: Literal[FEATURES]
    helpful: bool
    confidence_level: Optional[Literal["high", "medium", "low"]] = None
    note: Optional[str] = Field(default=None, max_length=200)


@app.post("/feedback")
def save_feedback(body: FeedbackRequest, request: Request, authorization: Optional[str] = Header(default=None)):
    if guardrails.rate_limited(guardrails.client_ip(request)):
        raise HTTPException(429, "Thanks! That's plenty of feedback for now.")
    user = None
    if authorization and authorization.lower().startswith("bearer "):
        found = db.get_user(authorization.split(" ", 1)[1])
        user = found["id"] if found else None
    note = guardrails.redact(body.note)[0] if body.note else None
    try:
        db.admin("POST", "ai_feedback", json={"feature": body.feature, "helpful": body.helpful,
                                               "confidence_level": body.confidence_level, "note": note, "user_id": user},
                 prefer="return=minimal")
    except RuntimeError as error:
        raise HTTPException(503, f"Couldn't save feedback: {error}. Run database/feedback.sql in Supabase.")
    return {"saved": True}


@app.get("/ai-stats")
def ai_stats():
    """How helpful people found each AI feature, split by the confidence we showed. Great for the write-up."""
    try:
        rows = db.admin("GET", "ai_feedback", params={"select": "feature,helpful,confidence_level", "limit": 10000}) or []
    except RuntimeError:
        rows = []
    summary = {}
    for r in rows:
        f = summary.setdefault(r["feature"], {"votes": 0, "helpful": 0, "by_confidence": {}})
        f["votes"] += 1
        f["helpful"] += r["helpful"]
        c = f["by_confidence"].setdefault(r["confidence_level"] or "none", {"votes": 0, "helpful": 0})
        c["votes"] += 1
        c["helpful"] += r["helpful"]
    return {"features": summary, "total_votes": len(rows)}
