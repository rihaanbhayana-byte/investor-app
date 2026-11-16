import Link from "next/link";

const STEPS = [
  { title: "Build a safety net first", text: "Before investing, keep 3 to 6 months of expenses in a savings account. Investments can drop, and you don't want to be forced to sell at a bad time." },
  { title: "Choose the type of account", text: "A regular brokerage account lets you withdraw any time. Retirement accounts such as a Roth IRA (you need earned income) or a 401(k) through work have tax benefits but rules on withdrawals." },
  { title: "Open an account with a broker", text: "Large, low-cost brokers include Fidelity, Charles Schwab and Vanguard. Look for no account fees, no trading commissions, and fractional shares so you can invest small amounts." },
  { title: "Add money", text: "Link your bank account and transfer the amount you chose in your plan." },
  { title: "Buy the funds in your plan", text: "Search each ticker from your plan (for example VTI, BND, VXUS), enter the dollar amount that matches its share, and place the order." },
  { title: "Automate your monthly amount", text: "Set up an automatic monthly transfer and investment. Investing a fixed amount regularly is called dollar-cost averaging." },
  { title: "Stay the course and rebalance once a year", text: "Markets go up and down. Once a year, check whether your mix has drifted from your plan's percentages and adjust it back." },
];

const TERMS = [
  ["Stock", "A small piece of ownership in one company."],
  ["Bond", "A loan to a government or company that pays interest. Usually steadier than stocks."],
  ["ETF", "A fund that holds many stocks or bonds at once and trades like a single stock."],
  ["Diversification", "Spreading money across many investments so one bad result hurts less."],
  ["Volatility", "How much prices swing up and down. Higher volatility means a bumpier ride."],
];

export default function LearnPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">How to start investing</h1>
        <p className="mt-1 text-slate-600">Seven steps from plan to your first investment.</p>
      </div>
      <ol className="space-y-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-bold text-white">{i + 1}</span>
            <div>
              <h2 className="font-semibold">{step.title}</h2>
              <p className="mt-1 text-slate-600">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Words to know</h2>
        <dl className="mt-3 space-y-3">
          {TERMS.map(([term, meaning]) => (
            <div key={term}>
              <dt className="font-semibold">{term}</dt>
              <dd className="text-slate-600">{meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
      <Link href="/plan" className="inline-block rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700">Build my plan</Link>
    </div>
  );
}
