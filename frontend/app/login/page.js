"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Logo from "@/components/Logo";

const BENEFITS = [
  "Save every plan and come back to it any time",
  "An AI coach that knows your plan",
  "Real US market data, free forever",
];

function Field({ id, label, icon, children }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="mt-2 flex items-center gap-3 rounded-2xl border border-line bg-ink px-4 transition focus-within:border-brand">
        <svg className="shrink-0 text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {icon}
        </svg>
        {children}
      </span>
    </label>
  );
}

const inputClass = "w-full bg-transparent py-3.5 text-fg placeholder:text-slate-500 focus:outline-none";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("mode");
    if (wanted === "signup" || wanted === "reset") setMode(wanted);
    // The link in the reset email logs the user in for one purpose: choosing a new password.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  function switchMode(next) {
    setMode(next);
    setError("");
    setInfo("");
  }

  // Our own checks, so errors appear in the page instead of the browser's small pop-up bubbles.
  function validate() {
    if (mode === "signup" && !fullName.trim()) return "Please enter your name.";
    if (mode !== "reset" && !/^\S+@\S+\.\S+$/.test(email.trim())) return "Please enter a valid email address.";
    if (mode !== "forgot" && password.length < 6) return "Your password needs at least 6 characters.";
    return "";
  }

  function friendly(message) {
    if (/invalid login credentials/i.test(message)) return "That email and password don't match. Check them, or reset your password below.";
    if (/already registered/i.test(message)) return "There's already an account with that email. Try logging in instead.";
    if (/rate limit|too many/i.test(message)) return "Too many attempts. Please wait a few minutes and try again.";
    if (/email not confirmed/i.test(message)) return "Please confirm your email first. Check your inbox for our link.";
    return message;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setInfo("");
    const problem = validate();
    if (problem) return setError(problem);
    setLoading(true);
    let result;
    if (mode === "signup") result = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() } } });
    else if (mode === "login") result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    else if (mode === "forgot") result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login?mode=reset` });
    else result = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (result.error) return setError(friendly(result.error.message));
    if (mode === "forgot") return setInfo(`If there's an account for ${email.trim()}, a reset link is on its way. Check your inbox (and spam).`);
    router.push(mode === "signup" ? "/plan" : "/dashboard");
  }

  const signup = mode === "signup";
  const HEADINGS = {
    login: ["Welcome back", "Log in to see your saved plans."],
    signup: ["Create your account", "Free. Takes 20 seconds."],
    forgot: ["Reset your password", "Enter your email and we'll send you a link to choose a new password."],
    reset: ["Choose a new password", "Pick something you haven't used before."],
  };

  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[32px] border border-line bg-surface shadow-float md:grid-cols-2" data-layout="marketing">
      <div className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-glow-hero p-10 md:flex">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-xl font-bold">Seedwise</span>
        </div>
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight tracking-tight">
            Your money&rsquo;s future, <span className="text-brand">made simple.</span>
          </h2>
          <ul className="mt-8 flex flex-col gap-4">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-3 text-slate-800">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-brand-line bg-ink/60 p-5 backdrop-blur">
          <div className="text-xs text-muted">Balanced Builder · past average</div>
          <div className="mt-1 flex items-end justify-between gap-4">
            <span className="font-display text-3xl font-bold text-brand">9.1% / yr</span>
            <svg width="120" height="40" viewBox="0 0 120 40" aria-hidden="true">
              <path d="M0 36 C 30 32, 50 26, 70 18 S 105 6, 120 3" stroke="var(--color-brand)" strokeWidth="2.5" fill="none" />
            </svg>
          </div>
          <div className="mt-1 text-xs text-slate-500">Based on real prices since 2016. Not a promise of future returns.</div>
        </div>
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl" aria-hidden="true" />
      </div>

      <div className="p-8 sm:p-12">
        <div role="tablist" aria-label="Account" className="inline-flex rounded-full border border-line bg-ink p-1">
          {[
            ["login", "Log in"],
            ["signup", "Sign up"],
          ].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={mode === id}
              onClick={() => switchMode(id)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${mode === id ? "bg-brand text-brand-ink" : "text-muted hover:text-fg"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <h1 className="mt-8 font-display text-3xl font-bold tracking-tight">{HEADINGS[mode][0]}</h1>
        <p className="mt-2 text-muted">{HEADINGS[mode][1]}</p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
          {signup && (
            <Field id="name" label="Your name" icon={<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>}>
              <input id="name" className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alex Smith" autoComplete="name" required />
            </Field>
          )}
          {mode !== "reset" && <Field id="email" label="Email" icon={<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>}>
            <input id="email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
          </Field>}
          {mode !== "forgot" && <Field id="password" label={mode === "reset" ? "New password" : "Password"} icon={<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>}>
            <input
              id="password"
              type={show ? "text" : "password"}
              minLength={6}
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
            <button type="button" onClick={() => setShow(!show)} className="shrink-0 text-sm font-medium text-muted hover:text-fg">
              {show ? "Hide" : "Show"}
            </button>
          </Field>}
          {mode === "login" && (
            <button type="button" onClick={() => switchMode("forgot")} className="-mt-2 self-end text-sm font-medium text-muted hover:text-brand">
              Forgot password?
            </button>
          )}

          {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {info && <p role="status" className="rounded-2xl border border-brand-line bg-brand-soft px-4 py-3 text-sm text-slate-800">{info}</p>}

          <button
            disabled={loading}
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-brand py-4 font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
          >
            {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-ink/30 border-t-brand-ink" />}
            {loading ? "Please wait..." : { login: "Log in →", signup: "Create my account →", forgot: "Send reset link →", reset: "Save new password →" }[mode]}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {mode === "forgot" || mode === "reset" ? (
            <button onClick={() => switchMode("login")} className="font-semibold text-brand hover:text-brand-light">← Back to log in</button>
          ) : (
            <>
              {signup ? "Already have an account?" : "New to Seedwise?"}{" "}
              <button onClick={() => switchMode(signup ? "login" : "signup")} className="font-semibold text-brand hover:text-brand-light">
                {signup ? "Log in" : "Create a free account"}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
