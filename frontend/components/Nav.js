"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const LINKS = [
  { href: "/plan", label: "Build my plan" },
  { href: "/coach", label: "AI Coach" },
  { href: "/dashboard", label: "My plans" },
  { href: "/stocks", label: "Stocks" },
  { href: "/tools", label: "Calculators" },
  { href: "/learn", label: "How to invest" },
];

export default function Nav() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function logOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
        <Link href="/" className="mr-4 text-lg font-bold text-emerald-700">Investor App</Link>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="text-slate-600 hover:text-emerald-700">
            {link.label}
          </Link>
        ))}
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-slate-500 sm:inline">{user.email}</span>
              <button onClick={logOut} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
                Log out
              </button>
            </>
          ) : (
            <Link href="/login" className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700">
              Log in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
