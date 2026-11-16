"use client";

import { useEffect, useState } from "react";
import PlanWizard, { GOALS } from "@/components/PlanWizard";
import PlanResults from "@/components/PlanResults";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const LOADING_STEPS = [
  "Reading your answers...",
  "Finding your investor personality...",
  "Picking your funds...",
  "Simulating 5,000 possible futures...",
];

function Loading() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, LOADING_STEPS.length - 1)), 600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 text-center" role="status">
      <style>{`@keyframes sw-bar { 0%,100% { transform: scaleY(0.35) } 50% { transform: scaleY(1) } } @keyframes sw-fade { from { opacity: 0 } to { opacity: 1 } }`}</style>
      <div className="flex h-20 items-end gap-2" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map((b) => (
          <div
            key={b}
            className="h-full w-3 origin-bottom rounded-full bg-mint motion-safe:animate-[sw-bar_1s_ease-in-out_infinite]"
            style={{ animationDelay: `${b * 0.12}s`, opacity: 0.4 + b * 0.09 }}
          />
        ))}
      </div>
      <div>
        <h2 key={i} className="font-display text-3xl font-bold motion-safe:animate-[sw-fade_0.3s_ease-out_both]">
          {LOADING_STEPS[i]}
        </h2>
        <p className="mt-2 text-muted">Replaying real market months since 2016 to see where your money could go.</p>
      </div>
    </div>
  );
}

function ChoiceCard({ onClick, featured, icon, title, text, cta }) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col gap-4 rounded-3xl border p-8 text-left transition duration-300 hover:-translate-y-1.5 hover:shadow-float ${
        featured
          ? "border-mint-line bg-glow hover:border-mint/60"
          : "border-line bg-surface hover:border-slate-300"
      }`}
    >
      {featured && <span className="absolute right-6 top-6 rounded-full bg-mint px-3 py-1 text-xs font-semibold text-mint-ink">Recommended</span>}
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint/15 text-mint">{icon}</span>
      <span className="font-display text-2xl font-bold">{title}</span>
      <span className="leading-relaxed text-muted">{text}</span>
      <span className="mt-2 font-semibold text-mint">
        {cta} <span className="inline-block transition group-hover:translate-x-1">→</span>
      </span>
    </button>
  );
}

export default function PlanPage() {
  const [phase, setPhase] = useState("intro"); // intro | loading | results
  const [wizardMode, setWizardMode] = useState(null); // null (closed) | "ai" | "manual"
  const [questions, setQuestions] = useState([]);
  const [plan, setPlan] = useState({ goal: GOALS[0], initialAmount: 1000, monthly: 100, years: 10, answers: {} });
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.questions().then(setQuestions).catch((e) => setError(e.message));
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) openSavedPlan(id);
  }, []);

  async function openSavedPlan(id) {
    setPhase("loading");
    const { data, error } = await supabase.from("investment_plans").select("*").eq("id", id).single();
    if (error) {
      setError("Could not open that plan. Are you logged in?");
      setPhase("intro");
      return;
    }
    const ok = await buildResults(
      {
        goal: data.goal,
        years: data.horizon_years,
        initialAmount: Number(data.initial_amount),
        monthly: Number(data.monthly_contribution),
        answers: data.risk_answers || {},
      },
      false
    );
    if (ok) setSaved("saved");
  }

  async function buildResults(p, save) {
    setPlan(p);
    setWizardMode(null);
    setPhase("loading");
    setError("");
    window.scrollTo({ top: 0 });
    try {
      const work = (async () => {
        const risk = await api.riskProfile({ answers: p.answers, horizon_years: p.years });
        const [portfolio, projection] = await Promise.all([
          api.portfolio(risk.risk_level),
          api.projection({ risk_level: risk.risk_level, initial_amount: p.initialAmount, monthly_contribution: p.monthly, years: p.years }),
        ]);
        return { risk, portfolio, projection };
      })();
      const [{ risk, portfolio, projection }] = await Promise.all([work, wait(2400)]);

      setResult({ risk, portfolio, projection });
      localStorage.setItem(
        "lastPlan",
        JSON.stringify({
          goal: p.goal,
          years: p.years,
          initial_amount: p.initialAmount,
          monthly_contribution: p.monthly,
          risk_level: risk.risk_level,
          risk_score: risk.score,
          portfolio: portfolio.name,
          holdings: portfolio.holdings.map((h) => ({ symbol: h.symbol, weight: h.weight })),
          projected_final: projection.final,
        })
      );
      setPhase("results");
      if (save) await savePlan(p, risk);
      return true;
    } catch (e) {
      setError(e.message);
      setPhase("intro");
      return false;
    }
  }

  async function savePlan(p, risk) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setSaved("login");
      return;
    }
    const { error } = await supabase.from("investment_plans").insert({
      user_id: data.user.id,
      goal: p.goal,
      horizon_years: p.years,
      initial_amount: p.initialAmount,
      monthly_contribution: p.monthly,
      risk_answers: p.answers,
      risk_score: risk.score,
      risk_level: risk.risk_level,
    });
    if (error) setError(`Could not save your plan: ${error.message}`);
    else setSaved("saved");
  }

  function startOver() {
    setPhase("intro");
    setResult(null);
    setSaved(null);
    window.history.replaceState(null, "", "/plan");
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</p>}

      {phase === "intro" && (
        <section className="flex flex-col items-center gap-10 pt-6 text-center">
          <div className="max-w-2xl">
            <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mint">Build my plan</div>
            <h1 className="mt-4 font-display text-5xl font-bold tracking-tight sm:text-6xl">Let&rsquo;s build your plan.</h1>
            <p className="mt-4 text-lg text-muted">About 2 minutes. No jargon. You can change anything later.</p>
          </div>

          <div className="grid w-full max-w-4xl gap-5 md:grid-cols-2">
            <ChoiceCard
              featured
              onClick={() => setWizardMode("ai")}
              icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" /></svg>}
              title="Describe it in my own words"
              text="Type one sentence like “a house deposit in 6 years, $250 a month” and our AI fills in everything for you."
              cta="Start with AI"
            />
            <ChoiceCard
              onClick={() => setWizardMode("manual")}
              icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></svg>}
              title="Answer step by step"
              text="Pick your goal, set your numbers with sliders, then answer a few quick questions about you."
              cta="Start"
            />
          </div>

          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-muted">
            <span>About 2 minutes</span>
            <span>5,000 simulated futures</span>
            <span>Real US market data since 2016</span>
          </div>
        </section>
      )}

      {phase === "loading" && <Loading />}

      {phase === "results" && result && (
        <PlanResults result={result} goal={plan.goal} years={plan.years} saved={saved} onStartOver={startOver} />
      )}

      {wizardMode && questions.length > 0 && (
        <PlanWizard
          questions={questions}
          startMode={wizardMode}
          initial={plan}
          onClose={() => setWizardMode(null)}
          onFinish={(p) => buildResults(p, true)}
        />
      )}
    </div>
  );
}
