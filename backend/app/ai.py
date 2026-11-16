"""Talk to an AI model through any OpenAI-compatible API (we use Groq), with tool calling."""
import json
import os

import requests

from . import db  # noqa: F401  (importing db loads the .env file)

AI_BASE_URL = os.environ.get("AI_BASE_URL", "").rstrip("/")
AI_API_KEY = os.environ.get("AI_API_KEY", "")
AI_MODEL = os.environ.get("AI_MODEL", "")

_http = requests.Session()

COACH_PROMPT = """You are the AI Coach inside a beginner investing app that uses real US market data.

Who you help: people who are brand new to investing. Use plain words, short paragraphs and simple examples.
Keep answers under about 180 words unless the user asks for more.

Rules:
1. For ANY number about a stock, fund, portfolio or projection, call a tool first. Never make up numbers.
2. The app covers 36 US stocks and funds with prices since 2016. If asked about something else, say it is not in the app yet.
3. You teach; you do not give personal financial advice. Do not tell the user to buy or sell a specific stock.
   You may explain the app's model portfolios, trade-offs, and what the numbers mean.
4. When you discuss specific investments, end with one short line: "Educational only, not financial advice."
5. Past returns come from 2016 onward, a strong period for stocks. Remind users future returns may be lower when relevant.
6. If the user's plan is given below, use it to make answers personal.
7. Politely steer unrelated questions back to investing and money basics."""


def complete(messages, tools=None, temperature=0.3, json_mode=False):
    """Send one request to the AI and return its reply message."""
    if not AI_API_KEY or not AI_MODEL:
        raise RuntimeError("AI is not set up (AI_API_KEY or AI_MODEL missing in .env).")
    body = {"model": AI_MODEL, "messages": messages, "temperature": temperature}
    if tools:
        body["tools"] = tools
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    response = _http.post(
        f"{AI_BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {AI_API_KEY}"},
        json=body,
        timeout=90,
    )
    if response.status_code == 429:
        raise RuntimeError("The free AI limit was reached for the moment. Please wait a minute and try again.")
    if response.status_code >= 300:
        raise RuntimeError(f"AI error {response.status_code}: {response.text[:300]}")
    return response.json()["choices"][0]["message"]


def run_with_tools(messages, tool_specs, tool_functions, max_rounds=5):
    """Let the AI call our tools (real data) as many times as it needs, then return its final answer."""
    messages = list(messages)
    for _ in range(max_rounds):
        reply = complete(messages, tools=tool_specs)
        calls = reply.get("tool_calls") or []
        if not calls:
            return reply.get("content") or ""
        messages.append({"role": "assistant", "content": reply.get("content") or "", "tool_calls": calls})
        for call in calls:
            name = call["function"]["name"]
            try:
                arguments = json.loads(call["function"].get("arguments") or "{}")
                result = tool_functions[name](**arguments)
            except Exception as error:
                result = {"error": str(error)}
            messages.append({
                "role": "tool",
                "tool_call_id": call["id"],
                "content": json.dumps(result, default=str)[:6000],
            })
    return complete(messages).get("content") or ""


def parse_json(text):
    """Read JSON from the AI's reply, even if it wrapped it in extra text."""
    import re
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            raise ValueError("The AI did not return JSON")
        return json.loads(match.group(0))
