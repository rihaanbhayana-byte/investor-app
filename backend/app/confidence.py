"""Measured confidence for every AI recommendation.

Rule: a confidence number is only shown when code can MEASURE it (simulations, distances,
agreement between runs, numbers checked against data). We never ask the AI to rate itself:
language models tend to say "90% sure" no matter what, so that number would mean nothing.

Every feature returns the same "insight" shape, so the website can show one consistent card:
{
  "confidence": {"level": "high|medium|low", "label": "...", "value": 0.0-1.0 or None, "measure": "how we measured it"},
  "why": ["short reasons"],
  "based_on": ["the data used"],
  "assumptions": ["what we assumed"],
}
"""
import re

WORD_NUMBERS = {"thousand": 1e3, "k": 1e3, "grand": 1e3, "million": 1e6, "m": 1e6, "mil": 1e6}


def insight(level, label, measure, value=None, why=(), based_on=(), assumptions=()):
    return {
        "confidence": {"level": level, "label": label, "value": None if value is None else round(float(value), 3), "measure": measure},
        "why": [w for w in why if w],
        "based_on": [b for b in based_on if b],
        "assumptions": [a for a in assumptions if a],
    }


def level_from(share, high=0.75, medium=0.5):
    return "high" if share >= high else "medium" if share >= medium else "low"


def numbers_in(text):
    """Every number a person wrote: "$1,500", "2k", "1.5 million", "50" -> {1500.0, 2000.0, 1500000.0, 50.0}."""
    found = set()
    for amount, unit in re.findall(r"\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(thousand|grand|million|mil|k|m)?\b", text.lower()):
        try:
            value = float(amount.replace(",", ""))
        except ValueError:
            continue
        found.add(value * WORD_NUMBERS.get(unit, 1))
    return found


def _close(a, b):
    return abs(a - b) <= max(1.0, 0.02 * abs(b))


def source_of(value, said, conversions=(), default=None):
    """Where did this number come from?
    said_it   - the person typed it
    worked_out - calculated from something they typed (e.g. $50 a week -> $217 a month)
    not_said  - they didn't mention it, so it was left at 0 / the default
    ai_guess  - the AI chose it without a matching number in the text"""
    if any(_close(n, value) for n in said):
        return "said_it"
    if any(_close(convert(n), value) for n in said for convert in conversions):
        return "worked_out"
    if value == 0 or (default is not None and value == default):
        return "not_said"
    return "ai_guess"


SOURCE_LABELS = {
    "said_it": "From your words",
    "worked_out": "Worked out from your words",
    "not_said": "Not mentioned",
    "ai_guess": "AI's guess",
}


def percents_in(text):
    """Percentages quoted in a piece of text: "about 42%" -> [42.0]."""
    return [float(x) for x in re.findall(r"(-?\d+(?:\.\d+)?)\s?%", text)]


def fact_check(text, true_values):
    """How many percentages in `text` match a real value (within 1.5 points, sign ignored)?
    true_values are fractions (0.42 = 42%). Returns (matched, total)."""
    quoted = percents_in(text)
    truth = [abs(v) * 100 for v in true_values if v is not None]
    matched = sum(1 for q in quoted if any(abs(abs(q) - t) <= 1.5 for t in truth))
    return matched, len(quoted)


def silhouettes(points, labels):
    """Silhouette score per point: (b - a) / max(a, b), from -1 to 1.
    a = average distance to its own group, b = average distance to the nearest other group.
    Near 1 = clearly belongs; near 0 = sits between two groups. Returns (scores, runner_up_group)."""
    import numpy as np

    points = np.asarray(points, dtype=float)
    labels = np.asarray(labels)
    distances = np.sqrt(((points[:, None, :] - points[None, :, :]) ** 2).sum(axis=2))
    groups = sorted(set(labels.tolist()))
    scores, runner_up = [], []
    for i in range(len(points)):
        own = labels == labels[i]
        own[i] = False
        a = distances[i, own].mean() if own.any() else 0.0
        others = {g: distances[i, labels == g].mean() for g in groups if g != labels[i]}
        nearest = min(others, key=others.get) if others else labels[i]
        b = others.get(nearest, 0.0)
        scores.append(0.0 if not own.any() else (b - a) / max(a, b, 1e-9))
        runner_up.append(nearest)
    return scores, runner_up
