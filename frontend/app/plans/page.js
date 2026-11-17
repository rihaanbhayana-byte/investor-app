"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { askCoach, setPageContext } from "@/lib/coach";
import { money } from "@/lib/format";

export const PERSONALITY = {
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

export function GoalIcon({ goal, color, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GOAL_ICONS[goal] || GOAL_ICONS["Grow my wealth"]}
    </svg>
  );
}


// Same goal, money, years and personality = the same plan saved twice.
export const planKey = (p) => [p.goal, Number(p.initial_amount), Number(p.monthly_contribution), p.horizon_years, p.risk_level].join("|");

function PlanRow({ plan, copies, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const p = PERSONALITY[plan.risk_level] || PERSONALITY.moderate;
  const start = Number(plan.initial_amount);
  const monthly = Number(plan.monthly_contribution);
  const total = start + monthly * 12 * plan.horizon_years;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-surface-2 md:grid-cols-[minmax(0,2.2fr)_1fr_1fr_0.8fr_1fr_auto]">
      <Link href={`/plan?id=${plan.id}`} className="flex min-w-0 items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${p.bg}`}>
          <GoalIcon goal={plan.goal} color={p.color} />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{plan.goal}</span>
            {copies > 1 && <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">{copies}× saved</span>}
          </span>
          <span className="block truncate text-xs text-muted">
            <span style={{ color: p.color }} className="font-semibold">{p.name}</span> · Saved {new Date(plan.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </span>
      </Link>
      <span className="hidden text-sm tabular-nums md:block">{money(start)}</span>
      <span className="hidden text-sm tabular-nums md:block">{money(monthly)}<span className="text-muted">/mo</span></span>
      <span className="hidden text-sm md:block">{plan.horizon_years} yrs</span>
      <span className="hidden text-sm font-semibold tabular-nums md:block">{money(total)}</span>
      <span className="col-start-2 row-start-1 flex items-center justify-end gap-1 md:col-start-auto md:row-start-auto">
        {confirm ? (
          <>
            <button type="button" onClick={() => onDelete(plan.id)} className="rounded-lg bg-loss px-3 py-1.5 text-xs font-semibold text-white">Delete</button>
            <button type="button" onClick={() => setConfirm(false)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold">Keep</button>
          </>
        ) : (
          <>
            <Link href={`/plan?id=${plan.id}`} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold transition hover:border-brand hover:text-brand">Open</Link>
            <button type="button" onClick={() => setConfirm(true)} aria-label={`Delete ${plan.goal} plan`} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-loss">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
            </button>
          </>
        )}
      </span>
      <span className="col-span-2 text-xs text-muted md:hidden">{money(start)} + {money(monthly)}/mo · {plan.horizon_years} yrs · {money(total)} in total</span>
    </li>
  );
}

export default function PlansPage() {
  const [plans, setPlans] = useState(null);
  const [loggedIn, setLoggedIn] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPageContext("My plans page: the list of goals they've planned");
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return setLoggedIn(false);
      const { data, error: e } = await supabase.from("investment_plans").select("id, goal, horizon_years, initial_amount, monthly_contribution, risk_level, created_at").order("created_at", { ascending: false });
      if (e) setError(e.message);
      else setPlans(data);
    })();
    return () => setPageContext("");
  }, []);

  // newest copy of each plan, with how many times it was saved
  const groups = useMemo(() => {
    const map = new Map();
    for (const p of plans || []) {
      const k = planKey(p);
      if (!map.has(k)) map.set(k, { plan: p, ids: [] });
      map.get(k).ids.push(p.id);
    }
    return [...map.values()];
  }, [plans]);
  const extra = groups.flatMap((g) => g.ids.slice(1));

  async function remove(ids) {
    setError("");
    const { error: e } = await supabase.from("investment_plans").delete().in("id", ids);
    if (e) setError(e.message);
    else setPlans((ps) => ps.filter((p) => !ids.includes(p.id)));
  }
  async function cleanUp() {
    setBusy(true);
    await remove(extra);
    setBusy(false);
  }

  if (!loggedIn)
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-10 text-center">
        <h1 className="text-2xl font-bold">Your plans live here</h1>
        <p className="text-muted">Log in to save plans and come back to them any time.</p>
        <Link href="/login?next=/plans" className="rounded-xl bg-brand px-6 py-3 font-semibold text-brand-ink">Log in or sign up</Link>
      </div>
    );

  const unique = groups.map((g) => g.plan);
  const monthly = unique.reduce((s, p) => s + Number(p.monthly_contribution), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">My plans</h1>
          <p className="mt-1 text-muted">
            {plans === null ? "Loading…" : unique.length === 0 ? "No plans yet." : `${unique.length} goal${unique.length === 1 ? "" : "s"} · ${money(monthly)} a month if you followed them all`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unique.length > 1 && (
            <button type="button" onClick={() => askCoach("Compare my saved plans in simple words and help me decide which one to focus on first.")} className="rounded-xl border border-brand-line bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand transition hover:border-brand">
              Ask AI to compare
            </button>
          )}
          <Link href="/plan" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-light">+ New plan</Link>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {extra.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>You saved some plans more than once ({extra.length} extra cop{extra.length === 1 ? "y" : "ies"}).</span>
          <button type="button" disabled={busy} onClick={cleanUp} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            {busy ? "Cleaning up…" : "Remove the copies"}
          </button>
        </div>
      )}

      {plans === null ? (
        <div className="h-64 animate-pulse rounded-2xl border border-line bg-surface" />
      ) : unique.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface p-12 text-center">
          <h2 className="text-xl font-bold">Start with a goal</h2>
          <p className="max-w-md text-muted">Tell the AI what you&rsquo;re saving for. You&rsquo;ll get a plan in about 2 minutes and it&rsquo;ll be saved here.</p>
          <Link href="/plan" className="rounded-xl bg-brand px-6 py-3 font-semibold text-brand-ink">Build my first plan →</Link>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_1fr_1fr_0.8fr_1fr_auto] gap-x-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted md:grid">
            <span>Goal</span><span>Start</span><span>Monthly</span><span>Time</span><span>You put in</span><span className="w-[92px]" />
          </div>
          <ul className="divide-y divide-line">
            {groups.map((g) => (
              <PlanRow key={g.plan.id} plan={g.plan} copies={g.ids.length} onDelete={(id) => remove(groups.find((x) => x.plan.id === id).ids)} />
            ))}
          </ul>
        </section>
      )}

      {unique.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/tools?tab=goal" className="flex items-center justify-between rounded-2xl border border-line bg-surface p-5 transition hover:border-brand/40">
            <span><span className="block font-semibold">Got a target number?</span><span className="text-sm text-muted">The Goal calculator tells you what to save each month.</span></span>
            <span className="text-brand">→</span>
          </Link>
          <Link href="/tools?tab=fees" className="flex items-center justify-between rounded-2xl border border-line bg-surface p-5 transition hover:border-brand/40">
            <span><span className="block font-semibold">What would fees cost you?</span><span className="text-sm text-muted">See how a small fee grows over the years.</span></span>
            <span className="text-brand">→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
