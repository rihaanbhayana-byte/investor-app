"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { askCoach } from "../lib/coach";
import Bell from "./Bell";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const ICON = {
  home: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  plan: "M12 5v14M5 12h14",
  practice: "M3 17l6-6 4 4 8-8M15 7h6v6",
  stocks: "M3 3v18h18M7 14l3-3 3 3 5-6",
  tools: "M14 7a4 4 0 0 1-5 5l-6 6 3 3 6-6a4 4 0 0 1 5-5l-3 3-2-2 3-3z",
  coach: "M21 12a8 8 0 0 1-12 7l-5 1 1-4A8 8 0 1 1 21 12z",
  learn: "M2 9l10-5 10 5-10 5zM6 11v5c3 3 9 3 12 0v-5",
  plans: "M4 5h16M4 12h16M4 19h10",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z",
  login: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

export const APP_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/plan", label: "Build my plan", icon: "plan" },
  { href: "/plans", label: "My plans", icon: "plans" },
  { href: "/practice", label: "Practice", icon: "practice" },
  { href: "/stocks", label: "Stocks", icon: "stocks" },
  { href: "/watchlist", label: "Watchlist", icon: "star" },
  { href: "/tools", label: "Tools", icon: "tools" },
  { href: "/coach", label: "AI Coach", icon: "coach", tag: "AI" },
  { href: "/learn", label: "Learn", icon: "learn" },
];

export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON[name]} />
    </svg>
  );
}

export function useUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") localStorage.removeItem("lastPlan");
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return user;
}

export async function logOut() {
  await supabase.auth.signOut();
  try {
    localStorage.removeItem("seedwise-pin-user");
    sessionStorage.removeItem("seedwise-unlocked");
  } catch {}
  localStorage.removeItem("lastPlan"); // don't show this person's plan to the next one on this device
  window.location.href = "/";
}

// The menu itself: used by the desktop sidebar and the phone drawer.
export function SidebarMenu({ active = "", onNavigate }) {
  const user = useUser();
  const isActive = (href) => active === href || (href !== "/" && active.startsWith(href + "/"));
  return (
    <div className="flex h-full flex-col gap-6 px-4 py-6">
      <div className="flex items-center justify-between gap-2">
        <Link href={user ? "/dashboard" : "/"} onClick={onNavigate} className="flex items-center gap-2.5 px-2">
          <Logo size={32} />
          <span className="text-[19px] font-bold tracking-tight">Seedwise</span>
        </Link>
        {!onNavigate && <Bell placement="sidebar" />}
      </div>

      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          askCoach();
        }}
        className="flex h-11 items-center gap-2.5 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-ink shadow-card transition hover:bg-brand-light"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" />
        </svg>
        <span className="whitespace-nowrap">Ask Seedwise AI</span>
      </button>

      <nav aria-label="Main" className="flex flex-col gap-0.5">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Menu</div>
        {APP_LINKS.map((l) => {
          const on = isActive(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={onNavigate}
              aria-current={on ? "page" : undefined}
              className={`flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition ${
                on ? "bg-brand-soft font-semibold text-brand" : "font-medium text-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              <Icon name={l.icon} />
              {l.label}
              {l.tag && <span className="ml-auto rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand">{l.tag}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-0.5">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Account</div>
        {user && (
          <Link href="/profile" onClick={onNavigate} aria-current={isActive("/profile") ? "page" : undefined} className={`flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition ${isActive("/profile") ? "bg-brand-soft font-semibold text-brand" : "font-medium text-muted hover:bg-surface-2 hover:text-fg"}`}>
            <Icon name="user" />
            Profile
          </Link>
        )}
        {user ? (
          <button type="button" onClick={logOut} className="flex h-10 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-fg">
            <Icon name="logout" />
            Log out
          </button>
        ) : (
          <Link href="/login" onClick={onNavigate} className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-fg">
            <Icon name="login" />
            Log in or sign up
          </Link>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <div className="rounded-2xl bg-brand-soft p-4">
          <div className="text-[13px] font-bold text-fg">Guardrails on</div>
          <p className="mt-1 text-xs leading-relaxed text-muted">Every AI answer is checked against real data. Educational only, not financial advice.</p>
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="truncate text-xs text-muted">{user ? user.email : "Not logged in"}</span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

// Desktop sidebar. Without the current path (while loading) it renders with nothing highlighted.
export function StaticSidebar() {
  return (
    <aside className="app-sidebar border-r border-line bg-surface">
      <SidebarMenu />
    </aside>
  );
}

export default function Sidebar() {
  const path = usePathname() || "";
  return (
    <aside className="app-sidebar border-r border-line bg-surface">
      <SidebarMenu active={path} />
    </aside>
  );
}
