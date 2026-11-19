"""Turns results.json into report.html (charts + tables) and summary.md."""
import base64
import html
import io

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

BRAND, INK, MUTED, LINE = "#2B5BFF", "#0f1720", "#5b6675", "#d5dbe3"
COLORS = ["#2B5BFF", "#0EA5E9", "#B45309", "#7C3AED", "#0f9f6e"]
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.edgecolor": LINE, "axes.labelcolor": MUTED, "xtick.color": MUTED, "ytick.color": MUTED})


def pct(x, d=0):
    return "–" if x is None else f"{x * 100:.{d}f}%"


def esc(x):
    return html.escape(str(x))


def fig_png(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=160, bbox_inches="tight")
    plt.close(fig)
    return f'<img src="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}" alt="">'


def bars(groups, series, title, ylabel="", as_pct=True, ylim=None):
    """groups: x labels; series: {name: [values]}"""
    fig, ax = plt.subplots(figsize=(7.2, 2.8))
    n = len(series)
    width = 0.8 / max(n, 1)
    for i, (name, vals) in enumerate(series.items()):
        xs = [g + (i - (n - 1) / 2) * width for g in range(len(groups))]
        vals = [v if v is not None else 0 for v in vals]
        b = ax.bar(xs, vals, width * 0.92, label=name, color=COLORS[i % len(COLORS)])
        ax.bar_label(b, labels=[f"{v * 100:.0f}%" if as_pct else f"{v:.2f}" for v in vals], fontsize=7.5, padding=2, color=INK)
    ax.set_xticks(range(len(groups)), groups)
    if as_pct:
        ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0))
    if ylim:
        ax.set_ylim(*ylim)
    ax.set_title(title, loc="left", fontsize=10.5, color=INK, fontweight="bold")
    ax.set_ylabel(ylabel)
    ax.grid(axis="y", color="#eef1f5")
    ax.set_axisbelow(True)
    if n > 1:
        ax.legend(frameon=False, fontsize=8, loc="upper left", bbox_to_anchor=(1, 1))
    return fig_png(fig)


def table(headers, rows):
    head = "".join(f"<th>{esc(h)}</th>" for h in headers)
    body = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f"<table><tr>{head}</tr>{body}</table>"


def card(label, value, sub=""):
    return f'<div class="card"><div class="l">{esc(label)}</div><div class="v">{value}</div><div class="s">{esc(sub)}</div></div>'


def write_report(R, out):
    parts, md = [], []
    cards = []
    g, w, s, e, rt, bt, pe = (R.get(k) or {} for k in ("goals", "wishes", "scout", "engine", "redteam", "backtest", "personas"))
    mm = R["main_model"]
    if g and mm not in g and "error" not in g:
        mm = next(iter(g), mm)
    if g.get(mm):
        cards.append(card("Goal reader, all fields right", pct(g[mm]["all_correct"]), f"{g[mm]['n']} written goals · {mm}"))
    if w.get(mm):
        cards.append(card("Wish reader, exactly right", pct(w[mm]["exact"]), f"{w[mm]['n']} wishes · {mm}"))
    if s.get("relevance") is not None:
        cards.append(card("Fund agent picks on topic", pct(s["relevance"]), f"{s['invented_rejected']} invented symbols caught"))
    if e.get("all_pass") is not None:
        cards.append(card("Engine mixes passing all guardrails", pct(e["all_pass"]), f"stability {pct(e['stability_mean'])} · median {e['median_secs']:.1f}s"))
    if rt.get("overall") is not None:
        bad = [k for k in ("harmful", "injection", "crisis") if k in rt["by_category"]]
        blocked = sum(rt["by_category"][k]["ok"] for k in bad)
        total = sum(rt["by_category"][k]["n"] for k in bad)
        cards.append(card("Harmful, injection and crisis prompts stopped", f"{blocked}/{total}", f"normal questions let through: {rt['by_category'].get('control', {}).get('ok', 0)}/{rt['by_category'].get('control', {}).get('n', 0)}"))
    if pe.get("completed") is not None:
        cards.append(card("Persona runs completed end to end", pct(pe["completed"]), f"{len(pe['rows'])} simulated personas"))
    parts.append(f'<div class="cards">{"".join(cards)}</div>')

    # 1 goal reader
    if g and "error" not in g:
        models = list(g)
        fields = ["goal", "initial", "monthly", "years"]
        parts.append("<h2>1. Goal reader: model comparison</h2><p>Each written goal has a known right answer. A field counts as right if the amount is within 1% (3% for monthly, because weekly amounts get converted) and the years match exactly.</p>")
        parts.append(bars(["Goal type", "Start amount", "Monthly", "Years", "All four"],
                          {m: [g[m]["fields"][f] for f in fields] + [g[m]["all_correct"]] for m in models}, "Share of goals read correctly", ylim=(0, 1.12)))
        parts.append(table(["Model", "All four right", "Median time", "Errors"], [[esc(m), pct(g[m]["all_correct"]), f"{g[m]['median_secs']:.1f}s" if g[m]["median_secs"] else "–", g[m]["errors"]] for m in models]))
        mis = g[mm]["misses"][:12] if mm in g else []
        if mis:
            parts.append(f"<h3>What {esc(mm)} got wrong</h3>" + table(["Goal text", "Expected", "Got"], [[esc(x["text"]), esc(x.get("want", "")), esc(x.get("got", x.get("error", "")))] for x in mis]))
        md.append(f"- Goal reader ({mm}): {pct(g.get(mm, {}).get('all_correct'))} of goals fully right")
    # 2 wish reader
    if w and "error" not in w:
        models = list(w)
        parts.append("<h2>2. Wish reader: model comparison</h2><p>Each wish has the rules it should produce (more of, none of, how many funds). A wish counts as right only if every rule matches exactly.</p>")
        parts.append(bars(["Exactly right", "Answered by the AI"], {m: [w[m]["exact"], w[m]["ai_answered"]] for m in models}, "Wish reader accuracy", ylim=(0, 1.12)))
        mis = w[mm]["misses"][:12] if mm in w else []
        if mis:
            parts.append(f"<h3>What {esc(mm)} got wrong</h3>" + table(["Wish", "Expected", "Got"], [[esc(x["text"]), esc(x.get("want", "")), esc(x.get("got", x.get("error", "")))] for x in mis]))
        md.append(f"- Wish reader ({mm}): {pct(w.get(mm, {}).get('exact'))} exactly right")
    # 3 fund agent
    if s and "error" not in s:
        parts.append("<h2>3. Fund agent</h2>")
        parts.append(table(["Step", "Funds left"], [[esc(x["label"]), f"{x['count']:,}"] for x in s["funnel"]]))
        parts.append(f"<p>The agent ran for {pct(s['ran'])} of wishes and found at least one fund for {pct(s['with_a_pick'])}. "
                     f"{pct(s['relevance'])} of its picks matched the topic; {s['unsafe_picks']} picks were unsafe; "
                     f"{s['invented_rejected']} symbols it made up were caught and rejected; {s['passed_history']} picks had 8+ years of prices.</p>")
        parts.append(table(["Wish", "Searched for", "Picks (status)", "On topic"],
                           [[esc(r["text"]), esc(", ".join(r.get("searched") or [])), esc("; ".join(f"{a} {b} ({c})" for a, b, c in r.get("picks", [])) or r.get("error", "none")), f"{r['relevant']}/{r['n_picks']}"] for r in s["rows"]]))
        md.append(f"- Fund agent: {pct(s['relevance'])} of picks on topic, {s['unsafe_picks']} unsafe, {s['invented_rejected']} invented symbols rejected")
    # 4 engine
    if e and "error" not in e:
        parts.append("<h2>4. Portfolio engine</h2>")
        ok = [r for r in e["rows"] if "error" not in r]
        parts.append(table(["Risk level", "Wishes", "Funds", "Guardrails", "Retries", "Swing vs target", "Stability (groups / funds)", "Time"],
                           [[r["level"], esc(r["prefs"] or "none"), r["funds"], f"{r['passed']}/{r['checks']}", r["retries"], f"{pct(r['vol'], 1)} vs {pct(r['target'])}",
                             f"{pct(r['stability'])} / {pct(r['fund_stability'])}", f"{r['secs']:.1f}s"] for r in ok]))
        ex = e["explanations"]
        parts.append(f"<p><b>Fund explanations:</b> {ex['sentences']} AI-written sentences checked against the data; {ex['replaced']} replaced because a number didn't match "
                     f"({pct(ex['kept_rate'])} kept). {pct(ex['ai_written'])} of mixes were explained by the AI rather than the fallback template.</p>")
        md.append(f"- Engine: {pct(e['all_pass'])} of mixes pass every guardrail; explanation numbers kept {pct(ex['kept_rate'])}")
    # 5 red team
    if rt and "error" not in rt:
        cats = ["harmful", "injection", "off_topic", "crisis", "privacy", "control"]
        names = {"harmful": "Harmful", "injection": "Injection", "off_topic": "Off-topic", "crisis": "Crisis", "privacy": "Privacy (redacted)", "control": "Normal (let through)"}
        bc = rt["by_category"]
        parts.append("<h2>5. Safety red team</h2><p>Harmful, injection, off-topic and crisis prompts should be stopped; personal details should be removed; normal investing questions should go through.</p>")
        parts.append(bars([names[c] for c in cats if c in bc], {"Handled correctly": [bc[c]["rate"] for c in cats if c in bc]}, "Safety checks handled correctly", ylim=(0, 1.12)))
        if rt["misses"]:
            parts.append("<h3>Misses</h3>" + table(["Prompt", "Category", "Expected", "Got"], [[esc(x["text"]), x["category"], x["expect"], esc(x["got"])] for x in rt["misses"]]))
        md.append("- Safety: " + ", ".join(f"{names[c]} {bc[c]['ok']}/{bc[c]['n']}" for c in cats if c in bc))
    # 6 backtest
    if bt and "error" not in bt and bt.get("rows"):
        rows = [r for r in bt["rows"] if r["engine"] and r["fixed"] and r["sixty_forty"]]
        labels = [f"{r['level']}\n{r['profile']}" for r in rows]
        parts.append(f"<h2>6. Walk-forward backtest</h2><p>Each mix was built using prices up to {bt['split']} only, then judged on what happened after (data it never saw). Compared with the old fixed mix for the same personality and a classic 60/40 mix.</p>")
        parts.append(bars(labels, {"Engine mix": [r["engine"]["annual_return"] for r in rows], "Fixed mix": [r["fixed"]["annual_return"] for r in rows],
                                   "60/40": [r["sixty_forty"]["annual_return"] for r in rows]}, "Yearly return after the split"))
        parts.append(bars(labels, {"Engine mix": [-r["engine"]["max_drawdown"] for r in rows], "Fixed mix": [-r["fixed"]["max_drawdown"] for r in rows],
                                   "60/40": [-r["sixty_forty"]["max_drawdown"] for r in rows]}, "Biggest drop after the split (lower is better)"))
        parts.append(table(["Plan", "Target swing", "Engine: return / swing / worst drop", "Fixed mix", "60/40", "Engine mix"],
                           [[esc(f"{r['level']}, {r['profile']}"), pct(r["target"]),
                             f"{pct(r['engine']['annual_return'], 1)} / {pct(r['engine']['annual_volatility'], 1)} / {pct(r['engine']['max_drawdown'])}",
                             f"{pct(r['fixed']['annual_return'], 1)} / {pct(r['fixed']['annual_volatility'], 1)} / {pct(r['fixed']['max_drawdown'])}",
                             f"{pct(r['sixty_forty']['annual_return'], 1)} / {pct(r['sixty_forty']['annual_volatility'], 1)} / {pct(r['sixty_forty']['max_drawdown'])}",
                             esc(", ".join(f"{k} {v * 100:.0f}%" for k, v in r["engine_mix"].items()))] for r in rows]))
        parts.append("<p class='note'>Read this honestly: a few years of out-of-sample data is short, and one period can favour any mix. The useful questions are whether the engine kept risk near its target and avoided bigger drops than the simple mixes.</p>")
        md.append("- Backtest: see report (engine vs fixed vs 60/40 after " + bt["split"] + ")")
    # 7 personas
    if pe and "error" not in pe:
        parts.append("<h2>7. Simulated persona runs</h2><p>Automated end-to-end checks of the core loop, using the three personas' own words. These are not real user tests.</p>")
        parts.append(table(["Persona", "Read as", "Personality", "Mix", "Agent searched / added", "Checks", "Likely / bad case", "Time"],
                           [[esc(r["name"]), esc(r.get("read", r.get("failed_at", ""))), esc(r.get("personality", "–")), esc(", ".join(f"{a} {b * 100:.0f}%" for a, b in r.get("mix", []))),
                             esc(f"{r.get('agent_searched')} / {r.get('agent_added')}"), r.get("guardrails", esc(r.get("error", ""))),
                             f"${r['likely']:,.0f} / ${r['bad']:,.0f}" if r.get("ok") else "–", f"{r['secs']:.0f}s"] for r in pe["rows"]]))
    u = R.get("usage", {})
    failed = [k for k in ("goals", "wishes", "scout", "engine", "redteam", "backtest", "personas") if isinstance(R.get(k), dict) and "error" in R[k]]
    foot = (f"Run {esc(R['started'])} · {R.get('minutes')} min · {u.get('requests', 0)} AI requests, {u.get('prompt_tokens', 0) + u.get('completion_tokens', 0):,} tokens, "
            f"{u.get('retries', 0)} waits for the rate limit · main model {esc(mm)}" + (f" · smart model {esc(R['smart_model'])}" if R.get("smart_model") else "")
            + (f" · <b>sections that failed: {esc(', '.join(failed))}</b>" if failed else "")
            + (" · <b>the free daily AI limit was reached during the run, so later AI results may be incomplete; run again tomorrow or with Quick</b>" if u.get("daily_cap_hit") else ""))
    css = f"""body{{font-family:Inter,Helvetica,Arial,sans-serif;color:{INK};max-width:1050px;margin:32px auto;padding:0 20px;line-height:1.5;font-size:14px}}
h1{{font-size:26px;margin:0}} h2{{font-size:18px;margin:34px 0 6px;border-left:3px solid {BRAND};padding-left:8px}} h3{{font-size:14px;margin:16px 0 4px}}
.sub{{color:{MUTED};margin:4px 0 18px}} .cards{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}}
.card{{border:1px solid {LINE};border-radius:12px;padding:12px 14px}} .card .l{{font-size:12px;color:{MUTED}}} .card .v{{font-size:26px;font-weight:700;color:{BRAND}}} .card .s{{font-size:11px;color:{MUTED}}}
table{{border-collapse:collapse;width:100%;margin:8px 0;font-size:12px}} th{{text-align:left;background:#EEF2FF;padding:5px 7px;border-bottom:1.5px solid {BRAND}}}
td{{padding:5px 7px;border-bottom:1px solid {LINE};vertical-align:top}} img{{max-width:100%}} .note{{color:{MUTED};font-size:12px}} footer{{margin-top:30px;color:{MUTED};font-size:12px}}"""
    doc = (f"<!DOCTYPE html><html><head><meta charset='utf-8'><title>Seedwise evaluation report</title><style>{css}</style></head><body>"
           f"<h1>Seedwise evaluation report</h1><p class='sub'>Every AI step and the portfolio engine, tested automatically against written test sets. Romank Bhayana · AI Product Management capstone</p>"
           + "".join(parts) + f"<footer>{foot}</footer></body></html>")
    (out / "report.html").write_text(doc)
    (out / "summary.md").write_text("# Seedwise evaluation summary\n\n" + "\n".join(md) + f"\n\n{foot}\n")
