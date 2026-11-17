"use client";

// Which plan the practice portfolio is following (saved on this device).
const KEY = "seedwise-practice-plan";

export function getFollowedPlan() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function followPlan(plan) {
  if (!plan?.holdings?.length) return;
  localStorage.setItem(
    KEY,
    JSON.stringify({
      goal: plan.goal,
      portfolio: plan.portfolio,
      risk_level: plan.risk_level,
      holdings: plan.holdings.map((h) => ({ symbol: h.symbol, weight: h.weight })),
      since: new Date().toISOString(),
    })
  );
  window.dispatchEvent(new Event("seedwise:plan-followed"));
}

export function stopFollowing() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("seedwise:plan-followed"));
}

// The plan built most recently on this device, in the shape followPlan needs.
export function lastBuiltPlan() {
  try {
    const p = JSON.parse(localStorage.getItem("lastPlan") || "null");
    return p?.holdings?.length ? p : null;
  } catch {
    return null;
  }
}
