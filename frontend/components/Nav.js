"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Logo from "./Logo";

const LINKS = [
  { href: "/plan", label: "Build my plan" },
  { href: "/coach", label: "AI Coach" },
  { href: "/dashboard", label: "My plans" },
  { href: "/stocks", label: "Stocks" },
  { href: "/tools", label: "Calculators" },
  { href: "/learn", label: "Learn" },
];

export default function Nav() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function logOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Logo />
          <span className="font-display text-xl font-bold tracking-tight">Seedwise</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 text-[15px] lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted transition hover:text-fg">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <button onClick={logOut} className="rounded-full px-4 py-2.5 text-[15px] text-muted hover:text-fg">
              Log out
            </button>
          ) : (
            <Link href="/login" className="rounded-full px-4 py-2.5 text-[15px] text-fg hover:text-mint">
              Log in
            </Link>
          )}
          <Link
            href="/plan"
            className="rounded-full bg-mint px-5 py-2.5 text-[15px] font-semibold text-mint-ink transition hover:bg-mint-light"
          >
            {user ? "New plan" : "Start free"}
          </Link>
        </div>

        <button
          className="rounded-lg p-2 text-fg lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <nav aria-label="Mobile" className="flex flex-col gap-1 border-t border-line px-6 py-4 lg:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-muted hover:bg-surface hover:text-fg">
              {l.label}
            </Link>
          ))}
          {user ? (
            <button onClick={logOut} className="rounded-lg px-3 py-3 text-left text-muted hover:bg-surface">Log out</button>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-fg hover:bg-surface">Log in</Link>
          )}
        </nav>
      )}
    </header>
  );
}