"use client";

import { api } from "@/lib/api";

// The 6-digit PIN that unlocks Seedwise on a device you're already signed in on.
// The PIN itself is checked by the server; these keys only remember *whether* to ask.
export const PIN_ON = "seedwise-pin-user"; // localStorage: id of the user who has a PIN (this device)
export const UNLOCKED = "seedwise-unlocked"; // sessionStorage: unlocked in this tab
export const LOCK_AFTER_MS = 5 * 60 * 1000; // lock again after 5 minutes in the background

export function markUnlocked() {
  try {
    sessionStorage.setItem(UNLOCKED, "1");
  } catch {}
  document.documentElement.classList.remove("pin-locked");
}

export function rememberPin(userId) {
  try {
    if (userId) localStorage.setItem(PIN_ON, userId);
    else localStorage.removeItem(PIN_ON);
  } catch {}
}

export function lockNow() {
  try {
    sessionStorage.removeItem(UNLOCKED);
  } catch {}
  window.dispatchEvent(new Event("seedwise:lock"));
}

// ---- Log in with PIN on this device
// localStorage keeps a long random device key (the server only stores its hash),
// plus the email and first name to greet you on the log-in page.
export const DEVICE = "seedwise-pin-device";

export function getDevice() {
  try {
    const d = JSON.parse(localStorage.getItem(DEVICE) || "null");
    return d && d.token ? d : null;
  } catch {
    return null;
  }
}

export function forgetDevice({ tellServer = false } = {}) {
  const d = getDevice();
  try {
    localStorage.removeItem(DEVICE);
  } catch {}
  if (tellServer && d) api.pinForgetDevice(d.token).catch(() => {});
}

// Called when you set a PIN or unlock with it, while signed in.
export async function enableDeviceLogin(user) {
  if (!user) return;
  const d = getDevice();
  if (d && d.email === user.email) return;
  try {
    const { device_token } = await api.pinAddDevice();
    const name = (user.user_metadata?.full_name || "").split(" ")[0];
    localStorage.setItem(DEVICE, JSON.stringify({ token: device_token, email: user.email, name }));
  } catch {}
}

export function maskEmail(email = "") {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}${"\u2022".repeat(Math.max(1, Math.min(6, name.length - 2)))}@${domain}`;
}
