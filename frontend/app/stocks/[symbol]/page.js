"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import PriceChart from "@/components/PriceChart";
import { api } from "@/lib/api";
import { bigMoney, percent, price } from "@/lib/format";

export default function StockPage() {
  const { symbol } = useParams();
  const [stock, setStock] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.stock(symbol).then(setStock).catch((e) => setError(e.message));
  }, [symbol]);

  if (error) return <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>;
  if (!stock) return <p className="text-slate-600">Loading...</p>;

  const latest = stock.prices.at(-1);
  const stats = stock.stats;
  const years = [...stock.fundamentals].reverse();

  return (
    <div className="space-y-6">
      <Link href="/stocks" className="text-sm text-emerald-700 hover:underline">← All stocks</Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{stock.name}</h1>
          <p className="text-slate-600">
            {stock.symbol} · {stock.sector} · {stock.asset_type === "etf" ? "Fund (ETF)" : "Stock"}
          </p>
        </div>
        {latest && (
          <div className="text-right">
            <div className="text-3xl font-bold">{price(latest.close)}</div>
            <div className="text-sm text-slate-500">Latest close ({latest.month})</div>
          </div>
        )}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Price since 2016</h2>
        <PriceChart data={stock.prices} />
      </section>

      {stats && (
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Average yearly return" value={percent(stats.annual_return)} hint="Growth per year, on average" />
          <Stat label="Volatility" value={percent(stats.annual_volatility)} hint="How much it swings in a year" />
          <Stat label="Biggest drop" value={percent(stats.max_drawdown)} hint="Largest fall from a peak" />
          <Stat label="Worst 12 months" value={percent(stats.worst_12_months)} hint={`Best 12 months: ${percent(stats.best_12_months)}`} />
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Company financials (from SEC filings)</h2>
        {years.length === 0 ? (
          <p className="mt-2 text-slate-600">Funds like ETFs hold many companies, so they don&rsquo;t report company financials.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2">Year</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Profit</th>
                  <th className="text-right">Profit margin</th>
                  <th className="text-right">Assets</th>
                  <th className="text-right">Debts</th>
                  <th className="text-right">Earnings per share</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y.fiscal_year} className="border-t border-slate-100">
                    <td className="py-2 font-semibold">{y.fiscal_year}</td>
                    <td className="text-right">{bigMoney(y.revenue)}</td>
                    <td className="text-right">{bigMoney(y.net_income)}</td>
                    <td className="text-right">{y.revenue && y.net_income != null ? percent(y.net_income / y.revenue) : "–"}</td>
                    <td className="text-right">{bigMoney(y.total_assets)}</td>
                    <td className="text-right">{bigMoney(y.total_liabilities)}</td>
                    <td className="text-right">{y.eps != null ? price(y.eps) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">{stock.disclaimer}</p>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}
