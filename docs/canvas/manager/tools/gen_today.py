#!/usr/bin/env python3
# Generates docs/canvas/manager/Today.dc.html (literal markup).
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheet import d7_sheet, d18_sheet, d7_dock, s_toast  # the ONE decision sheet
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'Today.dc.html')

MONO = "font-family: 'IBM Plex Mono', monospace"
NAVY = "#16203C"

TINT = {
    "RN": ("#16203C", "#FFFFFF"), "GA": ("#DCEAF8", "#1A5A8A"), "BO": ("#DDF1EE", "#0E5E57"),
    "FN": ("#F6E4F1", "#7A3268"), "DO": ("#E4E6FA", "#3A3F9B"), "MK": ("#E4F4EA", "#0F6B43"),
    "JN": ("#FDEEE1", "#7A4A02"), "EA": ("#E8EBF0", "#3D4A5C"), "ML": ("#F1EEE8", "#1C2233"),
    "SS": ("#F1EEE8", "#1C2233"),
}

ICON = {
    "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    "check": '<path d="M5 12l5 5 9-10"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "truck": '<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    "cart": '<path d="M3 4h2l2.5 11h10.5l2-7H6.5"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>',
    "box": '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
    "x": '<path d="M6 6l12 12M18 6L6 18"/>',
    "chev": '<path d="M9 6l6 6-6 6"/>',
    "dbl": '<path d="M6 6l6 6-6 6"/><path d="M13 6l6 6-6 6"/>',
    "undo": '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    "spin": '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>',
    "alert": '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5v.01"/>',
    "nosig": '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 13a10 10 0 0 1 5.2-2.8"/><path d="M12 20h.01"/><path d="M16.7 11.3a10 10 0 0 1 2.3 1.7"/>',
    "orders": '<path d="M8 4h8v3H8z"/><path d="M6 5.5H5V21h14V5.5h-1"/><path d="M9 12h6"/><path d="M9 16h4"/>',
    "money": '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v.01"/><path d="M17.5 14.5v.01"/>',
    "team": '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M21 20a6 6 0 0 0-4-5.6"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "eye": '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    "receipt": '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6"/><path d="M9 12h6"/>',
    "photo": '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
}
SUN = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.3 16.4a5.7 5.7 0 0 1 11.4 0z"/><path d="M12 3.4v2.3M5.4 6.5l1.6 1.6M18.6 6.5l-1.6 1.6M2.4 16.4h19.2M5.6 20.4h12.8" fill="none"/></svg>'


def ic(name, size=16, sw=2, extra=""):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"{extra}>{ICON[name]}</svg>')


def av(ini, size=30, fs=11, ring=False):
    bg, fg = TINT[ini]
    sh = f"; box-shadow: 0 0 0 2px #fff" if ring else ""
    return (f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex: none; border-radius: 999px; background: {bg}; color: {fg}; '
            f'font-size: {fs}px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center{sh}">{ini}</span>')


def dot(ini, size=12):
    bg, fg = TINT[ini]
    return f'<i aria-hidden="true" style="width: {size}px; height: {size}px; flex: none; border-radius: 999px; background: {bg}; box-shadow: inset 0 0 0 2px {fg}"></i>'


def mono(t, size=11, color="#6B7480", w=500, extra=""):
    return f'<span style="{MONO}; font-size: {size}px; font-weight: {w}; color: {color}{extra}">{t}</span>'


def label(t):
    return f'<div style="font-size: 11px; font-weight: 700; letter-spacing: .08em; color: #5F6980">{t}</div>'


def note(t):
    return f'<div style="{MONO}; font-size: 12px; line-height: 1.45; color: #5F6980; width: 360px">{t}</div>'


def pill(text, h=44, pad=14, bg=NAVY, fg="#fff", extra="", aria=None, icon=None):
    a = f' aria-label="{aria}"' if aria else ""
    i = ic(icon, 14, 2.4) if icon else ""
    return (f'<button{a} style="flex: none; height: {h}px; padding: 0 {pad}px; border: none; border-radius: 999px; background: {bg}; color: {fg}; '
            f'font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 5px; white-space: nowrap{extra}">{i}{text}</button>')


def rowslide(text, aria):
    # compact slide on a row: navy knob in a tile-coloured track (irreversible money move)
    return (f'<button aria-label="{aria}" style="flex: none; position: relative; height: 44px; width: 116px; padding: 0 12px 0 46px; border: none; border-radius: 999px; '
            f'background: #F1EEE8; box-shadow: inset 0 0 0 1px #E6E3DD; color: #1C2233; font-size: 12px; font-weight: 700; display: flex; align-items: center; white-space: nowrap; text-align: left">'
            f'<span style="position: absolute; left: 4px; top: 4px; width: 36px; height: 36px; border-radius: 999px; background: {NAVY}; color: #fff; display: flex; align-items: center; justify-content: center">{ic("dbl", 16, 2.4)}</span>{text}</button>')


# ---------------------------------------------------------------- common phone parts
def tabbar(fab_badge="8", fab_tick=False, active="Today"):
    def tab(name, icon):
        on = name == active
        col = "#1C2233" if on else "#5F6980"
        w = 700 if on else 600
        cur = ' aria-current="page"' if on else ""
        svg = SUN if icon == "sun" else ic(icon, 24)
        return (f'<button aria-label="{name}"{cur} style="min-height: 52px; border: none; background: none; padding: 0; display: flex; flex-direction: column; '
                f'align-items: center; justify-content: center; gap: 4px; color: {col}; font-size: 12px; font-weight: {w}">{svg}{name}</button>')
    if fab_tick:
        fab_in = ic("check", 28, 2.4)
        badge = ""
        fab_aria = "Decide next: nothing waits"
    else:
        fab_in = ic("plus", 28, 2.4)
        badge = (f'<span style="position: absolute; top: -4px; right: -4px; min-width: 24px; height: 24px; box-sizing: border-box; padding: 0 6px; border-radius: 999px; '
                 f'background: {NAVY}; color: #fff; {MONO}; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; border: 2px solid #F7F5F2">{fab_badge}</span>')
        fab_aria = f"Decide next: {fab_badge} decisions wait, oldest first"
    return (f'<div style="position: absolute; left: 0; right: 0; bottom: 0; background: #fff; border-top: 1px solid #E6E3DD; display: grid; '
            f'grid-template-columns: 1fr 1fr 96px 1fr 1fr; align-items: start; padding: 8px 0 12px">'
            + tab("Today", "sun") + tab("Orders", "orders")
            + f'<button aria-label="{fab_aria}" style="justify-self: center; margin-top: -26px; width: 64px; height: 64px; box-sizing: border-box; border-radius: 999px; '
              f'background: #C93A30; color: #fff; border: 4px solid #F7F5F2; box-shadow: 0 6px 20px rgba(201,58,48,.35); position: relative; display: flex; align-items: center; justify-content: center; padding: 0">{fab_in}{badge}</button>'
            + tab("Money", "money") + tab("Team", "team") + '</div>')


def hero(offline=False):
    live = ('<span style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,.08); font-size: 12px">'
            '<i style="width: 7px; height: 7px; border-radius: 999px; background: #6FDCB0; box-shadow: 0 0 0 4px rgba(111,220,176,.25)"></i>Live</span>')
    if offline:
        live = ('<span style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,.08); font-size: 12px; color: #F5C58A">'
                '<i style="width: 7px; height: 7px; border-radius: 999px; background: #F5A54A"></i>Offline</span>')
    return f'''<div style="background: {NAVY}; color: #fff; border-radius: 0 0 28px 28px; padding: 10px 20px 14px; display: flex; flex-direction: column; gap: 8px">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px">
            <div style="display: flex; flex-direction: column; gap: 2px">
              <span style="font-size: 24px; font-weight: 700; line-height: 1.1">Good morning, Ruth</span>
              <span style="display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 600; color: #B3BCD2">Sat 17 Oct{live}</span>
            </div>
            <button aria-label="Ruth, your page" style="width: 44px; height: 44px; border-radius: 999px; border: none; background: {NAVY}; box-shadow: inset 0 0 0 2px rgba(255,255,255,.3); color: #fff; font-size: 14px; font-weight: 700">RN</button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 5px">
            <span style="font-size: 12px; font-weight: 600; letter-spacing: .06em; color: #B3BCD2">SALES INVOICED · OCTOBER ›</span>
            <span style="{MONO}; font-size: 32px; font-weight: 600; letter-spacing: -.03em; line-height: 1">61,110,000 <small style="font-size: 16px; color: #B3BCD2; letter-spacing: 0">UGX</small></span>
            <div aria-label="58% of the 105,000,000 goal; pace 57%" style="position: relative; height: 6px; margin-top: 2px; border-radius: 999px; background: rgba(255,255,255,.12)"><i style="display: block; height: 100%; width: 58.2%; background: #fff; border-radius: 999px"></i><i style="position: absolute; left: 56.7%; top: -3px; width: 2px; height: 12px; border-radius: 2px; background: #6FDCB0"></i></div>
            <span style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; color: #B3BCD2"><span><b style="{MONO}; color: #fff">58%</b> of <b style="{MONO}; color: #fff">105M</b> · <b style="{MONO}; color: #fff">14</b> days left ›</span><span style="{MONO}; color: #6FDCB0">+1.61M ahead</span></span>
          </div>
        </div>'''


def tile(icon, n, name, badge=None, faces=(), aria=""):
    b = ""
    if badge:
        b = (f'<span style="position: absolute; top: -6px; right: -6px; min-width: 22px; height: 22px; padding: 0 6px; box-sizing: border-box; border-radius: 999px; background: {NAVY}; '
             f'color: #fff; {MONO}; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px #fff">{badge}</span>')
    fd = "".join(dot(f, 10) for f in faces)
    return (f'<button aria-label="{aria}" style="position: relative; height: 56px; border-radius: 12px; background: #F7F5F2; border: none; padding: 0; display: flex; flex-direction: column; '
            f'align-items: center; justify-content: center; gap: 2px; color: #1C2233">'
            f'<span style="display: flex; align-items: center; gap: 5px">{ic(icon, 15)}<b style="{MONO}; font-size: 18px; font-weight: 600">{n}</b></span>'
            f'<span style="font-size: 11px; font-weight: 600; color: #5F6980; white-space: nowrap">{name}</span>'
            f'<span style="display: flex; gap: 2px; height: 10px">{fd}</span>{b}</button>')


def onmove():
    return ('<div style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px"><span style="font-size: 17px; font-weight: 700">On the move</span>'
            f'<span style="{MONO}; font-size: 13px; font-weight: 600; color: #5F6980">8 orders</span></div>'
            '<div style="background: #fff; border: 1px solid #E6E3DD; border-radius: 16px; padding: 6px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px">'
            + tile("search", 3, "Checking", 2, ("DO", "GA"), "Checking: 3 orders, 2 wait on you, Denis and Grace hold them")
            + tile("cart", 2, "Buying", 1, ("DO",), "Buying: 2 orders, 1 waits on you, Denis holds them")
            + tile("box", 2, "Packing", 2, ("MK",), "Packing: 2 orders, 2 wait on you, Musa holds them")
            + tile("truck", 1, "On the road", None, ("SS",), "On the road: 1 order, Ssali drives it")
            + '</div>')


# ---------------------------------------------------------------- Needs-you rows (queue order)
QUEUE = [
    # standing first, then oldest (the one queue order at 09:40) · the pill is the §3 answer the asker sees
    ("MK", "Not paid yet · on credit?", "Musa · #0551 · 25 m", pill("On credit · load it", pad=12, aria="On credit, load it: Nansana Hardware, 1.5M, 14 days. Musa and Grace see it")),
    ("BO", "Return asked", "Brian · #0547 · −56,250 · 3 h", pill("Open", aria="Open: Return asked, 0547. Credit note raised is a slide")),
    ("DO", "Price up · Ridge cap", "Denis · #0552 · 2 h 10", pill("Shop's price", pad=12, aria="Shop's price 33,750 for Ridge cap 3 m on 0552. Denis and Faith see it")),
    ("MK", "Damaged · 3 Cement", "Musa · 3 bags · 1 h 30", pill("Open", aria="Open: Damaged, 3 Cement 50 kg. Written off is a slide")),
    ("GA", "Under the shop's price", "Grace · #0555 · 1 h 05", pill("Approved", aria="Approved 46,000 for Iron sheet G28 on 0555. Grace sees it")),
    ("GA", "Cancel asked", "Grace · #0556 · 50 m", pill("Cancelled", aria="Cancelled 0556, nothing paid. Grace, Denis and Musa see it. Undo 10 s")),
    ("MK", "Packed short", "Musa · #0550 · 40 m", pill("Bill what went", pad=12, aria="Bill what went: 36 Iron sheet G28, 1,710,000. Musa and Grace see it")),
    ("DO", "A carton for the shelf?", "Denis · Wall plugs · 15 m", pill("Shelf part OK", pad=12, aria="Shelf part OK: carton of 200 Wall plugs, 298,500. Denis sees it")),
]


def nk_row(ini, title, sub, ctrl, first=False, extra_style=""):
    bt = "" if first else "border-top: 1px solid #F1EEE8; "
    return (f'<div style="display: flex; align-items: center; gap: 8px; height: 46px; padding: 0 6px 0 8px; {bt}{extra_style}">{av(ini, 30)}'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{title}</span>'
            f'<span style="{MONO}; font-size: 11px; color: #6B7480; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{sub}</span></div>{ctrl}</div>')


def needs_you():
    rows = "".join(nk_row(*q, first=(i == 0)) for i, q in enumerate(QUEUE))
    return ('<div style="display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 17px; font-weight: 700"><i style="width: 8px; height: 8px; border-radius: 999px; background: {NAVY}"></i>'
            f'<span style="flex: 1">Needs you</span><span style="{MONO}; font-size: 11px; font-weight: 500; color: #5F6980">standing first · then oldest</span><b style="{MONO}; font-size: 13px; font-weight: 600; color: #5F6980">8</b></div>'
            f'<div style="background: #fff; border: 1px solid #E6E3DD; border-radius: 16px; padding: 0 0; overflow: hidden">{rows}</div>')


def phone(inner, bg="#F7F5F2"):
    return (f'<div style="position: relative; width: 360px; height: 780px; box-sizing: border-box; border-radius: 32px; border: 1px solid #E6E3DD; overflow: hidden; background: {bg}">'
            f'{inner}</div>')


def column(lbl, ph, nt):
    return f'<div style="display: flex; flex-direction: column; gap: 8px">{label(lbl)}{ph}{note(nt)}</div>'


# ---------------------------------------------------------------- page 1 · Today
P1 = phone(hero() + '<div style="padding: 10px 12px 0; display: flex; flex-direction: column; gap: 5px">' + onmove() + needs_you() + '</div>' + tabbar())


# ---------------------------------------------------------------- Decide card parts
def topbar(n, done):
    segs = ""
    for i in range(8):
        c = "#0F6B43" if i < done else (NAVY if i == done else "#E6E3DD")
        segs += f'<i style="flex: 1; height: 4px; border-radius: 9px; background: {c}"></i>'
    return (f'<div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px 10px">'
            f'<button aria-label="Close, back to Today" style="width: 44px; height: 44px; flex: none; border-radius: 999px; border: none; background: #fff; box-shadow: inset 0 0 0 1px #E6E3DD; color: #1C2233; display: flex; align-items: center; justify-content: center; padding: 0">{ic("x", 20)}</button>'
            f'<div style="flex: 1; display: flex; flex-direction: column; gap: 6px"><span style="font-size: 13px; font-weight: 700"><b style="{MONO}; font-weight: 600">{n}</b> of <b style="{MONO}; font-weight: 600">8</b> · oldest first</span>'
            f'<span style="display: flex; gap: 3px">{segs}</span></div>'
            f'<button aria-label="Next decision, this one waits" style="height: 44px; flex: none; padding: 0 6px 0 12px; border-radius: 999px; border: none; background: transparent; color: #5F6980; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 2px">next{ic("chev", 16)}</button></div>')


def asker(ini, name, role, asked, chip):
    return (f'<div style="display: flex; align-items: center; gap: 10px">{av(ini, 40, 13)}'
            f'<div style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">From {name}</span>'
            f'<span style="font-size: 12px; font-weight: 600; color: #5F6980">{role} · Asked · <span style="{MONO}">{asked}</span></span></div>{chip}</div>')


def chip(text, bg, fg, icon=None):
    i = ic(icon, 14) if icon else ""
    return (f'<span style="display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border-radius: 999px; background: {bg}; color: {fg}; font-size: 12px; font-weight: 700; white-space: nowrap">{i}{text}</span>')


def order_ref(num, cust, ini):
    return (f'<span style="display: inline-flex; align-items: center; gap: 6px"><span style="display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px 0 6px; border-radius: 999px; background: #F1EEE8">'
            f'{dot(ini)}<span style="{MONO}; font-size: 12px; font-weight: 600">{num}</span></span><span style="font-size: 14px; font-weight: 600; color: #5F6980">{cust}</span></span>')


def sees(who_html, words, on_navy=True):
    col = "#B3BCD2" if on_navy else "#5F6980"
    ch_bg = "rgba(255,255,255,.1)" if on_navy else "#E4F4EA"
    ch_fg = "#fff" if on_navy else "#0F6B43"
    return (f'<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: {col}">{ic("bell", 14)}{who_html}'
            f'<span style="height: 22px; padding: 0 8px; border-radius: 999px; background: {ch_bg}; color: {ch_fg}; font-weight: 700; display: inline-flex; align-items: center">{words}</span></div>')


def facts(items):
    t = ""
    for lab, val, col in items:
        t += (f'<div style="flex: 1; min-width: 0; padding: 8px 10px; border-radius: 12px; background: #F7F5F2; display: flex; flex-direction: column; gap: 2px">'
              f'<span style="font-size: 11px; font-weight: 600; color: #5F6980">{lab}</span><span style="{MONO}; font-size: 15px; font-weight: 600; color: {col}; white-space: nowrap">{val}</span></div>')
    return f'<div style="display: flex; gap: 6px">{t}</div>'


def limit_chips(selected=0):
    out = ""
    for i, (a, d) in enumerate([("1.5M", "14 d"), ("2M", "14 d"), ("3M", "30 d")]):
        on = i == selected
        st = (f"background: {NAVY}; color: #fff; box-shadow: none" if on else "background: #fff; color: #1C2233; box-shadow: inset 0 0 0 1px #E6E3DD")
        tick = ic("check", 14, 2.4) if on else ""
        pressed = ' aria-pressed="true"' if on else ' aria-pressed="false"'
        out += (f'<button{pressed} style="flex: 1; height: 44px; border: none; border-radius: 999px; {st}; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap">'
                f'{tick}<span style="{MONO}; font-weight: 600">{a}</span>· {d}</button>')
    return f'<div style="display: flex; gap: 6px">{out}</div>'


def credit_card(selected=0):
    return f'''<div style="margin: 0 16px; padding: 16px; border-radius: 20px; background: #fff; box-shadow: 0 1px 2px rgba(22,32,60,.05), inset 0 0 0 1px #E6E3DD; display: flex; flex-direction: column; gap: 14px">
          {asker("MK", "Musa", "Store", "09:15", chip("Truck waits", "#FDEEE1", "#7A4A02", "truck"))}
          <div style="display: flex; flex-direction: column; gap: 8px">
            <span style="font-size: 22px; font-weight: 800; letter-spacing: -.01em; line-height: 1.15">Not paid yet · on credit?</span>
            {order_ref("#0551", "Nansana Hardware", "MK")}
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #5F6980"><span>Would owe</span><span style="{MONO}">of a 1.5M limit</span></div>
            <div aria-label="Would owe 1,240,000 of a 1,500,000 limit" style="position: relative; height: 12px; border-radius: 999px; background: #F1EEE8"><i style="display: block; height: 100%; width: 82.7%; border-radius: 999px; background: {NAVY}"></i><i style="position: absolute; right: 0; top: -4px; width: 2px; height: 20px; border-radius: 2px; background: #5F6980"></i></div>
            <div style="display: flex; justify-content: space-between">{mono("owes 0 + this order", 11, "#6B7480")}<span style="{MONO}; font-size: 15px; font-weight: 600">1,240,000 <small style="font-size: 11px; color: #6B7480">UGX</small></span></div>
          </div>
          {facts([("Owes now", "0", "#0F6B43"), ("Limit", "none", "#95530C"), ("On credit", "1st", "#1C2233")])}
          <div style="display: flex; flex-direction: column; gap: 8px">
            <span style="font-size: 12px; font-weight: 700; color: #5F6980">Limit · terms</span>
            {limit_chips(selected)}
          </div>
        </div>'''


def peek(ini, txt, sub, top):
    return (f'<div style="position: absolute; left: 16px; right: 16px; top: {top}px; display: flex; flex-direction: column; gap: 6px">'
            f'<span style="font-size: 11px; font-weight: 700; letter-spacing: .08em; color: #5F6980; padding: 0 4px">NEXT</span>'
            f'<div style="display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 14px 0 10px; border-radius: 16px; border: 1.5px dashed #C9C4BA">{av(ini, 30)}'
            f'<span style="flex: 1; font-size: 13px; font-weight: 700; color: #5F6980">{txt}</span>{mono(sub, 11, "#5F6980", 600)}</div></div>')


def credit_dock(state="default"):
    if state == "disabled":
        main = (f'<button disabled aria-disabled="true" style="height: 56px; border: none; border-radius: 999px; background: rgba(255,255,255,.12); color: #B3BCD2; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: default">Pick a limit to load it</button>')
    else:
        main = (f'<button style="height: 56px; border: none; border-radius: 999px; background: #fff; color: {NAVY}; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px">{ic("check", 18, 2.4)}On credit · load it</button>')
    return f'''<div style="position: absolute; left: 0; right: 0; bottom: 0; background: {NAVY}; border-radius: 26px 26px 0 0; padding: 14px 16px 18px; box-shadow: 0 -8px 24px rgba(22,32,60,.18); display: flex; flex-direction: column; gap: 10px">
          {sees(dot("MK") + "Musa sees", "On credit · load it")}
          {main}
          <button style="height: 44px; border: none; border-radius: 999px; background: rgba(255,255,255,.08); color: #fff; font-size: 14px; font-weight: 700">Cash first · it stays</button>
        </div>'''


P2 = phone(d7_sheet(next_=("BO", "Brian · Return asked · #0547", "3 h")))


# ---------------------------------------------------------------- page 3 · answered, next slides in
def undo_toast(title, sub, secs="10"):
    return f'''<div role="status" style="margin: 0 16px 10px; padding: 8px 8px 8px 12px; border-radius: 16px; background: {NAVY}; color: #fff; display: flex; align-items: center; gap: 10px; box-shadow: 0 6px 20px rgba(27,36,56,.18)">
          <span style="width: 28px; height: 28px; flex: none; border-radius: 999px; background: rgba(111,220,176,.18); color: #6FDCB0; display: flex; align-items: center; justify-content: center">{ic("check", 16, 2.6)}</span>
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px"><span style="font-size: 14px; font-weight: 700; white-space: nowrap">{title}</span><span style="font-size: 12px; font-weight: 600; color: #B3BCD2; display: flex; align-items: center; gap: 4px; white-space: nowrap">{ic("bell", 12)}{sub}</span></div>
          <button aria-label="Undo, {secs} seconds left" style="flex: none; height: 44px; padding: 0 12px 0 6px; border: none; border-radius: 999px; background: #fff; color: {NAVY}; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px">
            <span style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" style="position: absolute; inset: 0; transform: rotate(-90deg)"><circle cx="15" cy="15" r="12" fill="none" stroke="#E6E3DD" stroke-width="3"/><circle cx="15" cy="15" r="12" fill="none" stroke="{NAVY}" stroke-width="3" stroke-linecap="round" stroke-dasharray="75.4" stroke-dashoffset="{75.4 * (1 - int(secs) / 10):.1f}"/></svg><b style="{MONO}; font-size: 11px; font-weight: 600">{secs}</b></span>Undo</button>
        </div>'''


def return_card():
    return f'''<div style="position: relative; margin: 0 16px; padding: 16px; border-radius: 20px; background: #fff; box-shadow: 0 6px 20px rgba(27,36,56,.12), inset 0 0 0 1px #E6E3DD; display: flex; flex-direction: column; gap: 14px; transform: translateX(14px)">
          {asker("BO", "Brian", "Sales", "06:40", chip("3 h", "#FDEEE1", "#7A4A02", "clock"))}
          <div style="display: flex; flex-direction: column; gap: 8px">
            <span style="font-size: 22px; font-weight: 800; letter-spacing: -.01em; line-height: 1.15">Return asked</span>
            {order_ref("#0547", "Lubowa Builders", "BO")}
          </div>
          <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 12px; background: #F7F5F2">
            <span style="width: 38px; height: 38px; flex: none; border-radius: 12px; background: #fff; color: #5F6980; display: flex; align-items: center; justify-content: center">{ic("undo", 20)}</span>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Timber 2×4</span>{mono("5 pcs back × 11,250", 12, "#5F6980")}</div>
            <span style="{MONO}; font-size: 16px; font-weight: 600">−56,250</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px">
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #5F6980"><span>Owes</span><span style="{MONO}">25 d · promised Mon 19 Oct</span></div>
            <div aria-label="Owes 662,000, after the credit note 605,750" style="display: flex; height: 12px; border-radius: 999px; overflow: hidden; background: #F1EEE8"><i style="display: block; height: 100%; width: 91.5%; background: {NAVY}"></i><i style="display: block; height: 100%; width: 8.5%; background: repeating-linear-gradient(135deg, #C9C4BA 0 3px, #F1EEE8 3px 6px)"></i></div>
            <div style="display: flex; justify-content: space-between; align-items: baseline">{mono("662,000 →", 12, "#6B7480")}<span style="{MONO}; font-size: 15px; font-weight: 600">605,750 <small style="font-size: 11px; color: #6B7480">UGX</small></span></div>
          </div>
        </div>'''


def ghost_prev():
    # the answered card leaving to the left
    return ('<div aria-hidden="true" style="position: absolute; left: -300px; top: 128px; width: 318px; height: 360px; border-radius: 20px; background: #fff; box-shadow: inset 0 0 0 1px #E6E3DD; opacity: .55"></div>'
            '<div aria-hidden="true" style="position: absolute; left: 22px; top: 300px; display: flex; gap: 3px; color: #C9C4BA">' + ic("chev", 14, 2.4, ' style="transform: rotate(180deg)"') + '</div>')


def slide(label_txt, ready=True):
    knob_bg = "#C93A30" if ready else "#5F6980"
    col = "#fff" if ready else "#B3BCD2"
    return (f'<div role="slider" aria-label="{label_txt}" style="position: relative; height: 60px; border-radius: 999px; background: rgba(255,255,255,.08); display: flex; align-items: center; justify-content: center">'
            f'<span style="position: absolute; left: 5px; top: 5px; width: 50px; height: 50px; border-radius: 999px; background: {knob_bg}; color: #fff; display: flex; align-items: center; justify-content: center">{ic("dbl", 22, 2.4)}</span>'
            f'<span style="font-size: 16px; font-weight: 700; color: {col}; padding-left: 40px">{label_txt}</span></div>')


def return_dock():
    return f'''<div style="position: absolute; left: 0; right: 0; bottom: 0; background: {NAVY}; border-radius: 26px 26px 0 0; padding: 14px 16px 18px; box-shadow: 0 -8px 24px rgba(22,32,60,.18); display: flex; flex-direction: column; gap: 10px">
          {sees(dot("BO") + dot("EA") + "Brian · Esther see", "Credit note raised")}
          {slide("Credit note · 56,250")}
          <button style="height: 44px; border: none; border-radius: 999px; background: transparent; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.35); color: #fff; font-size: 14px; font-weight: 700">Kept as sold</button>
        </div>'''


P3 = phone(d18_sheet(pos=2, total=8, toast=s_toast("On credit · load it", "#0551 · Musa · Grace see it"), next_=("DO", "Denis · Price up · #0552", "2 h 10")))


# ---------------------------------------------------------------- page 4 · all decided
DONE = [
    # time, answer, sub, sees-initials, kind
    ("09:59", "Shelf part OK", "Wall plugs · 298,500", ["DO"], "tap"),
    ("09:57", "Bill what went", "#0550 · 1,710,000", ["MK", "GA"], "tap"),
    ("09:55", "Cancelled", "#0556 · 430,000 · nothing paid", ["GA", "DO", "MK"], "tap"),
    ("09:52", "Approved", "#0555 · 46,000", ["GA"], "tap"),
    ("09:49", "Written off", "3 Cement 50 kg · 102,000", ["MK"], "slide"),
    ("09:46", "Shop's price", "#0552 · 33,750", ["DO", "FN"], "tap"),
    ("09:43", "Credit note raised", "#0547 · 56,250", ["BO", "EA"], "slide"),
    ("09:41", "On credit · load it", "#0551 · 1.5M · 14 d", ["MK", "GA"], "tap"),
    ("08:30", "Billed itself", "#0546 · 24 h after delivery", [], "auto"),
    ("07:55", "Approved", "#0549 · Iron sheet G28", ["BO"], "tap"),
]


def done_rows():
    out = ""
    for i, (t, a, s, who, kind) in enumerate(DONE):
        if kind == "auto":
            mark = f'<span style="width: 24px; height: 24px; flex: none; border-radius: 8px; background: #F1EEE8; color: #5F6980; display: flex; align-items: center; justify-content: center">{ic("receipt", 14)}</span>'
        elif kind == "slide":
            mark = f'<span style="width: 24px; height: 24px; flex: none; border-radius: 8px; background: #E4F4EA; color: #0F6B43; display: flex; align-items: center; justify-content: center">{ic("dbl", 14, 2.4)}</span>'
        else:
            mark = f'<span style="width: 24px; height: 24px; flex: none; border-radius: 8px; background: #E4F4EA; color: #0F6B43; display: flex; align-items: center; justify-content: center">{ic("check", 14, 2.6)}</span>'
        faces = "".join(av(w, 22, 9, ring=True) if False else av(w, 22, 11) for w in who)
        bt = "" if i == 0 else "border-top: 1px solid #F1EEE8; "
        sep = f'<div style="height: 6px; background: #F7F5F2; border-top: 1px solid #E6E3DD"></div>' if t == "08:30" else ""
        out += sep + (f'<div style="display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 10px; {bt if not sep else ""}">'
                      f'{mono(t, 11, "#6B7480", 600, "; width: 36px; flex: none")}{mark}'
                      f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px"><span style="font-size: 13px; font-weight: 700; white-space: nowrap">{a}</span>'
                      f'<span style="{MONO}; font-size: 11px; color: #6B7480; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{s}</span></div>'
                      f'<span style="display: flex; gap: 2px">{faces}</span></div>')
    return out


def who_bar():
    segs = [("MK", 3, "Musa"), ("DO", 2, "Denis"), ("GA", 2, "Grace"), ("BO", 1, "Brian")]
    bar = ""
    leg = ""
    for ini, n, name in segs:
        bg, fg = TINT[ini]
        bar += f'<i style="flex: {n}; height: 100%; background: {bg}"></i>'
        leg += (f'<span style="display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: #B3BCD2">{dot(ini, 10)}{name} <b style="{MONO}; color: #fff">{n}</b></span>')
    return (f'<div aria-label="Who asked: Musa 3, Denis 2, Grace 2, Brian 1" style="display: flex; gap: 2px; height: 10px; border-radius: 999px; overflow: hidden">{bar}</div>'
            f'<div style="display: flex; justify-content: space-between">{leg}</div>')


P4 = phone(f'''<div style="background: {NAVY}; color: #fff; border-radius: 0 0 28px 28px; padding: 22px 20px 20px; display: flex; flex-direction: column; gap: 14px">
          <div style="display: flex; align-items: center; gap: 14px">
            <span style="width: 52px; height: 52px; flex: none; border-radius: 999px; background: rgba(111,220,176,.16); color: #6FDCB0; display: flex; align-items: center; justify-content: center">{ic("check", 28, 2.6)}</span>
            <div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 26px; font-weight: 800; line-height: 1.1">All decided</span>
            <span style="font-size: 15px; font-weight: 600; color: #B3BCD2"><b style="{MONO}; color: #fff">0</b> waiting · <span style="{MONO}">09:59</span></span></div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline"><span style="font-size: 12px; font-weight: 600; letter-spacing: .06em; color: #B3BCD2">8 ANSWERED · WHO ASKED</span><span style="{MONO}; font-size: 12px; color: #6FDCB0">09:41–09:59</span></div>
          {who_bar()}
        </div>
        <div style="padding: 14px 12px 0; display: flex; flex-direction: column; gap: 8px">
          <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px"><span style="font-size: 17px; font-weight: 700">Today's answers</span><span style="display: flex; align-items: center; gap: 4px; {MONO}; font-size: 13px; font-weight: 600; color: #5F6980">{ic("bell", 12)}15 told</span></div>
          <div style="background: #fff; border: 1px solid #E6E3DD; border-radius: 16px; overflow: hidden">{done_rows()}</div>
        </div>
        <div style="position: absolute; left: 16px; right: 16px; bottom: 18px"><button style="width: 100%; height: 56px; border: none; border-radius: 999px; background: {NAVY}; color: #fff; font-size: 16px; font-weight: 700">Back to Today</button></div>''')


# ---------------------------------------------------------------- score panel
PAGES = [
    ("1 · Today", "Agent Today", [5, 4, 4, 6, 4], [9, 9, 8, 9, 8], [9, 9, 8, 8, 9]),
    ("2 · Decide next", "Decision sheet", [4, 3, 5, 6, 4], [9, 9, 8, 8, 8], [9, 9, 9, 8, 9]),
    ("3 · Answered · next", "Decision sheet", [4, 4, 4, 6, 4], [9, 9, 8, 8, 8], [9, 9, 8, 8, 9]),
    ("4 · All decided", "Agent Today", [4, 5, 4, 5, 3], [9, 9, 8, 9, 8], [9, 9, 9, 9, 9]),
]
MEAS = ["Agent consistency", "Taps per decision", "Glanceability", "Polish", "In step with askers"]


def avg(v):
    return sum(v) / len(v)


def score_panel():
    body = ""
    for name, _m, old, ag, nw in PAGES:
        rows = ""
        for i, m in enumerate(MEAS):
            col = "#0F6B43" if nw[i] >= ag[i] else "#C93A30"
            rows += (f'<div style="display: grid; grid-template-columns: 116px 1fr 74px; align-items: center; gap: 8px; height: 19px">'
                     f'<span style="font-size: 11px; font-weight: 600; color: #5F6980; white-space: nowrap">{m}</span>'
                     f'<span style="display: flex; flex-direction: column; gap: 1px">'
                     f'<i style="display: block; height: 3px; border-radius: 9px; background: #C9C4BA; width: {old[i]*10}%"></i>'
                     f'<i style="display: block; height: 3px; border-radius: 9px; background: {NAVY}; width: {ag[i]*10}%"></i>'
                     f'<i style="display: block; height: 3px; border-radius: 9px; background: {col}; width: {nw[i]*10}%"></i></span>'
                     f'<span style="{MONO}; font-size: 11px; font-weight: 600; text-align: right; color: #6B7480">{old[i]} · <b style="color: {NAVY}">{ag[i]}</b> · <b style="color: {col}">{nw[i]}</b></span></div>')
        body += (f'<div style="display: flex; flex-direction: column; gap: 5px; padding-bottom: 10px; border-bottom: 1px solid #F1EEE8">'
                 f'<div style="display: flex; align-items: baseline; justify-content: space-between"><span style="font-size: 13px; font-weight: 700">{name}</span>'
                 f'<span style="{MONO}; font-size: 11px; color: #6B7480">avg {avg(old):.1f} · <b style="color: {NAVY}">{avg(ag):.1f}</b> · <b style="color: #0F6B43">{avg(nw):.1f}</b></span></div>{rows}</div>')
    to = avg([avg(p[2]) for p in PAGES]); ta = avg([avg(p[3]) for p in PAGES]); tn = avg([avg(p[4]) for p in PAGES])
    return f'''<div style="width: 360px; box-sizing: border-box; margin-top: 19px; background: #fff; border: 1px solid #E6E3DD; border-radius: 16px; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px">
      <div style="display: flex; flex-direction: column; gap: 6px">
        <span style="font-size: 17px; font-weight: 700">Scores · out of 10</span>
        <span style="display: flex; gap: 10px; font-size: 11px; font-weight: 600; color: #5F6980">
          <span style="display: flex; align-items: center; gap: 4px"><i style="width: 10px; height: 4px; border-radius: 9px; background: #C9C4BA"></i>Manager today</span>
          <span style="display: flex; align-items: center; gap: 4px"><i style="width: 10px; height: 4px; border-radius: 9px; background: {NAVY}"></i>Agent app</span>
          <span style="display: flex; align-items: center; gap: 4px"><i style="width: 10px; height: 4px; border-radius: 9px; background: #0F6B43"></i>New</span>
        </span>
      </div>
      {body}
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 0">
        <span style="font-size: 13px; font-weight: 700">Tab average</span>
        <span style="{MONO}; font-size: 15px; font-weight: 600; color: #6B7480">{to:.1f} · <b style="color: {NAVY}">{ta:.1f}</b> · <b style="color: #0F6B43">{tn:.1f}</b></span>
      </div>
      <div style="padding: 10px 12px; border-radius: 12px; background: #F1EEE8; display: flex; flex-direction: column; gap: 2px">
        <span style="font-size: 12px; font-weight: 700">Agent match · Agent Today + Needs-you</span>
        <span style="font-size: 12px; font-weight: 600; color: #5F6980; line-height: 1.35">Flat navy hero · navy need badges · Needs you: asker, ask word, the answer they see on the pill · the one sheet (navy head, white answer, red knob only on a slide)</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px; padding-top: 2px">
        <span style="font-size: 12px; font-weight: 700">Taps · the 8 in the queue</span>
        <div style="display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; align-items: center">
          <span style="font-size: 11px; font-weight: 600; color: #5F6980">From the app</span>{mono("37 → 16", 12, NAVY, 600)}
          <span style="font-size: 11px; font-weight: 600; color: #5F6980">From the push</span>{mono("24 → 11", 12, NAVY, 600)}
          <span style="font-size: 11px; font-weight: 600; color: #5F6980">Each next in the queue</span>{mono("2 → 1", 12, NAVY, 600)}
        </div>
      </div>
    </div>'''


# ---------------------------------------------------------------- states
def card(inner, pad=16):
    return (f'<div style="width: 360px; box-sizing: border-box; padding: {pad}px; border-radius: 20px; background: #F7F5F2; border: 1px solid #E6E3DD; display: flex; flex-direction: column; gap: 10px">{inner}</div>')


def white_row(inner, extra=""):
    return f'<div style="background: #fff; border-radius: 16px; box-shadow: inset 0 0 0 1px #E6E3DD; overflow: hidden{extra}">{inner}</div>'


def state(lbl, inner, nt):
    return f'<div style="display: flex; flex-direction: column; gap: 8px">{label(lbl)}{inner}{note(nt)}</div>'


GRACE_SEES = sees(dot("GA") + "Grace sees", "Approved", on_navy=False)
G_ROW = lambda ctrl, sub="Grace · #0555 · 1 h 05", title="Under the shop's price", extra="": nk_row("GA", title, sub, ctrl, first=True, extra_style=extra)

S_DEFAULT = state("DEFAULT", card(white_row(G_ROW(pill("Approved"))) + GRACE_SEES), "one tap answers · Iron sheet G28 · shop's 47,500")
S_PRESSED = state("PRESSED", card(white_row(G_ROW(pill("Approved", bg="#0C1326", extra="; transform: scale(.95); box-shadow: 0 0 0 4px rgba(22,32,60,.15)"))) + GRACE_SEES), "pill darkens · scales 95% · tick feel")
S_DISABLED = state("DISABLED", card(
    '<div style="border-radius: 16px; overflow: hidden">' + d7_dock("disabled").replace("border-radius: 24px 24px 0 0", "border-radius: 16px") + '</div>'),
    "#0551 · no limit picked · the button says what is missing")
S_SENDING = state("SENDING", card(white_row(G_ROW(f'<button disabled aria-busy="true" style="flex: none; height: 44px; padding: 0 14px; border: none; border-radius: 999px; background: #243052; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; cursor: default">{ic("spin", 16, 2.4)}Approved</button>')) + GRACE_SEES), "row holds · nothing else moves")
SUCCESS_CTRL = (f'<button aria-label="Undo, 8 seconds left" style="flex: none; height: 44px; padding: 0 14px; border: none; border-radius: 999px; background: #F1EEE8; color: {NAVY}; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px">{ic("undo", 14, 2.4)}Undo <span style="{MONO}">8</span></button>')
S_SUCCESS = state("SUCCESS", card(white_row(nk_row("GA", "Approved · 46,000", "#0555 · Iron sheet G28", SUCCESS_CTRL, first=True).replace(av("GA", 30), f'<span style="width: 30px; height: 30px; flex: none; border-radius: 999px; background: #E4F4EA; color: #0F6B43; display: flex; align-items: center; justify-content: center">{ic("check", 16, 2.6)}</span>'))
    + sees(dot("GA") + "Grace sees", "Approved", on_navy=False).replace("</div>", '<span style="font-family: \'IBM Plex Mono\', monospace; color: #6B7480">in 8 s</span></div>')), "Undo 10 s · then the row leaves · FAB 8 → 7")
ERR_CTRL = pill("Try again", icon="undo")
S_ERROR = state("ERROR", card(white_row(nk_row("GA", "Under the shop's price", "Not sent · 09:40", ERR_CTRL, first=True).replace("color: #6B7480; white-space", "color: #8E2A22; white-space").replace(av("GA", 30), f'<span style="width: 30px; height: 30px; flex: none; border-radius: 999px; background: #FBE5E2; color: #8E2A22; display: flex; align-items: center; justify-content: center">{ic("alert", 16)}</span>'), extra="; box-shadow: inset 0 0 0 1.5px #8E2A22")
    + f'<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #5F6980">{ic("eye", 14)}Grace still sees<span style="height: 22px; padding: 0 8px; border-radius: 999px; background: #FDEEE1; color: #7A4A02; font-weight: 700; display: inline-flex; align-items: center">Ruth decides</span></div>'), "the answer is kept · or “Someone else just did this”")
S_OFFLINE = state("OFFLINE", card(
    f'<div style="border-radius: 16px; overflow: hidden; background: #fff; box-shadow: inset 0 0 0 1px #E6E3DD">'
    f'<div style="background: {NAVY}; color: #fff; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between"><span style="font-size: 16px; font-weight: 700">Good morning, Ruth</span>'
    f'<span style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,.08); font-size: 12px; font-weight: 600; color: #F5C58A"><i style="width: 7px; height: 7px; border-radius: 999px; background: #F5A54A"></i>Offline</span></div>'
    f'<div style="background: #FDEEE1; color: #7A4A02; padding: 8px 14px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700">{ic("nosig", 16)}No signal · <span style="{MONO}">1</span> answer waits to send</div>'
    + nk_row("GA", "Approved · 46,000", "#0555 · sends when back", chip("Waits", "#FDEEE1", "#7A4A02", "clock"), first=True) + '</div>'),
    "last sync 09:38 · slides wait for signal")
S_EMPTY = state("EMPTY", card(
    '<div style="display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 17px; font-weight: 700"><i style="width: 8px; height: 8px; border-radius: 999px; background: #C9C4BA"></i><span style="flex: 1">Needs you</span>'
    f'<b style="{MONO}; font-size: 13px; font-weight: 600; color: #5F6980">0</b></div>'
    f'<div style="height: 52px; border-radius: 16px; border: 1.5px dashed #C9C4BA; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 600; color: #5F6980"><span style="color: #0F6B43; display: flex">{ic("check", 16, 2.4)}</span>Nothing waits on you</div>'
    f'<div style="position: relative; height: 84px; margin: 0 -16px -16px; border-radius: 0 0 20px 20px; overflow: hidden">{tabbar(fab_tick=True)}</div>'), "FAB shows a tick · it opens All decided")


def lock(inner):
    return (f'<div style="width: 360px; box-sizing: border-box; padding: 14px 12px 16px; border-radius: 20px; background: #0E1322; display: flex; flex-direction: column; gap: 10px">'
            f'<div style="display: flex; justify-content: space-between; padding: 0 6px; font-size: 12px; font-weight: 600; color: #B3BCD2"><span>Sat 17 Oct</span><span style="{MONO}">09:40</span></div>{inner}</div>')


def notif(title, body, actions, when="now"):
    acts = "".join(f'<button style="height: 44px; padding: 0 12px; border: none; border-radius: 999px; background: {bg}; color: {fg}; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px">{t}</button>' for t, bg, fg in actions)
    return (f'<div style="border-radius: 20px; background: #232A3D; padding: 12px 14px 10px; display: flex; flex-direction: column; gap: 6px">'
            f'<div style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: #B3BCD2"><span style="width: 18px; height: 18px; border-radius: 6px; background: {NAVY}; box-shadow: inset 0 0 0 1px rgba(255,255,255,.25); color: #fff; display: flex; align-items: center; justify-content: center">{ic("plus", 12, 2.6)}</span>Manager · {when}{ic("chev", 12, 2, " style=\"transform: rotate(90deg)\"")}</div>'
            f'<span style="font-size: 14px; font-weight: 700; color: #fff">{title}</span>'
            f'<span style="font-size: 13px; font-weight: 500; color: #D5DAE6; line-height: 1.4">{body}</span>'
            f'<div style="display: flex; gap: 6px; margin-top: 2px">{acts}</div></div>')


S_PUSH = state("PUSH · ACTION ON THE LOCK SCREEN", lock(notif("Grace · Under the shop's price · #0555",
    f'Iron sheet G28 · <span style="{MONO}">46,000</span>, shop\'s <span style="{MONO}">47,500</span> · cost <span style="{MONO}">38,000</span> · <span style="{MONO}">30</span> sht',
    [("Approved · 46,000", "#fff", NAVY)])), "D-1 from the push: 2 → 1 tap · no app opened")
S_PUSH_UNDO = state("PUSH · UNDO 10 S", lock(notif("Approved · 46,000",
    f'#0555 · Grace sees it in <span style="{MONO}">10 s</span>',
    [(f'{ic("undo", 14, 2.4)}Undo · <span style="{MONO}">10 s</span>', "rgba(255,255,255,.12)", "#fff")])), "then sent · the app shows Undo if opened in the 10 s")

STATES = [S_DEFAULT, S_PRESSED, S_DISABLED, S_SENDING, S_PUSH, S_SUCCESS, S_ERROR, S_OFFLINE, S_EMPTY, S_PUSH_UNDO]


# ---------------------------------------------------------------- top strip
def strip_chip(num, text, navy=True):
    if navy:
        return (f'<span style="display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px 0 3px; border-radius: 999px; background: rgba(255,255,255,.1); font-size: 12px; font-weight: 700; white-space: nowrap">'
                f'<b style="min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; background: #fff; color: {NAVY}; {MONO}; font-size: 11px; display: flex; align-items: center; justify-content: center">{num}</b>{text}</span>')
    return (f'<span style="display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px 0 3px; border-radius: 999px; background: #fff; font-size: 12px; font-weight: 700; white-space: nowrap">'
            f'<b style="min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; background: #A82D24; color: #fff; {MONO}; font-size: 11px; display: flex; align-items: center; justify-content: center">{num}</b>{text}</span>')


ASKS = [("1", "Under the shop's price"), ("3", "Price up"), ("7", "Not paid yet · on credit?"), ("12", "Packed short"), ("16", "Damaged"), ("18", "Return asked"), ("20", "Cancel asked"), ("24", "A carton for the shelf?")]
ANS = [("1", "Approved"), ("3", "Shop's price"), ("7", "On credit · load it"), ("12", "Bill what went"), ("16", "Written off"), ("18", "Credit note raised"), ("20", "Cancelled"), ("24", "Shelf part OK")]

TOP = f'''<div style="height: 64px; display: flex; align-items: center; gap: 24px">
    <div style="display: flex; flex-direction: column; gap: 2px; flex: none">
      <span style="font-size: 28px; font-weight: 800; letter-spacing: -.01em">Today · Decide next</span>
      <span style="{MONO}; font-size: 12px; color: #5F6980">manager.html · tab 1 of 4 + the red + · Sat 17 Oct · mirrors Agent Today</span>
    </div>
    <div style="flex: 1"></div>
    <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-end">
      <div style="display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 3px 0 14px; border-radius: 999px; background: {NAVY}; color: #fff"><span style="font-size: 12px; font-weight: 700; white-space: nowrap">Asks in</span>{"".join(strip_chip(n, t) for n, t in ASKS)}</div>
      <div style="display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 3px 0 14px; border-radius: 999px; background: #FDE8E4; color: #A82D24"><span style="font-size: 12px; font-weight: 700; white-space: nowrap">Answers out</span>{"".join(strip_chip(n, t + " " + ic("bell", 12), False) for n, t in ANS)}</div>
    </div>
  </div>'''

ROW1 = ('<div style="display: flex; gap: 40px; align-items: flex-start">'
        + column("1 · TODAY · 09:40", P1, "On the row, the answer they see: D-1 · D-3 · D-7 · D-12 · D-20 · D-24 → 2 taps · Open + slide D-16 · D-18 → 2")
        + column("2 · DECIDE NEXT · 1 OF 8 · 09:40", P2, "Not paid yet · on credit? (D-7): 6 → 2 from the app · 5 → 1 from the push · red + opens the oldest in 1 tap")
        + column("3 · ANSWERED · THE NEXT SLIDES IN · 09:41", P3, "Next decision: 2 → 1 (0 to reach it) · Return asked (D-18): 4 → 2 from the app · push 2 → 2 (a slide) · Kept as sold 2 → 1")
        + column("4 · ALL DECIDED · 09:59", P4, "8 decisions: 37 → 16 taps from the app · 24 → 11 from the push · 0 for the bill that billed itself")
        + score_panel() + '</div>')

ROW2 = ('<div style="display: grid; grid-template-columns: repeat(5, 360px); gap: 20px 40px">' + "".join(STATES) + '</div>')

HTML = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Manager Today</title>
<script src="./support.js"></script></head><body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&amp;family=IBM+Plex+Mono:wght@500;600&amp;display=swap">
<style>body{{margin:0}} a{{color:#16203C}}a:hover{{color:#C93A30}} button{{font-family:inherit;cursor:pointer;margin:0}} svg{{flex:none}}</style>
</helmet>
<div style="width: 2040px; height: 1720px; box-sizing: border-box; padding: 40px; background: #F7F5F2; font-family: Figtree, system-ui, sans-serif; color: #1C2233; display: flex; flex-direction: column; gap: 24px; overflow: hidden">

  <!-- ============ TOP STRIP ============ -->
  {TOP}

  <!-- ============ ROW 1 · Today, Decide next, answered, all decided + scores ============ -->
  {ROW1}

  <!-- ============ ROW 2 · STATES ============ -->
  {ROW2}

</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":2040,"height":1720}}}}'>
class Component extends DCLogic {{ renderVals() {{ return {{}}; }} }}
</script></body></html>
'''

open(OUT, "w").write(HTML)
print("wrote", OUT, len(HTML))
