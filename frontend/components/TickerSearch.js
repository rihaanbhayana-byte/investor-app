"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui";

export default function TickerSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

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

  const showList = open && query.trim().length > 0;

  return (
    <div className="relative z-20">
      <div className="flex items-center gap-3 rounded-full border border-line bg-surface px-5 py-2 shadow-lift transition focus-within:border-mint">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          aria-label="Search any US-listed company"
          placeholder="Search any of ~10,000 US companies: Netflix, Uber, SBUX..."
          className="w-full bg-transparent py-3 text-lg text-fg placeholder:text-slate-500 focus:outline-none"
        />
        {loading && <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-mint" />}
      </div>

      {showList && (
        <div className="absolute inset-x-0 top-full mt-2 overflow-hidden rounded-3xl border border-line bg-surface shadow-float">
          {results.length === 0 && !loading && <p className="px-5 py-4 text-muted">No companies match &ldquo;{query}&rdquo;.</p>}
          <ul className="max-h-80 overflow-y-auto py-2">
            {results.map((r) => (
              <li key={r.symbol}>
                <Link href={`/stocks/${r.symbol}`} className="flex items-center gap-4 px-5 py-3 transition hover:bg-slate-100">
                  <Avatar symbol={r.symbol} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{r.symbol}</span>
                    <span className="block truncate text-sm text-muted">{r.name}</span>
                  </span>
                  {r.in_app ? (
                    <span className="rounded-full bg-mint/10 px-2.5 py-1 text-xs font-semibold text-mint">In our list</span>
                  ) : (
                    <span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs text-muted">Live data</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
