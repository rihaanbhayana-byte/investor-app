"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import CandleChart from "./CandleChart";
import Sparkline from "../Sparkline";
import StarButton from "../StarButton";
import ThemeToggle from "../ThemeToggle";
import { Avatar } from "../ui";
import { api } from "@/lib/api";
import { askCoach } from "@/lib/coach";
import { money, price as fmtPrice } from "@/lib/format";
import { addToWatchlist } from "@/lib/watchlist";

export const card = "rounded-2xl border border-line bg-surface";

const signed = (x, digits = 1) => `${x >= 0 ? "+" : "−"}${(Math.abs(x) * 100).toFixed(digits)}%`;
const tone = (x) => (x >= 0 ? "text-gain" : "text-loss");

function Pill({ children, kind = "gain" }) {
  const cls = {
    gain: "bg-gain-soft text-gain",
    loss: "bg-red-50 text-loss",
    brand: "bg-brand-soft text-brand",
  }[kind];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

/* ------------------------------------------------------------------ */
/* Top bar: greeting, search-or-ask box, theme, who you are           */
/* ------------------------------------------------------------------ */

function OmniSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  // ⌘K / Ctrl+K jumps here from anywhere on the dashboard
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 1) return setResults([]);
    const t = setTimeout(() => api.search(text).then((r) => setResults(r.slice(0, 5))).catch(() => setResults([])), 180);
    return () => clearTimeout(t);
  }, [q]);

  const text = q.trim();
  const exact = results.find((r) => r.symbol.toLowerCase() === text.toLowerCase());
  // options: stocks first when you typed a ticker, otherwise "Ask AI" first
  const options = text
    ? exact
      ? [{ kind: "stock", ...exact }, { kind: "ask" }, ...results.filter((r) => r !== exact).map((r) => ({ kind: "stock", ...r }))]
      : [{ kind: "ask" }, ...results.map((r) => ({ kind: "stock", ...r }))]
    : [];

  function choose(o) {
    if (!o) return;
    setOpen(false);
    setQ("");
    if (o.kind === "ask") askCoach(text);
    else router.push(`/stocks/${o.symbol}`);
  }

  return (
    <div className="relative w-full sm:w-80">
      <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, options.length - 1)));
          else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
          else if (e.key === "Enter") (e.preventDefault(), choose(options[active]));
          else if (e.key === "Escape") setOpen(false);
        }}
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls="omni-list"
        aria-label="Search a stock or ask the AI"
        placeholder="Search any stock or ask AI…"
        maxLength={300}
        className="h-10 w-full rounded-xl border border-line bg-surface pl-10 pr-12 text-sm text-fg placeholder:text-slate-500 focus:border-brand focus:outline-none"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line px-1.5 text-[10px] font-semibold text-muted sm:block">⌘K</kbd>
      {open && options.length > 0 && (
        <ul id="omni-list" role="listbox" className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-float">
          {options.map((o, i) => (
            <li key={o.kind === "ask" ? "ask" : o.symbol} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm ${i === active ? "bg-surface-2" : ""}`}
              >
                {o.kind === "ask" ? (
                  <>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" /></svg>
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      Ask Seedwise AI: <span className="font-semibold">&ldquo;{text}&rdquo;</span>
                    </span>
                  </>
                ) : (
                  <>
                    <Avatar symbol={o.symbol} size={28} />
                    <span className="font-semibold">{o.symbol}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">{o.name}</span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TopBar({ name, fullName, personality }) {
  const [today, setToday] = useState({ date: "", hello: "Welcome back" }); // the clock is read in the browser, not at build time
  useEffect(() => {
    const h = new Date().getHours();
    setToday({
      date: new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }),
      hello: h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening",
    });
  }, []);
  const initials = (fullName || name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="min-h-5 text-sm text-muted">{today.date}</div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{today.hello}{name ? `, ${name}` : ""}</h1>
      </div>
      <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
        <OmniSearch />
        <span className="hidden sm:block"><ThemeToggle /></span>
        <div className="hidden items-center gap-2.5 md:flex">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{initials}</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold">{fullName || name}</span>
            <span className="block text-xs text-muted">{personality || "No plan yet"}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI cards                                                          */
/* ------------------------------------------------------------------ */

// Your portfolio's value over the last ~30 days, rebuilt from today's holdings and real daily closes.
export function portfolioSeries(practice, quotes) {
  if (!practice?.holdings?.length) return [];
  const sparks = practice.holdings.map((h) => quotes[h.symbol]?.spark || []);
  const n = Math.min(...sparks.map((s) => s.length));
  if (n < 2) return [];
  return Array.from({ length: n }, (_, i) => practice.cash + practice.holdings.reduce((sum, h, k) => sum + h.shares * sparks[k][sparks[k].length - n + i], 0));
}

function Kpi({ label, value, sub, pill, children }) {
  return (
    <div className={`${card} flex min-w-0 flex-col gap-1 p-4`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        {pill}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-bold tracking-tight tabular-nums">{value}</span>
        {children}
      </div>
      <span className="truncate text-xs text-muted">{sub}</span>
    </div>
  );
}

export const BADGES = [
  { id: "planner", name: "Planner", how: "Build your first plan", href: "/plan" },
  { id: "first-trade", name: "First trade", how: "Make a practice trade", href: "/practice" },
  { id: "watcher", name: "Watcher", how: "Star a stock to follow it", href: "/stocks" },
  { id: "diversified", name: "Diversified", how: "Hold 5 or more investments", href: "/practice" },
  { id: "checkup", name: "Check-up", how: "Run the Portfolio Doctor", href: "/practice" },
  { id: "student", name: "Student", how: "Finish a Learn lesson", href: "/learn" },
  { id: "curious", name: "Curious", how: "Ask the AI a question", ask: true },
];

function BadgesKpi({ earned }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  const done = BADGES.filter((b) => earned[b.id]);
  const next = BADGES.find((b) => !earned[b.id]);
  return (
    <div ref={ref} className="relative min-w-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`${card} flex w-full min-w-0 flex-col gap-1 p-4 text-left transition hover:border-brand/50`}>
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted">Badges earned</span>
          {next ? <Pill kind="brand">Next: {next.name}</Pill> : <Pill>All done</Pill>}
        </div>
        <div className="flex w-full items-end justify-between gap-2">
          <span className="text-2xl font-bold tracking-tight">{done.length} of {BADGES.length}</span>
          <span className="mb-1.5 flex gap-1" aria-hidden="true">
            {BADGES.map((b) => <span key={b.id} className={`h-2 w-2 rounded-full ${earned[b.id] ? "bg-brand" : "bg-surface-2 ring-1 ring-line"}`} />)}
          </span>
        </div>
        <span className="truncate text-xs text-muted">{next ? `${next.how} to unlock` : "You've earned every badge"}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(320px,90vw)] rounded-2xl border border-line bg-surface p-2 shadow-float">
          <div className="px-2.5 pb-1 pt-1.5 text-sm font-bold">Your badges</div>
          <ul>
            {BADGES.map((b) => {
              const body = (
                <>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${earned[b.id] ? "bg-brand text-white" : "border border-line-strong text-muted"}`} aria-hidden="true">{earned[b.id] ? "✓" : ""}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{b.name}{earned[b.id] && <span className="sr-only"> (earned)</span>}</span>
                    <span className="block text-xs text-muted">{b.how}</span>
                  </span>
                  {!earned[b.id] && <span className="text-xs font-semibold text-brand">Go →</span>}
                </>
              );
              const cls = "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-surface-2";
              return (
                <li key={b.id}>
                  {b.ask ? (
                    <button type="button" className={cls} onClick={() => (setOpen(false), askCoach())}>{body}</button>
                  ) : (
                    <Link href={b.href} className={cls}>{body}</Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function KpiRow({ practice, quotes, earned }) {
  if (!practice) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className={`${card} h-[104px] animate-pulse`} />)}</div>;
  const start = practice.start_cash || 10000;
  const mine = practice.total / start - 1;
  const sp = practice.sp500_value != null ? practice.sp500_value / start - 1 : null;
  const pts = sp != null ? (mine - sp) * 100 : null;
  const series = portfolioSeries(practice, quotes);
  const voo = quotes.VOO?.spark || [];
  const n = Math.min(series.length, voo.length);
  const gap = n > 1 ? series.slice(-n).map((v, i) => v / series[series.length - n] - voo[voo.length - n + i] / voo[voo.length - n]) : [];
  const cashShare = practice.total ? practice.cash / practice.total : 1;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Portfolio value" value={money(practice.total)} sub={`${practice.gain >= 0 ? "+" : "−"}${money(Math.abs(practice.gain))} since you started`} pill={<Pill kind={mine >= 0 ? "gain" : "loss"}>{signed(mine, 2)}</Pill>}>
        <Sparkline values={series} width={84} height={30} label="Your practice portfolio over 30 days" />
      </Kpi>
      <Kpi
        label="vs the S&P 500"
        value={pts == null || practice.trade_count === 0 ? "–" : `${pts >= 0 ? "+" : "−"}${Math.abs(pts).toFixed(1)} pts`}
        sub={sp == null ? "Comparing once prices are in" : `S&P 500 is ${signed(sp, 2)} in the same time`}
        pill={pts == null || practice.trade_count === 0 ? null : Math.abs(pts) < 0.05 ? <Pill kind="brand">Even</Pill> : <Pill kind={pts >= 0 ? "gain" : "loss"}>{pts >= 0 ? "Ahead" : "Behind"}</Pill>}
      >
        <Sparkline values={gap} width={84} height={30} label="Your lead or gap versus the S&P 500" />
      </Kpi>
      <Kpi label="Cash to invest" value={money(practice.cash)} sub={cashShare > 0.25 ? "Uninvested money doesn't grow" : "Most of your money is invested"} pill={<Pill kind={cashShare > 0.25 ? "loss" : "gain"}>{Math.round(cashShare * 100)}%</Pill>}>
        <span className="mb-2 h-1.5 w-[84px] overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <span className="block h-full rounded-full bg-brand" style={{ width: `${(1 - cashShare) * 100}%` }} />
        </span>
      </Kpi>
      <BadgesKpi earned={earned} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Big chart card                                                     */
/* ------------------------------------------------------------------ */

const RANGES = ["1M", "6M", "1Y", "5Y", "ALL"];

export function FeaturedChart({ symbol, reason }) {
  const [range, setRange] = useState("1Y");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!symbol) return;
    let stop = false;
    setError("");
    api.candles(symbol, range).then((d) => !stop && setData(d)).catch((e) => !stop && setError(e.message));
    return () => {
      stop = true;
    };
  }, [symbol, range]);

  const ready = data && data.symbol === symbol;
  return (
    <section className={`${card} flex min-w-0 flex-col gap-4 p-5`} aria-labelledby="chart-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar symbol={symbol} size={40} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h2 id="chart-title" className="truncate text-base font-bold">{ready ? data.name : symbol}</h2>
              <span className="text-xs text-muted">{symbol} · {ready && data.asset_type === "etf" ? "Fund" : "Stock"}</span>
            </div>
            {ready && data.price != null ? (
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-2xl font-bold tabular-nums">{fmtPrice(data.price)}</span>
                {data.change_1d != null && (
                  <span className={`text-sm font-semibold tabular-nums ${tone(data.change_1d)}`}>
                    {data.change_1d >= 0 ? "+" : "−"}${Math.abs(data.change_1d).toFixed(2)} ({signed(data.change_1d_pct, 2)})
                  </span>
                )}
                <span className="text-xs text-muted">Close · {new Date(data.as_of + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              </div>
            ) : (
              <div className="mt-1 h-7 w-40 animate-pulse rounded bg-surface-2" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Time range" className="flex rounded-xl border border-line bg-surface-2 p-0.5">
            {RANGES.map((r) => (
              <button key={r} role="tab" aria-selected={range === r} type="button" onClick={() => setRange(r)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${range === r ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg"}`}>
                {r === "ALL" ? "All" : r}
              </button>
            ))}
          </div>
          <StarButton symbol={symbol} size="sm" />
        </div>
      </div>

      {error ? (
        <p className="flex h-[280px] items-center justify-center text-sm text-muted">{error}</p>
      ) : ready && data.range === range ? (
        <CandleChart bars={data.bars} group={data.group} />
      ) : (
        <div className="h-[280px] animate-pulse rounded-xl bg-surface-2" />
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <Link href={`/practice?symbol=${symbol}`} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition hover:bg-brand-light">Practice trade</Link>
        <button type="button" onClick={() => askCoach(`Explain ${symbol} simply: what does it do, how has its price moved, and how risky is it for a beginner?`)} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold transition hover:border-brand hover:text-brand">
          Explain {symbol} simply
        </button>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-gain" aria-hidden="true" />
          {reason} · Prices from Alpaca, updated nightly
        </span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Movers / Watchlist tabs                                            */
/* ------------------------------------------------------------------ */

export function MoversCard({ movers, watch, quotes, watchReady }) {
  const [tab, setTab] = useState("movers");
  const rows = tab === "movers" ? movers : watch;
  return (
    <section className={`${card} flex min-w-0 flex-col p-5`} aria-label="Stocks to look at">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div role="tablist" className="flex gap-4">
          {[
            ["movers", "Biggest movers · 1y"],
            ["watch", `Watchlist${watch.length ? ` (${watch.length})` : ""}`],
          ].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)} className={`border-b-2 pb-1 text-sm font-bold transition ${tab === id ? "border-brand text-fg" : "border-transparent text-muted hover:text-fg"}`}>
              {label}
            </button>
          ))}
        </div>
        <Link href={tab === "movers" ? "/stocks" : "/watchlist"} className="text-xs font-semibold text-brand">{tab === "movers" ? "All stocks" : "Open"}</Link>
      </div>
      {tab === "watch" && watchReady && watch.length === 0 ? (
        <div className="flex flex-col gap-3 py-2">
          <p className="text-sm text-muted">Follow stocks before you invest in them. Tap to add:</p>
          <div className="flex flex-wrap gap-2">
            {["VOO", "AAPL", "NVDA", "KO"].map((s) => (
              <button key={s} type="button" onClick={() => addToWatchlist(s).catch(() => {})} className="rounded-xl border border-line px-3 py-1.5 text-sm font-semibold transition hover:border-brand hover:text-brand">+ {s}</button>
            ))}
          </div>
        </div>
      ) : rows === null || (tab === "watch" && !watchReady) ? (
        [0, 1, 2, 3, 4].map((i) => <div key={i} className="mb-2 h-11 animate-pulse rounded-xl bg-surface-2" />)
      ) : (
        <ul className="flex flex-col">
          {rows.slice(0, 6).map((s) => {
            const q = quotes[s.symbol] || {};
            const change = tab === "movers" ? s.return_1y : q.change_1d;
            return (
              <li key={s.symbol}>
                <Link href={`/stocks/${s.symbol}`} className="flex items-center gap-3 rounded-xl px-1.5 py-2 transition hover:bg-surface-2">
                  <Avatar symbol={s.symbol} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{s.symbol}</span>
                    <span className="block truncate text-xs text-muted">{s.name || q.name}</span>
                  </span>
                  <Sparkline values={q.spark} width={60} height={24} label={`${s.symbol}, last 30 days`} />
                  <span className="w-[74px] text-right">
                    <span className="block text-sm font-semibold tabular-nums">{fmtPrice(q.price ?? s.latest_price)}</span>
                    {change != null && Math.abs(change) >= 0.0005 && <span className={`block text-xs font-semibold tabular-nums ${tone(change)}`}>{signed(change)}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {tab === "watch" && watch.length > 0 && <p className="mt-auto pt-2 text-[11px] text-muted">Change shown is today&rsquo;s move.</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Practice holdings row                                              */
/* ------------------------------------------------------------------ */

export function HoldingsRow({ practice, quotes }) {
  if (!practice) return null;
  const list = practice.holdings || [];
  return (
    <section aria-labelledby="holdings-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id="holdings-title" className="text-base font-bold">Practice portfolio</h2>
        <Link href="/practice" className="text-xs font-semibold text-brand">{list.length > 4 ? `See all ${list.length}` : "Open Practice"}</Link>
      </div>
      {list.length === 0 ? (
        <div className={`${card} flex flex-wrap items-center justify-between gap-4 p-5`}>
          <div>
            <div className="font-semibold">You have {money(practice.cash)} of play money</div>
            <div className="text-sm text-muted">Try your plan risk-free. Real prices, no real money.</div>
          </div>
          <Link href="/practice" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink">Make your first trade</Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {list.slice(0, 4).map((h) => {
            const share = practice.total ? h.value / practice.total : 0;
            return (
              <Link key={h.symbol} href={`/stocks/${h.symbol}`} className={`${card} flex min-w-0 flex-col gap-3 p-4 transition hover:border-brand/50`}>
                <div className="flex items-center gap-2.5">
                  <Avatar symbol={h.symbol} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{h.symbol}</span>
                    <span className="block truncate text-xs text-muted">{h.name}</span>
                  </span>
                  <Sparkline values={quotes[h.symbol]?.spark} width={56} height={24} label={`${h.symbol}, last 30 days`} />
                </div>
                <div className="flex items-end justify-between">
                  <span>
                    <span className="block text-[11px] text-muted">Value</span>
                    <span className="text-lg font-bold tabular-nums">{money(h.value)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[11px] text-muted">Return</span>
                    <span className={`text-sm font-semibold tabular-nums ${Math.abs(h.gain_pct) < 0.0005 ? "text-muted" : tone(h.gain_pct)}`}>{Math.abs(h.gain_pct) < 0.0005 ? "0.0%" : signed(h.gain_pct)}</span>
                  </span>
                </div>
                <div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${share * 100}%` }} /></div>
                  <div className="mt-1.5 text-[11px] text-muted">{Math.round(share * 100)}% of your portfolio</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* My plan + Portfolio Doctor                                         */
/* ------------------------------------------------------------------ */

export function PlanSummary({ plan, latest }) {
  if (plan === undefined) return <div className={`${card} h-52 animate-pulse`} />;
  if (!plan)
    return (
      <section className={`${card} flex flex-col items-start gap-3 p-5`}>
        <h2 className="text-base font-bold">My plan</h2>
        {latest ? (
          <>
            <p className="text-sm text-muted">Your latest saved plan: <span className="font-semibold text-fg">{latest.goal}</span>, {money(latest.initial_amount)} + {money(latest.monthly_contribution)}/month for {latest.horizon_years} years.</p>
            <Link href={`/plan?id=${latest.id}`} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink">See its projection →</Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">Tell the AI your goal and get a plan in about 2 minutes.</p>
            <Link href="/plan" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink">Build my plan →</Link>
          </>
        )}
      </section>
    );
  const f = plan.projected_final || {};
  const chance = f.odds?.more_than_put_in;
  return (
    <section className={`${card} flex flex-col gap-4 p-5`} aria-labelledby="plan-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="plan-title" className="text-base font-bold">My plan · {plan.goal}</h2>
        <Pill kind="brand">{plan.portfolio}</Pill>
      </div>
      <div className="flex flex-wrap gap-8">
        <div>
          <div className="text-xs text-muted">Likely value in {plan.years} year{plan.years === 1 ? "" : "s"}</div>
          <div className="text-[28px] font-bold tracking-tight tabular-nums">{f.median != null ? money(f.median) : "–"}</div>
        </div>
        <div>
          <div className="text-xs text-muted">You put in</div>
          <div className="text-[28px] font-bold tracking-tight tabular-nums text-muted">{f.contributed != null ? money(f.contributed) : "–"}</div>
        </div>
      </div>
      {chance != null && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <span className="font-semibold">How likely is this?</span>
            <span className="text-muted">{Math.round(chance * 100)}% of 5,000 futures end above what you put in</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${chance * 100}%` }} /></div>
        </div>
      )}
      <div className="flex flex-wrap gap-x-1.5 text-xs font-semibold text-brand">
        <Link href="/plan" className="hover:underline">Why? · Based on · How we measured it</Link>
        <span className="text-muted">·</span>
        <button type="button" onClick={() => askCoach("Explain my plan in simple words")} className="hover:underline">Ask AI to explain it</button>
      </div>
    </section>
  );
}

export const DOCTOR_CACHE = "seedwise-doctor-last";
const CHECK_ICON = { good: ["✓", "bg-gain-soft text-gain"], ok: ["!", "bg-amber-50 text-amber-600"], warn: ["!", "bg-red-50 text-loss"] };
const GRADE_TONE = { A: "text-gain border-gain", B: "text-brand border-brand", C: "text-amber-600 border-amber-500", D: "text-loss border-loss", F: "text-loss border-loss" };

export function DoctorSummary({ practice }) {
  const [report, setReport] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      setReport(JSON.parse(localStorage.getItem(DOCTOR_CACHE) || "null"));
    } catch {
      setReport(null);
    }
  }, []);
  async function run() {
    setBusy(true);
    setError("");
    let risk = null;
    try {
      risk = JSON.parse(localStorage.getItem("lastPlan") || "null")?.risk_level ?? null;
    } catch {}
    try {
      const r = await api.practiceDoctor(risk);
      const slim = { grade: r.grade, score: r.score, checks: r.checks, at: new Date().toISOString() };
      localStorage.setItem(DOCTOR_CACHE, JSON.stringify(slim));
      localStorage.setItem("seedwise-doctor-done", "true");
      window.dispatchEvent(new Event("seedwise:badges"));
      setReport(slim);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }
  const hasHoldings = (practice?.holdings?.length ?? 0) > 0;
  const order = { warn: 0, ok: 1, good: 2 };
  const checks = report?.checks ? [...report.checks].sort((a, b) => order[a.status] - order[b.status]).slice(0, 3) : [];
  return (
    <section className={`${card} flex flex-col gap-4 p-5`} aria-labelledby="doctor-title">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold ${report ? GRADE_TONE[report.grade] : "border-line text-muted"}`}>{report?.grade || "?"}</span>
        <div className="min-w-0 flex-1">
          <h2 id="doctor-title" className="text-base font-bold">Portfolio Doctor</h2>
          <div className="text-xs text-muted">Fixed rules, not AI{report ? ` · ${report.score} / 100` : ""}</div>
        </div>
        {hasHoldings && (
          <button type="button" onClick={run} disabled={busy} className="rounded-xl border border-line px-3.5 py-2 text-xs font-semibold transition hover:border-brand hover:text-brand disabled:opacity-50">
            {busy ? "Checking…" : report ? "Check again" : "Run check-up"}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!hasHoldings ? (
        <p className="text-sm text-muted">Buy something in <Link href="/practice" className="font-semibold text-brand">Practice</Link> and the doctor will grade how spread out and risky it is.</p>
      ) : report === undefined ? null : !report ? (
        <p className="text-sm text-muted">Get a grade and 3 tips for your practice portfolio. Takes a few seconds.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {checks.map((c) => {
            const [icon, cls] = CHECK_ICON[c.status] || CHECK_ICON.ok;
            return (
              <li key={c.name} className="flex items-start gap-2.5 text-sm">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${cls}`} aria-hidden="true">{icon}</span>
                <span className="w-28 shrink-0 font-semibold">{c.name}</span>
                <span className="min-w-0 flex-1 text-muted">{c.detail}</span>
              </li>
            );
          })}
        </ul>
      )}
      {report?.at && <Link href="/practice" className="mt-auto text-xs font-semibold text-brand">See the full check-up and tips →</Link>}
    </section>
  );
}
