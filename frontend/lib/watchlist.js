"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { supabase } from "./supabase";

// One shared copy of the person's watchlist, so starring a stock on one screen
// updates the sidebar bell, the dashboard and the Watchlist page straight away.
// Saved in Supabase (table "watchlist"); only the owner can read or change it.

let items = null; // [{ symbol, added_price, added_at }] newest first, or null before loading
let signedIn = false;
let error = "";
let loading = null;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

const MISSING_TABLE = "The watchlist isn't set up yet. Run database/watchlist.sql in Supabase.";

export function loadWatchlist(force = false) {
  if (items && !force) return Promise.resolve(items);
  if (!loading) {
    loading = (async () => {
      const { data } = await supabase.auth.getSession();
      signedIn = Boolean(data.session);
      if (!signedIn) {
        items = [];
      } else {
        const res = await supabase.from("watchlist").select("symbol,added_price,added_at").order("added_at", { ascending: false });
        error = res.error ? (/watchlist/.test(res.error.message) && /exist|schema cache/.test(res.error.message) ? MISSING_TABLE : res.error.message) : "";
        items = res.data || [];
      }
      emit();
      return items;
    })().finally(() => {
      loading = null;
    });
  }
  return loading;
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
      items = null;
      loadWatchlist(true);
    }
  });
}

export async function addToWatchlist(symbol, knownPrice) {
  symbol = symbol.toUpperCase();
  if (items?.some((i) => i.symbol === symbol)) return;
  // also makes sure a searched stock is in our database before we save it
  const quote = await api.quote(symbol).catch(() => null);
  const row = { symbol, added_price: quote?.price ?? knownPrice ?? null, added_at: new Date().toISOString() };
  items = [row, ...(items || [])];
  emit();
  const { error: e } = await supabase.from("watchlist").insert({ symbol, added_price: row.added_price });
  if (e) {
    items = items.filter((i) => i.symbol !== symbol);
    error = /exist|schema cache/.test(e.message) ? MISSING_TABLE : e.message;
    emit();
    throw new Error(error);
  }
}

export async function removeFromWatchlist(symbol) {
  const before = items || [];
  items = before.filter((i) => i.symbol !== symbol);
  emit();
  const { error: e } = await supabase.from("watchlist").delete().eq("symbol", symbol);
  if (e) {
    items = before;
    emit();
    throw new Error(e.message);
  }
}

export function useWatchlist() {
  const [, rerender] = useState(0);
  const [mounted, setMounted] = useState(false); // the server never knows your list, so the first render is always "loading"
  useEffect(() => {
    setMounted(true);
    const fn = () => rerender((n) => n + 1);
    listeners.add(fn);
    loadWatchlist();
    return () => listeners.delete(fn);
  }, []);
  const list = mounted ? items : null;
  return { items: list || [], ready: list !== null, signedIn: mounted && signedIn, error: mounted ? error : "", has: (s) => Boolean(list?.some((i) => i.symbol === s)) };
}
