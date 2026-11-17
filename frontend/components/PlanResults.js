"use client";

import InsightCard from "@/components/InsightCard";
import Link from "next/link";
import { useEffect, useState } from "react";
import GrowthChart from "@/components/GrowthChart";
import { LEVEL_LABELS, money, percent } from "@/lib/format";

const COLORS = ["var(--color-mint)", "var(--color-sky)", "var(--color-gold)", "var(--color-violet)", "var(--color-rose)"];

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

function Confetti() {
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPieces(
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.6,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 6,
      }))
    );
    const t = setTimeout(() => setPieces([]), 4500);
    return () => clearTimeout(t);
  }, []);
  if (!pieces.length) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      <style>{`@keyframes sw-confetti { from { transform: translateY(-5vh) rotate(0deg) } to { transform: translateY(110vh) rotate(720deg) } }`}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.45,
            background: p.color,
            animation: `sw-confetti ${p.duration}s cubic-bezier(.3,.6,.5,1) ${p.delay}s both`,
          }}
        />
      ))}
    </div>
  );
}

function PersonalityIcon({ level }) {
  const paths = {
    conservative: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
    moderate: <><path d="M3 21h18" /><path d="M5 21V11h4v10" /><path d="M10 21V7h4v14" /><path d="M15 21V3h4v18" /></>,
    aggressive: <><path d="M4 20L20 4" /><path d="M9 4h11v11" /></>,
  };
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--color-mint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      {saved !== "opened" && <Confetti />}
      <style>{`@keyframes sw-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }`}</style>

      {saved === "saved" && (
        <p className="rounded-2xl border border-mint-line bg-green-50 px-5 py-3 text-sm text-slate-800">
          <span className="font-semibold text-mint">Plan saved.</span> Find it any time under My plans.
        </p>
      )}
      {saved === "opened" && (
        <p className="rounded-2xl border border-line bg-surface px-5 py-3 text-sm text-muted">
          Your saved plan, recalculated with the latest market data.
        </p>
      )}
      {saved === "login" && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-slate-800">
          <Link href="/login" className="font-semibold text-amber-700 underline">Log in or sign up</Link> to save plans like this one.
        </p>
      )}

      <section className="flex flex-wrap gap-6">
        <div
          className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-3xl border border-mint-line bg-glow p-8 motion-safe:animate-[sw-rise_0.6s_ease-out_both]"
        >
          <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mint">Your investor personality</div>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mint/15">
            <PersonalityIcon level={risk.risk_level} />
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight">{portfolio.name}</h1>
          <p className="leading-relaxed text-slate-700">{risk.explanation}</p>
          <div className="mt-2 flex flex-col gap-2">
            {[
              ["conservative", "Steady Saver", "Mostly bonds. Calm ride."],
              ["moderate", "Balanced Builder", "Stocks and bonds mixed."],
              ["aggressive", "Growth Seeker", "Mostly stocks. Bumpier, more growth."],
            ].map(([level, name, note]) => {
              const me = risk.risk_level === level;
              return (
                <div
                  key={level}
                  className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ${
                    me ? "border border-mint bg-mint/10" : "border border-line bg-ink/50 text-muted"
                  }`}
                >
                  <span className={me ? "font-semibold text-fg" : ""}>{name}</span>
                  <span className="text-right text-xs">{me ? <span className="font-semibold text-mint">You are here</span> : note}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-auto flex items-center gap-3 pt-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-mint" style={{ width: `${(risk.score / risk.max_score) * 100}%` }} />
            </div>
            <span className="text-sm text-slate-700">
              {LEVEL_LABELS[risk.risk_level]} · {risk.score} / {risk.max_score}
            </span>
          </div>
          <InsightCard insight={risk.insight} feature="personality" title="How well this fits you" />
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
          <InsightCard insight={projection.insight} feature="projection" title="How likely is this?" className="mt-5" />
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
