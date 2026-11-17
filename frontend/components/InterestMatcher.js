"use client";

import SymbolSearch from "@/components/SymbolSearch";
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
  const [moreFor, setMoreFor] = useState(null); // symbol we're finding look-alikes for
  const [adding, setAdding] = useState(false);

  // You stay in charge of the list: remove picks, add your own, or ask for more like one you like.
  const remove = (symbol) => setResult((r) => ({ ...r, matches: r.matches.filter((m) => m.symbol !== symbol) }));

  async function addOwn(item) {
    if (result.matches.some((m) => m.symbol === item.symbol)) return;
    setAdding(true);
    try {
      const q = await api.quote(item.symbol);
      setResult((r) => ({
        ...r,
        matches: [...r.matches, { symbol: q.symbol, name: q.name, latest_price: q.price, return_1y: null, reason: "You added this one.", match: "Your pick" }],
      }));
    } catch (e) {
      setError(e.message);
    }
    setAdding(false);
  }

  async function moreLike(m) {
    setMoreFor(m.symbol);
    setError("");
    try {
      const r = await api.matchInterests(`${text}. Suggest companies similar to ${m.name} (${m.symbol}).`.slice(0, 390));
      const have = new Set(result.matches.map((x) => x.symbol));
      const fresh = r.matches.filter((x) => !have.has(x.symbol)).map((x) => ({ ...x, reason: x.reason, similarTo: m.symbol }));
      if (!fresh.length) setError(`No new companies like ${m.symbol} in our list. Try searching for one to add.`);
      setResult((prev) => ({ ...prev, matches: [...prev.matches, ...fresh].slice(0, 12) }));
    } catch (e) {
      setError(e.message);
    }
    setMoreFor(null);
  }

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
    <section className="reveal rounded-3xl border border-brand-line bg-glow p-6 sm:p-8">
      <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-brand">
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
          className="min-w-64 flex-1 rounded-full border border-line bg-ink px-5 py-3.5 text-fg placeholder:text-slate-500 focus:border-brand focus:outline-none"
        />
        <button disabled={loading || text.trim().length < 3} className="rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-40">
          {loading ? "Finding..." : "Find my companies"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" onClick={() => run(e)} disabled={loading} className="rounded-full border border-line-strong px-3 py-1.5 text-[13px] text-slate-700 transition hover:border-brand hover:text-brand">
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
              <div
                key={m.symbol}
                style={{ animationDelay: `${Math.min(i, 6) * 80}ms` }}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 transition hover:border-brand/40 motion-safe:animate-page-in"
              >
                <Link href={`/stocks/${m.symbol}`} className="flex items-center gap-3 rounded-xl transition hover:opacity-80">
                  <Avatar symbol={m.symbol} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{m.symbol}</div>
                    <div className="truncate text-sm text-muted">{m.name}</div>
                  </div>
                  {m.return_1y != null && <ReturnPill value={m.return_1y}>{percent(Math.abs(m.return_1y))}</ReturnPill>}
                </Link>
                {m.match && (
                  <span
                    title={m.votes ? `Picked in ${m.votes} of ${m.runs} independent AI runs` : undefined}
                    className={`self-start rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      m.match === "Strong match" ? "border-brand-line bg-brand-soft text-brand" : m.match === "Your pick" ? "border-line bg-slate-100 text-fg" : "border-amber-200 bg-amber-50 text-gold"
                    }`}
                  >
                    {m.match}{m.votes ? ` · ${m.votes}/${m.runs} runs` : ""}{m.similarTo ? ` · like ${m.similarTo}` : ""}
                  </span>
                )}
                <p className="text-sm leading-relaxed text-slate-800">{m.reason}</p>
                <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted">
                  <span>{price(m.latest_price)} a share</span>
                  <span className="flex gap-1">
                    {m.match !== "Your pick" && (
                      <button type="button" onClick={() => moreLike(m)} disabled={Boolean(moreFor)} className="rounded-full border border-line px-2.5 py-1 font-semibold text-fg transition hover:border-brand hover:text-brand disabled:opacity-50">
                        {moreFor === m.symbol ? "Finding…" : "More like this"}
                      </button>
                    )}
                    <button type="button" onClick={() => remove(m.symbol)} aria-label={`Remove ${m.symbol}`} className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-red-50 hover:text-red-600">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted">Missing one you love?</span>
            <SymbolSearch size="sm" className="w-72 max-w-full" placeholder="Add a company…" label="Add your own company" exclude={result.matches.map((m) => m.symbol)} onSelect={addOwn} />
            {adding && <span className="text-sm text-muted" role="status">Adding…</span>}
          </div>
          {result.fund_tip && (
            <p className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm text-slate-800">
              <svg className="mt-0.5 shrink-0 text-brand" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
              </svg>
              <span><span className="font-semibold text-brand">Simpler idea: </span>{result.fund_tip}</span>
            </p>
          )}
          <p className="text-xs text-slate-500">{result.disclaimer}</p>
        </div>
      )}
    </section>
  );
}
