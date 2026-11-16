import Link from "next/link";

const STEPS = [
  { title: "Tell us your goal", text: "How much you can start with, what you can add each month, and for how many years." },
  { title: "Answer 5 quick questions", text: "We work out how comfortable you are with ups and downs." },
  { title: "See your plan grow", text: "Get a simple ETF portfolio and a chart of what it could be worth." },
];

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-emerald-700 p-10 text-white">
        <h1 className="text-4xl font-bold">Start investing with confidence</h1>
        <p className="mt-4 max-w-2xl text-lg text-emerald-50">
          Build a beginner-friendly investment plan in five minutes, using real US stock market data.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/plan" className="rounded-lg bg-white px-5 py-3 font-semibold text-emerald-700 hover:bg-emerald-50">
            Build my plan
          </Link>
          <Link href="/stocks" className="rounded-lg border border-white/60 px-5 py-3 font-semibold hover:bg-white/10">
            Explore stocks
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold">How it works</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-emerald-700">Step {i + 1}</div>
              <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-slate-600">{step.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
