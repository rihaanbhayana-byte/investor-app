"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "@/lib/api";

export default function AIExplainer({ symbol }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function explain() {
    setLoading(true);
    setError("");
    try {
      const result = await api.explainStock(symbol);
      setText(result.explanation);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <section className="rounded-3xl border border-[#23493A] bg-[radial-gradient(130%_120%_at_0%_0%,#15392B_0%,#10171F_60%)] p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint/15 text-mint">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" />
            </svg>
          </span>
          <div>
            <h2 className="font-display text-xl font-bold">Explain {symbol} simply</h2>
            <p className="text-sm text-muted">The AI reads the real numbers on this page and explains them in plain words.</p>
          </div>
        </div>
        {!text && (
          <button
            onClick={explain}
            disabled={loading}
            className="rounded-full bg-mint px-6 py-3 font-semibold text-mint-ink transition hover:bg-mint-light disabled:opacity-50"
          >
            {loading ? "Reading the numbers..." : "Explain it →"}
          </button>
        )}
      </div>
      {loading && (
        <div className="mt-5 flex flex-col gap-2.5" aria-hidden="true">
          {[92, 80, 86, 60].map((w, i) => (
            <div key={i} className="h-3.5 animate-pulse rounded-full bg-slate-100" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}
      {text && (
        <div className="md mt-5 leading-relaxed text-slate-800">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
