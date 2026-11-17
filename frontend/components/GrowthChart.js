"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money } from "@/lib/format";

function axisMoney(v) {
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`;
  return `$${v}`;
}

function Row({ color, label, value, dashed }) {
  return (
    <div className="flex items-center justify-between gap-6 py-0.5">
      <span className="flex items-center gap-2 text-muted">
        <span className={dashed ? "w-3 border-t-2 border-dashed" : "h-2.5 w-2.5 rounded-sm"} style={dashed ? { borderColor: color } : { background: color }} />
        {label}
      </span>
      <span className="font-semibold text-fg">{money(value)}</span>
    </div>
  );
}

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-ink/95 px-4 py-3 text-sm shadow-2xl">
      <div className="mb-1.5 font-semibold">Year {label}</div>
      <Row color="var(--color-brand-light)" label="Good case" value={d.high} />
      <Row color="var(--color-brand)" label="Likely" value={d.median} />
      <Row color="var(--color-brand-line)" label="Bad case" value={d.low} />
      <Row color="var(--color-dim)" label="You put in" value={d.contributed} dashed />
    </div>
  );
}

export default function GrowthChart({ data }) {
  const rows = data.map((d) => ({ ...d, range: [d.low, d.high] }));

  return (
    <div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="sw-band" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0.06} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-grid)" vertical={false} />
            <XAxis
              dataKey="year"
              tickFormatter={(y) => `Yr ${y}`}
              tick={{ fill: "var(--color-muted)", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-line)" }}
            />
            <YAxis tickFormatter={axisMoney} width={56} tick={{ fill: "var(--color-muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip content={<TooltipBox />} cursor={{ stroke: "var(--color-line-strong)" }} />
            <Area type="monotone" dataKey="range" stroke="none" fill="url(#sw-band)" animationDuration={1400} />
            <Line type="monotone" dataKey="contributed" stroke="var(--color-dim)" strokeWidth={2} strokeDasharray="6 6" dot={false} animationDuration={1400} />
            <Line type="monotone" dataKey="median" stroke="var(--color-brand)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} animationDuration={1800} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-5 text-[13px] text-muted">
        <span className="flex items-center gap-2"><span className="h-[3px] w-4 bg-brand" />Likely path</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-4 rounded-sm bg-brand/25" />Range (bad case to good case)</span>
        <span className="flex items-center gap-2"><span className="w-4 border-t-2 border-dashed border-dim" />Money you put in</span>
      </div>
    </div>
  );
}
