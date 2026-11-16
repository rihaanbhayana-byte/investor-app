"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RISE } from "@/components/ui";

const LESSONS = [
  {
    title: "Build a safety net first",
    minutes: 1,
    text: "Before investing, keep 3 to 6 months of expenses in a savings account. Investments can drop, and you don't want to be forced to sell at a bad time.",
    key: "Invest money you won't need soon. Emergencies come out of savings, not investments.",
    quiz: {
      q: "Why keep an emergency fund before you invest?",
      options: ["So you're never forced to sell investments at a bad time", "Because savings accounts always beat stocks", "Because brokers require one to open an account"],
      answer: 0,
    },
  },
  {
    title: "Choose the type of account",
    minutes: 2,
    text: "A regular brokerage account lets you withdraw any time. Retirement accounts such as a Roth IRA (you need earned income) or a 401(k) through work have tax benefits but rules on withdrawals.",
    key: "Saving for retirement? Look at a Roth IRA or 401(k) first. Saving for something sooner? A regular brokerage account.",
    quiz: {
      q: "Which of these has tax benefits but rules on when you can withdraw?",
      options: ["A regular brokerage account", "A Roth IRA", "A checking account"],
      answer: 1,
    },
  },
  {
    title: "Open an account with a broker",
    minutes: 2,
    text: "Large, low-cost brokers include Fidelity, Charles Schwab and Vanguard. Look for no account fees, no trading commissions, and fractional shares so you can invest small amounts.",
    key: "Fees quietly eat your growth. Pick a broker with no account fees and no commissions.",
    quiz: {
      q: "What lets you invest $50 in a fund that costs $500 per share?",
      options: ["Trading commissions", "Fractional shares", "A margin account"],
      answer: 1,
    },
  },
  {
    title: "Add money",
    minutes: 1,
    text: "Link your bank account and transfer the amount you chose in your plan.",
    key: "Start with what your plan says. Even small amounts grow over time.",
    quiz: {
      q: "Where should the money you invest come from?",
      options: ["Your emergency fund", "A credit card", "Money you won't need during your plan's timeframe"],
      answer: 2,
    },
  },
  {
    title: "Buy the funds in your plan",
    minutes: 2,
    text: "Search each ticker from your plan (for example VTI, BND, VXUS), enter the dollar amount that matches its share, and place the order.",
    key: "Split each deposit using your plan's percentages.",
    quiz: {
      q: "Your plan says 45% VTI. You invest $200. How much goes into VTI?",
      options: ["$45", "$90", "$200"],
      answer: 1,
    },
  },
  {
    title: "Automate your monthly amount",
    minutes: 1,
    text: "Set up an automatic monthly transfer and investment. Investing a fixed amount regularly is called dollar-cost averaging.",
    key: "Automation beats willpower. Set it once and let it run.",
    quiz: {
      q: "Investing the same amount every month, whatever the market does, is called...",
      options: ["Dollar-cost averaging", "Day trading", "Market timing"],
      answer: 0,
    },
  },
  {
    title: "Stay the course and rebalance once a year",
    minutes: 2,
    text: "Markets go up and down. Once a year, check whether your mix has drifted from your plan's percentages and adjust it back.",
    key: "Drops are normal. Selling in a panic is how most beginners lose money.",
    quiz: {
      q: "Your stocks grew, so they're now a bigger share than your plan says. Rebalancing means...",
      options: ["Selling everything and waiting", "Moving some money back so the mix matches your plan again", "Buying even more stocks"],
      answer: 1,
    },
  },
];

const TERMS = [
  ["Stock", "A small piece of ownership in one company."],
  ["Bond", "A loan to a government or company that pays interest. Usually steadier than stocks."],
  ["ETF", "A fund that holds many stocks or bonds at once and trades like a single stock."],
  ["Index fund", "A fund that copies a whole market index, like the S&P 500, instead of picking stocks."],
  ["Diversification", "Spreading money across many investments so one bad result hurts less."],
  ["Volatility", "How much prices swing up and down. Higher volatility means a bumpier ride."],
  ["Compound growth", "Earning returns on your past returns, so growth speeds up over time."],
  ["Dividend", "A share of a company's profits paid out to people who own its stock."],
];

const STORE = "seedwise-learn";

function Check({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function Lesson({ lesson, index, open, done, onToggle, onComplete }) {
  const [picked, setPicked] = useState(null);
  const correct = picked === lesson.quiz.answer;

  return (
    <li className={`overflow-hidden rounded-3xl border transition ${open ? "border-slate-300 bg-surface" : done ? "border-[#23493A] bg-surface" : "border-line bg-surface hover:border-slate-300"}`}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-4 p-5 text-left sm:p-6">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display font-bold transition ${
            done ? "bg-mint text-mint-ink" : open ? "border-2 border-mint text-mint" : "border-2 border-slate-300 text-muted"
          }`}
        >
          {done ? <Check size={18} /> : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-bold">{lesson.title}</span>
          <span className="text-sm text-muted">{done ? "Completed" : `${lesson.minutes} min read · 1 question`}</span>
        </span>
        <svg className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="flex flex-col gap-5 px-5 pb-6 motion-safe:animate-[sw-rise_0.3s_ease-out_both] sm:px-6 sm:pl-[84px]">
          <p className="text-lg leading-relaxed text-slate-800">{lesson.text}</p>
          <div className="flex gap-3 rounded-2xl border border-[#23493A] bg-green-50 p-4">
            <svg className="mt-0.5 shrink-0 text-mint" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
            </svg>
            <p className="text-slate-800"><span className="font-semibold text-mint">Key idea: </span>{lesson.key}</p>
          </div>

          <fieldset className="rounded-2xl border border-line bg-ink p-5">
            <legend className="px-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-mint">Quick check</legend>
            <p className="font-semibold">{lesson.quiz.q}</p>
            <div className="mt-4 flex flex-col gap-2.5">
              {lesson.quiz.options.map((o, i) => {
                const chosen = picked === i;
                const isAnswer = i === lesson.quiz.answer;
                const state = picked == null ? "idle" : chosen && isAnswer ? "right" : chosen ? "wrong" : isAnswer && picked != null && !correct ? "hint" : "idle";
                return (
                  <button
                    key={o}
                    onClick={() => {
                      setPicked(i);
                      if (isAnswer) onComplete();
                    }}
                    disabled={correct}
                    className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
                      state === "right"
                        ? "border-mint bg-mint/10"
                        : state === "wrong"
                          ? "border-red-200 bg-red-50"
                          : "border-line hover:border-slate-300"
                    }`}
                  >
                    {o}
                    {state === "right" && <span className="text-mint"><Check /></span>}
                  </button>
                );
              })}
            </div>
            {picked != null && (
              <p className={`mt-3 text-sm ${correct ? "text-mint" : "text-red-600"}`}>
                {correct ? "Correct! Lesson complete." : "Not quite. Have another look at the lesson and try again."}
              </p>
            )}
          </fieldset>
        </div>
      )}
    </li>
  );
}

function FlipCard({ term, meaning }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped(!flipped)}
      aria-pressed={flipped}
      aria-label={`${term}. ${flipped ? meaning : "Tap to see the meaning."}`}
      className="group h-36 [perspective:1000px]"
    >
      <span
        className="relative block h-full w-full rounded-3xl transition duration-500 [transform-style:preserve-3d]"
        style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
      >
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-3xl border border-line bg-surface p-4 [backface-visibility:hidden] group-hover:border-slate-300">
          <span className="font-display text-xl font-bold">{term}</span>
          <span className="text-xs text-muted">Tap to flip</span>
        </span>
        <span className="absolute inset-0 flex items-center justify-center rounded-3xl border border-[#23493A] bg-[#10241C] p-5 text-center text-sm leading-relaxed text-slate-800 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          {meaning}
        </span>
      </span>
    </button>
  );
}

export default function LearnPage() {
  const [done, setDone] = useState([]);
  const [open, setOpen] = useState(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "[]");
      if (Array.isArray(saved)) {
        setDone(saved);
        const firstOpen = LESSONS.findIndex((_, i) => !saved.includes(i));
        setOpen(firstOpen === -1 ? null : firstOpen);
      }
    } catch {}
  }, []);

  function complete(i) {
    const next = done.includes(i) ? done : [...done, i];
    setDone(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {}
    setTimeout(() => {
      const nextOpen = LESSONS.findIndex((_, j) => !next.includes(j));
      setOpen(nextOpen === -1 ? null : nextOpen);
    }, 1200);
  }

  function reset() {
    setDone([]);
    setOpen(0);
    try {
      localStorage.removeItem(STORE);
    } catch {}
  }

  const progress = Math.round((done.length / LESSONS.length) * 100);
  const allDone = done.length === LESSONS.length;

  return (
    <div className="flex flex-col gap-10">
      <style>{RISE}</style>
      <section className="flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-2xl">
          <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mint">Learn</div>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Learn to invest in 7 short lessons.</h1>
          <p className="mt-3 text-lg text-muted">From &ldquo;where do I start?&rdquo; to your first investment. About 10 minutes in total.</p>
        </div>
        <div className="flex items-center gap-5 rounded-3xl border border-line bg-surface p-5">
          <div className="relative h-20 w-20">
            <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90" aria-hidden="true">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#1A222C" strokeWidth="3.5" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#3DDC97"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={`${(progress / 100) * 97.4} 97.4`}
                className="transition-all duration-700"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold">{progress}%</span>
          </div>
          <div>
            <div className="font-display text-xl font-bold">{done.length} of {LESSONS.length} done</div>
            <div className="text-sm text-muted">{allDone ? "You finished the course!" : "Your progress is saved on this device."}</div>
            {done.length > 0 && (
              <button onClick={reset} className="mt-1 text-xs text-muted underline hover:text-fg">Start over</button>
            )}
          </div>
        </div>
      </section>

      {allDone && (
        <section className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-[#23493A] bg-[radial-gradient(130%_140%_at_0%_0%,#17402F_0%,#10171F_60%)] p-8 motion-safe:animate-[sw-rise_0.4s_ease-out_both]">
          <div>
            <h2 className="font-display text-2xl font-bold">Course complete. You know the basics!</h2>
            <p className="mt-1 text-muted">Now put it to work: build a plan and see your numbers.</p>
          </div>
          <Link href="/plan" className="rounded-full bg-mint px-6 py-3.5 font-semibold text-mint-ink transition hover:bg-mint-light">Build my plan →</Link>
        </section>
      )}

      <ol className="flex flex-col gap-3">
        {LESSONS.map((lesson, i) => (
          <Lesson
            key={lesson.title}
            lesson={lesson}
            index={i}
            open={open === i}
            done={done.includes(i)}
            onToggle={() => setOpen(open === i ? null : i)}
            onComplete={() => complete(i)}
          />
        ))}
      </ol>

      <section>
        <h2 className="font-display text-2xl font-bold">Words to know</h2>
        <p className="mt-1 text-muted">Tap a card to flip it.</p>
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          {TERMS.map(([term, meaning]) => (
            <FlipCard key={term} term={term} meaning={meaning} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Link href="/coach" className="flex items-center justify-between rounded-3xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-mint/40">
          <span>
            <span className="block font-semibold">Still confused about something?</span>
            <span className="text-sm text-muted">Ask the AI Coach in your own words.</span>
          </span>
          <span className="text-mint">→</span>
        </Link>
        <Link href="/plan" className="flex items-center justify-between rounded-3xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-mint/40">
          <span>
            <span className="block font-semibold">Ready for numbers?</span>
            <span className="text-sm text-muted">Build your plan in about 2 minutes.</span>
          </span>
          <span className="text-mint">→</span>
        </Link>
      </section>
    </div>
  );
}
