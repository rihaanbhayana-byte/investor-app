"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const { error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
        : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/plan");
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8">
      <h1 className="text-2xl font-bold">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-1 text-slate-600">
        {mode === "signup" ? "Save your plans and come back to them anytime." : "Log in to see your saved plans."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {mode === "signup" && (
          <label className="block">
            <span className="text-sm font-medium">Your name</span>
            <input className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
        )}
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Password (at least 6 characters)</span>
          <input type="password" minLength={6} className={input} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {loading ? "Please wait..." : mode === "signup" ? "Sign up" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
        <button onClick={() => setMode(mode === "signup" ? "login" : "signup")} className="font-semibold text-emerald-700">
          {mode === "signup" ? "Log in" : "Create an account"}
        </button>
      </p>
    </div>
  );
}
