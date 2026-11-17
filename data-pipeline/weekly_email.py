"""Weekly email: last week's moves in each person's practice portfolio and watchlist.

Runs every Monday from GitHub Actions (.github/workflows/weekly-email.yml). Only people who turned on
"Weekly email" on their Profile page get one. Sent from a Gmail account with an App Password (free).

Try it safely:
    python data-pipeline/weekly_email.py --dry-run            # prints the emails instead of sending
    python data-pipeline/weekly_email.py --only you@gmail.com # sends just to you
"""
import argparse
import html
import os
import smtplib
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SECRET_KEY"]
APP_URL = os.environ.get("APP_URL", "https://seedwise-silk.vercel.app").rstrip("/")
BIG = 0.05  # a 5% week is worth calling out
http = requests.Session()
http.headers.update({"apikey": KEY, "Authorization": f"Bearer {KEY}"})


def get(table, params):
    rows, offset = [], 0
    while True:
        r = http.get(f"{URL}/rest/v1/{table}", params={**params, "limit": 1000, "offset": offset}, timeout=30)
        r.raise_for_status()
        batch = r.json()
        rows += batch
        if len(batch) < 1000:
            return rows
        offset += 1000


def users_by_id():
    out, page = {}, 1
    while True:
        r = http.get(f"{URL}/auth/v1/admin/users", params={"page": page, "per_page": 200}, timeout=30)
        r.raise_for_status()
        users = r.json().get("users", [])
        for u in users:
            out[u["id"]] = u
        if len(users) < 200:
            return out
        page += 1


def week_prices(symbols):
    """{symbol: (price a week ago, price now, date now)} from daily closes."""
    if not symbols:
        return {}
    since = (date.today() - timedelta(days=14)).isoformat()
    rows = get("daily_prices", {"select": "symbol,date,close", "symbol": f"in.({','.join(sorted(symbols))})",
                                "date": f"gte.{since}", "order": "date"})
    series = defaultdict(list)
    for r in rows:
        series[r["symbol"]].append((r["date"], float(r["close"])))
    out = {}
    for s, pts in series.items():
        now_d, now = pts[-1]
        week_ago = [p for d, p in pts if d <= (date.fromisoformat(now_d) - timedelta(days=7)).isoformat()]
        out[s] = (week_ago[-1] if week_ago else pts[0][1], now, now_d)
    return out


def positions(trades):
    shares = defaultdict(float)
    cash = 10000.0
    for t in trades:
        n, p = float(t["shares"]), float(t["price"])
        if t["side"] == "buy":
            shares[t["symbol"]] += n
            cash -= n * p
        else:
            shares[t["symbol"]] -= n
            cash += n * p
    return {s: n for s, n in shares.items() if n > 1e-6}, cash


def pct(x):
    return f"{'+' if x >= 0 else '−'}{abs(x) * 100:.1f}%"


def build(user, holdings, cash, watch, prices):
    name = (user.get("user_metadata") or {}).get("full_name", "").split(" ")[0] or "there"
    rows, port_then, port_now = [], cash, cash
    for s, n in sorted(holdings.items(), key=lambda kv: -kv[1] * prices.get(kv[0], (0, 0, ""))[1]):
        if s not in prices:
            continue
        then, now, _ = prices[s]
        port_then += n * then
        port_now += n * now
        rows.append((s, now, now / then - 1, n * now))
    watch_rows = [(s, prices[s][1], prices[s][1] / prices[s][0] - 1) for s in watch if s in prices]
    big = sorted([r for r in rows] + [(s, p, c, None) for s, p, c in watch_rows if s not in holdings],
                 key=lambda r: -abs(r[2]))
    big = [r for r in big if abs(r[2]) >= BIG][:5]
    if not rows and not watch_rows:
        return None
    week = port_now / port_then - 1 if port_then else 0
    as_of = max((p[2] for p in prices.values()), default=date.today().isoformat())

    # ---- plain text
    lines = [f"Hi {name},", "", f"Your Seedwise week (prices to {as_of}):", ""]
    if rows:
        lines.append(f"Practice portfolio: ${port_now:,.0f} ({pct(week)} this week)")
    if big:
        lines += ["", "Big moves (5% or more):"] + [f"  {s}  {pct(c)}  now ${p:,.2f}" for s, p, c, _ in big]
    if watch_rows:
        lines += ["", "Watchlist:"] + [f"  {s}  {pct(c)}  ${p:,.2f}" for s, p, c in watch_rows[:10]]
    lines += ["", f"Open Seedwise: {APP_URL}/dashboard", "",
              "Big moves are normal and aren't a signal to buy or sell. Educational only, not financial advice.",
              f"Turn these emails off any time on your Profile page: {APP_URL}/profile"]
    text = "\n".join(lines)

    # ---- html (inline styles: email apps ignore stylesheets)
    def row(sym, price, change, value=None):
        color = "#0E8F52" if change >= 0 else "#D23339"
        val = f"<td style='padding:8px 0;text-align:right;color:#5B6577'>${value:,.0f}</td>" if value is not None else "<td></td>"
        return (f"<tr style='border-top:1px solid #E4E8EF'><td style='padding:8px 0;font-weight:600'>{html.escape(sym)}</td>"
                f"<td style='padding:8px 0;text-align:right'>${price:,.2f}</td>"
                f"<td style='padding:8px 0;text-align:right;color:{color};font-weight:600'>{pct(change)}</td>{val}</tr>")

    def table(title, body, value_col=False):
        head = "<th style='text-align:right;font-weight:500'>Value</th>" if value_col else "<th></th>"
        return (f"<h3 style='margin:24px 0 6px;font-size:15px'>{title}</h3><table width='100%' style='border-collapse:collapse;font-size:14px'>"
                f"<tr style='color:#5B6577;font-size:12px'><th style='text-align:left;font-weight:500'>Ticker</th>"
                f"<th style='text-align:right;font-weight:500'>Price</th><th style='text-align:right;font-weight:500'>Week</th>{head}</tr>{body}</table>")

    parts = [f"<p style='margin:0 0 4px;color:#5B6577;font-size:13px'>Your week to {as_of}</p>",
             f"<h1 style='margin:0 0 16px;font-size:22px'>Hi {html.escape(name)}, here's your Seedwise week</h1>"]
    if rows:
        color = "#0E8F52" if week >= 0 else "#D23339"
        parts.append(f"<div style='background:#F4F6FA;border-radius:12px;padding:16px'><div style='color:#5B6577;font-size:12px'>Practice portfolio</div>"
                     f"<div style='font-size:26px;font-weight:700'>${port_now:,.0f} <span style='font-size:15px;color:{color}'>{pct(week)} this week</span></div></div>")
    if big:
        parts.append(table("Big moves (5% or more)", "".join(row(s, p, c) for s, p, c, _ in big)))
    if rows:
        parts.append(table("Your holdings", "".join(row(s, p, c, v) for s, p, c, v in rows[:10]), value_col=True))
    if watch_rows:
        parts.append(table("Your watchlist", "".join(row(s, p, c) for s, p, c in watch_rows[:10])))
    parts.append(f"<p style='margin:24px 0'><a href='{APP_URL}/dashboard' style='background:#2B5BFF;color:#fff;text-decoration:none;"
                 "padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block'>Open Seedwise</a></p>")
    parts.append("<p style='color:#5B6577;font-size:12px;line-height:1.5'>Big moves are normal and aren't a signal to buy or sell. "
                 f"Practice uses play money. Educational only, not financial advice.<br>"
                 f"<a href='{APP_URL}/profile' style='color:#5B6577'>Turn off these emails</a></p>")
    body = ("<div style='background:#F4F6FA;padding:24px'><div style='max-width:560px;margin:0 auto;background:#fff;border:1px solid #E4E8EF;"
            "border-radius:16px;padding:28px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0B1220'>"
            "<div style='font-weight:700;font-size:16px;margin-bottom:20px'><span style='display:inline-block;width:22px;height:22px;"
            "background:#2B5BFF;border-radius:6px;vertical-align:middle;margin-right:8px'></span>Seedwise</div>"
            + "".join(parts) + "</div></div>")
    subject = f"Your Seedwise week: practice portfolio {pct(week)}" if rows else "Your Seedwise week: watchlist moves"
    return subject, text, body


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="print the emails instead of sending them")
    ap.add_argument("--only", help="send only to this email address (for testing)")
    args = ap.parse_args()

    wanted = get("profiles", {"select": "id", "weekly_email": "is.true"})
    if not wanted:
        print("Nobody has turned on the weekly email yet.")
        return
    users = users_by_id()
    ids = [w["id"] for w in wanted if w["id"] in users]
    if args.only:
        ids = [i for i in ids if users[i].get("email", "").lower() == args.only.lower()]
    trades = get("practice_trades", {"select": "user_id,symbol,side,shares,price,created_at", "user_id": f"in.({','.join(ids)})", "order": "created_at"}) if ids else []
    watch = get("watchlist", {"select": "user_id,symbol", "user_id": f"in.({','.join(ids)})"}) if ids else []
    by_user_trades, by_user_watch = defaultdict(list), defaultdict(list)
    for t in trades:
        by_user_trades[t["user_id"]].append(t)
    for w in watch:
        by_user_watch[w["user_id"]].append(w["symbol"])
    plans = {i: positions(by_user_trades[i]) for i in ids}
    prices = week_prices({s for h, _ in plans.values() for s in h} | {s for i in ids for s in by_user_watch[i]})

    sender, password = os.environ.get("GMAIL_ADDRESS"), os.environ.get("GMAIL_APP_PASSWORD")
    smtp = None
    if not args.dry_run:
        if not sender or not password:
            sys.exit("Set GMAIL_ADDRESS and GMAIL_APP_PASSWORD (GitHub secrets) to send emails.")
        smtp = smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30)
        smtp.login(sender, password)

    sent = 0
    for i in ids:
        holdings, cash = plans[i]
        email = build(users[i], holdings, cash, by_user_watch[i], prices)
        if not email:
            continue
        subject, text, body = email
        to = users[i]["email"]
        if args.dry_run:
            print(f"--- to {to}: {subject}\n{text}\n")
            continue
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = f"Seedwise <{sender}>", to, subject
        msg.set_content(text)
        msg.add_alternative(body, subtype="html")
        smtp.send_message(msg)
        http.patch(f"{URL}/rest/v1/profiles", params={"id": f"eq.{i}"}, json={"last_email_at": datetime.now(timezone.utc).isoformat()}, timeout=15)
        sent += 1
    if smtp:
        smtp.quit()
    print(f"Weekly email: {sent} sent, {len(ids)} opted in.")


if __name__ == "__main__":
    main()
