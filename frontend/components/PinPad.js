"use client";

import { useEffect } from "react";

// Six dots and a number pad. Works with taps and with the keyboard.
export function PinDots({ value, error }) {
  return (
    <div className={`flex justify-center gap-3 ${error ? "motion-safe:animate-[pin-shake_0.35s]" : ""}`} aria-hidden="true">
      <style>{`@keyframes pin-shake{20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`}</style>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-3.5 w-3.5 rounded-full border-2 transition ${i < value.length ? (error ? "border-loss bg-loss" : "border-brand bg-brand") : "border-line-strong"}`} />
      ))}
    </div>
  );
}

export default function PinPad({ value, onChange, onComplete, disabled, extraKey }) {
  function press(d) {
    if (disabled || value.length >= 6) return;
    const next = value + d;
    onChange(next);
    if (next.length === 6) onComplete?.(next);
  }
  function back() {
    if (!disabled) onChange(value.slice(0, -1));
  }
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const key = "flex h-14 items-center justify-center rounded-2xl text-xl font-semibold transition hover:bg-surface-2 active:scale-95 disabled:opacity-40";
  return (
    <div className="mx-auto grid w-full max-w-[280px] grid-cols-3 gap-2" role="group" aria-label="Number pad">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <button key={d} type="button" className={key} onClick={() => press(d)} disabled={disabled} aria-label={d}>
          {d}
        </button>
      ))}
      <span className="flex items-center justify-center">{extraKey}</span>
      <button type="button" className={key} onClick={() => press("0")} disabled={disabled} aria-label="0">
        0
      </button>
      <button type="button" className={key} onClick={back} disabled={disabled} aria-label="Delete last digit">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 5H9l-6 7 6 7h12zM18 9l-6 6M12 9l6 6" /></svg>
      </button>
    </div>
  );
}
