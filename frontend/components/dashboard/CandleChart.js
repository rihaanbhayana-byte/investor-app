"use client";

import { useEffect, useRef, useState } from "react";

// Candlestick chart with volume bars, drawn in SVG from real daily open/high/low/close.
// Green candle = closed higher than it opened; red = closed lower.

const fmt = (n) => (n >= 1000 ? `$${Math.round(n).toLocaleString()}` : `$${n.toFixed(n < 10 ? 2 : 0)}`);
const vol = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n.toLocaleString());

function niceTicks(min, max, count = 5) {
  const raw = (max - min) / count || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(v);
  return ticks;
}

export default function CandleChart({ bars = [], group = "day", height = 280 }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (bars.length < 2) return <div ref={wrap} style={{ height }} className="flex items-center justify-center text-sm text-muted">Not enough price history yet.</div>;

  const pad = { l: 48, r: 8, t: 8, b: 22 };
  const volH = Math.round(height * 0.16);
  const priceH = height - pad.t - pad.b - volH - 8;
  const plotW = width - pad.l - pad.r;
  const hi = Math.max(...bars.map((b) => b.high));
  const lo = Math.min(...bars.map((b) => b.low));
  const span = hi - lo || 1;
  const yMin = lo - span * 0.05;
  const yMax = hi + span * 0.05;
  const y = (v) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * priceH;
  const maxVol = Math.max(...bars.map((b) => b.volume)) || 1;
  const slot = plotW / bars.length;
  const bodyW = Math.max(1, Math.min(14, slot * 0.62));
  const x = (i) => pad.l + slot * (i + 0.5);
  const ticks = niceTicks(yMin, yMax, 5);

  // x labels: wherever the year (long ranges), month, or week (1M) changes, if there's room
  const labels = [];
  const minGap = 46;
  let lastText = "";
  bars.forEach((b, i) => {
    const d = new Date(b.date + "T00:00:00");
    const text = group === "month" && bars.length > 30 ? String(d.getFullYear()) : group === "day" && bars.length <= 31 ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : d.toLocaleDateString(undefined, { month: "short" });
    const prev = labels.at(-1);
    const changed = group === "day" && bars.length <= 31 ? i % 5 === 0 : i > 0 && text !== lastText;
    lastText = text;
    if ((changed || i === 0) && (!prev || x(i) - x(prev.i) >= minGap) && prev?.text !== text) labels.push({ i, text });
  });

  const h = hover != null ? bars[hover] : null;
  const first = bars[0].open;
  const last = bars.at(-1).close;

  return (
    <div ref={wrap} className="relative" style={{ height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Price chart: from ${fmt(first)} to ${fmt(last)} (${last >= first ? "up" : "down"} ${Math.abs((last / first - 1) * 100).toFixed(1)}%)`}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.floor((e.clientX - r.left - pad.l) / slot);
          setHover(i >= 0 && i < bars.length ? i : null);
        }}
        onMouseLeave={() => setHover(null)}
        className="block"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray="3 4" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">{fmt(t)}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const up = b.close >= b.open;
          const color = up ? "var(--color-gain)" : "var(--color-loss)";
          const top = y(Math.max(b.open, b.close));
          const bodyH = Math.max(1, Math.abs(y(b.open) - y(b.close)));
          const vh = (b.volume / maxVol) * volH;
          return (
            <g key={b.date} opacity={hover == null || hover === i ? 1 : 0.55}>
              <line x1={x(i)} x2={x(i)} y1={y(b.high)} y2={y(b.low)} stroke={color} strokeWidth="1" />
              <rect x={x(i) - bodyW / 2} y={top} width={bodyW} height={bodyH} fill={color} rx={bodyW > 4 ? 1 : 0} />
              <rect x={x(i) - bodyW / 2} y={height - pad.b - vh} width={bodyW} height={vh} fill={color} opacity="0.28" />
            </g>
          );
        })}
        {labels.map((l) => (
          <text key={l.i} x={x(l.i)} y={height - 5} textAnchor="middle" fontSize="11" fill="var(--color-muted)">{l.text}</text>
        ))}
        {h && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="var(--color-muted)" strokeDasharray="2 3" />}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-float"
          style={{ left: Math.min(Math.max(x(hover) + 12, pad.l), width - 170) }}
        >
          <div className="font-semibold">
            {new Date(h.date + "T00:00:00").toLocaleDateString(undefined, group === "month" ? { month: "long", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" })}
            {group === "week" && " (week)"}
          </div>
          <div className="mt-1 grid grid-cols-[auto_auto] gap-x-3 tabular-nums text-muted">
            <span>Open</span><span className="text-right text-fg">${h.open.toFixed(2)}</span>
            <span>High</span><span className="text-right text-fg">${h.high.toFixed(2)}</span>
            <span>Low</span><span className="text-right text-fg">${h.low.toFixed(2)}</span>
            <span>Close</span><span className={`text-right font-semibold ${h.close >= h.open ? "text-gain" : "text-loss"}`}>${h.close.toFixed(2)}</span>
            <span>Volume</span><span className="text-right text-fg">{vol(h.volume)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
