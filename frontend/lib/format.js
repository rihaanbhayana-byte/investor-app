export function money(n) {
  if (n == null) return "–";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function price(n) {
  if (n == null) return "–";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function percent(n) {
  if (n == null) return "–";
  return `${(n * 100).toFixed(1)}%`;
}

export function bigMoney(n) {
  if (n == null) return "–";
  const size = Math.abs(n);
  const sign = n < 0 ? "-" : ""; // "-$9.1B", the same style as "-$4.65"
  if (size >= 1e12) return `${sign}$${(size / 1e12).toFixed(2)}T`;
  if (size >= 1e9) return `${sign}$${(size / 1e9).toFixed(1)}B`;
  if (size >= 1e6) return `${sign}$${(size / 1e6).toFixed(1)}M`;
  return money(n);
}

export const LEVEL_LABELS = {
  conservative: "Conservative",
  moderate: "Moderate",
  aggressive: "Aggressive",
};
