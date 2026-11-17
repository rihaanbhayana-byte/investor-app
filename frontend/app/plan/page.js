"use client";

import { useEffect, useState } from "react";
import PlanWizard, { GOALS } from "@/components/PlanWizard";
import PlanResults from "@/components/PlanResults";
import { api } from "@/lib/api";
import { setPageContext } from "@/lib/coach";
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
            className="h-full w-3 origin-bottom rounded-full bg-brand motion-safe:animate-[sw-bar_1s_ease-in-out_infinite]"
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

const GOAL_EXAMPLES = [
  "A house deposit in 6 years: I have $2,000 and can save $250 a month",
  "I'm 17, I have $500 and can add $50 a month for 10 years",
  "Retire comfortably. I'm 25 and can invest $300 a month",
];

// Type your goal straight away. The AI reads it and opens your numbers to check.
function GoalComposer({ onSubmit, onManual }) {
  const [text, setText] = useState("");
  const ready = text.trim().length >= 5;
  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onSubmit(text.trim());
        }}
        className="w-full rounded-2xl border border-line bg-surface p-2 text-left shadow-float focus-within:border-brand"
      >
        <label htmlFor="goal-text" className="sr-only">Your money goal, in your own words</label>
        <textarea
          id="goal-text"
          rows={3}
          value={text}
          autoFocus
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (ready) onSubmit(text.trim());
            }
          }}
          placeholder="Tell me your money goal: what you're saving for, how much you have, how much you can add, and when."
          className="w-full resize-none bg-transparent px-3 py-3 text-base text-fg placeholder:text-slate-500 focus:outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-2 pt-2">
          <span className="flex items-center gap-1.5 px-1 text-xs font-semibold text-brand">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" /></svg>
            AI reads it and fills in your plan
          </span>
          <button disabled={!ready} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50">Build my plan →</button>
        </div>
      </form>
      <div className="flex flex-wrap justify-center gap-2">
        {GOAL_EXAMPLES.map((g) => (
          <button key={g} type="button" onClick={() => setText(g)} className="max-w-full truncate rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted transition hover:border-brand hover:text-brand">
            {g}
          </button>
        ))}
      </div>
      <button type="button" onClick={onManual} className="text-sm font-semibold text-muted underline-offset-4 hover:text-fg hover:underline">
        Rather answer step by step →
      </button>
    </div>
  );
}

function ChoiceCard({ onClick, featured, icon, title, text, cta }) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col gap-4 rounded-3xl border p-8 text-left transition duration-300 hover:-translate-y-1.5 hover:shadow-float ${
        featured
          ? "border-brand-line bg-glow hover:border-brand/60"
          : "border-line bg-surface hover:border-slate-300"
      }`}
    >
      {featured && <span className="absolute right-6 top-6 rounded-xl bg-brand px-3 py-1 text-xs font-semibold text-brand-ink">Recommended</span>}
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/15 text-brand">{icon}</span>
      <span className="font-display text-2xl font-bold">{title}</span>
      <span className="leading-relaxed text-muted">{text}</span>
      <span className="mt-2 font-semibold text-brand">
        {cta} <span className="inline-block transition group-hover:translate-x-1">→</span>
      </span>
    </button>
  );
}

export default function PlanPage() {
  const [phase, setPhase] = useState("intro"); // intro | loading | results
  const [wizardMode, setWizardMode] = useState(null); // null (closed) | "ai" | "manual"
  const [goalText, setGoalText] = useState(""); // a goal typed on the home page, read by the AI straight away
  const [questions, setQuestions] = useState([]);
  const [plan, setPlan] = useState({ goal: GOALS[0], initialAmount: 1000, monthly: 100, years: 10, answers: {} });
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(null);
  const [savedId, setSavedId] = useState(null); // the saved plan's row, so a personality change can update it
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPageContext("Plan builder: their goal, investor personality and projection");
    return () => setPageContext("");
  }, []);

  useEffect(() => {
    api.questions().then(setQuestions).catch((e) => setError(e.message));
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) openSavedPlan(id);
    const typed = (params.get("goal") || "").trim();
    if (!id && typed.length >= 5) {
      setGoalText(typed.slice(0, 1000));
      setWizardMode("ai");
    } else if (!id && params.get("mode") === "manual") {
      setWizardMode("manual");
    }
    if (typed || params.get("mode")) window.history.replaceState(null, "", "/plan");
  }, []);

  // "Not quite me": the person can override the quiz's personality; the plan recalculates and re-saves.
  async function changePersonality(level) {
    if (!result || level === result.risk.risk_level) return;
    setSwitching(true);
    try {
      const [portfolio, projection] = await Promise.all([
        api.portfolio(level),
        api.projection({ risk_level: level, initial_amount: plan.initialAmount, monthly_contribution: plan.monthly, years: plan.years }),
      ]);
      const quizLevel = result.risk.quiz_level ?? result.risk.risk_level;
      const risk = { ...result.risk, risk_level: level, quiz_level: quizLevel, chosen: level !== quizLevel };
      const answers = { ...plan.answers, _chosen_level: risk.chosen ? level : undefined };
      if (!risk.chosen) delete answers._chosen_level;
      setPlan({ ...plan, answers });
      setResult({ risk, portfolio, projection });
      rememberPlan(plan, risk, portfolio, projection);
      if (savedId) {
        const { error } = await supabase.from("investment_plans").update({ risk_level: level, risk_answers: answers }).eq("id", savedId);
        if (error) setError(`Couldn't update your saved plan: ${error.message}`);
      }
    } catch (e) {
      setError(e.message);
    }
    setSwitching(false);
  }

  function rememberPlan(p, risk, portfolio, projection) {
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
  }

  async function openSavedPlan(id) {
    setPhase("loading");
    const { data, error } = await supabase.from("investment_plans").select("*").eq("id", id).single();
    if (error) {
      const { data: auth } = await supabase.auth.getUser();
      setError(auth.user ? "We couldn't find that plan. It may have been deleted. Open one from My plans." : "Log in to open your saved plans.");
      setPhase("intro");
      return;
    }
    setSavedId(id);
    const ok = await buildResults(
      {
        goal: data.goal,
        years: data.horizon_years,
        initialAmount: Number(data.initial_amount),
        monthly: Number(data.monthly_contribution),
        answers: data.risk_answers || {},
      },
      false,
      true
    );
    if (ok) setSaved("opened");
  }

  async function buildResults(p, save, reopening = false) {
    setPlan(p);
    setWizardMode(null);
    setPhase("loading");
    setError("");
    window.scrollTo({ top: 0 });
    try {
      const work = (async () => {
        const { _chosen_level: chosenLevel, ...quizAnswers } = p.answers || {};
        let risk = await api.riskProfile({ answers: quizAnswers, horizon_years: p.years });
        if (chosenLevel && chosenLevel !== risk.risk_level) {
          risk = { ...risk, quiz_level: risk.risk_level, risk_level: chosenLevel, chosen: true };
        }
        const [portfolio, projection] = await Promise.all([
          api.portfolio(risk.risk_level),
          api.projection({ risk_level: risk.risk_level, initial_amount: p.initialAmount, monthly_contribution: p.monthly, years: p.years }),
        ]);
        return { risk, portfolio, projection };
      })();
      const [{ risk, portfolio, projection }] = await Promise.all([work, wait(reopening ? 400 : 2400)]);

      setResult({ risk, portfolio, projection });
      rememberPlan(p, risk, portfolio, projection);
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
    // the same plan saved before? reuse it instead of making a copy
    const { data: same } = await supabase
      .from("investment_plans")
      .select("id")
      .eq("goal", p.goal)
      .eq("horizon_years", p.years)
      .eq("initial_amount", p.initialAmount)
      .eq("monthly_contribution", p.monthly)
      .eq("risk_level", risk.risk_level)
      .limit(1);
    if (same?.length) {
      setSaved("saved");
      setSavedId(same[0].id);
      return;
    }
    const { data: row, error } = await supabase.from("investment_plans").insert({
      user_id: data.user.id,
      goal: p.goal,
      horizon_years: p.years,
      initial_amount: p.initialAmount,
      monthly_contribution: p.monthly,
      risk_answers: p.answers,
      risk_score: risk.score,
      risk_level: risk.risk_level,
    }).select("id").single();
    if (error) setError(`Could not save your plan: ${error.message}`);
    else {
      setSaved("saved");
      setSavedId(row.id);
    }
  }

  function startOver() {
    setSavedId(null);
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
        <section className="flex flex-col items-center gap-8 pt-4 text-center">
          <div className="max-w-2xl">
            <h1 className="text-[32px] font-bold leading-tight tracking-tight">Build my plan</h1>
            <p className="mt-1.5 text-[15px] text-muted">About 2 minutes. No jargon. You can change anything later.</p>
          </div>

          <GoalComposer
            onSubmit={(text) => {
              setGoalText(text);
              setWizardMode("ai");
            }}
            onManual={() => setWizardMode("manual")}
          />

          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-muted">
            <span>About 2 minutes</span>
            <span>5,000 simulated futures</span>
            <span>Real US market data since 2016</span>
          </div>
        </section>
      )}

      {phase === "loading" && <Loading />}

      {phase === "results" && result && (
        <PlanResults result={result} goal={plan.goal} years={plan.years} inputs={{ initialAmount: plan.initialAmount, monthly: plan.monthly }} saved={saved} onStartOver={startOver} onChangePersonality={changePersonality} switching={switching} />
      )}

      {wizardMode && questions.length > 0 && (
        <PlanWizard
          questions={questions}
          startMode={wizardMode}
          initial={plan}
          initialText={wizardMode === "ai" ? goalText : ""}
          onClose={() => {
            setWizardMode(null);
            setGoalText("");
          }}
          onFinish={(p) => buildResults(p, true)}
        />
      )}
    </div>
  );
}
