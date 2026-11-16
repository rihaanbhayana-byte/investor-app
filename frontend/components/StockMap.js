"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { api } from "@/lib/api";
import { percent } from "@/lib/format";

export const CLUSTER_COLORS = {
  steady: "var(--color-sky)",
  grower: "var(--color-mint)",
  rocket: "var(--color-gold)",
  bumpy: "var(--color-rose)",
};

// Labels are only drawn for the group you focus on, so 36 symbols never pile on top of each other.
function Dot({ cx, cy, fill, payload, dimmed, showLabel, onPick }) {
  if (cx == null || cy == null) return null;
  return (
    <g style={{ cursor: "pointer", opacity: dimmed ? 0.15 : 1, transition: "opacity 0.3s" }} onClick={() => onPick(payload.symbol)}>
      <circle cx={cx} cy={cy} r={payload.asset_type === "etf" ? 9 : 7} fill={fill} fillOpacity={0.85} stroke="var(--color-surface)" strokeWidth={2} />
      {showLabel && (
        <text x={cx + 11} y={cy + 4} fontSize={11} fontWeight={600} fill="var(--color-fg)" stroke="var(--color-surface)" strokeWidth={3} paintOrder="stroke">
          {payload.symbol}
        </text>
      )}
    </g>
  );
}

function MapTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-ink/95 px-4 py-3 text-sm shadow-2xl">
      <div className="font-semibold">{p.symbol} · {p.name}</div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-5 gap-y-1 text-muted">
        <span>Avg yearly return</span><span className="text-right font-semibold text-fg">{percent(p.annual_return)}</span>
        <span>Swings (volatility)</span><span className="text-right font-semibold text-fg">{percent(p.annual_volatility)}</span>
        <span>Biggest drop</span><span className="text-right font-semibold text-fg">{percent(p.max_drawdown)}</span>
      </div>
    </div>
  );
}

export default function StockMap() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [focus, setFocus] = useState(null);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    api.stockMap().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-red-700">{error}</p>;
  if (!data) return <div className="h-[520px] animate-pulse rounded-3xl border border-line bg-surface" />;

  const pick = (symbol) => (window.location.href = `/stocks/${symbol}`);

  return (
    <section className="reveal flex flex-col gap-5 rounded-3xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-mint">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="8" r="2.5" /><circle cx="9" cy="17" r="2.5" /><circle cx="17" cy="18" r="2.5" />
            </svg>
            Machine learning
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Stock personality map</h2>
          <p className="mt-1.5 text-muted">
            An algorithm grouped all {data.points.length} stocks and funds by how they actually behaved since 2016. Higher up means more growth. Further right means bigger swings.
          </p>
        </div>
        <button onClick={() => setShowHow(!showHow)} className="rounded-full border border-line px-4 py-2 text-sm text-muted transition hover:border-line-strong hover:text-fg" aria-expanded={showHow}>
          {showHow ? "Hide" : "How does it work?"}
        </button>
      </div>

      {showHow && (
        <div className="rounded-2xl border border-mint-line bg-mint-soft p-5 text-sm leading-relaxed text-slate-800 motion-safe:animate-page-in">
          <p className="font-semibold text-fg">k-means clustering, in plain words</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>For each stock we measure three things from real prices: yearly return, how much it swings, and its biggest drop.</li>
            <li>We put those numbers on the same scale, so none of them counts more than the others.</li>
            <li>The algorithm drops 4 &ldquo;centres&rdquo; on the map, puts every stock with its nearest centre, then moves each centre to the middle of its group, again and again until nothing changes.</li>
            <li>Nobody tells it the answers. It discovers the groups by itself (this is called unsupervised learning). We just name the groups afterwards.</li>
          </ol>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {data.clusters.map((c) => (
          <button
            key={c.key}
            onClick={() => setFocus(focus === c.key ? null : c.key)}
            aria-pressed={focus === c.key}
            className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition ${focus === c.key ? "border-line-strong bg-slate-100 text-fg" : "border-line text-muted hover:text-fg"}`}
          >
            <span className="h-3 w-3 rounded-full" style={{ background: CLUSTER_COLORS[c.key] }} />
            {c.name} <span className="text-slate-500">({c.count})</span>
          </button>
        ))}
      </div>

      <div className="h-[340px] w-full sm:h-[460px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 16, bottom: 30, left: 0 }}>
            <CartesianGrid stroke="var(--color-grid)" />
            <XAxis
              type="number"
              dataKey="annual_volatility"
              name="Swings"
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              tick={{ fill: "var(--color-muted)", fontSize: 12 }}
              axisLine={{ stroke: "var(--color-line)" }}
              tickLine={false}
              label={{ value: "Swings per year (risk) →", position: "insideBottom", offset: -18, fill: "var(--color-muted)", fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="annual_return"
              name="Return"
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              tick={{ fill: "var(--color-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={48}
              label={{ value: "Yearly return →", angle: -90, position: "insideLeft", fill: "var(--color-muted)", fontSize: 12 }}
            />
            <ZAxis range={[60, 60]} />
            <Tooltip content={<MapTooltip />} cursor={{ strokeDasharray: "4 4", stroke: "var(--color-line-strong)" }} />
            {data.clusters.map((c) => (
              <Scatter
                key={c.key}
                name={c.name}
                data={data.points.filter((p) => p.cluster === c.key)}
                fill={CLUSTER_COLORS[c.key]}
                shape={(props) => <Dot {...props} dimmed={focus && focus !== c.key} showLabel={focus === c.key} onPick={pick} />}
                animationDuration={900}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.clusters.map((c) => (
          <div
            key={c.key}
            onMouseEnter={() => setFocus(c.key)}
            onMouseLeave={() => setFocus(null)}
            className={`rounded-2xl border bg-ink p-4 transition ${focus === c.key ? "border-line-strong" : "border-line"}`}
          >
            <div className="flex items-center gap-2 font-semibold">
              <span className="h-3 w-3 rounded-full" style={{ background: CLUSTER_COLORS[c.key] }} />
              {c.name}
            </div>
            <p className="mt-1.5 text-sm text-muted">{c.description}</p>
            <p className="mt-2 text-xs text-slate-500">
              Avg {percent(c.avg_return)} a year · swings {percent(c.avg_volatility)}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {c.members.map((m) => (
                <Link key={m} href={`/stocks/${m}`} className="rounded-md border border-line px-1.5 py-0.5 text-xs text-slate-700 transition hover:border-mint hover:text-mint">
                  {m}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Hover a dot for details, or tap a group above to label its members. Bigger dots are funds. Click a dot to open it. {data.disclaimer}</p>
    </section>
  );
}
