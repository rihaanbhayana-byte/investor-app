"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { askCoach } from "../lib/coach";
import Logo from "./Logo";
import { SidebarMenu } from "./Sidebar";

// App pages on phones: logo, Ask AI, and a menu button that opens the sidebar as a drawer.
export default function MobileBar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="app-mobilebar sticky top-0 z-40 h-14 items-center gap-2 border-b border-line bg-surface/90 px-4 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={28} />
          <span className="text-[17px] font-bold tracking-tight">Seedwise</span>
        </Link>
        <button
          type="button"
          onClick={() => askCoach()}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-xl bg-brand px-3.5 text-sm font-semibold text-brand-ink"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" /></svg>
          Ask AI
        </button>
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="flex h-10 w-10 items-center justify-center rounded-xl text-fg">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40 motion-safe:animate-[sw-fade_0.2s_ease-out]" />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-line bg-surface shadow-float motion-safe:animate-[sw-slide_0.25s_ease-out]">
            <SidebarMenu onNavigate={() => setOpen(false)} />
          </div>
          <style>{`@keyframes sw-fade{from{opacity:0}}@keyframes sw-slide{from{transform:translateX(-100%)}}`}</style>
        </div>
      )}
    </>
  );
}
