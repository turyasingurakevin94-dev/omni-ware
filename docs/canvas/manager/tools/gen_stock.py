#!/usr/bin/env python3
# Generates docs/canvas/manager/DecideStock.dc.html (literal markup).
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'DecideStock.dc.html')
M = "font-family: 'IBM Plex Mono', monospace"
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sheet as SH  # the ONE decision sheet

def svg(paths, size=16, sw=2, extra=''):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"{extra}>{paths}</svg>')

I = {
 'x': '<path d="M18 6L6 18M6 6l12 12"/>',
 'bell': '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
 'eye': '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 'tick': '<path d="M5 12l5 5 9-10"/>',
 'go': '<path d="M6 17l5-5-5-5"/><path d="M13 17l5-5-5-5"/>',
 'shelf': '<path d="M4 3v18M20 3v18M4 9h16M4 15h16"/>',
 'box': '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4"/><path d="M12 11v10"/>',
 'truck': '<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
 'chat': '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
 'bag': '<path d="M7 3h10l2 18H5z"/><path d="M9 8h6"/>',
 'spin': '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>',
 'wifioff': '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.8"/><path d="M19 12.9a10 10 0 0 0-2.3-1.6"/><path d="M12 20h.01"/>',
 'doc': '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h6"/>',
 'undo': '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
 'alert': '<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
 'retry': '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
 'back': '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/>',
 'expand': '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
 'list': '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
 'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 'chev': '<path d="M9 6l6 6-6 6"/>',
 'cam': '<path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/>',
}

PEOPLE = {'RN': ('#16203C', '#FFFFFF'), 'GA': ('#DCEAF8', '#1A5A8A'), 'BO': ('#DDF1EE', '#0E5E57'),
          'DO': ('#E4E6FA', '#3A3F9B'), 'MK': ('#E4F4EA', '#0F6B43'), 'JN': ('#FDEEE1', '#7A4A02'),
          'EA': ('#E8EBF0', '#3D4A5C')}

def av(ini, size=44, fs=14):
    bg, ink = PEOPLE[ini]
    return (f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex: none; border-radius: 999px; background: {bg}; '
            f'color: {ink}; font-size: {fs}px; font-weight: 700; display: flex; align-items: center; justify-content: center">{ini}</span>')

def dot(ini, s=12):
    bg, ink = PEOPLE[ini]
    return f'<i aria-hidden="true" style="width: {s}px; height: {s}px; flex: none; border-radius: 999px; background: {bg}; box-shadow: inset 0 0 0 2px {ink}"></i>'

def mono(t, size=None, w=600, col=None):
    s = f'{M}; font-weight: {w}'
    if size: s += f'; font-size: {size}px'
    if col: s += f'; color: {col}'
    return f'<span style="{s}">{t}</span>'

def chip(t, kind='good', h=22):
    c = {'good': ('#E4F4EA', '#0F6B43'), 'warn': ('#FDEEE1', '#7A4A02'), 'soft': ('#F1EEE8', '#1C2233'),
         'bad': ('#FBE5E2', '#8E2A22'), 'navy': ('rgba(255,255,255,.12)', '#FFFFFF')}[kind]
    return (f'<span style="height: {h}px; padding: 0 8px; border-radius: 999px; background: {c[0]}; color: {c[1]}; font-size: 12px; '
            f'font-weight: 700; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; flex: none">{t}</span>')

def label(t):
    return f'<div style="font-size: 11px; font-weight: 700; letter-spacing: .08em; color: #5F6980; white-space: nowrap">{t}</div>'

def note(t):
    return f'<div style="font-family: \'IBM Plex Mono\', monospace; font-size: 12px; color: #5F6980; line-height: 1.45">{t}</div>'

CARD = 'background: #fff; border: 1px solid #E6E3DD; border-radius: 16px'

# ---------- the sheet ----------
def sheet(aria, ini, title, frm, age, pos, ev_pill, strip, body, dock):
    return f'''<div style="position: relative; width: 360px; height: 780px; box-sizing: border-box; border-radius: 32px; border: 1px solid #E6E3DD; overflow: hidden; background: #F7F5F2">
<div style="background: #16203C; color: #fff; border-radius: 0 0 28px 28px; padding: 18px 20px; height: 120px; box-sizing: border-box"><span style="font-size: 24px; font-weight: 700">Good morning, Ruth</span></div>
<div style="position: absolute; inset: 0; background: rgba(12,19,38,.72)"></div>
<div role="dialog" aria-label="{aria}" style="position: absolute; left: 0; right: 0; top: 52px; bottom: 0; background: #F7F5F2; border-radius: 26px 26px 0 0; display: flex; flex-direction: column">
<div style="background: #16203C; color: #fff; border-radius: 26px 26px 22px 22px; padding: 0 18px 16px; display: flex; flex-direction: column; gap: 10px">
<button aria-label="Close" style="display: block; width: 100%; height: 30px; border: none; background: none; position: relative; padding: 0"><i style="position: absolute; left: 50%; top: 10px; width: 40px; height: 5px; margin-left: -20px; border-radius: 999px; background: rgba(255,255,255,.25)"></i></button>
<div style="display: flex; align-items: center; gap: 12px">{av(ini)}
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 17px; font-weight: 700; white-space: nowrap">{title}</span><span style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #B3BCD2; white-space: nowrap">{frm}</span></div>
<span style="display: flex; flex-direction: column; align-items: flex-end; gap: 3px"><span style="{M}; font-size: 13px; font-weight: 600; color: #fff; white-space: nowrap">{age}</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2; white-space: nowrap">{pos}</span></span></div>
{ev_pill}
{strip}
</div>
<div style="flex: 1; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; overflow: hidden">{body}</div>
{dock}
</div></div>'''

def ev_pill(icon, t, kind='navy'):
    bg, col = {'navy': ('rgba(255,255,255,.1)', '#fff'), 'warn': ('#FDEEE1', '#7A4A02'), 'loss': ('#FBE5E2', '#8E2A22')}[kind]
    return (f'<div style="display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px; border-radius: 999px; background: {bg}; '
            f'color: {col}; font-size: 13px; font-weight: 700; align-self: flex-start; white-space: nowrap">{svg(I[icon], 16)}{t}</div>')

def strip(name, sub, fig, figsub):
    return f'''<div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,.08)">
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700; white-space: nowrap">{name}</span><span style="font-size: 12px; font-weight: 600; color: #B3BCD2; white-space: nowrap">{sub}</span></div>
<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px"><span style="{M}; font-size: 16px; font-weight: 600; color: #fff">{fig}</span><span style="{M}; font-size: 11px; color: #B3BCD2; white-space: nowrap">{figsub}</span></div></div>'''

def sees(ini, who, chips):
    return (f'<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #B3BCD2; white-space: nowrap">'
            f'{svg(I["eye"], 14)}{dot(ini)}{who} sees{chips}<span style="color: #B3BCD2; display: flex" aria-label="a push goes">{svg(I["bell"], 14)}</span></div>')

def total(fig, sub, col='#6FDCB0'):
    return (f'<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 1px"><span style="{M}; font-size: 22px; font-weight: 600; color: #fff">{fig}</span>'
            f'<span style="{M}; font-size: 12px; font-weight: 600; color: {col}; white-space: nowrap">{sub}</span></div>')

def dock(top, main):
    return (f'<div style="background: #16203C; color: #fff; border-radius: 26px 26px 0 0; padding: 14px 16px 16px; box-shadow: 0 -8px 24px rgba(22,32,60,.18); '
            f'display: flex; flex-direction: column; gap: 12px"><div style="display: flex; align-items: center; justify-content: space-between; gap: 8px">{top}</div>{main}</div>')

def white_btn(t, aria, icon='tick'):
    return (f'<button aria-label="{aria}" style="width: 100%; height: 56px; border: none; border-radius: 999px; background: #fff; color: #16203C; font-size: 16px; '
            f'font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px">{svg(I[icon], 20, 2.4)}{t}</button>')

def ghost_btn(t, aria, icon=None, h=44):
    ic = svg(I[icon], 16) if icon else ''
    return (f'<button aria-label="{aria}" style="flex: none; height: {h}px; padding: 0 14px; border: none; border-radius: 999px; background: transparent; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.35); '
            f'color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; white-space: nowrap">{ic}{t}</button>')

def slide(t, aria, state='ready'):
    if state == 'ready':
        fill = '<i style="position: absolute; left: 5px; top: 5px; bottom: 5px; width: 50px; border-radius: 999px; background: rgba(255,255,255,.10)"></i>'
        knob = f'<button aria-label="{aria}" style="position: relative; z-index: 1; width: 50px; height: 50px; border-radius: 999px; background: #C93A30; border: none; color: #fff; display: flex; align-items: center; justify-content: center; padding: 0">{svg(I["go"], 22, 2.4)}</button>'
        lab = f'<span style="position: absolute; left: 0; right: 0; text-align: center; font-size: 16px; font-weight: 700; color: #fff; padding: 0 60px; white-space: nowrap">{t}</span>'
        bg = 'rgba(255,255,255,.08)'
    elif state == 'off':
        fill = ''
        knob = f'<button disabled aria-disabled="true" aria-label="{aria}" style="position: relative; z-index: 1; width: 50px; height: 50px; border-radius: 999px; background: #59627A; border: none; color: #B3BCD2; display: flex; align-items: center; justify-content: center; padding: 0; cursor: default">{svg(I["go"], 22, 2.4)}</button>'
        lab = f'<span style="position: absolute; left: 0; right: 0; text-align: center; font-size: 15px; font-weight: 600; color: #B3BCD2; padding: 0 56px 0 60px; white-space: nowrap">{t}</span>'
        bg = 'rgba(255,255,255,.05); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08)'
    else:  # busy
        fill = '<i style="position: absolute; left: 5px; right: 5px; top: 5px; bottom: 5px; border-radius: 999px; background: rgba(255,255,255,.10)"></i>'
        knob = f'<span style="flex: 1"></span><button disabled aria-busy="true" aria-label="{aria}" style="position: relative; z-index: 1; width: 50px; height: 50px; border-radius: 999px; background: #C93A30; border: none; color: #fff; display: flex; align-items: center; justify-content: center; padding: 0; cursor: default">{svg(I["spin"], 22, 2.4)}</button>'
        lab = f'<span style="position: absolute; left: 0; right: 0; text-align: center; font-size: 16px; font-weight: 700; color: #fff; padding: 0 60px; white-space: nowrap">{t}</span>'
        bg = 'rgba(255,255,255,.08)'
    return f'<div style="position: relative; height: 60px; box-sizing: border-box; border-radius: 999px; background: {bg}; display: flex; align-items: center; padding: 5px">{fill}{lab}{knob}</div>'

def switch(on, aria):
    tr = '#0F6B43' if on else '#C9C4BA'
    kx = 'right: 3px' if on else 'left: 3px'
    return (f'<button role="switch" aria-checked="{"true" if on else "false"}" aria-label="{aria}" style="flex: none; width: 52px; height: 44px; border: none; background: none; padding: 0; position: relative">'
            f'<i style="position: absolute; left: 4px; right: 4px; top: 9px; height: 26px; border-radius: 999px; background: {tr}"></i>'
            f'<i style="position: absolute; {kx.replace("3px", "7px")}; top: 12px; width: 20px; height: 20px; border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2)"></i></button>')

def outcome(title, l1, l2, icon, tone):
    bg, col = {'good': ('#E4F4EA', '#0F6B43'), 'soft': ('#F1EEE8', '#1C2233'), 'warn': ('#FDEEE1', '#7A4A02')}[tone]
    return f'''<div style="border-radius: 14px; background: #fff; box-shadow: inset 0 0 0 1px #E6E3DD; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px">
<span style="display: flex; align-items: center; gap: 6px"><span style="width: 26px; height: 26px; border-radius: 8px; background: {bg}; color: {col}; display: flex; align-items: center; justify-content: center; flex: none">{svg(I[icon], 15)}</span><span style="font-size: 13px; font-weight: 700; white-space: nowrap">{title}</span></span>
<span style="{M}; font-size: 13px; font-weight: 600">{l1}</span><span style="font-size: 11px; font-weight: 600; color: #5F6980; white-space: nowrap">{l2}</span></div>'''

def queue_dots(n, cur):
    out = ''.join(f'<i style="width: 14px; height: 4px; border-radius: 9px; background: {"#fff" if i == cur else "rgba(255,255,255,.22)"}"></i>' for i in range(1, n + 1))
    return out

# ======================= PHONE 1 · D-16 write off =======================
cells = ''.join(f'<i style="height: 10px; border-radius: 3px; background: {"#16203C" if i < 23 else "#FBE5E2"};{" box-shadow: inset 0 0 0 1.5px #8E2A22" if i >= 23 else ""}"></i>' for i in range(26))
p1_body = f'''<div style="{CARD}; padding: 12px; display: flex; gap: 12px">
<button aria-label="Open Musa's photo of the 3 broken bags" style="position: relative; width: 132px; height: 150px; flex: none; border: none; border-radius: 12px; padding: 0; overflow: hidden; background: linear-gradient(160deg, #D8D0C2 0%, #B9AF9E 100%)">
<span style="position: absolute; left: 18px; top: 34px; width: 62px; height: 78px; border-radius: 8px 8px 6px 6px; background: #EFE9DE; transform: rotate(-8deg); box-shadow: 0 2px 4px rgba(0,0,0,.15)"></span>
<span style="position: absolute; left: 58px; top: 46px; width: 58px; height: 72px; border-radius: 8px 8px 6px 6px; background: #E6DFD2; transform: rotate(10deg); box-shadow: 0 2px 4px rgba(0,0,0,.15)"></span>
<svg width="132" height="150" viewBox="0 0 132 150" aria-hidden="true" style="position: absolute; left: 0; top: 0"><path d="M30 60l12 10-6 12 14 8" fill="none" stroke="#8A7F6C" stroke-width="2" stroke-linecap="round"/><path d="M78 70l10 8-8 10 10 10" fill="none" stroke="#8A7F6C" stroke-width="2" stroke-linecap="round"/><ellipse cx="66" cy="130" rx="44" ry="7" fill="#A89C88"/></svg>
<span style="position: absolute; left: 6px; bottom: 6px; height: 22px; padding: 0 7px; border-radius: 999px; background: rgba(22,32,60,.78); color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 4px">{svg(I["cam"], 12)}<span style="{M}">08:09</span></span>
<span style="position: absolute; right: 6px; top: 6px; width: 26px; height: 26px; border-radius: 999px; background: rgba(22,32,60,.78); color: #fff; display: flex; align-items: center; justify-content: center">{svg(I["expand"], 13)}</span>
</button>
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px">
<span style="font-size: 11px; font-weight: 700; color: #5F6980">On the shelf</span>
<span style="display: flex; align-items: baseline; gap: 6px">{mono("26", 18)}<span style="color: #5F6980">→</span>{mono("23", 18)}<span style="font-size: 11px; font-weight: 600; color: #5F6980">bags</span></span>
<div role="img" aria-label="26 bags on the shelf, 3 come off" style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 3px">{cells}</div>
<span style="display: flex; gap: 10px; font-size: 11px; font-weight: 600; color: #5F6980"><span style="display: flex; align-items: center; gap: 4px"><i style="width: 8px; height: 8px; border-radius: 2px; background: #16203C"></i>{mono("23")} stay</span><span style="display: flex; align-items: center; gap: 4px"><i style="width: 8px; height: 8px; border-radius: 2px; background: #FBE5E2; box-shadow: inset 0 0 0 1.5px #8E2A22"></i>{mono("3")} off</span></span>
</div></div>
<div style="display: flex; align-items: center; gap: 10px; min-height: 64px; padding: 6px 4px 6px 10px; box-sizing: border-box; border-radius: 16px; background: #fff; box-shadow: inset 0 0 0 1px #E6E3DD">
<span style="width: 38px; height: 38px; flex: none; border-radius: 12px; background: #F1EEE8; color: #1C2233; display: flex; align-items: center; justify-content: center">{svg(I["bag"], 20)}</span>
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700; white-space: nowrap">Cement 50 kg · {mono("3")}</span><span style="{M}; font-size: 11px; color: #6B7480; white-space: nowrap">Damaged · 3 × 34,000</span></div>
{mono("−102,000", 13, 600, "#1C2233")}
{switch(True, "Write off Cement 50 kg, 3 bags")}
</div>
<div style="display: flex; align-items: center; gap: 6px; padding: 0 4px; font-size: 12px; font-weight: 600; color: #5F6980">{svg(I["doc"], 14)}In the owner's log · at cost</div>'''
P1 = SH.decision_sheet(pos=4, total=8, ini="MK", who="Musa", role="Store", asked="08:10", ref="Cement 50 kg · 3 bags", age="1 h 30",
    title="Damaged · Cement 50 kg", tags=[SH.s_tag(f'Broken in the yard · {mono("3")} bags', "amber")], body=p1_body,
    dock=SH.sheet_dock("", SH.s_slide("Written off", "102,000", "Slide: Written off, 3 bags, 102,000 at cost. Musa sees it"),
                       SH.s_second("Kept on the shelf", "Kept on the shelf: nothing is written off. Musa sees it"),
                       SH.s_total("102,000", "3 bags at cost", "#B3BCD2", left=SH.s_sees("Musa", "Written off"))),
    aria="Damaged, Cement 50 kg, from Musa")

# ======================= PHONE 2 · D-24 carton =======================
ticks = ''.join(f'<i style="flex: 1; height: 10px; border-radius: 2px; background: {"#0F6B43" if i < 14 else "#F1EEE8"}"></i>' for i in range(15))
p2_body = f'''<div style="{CARD}; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: baseline; justify-content: space-between"><span style="font-size: 15px; font-weight: 700">The carton</span><span style="{M}; font-size: 11px; color: #6B7480">200 packs</span></div>
<div role="img" aria-label="1 pack for the order, 199 for the shelf" style="display: flex; height: 16px; border-radius: 999px; overflow: hidden; gap: 2px"><i style="width: 12px; flex: none; background: #16203C"></i><i style="flex: 1; background: #0F6B43"></i></div>
<div style="display: flex; justify-content: space-between"><span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 11px; font-weight: 600; color: #5F6980; display: flex; align-items: center; gap: 4px"><i style="width: 8px; height: 8px; border-radius: 2px; background: #16203C"></i>For the order</span>{mono("1", 15)}</span><span style="display: flex; flex-direction: column; align-items: flex-end; gap: 1px"><span style="font-size: 11px; font-weight: 600; color: #5F6980; display: flex; align-items: center; gap: 4px"><i style="width: 8px; height: 8px; border-radius: 2px; background: #0F6B43"></i>For the shelf</span>{mono("199", 15, 600, "#0F6B43")}</span></div>
<div style="height: 1px; background: #F1EEE8"></div>
<div style="display: flex; align-items: baseline; justify-content: space-between"><span style="font-size: 13px; font-weight: 700">Lasts</span><span style="font-size: 13px; font-weight: 700">~{mono("14")} months of selling</span></div>
<div role="img" aria-label="199 packs last about 14 months, to December 2027" style="display: flex; gap: 3px">{ticks}</div>
<div style="display: flex; justify-content: space-between; {M}; font-size: 11px; color: #6B7480"><span>Oct 2026</span><span>Dec 2027</span></div>
</div>
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
{outcome("Shelf part OK", "199 · 298,500", "carton 300,000 · 1 for the order", "shelf", "good")}
{outcome("Order only", "1 · 1,500", "nothing on the shelf", "box", "soft")}
</div>'''
P2 = SH.decision_sheet(pos=8, total=8, ini="DO", who="Denis", role="Buyer", asked="09:25", ref="Wall plugs · 200 packs", age="15 m",
    title="A carton for the shelf?", tags=[SH.s_tag(f'{mono("1")} for the order · {mono("199")} for the shelf')], body=p2_body,
    dock=SH.sheet_dock(SH.s_sees("Denis", "Shelf part OK"), SH.s_primary("Shelf part OK", "298,500", "Shelf part OK: Denis buys the carton, 199 for the shelf, 298,500. Denis sees it"),
                       SH.s_second("Order only · 1,500", "Order only: Denis buys 1 pack. Denis sees it")),
    aria="A carton for the shelf, from Denis")

# ======================= PHONE 3 · D-13 check-in (+D-14 note) =======================
def tline(name, sup, d, m, diff=None):
    hl = 'background: #FDEEE1; margin: 0 -8px; padding: 7px 8px; border-radius: 12px;' if diff else 'padding: 1px 0;'
    wm = f'{m / d * 100:.1f}%'
    right = mono(diff, 12, 600, '#95530C') if diff else f'<span style="color: #0F6B43; display: flex">{svg(I["tick"], 15, 2.4)}</span>'
    return f'''<div style="display: flex; flex-direction: column; gap: 5px; {hl}">
<span style="display: flex; align-items: baseline; justify-content: space-between; gap: 8px"><span style="font-size: 13px; font-weight: 700; white-space: nowrap">{name}</span><span style="display: flex; align-items: center; gap: 8px">{mono(f"{d} · {m}", 12)}{right}</span></span>
<span style="display: flex; flex-direction: column; gap: 3px"><i style="display: block; height: 6px; border-radius: 9px; background: #16203C; width: 100%"></i><i style="display: block; height: 6px; border-radius: 9px; background: {"#95530C" if diff else "#0F6B43"}; width: {wm}"></i></span>
{f'<span style="{M}; font-size: 11px; color: #7A4A02">{sup}</span>' if diff else ''}</div>'''
p3_body = f'''<div style="{CARD}; padding: 12px 14px; display: flex; flex-direction: column; gap: 9px">
<div style="display: flex; align-items: center; justify-content: space-between"><span style="font-size: 15px; font-weight: 700">Line by line</span><span style="display: flex; gap: 10px; font-size: 11px; font-weight: 600; color: #5F6980"><span style="display: flex; align-items: center; gap: 4px"><i style="width: 10px; height: 4px; border-radius: 9px; background: #16203C"></i>Denis</span><span style="display: flex; align-items: center; gap: 4px"><i style="width: 10px; height: 4px; border-radius: 9px; background: #0F6B43"></i>Musa</span></span></div>
{tline("Cement 50 kg", "Nakawa Cement Depot", 20, 20)}
{tline("PVC pipe 4 in", "Owino Plumbing · 28,000 each", 12, 11, "−1 · −28,000")}
{tline("Iron sheet G28", "Namanve Sheets", 56, 56)}
</div>
<div style="{CARD}; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px">
<span style="display: flex; align-items: center; gap: 8px">{av("DO", 26, 11)}<span style="flex: 1; font-size: 13px; font-weight: 700">Denis's note</span>{mono("10:11", 11, 600, "#6B7480")}</span>
<span style="padding: 8px 10px; border-radius: 12px; background: #F7F5F2; font-size: 13px; font-weight: 600">“12 went on the truck at Owino.”</span>
<span style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: #5F6980">{svg(I["tick"], 13)}Closes with the check-in</span>
</div>'''
P3 = SH.decision_sheet(pos=2, total=2, ini="MK", who="Musa", role="Store", asked="10:10", ref="Denis's trip · Owino", age="6 m",
    title="Musa's check-in differs", tags=[SH.s_tag(f'{mono("1")} of {mono("3")} lines differs', "amber")], body=p3_body,
    dock=SH.sheet_dock(SH.s_sees("Musa · Denis", "Ruth took Musa's check-in"), SH.s_primary("Take the check-in", "−28,000", "Take the check-in: the shelf takes Musa's count, 28,000 at cost. Musa and Denis see it"),
                       SH.s_second("Nudge Denis", "Nudge Denis about the difference")),
    aria="Musa's check-in differs, Denis's trip")

# ======================= PHONE 4 · D-15 not on the list =======================
c4 = ''.join(f'<i style="height: 18px; box-sizing: border-box; border-radius: 3px; {"background: #16203C" if i < 20 else "background: #FDEEE1; border: 1.5px dashed #95530C"}"></i>' for i in range(22))
p4_body = f'''<div style="{CARD}; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; align-items: baseline; justify-content: space-between"><span style="font-size: 15px; font-weight: 700">On the truck</span><span style="{M}; font-size: 11px; color: #6B7480">Cement 50 kg · bags</span></div>
<div role="img" aria-label="20 bags on the list, 22 on the truck: 2 extra" style="display: grid; grid-template-columns: repeat(11, 1fr); gap: 3px">{c4}</div>
<div style="display: flex; justify-content: space-between"><span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 11px; font-weight: 600; color: #5F6980; display: flex; align-items: center; gap: 4px"><i style="width: 8px; height: 8px; border-radius: 2px; background: #16203C"></i>On the list</span>{mono("20", 15)}</span><span style="display: flex; flex-direction: column; align-items: flex-end; gap: 1px"><span style="font-size: 11px; font-weight: 600; color: #7A4A02; display: flex; align-items: center; gap: 4px"><i style="width: 8px; height: 8px; box-sizing: border-box; border-radius: 2px; border: 1.5px dashed #95530C"></i>Not on the list</span>{mono("+2", 15, 600, "#95530C")}</span></div>
<div style="height: 1px; background: #F1EEE8"></div>
<div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #5F6980"><span style="width: 26px; height: 26px; border-radius: 8px; background: #F1EEE8; color: #1C2233; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex: none">NC</span>Nakawa Cement Depot · {mono("34,000", 12, 600, "#1C2233")} a bag</div>
</div>
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
{outcome("Keep it", "+2 · 68,000", "on the shelf, at cost", "shelf", "good")}
{outcome("It goes back", "2 · back", "to Nakawa, next trip", "back", "soft")}
</div>'''
P4 = SH.decision_sheet(pos=1, total=1, ini="MK", who="Musa", role="Store", asked="10:17", ref="Denis's trip · Nakawa", age="3 m",
    title="Not on the list · keep it?", tags=[SH.s_tag(f'{mono("2")} bags more than the list', "amber")], body=p4_body,
    dock=SH.sheet_dock(SH.s_sees("Musa", "Keep it"), SH.s_primary("Keep it", "68,000", "Keep it: 2 bags go on the shelf, 68,000 at cost. Musa sees it"),
                       SH.s_second("It goes back", "It goes back: the 2 bags go back to Nakawa. Musa sees it")),
    aria="Not on the list, keep it? From Musa")

def phone_col(lab, ph, taps):
    frame = f'<div style="position: relative; width: 360px; height: 780px; box-sizing: border-box; border-radius: 32px; border: 1px solid #E6E3DD; overflow: hidden; background: #F7F5F2">{ph}</div>'
    return f'<div style="display: flex; flex-direction: column; gap: 8px">{label(lab)}{frame}{note(taps)}</div>'

ROW1 = ''.join([
  phone_col(f'1 · D-16 · DAMAGED · 4 OF 8 · {mono("09:40")}', P1, 'Written off · app 4 → 2 · push 2 → 2 (a slide)<br>Kept on the shelf · app — → 2 · push — → 1'),
  phone_col(f'2 · D-24 · A CARTON FOR THE SHELF · 8 OF 8 · {mono("09:40")}', P2, 'Shelf part OK · app 4 → 2 · push 2 → 1<br>Order only · app 4 → 2'),
  phone_col(f"3 · D-13 + D-14 · CHECK-IN DIFFERS · 2 OF 2 · {mono('10:16')}", P3, "Take the check-in · app 4 → 2 · push 2 → 1<br>with Denis's note 3 → 1 · the note alone 2 → 0"),
  phone_col(f'4 · D-15 · NOT ON THE LIST · 1 OF 1 · {mono("10:20")}', P4, 'Keep it · app — → 2 · push — → 1<br>no screen today · It goes back — → 2'),
])

# ======================= SCORE PANEL =======================
AG = [9, 9, 8, 8, 8]
LABELS = ['Agent consistency', 'Taps per decision', 'Glanceability', 'Polish', 'In step with asker']
PAGES = [('D-16 · Written off', [5, 5, 5, 6, 4], [9, 9, 9, 8, 9]),
         ('D-24 · A carton for the shelf', [5, 6, 5, 6, 5], [9, 9, 9, 9, 9]),
         ('D-13 + D-14 · Check-in differs', [5, 5, 6, 6, 4], [9, 9, 9, 8, 9]),
         ('D-15 · Not on the list', [1, 1, 1, 1, 1], [9, 9, 9, 8, 8])]
avg = lambda xs: f'{sum(xs) / len(xs):.1f}'
GOOD, BAD = '#0F6B43', '#C93A30'
sp = ''
for name, old, nw in PAGES:
    rows = ''
    for i, l in enumerate(LABELS):
        col = GOOD if nw[i] >= AG[i] else BAD
        rows += (f'<div style="display: grid; grid-template-columns: 108px 1fr 78px; align-items: center; gap: 8px; height: 18px">'
                 f'<span style="font-size: 11px; font-weight: 600; color: #5F6980; white-space: nowrap">{l}</span>'
                 f'<span style="display: flex; flex-direction: column; gap: 1px"><i style="display: block; height: 3px; border-radius: 9px; background: #C9C4BA; width: {old[i] * 10}%"></i>'
                 f'<i style="display: block; height: 3px; border-radius: 9px; background: #16203C; width: {AG[i] * 10}%"></i>'
                 f'<i style="display: block; height: 3px; border-radius: 9px; background: {col}; width: {nw[i] * 10}%"></i></span>'
                 f'<span style="{M}; font-size: 11px; font-weight: 600; text-align: right; color: #6B7480">{old[i]} · <b style="color: #16203C">{AG[i]}</b> · <b style="color: {col}">{nw[i]}</b></span></div>')
    sp += (f'<div style="display: flex; flex-direction: column; gap: 4px; padding-bottom: 10px; border-bottom: 1px solid #F1EEE8">'
           f'<div style="display: flex; align-items: baseline; justify-content: space-between"><span style="font-size: 13px; font-weight: 700">{name}</span>'
           f'<span style="{M}; font-size: 11px; color: #6B7480">{avg(old)} · <b style="color: #16203C">{avg(AG)}</b> · <b style="color: {GOOD}">{avg(nw)}</b></span></div>{rows}</div>')
allold = [x for p in PAGES for x in p[1]]; allnew = [x for p in PAGES for x in p[2]]
SCORE = f'''<div style="width: 360px; box-sizing: border-box; margin-top: 23px; background: #fff; border: 1px solid #E6E3DD; border-radius: 16px; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 17px; font-weight: 700">Scores · stock sheets</span>
<span style="display: flex; gap: 10px; font-size: 11px; font-weight: 600; color: #5F6980"><span style="display: flex; align-items: center; gap: 4px"><i style="width: 10px; height: 4px; border-radius: 9px; background: #C9C4BA"></i>Manager today</span><span style="display: flex; align-items: center; gap: 4px"><i style="width: 10px; height: 4px; border-radius: 9px; background: #16203C"></i>Agent app</span><span style="display: flex; align-items: center; gap: 4px"><i style="width: 10px; height: 4px; border-radius: 9px; background: #0F6B43"></i>New</span></span></div>
{sp}
<div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 0"><span style="font-size: 13px; font-weight: 700">Average</span><span style="{M}; font-size: 15px; font-weight: 600; color: #6B7480">{avg(allold)} · <b style="color: #16203C">{avg(AG)}</b> · <b style="color: #0F6B43">{avg(allnew)}</b></span></div>
<div style="padding: 10px 12px; border-radius: 12px; background: #F1EEE8; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 12px; font-weight: 700">Agent match · Needs you + basket dock</span><span style="font-size: 12px; font-weight: 600; color: #5F6980; line-height: 1.35">The one decision sheet · evidence drawn in white cards · navy dock: who sees what, one white answer or the red-knob slide, an outline second</span></div>
</div>'''

# ======================= ROW 2 · STATES =======================
SC = 'width: 360px; box-sizing: border-box; padding: 12px; border-radius: 20px; background: #F7F5F2; border: 1px solid #E6E3DD; display: flex; flex-direction: column; gap: 10px; overflow: hidden'
def state(lab, inner, nt):
    return f'<div style="display: flex; flex-direction: column; gap: 8px">{label(lab)}<div style="{SC}">{inner}</div>{note(nt)}</div>'

NAVYBOX = 'background: #16203C; color: #fff; border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 10px'

# 1 DEFAULT · D-17 count
dots17 = ''.join(f'<i style="height: 14px; border-radius: 4px; background: {"#6FDCB0" if i < 10 else "#F5B26B"}"></i>' for i in range(12))
def cline(n, b, c, v, col):
    return (f'<div style="display: flex; align-items: center; gap: 8px; min-height: 30px"><span style="flex: 1; font-size: 13px; font-weight: 700; white-space: nowrap">{n}</span>'
            f'{mono(f"{b} → {c}", 12, 600, "#5F6980")}<span style="width: 64px; text-align: right">{mono(v, 12, 600, col)}</span></div>')
S1 = state('DEFAULT · D-17 A COUNT TO CHECK · 16:20', f'''<div style="{NAVYBOX}">
<div style="display: flex; align-items: center; gap: 10px">{av("MK", 36, 12)}<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700; white-space: nowrap">A count to check · Aisle B</span><span style="font-size: 12px; font-weight: 600; color: #B3BCD2; white-space: nowrap">From Musa · Asked · {mono("16:20")}</span></div></div>
<div style="display: flex; align-items: center; gap: 10px"><div role="img" aria-label="12 items: 10 agree, 2 differ" style="flex: 1; display: grid; grid-template-columns: repeat(12, 1fr); gap: 3px">{dots17}</div>{mono("−12,000", 15, 600, "#F5B26B")}</div>
</div>
<div style="{CARD}; padding: 4px 12px">{cline("Timber 2×4", 30, 28, "−18,000", "#8E2A22")}<div style="height: 1px; background: #F1EEE8"></div>{cline("Wall plugs", 40, 44, "+6,000", "#0F6B43")}</div>
<div style="background: #16203C; border-radius: 16px; padding: 8px; display: flex; gap: 8px; align-items: center">{ghost_btn("Count it again", "Count it again: Musa counts the 2 items again")}<div style="flex: 1">{slide("Count taken", "Slide to take the count, net −12,000")}</div></div>''',
 'D-17 · app 4 → 2 · push 4 → 2 · push offers only Count it again')

# 2 PRESSED · D-23 restock row
weeks = ''.join(f'<i style="flex: 1; height: 6px; border-radius: 2px; background: {"#0F6B43" if i < 6 else "#E6E3DD"}"></i>' for i in range(8))
S2 = state("PRESSED · D-23 DENIS'S RESTOCK LIST", f'''<div style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px"><span style="font-size: 15px; font-weight: 700">Orders · Stock</span>{mono("Denis's list", 12, 600, "#5F6980")}</div>
<div style="display: flex; align-items: center; gap: 10px; min-height: 84px; padding: 8px 8px 8px 10px; box-sizing: border-box; border-radius: 16px; background: #fff; box-shadow: inset 0 0 0 1px #E6E3DD">
<span style="width: 38px; height: 38px; flex: none; border-radius: 12px; background: #F1EEE8; color: #1C2233; display: flex; align-items: center; justify-content: center">{svg(I["bag"], 20)}</span>
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 14px; font-weight: 700; white-space: nowrap">Cement 50 kg · {mono("40")}</span><span style="{M}; font-size: 11px; color: #6B7480; white-space: nowrap">1,360,000 · 6 weeks left</span><div role="img" aria-label="6 weeks of cement left on the shelf" style="display: flex; gap: 2px; width: 120px">{weeks}</div></div>
<button aria-label="Not yet: hold the Cement restock, Denis is told" style="flex: none; height: 44px; padding: 0 16px; border: none; border-radius: 999px; background: #0C1326; color: #fff; font-size: 13px; font-weight: 700; transform: scale(.95); box-shadow: 0 0 0 4px rgba(22,32,60,.15)">Not yet</button>
</div>
<div style="display: flex; align-items: center; gap: 6px; padding: 0 4px; font-size: 12px; font-weight: 600; color: #5F6980">{svg(I["eye"], 14)}{dot("DO")}Denis sees{chip("Not yet", "warn")}<span>or</span>{chip("Go ahead")}{svg(I["bell"], 14)}</div>''',
 'D-23 · Not yet · app 4 → 3 · no push in (nobody asks) · pill darkens 95%')

def frag(dock_html):
    return f'<div style="border-radius: 16px; overflow: hidden">{dock_html.replace("border-radius: 24px 24px 0 0", "border-radius: 16px")}</div>'

# 3 DISABLED · D-16 switch off
S3 = state('DISABLED · D-16 NOTHING PICKED', f'''<div style="display: flex; align-items: center; gap: 10px; min-height: 64px; padding: 6px 4px 6px 10px; box-sizing: border-box; border-radius: 16px; background: #fff; box-shadow: inset 0 0 0 1px #E6E3DD">
<span style="width: 38px; height: 38px; flex: none; border-radius: 12px; background: #F1EEE8; color: #5F6980; display: flex; align-items: center; justify-content: center">{svg(I["bag"], 20)}</span>
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700; white-space: nowrap; color: #5F6980">Cement 50 kg · {mono("3")}</span><span style="{M}; font-size: 11px; color: #6B7480">Damaged · 3 × 34,000</span></div>
{mono("0", 13, 600, "#5F6980")}{switch(False, "Write off Cement 50 kg, 3 bags")}</div>
{frag(SH.sheet_dock("", SH.s_slide("Pick what to write off", None, "Written off: pick a line first", "disabled"), SH.s_second("Kept on the shelf"), SH.s_total("0", "nothing picked", "#B3BCD2", left=SH.s_sees("Musa", "Written off"))))}''',
 'switch off → knob greys · Kept on the shelf still one tap')

# 4 SENDING · D-16
S4 = state('SENDING · D-16 THE SLIDE WENT', f'''{frag(SH.sheet_dock('', SH.s_slide('Written off', '102,000', 'Sending: Written off, 102,000', 'sending'), '', SH.s_total('102,000', '3 bags at cost', '#B3BCD2', left=SH.s_sees('Musa', 'Written off'))))}
<div style="display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 12px; font-weight: 600; color: #5F6980">{svg(I["shelf"], 14)}Shelf {mono("26 → 23", 12, 600, "#1C2233")} once the books take it</div>''',
 'the knob rests at the end · a slide can\'t go twice')

# 5 SUCCESS · D-13 + D-14
undo_bar = '<i style="display: block; height: 3px; border-radius: 9px; background: rgba(255,255,255,.15); position: relative; overflow: hidden"><i style="position: absolute; left: 0; top: 0; bottom: 0; width: 60%; background: #6FDCB0; border-radius: 9px"></i></i>'
S5 = state('SUCCESS · UNDO 10 S · D-14 CLOSES', f'''<div style="{NAVYBOX}; gap: 8px">
<div style="display: flex; align-items: center; gap: 10px"><span style="width: 36px; height: 36px; flex: none; border-radius: 999px; background: #E4F4EA; color: #0F6B43; display: flex; align-items: center; justify-content: center">{svg(I["tick"], 20, 2.4)}</span>
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">Ruth took Musa's check-in</span><span style="display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #B3BCD2; white-space: nowrap">{dot("MK", 10)}Musa · {dot("DO", 10)}Denis see it {svg(I["bell"], 12)}</span></div>
<button aria-label="Undo, 6 seconds left" style="flex: none; height: 44px; padding: 0 14px; border: none; border-radius: 999px; background: rgba(255,255,255,.1); color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px">{svg(I["undo"], 15)}Undo · {mono("6 s")}</button></div>
{undo_bar}</div>
<div style="display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 12px; font-weight: 600; color: #5F6980">{svg(I["doc"], 14)}Denis's note → the trip's history</div>
<button aria-label="Next: Musa, not on the list" style="display: flex; align-items: center; gap: 10px; min-height: 56px; padding: 6px 12px 6px 8px; border: none; border-radius: 16px; background: #fff; box-shadow: inset 0 0 0 1px #E6E3DD; text-align: left; color: #1C2233">{av("MK", 36, 12)}<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; font-weight: 700; color: #5F6980">THEN · 10:20 · 1 of 1</span><span style="font-size: 14px; font-weight: 700; white-space: nowrap">Not on the list · keep it?</span></span>{svg(I["chev"], 18)}</button>''',
 'Undo 10 s, then the next card slides in by itself')

# 6 ERROR · D-15
S6 = state('ERROR · D-15 KEEP IT', f'''<div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 16px; background: #fff; box-shadow: inset 0 0 0 1.5px #8E2A22">
<span style="width: 34px; height: 34px; flex: none; border-radius: 999px; background: #FBE5E2; color: #8E2A22; display: flex; align-items: center; justify-content: center">{svg(I["alert"], 18)}</span>
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Not sent · Keep it</span><span style="{M}; font-size: 11px; color: #6B7480; white-space: nowrap">Musa still sees · Ruth decides</span></div></div>
<div style="background: #16203C; border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 10px"><div style="display: flex; align-items: center; justify-content: space-between">{sees("MK", "Musa", chip("Ruth decides", "warn"))}{total("68,000", "+2 bags")}</div>{white_btn("Try again", "Try again: send Keep it", "retry")}</div>
<div style="display: flex; align-items: center; gap: 8px; padding: 0 4px; font-size: 12px; font-weight: 600; color: #5F6980">{svg(I["alert"], 14)}Answered first elsewhere → “Someone else just did this”</div>''',
 'the answer is kept · one tap sends it')

# 7 OFFLINE
S7 = state('OFFLINE · NO SIGNAL', f'''<div style="display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; border-radius: 12px; background: #FDEEE1; color: #7A4A02; font-size: 13px; font-weight: 700">{svg(I["wifioff"], 16)}No signal · it sends when back</div>
<div style="display: flex; align-items: center; gap: 10px; min-height: 60px; padding: 6px 10px; box-sizing: border-box; border-radius: 16px; background: #fff; box-shadow: inset 0 0 0 1px #E6E3DD">{av("DO", 36, 12)}
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700; white-space: nowrap">Shelf part OK · Wall plugs</span><span style="{M}; font-size: 11px; color: #6B7480">298,500 · 199 packs</span></div>{chip("Waits", "warn")}</div>
<div style="background: #16203C; border-radius: 16px; padding: 8px">{slide("Write off needs signal", "Write off waits for signal", "off")}</div>''',
 'taps wait in the outbox · a slide waits for signal')

# 8 EMPTY
def tab(lbl, path, on=False):
    return (f'<button aria-label="{lbl}" style="min-height: 52px; border: none; background: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; '
            f'color: {"#1C2233" if on else "#5F6980"}; font-size: 12px; font-weight: {700 if on else 600}; padding: 0">{svg(path, 22)}{lbl}</button>')
S8 = state('EMPTY · NO STOCK DECISION · 09:59', f'''<div style="{CARD}; padding: 14px; display: flex; align-items: center; gap: 10px">
<span style="width: 36px; height: 36px; flex: none; border-radius: 999px; background: #E4F4EA; color: #0F6B43; display: flex; align-items: center; justify-content: center">{svg(I["tick"], 20, 2.4)}</span>
<div style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">Nothing waits on you</span><span style="{M}; font-size: 11px; color: #6B7480">09:49 · written off 102,000 · Musa</span></div></div>
<div style="position: relative; margin: 6px -12px -12px; background: #fff; border-top: 1px solid #E6E3DD; display: grid; grid-template-columns: 1fr 1fr 80px 1fr 1fr; align-items: start; padding: 6px 0 8px">
{tab("Today", '<path d="M6.3 16.4a5.7 5.7 0 0 1 11.4 0z" fill="currentColor"/><path d="M12 3.4v2.3M5.4 6.5l1.6 1.6M18.6 6.5l-1.6 1.6M2.4 16.4h19.2M5.6 20.4h12.8"/>', True)}{tab("Orders", '<path d="M8 4h8v3H8z"/><path d="M6 5.5H5V21h14V5.5h-1"/><path d="M9 12h6"/><path d="M9 16h4"/>')}
<button aria-label="Decide next: nothing waits" style="justify-self: center; margin-top: -24px; width: 60px; height: 60px; box-sizing: border-box; border-radius: 999px; background: #C93A30; color: #fff; border: 4px solid #F7F5F2; box-shadow: 0 6px 20px rgba(255,255,255,.10); display: flex; align-items: center; justify-content: center; padding: 0">{svg(I["tick"], 26, 2.4)}</button>
{tab("Money", '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>')}{tab("Team", '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 12 0v1"/><path d="M16 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.6"/>')}
</div>''',
 'the + shows a tick, no badge · the log keeps it')

# Push column
def notif(ini, title, body, action, aria):
    bg, ink = PEOPLE[ini]
    return f'''<div style="background: #262C3A; border-radius: 18px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; color: #fff">
<div style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: #B3BCD2"><i style="width: 14px; height: 14px; border-radius: 4px; background: #16203C; box-shadow: inset 0 0 0 1px rgba(255,255,255,.3)"></i>Manager · now</div>
<div style="display: flex; gap: 10px"><div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 14px; font-weight: 700">{title}</span><span style="{M}; font-size: 12px; color: #D5DAE6; line-height: 1.45">{body}</span></div>{av(ini, 36, 12)}</div>
<div style="display: flex; gap: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,.08)">{action}</div></div>'''
def nact(t, aria):
    return f'<button aria-label="{aria}" style="height: 44px; padding: 0 12px; border: none; border-radius: 999px; background: none; color: #A9C1FF; font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 6px">{svg(I["tick"], 16, 2.4)}{t}</button>'
def nopen():
    return '<button aria-label="Open the card" style="height: 44px; padding: 0 12px; margin-left: auto; border: none; border-radius: 999px; background: none; color: #D5DAE6; font-size: 14px; font-weight: 700">Open</button>'
PUSH = f'''<div style="display: flex; flex-direction: column; gap: 8px">{label('FROM THE PUSH · LOCK SCREEN')}
<div style="width: 360px; box-sizing: border-box; padding: 12px; border-radius: 20px; background: #0C1326; display: flex; flex-direction: column; gap: 10px">
{notif("DO", "Denis · A carton for the shelf?", "Wall plugs · 1 for the order, 199 for the shelf · 298,500 · ~14 months of selling", nact("Shelf part OK", "Shelf part OK from the notification") + nopen(), "")}
<div style="background: #262C3A; border-radius: 18px; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; color: #fff"><div style="display: flex; align-items: center; gap: 8px"><span style="flex: 1; font-size: 13px; font-weight: 700">Shelf part OK · Denis sees it</span><button aria-label="Undo, 10 seconds" style="height: 44px; padding: 0 12px; border: none; border-radius: 999px; background: rgba(255,255,255,.1); color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px">{svg(I["undo"], 15)}Undo · {mono("10 s")}</button></div>{undo_bar.replace("60%", "100%")}</div>
{notif("MK", "Musa · Check-in differs · Denis's trip", "Owino Plumbing · PVC pipe 4 in 11 of 12 · −28,000 at cost<br>Denis: 12 went on the truck at Owino.", nact("Take the check-in", "Take the check-in from the notification") + nopen(), "")}
{notif("MK", "Musa · Damaged · 3 Cement 50 kg", "on the shelf 26 → 23 · −102,000 at cost", nact("Kept on the shelf", "Kept on the shelf from the notification") + nopen(), "")}
</div>{note('1 tap from the push · write-off: Open + slide = 2')}</div>'''

STATES = f'''<div style="display: flex; gap: 40px; align-items: flex-start">
<div style="display: grid; grid-template-columns: repeat(4, 360px); gap: 18px 40px">{S1}{S2}{S3}{S4}{S5}{S6}{S7}{S8}</div>
{PUSH}</div>'''

# ======================= TOP STRIP =======================
def ask_chip(d, t):
    return (f'<span style="display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px 0 4px; border-radius: 999px; background: rgba(255,255,255,.1); font-size: 12px; font-weight: 700; white-space: nowrap">'
            f'<b style="height: 22px; padding: 0 6px; border-radius: 999px; background: #fff; color: #16203C; {M}; font-size: 11px; display: flex; align-items: center">{d}</b>{t}</span>')
def ans_chip(t):
    return f'<span style="display: flex; align-items: center; height: 30px; padding: 0 10px; border-radius: 999px; background: #fff; font-size: 12px; font-weight: 700; white-space: nowrap">{t}</span>'
TOP = f'''<div style="height: 64px; display: flex; align-items: center; gap: 20px">
<div style="display: flex; flex-direction: column; gap: 2px; flex: none"><span style="font-size: 28px; font-weight: 800; letter-spacing: -.01em">Decide · stock</span><span style="{M}; font-size: 12px; color: #5F6980">manager.html · the red + · Sat 17 Oct · mirrors Agent Needs you + dock</span></div>
<div style="flex: 1"></div>
<div style="display: flex; align-items: center; gap: 6px; height: 44px; padding: 0 7px 0 14px; border-radius: 999px; background: #16203C; color: #fff"><span style="font-size: 13px; font-weight: 700; margin-right: 2px; white-space: nowrap">Asks in</span>{ask_chip("D-16", "Damaged")}{ask_chip("D-24", "A carton")}{ask_chip("D-13", "Check-in differs")}{ask_chip("D-15", "Not on the list")}{ask_chip("D-17", "A count to check")}</div>
<div style="display: flex; align-items: center; gap: 6px; height: 44px; padding: 0 7px 0 14px; border-radius: 999px; background: #FDE8E4; color: #A82D24"><span style="font-size: 13px; font-weight: 700; margin-right: 2px; white-space: nowrap">Answers out</span>{ans_chip("Written off")}{ans_chip("Shelf part OK")}{ans_chip("Take the check-in")}{ans_chip("Keep it")}{ans_chip("Count taken")}{ans_chip("Not yet")}</div>
</div>'''

HTML = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Decide stock</title>
<script src="./support.js"></script></head><body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&amp;family=IBM+Plex+Mono:wght@500;600&amp;display=swap">
<style>body{{margin:0}} a{{color:#16203C}}a:hover{{color:#C93A30}} button{{font-family:inherit;cursor:pointer;margin:0}} svg{{flex:none}}</style>
</helmet>
<div style="width: 2040px; height: 1720px; box-sizing: border-box; padding: 40px; background: #F7F5F2; font-family: Figtree, system-ui, sans-serif; color: #1C2233; display: flex; flex-direction: column; gap: 24px; overflow: hidden">
{TOP}
<div style="display: flex; gap: 40px; align-items: flex-start">{ROW1}{SCORE}</div>
{STATES}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":2040,"height":1720}}}}'>
class Component extends DCLogic {{ renderVals() {{ return {{}}; }} }}
</script></body></html>
'''
open(OUT, 'w').write(HTML)
print('ok', len(HTML))
