"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PortfolioPdfButton } from "@/components/DownloadPdf";
import { THEME_KEY } from "@/components/ThemeToggle";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const card = "rounded-2xl border border-line bg-surface";

function Section({ title, text, children, tone }) {
  return (
    <section className={`${card} ${tone === "danger" ? "border-red-200" : ""} grid gap-4 p-5 md:grid-cols-[240px_minmax(0,1fr)] md:gap-8 md:p-6`}>
      <div>
        <h2 className={`font-bold ${tone === "danger" ? "text-loss" : ""}`}>{title}</h2>
        {text && <p className="mt-1 text-sm text-muted">{text}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? "bg-brand" : "bg-line-strong"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function applyTheme(choice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {}
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");
  const [theme, setTheme] = useState("system");
  const [prefs, setPrefs] = useState(null);
  const [prefsNote, setPrefsNote] = useState("");
  const [resetAsk, setResetAsk] = useState(false);
  const [resetDone, setResetDone] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setName(data.user?.user_metadata?.full_name || "");
    });
    try {
      setTheme(localStorage.getItem(THEME_KEY) || "system");
    } catch {}
    api.account().then((a) => {
      setPrefs(a);
      if (a.setup_needed) setPrefsNote(a.setup_needed);
    }).catch(() => setPrefs({ weekly_email: false }));
  }, []);

  async function saveName(e) {
    e.preventDefault();
    setSaved("");
    setError("");
    const clean = name.trim().slice(0, 60);
    const { error: err } = await supabase.auth.updateUser({ data: { full_name: clean } });
    if (err) return setError(err.message);
    await supabase.from("profiles").update({ full_name: clean }).eq("id", user.id);
    setSaved("Saved");
    setTimeout(() => setSaved(""), 2000);
  }

  async function toggleEmail(on) {
    setPrefsNote("");
    setPrefs((p) => ({ ...p, weekly_email: on }));
    try {
      await api.setAccountPrefs({ weekly_email: on });
    } catch (e) {
      setPrefs((p) => ({ ...p, weekly_email: !on }));
      setPrefsNote(e.message);
    }
  }

  async function downloadData() {
    const [{ data: plans }, { data: watchlist }, practice] = await Promise.all([
      supabase.from("investment_plans").select("*"),
      supabase.from("watchlist").select("symbol,added_price,added_at"),
      api.practice().catch(() => null),
    ]);
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), profile: { name, email: user.email }, plans, watchlist, practice }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "seedwise-my-data.json" });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function deleteAccount() {
    setDeleting(true);
    setError("");
    try {
      await api.deleteAccount();
      await supabase.auth.signOut();
      Object.keys(localStorage).filter((k) => k.startsWith("seedwise") || k === "lastPlan").forEach((k) => localStorage.removeItem(k));
      router.replace("/?deleted=1");
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  }

  if (user === undefined) return <div className="h-96 animate-pulse rounded-2xl bg-surface" />;
  if (!user)
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-10 text-center">
        <h1 className="text-2xl font-bold">Your profile</h1>
        <p className="text-muted">Log in to change your settings.</p>
        <Link href="/login?next=/profile" className="rounded-xl bg-brand px-6 py-3 font-semibold text-brand-ink">Log in</Link>
      </div>
    );

  const initials = (name || user.email).split(/[ @]/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const field = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-fg focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">{initials}</span>
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{name || "Your profile"}</h1>
          <p className="text-[15px] text-muted">{user.email} · member since {new Date(user.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <Section title="Personal details" text="Your name appears on your dashboard and PDF reports.">
        <form onSubmit={saveName} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="pf-name">Name</label>
          <div className="flex gap-2">
            <input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={field} autoComplete="name" />
            <button className="shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-ink">{saved || "Save"}</button>
          </div>
          <label className="text-sm font-medium" htmlFor="pf-email">Email</label>
          <input id="pf-email" value={user.email} readOnly className={`${field} bg-surface-2 text-muted`} />
        </form>
      </Section>

      <Section title="Appearance" text="Light, dark, or follow your device.">
        <div role="radiogroup" aria-label="Theme" className="grid max-w-md grid-cols-3 gap-1 rounded-xl border border-line bg-surface-2 p-1">
          {[["light", "Light"], ["dark", "Dark"], ["system", "Device"]].map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={theme === id} onClick={() => (setTheme(id), applyTheme(id))} className={`rounded-lg py-2 text-sm font-semibold transition ${theme === id ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg"}`}>
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Notifications" text="The bell in the app always shows big moves. Email is optional.">
        <div className="flex items-start justify-between gap-4 rounded-xl border border-line p-4">
          <div>
            <div className="font-semibold">Weekly email</div>
            <div className="text-sm text-muted">Every Monday: how your practice portfolio and watchlist moved last week, and anything that changed 5% or more.</div>
          </div>
          <Switch label="Weekly email" checked={Boolean(prefs?.weekly_email)} disabled={!prefs} onChange={toggleEmail} />
        </div>
        {prefsNote && <p className="text-xs text-amber-700">{prefsNote}</p>}
      </Section>

      <Section title="Practice portfolio" text="Your $10,000 of play money.">
        <div className="flex flex-wrap items-center gap-2">
          <PortfolioPdfButton />
          {resetAsk ? (
            <>
              <span className="text-sm text-muted">Sell everything and start again with $10,000?</span>
              <button type="button" onClick={async () => { await api.practiceReset(); setResetAsk(false); setResetDone("Done. You have $10,000 again."); }} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white">Reset</button>
              <button type="button" onClick={() => setResetAsk(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm">Cancel</button>
            </>
          ) : (
            <button type="button" onClick={() => setResetAsk(true)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold transition hover:border-brand hover:text-brand">Reset play money</button>
          )}
        </div>
        {resetDone && <p className="text-sm text-gain">{resetDone}</p>}
      </Section>

      <Section title="Your data" text="Everything Seedwise keeps about you, in one file.">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={downloadData} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold transition hover:border-brand hover:text-brand">Download my data (JSON)</button>
          <button type="button" onClick={async () => { await supabase.auth.signOut(); localStorage.removeItem("lastPlan"); router.replace("/"); }} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold transition hover:border-brand hover:text-brand">Log out</button>
        </div>
      </Section>

      <Section title="Delete account" text="Removes your login, plans, practice portfolio, watchlist and settings. This can't be undone." tone="danger">
        <label htmlFor="pf-del" className="text-sm">Type <b>DELETE</b> to confirm</label>
        <div className="flex flex-wrap gap-2">
          <input id="pf-del" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={`${field} max-w-xs`} autoComplete="off" />
          <button type="button" disabled={confirmText !== "DELETE" || deleting} onClick={deleteAccount} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
            {deleting ? "Deleting…" : "Delete my account"}
          </button>
        </div>
      </Section>
    </div>
  );
}
