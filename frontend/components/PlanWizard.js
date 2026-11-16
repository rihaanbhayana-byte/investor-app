"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

const KEYFRAMES = `
@keyframes sw-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes sw-pop { from { opacity: 0; transform: translateY(24px) scale(0.96) } to { opacity: 1; transform: none } }
@keyframes sw-right { from { opacity: 0; transform: translateX(48px) } to { opacity: 1; transform: none } }
@keyframes sw-left { from { opacity: 0; transform: translateX(-48px) } to { opacity: 1; transform: none } }
@keyframes sw-pulse { 0% { transform: scale(1) } 40% { transform: scale(1.04) } 100% { transform: scale(1) } }
@keyframes sw-stagger { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
`;

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

const ICONS = {
  "Grow my wealth": <><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></>,
  Retirement: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  "Buying a home": <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  Education: <><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c3 2 9 2 12 0v-5" /></>,
  "A big purchase": <><path d="M6 7h12l1 14H5z" /><path d="M9 7a3 3 0 0 1 6 0" /></>,
  market_drop: <><path d="M3 7l6 6 4-4 8 8" /><path d="M21 11v6h-6" /></>,
  priority: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  experience: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />,
  income: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  emergency_fund: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  sparkle: <path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" />,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M16 13h2" /><path d="M3 10h18" /></>,
};

export const GOALS = ["Grow my wealth", "Retirement", "Buying a home", "Education", "A big purchase"];

const EXAMPLES = [
  ["House in 6 years", "I'm 22 and want to buy a house in about 6 years. I have $2,000 saved and can invest $250 a month."],
  ["Retirement", "I want to grow my money for retirement over 30 years. I can start with $500 and add $150 a month."],
  ["A car", "Saving for a car in 3 years. I have $1,000 and can add $100 a month."],
];

function Icon({ name, size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      {ICONS[name] || ICONS.sparkle}
    </svg>
  );
}

function KeyBadge({ n }) {
  return (
    <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-xs font-semibold text-muted sm:flex">
      {n}
    </span>
  );
}

function SliderField({ id, label, value, setValue, min, max, cap = max, step, prefix = "", suffix = "" }) {
  return (
    <div className="rounded-2xl border border-line bg-ink p-5">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</label>
        <div className="flex items-baseline gap-0.5 rounded-xl px-2 py-1 font-display text-3xl font-bold tabular-nums focus-within:bg-slate-100">
          {prefix && <span className="text-muted">{prefix}</span>}
          <input
            type="text"
            inputMode="numeric"
            aria-label={label}
            value={value}
            onChange={(e) => setValue(Math.min(cap, Math.max(min, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)))}
            style={{ width: `${Math.max(String(value).length, 1) + 0.6}ch` }}
            className="bg-transparent text-right [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {suffix && <span className="ml-1.5 text-lg text-muted">{suffix}</span>}
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(value, max)}
        onChange={(e) => setValue(Number(e.target.value))}
        className="mt-4 w-full cursor-pointer accent-mint"
      />
      {cap !== max && value >= cap && (
        <p className="mt-2 text-xs text-muted">That&rsquo;s the most this calculator handles ({prefix}{cap.toLocaleString()}{suffix && ` ${suffix}`}).</p>
      )}
    </div>
  );
}

export default function PlanWizard({ questions, startMode, initial, onClose, onFinish }) {
  const [mode, setMode] = useState(startMode);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [goal, setGoal] = useState(initial.goal);
  const [initialAmount, setInitialAmount] = useState(initial.initialAmount);
  const [monthly, setMonthly] = useState(initial.monthly);
  const [years, setYears] = useState(initial.years);
  const [answers, setAnswers] = useState({});
  const [picked, setPicked] = useState(null);
  const [aiText, setAiText] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const nothingToInvest = initialAmount <= 0 && monthly <= 0;

  // Closing by accident shouldn't throw away answers: ask first once the user has made progress.
  function requestClose() {
    if (index > 0 || aiText.trim()) setConfirmClose(true);
    else onClose();
  }

  const screens = [mode === "ai" ? "ai" : "goal", "money", ...questions.map((q) => q.id)];
  const screen = screens[index];
  const question = questions.find((q) => q.id === screen);
  const qNumber = question ? questions.indexOf(question) + 1 : 0;

  function go(delta) {
    setDir(delta);
    setIndex((i) => Math.min(Math.max(i + delta, 0), screens.length - 1));
  }

  function back() {
    if (index === 0) requestClose();
    else go(-1);
  }

  function pickGoal(g) {
    if (picked) return;
    setGoal(g);
    setPicked(g);
    setTimeout(() => {
      setPicked(null);
      go(1);
    }, 320);
  }

  function pickOption(q, optionId) {
    if (picked) return;
    const next = { ...answers, [q.id]: optionId };
    setAnswers(next);
    setPicked(optionId);
    setTimeout(() => {
      setPicked(null);
      if (index === screens.length - 1) onFinish({ goal, years, initialAmount, monthly, answers: next });
      else go(1);
    }, 380);
  }

  async function readGoal() {
    setAiLoading(true);
    setAiError("");
    setAiSummary("");
    try {
      const r = await api.parseGoal({ text: aiText });
      setGoal(r.goal);
      setInitialAmount(r.initial_amount);
      setMonthly(r.monthly_contribution);
      setYears(r.years);
      setAiSummary(r.summary);
      setTimeout(() => go(1), 1100);
    } catch (e) {
      setAiError(e.message);
    }
    setAiLoading(false);
  }

  // Keyboard shortcuts: Esc closes, 1-9 picks an answer, Enter continues on the money screen.
  const keyHandler = useRef(() => {});
  useEffect(() => {
    keyHandler.current = (e) => {
      if (e.key === "Escape") return confirmClose ? setConfirmClose(false) : requestClose();
      if (confirmClose) return;
      const typing = ["TEXTAREA", "INPUT"].includes(e.target.tagName) && e.target.type !== "range";
      if (screen === "money" && e.key === "Enter") return nothingToInvest ? null : go(1);
      if (typing) return;
      const n = Number(e.key);
      if (!n) return;
      if (screen === "goal" && GOALS[n - 1]) pickGoal(GOALS[n - 1]);
      if (question && question.options[n - 1]) pickOption(question, question.options[n - 1].id);
    };
  });
  useEffect(() => {
    const handle = (e) => keyHandler.current(e);
    window.addEventListener("keydown", handle);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handle);
      document.body.style.overflow = previous;
    };
  }, []);

  const slide = dir > 0 ? "motion-safe:animate-[sw-right_0.35s_ease-out_both]" : "motion-safe:animate-[sw-left_0.35s_ease-out_both]";
  const eyebrow = "text-[13px] font-semibold uppercase tracking-[0.14em] text-mint";
  const title = "mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-3 backdrop-blur-md motion-safe:animate-[sw-fade_0.25s_ease-out_both] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      <style>{KEYFRAMES}</style>
      <div className="relative flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-line bg-surface shadow-float motion-safe:animate-[sw-pop_0.4s_cubic-bezier(.2,.9,.3,1.15)_both]">
        <div className="flex items-center gap-4 px-5 pt-5 sm:px-8">
          <button onClick={back} aria-label="Back" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-slate-100 hover:text-fg">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...STROKE}><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="flex flex-1 gap-1.5" aria-label={`Step ${index + 1} of ${screens.length}`}>
            {screens.map((s, i) => (
              <div key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full bg-mint transition-all duration-500 ${i <= index ? "w-full" : "w-0"}`} />
              </div>
            ))}
          </div>
          <button onClick={requestClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-slate-100 hover:text-fg">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...STROKE}><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {confirmClose && (
          <div role="alertdialog" aria-labelledby="leave-title" className="absolute inset-0 z-10 flex items-center justify-center bg-surface/90 p-6 backdrop-blur-sm motion-safe:animate-[sw-fade_0.2s_ease-out_both]">
            <div className="max-w-sm text-center">
              <h3 id="leave-title" className="font-display text-2xl font-bold">Leave your plan?</h3>
              <p className="mt-2 text-muted">You&rsquo;ll lose the answers you&rsquo;ve given so far.</p>
              <div className="mt-6 flex justify-center gap-3">
                <button autoFocus onClick={() => setConfirmClose(false)} className="rounded-full bg-mint px-6 py-3 font-semibold text-mint-ink transition hover:bg-mint-light">Keep going</button>
                <button onClick={onClose} className="rounded-full border border-line px-6 py-3 text-muted transition hover:border-slate-300 hover:text-fg">Leave</button>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-y-auto px-5 pb-8 pt-6 sm:px-10 sm:pb-10">
          <div key={`${mode}-${index}`} className={slide}>
            {screen === "ai" && (
              <div>
                <div className={`flex items-center gap-2 ${eyebrow}`}><Icon name="sparkle" size={16} /> Fastest way · AI</div>
                <h2 id="wizard-title" className={title}>Tell us your goal in your own words.</h2>
                <p className="mt-2.5 text-muted">One or two sentences. What you&rsquo;re saving for, how much you have, how much you can add, and when.</p>
                <textarea
                  autoFocus
                  rows={4}
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  placeholder={EXAMPLES[0][1]}
                  className="mt-6 w-full resize-none rounded-2xl border border-line bg-ink px-5 py-4 text-lg text-fg placeholder:text-slate-500 focus:border-mint focus:outline-none"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-muted">Try:</span>
                  {EXAMPLES.map(([label, text]) => (
                    <button key={label} type="button" onClick={() => setAiText(text)} className="rounded-full border border-slate-300 px-3 py-1.5 text-[13px] text-slate-700 transition hover:border-mint hover:text-mint">
                      {label}
                    </button>
                  ))}
                </div>
                {aiSummary ? (
                  <div className="mt-6 flex items-start gap-3 rounded-2xl border border-mint-line bg-green-50 p-4 motion-safe:animate-[sw-pulse_0.5s_ease-out]">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint text-mint-ink">
                      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" {...STROKE} strokeWidth={3}><path d="M5 12l5 5 9-10" /></svg>
                    </span>
                    <p className="text-slate-800"><span className="font-semibold text-mint">Got it! </span>{aiSummary}</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={readGoal}
                    disabled={aiLoading || aiText.trim().length < 5}
                    className="mt-6 w-full rounded-full bg-mint px-6 py-4 text-base font-semibold text-mint-ink transition hover:bg-mint-light disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {aiLoading ? "Reading your goal..." : "Read my goal →"}
                  </button>
                )}
                {aiError && <p className="mt-3 text-sm text-red-600">{aiError}</p>}
                <button type="button" onClick={() => { setMode("manual"); setIndex(0); setDir(1); }} className="mt-5 w-full text-center text-sm text-muted hover:text-fg">
                  Rather pick from a list? Answer step by step
                </button>
              </div>
            )}

            {screen === "goal" && (
              <div>
                <div className={eyebrow}>Your goal</div>
                <h2 id="wizard-title" className={title}>What are you saving for?</h2>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {GOALS.map((g, i) => {
                    const on = goal === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        aria-pressed={on}
                        onClick={() => pickGoal(g)}
                        style={{ animationDelay: `${i * 50}ms` }}
                        className={`flex items-center gap-4 rounded-2xl border-2 p-4 text-left text-[17px] font-medium transition motion-safe:animate-[sw-stagger_0.35s_ease-out_both] ${
                          on ? "border-mint bg-mint/10" : "border-line bg-ink hover:-translate-y-0.5 hover:border-slate-300"
                        } ${picked === g ? "motion-safe:animate-[sw-pulse_0.35s_ease-out]!" : ""}`}
                      >
                        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${on ? "bg-mint text-mint-ink" : "bg-slate-100 text-mint"}`}>
                          <Icon name={g} />
                        </span>
                        <span className="flex-1">{g}</span>
                        <KeyBadge n={i + 1} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {screen === "money" && (
              <div>
                <div className={`flex items-center gap-2 ${eyebrow}`}><Icon name="wallet" size={16} /> Your numbers</div>
                <h2 id="wizard-title" className={title}>How much can you invest?</h2>
                <p className="mt-2.5 text-muted">
                  For <span className="font-semibold text-fg">{goal}</span>. Drag the sliders or type a number. You can change this later.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <SliderField id="start" label="Start with" value={initialAmount} setValue={setInitialAmount} min={0} max={50000} cap={10000000} step={100} prefix="$" />
                  <SliderField id="monthly" label="Add each month" value={monthly} setValue={setMonthly} min={0} max={5000} cap={100000} step={10} prefix="$" />
                  <SliderField id="years" label="For how long" value={years} setValue={(v) => setYears(Math.min(50, Math.max(1, v)))} min={1} max={40} step={1} suffix={years === 1 ? "year" : "years"} />
                </div>
                {nothingToInvest ? (
                  <div role="alert" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-slate-800">
                    Add a starting amount or a monthly amount (even $10 counts) so there&rsquo;s something to grow.
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-mint-line bg-green-50 px-5 py-4 text-slate-800">
                    You&rsquo;ll put in <span className="font-semibold text-mint">{money(initialAmount + monthly * 12 * years)}</span> over {years} {years === 1 ? "year" : "years"}. Next, let&rsquo;s see how it could grow.
                  </div>
                )}
                <button onClick={() => go(1)} disabled={nothingToInvest} className="mt-6 w-full rounded-full bg-mint px-6 py-4 text-base font-semibold text-mint-ink transition hover:bg-mint-light disabled:cursor-not-allowed disabled:opacity-40">
                  Continue →
                </button>
              </div>
            )}

            {question && (
              <div>
                <div className={eyebrow}>Investor personality · {qNumber} of {questions.length}</div>
                <div className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-mint/15 text-mint">
                  <Icon name={question.id} size={28} />
                </div>
                <h2 id="wizard-title" className={title}>{question.text}</h2>
                <p className="mt-2.5 text-muted">No wrong answers. Tap one, or press its number.</p>
                <div role="radiogroup" aria-labelledby="wizard-title" className="mt-6 flex flex-col gap-3">
                  {question.options.map((o, i) => {
                    const on = answers[question.id] === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => pickOption(question, o.id)}
                        style={{ animationDelay: `${i * 60}ms` }}
                        className={`flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left text-[17px] font-medium transition motion-safe:animate-[sw-stagger_0.35s_ease-out_both] ${
                          on ? "border-mint bg-mint/10" : "border-line bg-ink hover:-translate-y-0.5 hover:border-slate-300"
                        } ${picked === o.id ? "motion-safe:animate-[sw-pulse_0.35s_ease-out]!" : ""}`}
                      >
                        <KeyBadge n={i + 1} />
                        <span className="flex-1">{o.text}</span>
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-mint bg-mint text-mint-ink" : "border-slate-300"}`}>
                          {on && <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" {...STROKE} strokeWidth={4}><path d="M5 12l5 5 9-10" /></svg>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
