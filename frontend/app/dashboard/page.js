"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { money } from "@/lib/format";
import { RISE } from "@/components/ui";

const PERSONALITY = {
  conservative: { name: "Steady Saver", color: "var(--color-sky)", bg: "bg-sky-soft" },
  moderate: { name: "Balanced Builder", color: "var(--color-mint)", bg: "bg-mint-soft" },
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
      <div className="mt-1 font-display text-3xl font-bold tabular-nums">{value}</div>
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
        <Link href={`/plan?id=${plan.id}`} className="flex-1 rounded-full bg-mint px-5 py-3 text-center font-semibold text-mint-ink transition hover:bg-mint-light">
          Open plan →
        </Link>
        {confirming ? (
          <div className="flex items-center gap-2">
            <button onClick={() => onDelete(plan.id)} className="rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-ink">Delete</button>
            <button onClick={() => setConfirming(false)} className="rounded-full border border-slate-300 px-4 py-3 text-sm">Keep</button>
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

export default function DashboardPage() {
  const [plans, setPlans] = useState(null);
  const [name, setName] = useState("");
  const [loggedIn, setLoggedIn] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setLoggedIn(false);
        return;
      }
      const fullName = sessionData.session.user?.user_metadata?.full_name || "";
      setName(fullName.split(" ")[0]);
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
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mint/15 text-mint">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
        <h1 className="font-display text-3xl font-bold">Your plans live here</h1>
        <p className="text-muted">Log in to save plans, come back to them any time, and compare your goals.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/login" className="rounded-full bg-mint px-6 py-3 font-semibold text-mint-ink transition hover:bg-mint-light">Log in or sign up</Link>
          <Link href="/plan" className="rounded-full border border-slate-300 px-6 py-3 font-medium transition hover:border-mint hover:text-mint">Try without an account</Link>
        </div>
      </div>
    );
  }

  const totalMonthly = (plans || []).reduce((sum, p) => sum + Number(p.monthly_contribution), 0);
  const longest = (plans || []).reduce((max, p) => Math.max(max, p.horizon_years), 0);

  return (
    <div className="flex flex-col gap-8">
      <style>{RISE}</style>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mint">My plans</div>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">{name ? `Welcome back, ${name}.` : "Welcome back."}</h1>
          <p className="mt-3 text-lg text-muted">Every goal you&rsquo;ve planned, in one place.</p>
        </div>
        <Link href="/plan" className="rounded-full bg-mint px-6 py-3.5 font-semibold text-mint-ink transition hover:bg-mint-light">+ New plan</Link>
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
          <Link href="/plan" className="rounded-full bg-mint px-6 py-3 font-semibold text-mint-ink">Build my first plan →</Link>
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
          <Link href="/coach" className="flex items-center justify-between rounded-3xl border border-line bg-surface p-6 transition hover:border-mint/40">
            <span>
              <span className="block font-semibold">Not sure which plan to follow?</span>
              <span className="text-sm text-muted">Ask the AI Coach to compare them with you.</span>
            </span>
            <span className="text-mint">→</span>
          </Link>
          <Link href="/tools?tab=goal" className="flex items-center justify-between rounded-3xl border border-line bg-surface p-6 transition hover:border-mint/40">
            <span>
              <span className="block font-semibold">Got a target number?</span>
              <span className="text-sm text-muted">The Goal calculator tells you what to save each month.</span>
            </span>
            <span className="text-mint">→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
