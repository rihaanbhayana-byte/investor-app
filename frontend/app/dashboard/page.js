"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { askCoach, setPageContext } from "@/lib/coach";
import { money, percent } from "@/lib/format";
import { Avatar, ReturnPill, RISE } from "@/components/ui";

const PERSONALITY = {
  conservative: { name: "Steady Saver", color: "var(--color-sky)", bg: "bg-sky-soft" },
  moderate: { name: "Balanced Builder", color: "var(--color-brand)", bg: "bg-brand-soft" },
  aggressive: { name: "Growth Seeker", color: "var(--color-gold)", bg: "bg-gold-soft" },
};

const GOAL_ICONS = {
  "Grow my wealth": <><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></>,
  Retirement: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  "Buying a home": <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  Education: <><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c3 2 9 2 12 0v-5" /></>,
  "A big purchase": <><path d="M6 7h12l1 14H5z" /><path d="M9 7a3 3 0 0 1 6 0" /></>,
};

function GoalIcon({ goal, color }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GOAL_ICONS[goal] || GOAL_ICONS["Grow my wealth"]}
    </svg>
  );
}

function SummaryTile({ label, value, sub }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-6">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function PlanCard({ plan, onDelete, index }) {
  const [confirming, setConfirming] = useState(false);
  const p = PERSONALITY[plan.risk_level] || PERSONALITY.moderate;
  const start = Number(plan.initial_amount);
  const monthly = Number(plan.monthly_contribution);
  const total = start + monthly * 12 * plan.horizon_years;

  return (
    <article
      style={{ animationDelay: `${index * 60}ms` }}
      className="group flex flex-col gap-5 rounded-3xl border border-line bg-surface p-6 transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lift motion-safe:animate-[sw-rise_0.4s_ease-out_both]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${p.bg}`}>
            <GoalIcon goal={plan.goal} color={p.color} />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold">{plan.goal}</h2>
            <p className="text-sm text-muted">Saved {new Date(plan.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
          </div>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ color: p.color, borderColor: `color-mix(in srgb, ${p.color} 40%, transparent)` }}>
          {p.name}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-2xl border border-line bg-ink p-4">
        <div>
          <div className="text-xs text-muted">Start</div>
          <div className="font-semibold tabular-nums">{money(start)}</div>
        </div>
        <div>
          <div className="text-xs text-muted">Monthly</div>
          <div className="font-semibold tabular-nums">{money(monthly)}</div>
        </div>
        <div>
          <div className="text-xs text-muted">Time</div>
          <div className="font-semibold">{plan.horizon_years} {plan.horizon_years === 1 ? "year" : "years"}</div>
        </div>
      </div>

      <p className="text-sm text-muted">
        You&rsquo;ll put in <span className="font-semibold text-fg">{money(total)}</span> in total.
      </p>

      <div className="mt-auto flex items-center gap-3">
        <Link href={`/plan?id=${plan.id}`} className="flex-1 rounded-xl bg-brand px-5 py-3 text-center font-semibold text-brand-ink transition hover:bg-brand-light">
          Open plan →
        </Link>
        {confirming ? (
          <div className="flex items-center gap-2">
            <button onClick={() => onDelete(plan.id)} className="rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-ink">Delete</button>
            <button onClick={() => setConfirming(false)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm">Keep</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${plan.goal} plan`}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-muted transition hover:border-red-200 hover:text-red-600"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
            </svg>
          </button>
        )}
      </div>
    </article>
  );
}

const card = "rounded-3xl border border-line bg-surface p-6";
const ASK_IDEAS = ["Explain my plan in simple words", "How is my practice portfolio doing?", "What should a beginner learn first?"];

// The AI comes first: ask anything, answered in the side panel.
function AskBox() {
  const [q, setQ] = useState("");
  return (
    <section className={`${card} bg-glow`} aria-labelledby="ask-title">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-brand">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" /></svg>
        Seedwise AI
      </div>
      <h2 id="ask-title" className="mt-1.5 text-xl font-bold">What would you like to know?</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) askCoach(q.trim());
          setQ("");
        }}
        className="mt-4 flex flex-wrap gap-2 sm:flex-nowrap"
      >
        <label htmlFor="ask" className="sr-only">Ask Seedwise AI</label>
        <input id="ask" value={q} onChange={(e) => setQ(e.target.value)} maxLength={1500} placeholder="Ask about your plan, a stock, or any money question…" className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-fg placeholder:text-slate-500 focus:border-brand focus:outline-none" />
        <button disabled={!q.trim()} className="w-full rounded-xl bg-brand px-5 py-3 font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50 sm:w-auto">Ask</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {ASK_IDEAS.map((idea) => (
          <button key={idea} type="button" onClick={() => askCoach(idea)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand hover:text-brand">
            {idea}
          </button>
        ))}
      </div>
    </section>
  );
}

function readFlag(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(v) ? v.length > 0 : Boolean(v);
  } catch {
    return false;
  }
}

// "What should I do next?" Simple rules from what the person has already done. No AI needed.
function NextSteps({ hasPlan, practice }) {
  const [flags, setFlags] = useState({ doctor: false, learn: false, coach: false });
  useEffect(() => {
    setFlags({ doctor: readFlag("seedwise-doctor-done"), learn: readFlag("seedwise-learn"), coach: readFlag("seedwise-coach-used") });
  }, []);
  const steps = [
    { done: hasPlan, title: "Build your plan", text: "Your goal, personality and projection.", href: "/plan" },
    { done: (practice?.trade_count ?? 0) > 0, title: "Make a practice trade", text: "Try your plan with $10,000 of play money.", href: "/practice" },
    { done: flags.doctor, title: "Run the Portfolio Doctor", text: "Get a grade and 3 tips for your practice portfolio.", href: "/practice" },
    { done: flags.learn, title: "Finish a Learn lesson", text: "7 short lessons, each with a quiz.", href: "/learn" },
    { done: flags.coach, title: "Ask the AI a question", text: "It looks up real data before answering.", ask: true },
  ];
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  return (
    <section className={`${card} flex flex-col gap-4`} aria-labelledby="steps-title">
      <div className="flex items-center justify-between">
        <h2 id="steps-title" className="text-base font-bold">Your next steps</h2>
        <span className="text-sm font-semibold text-muted">{done} of {steps.length}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Steps done">
        <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="flex flex-col gap-1">
        {steps.map((s) => {
          const isNext = s === next;
          const body = (
            <>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${s.done ? "border-gain bg-gain text-white" : isNext ? "border-brand text-brand" : "border-line-strong text-muted"}`} aria-hidden="true">
                {s.done ? "✓" : ""}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${s.done ? "text-muted line-through" : ""}`}>{s.title}</span>
                {!s.done && <span className="block text-xs text-muted">{s.text}</span>}
              </span>
              {isNext && <span className="shrink-0 text-xs font-semibold text-brand">Start →</span>}
            </>
          );
          const cls = `flex items-center gap-3 rounded-xl px-2 py-2.5 text-left transition ${isNext ? "bg-brand-soft" : "hover:bg-surface-2"}`;
          return (
            <li key={s.title}>
              {s.ask ? (
                <button type="button" onClick={() => askCoach()} className={`w-full ${cls}`}>{body}<span className="sr-only">{s.done ? "(done)" : ""}</span></button>
              ) : (
                <Link href={s.href} className={cls}>{body}<span className="sr-only">{s.done ? "(done)" : ""}</span></Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PracticeSummary({ practice }) {
  if (!practice) return <div className={`${card} h-64 animate-pulse`} />;
  const start = 10000;
  const change = practice.total - start;
  const vsSp = practice.sp500_value != null ? practice.total - practice.sp500_value : null;
  return (
    <section className={`${card} flex flex-col gap-5`} aria-labelledby="practice-title">
      <div className="flex items-center justify-between">
        <h2 id="practice-title" className="text-base font-bold">Practice portfolio</h2>
        <Link href="/practice" className="text-sm font-semibold text-brand">Open Practice</Link>
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <div className="text-xs text-muted">Worth today</div>
          <div className="text-3xl font-bold tracking-tight tabular-nums">{money(practice.total)}</div>
        </div>
        <ReturnPill value={change / start}>{change >= 0 ? "+" : "−"}{money(Math.abs(change))} ({percent(Math.abs(change / start))})</ReturnPill>
        {vsSp != null && practice.trade_count > 0 && (
          <span className={`text-sm font-semibold ${vsSp >= 0 ? "text-gain" : "text-loss"}`}>
            {Math.abs(vsSp) < 0.5 ? "Even with the S&P 500" : `${vsSp > 0 ? "Ahead of" : "Behind"} the S&P 500 by ${money(Math.abs(vsSp))}`}
          </span>
        )}
      </div>
      {practice.holdings.length === 0 ? (
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">No investments yet. You have {money(practice.cash)} of play money to try your plan.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {practice.holdings.slice(0, 4).map((h) => (
            <li key={h.symbol} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
              <Avatar symbol={h.symbol} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{h.symbol}</span>
                <span className="block truncate text-xs text-muted">{money(h.value)}</span>
              </span>
              <span className={`text-sm font-semibold tabular-nums ${h.gain >= 0 ? "text-gain" : "text-loss"}`}>{h.gain >= 0 ? "+" : "−"}{percent(Math.abs(h.gain_pct))}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="text-xs text-muted">Cash left: {money(practice.cash)} · {practice.trade_count} trade{practice.trade_count === 1 ? "" : "s"}</div>
    </section>
  );
}

function MyPlanCard({ latest }) {
  const [plan, setPlan] = useState(undefined);
  useEffect(() => {
    try {
      setPlan(JSON.parse(localStorage.getItem("lastPlan") || "null"));
    } catch {
      setPlan(null);
    }
  }, []);
  if (plan === undefined) return <div className={`${card} h-56 animate-pulse`} />;
  if (!plan)
    return (
      <section className={`${card} flex flex-col items-start gap-3`}>
        <h2 className="text-base font-bold">Your plan</h2>
        {latest ? (
          <>
            <p className="text-sm text-muted">
              Your latest saved plan: <span className="font-semibold text-fg">{latest.goal}</span>, {money(latest.initial_amount)} + {money(latest.monthly_contribution)}/month for {latest.horizon_years} years.
            </p>
            <Link href={`/plan?id=${latest.id}`} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-light">See its projection →</Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">Tell the AI your goal and get a plan in about 2 minutes.</p>
            <Link href="/plan" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-light">Build my plan →</Link>
          </>
        )}
      </section>
    );
  const f = plan.projected_final || {};
  const chance = f.odds?.more_than_put_in;
  return (
    <section className={`${card} flex flex-col gap-4`} aria-labelledby="plan-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="plan-title" className="text-base font-bold">Your plan · {plan.goal}</h2>
        <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">{plan.portfolio}</span>
      </div>
      <div className="flex flex-wrap gap-8">
        <div>
          <div className="text-xs text-muted">Likely value in {plan.years} year{plan.years === 1 ? "" : "s"}</div>
          <div className="text-3xl font-bold tracking-tight tabular-nums">{f.median != null ? money(f.median) : "–"}</div>
        </div>
        <div>
          <div className="text-xs text-muted">You put in</div>
          <div className="text-3xl font-bold tracking-tight tabular-nums text-muted">{f.contributed != null ? money(f.contributed) : "–"}</div>
        </div>
      </div>
      {chance != null && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span className="font-semibold">How likely is this?</span>
            <span className="text-muted">{Math.round(chance * 100)}% of 5,000 futures end above what you put in</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${chance * 100}%` }} /></div>
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-sm font-semibold">
        <a href="#plans" className="text-brand">See all my plans</a>
        <button type="button" onClick={() => askCoach("Explain my plan in simple words")} className="text-brand">Ask AI to explain it</button>
      </div>
    </section>
  );
}

function Movers() {
  const [stocks, setStocks] = useState(null);
  useEffect(() => {
    api.stocks().then((list) => setStocks(list.filter((s) => s.return_1y != null))).catch(() => setStocks([]));
  }, []);
  const top = stocks ? [...stocks].sort((a, b) => Math.abs(b.return_1y) - Math.abs(a.return_1y)).slice(0, 5) : [];
  return (
    <section className={`${card} flex flex-col gap-2`} aria-labelledby="movers-title">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="movers-title" className="text-base font-bold">Biggest movers · 1 year</h2>
        <Link href="/stocks" className="text-sm font-semibold text-brand">All stocks</Link>
      </div>
      {stocks === null
        ? [0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-2" />)
        : top.map((s) => (
            <Link key={s.symbol} href={`/stocks/${s.symbol}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2">
              <Avatar symbol={s.symbol} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{s.symbol}</span>
                <span className="block truncate text-xs text-muted">{s.name}</span>
              </span>
              <span className="text-right">
                <span className="block text-sm font-semibold tabular-nums">{money(s.latest_price)}</span>
                <span className={`block text-xs font-semibold tabular-nums ${s.return_1y >= 0 ? "text-gain" : "text-loss"}`}>{s.return_1y >= 0 ? "+" : "−"}{percent(Math.abs(s.return_1y))}</span>
              </span>
            </Link>
          ))}
    </section>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const [plans, setPlans] = useState(null);
  const [name, setName] = useState("");
  const [loggedIn, setLoggedIn] = useState(true);
  const [error, setError] = useState("");
  const [practice, setPractice] = useState(null);
  const [today, setToday] = useState({ date: "", hello: "Welcome back" }); // read the clock in the browser, not at build time
  useEffect(() => {
    setToday({ date: new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }), hello: greeting() });
  }, []);

  useEffect(() => {
    setPageContext("Dashboard (home): their plan, practice portfolio and next steps");
    return () => setPageContext("");
  }, []);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setLoggedIn(false);
        return;
      }
      const fullName = sessionData.session.user?.user_metadata?.full_name || "";
      setName(fullName.split(" ")[0]);
      api.practice().then(setPractice).catch(() => setPractice({ total: 10000, cash: 10000, holdings: [], trade_count: 0, sp500_value: null }));
      const { data, error } = await supabase
        .from("investment_plans")
        .select("id, goal, horizon_years, initial_amount, monthly_contribution, risk_level, created_at")
        .order("created_at", { ascending: false });
      if (error) setError(error.message);
      else setPlans(data);
    }
    load();
  }, []);

  async function deletePlan(id) {
    const { error } = await supabase.from("investment_plans").delete().eq("id", id);
    if (error) setError(error.message);
    else setPlans(plans.filter((p) => p.id !== id));
  }

  if (!loggedIn) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5 rounded-[28px] border border-line bg-surface p-12 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/15 text-brand">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
        <h1 className="font-display text-3xl font-bold">Your plans live here</h1>
        <p className="text-muted">Log in to save plans, come back to them any time, and compare your goals.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/login" className="rounded-xl bg-brand px-6 py-3 font-semibold text-brand-ink transition hover:bg-brand-light">Log in or sign up</Link>
          <Link href="/plan" className="rounded-xl border border-slate-300 px-6 py-3 font-medium transition hover:border-brand hover:text-brand">Try without an account</Link>
        </div>
      </div>
    );
  }

  const totalMonthly = (plans || []).reduce((sum, p) => sum + Number(p.monthly_contribution), 0);
  const longest = (plans || []).reduce((max, p) => Math.max(max, p.horizon_years), 0);

  return (
    <div className="flex flex-col gap-6">
      <style>{RISE}</style>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="min-h-5 text-sm text-muted">{today.date}</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{today.hello}{name ? `, ${name}` : ""}</h1>
        </div>
        <Link href="/plan" className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-ink transition hover:bg-brand-light">+ New plan</Link>
      </div>

      <AskBox />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <MyPlanCard latest={plans?.[0]} />
          <PracticeSummary practice={practice} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <NextSteps hasPlan={(plans?.length ?? 0) > 0} practice={practice} />
          <Movers />
        </div>
      </div>

      <div id="plans" className="scroll-mt-6 flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">My plans</h2>
          <p className="mt-1 text-sm text-muted">Every goal you&rsquo;ve planned, in one place.</p>
        </div>
      </div>

      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-red-700">{error}</p>}

      {plans === null && !error && (
        <div className="grid gap-5 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-3xl border border-line bg-surface" />
          ))}
        </div>
      )}

      {plans?.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryTile label="Plans" value={plans.length} sub={plans.length === 1 ? "goal planned" : "goals planned"} />
          <SummaryTile label="Monthly across plans" value={money(totalMonthly)} sub="if you followed every plan" />
          <SummaryTile label="Longest plan" value={`${longest} ${longest === 1 ? "year" : "years"}`} sub="time is your biggest helper" />
        </div>
      )}

      {plans?.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-[28px] border border-dashed border-slate-300 p-12 text-center">
          <h2 className="font-display text-2xl font-bold">No plans yet</h2>
          <p className="max-w-md text-muted">Build your first plan in about 2 minutes. We&rsquo;ll save it here so you can come back to it.</p>
          <Link href="/plan" className="rounded-xl bg-brand px-6 py-3 font-semibold text-brand-ink">Build my first plan →</Link>
        </div>
      )}

      {plans?.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {plans.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} onDelete={deletePlan} index={i} />
          ))}
        </div>
      )}

      {plans?.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/coach" className="flex items-center justify-between rounded-3xl border border-line bg-surface p-6 transition hover:border-brand/40">
            <span>
              <span className="block font-semibold">Not sure which plan to follow?</span>
              <span className="text-sm text-muted">Ask the AI Coach to compare them with you.</span>
            </span>
            <span className="text-brand">→</span>
          </Link>
          <Link href="/tools?tab=goal" className="flex items-center justify-between rounded-3xl border border-line bg-surface p-6 transition hover:border-brand/40">
            <span>
              <span className="block font-semibold">Got a target number?</span>
              <span className="text-sm text-muted">The Goal calculator tells you what to save each month.</span>
            </span>
            <span className="text-brand">→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
