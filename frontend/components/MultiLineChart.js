"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#2563eb", "#059669", "#f59e0b", "#db2777"];

export default function MultiLineChart({ data, lines, format }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" minTickGap={40} />
          <YAxis width={70} tickFormatter={format} />
          <Tooltip formatter={(value) => format(value)} />
          <Legend />
          {lines.map((line, i) => (
            <Line key={line.key} type="monotone" dataKey={line.key} name={line.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
