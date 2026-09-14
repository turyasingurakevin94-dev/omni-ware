#!/usr/bin/env python3
"""Rebuild the four artboards of the charges-row canvas.

    python3 build.py
    node <design skill>/seed-canvas.mjs --template <...>/payload.template.html \
      --out charges-on-the-quote.html --title "Charges on the quote" \
      --artboard Main.dc.html --artboard Before.dc.html \
      --artboard Percent.dc.html --artboard Phone.dc.html --canvas canvas.json

_base.css is the shared half: it is read out of index.html rather than
drawn to taste, so this canvas and the app cannot drift. Every rule in it
names the line it came from. The artboards below add only what each one
is arguing about.
"""
import pathlib

base = pathlib.Path('_base.css').read_text()


def build(name, extra_css, body):
    html = f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
  <style>
{base}
{extra_css}
  </style>
</helmet>
{body}
</x-dc>
</body>
</html>
"""
    pathlib.Path(name).write_text(html)
    print(f"wrote {name} ({len(html)} bytes)")



ICON_SEARCH = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'
ICON_PLUS   = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
ICON_X      = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'
ICON_RESET  = '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>'

CHARGE_CSS = """
  /* ---- THE CHANGE ---------------------------------------------------
     A CHARGE IS A ROW OF THE DOCUMENT, not a panel beside it. It rides
     the same eight tracks as every other row, so its figure lands in
     the line-total column, under the figures it is added to -- which is
     the law the foot already keeps and the block below the table could
     not.

     What marks it as NOT A GOOD is what it has not got: no number in
     the gutter, no quantity, no supplier, no margin. Three empty cells
     and a quieter name say it without a tint band, a badge, or a second
     state colour -- and the shop-side rule runs through it unbroken, so
     the document still reads as one document. */
  .q-charge .ow-tbl-p{font-weight:500;}

  /* The unit slot an item uses for "Ctn" carries the one word that
     names what this row is. Same slot, same 12px ink-600: a marker that
     costs no new chrome. */

  /* The add row, on the pattern of "Add the next item" directly above
     it -- dashed gutter mark, the line itself across the client's
     columns. The services the shop has named are the taps; their usual
     amounts ride with them, because "Delivery" and "Delivery 60,000"
     are different amounts of help at the counter. */
  .q-chg-sug{display:inline-flex;align-items:center;gap:5px;margin-left:6px;
    padding:2px 8px;border:1px solid var(--ow-rule-soft);border-radius:999px;
    font-size:12px;color:var(--ink);background:#fff;vertical-align:middle;}
  .q-chg-sug b{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;
    letter-spacing:-.02em;font-weight:600;color:var(--ink-soft);}
  .q-chg-sug-more{color:var(--ink-soft);border-style:dashed;}
  .q-pct{font-size:11px;color:var(--ow-ink-600);margin-left:3px;}
"""

def head(cols=("", "Item", "Qty", "Price each", "Line total", "Supplier", "Buy @", "Margin")):
    c = cols
    return f"""      <div class="ow-tbl-h">
        <div class="ow-tbl-c"></div>
        <div class="ow-tbl-c">{c[1]}</div>
        <div class="ow-tbl-n">{c[2]}</div>
        <div class="ow-tbl-n">{c[3]}</div>
        <div class="ow-tbl-n">{c[4]}</div>
        <div class="ow-tbl-c q-shop-first">{c[5]}</div>
        <div class="ow-tbl-n">{c[6]}</div>
        <div class="ow-tbl-n">{c[7]}</div>
      </div>"""

def item_row(n, name, unit, qty, qunit, each, total, supp, buy, margin, mcls="warn"):
    return f"""      <div class="ow-tbl-r">
        <div class="ow-tbl-c q-gutter"><span class="q-row-num">{n}</span></div>
        <div class="ow-tbl-c"><span class="ow-tbl-p">{name}</span><span class="ow-tbl-s">{unit}</span></div>
        <div class="ow-tbl-n"><div style="display:flex;align-items:center;gap:3px;justify-content:flex-end;">
          <input class="ow-gi" value="{qty}" style="width:40px;"><span style="font-size:11px;color:var(--ow-ink-600);">{qunit}</span></div></div>
        <div class="ow-tbl-n"><div style="display:flex;align-items:center;gap:2px;justify-content:flex-end;">
          <input class="ow-gi" value="{each}"><span style="color:var(--ink-soft);display:flex;">{ICON_RESET}</span></div></div>
        <div class="ow-tbl-n"><span class="ow-fig">{total} <span class="ow-fig-u">UGX</span></span></div>
        <div class="ow-tbl-c q-shop-first"><span class="q-supp">{supp}</span></div>
        <div class="ow-tbl-n"><input class="ow-gi" value="{buy}"></div>
        <div class="ow-tbl-n"><span class="q-margin-pill {mcls}">{margin}</span></div>
      </div>"""

def charge_row(name, value, total, hovered=False, pct=False):
    gut = f'<span class="q-remove">{ICON_X}</span>' if hovered else ""
    gi = "ow-gi is-hover" if hovered else "ow-gi"
    sub = "Charge &middot; % of items" if pct else "Charge"
    pctmark = '<span class="q-pct">%</span>' if pct else ""
    bg = ' style="background:var(--ow-paper-2);"' if hovered else ""
    return f"""      <div class="ow-tbl-r q-charge"{bg}>
        <div class="ow-tbl-c q-gutter">{gut}</div>
        <div class="ow-tbl-c"><span class="ow-tbl-p">{name}</span><span class="ow-tbl-s">{sub}</span></div>
        <div class="ow-tbl-n"></div>
        <div class="ow-tbl-n"><div style="display:flex;align-items:center;gap:2px;justify-content:flex-end;">
          <input class="{gi}" value="{value}">{pctmark}</div></div>
        <div class="ow-tbl-n"><span class="ow-fig">{total} <span class="ow-fig-u">UGX</span></span></div>
        <div class="ow-tbl-c q-shop-first"></div>
        <div class="ow-tbl-n"></div>
        <div class="ow-tbl-n"></div>
      </div>"""

ADD_ITEM = f"""      <div class="ow-tbl-r" style="min-height:38px;">
        <div class="ow-tbl-c q-gutter"><span class="q-add-icon">{ICON_PLUS}</span></div>
        <div class="q-add-row-placeholder">Add the next item &mdash; or type in the search above</div>
      </div>"""

ADD_CHARGE = f"""      <div class="ow-tbl-r" style="min-height:38px;">
        <div class="ow-tbl-c q-gutter"><span class="q-add-icon">{ICON_PLUS}</span></div>
        <div class="q-add-row-placeholder">Add a charge
          <span class="q-chg-sug">Transport <b>5,000</b></span>
          <span class="q-chg-sug">Delivery <b>60,000</b></span>
          <span class="q-chg-sug">Urgent <b>5%</b></span>
          <span class="q-chg-sug q-chg-sug-more">Something else</span>
        </div>
      </div>"""

def foot(pays, costs, keep, keep_label="You keep on the items"):
    return f"""      <div class="ow-tbl-f q-foot q-foot-pays">
        <div class="q-foot-l">The client pays</div>
        <div class="ow-tbl-n q-foot-v"><span class="ow-fig">{pays} <span class="ow-fig-u">UGX</span></span></div>
        <div class="q-foot-x q-shop-first"></div>
      </div>
      <div class="ow-tbl-f q-foot q-foot-cost">
        <div class="q-foot-l">Costs you</div>
        <div class="ow-tbl-n q-foot-v"><span class="ow-fig" style="color:var(--ink-soft);font-weight:500;">{costs} <span class="ow-fig-u">UGX</span></span></div>
        <div class="q-foot-x q-shop-first"></div>
      </div>
      <div class="ow-tbl-f q-foot q-foot-keep">
        <div class="q-foot-l">{keep_label}</div>
        <div class="ow-tbl-n q-foot-v"><span class="ow-fig">{keep} <span class="ow-fig-u">UGX</span></span></div>
        <div class="q-foot-x q-shop-first"></div>
      </div>"""

SEARCH = f'<div class="q-search">{ICON_SEARCH}<span>Add item &mdash; search name, SKU or supplier code&hellip;</span></div>'

# ---------------- Main ----------------
main_body = f"""<div class="page">
  <div class="panel">
    {SEARCH}
    <div class="ow-tbl">
{head()}
{item_row(1, "Normal Mulper &mdash; Flat", "Ctn", "1", "Ctn", "155000", "155,000", "Our stock (2)", "145000", "6%")}
{charge_row("Transport", "5000", "5,000")}
{charge_row("Delivery &mdash; Kyaliwajjala", "60000", "60,000", hovered=True)}
{ADD_ITEM}
{ADD_CHARGE}
{foot("220,000", "145,000", "10,000")}
    </div>
  </div>
</div>"""
build("Main.dc.html", CHARGE_CSS, main_body)

# ---------------- Percent ----------------
pct_body = f"""<div class="page">
  <div class="panel">
    <div class="ow-tbl">
{head()}
{item_row(1, "Iron Sheets &mdash; G28 3m box", "Sheet", "20", "Sheet", "67500", "1,350,000", "Mulongo Hardware", "52000", "23%", mcls="")}
{charge_row("Urgent &mdash; same day", "5", "67,500", pct=True)}
{ADD_CHARGE}
{foot("1,417,500", "1,040,000", "310,000")}
    </div>
  </div>
</div>"""
build("Percent.dc.html", CHARGE_CSS, pct_body)


# ================= BEFORE — what ships today =================
BEFORE_CSS = """
  /* What ships today, redrawn from the owner's screenshot. Three things
     are wrong and all three are measurable.

     1. THE MONEY DOES NOT LINE UP. This block sits outside the table's
        grid, so 5,000 UGX lands ~280px right of the 155,000 UGX it is
        added to. A column of money that does not line up is the one
        thing this design system says is unreadable at a glance -- and
        it is the only way money is ever read.
     2. THE INPUT IS THE HEAVIEST OBJECT ON THE SCREEN. A permanently
        boxed control with its own padding and a native stepper, so a
        5,000 shilling fee out-weighs a 155,000 shilling line.
     3. IT READS AS A PANEL, NOT A ROW. A full-width rule, a heading, a
        sentence, ~900px between the name and its money, and a detached
        chip row -- while the shop-side divider that runs the length of
        the document stops dead above it. */
  .q-chg{margin-top:16px;padding-top:12px;border-top:1px solid var(--ow-rule);}
  .q-chg-h{display:flex;align-items:baseline;gap:8px;margin-bottom:8px;padding:0 12px;}
  .q-chg-t{font-size:12px;font-weight:600;color:var(--ink);}
  .q-chg-s{flex:1;min-width:0;font-size:11px;color:var(--ink-soft);}
  .q-chg-r{display:flex;align-items:center;gap:10px;padding:6px 12px;
    border-bottom:1px solid var(--ow-rule-soft);}
  .q-chg-n{flex:1;min-width:0;font-size:13px;color:var(--ink);}
  .q-chg-v{flex:none;width:110px;padding:6px 8px;border:1px solid var(--ow-steel-950);
    border-radius:6px;font-size:12px;font-family:'IBM Plex Mono',monospace;
    font-variant-numeric:tabular-nums;letter-spacing:-.02em;text-align:right;background:#fff;
    display:flex;align-items:center;justify-content:flex-end;gap:6px;}
  .q-chg-step{display:flex;flex-direction:column;gap:1px;color:var(--ow-ink-400);}
  .q-chg-step svg{width:9px;height:6px;fill:none;stroke:currentColor;stroke-width:2;}
  .q-chg-a{flex:none;min-width:104px;text-align:right;font-size:13px;
    font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;
    letter-spacing:-.02em;color:var(--ink);}
  .q-chg-x{width:26px;height:26px;display:flex;align-items:center;justify-content:center;
    color:var(--ow-ink-400);}
  .q-chg-x svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;}
  .q-chg-add{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;padding:0 12px 12px;}
  .q-chg-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;
    border:1px solid var(--line);border-radius:999px;font-size:12px;color:var(--ink);background:#fff;}
  .q-chg-chip b{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;
    letter-spacing:-.02em;font-weight:600;color:var(--ink-soft);}
  /* The two foot rows that restate what the rows already say. */
"""

CARET = '<svg viewBox="0 0 12 8"><path d="M2 6l4-4 4 4"/></svg>'
CARET_D = '<svg viewBox="0 0 12 8"><path d="M2 2l4 4 4-4"/></svg>'

before_body = f"""<div class="page">
  <div class="panel">
    {SEARCH}
    <div class="ow-tbl">
{head()}
{item_row(1, "Normal Mulper &mdash; Flat", "Ctn", "1", "Ctn", "155000", "155,000", "Our stock (2)", "145000", "6%")}
{ADD_ITEM}
      <div class="ow-tbl-f q-foot q-foot-cost">
        <div class="q-foot-l">Items</div>
        <div class="ow-tbl-n q-foot-v"><span class="ow-fig">155,000 <span class="ow-fig-u">UGX</span></span></div>
        <div class="q-foot-x q-shop-first"></div>
      </div>
      <div class="ow-tbl-f q-foot q-foot-cost">
        <div class="q-foot-l">Charges</div>
        <div class="ow-tbl-n q-foot-v"><span class="ow-fig">5,000 <span class="ow-fig-u">UGX</span></span></div>
        <div class="q-foot-x q-shop-first"></div>
      </div>
{foot("160,000", "145,000", "10,000")}
    </div>
    <div class="q-chg">
      <div class="q-chg-h">
        <span class="q-chg-t">Charges</span>
        <span class="q-chg-s">What you are charging besides the goods. A percent is worked out from the items above.</span>
      </div>
      <div class="q-chg-r">
        <span class="q-chg-n">Transport</span>
        <span class="q-chg-v">5000 <span class="q-chg-step">{CARET}{CARET_D}</span></span>
        <span class="q-chg-a">5,000 UGX</span>
        <span class="q-chg-x">{ICON_X}</span>
      </div>
      <div class="q-chg-add">
        <span class="q-chg-chip">Transport <b>5,000 UGX</b></span>
        <span class="q-chg-chip">+ Something else</span>
      </div>
    </div>
  </div>
</div>"""
build("Before.dc.html", BEFORE_CSS, before_body)

# ================= PHONE =================
PHONE_CSS = """
  /* 820 is a SWITCH, not a reflow. The phone gets 15px body, 14-16px
     row padding and thumb-sized controls -- and a charge is a CARD like
     an item card, minus the two facts it has not got. The same "what it
     hasn't got" marker as the console, in the phone's own grammar. */
  body{font-size:15px;background:#E9EBED;}
  .ph-page{padding:0;}
  .ph-card{background:#fff;border-top:1px solid var(--ow-rule-soft);padding:14px 16px;}
  .ph-head{display:flex;align-items:flex-start;gap:10px;}
  .ph-num{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--ink-soft);
    min-width:14px;padding-top:2px;}
  .ph-nm{flex:1;min-width:0;}
  .ph-name{font-size:15px;font-weight:600;color:var(--ink);
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .ph-charge .ph-name{font-weight:500;}
  .ph-sub{font-size:12px;color:var(--ow-ink-600);margin-top:1px;}
  .ph-x{width:var(--ow-tap);height:var(--ow-tap);margin:-10px -10px -10px 0;
    display:flex;align-items:center;justify-content:center;color:var(--ow-ink-400);flex:none;}
  .ph-x svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;}
  .ph-rows{margin-top:10px;display:flex;flex-direction:column;gap:9px;}
  .ph-row{display:flex;align-items:center;justify-content:space-between;gap:12px;}
  .ph-l{font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--ow-ink-600);}
  .ph-v{font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;
    font-size:14px;font-weight:600;letter-spacing:-.02em;color:var(--ink);white-space:nowrap;}
  .ph-gi{border:1px solid var(--ow-steel-100);border-radius:4px;background:#fff;padding:6px 8px;
    font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;
    font-size:14px;font-weight:500;letter-spacing:-.02em;text-align:right;min-width:96px;}
  .ph-add{background:#fff;border-top:1px solid var(--ow-rule-soft);padding:0 16px 14px;}
  .ph-add-row{display:flex;align-items:center;gap:10px;height:var(--ow-tap);
    color:var(--ink-soft);font-size:14px;}
  .ph-chips{display:flex;flex-wrap:wrap;gap:8px;}
  .ph-chip{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 14px;
    border:1px solid var(--ow-rule-soft);border-radius:999px;font-size:13px;color:var(--ink);background:#fff;}
  .ph-chip b{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;
    letter-spacing:-.02em;font-weight:600;color:var(--ink-soft);}
  .ph-chip-more{color:var(--ink-soft);border-style:dashed;}
  .ph-foot{background:#fff;padding:12px 16px 16px;border-top:1px solid var(--ow-rule);}
  .ph-foot-r{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:3px 0;}
  .ph-foot-l{font-size:14px;color:var(--ink-soft);}
  .ph-foot-pays .ph-foot-l{font-weight:600;color:var(--ink);}
  .ph-foot-v{font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;
    font-weight:600;letter-spacing:-.02em;font-size:15px;color:var(--ink);white-space:nowrap;}
  .ph-foot-pays .ph-foot-v{font-size:19px;}
  .ph-foot-cost .ph-foot-v{color:var(--ink-soft);font-weight:500;}
"""

def ph_row(label, value, gi=False):
    v = f'<span class="ph-gi">{value}</span>' if gi else f'<span class="ph-v">{value}</span>'
    return f'<div class="ph-row"><span class="ph-l">{label}</span>{v}</div>'

phone_body = f"""<div class="ph-page">
  <div class="ph-card">
    <div class="ph-head"><span class="ph-num">1</span>
      <span class="ph-nm"><div class="ph-name">Normal Mulper &mdash; Flat</div><div class="ph-sub">Ctn</div></span>
      <span class="ph-x">{ICON_X}</span></div>
    <div class="ph-rows">
      {ph_row("QTY", "1 &nbsp;Ctn", gi=True)}
      {ph_row("PRICE EACH", "155000", gi=True)}
      {ph_row("LINE TOTAL", "155,000 UGX")}
      {ph_row("SUPPLIER", "Our stock (2)")}
    </div>
  </div>

  <div class="ph-card ph-charge">
    <div class="ph-head"><span class="ph-num"></span>
      <span class="ph-nm"><div class="ph-name">Transport</div><div class="ph-sub">Charge</div></span>
      <span class="ph-x">{ICON_X}</span></div>
    <div class="ph-rows">
      {ph_row("AMOUNT", "5000", gi=True)}
    </div>
  </div>

  <div class="ph-card ph-charge">
    <div class="ph-head"><span class="ph-num"></span>
      <span class="ph-nm"><div class="ph-name">Urgent &mdash; same day</div><div class="ph-sub">Charge &middot; % of items</div></span>
      <span class="ph-x">{ICON_X}</span></div>
    <div class="ph-rows">
      {ph_row("RATE", "5 &nbsp;%", gi=True)}
      {ph_row("COMES TO", "7,750 UGX")}
    </div>
  </div>

  <div class="ph-add">
    <div class="ph-add-row"><span class="q-add-icon">{ICON_PLUS}</span><span>Add a charge</span></div>
    <div class="ph-chips">
      <span class="ph-chip">Transport <b>5,000</b></span>
      <span class="ph-chip">Delivery <b>60,000</b></span>
      <span class="ph-chip">Urgent <b>5%</b></span>
      <span class="ph-chip ph-chip-more">Something else</span>
    </div>
  </div>

  <div class="ph-foot">
    <div class="ph-foot-r ph-foot-pays"><span class="ph-foot-l">The client pays</span><span class="ph-foot-v">167,750 UGX</span></div>
    <div class="ph-foot-r ph-foot-cost"><span class="ph-foot-l">Costs you</span><span class="ph-foot-v">145,000 UGX</span></div>
    <div class="ph-foot-r"><span class="ph-foot-l">You keep on the items</span><span class="ph-foot-v">10,000 UGX</span></div>
  </div>
</div>"""
build("Phone.dc.html", PHONE_CSS, phone_body)
