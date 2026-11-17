"use client";

import { useState } from "react";
import { api } from "@/lib/api";

// One consistent card for every AI or ML recommendation:
// a MEASURED confidence (never the AI rating itself), then "Why?", "Based on" and "Assumptions",
// and a thumbs up / down that is saved so we can see which answers people trust.

const LEVEL_STYLE = {
  high: { chip: "border-gain-line bg-gain-soft text-gain", bar: "var(--color-gain)", word: "High confidence" },
  medium: { chip: "border-amber-200 bg-amber-50 text-gold", bar: "var(--color-gold)", word: "Medium confidence" },
  low: { chip: "border-red-200 bg-red-50 text-red-600", bar: "var(--color-rose)", word: "Low confidence" },
};

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const THUMB = <path d="M7 10v11H4V10zM7 10l4-7a2 2 0 0 1 3 2l-1 5h6a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 2H7" />;

export function ConfidenceChip({ confidence, className = "" }) {
  const style = LEVEL_STYLE[confidence.level] || LEVEL_STYLE.medium;
  return (
    <span
      title={`${style.word}. ${confidence.measure}`}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${style.chip} ${className}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: style.bar }} aria-hidden="true" />
      <span className="truncate">{confidence.label}</span>
    </span>
  );
}

export function Feedback({ feature, level, compact = false }) {
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(false);

  async function vote(helpful) {
    setSent(helpful);
    try {
      await api.feedback({ feature, helpful, confidence_level: level });
    } catch {
      setError(true);
    }
  }

  if (sent !== null)
    return <span className="text-xs text-muted" role="status">{error ? "Couldn't save, but thanks!" : "Thanks for the feedback!"}</span>;
  return (
    <span className="flex items-center gap-1">
      {!compact && <span className="mr-1 text-xs text-muted">Helpful?</span>}
      <button type="button" onClick={() => vote(true)} aria-label="Helpful" className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-brand-soft hover:text-brand">
        <Icon d={THUMB} size={15} />
      </button>
      <button type="button" onClick={() => vote(false)} aria-label="Not helpful" className="flex h-7 w-7 rotate-180 items-center justify-center rounded-full text-muted transition hover:bg-red-50 hover:text-red-600">
        <Icon d={THUMB} size={15} />
      </button>
    </span>
  );
}

function List({ title, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</div>
      <ul className="mt-1.5 flex flex-col gap-1 text-sm text-slate-700">
        {items.map((t) => (
          <li key={t} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * insight = { confidence: {level, label, value, measure}, why: [], based_on: [], assumptions: [] }
 * feature = name sent with feedback (coach, explain, matcher, strategy, goal_reader, personality, projection, doctor, stock_map)
 */
export default function InsightCard({ insight, feature, title = "How sure is this?", defaultOpen = false, className = "" }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!insight?.confidence) return null;
  const { confidence } = insight;
  const style = LEVEL_STYLE[confidence.level] || LEVEL_STYLE.medium;
  const hasMore = insight.why?.length || insight.based_on?.length || insight.assumptions?.length;

  return (
    <div className={`@container rounded-2xl border border-line bg-surface-2 p-4 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</span>
        <ConfidenceChip confidence={confidence} />
        <span className="ml-auto">
          <Feedback feature={feature} level={confidence.level} />
        </span>
      </div>

      {confidence.value != null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(confidence.value * 100)} aria-label={confidence.label}>
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(3, confidence.value * 100)}%`, background: style.bar }} />
        </div>
      )}

      {hasMore ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-brand transition hover:text-brand-light"
        >
          {open ? "Hide details" : "Why? · Based on · How we measured it"}
          <span className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <Icon d={<path d="M6 9l6 6 6-6" />} size={14} />
          </span>
        </button>
      ) : (
        <p className="mt-2 text-xs text-muted">{confidence.measure}</p>
      )}

      {open && (
        <div className="mt-3 grid gap-4 border-t border-line pt-3 motion-safe:animate-page-in @lg:grid-cols-2">
          <List title="Why" items={insight.why} />
          <List title="Based on" items={insight.based_on} />
          <List title="Assumptions" items={insight.assumptions} />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">How we measured it</div>
            <p className="mt-1.5 text-sm text-slate-700">{confidence.measure}</p>
          </div>
        </div>
      )}
    </div>
  );
}
