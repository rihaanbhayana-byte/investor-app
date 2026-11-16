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

const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  questions: () => request("/questions"),
  riskProfile: (body) => post("/risk-profile", body),
  portfolio: (level) => request(`/portfolios/${level}`),
  projection: (body) => post("/projection", body),
  stocks: () => request("/stocks"),
  stock: (symbol) => request(`/stocks/${symbol}`),
  chat: (body) => post("/chat", body),
  parseGoal: (body) => post("/parse-goal", body),
  explainStock: (symbol) => request(`/explain-stock/${symbol}`),
  timeMachine: (symbol, amount, start) => request(`/time-machine?symbol=${symbol}&amount=${amount}&start=${start}`),
  goalCalculator: (body) => post("/goal-calculator", body),
  compare: (symbols) => request(`/compare?symbols=${symbols.join(",")}`),
};
