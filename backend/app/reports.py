"""Seedwise PDF reports: an action plan, and a practice portfolio report.

Built with ReportLab (pure Python, no browser needed), so every PDF looks the same on every device.
All numbers come from the same code the app uses. No AI writes anything in these reports.
"""
from datetime import date, timedelta
from io import BytesIO

from reportlab.graphics.shapes import Drawing, Line, PolyLine, Polygon, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (CondPageBreak, Flowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

# ---------------------------------------------------------------- brand
BRAND = colors.HexColor("#2B5BFF")
BRAND_SOFT = colors.HexColor("#EEF2FF")
INK = colors.HexColor("#0B1220")
MUTED = colors.HexColor("#5B6577")
LINE = colors.HexColor("#E4E8EF")
PAGE = colors.HexColor("#F4F6FA")
GAIN = colors.HexColor("#0E8F52")
GAIN_SOFT = colors.HexColor("#E7F6EE")
LOSS = colors.HexColor("#D23339")
LOSS_SOFT = colors.HexColor("#FDECEC")
AMBER = colors.HexColor("#B45309")
AMBER_SOFT = colors.HexColor("#FEF3C7")
SERIES = ["#2B5BFF", "#0EA5E9", "#8B5CF6", "#F59E0B", "#10B981", "#EC4899", "#64748B"]

W, H = letter
MARGIN = 0.75 * inch
CONTENT_W = W - 2 * MARGIN
DISCLAIMER = ("Seedwise is an educational project. This report is not financial advice. Projections use past prices "
              "(since 2016) and simulated futures; real results will differ. Consider speaking with a licensed adviser "
              "before investing real money.")


def _style(name, size=10, leading=None, color=INK, bold=False, **kw):
    return ParagraphStyle(name, fontName="Helvetica-Bold" if bold else "Helvetica", fontSize=size,
                          leading=leading or size * 1.35, textColor=color, alignment=TA_LEFT, **kw)


S = {
    "title": _style("title", 24, 29, bold=True),
    "sub": _style("sub", 10.5, color=MUTED),
    "h2": _style("h2", 14, 18, bold=True, spaceBefore=6, spaceAfter=4),
    "body": _style("body", 10, 14.5),
    "muted": _style("muted", 9, 12.5, color=MUTED),
    "small": _style("small", 8, 11, color=MUTED),
    "label": _style("label", 8, 10, color=MUTED),
    "kpi": _style("kpi", 17, 21, bold=True),
    "cell": _style("cell", 9, 12),
    "cellb": _style("cellb", 9, 12, bold=True),
    "cellm": _style("cellm", 8.5, 11.5, color=MUTED),
}


def money(x, cents=False):
    if x is None:
        return "–"
    sign = "-" if x < 0 else ""
    return f"{sign}${abs(x):,.2f}" if cents else f"{sign}${abs(x):,.0f}"


def pct(x, digits=1, signed=False):
    if x is None:
        return "–"
    s = f"{abs(x) * 100:.{digits}f}%"
    return (("+" if x >= 0 else "-") + s) if signed else (("-" if x < 0 else "") + s)


def esc(text):
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ---------------------------------------------------------------- page frame
def _frame(title):
    def draw(c, doc):
        c.saveState()
        # header
        c.setFillColor(BRAND)
        c.roundRect(MARGIN, H - 0.62 * inch, 16, 16, 4, stroke=0, fill=1)
        c.setStrokeColor(colors.white)
        c.setLineWidth(1.4)
        c.line(MARGIN + 8, H - 0.62 * inch + 3.5, MARGIN + 8, H - 0.62 * inch + 10)
        c.bezier(MARGIN + 8, H - 0.62 * inch + 9, MARGIN + 8, H - 0.62 * inch + 13, MARGIN + 11, H - 0.62 * inch + 13.5, MARGIN + 12.5, H - 0.62 * inch + 13)
        c.bezier(MARGIN + 8, H - 0.62 * inch + 9, MARGIN + 8, H - 0.62 * inch + 12, MARGIN + 5, H - 0.62 * inch + 12.5, MARGIN + 3.5, H - 0.62 * inch + 12)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(MARGIN + 22, H - 0.62 * inch + 4, "Seedwise")
        c.setFont("Helvetica", 8.5)
        c.setFillColor(MUTED)
        c.drawRightString(W - MARGIN, H - 0.62 * inch + 4, f"{title}  ·  {date.today():%d %b %Y}")
        c.setStrokeColor(LINE)
        c.setLineWidth(0.6)
        c.line(MARGIN, H - 0.72 * inch, W - MARGIN, H - 0.72 * inch)
        # footer
        c.line(MARGIN, 0.62 * inch, W - MARGIN, 0.62 * inch)
        c.setFont("Helvetica", 7.5)
        c.drawString(MARGIN, 0.45 * inch, "Educational only. Not financial advice.  ·  seedwise-silk.vercel.app")
        c.drawRightString(W - MARGIN, 0.45 * inch, f"Page {doc.page}")
        c.restoreState()
    return draw


def _doc(buf, title):
    return SimpleDocTemplate(buf, pagesize=letter, leftMargin=MARGIN, rightMargin=MARGIN,
                             topMargin=0.95 * inch, bottomMargin=0.85 * inch, title=f"Seedwise · {title}", author="Seedwise")


# ---------------------------------------------------------------- building blocks
def kpi_strip(items):
    """A row of KPI cards: [(label, value, note, tone)]"""
    cells = []
    for label, value, note, tone in items:
        color = {"gain": GAIN, "loss": LOSS, "brand": BRAND}.get(tone, INK)
        cells.append([Paragraph(esc(label), S["label"]),
                      Paragraph(f'<font color="{color.hexval().replace("0x", "#")}">{esc(value)}</font>', S["kpi"]),
                      Paragraph(esc(note), S["small"])])
    col = CONTENT_W / len(items)
    t = Table([cells], colWidths=[col] * len(items))
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("LINEAFTER", (0, 0), (-2, -1), 0.6, LINE),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 11), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def data_table(header, rows, widths, align_right=(), zebra=True, bold_last=False):
    data = [[Paragraph(f"<b>{esc(h)}</b>", S["cellm"]) for h in header]]
    for r in rows:
        data.append([c if isinstance(c, Flowable) else Paragraph(esc(c), S["cell"]) for c in r])
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, LINE),
        ("LINEBELOW", (0, 1), (-1, -2), 0.4, LINE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("BACKGROUND", (0, 0), (-1, 0), PAGE),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]
    for col in align_right:
        style.append(("ALIGN", (col, 0), (col, -1), "RIGHT"))
    if bold_last:
        style.append(("BACKGROUND", (0, -1), (-1, -1), BRAND_SOFT))
    t.setStyle(TableStyle(style))
    for col in align_right:  # right-align the paragraphs too
        for row in data:
            if isinstance(row[col], Paragraph):
                row[col].style = ParagraphStyle("r", parent=row[col].style, alignment=2)
    return t


def note_box(text, bg=BRAND_SOFT, border=None):
    t = Table([[Paragraph(text, S["body"])]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg), ("BOX", (0, 0), (-1, -1), 0.6, border or bg),
                           ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                           ("LEFTPADDING", (0, 0), (-1, -1), 11), ("RIGHTPADDING", (0, 0), (-1, -1), 11)]))
    return t


def pill(text, kind="brand"):
    fg, bg = {"good": (GAIN, GAIN_SOFT), "ok": (AMBER, AMBER_SOFT), "warn": (LOSS, LOSS_SOFT)}.get(kind, (BRAND, BRAND_SOFT))
    t = Table([[Paragraph(f'<font color="{fg.hexval().replace("0x", "#")}"><b>{esc(text)}</b></font>', S["small"])]])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg), ("TOPPADDING", (0, 0), (-1, -1), 2),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 2), ("LEFTPADDING", (0, 0), (-1, -1), 5),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 5)]))
    return t


def allocation_bar(parts, height=14):
    """parts: [(label, share 0..1)] drawn as one stacked bar with a legend underneath."""
    d = Drawing(CONTENT_W, height + 18)
    x = 0
    total = sum(p for _, p in parts) or 1
    for i, (label, share) in enumerate(parts):
        w = CONTENT_W * share / total
        d.add(Rect(x, 18, max(w - 1, 0.5), height, fillColor=colors.HexColor(SERIES[i % len(SERIES)]), strokeColor=None))
        x += w
    lx = 0
    for i, (label, share) in enumerate(parts):
        d.add(Rect(lx, 3, 7, 7, fillColor=colors.HexColor(SERIES[i % len(SERIES)]), strokeColor=None))
        txt = f"{label} {share / total * 100:.0f}%"
        d.add(String(lx + 10, 3.5, txt, fontName="Helvetica", fontSize=7.5, fillColor=MUTED))
        lx += 16 + len(txt) * 4.1
    return d


def fan_chart(yearly, width=CONTENT_W, height=2.3 * inch):
    """Projection: shaded range (bad to good case), likely line, and money put in (dashed)."""
    pad_l, pad_b, pad_t = 46, 20, 8
    d = Drawing(width, height)
    n = len(yearly) - 1 or 1
    top = max(r["high"] for r in yearly) * 1.05
    plot_w, plot_h = width - pad_l - 6, height - pad_b - pad_t
    x = lambda i: pad_l + plot_w * i / n
    y = lambda v: pad_b + plot_h * v / top
    for k in range(5):  # grid + labels
        v = top * k / 4
        d.add(Line(pad_l, y(v), width - 6, y(v), strokeColor=LINE, strokeWidth=0.5))
        d.add(String(pad_l - 6, y(v) - 3, f"${v / 1000:,.0f}k" if top >= 10000 else f"${v:,.0f}", fontName="Helvetica",
                     fontSize=7, fillColor=MUTED, textAnchor="end"))
    pts = [(x(i), y(r["high"])) for i, r in enumerate(yearly)] + [(x(i), y(r["low"])) for i, r in reversed(list(enumerate(yearly)))]
    d.add(Polygon([c for p in pts for c in p], fillColor=colors.HexColor("#DCE5FF"), strokeColor=None))
    d.add(PolyLine([c for i, r in enumerate(yearly) for c in (x(i), y(r["contributed"]))], strokeColor=MUTED, strokeWidth=1.2, strokeDashArray=[4, 3]))
    d.add(PolyLine([c for i, r in enumerate(yearly) for c in (x(i), y(r["median"]))], strokeColor=BRAND, strokeWidth=2.2))
    step = max(1, round(n / 8))
    for i, r in enumerate(yearly):
        if i % step == 0 or i == n:
            d.add(String(x(i), 6, f"Yr {r['year']}", fontName="Helvetica", fontSize=7, fillColor=MUTED, textAnchor="middle"))
    # legend
    lx = pad_l
    for color, label, dash in [(BRAND, "Likely path", None), (colors.HexColor("#DCE5FF"), "Bad case to good case", None), (MUTED, "Money you put in", [4, 3])]:
        if label.startswith("Bad"):
            d.add(Rect(lx, height - 7, 12, 6, fillColor=color, strokeColor=None))
        else:
            d.add(Line(lx, height - 4, lx + 12, height - 4, strokeColor=color, strokeWidth=2, strokeDashArray=dash))
        d.add(String(lx + 16, height - 7, label, fontName="Helvetica", fontSize=7.5, fillColor=MUTED))
        lx += 20 + len(label) * 4.2
    return d


class Checklist(Flowable):
    """Numbered action steps with an empty box to tick, a title, detail and a 'by when'."""

    def __init__(self, steps):
        super().__init__()
        self.steps = steps
        self.paras = [(Paragraph(f"<b>{esc(t)}</b>", S["body"]), Paragraph(d, S["muted"])) for t, d, _ in steps]

    def wrap(self, aw, ah):
        self.width = aw
        self.heights = []
        for title, detail in self.paras:
            _, h1 = title.wrap(aw - 120, ah)
            _, h2 = detail.wrap(aw - 120, ah)
            self.heights.append(max(h1 + h2 + 14, 34))
        return aw, sum(self.heights)

    def draw(self):
        c = self.canv
        yy = sum(self.heights)
        for (title, detail), h, (_, _, when) in zip(self.paras, self.heights, self.steps):
            yy -= h
            c.setStrokeColor(BRAND)
            c.setLineWidth(1.1)
            c.roundRect(0, yy + h - 18, 11, 11, 2.5, stroke=1, fill=0)
            tw, th = title.wrap(self.width - 120, h)
            title.drawOn(c, 22, yy + h - 6 - th)
            dw, dh = detail.wrap(self.width - 120, h)
            detail.drawOn(c, 22, yy + h - 8 - th - dh)
            if when:
                c.setFont("Helvetica-Bold", 7.5)
                c.setFillColor(BRAND)
                c.drawRightString(self.width, yy + h - 15, when)
            c.setStrokeColor(LINE)
            c.setLineWidth(0.4)
            c.line(22, yy + 2, self.width, yy + 2)


class Grade(Flowable):
    def __init__(self, grade, score):
        super().__init__()
        self.grade, self.score = grade, score

    def wrap(self, aw, ah):
        return 54, 54

    def draw(self):
        color = {"A": GAIN, "B": BRAND, "C": AMBER}.get(self.grade, LOSS)
        c = self.canv
        c.setStrokeColor(color)
        c.setLineWidth(3)
        c.circle(27, 27, 24, stroke=1, fill=0)
        c.setFillColor(color)
        c.setFont("Helvetica-Bold", 22)
        c.drawCentredString(27, 19, self.grade)


# ---------------------------------------------------------------- report 1: action plan
def plan_pdf(p):
    """p: name, goal, years, initial, monthly, portfolio{name, description, holdings, stats}, projection{final, yearly}"""
    buf = BytesIO()
    doc = _doc(buf, "Action plan")
    port, proj = p["portfolio"], p["projection"]
    final, odds, stats = proj["final"], proj["final"]["odds"], port["stats"]
    years = p["years"]
    today = date.today()
    goal_date = today.replace(year=today.year + years) if not (today.month == 2 and today.day == 29) else today + timedelta(days=365 * years)
    growth = final["median"] - final["contributed"]
    story = []

    story += [Paragraph("Your investment action plan", S["title"]), Spacer(1, 4),
              Paragraph(f"{'Prepared for ' + esc(p['name']) + ' · ' if p.get('name') else ''}Goal: <b>{esc(p['goal'])}</b> · "
                        f"{money(p['initial'])} to start + {money(p['monthly'])} a month for {years} year{'s' if years != 1 else ''} · "
                        f"Personality: <b>{esc(port['name'])}</b>", S["sub"]), Spacer(1, 14)]
    story.append(kpi_strip([
        (f"Likely value by {goal_date:%b %Y}", money(final["median"]), "the middle of 5,000 futures", "brand"),
        ("You put in", money(final["contributed"]), "start + every monthly amount", None),
        ("From growth", ("+" if growth >= 0 else "") + money(growth), "likely case", "gain" if growth >= 0 else "loss"),
        ("Chance it beats what you put in", f"{odds['more_than_put_in'] * 100:.0f}%", f"of {odds['paths']:,} simulated futures", None),
    ]))
    story += [Spacer(1, 16), Paragraph("How your money could grow", S["h2"]),
              Paragraph("Each future is built from random real months of this portfolio's returns since 2016. "
                        "The shaded band runs from a bad case (1 future in 10) to a good case (1 in 10).", S["muted"]),
              Spacer(1, 8), fan_chart(proj["yearly"]), Spacer(1, 8)]
    story.append(data_table(
        ["Outcome after " + f"{years} years", "Value", "vs what you put in", "In today's money"],
        [["Bad case (1 in 10)", money(final["low"]), money(final["low"] - final["contributed"]), "–"],
         ["Likely", money(final["median"]), money(growth), money(final.get("median_in_todays_dollars"))],
         ["Good case (1 in 10)", money(final["high"]), money(final["high"] - final["contributed"]), "–"]],
        [CONTENT_W * 0.34, CONTENT_W * 0.2, CONTENT_W * 0.24, CONTENT_W * 0.22], align_right=(1, 2, 3)))

    # portfolio
    story += [CondPageBreak(3.5 * inch), Spacer(1, 18), Paragraph(f"Your portfolio: {esc(port['name'])}", S["h2"]),
              Paragraph(esc(port.get("description") or ""), S["muted"]), Spacer(1, 8)]
    rows = []
    for h in port["holdings"]:
        rows.append([Paragraph(f"<b>{esc(h['symbol'])}</b>", S["cell"]), esc(h.get("name") or h["symbol"]),
                     f"{h['weight'] * 100:.0f}%", money(p["initial"] * h["weight"], True), money(p["monthly"] * h["weight"], True)])
    rows.append([Paragraph("<b>Total</b>", S["cell"]), "", "100%", money(p["initial"], True), money(p["monthly"], True)])
    story.append(data_table(["Fund", "What it is", "Share", "Your start", "Each month"], rows,
                            [CONTENT_W * 0.12, CONTENT_W * 0.42, CONTENT_W * 0.12, CONTENT_W * 0.17, CONTENT_W * 0.17],
                            align_right=(2, 3, 4), bold_last=True))
    story += [Spacer(1, 8), allocation_bar([(h["symbol"], h["weight"]) for h in port["holdings"]])]

    worst = stats.get("worst_12_months")
    story += [Spacer(1, 14), KeepTogether([
        Paragraph("How this mix behaved since 2016", S["h2"]),
        data_table(["Average yearly return", "Typical yearly swing", "Worst 12 months", "Biggest drop (peak to low)"],
                   [[pct(stats.get("annual_return")), pct(stats.get("annual_volatility")), pct(worst), pct(stats.get("max_drawdown"))]],
                   [CONTENT_W / 4] * 4),
        Spacer(1, 8),
        note_box(f"<b>What a bad year could feel like:</b> if a stretch like the worst 12 months since 2016 came right after you "
                 f"started, your {money(p['initial'])} could drop to about <b>{money(p['initial'] * (1 + (worst or 0)))}</b> for a while. "
                 "Every drop so far has later recovered, but that took time. Selling in a panic is how drops become real losses.",
                 bg=AMBER_SOFT),
    ])]

    # action steps
    first = ", ".join(f"{money(p['initial'] * h['weight'])} of {h['symbol']}" for h in port["holdings"])
    targets_text = ", ".join("%s %.0f%%" % (h["symbol"], h["weight"] * 100) for h in port["holdings"])
    monthly_split = ", ".join(f"{money(p['monthly'] * h['weight'], True)} {h['symbol']}" for h in port["holdings"])
    steps = [
        ("Keep a safety net first", "Have 3 to 6 months of essential costs in a savings account before investing, so a surprise bill never forces you to sell.", "Before you start"),
        ("Open a low-cost brokerage account", "Pick one with no account fees and access to these ETFs. Under 18? Ask a parent about a custodial account. "
         "Earning income? A Roth IRA can be a tax-friendly home for this.", f"By {today + timedelta(days=14):%d %b}"),
        (f"Invest your starting {money(p['initial'])}", f"Buy {first}." if p["initial"] > 0 else "No starting amount: begin with your first monthly deposit.", f"By {today + timedelta(days=30):%d %b}"),
        (f"Automate {money(p['monthly'])} every month", f"Set an automatic deposit on payday and split it: {monthly_split}. Automating removes the temptation to time the market.", "Monthly"),
        ("Rebalance once a year", f"Check your mix each year. If any fund is 5+ percentage points away from its target ({targets_text}), "
         "sell a little of what grew and buy what fell behind.", f"By {today.replace(year=today.year + 1):%b %Y}"),
        ("Stay the course in a drop", f"Drops of {pct(abs(worst or 0), 0)} have happened in a single year. Keep your monthly deposits going: you're buying at lower prices.", "Always"),
        ("Review your plan", "Revisit your goal when your life changes (new job, bigger goal) or at least once a year. Practice changes first in Seedwise.", f"By {goal_date:%b %Y}"),
    ]
    story += [CondPageBreak(3.8 * inch), Spacer(1, 16), Paragraph("Your action plan", S["h2"]),
              Paragraph("Tick each step as you do it.", S["muted"]), Spacer(1, 8), Checklist(steps)]

    story += [Spacer(1, 16), KeepTogether([Paragraph("How these numbers were made", S["h2"]),
              Paragraph(f"Prices: daily closes from Alpaca since {port.get('history_from', '2016')}. Projection: {odds['paths']:,} simulated futures, "
                        "each built from random real months of this portfolio's returns. Assumes no fees or taxes and 2.5% yearly inflation "
                        "for \"today's money\". The strong decade since 2016 may not repeat.", S["muted"]),
              Spacer(1, 8), note_box(DISCLAIMER, bg=PAGE)])]

    doc.build(story, onFirstPage=_frame("Action plan"), onLaterPages=_frame("Action plan"))
    return buf.getvalue()


# ---------------------------------------------------------------- report 2: practice portfolio
def portfolio_pdf(r):
    """r: name, state (practice_state), doctor (run_doctor facts), plan (optional: portfolio name, goal, match result)"""
    buf = BytesIO()
    doc = _doc(buf, "Portfolio report")
    st, doctor, plan = r["state"], r.get("doctor"), r.get("plan")
    total = st["total"]
    ahead = st["total"] - st["sp500_value"] if st.get("sp500_value") is not None else None
    story = [Paragraph("Practice portfolio report", S["title"]), Spacer(1, 4),
             Paragraph(f"{'Prepared for ' + esc(r['name']) + ' · ' if r.get('name') else ''}Play money at real prices · "
                       f"Started {st['started_at'][:10]} · Prices as of {st.get('prices_as_of') or 'the latest close'}", S["sub"]), Spacer(1, 14)]
    story.append(kpi_strip([
        ("Portfolio value", money(total), f"started with {money(st.get('start_cash', 10000))}", "brand"),
        ("Gain / loss", ("+" if st["gain"] >= 0 else "") + money(st["gain"]), pct(st["gain_pct"], 2, True), "gain" if st["gain"] >= 0 else "loss"),
        ("vs the S&P 500", "–" if ahead is None or st["trade_count"] == 0 else ("+" if ahead >= 0 else "") + money(ahead),
         "if you'd bought VOO on day one" if ahead is not None else "after the next price update", "gain" if (ahead or 0) >= 0 else "loss"),
        ("Cash", money(st["cash"]), f"{st['cash'] / total * 100:.0f}% of the portfolio" if total else "", None),
    ]))

    story += [Spacer(1, 16), Paragraph("Holdings", S["h2"])]
    if st["holdings"]:
        rows = [[Paragraph(f"<b>{esc(h['symbol'])}</b>", S["cell"]), esc(h["name"]), f"{h['shares']:,.4f}", money(h["average_cost"], True),
                 money(h["price"], True), money(h["value"]),
                 Paragraph(f'<font color="{(GAIN if h["gain"] >= 0 else LOSS).hexval().replace("0x", "#")}">{("+" if h["gain"] >= 0 else "") + money(h["gain"])} ({pct(h["gain_pct"], 1, True)})</font>', S["cell"]),
                 f"{h['value'] / total * 100:.0f}%"] for h in st["holdings"]]
        rows.append([Paragraph("<b>Cash</b>", S["cell"]), "", "", "", "", money(st["cash"]), "", f"{st['cash'] / total * 100:.0f}%"])
        story.append(data_table(["Ticker", "Name", "Shares", "Avg cost", "Price", "Value", "Gain", "Share"], rows,
                                [CONTENT_W * w for w in (0.1, 0.24, 0.1, 0.1, 0.1, 0.11, 0.16, 0.09)], align_right=(2, 3, 4, 5, 6, 7)))
        story += [Spacer(1, 8), allocation_bar([(h["symbol"], h["value"] / total) for h in st["holdings"]] + [("Cash", st["cash"] / total)])]
    else:
        story.append(note_box("No investments yet. All of your play money is in cash."))

    if doctor:
        checks = [[c["name"], pill({"good": "Good", "ok": "Okay", "warn": "Watch out"}[c["status"]], c["status"]), Paragraph(esc(c["detail"]), S["cell"])]
                  for c in doctor["checks"]]
        head = Table([[Grade(doctor["grade"], doctor["score"]),
                       [Paragraph("Portfolio Doctor", S["h2"]),
                        Paragraph(f"Health score <b>{doctor['score']}/100</b> · fixed rules, not AI, so the same portfolio always gets the same grade.", S["muted"])]]],
                     colWidths=[62, CONTENT_W - 62])
        head.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
        story += [Spacer(1, 16), KeepTogether([head, Spacer(1, 6),
                  data_table(["Check", "Result", "What we found"], checks, [CONTENT_W * 0.2, CONTENT_W * 0.15, CONTENT_W * 0.65])])]
        hist = doctor.get("history_since_2016")
        if hist:
            story += [Spacer(1, 8), note_box(f"<b>If you'd held this mix since 2016:</b> about {pct(hist.get('annual_return'))} a year on average; "
                                             f"its worst 12 months were {pct(hist.get('worst_12_months'))}.", bg=PAGE)]

    if plan and plan.get("match"):
        m = plan["match"]
        rows = [[Paragraph(f"<b>{esc(x['symbol'])}</b>", S["cell"]), f"{x['target'] * 100:.0f}%", f"{x['now'] * 100:.0f}%",
                 Paragraph(f'<font color="{(LOSS if abs(x["now"] - x["target"]) >= 0.05 else MUTED).hexval().replace("0x", "#")}">{(x["now"] - x["target"]) * 100:+.0f} pts</font>', S["cell"])]
                for x in m["rows"]]
        block = [Paragraph(f"Following your plan: {esc(plan.get('portfolio') or '')}{' · ' + esc(plan['goal']) if plan.get('goal') else ''}", S["h2"]),
                 data_table(["Fund", "Plan target", "Now", "Difference"], rows, [CONTENT_W * 0.25] * 4, align_right=(1, 2, 3))]
        if m.get("drifted") and m.get("trades"):
            trades = "; ".join(f"{t['side']} {money(t['dollars'])} of {t['symbol']}" for t in m["trades"])
            block += [Spacer(1, 8), note_box(f"<b>You've drifted {m['drift'] * 100:.0f} points from your plan.</b> To rebalance at today's prices: {esc(trades)}.", bg=AMBER_SOFT)]
        else:
            block += [Spacer(1, 8), note_box("<b>On track.</b> Every fund is within 5 points of your plan's target.", bg=GAIN_SOFT)]
        story += [CondPageBreak(2.5 * inch), Spacer(1, 16), KeepTogether(block)]

    # next steps from the facts above
    steps = []
    if st["cash"] > total * 0.25 and total:
        steps.append(("Put your cash to work", f"{money(st['cash'])} ({st['cash'] / total * 100:.0f}%) is uninvested. Cash doesn't grow; consider investing it in your plan's mix.", "This week"))
    if plan and (plan.get("match") or {}).get("drifted"):
        steps.append(("Rebalance to your plan", "Use Practice → Rebalance to see and place the exact trades listed above.", "This week"))
    for c in (doctor or {}).get("checks", []):
        if c["status"] == "warn" and len(steps) < 4:
            steps.append((f"Fix: {c['name'].lower()}", esc(c["detail"]), "Next trade"))
    if not plan:
        steps.append(("Follow a plan", "Build a plan in Seedwise and use \"Practice this plan\" so your mix has a target to stay close to.", ""))
    steps.append(("Check in monthly", "Compare yourself with the S&amp;P 500 and re-run the Portfolio Doctor after big trades.", "Monthly"))
    story += [CondPageBreak(2.5 * inch), Spacer(1, 16), Paragraph("Next steps", S["h2"]), Spacer(1, 4), Checklist(steps[:5]),
              Spacer(1, 14), note_box("This is a <b>practice</b> portfolio: it uses play money, not real money. " + DISCLAIMER, bg=PAGE)]

    doc.build(story, onFirstPage=_frame("Portfolio report"), onLaterPages=_frame("Portfolio report"))
    return buf.getvalue()
