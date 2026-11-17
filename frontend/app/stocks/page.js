"use client";

import StarButton from "@/components/StarButton";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import TickerSearch from "@/components/TickerSearch";
import InterestMatcher from "@/components/InterestMatcher";
import StockMap from "@/components/StockMap";
import { Avatar, PageHeader, ReturnPill, RISE, Segmented, Select } from "@/components/ui";
import { percent, price } from "@/lib/format";

const SORTS = [
  ["az", "A to Z"],
  ["best", "Best 1-year return"],
  ["worst", "Worst 1-year return"],
  ["price", "Highest price"],
];

function sortList(list, by) {
  const copy = [...list];
  if (by === "best") return copy.sort((a, b) => (b.return_1y ?? -9) - (a.return_1y ?? -9));
  if (by === "worst") return copy.sort((a, b) => (a.return_1y ?? 9) - (b.return_1y ?? 9));
  if (by === "price") return copy.sort((a, b) => (b.latest_price ?? 0) - (a.latest_price ?? 0));
  return copy.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function StockCard({ s, index }) {
  return (
    <Link
      href={`/stocks/${s.symbol}`}
      style={{ animationDelay: `${Math.min(index, 20) * 25}ms` }}
      className="group flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 transition duration-200 hover:-translate-y-1 hover:border-brand/40 hover:shadow-lift motion-safe:animate-[sw-rise_0.4s_ease-out_both]"
    >
      <div className="flex items-center gap-3">
        <Avatar symbol={s.symbol} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{s.symbol}</span>
            {s.asset_type === "etf" && <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand">FUND</span>}
          </div>
          <div className="truncate text-sm text-muted">{s.name}</div>
        </div>
        <StarButton symbol={s.symbol} price={s.latest_price} size="sm" />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs text-muted">Price</div>
          <div className="font-display text-2xl font-bold tabular-nums">{price(s.latest_price)}</div>
        </div>
        <div className="text-right">
          <div className="mb-1 text-xs text-muted">1 year</div>
          <ReturnPill value={s.return_1y}>{percent(Math.abs(s.return_1y ?? 0))}</ReturnPill>
        </div>
      </div>
      <div className="text-xs text-slate-500">{s.sector}</div>
    </Link>
  );
}

export default function StocksPage() {
  const [stocks, setStocks] = useState([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [sector, setSector] = useState("all");
  const [sort, setSort] = useState("az");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.stocks()
      .then(setStocks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const sectors = [...new Set(stocks.filter((s) => s.asset_type === "stock").map((s) => s.sector).filter(Boolean))].sort();
  const term = search.trim().toLowerCase();
  const shown = sortList(
    stocks.filter(
      (s) =>
        (type === "all" || s.asset_type === type) &&
        (sector === "all" || s.sector === sector) &&
        (s.symbol.toLowerCase().includes(term) || s.name.toLowerCase().includes(term) || (s.sector || "").toLowerCase().includes(term))
    ),
    sort
  );
  const ranked = stocks.filter((s) => s.return_1y != null);
  const best = [...ranked].sort((a, b) => b.return_1y - a.return_1y).slice(0, 3);
  const worst = [...ranked].sort((a, b) => a.return_1y - b.return_1y)[0];

  return (
    <div className="flex flex-col gap-10">
      <style>{RISE}</style>
      <PageHeader eyebrow="Markets" title="Explore stocks & funds" subtitle="Search any US company, or browse 36 beginner-friendly picks with real prices." />

      <TickerSearch />

      <InterestMatcher />

      {best.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-bold">Biggest movers this year</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {best.map((s, i) => (
              <Link
                key={s.symbol}
                href={`/stocks/${s.symbol}`}
                className="relative overflow-hidden rounded-3xl border border-brand-line bg-glow p-5 transition hover:-translate-y-1 hover:border-brand/60"
              >
                <div className="flex items-center justify-between">
                  <Avatar symbol={s.symbol} size={40} />
                  <span className="font-display text-sm font-bold text-brand">#{i + 1}</span>
                </div>
                <div className="mt-4 font-semibold">{s.name}</div>
                <div className="mt-1 font-display text-3xl font-bold text-gain">+{percent(s.return_1y)}</div>
                <div className="text-xs text-muted">over the last 12 months</div>
              </Link>
            ))}
            {worst && (
              <Link
                href={`/stocks/${worst.symbol}`}
                className="rounded-3xl border border-red-200 bg-glow-danger p-5 transition hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <Avatar symbol={worst.symbol} size={40} />
                  <span className="text-xs font-semibold text-red-600">Biggest drop</span>
                </div>
                <div className="mt-4 font-semibold">{worst.name}</div>
                <div className="mt-1 font-display text-3xl font-bold text-red-600">{percent(worst.return_1y)}</div>
                <div className="text-xs text-muted">over the last 12 months</div>
              </Link>
            )}
          </div>
        </section>
      )}

      <StockMap />

      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-xl font-bold">Our beginner-friendly list</h2>
          <Segmented
            label="Type"
            value={type}
            onChange={(v) => {
              setType(v);
              setSector("all");
            }}
            options={[["all", "All"], ["stock", "Stocks"], ["etf", "Funds (ETFs)"]]}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-64 flex-1">
            <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              aria-label="Filter the list"
              placeholder="Filter by name, ticker or sector..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-line bg-ink py-3.5 pl-11 pr-4 text-fg placeholder:text-slate-500 focus:border-brand focus:outline-none"
            />
          </div>
          <Select label="Sort by" value={sort} onChange={setSort} className="w-56">
            {SORTS.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </Select>
        </div>

        {type !== "etf" && sectors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {["all", ...sectors].map((sec) => (
              <button
                key={sec}
                onClick={() => setSector(sec)}
                aria-pressed={sector === sec}
                className={`rounded-full px-3.5 py-2 text-sm transition ${
                  sector === sec ? "bg-fg text-ink" : "border border-line text-muted hover:border-slate-300 hover:text-fg"
                }`}
              >
                {sec === "all" ? "All sectors" : sec}
              </button>
            ))}
          </div>
        )}

        {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-red-700">{error}</p>}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-3xl border border-line bg-surface" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="rounded-3xl border border-line bg-surface p-8 text-center text-muted">Nothing matches. Try another word, or search all companies above.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((s, i) => (
              <StockCard key={s.symbol} s={s} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
