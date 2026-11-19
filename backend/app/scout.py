"""Fund scout: searches every US-listed fund, screens it down, and lets an AI agent find funds for a person's wishes.

The funnel, in order:
  1. Every US fund        the full list of US-listed ETFs (refreshed weekly from Alpaca by the data job)
  2. Safety screen        code removes leveraged, inverse, crypto, options and single-stock funds
  3. Agent search         an AI agent searches what's left for the person's wishes, using a search tool
  4. History check        live prices from Alpaca: keep funds with history back to 2016 (8+ years)
  5. Into the engine      survivors join the 26 hand-checked core funds; the optimiser decides if they earn a place

No web search and no paid tools: everything here is free.
"""
import json
import re
import time

from . import ai, analytics, db

SCREENS = [
    ("Leveraged or inverse", "They multiply or flip daily moves; built for day traders, not plans",
     re.compile(r"\b(\d(\.\d)?x|-\dx|ultra\w*|bull|bear|inverse|short|leveraged|daily target|daily\b.*\b(long|short))\b", re.I)),
    ("Crypto", "Prices can swing 50% or more; too new to judge over a decade",
     re.compile(r"\b(bitcoin|btc|ether(eum)?|crypto\w*|solana|xrp|blockchain|digital asset)\b", re.I)),
    ("Options and buffer funds", "Complex payoffs or one company's fate; hard for a beginner to understand",
     re.compile(r"\b(covered call|option\w*|buffer\w*|defined outcome|target outcome|premium income|yieldmax|autocallable|"
                r"0dte|single stock|enhanced yield|income strategy|structured)\b", re.I)),
    ("Notes, not funds", "Exchange-traded notes carry the issuing bank's credit risk",
     re.compile(r"\b(etn|exchange traded note|notes)\b", re.I)),
]
LOW_COST_BRANDS = re.compile(r"\b(vanguard|ishares|schwab|spdr|invesco|state street|fidelity)\b", re.I)
_cache = {"at": 0.0, "funds": None}


def all_funds():
    """Every US-listed fund in the weekly list (cached for 6 hours)."""
    if _cache["funds"] is not None and time.time() - _cache["at"] < 6 * 3600:
        return _cache["funds"]
    try:
        funds = db.select("symbols", {"select": "symbol,name", "asset_type": "eq.etf", "order": "symbol"})
    except Exception:
        funds = []
    _cache.update(at=time.time(), funds=funds)
    return funds


def funnel():
    """Counts at each safety step, plus the funds that survive."""
    funds = all_funds()
    stages = [{"label": "Every US-listed fund", "count": len(funds), "why": "The full list of US exchange-traded funds, refreshed weekly."}]
    left = funds
    for label, why, pattern in SCREENS:
        left = [f for f in left if not pattern.search(f["name"] or "")]
        stages.append({"label": f"Without: {label.lower()}", "count": len(left), "why": why})
    return stages, left


def search_tool(survivors, core):
    def search_funds(query: str):
        words = [w for w in re.findall(r"[a-z0-9&+]+", (query or "").lower()) if len(w) > 1][:4]
        if not words:
            return {"results": []}
        hits = [f for f in survivors if all(w in (f["name"] or "").lower() for w in words)]
        hits.sort(key=lambda f: (f["symbol"] not in core, not LOW_COST_BRANDS.search(f["name"] or ""), len(f["name"] or "")))
        return {"query": query, "matches": len(hits),
                "results": [{"symbol": f["symbol"], "name": f["name"], "in_core_list": f["symbol"] in core} for f in hits[:12]]}
    return search_funds


SCOUT_PROMPT = """You are a fund research agent for a beginner investing app (educational, play money).
A person described what they'd like in their investments. Find US index funds (ETFs) that match their wishes.

Use the search_funds tool with short keywords (1 to 3 words, e.g. "clean energy", "cybersecurity", "india", "esg").
Search 2 to 5 times with different keywords. The tool only returns funds that already passed a safety screen.

Then pick at most 4 funds that best match the wishes. Prefer: broad, plain index funds that hold many companies;
big low-cost families (Vanguard, iShares, Schwab, SPDR, Invesco). Skip anything marked in_core_list (we already have it)
unless nothing else fits. If the wishes are already covered by ordinary funds, pick nothing.

Reply with JSON only:
{"searched": ["keywords you searched"], "picks": [{"symbol": "...", "reason": "one short sentence on why it fits"}],
 "summary": "one sentence on what you looked for and what you found"}"""

SEARCH_SPEC = [{"type": "function", "function": {
    "name": "search_funds",
    "description": "Search every US-listed fund that passed the safety screen. Matches all words in the fund's name.",
    "parameters": {"type": "object", "properties": {"query": {"type": "string", "description": "1 to 3 keywords"}},
                   "required": ["query"]}}}]


def guess_kind(name):
    n = (name or "").lower()
    if re.search(r"\b(bond|treasury|treasuries|municipal|income|aggregate|tips|credit)\b", n):
        return "bond"
    if re.search(r"\b(gold|silver|commodit|real estate|reit)\b", n):
        return "real_asset"
    return "stock"


def run(wishes_text, core_symbols, ensure_security, max_checks=4, months_of=None):
    """The agent search for one person's wishes. Returns the funnel, what the agent did, and the funds that passed."""
    stages, survivors = funnel()
    report = {"stages": stages, "searched": [], "summary": "", "candidates": [], "added": [], "model": None, "ran": False}
    if not survivors or not wishes_text.strip():
        return report
    by_symbol = {f["symbol"]: f for f in survivors}
    search_funds = search_tool(survivors, set(core_symbols))
    trace = []
    try:
        reply = ai.run_with_tools(
            [{"role": "system", "content": SCOUT_PROMPT}, {"role": "user", "content": f"Their wishes: {wishes_text[:300]}"}],
            SEARCH_SPEC, {"search_funds": search_funds}, max_rounds=6, trace=trace, smart=True)
        data = ai.parse_json(reply)
    except Exception as error:
        report["error"] = f"The agent couldn't run just now ({str(error)[:80]})."
        return report
    report.update(ran=True, model=ai.last_model["name"], summary=str(data.get("summary") or "")[:240],
                  searched=[t["args"].get("query") for t in trace if t["tool"] == "search_funds"][:6])
    matched = len({r["symbol"] for t in trace for r in (t.get("result") or {}).get("results", [])})
    report["stages"].append({"label": "Matched your wishes (agent search)", "count": matched,
                             "why": f"The agent searched {len(report['searched'])} times: " + ", ".join(f'"{q}"' for q in report["searched"])})
    report["raw_picks"] = [str(p.get("symbol") or "").upper().strip() for p in (data.get("picks") or [])]
    picks = []
    for p in (data.get("picks") or [])[:max_checks]:
        sym = str(p.get("symbol") or "").upper().strip()
        if sym in by_symbol and sym not in [x["symbol"] for x in picks]:  # never trust a symbol the search didn't return
            picks.append({"symbol": sym, "name": by_symbol[sym]["name"], "reason": str(p.get("reason") or "")[:200]})
    for p in picks:
        if p["symbol"] in core_symbols:
            p["status"], p["note"] = "core", "Already in the 26 core funds."
            continue
        try:
            if months_of:  # read-only check (used by the evaluations)
                months = months_of(p["symbol"])
            else:
                ensure_security(p["symbol"])
                months = len(analytics.monthly_closes([p["symbol"]]).get(p["symbol"], []))
        except Exception:
            months = 0
        if months > 96:
            p["status"], p["note"] = "added", f"{months} months of prices since 2016. Fee not verified: assumed 0.75% a year and capped at 10% of the mix."
            report["added"].append({"symbol": p["symbol"], "name": p["name"], "kind": guess_kind(p["name"])})
        elif months:
            p["status"], p["note"] = "too_new", f"Only {months} months of prices; the engine needs 8+ years to judge it."
        else:
            p["status"], p["note"] = "no_data", "No price history available."
    report["candidates"] = picks
    report["stages"].append({"label": "Picked and checked by the agent", "count": len(picks),
                             "why": "At most 4 picks; each checked live for 8+ years of price history."})
    report["stages"].append({"label": "Passed the history check", "count": len(report["added"]),
                             "why": "These join the 26 core funds. The optimiser decides if they earn a place."})
    return report
