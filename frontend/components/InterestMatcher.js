"use client";

import InsightCard from "@/components/InsightCard";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { percent, price } from "@/lib/format";
import { Avatar, ReturnPill } from "@/components/ui";

const EXAMPLES = ["Gaming and sneakers", "Netflix, Disney and movies", "Coffee, burgers and fizzy drinks", "Electric cars and tech gadgets"];

export default function InterestMatcher() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function run(value) {
    const q = (value ?? text).trim();
    if (q.length < 3) return;
    setText(q);
    setLoading(true);
    setError("");
    try {
      setResult(await api.matchInterests(q));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <section className="reveal rounded-3xl border border-mint-line bg-glow p-6 sm:p-8">
      <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-mint">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" />
        </svg>
        AI matcher
      </div>
      <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Companies you already know</h2>
      <p className="mt-1.5 max-w-2xl text-muted">Tell us what you love. The AI finds the companies behind it and explains how they make money.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="mt-5 flex flex-wrap gap-3"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Your interests"
          placeholder="e.g. I love gaming, sneakers and watching movies"
          className="min-w-64 flex-1 rounded-full border border-line bg-ink px-5 py-3.5 text-fg placeholder:text-slate-500 focus:border-mint focus:outline-none"
        />
        <button disabled={loading || text.trim().length < 3} className="rounded-full bg-mint px-6 py-3.5 font-semibold text-mint-ink transition hover:bg-mint-light disabled:opacity-40">
          {loading ? "Finding..." : "Find my companies"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" onClick={() => run(e)} disabled={loading} className="rounded-full border border-line-strong px-3 py-1.5 text-[13px] text-slate-700 transition hover:border-mint hover:text-mint">
            {e}
          </button>
        ))}
      </div>

      {loading && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-line bg-surface" />
          ))}
        </div>
      )}
      {error && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-red-700">{error}</p>}

      {result && !loading && (
        <div className="mt-6 flex flex-col gap-4">
          {result.matches.length === 0 && result.no_match_note && <p className="text-slate-800">{result.no_match_note}</p>}
          {result.matches.length > 0 && <InsightCard insight={result.insight} feature="matcher" title="How sure are these picks?" />}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.matches.map((m, i) => (
              <Link
                key={m.symbol}
                href={`/stocks/${m.symbol}`}
                style={{ animationDelay: `${i * 80}ms` }}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-1 hover:border-mint/40 motion-safe:animate-page-in"
              >
                <div className="flex items-center gap-3">
                  <Avatar symbol={m.symbol} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{m.symbol}</div>
                    <div className="truncate text-sm text-muted">{m.name}</div>
                  </div>
                  <ReturnPill value={m.return_1y}>{percent(Math.abs(m.return_1y ?? 0))}</ReturnPill>
                </div>
                {m.match && (
                  <span
                    title={`Picked in ${m.votes} of ${m.runs} independent AI runs`}
                    className={`self-start rounded-full border px-2 py-0.5 text-[11px] font-semibold ${m.match === "Strong match" ? "border-mint-line bg-mint-soft text-mint" : "border-amber-200 bg-amber-50 text-gold"}`}
                  >
                    {m.match} · {m.votes}/{m.runs} runs
                  </span>
                )}
                <p className="text-sm leading-relaxed text-slate-800">{m.reason}</p>
                <div className="mt-auto text-xs text-muted">{price(m.latest_price)} a share · 1-year change shown</div>
              </Link>
            ))}
          </div>
          {result.fund_tip && (
            <p className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm text-slate-800">
              <svg className="mt-0.5 shrink-0 text-mint" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
              </svg>
              <span><span className="font-semibold text-mint">Simpler idea: </span>{result.fund_tip}</span>
            </p>
          )}
          <p className="text-xs text-slate-500">{result.disclaimer}</p>
        </div>
      )}
    </section>
  );
}
