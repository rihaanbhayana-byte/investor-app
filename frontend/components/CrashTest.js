"use client";

import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { money, percent } from "@/lib/format";
import { ChartTooltip, monthName, Segmented } from "@/components/ui";

const EVENTS = [
  { id: "covid", title: "COVID crash", when: "2020", text: "The fastest crash in history." },
  { id: "bear2022", title: "2022 bear market", when: "2022", text: "A long, slow slide as interest rates rose." },
  { id: "dip2018", title: "Late-2018 drop", when: "2018", text: "A sharp scare that passed quickly." },
];

const CHOICES = {
  panic: { label: "Sell everything", text: "Get out now and keep what's left in cash." },
  stayed: { label: "Hold on", text: "Do nothing and wait it out." },
  buy_more: { label: "Buy more", text: "Invest extra while prices are low." },
};

const LESSON = {
  panic:
    "Selling at the bottom locks in the loss. The market bounced back without you, and you'd have missed the recovery. This is the most common, and most expensive, beginner mistake.",
  stayed:
    "Holding on is hard when everything is falling, but you gave your money time to recover. Most big drops in history have eventually been made back.",
  buy_more:
    "Investing more when prices were low paid off. It takes nerve and spare cash, so only invest money you won't need for years.",
};

export default function CrashTest() {
  const [event, setEvent] = useState("covid");
  const [level, setLevel] = useState("moderate");
  const [amount, setAmount] = useState("10000");
  const [data, setData] = useState(null);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState("setup"); // setup | playing | decide | done
  const [choice, setChoice] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  const bottomIndex = data ? data.series.findIndex((r) => r.month === data.bottom_month) : -1;

  useEffect(() => {
    if (phase !== "playing" || !data) return;
    const speed = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 60 : 420;
    timer.current = setInterval(() => {
      setStep((s) => {
        const next = s + 1;
        if (!choice && next >= bottomIndex) {
          clearInterval(timer.current);
          setPhase("decide");
          return bottomIndex;
        }
        if (next >= data.series.length - 1) {
          clearInterval(timer.current);
          setPhase("done");
          return data.series.length - 1;
        }
        return next;
      });
    }, speed);
    return () => clearInterval(timer.current);
  }, [phase, data, choice, bottomIndex]);

  async function start() {
    setLoading(true);
    setError("");
    try {
      const result = await api.crashTest(event, level, Number(amount));
      setData(result);
      setStep(0);
      setChoice(null);
      setPhase("playing");
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  function decide(c) {
    setChoice(c);
    setPhase("playing");
  }

  function skip() {
    clearInterval(timer.current);
    if (!choice) {
      setStep(bottomIndex);
      setPhase("decide");
    } else {
      setStep(data.series.length - 1);
      setPhase("done");
    }
  }

  if (!data || phase === "setup") {
    return (
      <div className="flex flex-col gap-6 rounded-3xl border border-line bg-surface p-7">
        <div>
          <h3 className="font-display text-2xl font-bold">Could you survive a market crash?</h3>
          <p className="mt-1 text-muted">Pick a real crash. We&rsquo;ll replay it on a model portfolio, month by month, and ask what you&rsquo;d do at the worst moment.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {EVENTS.map((e) => (
            <button
              key={e.id}
              onClick={() => setEvent(e.id)}
              aria-pressed={event === e.id}
              className={`rounded-2xl border-2 p-5 text-left transition ${event === e.id ? "border-mint bg-mint/10" : "border-line bg-ink hover:border-slate-300"}`}
            >
              <div className="font-display text-sm font-bold text-mint">{e.when}</div>
              <div className="mt-1 font-display text-lg font-bold">{e.title}</div>
              <div className="mt-1 text-sm text-muted">{e.text}</div>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="mb-2 text-sm font-medium text-slate-700">Invested like a...</div>
            <Segmented label="Portfolio" value={level} onChange={setLevel} options={[["conservative", "Steady Saver"], ["moderate", "Balanced Builder"], ["aggressive", "Growth Seeker"]]} />
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-slate-700">Starting with</div>
            <Segmented label="Amount" value={amount} onChange={setAmount} options={[["1000", "$1,000"], ["10000", "$10,000"], ["50000", "$50,000"]]} />
          </div>
        </div>
        {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-red-700">{error}</p>}
        <button onClick={start} disabled={loading} className="self-start rounded-full bg-mint px-7 py-3.5 font-semibold text-mint-ink transition hover:bg-mint-light disabled:opacity-40">
          {loading ? "Loading the history..." : "Start the replay →"}
        </button>
      </div>
    );
  }

  const shown = data.series.map((r, i) => (i <= step ? r : { month: r.month }));
  const current = data.series[step];
  const value = choice ? current[choice] : current.stayed;
  // The % must compare with the money actually put in, so the extra top-up doesn't count as "growth".
  const addedExtra = choice === "buy_more" && step > bottomIndex;
  const putIn = data.amount + (addedExtra ? data.extra : 0);
  const change = value / putIn - 1;
  const latestEvent = [...data.series.slice(0, step + 1)].reverse().find((r) => r.event);
  const all = data.series.flatMap((r) => [r.stayed, r.panic, r.buy_more, r.sp500 || r.stayed]);
  const { domain, ticks: yTicks } = niceAxis(Math.min(...all), Math.max(...all));
  const yearTicks = data.series.filter((r) => r.month.endsWith("-01") || r.month.endsWith("-07")).map((r) => r.month);
  const lines = [
    { key: "stayed", name: "Held on", color: "var(--color-mint)" },
    ...(choice === "panic" || phase === "done" ? [{ key: "panic", name: "Sold at the bottom", color: "var(--color-loss)" }] : []),
    ...(choice === "buy_more" || phase === "done" ? [{ key: "buy_more", name: `Bought ${money(data.extra)} more`, color: "var(--color-sky)" }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-3xl border border-line bg-surface p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mint">{data.title} · {data.portfolio_name}</div>
            <div className="mt-2 font-display text-5xl font-bold tabular-nums">{money(value)}</div>
            <div className={`mt-1 font-semibold ${change >= 0 ? "text-mint" : "text-red-600"}`}>
              {change >= 0 ? "+" : ""}{percent(change)} on the {money(putIn)} you put in · {monthName(current.month)}
            </div>
          </div>
          <div className="flex gap-2">
            {phase === "playing" && (
              <button onClick={skip} className="rounded-full border border-line px-4 py-2.5 text-sm text-muted transition hover:border-slate-300 hover:text-fg">Skip ahead</button>
            )}
            <button onClick={() => { clearInterval(timer.current); setPhase("setup"); }} className="rounded-full border border-line px-4 py-2.5 text-sm text-muted transition hover:border-slate-300 hover:text-fg">
              Try another
            </button>
          </div>
        </div>

        <div className="mt-4 min-h-[56px] rounded-2xl border border-line bg-ink px-5 py-3.5" aria-live="polite">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">{latestEvent ? monthName(latestEvent.month) : "The story"}</span>
          <p className="mt-0.5 text-slate-800">{latestEvent ? latestEvent.event : data.intro}</p>
        </div>

        <div className="mt-6 h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={shown} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-grid)" vertical={false} />
              <XAxis dataKey="month" ticks={yearTicks} interval={0} tickFormatter={(m) => monthName(m)} tick={{ fill: "var(--color-muted)", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "var(--color-line)" }} />
              <YAxis domain={domain} ticks={yTicks} interval={0} width={70} tickFormatter={(v) => money(v)} tick={{ fill: "var(--color-muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip format={money} labelFormat={monthName} />} cursor={{ stroke: "var(--color-line-strong)" }} />
              <Line type="linear" dataKey="sp500" name="S&P 500" stroke="var(--color-dim)" strokeDasharray="6 6" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
              {lines.map((l) => (
                <Line key={l.key} type="linear" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={l.key === (choice || "stayed") ? 3.5 : 2} dot={false} isAnimationActive={false} />
              ))}
              {lines.some((l) => l.key === "buy_more") && step > bottomIndex && (
                <ReferenceDot
                  x={data.series[bottomIndex + 1]?.month}
                  y={data.series[bottomIndex + 1]?.buy_more}
                  r={5}
                  fill="var(--color-sky)"
                  stroke="var(--color-ink)"
                  strokeWidth={2}
                  label={{ value: `+${money(data.extra)} added`, position: "top", fill: "var(--color-sky)", fontSize: 12, fontWeight: 600 }}
                />
              )}
              {step >= bottomIndex && <ReferenceDot x={data.bottom_month} y={data.bottom_value} r={6} fill="var(--color-loss)" stroke="var(--color-ink)" strokeWidth={2} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-5 text-[13px] text-muted">
          {lines.map((l) => (
            <span key={l.key} className="flex items-center gap-2"><span className="h-[3px] w-4" style={{ background: l.color }} />{l.name}</span>
          ))}
          <span className="flex items-center gap-2"><span className="w-4 border-t-2 border-dashed border-dim" />S&amp;P 500</span>
        </div>
      </div>

      {phase === "decide" && (
        <div className="rounded-3xl border-2 border-red-200 bg-glow-danger p-7 motion-safe:animate-[sw-rise_0.35s_ease-out_both]">
          <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-red-600">{monthName(data.bottom_month)} · Decision time</div>
          <h3 className="mt-2 font-display text-3xl font-bold">
            Your {money(data.amount)} is now {money(data.bottom_value)}. That&rsquo;s {percent(Math.abs(data.max_drop))} gone.
          </h3>
          <p className="mt-2 text-muted">The news is scary and nobody knows how low it will go. What do you do?</p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {Object.entries(CHOICES).map(([id, c]) => (
              <button key={id} onClick={() => decide(id)} className="rounded-2xl border-2 border-line bg-ink p-5 text-left transition hover:-translate-y-0.5 hover:border-slate-300">
                <div className="font-display text-lg font-bold">{c.label}</div>
                <div className="mt-1 text-sm text-muted">{id === "buy_more" ? `Invest ${money(data.extra)} extra while prices are low.` : c.text}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="flex flex-col gap-4 motion-safe:animate-[sw-rise_0.4s_ease-out_both]">
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(CHOICES).map(([id, c]) => (
              <div key={id} className={`rounded-3xl border-2 p-6 ${choice === id ? "border-mint bg-mint/5" : "border-line bg-surface"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{c.label}</span>
                  {choice === id && <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold text-mint-ink">Your choice</span>}
                </div>
                <div className="mt-3 font-display text-3xl font-bold tabular-nums">{money(data.final[id])}</div>
                <div className="text-sm text-muted">
                  by {monthName(data.end_month)}{id === "buy_more" ? ` (you put in ${money(data.amount + data.extra)})` : ""}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-3xl border border-line bg-surface p-6">
            <h3 className="font-display text-xl font-bold">What this teaches</h3>
            <p className="mt-2 leading-relaxed text-slate-800">{LESSON[choice]}</p>
            <p className="mt-3 text-sm text-muted">
              {data.recovered_month
                ? `Holding on, this portfolio was back to ${money(data.amount)} by ${monthName(data.recovered_month)}, ${data.months_to_recover} months after the bottom.`
                : `By ${monthName(data.end_month)} this portfolio hadn't fully recovered yet. Some recoveries take years, which is why time matters.`}
            </p>
            <p className="mt-3 text-xs text-slate-500">{data.note}</p>
          </div>
        </div>
      )}
    </div>
  );
}


// Even, round steps for the money axis (e.g. $8,000 · $9,000 · $10,000 instead of $15,100 · $15,800).
function niceAxis(min, max) {
  const raw = (max - min) / 5 || 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((m) => m >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v));
  return { domain: [lo, hi], ticks };
}
