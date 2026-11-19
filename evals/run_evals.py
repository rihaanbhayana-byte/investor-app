"""Seedwise evaluations: one command that tests every AI step and the portfolio engine, then writes a report.

Run it in either place:
  - GitHub:  Actions -> "AI evaluations" -> Run workflow  (download the report from the run page)
  - Laptop:  python evals/run_evals.py            (uses the .env file in the project folder)

Options:
  --models openai/gpt-oss-120b,openai/gpt-oss-20b   models to compare on the goal and wish readers
  --skip redteam,scout,...                          leave sections out
  --quick                                           smaller samples, for a fast check

It only READS your database. It uses your free Groq quota (about 300 requests) and takes about 10 to 15 minutes,
because it waits between requests to stay inside the free rate limit.
"""
import argparse
import json
import pathlib
import re
import sys
import time
import traceback

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
DATA = pathlib.Path(__file__).parent / "data"
OUT = pathlib.Path(__file__).parent / "out"

from app import ai, analytics, engine, guardrails, live, main, risk, scout  # noqa: E402

# ---------------------------------------------------------------------
# Stay inside the free rate limit, retry when the AI is busy, and count tokens
# ---------------------------------------------------------------------
MIN_GAP = 2.2  # seconds between AI requests (Groq free tier: 30 a minute)
_last = [0.0]
USAGE = {"requests": 0, "prompt_tokens": 0, "completion_tokens": 0, "retries": 0, "failed": 0, "daily_cap_hit": False}
_busy_in_a_row = [0]
_orig_send = ai._send
_orig_post = ai._http.post


def _post(*args, **kwargs):
    r = _orig_post(*args, **kwargs)
    try:
        u = r.json().get("usage") or {}
        USAGE["prompt_tokens"] += u.get("prompt_tokens", 0)
        USAGE["completion_tokens"] += u.get("completion_tokens", 0)
    except Exception:
        pass
    return r


def _send(*args, **kwargs):
    if _busy_in_a_row[0] >= 6:  # the free daily cap is used up: fail fast instead of waiting all day
        USAGE["daily_cap_hit"] = True
        USAGE["failed"] += 1
        raise RuntimeError("Daily free AI limit reached; try again tomorrow or use --quick")
    for attempt in range(4):
        wait = MIN_GAP - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        USAGE["requests"] += 1
        try:
            out = _orig_send(*args, **kwargs)
            _busy_in_a_row[0] = 0
            return out
        except RuntimeError as error:
            if "limit" in str(error).lower() or "429" in str(error) or "503" in str(error):
                USAGE["retries"] += 1
                _busy_in_a_row[0] += 1
                if _busy_in_a_row[0] >= 6:
                    break
                time.sleep(15 * (attempt + 1))
                continue
            USAGE["failed"] += 1
            raise
    USAGE["failed"] += 1
    raise RuntimeError("Still rate-limited after 5 tries")


ai._send = _send
ai._http.post = _post


def use_model(model):
    """Point every AI call at one model (the smart model is switched off so the comparison is fair)."""
    ai.AI_MODEL = model
    ai.SMART_API_KEY = ""


def timed(fn, *a, **k):
    t = time.time()
    out = fn(*a, **k)
    return out, time.time() - t


def log(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------------
# 1. Goal reader: does the AI read money, years and the goal correctly?
# ---------------------------------------------------------------------
def eval_goals(models, quick):
    cases = json.loads((DATA / "goals.json").read_text())[: 20 if quick else None]
    results = {}
    real_screen = main.screen_or_reject
    main.screen_or_reject = lambda text, check_topic=True: real_screen(text, check_topic=False)  # the topic check is tested in section 5
    try:
        return _goal_loop(cases, models, results)
    finally:
        main.screen_or_reject = real_screen


def _goal_loop(cases, models, results):
    for model in models:
        use_model(model)
        rows = []
        log(f"\n[goal reader] {model}: {len(cases)} goals")
        for c in cases:
            try:
                got, secs = timed(main.parse_goal, main.GoalText(text=c["text"]), None)
                ok = {
                    "goal": got["goal"] == c["goal"],
                    "initial": abs(got["initial_amount"] - c["initial_amount"]) <= max(1, 0.01 * c["initial_amount"]),
                    "monthly": abs(got["monthly_contribution"] - c["monthly_contribution"]) <= max(1, 0.03 * c["monthly_contribution"]),
                    "years": got["years"] in c.get("years_ok", [c["years"]]),
                }
                rows.append({"text": c["text"], "tag": c["tag"], "ok": ok, "all": all(ok.values()), "secs": secs,
                             "got": {k: got[k] for k in ("goal", "initial_amount", "monthly_contribution", "years")},
                             "want": {k: c[k] for k in ("goal", "initial_amount", "monthly_contribution", "years")}})
            except Exception as error:
                rows.append({"text": c["text"], "tag": c["tag"], "error": str(error)[:200], "all": False,
                             "ok": {"goal": False, "initial": False, "monthly": False, "years": False}, "secs": None})
        n = len(rows)
        results[model] = {
            "n": n, "all_correct": sum(r["all"] for r in rows) / n,
            "fields": {f: sum(r["ok"][f] for r in rows) / n for f in ("goal", "initial", "monthly", "years")},
            "errors": sum("error" in r for r in rows),
            "median_secs": _median([r["secs"] for r in rows if r["secs"]]),
            "misses": [r for r in rows if not r["all"]],
        }
        log(f"  all fields right: {results[model]['all_correct']:.0%}  fields: { {k: f'{v:.0%}' for k, v in results[model]['fields'].items()} }")
    return results


# ---------------------------------------------------------------------
# 2. Wish reader: words -> engine rules
# ---------------------------------------------------------------------
def _max_ok(want, got):
    if want is None:
        return got is None or got >= 6
    if isinstance(want, str) and want.startswith("<="):
        return got is not None and got <= int(want[2:])
    return got == want


def eval_wishes(models, quick):
    cases = json.loads((DATA / "wishes.json").read_text())[: 12 if quick else None]
    results = {}
    for model in models:
        use_model(model)
        rows = []
        log(f"\n[wish reader] {model}: {len(cases)} wishes")
        for c in cases:
            try:
                got, secs = timed(main.read_preferences, c["text"])
                tilts, excl = set(got["tilts"]), set(got["exclude"])
                ok = tilts == set(c["tilts"]) and excl == set(c["exclude"]) and _max_ok(c["max_funds"], got["max_funds"]) \
                    and not (set(c["never"]) & tilts)
                rows.append({"text": c["text"], "ok": ok, "by": got["read_by"], "secs": secs,
                             "got": {"tilts": sorted(tilts), "exclude": sorted(excl), "max_funds": got["max_funds"]},
                             "want": {"tilts": c["tilts"], "exclude": c["exclude"], "max_funds": c["max_funds"]}})
            except Exception as error:
                rows.append({"text": c["text"], "ok": False, "error": str(error)[:200], "by": "error", "secs": None})
        n = len(rows)
        results[model] = {"n": n, "exact": sum(r["ok"] for r in rows) / n,
                          "ai_answered": sum(r["by"] == "ai" for r in rows) / n,
                          "median_secs": _median([r["secs"] for r in rows if r["secs"]]),
                          "misses": [r for r in rows if not r["ok"]]}
        log(f"  exactly right: {results[model]['exact']:.0%}  (AI answered {results[model]['ai_answered']:.0%}; rest fell back to keywords)")
    return results


# ---------------------------------------------------------------------
# 3. Fund agent: does it find relevant, safe funds, and never invent one?
# ---------------------------------------------------------------------
def eval_scout(quick):
    cases = json.loads((DATA / "scout.json").read_text())[: 4 if quick else None]
    core = [f["symbol"] for f in engine.FUNDS]
    months_of = lambda s: len(live.monthly_prices(s))  # noqa: E731  read-only: never writes to the database
    stages, survivors = scout.funnel()
    log(f"\n[fund agent] {len(cases)} wishes over {stages[0]['count']} funds ({stages[-1]['count']} after the safety screen)")
    rows = []
    for c in cases:
        try:
            rep, secs = timed(scout.run, c["text"], core, main.ensure_security, months_of=months_of)
            pat = re.compile(c["relevant"], re.I)
            picks = rep["candidates"]
            relevant = [p for p in picks if pat.search(p["name"] or "")]
            invented = [s for s in rep.get("raw_picks", []) if s and s not in {p["symbol"] for p in picks}]
            screened_bad = [p for p in picks for _, _, rx in scout.SCREENS if rx.search(p["name"] or "")]
            rows.append({"text": c["text"], "ran": rep["ran"], "searched": rep["searched"], "picks": [(p["symbol"], p["name"], p["status"]) for p in picks],
                         "relevant": len(relevant), "n_picks": len(picks), "invented_rejected": invented,
                         "unsafe_picks": len(screened_bad), "passed_history": len(rep["added"]), "secs": secs, "model": rep.get("model")})
            log(f"  {c['text']!r}: searched {rep['searched']} -> {[p['symbol'] for p in picks]} ({len(relevant)} relevant)")
        except Exception as error:
            rows.append({"text": c["text"], "ran": False, "error": str(error)[:200], "n_picks": 0, "relevant": 0,
                         "invented_rejected": [], "unsafe_picks": 0, "passed_history": 0, "secs": None})
    picks = sum(r["n_picks"] for r in rows)
    return {"funnel": stages, "rows": rows, "ran": sum(r["ran"] for r in rows) / len(rows),
            "relevance": (sum(r["relevant"] for r in rows) / picks) if picks else None,
            "invented_rejected": sum(len(r["invented_rejected"]) for r in rows),
            "unsafe_picks": sum(r["unsafe_picks"] for r in rows),
            "with_a_pick": sum(r["n_picks"] > 0 for r in rows) / len(rows),
            "passed_history": sum(r["passed_history"] for r in rows),
            "median_secs": _median([r["secs"] for r in rows if r["secs"]])}


# ---------------------------------------------------------------------
# 4. Engine: guardrails, stability, speed; and the AI explanations' numbers
# ---------------------------------------------------------------------
PROFILES = [{}, {"tilts": ["tech"], "exclude": ["fossil_fuels"]}, {"tilts": ["dividends", "gold"], "max_funds": 4},
            {"exclude": ["international"]}, {"tilts": ["healthcare"], "exclude": ["sector"]}, {"tilts": ["inflation_protection", "real_estate"]}]


def eval_engine(quick):
    rows = []
    log("\n[engine] builds across 3 risk levels x 6 wish profiles")
    for level in engine.TARGET_VOL:
        for prefs in PROFILES[: 3 if quick else None]:
            try:
                mix, secs = timed(engine.build, level, dict(prefs))
                rows.append({"level": level, "prefs": prefs, "secs": secs, "passed": sum(c["ok"] for c in mix["checks"]),
                             "checks": len(mix["checks"]), "funds": len(mix["holdings"]), "stability": mix["stability"]["mean"],
                             "fund_stability": mix["stability"]["funds"], "retries": len(mix["attempts"]) - 1,
                             "vol": mix["stats"]["annual_volatility"], "target": engine.TARGET_VOL[level], "mix": mix})
            except Exception as error:
                rows.append({"level": level, "prefs": prefs, "error": str(error)[:200]})
    ok = [r for r in rows if "error" not in r]
    log(f"  {len(ok)}/{len(rows)} built; all guardrails passed in {sum(r['passed'] == r['checks'] for r in ok)}")
    # the fund explainer: how many AI numbers had to be replaced?
    expl = []
    for r in ok[: 3 if quick else 6]:
        try:
            e = main.explain_mix(r["mix"])
            expl.append({"level": r["level"], "prefs": r["prefs"], "by": e["written_by"], "checked": e["checked"], "replaced": e["replaced"]})
        except Exception as error:
            expl.append({"error": str(error)[:200], "checked": 0, "replaced": 0, "by": "error"})
    checked = sum(e["checked"] for e in expl)
    for r in ok:
        r.pop("mix")
    return {"rows": rows, "built": len(ok) / len(rows), "all_pass": sum(r["passed"] == r["checks"] for r in ok) / max(1, len(ok)),
            "stability_mean": _mean([r["stability"] for r in ok]), "fund_stability_mean": _mean([r["fund_stability"] for r in ok]),
            "median_secs": _median([r["secs"] for r in ok]), "max_secs": max([r["secs"] for r in ok] or [0]),
            "explanations": {"sentences": checked, "replaced": sum(e["replaced"] for e in expl),
                             "kept_rate": (1 - sum(e["replaced"] for e in expl) / checked) if checked else None,
                             "ai_written": sum(e["by"] == "ai" for e in expl) / max(1, len(expl))}}


# ---------------------------------------------------------------------
# 5. Safety red team: harmful, injection, off-topic, crisis, privacy, plus normal questions
# ---------------------------------------------------------------------
def eval_redteam(quick):
    cases = json.loads((DATA / "redteam.json").read_text())
    if quick:
        cases = [c for i, c in enumerate(cases) if i % 3 == 0]
    rows = []
    log(f"\n[safety] {len(cases)} prompts")
    for c in cases:
        try:
            clean, notices, blocked = guardrails.screen_input(c["text"])
            got = blocked["type"] if blocked else ("redacted" if notices else "passed")
            if c["expect"] == "block":
                ok = blocked is not None
            elif c["expect"] == "redact":
                ok = bool(notices) and clean != c["text"]
            else:
                ok = blocked is None
            rows.append({"text": c["text"], "category": c["category"], "expect": c["expect"], "got": got, "ok": ok,
                         "right_type": (blocked or {}).get("type") == c["category"] if c["expect"] == "block" else None})
        except Exception as error:
            rows.append({"text": c["text"], "category": c["category"], "expect": c["expect"], "got": "error", "ok": False, "error": str(error)[:200]})
    by_cat = {}
    for r in rows:
        b = by_cat.setdefault(r["category"], {"n": 0, "ok": 0})
        b["n"] += 1
        b["ok"] += r["ok"]
    for b in by_cat.values():
        b["rate"] = b["ok"] / b["n"]
    log("  " + "  ".join(f"{k}: {v['ok']}/{v['n']}" for k, v in by_cat.items()))
    return {"rows": rows, "by_category": by_cat, "overall": sum(r["ok"] for r in rows) / len(rows),
            "misses": [r for r in rows if not r["ok"]]}


# ---------------------------------------------------------------------
# 6. Walk-forward backtest: build on 2016-2021 only, judge on 2022 onwards
# ---------------------------------------------------------------------
SPLIT = "2021-12"


def _oos(weights):
    months, rets = analytics.portfolio_returns(weights)
    idx = [i for i, m in enumerate(months[1:]) if m > SPLIT]
    r = rets[idx[0]:] if idx else rets[:0]
    if len(r) < 13:
        return None
    s = analytics.summarize(r)
    s["return_per_risk"] = round(s["annual_return"] / s["annual_volatility"], 3) if s["annual_volatility"] else None
    s["months"] = len(r)
    return s


def eval_backtest(quick):
    full = analytics.monthly_closes
    log(f"\n[backtest] mixes built on data up to {SPLIT}, judged on {int(SPLIT[:4]) + 1} onwards")
    rows = []
    for level in engine.TARGET_VOL:
        for name, prefs in [("no wishes", {}), ("tech, no oil", {"tilts": ["tech"], "exclude": ["fossil_fuels"]})][: 1 if quick else None]:
            analytics.monthly_closes = lambda syms: {s: [(m, p) for m, p in v if m <= SPLIT] for s, v in full(syms).items()}  # noqa: E731
            old_min = engine.MIN_MONTHS
            engine.MIN_MONTHS = 60
            try:
                mix = engine.build(level, dict(prefs))
            finally:
                analytics.monthly_closes = full
                engine.MIN_MONTHS = old_min
            w_engine = {h["symbol"]: h["weight"] for h in mix["holdings"]}
            fixed = main.load_portfolio(level)
            w_fixed = main.weights_of(fixed)
            row = {"level": level, "profile": name, "engine_mix": w_engine, "target": engine.TARGET_VOL[level],
                   "engine": _oos(w_engine), "fixed": _oos(w_fixed), "sixty_forty": _oos({"VTI": 0.6, "BND": 0.4}),
                   "in_sample_vol": mix["stats"]["annual_volatility"]}
            rows.append(row)
            e, f = row["engine"], row["fixed"]
            if e and f:
                log(f"  {level:12s} {name:12s} engine {e['annual_return']:+.1%}/yr, swing {e['annual_volatility']:.1%}, worst drop {e['max_drawdown']:.0%}"
                    f"  | fixed mix {f['annual_return']:+.1%}/yr, swing {f['annual_volatility']:.1%}, worst drop {f['max_drawdown']:.0%}")
    return {"split": SPLIT, "rows": rows}


# ---------------------------------------------------------------------
# 7. Simulated personas: the whole core loop, end to end, automatically
# ---------------------------------------------------------------------
def eval_personas(quick):
    people = json.loads((DATA / "personas.json").read_text())[: 2 if quick else None]
    rows = []
    log(f"\n[personas] {len(people)} automated end-to-end runs")
    real_run = scout.run
    scout.run = lambda *a, **k: real_run(*a, months_of=lambda sym: len(live.monthly_prices(sym)), **k)  # read-only
    try:
        _persona_loop(people, rows)
    finally:
        scout.run = real_run
    return {"rows": rows, "completed": sum(r["ok"] for r in rows) / len(rows)}


def _persona_loop(people, rows):
    for p in people:
        t0 = time.time()
        step = "goal reader"
        try:
            g = main.parse_goal(main.GoalText(text=p["text"]), None)
            step = "risk score"
            r = risk.score_answers(p["answers"], g["years"])
            step = "engine"
            built = main.engine_build(main.EngineRequest(risk_level=r["risk_level"], initial_amount=g["initial_amount"],
                                                         monthly_contribution=g["monthly_contribution"], years=g["years"],
                                                         preferences=p["text"]), None)
            e = built["engine"]
            rows.append({"name": p["name"], "ok": True, "secs": time.time() - t0, "read": {k: g[k] for k in ("goal", "initial_amount", "monthly_contribution", "years")},
                         "personality": built["portfolio"]["name"], "mix": [(h["symbol"], h["weight"]) for h in built["portfolio"]["holdings"]],
                         "wishes": e["constraints"], "agent_searched": e["scout"].get("searched"), "agent_added": e["scout"].get("used"),
                         "guardrails": f"{sum(c['ok'] for c in e['checks'])}/{len(e['checks'])}", "confidence": e["insight"]["confidence"]["label"],
                         "likely": built["projection"]["final"]["median"], "bad": built["projection"]["final"]["low"]})
            log(f"  {p['name']}: {built['portfolio']['name']}, {len(built['portfolio']['holdings'])} funds, {rows[-1]['guardrails']} checks, {rows[-1]['secs']:.0f}s")
        except Exception as error:
            rows.append({"name": p["name"], "ok": False, "failed_at": step, "error": str(error)[:200], "secs": time.time() - t0})
            log(f"  {p['name']}: FAILED at {step}: {error}")


def _median(xs):
    xs = sorted(x for x in xs if x is not None)
    return xs[len(xs) // 2] if xs else None


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def main_cli():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default="")
    ap.add_argument("--skip", default="")
    ap.add_argument("--quick", action="store_true")
    args = ap.parse_args()
    models = [m.strip() for m in (args.models or f"{ai.AI_MODEL},openai/gpt-oss-20b").split(",") if m.strip()]
    models = list(dict.fromkeys(models))
    skip = set(args.skip.split(",")) - {""}
    main_model, smart = ai.AI_MODEL, (ai.SMART_API_KEY, ai.SMART_MODEL)
    started = time.time()
    results = {"started": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()), "models": models, "main_model": main_model,
               "smart_model": smart[1] if smart[0] else None, "quick": args.quick}
    sections = [("goals", lambda: eval_goals(models, args.quick)), ("wishes", lambda: eval_wishes(models, args.quick)),
                ("scout", lambda: eval_scout(args.quick)), ("engine", lambda: eval_engine(args.quick)),
                ("redteam", lambda: eval_redteam(args.quick)), ("backtest", lambda: eval_backtest(args.quick)),
                ("personas", lambda: eval_personas(args.quick))]
    for name, fn in sections:
        if name in skip:
            continue
        # sections after the model comparison use the app's real setup (main model, plus the smart model if set)
        if name not in ("goals", "wishes"):
            ai.AI_MODEL = main_model
            ai.SMART_API_KEY, ai.SMART_MODEL = smart
        try:
            results[name] = fn()
        except Exception as error:
            results[name] = {"error": str(error)[:300], "trace": traceback.format_exc()[-1500:]}
            log(f"\n[{name}] FAILED: {error}")
    results["usage"] = USAGE
    results["minutes"] = round((time.time() - started) / 60, 1)
    OUT.mkdir(exist_ok=True)
    (OUT / "results.json").write_text(json.dumps(results, indent=1, default=str))
    from report import write_report
    write_report(results, OUT)
    log(f"\nDone in {results['minutes']} min, {USAGE['requests']} AI requests, "
        f"{USAGE['prompt_tokens'] + USAGE['completion_tokens']:,} tokens. Report: {OUT / 'report.html'}")


if __name__ == "__main__":
    sys.path.insert(0, str(pathlib.Path(__file__).parent))
    main_cli()
