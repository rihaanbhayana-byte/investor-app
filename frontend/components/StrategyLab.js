"use client";

import InsightCard from "@/components/InsightCard";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import MultiLineChart from "@/components/MultiLineChart";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { monthName } from "@/components/ui";

const EXAMPLES = [
  ["Buy the dip", "Put $200 a month into the S&P 500, and an extra $400 whenever it drops 10% from its high."],
  ["Stop-loss", "Invest $5,000 in QQQ in 2018 and sell everything if it falls 20%."],
  ["Steady bonds", "$100 every month into bonds (BND) since 2016."],
  ["One stock", "$150 a month into Apple stock starting in 2019."],
];

const STEPS = ["Reading your strategy...", "Turning it into rules...", "Replaying every month since the start...", "Asking the AI to explain the results..."];

const EVENT_STYLE = {
  dip: { label: "Bought the dip", color: "text-mint", bg: "bg-mint/10" },
  stop_loss: { label: "Stop-loss sold", color: "text-red-600", bg: "bg-red-50" },
  buy_back: { label: "Bought back in", color: "text-sky", bg: "bg-sky-soft" },
};

// A rule the AI read. If the AI guessed it (it wasn't in your words), it's marked so you can check it.
function Chip({ children, source }) {
  const guessed = source === "ai_guess";
  return (
    <span
      title={guessed ? "The AI guessed this: it wasn't in your words." : source === "said_it" ? "Taken from your words." : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${guessed ? "border-amber-200 bg-amber-50" : "border-slate-300 bg-ink"}`}
    >
      {children}
      {guessed && <span className="text-[11px] font-semibold text-gold">AI guessed</span>}
    </span>
  );
}

function ResultCard({ title, data, winner, color }) {
  return (
    <div className={`rounded-3xl border-2 p-6 ${winner ? "border-mint bg-mint/5" : "border-line bg-surface"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold">
          <span className="h-3 w-3 rounded-full" style={{ background: color }} />
          {title}
        </span>
        {winner && <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold text-mint-ink">Better per $</span>}
      </div>
      <div className="mt-4 font-display text-4xl font-bold tabular-nums">{money(data.final)}</div>
      <div className="mt-1 text-sm text-muted">from {money(data.put_in)} put in</div>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-line bg-ink p-4 text-sm">
        <div>
          <div className="text-xs text-muted">Profit</div>
          <div className={`font-semibold ${data.profit >= 0 ? "text-mint" : "text-red-600"}`}>{data.profit >= 0 ? "+" : "−"}{money(Math.abs(data.profit))}</div>
        </div>
        <div>
          <div className="text-xs text-muted">Per $100 put in</div>
          <div className={`font-semibold ${data.profit_per_100 >= 0 ? "text-mint" : "text-red-600"}`}>{data.profit_per_100 >= 0 ? "+" : "−"}${Math.abs(data.profit_per_100).toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}

export default function StrategyLab() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!loading) return;
    setStepIndex(0);
    const t = setInterval(() => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1)), 1300);
    return () => clearInterval(t);
  }, [loading]);

  async function run(e) {
    e?.preventDefault();
    if (text.trim().length < 5) return;
    setLoading(true);
    setError("");
    setShowAll(false);
    try {
      setResult(await api.strategyTest(text));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  const r = result?.rules;
  const strategyWins = result && result.strategy.profit_per_100 >= result.simple.profit_per_100;
  const events = result ? (showAll ? result.events : result.events.slice(0, 6)) : [];
  const sameRules = r && !r.dip_drop_pct && !r.stop_loss_pct;
  const src = result?.insight?.rule_sources || {};

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={run} className="rounded-3xl border border-mint-line bg-glow p-7">
        <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-mint">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" />
          </svg>
          AI strategy lab
        </div>
        <label htmlFor="strategy" className="mt-3 block font-display text-2xl font-bold">Describe a strategy in your own words.</label>
        <p className="mt-1 text-muted">The AI turns it into rules, then we test them on real prices month by month. It only tests ideas. It never trades.</p>
        <textarea
          id="strategy"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLES[0][1]}
          className="mt-5 w-full resize-none rounded-2xl border border-line bg-ink px-5 py-4 text-lg text-fg placeholder:text-slate-500 focus:border-mint focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Try:</span>
            {EXAMPLES.map(([label, example]) => (
              <button key={label} type="button" onClick={() => setText(example)} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:border-mint hover:text-mint">
                {label}
              </button>
            ))}
          </div>
          <button disabled={loading || text.trim().length < 5} className="rounded-full bg-mint px-7 py-3.5 font-semibold text-mint-ink transition hover:bg-mint-light disabled:opacity-40">
            {loading ? "Testing..." : "Test my strategy →"}
          </button>
        </div>
      </form>

      {loading && (
        <div className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-6" role="status">
          <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-mint" />
          <span className="text-slate-800">{STEPS[stepIndex]}</span>
        </div>
      )}

      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-red-700">{error}</p>}

      {result && !loading && (
        <div className="flex flex-col gap-6 motion-safe:animate-[sw-rise_0.4s_ease-out_both]">
          <div className="rounded-3xl border border-line bg-surface p-6">
            <div className="text-sm font-semibold text-mint">The AI understood: {r.name}</div>
            {r.summary && <p className="mt-2 text-lg text-slate-800">{r.summary}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip source={src.symbol}>{r.symbol}</Chip>
              <Chip source={src.start}>From {monthName(r.start)}</Chip>
              {r.initial > 0 && <Chip source={src.initial}>{money(r.initial)} at the start</Chip>}
              {r.monthly > 0 && <Chip source={src.monthly}>{money(r.monthly)} every month</Chip>}
              {r.dip_drop_pct && <Chip source={src.dip_extra === "ai_guess" ? "ai_guess" : src.dip_drop_pct}>+{money(r.dip_extra)} when {r.dip_drop_pct}% below the 12-month high</Chip>}
              {r.stop_loss_pct && <Chip source={src.stop_loss_pct}>Sell all if it falls {r.stop_loss_pct}% from its peak</Chip>}
            </div>
            <InsightCard insight={result.insight} feature="strategy" title="How much to trust this test" className="mt-4" />
            {r.not_supported && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-slate-800">Couldn&rsquo;t test: {r.not_supported}</p>}
          </div>

          {sameRules ? (
            <ResultCard title="Your strategy" data={result.strategy} color="var(--color-mint)" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <ResultCard title="Your strategy" data={result.strategy} winner={strategyWins} color="var(--color-mint)" />
              <ResultCard title={`Simple monthly investing in ${r.symbol}`} data={result.simple} winner={!strategyWins} color="var(--color-sky)" />
            </div>
          )}

          <div className="rounded-3xl border border-line bg-surface p-6">
            <h3 className="font-display text-xl font-bold">Month by month</h3>
            <div className="mt-5">
              <MultiLineChart
                data={result.series}
                lines={[
                  { key: "strategy", name: "Your strategy", color: "var(--color-mint)" },
                  ...(sameRules ? [] : [{ key: "simple", name: "Simple monthly", color: "var(--color-sky)" }]),
                  { key: "put_in", name: "Money you put in", color: "var(--color-dim)", dashed: true },
                ]}
                format={(v) => money(v)}
              />
            </div>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            {result.verdict && (
              <div className="rounded-3xl border border-mint-line bg-glow p-6">
                <h3 className="font-display text-xl font-bold">What the AI thinks</h3>
                <div className="md mt-3 leading-relaxed text-slate-800">
                  <ReactMarkdown>{result.verdict}</ReactMarkdown>
                </div>
              </div>
            )}
            <div className="rounded-3xl border border-line bg-surface p-6">
              <h3 className="font-display text-xl font-bold">What happened</h3>
              {result.event_count === 0 ? (
                <p className="mt-3 text-muted">No special rules fired. Your money went in on schedule every month.</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-muted">Your rules fired {result.event_count} {result.event_count === 1 ? "time" : "times"}.</p>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {events.map((ev, i) => {
                      const s = EVENT_STYLE[ev.type];
                      return (
                        <li key={i} className="flex gap-3 rounded-2xl border border-line bg-ink p-3.5 text-sm">
                          <span className={`h-fit shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${s.bg} ${s.color}`}>{monthName(ev.month)}</span>
                          <span><span className={`font-semibold ${s.color}`}>{s.label}. </span><span className="text-slate-700">{ev.text}</span></span>
                        </li>
                      );
                    })}
                  </ul>
                  {result.events.length > 6 && (
                    <button onClick={() => setShowAll(!showAll)} className="mt-3 text-sm text-mint hover:text-mint-light">
                      {showAll ? "Show less" : `Show all ${result.events.length}`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
