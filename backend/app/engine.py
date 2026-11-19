"""Seedwise portfolio engine: builds each person's own mix of index funds.

The pipeline, in the order it runs:
  1. Understand   the AI turns the person's words into constraints (main.py, PREFS_PROMPT); this file applies them
  2. Group        k-means (unsupervised learning) groups the funds by how they behaved since 2016
  3. Select       a constrained optimiser picks weights: the most expected return for the person's target risk
  4. Validate     guardrails check the result; a failed check changes the inputs and the engine tries again
  5. Measure      bootstrap resampling re-runs the optimiser on reshuffled history: how stable is the answer?
  6. Explain      facts per fund for the AI to explain (main.py), with a plain-words fallback

Every number comes from real monthly prices. The AI never sets a weight.
"""
import numpy as np
from scipy.optimize import minimize

from . import analytics, ml

# ---------------------------------------------------------------------
# The fund universe: low-cost index funds with price history since 2016.
# Fees are approximate yearly expense ratios; always check the fund's own site.
# ---------------------------------------------------------------------
F = lambda symbol, name, kind, fee, cap, themes, role: {  # noqa: E731
    "symbol": symbol, "name": name, "kind": kind, "fee": fee, "cap": cap, "themes": themes, "role": role}

FUNDS = [
    F("VTI", "Vanguard Total Stock Market ETF", "stock", 0.0003, 0.50, ["core", "us"], "The whole US stock market, about 3,500 companies"),
    F("VOO", "Vanguard S&P 500 ETF", "stock", 0.0003, 0.50, ["core", "us"], "The 500 largest US companies"),
    F("VTV", "Vanguard Value ETF", "stock", 0.0004, 0.20, ["value", "us"], "Large US companies priced cheaply for their profits"),
    F("VUG", "Vanguard Growth ETF", "stock", 0.0004, 0.20, ["growth", "us"], "Large US companies growing fastest"),
    F("VB", "Vanguard Small-Cap ETF", "stock", 0.0005, 0.15, ["small_companies", "us"], "About 1,300 smaller US companies"),
    F("QQQ", "Invesco QQQ Trust", "stock", 0.0020, 0.20, ["tech", "growth", "nasdaq"], "The 100 largest Nasdaq companies, heavy in tech"),
    F("SCHD", "Schwab US Dividend Equity ETF", "stock", 0.0006, 0.20, ["dividends", "us"], "US companies with strong, steady dividends"),
    F("VIG", "Vanguard Dividend Appreciation ETF", "stock", 0.0005, 0.20, ["dividends", "us"], "US companies that keep raising their dividends"),
    F("VXUS", "Vanguard Total International Stock ETF", "stock", 0.0005, 0.35, ["core", "international"], "About 8,000 companies outside the US"),
    F("VEA", "Vanguard FTSE Developed Markets ETF", "stock", 0.0003, 0.25, ["international"], "Companies in Europe, Japan, Canada and Australia"),
    F("VWO", "Vanguard FTSE Emerging Markets ETF", "stock", 0.0007, 0.15, ["emerging_markets", "international"], "Companies in fast-growing countries like India and Brazil"),
    F("XLK", "Technology Select Sector SPDR", "stock", 0.0008, 0.15, ["tech", "sector"], "US technology companies"),
    F("XLV", "Health Care Select Sector SPDR", "stock", 0.0008, 0.15, ["healthcare", "sector"], "US health-care companies"),
    F("XLF", "Financial Select Sector SPDR", "stock", 0.0008, 0.15, ["financials", "sector"], "US banks and insurers"),
    F("XLE", "Energy Select Sector SPDR", "stock", 0.0008, 0.10, ["energy", "fossil_fuels", "sector"], "US oil and gas companies"),
    F("XLP", "Consumer Staples Select Sector SPDR", "stock", 0.0008, 0.15, ["consumer_staples", "sector"], "Everyday brands: food, drinks, household goods"),
    F("XLU", "Utilities Select Sector SPDR", "stock", 0.0008, 0.15, ["utilities", "sector"], "Power and water companies"),
    F("VNQ", "Vanguard Real Estate ETF", "real_asset", 0.0013, 0.10, ["real_estate"], "US property companies"),
    F("IAU", "iShares Gold Trust", "real_asset", 0.0025, 0.10, ["gold"], "Physical gold"),
    F("BND", "Vanguard Total Bond Market ETF", "bond", 0.0003, 0.50, ["core", "bonds"], "About 11,000 US government and company bonds"),
    F("BNDX", "Vanguard Total International Bond ETF", "bond", 0.0007, 0.25, ["bonds", "international"], "Bonds from outside the US, currency-hedged"),
    F("VGSH", "Vanguard Short-Term Treasury ETF", "bond", 0.0003, 0.30, ["bonds", "short_bonds"], "US government bonds due in 1 to 3 years"),
    F("VGIT", "Vanguard Intermediate-Term Treasury ETF", "bond", 0.0003, 0.30, ["bonds"], "US government bonds due in 3 to 10 years"),
    F("VCIT", "Vanguard Intermediate-Term Corporate Bond ETF", "bond", 0.0003, 0.25, ["bonds"], "Bonds from large US companies"),
    F("VTIP", "Vanguard Short-Term Inflation-Protected Securities ETF", "bond", 0.0003, 0.20, ["inflation_protection", "bonds"], "Government bonds that rise with inflation"),
    F("TLT", "iShares 20+ Year Treasury Bond ETF", "bond", 0.0015, 0.15, ["long_bonds", "bonds"], "Long-term US government bonds, swing a lot with interest rates"),
]
BY_SYMBOL = {f["symbol"]: f for f in FUNDS}
# Single-industry and concentrated funds are bets, not building blocks: they're used only when someone asks.
SATELLITES = {"QQQ", "XLK", "XLV", "XLF", "XLE", "XLP", "XLU"}
UNVERIFIED_FEE = 0.0075   # funds the agent finds: a cautious fee until it's checked
WISH_CAP = 0.10           # ...and at most 10% each


def is_bet(symbol):
    """Single-industry funds, QQQ, and anything the agent found for a wish: kept small together."""
    return symbol in SATELLITES or "wish" in BY_SYMBOL[symbol]["themes"]


def register(found):
    """Add funds the agent found (kind guessed from the name) so the engine can use them."""
    for f in found or []:
        sym = f["symbol"]
        if sym not in BY_SYMBOL or "wish" in BY_SYMBOL[sym]["themes"]:
            BY_SYMBOL[sym] = {"symbol": sym, "name": f["name"], "kind": f.get("kind") or "stock", "fee": UNVERIFIED_FEE,
                              "cap": WISH_CAP, "themes": ["wish"], "role": f"Found by the agent for your wish: {f['name']}",
                              "fee_verified": False}

# What people can ask for. The AI may only use these words; anything else is ignored.
THEMES = {
    "tech": "technology", "healthcare": "health care", "financials": "banks and finance", "energy": "energy",
    "fossil_fuels": "oil and gas", "consumer_staples": "everyday brands", "utilities": "utilities",
    "real_estate": "real estate", "gold": "gold", "international": "outside the US",
    "emerging_markets": "emerging markets", "dividends": "dividends", "small_companies": "small companies",
    "value": "value companies", "growth": "growth companies", "inflation_protection": "inflation protection",
    "long_bonds": "long-term bonds", "sector": "single-industry funds", "wish": "your wish",
}

TARGET_VOL = {"conservative": 0.07, "moderate": 0.11, "aggressive": 0.16}
BOND_BAND = {"conservative": (0.45, 0.80), "moderate": (0.25, 0.50), "aggressive": (0.05, 0.25)}
WORST_YEAR_LIMIT = {"conservative": -0.15, "moderate": -0.25, "aggressive": -0.35}
NAMES = {"conservative": "Steady Saver", "moderate": "Balanced Builder", "aggressive": "Growth Seeker"}
MAX_FEE = 0.0020          # average yearly fee across the mix
MAX_SINGLE = 0.50         # no fund above half the money
MIN_WEIGHT = 0.05         # nothing smaller than 5%: tiny slices add fees and confusion
MIN_GROUPS = 3            # at least 3 different behaviour groups
REAL_ASSET_MAX = 0.15     # gold + property together
SATELLITE_MAX = 0.25      # single-industry funds + QQQ together, even when asked for
SPREAD = 0.10             # how strongly the optimiser prefers spreading money out
TILT_BONUS = 0.015        # a preference adds 1.5 points a year to a fund's expected return
MIN_MONTHS = 96           # at least 8 years of monthly history
GROUP_NAMES = {
    "ballast": ("Steady ballast", "Move little and hold the plan steady when stocks fall."),
    "absorber": ("Shock absorbers", "Often move differently from stocks, softening big drops."),
    "earner": ("Steady earners", "Stocks with calmer rides: dividends, value, everyday brands."),
    "core": ("Core market", "Broad stock funds that follow the whole market."),
    "growth": ("Growth engines", "The fastest growers since 2016, with bigger swings."),
}


# ---------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------
def load_returns(symbols):
    """Monthly returns for every fund with enough history, over the months they all share."""
    series = analytics.monthly_closes(symbols)
    usable = {s: dict(series[s]) for s in symbols if len(series.get(s, [])) > MIN_MONTHS}
    while usable:
        months = sorted(set.intersection(*(set(m) for m in usable.values())))
        if len(months) > MIN_MONTHS or len(usable) <= 3:
            break
        usable.pop(min(usable, key=lambda s: len(usable[s])))  # the shortest history shrinks the window: drop it
    if len(usable) < 3:
        raise ValueError("Not enough fund price history yet. Run the data refresh to load the fund list.")
    order = [f["symbol"] for f in FUNDS]
    syms = sorted(usable, key=lambda s: (order.index(s) if s in order else len(order), s))
    prices = np.array([[usable[s][m] for s in syms] for m in months])
    return syms, months, prices[1:] / prices[:-1] - 1


def fund_stats(R):
    """Per fund: yearly return, volatility, worst drop, and how it moves with stocks and with bonds."""
    growth = np.vstack([np.ones(R.shape[1]), np.cumprod(1 + R, axis=0)])
    drawdown = (growth / np.maximum.accumulate(growth, axis=0) - 1).min(axis=0)
    years = R.shape[0] / 12
    return {
        "annual_return": growth[-1] ** (1 / years) - 1,
        "volatility": R.std(axis=0, ddof=1) * np.sqrt(12),
        "max_drawdown": drawdown,
    }


# ---------------------------------------------------------------------
# Step 2: group funds by behaviour (k-means, unsupervised)
# ---------------------------------------------------------------------
def group_funds(syms, R, k=5):
    stats = fund_stats(R)
    stock_idx = [i for i, s in enumerate(syms) if BY_SYMBOL[s]["kind"] == "stock"]
    bond_idx = [i for i, s in enumerate(syms) if BY_SYMBOL[s]["kind"] == "bond"]
    stock_factor = R[:, stock_idx].mean(axis=1) if stock_idx else R.mean(axis=1)
    bond_factor = R[:, bond_idx].mean(axis=1) if bond_idx else R.mean(axis=1)
    corr = lambda x, f: float(np.corrcoef(x, f)[0, 1])  # noqa: E731
    raw = np.array([[stats["annual_return"][i], stats["volatility"][i], -stats["max_drawdown"][i],
                     corr(R[:, i], stock_factor), corr(R[:, i], bond_factor)] for i in range(len(syms))])
    k = min(k, len(syms))
    scaled = (raw - raw.mean(axis=0)) / np.where(raw.std(axis=0) > 0, raw.std(axis=0), 1)
    labels, _, _ = ml.kmeans(scaled, k)
    # Name each group from its members' average behaviour
    clusters = sorted(set(labels.tolist()))
    mean = {c: raw[labels == c].mean(axis=0) for c in clusters}
    names = {}
    for c in clusters:
        ret, vol, _, stock_link, _ = mean[c]
        if stock_link < 0.4 and vol < 0.08:
            names[c] = "ballast"       # calm and unlinked to stocks: bonds
        elif stock_link < 0.6:
            names[c] = "absorber"      # moves its own way: gold, long bonds, property
    stocky = sorted([c for c in clusters if c not in names], key=lambda c: mean[c][0])
    for j, c in enumerate(stocky):
        names[c] = "growth" if j == len(stocky) - 1 and len(stocky) > 1 else "earner" if j == 0 and len(stocky) > 2 else "core"
    groups = {}
    for i, s in enumerate(syms):
        key = names[int(labels[i])]
        groups[s] = key
    detail = {s: {"stock_link": round(float(raw[i][3]), 2), "bond_link": round(float(raw[i][4]), 2)} for i, s in enumerate(syms)}
    return groups, detail, stats


# ---------------------------------------------------------------------
# Step 3: optimise
# ---------------------------------------------------------------------
def expected_returns(syms, R):
    """Yearly expected return per fund, shrunk 70% of the way to its asset-class average.
    Ten years of returns are noisy; shrinking stops one lucky fund from taking over."""
    hist = R.mean(axis=0) * 12
    kinds = [BY_SYMBOL[s]["kind"] for s in syms]
    out = hist.copy()
    for kind in set(kinds):
        idx = [i for i, k in enumerate(kinds) if k == kind]
        out[idx] = 0.3 * hist[idx] + 0.7 * hist[idx].mean()
    return out


def covariance(R):
    """Yearly covariance, shrunk 20% towards the diagonal for stability."""
    cov = np.cov(R, rowvar=False) * 12
    return 0.8 * cov + 0.2 * np.diag(np.diag(cov))


def optimise(syms, mu, cov, level, target_vol, bounds, fee_weight=1.0):
    """Most expected return for the target risk, inside the bounds and the bond band."""
    n = len(syms)
    fees = np.array([BY_SYMBOL[s]["fee"] for s in syms])
    bond = np.array([1.0 if BY_SYMBOL[s]["kind"] == "bond" else 0.0 for s in syms])
    real = np.array([1.0 if BY_SYMBOL[s]["kind"] == "real_asset" else 0.0 for s in syms])
    sat = np.array([1.0 if is_bet(s) else 0.0 for s in syms])
    lo_b, hi_b = BOND_BAND[level]
    lo, hi = np.array([b[0] for b in bounds]), np.array([b[1] for b in bounds])
    # instant check: can these bounds hold 100% of the money and the bond range at all?
    room = lambda mask: ((1 - sat - real) * mask) @ hi + min(SATELLITE_MAX, (sat * mask) @ hi) + min(REAL_ASSET_MAX, (real * mask) @ hi)  # noqa: E731
    if lo.sum() > 1 + 1e-9 or room(np.ones(len(syms))) < 1 - 1e-9 or bond @ hi < lo_b - 1e-9 or bond @ lo > hi_b + 1e-9 \
            or room(1 - bond) < 1 - hi_b - 1e-9 or sat @ lo > SATELLITE_MAX + 1e-9:
        return None

    def objective(w):
        return -(mu @ w) + fee_weight * (fees @ w) + SPREAD * (w @ w)  # spread term avoids all-in answers

    cons = [
        {"type": "eq", "fun": lambda w: w.sum() - 1},
        {"type": "ineq", "fun": lambda w: target_vol ** 2 - w @ cov @ w},
        {"type": "ineq", "fun": lambda w: bond @ w - lo_b},
        {"type": "ineq", "fun": lambda w: hi_b - bond @ w},
        {"type": "ineq", "fun": lambda w: REAL_ASSET_MAX - real @ w},
        {"type": "ineq", "fun": lambda w: SATELLITE_MAX - sat @ w},
    ]
    start = np.array([max(lo, min(hi, 1 / n)) for lo, hi in bounds])
    best = None
    for attempt_start in (start,):
        res = minimize(objective, attempt_start, method="SLSQP", bounds=bounds, constraints=cons,
                       options={"maxiter": 200, "ftol": 1e-10})
        if res.success and (best is None or res.fun < best.fun):
            best = res
    if best is None:  # risk target out of reach inside these bounds: take the calmest mix that fits the rest
        res = minimize(lambda w: w @ cov @ w, start, method="SLSQP", bounds=bounds, constraints=[cons[0]] + cons[2:],
                       options={"maxiter": 200})
        if not res.success:
            return None
        best = res
    w = np.clip(best.x, 0, None)
    return w / w.sum()


def solve(syms, R, level, prefs, target_vol, forced=(), fee_weight=1.0):
    """Optimise over every allowed fund, keep the clear winners (at least 5% each, at most max_funds),
    then optimise again over just those so no slice ends up tiny."""
    mu = expected_returns(syms, R)
    tilts = set(prefs.get("tilts") or [])
    mu = mu + np.array([TILT_BONUS if tilts & set(BY_SYMBOL[s]["themes"]) else 0.0 for s in syms])
    cov = covariance(R)
    max_funds = prefs.get("max_funds") or 6
    allowed = [not is_bet(s) or bool(tilts & set(BY_SYMBOL[s]["themes"])) for s in syms]
    lower = {}
    for t in tilts:  # each wish gets at least 5% in its best-matching fund
        options = [i for i, s in enumerate(syms) if t in BY_SYMBOL[s]["themes"]]
        if options:
            lower[max(options, key=lambda i: mu[i])] = MIN_WEIGHT
    for f in forced:
        if f in syms:
            lower[syms.index(f)] = MIN_WEIGHT
    cap = lambda i: BY_SYMBOL[syms[i]]["cap"] if allowed[i] or i in lower else 0.0  # noqa: E731

    w = optimise(syms, mu, cov, level, target_vol, [(lower.get(i, 0.0), cap(i)) for i in range(len(syms))], fee_weight)
    if w is None:
        raise ValueError("No mix fits these rules. Try fewer exclusions.")
    keep = set(lower)
    lo_b, hi_b = BOND_BAND[level]
    kind = lambda i: BY_SYMBOL[syms[i]]["kind"]  # noqa: E731
    # broad core funds first (they can hold the most), then whatever the optimiser liked best
    bonds = sorted([i for i in range(len(syms)) if kind(i) == "bond"], key=lambda i: (-cap(i), -w[i]))
    stocks = sorted([i for i in range(len(syms)) if kind(i) == "stock" and cap(i) > 0 and not is_bet(syms[i])], key=lambda i: (-cap(i), -w[i]))
    # the kept funds must be able to hold the bond range and the stock share: add the biggest until they can
    for pool, need in ((bonds, lo_b + 0.02), (stocks, 1 - hi_b + 0.02)):
        for i in pool:
            if sum(cap(j) for j in keep if j in pool) >= need:
                break
            keep.add(i)
    for i in sorted(range(len(syms)), key=lambda i: -w[i]):
        if len(keep) >= max_funds:
            break
        if w[i] >= MIN_WEIGHT * 0.6:
            keep.add(i)
    spare = [i for i in sorted(range(len(syms)), key=lambda i: -w[i]) if i not in keep and cap(i) > 0]
    final = None
    for extra in range(min(len(spare), 6) + 1):  # if the kept funds can't meet every rule, add the next-biggest and retry
        chosen = keep | set(spare[:extra])
        for floor in (MIN_WEIGHT, 0.0):
            final = optimise(syms, mu, cov, level, target_vol,
                             [(max(floor, lower.get(i, 0.0)), cap(i)) if i in chosen else (0.0, 0.0) for i in range(len(syms))], fee_weight)
            if final is not None:
                break
        if final is not None:
            break
    w = final if final is not None else w
    w[w < 1e-3] = 0
    return w / w.sum(), mu, cov


# ---------------------------------------------------------------------
# Step 4: guardrails
# ---------------------------------------------------------------------
def check(syms, w, R, level, groups, prefs, target_vol):
    port = R @ w
    stats = analytics.summarize(port)
    fees = sum(w[i] * BY_SYMBOL[s]["fee"] for i, s in enumerate(syms))
    bets = sum(w[i] for i, s in enumerate(syms) if is_bet(s))
    bond = sum(w[i] for i, s in enumerate(syms) if BY_SYMBOL[s]["kind"] == "bond")
    held = [s for i, s in enumerate(syms) if w[i] > 0]
    n_groups = len({groups[s] for s in held})
    excluded = set(prefs.get("exclude") or [])
    broken = [s for s in held if excluded & set(BY_SYMBOL[s]["themes"])]
    lo_b, hi_b = BOND_BAND[level]
    worst = WORST_YEAR_LIMIT[level]
    pct = lambda x: f"{x * 100:.0f}%"  # noqa: E731
    return [
        {"id": "risk", "name": "Risk on target", "ok": abs(stats["annual_volatility"] - target_vol) <= 0.025 or stats["annual_volatility"] < target_vol,
         "detail": f"Typical yearly swing {pct(stats['annual_volatility'])}; target {pct(target_vol)}"},
        {"id": "worst_year", "name": "Bad year you can live with", "ok": stats["worst_12_months"] >= worst,
         "detail": f"Worst 12 months since 2016: {pct(stats['worst_12_months'])}; limit {pct(worst)}"},
        {"id": "groups", "name": "Truly spread out", "ok": n_groups >= MIN_GROUPS,
         "detail": f"{n_groups} different behaviour groups; at least {MIN_GROUPS} needed"},
        {"id": "single", "name": "No fund too big", "ok": max(w) <= MAX_SINGLE + 1e-6,
         "detail": f"Biggest fund {pct(max(w))}; limit {pct(MAX_SINGLE)}"},
        {"id": "bets", "name": "Small bets stay small", "ok": bets <= SATELLITE_MAX + 1e-3,
         "detail": f"Industry and wish funds {pct(bets)}; limit {pct(SATELLITE_MAX)}"},
        {"id": "fees", "name": "Low fees", "ok": fees <= MAX_FEE,
         "detail": f"Average yearly fee {fees * 100:.2f}%; limit {MAX_FEE * 100:.2f}%"},
        {"id": "bonds", "name": "Right amount of bonds", "ok": lo_b - 1e-3 <= bond <= hi_b + 1e-3,
         "detail": f"Bonds {pct(bond)}; your range {pct(lo_b)} to {pct(hi_b)}"},
        {"id": "prefs", "name": "Respects your wishes", "ok": not broken,
         "detail": "No excluded funds" if not broken else f"Contains {', '.join(broken)}"},
    ], stats


def _plain(checks):
    for c in checks:
        c["ok"] = bool(c["ok"])
    return checks


# ---------------------------------------------------------------------
# Step 5: how stable is the answer? (bootstrap)
# ---------------------------------------------------------------------
def stability(syms, R, level, prefs, target_vol, w, forced, groups, runs=10, seed=11):
    """Re-run the optimiser on reshuffled history (12-month blocks) and measure how much the mix stays the same:
    by behaviour group (the plan's shape) and by individual fund."""
    rng = np.random.default_rng(seed)
    T = R.shape[0]
    blocks = max(1, T // 12)
    shape = lambda v: {g: sum(v[i] for i, s in enumerate(syms) if groups[s] == g) for g in GROUP_NAMES}  # noqa: E731
    base = shape(w)
    by_group, by_fund = [], []
    for _ in range(runs):
        starts = rng.integers(0, T - 12, size=blocks)
        sample = np.vstack([R[s:s + 12] for s in starts])
        try:
            w2, _, _ = solve(syms, sample, level, prefs, target_vol, forced)
        except ValueError:
            continue
        other = shape(w2)
        by_group.append(sum(min(base[g], other[g]) for g in GROUP_NAMES))
        by_fund.append(float(np.minimum(w, w2).sum()))
    if not by_group:
        return 0.0, 0.0, 0.0
    return float(np.mean(by_group)), float(np.min(by_group)), float(np.mean(by_fund))


# ---------------------------------------------------------------------
# The whole pipeline
# ---------------------------------------------------------------------
def build(level, prefs, fixed=None, found=None):
    """Build (or, with `fixed`, just evaluate) a mix. `found` = funds the agent found for the person's wishes."""
    register(found)
    found_syms = [f["symbol"] for f in found or []]
    prefs = {"tilts": [t for t in (prefs.get("tilts") or []) if t in THEMES] + (["wish"] if found_syms else []),
             "exclude": [t for t in (prefs.get("exclude") or []) if t in THEMES],
             "max_funds": max(3, min(8, int(prefs.get("max_funds") or 6)))}
    candidates = [f["symbol"] for f in FUNDS if not (set(prefs["exclude"]) & set(f["themes"]))] + \
                 [s for s in found_syms if s not in [f["symbol"] for f in FUNDS]]
    if fixed:
        candidates = sorted(set(candidates) | set(fixed))
    syms, months, R = load_returns(candidates)
    groups, links, fstats = group_funds(syms, R)
    target = TARGET_VOL[level]
    attempts = []

    if fixed:
        w = np.array([fixed.get(s, 0.0) for s in syms])
        w = w / w.sum()
        checks, stats = check(syms, w, R, level, groups, prefs, target)
        checks = _plain(checks)
        stable = None
    else:
        forced, fee_weight = [], 1.0
        asked_funds = prefs["max_funds"]
        for n in range(1, 6):
            w, _, _ = solve(syms, R, level, prefs, target, forced, fee_weight)
            checks, stats = check(syms, w, R, level, groups, prefs, target)
            checks = _plain(checks)
            failed = [c for c in checks if not c["ok"]]
            if not failed:
                attempts.append({"n": n, "result": "passed", "change": ""})
                break
            changes = []
            ids = {c["id"] for c in failed}
            if ids & {"risk", "worst_year"}:
                held = int((w > 0).sum())
                if held >= prefs["max_funds"] and n >= 2:  # lowering the target alone didn't work: allow one more fund
                    prefs = {**prefs, "max_funds": prefs["max_funds"] + 1}
                    changes.append(f"allowed {prefs['max_funds']} funds to spread the risk")
                else:
                    target = round(target - 0.01, 3)
                    changes.append(f"lowered the risk target to {target * 100:.0f}%")
            if "groups" in ids:
                held_groups = {groups[s] for i, s in enumerate(syms) if w[i] > 0}
                missing = [s for s in syms if groups[s] not in held_groups and BY_SYMBOL[s]["kind"] != "real_asset"]
                if missing:
                    pick = min(missing, key=lambda s: BY_SYMBOL[s]["fee"])
                    forced.append(pick)
                    changes.append(f"added {pick} from the {GROUP_NAMES[groups[pick]][0].lower()} group")
            if "fees" in ids:
                fee_weight *= 4
                changes.append("weighed fees more heavily")
            attempts.append({"n": n, "result": "failed: " + ", ".join(c["name"].lower() for c in failed),
                             "change": "; ".join(changes) or "no fix available"})
            if not changes:
                break
        mean_overlap, worst_overlap, fund_overlap = stability(syms, R, level, prefs, target, w, forced, groups)
        stable = {"mean": round(mean_overlap, 3), "worst": round(worst_overlap, 3), "funds": round(fund_overlap, 3), "runs": 10}

    cov = covariance(R)
    risk_share = w * (cov @ w) / (w @ cov @ w)
    holdings = []
    for i, s in enumerate(syms):
        if w[i] <= 0:
            continue
        f = BY_SYMBOL[s]
        holdings.append({
            "symbol": s, "name": f["name"], "weight": round(float(w[i]), 4), "sector": None,
            "kind": f["kind"], "fee": f["fee"], "role": f["role"], "fee_verified": f.get("fee_verified", True),
            "group": groups[s], "group_name": GROUP_NAMES[groups[s]][0],
            "annual_return": round(float(fstats["annual_return"][i]), 4),
            "volatility": round(float(fstats["volatility"][i]), 4),
            "max_drawdown": round(float(fstats["max_drawdown"][i]), 4),
            "risk_share": round(float(risk_share[i]), 4),
            "stock_link": links[s]["stock_link"],
            "matches": [THEMES[t] for t in prefs["tilts"] if t in f["themes"]],
        })
    holdings.sort(key=lambda h: -h["weight"])
    # round to whole percents that still add up to 100
    pcts = [round(h["weight"] * 100) for h in holdings]
    pcts[0] += 100 - sum(pcts)
    for h, p in zip(holdings, pcts):
        h["weight"] = p / 100

    group_list = []
    for key, (name, about) in GROUP_NAMES.items():
        members = [s for s in syms if groups[s] == key]
        if members:
            group_list.append({"id": key, "name": name, "about": about, "funds": members,
                               "picked": [h["symbol"] for h in holdings if h["group"] == key]})
    notes = []
    asked = locals().get("asked_funds", prefs["max_funds"])
    if len(holdings) > asked:
        notes.append(f"You asked for at most {asked} funds; the safety rules needed {len(holdings)}.")
    return {
        "level": level, "name": NAMES[level], "holdings": holdings, "prefs": prefs, "notes": notes,
        "target_volatility": float(target), "initial_target": TARGET_VOL[level],
        "stats": stats, "checks": checks, "attempts": attempts, "stability": stable,
        "groups": group_list, "universe": len(FUNDS), "considered": len(syms),
        "excluded_funds": [f["symbol"] for f in FUNDS if f["symbol"] not in candidates],
        "core_count": len(FUNDS), "found_used": [h["symbol"] for h in holdings if h["symbol"] in found_syms],
        "months": (months[0], months[-1]), "n_months": len(R),
        "fee": round(sum(h["weight"] * h["fee"] for h in holdings), 5),
    }
