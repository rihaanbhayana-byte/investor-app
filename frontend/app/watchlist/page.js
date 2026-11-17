"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SymbolSearch from "@/components/SymbolSearch";
import Sparkline from "@/components/Sparkline";
import StarButton from "@/components/StarButton";
import { Avatar } from "@/components/ui";
import { api } from "@/lib/api";
import { askCoach, setPageContext } from "@/lib/coach";
import { price as fmtPrice } from "@/lib/format";
import { addToWatchlist, useWatchlist } from "@/lib/watchlist";

const STARTERS = ["VOO", "AAPL", "MSFT", "NVDA", "KO", "QQQ"];
const SORTS = {
  added: { label: "Recently added", fn: () => 0 },
  day: { label: "Today’s move", fn: (a, b) => Math.abs(b.change_1d ?? 0) - Math.abs(a.change_1d ?? 0) },
  year: { label: "1-year change", fn: (a, b) => (b.return_1y ?? -9) - (a.return_1y ?? -9) },
  since: { label: "Since I added it", fn: (a, b) => (b.since ?? -9) - (a.since ?? -9) },
};

function Change({ value }) {
  if (value == null) return <span className="text-muted">–</span>;
  if (Math.abs(value) < 0.0005) return <span className="tabular-nums text-muted">0.0%</span>;
  return <span className={`font-semibold tabular-nums ${value >= 0 ? "text-gain" : "text-loss"}`}>{value >= 0 ? "+" : "−"}{(Math.abs(value) * 100).toFixed(1)}%</span>;
}

export default function WatchlistPage() {
  const { items, ready, signedIn, error } = useWatchlist();
  const [quotes, setQuotes] = useState({});
  const [owned, setOwned] = useState(new Set());
  const [sort, setSort] = useState("added");
  const [addError, setAddError] = useState("");

  const key = items.map((i) => i.symbol).sort().join(",");
  useEffect(() => {
    if (!key) return;
    api.quotes(key.split(",")).then((list) => setQuotes(Object.fromEntries(list.map((q) => [q.symbol, q])))).catch(() => {});
  }, [key]);
  useEffect(() => {
    if (signedIn) api.practice().then((p) => setOwned(new Set(p.holdings.map((h) => h.symbol)))).catch(() => {});
  }, [signedIn]);

  const rows = useMemo(() => {
    const list = items.map((i) => {
      const q = quotes[i.symbol];
      return { ...i, ...(q || {}), loaded: Boolean(q), since: q && i.added_price ? q.price / Number(i.added_price) - 1 : null };
    });
    return sort === "added" ? list : [...list].sort(SORTS[sort].fn);
  }, [items, quotes, sort]);

  useEffect(() => {
    setPageContext(key ? `Watchlist page. Stocks they follow: ${key.replaceAll(",", ", ")}` : "Watchlist page (empty)");
    return () => setPageContext("");
  }, [key]);

  async function add(symbol) {
    setAddError("");
    try {
      await addToWatchlist(symbol);
    } catch (e) {
      setAddError(e.message);
    }
  }

  if (ready && !signedIn)
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-3xl border border-line bg-surface p-10 text-center">
        <span className="text-4xl" aria-hidden="true">☆</span>
        <h1 className="text-2xl font-bold">Your watchlist</h1>
        <p className="text-muted">Follow stocks and funds you&rsquo;re curious about, before you put any money in. Log in to start one.</p>
        <Link href="/login?next=/watchlist" className="rounded-xl bg-brand px-6 py-3 font-semibold text-brand-ink">Log in or sign up</Link>
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Watchlist</h1>
          <p className="mt-1 text-muted">Stocks and funds you&rsquo;re following. Watching is free, and a great way to learn how prices move.</p>
        </div>
        {items.length > 1 && (
          <button
            type="button"
            onClick={() => askCoach(`Compare the stocks on my watchlist (${key.replaceAll(",", ", ")}) in simple words: which are riskier, which are steadier, and how they'd fit a beginner's plan.`)}
            className="flex items-center gap-2 rounded-xl border border-brand-line bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand transition hover:border-brand"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" /></svg>
            Ask AI to compare them
          </button>
        )}
      </div>

      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

      <section className="rounded-3xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center gap-3">
          <SymbolSearch label="Add a stock or fund to your watchlist" placeholder="Add any US stock or fund…" exclude={items.map((i) => i.symbol)} onSelect={(item) => add(item.symbol)} className="min-w-0 flex-1" />
          {items.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted">
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg">
                {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
          )}
        </div>
        {addError && <p className="mt-2 text-sm text-red-600" role="alert">{addError}</p>}
      </section>

      {!ready ? (
        <div className="h-64 animate-pulse rounded-3xl bg-surface-2" />
      ) : items.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-line-strong bg-surface p-8 text-center">
          <h2 className="text-lg font-bold">Nothing here yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">Search above, or tap ☆ Watch on any stock page. Not sure where to start? Popular with beginners:</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {STARTERS.map((s) => (
              <button key={s} type="button" onClick={() => add(s)} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold transition hover:border-brand hover:text-brand">
                + {s}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-line bg-surface">
          <div className="hidden grid-cols-[minmax(0,2fr)_110px_100px_90px_90px_110px_40px] items-center gap-3 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted md:grid">
            <span>Name</span><span>30 days</span><span className="text-right">Price</span><span className="text-right">Today</span><span className="text-right">1 year</span><span className="text-right">Since added</span><span />
          </div>
          <ul>
            {rows.map((r) => (
              <li key={r.symbol} className="border-b border-line last:border-0">
                <Link href={`/stocks/${r.symbol}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-5 py-3.5 transition hover:bg-surface-2 md:grid-cols-[minmax(0,2fr)_110px_100px_90px_90px_110px_40px]">
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar symbol={r.symbol} size={38} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold">{r.symbol}</span>
                        {owned.has(r.symbol) && <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand">Owned</span>}
                      </span>
                      <span className="block truncate text-sm text-muted">{r.name || "Loading…"}</span>
                    </span>
                  </span>
                  <span className="hidden md:block"><Sparkline values={r.spark} label={`${r.symbol} over 30 days`} /></span>
                  <span className="text-right font-semibold tabular-nums">{r.loaded ? fmtPrice(r.price) : "–"}</span>
                  <span className="hidden text-right text-sm md:block"><Change value={r.change_1d} /></span>
                  <span className="hidden text-right text-sm md:block"><Change value={r.return_1y} /></span>
                  <span className="hidden text-right text-sm md:block"><Change value={r.since} /></span>
                  <span className="col-start-2 row-start-1 hidden justify-self-end md:col-start-auto md:row-start-auto md:block"><StarButton symbol={r.symbol} size="sm" /></span>
                  <span className="col-span-2 flex items-center justify-between gap-3 text-xs text-muted md:hidden">
                    <span>Today <Change value={r.change_1d} /> · 1y <Change value={r.return_1y} /></span>
                    <StarButton symbol={r.symbol} size="sm" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-muted">Prices are daily closes from Alpaca, updated every night. &ldquo;Since added&rdquo; uses the price on the day you starred it. Educational only, not financial advice.</p>
    </div>
  );
}
