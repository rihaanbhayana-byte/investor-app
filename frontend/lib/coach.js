"use client";

// A tiny message bus so any page can open the AI coach side panel,
// and tell it what the person is looking at ("NVDA stock page").

export function askCoach(question = "") {
  window.dispatchEvent(new CustomEvent("seedwise:ask", { detail: { question } }));
}

export function setPageContext(text) {
  window.__seedwiseContext = text || "";
  window.dispatchEvent(new CustomEvent("seedwise:context"));
}

export function getPageContext() {
  return (typeof window !== "undefined" && window.__seedwiseContext) || "";
}
