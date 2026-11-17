"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { price, percent } from "../lib/format";

const GOAL_EXAMPLES = [
  "I'm 17, I have $500 and can add $50 a month for 10 years",
  "A house deposit in 6 years: I have $2,000 and can save $250 a month",
  "Retire comfortably. I'm 25 and can invest $300 a month",
];

// The first thing on the page: tell the AI your goal in your own words.
function GoalBox() {
  const router = useRouter();
  const [text, setText] = useState("");
  const ready = text.trim().length >= 5;
  function go(e) {
    e.preventDefault();
    if (ready) router.push(`/plan?goal=${encodeURIComponent(text.trim())}`);
  }
  return (
    <form onSubmit={go} className="mt-8 rounded-2xl border border-line bg-surface p-2 shadow-float focus-within:border-brand">
      <label htmlFor="goal" className="sr-only">Your money goal, in your own words</label>
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <span className="ml-3 hidden text-brand sm:block" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" /></svg>
        </span>
        <input
          id="goal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          autoComplete="off"
          placeholder="Tell me your money goal…"
          className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-base text-fg placeholder:text-slate-500 focus:outline-none"
        />
        <button disabled={!ready} className="w-full rounded-xl bg-brand px-6 py-3.5 text-base font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50 sm:w-auto">
          Build my plan →
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 pb-1.5 pt-3">
        <span className="text-xs text-muted">Try:</span>
        {GOAL_EXAMPLES.map((g) => (
          <button key={g} type="button" onClick={() => setText(g)} className="max-w-full truncate rounded-full border border-line px-3 py-1 text-xs text-slate-700 transition hover:border-brand hover:text-brand">
            {g}
          </button>
        ))}
      </div>
    </form>
  );
}

const STEPS = [
  { n: "01", title: "Say your goal, your way", text: "“I want a house deposit in 6 years and can save $250 a month.” Our AI turns that into a plan." },
  { n: "02", title: "Find your investor personality", text: "A few quick questions reveal how much risk fits you: Steady Saver, Balanced Builder or Growth Seeker." },
  { n: "03", title: "Watch your future unfold", text: "See good, likely and bad outcomes from 5,000 simulations on real market history since 2016." },
];

const FEATURES = [
  {
    href: "/practice",
    title: "Practice portfolio",
    text: "Get $10,000 of play money and invest it at real prices. Learn by doing, with zero risk.",
    demo: <>Can you beat the S&amp;P 500? <span className="font-semibold text-brand">Start practicing →</span></>,
    icon: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M16 13h2" /><path d="M3 10h18" /></>,
  },
  {
    href: "/tools?tab=crash",
    title: "Crash test",
    text: "Replay the 2020 COVID crash on your plan, month by month. Would you have panicked?",
    demo: <>Hold, sell or buy more? <span className="font-semibold text-brand">You decide.</span></>,
    icon: <><path d="M3 7l6 6 4-4 8 8" /><path d="M21 11v6h-6" /></>,
  },
  {
    href: "/tools?tab=strategy",
    title: "AI strategy lab",
    text: "Describe a strategy in plain English. The AI turns it into rules and tests it on real prices since 2016.",
    demo: <>&ldquo;$200 a month, extra when it drops 10%&rdquo;</>,
    icon: <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /></>,
  },
  {
    href: "/coach",
    title: "AI Coach",
    text: "Ask anything: “What’s an ETF?” “Why is my plan 35% bonds?” It looks up real numbers before it answers.",
    demo: <>You: Compare Apple and Microsoft →</>,
    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  },
  {
    href: "/tools",
    title: "Time Machine",
    text: "What if you’d invested back then? Pick any stock and a start date, and see it against the S&P 500.",
    demo: <>$1,000 in NVDA (2016) → <span className="font-semibold text-brand">$223,625</span></>,
    icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  },
  {
    href: "/learn",
    title: "Learn in 7 lessons",
    text: "Bite-sized lessons with quick quizzes, from “what is a stock” to opening your first account.",
    icon: <><path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /></>,
  },
];

function Icon({ children }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function TickerItem({ s }) {
  const up = s.return_1y >= 0;
  return (
    <span className="flex items-center gap-2 whitespace-nowrap text-sm">
      <span className="font-semibold text-fg">{s.symbol}</span>
      <span className="text-muted">{price(s.latest_price)}</span>
      <span className={up ? "text-gain" : "text-loss"}>
        {up ? "▲" : "▼"} {percent(Math.abs(s.return_1y))}
      </span>
    </span>
  );
}

export default function Home() {
  const [tickers, setTickers] = useState([]);

  useEffect(() => {
    api
      .stocks()
      .then((d) => {
        const list = Array.isArray(d) ? d : d?.stocks || [];
        setTickers(list.filter((s) => s.latest_price != null && s.return_1y != null));
      })
      .catch(() => {});
  }, []);

  return (
    <div data-layout="marketing" className="flex flex-col gap-24">
      {/* HERO */}
      <section className="flex flex-wrap items-center gap-14 overflow-x-clip pt-6">
        <div className="min-w-0 flex-[1_1_440px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] text-slate-700">
            <span className="h-2 w-2 rounded-full bg-brand" />
            AI-powered · Real US market data · Free
          </div>
          <h1 className="mt-6 text-[clamp(2.5rem,5.4vw,4rem)] font-bold leading-[1.05] tracking-[-0.035em]">
            Tell us your goal. <span className="text-gradient">Get a real plan</span> in 2 minutes.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Type your goal in plain words. Seedwise&rsquo;s AI reads it, builds a beginner-friendly portfolio, and shows
            good, likely and bad outcomes from 5,000 simulations on real market data.
          </p>
          <GoalBox />
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link href="/plan?mode=manual" className="font-medium text-muted underline-offset-4 hover:text-fg hover:underline">Rather answer step by step</Link>
            <Link href="/tools" className="font-medium text-muted underline-offset-4 hover:text-fg hover:underline">Try the Time Machine</Link>
            <span className="text-slate-500">Free · Educational only, not financial advice</span>
          </div>
        </div>

        <div className="relative min-w-0 flex-[1_1_440px]">
          <div className="relative rounded-3xl border border-line bg-surface p-7 shadow-float">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] text-muted">Balanced Builder · $5,000 + $150/month</div>
              <div className="mt-1.5 font-display text-4xl font-bold tracking-tight">$40,500</div>
              <div className="mt-1 text-sm text-brand">Likely value in 10 years</div>
            </div>
            <div className="rounded-full bg-brand/10 px-3 py-1.5 text-[13px] font-semibold text-brand">9.1% past avg / yr</div>
          </div>
          <svg viewBox="0 0 440 200" className="mt-5 h-auto w-full" role="img" aria-label="Example projection: a range of outcomes widening over time, with the likely path rising above the money put in">
            <path d="M0 170 C 120 150, 260 110, 440 40 L 440 130 C 260 150, 120 165, 0 170 Z" fill="color-mix(in srgb, var(--color-brand) 16%, transparent)" />
            <path d="M0 170 C 120 158, 260 132, 440 86" stroke="var(--color-brand)" strokeWidth="3" fill="none" />
            <path d="M0 170 L 440 128" stroke="var(--color-dim)" strokeWidth="2" strokeDasharray="6 6" fill="none" />
          </svg>
          <div className="mt-2 flex flex-wrap gap-5 text-[13px] text-muted">
            <span className="flex items-center gap-2"><span className="h-[3px] w-4 bg-brand" />Likely path</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-4 rounded-sm bg-brand/25" />Range of outcomes</span>
            <span className="flex items-center gap-2"><span className="w-4 border-t-2 border-dashed border-dim" />Money you put in</span>
          </div>
        </div>
        </div>
      </section>

      {/* LIVE TICKER */}
      <section aria-label="Market prices and 1-year returns" aria-busy={tickers.length === 0} className="-mt-10 h-[54px] overflow-hidden rounded-2xl border border-line bg-surface-2 py-4">
        {tickers.length > 0 ? (
          <div className="flex w-max gap-10 px-6 animate-[seedwise-marquee_70s_linear_infinite] hover:[animation-play-state:paused] motion-reduce:animate-none">
            {[...tickers, ...tickers].map((s, i) => (
              <TickerItem key={i} s={s} />
            ))}
          </div>
        ) : (
          <div className="flex gap-10 px-6" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="h-5 w-40 shrink-0 animate-pulse rounded-full bg-line" />
            ))}
          </div>
        )}
        <style>{`@keyframes seedwise-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
      </section>

      {/* HOW IT WORKS */}
      <section className="reveal">
        <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-brand">How it works</div>
        <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">From “I want to start investing” to a real plan.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-3xl border border-line bg-surface p-7 transition hover:-translate-y-1 hover:border-brand/40">
              <div className="text-gradient font-display text-3xl font-bold">{s.n}</div>
              <h3 className="mt-3.5 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2.5 leading-relaxed text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="reveal">
        <h2 className="font-display text-4xl font-bold tracking-tight">Tools that make investing click.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="group flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-8 transition hover:-translate-y-1 hover:border-brand/40"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/12 transition duration-300 group-hover:scale-110 group-hover:bg-brand/20"><Icon>{f.icon}</Icon></span>
              <h3 className="text-[22px] font-semibold">{f.title}</h3>
              <p className="leading-relaxed text-muted">{f.text}</p>
              {f.demo && (
                <div className="rounded-xl border border-line bg-ink px-4 py-3.5 text-sm text-slate-700">{f.demo}</div>
              )}
              <span className="mt-auto text-sm font-medium text-brand opacity-0 transition group-hover:opacity-100">Open →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="reveal flex flex-wrap items-center justify-between gap-6 rounded-[28px] border border-brand-line bg-glow p-10 sm:p-14">
        <div className="min-w-0 flex-[1_1_400px]">
          <h2 className="font-display text-4xl font-bold tracking-tight">Your first plan is 2 minutes away.</h2>
          <p className="mt-2.5 text-lg text-muted">Free, private and built for complete beginners.</p>
        </div>
        <Link href="/plan" className="rounded-full bg-brand px-7 py-4 text-base font-semibold text-brand-ink transition hover:bg-brand-light">
          Build my plan →
        </Link>
      </section>
    </div>
  );
}