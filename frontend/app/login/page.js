"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import PinPad, { PinDots } from "@/components/PinPad";
import { api } from "@/lib/api";
import { forgetDevice, getDevice, markUnlocked, maskEmail } from "@/lib/pin";

const BENEFITS = [
  "Save every plan and come back to it any time",
  "An AI coach that knows your plan",
  "Real US market data, free forever",
];

function Field({ id, label, icon, children }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="mt-1.5 flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
        <svg className="shrink-0 text-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {icon}
        </svg>
        {children}
      </span>
    </label>
  );
}

const inputClass = "w-full bg-transparent py-3 text-fg placeholder:text-slate-500 focus:outline-none";

// The right-hand side: a calm preview of what's inside the app (example numbers).
function AuthPreview() {
  return (
    <div className="relative hidden overflow-hidden border-l border-line bg-surface-2 lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20">
      <div className="pointer-events-none absolute inset-0 bg-glow" aria-hidden="true" />
      <div className="relative max-w-md">
        <h2 className="text-[32px] font-bold leading-tight tracking-tight">
          Your money&rsquo;s future, <span className="text-brand">made simple.</span>
        </h2>
        <ul className="mt-5 flex flex-col gap-2.5 text-[15px] text-muted">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
              </span>
              {b}
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col gap-3" aria-label="Example of the app" role="img">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-float">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>My plan · Buying a home</span>
              <span className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand">Balanced Builder</span>
            </div>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <div className="text-xs text-muted">Likely value in 6 years</div>
                <div className="text-2xl font-bold tabular-nums">$22,757</div>
              </div>
              <svg width="120" height="38" viewBox="0 0 120 38" aria-hidden="true">
                <path d="M0 34 C 30 31, 50 25, 70 18 S 105 6, 120 3 L120 38 L0 38Z" fill="var(--color-brand)" opacity="0.08" />
                <path d="M0 34 C 30 31, 50 25, 70 18 S 105 6, 120 3" stroke="var(--color-brand)" strokeWidth="2.5" fill="none" />
              </svg>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full w-[90%] rounded-full bg-brand" /></div>
            <div className="mt-1.5 text-[11px] text-muted">90% of 5,000 futures end above what you put in</div>
          </div>
          <div className="ml-10 rounded-2xl rounded-br-md border border-line bg-surface p-4 text-sm shadow-card">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" /></svg>
              Seedwise AI
            </div>
            Your plan is mostly broad funds, so one company having a bad year won&rsquo;t sink it.
          </div>
        </div>
        <p className="mt-4 text-[11px] text-muted">Example numbers. Based on real prices since 2016; not a promise of future returns.</p>
      </div>
    </div>
  );
}

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
  const [device, setDevice] = useState(null); // this device can log in with a PIN
  const [usePin, setUsePin] = useState(false);
  const [pin, setPin] = useState("");
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("mode");
    if (wanted === "signup" || wanted === "reset") setMode(wanted);
    const pinNote = new URLSearchParams(window.location.search).get("pin");
    if (pinNote === "reset") setInfo("Too many wrong PINs, so we signed you out to keep your account safe. Log in, then set a new PIN in Profile.");
    if (pinNote === "forgot") setInfo("Log in with your email and password. Then you can set a new PIN in Profile.");
    if (pinNote === "reset") forgetDevice();
    const d = getDevice();
    setDevice(d);
    if (d) setEmail(d.email);
    if (d && !wanted && !pinNote) setUsePin(true);
    // already logged in? go to the app (except when choosing a new password)
    if (wanted !== "reset") supabase.auth.getSession().then(({ data: d }) => d.session && router.replace("/dashboard"));
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
    const next = new URLSearchParams(window.location.search).get("next") || "";
    const safe = next.startsWith("/") && !next.startsWith("//") ? next : null; // only pages on this site
    router.push(safe || (mode === "signup" ? "/plan" : "/dashboard"));
  }

  function goToApp() {
    const next = new URLSearchParams(window.location.search).get("next") || "";
    const safe = next.startsWith("/") && !next.startsWith("//") ? next : null;
    router.push(safe || "/dashboard");
  }

  async function loginWithPin(value) {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const r = await api.pinLogin(device.token, value);
      if (!r.ok) {
        setError(`Wrong PIN. ${r.attempts_left} ${r.attempts_left === 1 ? "try" : "tries"} left.`);
        setPin("");
        setLoading(false);
        return;
      }
      let { error: err } = await supabase.auth.verifyOtp({ token_hash: r.token_hash, type: "email" });
      if (err) ({ error: err } = await supabase.auth.verifyOtp({ token_hash: r.token_hash, type: "magiclink" }));
      if (err) throw new Error("Couldn't log you in with the PIN right now. Please use your password.");
      markUnlocked();
      goToApp();
    } catch (e) {
      if (e.status === 401 || e.status === 423) {
        forgetDevice();
        setDevice(null);
        setUsePin(false);
      }
      setError(e.message);
      setPin("");
      setLoading(false);
    }
  }

  function notYou() {
    forgetDevice({ tellServer: true });
    setDevice(null);
    setUsePin(false);
    setEmail("");
    setPin("");
    setError("");
  }

  function askForPin() {
    setError("");
    if (device) {
      setPin("");
      setInfo("");
      return setUsePin(true);
    }
    setInfo("PIN log in works on a device where you've logged in with your password and turned on a PIN in Profile → Security. Log in with your password once, then set it up.");
  }

  const pinView = mode === "login" && usePin && device;
  const signup = mode === "signup";
  const HEADINGS = {
    login: ["Welcome back", "Log in to see your saved plans."],
    signup: ["Create your account", "Free. Takes 20 seconds."],
    forgot: ["Reset your password", "Enter your email and we'll send you a link to choose a new password."],
    reset: ["Choose a new password", "Pick something you haven't used before."],
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={30} />
            <span className="text-lg font-bold tracking-tight">Seedwise</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-medium text-muted hover:text-fg">← Back to home</Link>
            <ThemeToggle />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
        <div role="tablist" aria-label="Account" className="grid grid-cols-2 rounded-xl border border-line bg-surface-2 p-1">
          {[
            ["login", "Log in"],
            ["signup", "Sign up"],
          ].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={mode === id}
              onClick={() => switchMode(id)}
              className={`rounded-lg py-2 text-sm font-semibold transition ${mode === id ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {pinView ? (
          <div className="mt-8 flex flex-col items-center text-center">
            <h1 className="text-[28px] font-bold leading-tight tracking-tight">Welcome back{device.name ? `, ${device.name}` : ""}</h1>
            <p className="mt-1.5 text-[15px] text-muted">Enter your 6-digit PIN for {maskEmail(device.email)}</p>
            <div className="mt-8">
              <PinDots value={pin} error={Boolean(error)} />
            </div>
            <p className="mt-4 min-h-5 text-sm font-medium text-loss" role="alert">{loading ? <span className="text-muted">Logging you in…</span> : error}</p>
            <div className="mt-4 w-full">
              <PinPad value={pin} onChange={(v) => (setPin(v), setError(""))} onComplete={loginWithPin} disabled={loading} />
            </div>
            <div className="mt-6 flex w-full flex-col gap-2">
              <button type="button" onClick={() => (setUsePin(false), setError(""))} className="rounded-xl border border-line py-3 text-sm font-semibold transition hover:border-brand hover:text-brand">
                Use password instead
              </button>
              <button type="button" onClick={notYou} className="py-2 text-sm text-muted hover:text-fg">
                Not you? Use a different account
              </button>
            </div>
          </div>
        ) : (
        <>
        <h1 className="mt-8 text-[28px] font-bold leading-tight tracking-tight">{HEADINGS[mode][0]}</h1>
        <p className="mt-1.5 text-[15px] text-muted">{HEADINGS[mode][1]}</p>

        <form onSubmit={handleSubmit} noValidate className="mt-7 flex flex-col gap-4">
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

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {info && <p role="status" className="rounded-xl border border-brand-line bg-brand-soft px-4 py-3 text-sm text-fg">{info}</p>}

          <button
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
          >
            {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-ink/30 border-t-brand-ink" />}
            {loading ? "Please wait..." : { login: "Log in →", signup: "Create my account →", forgot: "Send reset link →", reset: "Save new password →" }[mode]}
          </button>
          {mode === "login" && (
            <button type="button" onClick={askForPin} className="flex items-center justify-center gap-2 rounded-xl border border-line py-3 text-sm font-semibold transition hover:border-brand hover:text-brand">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="6" cy="6" r="1.5" /><circle cx="12" cy="6" r="1.5" /><circle cx="18" cy="6" r="1.5" /><circle cx="6" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="18" cy="12" r="1.5" /><circle cx="12" cy="18" r="1.5" />
              </svg>
              Log in with PIN
            </button>
          )}
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
        </>
        )}
          {signup && <p className="mt-6 text-center text-xs text-muted">Seedwise is for learning. It never touches real money and isn&rsquo;t financial advice.</p>}
        </div>

        <p className="text-xs text-muted">© Seedwise · An educational project. Not financial advice.</p>
      </div>

      <AuthPreview />
    </div>
  );
}
