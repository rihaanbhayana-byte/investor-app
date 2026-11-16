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
