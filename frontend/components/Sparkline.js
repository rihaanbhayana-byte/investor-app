// A tiny price line: green if it ended higher than it started, red if lower.
export default function Sparkline({ values = [], width = 96, height = 32, label }) {
  if (!values || values.length < 2) return <span style={{ width, height }} className="inline-block" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`);
  const up = values.at(-1) >= values[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label || `Last ${values.length} days: ${up ? "up" : "down"}`} className={up ? "text-gain" : "text-loss"}>
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
