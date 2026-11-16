"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";

const SUGGESTIONS = [
  "What is an ETF, in simple words?",
  "Explain my plan to me",
  "Compare Apple and Microsoft",
  "Which stocks here grew the most last year?",
  "What happens to my money if the market drops 20%?",
];

const GREETING = {
  role: "assistant",
  content: "Hi! I'm your AI investing coach. Ask me anything about investing, your plan, or the stocks in this app. I look up real data before I answer.",
};

export default function CoachPage() {
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lastPlan");
      if (saved) setPlan(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text) {
    const question = text.trim();
    if (!question || loading) return;
    const next = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const history = next.filter((m) => m !== GREETING).slice(-12);
      const { reply } = await api.chat({ messages: history, plan });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `Sorry, something went wrong: ${e.message}` }]);
    }
    setLoading(false);
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] flex-col rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <h1 className="text-xl font-bold">AI Coach</h1>
        <p className="text-sm text-slate-500">
          {plan ? `Knows your latest plan: ${plan.goal}, ${plan.risk_level}.` : "Build a plan first and I can answer questions about it."}
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`md max-w-[85%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-900"}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-slate-500">Looking up the data...</div>}
        <div ref={bottomRef} />
      </div>

      {messages.length === 1 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-slate-200 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about investing..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
        />
        <button disabled={loading || !input.trim()} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
