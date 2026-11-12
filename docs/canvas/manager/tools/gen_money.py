# Generates Money.dc.html and MoneyCredit.dc.html (literal markup) for the Manager canvas.
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

NAVY = "#16203C"; NAVY3 = "#2A3350"; BG = "#F7F5F2"; TILE = "#F1EEE8"; LINE = "#E6E3DD"; DASH = "#C9C4BA"
INK = "#1C2233"; SOFT = "#5F6980"; FAINT = "#6B7480"; ONNAVY = "#B3BCD2"; MINT = "#6FDCB0"
ACC = "#C93A30"; ACCD = "#A82D24"; ACCS = "#FDE8E4"
GOOD = "#0F6B43"; GOODBG = "#E4F4EA"; WARN = "#95530C"; WARNBG = "#FDEEE1"; WARNINK = "#7A4A02"
BAD = "#8E2A22"; BADBG = "#FBE5E2"
MONO = "font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; letter-spacing: -.02em"

PEOPLE = {
    "RN": ("#16203C", "#FFFFFF"), "GA": ("#DCEAF8", "#1A5A8A"), "BO": ("#DDF1EE", "#0E5E57"),
    "FN": ("#F6E4F1", "#7A3268"), "DO": ("#E4E6FA", "#3A3F9B"), "MK": ("#E4F4EA", "#0F6B43"),
    "EA": ("#E8EBF0", "#3D4A5C"),
}

def ic(paths, size=18, sw=2, color="currentColor", fill="none"):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="{fill}" stroke="{color}" stroke-width="{sw}" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths}</svg>')

P = {
    "back": '<path d="M15 18l-6-6 6-6"/>',
    "close": '<path d="M6 6l12 12M18 6L6 18"/>',
    "chev": '<path d="M9 6l6 6-6 6"/>',
    "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    "eye": '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    "check": '<path d="M5 12l5 5 9-10"/>',
    "call": '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    "chat": '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    "doc": '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    "cash": '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    "truck": '<path d="M2 6h12v10H2zM14 9h4l4 4v3h-8"/><circle cx="6.5" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "wifioff": '<path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5-2.6M19 12.5a10 10 0 0 0-2.2-1.5M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 10.7 5M12 20h.01"/>',
    "merge": '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="12" cy="20" r="2"/><path d="M6 7v2a5 5 0 0 0 5 5h1v4M18 7v2a5 5 0 0 1-5 5"/>',
    "book": '<path d="M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM20 19v2H6"/>',
    "spin": '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>',
    "retry": '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    "cal": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "hand": '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    "lock": '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    "today": '<path d="M6.3 16.4a5.7 5.7 0 0 1 11.4 0z"/><path d="M12 3.4v2.3M5.4 6.5l1.6 1.6M18.6 6.5l-1.6 1.6M2.4 16.4h19.2M5.6 20.4h12.8" fill="none"/>',
    "orders": '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    "team": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20v-1a5 5 0 0 0-3.5-4.8"/>',
    "alert": '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
}

def mono(t, size=13, w=600, color=None, extra=""):
    c = f"; color: {color}" if color else ""
    return f'<span style="{MONO}; font-size: {size}px; font-weight: {w}{c}{extra}">{t}</span>'

def ugx(n, size=36, color=ONNAVY):
    return (f'<span style="{MONO}; font-size: {size}px; font-weight: 600; letter-spacing: -.03em; line-height: 1">{n} '
            f'<small style="font-size: {size//2}px; color: {color}; letter-spacing: 0">UGX</small></span>')

def av(init, size=36, ring=False):
    bg, ink = PEOPLE[init]
    sh = "; box-shadow: inset 0 0 0 2px rgba(255,255,255,.3)" if ring else ""
    return (f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex: none; border-radius: 999px; background: {bg}; color: {ink}; '
            f'font-size: {max(11, size//3)}px; font-weight: 700; display: flex; align-items: center; justify-content: center{sh}">{init}</span>')

def cust(init, size=36, dark=False):
    bg, ink = ("rgba(255,255,255,.1)", "#FFFFFF") if dark else (TILE, INK)
    return (f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex: none; border-radius: 12px; background: {bg}; color: {ink}; '
            f'font-size: {max(11, size//3)}px; font-weight: 700; display: flex; align-items: center; justify-content: center">{init}</span>')

def dot(init, size=12):
    bg, ink = PEOPLE[init]
    return f'<i aria-hidden="true" style="width: {size}px; height: {size}px; flex: none; border-radius: 999px; background: {bg}; box-shadow: inset 0 0 0 2px {ink}"></i>'

def who(init, text, num=None, dark=False):
    bg = "rgba(255,255,255,.1)" if dark else TILE
    col = "#FFFFFF" if dark else INK
    n = f' · {mono(num, 11)}' if num else ""
    return (f'<span style="display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px 0 5px; border-radius: 999px; background: {bg}; '
            f'color: {col}; font-size: 12px; font-weight: 700; white-space: nowrap">{dot(init)}{text}{n}</span>')

def chip(t, kind="soft", h=22, size=11):
    m = {"soft": (TILE, INK), "good": (GOODBG, GOOD), "warn": (WARNBG, WARNINK), "bad": (BADBG, BAD),
         "navy": (NAVY, "#FFFFFF"), "onnavy": ("rgba(255,255,255,.1)", "#FFFFFF"), "amber_on": ("rgba(245,178,107,.18)", "#F5B26B")}[kind]
    return (f'<span style="display: inline-flex; align-items: center; gap: 4px; height: {h}px; padding: 0 8px; border-radius: 999px; background: {m[0]}; '
            f'color: {m[1]}; font-size: {size}px; font-weight: 700; white-space: nowrap">{t}</span>')

def sees(names, word, bell=True, dark=False):
    col = ONNAVY if dark else SOFT
    b = ic(P["bell"], 13) if bell else ""
    return (f'<div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; font-weight: 600; color: {col}">'
            f'{ic(P["eye"], 14)}{names} sees{word}{b}</div>')

def pill(label, kind="navy", h=44, icon=None, extra="", aria=None, size=13):
    m = {"navy": (NAVY, "#FFFFFF", "none"), "white": ("#FFFFFF", NAVY, "none"),
         "ghost": ("transparent", "#FFFFFF", "inset 0 0 0 1.5px rgba(255,255,255,.35)"),
         "line": ("#FFFFFF", INK, f"inset 0 0 0 1.5px {LINE}"),
         "off": ("#E6E3DD", "#5F6980", "none"), "offdark": ("rgba(255,255,255,.08)", "#8D99B5", "none")}[kind]
    i = ic(P[icon], 15, 2.2) if icon else ""
    a = f' aria-label="{aria}"' if aria else ""
    return (f'<button{a} style="flex: none; height: {h}px; padding: 0 16px; border: none; border-radius: 999px; background: {m[0]}; color: {m[1]}; '
            f'box-shadow: {m[2]}; font-size: {size}px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap{extra}">{i}{label}</button>')

def sec(title, right="", dotc=None, extra=""):
    d = f'<i style="width: 8px; height: 8px; border-radius: 999px; background: {dotc}"></i>' if dotc else ""
    return (f'<div style="display: flex; align-items: center; justify-content: space-between; padding: 0 4px{extra}">'
            f'<span style="display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 700">{d}{title}</span>'
            f'<span style="{MONO}; font-size: 13px; font-weight: 600; color: {SOFT}">{right}</span></div>')

def card(inner, pad="12px 14px", gap=10, extra=""):
    return (f'<div style="background: #FFFFFF; border: 1px solid {LINE}; border-radius: 16px; padding: {pad}; display: flex; flex-direction: column; gap: {gap}px{extra}">{inner}</div>')

def agetrack(days, w=86, maxd=40, dark=False, col=None, h=6):
    """A days track 0..maxd with the hold line at 21 and a dot at `days`."""
    x = min(days, maxd) / maxd * w
    hx = 21 / maxd * w
    track = "rgba(255,255,255,.14)" if dark else "#ECE8E1"
    if col is None:
        col = (GOOD if days <= 7 else ("#5F6980" if days <= 21 else (WARN if days <= 30 else BAD)))
        if dark: col = "#F5B26B" if days > 21 else MINT
    tick = "#FFFFFF" if dark else INK
    H = h + 8
    return (f'<svg width="{w}" height="{H}" viewBox="0 0 {w} {H}" aria-hidden="true" style="flex: none">'
            f'<rect x="0" y="4" width="{w}" height="{h}" rx="{h/2}" fill="{track}"/>'
            f'<rect x="0" y="4" width="{x:.1f}" height="{h}" rx="{h/2}" fill="{col}"/>'
            f'<line x1="{hx:.1f}" y1="0" x2="{hx:.1f}" y2="{H}" stroke="{tick}" stroke-width="2" stroke-dasharray="2 2"/></svg>')

def tabbar(active="Money", badge="8"):
    def tab(name, icon):
        on = name == active
        col = INK if on else SOFT
        fill = "rgba(28,34,51,.14)" if on else "none"
        cur = ' aria-current="page"' if on else ""
        return (f'<button aria-label="{name}"{cur} style="min-height: 52px; border: none; background: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; '
                f'color: {col}; font-size: 12px; font-weight: {700 if on else 600}; padding: 0">{ic(P[icon], 24, 2, "currentColor", fill if icon != "today" else ("currentColor" if on else "none"))}{name}</button>')
    fab = (f'<button aria-label="Decide next, {badge} waiting" style="justify-self: center; margin-top: -26px; width: 64px; height: 64px; box-sizing: border-box; border-radius: 999px; background: {ACC}; color: #fff; border: 4px solid {BG}; '
           f'box-shadow: 0 6px 20px rgba(201,58,48,.35); position: relative; display: flex; align-items: center; justify-content: center; padding: 0">{ic(P["plus"], 28, 2.4)}'
           f'<span style="position: absolute; top: -4px; right: -4px; min-width: 22px; height: 22px; box-sizing: border-box; padding: 0 6px; border-radius: 999px; background: {NAVY}; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 2px solid {BG}">{badge}</span></button>')
    return (f'<div style="position: absolute; left: 0; right: 0; bottom: 0; background: #fff; border-top: 1px solid {LINE}; display: grid; grid-template-columns: 1fr 1fr 96px 1fr 1fr; align-items: start; padding: 8px 0 12px">'
            f'{tab("Today","today")}{tab("Orders","orders")}{fab}{tab("Money","cash")}{tab("Team","team")}</div>')

def phone(label, inner, taps, bg=BG):
    return (f'<div style="display: flex; flex-direction: column; gap: 8px; width: 360px">'
            f'<div style="font-size: 11px; font-weight: 700; letter-spacing: .08em; color: {SOFT}">{label}</div>'
            f'<div style="position: relative; width: 360px; height: 780px; box-sizing: border-box; border-radius: 32px; border: 1px solid {LINE}; overflow: hidden; background: {bg}">{inner}</div>'
            f'<div style="{MONO}; letter-spacing: 0; font-size: 12px; color: {SOFT}; line-height: 1.45">{taps}</div></div>')

def slide(label, ready=True, knob_at_end=False, sending=False):
    kb = ACC if ready else "#5F6980"
    pos = "right: 5px" if knob_at_end else "left: 5px"
    inner = ic(P["spin"], 22, 2.4) if sending else '<span style="font-size: 22px; font-weight: 800; line-height: 1">»</span>'
    lc = "#FFFFFF" if ready else "#8D99B5"
    return (f'<div role="slider" aria-label="{label}" style="position: relative; height: 60px; border-radius: 999px; background: rgba(255,255,255,.08); display: flex; align-items: center; justify-content: center">'
            f'<span style="position: absolute; {pos}; top: 5px; width: 50px; height: 50px; border-radius: 999px; background: {kb}; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,.25)">{inner}</span>'
            f'<span style="font-size: 16px; font-weight: 700; color: {lc}; padding-left: 40px">{label}</span></div>')

def dock(inner, pad="14px 16px 18px"):
    return (f'<div style="position: absolute; left: 0; right: 0; bottom: 0; background: {NAVY}; border-radius: 26px 26px 0 0; padding: {pad}; box-shadow: 0 -8px 24px rgba(22,32,60,.18); display: flex; flex-direction: column; gap: 12px; color: #fff">{inner}</div>')

def seg(opts, on, dark=True):
    items = []
    for o in opts:
        sel = o == on
        bg = "#FFFFFF" if sel else "transparent"
        col = NAVY if sel else ("#FFFFFF" if dark else INK)
        items.append(f'<button aria-pressed="{str(sel).lower()}" style="flex: 1; height: 44px; border: none; border-radius: 999px; background: {bg}; color: {col}; {MONO}; letter-spacing: 0; font-size: 13px; font-weight: 600; padding: 0 6px; white-space: nowrap">{o}</button>')
    g = "rgba(255,255,255,.08)" if dark else TILE
    return f'<div style="display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: {g}; flex: 1">{"".join(items)}</div>'

# --------------------------------------------------------------------- board parts
def top_strip(title, sub, asks, answers):
    def chips(items, red):
        out = []
        for n, t in items:
            if red:
                out.append(f'<span style="display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px 0 4px; border-radius: 999px; background: #fff; font-size: 13px; font-weight: 700; white-space: nowrap"><b style="min-width: 22px; height: 22px; padding: 0 4px; box-sizing: border-box; border-radius: 999px; background: {ACCD}; color: #fff; {MONO}; letter-spacing: 0; font-size: 11px; display: flex; align-items: center; justify-content: center">{n}</b>{t}</span>')
            else:
                out.append(f'<span style="display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px 0 4px; border-radius: 999px; background: rgba(255,255,255,.1); font-size: 13px; font-weight: 700; white-space: nowrap"><b style="min-width: 22px; height: 22px; padding: 0 4px; box-sizing: border-box; border-radius: 999px; background: #fff; color: {NAVY}; {MONO}; letter-spacing: 0; font-size: 11px; display: flex; align-items: center; justify-content: center">{n}</b>{t}</span>')
        return "".join(out)
    return (f'<div style="height: 64px; display: flex; align-items: center; gap: 20px">'
            f'<div style="display: flex; flex-direction: column; gap: 2px; flex: none"><span style="font-size: 28px; font-weight: 800; letter-spacing: -.01em">{title}</span>'
            f'<span style="{MONO}; letter-spacing: 0; font-size: 12px; color: {SOFT}">{sub}</span></div><div style="flex: 1"></div>'
            f'<div style="display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 8px 0 16px; border-radius: 999px; background: {NAVY}; color: #fff"><span style="font-size: 13px; font-weight: 700; white-space: nowrap">Asks in</span>{chips(asks, False)}</div>'
            f'<div style="display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 8px 0 16px; border-radius: 999px; background: {ACCS}; color: {ACCD}"><span style="font-size: 13px; font-weight: 700; white-space: nowrap">Answers out</span>{chips(answers, True)}</div></div>')

def score_panel(title, legend_today, pages, match_title, match_text):
    labels = ["Consistency with Agent", "Taps per decision", "Glanceability", "Polish", "In step with asker"]
    blocks = []
    tot = [0, 0, 0]; n = 0
    for name, old, ag, nw in pages:
        rows = []
        for i, l in enumerate(labels):
            col = GOOD if nw[i] >= ag[i] else ACC
            rows.append(f'<div style="display: grid; grid-template-columns: 128px 1fr 66px; align-items: center; gap: 8px; height: 19px">'
                        f'<span style="font-size: 11px; font-weight: 600; color: {SOFT}; white-space: nowrap">{l}</span>'
                        f'<span style="display: flex; flex-direction: column; gap: 1px">'
                        f'<i style="display: block; height: 3px; border-radius: 9px; background: {DASH}; width: {old[i]*10}%"></i>'
                        f'<i style="display: block; height: 3px; border-radius: 9px; background: {NAVY}; width: {ag[i]*10}%"></i>'
                        f'<i style="display: block; height: 3px; border-radius: 9px; background: {col}; width: {nw[i]*10}%"></i></span>'
                        f'<span style="{MONO}; letter-spacing: 0; font-size: 11px; font-weight: 600; text-align: right; color: {FAINT}">{old[i]} · <b style="color: {NAVY}">{ag[i]}</b> · <b style="color: {col}">{nw[i]}</b></span></div>')
        a = [sum(x) / 5 for x in (old, ag, nw)]
        for k in range(3): tot[k] += a[k]
        n += 1
        blocks.append(f'<div style="display: flex; flex-direction: column; gap: 5px; padding-bottom: 10px; border-bottom: 1px solid {TILE}">'
                      f'<div style="display: flex; align-items: baseline; justify-content: space-between"><span style="font-size: 13px; font-weight: 700">{name}</span>'
                      f'<span style="{MONO}; letter-spacing: 0; font-size: 11px; color: {FAINT}">avg {a[0]:.1f} · <b style="color: {NAVY}">{a[1]:.1f}</b> · <b style="color: {GOOD}">{a[2]:.1f}</b></span></div>'
                      f'{"".join(rows)}</div>')
    t = [x / n for x in tot]
    return (f'<div style="width: 360px; box-sizing: border-box; margin-top: 23px; background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px">'
            f'<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 17px; font-weight: 700">{title}</span>'
            f'<span style="display: flex; gap: 10px; font-size: 11px; font-weight: 600; color: {SOFT}">'
            f'<span style="display: flex; align-items: center; gap: 4px"><i style="width: 10px; height: 4px; border-radius: 9px; background: {DASH}"></i>{legend_today}</span>'
            f'<span style="display: flex; align-items: center; gap: 4px"><i style="width: 10px; height: 4px; border-radius: 9px; background: {NAVY}"></i>Agent app</span>'
            f'<span style="display: flex; align-items: center; gap: 4px"><i style="width: 10px; height: 4px; border-radius: 9px; background: {GOOD}"></i>New</span></span></div>'
            f'{"".join(blocks)}'
            f'<div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 0"><span style="font-size: 13px; font-weight: 700">Average</span>'
            f'<span style="{MONO}; letter-spacing: 0; font-size: 15px; font-weight: 600; color: {FAINT}">{t[0]:.1f} · <b style="color: {NAVY}">{t[1]:.1f}</b> · <b style="color: {GOOD}">{t[2]:.1f}</b></span></div>'
            f'<div style="padding: 10px 12px; border-radius: 12px; background: {TILE}; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="font-size: 12px; font-weight: 700">Agent match · {match_title}</span>'
            f'<span style="font-size: 12px; font-weight: 600; color: {SOFT}; line-height: 1.35">{match_text}</span></div></div>')

def state(label, inner, caption, h=None):
    hh = f"; height: {h}px" if h else ""
    return (f'<div style="display: flex; flex-direction: column; gap: 8px; width: 460px">'
            f'<span style="font-size: 11px; font-weight: 700; letter-spacing: .08em; color: {SOFT}">{label}</span>'
            f'<div style="width: 360px; box-sizing: border-box; border-radius: 20px; border: 1px solid {LINE}; background: {BG}; padding: 12px; overflow: hidden; position: relative; display: flex; flex-direction: column; gap: 10px{hh}">{inner}</div>'
            f'<span style="{MONO}; letter-spacing: 0; font-size: 12px; color: {SOFT}; width: 420px">{caption}</span></div>')

def board(title_tag, strip, phones, panel, states):
    s1 = "".join(states[:4]); s2 = "".join(states[4:])
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>{title_tag}</title>
<script src="./support.js"></script></head><body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&amp;family=IBM+Plex+Mono:wght@500;600&amp;display=swap">
<style>body{{margin:0}} a{{color:#16203C}}a:hover{{color:#C93A30}} button{{font-family:inherit;cursor:pointer;margin:0}} svg{{flex:none}}</style>
</helmet>
<div style="width: 2040px; height: 1720px; box-sizing: border-box; padding: 40px; background: {BG}; font-family: Figtree, system-ui, sans-serif; color: {INK}; display: flex; flex-direction: column; gap: 24px; overflow: hidden">
{strip}
<div style="display: flex; gap: 40px; align-items: flex-start">
{"".join(phones)}
{panel}
</div>
<div style="display: flex; flex-direction: column; gap: 22px">
<div style="display: flex; gap: 40px">{s1}</div>
<div style="display: flex; gap: 40px">{s2}</div>
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":2040,"height":1720}}}}'>
class Component extends DCLogic {{ renderVals() {{ return {{}}; }} }}
</script></body></html>
'''

# ===================================================================== MONEY BOARD
def money_hero(offline=False):
    live = (f'<span style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,.08); font-size: 12px">'
            f'<i style="width: 7px; height: 7px; border-radius: 999px; background: {"#F5B26B" if offline else MINT}; box-shadow: 0 0 0 4px {"rgba(245,178,107,.2)" if offline else "rgba(111,220,176,.25)"}"></i>{"Offline" if offline else "Live"}</span>')
    return (f'<div style="background: {NAVY}; color: #fff; border-radius: 0 0 28px 28px; padding: 14px 20px 16px; display: flex; flex-direction: column; gap: 10px">'
            f'<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px"><div style="display: flex; flex-direction: column; gap: 4px">'
            f'<span style="font-size: 24px; font-weight: 700">Money</span>'
            f'<span style="display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 600; color: {ONNAVY}">Sat 17 Oct{live}</span></div>'
            f'<button aria-label="Ruth, your page" style="width: 44px; height: 44px; border-radius: 999px; border: none; background: {NAVY}; box-shadow: inset 0 0 0 2px rgba(255,255,255,.3); color: #fff; font-size: 14px; font-weight: 700">RN</button></div>'
            f'<div style="display: flex; flex-direction: column; gap: 7px"><span style="font-size: 12px; font-weight: 600; letter-spacing: .06em; color: {ONNAVY}">IN TODAY ›</span>'
            f'{ugx("2,836,000", 34)}'
            f'<div style="display: flex; gap: 3px; height: 6px"><i style="display: block; width: 69.1%; background: #fff; border-radius: 999px"></i><i style="display: block; flex: 1; background: {MINT}; border-radius: 999px"></i></div>'
            f'<div style="display: flex; gap: 14px; font-size: 12px; font-weight: 600; color: {ONNAVY}">'
            f'<span style="display: flex; align-items: center; gap: 5px"><i style="width: 8px; height: 8px; border-radius: 999px; background: #fff"></i>Cash {mono("1,960,000", 12, 600, "#FFFFFF")}</span>'
            f'<span style="display: flex; align-items: center; gap: 5px"><i style="width: 8px; height: 8px; border-radius: 999px; background: {MINT}"></i>Mobile money {mono("876,000", 12, 600, "#FFFFFF")}</span></div></div></div>')

BANDS = [("under 7 d", "878,000", 13.1, GOOD), ("8–21 d", "2,829,000", 42.4, "#8D99B5"), ("22–30 d", "662,000", 9.9, WARN), ("over 30 d", "2,310,000", 34.6, BAD)]

def aging_card():
    segs = "".join(f'<i style="display: block; width: {w}%; background: {c}"></i>' for _, _, w, c in BANDS)
    labs = "".join(f'<span style="display: flex; flex-direction: column; gap: 1px"><span style="display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: {SOFT}; white-space: nowrap"><i style="width: 7px; height: 7px; border-radius: 2px; background: {c}"></i>{l}</span>{mono(v, 12)}</span>' for l, v, _, c in BANDS)
    return card(
        f'<div style="position: relative; height: 14px"><span style="position: absolute; left: 55.5%; transform: translateX(-50%); top: 0; font-size: 11px; font-weight: 700; color: {INK}; white-space: nowrap">Held at {mono("21 d", 11, 700)}</span></div>'
        f'<div style="position: relative"><div style="display: flex; gap: 2px; height: 14px; border-radius: 999px; overflow: hidden">{segs}</div>'
        f'<i style="position: absolute; left: 55.5%; top: -6px; height: 26px; border-left: 2px dashed {INK}"></i></div>'
        f'<div style="display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 4px">{labs}</div>', pad="10px 14px 12px", gap=6)

def lead_debtor(state_="default"):
    btn_extra = ""
    if state_ == "pressed":
        btn = (f'<button aria-label="Nudge Grace" style="flex: none; height: 44px; padding: 0 14px; border: none; border-radius: 999px; background: #DCE1EC; color: {NAVY}; transform: scale(.95); box-shadow: 0 0 0 3px rgba(255,255,255,.35); font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px">{dot("GA")}Nudge Grace</button>')
    elif state_ == "done":
        btn = (f'<button aria-label="Undo the nudge" style="flex: none; height: 44px; padding: 0 14px; border: none; border-radius: 999px; background: rgba(255,255,255,.12); color: #fff; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px">Undo {mono("10", 13, 600)}</button>')
    else:
        btn = (f'<button aria-label="Nudge Grace about Kyaligonza and Sons" style="flex: none; height: 44px; padding: 0 14px; border: none; border-radius: 999px; background: #fff; color: {NAVY}; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px">{dot("GA")}Nudge Grace</button>')
    return (f'<div style="background: {NAVY}; color: #fff; border-radius: 16px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px">'
            f'<div style="display: flex; align-items: center; gap: 10px">{cust("KS", 38, True)}'
            f'<div style="flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 700">Kyaligonza &amp; Sons</span>'
            f'<span style="{MONO}; letter-spacing: 0; font-size: 11px; color: {ONNAVY}">oldest 9 Sep · 38 d</span></div>'
            f'{mono("2,310,000", 16, 600, "#FFFFFF")}</div>'
            f'<div style="display: flex; align-items: center; gap: 8px">{agetrack(38, 84, 40, True)}{chip("Held", "amber_on")}<span style="flex: 1"></span>{btn}</div></div>')

def debtor_rows():
    rows = [("LB", "Lubowa Builders", 25, "662,000", f'<span style="display: inline-flex; align-items: center; gap: 3px; color: {WARNINK}; font-size: 11px; font-weight: 700; white-space: nowrap">{ic(P["cal"], 12)}Promised {mono("Mon 19", 11, 700)}</span>'),
            ("GS", "Ggaba Stores", 16, "1,615,000", ""),
            ("MR", "Mukono Roofing", 12, "1,214,000", ""),
            ("KC", "Kato Construction", 4, "878,000", "")]
    out = []
    for i, (ini, name, d, amt, extra) in enumerate(rows):
        bb = f"border-bottom: 1px solid {TILE};" if i < len(rows) - 1 else ""
        out.append(f'<button aria-label="{name}, owes {amt}" style="display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 0; border: none; background: none; text-align: left; color: {INK}; {bb}">'
                   f'{cust(ini, 36)}<span style="flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0"><span style="font-size: 14px; font-weight: 700">{name}</span>'
                   f'<span style="display: flex; align-items: center; gap: 6px">{agetrack(d, 48)}{mono(f"{d} d", 11, 600, SOFT, "; white-space: nowrap")}{extra}</span></span>'
                   f'{mono(amt, 14)}</button>')
    return card("".join(out), pad="2px 14px", gap=0)

def money_p1():
    body = (f'<div style="padding: 12px 16px 0; display: flex; flex-direction: column; gap: 8px">'
            f'{sec("To collect", "6,679,000 · 5")}{aging_card()}'
            f'{lead_debtor()}{debtor_rows()}</div>')
    return money_hero() + body + tabbar()

def money_p2():
    hero = (f'<div style="background: {NAVY}; color: #fff; border-radius: 0 0 28px 28px; padding: 14px 20px 18px; display: flex; flex-direction: column; gap: 12px">'
            f'<div style="display: flex; align-items: center; gap: 10px">'
            f'<button aria-label="Back to Money" style="width: 44px; height: 44px; border-radius: 999px; border: none; background: rgba(255,255,255,.08); color: #fff; display: flex; align-items: center; justify-content: center; padding: 0">{ic(P["back"], 18)}</button>'
            f'{cust("KS", 40, True)}<div style="flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0"><span style="font-size: 17px; font-weight: 700; white-space: nowrap">Kyaligonza &amp; Sons</span>'
            f'<span style="display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: {ONNAVY}">{dot("GA")}{dot("BO")}Grace · Brian sell here</span></div></div>'
            f'<div style="display: flex; flex-direction: column; gap: 7px"><span style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; letter-spacing: .06em; color: {ONNAVY}">OWES ›{chip("Held", "amber_on")}</span>'
            f'{ugx("2,310,000", 34)}'
            f'<div style="display: flex; align-items: center; gap: 8px">{agetrack(38, 260, 40, True)}{mono("38 d", 12, 600, "#FFFFFF")}</div>'
            f'<span style="font-size: 12px; font-weight: 600; color: {ONNAVY}">oldest bill · new orders held from {mono("21 d", 12, 600, "#FFFFFF")}</span></div></div>')
    bills = [("Wed 9 Sep", "oldest bill", 38, "1,450,000"), ("Mon 14 Sep", "bill", 33, "860,000")]
    br = []
    for i, (n, dte, d, a) in enumerate(bills):
        bb = f"border-bottom: 1px solid {TILE};" if i == 0 else ""
        br.append(f'<div style="display: flex; align-items: center; gap: 10px; min-height: 52px; {bb}"><span style="width: 36px; height: 36px; border-radius: 12px; background: {BADBG}; color: {BAD}; display: flex; align-items: center; justify-content: center; flex: none">{ic(P["doc"], 17)}</span>'
                  f'<span style="flex: 1; display: flex; flex-direction: column; gap: 2px">{mono(n, 14)}<span style="{MONO}; letter-spacing: 0; font-size: 11px; color: {FAINT}">{dte} · {d} d</span></span>{mono(a, 14)}</div>')
    # promises timeline: 21 Sep kept, 2 Oct broken, 9 Oct broken, today 17 Oct; scale 14 Sep..17 Oct = 33 days over 280px
    def px(day_from_14sep): return 10 + day_from_14sep / 33 * 280
    pts = [(7, "kept", "21 Sep"), (18, "broken", "2 Oct"), (25, "broken", "9 Oct")]
    svg = f'<svg width="300" height="44" viewBox="0 0 300 44" aria-hidden="true"><line x1="10" y1="14" x2="290" y2="14" stroke="#E6E3DD" stroke-width="2"/>'
    for d, k, lab in pts:
        x = px(d)
        if k == "kept":
            svg += f'<circle cx="{x:.0f}" cy="14" r="7" fill="{GOOD}"/><path d="M{x-3:.0f} 14l2 2 4-4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>'
        else:
            svg += f'<circle cx="{x:.0f}" cy="14" r="6" fill="#fff" stroke="{BAD}" stroke-width="2.5"/>'
        svg += f'<text x="{x:.0f}" y="38" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" font-weight="600" fill="{FAINT}">{lab}</text>'
    svg += f'<rect x="{px(33)-1:.0f}" y="4" width="2" height="20" fill="{INK}"/><text x="{px(33)-4:.0f}" y="38" text-anchor="end" font-family="IBM Plex Mono" font-size="11" font-weight="600" fill="{INK}">today</text></svg>'
    prom = card(svg, pad="10px 12px 6px", gap=0)
    chase = card(
        f'<div style="display: flex; align-items: center; gap: 8px">'
        + "".join(f'<button aria-label="{l}" style="flex: 1; height: 48px; border-radius: 14px; border: none; background: {TILE}; color: {INK}; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 0; font-size: 13px; font-weight: 700">{ic(P[i], 18)}{l}</button>' for i, l in [("call", "Call"), ("doc", "Statement")])
        + f'</div>', pad="10px 12px", gap=8)
    body = (f'<div style="padding: 14px 16px 0; display: flex; flex-direction: column; gap: 9px">'
            f'{sec("Bills", "2")}{card("".join(br), pad="2px 14px", gap=0)}'
            f'<div style="display: flex; align-items: center; justify-content: space-between; padding: 0 4px; margin-top: 3px"><span style="font-size: 17px; font-weight: 700">Promises</span>'
            f'<span style="display: flex; gap: 6px">{chip("1 kept", "good")}{chip("2 broken", "bad")}</span></div>{prom}'
            f'{sec("Chase", "", extra="; margin-top: 3px")}{chase}</div>')
    dk = dock(f'<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: {ONNAVY}">{ic(P["bell"], 14)}{dot("GA")}Grace sees{chip("Ruth nudged you", "onnavy")}</div>'
              f'<div style="display: flex; align-items: center; gap: 8px">{pill(dot("GA") + "Nudge Grace", "white", 56, aria="Nudge Grace", extra="; flex: 1", size=15)}'
              f'{pill("Promise", "ghost", 56, "cal", size=15)}</div>', pad="14px 16px 20px")
    return hero + body + dk

def promise_days(selected=None, done=False):
    days = [("Sat", "17", "today"), ("Sun", "18", ""), ("Mon", "19", ""), ("Tue", "20", ""), ("Wed", "21", ""), ("Thu", "22", ""), ("Fri", "23", "")]
    out = []
    for wd, dn, t in days:
        if t == "today":
            out.append(f'<span style="height: 64px; border-radius: 12px; border: 1.5px dashed {DASH}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: {SOFT}"><span style="font-size: 11px; font-weight: 600">{wd}</span>{mono(dn, 17)}</span>')
        else:
            sel = dn == selected
            bg = NAVY if sel else "#fff"; col = "#fff" if sel else INK
            bd = "none" if sel else f"inset 0 0 0 1px {LINE}"
            out.append(f'<button aria-label="Promised {wd} {dn} Oct" style="height: 64px; border-radius: 12px; border: none; background: {bg}; color: {col}; box-shadow: {bd}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 0"><span style="font-size: 11px; font-weight: 600">{wd}</span>{mono(dn, 17)}</button>')
    return f'<div style="display: grid; grid-template-columns: repeat(7, minmax(0,1fr)); gap: 5px">{"".join(out)}</div>'

def money_p3():
    top = (f'<div style="height: 40px; background: {NAVY3}; display: flex; align-items: center; justify-content: center">'
           f'<span style="width: 40px; height: 5px; border-radius: 999px; background: rgba(255,255,255,.35)"></span></div>')
    keypad = ('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
              '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h8"/></svg>')
    def amt(l, v, on):
        inner = mono(v, 13) if v else f'<span style="color: {INK}">{keypad}</span>'
        return (f'<button aria-pressed="{str(on).lower()}" aria-label="{l}{" " + v if v else ", type an amount"}" style="flex: 1; height: 52px; border: none; border-radius: 13px; background: {"#fff" if on else "transparent"}; box-shadow: {"0 1px 2px rgba(0,0,0,.08)" if on else "none"}; color: {INK}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; padding: 0">'
                f'<span style="font-size: 11px; font-weight: 600; color: {SOFT}">{l}</span>{inner}</button>')
    seg_amt = (f'<div style="display: flex; gap: 2px; padding: 3px; border-radius: 16px; background: {TILE}">'
               + amt("All", "2,310,000", True) + amt("Oldest bill", "1,450,000", False) + amt("Part", "", False)
               + '</div>')
    sheet = (f'<div style="position: absolute; left: 0; right: 0; bottom: 0; top: 40px; background: {BG}; border-radius: 26px 26px 0 0; padding: 14px 16px 0; display: flex; flex-direction: column; gap: 11px">'
             f'<div style="display: flex; align-items: center; gap: 10px">{cust("KS", 40)}<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">Kyaligonza &amp; Sons</span>'
             f'<span style="{MONO}; letter-spacing: 0; font-size: 11px; color: {SOFT}">owes 2,310,000 · oldest 38 d</span></span>'
             f'<button aria-label="Close" style="width: 44px; height: 44px; border-radius: 999px; border: none; background: #fff; box-shadow: inset 0 0 0 1px {LINE}; color: {INK}; display: flex; align-items: center; justify-content: center; padding: 0">{ic(P["close"], 18)}</button></div>'
             f'<span style="font-size: 24px; font-weight: 800; letter-spacing: -.01em; padding: 0 2px">Promise</span>'
             f'{sec("How much", "")}{seg_amt}'
             f'{sec("Which day", "")}{promise_days("19")}'
             f'<button aria-label="A later day" style="height: 44px; border-radius: 999px; border: 1.5px dashed {DASH}; background: transparent; color: {SOFT}; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px">{ic(P["cal"], 16)}Later</button>'
             f'{sec("Their promises", "1 kept · 2 broken", extra="; margin-top: 2px")}'
             + card(
                 "".join(f'<div style="display: flex; align-items: center; gap: 10px; min-height: 30px">{mk}<span style="flex: 1; {MONO}; letter-spacing: 0; font-size: 12px; font-weight: 600">{d}</span>{mono(a, 12, 600, SOFT)}{chip(w, k)}</div>'
                         for mk, d, a, w, k in [
                             (f'<i style="width: 12px; height: 12px; border-radius: 999px; background: {GOOD}"></i>', "Mon 21 Sep", "400,000", "Kept", "good"),
                             (f'<i style="width: 12px; height: 12px; box-sizing: border-box; border-radius: 999px; border: 2.5px solid {BAD}"></i>', "Fri 2 Oct", "1,000,000", "Broken", "bad"),
                             (f'<i style="width: 12px; height: 12px; box-sizing: border-box; border-radius: 999px; border: 2.5px solid {BAD}"></i>', "Fri 9 Oct", "1,000,000", "Broken", "bad")]),
                 pad="6px 14px", gap=0)
             + '</div>')
    dk = dock(f'<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: {ONNAVY}">{ic(P["bell"], 14)}{dot("GA")}Grace sees{chip("Promised · Mon 19", "onnavy")}</div>'
              f'{pill("Promised · 2,310,000 · Mon 19", "white", 56, "check", extra="; width: 100%", size=15)}', pad="14px 16px 20px")
    return top + sheet + dk

def money_p4():
    hero = (f'<div style="background: {NAVY}; color: #fff; border-radius: 0 0 28px 28px; padding: 14px 20px 18px; display: flex; flex-direction: column; gap: 12px">'
            f'<div style="display: flex; align-items: center; gap: 10px">'
            f'<button aria-label="Back to Money" style="width: 44px; height: 44px; border-radius: 999px; border: none; background: rgba(255,255,255,.08); color: #fff; display: flex; align-items: center; justify-content: center; padding: 0">{ic(P["back"], 18)}</button>'
            f'{cust("GS", 40, True)}<div style="flex: 1; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 17px; font-weight: 700">Ggaba Stores</span>'
            f'<span style="display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: {ONNAVY}">{dot("GA")}Grace sells here</span></div></div>'
            f'<div style="display: flex; flex-direction: column; gap: 7px"><span style="font-size: 12px; font-weight: 600; letter-spacing: .06em; color: {ONNAVY}">OWES ›</span>'
            f'{ugx("1,615,000", 30)}'
            f'<div style="height: 6px; border-radius: 999px; background: rgba(255,255,255,.12); overflow: hidden"><i style="display: block; height: 100%; width: 80.75%; background: #fff; border-radius: 999px"></i></div>'
            f'<span style="font-size: 12px; font-weight: 600; color: {ONNAVY}">{mono("81%", 12, 600, "#FFFFFF")} of the {mono("2,000,000", 12, 600, "#FFFFFF")} limit · oldest {mono("16 d", 12, 600, "#FFFFFF")}</span></div></div>')
    def chips_row(opts, on, now=None):
        out = []
        for o in opts:
            sel = o == on
            bg = NAVY if sel else "#fff"; col = "#fff" if sel else INK
            bd = "none" if sel else f"inset 0 0 0 1px {LINE}"
            out.append(f'<button aria-pressed="{str(sel).lower()}" style="flex: 1; height: 44px; border-radius: 999px; border: none; background: {bg}; color: {col}; box-shadow: {bd}; {MONO}; letter-spacing: 0; font-size: 13px; font-weight: 600; padding: 0">{o}</button>')
        return "".join(out)
    ask = (f'<div style="background: #fff; border: 1.5px solid {NAVY}; border-radius: 16px; padding: 12px 14px; display: flex; flex-direction: column; gap: 9px">'
           f'<div style="display: flex; align-items: center; gap: 10px">{av("EA", 36)}'
           f'<span style="flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 14px; font-weight: 700">From Esther · Credit asked</span>'
           f'<span style="{MONO}; letter-spacing: 0; font-size: 11px; color: {FAINT}">11:30 · pays every 2 weeks</span></span>{chip("10 m", "soft")}</div>'
           f'<div style="display: flex; align-items: center; gap: 8px">{mono("2,000,000", 13, 600, SOFT)}<span style="color: {SOFT}">{ic(P["chev"], 14)}</span>{mono("3,000,000 · 14 days", 13, 700, INK)}'
           f'</div>'
           f'<div style="display: flex; gap: 8px">{pill("Limit 3,000,000 · 14 days", "navy", 44, extra="; flex: 1; padding: 0 10px", size=13)}{pill("Cash only", "line", 44)}</div>'
           f'<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: {SOFT}">{ic(P["bell"], 13)}<span style="white-space: nowrap">Esther · Grace see <b style="color: {INK}">Limit 3,000,000 · 14 days</b></span></div></div>')
    limit = card(
        f'<div style="display: flex; align-items: center; gap: 10px"><span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; font-weight: 600; color: {SOFT}">Limit now</span>'
        f'{mono("2,000,000 · 14 days", 14, 600, INK)}</span>{pill("Change", "line", 44)}</div>', pad="8px 14px", gap=0)
    def rec(name, phone_, orders, keep, owes):
        ring = f"inset 0 0 0 2px {NAVY}" if keep else f"inset 0 0 0 1px {LINE}"
        mark = (f'<span style="width: 20px; height: 20px; border-radius: 999px; background: {NAVY}; color: #fff; display: flex; align-items: center; justify-content: center">{ic(P["check"], 12, 3)}</span>' if keep
                else f'<span style="width: 20px; height: 20px; box-sizing: border-box; border-radius: 999px; border: 2px solid {DASH}"></span>')
        return (f'<button aria-pressed="{str(keep).lower()}" aria-label="Keep {name}" style="flex: 1; min-width: 0; border: none; background: #fff; box-shadow: {ring}; border-radius: 12px; padding: 10px; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; text-align: left; color: {INK}">'
                f'<span style="display: flex; align-items: center; gap: 6px; width: 100%">{mark}<span style="font-size: 13px; font-weight: 700; white-space: nowrap">{name}</span></span>'
                f'{mono(phone_, 11, 600, FAINT)}<span style="display: flex; justify-content: space-between; width: 100%">{mono(orders, 11, 600, FAINT)}{mono(owes, 12, 600, INK)}</span></button>')
    look = card(
        f'<div style="display: flex; align-items: center; gap: 8px"><span style="color: {WARN}">{ic(P["merge"], 18)}</span><span style="flex: 1; font-size: 14px; font-weight: 700">Look alike</span>{chip("Same phone", "warn")}</div>'
        f'<div style="display: flex; gap: 8px">{rec("Ggaba Stores", "0772 418 330", "6 orders", True, "1,615,000")}{rec("Gaba Stores", "0772 418 330", "1 order", False, "0")}</div>', pad="12px 14px", gap=10)
    books = card(
        f'<div style="display: flex; align-items: center; gap: 10px"><span style="width: 36px; height: 36px; border-radius: 12px; background: {TILE}; display: flex; align-items: center; justify-content: center; flex: none">{ic(P["book"], 18)}</span>'
        f'<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Old books</span><span style="{MONO}; letter-spacing: 0; font-size: 11px; color: {FAINT}">since Thu 1 Oct</span></span>'
        f'{mono("290,000", 14)}{chip("Next", "soft")}</div>', pad="10px 14px", gap=0)
    body = f'<div style="padding: 12px 16px 0; display: flex; flex-direction: column; gap: 8px">{ask}{limit}{look}{books}</div>'
    dk = dock(slide("Merge into Ggaba Stores"))
    return hero + body + dk

def money_states():
    st = []
    st.append(state("DEFAULT", lead_debtor(), "over 30 d leads · Nudge on the card · hold line on the track"))
    st.append(state("PRESSED", lead_debtor("pressed"), "pill lightens · scales 95% · tick feel"))
    dis = (f'<div style="background: {NAVY}; border-radius: 20px; padding: 14px; display: flex; flex-direction: column; gap: 10px">'
           f'<div style="display: flex; gap: 8px">' +
           "".join(f'<span style="flex: 1; border-radius: 12px; padding: 8px 10px; background: rgba(255,255,255,.06); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.2); display: flex; flex-direction: column; gap: 2px"><span style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #fff"><span style="width: 16px; height: 16px; box-sizing: border-box; border-radius: 999px; border: 2px solid rgba(255,255,255,.45)"></span>{n}</span>{mono(o, 11, 600, ONNAVY)}</span>'
                   for n, o in [("Ggaba Stores", "6 orders"), ("Gaba Stores", "1 order")]) +
           f'</div>{slide("Pick the one to keep", ready=False)}</div>')
    st.append(state("DISABLED", dis, "merge slide greys until one record is ticked to keep"))
    sending = (f'<div style="background: {NAVY}; border-radius: 20px; padding: 14px; display: flex; flex-direction: column; gap: 10px">{slide("Merging", knob_at_end=True, sending=True)}'
               f'<span style="font-size: 12px; font-weight: 600; color: {ONNAVY}; text-align: center">{mono("7", 12, 600, "#FFFFFF")} orders · {mono("1,615,000", 12, 600, "#FFFFFF")} into one</span></div>')
    st.append(state("SENDING", sending, "knob at the end · spinner · nothing else to tap"))
    succ = (f'<div style="display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 10px 12px">'
            f'<span style="width: 36px; height: 36px; border-radius: 12px; background: {GOODBG}; color: {GOOD}; display: flex; align-items: center; justify-content: center">{ic(P["check"], 18, 2.4)}</span>'
            f'<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Merged · Ggaba Stores</span>{mono("7 orders · 1,615,000", 11, 600, FAINT)}</span>'
            f'{pill("Undo " + mono("10", 13), "line", 44)}</div>'
            f'<div style="background: {NAVY}; border-radius: 20px; padding: 12px">{slide("Opening balance · 290,000")}</div>')
    st.append(state("SUCCESS", succ, "Undo 10 s · the dock moves to the next: old books"))
    err = (f'<div style="display: flex; align-items: center; gap: 10px; background: #fff; border: 1.5px solid {BAD}; border-radius: 16px; padding: 10px 12px">'
           f'<span style="width: 36px; height: 36px; border-radius: 12px; background: {BADBG}; color: {BAD}; display: flex; align-items: center; justify-content: center">{ic(P["alert"], 18)}</span>'
           f'<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Promised · Mon 19</span>{mono("Not saved · no signal", 11, 600, BAD)}</span>'
           f'{pill("Try again", "navy", 44, "retry")}</div>'
           + promise_days("19"))
    st.append(state("ERROR", err, "the day stays picked · Try again sends the same promise"))
    off = (f'<div style="background: {NAVY}; color: #fff; border-radius: 16px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between">'
           f'<span style="font-size: 18px; font-weight: 700">Money</span><span style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,.08); font-size: 12px; font-weight: 600; color: {ONNAVY}"><i style="width: 7px; height: 7px; border-radius: 999px; background: #F5B26B"></i>Offline</span></div>'
           f'<div style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; background: {WARNBG}; color: {WARNINK}; font-size: 13px; font-weight: 700">{ic(P["wifioff"], 16)}No signal · {mono("1", 13, 600)} nudge waits to send</div>'
           f'<span style="padding: 0 4px; {MONO}; letter-spacing: 0; font-size: 12px; color: {SOFT}">In today as of 09:02 · 2,836,000</span>')
    st.append(state("OFFLINE", off, "figures keep their time · taps queue and send later"))
    emp = (f'{sec("Who owes", "0", dotc=DASH)}'
           f'<div style="height: 64px; border-radius: 16px; border: 1.5px dashed {DASH}; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 600; color: {SOFT}"><span style="color: {GOOD}">{ic(P["check"], 18, 2.4)}</span>Nobody owes</div>')
    st.append(state("EMPTY", emp, "the aging bar folds away · In today stays"))
    return st

def money_board():
    strip = top_strip("Money", "manager.html · tab 3 of 4 · Sat 17 Oct · mirrors Agent Money",
                      [("28", "Promised · 662,000 · Mon"), ("32", "Credit asked")],
                      [("28", "Promised · Mon 19"), ("30", "Nudge Grace"), ("32", "Limit 3,000,000 · 14 days")])
    strip = strip.replace(ACCS, "#FFFFFF; box-shadow: inset 0 0 0 1.5px " + NAVY).replace(ACCD, NAVY)
    phones = [
        phone("1 · MONEY · <span style=\"font-family: 'IBM Plex Mono', monospace\">09:40</span>", money_p1(),
              "Chase debtors (D-30): 5 → 2 from Today's watch row · 3 via Money"),
        phone("2 · ONE DEBTOR · KYALIGONZA &amp; SONS", money_p2(),
              "Nudge Grace (D-30): 5 → 2 (Today's row) · Promise (D-28): 6 → 4 · payments stay with Accounts"),
        phone("3 · A PROMISE · D-28", money_p3(),
              "Promised (D-28): 6 → 4 · app, Money, debtor, Promised (Undo 10 s)"),
        phone("4 · CUSTOMER · GGABA STORES · <span style=\"font-family: 'IBM Plex Mono', monospace\">11:40</span>", money_p4(),
              "Credit asked (D-32): 1 tap on the card · Change (D-25) 8 → 5 · Merge (D-26) 6 → 4 · Opening balance (D-27) 6 → 4"),
    ]
    AG = (9, 8, 8, 9, 8)
    panel = score_panel("Scores · Money tab", "Manager today", [
        ("1 · Money", (5, 4, 4, 5, 5), AG, (9, 8, 9, 8, 8)),
        ("2 · One debtor", (5, 4, 4, 5, 4), AG, (9, 8, 8, 8, 8)),
        ("3 · A promise", (4, 4, 4, 5, 4), AG, (8, 8, 8, 8, 8)),
        ("4 · Customer", (4, 3, 4, 4, 4), AG, (8, 8, 8, 8, 8)),
    ], "Agent Money / Money Pro",
        "Flat navy hero with one figure and a split bar · white cards · row tracks · navy pill on the lead card · navy dock with total + one move")
    panel = panel.replace(ACC, BAD)
    return board("Manager Money", strip, phones, panel, money_states())

# ===================================================================== CREDIT BOARD
def decide_top(count=None, pinned=None):
    c = f'<span style="{MONO}; letter-spacing: 0; font-size: 13px; font-weight: 600; color: {SOFT}">{count}</span>' if count else '<span style="width: 44px"></span>'
    pin = ""
    if pinned:
        pin = (f'<div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 12px; background: {WARNBG}; color: {WARNINK}; font-size: 13px; font-weight: 700">'
               f'{ic(P["truck"], 17)}{pinned}</div>')
    return (f'<div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 0">'
            f'<button aria-label="Close" style="width: 44px; height: 44px; border-radius: 999px; border: none; background: #fff; box-shadow: inset 0 0 0 1px {LINE}; color: {INK}; display: flex; align-items: center; justify-content: center; padding: 0">{ic(P["close"], 18)}</button>'
            f'<span style="font-size: 15px; font-weight: 700">Decide next</span>{c}</div>'
            + (f'<div style="padding: 10px 16px 0">{pin}</div>' if pin else ""))

def asker(init, name, num, asked, age):
    return (f'<div style="display: flex; align-items: center; gap: 10px">{av(init, 44)}'
            f'<span style="flex: 1; display: flex; flex-direction: column; gap: 4px"><span style="display: flex">{who(init, "From " + name, num)}</span>'
            f'<span style="{MONO}; letter-spacing: 0; font-size: 12px; color: {SOFT}">Asked · {asked} · {age} ago</span></span></div>')

def ask_head(title, cust_init, cust_name, reason, kind="bad"):
    return (f'<div style="display: flex; flex-direction: column; gap: 8px"><span style="font-size: 26px; font-weight: 800; letter-spacing: -.01em; line-height: 1.1">{title}</span>'
            f'<div style="display: flex; align-items: center; gap: 8px">{cust(cust_init, 32)}<span style="flex: 1; font-size: 15px; font-weight: 700">{cust_name}</span>{chip(reason, kind, 26, 12)}</div></div>')

def stack_bar(parts, total_w=100, h=14, marks=()):
    segs = "".join(f'<i style="display: block; width: {w}%; height: 100%; background: {c}; {extra}"></i>' for w, c, extra in parts)
    mk = "".join(f'<i style="position: absolute; left: {x}%; top: -5px; height: {h+10}px; border-left: 2px dashed {c}"></i>' for x, c in marks)
    return f'<div style="position: relative"><div style="display: flex; gap: 2px; height: {h}px; border-radius: 999px; overflow: hidden; background: #ECE8E1">{segs}</div>{mk}</div>'

HATCH = "background-image: repeating-linear-gradient(135deg, rgba(255,255,255,.45) 0 4px, transparent 4px 8px)"

def legend(items):
    return ('<div style="display: flex; flex-wrap: wrap; gap: 6px 14px">' +
            "".join(f'<span style="display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: {SOFT}"><i style="width: 9px; height: 9px; border-radius: 3px; background: {c}; {x}"></i>{l} {mono(v, 12, 600, INK)}</span>' for l, v, c, x in items)
            + '</div>')

def answer_dock(seg_html, left, right, left_aria=None, right_aria=None, state_=None):
    if state_ == "sending":
        rbtn = f'<button aria-label="Sending" style="flex: 1.5; height: 52px; border: none; border-radius: 999px; background: #fff; color: {NAVY}; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px">{ic(P["spin"], 18, 2.4)}Sending</button>'
        lbtn = f'<button disabled style="flex: 1; height: 52px; border: none; border-radius: 999px; background: rgba(255,255,255,.06); color: #8D99B5; font-size: 14px; font-weight: 700">{left}</button>'
    elif state_ == "disabled":
        rbtn = f'<button disabled style="flex: 1.5; height: 52px; border: none; border-radius: 999px; background: rgba(255,255,255,.08); color: #8D99B5; font-size: 15px; font-weight: 700">Pick a limit</button>'
        lbtn = f'<button style="flex: 1; height: 52px; border: none; border-radius: 999px; background: transparent; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.35); color: #fff; font-size: 14px; font-weight: 700">{left}</button>'
    else:
        lbtn = f'<button aria-label="{left_aria or left}" style="flex: 1; height: 52px; border: none; border-radius: 999px; background: transparent; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.35); color: #fff; font-size: 14px; font-weight: 700; white-space: nowrap; padding: 0 10px">{left}</button>'
        rbtn = f'<button aria-label="{right_aria or right}" style="flex: 1.5; height: 52px; border: none; border-radius: 999px; background: #fff; color: {NAVY}; font-size: 15px; font-weight: 700; white-space: nowrap; padding: 0 10px; display: flex; align-items: center; justify-content: center; gap: 6px">{ic(P["check"], 16, 2.6)}{right}</button>'
    s = f'<div style="display: flex; gap: 8px; align-items: center">{seg_html}</div>' if seg_html else ""
    return dock(f'{s}<div style="display: flex; gap: 8px">{lbtn}{rbtn}</div>')

def limit_seg(opts, on, terms=("14 d", "30 d"), ton="14 d"):
    return seg(opts, on) + f'<div style="width: 120px; display: flex">{seg(list(terms), ton)}</div>'

# ---- MoneyCredit · revision 1: every page is the ONE decision sheet (tools/sheet.py) ----
import sys as _sys
_sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sheet as SH  # shared with Today, DecidePrice, DecideOrders, DecideStock


def cr_owe_card(label, fig, parts, marks=(), mark_labels="", legend_items=None):
    return card(
        f'<div style="display: flex; align-items: baseline; justify-content: space-between"><span style="font-size: 13px; font-weight: 700; color: {SOFT}">{label}</span>{mono(fig, 18)}</div>'
        + stack_bar(parts, marks=marks) + mark_labels
        + (legend(legend_items) if legend_items else ""), pad="12px 14px", gap=8)


def cr_facts(rows):
    return card("".join(f'<div style="display: flex; align-items: center; gap: 10px; min-height: 34px"><span style="color: {SOFT}">{ic(P[i], 16)}</span><span style="flex: 1; font-size: 13px; font-weight: 600">{l}</span>{mono(v, 13)}</div>'
                        for i, l, v in rows), pad="6px 14px", gap=0)


def cr_p1():
    ev = cr_owe_card("Would owe", "3,690,000", [(62.6, NAVY, ""), (37.4, "#8D99B5", HATCH)],
                     legend_items=[("Owes", "2,310,000", NAVY, ""), ("#0555", "1,380,000", "#8D99B5", HATCH)])
    age = card(
        f'<div style="display: flex; align-items: baseline; justify-content: space-between"><span style="font-size: 13px; font-weight: 700; color: {SOFT}">Oldest bill</span>{mono("38 d", 18, 600, BAD)}</div>'
        f'<svg width="300" height="40" viewBox="0 0 300 40" aria-hidden="true"><rect x="0" y="10" width="300" height="8" rx="4" fill="#ECE8E1"/>'
        f'<rect x="0" y="10" width="{21/40*300:.0f}" height="8" rx="4" fill="#C9C4BA"/>'
        f'<line x1="{21/40*300:.0f}" y1="2" x2="{21/40*300:.0f}" y2="26" stroke="{INK}" stroke-width="2" stroke-dasharray="3 2"/>'
        f'<circle cx="{33/40*300:.0f}" cy="14" r="6" fill="#fff" stroke="{BAD}" stroke-width="2.5"/><circle cx="{38/40*300:.0f}" cy="14" r="6" fill="{BAD}"/>'
        f'<text x="{21/40*300:.0f}" y="38" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" font-weight="600" fill="{INK}">held from 21 d</text>'
        f'<text x="300" y="38" text-anchor="end" font-family="IBM Plex Mono" font-size="11" font-weight="600" fill="{BAD}">9 Sep</text></svg>'
        f'<div style="display: flex; align-items: center; gap: 8px"><span style="font-size: 12px; font-weight: 600; color: {SOFT}">Promises</span>{chip("1 kept", "good")}{chip("2 broken", "bad")}</div>', pad="12px 14px", gap=6)
    bills = card("".join(
        f'<div style="display: flex; align-items: center; gap: 10px; min-height: 40px{"; border-top: 1px solid " + TILE if i else ""}">'
        f'<span style="width: 30px; height: 30px; border-radius: 10px; background: {BADBG}; color: {BAD}; display: flex; align-items: center; justify-content: center; flex: none">{ic(P["doc"], 15)}</span>'
        f'<span style="flex: 1; display: flex; flex-direction: column; gap: 1px">{mono(d, 13)}<span style="{MONO}; letter-spacing: 0; font-size: 11px; color: {FAINT}">{n} · {ag} d</span></span>{mono(a, 13)}</div>'
        for i, (d, n, ag, a) in enumerate([("Wed 9 Sep", "oldest bill", 38, "1,450,000"), ("Mon 14 Sep", "bill", 33, "860,000")])), pad="4px 14px", gap=0)
    dock_ = SH.sheet_dock(SH.s_sees("Grace", "On credit"),
                          SH.s_primary("On credit", "1,380,000", "On credit: load 0555, 1,380,000. Grace sees On credit"),
                          SH.s_second("Cash first", "Cash first: 0555 waits until Kyaligonza pays. Grace sees Cash first"))
    return SH.decision_sheet(pos=1, total=1, ini="GA", who="Grace", role="Sales", asked="12:15", ref="#0555 Kyaligonza &amp; Sons",
                             age="5 m", title="On credit?", tags=[SH.s_tag("Old bill · 38 days", "amber")],
                             body=ev + age + bills, dock=dock_, aria="On credit? From Grace, order 0555")


def cr_p2():
    ev = cr_owe_card("Would owe", "2,501,500",
                     [(1214000/4000000*100, NAVY, ""), (1287500/4000000*100, "#8D99B5", HATCH)], marks=[(75, GOOD)],
                     mark_labels=f'<div style="position: relative; height: 16px"><span style="position: absolute; left: 75%; transform: translateX(-50%); font-size: 11px; font-weight: 700; color: {GOOD}; white-space: nowrap">{mono("3M", 11, 700, GOOD)} limit</span></div>',
                     legend_items=[("Owes", "1,214,000", NAVY, ""), ("#0552", "1,287,500", "#8D99B5", HATCH)])
    facts = cr_facts([("clock", "Oldest bill", "12 d"), ("doc", "#0552 · 2 lines", "1,287,500"), ("lock", "Limit", "none")])
    dock_ = SH.sheet_dock(SH.s_sees("Faith", "On credit"),
                          SH.s_primary("On credit", "1,287,500", "On credit: limit 3M, 30 days, load 0552. Faith sees On credit"),
                          SH.s_second("Cash first", "Cash first: 0552 waits until Mukono Roofing pays"),
                          SH.s_seg(["2M · 14 d", "3M · 30 d", "5M · 30 d"], 1, "Limit and terms"))
    return SH.decision_sheet(pos=1, total=1, ini="FN", who="Faith", role="Sales", asked="13:05", ref="#0552 Mukono Roofing",
                             age="5 m", title="On credit?", tags=[SH.s_tag("No limit set", "amber")],
                             body=ev + facts, dock=dock_, aria="On credit? From Faith, order 0552")


def cr_p3():
    # D-7 is drawn once, in tools/sheet.py, so Today p2 and this page are the same sheet
    return SH.d7_sheet(pos=1, total=8, next_=("BO", "Brian · Return asked · #0547", "3 h"))


def cr_p4():
    ev = cr_owe_card("Owes", "1,615,000", [(1615000/3500000*100, NAVY, "")], marks=[(2/3.5*100, INK), (3/3.5*100, GOOD)],
                     mark_labels=f'<div style="position: relative; height: 16px; font-size: 11px; font-weight: 700"><span style="position: absolute; left: 57.1%; transform: translateX(-50%); white-space: nowrap; color: {INK}">now {mono("2M", 11, 700)}</span>'
                                 f'<span style="position: absolute; left: 85.7%; transform: translateX(-50%); white-space: nowrap; color: {GOOD}">asked {mono("3M", 11, 700, GOOD)}</span></div>')
    facts = cr_facts([("clock", "Oldest bill", "16 d"), ("cal", "Terms asked", "14 days"), ("orders", "On the move", "#0553")])
    quote = (f'<div style="display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-radius: 12px; background: #fff; border: 1px solid {LINE}">{av("EA", 24)}'
             f'<span style="font-size: 13px; font-weight: 600; color: {INK}; line-height: 1.35">“Pays every 2 weeks”</span></div>')
    dock_ = SH.sheet_dock(SH.s_sees("Esther · Grace", "Limit 3,000,000 · 14 days"),
                          SH.s_primary("Limit 3,000,000 · 14 days", None, "Limit 3,000,000, 14 days for Ggaba Stores. Esther and Grace see it"),
                          SH.s_second("Cash only", "Cash only: Ggaba Stores buys for cash. Esther and Grace see it"))
    return SH.decision_sheet(pos=1, total=1, ini="EA", who="Esther", role="Sales", asked="11:30", ref="Ggaba Stores · limit now 2M",
                             age="10 m", title="Credit asked · Ggaba Stores", body=ev + facts + quote, dock=dock_,
                             aria="Credit asked, Ggaba Stores, from Esther")


def cr_tabbar_tick():
    t = tabbar("Money", "0")
    t = t.replace(ic(P["plus"], 28, 2.4), ic(P["check"], 28, 2.4)).replace('aria-label="Decide next, 0 waiting"', 'aria-label="Decide next: nothing waits"')
    i = t.index('<span style="position: absolute; top: -4px'); j = t.index('</span>', i) + 7
    return t[:i] + t[j:]


def notif(undo=False):
    head = (f'<div style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: #AEB6C6">'
            f'<span style="width: 18px; height: 18px; border-radius: 999px; background: {NAVY}; color: #fff; display: flex; align-items: center; justify-content: center">{ic(P["plus"], 11, 3)}</span>Omni-ware Manager · now{ic(P["chev"], 12)}</div>')
    if not undo:
        body = (f'<span style="font-size: 14px; font-weight: 700; color: #F1F3F7">Musa · Not paid yet · on credit? · #0551</span>'
                f'<span style="{MONO}; letter-spacing: 0; font-size: 12px; color: #C9CFDB; line-height: 1.45">Nansana Hardware · 1,240,000 · owes 0<br>no limit set · 1st order on credit<br>truck waits · Ssali</span>'
                f'<div style="display: flex; gap: 8px; padding-top: 4px"><button style="height: 44px; padding: 0 12px; border: none; border-radius: 999px; background: #2E3546; color: #E8EBF0; font-size: 13px; font-weight: 700">On credit · load it · 1.5M · 14 d</button></div>')
    else:
        body = (f'<span style="font-size: 14px; font-weight: 700; color: #F1F3F7">On credit · load it · #0551</span>'
                f'<span style="font-size: 12px; font-weight: 600; color: #C9CFDB">Musa · Grace see it · limit 1,500,000 · 14 d</span>'
                f'<div style="display: flex; gap: 8px; padding-top: 4px"><button style="height: 44px; padding: 0 14px; border: none; border-radius: 999px; background: #2E3546; color: #E8EBF0; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px">{ic(P["retry"], 14)}Undo · {mono("10", 13, 600)} s</button></div>')
    return (f'<div style="background: #0B0F1A; border-radius: 14px; padding: 12px; margin: -2px">'
            f'<div style="background: #1C2130; border-radius: 18px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px">{head}{body}</div></div>')

def needs_row(pressed=False):
    btn_style = (f"background: #0B1226; transform: scale(.95); box-shadow: 0 0 0 3px rgba(22,32,60,.18)" if pressed else f"background: {NAVY}")
    return (f'<div style="background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px">'
            f'<div style="display: flex; align-items: center; gap: 10px">{av("MK", 38)}<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Not paid yet · on credit?</span>'
            f'<span style="{MONO}; letter-spacing: 0; font-size: 11px; color: {FAINT}">Musa · #0551 · 1,240,000 · 25 m</span></span></div>'
            f'<div style="display: flex; align-items: center; gap: 8px"><span style="display: flex; align-items: center; gap: 5px; {MONO}; letter-spacing: 0; font-size: 11px; font-weight: 600; color: {WARNINK}">{ic(P["truck"], 14)}truck waits · 25 m</span><span style="flex: 1"></span>'
            f'<button aria-label="On credit, load it" style="flex: none; height: 44px; padding: 0 14px; border: none; border-radius: 999px; {btn_style}; color: #fff; font-size: 13px; font-weight: 700">On credit · load it</button></div></div>')

def credit_states():
    st = []
    st.append(state("DEFAULT · THE PUSH", notif(), "evidence in 3 lines · one safe answer · 1 tap from the lock screen"))
    st.append(state("PRESSED", needs_row(True), "the same answer on the Needs-you row · pill darkens · scales 95%"))
    dis = f'<div style="border-radius: 20px; overflow: hidden">{SH.d7_dock("disabled").replace("border-radius: 24px 24px 0 0", "border-radius: 20px")}</div>'
    st.append(state("DISABLED", dis, "limit cleared · the answer greys and says what is missing"))
    snd = f'<div style="border-radius: 20px; overflow: hidden">{SH.d7_dock("sending").replace("border-radius: 24px 24px 0 0", "border-radius: 20px")}</div>'
    st.append(state("SENDING", snd, "spinner on the answer · nothing else moves"))
    st.append(state("SUCCESS · UNDO 10 S", notif(True)
                    + f'<div style="display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 12px; font-weight: 600; color: {SOFT}">{ic(P["chev"], 14)}then the next card slides in · {mono("2 of 8", 12, 600, INK)}</div>',
                    "Musa · Grace see On credit · load it · Undo on the push and in the app"))
    err = (f'<div style="display: flex; align-items: center; gap: 10px; background: #fff; border: 1.5px solid {BAD}; border-radius: 16px; padding: 10px 12px">'
           f'<span style="width: 36px; height: 36px; border-radius: 12px; background: {BADBG}; color: {BAD}; display: flex; align-items: center; justify-content: center">{ic(P["alert"], 18)}</span>'
           f'<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">On credit · load it</span>{mono("Not sent · no signal", 11, 600, BAD)}</span>'
           f'{pill("Try again", "navy", 44, "retry")}</div>'
           f'<div style="display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 10px 12px">'
           f'<span style="width: 36px; height: 36px; border-radius: 12px; background: {TILE}; display: flex; align-items: center; justify-content: center">{ic(P["check"], 18, 2.4)}</span><span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Someone else just did this</span>{mono("#0551 · On credit · load it · 09:40", 11, 600, FAINT)}</span></div>')
    st.append(state("ERROR", err, "no signal → Try again · already answered → shows who and the answer"))
    off = (f'<div style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; background: {WARNBG}; color: {WARNINK}; font-size: 13px; font-weight: 700">{ic(P["wifioff"], 16)}No signal · your answer waits to send</div>'
           + needs_row(False))
    st.append(state("OFFLINE", off, "answers queue · Musa is told when it sends"))
    emp = (f'{sec("On credit?", "0", dotc=DASH)}'
           f'<div style="height: 56px; border-radius: 16px; border: 1.5px dashed {DASH}; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 600; color: {SOFT}"><span style="color: {GOOD}">{ic(P["check"], 18, 2.4)}</span>Nothing waits on credit</div>'
           f'<div style="position: relative; height: 86px; margin: 0 -12px -12px">{cr_tabbar_tick()}</div>')
    st.append(state("EMPTY", emp, "the FAB shows a tick · Money stays one tap away"))
    return st

def credit_board():
    strip = top_strip("Money · credit", "manager.html · the credit decisions · Sat 17 Oct · mirrors Agent Money",
                      [("5", "On credit?"), ("6", "No limit set"), ("7", "Not paid yet · on credit?"), ("32", "Credit asked")],
                      [("5", "On credit"), ("6", "On credit"), ("7", "On credit · load it"), ("32", "Limit 3,000,000 · 14 days")])
    phones = [
        phone("1 · CREDIT HOLD · D-5 · 1 OF 1 · <span style=\"font-family: 'IBM Plex Mono', monospace\">12:20</span>", cr_p1(),
              "On credit (D-5): push 2 → 1 · app 3 → 2 · Grace sees On credit"),
        phone("2 · NO LIMIT SET · D-6 · 1 OF 1 · <span style=\"font-family: 'IBM Plex Mono', monospace\">13:10</span>", cr_p2(),
              "On credit · 3M · 30 d (D-6): one chip row, terms in each · push 5 → 1 · app 6 → 2"),
        phone("3 · THE STORE ASKS · D-7 · 1 OF 8 · <span style=\"font-family: 'IBM Plex Mono', monospace\">09:40</span>", cr_p3(),
              "On credit · load it (D-7): the same sheet as Today p2 · push 5 → 1 · app 6 → 2"),
        phone("4 · CREDIT ASKED · D-32 · 1 OF 1 · <span style=\"font-family: 'IBM Plex Mono', monospace\">11:40</span>", cr_p4(),
              "Limit 3,000,000 · 14 days (D-32): push — → 1 · app not possible → 2"),
    ]
    AG = (9, 8, 8, 9, 8)
    panel = score_panel("Scores · credit decisions", "Manager today", [
        ("1 · Credit hold", (5, 6, 4, 5, 4), AG, (9, 9, 8, 8, 9)),
        ("2 · No limit set", (4, 3, 4, 4, 4), AG, (9, 8, 8, 8, 9)),
        ("3 · Store asks", (5, 3, 5, 5, 5), AG, (9, 9, 8, 8, 9)),
        ("4 · Credit asked", (0, 0, 0, 0, 0), AG, (9, 9, 8, 8, 9)),
    ], "Agent Money / Money Pro",
        "The one decision sheet: navy head (n of N, asker, ask word) · white evidence cards, one bar each · navy dock: who sees what, one white answer, one outline")
    return board("Manager Money credit", strip, phones, panel, credit_states())

with open(os.path.join(OUT, "Money.dc.html"), "w") as f: f.write(money_board())
with open(os.path.join(OUT, "MoneyCredit.dc.html"), "w") as f: f.write(credit_board())
print("ok")
