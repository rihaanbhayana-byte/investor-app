"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api";
import { getPageContext } from "../lib/coach";
import { ConfidenceChip, Feedback } from "./InsightCard";

// The AI coach as a side panel, available from every page ("Ask AI").
// It's the same coach and the same guardrails as the Coach page; it also
// knows which page you're on, so "is this risky?" on NVDA's page is about NVDA.

const GUARDRAIL_LABEL = {
  off_topic: "Guardrail: staying on money topics",
  harmful: "Guardrail: harmful request",
  injection: "Guardrail: rules can't be changed",
  crisis: "Support resources",
};

function mask(text) {
  return text
    .replace(/\b\d(?:[ -]?\d){12,18}\b/g, (m) => `•••• ${m.replace(/\D/g, "").slice(-4)}`)
    .replace(/\b\d{3}-\d{2}-(\d{4})\b/g, "•••-••-$1");
}

function suggestionsFor(context) {
  const stock = context.match(/stock page for ([A-Z.]+)/i)?.[1];
  if (stock) return [`Explain ${stock} in simple words`, `Is ${stock} risky for a beginner?`, `How did ${stock} do compared with the S&P 500?`];
  if (/practice/i.test(context)) return ["How can I spread my practice money better?", "What does 'diversified' mean?", "Why is my portfolio up or down?"];
  if (/plan/i.test(context)) return ["Explain my plan in simple words", "What happens to my plan if the market drops 20%?", "How could I reach my goal faster?"];
  return ["What is an ETF, in simple words?", "Explain my plan to me", "Should I pay off debt or invest first?"];
}

export default function CoachPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const pending = useRef(null);

  useEffect(() => {
    const onAsk = (e) => {
      setContext(getPageContext());
      setOpen(true);
      const q = e.detail?.question?.trim();
      if (q) pending.current = q;
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    const onContext = () => setContext(getPageContext());
    window.addEventListener("seedwise:ask", onAsk);
    window.addEventListener("seedwise:context", onContext);
    return () => {
      window.removeEventListener("seedwise:ask", onAsk);
      window.removeEventListener("seedwise:context", onContext);
    };
  });

  // a question passed in by a page ("Ask the coach about this tip") is sent once the panel is open
  useEffect(() => {
    if (open && pending.current && !loading) {
      const q = pending.current;
      pending.current = null;
      send(q);
    }
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text) {
    const question = text.trim();
    if (!question || loading) return;
    const next = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      localStorage.setItem("seedwise-coach-used", "true");
    } catch {}
    let plan = null;
    try {
      plan = JSON.parse(localStorage.getItem("lastPlan") || "null");
    } catch {}
    try {
      const result = await api.chat({
        messages: next.slice(-12).map(({ role, content }) => ({ role, content })),
        plan,
        context: getPageContext() || undefined,
      });
      setMessages([...next, { role: "assistant", content: result.reply, guardrail: result.guardrail, notices: result.notices || [], insight: result.insight }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: e.message, error: true }]);
    }
    setLoading(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="coach-panel-title">
      <button type="button" aria-label="Close the AI coach" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/30 motion-safe:animate-[cp-fade_0.2s_ease-out]" />
      <section className="relative flex h-full w-full max-w-[440px] flex-col border-l border-line bg-surface shadow-float motion-safe:animate-[cp-slide_0.25s_ease-out]">
        <style>{`@keyframes cp-fade{from{opacity:0}}@keyframes cp-slide{from{transform:translateX(100%)}}`}</style>
        <header className="flex items-center gap-3 border-b border-line px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="coach-panel-title" className="text-base font-bold">Ask Seedwise AI</h2>
            <p className="truncate text-xs text-muted">{context ? `Looking at: ${context}` : "Looks up real market data before answering"}</p>
          </div>
          {messages.length > 0 && (
            <button type="button" onClick={() => setMessages([])} className="rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-fg">
              New chat
            </button>
          )}
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">Ask anything about investing, your plan or this page. Try:</p>
              {suggestionsFor(context).map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-left text-sm font-medium transition hover:border-brand hover:text-brand">
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-4">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-8 self-end rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-brand-ink">{mask(m.content)}</div>
              ) : (
                <div key={i} className="mr-4 flex flex-col gap-2">
                  {m.notices?.map((n) => (
                    <div key={n} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-slate-800">{n}</div>
                  ))}
                  <div className={`md rounded-2xl rounded-bl-md border px-4 py-3 text-sm leading-relaxed ${m.error ? "border-red-200 bg-red-50" : m.guardrail ? "border-brand-line bg-brand-soft" : "border-line bg-surface-2"}`}>
                    {m.guardrail && <div className="mb-1.5 text-xs font-semibold text-brand">{GUARDRAIL_LABEL[m.guardrail] || "Guardrail"}</div>}
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                  {m.insight && !m.guardrail && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <ConfidenceChip confidence={m.insight.confidence} />
                      {m.insight.confidence.level === "low" && i === messages.length - 1 && (
                        <button type="button" onClick={() => send("Please check that answer against real data from the app and show the numbers you used.")} className="rounded-full border border-brand-line px-2.5 py-1 font-semibold text-brand hover:bg-brand-soft">
                          Check it with real data
                        </button>
                      )}
                      <span className="ml-auto"><Feedback feature="coach" level={m.insight.confidence.level} compact /></span>
                      {m.insight.based_on?.length > 0 && <span className="basis-full">Used: {m.insight.based_on.join(" · ")}</span>}
                    </div>
                  )}
                </div>
              )
            )}
            {loading && (
              <div className="flex items-center gap-1.5 self-start rounded-2xl border border-line bg-surface-2 px-4 py-3" role="status" aria-label="The coach is thinking">
                {[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d * 120}ms` }} />)}
              </div>
            )}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-line p-4"
        >
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2 py-1.5 pl-4 pr-1.5 focus-within:border-brand">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Your question"
              placeholder="Ask about investing or this page…"
              maxLength={1500}
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-fg placeholder:text-slate-500 focus:outline-none"
            />
            <button disabled={loading || !input.trim()} aria-label="Send" className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-ink transition hover:bg-brand-light disabled:opacity-40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
            <span>Educational only, not financial advice.</span>
            <Link href="/coach" onClick={() => setOpen(false)} className="font-semibold text-brand">Open full coach</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
