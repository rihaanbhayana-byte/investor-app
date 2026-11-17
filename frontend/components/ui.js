"use client";

import { useEffect, useState } from "react";

// Shared building blocks for the Seedwise look.

export const SERIES_COLORS = ["var(--color-brand)", "var(--color-sky)", "var(--color-gold)", "var(--color-violet)", "var(--color-rose)"];

const AVATAR_COLORS = ["var(--color-brand)", "var(--color-sky)", "var(--color-gold)", "var(--color-violet)", "var(--color-rose)", "#2CB5A8"];

export function Avatar({ symbol, size = 44 }) {
  const sum = [...(symbol || "?")].reduce((a, c) => a + c.charCodeAt(0), 0);
  const tint = AVATAR_COLORS[sum % AVATAR_COLORS.length];
  const bg = `color-mix(in srgb, ${tint} 16%, var(--color-surface))`;
  const fg = `color-mix(in srgb, ${tint} 80%, var(--color-fg))`;
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-xl font-display font-bold"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * (symbol?.length > 3 ? 0.3 : 0.36) }}
    >
      {symbol}
    </span>
  );
}

export function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Select({ value, onChange, children, label, className = "" }) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 cursor-pointer appearance-none truncate rounded-2xl border border-line bg-ink py-3.5 pl-4 pr-11 text-fg transition hover:border-slate-300 focus:border-brand focus:outline-none"
      >
        {children}
      </select>
      <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-full border border-line bg-ink p-1">
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${value === id ? "bg-brand text-brand-ink" : "text-muted hover:text-fg"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function ReturnPill({ value, children }) {
  if (value == null) return <span className="text-muted">–</span>;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${up ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss"}`}>
      {up ? "▲" : "▼"} {children}
    </span>
  );
}

export function useCountUp(target, ms = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target == null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

export function ChartTooltip({ active, payload, label, format, labelFormat }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-ink/95 px-4 py-3 text-sm shadow-2xl">
      <div className="mb-1.5 font-semibold">{labelFormat ? labelFormat(label) : label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-6 py-0.5">
          <span className="flex items-center gap-2 text-muted">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color || p.stroke }} />
            {p.name}
          </span>
          <span className="font-semibold text-fg">{format ? format(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthName = (m) => (m ? `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}` : "");

export const RISE = `@keyframes sw-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }`;

// Clean x-axis labels: one tick per year for long ranges, month names for short ones.
export function monthAxis(data) {
  const months = data.map((d) => d.month);
  if (months.length > 30) {
    const ticks = months.filter((m) => m.endsWith("-01"));
    return { ticks, tickFormatter: (m) => m.slice(0, 4) };
  }
  const step = Math.ceil(months.length / 6);
  return { ticks: months.filter((_, i) => i % step === 0), tickFormatter: (m) => `${MONTHS[Number(m.slice(5, 7)) - 1]} '${m.slice(2, 4)}` };
}
