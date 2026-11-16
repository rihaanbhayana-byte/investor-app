"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { price } from "@/lib/format";

export default function PriceChart({ data }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" minTickGap={40} />
          <YAxis tickFormatter={(v) => `$${Math.round(v)}`} width={60} domain={["auto", "auto"]} />
          <Tooltip formatter={(value) => price(value)} />
          <Line type="monotone" dataKey="close" name="Price" stroke="#059669" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
