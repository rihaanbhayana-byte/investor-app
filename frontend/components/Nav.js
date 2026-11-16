"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/plan", label: "Build my plan" },
  { href: "/practice", label: "Practice" },
  { href: "/coach", label: "AI Coach" },
  { href: "/stocks", label: "Stocks" },
  { href: "/tools", label: "Tools" },
  { href: "/learn", label: "Learn" },
];

export default function Nav() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-all duration-300 ${
        scrolled ? "border-line bg-ink/85 shadow-lift" : "border-transparent bg-ink/40"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="transition duration-300 group-hover:rotate-[-8deg] group-hover:scale-105"><Logo /></span>
          <span className="font-display text-xl font-bold tracking-tight">Seedwise</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-6 text-[15px] lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="relative py-1 text-muted transition hover:text-fg after:absolute after:inset-x-0 after:-bottom-0.5 after:h-[2px] after:origin-left after:scale-x-0 after:rounded-full after:bg-mint after:transition-transform after:duration-300 hover:after:scale-x-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          {user ? (
            <>
              <Link href="/dashboard" className="rounded-full px-3 py-2.5 text-[15px] text-fg hover:text-mint">
                My plans
              </Link>
              <button onClick={logOut} className="rounded-full px-3 py-2.5 text-[15px] text-muted hover:text-fg">
                Log out
              </button>
            </>
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

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
        <button
          className="rounded-lg p-2 text-fg"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Mobile" className="flex flex-col gap-1 border-t border-line bg-ink/95 px-6 py-4 motion-safe:animate-page-in lg:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-muted hover:bg-surface hover:text-fg">
              {l.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/dashboard" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-fg hover:bg-surface">My plans</Link>
              <button onClick={logOut} className="rounded-lg px-3 py-3 text-left text-muted hover:bg-surface">Log out</button>
            </>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-fg hover:bg-surface">Log in</Link>
          )}
        </nav>
      )}
    </header>
  );
}