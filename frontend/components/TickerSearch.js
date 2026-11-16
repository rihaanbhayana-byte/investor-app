"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function TickerSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      api.search(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="font-medium">🔎 Search any US-listed company</p>
      <p className="text-sm text-slate-500">About 10,000 companies. Ones outside our list load live data from Alpaca and SEC.</p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Try: Netflix, SBUX, Uber, Spotify..."
        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
      />
      {loading && <p className="mt-2 text-sm text-slate-500">Searching...</p>}
      {results.length > 0 && (
        <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto">
          {results.map((r) => (
            <li key={r.symbol}>
              <Link href={`/stocks/${r.symbol}`} className="flex items-center justify-between rounded px-2 py-2 hover:bg-slate-50">
                <span>
                  <span className="font-semibold">{r.symbol}</span> <span className="text-slate-600">{r.name}</span>
                </span>
                {r.in_app && <span className="text-xs font-medium text-emerald-700">In our list</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
