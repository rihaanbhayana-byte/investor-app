const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body.detail === "string" ? body.detail : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}

export const api = {
  questions: () => request("/questions"),
  riskProfile: (body) => request("/risk-profile", { method: "POST", body: JSON.stringify(body) }),
  portfolio: (level) => request(`/portfolios/${level}`),
  projection: (body) => request("/projection", { method: "POST", body: JSON.stringify(body) }),
  stocks: () => request("/stocks"),
  stock: (symbol) => request(`/stocks/${symbol}`),
};
