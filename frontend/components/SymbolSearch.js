"use client";

import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui";

const RECENT_KEY = "seedwise-recent-symbols";
const POPULAR = [
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", asset_type: "etf", featured: true },
  { symbol: "AAPL", name: "Apple", asset_type: "stock", featured: true },
  { symbol: "NVDA", name: "NVIDIA", asset_type: "stock", featured: true },
  { symbol: "TSLA", name: "Tesla", asset_type: "stock", featured: true },
  { symbol: "QQQ", name: "Invesco QQQ (Nasdaq-100)", asset_type: "etf", featured: true },
];

function readRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function remember(item) {
  try {
    const next = [item, ...readRecent().filter((r) => r.symbol !== item.symbol)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private browsing: nothing to remember */
  }
}

// Ask the database first (fast, typo-tolerant). If search.sql hasn't been run yet, use the backend's older search.
async function findSymbols(q) {
  const { data, error } = await supabase.rpc("search_symbols", { q, max_results: 8 });
  if (!error && data) return data;
  const rows = await api.search(q);
  return rows.slice(0, 8).map((r) => ({ ...r, asset_type: "stock", featured: r.in_app }));
}

/**
 * Search any US stock or ETF, with suggestions as you type.
 * onSelect(item) gets { symbol, name, asset_type, featured }.
 */
export default function SymbolSearch({
  onSelect,
  placeholder = "Search any US stock or ETF…",
  size = "md",
  exclude = [],
  autoFocus = false,
  clearOnSelect = true,
  label = "Search for a stock or fund",
  className = "",
  onDismiss,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const latest = useRef(0);
  const box = useRef(null);

  useEffect(() => setRecent(readRecent()), []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ticket = ++latest.current;
    const timer = setTimeout(() => {
      findSymbols(q)
        .then((rows) => ticket === latest.current && (setResults(rows), setActive(0)))
        .catch(() => ticket === latest.current && setResults([]))
        .finally(() => ticket === latest.current && setLoading(false));
    }, 120);
    return () => clearTimeout(timer);
  }, [query]);

  // close when clicking anywhere else
  useEffect(() => {
    if (!open) return;
    const away = (e) => {
      if (box.current && !box.current.contains(e.target)) {
        setOpen(false);
        onDismiss?.();
      }
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open, onDismiss]);

  const typing = query.trim().length > 0;
  const shown = (typing ? results : recent.length ? recent : POPULAR).filter((r) => !exclude.includes(r.symbol));
  const heading = typing ? null : recent.length ? "Recent" : "Popular";

  function choose(item) {
    remember({ symbol: item.symbol, name: item.name, asset_type: item.asset_type, featured: item.featured });
    setRecent(readRecent());
    setOpen(false);
    setQuery(clearOnSelect ? "" : item.symbol);
    onSelect?.(item);
  }

  function onKey(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && shown[active]) {
        e.preventDefault();
        choose(shown[active]);
      } else if (typing && /^[A-Za-z.]{1,6}$/.test(query.trim())) {
        e.preventDefault();
        choose({ symbol: query.trim().toUpperCase(), name: query.trim().toUpperCase() });
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      onDismiss?.();
    }
  }

  const big = size === "lg";
  const small = size === "sm";

  return (
    <div ref={box} className={`relative ${open ? "z-40" : "z-20"} ${className}`}>
      <div
        className={`flex items-center gap-3 border border-line bg-surface transition focus-within:border-mint ${
          big ? "rounded-full px-5 py-2 shadow-lift" : small ? "rounded-full px-3.5 py-1" : "rounded-2xl px-4 py-1.5"
        }`}
      >
        <svg width={big ? 22 : 18} height={big ? 22 : 18} viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${listId}-${shown[active].symbol}` : undefined}
          autoComplete="off"
          spellCheck="false"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder}
          className={`w-full min-w-0 bg-transparent text-fg placeholder:text-slate-500 focus:outline-none ${big ? "py-3 text-lg" : small ? "py-1 text-sm" : "py-2"}`}
        />
        {loading && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-mint" aria-hidden="true" />}
      </div>

      {open && (
        <div className={`absolute left-0 top-full mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-float ${small ? "w-80 max-w-[85vw]" : "right-0"}`}>
          {heading && <div className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted">{heading}</div>}
          {typing && !loading && shown.length === 0 && (
            <p className="px-4 py-4 text-sm text-muted">
              No stocks or funds match &ldquo;{query}&rdquo;. Try the company name or its ticker.
            </p>
          )}
          <ul id={listId} role="listbox" aria-label="Matching stocks and funds" className="max-h-80 overflow-y-auto py-1.5">
            {shown.map((r, i) => (
              <li
                key={r.symbol}
                id={`${listId}-${r.symbol}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(r);
                }}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${i === active ? "bg-mint-soft" : ""}`}
              >
                <Avatar symbol={r.symbol} size={small ? 30 : 36} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{r.symbol}</span>
                  <span className="block truncate text-sm text-muted">{r.name}</span>
                </span>
                {r.asset_type === "etf" && <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-muted">Fund</span>}
                {r.featured && <span className="shrink-0 rounded-full bg-mint/10 px-2 py-0.5 text-xs font-semibold text-mint">Featured</span>}
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-4 py-2 text-xs text-muted">
            Any US stock or fund. New ones take a few seconds to load the first time.
          </div>
        </div>
      )}
    </div>
  );
}
