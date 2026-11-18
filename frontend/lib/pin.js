"use client";

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
