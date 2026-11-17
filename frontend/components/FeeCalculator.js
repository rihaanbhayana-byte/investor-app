"use client";

import { useMemo, useState } from "react";
import { askCoach } from "@/lib/coach";
import { money } from "@/lib/format";

// How much would fees cost you? Plain compound-interest math, month by month.
// The growth rate is an assumption you can change; past returns don't promise future ones.

function grow({ start, monthly, years, rate, pctFee = 0, flatFee = 0 }) {
  const r = rate / 12;
  const f = pctFee / 12;
  let v = start;
  let paid = 0;
  const path = [v];
  for (let m = 1; m <= years * 12; m++) {
    v = v * (1 + r) + monthly;
    const fee = v * f + flatFee;
    paid += Math.min(fee, v);
    v = Math.max(0, v - fee);
    if (m % 12 === 0) path.push(v);
  }
  return { end: v, paid, path };
}

const OPTIONS = [
  { id: "etf", name: "Low-cost index fund", pct: 0.0003, flat: 0, note: "about 0.03% a year (e.g. VOO, VTI)" },
  { id: "robo", name: "Robo-advisor", pct: 0.0025, flat: 0, note: "0.25% a year on top of fund costs" },
  { id: "flat", name: "$4/month app", pct: 0, flat: 4, note: "flat fee, however much you invest" },
  { id: "active", name: "Actively managed fund", pct: 0.01, flat: 0, note: "around 1% a year" },
];

function Field({ id, label, value, onChange, prefix = "$", suffix, step = 1 }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-muted">{label}</span>
      <span className="flex items-center rounded-xl border border-line bg-surface px-3 focus-within:border-brand">
        {prefix && <span className="text-muted">{prefix}</span>}
        <input id={id} type="number" inputMode="decimal" min={0} step={step} value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} className="w-full bg-transparent px-1.5 py-2.5 tabular-nums text-fg focus:outline-none" />
        {suffix && <span className="text-muted">{suffix}</span>}
      </span>
    </label>
  );
}

export default function FeeCalculator() {
  const [start, setStart] = useState(1000);
  const [monthly, setMonthly] = useState(100);
  const [years, setYears] = useState(20);
  const [ratePct, setRatePct] = useState(7);

  const rows = useMemo(() => {
    const base = { start, monthly, years: Math.min(years, 60), rate: ratePct / 100 };
    const noFee = grow(base);
    return {
      noFee,
      options: OPTIONS.map((o) => ({ ...o, ...grow({ ...base, pctFee: o.pct, flatFee: o.flat }) })).map((o) => ({ ...o, lost: noFee.end - o.end })),
      putIn: start + monthly * 12 * Math.min(years, 60),
    };
  }, [start, monthly, years, ratePct]);
  const worst = Math.max(...rows.options.map((o) => o.lost), 1);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6">
        <div>
          <h2 className="text-xl font-bold">What would fees cost you?</h2>
          <p className="mt-1 text-sm text-muted">Small yearly fees come out every year, and the money they take can&rsquo;t grow. Over decades that adds up.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="fee-start" label="Starting amount" value={start} onChange={setStart} step={100} />
          <Field id="fee-monthly" label="Each month" value={monthly} onChange={setMonthly} step={10} />
          <Field id="fee-years" label="Years" value={years} onChange={(x) => setYears(Math.min(60, Math.round(x)))} prefix="" suffix="yrs" />
          <Field id="fee-rate" label="Growth per year (assumed)" value={ratePct} onChange={(x) => setRatePct(Math.min(20, x))} prefix="" suffix="%" step={0.5} />
        </div>
        <p className="text-xs text-muted">7% is close to the S&amp;P 500&rsquo;s long-run average after inflation. It&rsquo;s an assumption, not a promise.</p>
        <div className="rounded-2xl bg-surface-2 p-4 text-sm">
          With no fees at all you&rsquo;d have about <span className="font-bold tabular-nums">{money(rows.noFee.end)}</span> after putting in {money(rows.putIn)}.
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-6" aria-live="polite">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">After {years} years</div>
        {rows.options.map((o) => (
          <div key={o.id} className="rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="font-semibold">{o.name}</div>
                <div className="text-xs text-muted">{o.note}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold tabular-nums">{money(o.end)}</div>
                <div className={`text-xs font-semibold tabular-nums ${o.lost > 1 ? "text-loss" : "text-muted"}`}>{o.lost > 1 ? `−${money(o.lost)} to fees` : "almost nothing lost"}</div>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-loss/70" style={{ width: `${(o.lost / worst) * 100}%` }} />
            </div>
          </div>
        ))}
        <p className="text-xs text-muted">&ldquo;Lost to fees&rdquo; includes the growth those fees would have earned. Example fees are typical, not quotes for any company.</p>
        <button type="button" onClick={() => askCoach("Explain investing fees in simple words: expense ratios, advisory fees and flat monthly fees. How can a beginner keep them low?")} className="self-start text-sm font-semibold text-brand">
          Ask AI how to keep fees low →
        </button>
      </section>
    </div>
  );
}
