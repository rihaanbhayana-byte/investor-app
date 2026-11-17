"use client";

import FeeCalculator from "@/components/FeeCalculator";
import SymbolSearch from "@/components/SymbolSearch";
import { useEffect, useState } from "react";
import MultiLineChart from "@/components/MultiLineChart";
import CrashTest from "@/components/CrashTest";
import StrategyLab from "@/components/StrategyLab";
import { api } from "@/lib/api";
import { money, percent } from "@/lib/format";
import { Avatar, PageHeader, RISE, SERIES_COLORS, Segmented, monthName, useCountUp } from "@/components/ui";

const YEARS = Array.from({ length: 10 }, (_, i) => 2016 + i);
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

const TABS = [
  { id: "time", title: "Time Machine", text: "What if you’d invested back then?", icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> },
  { id: "crash", title: "Crash test", text: "Would you survive a crash?", icon: <><path d="M3 7l6 6 4-4 8 8" /><path d="M21 11v6h-6" /></> },
  { id: "strategy", title: "Strategy lab", text: "Test an idea with AI.", icon: <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /> },
  { id: "goal", title: "Goal calculator", text: "How much to save each month?", icon: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></> },
  { id: "compare", title: "Compare stocks", text: "Race up to 4 side by side.", icon: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></> },
  { id: "fees", title: "Fee calculator", text: "What would fees cost you?", icon: <><circle cx="12" cy="12" r="9" /><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2" /></> },
];

const card = "rounded-3xl border border-line bg-surface p-7";
const primary = "rounded-xl bg-brand px-7 py-3.5 font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-40";

function useDebounced(value, ms = 450) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function InlineSelect({ value, onChange, children, label }) {
  return (
    <span className="relative inline-flex">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-2xl border-2 border-brand/40 bg-ink py-1 pl-4 pr-10 font-display font-bold text-brand transition hover:border-brand focus:border-brand focus:outline-none"
      >
        {children}
      </select>
      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );
}

// The ticker inside the Time Machine sentence: tap it to search any US stock or fund.
function InlineSymbol({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <span className="inline-block w-64 max-w-full align-middle font-sans text-base font-normal leading-normal">
        <SymbolSearch
          size="sm"
          autoFocus
          label="Pick a stock or fund"
          placeholder="Type a name or ticker…"
          onSelect={(item) => {
            onChange(item.symbol);
            setEditing(false);
          }}
          onDismiss={() => setEditing(false)}
        />
      </span>
    );
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`Stock: ${value}. Change it`}
      className="inline-flex items-center gap-2 rounded-2xl border-2 border-brand/40 bg-ink py-1 pl-4 pr-3 font-display font-bold text-brand transition hover:border-brand focus:border-brand focus:outline-none"
    >
      {value}
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
    </button>
  );
}

function Slider({ id, label, value, setValue, min, max, step, display }) {
  return (
    <div className="rounded-2xl border border-line bg-ink p-5">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</label>
        <span className="font-display text-2xl font-bold tabular-nums">{display(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => setValue(Number(e.target.value))} className="mt-4 w-full cursor-pointer accent-brand" />
    </div>
  );
}

function ErrorBox({ children }) {
  return <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-red-700">{children}</p>;
}

export default function ToolsPage() {
  const [tab, setTab] = useState("time");
  const [startSymbol, setStartSymbol] = useState("NVDA");
  const [stocks, setStocks] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (TABS.some((t) => t.id === params.get("tab"))) setTab(params.get("tab"));
    if (params.get("symbol")) setStartSymbol(params.get("symbol").toUpperCase());
    api.stocks().then(setStocks).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <style>{RISE}</style>
      <PageHeader title="Tools" subtitle="Calculators and experiments on real US market data since 2016." />

      <div role="tablist" aria-label="Tools" className="-mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1 [scrollbar-width:none]">
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => {
                setTab(t.id);
                window.history.replaceState(null, "", `/tools?tab=${t.id}`); // keep the link shareable and accurate
              }}
              title={t.text}
              className={`flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold transition ${
                on ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>{t.icon}</svg>
              {t.title}
            </button>
          );
        })}
      </div>

      <div key={tab} className="motion-safe:animate-[sw-rise_0.35s_ease-out_both]">
        <p className="-mt-2 text-sm text-muted">{TABS.find((t) => t.id === tab)?.text}</p>
        {tab === "time" && <TimeMachine stocks={stocks} startSymbol={startSymbol} />}
        {tab === "goal" && <GoalCalculator />}
        {tab === "compare" && <Compare stocks={stocks} />}
        {tab === "crash" && <CrashTest />}
        {tab === "strategy" && <StrategyLab />}
        {tab === "fees" && <FeeCalculator />}
      </div>
    </div>
  );
}

/* ---------------- Time Machine ---------------- */

function TimeMachine({ stocks, startSymbol }) {
  const [symbol, setSymbol] = useState(startSymbol);
  const [amount, setAmount] = useState(1000);
  const [year, setYear] = useState(2016);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const shown = useCountUp(result?.final_value ?? null, 1400);

  useEffect(() => setSymbol(startSymbol), [startSymbol]);

  async function run(e) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      setResult(await api.timeMachine(symbol, amount, `${year}-01`));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  const maxBar = result ? Math.max(result.final_value, result.sp500_final_value || 0) : 1;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={run} className={`${card} flex flex-col gap-6`}>
        <p className="text-xl font-bold leading-[2.4] sm:text-2xl sm:leading-[2.3]">
          If I had invested{" "}
          <span className="inline-flex items-baseline rounded-2xl border-2 border-brand/40 bg-ink px-3 text-brand focus-within:border-brand">
            $
            <input
              type="text"
              inputMode="numeric"
              aria-label="Amount"
              value={amount.toLocaleString("en-US")}
              onChange={(e) => setAmount(Math.min(10000000, Math.max(1, Number(e.target.value.replace(/[^0-9]/g, "")) || 1)))}
              style={{ width: `${amount.toLocaleString("en-US").length + 0.8}ch` }}
              className="bg-transparent [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </span>{" "}
          in{" "}
          <InlineSymbol value={symbol} onChange={setSymbol} />{" "}
          in January{" "}
          <InlineSelect label="Year" value={year} onChange={(v) => setYear(Number(v))}>
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </InlineSelect>
          ...
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Quick picks:</span>
            {["NVDA", "AAPL", "TSLA", "KO", "VOO"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSymbol(s)}
                className={`rounded-full px-3.5 py-1.5 text-sm transition ${symbol === s ? "bg-fg text-ink" : "border border-line text-muted hover:border-slate-300 hover:text-fg"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <button className={primary} disabled={loading}>{loading ? "Travelling back in time..." : "Take me back →"}</button>
        </div>
      </form>

      {error && <ErrorBox>{error}</ErrorBox>}

      {result && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className={`${card} flex flex-col gap-5 border-brand-line bg-glow`}>
            <div className="flex items-center gap-3">
              <Avatar symbol={result.symbol} />
              <div>
                <div className="font-semibold">{result.name}</div>
                <div className="text-sm text-muted">{money(result.amount)} in {monthName(result.start_month)}</div>
                {result.start_month > `${year}-01` && (
                  <div className="text-xs text-muted">{result.symbol}&rsquo;s price data starts in {monthName(result.start_month)}, so the trip starts there.</div>
                )}
              </div>
            </div>
            <div>
              <div className="text-muted">would be worth today</div>
              <div className="font-display text-6xl font-bold tracking-tight tabular-nums">{money(shown)}</div>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className={`rounded-full px-3 py-1.5 font-semibold ${result.gain >= 0 ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss"}`}>
                {result.gain >= 0 ? "+" : "−"}{money(Math.abs(result.gain))} ({percent(result.total_return)})
              </span>
              <span className="rounded-xl border border-slate-300 px-3 py-1.5 text-slate-700">≈ {percent(result.annual_return)} a year</span>
            </div>
            {result.sp500_final_value != null && (
              <div className="flex flex-col gap-3 rounded-2xl border border-line bg-ink p-4">
                <div className="text-sm font-semibold">vs. the whole market (S&amp;P 500)</div>
                {[
                  [result.symbol, result.final_value, "var(--color-brand)"],
                  ["S&P 500", result.sp500_final_value, "var(--color-dim)"],
                ].map(([label, value, color]) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">{label}</span>
                      <span className="font-semibold">{money(value)}</span>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(value / maxBar) * 100}%`, background: color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={card}>
            <h3 className="font-display text-xl font-bold">The journey</h3>
            <p className="mt-1 text-sm text-muted">Month by month, from {monthName(result.start_month)} to {monthName(result.end_month)}.</p>
            <div className="mt-5">
              <MultiLineChart
                data={result.series}
                lines={[
                  { key: "value", name: result.symbol, color: "var(--color-brand)" },
                  { key: "sp500_value", name: "S&P 500 (VOO)", color: "var(--color-dim)", dashed: true },
                ]}
                format={(v) => money(v)}
              />
            </div>
            <p className="mt-4 text-xs text-slate-500">Picking one winner in hindsight is much easier than in real life. That&rsquo;s why most plans use funds.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Goal calculator ---------------- */

function GoalCalculator() {
  const [target, setTarget] = useState(50000);
  const [years, setYears] = useState(8);
  const [initial, setInitial] = useState(0);
  const [level, setLevel] = useState("moderate");
  const [chance, setChance] = useState("50");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inputs = useDebounced(JSON.stringify({ target, years, initial_amount: initial, risk_level: level }));

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api.goalCalculator(JSON.parse(inputs))
      .then((r) => alive && setResult(r))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [inputs]);

  const monthly = result ? result[`monthly_for_${chance}_percent`] : null;
  const shown = useCountUp(monthly, 700);
  const cash = result?.monthly_without_growth ?? 0;
  const saved = result ? Math.max(0, cash - monthly) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className={`${card} flex flex-col gap-4`}>
        <h3 className="font-display text-xl font-bold">Your goal</h3>
        <Slider id="target" label="I want to have" value={target} setValue={setTarget} min={1000} max={500000} step={1000} display={money} />
        <Slider id="years" label="In" value={years} setValue={setYears} min={1} max={40} step={1} display={(v) => `${v} ${v === 1 ? "year" : "years"}`} />
        <Slider id="initial" label="Starting with" value={initial} setValue={setInitial} min={0} max={100000} step={500} display={money} />
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700">Invested like a...</div>
          <Segmented
            label="Portfolio"
            value={level}
            onChange={setLevel}
            options={[["conservative", "Steady Saver"], ["moderate", "Balanced Builder"], ["aggressive", "Growth Seeker"]]}
          />
        </div>
      </div>

      <div className={`${card} flex flex-col gap-5 border-brand-line bg-glow`} aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-brand">{result?.portfolio_name || "Your answer"}</span>
          {loading && <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand" aria-label="Calculating" />}
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        {result && (
          <>
            {initial >= target ? (
              <div>
                <div className="font-display text-4xl font-bold tracking-tight text-brand">You&rsquo;ve already reached this goal!</div>
                <div className="mt-2 text-muted">Your starting {money(initial)} is already more than {money(target)}. Try a bigger goal.</div>
              </div>
            ) : monthly <= 0 ? (
              <div>
                <div className="font-display text-4xl font-bold tracking-tight text-brand">No monthly saving needed</div>
                <div className="mt-2 text-muted">Invested like this, your {money(initial)} could grow to {money(target)} in {years} {years === 1 ? "year" : "years"} on its own (at this level of certainty).</div>
              </div>
            ) : (
              <div>
                <div className="text-muted">Save about</div>
                <div className="font-display text-6xl font-bold tracking-tight tabular-nums">
                  {money(shown)}
                  <span className="text-2xl text-muted"> / month</span>
                </div>
                <div className="mt-1 text-muted">to reach {money(target)} in {years} {years === 1 ? "year" : "years"}.</div>
              </div>
            )}
            <div>
              <div className="mb-2 text-sm text-slate-700">How sure do you want to be?</div>
              <Segmented label="Certainty" value={chance} onChange={setChance} options={[["50", "50% chance"], ["75", "75% chance"], ["90", "90% chance"]]} />
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-ink p-4">
              {[
                ["Investing", monthly, "var(--color-brand)"],
                ["Just saving cash", cash, "var(--color-dim)"],
              ].map(([label, value, color]) => (
                <div key={label}>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">{label}</span>
                    <span className="font-semibold">{money(value)} / month</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${cash ? Math.min(100, (value / cash) * 100) : 0}%`, background: color }} />
                  </div>
                </div>
              ))}
            </div>
            {saved > 0 && (
              <p className="text-slate-700">
                Investing could save you about <span className="font-semibold text-brand">{money(saved)} a month</span> compared with keeping it in cash.
              </p>
            )}
            <p className="text-xs text-slate-500">{result.disclaimer}</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Compare ---------------- */

const PRESETS = [
  ["Big Tech", ["AAPL", "MSFT", "GOOGL", "NVDA"]],
  ["Funds", ["VOO", "QQQ", "BND"]],
  ["Drinks", ["KO", "PEP"]],
  ["Banks & cards", ["JPM", "V", "MA"]],
];

function Compare({ stocks }) {
  const [picks, setPicks] = useState(["AAPL", "MSFT", "VOO"]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const key = useDebounced(picks.join(","), 350);

  useEffect(() => {
    const list = key.split(",").filter(Boolean);
    if (list.length < 2) {
      setResult(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    api.compare(list)
      .then((r) => alive && setResult(r))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [key]);

  const ranked = result ? [...result.symbols].sort((a, b) => result.series.at(-1)[b] - result.series.at(-1)[a]) : [];
  const colorOf = (s) => SERIES_COLORS[picks.indexOf(s) % SERIES_COLORS.length];

  return (
    <div className="flex flex-col gap-6">
      <div className={`${card} flex flex-col gap-5`}>
        <div className="flex flex-wrap items-center gap-2.5">
          {picks.map((s, i) => (
            <span key={s} className="flex items-center gap-2 rounded-full border border-line bg-ink py-1.5 pl-3 pr-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
              <span className="font-semibold">{s}</span>
              <button
                onClick={() => setPicks(picks.filter((p) => p !== s))}
                aria-label={`Remove ${s}`}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-slate-100 hover:text-fg"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" {...STROKE}><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </span>
          ))}
          {picks.length < 4 && (
            <SymbolSearch
              size="sm"
              className="w-56"
              label="Add a stock to the race"
              placeholder="+ Add a stock…"
              exclude={picks}
              onSelect={(item) => setPicks((p) => (p.includes(item.symbol) ? p : [...p, item.symbol].slice(0, 4)))}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Try a matchup:</span>
          {PRESETS.map(([label, list]) => (
            <button key={label} onClick={() => setPicks(list)} className="rounded-full border border-line px-3.5 py-1.5 text-sm text-muted transition hover:border-slate-300 hover:text-fg">
              {label}
            </button>
          ))}
        </div>
        {picks.length < 2 && <p className="text-sm text-muted">Pick at least two to start the race.</p>}
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      {result && (
        <div className={`flex flex-col gap-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ranked.map((s, i) => (
              <div
                key={s}
                style={{ animationDelay: `${i * 70}ms` }}
                className={`rounded-3xl border p-5 motion-safe:animate-[sw-rise_0.4s_ease-out_both] ${i === 0 ? "border-brand bg-brand/5" : "border-line bg-surface"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: colorOf(s) }} />
                    <span className="font-semibold">{s}</span>
                  </span>
                  <span className={`font-display text-sm font-bold ${i === 0 ? "text-brand" : "text-muted"}`}>{i === 0 ? "Winner" : `#${i + 1}`}</span>
                </div>
                <div className="mt-3 text-xs text-muted">$100 became</div>
                <div className="font-display text-3xl font-bold tabular-nums">{money(result.series.at(-1)[s])}</div>
                <div className="mt-1 text-sm text-muted">{percent(result.stats[s].annual_return)} a year</div>
              </div>
            ))}
          </div>

          <div className={card}>
            <h3 className="font-display text-xl font-bold">Growth of $100 since {monthName(result.series[0].month)}</h3>
            <div className="mt-5">
              <MultiLineChart data={result.series} lines={result.symbols.map((s) => ({ key: s, name: s, color: colorOf(s) }))} format={(v) => money(v)} />
            </div>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-line bg-surface">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-ink text-muted">
                <tr>
                  <th className="px-5 py-3.5 font-medium">Ticker</th>
                  <th className="px-5 py-3.5 text-right font-medium">Avg yearly return</th>
                  <th className="px-5 py-3.5 text-right font-medium">Volatility (swings)</th>
                  <th className="px-5 py-3.5 text-right font-medium">Biggest drop</th>
                  <th className="px-5 py-3.5 text-right font-medium">Worst 12 months</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((s) => {
                  const st = result.stats[s];
                  return (
                    <tr key={s} className="border-t border-line">
                      <td className="px-5 py-3.5 font-semibold">
                        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(s) }} />{s}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">{percent(st.annual_return)}</td>
                      <td className="px-5 py-3.5 text-right">{percent(st.annual_volatility)}</td>
                      <td className="px-5 py-3.5 text-right text-red-600">{percent(st.max_drawdown)}</td>
                      <td className="px-5 py-3.5 text-right">{percent(st.worst_12_months)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
