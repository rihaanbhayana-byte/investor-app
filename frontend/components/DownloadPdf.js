"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { getFollowedPlan } from "@/lib/planPractice";
import { supabase } from "@/lib/supabase";

async function myName() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.user_metadata?.full_name || undefined;
}

const BTN = "inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold transition hover:border-brand hover:text-brand disabled:opacity-60";

function Icon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}

function useDownload(run) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function go() {
    setBusy(true);
    setError("");
    try {
      await run();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }
  return { busy, error, go };
}

// The plan as an action-plan PDF: projection, fund-by-fund amounts, dated checklist.
export function PlanPdfButton({ plan, className = BTN, label = "Download PDF" }) {
  const { busy, error, go } = useDownload(async () =>
    api.planPdf({
      goal: plan.goal,
      risk_level: plan.risk_level,
      initial_amount: Number(plan.initial_amount),
      monthly_contribution: Number(plan.monthly_contribution),
      years: Number(plan.years),
      holdings: plan.holdings || undefined,
      name: await myName(),
    })
  );
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={go} disabled={busy} className={className}>
        <Icon />
        {busy ? "Making your PDF…" : label}
      </button>
      {error && <span role="alert" className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}

// The practice portfolio as a report: holdings, vs S&P 500, doctor grade, drift and next steps.
export function PortfolioPdfButton({ className = BTN, label = "Download report" }) {
  const { busy, error, go } = useDownload(async () => {
    let last = null;
    try {
      last = JSON.parse(localStorage.getItem("lastPlan") || "null");
    } catch {}
    const followed = getFollowedPlan();
    await api.portfolioPdf({
      risk_level: followed?.risk_level || last?.risk_level || undefined,
      targets: followed?.holdings,
      plan_name: followed?.portfolio,
      goal: followed?.goal,
      name: await myName(),
    });
  });
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={go} disabled={busy} className={className}>
        <Icon />
        {busy ? "Making your report…" : label}
      </button>
      {error && <span role="alert" className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}
