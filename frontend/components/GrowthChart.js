"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money } from "@/lib/format";

export default function GrowthChart({ data }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="year" tickFormatter={(y) => `Yr ${y}`} />
          <YAxis tickFormatter={(v) => `$${(v / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`} width={60} />
          <Tooltip formatter={(value) => money(value)} labelFormatter={(y) => `Year ${y}`} />
          <Legend />
          <Line type="monotone" dataKey="high" name="Good case" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="median" name="Typical" stroke="#2563eb" strokeWidth={3} dot={false} />
          <Line type="monotone" dataKey="low" name="Bad case" stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="contributed" name="Money you put in" stroke="#64748b" strokeDasharray="5 5" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
