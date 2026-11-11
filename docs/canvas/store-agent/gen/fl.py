# FL01: steps and taps, today's Store against the new one. Counts are the boards' own (recounted on the
# boards where the measured job differs) and STORE-TODAY.md §2 for today.
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ib import shell, fit, e, M, NAVY, INK, INK6, INK4, RULE, GROUND, TILE, OUT
D = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'flowdata.json')))
JOBS = D['jobs']
OLD = [j for j in JOBS if j['before'] is not None]
NEW = [j for j in JOBS if j['before'] is None]
W = 1440
MAXT = max(max(j['before'] or 0, j['after']) for j in JOBS)
def bar(n, typed, color):
    if n is None:
        return (f'<span style="display:flex;align-items:center;gap:10px"><span style="flex:1;height:14px;border-radius:999px;border:1.5px dashed #C9CDD5"></span>'
                f'<span style="width:130px;font-size:13px;font-weight:600;color:{INK4}">no way today</span></span>')
    w = n / MAXT * 100
    t = '' if not typed else f'<i style="display:block;width:{typed*10}px;height:100%;border-radius:999px;margin-left:3px;background:repeating-linear-gradient(135deg,{color} 0 2px,transparent 2px 5px)"></i>'
    lab = f'{n} taps' + (f' + {typed} typed' if typed else '')
    return (f'<span style="display:flex;align-items:center;gap:10px"><span style="flex:1;height:14px;border-radius:999px;background:{TILE};overflow:hidden;display:flex">'
            f'<i style="display:block;height:100%;width:{w:.1f}%;border-radius:999px;background:{color}"></i>{t}</span>'
            f'<span style="width:130px;font-size:13px;font-weight:600;{M}">{lab}</span></span>')
def cutchip(j):
    if j['before'] is None:
        return ('#E4E6FA', '#3A3F9B', 'new job')
    cut = j['before'] - j['after']
    tb, ta = j.get('typed_before', 0), j.get('typed_after', 0)
    if cut > 0:
        return ('#E4F4EA', '#0F6B43', f'−{cut}' + (' · no typing' if tb and not ta else ''))
    if tb and not ta:
        return ('#E4F4EA', '#0F6B43', f'no typing')
    return (TILE, INK6, 'same')
GRID = 'grid-template-columns:330px minmax(0,1fr) minmax(0,1fr) 140px;gap:0 24px'
def jobrow(j, last):
    b = '' if last else 'border-bottom:1px solid #EFECE6;'
    bg, ink, t = cutchip(j)
    return (f'<div style="display:grid;{GRID};align-items:center;padding:12px 24px;{b}">'
            f'<span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:15px;font-weight:700">{e(j["job"])}</span>'
            f'<span style="font-size:12px;color:{INK4}">{e(j["how"])} · <span style="color:#3A3F9B;{M}">{e(j["boards"])}</span></span></span>'
            f'{bar(j["before"], j.get("typed_before", 0), "#9AA1AE")}{bar(j["after"], j.get("typed_after", 0), NAVY)}'
            f'<span style="justify-self:end;height:28px;padding:0 12px;border-radius:999px;background:{bg};color:{ink};font-size:13px;font-weight:700;display:flex;align-items:center;white-space:nowrap;{M}">{e(t)}</span></div>')
PHC = {'pack': '#5B6BD0', 'load': '#15803D', 'deliver': '#0369A1', 'gate': '#B4691C'}
PHL = {'pack': 'Pack', 'load': 'Load', 'deliver': 'Deliver', 'gate': 'Hand over'}
def phases(steps):
    ph, out = 'pack', []
    for s in steps:
        if s in ('Load tile', 'To load'): ph = 'load'
        if s == 'At the door': ph = 'deliver'
        if s in ('Gate card', 'Ready card'): ph = 'gate'
        out.append(ph)
    return out
STEP = 92
def strip(steps, dark):
    out, k = '', 0
    for s, ph in zip(steps, phases(steps)):
        c = PHC[ph]
        if s.startswith('~'):  # typed, not a tap
            out += (f'<span style="width:{STEP}px;flex:none;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="width:34px;height:34px;border-radius:999px;border:1.5px dashed {c};color:{c};font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center">Aa</span>'
                    f'<span style="font-size:11px;font-weight:600;color:{INK6};text-align:center;line-height:1.25">{e(s[1:])} · typed</span></span>')
            continue
        k += 1
        st = f'background:{c};color:#FFFFFF' if dark else f'background:#FFFFFF;color:{c};box-shadow:inset 0 0 0 1.5px {c}'
        out += (f'<span style="width:{STEP}px;flex:none;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="width:34px;height:34px;border-radius:999px;{st};font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;{M}">{k}</span>'
                f'<span style="font-size:11px;font-weight:600;color:{INK6};text-align:center;line-height:1.25">{e(s)}</span></span>')
    return out
def taps(steps): return sum(1 for s in steps if not s.startswith('~'))
def typed(steps): return sum(1 for s in steps if s.startswith('~'))
def path(p):
    tb, ta, ty = taps(p['before']), taps(p['after']), typed(p['before'])
    lab = lambda n, t: f'{n}' + (f' + typed' if t else '')
    return (f'<div style="background:#fff;border:1px solid {RULE};border-radius:20px;padding:20px 24px;display:flex;flex-direction:column;gap:14px">'
            f'<div style="display:flex;align-items:baseline;gap:12px"><span style="font-size:17px;font-weight:700">{e(p["title"])}</span><span style="font-size:12px;color:#3A3F9B;{M}">{e(p["boards"])}</span><span style="flex:1"></span>'
            f'<span style="font-size:15px;color:{INK4};{M}">{lab(tb, ty)} → </span><span style="font-size:28px;font-weight:600;{M}">{ta}</span><span style="font-size:13px;color:{INK6}">taps</span></div>'
            f'<div style="display:grid;grid-template-columns:70px minmax(0,1fr);align-items:center;gap:8px 12px">'
            f'<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:{INK4}">TODAY</span><div style="display:flex">{strip(p["before"], False)}</div>'
            f'<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:{INK4}">NEW</span><div style="display:flex">{strip(p["after"], True)}</div></div></div>')
tb = sum(j['before'] for j in OLD); ta = sum(j['after'] for j in OLD)
head = (f'<div style="background:{NAVY};color:#fff;padding:40px 48px 32px;display:flex;align-items:flex-end;gap:32px">'
        f'<span style="flex:1;display:flex;flex-direction:column;gap:6px"><span style="font-size:13px;font-weight:700;letter-spacing:.12em;color:#8D99B5">THE FLOW · STEPS AND TAPS</span>'
        f'<span style="font-size:38px;font-weight:700;letter-spacing:-.02em">Today\'s Store against the new one</span>'
        f'<span style="font-size:15px;color:#B3BCD2">From a fresh open of the app. Today: measured in the real app (docs/audit/store/STORE-TODAY.md §2). New: counted on the boards. A slide is one tap; typed text is not a tap and is shown apart.</span></span>'
        f'<span style="display:flex;align-items:baseline;gap:10px;white-space:nowrap"><span style="font-size:20px;color:#8D99B5;{M}">{tb}</span><span style="font-size:20px;color:#8D99B5">→</span><span style="font-size:56px;font-weight:600;{M}">{ta}</span><span style="font-size:15px;color:#B3BCD2">taps across the<br>{len(OLD)} jobs that exist today</span></span></div>')
legend = (f'<div style="display:grid;{GRID};padding:12px 24px;background:{GROUND};border-bottom:1px solid {RULE}">'
          + ''.join(f'<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:{INK4}">{t}</span>' for t in ['THE JOB · ITS BOARDS', 'TODAY', 'NEW', 'CUT']) + '</div>')
newhead = (f'<div style="padding:12px 24px;background:{GROUND};border-top:1px solid {RULE};border-bottom:1px solid {RULE};font-size:11px;font-weight:700;letter-spacing:.1em;color:{INK4}">'
           f'NEW JOBS · NOT IN THE TOTAL</div>')
table = (f'<div style="margin:24px 48px;background:#fff;border:1px solid {RULE};border-radius:20px;overflow:hidden">{legend}'
         + ''.join(jobrow(j, i == len(OLD) - 1) for i, j in enumerate(OLD)) + newhead
         + ''.join(jobrow(j, i == len(NEW) - 1) for i, j in enumerate(NEW)) + '</div>')
key = (f'<div style="margin:0 48px 14px;display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;font-size:12px;color:{INK6}">'
       f'<span style="font-size:13px;font-weight:700;color:{INK}">One order, end to end</span><span>each step is one tap at a fixed width, so the shorter path is the shorter strip</span>'
       + ''.join(f'<span style="display:inline-flex;align-items:center;gap:6px"><i style="width:12px;height:12px;border-radius:999px;background:{c}"></i>{PHL[k]}</span>' for k, c in PHC.items())
       + f'<span style="display:inline-flex;align-items:center;gap:6px"><i style="width:12px;height:12px;border-radius:999px;border:1.5px dashed {INK4}"></i>typed, not a tap</span></div>')
pathsec = f'<div style="margin:0 48px;display:flex;flex-direction:column;gap:14px">{"".join(path(p) for p in D["paths"])}</div>'
if __name__ == '__main__':
    h = fit(os.path.join(OUT, 'FL01Taps.dc.html'), head + table + key + pathsec, W, 'Steps and taps')
    print('FL01', h, tb, ta, [(p['title'], taps(p['before']), taps(p['after'])) for p in D['paths']])
