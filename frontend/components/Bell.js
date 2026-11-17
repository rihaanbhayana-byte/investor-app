"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { askCoach } from "@/lib/coach";
import { price as fmtPrice } from "@/lib/format";
import { useWatchlist } from "@/lib/watchlist";

// 🔔 "What changed": big moves in your watchlist and practice stocks since you last looked.
// Simple rules on real prices (no AI, no emails). Remembered on this device.

const SEEN = "seedwise-seen-prices"; // { SYMBOL: price when you last opened the bell }
const READ = "seedwise-read-alerts"; // alert ids you've already seen
const BIG = 0.03; // a 3% move is worth telling a beginner about

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

const pct = (x) => `${x >= 0 ? "+" : "−"}${(Math.abs(x) * 100).toFixed(1)}%`;

export function buildAlerts(quotes, seen, owned) {
  const alerts = [];
  for (const q of quotes) {
    const where = owned.has(q.symbol) ? "in your practice portfolio" : "on your watchlist";
    const base = seen[q.symbol];
    const since = base ? q.price / base - 1 : null;
    const spark = q.spark || [];
    if (since != null && Math.abs(since) >= BIG) {
      alerts.push({ id: `${q.symbol}:since:${q.as_of}`, q, size: since, title: `${q.symbol} ${since > 0 ? "rose" : "fell"} ${pct(since).slice(1)} since you last looked`, text: `Now ${fmtPrice(q.price)}, ${where}.` });
    } else if (q.change_1d != null && Math.abs(q.change_1d) >= BIG) {
      alerts.push({ id: `${q.symbol}:day:${q.as_of}`, q, size: q.change_1d, title: `${q.symbol} ${q.change_1d > 0 ? "jumped" : "dropped"} ${pct(q.change_1d).slice(1)} in a day`, text: `Closed at ${fmtPrice(q.price)}, ${where}.` });
    } else if (spark.length >= 20 && q.price >= Math.max(...spark)) {
      alerts.push({ id: `${q.symbol}:high:${q.as_of}`, q, size: 0.001, title: `${q.symbol} hit a 30-day high`, text: `${fmtPrice(q.price)}, ${where}.` });
    } else if (spark.length >= 20 && q.price <= Math.min(...spark)) {
      alerts.push({ id: `${q.symbol}:low:${q.as_of}`, q, size: -0.001, title: `${q.symbol} hit a 30-day low`, text: `${fmtPrice(q.price)}, ${where}.` });
    }
  }
  return alerts.sort((a, b) => Math.abs(b.size) - Math.abs(a.size)).slice(0, 8);
}

export default function Bell({ placement = "sidebar" }) {
  const { items, ready, signedIn } = useWatchlist();
  const [owned, setOwned] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [read, setRead] = useState([]);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const panelRef = useRef(null);
  const btnRef = useRef(null);
  const quotesRef = useRef([]);

  const symbolsKey = [...new Set([...items.map((i) => i.symbol), ...owned])].sort().join(",");

  useEffect(() => {
    if (!signedIn) return setOwned([]);
    api.practice().then((p) => setOwned(p.holdings.map((h) => h.symbol))).catch(() => setOwned([]));
  }, [signedIn]);

  useEffect(() => {
    if (!ready || !symbolsKey) {
      setAlerts([]);
      setChecked(ready);
      return;
    }
    let stop = false;
    async function check() {
      try {
        const quotes = await api.quotes(symbolsKey.split(","));
        if (stop) return;
        quotesRef.current = quotes;
        const seen = readJSON(SEEN, {});
        // first time we see a stock: remember today's price quietly
        let changed = false;
        for (const q of quotes) if (!seen[q.symbol]) (seen[q.symbol] = q.price), (changed = true);
        if (changed) localStorage.setItem(SEEN, JSON.stringify(seen));
        setAlerts(buildAlerts(quotes, seen, new Set(owned)));
        setRead(readJSON(READ, []));
      } catch {}
      setChecked(true);
    }
    check();
    const timer = setInterval(check, 15 * 60 * 1000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [ready, symbolsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const unread = alerts.filter((a) => !read.includes(a.id)).length;

  function openPanel() {
    setOpen(true);
    // mark these as read, and make "now" the new starting point for "since you last looked"
    const ids = [...new Set([...readJSON(READ, []), ...alerts.map((a) => a.id)])].slice(-200);
    localStorage.setItem(READ, JSON.stringify(ids));
    const seen = readJSON(SEEN, {});
    for (const q of quotesRef.current) seen[q.symbol] = q.price;
    localStorage.setItem(SEEN, JSON.stringify(seen));
  }
  function closePanel() {
    setOpen(false);
    setRead(readJSON(READ, []));
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && (closePanel(), btnRef.current?.focus());
    const onClick = (e) => !panelRef.current?.contains(e.target) && !btnRef.current?.contains(e.target) && closePanel();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const pos = placement === "sidebar" ? "fixed left-[268px] top-5 w-[360px]" : "fixed inset-x-3 top-16";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        aria-label={unread ? `Updates: ${unread} new` : "Updates"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 003.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-loss px-1 text-[10px] font-bold text-white">{unread}</span>
        )}
      </button>

      {open && createPortal(
        <div ref={panelRef} role="dialog" aria-label="Updates on your stocks" className={`${pos} z-[55] overflow-hidden rounded-2xl border border-line bg-surface shadow-float motion-safe:animate-[sw-rise_0.18s_ease-out_both]`}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <div className="text-sm font-bold">What changed</div>
              <div className="text-xs text-muted">Moves of 3% or more in stocks you follow</div>
            </div>
            <Link href="/watchlist" onClick={closePanel} className="text-xs font-semibold text-brand">Watchlist</Link>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {!signedIn ? (
              <p className="p-3 text-sm text-muted">
                <Link href="/login?next=/watchlist" onClick={closePanel} className="font-semibold text-brand">Log in</Link> and star some stocks. We&rsquo;ll tell you here when they make a big move.
              </p>
            ) : !symbolsKey ? (
              <p className="p-3 text-sm text-muted">
                Star stocks to follow them (look for ☆ on any stock page). We&rsquo;ll tell you here when they move 3% or more.
              </p>
            ) : !checked ? (
              <div className="h-20 animate-pulse rounded-xl bg-surface-2" />
            ) : alerts.length === 0 ? (
              <p className="p-3 text-sm text-muted">All quiet. None of your {symbolsKey.split(",").length} stocks moved 3% or more since you last looked.</p>
            ) : (
              <ul className="flex flex-col">
                {alerts.map((a) => (
                  <li key={a.id} className="flex gap-3 rounded-xl px-2.5 py-2.5 hover:bg-surface-2">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${read.includes(a.id) ? "bg-transparent" : "bg-brand"}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <Link href={`/stocks/${a.q.symbol}`} onClick={closePanel} className="block text-sm font-semibold hover:text-brand">
                        {a.title}
                      </Link>
                      <span className="block text-xs text-muted">{a.text}</span>
                      <button
                        type="button"
                        onClick={() => {
                          closePanel();
                          askCoach(`${a.title}. In simple words, what might explain a move like that, and should a beginner worry about it?`);
                        }}
                        className="mt-1 text-xs font-semibold text-brand hover:underline"
                      >
                        Ask AI why
                      </button>
                    </span>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${a.size >= 0 ? "text-gain" : "text-loss"}`}>{Math.abs(a.size) >= 0.01 ? pct(a.size) : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="border-t border-line px-4 py-2 text-[11px] text-muted">Based on daily closing prices. Big moves are normal; they&rsquo;re not a signal to buy or sell.</p>
        </div>,
        document.body
      )}
    </>
  );
}
