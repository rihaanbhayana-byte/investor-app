"use client";

import { useState } from "react";
import { api } from "@/lib/api";

const EXAMPLES = [
  "I'm 22 and want to buy a house in about 6 years. I have $2,000 saved and can invest $250 a month.",
  "I want to grow my money for retirement over 30 years. I can start with $500 and add $150 a month.",
  "Saving for a car in 3 years. I have $1,000 and can add $100 a month.",
];

export default function GoalFromText({ onFill }) {
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function fill() {
    setLoading(true);
    setError("");
    setSummary("");
    try {
      const result = await api.parseGoal({ text });
      onFill(result);
      setSummary(result.summary);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <div className="rounded-3xl border border-mint-line bg-glow p-6 sm:p-8">
      <div className="flex items-center gap-2.5">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-mint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" />
        </svg>
        <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mint">Fastest way · AI</span>
      </div>
      <label htmlFor="goal-text" className="mt-3 block font-display text-2xl font-bold tracking-tight">
        Tell us your goal in your own words
      </label>
      <textarea
        id="goal-text"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLES[0]}
        className="mt-4 w-full resize-none rounded-2xl border border-line bg-ink px-4 py-3.5 text-fg placeholder:text-slate-500 focus:border-mint focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-muted">Try:</span>
        {["House in 6 years", "Retirement", "A car"].map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setText(EXAMPLES[i])}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-[13px] text-slate-700 transition hover:border-mint hover:text-mint"
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={fill}
        disabled={loading || text.trim().length < 5}
        className="mt-5 rounded-full bg-mint px-6 py-3 font-semibold text-mint-ink transition hover:bg-mint-light disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Reading your goal..." : "Read my goal →"}
      </button>
      {summary && (
        <p className="mt-4 rounded-xl border border-mint-line bg-ink/60 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold text-mint">Got it. </span>
          {summary} Check the details below and change anything that&rsquo;s off.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
