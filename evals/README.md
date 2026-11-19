# Seedwise evaluations

One command tests every AI step and the portfolio engine against written test sets, and writes a report.

| Section | What it checks | Test set |
| --- | --- | --- |
| 1. Goal reader | Goal type, starting amount, monthly amount and years read correctly; compares models | `data/goals.json` (50 goals with right answers) |
| 2. Wish reader | Wishes turned into the exact engine rules; compares models | `data/wishes.json` (30 wishes) |
| 3. Fund agent | Searches the full fund list; picks on topic, safe, never invented | `data/scout.json` (8 topics) |
| 4. Engine | Guardrails passed, stability, speed; AI explanation numbers kept | 3 risk levels × 6 wish profiles |
| 5. Safety | Harmful, injection, off-topic, crisis stopped; personal details removed; normal questions allowed | `data/redteam.json` (50 prompts) |
| 6. Backtest | Mixes built on 2016–2021, judged on 2022 onwards, vs fixed mixes and 60/40 | real prices |
| 7. Personas | The core loop end to end for the 3 personas (automated, not user testing) | `data/personas.json` |

**Run on GitHub:** Actions → "AI evaluations" → Run workflow. Download `seedwise-evaluation-report` from the run page.
**Run on a laptop:** `python evals/run_evals.py` (add `--quick` for a short run).

It only reads the database. A full run uses about 300 requests of the free Groq quota and takes 10–15 minutes.
