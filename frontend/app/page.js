"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { price, percent } from "../lib/format";

const STEPS = [
  { n: "01", title: "Say your goal, your way", text: "“I want a house deposit in 6 years and can save $250 a month.” Our AI turns that into a plan." },
  { n: "02", title: "Find your investor personality", text: "A few quick questions reveal how much risk fits you: Steady Saver, Balanced Builder or Growth Seeker." },
  { n: "03", title: "Watch your future unfold", text: "See good, likely and bad outcomes from 5,000 simulations on real market history since 2016." },
];

const FEATURES = [
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
    demo: <>$1,000 in NVDA (2016) → <span className="font-semibold text-mint">$223,625</span></>,
    icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  },
  {
    href: "/stocks",
    title: "Explore any US stock",
    text: "Search thousands of companies. Charts, 10 years of financials and a plain-English AI summary.",
    icon: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></>,
  },
  {
    href: "/learn",
    title: "Learn in 7 lessons",
    text: "Bite-sized lessons from “what is a stock” to opening your first account.",
    icon: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />,
  },
];

function Icon({ children }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3DDC97" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <span className={up ? "text-mint" : "text-red-600"}>
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
    <div className="flex flex-col gap-24">
      {/* HERO */}
      <section className="flex flex-wrap items-center gap-14 pt-6">
        <div className="min-w-0 flex-[1_1_440px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] text-slate-700">
            <span className="h-2 w-2 rounded-full bg-mint" />
            AI-powered · Real US market data · Free
          </div>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.03] tracking-tight sm:text-6xl">
            See where your money could be in <span className="text-mint">10 years.</span>
            <br />
            In 2 minutes.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Tell Seedwise your goal in plain words. Get a beginner-friendly portfolio, a projection built from 5,000
            simulated futures, and an AI coach that explains every number.
          </p>
          <div className="mt-8 flex flex-wrap gap-3.5">
            <Link href="/plan" className="rounded-full bg-mint px-7 py-4 text-base font-semibold text-mint-ink transition hover:bg-mint-light">
              Build my plan →
            </Link>
            <Link href="/tools" className="rounded-full border border-slate-300 px-7 py-4 text-base font-medium text-fg transition hover:border-mint hover:text-mint">
              Try the Time Machine
            </Link>
          </div>
          <p className="mt-5 text-[13px] text-slate-500">No credit card. Educational only, not financial advice.</p>
        </div>

        <div className="min-w-0 flex-[1_1_440px] rounded-3xl border border-line bg-gradient-to-b from-[#121A23] to-[#0E141B] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] text-muted">Balanced Builder · Example plan</div>
              <div className="mt-1.5 font-display text-4xl font-bold tracking-tight">$27,200</div>
              <div className="mt-1 text-sm text-mint">Likely value in 6 years</div>
            </div>
            <div className="rounded-full bg-mint/10 px-3 py-1.5 text-[13px] font-semibold text-mint">9.1% avg / yr</div>
          </div>
          <svg viewBox="0 0 440 200" className="mt-5 h-auto w-full" role="img" aria-label="Example projection: a range of outcomes widening over time, with the likely path rising above the money put in">
            <path d="M0 170 C 120 150, 260 110, 440 40 L 440 130 C 260 150, 120 165, 0 170 Z" fill="rgba(61,220,151,0.14)" />
            <path d="M0 170 C 120 158, 260 132, 440 86" stroke="#3DDC97" strokeWidth="3" fill="none" />
            <path d="M0 170 L 440 128" stroke="#5B6876" strokeWidth="2" strokeDasharray="6 6" fill="none" />
          </svg>
          <div className="mt-2 flex flex-wrap gap-5 text-[13px] text-muted">
            <span className="flex items-center gap-2"><span className="h-[3px] w-4 bg-mint" />Likely path</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-4 rounded-sm bg-mint/25" />Range of outcomes</span>
            <span className="flex items-center gap-2"><span className="w-4 border-t-2 border-dashed border-[#5B6876]" />Money you put in</span>
          </div>
        </div>
      </section>

      {/* LIVE TICKER */}
      {tickers.length > 0 && (
        <section aria-label="Market prices and 1-year returns" className="-mt-10 overflow-hidden rounded-2xl border border-line bg-[#0D1218] py-4">
          <div className="flex w-max gap-10 px-6 animate-[seedwise-marquee_70s_linear_infinite] hover:[animation-play-state:paused] motion-reduce:animate-none">
            {[...tickers, ...tickers].map((s, i) => (
              <TickerItem key={i} s={s} />
            ))}
          </div>
          <style>{`@keyframes seedwise-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section>
        <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mint">How it works</div>
        <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">From “I want to start investing” to a real plan.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-line bg-surface p-7">
              <div className="font-display text-[15px] font-semibold text-mint">{s.n}</div>
              <h3 className="mt-3.5 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2.5 leading-relaxed text-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section>
        <h2 className="font-display text-4xl font-bold tracking-tight">Tools that make investing click.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {FEATURES.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="group flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-8 transition hover:-translate-y-1 hover:border-mint/40"
            >
              <Icon>{f.icon}</Icon>
              <h3 className="text-[22px] font-semibold">{f.title}</h3>
              <p className="leading-relaxed text-muted">{f.text}</p>
              {f.demo && (
                <div className="rounded-xl border border-line bg-ink px-4 py-3.5 text-sm text-slate-700">{f.demo}</div>
              )}
              <span className="mt-auto text-sm font-medium text-mint opacity-0 transition group-hover:opacity-100">Open →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="flex flex-wrap items-center justify-between gap-6 rounded-[28px] border border-[#1F3A2F] bg-[radial-gradient(120%_140%_at_0%_0%,#133227_0%,#0F161E_55%)] p-10 sm:p-14">
        <div className="min-w-0 flex-[1_1_400px]">
          <h2 className="font-display text-4xl font-bold tracking-tight">Your first plan is 2 minutes away.</h2>
          <p className="mt-2.5 text-lg text-muted">Free, private and built for complete beginners.</p>
        </div>
        <Link href="/plan" className="rounded-full bg-mint px-7 py-4 text-base font-semibold text-mint-ink transition hover:bg-mint-light">
          Build my plan →
        </Link>
      </section>
    </div>
  );
}