import { supabase } from "@/lib/supabase";

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

// Sends the user's login token so the backend knows whose practice portfolio it is.
async function withLogin(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return request(path, { ...options, headers: token ? { Authorization: `Bearer ${token}` } : {} });
}

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
  search: (q) => request(`/search?q=${encodeURIComponent(q)}`),
  liveStock: (symbol) => request(`/live-stock/${symbol}`),
  quote: (symbol) => request(`/quote/${encodeURIComponent(symbol)}`),
  compare: (symbols) => request(`/compare?symbols=${symbols.join(",")}`),
  practice: () => withLogin("/practice"),
  practiceTrade: (body) => withLogin("/practice/trade", { method: "POST", body: JSON.stringify(body) }),
  practiceReset: () => withLogin("/practice/reset", { method: "POST" }),
  crashTest: (event, level, amount) => request(`/crash-test?event=${event}&risk_level=${level}&amount=${amount}`),
  strategyTest: (text, rules) => post("/strategy-test", rules ? { text, rules } : { text }),
  stockMap: (k = 4) => request(`/stock-map?k=${k}`),
  guardrails: () => request("/guardrails"),
  matchInterests: (text) => post("/match-interests", { text }),
  feedback: (body) => withLogin("/feedback", { method: "POST", body: JSON.stringify(body) }),
  practiceDoctor: (riskLevel) => withLogin("/practice/doctor", { method: "POST", body: JSON.stringify({ risk_level: riskLevel }) }),
};
