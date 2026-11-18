"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { enableDeviceLogin, forgetDevice, lockNow, markUnlocked, rememberPin } from "@/lib/pin";
import { supabase } from "@/lib/supabase";

function PinField({ id, label, value, onChange, autoFocus }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="••••••"
        className="w-44 rounded-xl border border-line bg-surface px-4 py-2.5 text-center text-lg tracking-[0.5em] text-fg focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
      />
    </label>
  );
}

// Profile → Security: how you sign in, and your 6-digit PIN.
export default function PinSettings({ user }) {
  const [enabled, setEnabled] = useState(null);
  const [mode, setMode] = useState(null); // null | "set" | "change" | "off"
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });

  useEffect(() => {
    api.pinStatus().then((s) => setEnabled(s.enabled)).catch((e) => (setEnabled(false), setMsg({ text: e.message, ok: false })));
  }, []);

  const reset = () => (setMode(null), setCurrent(""), setPin(""), setAgain(""));

  async function save(e) {
    e.preventDefault();
    setMsg({ text: "", ok: false });
    if (mode !== "off" && pin !== again) return setMsg({ text: "The two PINs don't match.", ok: false });
    setBusy(true);
    try {
      if (mode === "off") {
        await api.pinRemove(current);
        rememberPin(null);
        forgetDevice();
        setEnabled(false);
        setMsg({ text: "PIN turned off.", ok: true });
      } else {
        await api.pinSet(pin, mode === "change" ? current : undefined);
        rememberPin(user.id);
        markUnlocked();
        await enableDeviceLogin(user);
        setEnabled(true);
        setMsg({ text: mode === "change" ? "PIN changed." : "PIN is on. Use it to unlock, or to log in on this device.", ok: true });
      }
      reset();
    } catch (err) {
      setMsg({ text: err.message, ok: false });
    }
    setBusy(false);
  }

  async function forgot() {
    await supabase.auth.signOut({ scope: "local" });
    window.location.href = "/login?pin=forgot&next=/profile";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">6-digit PIN</span>
              {enabled !== null && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${enabled ? "bg-gain-soft text-gain" : "bg-surface-2 text-muted"}`}>{enabled ? "On" : "Off"}</span>}
            </div>
            <p className="mt-1 max-w-md text-sm text-muted">
              Log in and unlock Seedwise on this device with a PIN instead of your password. We ask for it in a new tab, after 5 minutes away, or when you tap Lock now. 5 wrong tries turns the PIN off.
            </p>
          </div>
          {mode === null && enabled !== null && (
            <div className="flex flex-wrap gap-2">
              {enabled ? (
                <>
                  <button type="button" onClick={lockNow} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-ink">Lock now</button>
                  <button type="button" onClick={() => setMode("change")} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold hover:border-brand hover:text-brand">Change PIN</button>
                  <button type="button" onClick={() => setMode("off")} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold hover:border-brand hover:text-brand">Turn off</button>
                </>
              ) : (
                <button type="button" onClick={() => setMode("set")} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-ink">Set up PIN</button>
              )}
            </div>
          )}
        </div>

        {mode && (
          <form onSubmit={save} className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
            <div className="flex flex-wrap gap-4">
              {(mode === "change" || mode === "off") && <PinField id="pin-current" label="Current PIN" value={current} onChange={setCurrent} autoFocus />}
              {mode !== "off" && <PinField id="pin-new" label="New PIN" value={pin} onChange={setPin} autoFocus={mode === "set"} />}
              {mode !== "off" && <PinField id="pin-again" label="Type it again" value={again} onChange={setAgain} />}
            </div>
            {mode !== "off" && <p className="text-xs text-muted">Avoid easy PINs like 123456, repeats or your birthday.</p>}
            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={busy || (mode !== "set" && current.length !== 6) || (mode !== "off" && (pin.length !== 6 || again.length !== 6))}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${mode === "off" ? "bg-red-600" : "bg-brand"}`}
              >
                {busy ? "Saving…" : mode === "off" ? "Turn off PIN" : "Save PIN"}
              </button>
              <button type="button" onClick={reset} className="rounded-xl border border-line px-4 py-2 text-sm">Cancel</button>
              {mode !== "set" && <button type="button" onClick={forgot} className="ml-auto text-xs font-semibold text-brand">Forgot your PIN?</button>}
            </div>
          </form>
        )}
        {msg.text && <p role="status" className={`mt-3 text-sm ${msg.ok ? "text-gain" : "text-red-600"}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
