"use client";

import InsightCard from "@/components/InsightCard";
import { useState } from "react";
import { api } from "@/lib/api";
import { askCoach } from "@/lib/coach";
import { percent } from "@/lib/format";

const GRADE_COLOR = {
  A: "var(--color-brand)",
  B: "var(--color-brand)",
  C: "var(--color-gold)",
  D: "var(--color-rose)",
  F: "var(--color-loss)",
};

const STATUS = {
  good: { label: "Good", cls: "bg-brand/10 text-brand", icon: <path d="M5 12l5 5 9-10" /> },
  ok: { label: "Okay", cls: "bg-gold-soft text-gold", icon: <path d="M12 8v5M12 16h.01" /> },
  warn: { label: "Watch out", cls: "bg-red-50 text-red-600", icon: <path d="M12 7v6M12 17h.01" /> },
};

export default function PortfolioDoctor({ hasHoldings, onResult, stale = false }) {
  const [report, setReport] = useState(null);
  const [hidden, setHidden] = useState([]); // tips the person said aren't for them
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function check() {
    setLoading(true);
    setError("");
    let riskLevel = null;
    try {
      riskLevel = JSON.parse(localStorage.getItem("lastPlan") || "null")?.risk_level ?? null;
    } catch {}
    try {
      const r = await api.practiceDoctor(riskLevel);
      setHidden([]);
      setReport(r);
      onResult?.(r);
      try {
        localStorage.setItem("seedwise-doctor-done", "true"); // earns the "Check-up" badge on the dashboard
        localStorage.setItem("seedwise-doctor-last", JSON.stringify({ grade: r.grade, score: r.score, checks: r.checks, at: new Date().toISOString() }));
      } catch {}
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <section className="@container rounded-3xl border border-line bg-surface p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12h4l3-8 4 16 3-8h4" />
            </svg>
          </span>
          <div>
            <h2 className="text-lg font-bold">AI Portfolio Doctor</h2>
            <p className="text-sm text-muted">A check-up on how spread out and risky your practice portfolio is.</p>
          </div>
        </div>
        <button
          onClick={check}
          disabled={loading || !hasHoldings}
          className="rounded-xl bg-brand px-6 py-3 font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-40"
        >
          {loading ? "Examining..." : report ? "Check again" : "Check my portfolio"}
        </button>
      </div>
      {stale && report && (
        <p className="mt-4 rounded-xl border border-brand-line bg-brand-soft px-4 py-2.5 text-sm text-brand">
          Your portfolio changed since this check-up. Run it again to see your new grade.
        </p>
      )}
      {!hasHoldings && <p className="mt-4 text-sm text-muted">Make a few trades first, then come back for a check-up.</p>}
      {error && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</p>}

      {report && !loading && (
        <div className="mt-6 grid gap-6 motion-safe:animate-page-in @3xl:grid-cols-[220px_1fr]">
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-ink p-6 text-center">
            <div
              className="flex h-28 w-28 items-center justify-center rounded-full border-[6px] font-display text-6xl font-bold"
              style={{ borderColor: GRADE_COLOR[report.grade], color: GRADE_COLOR[report.grade] }}
            >
              {report.grade}
            </div>
            <div className="text-sm text-muted">Health score {report.score}/100</div>
            {report.history_since_2016 && (
              <div className="mt-2 text-xs leading-relaxed text-slate-500">
                In its worst 12 months since 2016, this mix would have changed by{" "}
                <span className="font-semibold text-fg">{percent(report.history_since_2016.worst_12_months)}</span>.
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {report.headline && <p className="font-display text-xl font-bold">{report.headline}</p>}
            <ul className="grid gap-2.5 @lg:grid-cols-2">
              {report.checks.map((c) => {
                const s = STATUS[c.status];
                return (
                  <li key={c.name} className="flex gap-3 rounded-2xl border border-line bg-ink p-3.5">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${s.cls}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{s.icon}</svg>
                    </span>
                    <span className="text-sm">
                      <span className="font-semibold">{c.name}</span> <span className={`ml-1 text-xs ${s.cls.split(" ")[1]}`}>{s.label}</span>
                      <span className="mt-0.5 block text-muted">{c.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {report.tips.length > 0 && (
              <div className="rounded-2xl border border-brand-line bg-brand-soft p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-brand">The doctor suggests</div>
                  {hidden.length > 0 && (
                    <button type="button" onClick={() => setHidden([])} className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-fg">
                      Show {hidden.length} hidden tip{hidden.length > 1 ? "s" : ""}
                    </button>
                  )}
                </div>
                <ul className="mt-2 flex flex-col gap-2 text-sm text-slate-800">
                  {report.tips.map((t, i) =>
                    hidden.includes(i) ? null : (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                        <span className="flex-1">
                          {t}
                          <button
                            type="button"
                            onClick={() => askCoach(`The Portfolio Doctor gave me this tip: "${t}" What does it mean for my practice portfolio, and how would I do it?`)}
                            className="ml-2 whitespace-nowrap text-xs font-semibold text-brand underline-offset-2 hover:underline"
                          >
                            Ask the coach about this
                          </button>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setHidden((h) => [...h, i]);
                            api.feedback({ feature: "doctor", helpful: false, confidence_level: report.insight?.confidence?.level, note: "tip hidden: not for me" }).catch(() => {});
                          }}
                          className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-xs text-muted transition hover:border-slate-300 hover:text-fg"
                        >
                          Not for me
                        </button>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
            <InsightCard insight={report.insight} feature="doctor" title="How this grade works" />
            <p className="text-xs text-slate-500">{report.disclaimer}</p>
          </div>
        </div>
      )}
    </section>
  );
}
