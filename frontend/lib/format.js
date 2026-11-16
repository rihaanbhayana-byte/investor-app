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
  if (size >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (size >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (size >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return money(n);
}

export const LEVEL_LABELS = {
  conservative: "Conservative",
  moderate: "Moderate",
  aggressive: "Aggressive",
};
