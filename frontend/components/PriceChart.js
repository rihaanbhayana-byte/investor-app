"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { price } from "@/lib/format";
import { ChartTooltip, monthName, monthAxis } from "@/components/ui";

export default function PriceChart({ data, up = true }) {
  const color = up ? "var(--color-mint)" : "var(--color-loss)";
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sw-price" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-grid)" vertical={false} />
          <XAxis dataKey="month" {...monthAxis(data)} interval={0} tick={{ fill: "var(--color-muted)", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "var(--color-line)" }} />
          <YAxis tickFormatter={(v) => `$${Math.round(v)}`} width={60} domain={["auto", "auto"]} tick={{ fill: "var(--color-muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip format={price} labelFormat={monthName} />} cursor={{ stroke: "var(--color-line-strong)" }} />
          <Area type="monotone" dataKey="close" name="Price" stroke={color} strokeWidth={2.5} fill="url(#sw-price)" animationDuration={1200} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
