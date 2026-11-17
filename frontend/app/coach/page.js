"use client";

import { ConfidenceChip, Feedback } from "@/components/InsightCard";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

// Hide card numbers and SSNs in the user's own bubble too (the server also strips them before the AI sees them).
function mask(text) {
  return text
    .replace(/\b\d(?:[ -]?\d){12,18}\b/g, (m) => `•••• ${m.replace(/\D/g, "").slice(-4)}`)
    .replace(/\b\d{3}-\d{2}-(\d{4})\b/g, "•••-••-$1");
}

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
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink">
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
            <span key={d} className="h-2 w-2 rounded-full bg-brand motion-safe:animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
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
  const [shield, setShield] = useState(null);
  const shieldRef = useRef(null);

  // Close the guardrails panel with Escape or a click anywhere else.
  useEffect(() => {
    if (!shield) return;
    const onKey = (e) => e.key === "Escape" && setShield(null);
    const onClick = (e) => shieldRef.current && !shieldRef.current.contains(e.target) && setShield(null);
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [shield]);
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
    try { localStorage.setItem("seedwise-coach-used", "true"); } catch {}
    try {
      const result = await api.chat({ messages: next.slice(-12).map(({ role, content }) => ({ role, content })), plan });
      setMessages([...next, { role: "assistant", content: result.reply, guardrail: result.guardrail, notices: result.notices || [], insight: result.insight }]);
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
          <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-brand">What the coach knows</div>
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
              <Link href="/plan" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink">Build my plan</Link>
            </>
          )}
        </div>
        <div className="hidden rounded-3xl border border-line bg-surface p-6 lg:block">
          <h2 className="font-semibold">More ideas</h2>
          <div className="mt-3 flex flex-col gap-2">
            {MORE.map((q) => (
              <button key={q} onClick={() => send(q)} disabled={loading} className="rounded-xl border border-line px-3.5 py-2.5 text-left text-sm text-slate-700 transition hover:border-brand/40 hover:text-fg">
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
                <span className="h-2 w-2 rounded-full bg-brand" />
                Looks up real market data before answering
              </p>
            </div>
          </div>
          <div ref={shieldRef} className="relative ml-auto mr-2">
            <button
              onClick={() => (shield ? setShield(null) : api.guardrails().then(setShield).catch(() => setShield({ layers: [] })))}
              aria-expanded={Boolean(shield)}
              className="flex items-center gap-1.5 rounded-full border border-brand-line bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" />
              </svg>
              Guardrails on
            </button>
            {shield && (
              <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-2xl border border-line bg-surface p-4 shadow-float motion-safe:animate-page-in">
                <div className="text-sm font-semibold">How this coach stays safe</div>
                <ul className="mt-2.5 flex flex-col gap-2.5">
                  {shield.layers.map((l) => (
                    <li key={l.name} className="flex gap-2.5 text-xs">
                      <span className="mt-0.5 text-brand">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
                      </span>
                      <span><span className="font-semibold text-fg">{l.name}.</span> <span className="text-muted">{l.detail}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-brand-ink">
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
                    className="flex items-start gap-3 rounded-2xl border border-line bg-ink p-4 text-left transition hover:-translate-y-0.5 hover:border-brand/40"
                  >
                    <span className="mt-0.5 text-brand">
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
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-brand px-4 py-3 font-medium text-brand-ink">{mask(m.content)}</div>
                  </div>
                ) : (
                  <div key={i} className="flex items-start gap-3 motion-safe:animate-[sw-rise_0.3s_ease-out_both]">
                    <CoachAvatar />
                    <div className="flex min-w-0 max-w-[85%] flex-col gap-2">
                      {m.notices?.map((n) => (
                        <div key={n} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-slate-800">
                          <svg className="mt-0.5 shrink-0 text-gold" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                          </svg>
                          {n}
                        </div>
                      ))}
                      <div className={`md rounded-2xl rounded-tl-md border px-4 py-3 leading-relaxed ${m.error ? "border-red-200 bg-red-50" : m.guardrail ? "border-brand-line bg-brand-soft" : "border-line bg-ink"}`}>
                        {m.guardrail && (
                          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg>
                            {{ off_topic: "Guardrail: staying on money topics", harmful: "Guardrail: harmful request", injection: "Guardrail: rules can't be changed", crisis: "Support resources" }[m.guardrail] || "Guardrail"}
                          </div>
                        )}
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                      {m.insight && !m.guardrail && (
                        <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted">
                          <ConfidenceChip confidence={m.insight.confidence} />
                          {m.insight.based_on?.length > 0 && <span>Used: {m.insight.based_on.join(" · ")}</span>}
                          {m.insight.confidence.level === "low" && i === messages.length - 1 && (
                            <button
                              type="button"
                              onClick={() => send("Please check that answer against real data from the app and show the numbers you used.")}
                              disabled={loading}
                              className="rounded-full border border-brand-line px-2.5 py-1 font-semibold text-brand transition hover:bg-brand-soft disabled:opacity-50"
                            >
                              Check it with real data
                            </button>
                          )}
                          <span className="ml-auto"><Feedback feature="coach" level={m.insight.confidence.level} compact /></span>
                        </div>
                      )}
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
          <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-line bg-ink py-1.5 pl-5 pr-1.5 transition focus-within:border-brand">
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
              className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-brand-ink transition hover:bg-brand-light disabled:opacity-30"
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
