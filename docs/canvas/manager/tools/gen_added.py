# Generates Added.dc.html and Added2.dc.html: the pages the canvas did not draw yet (spec 04 §5, AD01–AD05).
# Reuses the Money board's parts (gen_money.py) and the ONE decision sheet's dock parts (sheet.py).
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
_src = open(os.path.join(HERE, "gen_money.py")).read()
_src = _src[:_src.index('with open(os.path.join(OUT, "Money.dc.html")')]  # parts only, no writes
G = {"__file__": os.path.join(HERE, "gen_money.py")}
exec(compile(_src, "gen_money.py", "exec"), G)
globals().update({k: v for k, v in G.items() if not k.startswith("__")})
import sheet as SH  # noqa: E402

P.update({
    "bag": '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    "sheet": '<path d="M3 9l3-3 3 3 3-3 3 3 3-3 3 3v9l-3-3-3 3-3-3-3 3-3-3-3 3z"/>',
    "ridge": '<path d="M3 15l9-7 9 7"/><path d="M3 20l9-7 9 7"/>',
    "out": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    "store": '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8"/>',
    "decide": '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 12l3 3 5-6"/>',
    "cloud": '<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1 0 8z"/><path d="M4 4l16 16"/>',
    "log": '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    "book": '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    "copy": '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
})


def M(t, size=12, w=600, color=None):
    return mono(t, size, w, color, "; letter-spacing: 0")


def mlabel(t):
    return f"<span style=\"font-family: 'IBM Plex Mono', monospace\">{t}</span>"


# ===================================================================== AD01 · sign in
def brand_hero(h=176):
    return (f'<div style="height: {h}px; box-sizing: border-box; background: {NAVY}; color: #fff; border-radius: 0 0 28px 28px; padding: 0 24px 24px; display: flex; flex-direction: column; justify-content: flex-end; gap: 14px">'
            f'<div style="display: flex; align-items: center; gap: 12px"><span style="width: 52px; height: 52px; border-radius: 16px; background: rgba(255,255,255,.08); color: {MINT}; display: flex; align-items: center; justify-content: center">{ic(P["decide"], 26)}</span>'
            f'<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; font-weight: 700; letter-spacing: .08em; color: {ONNAVY}">MUKASA HARDWARE</span>'
            f'<span style="font-size: 26px; font-weight: 800">Manager</span></span></div>'
            f'<span style="font-size: 14px; font-weight: 600; color: {ONNAVY}">Decide · Money · Team</span></div>')


def field(label, value="", kind="empty", pw=False):
    ring = {"empty": f"inset 0 0 0 1px {LINE}", "focus": f"inset 0 0 0 1.5px {NAVY}", "bad": f"inset 0 0 0 1.5px {BAD}", "filled": f"inset 0 0 0 1px {LINE}"}[kind]
    v = ""
    if value:
        v = (f'<span style="font-size: 18px; font-weight: 700; letter-spacing: .18em; color: {INK}">{value}</span>' if pw
             else f'<span style="font-size: 15px; font-weight: 600; color: {INK}">{value}</span>')
    return (f'<label style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 12px; font-weight: 700; color: {SOFT}">{label}</span>'
            f'<span style="height: 48px; box-sizing: border-box; border-radius: 14px; background: #fff; box-shadow: {ring}; padding: 0 14px; display: flex; align-items: center">{v}</span></label>')


def sign_btn(state="default"):
    base = "width: 100%; height: 56px; border: none; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px"
    if state == "sending":
        return f'<button aria-busy="true" style="{base}; background: {NAVY3}; color: {ONNAVY}">{ic(P["spin"], 18, 2.4)}Signing in</button>'
    if state == "off":
        return f'<button disabled aria-disabled="true" style="{base}; background: {LINE}; color: {SOFT}">Sign in</button>'
    return f'<button style="{base}; background: {NAVY}; color: #fff">Sign in</button>'


def bar_msg(text, kind):
    bg, fg, i = {"bad": (BADBG, BAD, "alert"), "warn": (WARNBG, WARNINK, "wifioff")}[kind]
    return (f'<div role="alert" style="display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 12px; background: {bg}; color: {fg}; font-size: 13px; font-weight: 700">{ic(P[i], 16)}{text}</div>')


def sign_form(state="default"):
    if state == "default":
        f = field("Email") + field("Password") + sign_btn()
    elif state == "sending":
        f = field("Email", "ruth@mukasa.ug", "filled") + field("Password", "••••••••", "filled", True) + sign_btn("sending")
    elif state == "wrong":
        f = field("Email", "ruth@mukasa.ug", "filled") + field("Password", "••••", "bad", True) + bar_msg("Wrong email or password", "bad") + sign_btn()
    else:
        f = field("Email", "ruth@mukasa.ug", "filled") + field("Password", "••••••••", "filled", True) + bar_msg("No signal · try when you have signal", "warn") + sign_btn("off")
    return card(f, pad="16px", gap=14)


def keeps_line():
    return (f'<span style="display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; font-weight: 600; color: {SOFT}">'
            f'{ic(P["lock"], 14)}The phone keeps you signed in</span>')


def p_signin():
    return brand_hero() + f'<div style="padding: 16px; display: flex; flex-direction: column; gap: 14px">{sign_form()}{keeps_line()}</div>'


def p_noreach():
    big = (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 8px 0 4px">'
           f'<span style="position: relative; width: 88px; height: 88px; border-radius: 999px; background: {WARNBG}; color: {WARN}; display: flex; align-items: center; justify-content: center">{ic(P["cloud"], 40, 1.8)}</span>'
           f'<span style="font-size: 22px; font-weight: 800; text-align: center">Could not reach the shop</span>'
           f'<span style="{MONO}; letter-spacing: 0; font-size: 12px; color: {SOFT}">tried 09:40</span></div>')
    copy = (f'<button aria-label="Open the copy saved on this phone at 09:38" style="width: 100%; border: none; background: #fff; box-shadow: inset 0 0 0 1px {LINE}; border-radius: 16px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; text-align: left; color: {INK}">'
            f'<span style="width: 40px; height: 40px; flex: none; border-radius: 12px; background: {TILE}; display: flex; align-items: center; justify-content: center">{ic(P["copy"], 20)}</span>'
            f'<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">Open the saved copy</span>'
            f'<span style="font-size: 12px; font-weight: 600; color: {SOFT}">saved {M("09:38", 12, 600, INK)} · look only</span></span>'
            f'<span style="color: {SOFT}">{ic(P["chev"], 18)}</span></button>')
    retry = (f'<button style="width: 100%; height: 56px; border: none; border-radius: 999px; background: {NAVY}; color: #fff; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px">{ic(P["retry"], 18, 2.4)}Try again</button>')
    out = (f'<button style="width: 100%; height: 48px; border: none; border-radius: 999px; background: transparent; color: {SOFT}; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px">{ic(P["out"], 16)}Sign out</button>')
    return (brand_hero(136) + f'<div style="padding: 20px 16px; display: flex; flex-direction: column; gap: 14px">{big}{retry}{copy}{out}</div>'
            )


def first_load():
    sk = lambda w, h=12, c="rgba(255,255,255,.12)": f'<i style="display: block; width: {w}; height: {h}px; border-radius: 999px; background: {c}"></i>'
    return (f'<div style="background: {NAVY}; color: #fff; border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px">'
            f'<div style="display: flex; align-items: center; justify-content: space-between"><span style="font-size: 18px; font-weight: 700">Good morning, Ruth</span>'
            f'<span style="display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; background: rgba(255,255,255,.08); font-size: 12px; font-weight: 600; color: {ONNAVY}">{ic(P["spin"], 13, 2.4)}Getting the shop</span></div>'
            f'{sk("62%", 26)}{sk("100%", 6)}</div>'
            f'<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px">' +
            "".join(f'<i style="height: 58px; border-radius: 12px; background: #ECE8E1"></i>' for _ in range(4)) + '</div>'
            + "".join(f'<div style="display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 10px 12px"><i style="width: 36px; height: 36px; border-radius: 999px; background: #ECE8E1"></i>'
                      f'<span style="flex: 1; display: flex; flex-direction: column; gap: 6px">{sk("70%", 10, "#ECE8E1")}{sk("45%", 8, "#F1EEE8")}</span></div>' for _ in range(2)))


# ===================================================================== AD02 · You
def today_behind():
    tile = lambda n, l: (f'<span style="height: 64px; border-radius: 14px; background: #fff; border: 1px solid {LINE}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px">'
                         f'{M(n, 18)}<span style="font-size: 11px; font-weight: 600; color: {SOFT}">{l}</span></span>')
    return (f'<div style="background: {NAVY}; color: #fff; border-radius: 0 0 28px 28px; padding: 16px 20px 18px; display: flex; flex-direction: column; gap: 10px">'
            f'<div style="display: flex; align-items: center; justify-content: space-between"><span style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 22px; font-weight: 700">Good morning, Ruth</span>'
            f'<span style="font-size: 14px; font-weight: 600; color: {ONNAVY}">Sat 17 Oct · Live</span></span>'
            f'<span style="width: 44px; height: 44px; border-radius: 999px; background: #0B1226; box-shadow: inset 0 0 0 2px #fff, 0 0 0 4px rgba(255,255,255,.25); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700">RN</span></div>'
            f'<span style="font-size: 12px; font-weight: 600; letter-spacing: .06em; color: {ONNAVY}">SALES INVOICED · OCTOBER ›</span>{ugx("61,110,000", 30)}'
            f'<div style="height: 6px; border-radius: 999px; background: rgba(255,255,255,.12)"><i style="display: block; width: 58%; height: 100%; border-radius: 999px; background: #fff"></i></div></div>'
            f'<div style="padding: 14px 16px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px">{tile("3", "Checking")}{tile("2", "Buying")}{tile("2", "Packing")}{tile("1", "On the road")}</div>')


def you_switch(on=True):
    bg = GOOD if on else "#C9C4BA"
    pos = "right: 3px" if on else "left: 3px"
    return (f'<button role="switch" aria-checked="{str(on).lower()}" aria-label="Pushes on this phone" style="flex: none; width: 60px; height: 44px; border: none; background: none; padding: 0; position: relative; display: flex; align-items: center">'
            f'<span style="position: relative; width: 52px; height: 30px; border-radius: 999px; background: {bg}; display: block"><i style="position: absolute; top: 3px; {pos}; width: 24px; height: 24px; border-radius: 999px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25)"></i></span></button>')


def you_sheet(state="default"):
    if state == "sending":
        btn = f'<button aria-busy="true" style="width: 100%; height: 56px; border: none; border-radius: 999px; background: {NAVY3}; color: {ONNAVY}; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px">{ic(P["spin"], 18, 2.4)}Signing out</button>'
    else:
        btn = f'<button style="width: 100%; height: 56px; border: none; border-radius: 999px; background: {NAVY}; color: #fff; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px">{ic(P["out"], 18, 2.2)}Sign out</button>'
    rows = card(
        f'<div style="display: flex; align-items: center; gap: 12px; min-height: 52px; border-bottom: 1px solid {TILE}"><span style="width: 36px; height: 36px; border-radius: 12px; background: {TILE}; display: flex; align-items: center; justify-content: center">{ic(P["store"], 18)}</span>'
        f'<span style="flex: 1; font-size: 14px; font-weight: 600; color: {SOFT}">Shop</span><span style="font-size: 14px; font-weight: 700">Mukasa Hardware</span></div>'
        f'<div style="display: flex; align-items: center; gap: 12px; min-height: 52px"><span style="width: 36px; height: 36px; border-radius: 12px; background: {GOODBG}; color: {GOOD}; display: flex; align-items: center; justify-content: center">{ic(P["bell"], 18)}</span>'
        f'<span style="flex: 1; font-size: 14px; font-weight: 700">Pushes on this phone</span>{you_switch(True)}</div>', pad="2px 14px", gap=0)
    return (f'<div role="dialog" aria-label="You" style="position: absolute; left: 0; right: 0; bottom: 0; background: {BG}; border-radius: 26px 26px 0 0; padding: 10px 16px 20px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 -8px 24px rgba(22,32,60,.25)">'
            f'<span style="align-self: center; width: 40px; height: 5px; border-radius: 999px; background: {DASH}"></span>'
            f'<div style="display: flex; align-items: center; gap: 12px">{av("RN", 56)}'
            f'<span style="flex: 1; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 20px; font-weight: 800">Ruth Nakato</span><span style="font-size: 13px; font-weight: 600; color: {SOFT}">Manager · Mukasa Hardware</span></span>'
            f'<button aria-label="Close" style="width: 44px; height: 44px; border-radius: 999px; border: none; background: #fff; box-shadow: inset 0 0 0 1px {LINE}; color: {INK}; display: flex; align-items: center; justify-content: center; padding: 0">{ic(P["close"], 18)}</button></div>'
            f'{rows}{btn}</div>')


def p_you():
    return (today_behind() + tabbar("Today")
            + '<div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(12,18,38,.55)"></div>' + you_sheet())


# ===================================================================== AD05 · Denis's restock list
def weeks(n, of=8):
    col = BAD if n <= 2 else (WARN if n <= 3 else GOOD)
    cells = "".join(f'<i style="flex: 1; height: 6px; border-radius: 2px; background: {col if i < n else LINE}"></i>' for i in range(of))
    return f'<span role="img" aria-label="{n} weeks left on the shelf" style="display: flex; gap: 2px; width: 120px">{cells}</span>'


RESTOCK = {
    "sheet": ("sheet", "Iron sheet G28", "60", "sht", "2,280,000", 2),
    "cement": ("bag", "Cement 50 kg", "40", "bag", "1,360,000", 6),
    "ridge": ("ridge", "Ridge cap 3 m", "30", "pcs", "810,000", 3),
}


def rs_row(key, ctrl="notyet", first=False):
    icn, name, q, u, amt, w = RESTOCK[key]
    held = ctrl in ("held", "done")
    if ctrl == "notyet":
        btn = pill("Not yet", "navy", 44, aria=f"Not yet: hold the {name} restock, Denis is told")
    elif ctrl == "pressed":
        btn = (f'<button aria-label="Not yet: hold the {name} restock" style="flex: none; height: 44px; padding: 0 16px; border: none; border-radius: 999px; background: #0C1326; color: #fff; font-size: 13px; font-weight: 700; transform: scale(.95); box-shadow: 0 0 0 4px rgba(22,32,60,.15)">Not yet</button>')
    elif ctrl == "waits":
        btn = (f'<span style="flex: none; display: inline-flex; align-items: center; gap: 5px; height: 36px; padding: 0 12px; border-radius: 999px; background: {TILE}; color: {SOFT}; font-size: 13px; font-weight: 700">{ic(P["clock"], 14)}Waits</span>')
    elif ctrl == "done":
        btn = ""  # the toast below holds the Undo
    else:
        btn = pill("Go ahead", "line", 44, aria=f"Go ahead: let Denis buy {name}")
    tag = ""
    if held:
        when = "09:41" if ctrl == "done" else "Thu 15"
        tag = f'<span style="display: flex; align-items: center; gap: 6px">{chip("Not yet · Ruth", "warn")}{M(when, 11, 600, FAINT)}</span>'
    else:
        tag = weeks(w)
    sub = f'{amt} · {w} weeks left'
    bt = "" if first else f"border-top: 1px solid {TILE};"
    tint = f"background: {WARNBG};" if False else ""
    return (f'<div style="display: flex; align-items: center; gap: 10px; min-height: 78px; padding: 8px 0; box-sizing: border-box; {bt}{tint}">'
            f'<span style="width: 40px; height: 40px; flex: none; border-radius: 12px; background: {TILE}; color: {INK}; display: flex; align-items: center; justify-content: center">{ic(P[icn], 20)}</span>'
            f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 14px; font-weight: 700; white-space: nowrap">{name} · {M(q + " " + u, 13, 600, INK)}</span>'
            f'<span style="{MONO}; letter-spacing: 0; font-size: 11px; color: {FAINT}; white-space: nowrap">{sub}</span>{tag}</span>{btn}</div>')


def rs_sees(word="Not yet", kind="warn"):
    return (f'<div style="display: flex; align-items: center; gap: 6px; padding: 0 4px; font-size: 12px; font-weight: 600; color: {SOFT}">{ic(P["eye"], 14)}{dot("DO")}Denis sees{chip(word, kind)}'
            f'<span>or</span>{chip("Go ahead", "good")}{ic(P["bell"], 14)}</div>')


def p_restock():
    hero = (f'<div style="background: {NAVY}; color: #fff; border-radius: 0 0 28px 28px; padding: 14px 20px 18px; display: flex; flex-direction: column; gap: 12px">'
            f'<div style="display: flex; align-items: center; gap: 10px">'
            f'<button aria-label="Back to Orders" style="width: 44px; height: 44px; border-radius: 999px; border: none; background: rgba(255,255,255,.08); color: #fff; display: flex; align-items: center; justify-content: center; padding: 0">{ic(P["back"], 18)}</button>'
            f'<span style="flex: 1; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 17px; font-weight: 700">Denis\'s restock list</span>'
            f'<span style="display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: {ONNAVY}">{dot("DO")}Denis · next trip {M("11:30", 12, 600, "#FFFFFF")}</span></span></div>'
            f'<div style="display: flex; flex-direction: column; gap: 7px"><span style="font-size: 12px; font-weight: 600; letter-spacing: .06em; color: {ONNAVY}">THIS TRIP · 3 LINES</span>'
            f'{ugx("4,450,000", 30)}'
            f'<div style="display: flex; gap: 3px; height: 6px"><i style="display: block; width: 81.8%; background: #fff; border-radius: 999px"></i><i style="display: block; flex: 1; border-radius: 999px; background: #F5B26B"></i></div>'
            f'<div style="display: flex; gap: 14px; font-size: 12px; font-weight: 600; color: {ONNAVY}">'
            f'<span style="display: flex; align-items: center; gap: 5px"><i style="width: 8px; height: 8px; border-radius: 999px; background: #fff"></i>Go ahead {M("3,640,000", 12, 600, "#FFFFFF")}</span>'
            f'<span style="display: flex; align-items: center; gap: 5px"><i style="width: 8px; height: 8px; border-radius: 999px; background: #F5B26B"></i>Not yet {M("810,000", 12, 600, "#FFFFFF")}</span></div></div></div>')
    body = (f'<div style="padding: 12px 16px 0; display: flex; flex-direction: column; gap: 8px">'
            f'{sec("Planned", "2 · shortest first")}'
            + card(rs_row("sheet", first=True) + rs_row("cement"), pad="0 12px", gap=0)
            + sec("Not yet", "1", extra="; margin-top: 4px")
            + card(rs_row("ridge", "held", first=True), pad="0 12px", gap=0)
            + rs_sees() + '</div>')
    return hero + body + tabbar("Orders")


# ===================================================================== AD03 · Change the limit
def dim():
    return '<div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(12,18,38,.55)"></div>'


def sheet_wrap(top, inner):
    return (f'<div role="dialog" style="position: absolute; left: 0; right: 0; top: {top}px; bottom: 0; background: {BG}; border-radius: 26px 26px 0 0; padding: 10px 16px 0; display: flex; flex-direction: column; gap: 12px">'
            f'<span style="align-self: center; width: 40px; height: 5px; border-radius: 999px; background: {DASH}"></span>{inner}</div>')


def sheet_title(tile, title, sub):
    return (f'<div style="display: flex; align-items: center; gap: 10px">{tile}<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 20px; font-weight: 800; white-space: nowrap">{title}</span>'
            f'<span style="{MONO}; letter-spacing: 0; font-size: 11px; color: {SOFT}; white-space: nowrap">{sub}</span></span>'
            f'<button aria-label="Close" style="width: 44px; height: 44px; flex: none; border-radius: 999px; border: none; background: #fff; box-shadow: inset 0 0 0 1px {LINE}; color: {INK}; display: flex; align-items: center; justify-content: center; padding: 0">{ic(P["close"], 18)}</button></div>')


def chip_row(opts, on, pressed=None, now=None):
    out = []
    for o in opts:
        sel = o == on
        bg = NAVY if sel else "#fff"; col = "#fff" if sel else INK
        bd = "none" if sel else f"inset 0 0 0 1px {LINE}"
        extra = ""
        if o == pressed:
            bg, col, bd = "#0C1326", "#fff", "0 0 0 4px rgba(22,32,60,.15)"; extra = "; transform: scale(.95)"
        mark = (f'<i style="position: absolute; top: -6px; left: 50%; transform: translateX(-50%); height: 12px; padding: 0 5px; border-radius: 999px; background: {TILE}; color: {SOFT}; font-size: 9px"></i>' if False else "")
        lab = o
        if o == now:
            lab = f'{o}<span style="position: absolute; bottom: -7px; left: 50%; transform: translateX(-50%); height: 14px; padding: 0 5px; border-radius: 999px; background: {TILE}; color: {SOFT}; font-family: Figtree; font-size: 11px; line-height: 14px; font-weight: 700">now</span>'
        wide = "flex: 1.6" if o == "Cash only" else "flex: 1"
        fam = "font-family: Figtree, sans-serif" if o == "Cash only" else f"{MONO}; letter-spacing: 0"
        out.append(f'<button aria-pressed="{str(sel).lower()}" style="position: relative; {wide}; min-width: 0; height: 44px; border-radius: 999px; border: none; background: {bg}; color: {col}; box-shadow: {bd}; {fam}; font-size: 13px; font-weight: 700; padding: 0; white-space: nowrap{extra}">{lab}</button>')
    return f'<div style="display: flex; gap: 6px">{"".join(out)}</div>'


def owe_vs_limit(limit_m=3):
    lim = limit_m * 1_000_000
    span = max(lim, 2_000_000)
    owe_w = 1615000 / span * 100
    now_x = 2_000_000 / span * 100
    left = lim - 1615000
    mk = (f'<i style="position: absolute; left: {now_x:.1f}%; top: -5px; height: 24px; border-left: 2px dashed {INK}"></i>' if lim != 2_000_000 else "")
    labels = (f'<div style="position: relative; height: 15px; font-size: 11px; font-weight: 700">'
              + (f'<span style="position: absolute; left: {now_x:.1f}%; transform: translateX(-50%); color: {INK}; white-space: nowrap">now {M("2M", 11, 700)}</span>' if lim != 2_000_000 else "")
              + f'<span style="position: absolute; right: 0; color: {GOOD}; white-space: nowrap">{M(f"{limit_m}M", 11, 700, GOOD)}</span></div>')
    return card(
        f'<div style="display: flex; align-items: baseline; justify-content: space-between"><span style="font-size: 13px; font-weight: 700; color: {SOFT}">Owes · 6 orders</span>{M("1,615,000", 18)}</div>'
        f'<div style="position: relative"><div style="height: 14px; border-radius: 999px; background: #ECE8E1; overflow: hidden"><i style="display: block; width: {owe_w:.1f}%; height: 100%; background: {NAVY}; border-radius: 999px"></i></div>{mk}</div>'
        f'{labels}'
        f'<div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 600; color: {SOFT}"><span>Left</span>{M(f"{left:,}", 13, 600, GOOD)}</div>', pad="12px 14px", gap=6)


def limit_dock(state="default"):
    if state == "disabled":
        main = SH.s_primary("Nothing to save", state="disabled")
        sees = SH.s_sees("Grace", "Limit 2,000,000 · 14 days")
    else:
        main = SH.s_primary("Save · Limit 3,000,000 · 14 days", aria="Save: limit 3,000,000, 14 days for Ggaba Stores. Grace sees it", state=state)
        sees = SH.s_sees("Grace", "Limit 3,000,000 · 14 days")
    return SH.sheet_dock(sees, main)


def limit_body(on="3M", pressed=None, terms="14 d"):
    lim = {"1.5M": 1.5, "2M": 2, "3M": 3, "5M": 5}.get(on, 3)
    return (sheet_title(cust("GS", 40), "Ggaba Stores", "Limit now 2,000,000 · 14 days")
            + sec("Limit", "")
            + chip_row(["1.5M", "2M", "3M", "5M", "Cash only"], on, pressed, now="2M")
            + sec("Terms", "", extra="; margin-top: 4px")
            + chip_row(["7 d", "14 d", "30 d"], terms, now="14 d")
            + owe_vs_limit(lim if lim != 1.5 else 1.5))


def p_limit():
    dk = limit_dock().replace("flex: none; background: " + SH.S_NAVY, "position: absolute; left: 0; right: 0; bottom: 0; background: " + SH.S_NAVY, 1)
    return money_p4() + dim() + sheet_wrap(206, limit_body()) + dk


# ===================================================================== AD04 · Look alike, Old books
def rec_big(name, orders, owes, keep, who_):
    ring = f"inset 0 0 0 2px {NAVY}" if keep else f"inset 0 0 0 1px {LINE}"
    mark = (f'<span style="width: 24px; height: 24px; flex: none; border-radius: 999px; background: {NAVY}; color: #fff; display: flex; align-items: center; justify-content: center">{ic(P["check"], 14, 3)}</span>' if keep
            else f'<span style="width: 24px; height: 24px; flex: none; box-sizing: border-box; border-radius: 999px; border: 2px solid {DASH}"></span>')
    tag = chip("Kept", "navy") if keep else chip("Merged in", "soft")
    return (f'<button aria-pressed="{str(keep).lower()}" aria-label="Keep {name}" style="flex: 1; min-width: 0; border: none; background: #fff; box-shadow: {ring}; border-radius: 16px; padding: 12px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; text-align: left; color: {INK}">'
            f'<span style="display: flex; align-items: center; gap: 8px; width: 100%">{mark}<span style="font-size: 15px; font-weight: 800; white-space: nowrap">{name}</span></span>'
            f'<span style="display: flex; flex-direction: column; gap: 3px; width: 100%">'
            f'<span style="display: flex; justify-content: space-between">{M("orders", 11, 600, FAINT)}{M(orders, 13, 600, INK)}</span>'
            f'<span style="display: flex; justify-content: space-between">{M("owes", 11, 600, FAINT)}{M(owes, 13, 600, INK)}</span></span>'
            f'<span style="display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: {SOFT}; white-space: nowrap">{who_}</span>{tag}</button>')


def look_body():
    same = card(
        f'<div style="display: flex; align-items: center; gap: 10px"><span style="width: 36px; height: 36px; flex: none; border-radius: 12px; background: {WARNBG}; color: {WARN}; display: flex; align-items: center; justify-content: center">{ic(P["call"], 18)}</span>'
        f'<span style="flex: 1; display: flex; flex-direction: column; gap: 2px">{M("0772 418 330", 15, 600, INK)}<span style="font-size: 12px; font-weight: 600; color: {SOFT}">on both</span></span>{chip("Same phone", "warn", 26, 12)}</div>', pad="10px 14px", gap=0)
    after = card(
        f'<div style="display: flex; align-items: center; justify-content: space-between"><span style="font-size: 13px; font-weight: 700; color: {SOFT}">After · Ggaba Stores</span>{M("1,615,000", 16)}</div>'
        f'<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px">'
        + "".join(f'<i style="height: 14px; border-radius: 4px; background: {NAVY if i < 6 else "#8D99B5"}"></i>' for i in range(7)) +
        f'</div><div style="display: flex; justify-content: space-between; {MONO}; letter-spacing: 0; font-size: 11px; color: {FAINT}"><span>6 + 1 = 7 orders</span><span>owes 1,615,000 + 0</span></div>', pad="12px 14px", gap=8)
    return (sheet_title(f'<span style="width: 40px; height: 40px; flex: none; border-radius: 12px; background: {WARNBG}; color: {WARN}; display: flex; align-items: center; justify-content: center">{ic(P["merge"], 20)}</span>',
                        "Look alike", "2 customers look alike")
            + same
            + f'<div style="display: flex; gap: 8px">{rec_big("Ggaba Stores", "6", "1,615,000", True, dot("GA") + "Grace sells here")}{rec_big("Gaba Stores", "1", "0", False, dot("GA") + "Grace · 1 order")}</div>'
            + after)


def log_line():
    return (f'<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: {SH.S_ON}; white-space: nowrap">{ic(P["log"], 14)}'
            f'<span>Goes in the owner\'s log</span></div>')


def abs_dock(d):
    return d.replace("flex: none; background: " + SH.S_NAVY, "position: absolute; left: 0; right: 0; bottom: 0; background: " + SH.S_NAVY, 1)


def p_look():
    dk = SH.sheet_dock(log_line(), SH.s_slide("Merge into Ggaba Stores", aria="Slide: merge Gaba Stores into Ggaba Stores, 7 orders"),
                       SH.s_second("Not the same", "Not the same: keep both records, the look alike goes away"))
    return money_p4() + dim() + sheet_wrap(96, look_body()) + abs_dock(dk)


def books_body():
    total = 1905000
    span = 2000000
    ob = 290000 / span * 100; bl = 1615000 / span * 100
    fig = card(
        f'<div style="display: flex; align-items: center; justify-content: space-between"><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; font-weight: 700; color: {SOFT}">Old books</span>'
        f'<span style="font-size: 12px; font-weight: 600; color: {SOFT}">from the fresh start · {M("1 Oct", 12, 600, INK)}</span></span>{M("290,000", 24)}</div>', pad="12px 14px", gap=0)
    bar = card(
        f'<div style="display: flex; align-items: baseline; justify-content: space-between; gap: 8px"><span style="font-size: 13px; font-weight: 700; color: {SOFT}">Owes</span>'
        f'<span style="{MONO}; letter-spacing: 0; font-size: 14px; font-weight: 600; white-space: nowrap"><span style="color: {FAINT}; text-decoration: line-through">1,615,000</span> → 1,905,000</span></div>'
        f'<div style="position: relative"><div style="display: flex; gap: 2px; height: 14px; border-radius: 999px; overflow: hidden; background: #ECE8E1">'
        f'<i style="display: block; width: {ob:.1f}%; background: {WARN}; {HATCH}"></i><i style="display: block; width: {bl:.1f}%; background: {NAVY}"></i></div>'
        f'<i style="position: absolute; right: 0; top: -5px; height: 24px; border-left: 2px dashed {INK}"></i></div>'
        f'<div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700"><span style="color: {SOFT}">limit {M("2M", 11, 700, INK)}</span><span style="color: {WARN}">{M("95,000", 11, 700, WARN)} left</span></div>', pad="12px 14px", gap=6)
    rows = [(WARN, HATCH, "Old books", "since 1 Oct", "290,000", True),
            (NAVY, "", "6 orders", "1 Oct → 17 Oct · oldest 16 d", "1,615,000", False)]
    bills = card("".join(
        f'<div style="display: flex; align-items: center; gap: 10px; min-height: 48px{"; border-top: 1px solid " + TILE if i else ""}">'
        f'<i style="width: 12px; height: 28px; flex: none; border-radius: 4px; background: {c}; {h}"></i>'
        f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px"><span style="font-size: 14px; font-weight: 700">{n}</span>{M(s, 11, 500, FAINT)}</span>'
        f'{M(a, 13)}{chip("new", "warn") if new else ""}</div>' for i, (c, h, n, s, a, new) in enumerate(rows)), pad="2px 14px", gap=0)
    return (sheet_title(f'<span style="width: 40px; height: 40px; flex: none; border-radius: 12px; background: {TILE}; display: flex; align-items: center; justify-content: center">{ic(P["book"], 20)}</span>',
                        "Old books", "Ggaba Stores · since 1 Oct")
            + fig + bar + sec("Bills", "2") + bills)


def p_books():
    dk = SH.sheet_dock(log_line(), SH.s_slide("Opening balance", "290,000", aria="Slide: opening balance 290,000 for Ggaba Stores"))
    return money_p4() + dim() + sheet_wrap(136, books_body()) + abs_dock(dk)


def way_in():
    def fc(label, n, kind="off", dot_=None):
        st = {"on": f"background: {NAVY}; color: #fff;", "off": f"background: #fff; color: {INK}; box-shadow: inset 0 0 0 1px {LINE};",
              "press": f"background: #0C1326; color: #fff; transform: scale(.95); box-shadow: 0 0 0 4px rgba(22,32,60,.15);"}[kind]
        return (f'<button aria-label="{label} {n}" style="flex: none; height: 44px; padding: 0 14px; border: none; border-radius: 999px; {st} font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; white-space: nowrap">'
                f'{dot_ or ""}{label} <b style="{MONO}; font-weight: 600; opacity: .75">{n}</b></button>')
    head = (f'<div style="background: {NAVY}; color: #fff; border-radius: 16px; padding: 10px 14px; display: flex; align-items: baseline; gap: 8px">'
            f'<span style="font-size: 20px; font-weight: 800">Orders</span>{M("10", 14, 600, ONNAVY)}</div>')
    redot = f'<i style="width: 8px; height: 8px; border-radius: 999px; background: {BAD}"></i>'
    row = (f'<div style="overflow: hidden; margin: 0 -12px; padding: 4px 12px"><div style="display: flex; gap: 6px; margin-left: -84px">'
           f'{fc("All", "10", "on")}{fc("Stuck", "1", dot_=redot)}{fc("Ruth decides", "5")}{fc("Denis\'s list", "3", "press", dot("DO"))}</div></div>')
    nxt = (f'<div style="display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 10px 12px">'
           f'{av("DO", 32)}<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Denis\'s restock list</span>'
           f'{M("this trip · 3 lines · 4,450,000", 11, 600, FAINT)}</span><span style="color: {SOFT}">{ic(P["chev"], 18)}</span></div>')
    return head + row + nxt


# ===================================================================== states
def frag(d):
    return f'<div style="border-radius: 20px; overflow: hidden">{d.replace("border-radius: 24px 24px 0 0", "border-radius: 20px")}</div>'


def states1():
    st = []
    st.append(state("LOADING · THE FIRST LOAD", first_load(), "navy head at once · Getting the shop · never a blank page"))
    st.append(state("SENDING · SIGNING IN", sign_form("sending"), "the button waits · nothing else to tap"))
    st.append(state("ERROR · WRONG EMAIL OR PASSWORD", sign_form("wrong"), "the password ring goes red · type it again"))
    st.append(state("OFFLINE · DISABLED · NO SIGNAL", sign_form("off"), "the button greys and waits for signal"))
    st.append(state("THE WAY IN · ORDERS → DENIS'S LIST", way_in(),
                    "Orders p1's chip row, swiped · 1 tap on Denis's list 3 opens orders/stock"))
    succ = (card(rs_row("cement", "done", True), pad="0 12px", gap=0)
            + SH.s_toast("Not yet · Cement 50 kg", "Denis sees it", 10))
    st.append(state("SUCCESS · UNDO 10 S", succ, "the row moves to Not yet · Undo 10 s · Denis gets the push"))
    off = (f'<div style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; background: {WARNBG}; color: {WARNINK}; font-size: 13px; font-weight: 700">{ic(P["wifioff"], 16)}No signal · it sends when back</div>'
           + card(rs_row("cement", "waits", True), pad="0 12px", gap=0))
    st.append(state("OFFLINE · WAITS", off, "the tap queues · Denis is told when it sends"))
    emp = (f'{sec("Planned", "0", dotc=DASH)}'
           f'<div style="height: 64px; border-radius: 16px; border: 1.5px dashed {DASH}; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 600; color: {SOFT}"><span style="color: {GOOD}">{ic(P["check"], 18, 2.4)}</span>Nothing planned</div>')
    st.append(state("EMPTY · NOTHING PLANNED", emp, "Denis has planned nothing · the hero shows 0"))
    return st


def states2():
    st = []
    st.append(state("PRESSED · 3M", chip_row(["1.5M", "2M", "3M", "5M", "Cash only"], "3M", pressed="3M", now="2M") + owe_vs_limit(3),
                    "chip darkens · scales 95% · the bar redraws to 3M"))
    st.append(state("DISABLED · NOTHING TO SAVE", chip_row(["1.5M", "2M", "3M", "5M", "Cash only"], "2M", now="2M") + frag(limit_dock("disabled")),
                    "the picks match now · Save greys"))
    st.append(state("SENDING", frag(limit_dock("sending")), "spinner on Save · nothing else moves"))
    st.append(state("SUCCESS · UNDO 10 S", SH.s_toast("Limit set · 3,000,000", "Grace sees it", 10)
                    + card(f'<div style="display: flex; align-items: center; gap: 10px"><span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; font-weight: 600; color: {SOFT}">Limit now</span>{M("3,000,000 · 14 days", 14, 600, INK)}</span>{pill("Change", "line", 44)}</div>', pad="8px 14px", gap=0),
                    "Money p4 shows the new limit · Grace gets the push"))
    err = (f'<div style="display: flex; align-items: center; gap: 10px; background: #fff; border: 1.5px solid {BAD}; border-radius: 16px; padding: 10px 12px">'
           f'<span style="width: 36px; height: 36px; border-radius: 12px; background: {BADBG}; color: {BAD}; display: flex; align-items: center; justify-content: center">{ic(P["alert"], 18)}</span>'
           f'<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Limit 3,000,000</span>{M("Not saved · no signal", 11, 600, BAD)}</span>'
           f'{pill("Try again", "navy", 44, "retry")}</div>')
    st.append(state("ERROR", err, "the picks stay · Try again"))
    off = (f'<div style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; background: {WARNBG}; color: {WARNINK}; font-size: 13px; font-weight: 700">{ic(P["wifioff"], 16)}No signal · it sends when back</div>'
           f'<div style="display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 8px 12px">{cust("GS", 32)}<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Limit 3,000,000</span>{M("14 days", 11, 600, FAINT)}</span>'
           f'<span style="display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 12px; border-radius: 999px; background: {TILE}; color: {SOFT}; font-size: 13px; font-weight: 700">{ic(P["clock"], 14)}Waits</span></div>'
           f'<span style="padding: 0 4px; font-size: 12px; font-weight: 600; color: {SOFT}">A slide (merge, opening balance) waits for signal</span>')
    st.append(state("OFFLINE", off, "a Save queues · a slide never does"))
    merging = (f'<div style="border-radius: 20px; background: {NAVY}; padding: 12px; display: flex; flex-direction: column; gap: 8px">{SH.s_slide("Merging", state="sending")}'
               f'<span style="font-size: 12px; font-weight: 600; color: {ONNAVY}; text-align: center">{M("7", 12, 600, "#FFFFFF")} orders · {M("1,615,000", 12, 600, "#FFFFFF")} into one</span></div>'
               f'<div style="display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 10px 12px">'
               f'<span style="width: 36px; height: 36px; border-radius: 12px; background: {GOODBG}; color: {GOOD}; display: flex; align-items: center; justify-content: center">{ic(P["check"], 18, 2.4)}</span>'
               f'<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Merged · Ggaba Stores</span>{M("7 orders · 1,615,000", 11, 600, FAINT)}</span>'
               f'{pill("Undo " + M("10", 13), "line", 44)}</div>')
    st.append(state("LOOK ALIKE · MERGING → MERGED", merging, "the same dock as Money's states · knob at the end, then Undo 10 s"))
    done = (f'<div style="display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 10px 12px">'
            f'<span style="width: 36px; height: 36px; border-radius: 12px; background: {GOODBG}; color: {GOOD}; display: flex; align-items: center; justify-content: center">{ic(P["check"], 18, 2.4)}</span>'
            f'<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Opening balance · 290,000</span>{M("Ggaba Stores owes 1,905,000", 11, 600, FAINT)}</span></div>'
            f'<div style="display: flex; align-items: center; gap: 10px; background: #fff; border: 1px dashed {DASH}; border-radius: 16px; padding: 10px 12px; color: {SOFT}">'
            f'<span style="width: 36px; height: 36px; border-radius: 12px; background: {TILE}; display: flex; align-items: center; justify-content: center">{ic(P["book"], 18)}</span>'
            f'<span style="flex: 1; font-size: 14px; font-weight: 700">Old books</span>{M("0 left", 13, 600, GOOD)}</div>')
    st.append(state("OLD BOOKS · DONE", done, "the Old books card empties · the owner's log gets one line"))
    return st


# ===================================================================== boards
def added1():
    strip = top_strip("Added while building · 1", "manager.html · AD01 · AD02 · AD05 · Sat 17 Oct · 09:40",
                      [("23", "Denis's restock list")], [("23", "Not yet"), ("23", "Go ahead")])
    phones = [
        phone("1 · AD01 SIGN IN", p_signin(), "Sign in: 2 fields · 1 tap · then Today · the phone keeps Ruth in"),
        phone("2 · AD01 COULD NOT REACH THE SHOP", p_noreach(), "Try again: 1 tap · the saved copy: 1 tap · Sign out stays reachable"),
        phone("3 · AD02 YOU · FROM THE RN DISC", p_you(), "Sign out: — → 2 taps (RN, Sign out) · pushes off: 2 taps"),
        phone("4 · AD05 ORDERS · STOCK · " + mlabel("09:40"), p_restock(), "Not yet (D-23): 4 → 3 taps (app, Orders · Stock, Not yet) · Denis sees Not yet"),
    ]
    AT = (9, 9, 8, 9, 8); AC = (9, 8, 8, 8, 8); AS = (9, 9, 8, 8, 8)
    panel = score_panel("Scores · added · 1", "Manager today", [
        ("1 · Sign in", (6, 7, 6, 5, 5), AT, (9, 9, 9, 9, 9)),
        ("2 · Could not reach", (2, 3, 3, 3, 3), AT, (9, 9, 8, 9, 9)),
        ("3 · You", (0, 0, 0, 0, 0), AS, (9, 9, 9, 9, 8)),
        ("4 · Restock list", (4, 4, 3, 4, 4), AC, (9, 9, 9, 8, 9)),
    ], "Agent Today · You sheet · Clients",
        "Sign in = the Buyer's Gate re-cast · You = the Buyer's You sheet · restock rows = Clients rows with the answer on the row")
    return board("Manager Added 1", strip, phones, panel, states1())


def added2():
    strip = top_strip("Added while building · 2", "manager.html · AD03 · AD04 · Money p4 · Ggaba Stores · 11:40",
                      [("25", "Limit now"), ("26", "Look alike"), ("27", "Old books")],
                      [("25", "Limit 3,000,000 · 14 days"), ("26", "Merge into Ggaba Stores"), ("27", "Opening balance · 290,000")])
    phones = [
        phone("1 · AD03 CHANGE THE LIMIT · D-25 · " + mlabel("11:40"), p_limit(), "Change the limit (D-25): 8 → 4 taps (Money, Ggaba, Change, 3M, Save → 5) · Grace sees it"),
        phone("2 · AD04 LOOK ALIKE · D-26", p_look(), "Merge (D-26): 6 → 4 (Money, Ggaba, Open, slide) · ticked one is kept"),
        phone("3 · AD04 OLD BOOKS · D-27", p_books(), "Opening balance (D-27): 6 → 4 (Money, Ggaba, Open, slide)"),
    ]
    AS = (9, 9, 8, 8, 8)
    panel = score_panel("Scores · added · 2", "Manager today", [
        ("1 · Change the limit", (4, 3, 4, 4, 4), AS, (9, 9, 9, 9, 9)),
        ("2 · Look alike", (3, 3, 3, 4, 3), AS, (9, 9, 9, 8, 8)),
        ("3 · Old books", (3, 3, 3, 3, 3), AS, (9, 9, 9, 8, 8)),
    ], "Decision sheet + basket dock",
        "Sheets rise over Money p4 · white evidence cards, one bar each · navy dock: who sees it, one white Save or one red-knob slide")
    return board("Manager Added 2", strip, phones, panel, states2())


OUTD = os.path.join(HERE, "..")
with open(os.path.join(OUTD, "Added.dc.html"), "w") as f:
    f.write(added1())
with open(os.path.join(OUTD, "Added2.dc.html"), "w") as f:
    f.write(added2())
print("ok")
