import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ib import shell, e, M, NAVY, INK, INK6, INK4, RULE, GROUND, OUT
JOBS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'flowdata.json')))
W=1440; MAXT = max(max(j['before'], j['after']) for j in JOBS['jobs'])
def bar(n, color, label):
    w = n / MAXT * 100
    return (f'<span style="display:flex;align-items:center;gap:10px"><span style="flex:1;height:14px;border-radius:999px;background:#F1EEE8;overflow:hidden"><i style="display:block;height:100%;width:{w:.1f}%;border-radius:999px;background:{color}"></i></span>'
            f'<span style="width:110px;font-size:13px;font-weight:600;{M}">{n}{label}</span></span>')
rows=''
for i,j in enumerate(JOBS['jobs']):
    b = '' if i==len(JOBS['jobs'])-1 else 'border-bottom:1px solid #EFECE6;'
    cut = j['before']-j['after']
    rows += (f'<div style="display:grid;grid-template-columns:300px minmax(0,1fr) minmax(0,1fr) 120px;gap:0 24px;align-items:center;padding:14px 24px;{b}">'
             f'<span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:15px;font-weight:700">{e(j["job"])}</span><span style="font-size:12px;color:{INK4}">{e(j["how"])}</span></span>'
             f'{bar(j["before"], "#9AA1AE", " taps" + (" + typed" if j.get("typed_before") else ""))}{bar(j["after"], "#16203C", " taps" + (" + typed" if j.get("typed_after") else ""))}'
             f'<span style="justify-self:end;height:28px;padding:0 12px;border-radius:999px;background:{"#E4F4EA" if cut>0 else "#F1EEE8"};color:{"#0F6B43" if cut>0 else INK6};font-size:13px;font-weight:700;display:flex;align-items:center;{M}">{"−"+str(cut) if cut>0 else "same"}</span></div>')
def path(title, steps_before, steps_after, tb, ta):
    def strip(steps, dark):
        return ''.join(f'<span style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;min-width:0"><span style="width:34px;height:34px;border-radius:999px;background:{NAVY if dark else "#F1EEE8"};color:{"#FFFFFF" if dark else INK6};font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;{M}">{k+1}</span><span style="font-size:11px;font-weight:600;color:{INK6};text-align:center;line-height:1.25">{e(s)}</span></span>' for k,s in enumerate(steps))
    return (f'<div style="background:#fff;border:1px solid {RULE};border-radius:20px;padding:20px 24px;display:flex;flex-direction:column;gap:16px">'
            f'<div style="display:flex;align-items:baseline;gap:12px"><span style="font-size:17px;font-weight:700;flex:1">{e(title)}</span><span style="font-size:14px;color:{INK4};{M}">{tb} → </span><span style="font-size:26px;font-weight:600;{M}">{ta}</span><span style="font-size:13px;color:{INK6}">taps</span></div>'
            f'<div style="display:flex;flex-direction:column;gap:8px"><span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:{INK4}">TODAY</span><div style="display:flex;gap:4px">{strip(steps_before, False)}</div></div>'
            f'<div style="display:flex;flex-direction:column;gap:8px"><span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:{INK4}">NEW</span><div style="display:flex;gap:4px">{strip(steps_after, True)}</div></div></div>')
paths = ''.join(path(p['title'], p['before'], p['after'], len(p['before']), len(p['after'])) for p in JOBS['paths'])
tb = sum(j['before'] for j in JOBS['jobs']); ta = sum(j['after'] for j in JOBS['jobs'])
head = (f'<div style="background:{NAVY};color:#fff;padding:40px 48px 32px;display:flex;align-items:flex-end;gap:32px">'
        f'<span style="flex:1;display:flex;flex-direction:column;gap:6px"><span style="font-size:13px;font-weight:700;letter-spacing:.12em;color:#8D99B5">THE FLOW · STEPS AND TAPS</span>'
        f'<span style="font-size:38px;font-weight:700;letter-spacing:-.02em">Today\'s Store against the new one</span>'
        f'<span style="font-size:15px;color:#B3BCD2">Taps from a fresh open of the app, measured in the real app today (docs/audit/store/STORE-TODAY.md §2) and counted on the boards. A slide is one tap; typed counts are marked.</span></span>'
        f'<span style="display:flex;align-items:baseline;gap:10px"><span style="font-size:20px;color:#8D99B5;{M}">{tb}</span><span style="font-size:20px;color:#8D99B5">→</span><span style="font-size:56px;font-weight:600;{M}">{ta}</span><span style="font-size:15px;color:#B3BCD2">taps across<br>{len(JOBS["jobs"])} jobs</span></span></div>')
legend = (f'<div style="display:grid;grid-template-columns:300px minmax(0,1fr) minmax(0,1fr) 120px;gap:0 24px;padding:12px 24px;background:{GROUND};border-bottom:1px solid {RULE}">'
          + ''.join(f'<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:{INK4}">{t}</span>' for t in ['THE JOB','TODAY','NEW','CUT']) + '</div>')
table = f'<div style="margin:24px 48px;background:#fff;border:1px solid {RULE};border-radius:20px;overflow:hidden">{legend}{rows}</div>'
pathsec = f'<div style="margin:0 48px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px">{paths}</div>'
h = 190 + 24 + 40 + len(JOBS['jobs'])*68 + 24 + 300 - 60
open(os.path.join(OUT,'FL01Taps.dc.html'),'w').write(shell('Steps and taps', W, h, head+table+pathsec))
print('FL01', h, tb, ta)
