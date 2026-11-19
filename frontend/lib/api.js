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
    throw Object.assign(new Error(message), { status: response.status });
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

// Ask the backend for a PDF and save it.
async function downloadPdf(path, body, filename, needsLogin = false) {
  const headers = { "Content-Type": "application/json" };
  if (needsLogin) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const response = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Couldn't make the PDF. Please try again.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const api = {
  questions: () => request("/questions"),
  riskProfile: (body) => post("/risk-profile", body),
  portfolio: (level) => request(`/portfolios/${level}`),
  projection: (body) => post("/projection", body),
  buildMix: (body) => post("/engine/build", body),
  stocks: () => request("/stocks"),
  candles: (symbol, range = "1Y") => request(`/candles/${encodeURIComponent(symbol)}?range=${range}`),
  quotes: (symbols) => request(`/quotes?symbols=${encodeURIComponent(symbols.join(","))}`),
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
  matchPlan: (targets, useCash = 0, apply = false) => withLogin("/practice/match-plan", { method: "POST", body: JSON.stringify({ targets, use_cash: useCash, apply }) }),
  planPdf: (body) => downloadPdf("/report/plan", body, "seedwise-plan.pdf"),
  portfolioPdf: (body) => downloadPdf("/report/portfolio", body, "seedwise-portfolio.pdf", true),
  account: () => withLogin("/account"),
  setAccountPrefs: (prefs) => withLogin("/account/preferences", { method: "POST", body: JSON.stringify(prefs) }),
  deleteAccount: () => withLogin("/account", { method: "DELETE" }),
  pinStatus: () => withLogin("/pin"),
  pinSet: (pin, currentPin) => withLogin("/pin", { method: "POST", body: JSON.stringify({ pin, current_pin: currentPin || undefined }) }),
  pinVerify: (pin) => withLogin("/pin/verify", { method: "POST", body: JSON.stringify({ pin }) }),
  pinRemove: (pin) => withLogin("/pin", { method: "DELETE", body: JSON.stringify({ pin }) }),
  pinAddDevice: () => withLogin("/pin/device", { method: "POST" }),
  pinForgetDevice: (deviceToken) => post("/pin/device/forget", { device_token: deviceToken }),
  pinLogin: (deviceToken, pin) => post("/pin/login", { device_token: deviceToken, pin }),
  practiceDoctor: (riskLevel) => withLogin("/practice/doctor", { method: "POST", body: JSON.stringify({ risk_level: riskLevel }) }),
};
