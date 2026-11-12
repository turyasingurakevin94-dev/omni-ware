#!/usr/bin/env python3
# Generates docs/canvas/manager/DecideOrders.dc.html (literal markup).
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sheet as SH  # the ONE decision sheet

M = "font-family: 'IBM Plex Mono', monospace"
NAVY, INK, SOFT, FAINT, LINE, TILE, BG = "#16203C", "#1C2233", "#5F6980", "#6B7480", "#E6E3DD", "#F1EEE8", "#F7F5F2"
RED, REDD, REDS = "#C93A30", "#A82D24", "#FDE8E4"
GOOD, GOODBG, WARN, WARNBG, WARNINK, BAD, BADBG = "#0F6B43", "#E4F4EA", "#95530C", "#FDEEE1", "#7A4A02", "#8E2A22", "#FBE5E2"
ONNAVY, MINT = "#B3BCD2", "#6FDCB0"

PEOPLE = {
    "RN": ("#16203C", "#FFFFFF"), "GA": ("#DCEAF8", "#1A5A8A"), "BO": ("#DDF1EE", "#0E5E57"),
    "DO": ("#E4E6FA", "#3A3F9B"), "MK": ("#E4F4EA", "#0F6B43"), "EA": ("#E8EBF0", "#3D4A5C"),
    "PS": ("#F1EEE8", "#1C2233"), "KC": ("#F1EEE8", "#1C2233"), "JN": ("#FDEEE1", "#7A4A02"),
}

P = {
    "x": '<path d="M6 6l12 12M18 6L6 18"/>',
    "chev": '<path d="M9 6l6 6-6 6"/>',
    "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    "tick": '<path d="M5 12l5 5 9-10"/>',
    "undo": '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    "alert": '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
    "nosig": '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.8"/><path d="M19 12.9a10 10 0 0 0-2.3-1.6"/><path d="M12 20h.01"/>',
    "retry": '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    "box": '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
    "sheet": '<path d="M3 8l3-3 3 3 3-3 3 3 3-3 3 3v10H3z"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "quote": '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    "return": '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    "doc": '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
    "gift": '<path d="M4 11h16v10H4z"/><path d="M3 7h18v4H3z"/><path d="M12 7v14"/><path d="M12 7a3 3 0 1 1 3-3c0 2-3 3-3 3zM12 7a3 3 0 1 0-3-3c0 2 3 3 3 3z"/>',
    "minus": '<path d="M5 12h14"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "cash": '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    "wallet": '<path d="M4 7h15a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4z"/><path d="M4 7l11-3v3"/><path d="M16 13h.01"/>',
    "truck": '<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    "shelf": '<path d="M4 4v16M20 4v16M4 9h16M4 15h16"/>',
    "crack": '<path d="M4 4h16v16H4z"/><path d="M10 4l2 5-3 3 3 4-1 4"/>',
    "skip": '<path d="M6 6l6 6-6 6"/><path d="M13 6l6 6-6 6"/>',
}


def ic(name, s=20, sw=2, extra=""):
    return (f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"{extra}>{P[name]}</svg>')


def av(ini, size=40, fs=14, ring=False):
    bg, fg = PEOPLE[ini]
    sh = "; box-shadow: 0 0 0 2px #fff, 0 0 0 4px " + fg if ring else ""
    return (f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex: none; border-radius: 999px; background: {bg}; '
            f'color: {fg}; font-size: {fs}px; font-weight: 800; display: flex; align-items: center; justify-content: center{sh}">{ini}</span>')


def from_chip(ini, name, no):
    bg, fg = PEOPLE[ini]
    return (f'<span aria-label="From {name}, order {no[1:]}" style="display: inline-flex; align-items: center; gap: 5px; height: 24px; '
            f'padding: 0 8px 0 3px; border-radius: 999px; background: {TILE}; font-size: 12px; font-weight: 700; color: {INK}">'
            f'<i aria-hidden="true" style="width: 18px; height: 18px; border-radius: 999px; background: {bg}; color: {fg}; font-style: normal; '
            f'font-size: 9px; font-weight: 800; display: flex; align-items: center; justify-content: center"></i>'
            f'From {name} · <span style="{M}; font-size: 11px; font-weight: 600">{no}</span></span>')


def ugx(v, size=22, col="#fff", ucol=ONNAVY):
    return (f'<span style="{M}; font-size: {size}px; font-weight: 600; letter-spacing: -.03em; color: {col}; white-space: nowrap">'
            f'<span style="font-size: 11px; color: {ucol}; letter-spacing: 0">UGX </span>{v}</span>')


# ------------------------------------------------------------ sheet parts
def sheet_head(pos, total, label="Decide next", offline=False):
    segs = "".join(
        f'<i style="flex: 1; height: 4px; border-radius: 9px; background: {GOOD if i < pos - 1 else (NAVY if i == pos - 1 else "#DDD9D1")}"></i>'
        for i in range(total))
    off = ""
    if offline:
        off = (f'<div style="display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border-radius: 12px; background: {WARNBG}; '
               f'color: {WARNINK}; font-size: 13px; font-weight: 700">{ic("nosig", 16)}No signal · <span style="{M}">1</span>&#160;answer waits to send</div>')
    return f'''<div style="padding: 14px 16px 0; display: flex; flex-direction: column; gap: 10px">
          <div style="display: flex; align-items: center; gap: 10px">
            <button aria-label="Close" style="width: 44px; height: 44px; flex: none; border-radius: 999px; border: none; background: #fff; box-shadow: inset 0 0 0 1px {LINE}; color: {INK}; display: flex; align-items: center; justify-content: center; padding: 0">{ic("x", 20)}</button>
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px"><span style="font-size: 15px; font-weight: 700">{label}</span><span style="{M}; font-size: 11px; color: {SOFT}">{pos} of {total} · oldest first</span></div>
            <button aria-label="Next decision" style="width: 44px; height: 44px; flex: none; border-radius: 999px; border: none; background: #fff; box-shadow: inset 0 0 0 1px {LINE}; color: {INK}; display: flex; align-items: center; justify-content: center; padding: 0">{ic("skip", 20)}</button>
          </div>
          <div style="display: flex; gap: 4px; padding: 0 2px">{segs}</div>{off}
        </div>'''


def asker(ini, who, ask, no, sub, age, quote=None, age_col="warn"):
    bgc, fgc = (WARNBG, WARNINK) if age_col == "warn" else (BADBG, BAD)
    q = ""
    if quote:
        q = (f'<div style="display: flex; align-items: flex-start; gap: 8px; padding: 9px 12px; border-radius: 12px; background: {TILE}; font-size: 14px; font-weight: 600">'
             f'<span style="color: {SOFT}; margin-top: 1px">{ic("quote", 16)}</span><span>“{quote}”</span></div>')
    return f'''<div style="background: #fff; border-radius: 16px; box-shadow: inset 0 0 0 1px {LINE}; padding: 12px; display: flex; flex-direction: column; gap: 10px">
            <div style="display: flex; align-items: center; gap: 10px">
              {av(ini, 42, 14)}
              <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px">
                <span style="font-size: 16px; font-weight: 700; line-height: 20px">{who} · {ask}</span>
                <span style="{M}; font-size: 11px; color: {FAINT}; white-space: nowrap">{no} · {sub.split(" · ",1)[0]}</span>
                <span style="{M}; font-size: 11px; color: {FAINT}; white-space: nowrap">{sub.split(" · ",1)[1]}</span>
              </div>
              <span style="flex: none; height: 26px; padding: 0 9px; border-radius: 999px; background: {bgc}; color: {fgc}; {M}; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 4px">{ic("clock", 13)}{age}</span>
            </div>{q}
          </div>'''


def seg(opts, on, light=False):
    track = "rgba(255,255,255,.08)" if not light else TILE
    out = []
    for i, (icon, word) in enumerate(opts):
        if i == on:
            st = f"background: #fff; color: {NAVY}; box-shadow: 0 1px 3px rgba(22,32,60,.25)"
        else:
            st = f"background: transparent; color: {ONNAVY if not light else SOFT}"
        out.append(f'<button role="radio" aria-checked="{"true" if i == on else "false"}" style="flex: 1; height: 40px; border: none; border-radius: 999px; {st}; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 6px; white-space: nowrap">{ic(icon, 16)}{word}</button>')
    return f'<div role="radiogroup" style="display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: {track}">{"".join(out)}</div>'


def red_button(label, state="default", aria=None):
    # The dock rule (all boards): a reversible answer is a WHITE pill with navy text; only a slide knob is red.
    bg, tr, extra = "#FFFFFF", "", ""
    content = (f'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
               f'<path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{label}')
    if state == "pressed":
        bg, tr = "#E4E8F2", "transform: scale(.97); box-shadow: 0 0 0 3px rgba(255,255,255,.22);"
    if state == "sending":
        content = (f'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">'
                   f'<path d="M21 12a9 9 0 1 1-6.2-8.6" /></svg>{label}')
        extra = ' aria-busy="true" disabled'
    return (f'<button{extra} aria-label="{aria or label}" style="height: 56px; width: 100%; border: none; border-radius: 999px; background: {bg}; color: {NAVY}; '
            f'font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; {tr}">{content}</button>')


def slide(label, aria, disabled=False):
    knob = "#5A637C" if disabled else RED
    col = ONNAVY if disabled else "#fff"
    return f'''<div style="position: relative; height: 60px; box-sizing: border-box; border-radius: 999px; background: rgba(255,255,255,.08); display: flex; align-items: center; padding: 5px">
            <span style="position: absolute; left: 0; right: 0; text-align: center; font-size: 16px; font-weight: 700; color: {col}; padding: 0 56px 0 64px; white-space: nowrap">{label}</span>
            <button aria-label="{aria}"{' aria-disabled="true"' if disabled else ''} style="position: relative; z-index: 1; width: 50px; height: 50px; border-radius: 999px; background: {knob}; border: none; color: #fff; display: flex; align-items: center; justify-content: center; padding: 0">{ic("skip", 22)}</button>
          </div>'''


def keep_pill(word):
    return (f'<button style="flex: none; height: 44px; padding: 0 16px; border-radius: 999px; border: none; background: transparent; '
            f'box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.35); color: #fff; font-size: 13px; font-weight: 700">{word}</button>')


def told(names, word):
    return (f'<span style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: {ONNAVY}">'
            f'{ic("bell", 14)}<span>{names} {"see" if "·" in names else "sees"}: <b style="color: #fff">{word}</b></span></span>')


def dock(top_l, top_r, mid, action, foot, radius="26px 26px 0 0", absolute=True):
    pos = "position: absolute; left: 0; right: 0; bottom: 0;" if absolute else ""
    top = f'<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">{top_l}{top_r}</div>' if (top_l or top_r) else ""
    footd = f'<div style="display: flex; align-items: center; gap: 10px; min-height: 20px">{foot}</div>' if foot else ""
    return f'''<div style="{pos} background: {NAVY}; border-radius: {radius}; padding: 14px 16px 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 -8px 24px rgba(22,32,60,.18); color: #fff">
          {top}{mid}
          {action}
          {footd}
        </div>'''


def dock_label(over, word):
    return (f'<span style="display: flex; flex-direction: column; gap: 1px; min-width: 0"><span style="font-size: 11px; font-weight: 600; letter-spacing: .06em; '
            f'text-transform: uppercase; color: {ONNAVY}">{over}</span><span style="font-size: 15px; font-weight: 700; white-space: nowrap">{word}</span></span>')


def dock_total(v, sub, subcol=MINT):
    return (f'<span style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px">{ugx(v)}'
            f'<span style="{M}; font-size: 12px; font-weight: 600; color: {subcol}; white-space: nowrap">{sub}</span></span>')


def phone(num, label, time, body, taps, h=780):
    return f'''<div style="display: flex; flex-direction: column; gap: 8px; width: 360px">
      <div style="font-size: 11px; font-weight: 700; letter-spacing: .08em; color: {SOFT}; white-space: nowrap">{num} · {label} · <span style="{M}">{time}</span></div>
      <div style="position: relative; width: 360px; height: {h}px; box-sizing: border-box; border-radius: 32px; border: 1px solid {LINE}; overflow: hidden; background: {BG}">
        {body}
      </div>
      <div style="{M}; font-size: 12px; color: {SOFT}; line-height: 17px">{taps}</div>
    </div>'''


def card(children, pad=12, gap=10, extra=""):
    return (f'<div style="background: #fff; border-radius: 16px; box-shadow: inset 0 0 0 1px {LINE}; padding: {pad}px; display: flex; '
            f'flex-direction: column; gap: {gap}px; {extra}">{children}</div>')


def item_head(icon, name, right, tile=TILE, tcol=INK):
    return (f'<div style="display: flex; align-items: center; gap: 10px"><span style="width: 38px; height: 38px; flex: none; border-radius: 12px; background: {tile}; color: {tcol}; '
            f'display: flex; align-items: center; justify-content: center">{ic(icon, 20)}</span><span style="flex: 1; font-size: 15px; font-weight: 700">{name}</span>'
            f'<span style="{M}; font-size: 12px; font-weight: 600; color: {SOFT}; white-space: nowrap">{right}</span></div>')


# ------------------------------------------------------------ D-12 short pick
def grid40(filled=36, total=40):
    cells = []
    for i in range(total):
        if i < filled:
            cells.append(f'<i style="height: 12px; border-radius: 3px; background: {NAVY}"></i>')
        else:
            cells.append(f'<i style="height: 12px; box-sizing: border-box; border-radius: 3px; border: 1.5px dashed {BAD}"></i>')
    return f'<div aria-label="36 of 40 sheets packed" style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px">{"".join(cells)}</div>'


def bar_row(label, v, pct, col, note, bold=False):
    return (f'<div style="display: flex; flex-direction: column; gap: 5px"><div style="display: flex; justify-content: space-between; align-items: baseline">'
            f'<span style="font-size: 13px; font-weight: {"700" if bold else "600"}; color: {INK if bold else SOFT}">{label} <span style="{M}; font-size: 11px; color: {FAINT}">{note}</span></span>'
            f'<span style="{M}; font-size: 15px; font-weight: 600; color: {INK if bold else SOFT}">{v}</span></div>'
            f'<div style="height: 8px; border-radius: 999px; background: {TILE}; overflow: hidden"><i style="display: block; height: 100%; width: {pct}%; border-radius: 999px; background: {col}"></i></div></div>')


def d12_body():
    ev = card(
        item_head("sheet", "Iron sheet G28", "47,500 a sht")
        + f'''<div style="display: flex; align-items: baseline; gap: 8px"><span style="{M}; font-size: 34px; font-weight: 600; letter-spacing: -.03em; line-height: 1">36</span><span style="font-size: 15px; font-weight: 700; color: {SOFT}">of <span style="{M}">40</span> sht packed</span><span style="flex: 1"></span><span style="height: 24px; padding: 0 8px; border-radius: 999px; background: {BADBG}; color: {BAD}; font-size: 12px; font-weight: 700; display: flex; align-items: center"><span style="{M}">4</span>&#160;short</span></div>'''
        + grid40()
        + f'<div style="height: 1px; background: {TILE}"></div>'
        + bar_row("Bill what went", "1,710,000", 90, NAVY, "36 × 47,500", True)
        + bar_row("Bill it all", "1,900,000", 100, "#C9C4BA", "40 × 47,500"),
        12, 12)
    d = SH.sheet_dock(SH.s_sees("Musa · Grace", "Bill what went"),
                      SH.s_primary("Bill what went", "1,710,000", "Bill what went: 36 sheets, 1,710,000. Musa and Grace see it"),
                      SH.s_second("Bill it all · 1,900,000", "Bill it all: 40 sheets, 1,900,000"))
    return SH.decision_sheet(pos=7, total=8, ini="MK", who="Musa", role="Store", asked="09:00", ref="#0550 Kato Construction", age="40 m",
                             title="Packed short", body=ev, dock=d, next_=("DO", "Denis · A carton for the shelf?", "15 m"),
                             aria="Packed short, from Musa, order 0550")


# ------------------------------------------------------------ D-20 cancel asked
def stages(cur):
    names = ["Checking", "Buying", "Packing", "On the road"]
    out = []
    for i, n in enumerate(names):
        if i == cur:
            dot = f'<span style="width: 22px; height: 22px; border-radius: 999px; background: {NAVY}; box-shadow: 0 0 0 4px #E3E6EE; display: flex; align-items: center; justify-content: center"><i style="width: 8px; height: 8px; border-radius: 9px; background: #fff"></i></span>'
            lab = f'<span style="font-size: 11px; font-weight: 700; color: {INK}">{n}</span>'
        else:
            dot = f'<span style="width: 22px; height: 22px; box-sizing: border-box; border-radius: 999px; border: 1.5px dashed {"#C9C4BA"}; background: #fff"></span>'
            lab = f'<span style="font-size: 11px; font-weight: 600; color: {FAINT}">{n}</span>'
        out.append(f'<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 70px; position: relative; z-index: 1">{dot}{lab}</div>')
    return (f'<div style="position: relative; display: flex; justify-content: space-between"><i style="position: absolute; left: 35px; right: 35px; top: 10px; height: 2px; background: {TILE}"></i>'
            + "".join(out) + "</div>")


def fact(num, label, col=INK, bg=BG):
    return (f'<div style="flex: 1; height: 62px; border-radius: 12px; background: {bg}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px">'
            f'<b style="{M}; font-size: 18px; font-weight: 600; color: {col}">{num}</b><span style="font-size: 11px; font-weight: 600; color: {SOFT}">{label}</span></div>')


def faces_row(items):
    out = []
    for ini, name, what in items:
        out.append(f'<div style="display: flex; align-items: center; gap: 10px; min-height: 40px">{av(ini, 32, 12)}<span style="flex: 1; font-size: 14px; font-weight: 700">{name}</span>'
                   f'<span style="{M}; font-size: 11px; color: {FAINT}">{what}</span></div>')
    return "".join(out)


def d20_body():
    ev = card(
        f'<div style="display: flex; align-items: center; justify-content: space-between"><span style="font-size: 13px; font-weight: 700">Where #0556 is</span><span style="{M}; font-size: 11px; color: {FAINT}">since 08:20</span></div>'
        + stages(0)
        + f'<div style="display: flex; gap: 6px">{fact("0", "Packed")}{fact("0", "Paid")}{fact("430,000", "Order")}</div>',
        12, 14)
    stop = card(
        f'<span style="font-size: 13px; font-weight: 700">Who stops</span>'
        + faces_row([("DO", "Denis", "off To ask"), ("MK", "Musa", "nothing to unpack")]),
        12, 4)
    # nothing paid, so a cancel can be undone: a tap with Undo 10 s, not a slide (decided once for every board)
    d = SH.sheet_dock(SH.s_sees("Grace · Denis · Musa", "Cancelled"),
                      SH.s_primary("Cancelled", "#0556", "Cancelled: order 0556, nothing paid. Grace, Denis and Musa see it. Undo 10 s"),
                      SH.s_second("Kept", "Kept: the order goes on. Grace sees Kept"))
    return SH.decision_sheet(pos=6, total=8, ini="GA", who="Grace", role="Sales", asked="08:50", ref="#0556 Ggaba Stores", age="50 m",
                             title="Cancel asked", tags=[SH.s_tag("Nothing paid", "mint")],
                             body=SH.s_quote("changed their mind") + ev + stop, dock=d, aria="Cancel asked, from Grace, order 0556")


# ------------------------------------------------------------ D-18 return
def owes_bars(before, after, pct_after, label="Lubowa Builders owes"):
    return (f'<div style="display: flex; flex-direction: column; gap: 6px"><div style="display: flex; justify-content: space-between; align-items: baseline">'
            f'<span style="font-size: 13px; font-weight: 700">{label}</span><span style="{M}; font-size: 13px; font-weight: 600; white-space: nowrap"><span style="color: {FAINT}; text-decoration: line-through">{before}</span> → {after}</span></div>'
            f'<div style="position: relative; height: 10px; border-radius: 999px; background: repeating-linear-gradient(135deg, {GOODBG} 0 4px, #fff 4px 8px); box-shadow: inset 0 0 0 1px {GOODBG}; overflow: hidden">'
            f'<i style="position: absolute; left: 0; top: 0; bottom: 0; width: {pct_after}%; border-radius: 999px; background: {NAVY}"></i></div></div>')


def stepper(v):
    b = (lambda icon, aria: f'<button aria-label="{aria}" style="width: 44px; height: 44px; border-radius: 999px; border: none; background: #fff; box-shadow: inset 0 0 0 1px {LINE}; color: {INK}; display: flex; align-items: center; justify-content: center; padding: 0">{ic(icon, 18)}</button>')
    return (f'<div style="display: flex; align-items: center; gap: 6px; padding: 3px; border-radius: 999px; background: {BG}">{b("minus", "One less")}'
            f'<span style="{M}; font-size: 20px; font-weight: 600; min-width: 28px; text-align: center">{v}</span>{b("plus", "One more")}</div>')


def d18_body():
    # D-18 is drawn once, in tools/sheet.py: Today p3 shows the same sheet
    return SH.d18_sheet(pos=2, total=8, next_=("DO", "Denis · Price up · #0552", "2 h 10"))


# ------------------------------------------------------------ D-19 void
def bill_tile(no, tag, tagbg, tagcol, dashed=False):
    border = f"border: 1.5px dashed {BAD}" if dashed else f"border: 1px solid {LINE}"
    return (f'<div style="flex: 1; box-sizing: border-box; border-radius: 12px; {border}; background: {"#fff" if not dashed else "#FFF7F6"}; padding: 10px; display: flex; flex-direction: column; gap: 4px">'
            f'<span style="display: flex; justify-content: space-between; align-items: center"><b style="{M}; font-size: 14px; font-weight: 600">{no}</b>'
            f'<span style="height: 20px; padding: 0 7px; border-radius: 999px; background: {tagbg}; color: {tagcol}; font-size: 11px; font-weight: 700; display: flex; align-items: center">{tag}</span></span>'
            f'<span style="{M}; font-size: 16px; font-weight: 600">320,000</span>'
            f'<span style="{M}; font-size: 11px; color: {FAINT}">16 Oct · 3 lines</span></div>')


def d19_body(state="default"):
    twin = card(
        f'<div style="display: flex; align-items: center; justify-content: space-between"><span style="font-size: 13px; font-weight: 700">Entered twice</span><span style="{M}; font-size: 11px; color: {FAINT}">same total · same day</span></div>'
        f'<div style="display: flex; align-items: center; gap: 6px">{bill_tile("#0544", "Stays", GOODBG, GOOD)}<span style="{M}; font-size: 18px; font-weight: 600; color: {SOFT}">=</span>{bill_tile("#0545", "Void", BADBG, BAD, True)}</div>',
        12, 10)
    money = card(
        f'<div style="display: flex; align-items: center; justify-content: space-between"><span style="font-size: 13px; font-weight: 700">Paid on #0545</span><span style="{M}; font-size: 15px; font-weight: 600">200,000</span></div>'
        + owes_bars("878,000", "758,000", 86, "Kato Construction owes"),
        12, 10)
    d = SH.sheet_dock(SH.s_sees("Esther · Grace", "Voided"),
                      SH.s_slide("Voided", "320,000", "Slide: Voided, bill 0545 of 320,000; 200,000 kept as a deposit. Esther and Grace see it"),
                      SH.s_second("Kept as billed", "Kept as billed: 0545 stays. Esther sees it"),
                      SH.s_seg(["Refund 200,000", "Deposit 200,000"], 1, "The 200,000 paid"))
    return SH.decision_sheet(pos=1, total=1, ini="EA", who="Esther", role="Sales", asked="14:05", ref="#0545 Kato Construction", age="15 m",
                             title="Void asked", body=twin + money, dock=d, aria="Void asked, from Esther, bill 0545")


# ------------------------------------------------------------ compact phones (D-10, D-22)
def compact_head(ini, who, ask, no, sub, age):
    return f'''<div style="padding: 12px 14px 0; display: flex; align-items: center; gap: 10px">
          <button aria-label="Close" style="width: 44px; height: 44px; flex: none; border-radius: 999px; border: none; background: #fff; box-shadow: inset 0 0 0 1px {LINE}; color: {INK}; display: flex; align-items: center; justify-content: center; padding: 0">{ic("x", 18)}</button>
          {av(ini, 38, 13)}
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700; white-space: nowrap">{who} · {ask}</span><span style="{M}; font-size: 11px; color: {FAINT}; white-space: nowrap">{no} · {sub.split(" · ",1)[0]}</span><span style="{M}; font-size: 11px; color: {FAINT}">{sub.split(" · ",1)[1]}</span></div>
          <span style="flex: none; height: 24px; padding: 0 8px; border-radius: 999px; background: {WARNBG}; color: {WARNINK}; {M}; font-size: 11px; font-weight: 600; display: flex; align-items: center">{age}</span>
        </div>'''


def chip(word, on):
    st = f"background: {NAVY}; color: #fff" if on else f"background: #fff; color: {INK}; box-shadow: inset 0 0 0 1px {LINE}"
    return f'<button role="radio" aria-checked="{"true" if on else "false"}" style="height: 44px; padding: 0 13px; border: none; border-radius: 999px; {st}; font-size: 13px; font-weight: 700; white-space: nowrap">{word}</button>'


def d10_body():
    ev = card(
        item_head("gift", "Wall plugs · 2 at 0", "#0563", GOODBG, GOOD)
        + f'<div style="display: flex; justify-content: space-between; align-items: baseline"><span style="font-size: 13px; font-weight: 600; color: {SOFT}">At cost</span><span style="{M}; font-size: 14px; font-weight: 600">2 × 3,000 = 6,000</span></div>'
        + f'<div role="radiogroup" aria-label="Why it was free" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px">{chip("Sample", False)}{chip("Goodwill", True)}{chip("Replacement", False)}{chip("Other", False)}</div>',
        12, 10)
    d = SH.sheet_dock(SH.s_sees("Brian", "Given away · Goodwill"),
                      SH.s_primary("Given away · Goodwill", None, "Given away, goodwill: 2 Wall plugs, 6,000 at cost. Brian sees it"),
                      SH.s_second("Bill it", "Bill it: Brian puts the price on the line"))
    return SH.decision_sheet(pos=1, total=1, ini="BO", who="Brian", role="Sales", asked="15:40", ref="#0563 Kyaligonza &amp; Sons", age="30 m",
                             title="Can't bill itself · a line at 0", body=ev, dock=d, aria="Can't bill itself, a line at 0, from Brian, order 0563")


def line_change(name, a, b, diff, on=True, same=False):
    if same:
        tog = f'<span style="{M}; font-size: 11px; color: {FAINT}">no change</span>'
    else:
        tog = (f'<div role="radiogroup" style="display: flex; padding: 2px; border-radius: 999px; background: {BG}">'
               f'<button role="radio" aria-checked="true" style="height: 40px; padding: 0 12px; border: none; border-radius: 999px; background: {NAVY}; color: #fff; font-size: 12px; font-weight: 700">Agreed</button>'
               f'<button role="radio" aria-checked="false" style="height: 40px; padding: 0 12px; border: none; border-radius: 999px; background: transparent; color: {SOFT}; font-size: 12px; font-weight: 700">Kept</button></div>')
    return (f'<div style="display: flex; align-items: center; gap: 8px; min-height: 48px"><div style="flex: 1; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="font-size: 14px; font-weight: 700">{name}</span><span style="{M}; font-size: 12px; font-weight: 600; color: {SOFT}">'
            f'{a} → <b style="color: {INK if same else GOOD}">{b}</b>{(" · " + diff) if diff else ""}</span></div>{tog}</div>')


def d22_body():
    ev = card(
        line_change("Cement 50 kg", "20", "12", "−340,000")
        + f'<div style="height: 1px; background: {TILE}"></div>'
        + line_change("PVC pipe 4 in", "6", "6", "", same=True)
        + f'<div style="display: flex; gap: 6px">{fact("340,000", "Less", GOOD, GOODBG)}{fact("300,000", "Paid")}</div>',
        12, 8)
    d = SH.sheet_dock(SH.s_sees("Peter · Denis", "Agreed"),
                      SH.s_primary("Agreed", "−340,000", "Agreed: Cement 20 to 12, 340,000 less. Peter and Denis see it"),
                      SH.s_second("Kept", "Kept: the order stays as it was. Peter sees it"))
    return SH.decision_sheet(pos=1, total=1, ini="PS", who="Peter", role="Agent", asked="11:05", ref="#0560 Mukono Roofing", age="20 m",
                             title="Peter asks: fewer", body=ev, dock=d, aria="Peter asks for fewer, order 0560")


# ------------------------------------------------------------ states
def state_slot(name, inner, cap, w=360):
    return f'''<div style="display: flex; flex-direction: column; gap: 6px; width: {w}px">
        <span style="font-size: 11px; font-weight: 700; letter-spacing: .08em; color: {SOFT}; text-transform: uppercase; white-space: nowrap">{name}</span>
        <div style="height: 172px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center">{inner}</div>
        <span style="{M}; font-size: 12px; color: {SOFT}; white-space: nowrap">{cap}</span>
      </div>'''


def mini_dock(action, foot, top=True):
    tl = dock_label("Kato Construction", "The bill") if top else ""
    tr = dock_total("1,710,000", "36 of 40 sht") if top else ""
    return dock(tl, tr, "", action, foot, radius="22px", absolute=False)


def notif(title, body, actions, when="09:00", undo=None):
    head = (f'<div style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: #AEB4C2">'
            f'<span style="width: 18px; height: 18px; border-radius: 6px; background: {NAVY}; box-shadow: inset 0 0 0 1px rgba(255,255,255,.25); color: #fff; display: flex; align-items: center; justify-content: center">{ic("plus", 12, 3)}</span>'
            f'Manager · <span style="{M}">{when}</span></div>')
    if undo:
        inner = (f'{head}<div style="display: flex; align-items: center; gap: 10px"><span style="width: 32px; height: 32px; flex: none; border-radius: 999px; background: rgba(111,220,176,.18); color: {MINT}; display: flex; align-items: center; justify-content: center">{ic("tick", 18, 2.4)}</span>'
                 f'<span style="flex: 1; font-size: 14px; font-weight: 700; color: #fff">{undo}</span>'
                 f'<button style="height: 44px; padding: 0 14px; border: none; border-radius: 999px; background: rgba(255,255,255,.12); color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px">{ic("undo", 16)}Undo · <span style="{M}">10 s</span></button></div>'
                 f'<div style="height: 4px; border-radius: 9px; background: rgba(255,255,255,.12); overflow: hidden"><i style="display: block; height: 100%; width: 70%; background: {MINT}"></i></div>')
    else:
        btns = "".join(
            f'<button style="height: 44px; padding: 0 10px; border: none; background: transparent; color: {"#9FC6FF" if i == 0 else "#AEB4C2"}; font-size: 13px; font-weight: 700; white-space: nowrap">{a}</button>'
            for i, a in enumerate(actions))
        inner = (f'{head}<span style="font-size: 14px; font-weight: 700; color: #fff">{title}</span>'
                 f'<span style="{M}; font-size: 11px; line-height: 16px; color: #C9CEDA">{body}</span>'
                 f'<div style="display: flex; gap: 4px; margin: 0 -10px -6px">{btns}</div>')
    return (f'<div style="background: #0B0F1A; border-radius: 20px; padding: 10px"><div style="background: #262B38; border-radius: 16px; padding: 12px 14px; '
            f'display: flex; flex-direction: column; gap: 6px">{inner}</div></div>')


def frag(dock_html):
    return f'<div style="border-radius: 20px; overflow: hidden">{dock_html.replace("border-radius: 24px 24px 0 0", "border-radius: 20px")}</div>'


D12_SEES = SH.s_sees("Musa · Grace", "Bill what went")
D12_SECOND = SH.s_second("Bill it all · 1,900,000")


def states():
    s = []
    s.append(state_slot("Default · from the push", notif("Musa · Packed short · #0550", "Iron sheet G28 36 of 40 · bill 1,710,000<br>(all 40: 1,900,000) · Kato Construction",
                                                         ["BILL WHAT WENT · 1,710,000", "OPEN"]),
                        "lock screen · 1 tap answers · the safe answer"))
    s.append(state_slot("Pressed", frag(SH.sheet_dock(D12_SEES, SH.s_primary("Bill what went", "1,710,000", state="pressed"), D12_SECOND)),
                        "white answer greys · 97% · navy ring"))
    s.append(state_slot("Disabled · D-19", frag(SH.sheet_dock(SH.s_sees("Esther · Grace", "Voided"),
                                                         SH.s_slide("Pick refund or deposit", None, "Slide to void: pick refund or deposit first", "disabled"),
                                                         SH.s_second("Kept as billed"))),
                        "grey knob until the 200,000 is placed"))
    s.append(state_slot("Sending", frag(SH.sheet_dock(D12_SEES, SH.s_primary("Bill what went", "1,710,000", state="sending"), D12_SECOND)),
                        "the answer spins · nothing else moves"))
    succ = card(
        f'<div style="display: flex; align-items: center; gap: 10px"><span style="width: 38px; height: 38px; flex: none; border-radius: 12px; background: {GOODBG}; color: {GOOD}; display: flex; align-items: center; justify-content: center">{ic("tick", 20, 2.4)}</span>'
        f'<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Bill what went · <span style="{M}">1,710,000</span></span>'
        f'<span style="display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: {SOFT}">{ic("bell", 13)}Musa · Grace see it</span></span>'
        f'<button style="height: 44px; padding: 0 14px; border: none; border-radius: 999px; background: {TILE}; color: {INK}; font-size: 13px; font-weight: 700">Undo <span style="{M}">10</span></button></div>'
        f'<div style="display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 10px; border-radius: 12px; background: {BG}">{av("DO", 26, 11)}<span style="flex: 1; font-size: 13px; font-weight: 700">Next · 8 of 8 · A carton for the shelf?</span><span style="color: {SOFT}">{ic("chev", 16)}</span></div>',
        12, 10)
    s.append(state_slot("Success · Undo 10 s", succ, "the push shows the same Undo 10 s · next slides in"))
    err = card(
        f'<div style="display: flex; align-items: center; gap: 10px"><span style="width: 38px; height: 38px; flex: none; border-radius: 12px; background: {BADBG}; color: {BAD}; display: flex; align-items: center; justify-content: center">{ic("alert", 20)}</span>'
        f'<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Bill what went</span><span style="{M}; font-size: 11px; color: {BAD}">Not saved · no signal</span></span>'
        f'<button style="height: 44px; padding: 0 14px; border: none; border-radius: 999px; background: {NAVY}; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px">{ic("retry", 15)}Try again</button></div>'
        f'<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: {SOFT}">{ic("bell", 13)}Musa still sees: <b style="color: {WARNINK}">Packed short · Ruth decides</b></div>',
        12, 10, f"box-shadow: inset 0 0 0 1.5px {BAD}")
    s.append(state_slot("Error", err, "nothing sent · the ask stays open"))
    off = frag(SH.sheet_dock(D12_SEES, SH.s_primary("Bill what went", "1,710,000"), "",
                             f'<div style="display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px; border-radius: 10px; background: rgba(245,178,107,.16); color: #F5B26B; font-size: 12px; font-weight: 700">{ic("nosig", 15)}No signal · your answer waits to send</div>'))
    s.append(state_slot("Offline", off, "the tap still answers · it sends on signal"))
    empty = card(
        f'<div style="display: flex; align-items: center; gap: 12px"><span style="width: 44px; height: 44px; flex: none; border-radius: 999px; background: {GOODBG}; color: {GOOD}; display: flex; align-items: center; justify-content: center">{ic("tick", 22, 2.6)}</span>'
        f'<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">All decided</span><span style="{M}; font-size: 11px; color: {FAINT}">8 answered · last 09:59</span></span></div>'
        f'<button style="width: 100%; height: 56px; border: none; border-radius: 999px; background: {NAVY}; color: #fff; font-size: 16px; font-weight: 700">Back to Today</button>',
        12, 10)
    s.append(state_slot("Empty · 09:59", empty, "the same end button as Today · the + shows a tick"))
    s.append(state_slot("Push · slide decisions", notif("Brian · Return asked · #0547", "Lubowa Builders · Timber 2×4 · 5 back<br>56,250 · owes 662,000", ["KEPT AS SOLD", "OPEN"], "06:40"),
                        "void, credit note: the push offers Kept only"))
    return s


def push_slots():
    a = notif("Musa · Packed short · #0550", "Iron sheet G28 36 of 40 · bill 1,710,000<br>(full 1,900,000) · Kato Construction",
              ["BILL WHAT WENT 1,710,000", "OPEN"])
    b = notif("", "", [], undo="Bill what went · 1,710,000")
    return [state_slot("Push · D-12 expanded", a, "lock screen · 1 tap answers"),
            state_slot("Push · after the tap", b, "10 s to undo · then it sends")]


# ------------------------------------------------------------ score panel
def score_block(name, rows):
    labels = ["Consistency with Agent", "Taps per decision", "Glanceability", "Polish", "In step with the asker"]
    out = []
    so = sa = sn = 0
    for lab, (o, a, n) in zip(labels, rows):
        so += o; sa += a; sn += n
        col = GOOD if n >= a else RED
        out.append(f'''<div style="display: grid; grid-template-columns: 136px 1fr 70px; align-items: center; gap: 8px; height: 15px">
            <span style="font-size: 11px; font-weight: 600; color: {SOFT}; white-space: nowrap">{lab}</span>
            <span style="display: flex; flex-direction: column; gap: 1px"><i style="display: block; height: 3px; border-radius: 9px; background: #C9C4BA; width: {o*10}%"></i><i style="display: block; height: 3px; border-radius: 9px; background: {NAVY}; width: {a*10}%"></i><i style="display: block; height: 3px; border-radius: 9px; background: {col}; width: {n*10}%"></i></span>
            <span style="{M}; font-size: 11px; font-weight: 600; text-align: right; color: {FAINT}">{o} · <b style="color: {NAVY}">{a}</b> · <b style="color: {col}">{n}</b></span>
          </div>''')
    avg = lambda v: f"{v/5:.1f}"
    return (so, sa, sn, f'''<div style="display: flex; flex-direction: column; gap: 2px; padding-bottom: 7px; border-bottom: 1px solid {TILE}">
          <div style="display: flex; align-items: baseline; justify-content: space-between"><span style="font-size: 13px; font-weight: 700">{name}</span><span style="{M}; font-size: 11px; color: {FAINT}">avg {avg(so)} · <b style="color: {NAVY}">{avg(sa)}</b> · <b style="color: {GOOD}">{avg(sn)}</b></span></div>
          {"".join(out)}
        </div>''')


def score_panel():
    pages = [
        ("1 · Packed short · D-12", [(3, 9, 9), (5, 9, 9), (4, 8, 9), (5, 8, 8), (3, 8, 9)]),
        ("2 · Cancel asked · D-20", [(3, 9, 9), (3, 9, 9), (4, 8, 8), (5, 8, 8), (2, 8, 9)]),
        ("3 · Return asked · D-18", [(4, 9, 9), (5, 9, 9), (4, 8, 8), (5, 8, 8), (3, 8, 9)]),
        ("4 · Void asked · D-19", [(4, 9, 9), (4, 9, 8), (4, 8, 9), (5, 8, 8), (3, 8, 9)]),
        ("5 · A line at 0 · Peter asks", [(3, 9, 9), (3, 9, 9), (4, 8, 8), (5, 8, 8), (2, 8, 9)]),
    ]
    blocks, to, ta, tn = [], 0, 0, 0
    for n, r in pages:
        o, a, nn, html = score_block(n, r)
        to += o; ta += a; tn += nn
        blocks.append(html)
    k = len(pages) * 5
    leg = lambda c, w: f'<span style="display: flex; align-items: center; gap: 4px"><i style="width: 10px; height: 4px; border-radius: 9px; background: {c}"></i>{w}</span>'
    return f'''<div style="width: 360px; box-sizing: border-box; margin-top: 19px; background: #fff; border-radius: 16px; box-shadow: inset 0 0 0 1px {LINE}; padding: 14px 16px; display: flex; flex-direction: column; gap: 7px">
        <div style="display: flex; flex-direction: column; gap: 4px">
          <span style="font-size: 17px; font-weight: 700">Scores · decision sheets</span>
          <span style="display: flex; gap: 10px; font-size: 11px; font-weight: 600; color: {SOFT}">{leg("#C9C4BA", "Manager today")}{leg(NAVY, "Agent")}{leg(GOOD, "New")}</span>
        </div>
        {"".join(blocks)}
        <div style="display: flex; align-items: baseline; justify-content: space-between"><span style="font-size: 13px; font-weight: 700">Board average</span><span style="{M}; font-size: 15px; font-weight: 600; color: {FAINT}">{to/k:.1f} · <b style="color: {NAVY}">{ta/k:.1f}</b> · <b style="color: {GOOD}">{tn/k:.1f}</b></span></div>
        <div style="background: {TILE}; border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px">
          <span style="font-size: 12px; font-weight: 700">Agent match · Needs-you + basket dock</span>
          <span style="font-size: 12px; font-weight: 600; color: {SOFT}; line-height: 16px">The one decision sheet · evidence as white cards · navy dock: who sees what, a white answer or the red-knob slide, an outline second</span>
        </div>
      </div>'''


# ------------------------------------------------------------ top strip
def top_strip():
    def ask(n, w):
        return (f'<span style="display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px 0 4px; border-radius: 999px; background: rgba(255,255,255,.1); font-size: 13px; font-weight: 700; white-space: nowrap">'
                f'<b style="min-width: 22px; height: 22px; padding: 0 4px; box-sizing: border-box; border-radius: 999px; background: #fff; color: {NAVY}; {M}; font-size: 11px; display: flex; align-items: center; justify-content: center">{n}</b>{w}</span>')

    def ans(n, w):
        return (f'<span style="display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px 0 4px; border-radius: 999px; background: #fff; font-size: 13px; font-weight: 700; white-space: nowrap">'
                f'<b style="min-width: 22px; height: 22px; padding: 0 4px; box-sizing: border-box; border-radius: 999px; background: {REDD}; color: #fff; {M}; font-size: 11px; display: flex; align-items: center; justify-content: center">{n}</b>{w}</span>')
    asks = "".join(ask(n, w) for n, w in [("12", "Packed short"), ("20", "Cancel asked"), ("19", "Void asked"), ("18", "Return asked"), ("10", "A line at 0"), ("22", "Peter asks")])
    answers = "".join(ans(n, w) for n, w in [("12", "Bill what went"), ("20", "Cancelled"), ("19", "Voided"), ("18", "Credit note raised"), ("10", "Given away"), ("22", "Agreed")])
    return f'''<div style="height: 64px; display: flex; align-items: center; gap: 16px">
    <div style="display: flex; flex-direction: column; gap: 2px; flex: none">
      <span style="font-size: 28px; font-weight: 800; letter-spacing: -.01em; white-space: nowrap">Decide · orders</span>
      <span style="{M}; font-size: 12px; color: {SOFT}; white-space: nowrap">manager.html · the + sheet · after the order</span>
    </div>
    <div style="flex: 1"></div>
    <div style="display: flex; align-items: center; gap: 6px; height: 44px; padding: 0 7px 0 14px; border-radius: 999px; background: {NAVY}; color: #fff">
      <span style="font-size: 13px; font-weight: 700; white-space: nowrap">Asks in</span>{asks}
    </div>
    <div style="display: flex; align-items: center; gap: 6px; height: 44px; padding: 0 7px 0 14px; border-radius: 999px; background: {REDS}; color: {REDD}">
      <span style="font-size: 13px; font-weight: 700; white-space: nowrap">Answers out</span>{answers}
    </div>
  </div>'''


def compact_phone(label, time, body, taps):
    return f'''<div style="display: flex; flex-direction: column; gap: 6px; width: 360px">
        <span style="font-size: 11px; font-weight: 700; letter-spacing: .08em; color: {SOFT}; white-space: nowrap">{label} · <span style="{M}">{time}</span></span>
        <div style="position: relative; width: 360px; height: 610px; box-sizing: border-box; border-radius: 32px; border: 1px solid {LINE}; overflow: hidden; background: {BG}">{body}</div>
        <span style="{M}; font-size: 12px; color: {SOFT}; white-space: nowrap">{taps}</span>
      </div>'''


def main(out):
    row1 = "\n".join([
        phone("1", "PACKED SHORT · D-12 · 7 OF 8", "09:40", d12_body(),
              "Bill what went · app 4 → 2 · push 2 → 1<br>Bill it all · app 3 → 2 (two pills, no segment)"),
        phone("2", "CANCEL ASKED · D-20 · 6 OF 8", "09:40", d20_body(),
              "Cancelled · a tap + Undo · app 4 → 2<br>Kept · app 4 → 2 · push 4 → 1"),
        phone("3", "RETURN ASKED · D-18 · 2 OF 8", "09:40", d18_body(),
              "Credit note raised (slide) · app 4 → 2<br>Kept as sold · push 2 → 1 · = Today p3"),
        phone("4", "VOID ASKED, WITH MONEY · D-19 · 1 OF 1", "14:20", d19_body(),
              "Voided + deposit · app 6 → 3 · push 4 → 3<br>Kept as billed · push 2 → 1"),
        score_panel(),
    ])
    st = states()
    ps = push_slots()
    col = lambda items: f'<div style="display: flex; flex-direction: column; gap: 12px">{"".join(items)}</div>'
    row2 = f'''<div style="display: flex; gap: 40px; align-items: flex-start">
      <div style="display: flex; flex-direction: column; gap: 12px; width: 760px">
        <div style="display: flex; gap: 40px">
          {compact_phone("5 · A LINE AT 0 · D-10 · 1 OF 1", "16:10", d10_body(), "Given away · app 6 → 2 · push 5 → 2 · Bill it 6 → 2")}
          {compact_phone("6 · PETER ASKS FOR FEWER · D-22 · 1 OF 1", "11:25", d22_body(), "Agreed · app 4 → 2 · push 2 → 1 · Kept 4 → 2")}
        </div>
      </div>
      {col(st[0:3])}
      {col(st[3:6])}
      {col(st[6:9])}
    </div>'''
    html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Decide orders</title>
<script src="./support.js"></script></head><body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&amp;family=IBM+Plex+Mono:wght@500;600&amp;display=swap">
<style>body{{margin:0}} a{{color:#16203C}}a:hover{{color:#C93A30}} button{{font-family:inherit;cursor:pointer;margin:0}} svg{{flex:none}}</style>
</helmet>
<div style="width: 2040px; height: 1720px; box-sizing: border-box; padding: 40px; background: #F7F5F2; font-family: Figtree, system-ui, sans-serif; color: #1C2233; display: flex; flex-direction: column; gap: 24px; overflow: hidden">
  {top_strip()}
  <div style="display: flex; gap: 40px; align-items: flex-start">
    {row1}
  </div>
  {row2}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":2040,"height":1720}}}}'>
class Component extends DCLogic {{ renderVals() {{ return {{}}; }} }}
</script></body></html>
'''
    open(out, "w").write(html)


import os
main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "DecideOrders.dc.html"))
