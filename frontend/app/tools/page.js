"use client";

import { useEffect, useState } from "react";
import MultiLineChart from "@/components/MultiLineChart";
import { api } from "@/lib/api";
import { LEVEL_LABELS, money, percent } from "@/lib/format";

const card = "rounded-xl border border-slate-200 bg-white p-6";
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const primary = "rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50";
const YEARS = Array.from({ length: 10 }, (_, i) => 2016 + i);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (m) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

const TABS = [
  ["time", "⏳ Time machine"],
  ["goal", "🎯 Goal calculator"],
  ["compare", "📈 Compare stocks"],
];

export default function ToolsPage() {
  const [tab, setTab] = useState("time");
  const [stocks, setStocks] = useState([]);

  useEffect(() => {
    api.stocks().then(setStocks).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Calculators</h1>
        <p className="mt-1 text-slate-600">Play with real market data since 2016.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 font-medium ${tab === id ? "bg-emerald-600 text-white" : "border border-slate-300 bg-white hover:bg-slate-50"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "time" && <TimeMachine stocks={stocks} />}
      {tab === "goal" && <GoalCalculator />}
      {tab === "compare" && <Compare stocks={stocks} />}
    </div>
  );
}

function StockSelect({ stocks, value, onChange, allowNone }) {
  return (
    <select className={input} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowNone && <option value="">(none)</option>}
      {stocks.map((s) => (
        <option key={s.symbol} value={s.symbol}>
          {s.symbol}: {s.name}
        </option>
      ))}
    </select>
  );
}

function TimeMachine({ stocks }) {
  const [symbol, setSymbol] = useState("NVDA");
  const [amount, setAmount] = useState(1000);
  const [year, setYear] = useState(2016);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function run(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      setResult(await api.timeMachine(symbol, amount, `${year}-01`));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={run} className={`${card} grid gap-4 md:grid-cols-4 md:items-end`}>
        <label className="block md:col-span-2">
          <span className="font-medium">If I had invested in</span>
          <StockSelect stocks={stocks} value={symbol} onChange={setSymbol} />
        </label>
        <label className="block">
          <span className="font-medium">Amount ($)</span>
          <input type="number" min={1} className={input} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="font-medium">In January of</span>
          <select className={input} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <button className={`${primary} md:col-span-4 md:w-fit`} disabled={loading}>
          {loading ? "Travelling..." : "Show me"}
        </button>
      </form>
      {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {result && (
        <div className={card}>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Result</p>
          <h2 className="mt-1 text-2xl font-bold">
            {money(result.amount)} in {result.symbol} in {monthName(result.start_month)} would be worth {money(result.final_value)} today
          </h2>
          <p className="mt-2 text-slate-600">
            That&rsquo;s a {result.gain >= 0 ? "gain" : "loss"} of {money(Math.abs(result.gain))} ({percent(result.total_return)}), or about{" "}
            {percent(result.annual_return)} a year.
            {result.sp500_final_value != null && <> The same money in the S&amp;P 500 (VOO) would be worth {money(result.sp500_final_value)}.</>}
          </p>
          <div className="mt-4">
            <MultiLineChart
              data={result.series}
              lines={[
                { key: "value", name: result.symbol },
                { key: "sp500_value", name: "S&P 500 (VOO)" },
              ]}
              format={(v) => money(v)}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">Past results only. Picking one winning stock in hindsight is much easier than in real life.</p>
        </div>
      )}
    </div>
  );
}

function GoalCalculator() {
  const [target, setTarget] = useState(50000);
  const [years, setYears] = useState(8);
  const [initial, setInitial] = useState(0);
  const [level, setLevel] = useState("moderate");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function run(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      setResult(await api.goalCalculator({ target, years, initial_amount: initial, risk_level: level }));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={run} className={`${card} grid gap-4 md:grid-cols-4 md:items-end`}>
        <label className="block">
          <span className="font-medium">I want to have ($)</span>
          <input type="number" min={1} className={input} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="font-medium">In how many years</span>
          <input type="number" min={1} max={50} className={input} value={years} onChange={(e) => setYears(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="font-medium">Starting with ($)</span>
          <input type="number" min={0} className={input} value={initial} onChange={(e) => setInitial(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="font-medium">Portfolio</span>
          <select className={input} value={level} onChange={(e) => setLevel(e.target.value)}>
            {Object.entries(LEVEL_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>
        <button className={`${primary} md:col-span-4 md:w-fit`} disabled={loading}>
          {loading ? "Calculating..." : "How much per month?"}
        </button>
      </form>
      {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {result && (
        <div className={card}>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">{result.portfolio_name}</p>
          <h2 className="mt-1 text-2xl font-bold">
            Save about {money(result.monthly_for_50_percent)} a month for a 50/50 chance of reaching {money(target)}
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Box label="50% chance" value={`${money(result.monthly_for_50_percent)}/mo`} />
            <Box label="75% chance" value={`${money(result.monthly_for_75_percent)}/mo`} />
            <Box label="90% chance" value={`${money(result.monthly_for_90_percent)}/mo`} />
            <Box label="With no growth at all" value={`${money(result.monthly_without_growth)}/mo`} />
          </div>
          <p className="mt-3 text-slate-600">
            Investing could save you about {money(result.monthly_without_growth - result.monthly_for_50_percent)} a month compared with just
            saving cash. Want more certainty? Save the 75% or 90% amount.
          </p>
          <p className="mt-2 text-xs text-slate-500">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

function Compare({ stocks }) {
  const [picks, setPicks] = useState(["AAPL", "MSFT", "VOO", ""]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function run(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      setResult(await api.compare(picks.filter(Boolean)));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={run} className={`${card} space-y-4`}>
        <div className="grid gap-3 md:grid-cols-4">
          {picks.map((value, i) => (
            <StockSelect
              key={i}
              stocks={stocks}
              value={value}
              allowNone={i >= 2}
              onChange={(v) => setPicks(picks.map((p, j) => (j === i ? v : p)))}
            />
          ))}
        </div>
        <button className={primary} disabled={loading}>{loading ? "Comparing..." : "Compare"}</button>
      </form>
      {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {result && (
        <div className={card}>
          <h2 className="text-xl font-bold">Growth of $100 since {monthName(result.series[0].month)}</h2>
          <MultiLineChart data={result.series} lines={result.symbols.map((s) => ({ key: s, name: s }))} format={(v) => money(v)} />
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Ticker</th>
                <th className="text-right">$100 became</th>
                <th className="text-right">Avg yearly return</th>
                <th className="text-right">Volatility</th>
                <th className="text-right">Biggest drop</th>
                <th className="text-right">Worst 12 months</th>
              </tr>
            </thead>
            <tbody>
              {result.symbols.map((s) => {
                const st = result.stats[s];
                return (
                  <tr key={s} className="border-t border-slate-100">
                    <td className="py-2 font-semibold">{s}</td>
                    <td className="text-right">{money(result.series.at(-1)[s])}</td>
                    <td className="text-right">{percent(st.annual_return)}</td>
                    <td className="text-right">{percent(st.annual_volatility)}</td>
                    <td className="text-right">{percent(st.max_drawdown)}</td>
                    <td className="text-right">{percent(st.worst_12_months)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

function Box({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}