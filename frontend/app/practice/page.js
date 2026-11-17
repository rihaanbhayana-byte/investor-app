"use client";

import SymbolSearch from "@/components/SymbolSearch";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { setPageContext } from "@/lib/coach";
import { supabase } from "@/lib/supabase";
import { money, percent, price } from "@/lib/format";
import PortfolioDoctor from "@/components/PortfolioDoctor";
import { PlanTracker } from "@/components/PlanPractice";
import { Avatar, ReturnPill, RISE, SERIES_COLORS, Segmented, useCountUp } from "@/components/ui";

const QUICK = [100, 500, 1000];

function Badge({ done, title, text, icon }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-4 transition ${done ? "border-brand-line bg-brand-soft" : "border-line bg-surface opacity-60"}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${done ? "bg-brand text-brand-ink" : "bg-slate-100 text-muted"}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {done ? <path d="M5 12l5 5 9-10" /> : icon}
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted">{text}</span>
      </span>
    </div>
  );
}

function LoggedOut() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 rounded-[28px] border border-line bg-surface p-12 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/15 text-brand">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="6" width="18" height="14" rx="2" /><path d="M16 13h2" /><path d="M3 10h18" />
        </svg>
      </span>
      <h1 className="font-display text-4xl font-bold tracking-tight">Invest $10,000 of play money.</h1>
      <p className="max-w-md text-lg text-muted">Buy and sell real stocks and funds at real prices, with zero risk. Can you beat the S&amp;P 500?</p>
      <p className="text-sm text-muted">Log in so we can keep your practice portfolio safe.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/login?mode=signup" className="rounded-xl bg-brand px-6 py-3 font-semibold text-brand-ink transition hover:bg-brand-light">Create a free account</Link>
        <Link href="/login" className="rounded-xl border border-slate-300 px-6 py-3 font-medium transition hover:border-brand hover:text-brand">Log in</Link>
      </div>
    </div>
  );
}

export default function PracticePage() {
  const [tradedSinceCheck, setTradedSinceCheck] = useState(false);
  useEffect(() => {
    setPageContext("Practice portfolio (play money)");
    return () => setPageContext("");
  }, []);
  const [loggedIn, setLoggedIn] = useState(null);
  const [state, setState] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [symbol, setSymbol] = useState("VOO");
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("symbol");
    if (wanted && /^[A-Za-z][A-Za-z.\-]{0,9}$/.test(wanted)) setSymbol(wanted.toUpperCase());
  }, []);
  const [side, setSide] = useState("buy");
  const [dollarsText, setDollarsText] = useState("1000");
  const dollars = Number(dollarsText) || 0;
  const setDollars = (v) => setDollarsText(String(v));
  const [sellAll, setSellAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [quotes, setQuotes] = useState({}); // prices for stocks outside our featured 36
  const total = useCountUp(state?.total ?? null, 900);

  // A stock picked from search that isn't one of our 36: fetch its price (adds it on first use).
  useEffect(() => {
    if (!state || !symbol || quotes[symbol]) return;
    if (stocks.some((s) => s.symbol === symbol) || state.holdings.some((h) => h.symbol === symbol)) return;
    setQuotes((q) => ({ ...q, [symbol]: { loading: true } }));
    api.quote(symbol)
      .then((r) => setQuotes((q) => ({ ...q, [symbol]: r })))
      .catch((e) => setQuotes((q) => ({ ...q, [symbol]: { error: e.message } })));
  }, [symbol, stocks, state, quotes]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const ok = Boolean(data.session);
      setLoggedIn(ok);
      if (!ok) return;
      api.practice().then(setState).catch((e) => setError(e.message));
      api.stocks().then(setStocks).catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  if (loggedIn === false) return <LoggedOut />;
  if (!state)
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-red-700">{error}</p> : null}
        <div className="h-40 animate-pulse rounded-3xl border border-line bg-surface" />
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="h-96 animate-pulse rounded-3xl border border-line bg-surface" />
          <div className="h-96 animate-pulse rounded-3xl border border-line bg-surface" />
        </div>
      </div>
    );

  const stock = stocks.find((s) => s.symbol === symbol);
  const position = state.holdings.find((h) => h.symbol === symbol);
  const quote = quotes[symbol];
  const livePrice = position?.price ?? stock?.latest_price ?? quote?.price;
  const pickedName = stock?.name ?? position?.name ?? quote?.name;
  const maxDollars = side === "buy" ? state.cash : position?.value ?? 0;
  const amount = sellAll ? maxDollars : dollars;
  const tooMuch = !sellAll && amount > maxDollars + 0.005;
  const shares = livePrice ? amount / livePrice : 0;
  const ahead = state.sp500_value != null ? state.total - state.sp500_value : null;
  const etfs = new Set([...stocks, ...Object.values(quotes)].filter((s) => s.asset_type === "etf").map((s) => s.symbol));

  const badges = [
    { title: "First trade", text: "Make your first investment", done: state.trade_count > 0, icon: <path d="M12 5v14M5 12h14" /> },
    { title: "Fund fan", text: "Own an ETF (a whole basket)", done: state.holdings.some((h) => etfs.has(h.symbol)), icon: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></> },
    { title: "Diversified", text: "Hold 5 or more investments", done: state.holdings.length >= 5, icon: <><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6 6" /></> },
    { title: "Fully invested", text: "Less than 5% left in cash", done: state.trade_count > 0 && state.cash < state.total * 0.05, icon: <path d="M3 17l6-6 4 4 8-8" /> },
    { title: "Beat the market", text: "Ahead of the S&P 500", done: state.trade_count > 0 && ahead > 0, icon: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /> },
  ];

  async function trade(e) {
    e.preventDefault();
    if (!amount || amount <= 0 || tooMuch) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.practiceTrade({ symbol, side, dollars: Math.round(amount * 100) / 100, sell_all: side === "sell" && sellAll });
      setState(result);
      setTradedSinceCheck(true);
      setToast(result.message);
      setSellAll(false);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function reset() {
    setBusy(true);
    try {
      setState(await api.practiceReset());
      setToast("Fresh start! You have $10,000 of play money again.");
    } catch (err) {
      setError(err.message);
    }
    setConfirmReset(false);
    setBusy(false);
  }

  const startDate = new Date(state.started_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="flex flex-col gap-8">
      <style>{RISE}</style>

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-brand-line bg-brand-soft px-5 py-3 shadow-2xl motion-safe:animate-[sw-rise_0.3s_ease-out_both]">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-brand-ink">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
          </span>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Practice</h1>
          <p className="mt-1 text-[15px] text-muted">$10,000 of play money at real prices. Nothing here is real, so mistakes are free lessons.</p>
        </div>
        {confirmReset ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Start over with $10,000?</span>
            <button onClick={reset} disabled={busy} className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-ink">Reset</button>
            <button onClick={() => setConfirmReset(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)} className="rounded-xl border border-line px-5 py-2.5 text-sm text-muted transition hover:border-slate-300 hover:text-fg">
            Reset portfolio
          </button>
        )}
      </div>

      <section className="grid grid-cols-1 gap-6 rounded-3xl border border-brand-line bg-glow p-5 sm:p-7 lg:grid-cols-[1.3fr_1fr] [&>*]:min-w-0">
        <div>
          <div className="text-muted">Your portfolio is worth</div>
          <div className="mt-1 font-display text-5xl font-bold tracking-tight tabular-nums sm:text-6xl">{money(total)}</div>
          <div className="mt-3 flex flex-wrap gap-2.5 text-sm">
            <ReturnPill value={state.gain}>
              {money(Math.abs(state.gain))} ({percent(Math.abs(state.gain_pct))})
            </ReturnPill>
            <span className="rounded-xl border border-slate-300 px-3 py-1 text-slate-700">Cash {money(state.cash)}</span>
            <span className="rounded-xl border border-slate-300 px-3 py-1 text-slate-700">Invested {money(state.invested)}</span>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Started {startDate} · Prices as of {state.prices_as_of || "the latest close"} · They update once a day after the market closes.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3 rounded-2xl border border-line bg-ink/70 p-5">
          <div className="text-sm font-semibold">You vs. the S&amp;P 500</div>
          {state.sp500_value != null ? (
            <>
              {[
                ["You", state.total, "var(--color-brand)"],
                ["S&P 500", state.sp500_value, "var(--color-dim)"],
              ].map(([label, value, color]) => (
                <div key={label}>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">{label}</span>
                    <span className="font-semibold">{money(value)}</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(value / Math.max(state.total, state.sp500_value)) * 100}%`, background: color }} />
                  </div>
                </div>
              ))}
              <p className="text-sm">
                {state.trade_count === 0 ? (
                  <span className="text-muted">Make a trade to start the race.</span>
                ) : Math.abs(ahead) < 0.5 ? (
                  <span className="text-muted">You&rsquo;re even with the S&amp;P 500 so far.</span>
                ) : ahead > 0 ? (
                  <span className="font-semibold text-gain">You&rsquo;re ahead by {money(ahead)}!</span>
                ) : (
                  <span className="text-muted">You&rsquo;re {money(-ahead)} behind. Most pros are too!</span>
                )}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">The comparison appears after the next price update.</p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {badges.map((b) => (
          <Badge key={b.title} {...b} />
        ))}
      </section>

      <PlanTracker state={state} onChange={(s) => s && setState(s)} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)] [&>*]:min-w-0">
        <form onSubmit={trade} className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-5 sm:p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-xl font-bold">Make a trade</h2>
          <Segmented label="Buy or sell" value={side} onChange={(v) => { setSide(v); setSellAll(false); if (v === "sell" && state.holdings.length && !position) setSymbol(state.holdings[0].symbol); }} options={[["buy", "Buy"], ["sell", "Sell"]]} />
          {side === "buy" ? (
            <SymbolSearch
              label="Find a stock or fund to buy"
              placeholder="Find a stock or fund to buy…"
              onSelect={(item) => { setSymbol(item.symbol); setSellAll(false); }}
            />
          ) : state.holdings.length ? (
            <div>
              <div className="text-sm font-medium text-slate-700">Pick one you own</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {state.holdings.map((h) => (
                  <button
                    type="button"
                    key={h.symbol}
                    onClick={() => { setSymbol(h.symbol); setSellAll(false); }}
                    aria-pressed={symbol === h.symbol}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${symbol === h.symbol ? "bg-fg text-ink" : "border border-line text-muted hover:border-slate-300 hover:text-fg"}`}
                  >
                    {h.symbol}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-line bg-ink px-4 py-3 text-sm text-muted">You don&rsquo;t own anything yet. Buy something first.</p>
          )}
          {quote?.loading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-ink p-4 text-sm text-muted" role="status">
              <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-brand" aria-hidden="true" />
              Loading {symbol}&rsquo;s prices. The first time takes a few seconds.
            </div>
          ) : quote?.error ? (
            <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{quote.error}</p>
          ) : (
            pickedName && (
              <div className="flex items-center gap-3 rounded-2xl border border-line bg-ink p-4">
                <Avatar symbol={symbol} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{symbol}</div>
                  <div className="truncate text-sm text-muted">{pickedName}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold tabular-nums">{price(livePrice)}</div>
                  {stock?.return_1y != null ? (
                    <ReturnPill value={stock.return_1y}>{percent(Math.abs(stock.return_1y))}</ReturnPill>
                  ) : (
                    <div className="text-xs text-muted">a share</div>
                  )}
                </div>
              </div>
            )
          )}
          <div>
            <label htmlFor="amount" className="text-sm font-medium text-slate-700">Amount</label>
            <div className={`mt-2 flex items-baseline gap-1 rounded-2xl border bg-ink px-4 py-3 ${tooMuch ? "border-red-400" : "border-line focus-within:border-brand"}`}>
              <span className="font-display text-2xl font-bold text-muted">$</span>
              <input
                id="amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={tooMuch}
                value={sellAll ? (Math.floor(maxDollars * 100) / 100).toString() : dollarsText}
                onChange={(e) => {
                  setSellAll(false);
                  // digits and one decimal point only: no minus signs, no letters, no leading zeros
                  let v = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").replace(/^0+(?=\d)/, "");
                  const [whole, cents] = v.split(".");
                  if (cents !== undefined) v = `${whole}.${cents.slice(0, 2)}`;
                  setDollarsText(v);
                }}
                className="w-full bg-transparent font-display text-2xl font-bold tabular-nums [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button key={q} type="button" onClick={() => { setSellAll(false); setDollars(q); }} className="rounded-full border border-line px-3 py-1.5 text-sm text-muted transition hover:border-slate-300 hover:text-fg">
                  {money(q)}
                </button>
              ))}
              <button type="button" onClick={() => { if (side === "sell") setSellAll(true); else setDollars(Math.floor(state.cash * 100) / 100); }} className="rounded-full border border-line px-3 py-1.5 text-sm text-muted transition hover:border-slate-300 hover:text-fg">
                {side === "sell" ? "Sell all" : "Max"}
              </button>
            </div>
          </div>
          {tooMuch ? (
            <p className="text-sm font-medium text-red-600" role="alert">
              {side === "buy" ? `You only have ${money(state.cash)} to spend.` : position ? `You only own ${money(position.value)} of ${symbol}.` : `You don't own any ${symbol} to sell.`}{" "}
              {maxDollars > 0 && (
                <button type="button" onClick={() => (side === "sell" ? setSellAll(true) : setDollars(Math.floor(maxDollars * 100) / 100))} className="font-semibold underline underline-offset-2">
                  Use {money(maxDollars)}
                </button>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted">
              {side === "buy" ? `You have ${money(state.cash)} to spend.` : position ? `You own ${position.shares.toFixed(4)} shares (${money(position.value)}).` : `You don't own any ${symbol} yet.`}
              {amount > 0 && livePrice ? ` ${money(amount)} ≈ ${shares.toFixed(4)} shares.` : ""}
            </p>
          )}
          {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button
            disabled={busy || !amount || amount <= 0 || tooMuch || !livePrice}
            className={`rounded-full py-4 font-semibold transition disabled:opacity-40 ${side === "buy" ? "bg-brand text-brand-ink hover:bg-brand-light" : "bg-gold text-gold-ink hover:opacity-90"}`}
          >
            {busy ? "Placing order..." : `${side === "buy" ? "Buy" : "Sell"} ${money(amount)} of ${symbol}`}
          </button>
        </form>

        <div className="flex flex-col gap-6">
          <section className="rounded-3xl border border-line bg-surface p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-xl font-bold">Your holdings</h2>
              <span className="text-sm text-muted">{state.holdings.length} {state.holdings.length === 1 ? "investment" : "investments"}</span>
            </div>
            <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              {state.holdings.map((h, i) => (
                <div key={h.symbol} style={{ width: `${(h.value / state.total) * 100}%`, background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
              ))}
              <div style={{ width: `${(state.cash / state.total) * 100}%` }} className="bg-line-strong" />
            </div>
            {state.holdings.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <p className="font-semibold">No investments yet</p>
                <p className="mt-1 text-sm text-muted">Tip: many beginners start with VOO, which holds the 500 biggest US companies in one fund.</p>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-2.5">
                {state.holdings.map((h, i) => (
                  <button
                    key={h.symbol}
                    onClick={() => { setSymbol(h.symbol); setSide("sell"); }}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-ink p-3.5 text-left transition hover:border-slate-300 sm:gap-4 sm:p-4 motion-safe:animate-[sw-rise_0.35s_ease-out_both]"
                  >
                    <span className="hidden h-3 w-3 shrink-0 rounded-full sm:block" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                    <Avatar symbol={h.symbol} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{h.symbol}</span>
                      <span className="block truncate text-xs text-muted">{h.shares.toFixed(4)} shares · avg {price(h.average_cost)}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold tabular-nums">{money(h.value)}</span>
                      <span className={`block text-xs font-semibold ${h.gain >= 0 ? "text-gain" : "text-loss"}`}>
                        {h.gain >= 0 ? "+" : "−"}{money(Math.abs(h.gain))} ({percent(Math.abs(h.gain_pct))})
                      </span>
                    </span>
                  </button>
                ))}
                <div className="flex items-center gap-4 rounded-2xl border border-line p-4 text-sm text-muted">
                  <span className="h-3 w-3 shrink-0 rounded-full bg-line-strong" />
                  <span className="flex-1">Cash</span>
                  <span className="font-semibold text-fg">{money(state.cash)}</span>
                </div>
              </div>
            )}
          </section>

          <PortfolioDoctor hasHoldings={state.holdings.length > 0} stale={tradedSinceCheck} onResult={() => setTradedSinceCheck(false)} />

          <section className="rounded-3xl border border-line bg-surface p-6">
            <h2 className="font-display text-xl font-bold">Trade history</h2>
            {state.trades.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Your trades will show up here.</p>
            ) : (
              <ul className="mt-4 flex flex-col divide-y divide-line">
                {state.trades.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-3 text-sm">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${t.side === "buy" ? "bg-brand/10 text-brand" : "bg-gold-soft text-gold"}`}>{t.side}</span>
                    <span className="font-semibold">{t.symbol}</span>
                    <span className="flex-1 truncate text-muted">{t.shares.toFixed(4)} shares at {price(t.price)}</span>
                    <span className="font-semibold tabular-nums">{money(t.shares * t.price)}</span>
                    <span className="hidden w-24 text-right text-xs text-slate-500 sm:block">{new Date(t.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <p className="text-xs text-slate-500">Practice only. No real money is involved and nothing here is financial advice.</p>
    </div>
  );
}
