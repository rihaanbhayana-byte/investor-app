"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { setPageContext } from "@/lib/coach";
import { RISE } from "@/components/ui";
import { useWatchlist } from "@/lib/watchlist";
import { DoctorSummary, FeaturedChart, HoldingsRow, KpiRow, MoversCard, PlanSummary, TopBar } from "@/components/dashboard/parts";

function readFlag(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(v) ? v.length > 0 : Boolean(v);
  } catch {
    return false;
  }
}

export default function DashboardPage() {
  const [plans, setPlans] = useState(null);
  const [name, setName] = useState("");
  const [loggedIn, setLoggedIn] = useState(true);
  const [error, setError] = useState("");
  const [practice, setPractice] = useState(null);
  const [fullName, setFullName] = useState("");
  const [lastPlan, setLastPlan] = useState(undefined);
  const [movers, setMovers] = useState(null);
  const [quotes, setQuotes] = useState({});
  const [flags, setFlags] = useState({});
  const watch = useWatchlist();

  useEffect(() => {
    try {
      setLastPlan(JSON.parse(localStorage.getItem("lastPlan") || "null"));
    } catch {
      setLastPlan(null);
    }
    const readFlags = () => setFlags({ checkup: readFlag("seedwise-doctor-done"), student: readFlag("seedwise-learn"), curious: readFlag("seedwise-coach-used") });
    readFlags();
    window.addEventListener("seedwise:badges", readFlags);
    api.stocks().then((list) => setMovers(list.filter((s) => s.return_1y != null).sort((a, b) => Math.abs(b.return_1y) - Math.abs(a.return_1y)).slice(0, 6))).catch(() => setMovers([]));
    return () => window.removeEventListener("seedwise:badges", readFlags);
  }, []);

  // one request for every price on the page: holdings, watchlist, movers and the S&P 500
  const symbols = [...new Set([...(practice?.holdings || []).map((h) => h.symbol), ...watch.items.slice(0, 8).map((w) => w.symbol), ...(movers || []).map((m) => m.symbol), "VOO"])].slice(0, 40);
  const symbolsKey = symbols.sort().join(",");
  useEffect(() => {
    if (!practice || movers === null || !watch.ready) return;
    api.quotes(symbolsKey.split(",")).then((list) => setQuotes(Object.fromEntries(list.map((q) => [q.symbol, q])))).catch(() => {});
  }, [symbolsKey, practice, movers, watch.ready]);

  useEffect(() => {
    setPageContext("Dashboard (home): their practice portfolio, plan, watchlist and badges");
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
      setFullName(fullName || sessionData.session.user?.email?.split("@")[0] || "");
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

  // the big chart: your biggest holding, else your first watched stock, else the S&P 500
  const featured = !practice || !watch.ready
    ? null
    : practice.holdings?.[0]
      ? { symbol: practice.holdings[0].symbol, reason: "Your biggest holding" }
      : watch.items[0]
        ? { symbol: watch.items[0].symbol, reason: "From your watchlist" }
        : { symbol: "VOO", reason: "The S&P 500" };

  const earned = {
    planner: (plans?.length ?? 0) > 0 || Boolean(lastPlan),
    "first-trade": (practice?.trade_count ?? 0) > 0,
    watcher: watch.items.length > 0,
    diversified: (practice?.holdings?.length ?? 0) >= 5,
    ...flags,
  };


  return (
    <div className="flex flex-col gap-5">
      <style>{RISE}</style>
      <TopBar name={name} fullName={fullName} personality={lastPlan?.portfolio} />

      <KpiRow practice={practice} quotes={quotes} earned={earned} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        {featured ? <FeaturedChart symbol={featured.symbol} reason={featured.reason} /> : <div className="h-[420px] animate-pulse rounded-2xl border border-line bg-surface" />}
        <MoversCard movers={movers} watch={watch.items} watchReady={watch.ready} quotes={quotes} />
      </div>

      <HoldingsRow practice={practice} quotes={quotes} plan={lastPlan} />

      <div className="grid gap-5 lg:grid-cols-2">
        <PlanSummary plan={lastPlan} latest={plans?.[0]} />
        <DoctorSummary practice={practice} />
      </div>

    </div>
  );
}
