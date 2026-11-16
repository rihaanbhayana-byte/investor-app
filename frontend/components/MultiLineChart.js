"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip, SERIES_COLORS, monthName, monthAxis } from "@/components/ui";

export default function MultiLineChart({ data, lines, format, height = "h-80" }) {
  return (
    <div>
      <div className={`${height} w-full`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-grid)" vertical={false} />
            <XAxis dataKey="month" {...monthAxis(data)} interval={0} tick={{ fill: "var(--color-muted)", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "var(--color-line)" }} />
            <YAxis width={70} tickFormatter={format} tick={{ fill: "var(--color-muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip format={format} labelFormat={monthName} />} cursor={{ stroke: "var(--color-line-strong)" }} />
            {lines.map((line, i) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.name}
                stroke={line.color || SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={line.dashed ? 2 : 2.5}
                strokeDasharray={line.dashed ? "6 6" : undefined}
                dot={false}
                activeDot={{ r: 4 }}
                animationDuration={1400}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-5 text-[13px] text-muted">
        {lines.map((line, i) => (
          <span key={line.key} className="flex items-center gap-2">
            <span
              className={line.dashed ? "w-4 border-t-2 border-dashed" : "h-[3px] w-4"}
              style={line.dashed ? { borderColor: line.color } : { background: line.color || SERIES_COLORS[i % SERIES_COLORS.length] }}
            />
            {line.name}
          </span>
        ))}
      </div>
    </div>
  );
}
