"""Guardrails: safety checks that run around every AI feature.

Layers (in the order they run):
  1. Rate limit        - stop one visitor flooding the free AI quota
  2. Personal data     - remove card numbers, SSNs, emails, phones, passwords before the AI sees them
  3. Prompt injection  - block attempts to override the AI's rules
  4. Topic check       - a fast AI classifier keeps the coach on investing and money topics
  5. Output check      - add a caution note if an answer sounds like a promise or a buy/sell order
"""
import json
import re
import time
from collections import defaultdict, deque

from . import ai

# ---------------------------------------------------------------------
# 1. Rate limiting (per visitor IP, in memory)
# ---------------------------------------------------------------------
_hits = defaultdict(deque)
LIMITS = [(15, 60), (300, 24 * 3600)]  # 15 AI requests per minute, 300 per day


def client_ip(request):
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")


def rate_limited(ip):
    """Return a friendly message if this visitor is over the limit, else None."""
    now = time.time()
    hits = _hits[ip]
    while hits and now - hits[0] > LIMITS[-1][1]:
        hits.popleft()
    for limit, window in LIMITS:
        if sum(1 for t in hits if now - t <= window) >= limit:
            stats["rate_limited"] += 1
            return "You're asking very quickly! Please wait a minute and try again." if window == 60 else \
                "You've reached today's AI limit for this free app. Please come back tomorrow."
    hits.append(now)
    return None


# ---------------------------------------------------------------------
# 2. Personal data
# ---------------------------------------------------------------------
PII_PATTERNS = [
    ("a card number", re.compile(r"\b\d(?:[ -]?\d){12,18}\b")),
    ("a Social Security number", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    ("an email address", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")),
    ("a phone number", re.compile(r"(?<![\w$])\+?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b")),
    ("a password", re.compile(r"(?i)\b(password|passcode|pin)\s*(is|:|=)\s*\S+")),
]


def redact(text):
    """Replace personal data with [removed]. Returns (clean_text, list_of_things_removed)."""
    found = []
    for label, pattern in PII_PATTERNS:
        if pattern.search(text):
            found.append(label)
            text = pattern.sub("[removed]", text)
    if found:
        stats["personal_data_removed"] += 1
    return text, found


def privacy_notice(found):
    return f"For your safety I removed {', '.join(found)} from your message. Never share personal or account details here."


# ---------------------------------------------------------------------
# 3. Prompt injection
# ---------------------------------------------------------------------
INJECTION = re.compile(
    r"(?i)("
    r"ignore (all |any |the |your |my )?(previous|prior|above|earlier|system) (instructions|rules|prompts?|messages)"
    r"|disregard (the |your |all )?(rules|instructions|guidelines)"
    r"|forget (your|the|all) (rules|instructions)"
    r"|(reveal|show|print|repeat|tell me) (me )?(your|the) (system )?(prompt|instructions|rules)"
    r"|system prompt|developer mode|jailbreak|\bDAN\b"
    r"|you are (now|no longer)|pretend (to be|you are|you're)|act as (an? )?(unfiltered|unrestricted|different)"
    r"|new instructions:"
    r")"
)


def looks_like_injection(text):
    if INJECTION.search(text):
        stats["injection_blocked"] += 1
        return True
    return False


# ---------------------------------------------------------------------
# 4. Topic check (fast AI classifier)
# ---------------------------------------------------------------------
CLASSIFY_PROMPT = """You are a safety filter for an investing-education app for beginners.
Classify the LATEST user message (use the earlier context only to understand short follow-ups like "why?").
Reply with JSON only: {"category": "...", "reason": "max 12 words"}

Categories:
- "on_topic": investing, stocks, funds, markets, the economy, saving, budgeting, debt, retirement, general tax
  basics for investors, financial words, maths about money or returns, the user's plan, how this app works,
  and simple greetings or thanks.
- "off_topic": anything else (general trivia, maths not about money, homework, coding, writing essays or poems,
  sports, celebrities, health, relationships, news unrelated to markets, etc.).
- "harmful": insider trading, market manipulation or pump-and-dump, scams or fraud, money laundering,
  tax evasion, hacking accounts, or anything illegal or meant to hurt others.
- "crisis": the user mentions self-harm or suicide, or seems in a desperate emergency."""


def classify(text, context=""):
    """Returns 'on_topic', 'off_topic', 'harmful' or 'crisis'. If the check itself fails, allow (fail open)."""
    messages = [
        {"role": "system", "content": CLASSIFY_PROMPT},
        {"role": "user", "content": json.dumps({"earlier_context": context[-600:], "latest_message": text[:1500]})},
    ]
    try:
        try:
            reply = ai.complete(messages, temperature=0, json_mode=True)
        except RuntimeError:
            reply = ai.complete(messages, temperature=0)
        category = str(ai.parse_json(reply.get("content") or "").get("category", "on_topic"))
    except Exception:
        return "on_topic"
    category = category if category in ("on_topic", "off_topic", "harmful", "crisis") else "on_topic"
    if category != "on_topic":
        stats[category] += 1
    return category


CANNED = {
    "off_topic": (
        "I'm Seedwise's investing coach, so I stick to money topics and can't help with that one. "
        "I'd love to help with something like:\n\n"
        "- \"What is an ETF?\"\n- \"How does my plan grow over time?\"\n- \"Should I pay off debt or invest first?\""
    ),
    "harmful": (
        "I can't help with that. It could break the law or hurt other people. "
        "I'm happy to explain how investing works the honest way, or how to spot and avoid scams."
    ),
    "injection": (
        "I can't change or share my instructions, but I'm happy to help with any investing or money question."
    ),
    "crisis": (
        "I'm really sorry you're going through this. You don't have to handle it alone. "
        "If you're thinking about harming yourself, please reach out right now. In the US you can call or text **988** "
        "(Suicide & Crisis Lifeline), any time of day. If you're outside the US, your local emergency number can help.\n\n"
        "If money worries are part of it, a free non-profit credit counsellor (for example through NFCC.org) can help "
        "you make a plan. Losses can feel huge, but there are people who can help you through this."
    ),
}


# ---------------------------------------------------------------------
# 5. Output check
# ---------------------------------------------------------------------
RISKY_OUTPUT = re.compile(
    r"(?i)(guaranteed (return|profit|gain)|risk[- ]free (return|profit|investment)|can'?t lose|"
    r"you should (definitely )?(buy|sell)\b|i recommend (buying|selling)|sure thing|double your money)"
)
CAUTION = "\n\n_Note: no investment is guaranteed, and this isn't a recommendation to buy or sell. Educational only, not financial advice._"


def check_output(text):
    if RISKY_OUTPUT.search(text or ""):
        stats["output_softened"] += 1
        return (text or "") + CAUTION
    return text


# ---------------------------------------------------------------------
# Counters, for the "Guardrails" panel and the capstone write-up
# ---------------------------------------------------------------------
stats = defaultdict(int)


def screen_input(text, context="", check_topic=True):
    """Run layers 2-4 on a user message.
    Returns (clean_text, notices, blocked) where blocked is None or {"type": ..., "reply": ...}."""
    stats["messages_checked"] += 1
    clean, found = redact(text)
    notices = [privacy_notice(found)] if found else []
    if looks_like_injection(clean):
        return clean, notices, {"type": "injection", "reply": CANNED["injection"]}
    if check_topic:
        category = classify(clean, context)
        if category != "on_topic":
            return clean, notices, {"type": category, "reply": CANNED[category]}
    return clean, notices, None
