#!/usr/bin/env python3
# Generates docs/canvas/manager/Orders.dc.html (literal markup).
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'Orders.dc.html')

NAVY = "#16203C"; BG = "#F7F5F2"; LINE = "#E6E3DD"; TILE = "#F1EEE8"
INK = "#1C2233"; SOFT = "#5F6980"; FAINT = "#6B7480"; ONNAVY = "#B3BCD2"
RED = "#C93A30"; REDD = "#A82D24"; REDS = "#FDE8E4"
GOOD = "#0F6B43"; GOODB = "#E4F4EA"; WARN = "#95530C"; WARNB = "#FDEEE1"; WARNI = "#7A4A02"
BAD = "#8E2A22"; BADB = "#FBE5E2"; MINT = "#6FDCB0"
MONO = "font-family: 'IBM Plex Mono', ui-monospace, monospace"

PEOPLE = {
  "RN": ("#16203C", "#FFFFFF"), "GA": ("#DCEAF8", "#1A5A8A"), "BO": ("#DDF1EE", "#0E5E57"),
  "FN": ("#F6E4F1", "#7A3268"), "DO": ("#E4E6FA", "#3A3F9B"), "MK": ("#E4F4EA", "#0F6B43"),
  "JN": ("#FDEEE1", "#7A4A02"), "EA": ("#E8EBF0", "#3D4A5C"), "ML": ("#F1EEE8", "#1C2233"),
  "PS": ("#F1EEE8", "#1C2233"),
}

IC = {
 "home": '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
 "orders": '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4"/>',
 "wallet": '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
 "team": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
 "plus": '<path d="M12 5v14M5 12h14"/>',
 "search": '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 "back": '<path d="m15 18-6-6 6-6"/>',
 "chev": '<path d="m9 18 6-6-6-6"/>',
 "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
 "check": '<path d="M20 6 9 17l-5-5"/>',
 "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 "send": '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
 "undo": '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/>',
 "alert": '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
 "wifioff": '<path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5.2-2.8M19 12.5a10 10 0 0 0-2.5-1.8M12 20h.01"/>',
 "receipt": '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
 "bolt": '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
 "copy": '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
 "truck": '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
 "lock": '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
 "arrow": '<path d="M5 12h14M13 6l6 6-6 6"/>',
 "dbl": '<path d="m6 17 5-5-5-5M13 17l5-5-5-5"/>',
 "box": '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
 "cart": '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11.5l2-8H6.2"/>',
 "eye": '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 "spin": '<path d="M12 3a9 9 0 1 0 9 9"/>',
 "tag": '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
}

def ic(name, size=16, color="currentColor", sw=2, extra=""):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"{extra}>{IC[name]}</svg>')

def av(code, size=38, ring=None, fs=None):
    bg, fg = PEOPLE.get(code, (TILE, INK))
    fs = fs or (13 if size >= 34 else 11)
    r = f"box-shadow: 0 0 0 2px {ring};" if ring else ""
    return (f'<span style="width: {size}px; height: {size}px; flex: none; border-radius: 999px; background: {bg}; color: {fg}; '
            f'display: flex; align-items: center; justify-content: center; font-size: {fs}px; font-weight: 700; {r}">{code}</span>')

def cust(code, size=38):
    return (f'<span style="width: {size}px; height: {size}px; flex: none; border-radius: 12px; background: {TILE}; color: {INK}; '
            f'display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700">{code}</span>')

def m(t, size=11, color=SOFT, w=500, extra=""):
    return f'<span style="{MONO}; font-size: {size}px; font-weight: {w}; color: {color}; {extra}">{t}</span>'

def pill(label, icon=None, kind="navy", h=36, extra="", aria=None):
    st = {
      "navy": f"background: {NAVY}; color: #fff;",
      "ghost": f"background: #fff; color: {INK}; box-shadow: inset 0 0 0 1px {LINE};",
      "soft": f"background: {TILE}; color: {INK};",
      "good": f"background: {GOODB}; color: {GOOD};",
      "warn": f"background: {WARNB}; color: {WARNI};",
      "bad": f"background: {BADB}; color: {BAD};",
      "red": f"background: {REDS}; color: {REDD};",
    }[kind]
    i = ic(icon, 15) if icon else ""
    a = f' aria-label="{aria}"' if aria else ""
    return (f'<button{a} style="all: unset; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 6px; '
            f'height: {h}px; min-width: 44px; padding: 0 14px; border-radius: 999px; font-size: 13px; font-weight: 700; white-space: nowrap; flex: none; {st} {extra}">{i}{label}</button>')

def chip(label, kind="soft"):
    st = {"good": (GOODB, GOOD), "warn": (WARNB, WARNI), "bad": (BADB, BAD), "soft": (TILE, INK), "navy": (NAVY, "#fff"), "red": (REDS, REDD)}[kind]
    return (f'<span style="display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 999px; '
            f'background: {st[0]}; color: {st[1]}; font-size: 11px; font-weight: 700; white-space: nowrap; flex: none">{label}</span>')

def sees(code, name, words, dashed=True, bell=True):
    b = ic("bell", 14, SOFT) if bell else ""
    border = f"1px dashed {LINE}" if dashed else f"1px solid {LINE}"
    return (f'<div style="display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 6px 10px; border-radius: 12px; border: {border}; background: #fff">'
            f'{av(code, 24, fs=10)}<span style="flex: 1; min-width: 0; font-size: 12px; font-weight: 600; color: {SOFT}">{name} sees: <b style="color: {INK}">{words}</b></span>{b}</div>')

def agebar(pct, over=False, limit_pct=None, h=4):
    # pct of the limit (0-100+). The track shows 0..150% of the limit; a tick marks the limit.
    span = 150.0
    w = min(pct, span) / span * 100
    lim = 100 / span * 100
    col = BAD if over else (WARN if pct >= 75 else GOOD)
    return (f'<span style="position: relative; display: block; height: {h}px; border-radius: 999px; background: {TILE}">'
            f'<span style="position: absolute; left: 0; top: 0; bottom: 0; width: {w:.1f}%; border-radius: 999px; background: {col}"></span>'
            f'<span style="position: absolute; left: {lim:.1f}%; top: -3px; width: 2px; height: {h+6}px; border-radius: 2px; background: {INK}"></span></span>')

# ---------------------------------------------------------------- shells
def tabbar(badge="8", active="Orders"):
    def tab(name, icon):
        on = name == active
        col = INK if on else SOFT
        fw = 700 if on else 600
        bar = f'<i style="position: absolute; top: -8px; width: 24px; height: 3px; border-radius: 3px; background: {NAVY}"></i>' if on else ""
        return (f'<button style="all: unset; box-sizing: border-box; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-height: 52px; color: {col}; font-size: 12px; font-weight: {fw}">'
                f'{bar}{ic(icon, 24, sw=2.2 if on else 2)}{name}</button>')
    fab = (f'<button aria-label="Decide next · {badge} waiting" style="all: unset; box-sizing: border-box; justify-self: center; margin-top: -26px; width: 64px; height: 64px; border-radius: 999px; background: {RED}; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(201,58,48,.35); border: 4px solid {BG}; position: relative">'
           f'{ic("plus", 28, sw=2.4)}<span style="position: absolute; top: -4px; right: -4px; min-width: 22px; height: 22px; padding: 0 6px; box-sizing: border-box; border-radius: 999px; background: {NAVY}; color: #fff; {MONO}; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; border: 2px solid {BG}">{badge}</span></button>')
    return (f'<div style="position: absolute; left: 0; right: 0; bottom: 0; height: 76px; box-sizing: border-box; background: #fff; border-top: 1px solid {LINE}; display: grid; grid-template-columns: 1fr 1fr 96px 1fr 1fr; align-items: start; padding: 8px 0 0">'
            f'{tab("Today","home")}{tab("Orders","orders")}{fab}{tab("Money","wallet")}{tab("Team","team")}</div>')

def phone(label, time, inner, taps):
    return (f'<div style="display: flex; flex-direction: column; gap: 8px; width: 360px; flex: none">'
            f'<div style="font-size: 11px; font-weight: 700; letter-spacing: .08em; color: {SOFT}; height: 14px">{label} · {m(time, 11, SOFT, 600)}</div>'
            f'<div style="position: relative; width: 360px; height: 780px; box-sizing: border-box; border-radius: 32px; border: 1px solid {LINE}; overflow: hidden; background: {BG}">{inner}</div>'
            f'<div style="{MONO}; font-size: 12px; color: {SOFT}; padding: 4px 4px 0; line-height: 1.45">{taps}</div></div>')

def card(inner, extra=""):
    return f'<div style="background: #fff; border: 1px solid {LINE}; border-radius: 16px; {extra}">{inner}</div>'

def sec(title, count, dot=None, right=""):
    d = f'<i style="width: 8px; height: 8px; border-radius: 999px; background: {dot}; flex: none"></i>' if dot else ""
    return (f'<div style="display: flex; align-items: center; gap: 8px; height: 22px">{d}<span style="font-size: 17px; font-weight: 700">{title}</span>'
            f'{m(count, 13, SOFT, 600)}<span style="flex: 1"></span>{right}</div>')

# ---------------------------------------------------------------- order row
def orow(asker, num, customer, amount, sub, age, pct, holder, holder_name, over=False, action="", subcol=FAINT, border=LINE, bg="#fff"):
    act = f'<div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 2px">{action}</div>' if action else ""
    agecol = BAD if over else SOFT
    return (f'<div style="background: {bg}; border: 1px solid {border}; border-radius: 16px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px">'
            f'<div style="display: flex; align-items: center; gap: 10px">'
            f'{av(asker, 36)}'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">'
            f'<div style="display: flex; align-items: baseline; gap: 6px; min-width: 0">{m(num, 12, SOFT, 600)}<span style="font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{customer}</span></div>'
            f'{m(sub, 11, subcol, 500, "white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}</div>'
            f'<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex: none">{m(amount, 14, INK, 600)}'
            f'<span style="display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: {SOFT}">{av(holder, 20, fs=9)}{holder_name}</span></div></div>'
            f'<div style="display: flex; align-items: center; gap: 8px"><span style="flex: 1">{agebar(pct, over)}</span>{m(age, 11, agecol, 600, "white-space: nowrap")}</div>'
            f'{act}</div>')

# ---------------------------------------------------------------- hero stage columns (mirrors Agent Clients week columns)
def stagecols(active=None):
    cols = [
      ("Checking", "3", ["BO", "GA", "GA"], "late", "2"),
      ("Buying", "2", ["FN", "GA"], "", "1"),
      ("Packing", "2", ["BO", "FN"], "", "2"),
      ("On the road", "1", ["BO"], "", ""),
      ("Delivered", "2", ["BO", "GA"], "done", ""),
    ]
    out = []
    for name, n, dots, kind, need in cols:
        if kind == "late":
            box = "background: rgba(240,138,126,.16); box-shadow: inset 0 0 0 1px rgba(240,138,126,.45);"; ncol = "#F7A196"; lcol = "#F7A196"
        elif kind == "done":
            box = "background: rgba(111,220,176,.12);"; ncol = MINT; lcol = MINT
        else:
            box = "background: rgba(255,255,255,.06);"; ncol = "#fff"; lcol = "#8D99B5"
        if active == name:
            box = "background: #fff;"; ncol = NAVY
        ds = "".join(f'<i style="width: 12px; height: 12px; border-radius: 999px; background: {PEOPLE[d][0]}; box-shadow: 0 0 0 2px {"#fff" if active==name else NAVY}; margin-left: {0 if j==0 else -4}px"></i>' for j, d in enumerate(dots))
        badge = (f'<span style="position: absolute; top: -6px; right: -4px; min-width: 18px; height: 18px; padding: 0 4px; box-sizing: border-box; border-radius: 999px; background: {RED}; color: #fff; {MONO}; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px {NAVY}">{need}</span>') if need else ""
        out.append(f'<button style="all: unset; box-sizing: border-box; flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px">'
                   f'<span style="position: relative; width: 100%; height: 64px; border-radius: 14px; {box} display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 9px 0 10px; box-sizing: border-box">'
                   f'<b style="{MONO}; font-size: 17px; font-weight: 600; line-height: 1; color: {ncol}">{n}</b><span style="display: flex">{ds}</span>{badge}</span>'
                   f'<span style="font-size: 11px; font-weight: 700; color: {lcol}; white-space: nowrap">{name}</span></button>')
    return f'<div style="display: flex; gap: 5px">{"".join(out)}</div>'

def fchips(items):
    out = []
    for label, n, on, dot in items:
        st = f"background: {NAVY}; color: #fff;" if on else f"background: #fff; color: {INK}; box-shadow: inset 0 0 0 1px {LINE};"
        d = f'<i style="width: 8px; height: 8px; border-radius: 999px; background: {dot}"></i>' if dot else ""
        out.append(f'<button style="all: unset; box-sizing: border-box; flex: none; height: 36px; padding: 0 12px; border-radius: 999px; {st} font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px">{d}{label} <b style="{MONO}; font-weight: 600; opacity: .75">{n}</b></button>')
    return f'<div style="display: flex; gap: 6px; overflow: hidden">{"".join(out)}</div>'

# ================================================================ PAGE 1 · Orders list
def page1():
    hero = (f'<div style="background: {NAVY}; color: #fff; border-radius: 0 0 28px 28px; padding: 16px 16px 16px; display: flex; flex-direction: column; gap: 14px">'
            f'<div style="display: flex; align-items: center; gap: 10px"><span style="flex: 1; display: flex; align-items: baseline; gap: 8px; font-size: 26px; font-weight: 800; letter-spacing: -.02em">Orders {m("10", 16, MINT, 600)}</span>'
            f'<button aria-label="Search orders" style="all: unset; width: 44px; height: 44px; border-radius: 999px; background: rgba(255,255,255,.10); display: flex; align-items: center; justify-content: center">{ic("search", 20, "#fff")}</button></div>'
            f'{stagecols()}'
            f'<div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: {ONNAVY}"><span style="color: #F7A196">1 stuck</span><span>5 wait on you</span><span>{m("8,810,000", 11, ONNAVY, 600)} on the move</span></div></div>')
    rows = (
      sec("Stuck", "1", RED) +
      orow("BO", "#0554", "Lubowa Builders", "450,000", "Timber 2×4 · asked Ndeeba", "2 h 40 m / 2 h", 133, "DO", "Denis", over=True,
           action=f'<button aria-label="Give it to Moses" style="all: unset; box-sizing: border-box; height: 36px; padding: 0 12px 0 4px; border-radius: 999px; box-shadow: inset 0 0 0 1px {LINE}; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700">{av("ML", 28, fs=10)}Give it to Moses</button>' + pill("Nudge Denis", "send"),
           border="#E9B8B2") +
      sec("Checking", "2") +
      orow("GA", "#0555", "Kyaligonza &amp; Sons", "1,380,000", "Under the shop's price", "1 h 05 m / 2 h", 54, "RN", "Ruth", subcol=WARNI) +
      orow("GA", "#0556", "Ggaba Stores", "430,000", "Cancel asked", "0 h 50 m / 2 h", 42, "RN", "Ruth", subcol=WARNI) +
      sec("Buying", "2")
    )
    body = f'<div style="padding: 14px 16px 0; display: flex; flex-direction: column; gap: 10px">{fchips([("All","10",True,None),("Stuck","1",False,RED),("Ruth decides","5",False,None)])}{rows}</div>'
    return hero + body + tabbar("8")

# ================================================================ PAGE 2 · one order
def track(cur=1):
    names = ["Checking", "Buying", "Packing", "On the road", "Delivered"]
    segs, labs = [], []
    for i, n in enumerate(names):
        if i < cur: c = MINT
        elif i == cur: c = "#fff"
        else: c = "rgba(255,255,255,.14)"
        segs.append(f'<span style="flex: 1; height: 6px; border-radius: 999px; background: {c}"></span>')
        lc = "#fff" if i == cur else ("#8D99B5" if i > cur else MINT)
        labs.append(f'<span style="flex: 1; font-size: 11px; font-weight: 700; color: {lc}; white-space: nowrap; text-align: center">{n}</span>')
    return (f'<div style="display: flex; flex-direction: column; gap: 6px"><div style="display: flex; gap: 4px">{"".join(segs)}</div>'
            f'<div style="display: flex; gap: 4px">{"".join(labs)}</div></div>')

def line_card(icon, icol, ibg, name, qty, sub, state):
    return (f'<div style="background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 10px 12px; display: flex; align-items: center; gap: 10px">'
            f'<span style="width: 38px; height: 38px; border-radius: 12px; background: {ibg}; color: {icol}; display: flex; align-items: center; justify-content: center; flex: none">{ic(icon, 18)}</span>'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">{name}</span>{m(qty, 11, FAINT)}{m(sub, 11, FAINT)}</div>'
            f'{state}</div>')

def page2():
    hero = (f'<div style="background: {NAVY}; color: #fff; border-radius: 0 0 28px 28px; padding: 14px 16px 18px; display: flex; flex-direction: column; gap: 12px">'
            f'<div style="display: flex; align-items: center; gap: 10px">'
            f'<button aria-label="Back to Orders" style="all: unset; width: 44px; height: 44px; border-radius: 999px; background: rgba(255,255,255,.10); display: flex; align-items: center; justify-content: center; flex: none">{ic("back", 20, "#fff")}</button>'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 19px; font-weight: 800; white-space: nowrap">Mukono Roofing</span>'
            f'<span style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: {ONNAVY}; white-space: nowrap">{av("FN", 20, fs=9)}From Faith · {m("#0552", 12, "#fff", 600)}</span></div></div>'
            f'<div style="display: flex; align-items: baseline; justify-content: space-between"><span style="display: flex; align-items: baseline; gap: 6px">{m("1,210,000", 28, "#fff", 600, "letter-spacing: -.02em; line-height: 1")}<span style="font-size: 13px; font-weight: 700; color: {ONNAVY}">UGX</span></span>{m("2 lines", 11, ONNAVY, 600)}</div>'
            f'{track(1)}</div>')
    holds = (f'<div style="background: #fff; border: 1.5px solid {NAVY}; border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 10px">'
             f'<div style="display: flex; align-items: center; gap: 10px">{av("RN", 36)}'
             f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">Price up · Ruth decides</span>{m("From Denis · 07:30 · 2 h 10 m", 11, FAINT)}</div>'
             f'{av("DO", 26, fs=10)}</div>'
             # the ladder
             f'<div style="position: relative; height: 40px">'
             f'<span style="position: absolute; left: 0; right: 0; top: 10px; height: 6px; border-radius: 999px; background: {TILE}"></span>'
             f'<span style="position: absolute; left: 0; width: 42%; top: 10px; height: 6px; border-radius: 999px 0 0 999px; background: {BADB}"></span>'
             f'<span style="position: absolute; left: 33%; top: 6px; width: 2px; height: 14px; background: {SOFT}"></span>'
             f'<span style="position: absolute; left: 42%; top: 4px; width: 3px; height: 18px; background: {BAD}"></span>'
             f'<span style="position: absolute; right: 0; top: 2px; width: 22px; height: 22px; border-radius: 999px; background: {NAVY}; box-shadow: 0 0 0 3px #fff"></span>'
             f'<span style="position: absolute; left: 0; top: 26px">{m("sells 26,000", 11, SOFT, 600)}</span>'
             f'<span style="position: absolute; left: 40%; top: 26px">{m("cost 27,000", 11, BAD, 600)}</span>'
             f'<span style="position: absolute; right: 0; top: 26px">{m("shop\'s 33,750", 11, INK, 600)}</span></div>'
             f'{m("10 pcs · under cost by 1,000", 11, BAD, 600)}'
             f'<div style="display: flex; align-items: center; gap: 8px">{pill("Other price", kind="ghost", h=44)}{pill("Shop&#39;s price 33,750", "check", h=44, extra="flex: 1")}</div></div>')
    lines = (sec("Lines", "2") +
             line_card("check", GOOD, GOODB, "Iron sheet G28", "20 sht × 47,500 = 950,000", "Namanve Sheets", chip("Found", "good")) +
             line_card("tag", WARN, WARNB, "Ridge cap 3 m", "10 pcs × 26,000 = 260,000", "cost 24,000 → 27,000", chip("Price up", "warn")))
    nxt = (f'<div style="display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 4px">{ic("cart", 16, SOFT)}'
           f'<span style="font-size: 12px; font-weight: 600; color: {SOFT}">Then</span>{av("DO", 22, fs=9)}<span style="font-size: 12px; font-weight: 700">Denis buys</span>{m("· trip 11:30", 11, SOFT, 600)}</div>')
    body = (f'<div style="padding: 14px 16px 0; display: flex; flex-direction: column; gap: 10px">'
            f'{sec("Waits on", "1", RED)}{holds}{sees("FN", "Faith", "Price set · Tell them")}{lines}</div>')
    return hero + body + tabbar("8")

# ================================================================ PAGE 3 · stuck order, answered in place
def page3():
    hero = (f'<div style="background: {NAVY}; color: #fff; border-radius: 0 0 28px 28px; padding: 16px 16px 16px; display: flex; flex-direction: column; gap: 14px">'
            f'<div style="display: flex; align-items: center; gap: 10px"><span style="flex: 1; display: flex; align-items: baseline; gap: 8px; font-size: 26px; font-weight: 800; letter-spacing: -.02em">Stuck {m("1", 16, "#F7A196", 600)}</span>'
            f'<button aria-label="Search orders" style="all: unset; width: 44px; height: 44px; border-radius: 999px; background: rgba(255,255,255,.10); display: flex; align-items: center; justify-content: center">{ic("search", 20, "#fff")}</button></div>'
            f'{stagecols("Checking")}</div>')
    gauge = (f'<div style="display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 12px; background: {BADB}">'
             f'<div style="display: flex; align-items: baseline; justify-content: space-between">{m("2 h 40 m", 18, BAD, 600)}{m("in Checking · limit 2 h", 11, BAD, 600)}</div>'
             f'<span style="position: relative; display: block; height: 8px; border-radius: 999px; background: #fff">'
             f'<span style="position: absolute; left: 0; top: 0; bottom: 0; width: 75%; border-radius: 999px 0 0 999px; background: {WARN}"></span>'
             f'<span style="position: absolute; left: 75%; top: 0; bottom: 0; width: 25%; border-radius: 0 999px 999px 0; background: {BAD}"></span>'
             f'<span style="position: absolute; left: 75%; top: -3px; width: 2px; height: 14px; background: {INK}"></span></span>'
             f'<div style="display: flex; justify-content: space-between">{m("07:00 placed", 11, SOFT, 600)}{m("09:00 limit", 11, INK, 600)}{m("40 m over", 11, BAD, 600)}</div></div>')
    waits = (f'<div style="display: flex; align-items: center; gap: 10px">'
             f'<span style="width: 38px; height: 38px; border-radius: 12px; background: {WARNB}; color: {WARN}; display: flex; align-items: center; justify-content: center; flex: none">{ic("clock", 18)}</span>'
             f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Timber 2×4 · 40 pcs</span>{m("asked Ndeeba · 07:00 · no reply", 11, FAINT)}</div></div>')
    holder = (f'<div style="display: flex; align-items: center; gap: 10px">{av("DO", 36)}'
              f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Denis holds it</span>{m("trip at 11:30", 11, FAINT)}</div>'
              f'{pill("Nudge Denis", "send", h=44)}</div>')
    words = (f'<div style="display: flex; gap: 8px; padding: 10px 12px; border-radius: 12px; background: {TILE}">{ic("bell", 14, SOFT)}'
             f'<span style="font-size: 12px; font-weight: 600; color: {SOFT}; line-height: 1.4">Denis sees: <b style="color: {INK}">Ruth nudged you</b> · #0554 has waited 2 h 40 m in Checking. Can you sort it now?</span></div>')
    give = (f'<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 12px; font-weight: 700; color: {SOFT}">Give it to</span>'
            f'<div style="display: flex; gap: 8px">'
            f'<button style="all: unset; box-sizing: border-box; flex: 1; height: 52px; padding: 0 10px; border-radius: 14px; box-shadow: inset 0 0 0 1px {LINE}; display: flex; align-items: center; gap: 8px">{av("ML", 32)}<span style="display: flex; flex-direction: column"><b style="font-size: 13px">Moses</b>{m("finds items", 11, FAINT)}</span></button>'
            f'<button style="all: unset; box-sizing: border-box; flex: 1; height: 52px; padding: 0 10px; border-radius: 14px; box-shadow: inset 0 0 0 1px {LINE}; display: flex; align-items: center; gap: 8px">{av("RN", 32)}<span style="display: flex; flex-direction: column"><b style="font-size: 13px">Me</b>{m("move it on", 11, FAINT)}</span></button>'
            f'</div></div>')
    big = (f'<div style="background: #fff; border: 1.5px solid #E9B8B2; border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 12px">'
           f'<div style="display: flex; align-items: center; gap: 10px">{av("BO", 36)}<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">'
           f'<div style="display: flex; align-items: baseline; gap: 6px">{m("#0554", 12, SOFT, 600)}<span style="font-size: 15px; font-weight: 700">Lubowa Builders</span></div>{m("From Brian · 1 line", 11, FAINT)}</div>{m("450,000", 14, INK, 600)}</div>'
           f'{gauge}{waits}<div style="height: 1px; background: {TILE}"></div>{holder}{words}{give}</div>')
    body = (f'<div style="padding: 14px 16px 0; display: flex; flex-direction: column; gap: 10px">'
            f'{big}{sees("BO", "Brian", "Checking · Moses", bell=False)}</div>')
    return hero + body + tabbar("8")

# ================================================================ PAGE 4 · Invoices to bill (10:05, after the 10:00 run)
def page4():
    hero = (f'<div style="background: {NAVY}; color: #fff; border-radius: 0 0 28px 28px; padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 10px">'
            f'<div style="display: flex; align-items: center; gap: 10px">'
            f'<button aria-label="Back to Orders" style="all: unset; width: 44px; height: 44px; border-radius: 999px; background: rgba(255,255,255,.10); display: flex; align-items: center; justify-content: center; flex: none">{ic("back", 20, "#fff")}</button>'
            f'<span style="flex: 1; display: flex; align-items: baseline; gap: 8px; font-size: 22px; font-weight: 800">To bill {m("4", 15, MINT, 600)}</span>'
            f'<span style="display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 999px; background: rgba(111,220,176,.16); color: {MINT}; font-size: 12px; font-weight: 700">{ic("bolt", 13)}Run {m("10:00", 12, MINT, 600)}</span></div>'
                        f'<span style="display: flex; align-items: baseline; gap: 6px">{m("1,173,567", 32, "#fff", 600, "letter-spacing: -.02em; line-height: 1")}<span style="font-size: 14px; font-weight: 700; color: {ONNAVY}">UGX</span></span>'
            f'<div style="display: flex; gap: 3px; height: 8px"><i style="width: 63.7%; border-radius: 999px; background: {MINT}"></i><i style="flex: 1; border-radius: 999px; background: #F7A196"></i></div>'
            f'<div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700"><span style="color: {MINT}">Bills itself · {m("748,000", 11, MINT, 600)}</span><span style="color: #F7A196">Can\'t bill itself · {m("425,567", 11, "#F7A196", 600)}</span></div>'
            f'<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: {ONNAVY}">{ic("check", 14, MINT)}{m("08:30", 12, "#fff", 600)} #0546 billed itself · Esther sees it</div>'
            f'</div>')
    def cant(asker, num, cust_, amount, why, ev, btn):
        return (f'<div style="background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 10px 12px; display: flex; align-items: center; gap: 10px">'
                f'{av(asker, 36)}<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">'
                f'<div style="display: flex; align-items: baseline; gap: 6px; min-width: 0">{m(num, 12, SOFT, 600)}<span style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{cust_}</span></div>'
                f'<span style="font-size: 12px; font-weight: 700; color: {WARNI}">{why}</span>{m(ev, 11, FAINT, 500, "white-space: nowrap; overflow: hidden; text-overflow: ellipsis")}</div>{btn}</div>')
    twice = (f'<div style="background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px">'
             f'<div style="display: flex; align-items: center; gap: 10px">'
             f'<span style="width: 36px; height: 36px; border-radius: 12px; background: {WARNB}; color: {WARN}; display: flex; align-items: center; justify-content: center; flex: none">{ic("copy", 18)}</span>'
             f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Taken twice? · Kato</span>'
             f'{m("#0544 = #0545 · 320,000", 11, FAINT)}</div>{pill("Both are real", kind="ghost", h=36)}</div>'
             f'<div style="display: flex; align-items: center; gap: 8px">'
             f'<div style="flex: 1; position: relative; height: 44px; border-radius: 999px; background: {NAVY}; display: flex; align-items: center">'
             f'<span style="position: absolute; left: 4px; top: 4px; width: 36px; height: 36px; border-radius: 999px; background: {RED}; color: #fff; display: flex; align-items: center; justify-content: center">{ic("dbl", 18)}</span>'
             f'<span style="flex: 1; text-align: center; padding-left: 36px; font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap">Cancel #0545 · keep #0544</span></div></div></div>')
    def selfrow(num, cust_, amount, when, left_pct, left):
        circ = 2 * 3.14159 * 15
        dash = circ * left_pct
        return (f'<div style="background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 8px 12px; display: flex; align-items: center; gap: 10px; min-height: 60px; box-sizing: border-box">'
                f'<span style="position: relative; width: 38px; height: 38px; flex: none"><svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="15" fill="none" stroke="{TILE}" stroke-width="4"/>'
                f'<circle cx="19" cy="19" r="15" fill="none" stroke="{GOOD}" stroke-width="4" stroke-linecap="round" stroke-dasharray="{dash:.1f} {circ:.1f}" transform="rotate(-90 19 19)"/></svg>'
                f'<span style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: {GOOD}">{ic("bolt", 14)}</span></span>'
                f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><div style="display: flex; align-items: baseline; gap: 6px">{m(num, 12, SOFT, 600)}<span style="font-size: 14px; font-weight: 700; white-space: nowrap">{cust_}</span></div>'
                f'{m(when, 11, FAINT)}</div>'
                f'<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px">{m(amount, 13, INK, 600)}{m(left, 11, GOOD, 600)}</div></div>')
    body = (f'<div style="padding: 12px 16px 0; display: flex; flex-direction: column; gap: 8px">'
            f'{sec("Can&#39;t bill itself", "2", RED)}'
            f'{cant("GA", "#0561", "Walk-in", "567", "Only 567 · check it", "567 · 1 line · typed 567", pill("Bill 567"))}'
            f'{cant("FN", "#0562", "Mukono Roofing", "425,000", "Price coming", "Cement · 425,000", pill("Set 42,500"))}'
            f'{twice}'
            f'{sec("Bills itself", "2", None, m("24 h after delivery", 11, SOFT, 600))}'
            f'{selfrow("#0548", "Kato Construction", "430,000", "Fri 16:10 · Ssali", 0.254, "in 6 h 05 m")}'
            f'{selfrow("#0557", "Lubowa Builders", "318,000", "Today 08:50 · Ssali", 0.948, "in 22 h 45 m")}'
            f'</div>')
    return hero + body + tabbar("2")

# ================================================================ STATES
def scard(name, inner):
    return (f'<div style="display: flex; flex-direction: column; gap: 6px; width: 360px; flex: none">'
            f'<span style="font-size: 11px; font-weight: 700; letter-spacing: .08em; color: {SOFT}">{name}</span>'
            f'<div style="height: 300px; box-sizing: border-box; border-radius: 20px; border: 1px solid {LINE}; background: {BG}; padding: 14px; display: flex; flex-direction: column; gap: 10px; overflow: hidden">{inner}</div></div>')

def lock(title, body, action, app="Manager · now"):
    return (f'<div style="background: #0E1426; border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 8px">'
            f'<div style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: {ONNAVY}">'
            f'<span style="width: 18px; height: 18px; border-radius: 6px; background: {NAVY}; color: #fff; display: flex; align-items: center; justify-content: center">{ic("orders", 11)}</span>{app}</div>'
            f'<div style="background: #1E2740; border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px">'
            f'<span style="font-size: 13px; font-weight: 700; color: #fff">{title}</span>{body}'
            f'<div style="display: flex; gap: 16px; margin-top: 4px">{action}</div></div></div>')

def stuckmini(btn, extra_border=None, bg="#fff", sub="Timber 2×4 · asked Ndeeba"):
    b = extra_border or "#E9B8B2"
    return orow("BO", "#0554", "Lubowa Builders", "450,000", sub, "2 h 40 m / 2 h", 133, "DO", "Denis", over=True, action=btn, border=b, bg=bg)

def states():
    giveb = f'<button aria-label="Give it to Moses" style="all: unset; box-sizing: border-box; height: 36px; padding: 0 12px 0 4px; border-radius: 999px; box-shadow: inset 0 0 0 1px {LINE}; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700">{av("ML", 28, fs=10)}Give it to Moses</button>'
    s = []
    # DEFAULT: push on the lock screen with its one safe answer
    s.append(scard("DEFAULT · PUSH", lock("Can't bill itself · Only 567 · #0561",
        m("Walk-in · 1 line · typed 567", 12, ONNAVY) + m("Grace's counter sale · delivered 09:20", 12, ONNAVY),
        f'<span style="font-size: 13px; font-weight: 700; color: {MINT}; height: 32px; display: flex; align-items: center">Bill 567</span><span style="font-size: 13px; font-weight: 700; color: {ONNAVY}; height: 32px; display: flex; align-items: center">Open</span>')
        + sees("GA", "Grace", "Can't bill itself") + m("push 3 → 1 tap · app 4 → 2", 11, SOFT)))
    # PRESSED
    s.append(scard("PRESSED", stuckmini(giveb + pill("Nudge Denis", "send", extra=f"background: #243052; box-shadow: 0 0 0 3px rgba(22,32,60,.22); transform: scale(.97);"), extra_border=NAVY)
        + sees("DO", "Denis", "Ruth nudged you")))
    # DISABLED
    s.append(scard("DISABLED", f'<div style="background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 10px 12px; display: flex; align-items: center; gap: 10px">'
        f'{av("FN", 36)}<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><div style="display: flex; gap: 6px; align-items: baseline">{m("#0562", 12, SOFT, 600)}<span style="font-size: 14px; font-weight: 700">Mukono Roofing</span></div>'
        f'<span style="font-size: 12px; font-weight: 700; color: {WARNI}">Price coming</span>{m("no cost yet · Denis buys it", 11, FAINT)}</div>'
        f'<button disabled style="all: unset; box-sizing: border-box; height: 36px; padding: 0 12px; border-radius: 999px; background: {TILE}; color: {SOFT}; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px">{ic("lock", 14)}Set price</button></div>'
        f'<div style="background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 10px 12px; display: flex; align-items: center; gap: 10px">'
        f'<span style="width: 36px; height: 36px; border-radius: 12px; background: {TILE}; color: {SOFT}; display: flex; align-items: center; justify-content: center; flex: none">{ic("copy", 18)}</span>'
        f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Taken twice? · Kato</span>{m("#0545 is paid · open it to refund", 11, FAINT)}</div></div>'
        f'<div style="position: relative; height: 44px; border-radius: 999px; background: {TILE}; display: flex; align-items: center">'
        f'<span style="position: absolute; left: 4px; top: 4px; width: 36px; height: 36px; border-radius: 999px; background: #C9C4BA; color: #fff; display: flex; align-items: center; justify-content: center">{ic("lock", 16)}</span>'
        f'<span style="flex: 1; text-align: center; padding-left: 36px; font-size: 13px; font-weight: 700; color: {SOFT}">Paid · open the order</span></div>'))
    # SENDING
    s.append(scard("SENDING", stuckmini(giveb + f'<button style="all: unset; box-sizing: border-box; height: 36px; padding: 0 14px; border-radius: 999px; background: {NAVY}; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px">{ic("spin", 15, sw=2.4)}Nudging</button>')
        + sees("DO", "Denis", "Ruth nudged you")))
    # SUCCESS: in-app undo + the notification turned Undo
    s.append(scard("SUCCESS", stuckmini(f'<div style="flex: 1; height: 44px; border-radius: 999px; background: {NAVY}; color: #fff; display: flex; align-items: center; gap: 8px; padding: 0 6px 0 14px; box-sizing: border-box">{ic("check", 16, MINT)}<span style="flex: 1; font-size: 13px; font-weight: 700">Nudged Denis · 09:40</span>'
        f'<button style="all: unset; box-sizing: border-box; height: 34px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,.12); display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700">{ic("undo", 14)}Undo</button></div>', sub="Denis is told · 10 s to undo")
        + lock("Billed · 567 · #0561", "",
               f'<span style="font-size: 13px; font-weight: 700; color: {MINT}; height: 32px; display: flex; align-items: center; gap: 4px">{ic("undo", 14)}Undo · 10 s</span>')))
    # ERROR
    s.append(scard("ERROR", f'<div style="background: #fff; border: 1.5px solid {BAD}; border-radius: 16px; padding: 10px 12px; display: flex; align-items: center; gap: 10px">'
        f'<span style="width: 36px; height: 36px; border-radius: 12px; background: {BADB}; color: {BAD}; display: flex; align-items: center; justify-content: center; flex: none">{ic("alert", 18)}</span>'
        f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Not sent</span>{m("Nudge Denis · #0554", 11, FAINT)}</div>'
        f'{pill("Try again", "undo")}</div>'
        + lock("Someone else just did this", m("#0561 · Esther billed it · 10:04", 12, ONNAVY),
               f'<span style="font-size: 13px; font-weight: 700; color: {ONNAVY}; height: 32px; display: flex; align-items: center">Open</span>')))
    # OFFLINE
    s.append(scard("OFFLINE", f'<div style="display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border-radius: 12px; background: {WARNB}; color: {WARNI}; font-size: 13px; font-weight: 700">{ic("wifioff", 16)}Offline · it sends when back</div>'
        + stuckmini(f'<span style="display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border-radius: 999px; background: {TILE}; color: {SOFT}; font-size: 13px; font-weight: 700">{ic("clock", 14)}Waiting · Nudge Denis</span>')))
    # EMPTY
    s.append(scard("EMPTY", f'<div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px">'
        f'<span style="width: 60px; height: 60px; border-radius: 18px; background: {GOODB}; color: {GOOD}; display: flex; align-items: center; justify-content: center">{ic("check", 26)}</span>'
        f'<span style="font-size: 14px; font-weight: 600; color: {SOFT}">Nothing stuck · nothing to bill</span>'
        f'<div style="display: flex; gap: 4px">' + "".join(f'<i style="width: 40px; height: 6px; border-radius: 999px; background: {GOOD}"></i>' for _ in range(5)) + '</div>'
        f'<span style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: {SOFT}">{ic("bolt", 13, GOOD)}Next run {m("11:00", 12, INK, 600)}</span></div>'))
    return s

# ================================================================ SCORE PANEL
def score_panel():
    pages = [
      ("1 · Orders list", [("Consistency", 5, 9, 9), ("Taps per decision", 4, 8, 9), ("Glanceability", 5, 8, 9), ("Polish", 5, 8, 8), ("In step with asker", 4, 8, 9)]),
      ("2 · One order", [("Consistency", 5, 9, 9), ("Taps per decision", 3, 8, 8), ("Glanceability", 5, 8, 9), ("Polish", 6, 8, 8), ("In step with asker", 4, 8, 9)]),
      ("3 · Stuck order", [("Consistency", 4, 9, 9), ("Taps per decision", 3, 8, 9), ("Glanceability", 5, 8, 8), ("Polish", 5, 8, 8), ("In step with asker", 3, 8, 9)]),
      ("4 · To bill", [("Consistency", 5, 9, 9), ("Taps per decision", 5, 8, 9), ("Glanceability", 4, 8, 8), ("Polish", 5, 8, 8), ("In step with asker", 4, 8, 9)]),
    ]
    def bar(v, col):
        return f'<span style="flex: 1; height: 4px; border-radius: 999px; background: {TILE}"><span style="display: block; height: 4px; border-radius: 999px; background: {col}; width: {v*10}%"></span></span>'
    out = []
    for title, rows in pages:
        r = []
        for k, a, b, c in rows:
            cc = GOOD if c >= b else RED
            r.append(f'<div style="display: grid; grid-template-columns: 112px 1fr 1fr 1fr; gap: 6px; align-items: center; height: 18px">'
                     f'<span style="font-size: 11px; font-weight: 600; color: {SOFT}; white-space: nowrap">{k}</span>'
                     f'<span style="display: flex; align-items: center; gap: 4px">{m(a, 11, SOFT, 600, "width: 14px")}{bar(a, "#9AA1AE")}</span>'
                     f'<span style="display: flex; align-items: center; gap: 4px">{m(b, 11, NAVY, 600, "width: 14px")}{bar(b, NAVY)}</span>'
                     f'<span style="display: flex; align-items: center; gap: 4px">{m(c, 11, cc, 600, "width: 14px")}{bar(c, cc)}</span></div>')
        A = sum(x[1] for x in rows) / 5; B = sum(x[2] for x in rows) / 5; C = sum(x[3] for x in rows) / 5
        out.append(f'<div style="display: flex; flex-direction: column; gap: 3px; padding-top: 8px; border-top: 1px solid {TILE}"><span style="font-size: 13px; font-weight: 700">{title}</span>{"".join(r)}'
                   f'<div style="display: grid; grid-template-columns: 112px 1fr 1fr 1fr; gap: 6px; align-items: center; height: 20px"><span style="font-size: 11px; font-weight: 800">Average</span>'
                   f'{m(f"{A:.1f}", 12, SOFT, 600)}{m(f"{B:.1f}", 12, NAVY, 600)}{m(f"{C:.1f}", 12, GOOD, 600)}</div></div>')
    head = (f'<div style="display: flex; align-items: baseline; justify-content: space-between"><span style="font-size: 17px; font-weight: 700">Scores</span><span style="font-size: 12px; font-weight: 600; color: {FAINT}">out of 10</span></div>'
            f'<div style="display: grid; grid-template-columns: 112px 1fr 1fr 1fr; gap: 6px; font-size: 11px; font-weight: 700; color: {SOFT}"><span></span>'
            f'<span style="display: flex; align-items: center; gap: 4px"><i style="width: 8px; height: 8px; border-radius: 999px; background: #9AA1AE"></i>Manager today</span>'
            f'<span style="display: flex; align-items: center; gap: 4px"><i style="width: 8px; height: 8px; border-radius: 999px; background: {NAVY}"></i>Agent app</span>'
            f'<span style="display: flex; align-items: center; gap: 4px"><i style="width: 8px; height: 8px; border-radius: 999px; background: {GOOD}"></i>New</span></div>')
    match = (f'<div style="margin-top: auto; padding: 10px 12px; border-radius: 12px; background: {TILE}; display: flex; flex-direction: column; gap: 2px">'
             f'<span style="font-size: 12px; font-weight: 700">Agent match: Clients</span>'
             f'<span style="font-size: 12px; font-weight: 600; color: {SOFT}; line-height: 1.4">Clients hero + week columns = stage columns with face dots and the late tint (1, 3) · filter chips (1, 3) · client rows with the answer on the row (1, 4) · client sheet head (2) · order + the Today Needs-you card (2).</span></div>')
    return (f'<div style="width: 360px; height: 830px; flex: none; box-sizing: border-box; background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px; margin-top: 22px">'
            f'{head}{"".join(out)}{match}</div>')

# ================================================================ TOP STRIP
def topstrip():
    def ch(t, kind):
        if kind == "in":
            return f'<span style="display: flex; align-items: center; height: 30px; padding: 0 12px; border-radius: 999px; background: {NAVY}; color: #fff; font-size: 13px; font-weight: 700; white-space: nowrap">{t}</span>'
        return f'<span style="display: flex; align-items: center; height: 30px; padding: 0 12px; border-radius: 999px; background: {REDS}; color: {REDD}; font-size: 13px; font-weight: 700; white-space: nowrap">{t}</span>'
    ins = ["Asks in: D-3 Price up", "D-9 · D-11 Can't bill itself", "D-21 Taken twice?"]
    outs = ["Answers out: D-31 Nudge · Give it to", "D-3 Shop's price", "D-9 Bill it", "D-8 Bills itself", "D-21 Cancel #0545"]
    return (f'<div style="height: 64px; display: flex; align-items: center; gap: 20px">'
            f'<div style="display: flex; flex-direction: column; gap: 2px; flex: none"><span style="font-size: 28px; font-weight: 800; letter-spacing: -.01em">Orders</span>'
            f'{m("manager.html · tab 2 of 4 · Sat 17 Oct · mirrors Agent Clients", 12, SOFT)}</div>'
            f'<div style="display: flex; flex-wrap: wrap; gap: 6px; flex: 1; justify-content: flex-end">{"".join(ch(t,"in") for t in ins)}{"".join(ch(t,"out") for t in outs)}</div></div>')

# ================================================================ ASSEMBLE
phones = [
  phone("1 · ORDERS BY STAGE", "09:40", page1(),
        "Nudge a stuck order: 5 → 2 taps (app, Nudge on the row)<br>Give it to Moses: 4 → 2 (app, Moses on the row)"),
  phone("2 · ONE ORDER · #0552", "09:40", page2(),
        "Price up · Shop's price: push 5 → 1 · app 7 → 2<br>(from this page 3: app, row, Shop's price)"),
  phone("3 · STUCK · ANSWERED IN PLACE", "09:40", page3(),
        "Nudge Denis: 5 → 2 · Give it to: 4 → 2<br>the nudge is a push, not WhatsApp"),
  phone("4 · TO BILL · AFTER THE RUN", "10:05", page4(),
        "Invoice: push 2 → 0 · app 3 → 0 (bills itself)<br>Bill 567: push 3 → 1 · app 4 → 2<br>Set 42,500: push 4 → 1 · app 6 → 2 · Taken twice?: 4 → 2"),
]
st = states()
html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Manager Orders</title>
<script src="./support.js"></script></head><body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&amp;family=IBM+Plex+Mono:wght@500;600&amp;display=swap">
<style>body{{margin:0}} a{{color:#16203C}}a:hover{{color:#C93A30}} button{{font-family:inherit;cursor:pointer;margin:0}} svg{{flex:none}}</style>
</helmet>
<div style="width: 2040px; height: 1720px; box-sizing: border-box; padding: 40px; background: #F7F5F2; font-family: Figtree, system-ui, sans-serif; color: #1C2233; display: flex; flex-direction: column; gap: 20px; overflow: hidden">
{topstrip()}
<div style="display: flex; gap: 40px; align-items: flex-start">
{"".join(phones)}
{score_panel()}
</div>
<div style="display: grid; grid-template-columns: repeat(4, 360px); column-gap: 40px; row-gap: 14px">
{"".join(st)}
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":2040,"height":1720}}}}'>
class Component extends DCLogic {{ renderVals() {{ return {{}}; }} }}
</script></body></html>
'''
open(OUT, "w").write(html)
print("wrote", OUT, len(html))
