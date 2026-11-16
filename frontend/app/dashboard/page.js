"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LEVEL_LABELS, money } from "@/lib/format";

export default function DashboardPage() {
  const [plans, setPlans] = useState(null);
  const [loggedIn, setLoggedIn] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setLoggedIn(false);
        return;
      }
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
    if (!window.confirm("Delete this plan?")) return;
    const { error } = await supabase.from("investment_plans").delete().eq("id", id);
    if (error) setError(error.message);
    else setPlans(plans.filter((p) => p.id !== id));
  }

  if (!loggedIn) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-bold">My plans</h1>
        <p className="mt-2 text-slate-600">Log in to see the plans you have saved.</p>
        <Link href="/login" className="mt-4 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white">Log in</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">My plans</h1>
        <Link href="/plan" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">+ New plan</Link>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {plans === null && !error && <p className="text-slate-600">Loading...</p>}
      {plans?.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
          No plans yet. <Link href="/plan" className="font-semibold text-emerald-700">Build your first plan</Link>.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {plans?.map((plan) => (
          <div key={plan.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{plan.goal}</h2>
                <p className="text-sm text-slate-500">Saved {new Date(plan.created_at).toLocaleDateString()}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                {LEVEL_LABELS[plan.risk_level]}
              </span>
            </div>
            <p className="mt-3 text-slate-700">
              {money(Number(plan.initial_amount))} to start, {money(Number(plan.monthly_contribution))} a month, for {plan.horizon_years} years
            </p>
            <div className="mt-4 flex gap-3">
              <Link href={`/plan?id=${plan.id}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50">View plan</Link>
              <button onClick={() => deletePlan(plan.id)} className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
