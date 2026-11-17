"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PriceChart from "@/components/PriceChart";
import AIExplainer from "@/components/AIExplainer";
import { Avatar, ChartTooltip, ReturnPill, RISE, Segmented, monthName } from "@/components/ui";
import { api } from "@/lib/api";
import { setPageContext } from "@/lib/coach";
import StarButton from "@/components/StarButton";
import { bigMoney, percent, price } from "@/lib/format";

const RANGES = [
  ["12", "1Y"],
  ["36", "3Y"],
  ["60", "5Y"],
  ["all", "All"],
];

function Stat({ label, value, hint, tone }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-5">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold ${tone === "up" ? "text-brand" : tone === "down" ? "text-red-600" : ""}`}>{value}</div>
      <div className="mt-1.5 text-xs leading-relaxed text-slate-500">{hint}</div>
    </div>
  );
}

export default function StockPage() {
  const { symbol } = useParams();
  const [stock, setStock] = useState(null);
  const [error, setError] = useState("");
  const [range, setRange] = useState("all");

  useEffect(() => {
    api.stock(symbol)
      .then(setStock)
      .catch(() => api.liveStock(symbol).then(setStock).catch((e) => setError(e.message)));
  }, [symbol]);

  // the AI side panel knows which stock you're looking at
  useEffect(() => {
    if (!stock) return;
    const p = stock.prices?.at(-1)?.close;
    setPageContext(`stock page for ${stock.symbol} (${stock.name})${p ? `, latest monthly close $${p.toFixed(2)}` : ""}`);
    return () => setPageContext("");
  }, [stock]);

  if (error)
    return (
      <div className="rounded-3xl border border-line bg-surface p-10 text-center">
        <h1 className="font-display text-2xl font-bold">We couldn&rsquo;t load {String(symbol).toUpperCase()}</h1>
        <p className="mt-2 text-muted">{error}</p>
        <Link href="/stocks" className="mt-6 inline-block rounded-xl bg-brand px-6 py-3 font-semibold text-brand-ink">Back to stocks</Link>
      </div>
    );

  if (!stock)
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <p className="text-sm text-muted" role="status">Loading {String(symbol).toUpperCase()}&hellip; a stock opened for the first time can take a few seconds.</p>
        <div className="h-24 animate-pulse rounded-3xl border border-line bg-surface" />
        <div className="h-96 animate-pulse rounded-3xl border border-line bg-surface" />
        <div className="h-32 animate-pulse rounded-3xl border border-line bg-surface" />
      </div>
    );

  const prices = range === "all" ? stock.prices : stock.prices.slice(-Number(range) - 1);
  const latest = stock.prices.at(-1);
  const first = prices[0];
  const change = latest && first ? latest.close / first.close - 1 : null;
  const yearAgo = stock.prices.at(-13);
  const oneYear = latest && yearAgo ? latest.close / yearAgo.close - 1 : null;
  const stats = stock.stats;
  const years = [...stock.fundamentals].reverse();
  const chartYears = [...stock.fundamentals]
    .sort((a, b) => a.fiscal_year - b.fiscal_year)
    .slice(-6)
    .map((y) => ({ year: String(y.fiscal_year), revenue: y.revenue, profit: y.net_income }));

  return (
    <div className="flex flex-col gap-6">
      <style>{RISE}</style>
      <Link href="/stocks" className="self-start text-sm text-muted transition hover:text-brand">← All stocks</Link>

      <section className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-line bg-surface p-7 motion-safe:animate-[sw-rise_0.4s_ease-out_both]">
        <div className="flex min-w-0 items-center gap-5">
          <Avatar symbol={stock.symbol} size={64} />
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{stock.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full border border-slate-300 px-2.5 py-1 font-semibold">{stock.symbol}</span>
              <span className="rounded-full border border-line px-2.5 py-1 text-muted">{stock.asset_type === "etf" ? "Fund (ETF)" : "Stock"}</span>
              {stock.sector && stock.sector !== "Live data" && <span className="rounded-full border border-line px-2.5 py-1 text-muted">{stock.sector}</span>}
              {(stock.live || stock.featured === false) && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-brand">Added by search</span>}
              <StarButton symbol={stock.symbol} price={latest?.close} className="ml-1" />
            </div>
          </div>
        </div>
        {latest && (
          <div className="text-right">
            <div className="font-display text-4xl font-bold tabular-nums">{price(latest.close)}</div>
            <div className="mt-1.5 flex items-center justify-end gap-2 text-sm text-muted">
              {oneYear != null && <ReturnPill value={oneYear}>{percent(Math.abs(oneYear))}</ReturnPill>}
              <span>1 year · {monthName(latest.month)}</span>
            </div>
          </div>
        )}
      </section>

      <AIExplainer symbol={stock.symbol} />

      {(stock.live || stock.featured === false) && (
        <p className="rounded-2xl border border-line bg-surface px-5 py-3 text-sm text-muted">
          {stock.symbol} isn&rsquo;t one of our 36 featured stocks, so we loaded its prices from Alpaca and its financials from the company&rsquo;s SEC filings.
          {!stock.live && " It now works in every tool: Practice, Time Machine, Compare and the Strategy lab."}
        </p>
      )}

      <section className="rounded-3xl border border-line bg-surface p-7 motion-safe:animate-[sw-rise_0.4s_ease-out_0.08s_both]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold">Price history</h2>
            {change != null && first && (
              <p className="mt-1 text-sm text-muted">
                <span className={change >= 0 ? "font-semibold text-gain" : "font-semibold text-loss"}>
                  {change >= 0 ? "+" : ""}
                  {percent(change)}
                </span>{" "}
                since {monthName(first.month)}
              </p>
            )}
          </div>
          <Segmented label="Time range" value={range} onChange={setRange} options={RANGES} />
        </div>
        <div className="mt-5">
          <PriceChart data={prices} up={change == null || change >= 0} />
        </div>
      </section>

      {stats && (
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Average yearly return" value={percent(stats.annual_return)} hint="How much it grew per year, on average." tone={stats.annual_return >= 0 ? "up" : "down"} />
          <Stat label="Volatility" value={percent(stats.annual_volatility)} hint="How much it swings up and down in a typical year." />
          <Stat label="Biggest drop" value={percent(stats.max_drawdown)} hint="The largest fall from a high point." tone="down" />
          <Stat label="Worst 12 months" value={percent(stats.worst_12_months)} hint={`Best 12 months: ${percent(stats.best_12_months)}`} />
        </section>
      )}

      <section className="rounded-3xl border border-line bg-surface p-7">
        <h2 className="font-display text-xl font-bold">Company financials</h2>
        <p className="mt-1 text-sm text-muted">From the company&rsquo;s yearly SEC filings.</p>
        {years.length === 0 ? (
          <p className="mt-4 text-muted">Funds like ETFs hold many companies, so they don&rsquo;t report company financials.</p>
        ) : (
          <>
            <div className="mt-6 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartYears} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barGap={4}>
                  <CartesianGrid stroke="var(--color-grid)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: "var(--color-muted)", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "var(--color-line)" }} />
                  <YAxis tickFormatter={bigMoney} width={70} tick={{ fill: "var(--color-muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip format={bigMoney} />} cursor={{ fill: "color-mix(in srgb, var(--color-fg) 4%, transparent)" }} />
                  <Bar dataKey="revenue" name="Revenue" fill="var(--color-sky)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="profit" name="Profit" fill="var(--color-brand)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex gap-5 text-[13px] text-muted">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-sky" />Revenue (money coming in)</span>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-brand" />Profit (what&rsquo;s left)</span>
            </div>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-ink text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Year</th>
                    <th className="px-4 py-3 text-right font-medium">Revenue</th>
                    <th className="px-4 py-3 text-right font-medium">Profit</th>
                    <th className="px-4 py-3 text-right font-medium">Margin</th>
                    <th className="px-4 py-3 text-right font-medium">Assets</th>
                    <th className="px-4 py-3 text-right font-medium">Debts</th>
                    <th className="px-4 py-3 text-right font-medium">EPS</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y.fiscal_year} className="border-t border-line">
                      <td className="px-4 py-3 font-semibold">{y.fiscal_year}</td>
                      <td className="px-4 py-3 text-right">{bigMoney(y.revenue)}</td>
                      <td className={`px-4 py-3 text-right ${y.net_income < 0 ? "text-red-600" : ""}`}>{bigMoney(y.net_income)}</td>
                      <td className="px-4 py-3 text-right">{y.revenue && y.net_income != null ? percent(y.net_income / y.revenue) : "–"}</td>
                      <td className="px-4 py-3 text-right">{bigMoney(y.total_assets)}</td>
                      <td className="px-4 py-3 text-right">{bigMoney(y.total_liabilities)}</td>
                      <td className="px-4 py-3 text-right">{y.eps != null ? price(y.eps) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Link href="/coach" className="flex items-center justify-between rounded-3xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-brand/40">
          <span>
            <span className="block font-semibold">Ask the AI Coach</span>
            <span className="text-sm text-muted">&ldquo;Is {stock.symbol} a good fit for a beginner?&rdquo;</span>
          </span>
          <span className="text-brand">→</span>
        </Link>
        {!stock.live && (
          <Link href={`/tools?tab=time&symbol=${stock.symbol}`} className="flex items-center justify-between rounded-3xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-brand/40">
            <span>
              <span className="block font-semibold">Time Machine</span>
              <span className="text-sm text-muted">What if I&rsquo;d bought {stock.symbol} in 2016?</span>
            </span>
            <span className="text-brand">→</span>
          </Link>
        )}
      </section>

      <p className="text-xs text-slate-500">{stock.disclaimer}</p>
    </div>
  );
}
