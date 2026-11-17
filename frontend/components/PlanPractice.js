"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { askCoach } from "@/lib/coach";
import { money } from "@/lib/format";
import { followPlan, getFollowedPlan, lastBuiltPlan, stopFollowing } from "@/lib/planPractice";
import { supabase } from "@/lib/supabase";
import { Avatar } from "./ui";

const pct = (x) => `${Math.round(x * 100)}%`;

// Preview the exact trades, then carry them out. Used for "Practice this plan" and for "Rebalance".
export function PlanTradeDialog({ plan, mode = "invest", onClose, onDone }) {
  const [cash, setCash] = useState(null);
  const [amount, setAmount] = useState(0);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const targets = plan.holdings.map((h) => ({ symbol: h.symbol, weight: h.weight }));
  const invest = mode === "invest";

  useEffect(() => {
    api.practice().then((s) => {
      setCash(s.cash);
      setAmount(invest ? Math.floor(s.cash) : 0);
    }).catch((e) => setError(e.message));
  }, [invest]);

  useEffect(() => {
    if (cash === null) return;
    const t = setTimeout(() => {
      setError("");
      api.matchPlan(targets, invest ? amount : 0).then(setPreview).catch((e) => (setPreview(null), setError(e.message)));
    }, 250);
    return () => clearTimeout(t);
  }, [amount, cash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [busy, onClose]);

  async function go() {
    setBusy(true);
    setError("");
    try {
      const r = await api.matchPlan(targets, invest ? amount : 0, true);
      followPlan(plan);
      setDone(r.message);
      onDone?.(r.state);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  const sells = preview?.trades.filter((t) => t.side === "sell") || [];
  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="ptd-title">
      <button type="button" aria-label="Close" onClick={() => !busy && onClose()} className="absolute inset-0 bg-black/40" />
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-float sm:rounded-3xl">
        <div className="border-b border-line px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand">{plan.portfolio}{plan.goal ? ` · ${plan.goal}` : ""}</div>
          <h2 id="ptd-title" className="mt-1 text-xl font-bold">{invest ? "Practice this plan" : "Rebalance to your plan"}</h2>
          <p className="mt-1 text-sm text-muted">
            {invest ? "Your play money goes into the plan's mix at today's real prices. No real money is used." : "Sell what's grown too big, buy what's fallen behind, so your mix matches your plan again."}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gain-soft text-xl text-gain">✓</span>
              <p className="font-semibold">{done}</p>
              <p className="text-sm text-muted">We&rsquo;ll tell you on the Practice page if your mix drifts away from the plan.</p>
            </div>
          ) : (
            <>
              {invest && cash !== null && (
                <div className="mb-5">
                  <div className="flex items-center justify-between text-sm">
                    <label htmlFor="ptd-amount" className="font-semibold">How much play money?</label>
                    <span className="text-lg font-bold tabular-nums">{money(amount)}</span>
                  </div>
                  <input id="ptd-amount" type="range" min={0} max={Math.floor(cash)} step={50} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-brand)]" />
                  <div className="flex justify-between text-xs text-muted"><span>$0</span><span>All {money(cash)} available</span></div>
                </div>
              )}

              {!preview && !error && <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />}

              {preview && (
                <>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Your mix after</div>
                  <ul className="mt-2 flex flex-col gap-2">
                    {preview.rows.map((r) => (
                      <li key={r.symbol} className="flex items-center gap-3">
                        <Avatar symbol={r.symbol} size={30} />
                        <span className="w-14 text-sm font-semibold">{r.symbol}</span>
                        <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: pct(r.target) }} />
                        </span>
                        <span className="w-24 text-right text-sm tabular-nums">
                          {r.target ? pct(r.target) : <span className="text-loss">sold</span>}
                          <span className="ml-1 text-xs text-muted">{money(r.value_after)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Trades ({preview.trades.length})</div>
                  {preview.trades.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">{invest ? "Pick an amount to see the trades." : "Already in line with your plan. Nothing to do."}</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
                      {preview.trades.map((t) => (
                        <li key={t.symbol + t.side} className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <span>
                            <span className={`mr-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${t.side === "buy" ? "bg-gain-soft text-gain" : "bg-red-50 text-loss"}`}>{t.side}</span>
                            <span className="font-semibold">{t.symbol}</span>
                          </span>
                          <span className="tabular-nums">{money(t.dollars)} <span className="text-xs text-muted">at ${t.price.toFixed(2)}</span></span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {sells.some((t) => !plan.holdings.some((h) => h.symbol === t.symbol)) && (
                    <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Stocks that aren&rsquo;t in your plan get sold so your mix matches it.</p>
                  )}
                </>
              )}
              {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line px-6 py-4">
          {done ? (
            <>
              <Link href="/practice" onClick={onClose} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink">Open Practice</Link>
              <button type="button" onClick={onClose} className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold">Close</button>
            </>
          ) : (
            <>
              <button type="button" onClick={go} disabled={busy || !preview || preview.trades.length === 0} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50">
                {busy ? "Placing trades…" : invest ? `Invest ${money(amount)}` : `Rebalance (${preview?.trades.length ?? 0} trades)`}
              </button>
              <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold">Cancel</button>
              <button type="button" onClick={() => (onClose(), askCoach(invest ? "Why is it a good idea to practice my plan with play money before using real money?" : "What is rebalancing, and why do investors do it?"))} className="ml-auto text-xs font-semibold text-brand">
                {invest ? "Why practice first?" : "Why rebalance?"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// The button on plan results and the dashboard.
export function PracticePlanButton({ plan, className = "", label = "Practice this plan" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!plan?.holdings?.length) return null;
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const { data } = await supabase.auth.getSession();
          if (!data.session) return router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
          setOpen(true);
        }}
        className={className || "rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-ink transition hover:bg-brand-light"}
      >
        {label}
      </button>
      {open && <PlanTradeDialog plan={plan} mode="invest" onClose={() => setOpen(false)} />}
    </>
  );
}

// On the Practice page: are you following your plan, or have you drifted?
export function PlanTracker({ state, onChange }) {
  const [plan, setPlan] = useState(undefined);
  const [check, setCheck] = useState(null);
  const [dialog, setDialog] = useState(null);
  useEffect(() => {
    const read = () => setPlan(getFollowedPlan());
    read();
    window.addEventListener("seedwise:plan-followed", read);
    return () => window.removeEventListener("seedwise:plan-followed", read);
  }, []);
  const sig = state ? `${state.trade_count}:${state.cash}` : "";
  useEffect(() => {
    if (!plan || !state || state.holdings.length === 0) return setCheck(null);
    api.matchPlan(plan.holdings, 0).then(setCheck).catch(() => setCheck(null));
  }, [plan, sig]); // eslint-disable-line react-hooks/exhaustive-deps

  if (plan === undefined || !state) return null;

  if (!plan) {
    const built = lastBuiltPlan();
    if (!built) return null;
    return (
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-line bg-glow p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-brand">Your plan · {built.portfolio}</div>
          <div className="mt-1 font-semibold">Try your plan&rsquo;s mix with play money</div>
          <div className="text-sm text-muted">{built.holdings.map((h) => `${h.symbol} ${Math.round(h.weight * 100)}%`).join(" · ")}</div>
        </div>
        <button type="button" onClick={() => setDialog("invest")} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink">Practice this plan</button>
        {dialog && <PlanTradeDialog plan={built} mode="invest" onClose={() => setDialog(null)} onDone={onChange} />}
      </section>
    );
  }

  const drifted = check?.drifted;
  return (
    <section className="rounded-2xl border border-line bg-surface p-5" aria-labelledby="tracker-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Following your plan</div>
          <h2 id="tracker-title" className="text-lg font-bold">{plan.portfolio}{plan.goal ? ` · ${plan.goal}` : ""}</h2>
        </div>
        {check?.drift != null && (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${drifted ? "bg-amber-50 text-amber-700" : "bg-gain-soft text-gain"}`}>
            {drifted ? `Drifted ${Math.round(check.drift * 100)} pts from your plan` : "On track"}
          </span>
        )}
      </div>

      {state.holdings.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing invested yet.</p>
      ) : !check ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-surface-2" />
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {check.rows.map((r) => (
            <li key={r.symbol} className="grid grid-cols-[56px_1fr_92px] items-center gap-3 text-sm">
              <span className="font-semibold">{r.symbol}</span>
              <span className="relative h-2.5 rounded-full bg-surface-2">
                <span className={`absolute inset-y-0 left-0 rounded-full ${Math.abs(r.now - r.target) >= 0.05 ? "bg-amber-500" : "bg-brand"}`} style={{ width: pct(Math.min(r.now, 1)) }} />
                {r.target > 0 && <span className="absolute -top-1 h-[18px] w-0.5 rounded bg-fg" style={{ left: pct(r.target) }} title={`Target ${pct(r.target)}`} />}
              </span>
              <span className="text-right tabular-nums">
                {pct(r.now)} <span className="text-xs text-muted">/ {r.target ? pct(r.target) : "0%"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">Bar = your mix now. Black line = your plan&rsquo;s target.</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {drifted && <button type="button" onClick={() => setDialog("rebalance")} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-ink">Rebalance</button>}
        {state.cash >= 50 && <button type="button" onClick={() => setDialog("invest")} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold transition hover:border-brand hover:text-brand">Invest {money(state.cash)} cash in the plan</button>}
        <button type="button" onClick={() => askCoach(drifted ? "My practice portfolio has drifted from my plan. What does that mean and should I rebalance?" : "How does my practice portfolio compare with my plan?")} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold transition hover:border-brand hover:text-brand">
          Ask AI
        </button>
        <button type="button" onClick={stopFollowing} className="ml-auto text-xs font-semibold text-muted hover:text-fg">Stop following</button>
      </div>
      {dialog && <PlanTradeDialog plan={plan} mode={dialog} onClose={() => setDialog(null)} onDone={onChange} />}
    </section>
  );
}
