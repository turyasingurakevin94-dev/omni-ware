#!/usr/bin/env python3
# Generates docs/canvas/manager/DecidePrice.dc.html (literal markup).
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'DecidePrice.dc.html')
MONO = "font-family: 'IBM Plex Mono', monospace"
NAVY, INK, SOFT, FAINT, ONNAVY = "#16203C", "#1C2233", "#5F6980", "#6B7480", "#B3BCD2"

def ico(paths, size=16, sw=2, extra=""):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"{extra}>{paths}</svg>')

CHECK = '<path d="M5 12l5 5 9-10"/>'
BELL = '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'
EYE = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
PEN = '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'
CLOCK = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
SPIN = '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>'
UNDO = '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'
RETRY = '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'
OFF = '<path d="M2 2l20 20"/><path d="M8.5 16.4a6 6 0 0 1 7 0"/><path d="M5 12.9a11 11 0 0 1 4.2-2.4"/><path d="M14.8 10.5A11 11 0 0 1 19 12.9"/><path d="M12 20h.01"/>'
CHEV = '<path d="M9 6l6 6-6 6"/>'
TAG = '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>'
STORE = '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>'
PLUS = '<path d="M12 5v14M5 12h14"/>'
UP = '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>'
LOCK = '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'

PEOPLE = {
    "GA": ("#DCEAF8", "#1A5A8A"), "BO": ("#DDF1EE", "#0E5E57"), "FN": ("#F6E4F1", "#7A3268"),
    "DO": ("#E4E6FA", "#3A3F9B"), "ML": ("#F1EEE8", "#1C2233"), "RN": ("#16203C", "#FFFFFF"),
}

def avatar(ini, size=44, radius="999px", fs=14):
    bg, fg = PEOPLE[ini]
    return (f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex: none; border-radius: {radius}; '
            f'background: {bg}; color: {fg}; font-size: {fs}px; font-weight: 700; display: flex; align-items: center; justify-content: center">{ini}</span>')

def dot(ini, s=12):
    bg, fg = PEOPLE[ini]
    return f'<i aria-hidden="true" style="width: {s}px; height: {s}px; flex: none; border-radius: 999px; background: {bg}; box-shadow: inset 0 0 0 2px {fg}"></i>'

def m(t, size=None, w=None, col=None):
    st = MONO
    if size: st += f"; font-size: {size}px"
    if w: st += f"; font-weight: {w}"
    if col: st += f"; color: {col}"
    return f'<span style="{st}">{t}</span>'

def sees(who_ini, who, word, bg="#E4F4EA", fg="#0F6B43", bell=False, on_navy=False, extra=""):
    col = ONNAVY if on_navy else SOFT
    b = ico(BELL, 14) if bell else ""
    return (f'<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: {col}">'
            f'{ico(EYE, 14)}{dot(who_ini)}{who} sees'
            f'<span style="height: 22px; padding: 0 8px; border-radius: 999px; background: {bg}; color: {fg}; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap">{word}</span>{b}{extra}</div>')

# ---------- the scale: cost / their price / shop's price on one line ----------
def scale(lo, hi, cost, marks, zone_label="never under cost", band=None):
    """marks: list of dict(v, kind: 'their'|'shop'|'cost'|'tick'|'ghost', label, pos: 'up'|'down', ini)"""
    def pct(v): return (v - lo) / (hi - lo) * 100
    c = pct(cost)
    parts = []
    # under-cost zone
    parts.append(f'<i style="position: absolute; left: 0; top: 0; bottom: 0; width: {c:.1f}%; border-radius: 999px 0 0 999px; '
                 f'background: repeating-linear-gradient(135deg, #FBE5E2 0 4px, #F3CFCA 4px 7px)"></i>')
    if band:
        a, b = pct(band[0]), pct(band[1])
        parts.append(f'<i style="position: absolute; left: {a:.1f}%; width: {b-a:.1f}%; top: -4px; bottom: -4px; border-radius: 6px; background: #E8EBF0"></i>')
    # gain fill from cost to the furthest 'their'/'fill' mark
    fill = [x for x in marks if x.get("fill")]
    for f in fill:
        p = pct(f["v"])
        parts.append(f'<i style="position: absolute; left: {c:.1f}%; width: {p-c:.1f}%; top: 0; bottom: 0; background: {f.get("fillcol", NAVY)}"></i>')
    track = f'<div style="position: absolute; left: 0; right: 0; top: 50%; height: 8px; margin-top: -4px; border-radius: 999px; background: #F1EEE8">{"".join(parts)}</div>'
    pins = []
    for x in marks:
        p = pct(x["v"])
        k = x["kind"]
        if k == "cost":
            pin = f'<i style="position: absolute; left: {p:.1f}%; top: 50%; width: 3px; height: 22px; margin: -11px 0 0 -1.5px; border-radius: 2px; background: {INK}"></i>'
        elif k == "shop":
            pin = f'<i style="position: absolute; left: {p:.1f}%; top: 50%; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 4px; background: #fff; box-shadow: inset 0 0 0 2.5px {NAVY}; transform: rotate(45deg)"></i>'
        elif k == "their":
            bg, fg = PEOPLE[x["ini"]]
            ring = x.get("ring", fg)
            pin = f'<i style="position: absolute; left: {p:.1f}%; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 999px; background: {bg}; box-shadow: 0 0 0 2px #fff, inset 0 0 0 3px {ring}"></i>'
        elif k == "bad":
            pin = f'<i style="position: absolute; left: {p:.1f}%; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 999px; background: #fff; box-shadow: 0 0 0 2px #fff, inset 0 0 0 3px #8E2A22"></i>'
        elif k == "ghost":
            pin = f'<i style="position: absolute; left: {p:.1f}%; top: 50%; width: 3px; height: 14px; margin: -7px 0 0 -1.5px; border-radius: 2px; background: #C9C4BA"></i>'
        else:  # tick
            pin = f'<i style="position: absolute; left: {p:.1f}%; top: 50%; width: 2px; height: 12px; margin: -6px 0 0 -1px; background: {SOFT}"></i>'
        pins.append(pin)
        if x.get("label"):
            align = x.get("align", "center")
            tx = {"center": "-50%", "left": "-8px", "right": "calc(-100% + 8px)"}[align]
            ta = {"center": "center", "left": "left", "right": "right"}[align]
            top = "0" if x["pos"] == "up" else "auto"
            bot = "auto" if x["pos"] == "up" else "0"
            col = x.get("col", INK)
            pins.append(f'<span style="position: absolute; left: {p:.1f}%; top: {top}; bottom: {bot}; transform: translateX({tx}); '
                        f'display: flex; flex-direction: column; align-items: {"center" if align=="center" else ("flex-start" if align=="left" else "flex-end")}; text-align: {ta}; white-space: nowrap; line-height: 1.15">'
                        f'<span style="font-size: 11px; font-weight: 700; color: {col if col!=INK else SOFT}">{x["label"]}</span>'
                        f'{m(x["txt"], 13, 600, col)}</span>')
    zone = (f'<span style="position: absolute; left: 0; top: 6px; font-size: 11px; font-weight: 700; color: #8E2A22; display: flex; align-items: center; gap: 3px; white-space: nowrap">'
            f'{ico(LOCK, 12)}{zone_label}</span>') if zone_label else ""
    return (f'<div style="position: relative; height: 104px; margin: 0 8px">'
            f'<div style="position: absolute; left: 0; right: 0; top: 34px; height: 36px">{track}{"".join(pins[i] for i in range(0, len(pins)) if "transform: translateX" not in pins[i])}</div>'
            f'{"".join(p for p in pins if "transform: translateX" in p)}{zone}</div>')

def scale_card(title_right, sc, foot):
    return (f'<div style="background: #fff; border: 1px solid #E6E3DD; border-radius: 16px; padding: 12px 12px 10px; display: flex; flex-direction: column; gap: 4px">'
            f'<div style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px"><span style="font-size: 15px; font-weight: 700">A sheet</span>{title_right}</div>'
            f'{sc}{foot}</div>')

def rung(label, price, sub, aria, icon=TAG, tone="plain", bell=False):
    bg, fg, ibg, icol = "#fff", INK, "#F1EEE8", INK
    b = f'<span style="color: {SOFT}; display: flex">{ico(BELL, 14)}</span>' if bell else ""
    return (f'<button aria-label="{aria}" style="width: 100%; min-height: 56px; border: none; border-radius: 16px; background: {bg}; box-shadow: inset 0 0 0 1px #E6E3DD; '
            f'display: flex; align-items: center; gap: 10px; padding: 6px 12px 6px 8px; text-align: left; color: {fg}">'
            f'<span style="width: 38px; height: 38px; flex: none; border-radius: 12px; background: {ibg}; color: {icol}; display: flex; align-items: center; justify-content: center">{ico(icon, 18)}</span>'
            f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">{label}</span>'
            f'<span style="{MONO}; font-size: 11px; color: {FAINT}">{sub}</span></span>'
            f'{m(price, 16, 600)}{b}</button>')

def dock(seesline, total, gainline, btn_label, btn_aria, state="default", gaincol="#6FDCB0"):
    if state == "default":
        btn = (f'<button aria-label="{btn_aria}" style="width: 100%; height: 56px; border: none; border-radius: 999px; background: #fff; color: {NAVY}; '
               f'font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px">{ico(CHECK, 20, 2.4)}{btn_label}</button>')
    elif state == "pressed":
        btn = (f'<button aria-label="{btn_aria}" style="width: 100%; height: 56px; border: none; border-radius: 999px; background: #DDE2EE; color: {NAVY}; '
               f'font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; transform: scale(.97); box-shadow: 0 0 0 4px rgba(255,255,255,.18)">{ico(CHECK, 20, 2.4)}{btn_label}</button>')
    elif state == "sending":
        btn = (f'<button disabled aria-busy="true" style="width: 100%; height: 56px; border: none; border-radius: 999px; background: #243052; color: #fff; '
               f'font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: default">{ico(SPIN, 20, 2.4)}{btn_label}</button>')
    elif state == "offline":
        btn = (f'<button aria-label="{btn_aria}" style="width: 100%; height: 56px; border: none; border-radius: 999px; background: #fff; color: {NAVY}; '
               f'font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px">{ico(CLOCK, 20, 2.2)}{btn_label}</button>')
    else:
        btn = state  # custom markup
    return (f'<div style="background: {NAVY}; color: #fff; border-radius: 26px 26px 0 0; padding: 14px 16px 16px; box-shadow: 0 -8px 24px rgba(22,32,60,.18); display: flex; flex-direction: column; gap: 12px">'
            f'<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px">{seesline}'
            f'<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 1px">{m(total, 22, 600, "#fff")}{m(gainline, 12, 600, gaincol)}</div></div>'
            f'{btn}</div>')

def sheet_head(ini, who, ask, ref, client, age, queue, item, qty, line_total, each, chip=None):
    chip_html = chip or ""
    return (f'<div style="background: {NAVY}; color: #fff; border-radius: 26px 26px 22px 22px; padding: 0 18px 16px; display: flex; flex-direction: column; gap: 10px">'
            f'<button aria-label="Close" style="display: block; width: 100%; height: 30px; border: none; background: none; position: relative; padding: 0"><i style="position: absolute; left: 50%; top: 10px; width: 40px; height: 5px; margin-left: -20px; border-radius: 999px; background: rgba(255,255,255,.25)"></i></button>'
            f'<div style="display: flex; align-items: center; gap: 12px">{avatar(ini)}'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px">'
            f'<span style="font-size: 17px; font-weight: 700; white-space: nowrap">{ask}</span>'
            f'<span style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: {ONNAVY}; white-space: nowrap">From {who} · {m(ref, 12, 600, "#fff")}</span></div>'
            f'<span style="display: flex; flex-direction: column; align-items: flex-end; gap: 3px">{m(age, 13, 600, "#fff")}<span style="font-size: 11px; font-weight: 600; color: {ONNAVY}">{queue}</span></span></div>'
            f'{chip_html}'
            f'<div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,.08)">'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700">{item} · {m(qty)}</span>'
            f'<span style="font-size: 12px; font-weight: 600; color: {ONNAVY}">{client}</span></div>'
            f'<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px">{m(line_total, 16, 600, "#fff")}{m(each, 11, None, ONNAVY)}</div></div></div>')

def backdrop():
    return (f'<div style="background: {NAVY}; color: #fff; border-radius: 0 0 28px 28px; padding: 18px 20px; height: 120px; box-sizing: border-box">'
            f'<span style="font-size: 24px; font-weight: 700">Good morning, Ruth</span></div>'
            f'<div style="position: absolute; inset: 0; background: rgba(12,19,38,.72)"></div>')

def phone(label, sheet_inner, foot, aria):
    return (f'<div style="display: flex; flex-direction: column; gap: 8px">'
            f'<div style="font-size: 11px; font-weight: 700; letter-spacing: .08em; color: {SOFT}">{label}</div>'
            f'<div style="position: relative; width: 360px; height: 780px; box-sizing: border-box; border-radius: 32px; border: 1px solid #E6E3DD; overflow: hidden; background: #F7F5F2">'
            f'{backdrop()}'
            f'<div role="dialog" aria-label="{aria}" style="position: absolute; left: 0; right: 0; top: 52px; bottom: 0; background: #F7F5F2; border-radius: 26px 26px 0 0; display: flex; flex-direction: column">'
            f'{sheet_inner}</div></div>'
            f'<div style="{MONO}; font-size: 12px; color: {SOFT}; line-height: 1.4">{foot}</div></div>')

def body(*parts, gap=10):
    return f'<div style="flex: 1; padding: 12px 16px; display: flex; flex-direction: column; gap: {gap}px">{"".join(parts)}</div>'

def sec(t, right=""):
    return f'<div style="display: flex; align-items: baseline; justify-content: space-between; padding: 2px 4px 0"><span style="font-size: 15px; font-weight: 700">{t}</span>{right}</div>'

def gap_line(parts):
    return f'<div style="display: flex; justify-content: space-between; gap: 8px; padding: 6px 4px 0; border-top: 1px solid #F1EEE8">{parts}</div>'

def kv(label, val, col=INK):
    return f'<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 11px; font-weight: 600; color: {SOFT}">{label}</span>{m(val, 13, 600, col)}</span>'

# =================== PHONE 1 · D-1 Grace #0555 ===================
p1_scale = scale(36000, 49000, 38000, [
    dict(v=38000, kind="cost", label="Cost", txt="38,000", pos="down", align="left"),
    dict(v=46000, kind="their", ini="GA", label="Grace", txt="46,000", pos="up", fill=True),
    dict(v=47500, kind="shop", label="Shop's", txt="47,500", pos="down", align="right"),
])
p1 = phone("1 · D-1 · UNDER THE SHOP'S PRICE · " + m("09:40"),
    sheet_head("GA", "Grace", "Under the shop's price", "#0555", "Kyaligonza &amp; Sons", "1 h 05", "2 of 8",
               "Iron sheet G28", "30 sht", "1,380,000", "46,000 a sht")
    + body(
        scale_card(m("UGX a sht", 11, None, FAINT), p1_scale,
                   gap_line(kv("Gain a sht", "8,000", "#0F6B43") + kv("Under the shop's", "−1,500", "#95530C") + kv("On 30 sht", "−45,000", "#95530C"))),
        sec("Or", m("never under 38,000", 11, None, FAINT)),
        rung("Shop's price", "47,500", "+45,000 on 30", "Shop's price, 47,500 a sheet. Grace is told", bell=True),
        rung("Another price", "", "38,000 or more", "Another price, 38,000 or more", icon=PEN),
    )
    + dock(sees("GA", "Grace", "Approved", on_navy=True), "1,380,000", "gain 240,000", "Approve 46,000", "Approve 46,000 a sheet, Grace sees Approved"),
    "Approve · app 4 → 2 taps · push 2 → 1",
    "Under the shop's price, from Grace, order 0555")

# =================== PHONE 2 · D-4 counter ===================
counter_chip = (f'<div style="display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px; border-radius: 999px; background: #FDEEE1; color: #7A4A02; font-size: 13px; font-weight: 700; align-self: flex-start">'
                f'{ico(STORE, 16)}At the counter · waits {m("3 min", 13, 600)}</div>')
p2_scale = scale(32000, 44000, 34000, [
    dict(v=34000, kind="cost", label="Cost", txt="34,000", pos="down", align="left"),
    dict(v=40000, kind="their", ini="GA", label="Grace", txt="40,000", pos="up", fill=True),
    dict(v=42500, kind="shop", label="Shop's", txt="42,500", pos="down", align="right"),
])
p2 = phone("2 · D-4 · AT THE COUNTER · " + m("11:20") + " · FIRST IN THE QUEUE",
    sheet_head("GA", "Grace", "At the counter", "Walk-in", "Paying now · cash", "3 min", "first",
               "Cement 50 kg", "10 bags", "400,000", "40,000 a bag", chip=counter_chip)
    + body(
        scale_card(m("UGX a bag", 11, None, FAINT), p2_scale,
                   gap_line(kv("Gain a bag", "6,000", "#0F6B43") + kv("Under the shop's", "−2,500", "#95530C") + kv("On 10 bags", "−25,000", "#95530C"))).replace(">A sheet<", ">A bag<"),
        rung("Shop's price", "42,500", "+25,000 on 10", "Shop's price, 42,500 a bag. Grace is told", bell=True),
    )
    + dock(sees("GA", "Grace", "Approved · pay", on_navy=True), "400,000", "gain 60,000", "Approve 40,000", "Approve 40,000 a bag, Grace takes the money"),
    "Approve · app 4 → 2 taps · push 2 → 1",
    "At the counter, from Grace")

# =================== PHONE 3 · D-3 Denis #0552 ===================
up_chip = (f'<div style="display: flex; align-items: center; gap: 8px; align-self: flex-start; font-size: 13px; font-weight: 700; color: #fff">'
           f'<span style="display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border-radius: 999px; background: rgba(255,255,255,.1)">{ico(UP, 15)}Cost {m("24,000", 13, 600, ONNAVY)} → {m("27,000", 13, 600, "#fff")}</span>'
           f'<span style="display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border-radius: 999px; background: #FBE5E2; color: #8E2A22; white-space: nowrap">Under cost {m("−1,000", 13, 600)}</span></div>')
p3_scale = scale(23000, 35000, 27000, [
    dict(v=24000, kind="ghost"),
    dict(v=26000, kind="bad", label="Sells", txt="26,000", pos="up", col="#8E2A22", align="right"),
    dict(v=27000, kind="cost", label="Cost", txt="27,000", pos="down", align="right"),
    dict(v=29000, kind="tick", label="Same gain", txt="29,000", pos="up", align="left"),
    dict(v=33750, kind="shop", label="Shop's", txt="33,750", pos="down", align="right", fill=True, fillcol="#C9C4BA"),
], zone_label=None)
p3 = phone("3 · D-3 · PRICE UP · " + m("09:40") + " · OLDEST",
    sheet_head("DO", "Denis", "Price up", "#0552", "Mukono Roofing · Faith's", "2 h 10", "1 of 8",
               "Ridge cap 3 m", "10 pcs", "337,500", "33,750 a pcs", chip=up_chip)
    + body(
        scale_card(m("UGX a pcs", 11, None, FAINT), p3_scale,
                   gap_line(kv("Sells now", "26,000", "#8E2A22") + kv("Cost now", "27,000") + kv("Mukono pays", "+77,500", "#95530C"))).replace(">A sheet<", ">A piece<"),
        sec("Or", m("never under 27,000", 11, None, FAINT)),
        rung("Same gain", "29,000", "+2,000 a pcs · as before", "Same gain, 29,000 a piece. Faith is told", icon=TAG, bell=True),
        rung("Another price", "", "27,000 or more", "Another price, 27,000 or more", icon=PEN),
    )
    + dock(f'<div style="display: flex; flex-direction: column; gap: 6px">{sees("FN", "Faith", "Price set", on_navy=True, bell=True)}{sees("DO", "Denis", "Price set", on_navy=True)}</div>',
           "337,500", "gain 67,500", "Shop's price 33,750", "Shop's price, 33,750 a piece. Faith and Denis see Price set"),
    "Shop's price · app 7 → 2 taps · push 5 → 1",
    "Price up, from Denis, order 0552")

# =================== PHONE 4 · D-2 Brian #0553 ===================
cost_chip = (f'<div style="display: flex; align-items: center; gap: 6px; align-self: flex-start; height: 30px; padding: 0 10px 0 6px; border-radius: 999px; background: rgba(255,255,255,.1); font-size: 13px; font-weight: 700">'
             f'{dot("DO", 14)}Cost from Denis · Katwe {m("31,000", 13, 600)}</div>')
p4_scale = scale(29000, 42000, 31000, [
    dict(v=31000, kind="cost", label="Cost", txt="31,000", pos="down", align="left"),
    dict(v=37200, kind="tick"),
    dict(v=38750, kind="shop", label="+25%", txt="38,750", pos="up", fill=True),
    dict(v=40300, kind="tick"),
])
chips = "".join(
    f'<button aria-label="{a}" style="flex: 1; height: 52px; border: none; border-radius: 14px; background: #fff; box-shadow: inset 0 0 0 {"2px " + NAVY if on else "1px #E6E3DD"}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; color: {INK}">'
    f'<span style="font-size: 12px; font-weight: 700; color: {INK if on else SOFT}">{p}</span>{m(v, 13, 600)}</button>'
    for p, v, a, on in [("+20%", "37,200", "20 percent, 37,200", False), ("+25%", "38,750", "25 percent, the shop's markup, 38,750", True), ("+30%", "40,300", "30 percent, 40,300", False)])
p4 = phone("4 · D-2 · PRICE COMING · " + m("10:15"),
    sheet_head("BO", "Brian", "Price coming", "#0553", "Ggaba Stores", "0 h 10", "9 of 9",
               "Y12 rebar 12 m", "20 pcs", "775,000", "38,750 a pcs", chip=cost_chip)
    + body(
        scale_card(m("UGX a pcs", 11, None, FAINT), p4_scale,
                   gap_line(kv("Gain a pcs", "7,750", "#0F6B43") + kv("Markup", "25%") + kv("On 20 pcs", "+155,000", "#0F6B43"))).replace(">A sheet<", ">A piece<"),
        sec("Markup", m("the shop's is 25%", 11, None, FAINT)),
        f'<div style="display: flex; gap: 8px">{chips}</div>',
        rung("Another price", "", "31,000 or more", "Another price, 31,000 or more", icon=PEN),
    )
    + dock(sees("BO", "Brian", "Price set", on_navy=True, bell=True), "775,000", "gain 155,000", "Set 38,750", "Set the price, 38,750 a piece. Brian sees Price set"),
    "Set the price · app 6 → 2 taps · push 4 → 1",
    "Price coming, from Brian, order 0553")

# =================== SCORE PANEL ===================
scores = [
    ("D-1 · Under the shop's price", [5, 4, 5, 6, 4], [9, 9, 9, 9, 9]),
    ("D-4 · At the counter", [5, 6, 4, 6, 5], [9, 9, 9, 9, 9]),
    ("D-3 · Price up", [4, 3, 4, 6, 4], [9, 9, 9, 8, 9]),
    ("D-2 · Price coming", [4, 4, 4, 5, 4], [9, 9, 9, 9, 8]),
    ("D-33 · A new item to price", [3, 2, 3, 5, 2], [9, 9, 9, 8, 8]),
]
AG = [9, 9, 8, 8, 8]
LABELS = ["Agent consistency", "Taps per decision", "Glanceability", "Polish", "In step with asker"]
def avg(a): return sum(a) / len(a)
sp = []
for name, old, new in scores:
    rows = []
    for lab, o, a, n in zip(LABELS, old, AG, new):
        col = "#0F6B43" if n >= a else "#C93A30"
        rows.append(f'<div style="display: grid; grid-template-columns: 112px 1fr 64px; align-items: center; gap: 8px; height: 17px">'
                    f'<span style="font-size: 11px; font-weight: 600; color: {SOFT}; white-space: nowrap">{lab}</span>'
                    f'<span style="display: flex; flex-direction: column; gap: 1px">'
                    f'<i style="display: block; height: 3px; border-radius: 9px; background: #C9C4BA; width: {o*10}%"></i>'
                    f'<i style="display: block; height: 3px; border-radius: 9px; background: {NAVY}; width: {a*10}%"></i>'
                    f'<i style="display: block; height: 3px; border-radius: 9px; background: {col}; width: {n*10}%"></i></span>'
                    f'<span style="{MONO}; font-size: 11px; font-weight: 600; text-align: right; color: {FAINT}">{o} · <b style="color: {NAVY}">{a}</b> · <b style="color: {col}">{n}</b></span></div>')
    sp.append(f'<div style="display: flex; flex-direction: column; gap: 3px; padding-bottom: 8px; border-bottom: 1px solid #F1EEE8">'
              f'<div style="display: flex; align-items: baseline; justify-content: space-between"><span style="font-size: 13px; font-weight: 700">{name}</span>'
              f'<span style="{MONO}; font-size: 11px; color: {FAINT}">{avg(old):.1f} · <b style="color: {NAVY}">{avg(AG):.1f}</b> · <b style="color: #0F6B43">{avg(new):.1f}</b></span></div>{"".join(rows)}</div>')
all_old = avg([avg(o) for _, o, _ in scores]); all_new = avg([avg(n) for _, _, n in scores])
score_panel = (f'<div style="width: 360px; box-sizing: border-box; margin-top: 23px; background: #fff; border: 1px solid #E6E3DD; border-radius: 16px; padding: 14px 18px; display: flex; flex-direction: column; gap: 9px">'
    f'<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 17px; font-weight: 700">Scores · price sheets</span>'
    f'<span style="display: flex; gap: 10px; font-size: 11px; font-weight: 600; color: {SOFT}">'
    f'<span style="display: flex; align-items: center; gap: 4px"><i style="width: 10px; height: 4px; border-radius: 9px; background: #C9C4BA"></i>Manager today</span>'
    f'<span style="display: flex; align-items: center; gap: 4px"><i style="width: 10px; height: 4px; border-radius: 9px; background: {NAVY}"></i>Agent app</span>'
    f'<span style="display: flex; align-items: center; gap: 4px"><i style="width: 10px; height: 4px; border-radius: 9px; background: #0F6B43"></i>New</span></span></div>'
    f'{"".join(sp)}'
    f'<div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 0"><span style="font-size: 13px; font-weight: 700">Average</span>'
    f'<span style="{MONO}; font-size: 15px; font-weight: 600; color: {FAINT}">{all_old:.1f} · <b style="color: {NAVY}">{avg(AG):.1f}</b> · <b style="color: #0F6B43">{all_new:.1f}</b></span></div>'
    f'<div style="padding: 10px 12px; border-radius: 12px; background: #F1EEE8; display: flex; flex-direction: column; gap: 2px">'
    f'<span style="font-size: 12px; font-weight: 700">Agent match · Needs you + basket dock</span>'
    f'<span style="font-size: 12px; font-weight: 600; color: {SOFT}; line-height: 1.35">Navy sheet head like the Ask sheet · rows with an icon tile · navy dock with the total, the earn line and one move</span></div></div>')

# =================== STATES ===================
def card(label, inner, cap, pad=16, bg="#F7F5F2"):
    return (f'<div style="display: flex; flex-direction: column; gap: 8px">'
            f'<span style="font-size: 11px; font-weight: 700; letter-spacing: .08em; color: {SOFT}">{label}</span>'
            f'<div style="width: 360px; box-sizing: border-box; padding: {pad}px; border-radius: 20px; background: {bg}; border: 1px solid #E6E3DD; display: flex; flex-direction: column; gap: 10px; overflow: hidden">{inner}</div>'
            f'<span style="{MONO}; font-size: 12px; color: {SOFT}">{cap}</span></div>')

def mini_dock(seesline, btn, total="1,380,000", gl="gain 240,000"):
    return (f'<div style="background: {NAVY}; color: #fff; border-radius: 20px; padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 10px">'
            f'<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px">{seesline}'
            f'<div style="display: flex; flex-direction: column; align-items: flex-end">{m(total, 18, 600, "#fff")}{m(gl, 11, 600, "#6FDCB0")}</div></div>{btn}</div>')

def btn56(label, icon, bg="#fff", fg=NAVY, extra="", attrs=""):
    return (f'<button {attrs} style="width: 100%; height: 56px; border: none; border-radius: 999px; background: {bg}; color: {fg}; font-size: 16px; font-weight: 700; '
            f'display: flex; align-items: center; justify-content: center; gap: 8px; {extra}">{ico(icon, 20, 2.4)}{label}</button>')

def notif(title, body_lines, action_html, when="now"):
    lines = "".join(f'<span style="{MONO}; font-size: 12px; color: #D5DAE6; line-height: 1.35">{l}</span>' for l in body_lines)
    return (f'<div style="background: #0B1020; border-radius: 16px; padding: 10px">'
            f'<div style="background: #222A3D; border-radius: 14px; padding: 10px 12px 4px; display: flex; flex-direction: column; gap: 4px; color: #fff">'
            f'<span style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: {ONNAVY}"><i style="width: 14px; height: 14px; border-radius: 4px; background: #C93A30"></i>Manager · {when}</span>'
            f'<span style="font-size: 14px; font-weight: 700">{title}</span>{lines}'
            f'<div style="display: flex; align-items: center; gap: 4px; border-top: 1px solid rgba(255,255,255,.08); margin-top: 4px">{action_html}</div></div></div>')

def n_action(label, aria, col="#9FC3FF", icon=None):
    i = ico(icon, 16, 2.2) if icon else ""
    return (f'<button aria-label="{aria}" style="height: 44px; padding: 0 10px; border: none; background: none; color: {col}; font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 6px">{i}{label}</button>')

D1_NOTIF_BODY = ["Iron sheet G28 · 46,000, shop's 47,500", "cost 38,000 · 30 sht"]

# 1 DEFAULT · D-33 markup (compact sheet)
d33_scale = scale(26000, 38000, 28000, [
    dict(v=28000, kind="cost", label="Cost", txt="28,000", pos="down", align="left"),
    dict(v=33600, kind="tick"),
    dict(v=35000, kind="shop", label="+25%", txt="35,000", pos="up", fill=True),
    dict(v=36400, kind="tick"),
    dict(v=36000, kind="ghost", label="Rivals", txt="34–36k", pos="down", align="right", col=SOFT),
], zone_label=None, band=(34000, 36000))
d33 = (f'<div style="display: flex; align-items: center; gap: 10px">{avatar("ML", 38, "999px", 13)}'
       f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">A new item to price</span>'
       f'<span style="font-size: 12px; font-weight: 600; color: {SOFT}">From Moses · PVC pipe 4 in</span></div>{m("0 h 20", 13, 600)}</div>'
       f'<div style="background: #fff; border: 1px solid #E6E3DD; border-radius: 16px; padding: 4px 4px 2px">{d33_scale}</div>'
       f'<button aria-label="Markup 25 percent, 35,000 a piece" style="width: 100%; height: 52px; border: none; border-radius: 999px; background: {NAVY}; color: #fff; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px">{ico(CHECK, 18, 2.4)}Markup 25% · {m("35,000", 15, 600)}</button>'
       f'{sees("ML", "Moses", "Markup 25%")}')
s1 = card("DEFAULT · D-33 A NEW ITEM TO PRICE", d33, "markup · app 7 → 2 · push — → 1", pad=14)

# 2 PRESSED
s2 = card("PRESSED",
    rung("Shop's price", "47,500", "+45,000 on 30", "Shop's price", bell=True).replace("background: #fff; box-shadow: inset 0 0 0 1px #E6E3DD", "background: #EEF0F5; box-shadow: inset 0 0 0 2px #16203C; transform: scale(.98)")
    + mini_dock(sees("GA", "Grace", "Approved", on_navy=True), btn56("Approve 46,000", CHECK, "#DDE2EE", NAVY, "transform: scale(.97); box-shadow: 0 0 0 4px rgba(255,255,255,.18)")),
    "rung · inset navy ring · dock button greys 8% · 97%")

# 3 DISABLED · D-2 no known cost + under cost keypad
s3 = card("DISABLED · NO KNOWN COST",
    f'<div style="display: flex; gap: 8px">'
    f'<div style="flex: 1; height: 52px; border-radius: 14px; border: 1.5px dashed {SOFT}; display: flex; align-items: center; gap: 8px; padding: 0 12px; box-sizing: border-box">'
    f'<span style="font-size: 12px; font-weight: 700; color: {SOFT}">Cost</span>{m("?", 18, 600, SOFT)}</div>'
    f'<button aria-label="Ask Denis for the cost" style="height: 52px; padding: 0 14px; border: none; border-radius: 999px; background: {NAVY}; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px">{dot("DO", 14)}Ask Denis</button></div>'
    + btn56("Set price", CHECK, "#E6E3DD", SOFT, "cursor: default", 'disabled aria-disabled="true"')
    + f'<div style="display: flex; gap: 8px; align-items: center">'
    f'<div style="flex: 1; height: 52px; border-radius: 14px; background: #fff; box-shadow: inset 0 0 0 2px #8E2A22; display: flex; align-items: center; justify-content: space-between; padding: 0 12px">{m("36,000", 18, 600, "#8E2A22")}<span style="font-size: 12px; font-weight: 700; color: #8E2A22; display: flex; align-items: center; gap: 4px">{ico(LOCK, 13)}under 38,000</span></div>'
    f'<button disabled aria-disabled="true" style="height: 52px; padding: 0 18px; border: none; border-radius: 999px; background: #E6E3DD; color: {SOFT}; font-size: 14px; font-weight: 700; cursor: default">Use</button></div>',
    "no cost: Set waits · under cost: Use waits")

# 4 SENDING · notification (push path) + in-app sending
s4 = card("SENDING · FROM THE PUSH",
    notif("Grace · Under the shop's price · #0555", D1_NOTIF_BODY,
          n_action("Approve 46,000", "Approve 46,000 from the notification", icon=CHECK) + '<span style="flex: 1"></span>' + n_action("Open", "Open the decision", "#B3BCD2"))
    + mini_dock(sees("GA", "Grace", "Approved", on_navy=True), btn56("Approving", SPIN, "#243052", "#fff", "cursor: default", 'disabled aria-busy="true"')),
    "push: 1 tap · in the app: the dock spins", pad=12)

# 5 SUCCESS · Undo 10 s, next decision
s5 = card("SUCCESS · UNDO 10 S",
    notif("Approved · Iron sheet G28 · 46,000", ["Grace sees it · #0555"],
          n_action("Undo · 10 s", "Undo, 10 seconds left", "#9FC3FF", UNDO), when="09:40")
    + f'<div style="display: flex; align-items: center; gap: 10px; min-height: 60px; padding: 6px 8px 6px 10px; border-radius: 16px; background: #fff; box-shadow: inset 0 0 0 1px #E6E3DD">'
      f'<span style="width: 38px; height: 38px; flex: none; border-radius: 12px; background: #E4F4EA; color: #0F6B43; display: flex; align-items: center; justify-content: center">{ico(CHECK, 20)}</span>'
      f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700">Approved · {m("46,000")}</span>'
      f'<span style="{MONO}; font-size: 11px; color: {FAINT}">Next · Musa #0551 in 2 s</span></div>'
      f'<button aria-label="Undo, 10 seconds" style="height: 44px; padding: 0 14px; border: none; border-radius: 999px; background: #F1EEE8; color: {INK}; font-size: 13px; font-weight: 700">Undo {m("10", 13, 600)}</button></div>',
    "push and app say the same word · next comes by itself", pad=12)

# 6 ERROR
s6 = card("ERROR",
    f'<div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 16px; background: #fff; box-shadow: inset 0 0 0 2px #8E2A22">'
    f'<span style="width: 38px; height: 38px; flex: none; border-radius: 12px; background: #FBE5E2; color: #8E2A22; display: flex; align-items: center; justify-content: center">{ico("<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 8v5\"/><path d=\"M12 16h.01\"/>", 20)}</span>'
    f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700">Not saved</span>'
    f'<span style="{MONO}; font-size: 11px; color: {FAINT}">Grace still sees Ruth decides</span></div></div>'
    + mini_dock(sees("GA", "Grace", "Ruth decides", "#FDEEE1", "#7A4A02", on_navy=True), btn56("Try again", RETRY)),
    "the answer is kept · one tap sends it")

# 7 OFFLINE
s7 = card("OFFLINE",
    f'<div style="display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; border-radius: 14px; background: #FDEEE1; color: #7A4A02; font-size: 13px; font-weight: 700">{ico(OFF, 18)}No signal · it sends when back</div>'
    + mini_dock(sees("GA", "Grace", "Approved", "#FDEEE1", "#7A4A02", on_navy=True),
                btn56("Approve 46,000", CLOCK)),
    "still 1 tap · the answer waits on the phone")

# 8 EMPTY
s8 = card("EMPTY · ALL DECIDED",
    f'<div style="display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 17px; font-weight: 700"><i style="width: 8px; height: 8px; border-radius: 999px; background: #C9C4BA"></i><span style="flex: 1">Needs you</span>{m("0", 13, 600, SOFT)}</div>'
    f'<div style="height: 56px; border-radius: 16px; border: 1.5px dashed #C9C4BA; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 600; color: {SOFT}">{ico(CHECK, 18)}Every price decided</div>'
    f'<div style="display: flex; flex-direction: column; gap: 4px; padding: 0 4px">'
    f'<span style="display: flex; align-items: center; gap: 6px; {MONO}; font-size: 11px; color: {FAINT}">{dot("BO")}07:55 · #0549 · Approved</span></div>'
    f'<div style="display: flex; justify-content: center"><button aria-label="Decide: nothing waits" style="width: 64px; height: 64px; box-sizing: border-box; border-radius: 999px; background: #C93A30; color: #fff; border: 4px solid #F7F5F2; box-shadow: 0 6px 20px rgba(201,58,48,.35); display: flex; align-items: center; justify-content: center">{ico(PLUS, 28, 2.4)}</button></div>',
    "the + has no badge · the log keeps today's answers")

# =================== BOARD ===================
def chip_n(n, t, inv=False):
    if inv:
        return (f'<span style="display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px 0 4px; border-radius: 999px; background: #fff; font-size: 13px; font-weight: 700; white-space: nowrap">'
                f'<b style="min-width: 22px; height: 22px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; background: #A82D24; color: #fff; {MONO}; font-size: 11px; display: flex; align-items: center; justify-content: center">{n}</b>{t}</span>')
    return (f'<span style="display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px 0 4px; border-radius: 999px; background: rgba(255,255,255,.1); font-size: 13px; font-weight: 700; white-space: nowrap">'
            f'<b style="min-width: 22px; height: 22px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; background: #fff; color: {NAVY}; {MONO}; font-size: 11px; display: flex; align-items: center; justify-content: center">{n}</b>{t}</span>')

top = (f'<div style="height: 64px; display: flex; align-items: center; gap: 20px">'
       f'<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 28px; font-weight: 800; letter-spacing: -.01em">Decide · prices</span>'
       f'<span style="{MONO}; font-size: 12px; color: {SOFT}">manager.html · the red + · Sat 17 Oct · mirrors Agent Needs you + dock</span></div>'
       f'<div style="flex: 1"></div>'
       f'<div style="display: flex; align-items: center; gap: 6px; height: 44px; padding: 0 8px 0 14px; border-radius: 999px; background: {NAVY}; color: #fff">'
       f'<span style="font-size: 13px; font-weight: 700; white-space: nowrap">Asks in</span>'
       f'{chip_n("D-1", "Under the shop&#39;s price")}{chip_n("D-2", "Price coming")}{chip_n("D-3", "Price up")}{chip_n("D-4", "At the counter")}{chip_n("D-33", "A new item")}</div>'
       f'<div style="display: flex; align-items: center; gap: 6px; height: 44px; padding: 0 8px 0 14px; border-radius: 999px; background: #FDE8E4; color: #A82D24">'
       f'<span style="font-size: 13px; font-weight: 700; white-space: nowrap">Answers out</span>'
       f'{chip_n("2", "Approved", True)}{chip_n("2", "Price set", True)}{chip_n("3", "Shop&#39;s price", True)}{chip_n("1", "Markup 25%", True)}</div></div>')

html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Decide prices</title>
<script src="./support.js"></script></head><body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&amp;family=IBM+Plex+Mono:wght@500;600&amp;display=swap">
<style>body{{margin:0}} a{{color:#16203C}}a:hover{{color:#C93A30}} button{{font-family:inherit;cursor:pointer;margin:0}} svg{{flex:none}}</style>
</helmet>
<div style="width: 2040px; height: 1720px; box-sizing: border-box; padding: 40px; background: #F7F5F2; font-family: Figtree, system-ui, sans-serif; color: #1C2233; display: flex; flex-direction: column; gap: 24px; overflow: hidden">
{top}
<div style="display: flex; gap: 40px; align-items: flex-start">
{p1}
{p2}
{p3}
{p4}
{score_panel}
</div>
<div style="display: grid; grid-template-columns: repeat(4, 460px); gap: 22px 40px">
{s1}{s2}{s3}{s4}{s5}{s6}{s7}{s8}
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":2040,"height":1720}}}}'>
class Component extends DCLogic {{ renderVals() {{ return {{}}; }} }}
</script></body></html>
'''
open(OUT, "w").write(html)
print("ok", len(html))
