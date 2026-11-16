"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import TickerSearch from "@/components/TickerSearch";
import { percent, price } from "@/lib/format";

export default function StocksPage() {
  const [stocks, setStocks] = useState([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.stocks()
      .then(setStocks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const term = search.trim().toLowerCase();
  const shown = stocks.filter(
    (s) =>
      (type === "all" || s.asset_type === type) &&
      (s.symbol.toLowerCase().includes(term) || s.name.toLowerCase().includes(term) || (s.sector || "").toLowerCase().includes(term))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Explore stocks and funds</h1>
        <p className="mt-1 text-slate-600">Search any US company, or browse our 36 beginner-friendly picks below.</p>
      </div>

      <TickerSearch />

      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Search by name, ticker or sector..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-64 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
        />
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">
          <option value="all">Stocks and funds</option>
          <option value="stock">Stocks only</option>
          <option value="etf">Funds (ETFs) only</option>
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {loading && <p className="text-slate-600">Loading...</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-sm text-slate-500">
            <tr>
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Sector</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">1-year return</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.symbol} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold">
                  <Link href={`/stocks/${s.symbol}`} className="text-emerald-700 hover:underline">{s.symbol}</Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/stocks/${s.symbol}`} className="hover:underline">{s.name}</Link>
                  {s.asset_type === "etf" && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">ETF</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">{s.sector}</td>
                <td className="px-4 py-3 text-right">{price(s.latest_price)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${s.return_1y >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {percent(s.return_1y)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
