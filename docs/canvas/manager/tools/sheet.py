# The ONE decision sheet (what the red + opens). Every Decide board, Today p2/p3 and
# MoneyCredit draw it through this module, so the markup is identical everywhere.
# Revision 1 (mgr-rev1-spec §1): navy head band (× · "n of N" + strip · next ›), asker row,
# §3 ask word as the title, white evidence cards on paper, navy dock (sees line, white
# answer pill h56 + outline second answer, or the red-knob slide + outline "Kept …").

S_MONO = "font-family: 'IBM Plex Mono', monospace"
S_NAVY = "#16203C"
S_ON = "#B3BCD2"
S_MINT = "#6FDCB0"
S_RED = "#C93A30"   # the one move only: the slide knob
S_AMBER = "#F5B26B"

S_TINT = {
    "RN": ("#16203C", "#FFFFFF"), "GA": ("#DCEAF8", "#1A5A8A"), "BO": ("#DDF1EE", "#0E5E57"),
    "FN": ("#F6E4F1", "#7A3268"), "DO": ("#E4E6FA", "#3A3F9B"), "MK": ("#E4F4EA", "#0F6B43"),
    "EA": ("#E8EBF0", "#3D4A5C"), "PS": ("#F1EEE8", "#1C2233"), "ML": ("#F1EEE8", "#1C2233"),
}

_P = {
    "x": '<path d="M6 6l12 12M18 6L6 18"/>',
    "chev": '<path d="M9 6l6 6-6 6"/>',
    "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    "check": '<path d="M5 12l5 5 9-10"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "spin": '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>',
    "dbl": '<path d="M6 6l6 6-6 6"/><path d="M13 6l6 6-6 6"/>',
    "retry": '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
}


def s_ic(name, size=16, sw=2):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{sw}" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{_P[name]}</svg>')


def s_av(ini, size=40):
    bg, fg = S_TINT[ini]
    fs = max(11, size // 3)
    return (f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex: none; border-radius: 999px; background: {bg}; color: {fg}; '
            f'font-size: {fs}px; font-weight: 700; display: flex; align-items: center; justify-content: center">{ini}</span>')


def s_strip(pos, total):
    segs = ""
    for i in range(1, total + 1):
        c = "#FFFFFF" if i < pos else (S_MINT if i == pos else "rgba(255,255,255,.18)")
        segs += f'<i style="flex: 1; height: 4px; border-radius: 9px; background: {c}"></i>'
    return f'<span aria-hidden="true" style="display: flex; gap: 3px; width: 100%">{segs}</span>'


def s_age_warn(age):
    # amber over 1 h: "1 h 05", "2 h 10", "3 h"; not "0 h 15", "25 m"
    a = age.replace(" ", "")
    if "h" not in a:
        return False
    try:
        return int(a.split("h")[0]) >= 1
    except ValueError:
        return False


def s_age_chip(age, warn=None):
    if warn is None:
        warn = s_age_warn(age)
    bg, fg = ("rgba(245,178,107,.18)", S_AMBER) if warn else ("rgba(255,255,255,.10)", "#FFFFFF")
    return (f'<span aria-label="waiting {age}" style="flex: none; display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px; border-radius: 999px; '
            f'background: {bg}; color: {fg}; {S_MONO}; font-size: 12px; font-weight: 600; white-space: nowrap">{s_ic("clock", 13, 2.2)}{age}</span>')


def sheet_head(pos, total, ini, who, role, asked, ref, age, title, tags=None, age_warn=None, offline=False):
    nxt = ("next" if pos < total else "")
    nxt_btn = (f'<button aria-label="Next decision" style="flex: none; height: 44px; padding: 0 4px 0 10px; border: none; background: none; color: {S_ON}; '
               f'font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 2px">{nxt}{s_ic("chev", 16, 2.4)}</button>' if nxt
               else '<span style="width: 44px; flex: none"></span>')
    off = ""
    if offline:
        off = (f'<div style="display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px; border-radius: 10px; background: rgba(245,178,107,.16); '
               f'color: {S_AMBER}; font-size: 12px; font-weight: 700">No signal · it sends when back</div>')
    tg = ""
    if tags:
        tg = f'<div style="display: flex; gap: 6px; flex-wrap: wrap">{"".join(tags)}</div>'
    return f'''<div style="flex: none; background: {S_NAVY}; color: #fff; border-radius: 0 0 24px 24px; padding: 8px 16px 16px; display: flex; flex-direction: column; gap: 10px">
      <div style="display: flex; align-items: center; gap: 10px">
        <button aria-label="Close" style="flex: none; width: 44px; height: 44px; border-radius: 999px; border: none; background: rgba(255,255,255,.10); color: #fff; display: flex; align-items: center; justify-content: center; padding: 0">{s_ic("x", 18, 2.2)}</button>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px" aria-label="{pos} of {total} waiting, standing first then oldest">
          <span style="{S_MONO}; font-size: 13px; font-weight: 600; color: #fff">{pos} of {total}</span>{s_strip(pos, total)}
        </div>{nxt_btn}
      </div>{off}
      <div style="display: flex; align-items: center; gap: 10px">{s_av(ini, 40)}
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px">
          <span style="display: flex; align-items: center; justify-content: space-between; gap: 8px"><span style="font-size: 15px; font-weight: 700; color: #fff; white-space: nowrap">From {who} · {role}</span>{s_age_chip(age, age_warn)}</span>
          <span style="{S_MONO}; font-size: 11px; font-weight: 500; color: {S_ON}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Asked {asked} · {ref}</span>
        </div>
      </div>
      <span style="font-size: 22px; font-weight: 700; line-height: 1.15; color: #fff">{title}</span>{tg}
    </div>'''


def s_tag(text, kind="on"):
    m = {"on": ("rgba(255,255,255,.10)", "#FFFFFF"), "amber": ("rgba(245,178,107,.18)", S_AMBER),
         "mint": ("rgba(111,220,176,.16)", S_MINT), "bad": ("rgba(255,170,160,.16)", "#FFB4AB")}[kind]
    return (f'<span style="display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px; border-radius: 999px; background: {m[0]}; '
            f'color: {m[1]}; font-size: 12px; font-weight: 700; white-space: nowrap">{text}</span>')


def s_sees(names, word, plural=None):
    verb = "see" if (plural if plural is not None else "·" in names) else "sees"
    return (f'<div style="display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 12px; font-weight: 600; color: {S_ON}; white-space: nowrap">'
            f'{s_ic("bell", 14)}<span>{names} {verb}</span>'
            f'<span style="display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 999px; background: rgba(111,220,176,.16); color: {S_MINT}; '
            f'font-size: 12px; font-weight: 700; overflow: hidden; text-overflow: ellipsis">{word}</span></div>')


def s_primary(word, fig=None, aria=None, state="default"):
    f = f'<span style="{S_MONO}; font-weight: 600"> · {fig}</span>' if fig else ""
    a = aria or (f"{word} {fig}" if fig else word)
    base = ("width: 100%; height: 56px; border: none; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; "
            "align-items: center; justify-content: center; gap: 8px; white-space: nowrap; padding: 0 14px")
    if state == "sending":
        return f'<button aria-busy="true" aria-label="Sending {a}" style="{base}; background: #fff; color: {S_NAVY}">{s_ic("spin", 18, 2.4)}{word}{f}</button>'
    if state == "pressed":
        return f'<button aria-label="{a}" style="{base}; background: #E1E6F2; color: {S_NAVY}; transform: scale(.97); box-shadow: inset 0 0 0 3px {S_NAVY}, 0 0 0 3px #fff">{s_ic("check", 18, 2.6)}{word}{f}</button>'
    if state == "disabled":
        return f'<button disabled aria-disabled="true" style="{base}; background: rgba(255,255,255,.10); color: {S_ON}">{word}</button>'
    if state == "retry":
        return f'<button aria-label="Try again: {a}" style="{base}; background: #fff; color: {S_NAVY}">{s_ic("retry", 18, 2.4)}Try again</button>'
    return f'<button aria-label="{a}" style="{base}; background: #fff; color: {S_NAVY}">{s_ic("check", 18, 2.6)}{word}{f}</button>'


def s_second(label, aria=None, disabled=False):
    col = S_ON if disabled else "#FFFFFF"
    return (f'<button aria-label="{aria or label}" style="flex: 1; min-width: 0; width: 100%; height: 44px; border: none; border-radius: 999px; background: transparent; '
            f'box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.35); color: {col}; font-size: 14px; font-weight: 700; white-space: nowrap; padding: 0 12px">{label}</button>')


def s_slide(word, fig=None, aria=None, state="ready"):
    f = f'<span style="{S_MONO}; font-weight: 600"> · {fig}</span>' if fig else ""
    knob_bg = S_RED if state in ("ready", "sending") else "#5F6980"
    pos = "right: 4px" if state == "sending" else "left: 4px"
    knob_in = s_ic("spin", 20, 2.4) if state == "sending" else s_ic("dbl", 20, 2.4)
    col = "#FFFFFF" if state != "disabled" else S_ON
    a = aria or f"Slide: {word}" + (f" {fig}" if fig else "")
    return (f'<div role="slider" aria-label="{a}" style="position: relative; width: 100%; height: 56px; box-sizing: border-box; border-radius: 999px; '
            f'background: rgba(255,255,255,.08); display: flex; align-items: center; justify-content: center; padding-left: 44px">'
            f'<span style="position: absolute; {pos}; top: 4px; width: 48px; height: 48px; border-radius: 999px; background: {knob_bg}; color: #fff; '
            f'display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,.25)">{knob_in}</span>'
            f'<span style="font-size: 16px; font-weight: 700; color: {col}; white-space: nowrap">{word}{f}</span></div>')


def s_total(fig, sub=None, sub_col=S_MINT, left=None):
    lf = left or ""
    sb = f'<span style="{S_MONO}; font-size: 12px; font-weight: 600; color: {sub_col}">{sub}</span>' if sub else ""
    return (f'<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 10px">{lf}'
            f'<span style="margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; gap: 2px">'
            f'<span style="{S_MONO}; font-size: 24px; font-weight: 600; letter-spacing: -.03em; line-height: 1; color: #fff">{fig}</span>{sb}</span></div>')


def sheet_dock(sees_html, main_html, second_html="", top_html=""):
    sec = f'<div style="display: flex; gap: 8px">{second_html}</div>' if second_html else ""
    return (f'<div style="flex: none; background: {S_NAVY}; color: #fff; border-radius: 24px 24px 0 0; padding: 14px 16px 16px; '
            f'box-shadow: 0 -8px 24px rgba(22,32,60,.18); display: flex; flex-direction: column; gap: 10px">'
            f'{top_html}{sees_html}{main_html}{sec}</div>')


def s_next(ini, text, age, sub=None):
    if sub:
        # the next decision with its evidence: fills the band above the dock (round 2, fix 7)
        return (f'<div style="flex: none; display: flex; align-items: center; gap: 10px; min-height: 60px; padding: 8px 12px; box-sizing: border-box; border-radius: 12px; border: 1px dashed #C9C4BA; '
                f'color: #5F6980; font-size: 12px; font-weight: 700">{s_av(ini, 32)}'
                f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="display: flex; gap: 6px; white-space: nowrap; overflow: hidden"><span style="letter-spacing: .06em">NEXT</span>'
                f'<span style="color: #1C2233; overflow: hidden; text-overflow: ellipsis">{text}</span></span>'
                f'<span style="{S_MONO}; font-size: 11px; font-weight: 500; color: #6B7480; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{sub}</span></span>'
                f'<span style="{S_MONO}; font-weight: 600">{age}</span></div>')
    return (f'<div style="flex: none; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; border-radius: 12px; border: 1px dashed #C9C4BA; '
            f'color: #5F6980; font-size: 12px; font-weight: 700"><span style="letter-spacing: .06em">NEXT</span>{s_av(ini, 24)}'
            f'<span style="flex: 1; min-width: 0; color: #1C2233; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{text}</span>'
            f'<span style="{S_MONO}; font-weight: 600">{age}</span></div>')


def decision_sheet(*, pos, total, ini, who, role, asked, ref, age, title, body, dock, tags=None,
                   age_warn=None, aria=None, offline=False, next_=None, body_gap=10):
    nx = s_next(*next_) if next_ else ""
    a = aria or f"Decide: {title}, from {who}"
    return (f'<div role="dialog" aria-label="{a}" style="position: absolute; inset: 0; display: flex; flex-direction: column; background: #F7F5F2">'
            + sheet_head(pos, total, ini, who, role, asked, ref, age, title, tags, age_warn, offline)
            + f'<div style="flex: 1; min-height: 0; overflow: hidden; padding: 12px 16px; display: flex; flex-direction: column; gap: {body_gap}px">{body}{nx}</div>'
            + dock + '</div>')


# ---------------------------------------------------------------- shared evidence parts
S_LINE = "#E6E3DD"
S_SOFT = "#5F6980"
S_FAINT = "#6B7480"
S_INK = "#1C2233"
S_GOOD = "#0F6B43"
S_WARN = "#95530C"
S_WARNINK = "#7A4A02"
S_BAD = "#8E2A22"
S_HATCH = "repeating-linear-gradient(135deg, #8D99B5 0 4px, #C9CEDA 4px 8px)"


def s_card(inner, pad="12px 14px", gap=8, extra=""):
    return (f'<div style="background: #fff; border: 1px solid {S_LINE}; border-radius: 16px; padding: {pad}; display: flex; '
            f'flex-direction: column; gap: {gap}px{extra}">{inner}</div>')


def s_m(t, size=13, w=600, col=None):
    c = f"; color: {col}" if col else ""
    return f'<span style="{S_MONO}; font-size: {size}px; font-weight: {w}{c}">{t}</span>'


def s_chip(t, kind="soft"):
    m = {"soft": ("#F1EEE8", S_INK), "good": ("#E4F4EA", S_GOOD), "warn": ("#FDEEE1", S_WARNINK), "bad": ("#FBE5E2", S_BAD)}[kind]
    return (f'<span style="display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 9px; border-radius: 999px; '
            f'background: {m[0]}; color: {m[1]}; font-size: 12px; font-weight: 700; white-space: nowrap">{t}</span>')


def s_quote(text):
    return (f'<div style="display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 8px 12px; box-sizing: border-box; border-radius: 12px; '
            f'background: #fff; border: 1px solid {S_LINE}; font-size: 14px; font-weight: 600; color: {S_INK}">'
            f'<span style="color: {S_SOFT}; font-size: 18px; font-weight: 800; line-height: 1">“</span>{text}</div>')


def s_kv_head(label, fig, fig_col=None, size=18):
    return (f'<div style="display: flex; align-items: baseline; justify-content: space-between; gap: 8px">'
            f'<span style="font-size: 13px; font-weight: 700; color: {S_SOFT}">{label}</span>{s_m(fig, size, 600, fig_col)}</div>')


def s_seg(opts, on, aria="Pick one"):
    out = ""
    for i, o in enumerate(opts):
        sel = i == on
        st = f"background: #fff; color: {S_NAVY}" if sel else "background: transparent; color: #fff"
        out += (f'<button role="radio" aria-checked="{str(sel).lower()}" style="flex: 1; min-width: 0; height: 44px; border: none; border-radius: 999px; {st}; '
                f'{S_MONO}; font-size: 13px; font-weight: 600; white-space: nowrap; padding: 0 4px">{o}</button>')
    return (f'<div role="radiogroup" aria-label="{aria}" style="display: flex; gap: 2px; padding: 3px; border-radius: 999px; '
            f'background: rgba(255,255,255,.08)">{out}</div>')


def s_owes(label, before, after, pct_after):
    return (f'<div style="display: flex; flex-direction: column; gap: 6px"><div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px">'
            f'<span style="font-size: 13px; font-weight: 700">{label}</span><span style="{S_MONO}; font-size: 13px; font-weight: 600; white-space: nowrap">'
            f'<span style="color: {S_FAINT}; text-decoration: line-through">{before}</span> → {after}</span></div>'
            f'<div style="position: relative; height: 10px; border-radius: 999px; background: repeating-linear-gradient(135deg, #E4F4EA 0 4px, #fff 4px 8px); '
            f'box-shadow: inset 0 0 0 1px #E4F4EA; overflow: hidden"><i style="position: absolute; left: 0; top: 0; bottom: 0; width: {pct_after}%; '
            f'border-radius: 999px; background: {S_NAVY}"></i></div></div>')


def s_toast(title, sub, secs=10):
    off = 75.4 * (1 - secs / 10)
    return (f'<div role="status" style="flex: none; padding: 8px 8px 8px 12px; border-radius: 16px; background: {S_NAVY}; color: #fff; display: flex; align-items: center; gap: 10px">'
            f'<span style="width: 28px; height: 28px; flex: none; border-radius: 999px; background: rgba(111,220,176,.18); color: {S_MINT}; display: flex; align-items: center; justify-content: center">{s_ic("check", 16, 2.6)}</span>'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px"><span style="font-size: 14px; font-weight: 700; white-space: nowrap">{title}</span>'
            f'<span style="font-size: 12px; font-weight: 600; color: {S_ON}; display: flex; align-items: center; gap: 4px; white-space: nowrap">{s_ic("bell", 12)}{sub}</span></div>'
            f'<button aria-label="Undo, {secs} seconds left" style="flex: none; height: 44px; padding: 0 12px 0 6px; border: none; border-radius: 999px; background: #fff; color: {S_NAVY}; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px">'
            f'<span style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" style="position: absolute; inset: 0; transform: rotate(-90deg)"><circle cx="15" cy="15" r="12" fill="none" stroke="#E6E3DD" stroke-width="3"/><circle cx="15" cy="15" r="12" fill="none" stroke="{S_NAVY}" stroke-width="3" stroke-linecap="round" stroke-dasharray="75.4" stroke-dashoffset="{off:.1f}"/></svg><b style="{S_MONO}; font-size: 11px; font-weight: 600">{secs}</b></span>Undo</button></div>')


# ---------------------------------------------------------------- D-7 · the Store's ask (Today p2 = MoneyCredit p3)
def _truck_ring(mins=25, of=60):
    import math
    r = 22; c = 2 * math.pi * r; f = mins / of * c
    return (f'<span style="position: relative; width: 54px; height: 54px; flex: none"><svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">'
            f'<circle cx="27" cy="27" r="{r}" fill="none" stroke="#F3DCC4" stroke-width="5"/>'
            f'<circle cx="27" cy="27" r="{r}" fill="none" stroke="{S_WARN}" stroke-width="5" stroke-linecap="round" stroke-dasharray="{f:.1f} {c:.1f}" transform="rotate(-90 27 27)"/></svg>'
            f'<span style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: {S_WARNINK}">{s_m(str(mins), 15, 700)}<span style="font-size: 11px; font-weight: 700; line-height: 1">min</span></span></span>')


def d7_body():
    wait = s_card(
        f'<div style="display: flex; align-items: center; gap: 12px">{_truck_ring()}'
        f'<span style="flex: 1; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700">Truck waits · Ssali</span>'
        f'<span style="{S_MONO}; font-size: 11px; color: {S_FAINT}">#0551 packed · not paid</span></span></div>', pad="10px 14px")
    owe = s_card(
        s_kv_head("Would owe", "1,240,000")
        + f'<div style="position: relative"><div style="height: 14px; border-radius: 999px; overflow: hidden; background: #ECE8E1"><i style="display: block; width: 62%; height: 100%; background: {S_HATCH}"></i></div>'
          f'<i style="position: absolute; left: 75%; top: -5px; height: 24px; border-left: 2px dashed {S_GOOD}"></i></div>'
        + f'<div style="position: relative; height: 16px"><span style="position: absolute; left: 75%; transform: translateX(-50%); white-space: nowrap; font-size: 11px; font-weight: 700; color: {S_GOOD}">{s_m("1.5M", 11, 700, S_GOOD)} limit</span></div>'
        + f'<div style="display: flex; gap: 6px; flex-wrap: wrap">{s_chip("Owes 0", "good")}{s_chip("1st order on credit")}{s_chip("Cash customer")}</div>')
    return wait + owe


def d7_dock(state="default"):
    on = -1 if state == "disabled" else 0
    top = s_seg(["1.5M · 14 d", "2M · 14 d", "3M · 30 d"], on, "Limit and terms")
    if state == "disabled":
        main = s_primary("Pick a limit to load it", state="disabled")
    else:
        main = s_primary("On credit · load it", "1,240,000", "On credit, load it: 1,240,000 on a 1.5M limit, 14 days. Musa and Grace see it", state=state)
    return sheet_dock(s_sees("Musa · Grace", "On credit · load it"), main,
                      s_second("Cash first · it stays", "Cash first, it stays: Musa keeps the order until it is paid"), top)


def d7_sheet(state="default", pos=1, total=8, next_=None):
    return decision_sheet(pos=pos, total=total, ini="MK", who="Musa", role="Store", asked="09:15", ref="#0551 Nansana Hardware",
                          age="25 m", title="Not paid yet · on credit?", tags=[s_tag("No limit set", "amber")],
                          body=d7_body(), dock=d7_dock(state), next_=next_,
                          aria="Not paid yet, on credit? From Musa, order 0551")


# ---------------------------------------------------------------- D-18 · return (Today p3 = DecideOrders p3)
def _stepper(v):
    b = (lambda d, aria: f'<button aria-label="{aria}" style="width: 44px; height: 44px; border-radius: 999px; border: none; background: #fff; box-shadow: inset 0 0 0 1px {S_LINE}; color: {S_INK}; display: flex; align-items: center; justify-content: center; padding: 0; font-size: 20px; font-weight: 700">{d}</button>')
    return (f'<div style="display: flex; align-items: center; gap: 6px; padding: 3px; border-radius: 999px; background: #F7F5F2">{b("−", "One less")}'
            f'<span style="{S_MONO}; font-size: 20px; font-weight: 600; min-width: 28px; text-align: center">{v}</span>{b("+", "One more")}</div>')


def d18_body(toast=""):
    item = s_card(
        f'<div style="display: flex; align-items: center; justify-content: space-between"><span style="font-size: 15px; font-weight: 700">Timber 2×4</span>{s_m("11,250 a pcs", 12, 600, S_SOFT)}</div>'
        f'<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px">{_stepper(5)}'
        f'<span style="display: flex; flex-direction: column; align-items: flex-end; gap: 1px">{s_m("5 × 11,250", 11, 500, S_FAINT)}{s_m("−56,250", 20, 600, S_GOOD)}</span></div>'
        f'<div style="display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 4px 4px 4px 12px; box-sizing: border-box; border-radius: 12px; background: #F7F5F2">'
        f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; font-size: 13px; font-weight: 700"><span>Back on the shelf</span><span style="color: {S_SOFT}">Off what they owe</span></span>'
        f'<button aria-label="Change: damaged, or cash back" style="flex: none; height: 44px; padding: 0 12px; border: none; border-radius: 999px; background: transparent; color: {S_NAVY}; font-size: 13px; font-weight: 700; text-decoration: underline">Change</button></div>',
        pad="12px", gap=10)
    owes = s_card(s_owes("Lubowa Builders owes", "662,000", "605,750", 91), pad="12px")
    return toast + s_quote("5 too many · they never used them") + item + owes


def d18_dock(state="ready"):
    return sheet_dock(s_sees("Brian · Esther", "Credit note raised"),
                      s_slide("Credit note raised", "56,250", "Slide: Credit note raised, 56,250 off what Lubowa Builders owes. Brian and Esther see it", state),
                      s_second("Kept as sold", "Kept as sold: no credit note. Brian sees it"))


def d18_sheet(pos=2, total=8, toast="", next_=None):
    return decision_sheet(pos=pos, total=total, ini="BO", who="Brian", role="Sales", asked="06:40", ref="#0547 Lubowa Builders",
                          age="3 h", title="Return asked", body=d18_body(toast), dock=d18_dock(), next_=next_,
                          aria="Return asked, from Brian, order 0547")
