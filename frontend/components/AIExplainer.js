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
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-emerald-900">✨ Explain this simply</h2>
          <p className="text-sm text-emerald-800">The AI reads the real numbers on this page and explains them in plain words.</p>
        </div>
        {!text && (
          <button onClick={explain} disabled={loading} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
            {loading ? "Thinking..." : "Explain it"}
          </button>
        )}
      </div>
      {text && (
        <div className="md mt-3 text-slate-800">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
