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

    return {
        "score": score,
        "max_score": 3 * (len(QUESTIONS) + 1),
        "risk_level": level,
        "explanation": EXPLANATIONS[level],
    }
