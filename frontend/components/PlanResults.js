"use client";

import InsightCard from "@/components/InsightCard";
import Link from "next/link";
import { PracticePlanButton } from "./PlanPractice";
import WhatIf from "./WhatIf";
import { EngineTrace, MixTable, WishesBox } from "./MixEngine";
import { Kpi, Pill } from "./dashboard/parts";
import { PlanPdfButton } from "./DownloadPdf";
import { useEffect, useState } from "react";
import GrowthChart from "@/components/GrowthChart";
import { LEVEL_LABELS, money, percent } from "@/lib/format";

const COLORS = ["var(--color-brand)", "var(--color-sky)", "var(--color-gold)", "var(--color-violet)", "var(--color-rose)"];

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
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[level] || paths.moderate}
    </svg>
  );
}

function Box({ label, value, highlight }) {
  return (
    <div className={`rounded-xl p-3.5 ${highlight ? "border border-brand-line bg-brand-soft" : "border border-line bg-surface-2"}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${highlight ? "text-brand" : ""}`}>{value}</div>
    </div>
  );
}

const PERSONALITY_NAMES = { conservative: "Steady Saver", moderate: "Balanced Builder", aggressive: "Growth Seeker" };

export default function PlanResults({ result, goal, years, inputs, saved, onStartOver, onChangePersonality, switching = false, wishes = "", onRebuild }) {
  const { risk, portfolio, projection, engine } = result;
  const mix = engine ? portfolio.holdings.map((h) => ({ symbol: h.symbol, weight: h.weight })) : null;
  const final = projection.final;
  const stats = portfolio.stats;
  const animated = useCountUp(final.median);
  const growth = final.median - final.contributed;
  const target = Math.ceil((final.median * 1.2) / 1000) * 1000;

  return (
    <div className="flex flex-col gap-5">
      {saved !== "opened" && <Confetti />}
      <style>{`@keyframes sw-rise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }`}</style>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">{portfolio.name}</span>
            {saved === "saved" && <span className="font-semibold text-gain">✓ Saved to My plans</span>}
            {saved === "opened" && <span>Saved plan · recalculated with today&rsquo;s prices</span>}
            {saved === "login" && (
              <span>
                <Link href="/login?next=/plan" className="font-semibold text-brand hover:underline">Log in</Link> to save this plan
              </span>
            )}
          </div>
          <h1 className="mt-1.5 text-[28px] font-bold leading-tight tracking-tight">{goal}</h1>
          <p className="mt-0.5 text-[15px] text-muted">
            {inputs ? `${money(Number(inputs.initialAmount))} to start + ${money(Number(inputs.monthly))} a month · ` : ""}
            {years} year{years === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <PracticePlanButton plan={{ goal, portfolio: portfolio.name, risk_level: risk.risk_level, holdings: portfolio.holdings }} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-light" />
          {inputs && <PlanPdfButton plan={{ goal, risk_level: risk.risk_level, initial_amount: inputs.initialAmount, monthly_contribution: inputs.monthly, years, holdings: mix }} />}
          <button type="button" onClick={onStartOver} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold transition hover:border-brand hover:text-brand">New plan</button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={`Likely value in ${years} year${years === 1 ? "" : "s"}`} value={money(animated)} sub={`≈ ${money(final.median_in_todays_dollars)} in today's money`} pill={<Pill kind="brand">Likely</Pill>} />
        <Kpi label="You put in" value={money(final.contributed)} sub="your start + every monthly amount" />
        <Kpi label="From growth" value={`${growth >= 0 ? "+" : "−"}${money(Math.abs(growth))}`} sub="in the likely case" pill={<Pill kind={growth >= 0 ? "gain" : "loss"}>{final.contributed ? `${growth >= 0 ? "+" : "−"}${Math.round(Math.abs(growth / final.contributed) * 100)}%` : "–"}</Pill>} />
        <Kpi label="Chance it beats what you put in" value={`${Math.round((final.odds?.more_than_put_in ?? 0) * 100)}%`} sub={`of ${(final.odds?.paths ?? 5000).toLocaleString()} simulated futures`}>
          <span className="mb-2 h-1.5 w-[84px] overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <span className="block h-full rounded-full bg-gain" style={{ width: `${(final.odds?.more_than_put_in ?? 0) * 100}%` }} />
          </span>
        </Kpi>
      </div>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6 motion-safe:animate-[sw-rise_0.5s_ease-out_both]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">How your money could grow</h2>
            <span className="text-xs text-muted">5,000 simulated futures on real data since 2016</span>
          </div>
          <div className="mt-4">
            <GrowthChart data={projection.yearly} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Box label="Bad case (1 in 10)" value={money(final.low)} />
            <Box label="Likely" value={money(final.median)} highlight />
            <Box label="Good case (1 in 10)" value={money(final.high)} />
          </div>
          <InsightCard insight={projection.insight} feature="projection" title="How likely is this?" className="mt-4" />
        </div>

        <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6 motion-safe:animate-[sw-rise_0.5s_ease-out_0.1s_both]">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Your investor personality</div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft">
              <PersonalityIcon level={risk.risk_level} />
            </span>
            <h2 className="text-xl font-bold tracking-tight">{portfolio.name}</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted">{risk.chosen && !engine ? portfolio.description : risk.explanation}</p>
          {risk.chosen && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span className="font-semibold">You chose this.</span> The quiz suggested {PERSONALITY_NAMES[risk.quiz_level]}.{" "}
              <button type="button" onClick={() => onChangePersonality?.(risk.quiz_level)} disabled={switching} className="font-semibold text-brand underline underline-offset-2">
                Go back
              </button>
            </p>
          )}
          <div className="text-xs font-medium text-muted">Not quite you? Pick another and the plan updates.</div>
          <div className={`flex flex-col gap-1.5 transition-opacity ${switching ? "opacity-50" : ""}`} aria-busy={switching}>
            {[
              ["conservative", "Steady Saver", "Mostly bonds. Calm ride."],
              ["moderate", "Balanced Builder", "Stocks and bonds mixed."],
              ["aggressive", "Growth Seeker", "Mostly stocks. Bumpier."],
            ].map(([level, name, note]) => {
              const me = risk.risk_level === level;
              const quiz = (risk.quiz_level ?? risk.risk_level) === level;
              return (
                <button
                  type="button"
                  key={level}
                  disabled={me || switching || !onChangePersonality}
                  aria-pressed={me}
                  onClick={() => onChangePersonality?.(level)}
                  className={`group flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm transition ${
                    me ? "border border-brand bg-brand-soft" : "border border-line text-muted hover:border-brand/50 hover:text-fg"
                  }`}
                >
                  <span className={me ? "font-semibold text-fg" : ""}>
                    {name}
                    {quiz && !me && <span className="ml-2 text-[11px] font-semibold text-gold">quiz pick</span>}
                  </span>
                  <span className="text-right text-xs">
                    {me ? (
                      <span className="font-semibold text-brand">{switching ? "Updating…" : "Current"}</span>
                    ) : (
                      <>
                        <span className="group-hover:hidden">{note}</span>
                        <span className="hidden font-semibold text-brand group-hover:inline">Switch →</span>
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brand" style={{ width: `${(risk.score / risk.max_score) * 100}%` }} />
            </div>
            <span className="text-xs text-muted">
              {LEVEL_LABELS[risk.risk_level]} · {risk.score} / {risk.max_score}
            </span>
          </div>
          <InsightCard insight={risk.insight} feature="personality" title={risk.chosen ? "How well the quiz pick fit you" : "How well this fits you"} />
        </div>
      </section>

      {engine && (
        <section className={`grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] motion-safe:animate-[sw-rise_0.6s_ease-out_0.2s_both] ${switching ? "opacity-60" : ""}`} aria-busy={switching}>
          <MixTable portfolio={portfolio} engine={engine} />
          <div className="flex min-w-0 flex-col gap-5">
            <WishesBox key={wishes} engine={engine} initialText={wishes} onRebuild={onRebuild} busy={switching} />
            <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
              <h2 className="text-lg font-bold">How this mix behaved since 2016</h2>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div><div className="text-xs text-muted">Avg yearly return</div><div className="text-2xl font-semibold text-brand">{percent(stats.annual_return)}</div></div>
                <div><div className="text-xs text-muted">Typical yearly swing</div><div className="text-2xl font-semibold">{percent(stats.annual_volatility)}</div></div>
                <div><div className="text-xs text-muted">Biggest drop</div><div className="text-2xl font-semibold">{percent(stats.max_drawdown)}</div></div>
                <div><div className="text-xs text-muted">Worst 12 months</div><div className="text-2xl font-semibold">{percent(stats.worst_12_months)}</div></div>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-muted">A strong decade for markets. Future results may be lower.</p>
            </div>
          </div>
        </section>
      )}
      {engine && <EngineTrace engine={engine} portfolio={portfolio} />}

      {inputs && <WhatIf key={`${risk.risk_level}-${inputs.initialAmount}-${inputs.monthly}-${years}-${(mix || []).map((h) => h.symbol + h.weight).join()}`} riskLevel={risk.risk_level} holdings={mix} initialAmount={Number(inputs.initialAmount)} monthly={Number(inputs.monthly)} years={years} base={final} />}

      <section className="flex flex-wrap items-start gap-5 motion-safe:animate-[sw-rise_0.6s_ease-out_0.3s_both]">
        {!engine && <div className="min-w-0 flex-[1_1_500px] rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-bold">What you&rsquo;d invest in</h2>
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
                className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 transition hover:border-brand/40 hover:bg-surface-2"
              >
                <span className="h-3 w-3 shrink-0 rounded" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="w-14 font-semibold">{h.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted">{h.name}</span>
                <span className="font-semibold">{percent(h.weight)}</span>
              </Link>
            ))}
          </div>
        </div>}

        <div className={`flex min-w-0 flex-[1_1_320px] gap-6 ${engine ? "flex-col lg:flex-row" : "flex-col"}`}>
          {!engine && <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="text-lg font-bold">How it behaved in the past</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div><div className="text-xs text-muted">Avg yearly return</div><div className="text-2xl font-semibold text-brand">{percent(stats.annual_return)}</div></div>
              <div><div className="text-xs text-muted">Biggest drop</div><div className="text-2xl font-semibold">{percent(stats.max_drawdown)}</div></div>
              <div><div className="text-xs text-muted">Worst 12 months</div><div className="text-2xl font-semibold">{percent(stats.worst_12_months)}</div></div>
              <div><div className="text-xs text-muted">Years of data</div><div className="text-2xl font-semibold">{stats.years_of_data}</div></div>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-slate-500">
              Based on 2016 onward, a strong decade for markets. Future results may be lower.
            </p>
          </div>}

          <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="mb-1 text-lg font-bold">Your next steps</h2>
            <Link href="/practice" className="flex justify-between rounded-xl border border-line bg-surface-2 px-4 py-3.5 transition hover:border-brand/40">
              Practice this plan with play money <span className="text-brand">→</span>
            </Link>
            <Link href="/coach" className="flex justify-between rounded-xl border border-line bg-surface-2 px-4 py-3.5 transition hover:border-brand/40">
              Ask the AI Coach about my plan <span className="text-brand">→</span>
            </Link>
            <Link href="/learn" className="flex justify-between rounded-xl border border-line bg-surface-2 px-4 py-3.5 transition hover:border-brand/40">
              How do I actually start investing? <span className="text-brand">→</span>
            </Link>
            <Link href="/tools" className="flex justify-between rounded-xl border border-line bg-surface-2 px-4 py-3.5 transition hover:border-brand/40">
              How much to reach {money(target)}? <span className="text-brand">→</span>
            </Link>
            <button onClick={onStartOver} className="mt-1 rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium transition hover:border-brand hover:text-brand">
              Start a new plan
            </button>
          </div>
        </div>
      </section>

      <p className="text-xs text-slate-500">{projection.disclaimer}</p>
    </div>
  );
}
