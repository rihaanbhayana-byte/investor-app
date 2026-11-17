"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { askCoach } from "@/lib/coach";
import { money } from "@/lib/format";
import GrowthChart from "./GrowthChart";

// "What if I saved a bit more, or waited longer?" Drag a slider and the real projection
// (5,000 simulated futures on this portfolio's history) runs again.
function Slider({ id, label, value, min, max, step, onChange, format }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-medium text-muted">{label}</label>
        <span className="font-bold tabular-nums">{format(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-brand)]" />
    </div>
  );
}

export default function WhatIf({ riskLevel, initialAmount, monthly, years, base }) {
  const start = { initialAmount, monthly, years };
  const [v, setV] = useState(start);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const changed = v.initialAmount !== initialAmount || v.monthly !== monthly || v.years !== years;

  useEffect(() => {
    if (!changed) return setResult(null);
    const n = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .projection({ risk_level: riskLevel, initial_amount: v.initialAmount, monthly_contribution: v.monthly, years: v.years })
        .then((r) => n === seq.current && setResult(r))
        .catch(() => {})
        .finally(() => n === seq.current && setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [v.initialAmount, v.monthly, v.years]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = result?.final;
  const diff = now ? now.median - base.median : 0;
  const maxMonthly = Math.max(1000, Math.ceil((monthly * 3) / 50) * 50);
  const maxStart = Math.max(10000, Math.ceil((initialAmount * 3) / 500) * 500);

  return (
    <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8" aria-labelledby="whatif-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-brand">What if…</div>
          <h2 id="whatif-title" className="text-2xl font-bold tracking-tight">Try small changes, see the difference</h2>
        </div>
        {changed && <button type="button" onClick={() => setV(start)} className="text-sm font-semibold text-brand">Reset to my plan</button>}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-6">
          <Slider id="wi-monthly" label="Each month" value={v.monthly} min={0} max={maxMonthly} step={25} format={(x) => money(x)} onChange={(x) => setV({ ...v, monthly: x })} />
          <Slider id="wi-years" label="For how long" value={v.years} min={1} max={40} step={1} format={(x) => `${x} year${x === 1 ? "" : "s"}`} onChange={(x) => setV({ ...v, years: x })} />
          <Slider id="wi-start" label="Starting amount" value={v.initialAmount} min={0} max={maxStart} step={100} format={(x) => money(x)} onChange={(x) => setV({ ...v, initialAmount: x })} />
          <div className="flex flex-wrap gap-2">
            {[
              ["+$50 a month", () => setV({ ...v, monthly: v.monthly + 50 })],
              ["+5 years", () => setV({ ...v, years: Math.min(40, v.years + 5) })],
              ["Start 2 years later", () => setV({ ...v, years: Math.max(1, v.years - 2) })],
            ].map(([label, fn]) => (
              <button key={label} type="button" onClick={fn} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold transition hover:border-brand hover:text-brand">{label}</button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line p-4">
              <div className="text-xs text-muted">Your plan</div>
              <div className="text-2xl font-bold tabular-nums">{money(base.median)}</div>
              <div className="text-xs text-muted">in {years} yrs · you put in {money(base.contributed)}</div>
            </div>
            <div className={`rounded-2xl border p-4 transition ${changed ? "border-brand bg-brand-soft" : "border-dashed border-line"}`} aria-live="polite">
              <div className="text-xs text-muted">With your changes</div>
              {!changed ? (
                <div className="mt-1 text-sm text-muted">Move a slider to compare.</div>
              ) : loading && !now ? (
                <div className="mt-1 h-8 w-32 animate-pulse rounded bg-surface-2" />
              ) : now ? (
                <>
                  <div className={`text-2xl font-bold tabular-nums ${loading ? "opacity-50" : ""}`}>{money(now.median)}</div>
                  <div className={`text-xs font-semibold ${diff >= 0 ? "text-gain" : "text-loss"}`}>
                    {diff >= 0 ? "+" : "−"}{money(Math.abs(diff))} vs your plan · you put in {money(now.contributed)}
                  </div>
                </>
              ) : null}
            </div>
          </div>
          {changed && now && <GrowthChart data={result.yearly} />}
          {changed && now && (
            <button
              type="button"
              onClick={() => askCoach(`If I invest ${money(v.monthly)} a month for ${v.years} years starting with ${money(v.initialAmount)} instead of my plan, the likely value changes by ${money(diff)}. Explain in simple words why small changes like this matter so much.`)}
              className="self-start text-sm font-semibold text-brand"
            >
              Ask AI why this makes such a difference →
            </button>
          )}
        </div>
      </div>
      <p className="mt-5 text-xs text-muted">Same portfolio, same 5,000 simulations on real data since 2016. Only the money and time change.</p>
    </section>
  );
}
