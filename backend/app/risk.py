"""Risk questionnaire and scoring."""

QUESTIONS = [
    {
        "id": "market_drop",
        "text": "If your investments dropped 20% in one month, what would you most likely do?",
        "options": [
            {"id": "sell_all", "text": "Sell everything to stop the loss", "points": 0},
            {"id": "sell_some", "text": "Sell some of it", "points": 1},
            {"id": "wait", "text": "Do nothing and wait", "points": 2},
            {"id": "buy_more", "text": "Buy more while prices are lower", "points": 3},
        ],
    },
    {
        "id": "priority",
        "text": "Which matters most to you?",
        "options": [
            {"id": "safety", "text": "Not losing money", "points": 0},
            {"id": "mostly_safety", "text": "Mostly safety, with a little growth", "points": 1},
            {"id": "balance", "text": "A balance of safety and growth", "points": 2},
            {"id": "growth", "text": "Growing my money as much as possible", "points": 3},
        ],
    },
    {
        "id": "experience",
        "text": "How much investing experience do you have?",
        "options": [
            {"id": "none", "text": "None, I'm brand new", "points": 0},
            {"id": "little", "text": "A little (savings account, maybe a fund)", "points": 1},
            {"id": "some", "text": "Some (I've bought stocks or funds before)", "points": 2},
            {"id": "lot", "text": "A lot (I invest regularly)", "points": 3},
        ],
    },
    {
        "id": "income",
        "text": "How stable is your income?",
        "options": [
            {"id": "unstable", "text": "Not stable", "points": 0},
            {"id": "somewhat", "text": "Somewhat stable", "points": 1},
            {"id": "stable", "text": "Stable", "points": 2},
            {"id": "very_stable", "text": "Very stable", "points": 3},
        ],
    },
    {
        "id": "emergency_fund",
        "text": "Do you have savings for emergencies (3 to 6 months of expenses)?",
        "options": [
            {"id": "no", "text": "No", "points": 0},
            {"id": "building", "text": "I'm building one", "points": 1},
            {"id": "yes", "text": "Yes", "points": 3},
        ],
    },
]

EXPLANATIONS = {
    "conservative": "You prefer stability. Your plan holds mostly bonds, which move less, with some stocks for growth.",
    "moderate": "You want growth but also some stability. Your plan mixes stocks and bonds.",
    "aggressive": "You can handle bigger ups and downs for higher long-term growth. Your plan holds mostly stocks.",
}


def horizon_points(years):
    if years < 3:
        return 0
    if years <= 5:
        return 1
    if years <= 10:
        return 2
    return 3


def public_questions():
    """Questions without the point values (the website does not need them)."""
    return [
        {"id": q["id"], "text": q["text"], "options": [{"id": o["id"], "text": o["text"]} for o in q["options"]]}
        for q in QUESTIONS
    ]


def score_answers(answers, horizon_years):
    score = horizon_points(horizon_years)
    for question in QUESTIONS:
        chosen = answers.get(question["id"])
        option = next((o for o in question["options"] if o["id"] == chosen), None)
        if option is None:
            raise ValueError(f"Missing or invalid answer for '{question['id']}'")
        score += option["points"]

    if horizon_years < 3 or score <= 6:
        level = "conservative"
    elif score <= 12:
        level = "moderate"
    else:
        level = "aggressive"

    max_score = 3 * (len(QUESTIONS) + 1)
    return {
        "score": score,
        "max_score": max_score,
        "risk_level": level,
        "explanation": EXPLANATIONS[level],
        "insight": personality_insight(answers, horizon_years, score, max_score, level),
    }


NAMES = {"conservative": "Steady Saver", "moderate": "Balanced Builder", "aggressive": "Growth Seeker"}
SHORT = {
    "market_drop": "In a 20% drop you'd",
    "priority": "What matters most",
    "experience": "Experience",
    "income": "Income",
    "emergency_fund": "Emergency savings",
}


def personality_insight(answers, horizon_years, score, max_score, level):
    """How clearly does this person fit their personality? Measured as the distance from their
    score to the cut-off of the neighbouring personality (bands: 0-6, 7-12, 13-18)."""
    from .confidence import insight

    if horizon_years < 3:
        return insight(
            "high", f"Clear fit: {NAMES[level]}",
            "Money needed in under 3 years always gets the steadiest plan, whatever the answers.",
            why=[f"You need the money in {horizon_years} year{'s' if horizon_years != 1 else ''}, which is too soon to ride out a crash."],
            based_on=["Your timeline", "Your 5 answers"],
            assumptions=["Stocks can take 2 to 5 years to recover from a crash."],
        )
    # distance (in points) to the nearest cut-off, and which personality sits on the other side
    if level == "conservative":
        gap, neighbour = 6.5 - score, "moderate"
    elif level == "aggressive":
        gap, neighbour = score - 12.5, "moderate"
    else:
        down, up = score - 6.5, 12.5 - score
        gap, neighbour = (down, "conservative") if down < up else (up, "aggressive")
    points = int(gap + 0.5)  # points needed to cross over
    if gap >= 2.5:
        conf, label = "high", f"Strong fit: {NAMES[level]}"
    elif gap >= 1.5:
        conf, label = "medium", f"Good fit: {NAMES[level]}"
    else:
        conf, label = "low", f"Close call: near {NAMES[neighbour]}"

    # the answers that pushed hardest towards this result
    chosen = []
    for q in QUESTIONS:
        option = next(o for o in q["options"] if o["id"] == answers.get(q["id"]))
        chosen.append((q["id"], option["text"], option["points"]))
    pull = (lambda c: -c[2]) if level == "aggressive" else (lambda c: c[2]) if level == "conservative" else (lambda c: abs(c[2] - 1.5))  # middle answers explain a middle result
    decisive = sorted(chosen, key=pull)[:3]
    why = [f"{SHORT[qid]}: {text[0].lower() + text[1:]} ({pts} of 3 points)" for qid, text, pts in decisive]
    why.append(f"Your {horizon_years}-year timeline adds {horizon_points(horizon_years)} of 3 points.")
    return {
        **insight(
            conf, label,
            f"You scored {score} of {max_score}. You are {points} point{'s' if points != 1 else ''} away from {NAMES[neighbour]}. "
            "The bands are 0-6 Steady Saver, 7-12 Balanced Builder, 13-18 Growth Seeker.",
            value=min(1.0, gap / 3.0),
            why=why,
            based_on=["Your 5 answers", "Your timeline"],
            assumptions=["Each answer is worth 0 to 3 points; the total decides the personality."],
        ),
        "neighbour": neighbour,
        "neighbour_name": NAMES[neighbour],
    }
