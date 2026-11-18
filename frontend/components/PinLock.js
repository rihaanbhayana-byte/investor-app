"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { LOCK_AFTER_MS, PIN_ON, UNLOCKED, markUnlocked, rememberPin } from "@/lib/pin";
import { supabase } from "@/lib/supabase";
import Logo from "./Logo";
import PinPad, { PinDots } from "./PinPad";

// The lock screen. Shown when someone who set a PIN opens Seedwise in a new tab,
// comes back after 5 minutes away, or taps "Lock now". The PIN is checked by the server.
const NO_LOCK = ["/login"];

export default function PinLock() {
  const [locked, setLocked] = useState(false);
  const [user, setUser] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hiddenAt = useRef(0);

  useEffect(() => {
    const path = () => window.location.pathname.replace(/\/+$/, "") || "/";
    async function check() {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      setUser(u || null);
      if (!u || NO_LOCK.includes(path())) {
        document.documentElement.classList.remove("pin-locked");
        return;
      }
      let onHere = false;
      try {
        onHere = localStorage.getItem(PIN_ON) === u.id;
      } catch {}
      let unlocked = false;
      try {
        unlocked = sessionStorage.getItem(UNLOCKED) === "1";
      } catch {}
      if (onHere && !unlocked) setLocked(true);
      else document.documentElement.classList.remove("pin-locked");
      // keep this device in step with the server (PIN set or removed on another device)
      api.pinStatus().then((s) => {
        if (s.enabled && !onHere) rememberPin(u.id);
        if (!s.enabled && onHere) {
          rememberPin(null);
          setLocked(false);
          markUnlocked();
        }
      }).catch(() => {});
    }
    check();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        // they just proved who they are (with their password): no PIN needed in this tab
        markUnlocked();
        setLocked(false);
        setUser(session?.user || null);
      }
      if (event === "SIGNED_OUT") {
        rememberPin(null);
        try {
          sessionStorage.removeItem(UNLOCKED);
        } catch {}
        setLocked(false);
        document.documentElement.classList.remove("pin-locked");
      }
    });
    const onVisible = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > LOCK_AFTER_MS) {
        try {
          sessionStorage.removeItem(UNLOCKED);
        } catch {}
        check();
      }
    };
    const onLock = () => check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("seedwise:lock", onLock);
    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("seedwise:lock", onLock);
    };
  }, []);

  async function verify(value) {
    setBusy(true);
    setError("");
    try {
      const r = await api.pinVerify(value);
      if (r.ok) {
        markUnlocked();
        setLocked(false);
        setPin("");
      } else {
        setError(`Wrong PIN. ${r.attempts_left} ${r.attempts_left === 1 ? "try" : "tries"} left.`);
        setPin("");
      }
    } catch (e) {
      if (e.status === 423 || e.status === 401) {
        await supabase.auth.signOut({ scope: "local" });
        window.location.href = "/login?pin=reset";
        return;
      }
      setError(e.message);
      setPin("");
    }
    setBusy(false);
  }

  async function forgot() {
    await supabase.auth.signOut({ scope: "local" });
    window.location.href = "/login?pin=forgot";
  }

  if (!locked || !user) return null;
  const name = (user.user_metadata?.full_name || user.email || "").split(/[ @]/)[0];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink px-6" role="dialog" aria-modal="true" aria-labelledby="pin-title">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <Logo size={44} />
        <div>
          <h1 id="pin-title" className="text-2xl font-bold tracking-tight">Welcome back{name ? `, ${name}` : ""}</h1>
          <p className="mt-1 text-sm text-muted">Enter your 6-digit Seedwise PIN</p>
        </div>
        <PinDots value={pin} error={Boolean(error)} />
        <p className="min-h-5 text-sm font-medium text-loss" role="alert">{busy ? <span className="text-muted">Checking…</span> : error}</p>
        <PinPad value={pin} onChange={(v) => (setPin(v), setError(""))} onComplete={verify} disabled={busy}
          extraKey={<button type="button" onClick={forgot} className="text-xs font-semibold text-brand">Forgot?</button>} />
        <button type="button" onClick={forgot} className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
          Not you? Log in with your email and password
        </button>
      </div>
    </div>
  );
}
