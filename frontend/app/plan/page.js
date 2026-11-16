"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import GrowthChart from "@/components/GrowthChart";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { LEVEL_LABELS, money, percent } from "@/lib/format";

const GOALS = ["Grow my wealth", "Retirement", "Buying a home", "Education", "A big purchase"];

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const card = "rounded-xl border border-slate-200 bg-white p-6";
const primary = "rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50";
const secondary = "rounded-lg border border-slate-300 px-5 py-2.5 font-semibold hover:bg-slate-50";

export default function PlanPage() {
  const [step, setStep] = useState("goal");
  const [goal, setGoal] = useState(GOALS[0]);
  const [initialAmount, setInitialAmount] = useState(1000);
  const [monthly, setMonthly] = useState(100);
  const [years, setYears] = useState(10);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.questions().then(setQuestions).catch((e) => setError(e.message));
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) openSavedPlan(id);
  }, []);

  async function openSavedPlan(id) {
    setLoading(true);
    const { data, error } = await supabase.from("investment_plans").select("*").eq("id", id).single();
    if (error) {
      setError("Could not open that plan. Are you logged in?");
      setLoading(false);
      return;
    }
    const plan = {
      goal: data.goal,
      years: data.horizon_years,
      initialAmount: Number(data.initial_amount),
      monthly: Number(data.monthly_contribution),
      answers: data.risk_answers || {},
    };
    setGoal(plan.goal);
    setYears(plan.years);
    setInitialAmount(plan.initialAmount);
    setMonthly(plan.monthly);
    setAnswers(plan.answers);
    await buildResults(plan, false);
    setSaved("saved");
  }

  async function buildResults(plan, save) {
    setLoading(true);
    setError("");
    try {
      const risk = await api.riskProfile({ answers: plan.answers, horizon_years: plan.years });
      const [portfolio, projection] = await Promise.all([
        api.portfolio(risk.risk_level),
        api.projection({
          risk_level: risk.risk_level,
          initial_amount: plan.initialAmount,
          monthly_contribution: plan.monthly,
          years: plan.years,
        }),
      ]);
      setResult({ risk, portfolio, projection });
      setStep("results");
      if (save) await savePlan(plan, risk);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function savePlan(plan, risk) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setSaved("login");
      return;
    }
    const { error } = await supabase.from("investment_plans").insert({
      user_id: data.user.id,
      goal: plan.goal,
      horizon_years: plan.years,
      initial_amount: plan.initialAmount,
      monthly_contribution: plan.monthly,
      risk_answers: plan.answers,
      risk_score: risk.score,
      risk_level: risk.risk_level,
    });
    if (error) setError(`Could not save your plan: ${error.message}`);
    else setSaved("saved");
  }

  function startOver() {
    setStep("goal");
    setAnswers({});
    setResult(null);
    setSaved(null);
    window.history.replaceState(null, "", "/plan");
  }

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Build my plan</h1>
        <p className="mt-1 text-slate-600">
          {step === "goal" && "Step 1 of 3: your goal and budget"}
          {step === "questions" && "Step 2 of 3: how you feel about risk"}
          {step === "results" && "Step 3 of 3: your plan"}
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {loading && <p className="text-slate-600">Crunching the numbers...</p>}

      {step === "goal" && (
        <form
          className={`${card} space-y-5`}
          onSubmit={(e) => {
            e.preventDefault();
            setStep("questions");
          }}
        >
          <label className="block">
            <span className="font-medium">What are you investing for?</span>
            <select className={input} value={goal} onChange={(e) => setGoal(e.target.value)}>
              {GOALS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-5 md:grid-cols-3">
            <label className="block">
              <span className="font-medium">Amount to start with ($)</span>
              <input type="number" min={0} step={50} className={input} value={initialAmount} onChange={(e) => setInitialAmount(Number(e.target.value))} required />
            </label>
            <label className="block">
              <span className="font-medium">Add each month ($)</span>
              <input type="number" min={0} step={10} className={input} value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} required />
            </label>
            <label className="block">
              <span className="font-medium">For how many years?</span>
              <input type="number" min={1} max={50} className={input} value={years} onChange={(e) => setYears(Number(e.target.value))} required />
            </label>
          </div>
          <button className={primary}>Next: risk questions</button>
        </form>
      )}

      {step === "questions" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            buildResults({ goal, years, initialAmount, monthly, answers }, true);
          }}
        >
          {questions.map((q, i) => (
            <fieldset key={q.id} className={card}>
              <legend className="font-semibold">
                {i + 1}. {q.text}
              </legend>
              <div className="mt-3 space-y-2">
                {q.options.map((o) => (
                  <label key={o.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                    <input type="radio" name={q.id} checked={answers[q.id] === o.id} onChange={() => setAnswers({ ...answers, [q.id]: o.id })} />
                    {o.text}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="flex gap-3">
            <button type="button" className={secondary} onClick={() => setStep("goal")}>
              Back
            </button>
            <button className={primary} disabled={!allAnswered || loading}>
              See my plan
            </button>
          </div>
        </form>
      )}

      {step === "results" && result && <Results result={result} saved={saved} startOver={startOver} goal={goal} />}
    </div>
  );
}

function Results({ result, saved, startOver, goal }) {
  const { risk, portfolio, projection } = result;
  const final = projection.final;
  const stats = portfolio.stats;

  return (
    <div className="space-y-6">
      {saved === "saved" && <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">Plan saved. Find it any time under My plans.</p>}
      {saved === "login" && (
        <p className="rounded-lg bg-amber-50 p-3 text-amber-800">
          <Link href="/login" className="font-semibold underline">Log in or sign up</Link> to save plans like this one.
        </p>
      )}

      <section className={card}>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Your risk level</p>
        <h2 className="mt-1 text-2xl font-bold">
          {LEVEL_LABELS[risk.risk_level]} <span className="text-base font-normal text-slate-500">(score {risk.score} of {risk.max_score})</span>
        </h2>
        <p className="mt-2 text-slate-600">{risk.explanation}</p>
      </section>

      <section className={card}>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Your portfolio for &ldquo;{goal}&rdquo;</p>
        <h2 className="mt-1 text-2xl font-bold">{portfolio.name}</h2>
        <p className="mt-1 text-slate-600">{portfolio.description}</p>
        <table className="mt-4 w-full text-left">
          <thead className="text-sm text-slate-500">
            <tr>
              <th className="py-2">Fund</th>
              <th>What it holds</th>
              <th className="text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.holdings.map((h) => (
              <tr key={h.symbol} className="border-t border-slate-100">
                <td className="py-2 font-semibold">
                  <Link href={`/stocks/${h.symbol}`} className="text-emerald-700 hover:underline">{h.symbol}</Link>
                </td>
                <td>{h.name} <span className="text-slate-500">({h.sector})</span></td>
                <td className="text-right font-semibold">{percent(h.weight)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Average yearly return" value={percent(stats.annual_return)} />
          <Stat label="Worst 12 months" value={percent(stats.worst_12_months)} />
          <Stat label="Biggest drop" value={percent(stats.max_drawdown)} />
          <Stat label="Years of data" value={stats.years_of_data} />
        </div>
      </section>

      <section className={card}>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">What it could grow to</p>
        <h2 className="mt-1 text-2xl font-bold">
          After {final.year} years: about {money(final.median)}
        </h2>
        <p className="mt-1 text-slate-600">
          You would put in {money(final.contributed)}. In a bad case you might have {money(final.low)}; in a good case {money(final.high)}.
          In today&rsquo;s money, the typical result is worth about {money(final.median_in_todays_dollars)}.
        </p>
        <div className="mt-4">
          <GrowthChart data={projection.yearly} />
        </div>
        <p className="mt-3 text-xs text-slate-500">{projection.disclaimer}</p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/learn" className={primary}>How do I actually invest?</Link>
        <button onClick={startOver} className={secondary}>Start over</button>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
