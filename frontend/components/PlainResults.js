"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import GrowthChart from "@/components/GrowthChart";
import { LEVEL_LABELS, money, percent } from "@/lib/format";

const COLORS = ["#3DDC97", "#5AA9F5", "#F5B95A", "#B58CF5", "#F58C8C"];

function useCountUp(target, ms = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

function PersonalityIcon({ level }) {
  const paths = {
    conservative: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
    moderate: <><path d="M3 21h18" /><path d="M5 21V11h4v10" /><path d="M10 21V7h4v14" /><path d="M15 21V3h4v18" /></>,
    aggressive: <><path d="M4 20L20 4" /><path d="M9 4h11v11" /></>,
  };
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#3DDC97" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[level] || paths.moderate}
    </svg>
  );
}

function Box({ label, value, highlight }) {
  return (
    <div className={`rounded-2xl bg-ink p-4 ${highlight ? "border-2 border-mint" : "border border-line"}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${highlight ? "text-mint" : ""}`}>{value}</div>
    </div>
  );
}

export default function PlanResults({ result, goal, years, saved, onStartOver }) {
  const { risk, portfolio, projection } = result;
  const final = projection.final;
  const stats = portfolio.stats;
  const animated = useCountUp(final.median);
  const growth = final.median - final.contributed;
  const target = Math.ceil((final.median * 1.2) / 1000) * 1000;

  return (
    <div className="flex flex-col gap-6">
      <style>{`@keyframes sw-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }`}</style>

      {saved === "saved" && (
        <p className="rounded-2xl border border-[#23493A] bg-green-50 px-5 py-3 text-sm text-slate-800">
          <span className="font-semibold text-mint">Plan saved.</span> Find it any time under My plans.
        </p>
      )}
      {saved === "login" && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-slate-800">
          <Link href="/login" className="font-semibold text-amber-700 underline">Log in or sign up</Link> to save plans like this one.
        </p>
      )}

      <section className="flex flex-wrap gap-6">
        <div
          className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-3xl border border-[#23493A] bg-[radial-gradient(130%_120%_at_0%_0%,#17402F_0%,#10171F_60%)] p-8 motion-safe:animate-[sw-rise_0.6s_ease-out_both]"
        >
          <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mint">Your investor personality</div>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mint/15">
            <PersonalityIcon level={risk.risk_level} />
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight">{portfolio.name}</h1>
          <p className="leading-relaxed text-slate-700">{risk.explanation}</p>
          <div className="mt-auto flex items-center gap-3 pt-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-mint" style={{ width: `${(risk.score / risk.max_score) * 100}%` }} />
            </div>
            <span className="text-sm text-slate-700">
              {LEVEL_LABELS[risk.risk_level]} · {risk.score} / {risk.max_score}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-[2_1_520px] rounded-3xl border border-line bg-surface p-8 motion-safe:animate-[sw-rise_0.6s_ease-out_0.15s_both]">
          <div className="text-[15px] text-muted">
            In {years} {years === 1 ? "year" : "years"}, your plan for &ldquo;{goal}&rdquo; could be worth about
          </div>
          <div className="mt-2 font-display text-6xl font-bold tracking-tight tabular-nums sm:text-7xl" aria-live="polite">
            {money(animated)}
          </div>
          <div className="mt-3 flex flex-wrap gap-2.5 text-sm">
            {growth >= 0 ? (
              <span className="rounded-full bg-mint/10 px-3 py-1.5 font-semibold text-mint">+{money(growth)} from growth</span>
            ) : (
              <span className="rounded-full bg-red-50 px-3 py-1.5 font-semibold text-red-600">{money(growth)} vs. what you put in</span>
            )}
            <span className="rounded-full border border-slate-300 px-3 py-1.5 text-slate-700">{money(final.contributed)} you put in</span>
            <span className="rounded-full border border-slate-300 px-3 py-1.5 text-slate-700">
              ≈ {money(final.median_in_todays_dollars)} in today&rsquo;s money
            </span>
          </div>
          <div className="mt-6">
            <GrowthChart data={projection.yearly} />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Box label="Bad case (1 in 10)" value={money(final.low)} />
            <Box label="Likely" value={money(final.median)} highlight />
            <Box label="Good case (1 in 10)" value={money(final.high)} />
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-6 motion-safe:animate-[sw-rise_0.6s_ease-out_0.3s_both]">
        <div className="min-w-0 flex-[1_1_500px] rounded-3xl border border-line bg-surface p-8">
          <h2 className="font-display text-2xl font-bold">What you&rsquo;d invest in</h2>
          <p className="mt-1.5 text-muted">{portfolio.description}</p>
          <div className="mt-6 flex h-3.5 overflow-hidden rounded-full">
            {portfolio.holdings.map((h, i) => (
              <div key={h.symbol} style={{ width: `${h.weight * 100}%`, background: COLORS[i % COLORS.length] }} />
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3">
            {portfolio.holdings.map((h, i) => (
              <Link
                key={h.symbol}
                href={`/stocks/${h.symbol}`}
                className="flex items-center gap-4 rounded-2xl border border-line bg-ink p-4 transition hover:border-mint/40"
              >
                <span className="h-3 w-3 shrink-0 rounded" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="w-14 font-semibold">{h.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted">{h.name}</span>
                <span className="font-semibold">{percent(h.weight)}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
          <div className="rounded-3xl border border-line bg-surface p-7">
            <h2 className="font-display text-xl font-bold">How it behaved in the past</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div><div className="text-xs text-muted">Avg yearly return</div><div className="text-2xl font-semibold text-mint">{percent(stats.annual_return)}</div></div>
              <div><div className="text-xs text-muted">Biggest drop</div><div className="text-2xl font-semibold">{percent(stats.max_drawdown)}</div></div>
              <div><div className="text-xs text-muted">Worst 12 months</div><div className="text-2xl font-semibold">{percent(stats.worst_12_months)}</div></div>
              <div><div className="text-xs text-muted">Years of data</div><div className="text-2xl font-semibold">{stats.years_of_data}</div></div>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-slate-500">
              Based on 2016 onward, a strong decade for markets. Future results may be lower.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-7">
            <h2 className="mb-1 font-display text-xl font-bold">Your next steps</h2>
            <Link href="/coach" className="flex justify-between rounded-2xl border border-line bg-ink px-4 py-3.5 transition hover:border-mint/40">
              Ask the AI Coach about my plan <span className="text-mint">→</span>
            </Link>
            <Link href="/learn" className="flex justify-between rounded-2xl border border-line bg-ink px-4 py-3.5 transition hover:border-mint/40">
              How do I actually start investing? <span className="text-mint">→</span>
            </Link>
            <Link href="/tools" className="flex justify-between rounded-2xl border border-line bg-ink px-4 py-3.5 transition hover:border-mint/40">
              How much to reach {money(target)}? <span className="text-mint">→</span>
            </Link>
            <button onClick={onStartOver} className="mt-1 rounded-full border border-slate-300 px-5 py-3 text-sm font-medium transition hover:border-mint hover:text-mint">
              Start a new plan
            </button>
          </div>
        </div>
      </section>

      <p className="text-xs text-slate-500">{projection.disclaimer}</p>
    </div>
  );
}