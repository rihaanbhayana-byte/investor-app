"use client";

import { useState } from "react";
import { api } from "@/lib/api";

const EXAMPLE = "I'm 22 and want to buy a house in about 6 years. I have $2,000 saved and can invest $250 a month.";

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
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <p className="font-medium text-emerald-900">✨ Describe your goal in your own words</p>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLE}
        className="mt-2 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={fill}
          disabled={loading || text.trim().length < 5}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Reading..." : "Fill in the form for me"}
        </button>
        <button type="button" onClick={() => setText(EXAMPLE)} className="text-sm text-emerald-800 underline">
          Use an example
        </button>
      </div>
      {summary && <p className="mt-2 text-sm text-emerald-900">{summary} Check the boxes below and change anything that's off.</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
