"use client";

import Link from "next/link";
import { useState } from "react";
import InsightCard from "@/components/InsightCard";
import { percent } from "@/lib/format";

export const MIX_COLORS = ["var(--color-brand)", "var(--color-sky)", "var(--color-gold)", "var(--color-violet)", "var(--color-rose)", "var(--color-gain)", "#64748B", "#0F766E"];

const THEME_WORDS = {
  tech: "technology", healthcare: "health care", financials: "banks and finance", energy: "energy", fossil_fuels: "oil and gas",
  consumer_staples: "everyday brands", utilities: "utilities", real_estate: "real estate", gold: "gold", international: "outside the US",
  emerging_markets: "emerging markets", dividends: "dividends", small_companies: "small companies", value: "value companies",
  growth: "growth companies", inflation_protection: "inflation protection", long_bonds: "long-term bonds", sector: "single-industry funds",
};
const EXAMPLES = ["More tech", "No oil companies", "Add some gold", "More dividends", "Keep it simple", "More outside the US"];

const GROUP_STYLE = {
  ballast: "bg-sky-soft text-sky",
  absorber: "bg-gold-soft text-gold",
  earner: "bg-gain-soft text-gain",
  core: "bg-brand-soft text-brand",
  growth: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
};

function Tag({ children, kind = "ai" }) {
  const cls = { ai: "bg-violet-500/10 text-violet-600 dark:text-violet-300", ml: "bg-brand-soft text-brand", math: "bg-surface-2 text-muted" }[kind];
  return <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${cls}`}>{children}</span>;
}

export function constraintWords(c) {
  if (!c) return [];
  const out = [];
  (c.tilts || []).forEach((t) => out.push({ kind: "more", text: `More ${THEME_WORDS[t] || t}` }));
  (c.exclude || []).forEach((t) => out.push({ kind: "no", text: `No ${THEME_WORDS[t] || t}` }));
  if (c.max_funds) out.push({ kind: "max", text: `At most ${c.max_funds} funds` });
  return out;
}

// "Anything you'd like in your mix?" — the AI turns the words into rules the engine must follow.
export function WishesBox({ engine, initialText = "", onRebuild, busy }) {
  const [text, setText] = useState(initialText);
  const read = constraintWords(engine?.constraints);
  const by = engine?.constraints?.read_by;
  function submit(e) {
    e.preventDefault();
    if (!busy) onRebuild(text.trim());
  }
  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">Make it yours</h2>
        <Tag>AI</Tag>
      </div>
      <p className="mt-1 text-sm text-muted">Tell the engine what you&rsquo;d like more or less of. The AI turns your words into rules, and the engine rebuilds your mix around them.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="wishes" className="sr-only">Your wishes</label>
        <input
          id="wishes"
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. I like tech, nothing in oil companies, keep it simple"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-[15px] text-fg placeholder:text-muted focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
        />
        <button disabled={busy} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink disabled:opacity-50">
          {busy ? "Rebuilding…" : "Rebuild my mix"}
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            type="button"
            key={ex}
            onClick={() => setText((t) => (t.trim() ? `${t.trim().replace(/[.,]$/, "")}, ${ex.toLowerCase()}` : ex))}
            className="rounded-full border border-line px-2.5 py-1 text-xs text-muted transition hover:border-brand hover:text-brand"
          >
            + {ex}
          </button>
        ))}
      </div>
      {read.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line pt-3 text-xs">
          <span className="font-semibold text-muted">{by === "keywords" ? "Read by keyword matching (AI unavailable):" : "The AI read this as:"}</span>
          {read.map((r) => (
            <span key={r.text} className={`rounded-full px-2.5 py-1 font-semibold ${r.kind === "no" ? "bg-red-50 text-loss dark:bg-red-500/10" : r.kind === "more" ? "bg-gain-soft text-gain" : "bg-surface-2 text-fg"}`}>
              {r.text}
            </span>
          ))}
        </div>
      )}
    </form>
  );
}

// The mix itself: a bar, then every fund with its group and a reason.
export function MixTable({ portfolio, engine }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">Your mix</h2>
        <span className="text-xs text-muted">
          {portfolio.holdings.length} funds · average fee {(engine.fee * 100).toFixed(2)}% a year
        </span>
      </div>
      {engine.overview && <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{engine.overview}</p>}
      <div className="mt-5 flex h-3.5 overflow-hidden rounded-full" role="img" aria-label={portfolio.holdings.map((h) => `${h.symbol} ${Math.round(h.weight * 100)}%`).join(", ")}>
        {portfolio.holdings.map((h, i) => (
          <div key={h.symbol} style={{ width: `${h.weight * 100}%`, background: MIX_COLORS[i % MIX_COLORS.length] }} />
        ))}
      </div>
      <ul className="mt-5 flex flex-col gap-2.5">
        {portfolio.holdings.map((h, i) => (
          <li key={h.symbol} className="rounded-xl border border-line px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="h-3 w-3 shrink-0 rounded" style={{ background: MIX_COLORS[i % MIX_COLORS.length] }} aria-hidden="true" />
              <Link href={`/stocks/${h.symbol}`} className="font-semibold hover:text-brand">{h.symbol}</Link>
              <span className="min-w-0 flex-1 truncate text-sm text-muted">{h.name}</span>
              <span className="text-lg font-bold tabular-nums">{Math.round(h.weight * 100)}%</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${GROUP_STYLE[h.group] || "bg-surface-2 text-muted"}`}>{h.group_name}</span>
              {h.matches?.length > 0 && <span className="rounded-full bg-gain-soft px-2 py-0.5 text-[11px] font-semibold text-gain">Your wish: {h.matches.join(", ")}</span>}
              <span className="text-[11px] text-muted">fee {(h.fee * 100).toFixed(2)}% · {Math.round(h.risk_share * 100)}% of the mix&rsquo;s risk</span>
            </div>
            {h.why && <p className="mt-1.5 pl-6 text-sm leading-relaxed">{h.why}</p>}
          </li>
        ))}
      </ul>
      {engine.notes?.map((n) => (
        <p key={n} className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{n}</p>
      ))}
    </div>
  );
}

function Step({ n, title, tag, tagKind, last = false, children }) {
  return (
    <li className={`relative flex gap-4 ${last ? "" : "pb-6"}`}>
      {!last && <span className="absolute bottom-0 left-[15px] top-8 w-px bg-line" aria-hidden="true" />}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-ink">{n}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{title}</h3>
          <Tag kind={tagKind}>{tag}</Tag>
        </div>
        <div className="mt-1.5 text-sm text-muted">{children}</div>
      </div>
    </li>
  );
}

// "How the engine built it": the five steps, with what happened at each.
export function EngineTrace({ engine, portfolio }) {
  const passed = engine.checks.filter((c) => c.ok).length;
  const read = constraintWords(engine.constraints);
  const stats = portfolio.stats;
  const failed = engine.attempts.filter((a) => a.result !== "passed");
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="engine-title">
      <h2 id="engine-title" className="text-lg font-bold">How the engine built your mix</h2>
      <p className="mt-1 text-sm text-muted">Five steps, run fresh for you on real prices. The AI handles words; every weight comes from maths you can check.</p>
      <ol className="mt-5">
        <Step n={1} title="Read your wishes" tag="AI · language model" tagKind="ai">
          {read.length ? (
            <div className="flex flex-wrap gap-1.5">
              {read.map((r) => (
                <span key={r.text} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-fg">{r.text}</span>
              ))}
            </div>
          ) : (
            "No special wishes, so every fund was allowed except single-industry bets."
          )}
          {engine.excluded_funds?.length > 0 && <p className="mt-1.5">Left out: {engine.excluded_funds.join(", ")}.</p>}
        </Step>
        <Step n={2} title={`Grouped ${engine.considered} funds by how they behave`} tag="Unsupervised learning · k-means" tagKind="ml">
          <p>No one labelled these funds. k-means found groups from 5 measures of their real history since 2016: return, swings, worst drop, and how closely they move with stocks and with bonds.</p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {engine.groups.map((g) => (
              <div key={g.id} className="rounded-xl border border-line p-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${GROUP_STYLE[g.id]}`}>{g.name}</span>
                  <span className="text-[11px]">{g.picked.length ? `${g.picked.length} picked` : "none picked"}</span>
                </div>
                <p className="mt-1 text-xs">{g.about}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {g.funds.map((s) => (
                    <span key={s} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${g.picked.includes(s) ? "bg-brand text-brand-ink" : "bg-surface-2 text-muted"}`}>{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Step>
        <Step n={3} title="Chose the weights" tag="Optimisation" tagKind="math">
          <p>
            The optimiser looked for the most expected growth with a typical yearly swing of about <b className="text-fg">{Math.round(engine.target_volatility * 100)}%</b>
            {engine.target_volatility < engine.initial_target ? ` (lowered from ${Math.round(engine.initial_target * 100)}% to pass the checks)` : ""}, the level that fits a {portfolio.name}.
            It got <b className="text-fg">{percent(stats.annual_volatility)}</b>. Past returns were shrunk towards their averages first, so one lucky fund can&rsquo;t take over.
          </p>
        </Step>
        <Step n={4} title={`Checked itself: ${passed} of ${engine.checks.length} guardrails pass`} tag="Self-check" tagKind="math">
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {engine.checks.map((c) => (
              <li key={c.id} className="flex gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs">
                <span className={c.ok ? "text-gain" : "text-loss"} aria-hidden="true">{c.ok ? "✓" : "✗"}</span>
                <span>
                  <span className="font-semibold text-fg">{c.name}</span>
                  <span className="sr-only">{c.ok ? " passed" : " failed"}</span>
                  <br />
                  {c.detail}
                </span>
              </li>
            ))}
          </ul>
          {failed.length > 0 && (
            <div className="mt-2.5 rounded-lg border border-line p-2.5 text-xs">
              <div className="font-semibold text-fg">The engine fixed its own first try:</div>
              {failed.map((a) => (
                <div key={a.n}>Try {a.n} {a.result}, so it {a.change}.</div>
              ))}
            </div>
          )}
        </Step>
        <Step n={5} last title="Stress-tested the answer" tag="Bootstrap resampling" tagKind="ml">
          <p>The engine re-ran itself on {engine.stability?.runs ?? 10} reshuffled versions of history to see if your mix holds up or was a fluke of the data.</p>
          <InsightCard insight={engine.insight} feature="mix" title="How sure is the engine?" className="mt-2.5" />
        </Step>
      </ol>
    </section>
  );
}
