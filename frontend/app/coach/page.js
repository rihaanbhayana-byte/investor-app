"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

const SUGGESTIONS = [
  { text: "What is an ETF, in simple words?", icon: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /> },
  { text: "Explain my plan to me", icon: <><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></> },
  { text: "Compare Apple and Microsoft", icon: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></> },
  { text: "What happens to my money if the market drops 20%?", icon: <><path d="M3 7l6 6 4-4 8 8" /><path d="M21 11v6h-6" /></> },
];

const MORE = ["Which stocks here grew the most last year?", "Should I pay off debt or invest first?", "What's the difference between VOO and VTI?"];

const THINKING = ["Thinking...", "Looking up real numbers...", "Checking the data...", "Writing a simple answer..."];

const PERSONALITY = { conservative: "Steady Saver", moderate: "Balanced Builder", aggressive: "Growth Seeker" };

function Sparkle({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" />
    </svg>
  );
}

function CoachAvatar() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mint text-mint-ink">
      <Sparkle size={18} />
    </span>
  );
}

function Typing() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % THINKING.length), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-end gap-3" role="status">
      <CoachAvatar />
      <div className="flex items-center gap-3 rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3">
        <span className="flex gap-1" aria-hidden="true">
          {[0, 1, 2].map((d) => (
            <span key={d} className="h-2 w-2 rounded-full bg-mint motion-safe:animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
          ))}
        </span>
        <span className="text-sm text-muted">{THINKING[i]}</span>
      </div>
    </div>
  );
}

export default function CoachPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lastPlan");
      if (saved) setPlan(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text) {
    const question = text.trim();
    if (!question || loading) return;
    const next = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { reply } = await api.chat({ messages: next.slice(-12), plan });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `Sorry, something went wrong: ${e.message}`, error: true }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  }

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <style>{`@keyframes sw-rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }`}</style>

      <aside className="flex flex-col gap-4 lg:w-80 lg:shrink-0">
        <div className="rounded-3xl border border-line bg-surface p-6">
          <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mint">What the coach knows</div>
          {plan ? (
            <>
              <h2 className="mt-3 font-display text-xl font-bold">Your latest plan</h2>
              <div className="mt-4 flex flex-col gap-2.5 text-sm">
                {[
                  ["Goal", plan.goal],
                  ["Personality", PERSONALITY[plan.risk_level] || plan.risk_level],
                  ["Start", money(plan.initial_amount)],
                  ["Monthly", money(plan.monthly_contribution)],
                  ["Time", `${plan.years} years`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-line pb-2.5 last:border-0">
                    <span className="text-muted">{k}</span>
                    <span className="text-right font-semibold">{v}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-3 font-display text-xl font-bold">No plan yet</h2>
              <p className="mt-2 text-sm text-muted">Build a plan and the coach can answer questions about your numbers.</p>
              <Link href="/plan" className="mt-4 inline-block rounded-full bg-mint px-5 py-2.5 text-sm font-semibold text-mint-ink">Build my plan</Link>
            </>
          )}
        </div>
        <div className="hidden rounded-3xl border border-line bg-surface p-6 lg:block">
          <h2 className="font-semibold">More ideas</h2>
          <div className="mt-3 flex flex-col gap-2">
            {MORE.map((q) => (
              <button key={q} onClick={() => send(q)} disabled={loading} className="rounded-xl border border-line px-3.5 py-2.5 text-left text-sm text-slate-700 transition hover:border-mint/40 hover:text-fg">
                {q}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="flex h-[calc(100vh-11rem)] min-h-[560px] flex-1 flex-col overflow-hidden rounded-3xl border border-line bg-surface">
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <CoachAvatar />
            <div>
              <h1 className="font-display text-lg font-bold">Seedwise Coach</h1>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <span className="h-2 w-2 rounded-full bg-mint" />
                Looks up real market data before answering
              </p>
            </div>
          </div>
          {!empty && (
            <button onClick={() => setMessages([])} className="rounded-full border border-line px-3.5 py-2 text-sm text-muted transition hover:border-slate-300 hover:text-fg">
              New chat
            </button>
          )}
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6" aria-live="polite">
          {empty ? (
            <div className="mx-auto flex h-full max-w-2xl flex-col justify-center gap-8 motion-safe:animate-[sw-rise_0.4s_ease-out_both]">
              <div className="text-center">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-mint text-mint-ink">
                  <Sparkle size={30} />
                </span>
                <h2 className="mt-5 font-display text-3xl font-bold">Hi! What would you like to know?</h2>
                <p className="mt-2 text-muted">Ask about investing, your plan, or any stock. No question is too basic.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    onClick={() => send(s.text)}
                    className="flex items-start gap-3 rounded-2xl border border-line bg-ink p-4 text-left transition hover:-translate-y-0.5 hover:border-mint/40"
                  >
                    <span className="mt-0.5 text-mint">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{s.icon}</svg>
                    </span>
                    <span className="text-[15px]">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end motion-safe:animate-[sw-rise_0.25s_ease-out_both]">
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-mint px-4 py-3 font-medium text-mint-ink">{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className="flex items-start gap-3 motion-safe:animate-[sw-rise_0.3s_ease-out_both]">
                    <CoachAvatar />
                    <div className={`md min-w-0 max-w-[85%] rounded-2xl rounded-tl-md border px-4 py-3 leading-relaxed ${m.error ? "border-red-200 bg-red-50" : "border-line bg-ink"}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  </div>
                )
              )}
              {loading && <Typing />}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-line p-4"
        >
          <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-line bg-ink py-1.5 pl-5 pr-1.5 transition focus-within:border-mint">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Your question"
              placeholder="Ask anything about investing..."
              className="flex-1 bg-transparent py-2 text-fg placeholder:text-slate-500 focus:outline-none"
            />
            <button
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-mint text-mint-ink transition hover:bg-mint-light disabled:opacity-30"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">Educational only, not financial advice. The coach can make mistakes.</p>
        </form>
      </section>
    </div>
  );
}
