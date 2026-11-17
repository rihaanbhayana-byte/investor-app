"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addToWatchlist, removeFromWatchlist, useWatchlist } from "@/lib/watchlist";

// ☆ / ★ : add or remove a stock from your watchlist.
export default function StarButton({ symbol, price, size = "md", className = "" }) {
  const router = useRouter();
  const { has, signedIn, ready } = useWatchlist();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const on = has(symbol);

  async function toggle(e) {
    e.preventDefault(); // stars sit inside clickable stock cards
    e.stopPropagation();
    if (!ready || busy) return;
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      if (on) await removeFromWatchlist(symbol);
      else await addToWatchlist(symbol, price);
    } catch (err) {
      setMsg(err.message);
    }
    setBusy(false);
  }

  const small = size === "sm";
  const label = on ? `Remove ${symbol} from your watchlist` : `Add ${symbol} to your watchlist`;
  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        aria-label={label}
        title={signedIn ? label : "Log in to keep a watchlist"}
        className={
          small
            ? `flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-surface-2 ${on ? "text-amber-500" : "text-muted hover:text-fg"}`
            : `flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition ${on ? "border-amber-300 bg-amber-50 text-amber-700" : "border-line bg-surface text-fg hover:border-brand hover:text-brand"}`
        }
      >
        <svg width={small ? 18 : 17} height={small ? 18 : 17} viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
        </svg>
        {!small && (on ? "Watching" : "Watch")}
      </button>
      {msg && (
        <span role="alert" className="absolute right-0 top-full z-10 mt-2 w-64 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 shadow-card">
          {msg}
        </span>
      )}
    </span>
  );
}
