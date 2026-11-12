import html, sys
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'Flow.dc.html')
W, H = 2040, 2400
NAVY='#16203C'; INK='#1C2233'; SOFT='#5F6980'; FAINT='#6B7480'; LINE='#E6E3DD'; BG='#F7F5F2'; TILE='#F1EEE8'
RED='#C93A30'; REDS='#FDE8E4'; REDD='#A82D24'; GOOD='#0F6B43'; GOODB='#E4F4EA'; WARN='#95530C'; WARNB='#FDEEE1'; WARNI='#7A4A02'
BAD='#8E2A22'; BADB='#FBE5E2'; DASH='#C9C4BA'; MINT='#6FDCB0'; ONNAVY='#B3BCD2'; MONO="'IBM Plex Mono', monospace"
e = html.escape
P = {'RN':('#16203C','#FFFFFF'),'GA':('#DCEAF8','#1A5A8A'),'BO':('#DDF1EE','#0E5E57'),'FN':('#F6E4F1','#7A3268'),
     'DO':('#E4E6FA','#3A3F9B'),'MK':('#E4F4EA','#0F6B43'),'EA':('#E8EBF0','#3D4A5C'),'ML':('#F1EEE8','#1C2233'),'PS':('#F1EEE8','#1C2233')}
ICON = {
 'bell':'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"></path><path d="M10 21h4"></path>',
 'x':'<path d="M6 6l12 12M18 6L6 18"></path>', 'check':'<path d="M5 12l5 5L19 7"></path>',
 'arrow':'<path d="M5 12h14M13 6l6 6-6 6"></path>', 'undo':'<path d="M9 14L4 9l5-5"></path><path d="M4 9h10a6 6 0 0 1 0 12h-3"></path>',
 'eye':'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
 'lock':'<rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path>',
}
def svg(n, s=14, sw=2):
    return f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICON[n]}</svg>'
def av(k, s=32):
    bg, fg = P[k]; r = 10 if s >= 30 else 99; fs = 13 if s >= 30 else 12
    return f'<span style="width: {s}px; height: {s}px; border-radius: {r}px; background: {bg}; color: {fg}; display: inline-flex; align-items: center; justify-content: center; font-size: {fs}px; font-weight: 800; flex-shrink: 0">{k}</span>'
def pill(l, kind='tap'):
    base = 'height: 30px; padding: 0 12px; border-radius: 999px; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; box-sizing: border-box; flex-shrink: 0'
    if kind == 'primary': return f'<span style="{base}; background: {NAVY}; color: #fff">{e(l)}</span>'
    if kind == 'slide': return f'<span style="{base}; background: {NAVY}; color: #fff; padding-left: 4px"><span style="width: 24px; height: 24px; border-radius: 99px; background: {RED}; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800">»</span>{e(l)}</span>'
    return f'<span style="{base}; background: #fff; color: {INK}; border: 1px solid {DASH}">{e(l)}</span>'
def card(inner, extra=''):
    return f'<div style="background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 10px; box-sizing: border-box; {extra}">{inner}</div>'
def sec(title, right=''):
    return f'<div style="display: flex; align-items: baseline; justify-content: space-between; gap: 16px"><span style="font-size: 20px; font-weight: 800">{e(title)}</span><span style="font-family: {MONO}; font-size: 14px; color: {SOFT}">{right}</span></div>'

# ---------- hero ----------
def bigstat(label, b, a, sub):
    wa = round(a / b * 100, 1)
    return (f'<div style="background: rgba(255,255,255,.08); border-radius: 18px; padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; width: 330px; box-sizing: border-box">'
            f'<span style="font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: {ONNAVY}">{e(label)}</span>'
            f'<div style="display: flex; align-items: baseline; gap: 12px; font-family: {MONO}"><span style="font-size: 28px; font-weight: 600; color: {ONNAVY}; text-decoration: line-through">{b}</span><span style="font-size: 20px; color: {ONNAVY}">→</span><span style="font-size: 52px; font-weight: 600; color: {MINT}">{a}</span><span style="font-family: Figtree, sans-serif; font-size: 14px; font-weight: 600; color: {ONNAVY}">{e(sub)}</span></div>'
            f'<div style="display: flex; flex-direction: column; gap: 5px"><div style="height: 8px; border-radius: 99px; background: rgba(255,255,255,.12); display: flex"><div style="width: 100%; border-radius: 99px; background: #5F6980"></div></div>'
            f'<div style="height: 8px; border-radius: 99px; background: rgba(255,255,255,.12); display: flex"><div style="width: {wa}%; border-radius: 99px; background: {MINT}"></div></div></div></div>')
hero = (f'<div style="background: {NAVY}; color: #fff; border-radius: 0 0 28px 28px; padding: 22px 40px 24px; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px">'
        f'<div style="display: flex; flex-direction: column; gap: 10px"><div style="font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: {ONNAVY}">Sat 17 Oct · 09:40 · Mukasa Hardware · Ruth Nakato</div>'
        f'<div style="font-size: 38px; font-weight: 800; line-height: 1.1">The Manager’s day<br>before → after</div>'
        f'<div style="display: flex; gap: 8px; margin-top: 4px"><span style="height: 30px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,.1); font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px"><span style="width: 8px; height: 8px; border-radius: 99px; background: #fff"></span>a queue · 8 wait</span>'
        f'<span style="height: 30px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,.1); font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px">{svg("eye", 14)}a watch · 3 things</span></div></div>'
        f'<div style="display: flex; gap: 12px">'
        + bigstat('From the app · 30 decisions', 145, 68, 'taps')
        + bigstat('From the push · 20 with a push', 59, 24, 'taps')
        + bigstat('Each next in the queue', 2, 1, 'tap')
        + '</div></div>')

# ---------- the queue ----------
Q = [  # who, ask, evidence, age_min, answer, kind, app before, app after, push before, push after, standing
 ('MK','Not paid yet · on credit? · #0551','Nansana Hardware · 1,240,000 · truck waits',25,'On credit · load it','primary',6,2,5,1,True,'Musa · Grace'),
 ('BO','Return asked · #0547','5 Timber 2×4 · −56,250',180,'Credit note raised · 56,250','slide',4,2,2,2,False,'Brian · Esther'),
 ('DO','Price up · #0552','Ridge cap 3 m · cost 27,000, sells 26,000',130,'Shop’s price · 33,750','primary',7,2,5,1,False,'Denis · Faith'),
 ('MK','Damaged · 3 Cement 50 kg','−102,000 at cost · photo',90,'Written off · 102,000','slide',4,2,2,2,False,'Musa'),
 ('GA','Under the shop’s price · #0555','Iron sheet G28 · 46,000 of 47,500',65,'Approved · 46,000','primary',4,2,2,1,False,'Grace'),
 ('GA','Cancel asked · #0556','Ggaba Stores · 430,000 · not paid',50,'Cancelled','slide',4,2,4,2,False,'Grace · Musa · Denis'),
 ('MK','Packed short · #0550','Iron sheet G28 36 of 40',40,'Bill what went · 1,710,000','primary',4,2,2,1,False,'Musa · Grace'),
 ('DO','A carton for the shelf?','Wall plugs · 199 for the shelf · 298,500',15,'Shelf part OK','primary',4,2,2,1,False,'Denis'),
]
def age(m): return f'{m//60} h {m%60:02d} m'
QCOLS = '24px 36px minmax(0, 1fr) 150px 250px 80px 80px'
qrows = ''
for i, (k, ask, ev, m, ans, kind, ab, aa, pb, pa, st, who) in enumerate(Q):
    w = round(m / 180 * 100, 1)
    barc = NAVY if st else (WARN if m >= 60 else '#5F6980')
    standing = f'<span style="height: 22px; padding: 0 8px; border-radius: 999px; background: {NAVY}; color: #fff; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; white-space: nowrap">STANDING THERE</span>' if st else ''
    same = (pa == pb)
    qrows += (f'<div style="display: grid; grid-template-columns: {QCOLS}; gap: 14px; align-items: center; min-height: 48px; border-top: 1px solid {LINE}">'
              f'<span style="font-family: {MONO}; font-size: 15px; font-weight: 600; color: {NAVY}">{i + 1}</span>{av(k, 36)}'
              f'<div style="display: flex; flex-direction: column; gap: 3px; min-width: 0"><div style="display: flex; align-items: center; gap: 8px"><span style="font-size: 14px; font-weight: 800; white-space: nowrap">{e(ask)}</span>{standing}</div><span style="font-family: {MONO}; font-size: 12px; color: {SOFT}; white-space: nowrap">{e(ev)}</span></div>'
              f'<div style="display: flex; flex-direction: column; gap: 4px"><div style="height: 8px; border-radius: 99px; background: {TILE}; display: flex"><div style="width: {w}%; border-radius: 99px; background: {barc}"></div></div><span style="font-family: {MONO}; font-size: 12px; font-weight: 600; color: {barc}">{age(m)}</span></div>'
              f'<div style="display: flex; flex-direction: column; gap: 3px; align-items: flex-start; padding: 4px 0">{pill(ans, kind)}<span style="display: inline-flex; align-items: center; gap: 4px; font-family: {MONO}; font-size: 11px; color: {SOFT}; white-space: nowrap">{svg("bell", 12)}{e(who)} {"sees" if " · " not in who else "see"} it</span></div>'
              f'<span style="font-family: {MONO}; font-size: 14px; font-weight: 600; color: {SOFT}; text-align: right">{ab} → <span style="color: {GOOD}">{aa}</span></span>'
              f'<span style="font-family: {MONO}; font-size: 14px; font-weight: 600; color: {SOFT}; text-align: right">{pb} → <span style="color: {BAD if same else GOOD}">{pa}</span></span></div>')
sab = sum(q[6] for q in Q); saa = sum(q[7] for q in Q); spb = sum(q[8] for q in Q); spa = sum(q[9] for q in Q)
qhead = (f'<div style="display: grid; grid-template-columns: {QCOLS}; gap: 14px; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: {SOFT}; padding-bottom: 4px">'
         '<span>#</span><span></span><span>Who waits · what · the evidence</span><span>Waited</span><span>The answer</span><span style="text-align: right">App</span><span style="text-align: right">Push</span></div>')
qfoot = (f'<div style="display: grid; grid-template-columns: {QCOLS}; gap: 14px; align-items: center; min-height: 52px; border-top: 2px solid {NAVY}">'
         f'<span></span><span></span><span style="font-size: 14px; font-weight: 800">One by one</span><span></span>'
         f'<span style="font-size: 13px; font-weight: 600; color: {SOFT}">in a row: each next 2 → 1</span>'
         f'<span style="font-family: {MONO}; font-size: 16px; font-weight: 600; text-align: right; color: {SOFT}">{sab} → <span style="color: {GOOD}">{saa}</span></span>'
         f'<span style="font-family: {MONO}; font-size: 16px; font-weight: 600; text-align: right; color: {SOFT}">{spb} → <span style="color: {GOOD}">{spa}</span></span></div>')
queue = card(sec('A queue · 8 wait on Ruth', 'standing first · then oldest') + qhead + qrows + qfoot, 'flex: 1.75 1 0; min-width: 0')

# ---------- the watch ----------
WATCH = [
 ('DO', 'Stuck · #0554 Lubowa', '2 h 40 m in Checking · 40 m over · Denis holds it', 'Nudge Denis', '5 → 2'),
 ('FN', 'Behind pace · Faith', '14,910,000 of 30M · behind 2,090,000', 'Nudge Faith', '5 → 2'),
 ('GA', 'Over 30 days · Kyaligonza & Sons', '2,310,000 · oldest 38 d · Grace’s', 'Nudge Grace', '5 → 2'),
]
wrows = ''
for k, t, ev, mv, taps in WATCH:
    wrows += (f'<div style="display: grid; grid-template-columns: 36px minmax(0, 1fr) auto 64px; gap: 12px; align-items: center; min-height: 58px; border-top: 1px solid {LINE}">'
              f'{av(k, 36)}<div style="display: flex; flex-direction: column; gap: 3px; min-width: 0"><span style="font-size: 14px; font-weight: 800">{e(t)}</span><span style="font-family: {MONO}; font-size: 12px; color: {SOFT}">{e(ev)}</span></div>'
              f'{pill(mv, "primary")}<span style="font-family: {MONO}; font-size: 14px; font-weight: 600; color: {SOFT}; text-align: right">{taps.split(" → ")[0]} → <span style="color: {GOOD}">{taps.split(" → ")[1]}</span></span></div>')
LOG = [('07:55', 'Approved · Iron sheet G28 · #0549 for Brian', 'RN'), ('08:30', '#0546 billed itself · 24 h after delivery', None)]
lrows = ''
for t, w, k in LOG:
    ic = av(k, 24) if k else f'<span style="width: 24px; height: 24px; border-radius: 99px; background: {GOODB}; color: {GOOD}; display: inline-flex; align-items: center; justify-content: center">{svg("check", 14, 2.5)}</span>'
    lrows += f'<div style="display: flex; align-items: center; gap: 10px; min-height: 36px"><span style="font-family: {MONO}; font-size: 13px; font-weight: 600; color: {SOFT}; width: 48px">{t}</span>{ic}<span style="font-size: 13px; font-weight: 600">{e(w)}</span></div>'

# ---------- one decision path ----------
def step(name, taps, kind='white', where=''):
    if kind == 'white':
        bg, fg, num = '#fff', INK, SOFT; bd = f'border: 1px solid {LINE}'
    elif kind == 'gone':
        bg, fg, num = TILE, SOFT, SOFT; bd = f'border: 1px dashed {DASH}'
    else:
        bg, fg, num = NAVY, '#fff', MINT; bd = 'border: 1px solid ' + NAVY
    flex = max(taps, 0.6)
    deco = 'text-decoration: line-through; ' if kind == 'gone' else ''
    return (f'<div style="flex: {flex} 1 0; min-width: 0; background: {bg}; color: {fg}; {bd}; border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; height: 66px">'
            f'<span style="font-size: 13px; font-weight: 700; line-height: 1.25; {deco}">{e(name)}</span>'
            f'<span style="font-family: {MONO}; font-size: 18px; font-weight: 600; color: {num}">{taps}</span></div>')
def lane(label, sub, steps, total, color):
    return (f'<div style="display: grid; grid-template-columns: 170px minmax(0, 1fr) 64px; gap: 14px; align-items: center">'
            f'<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 800">{e(label)}</span><span style="font-family: {MONO}; font-size: 12px; color: {SOFT}">{e(sub)}</span></div>'
            f'<div style="display: flex; gap: 6px">{"".join(steps)}</div>'
            f'<span style="font-family: {MONO}; font-size: 28px; font-weight: 600; color: {color}; text-align: right">{total}</span></div>')
lanes = (lane('Before · the app', 'D-1 · 5 of 8', [step('Open the app', 1), step('Decide now tile', 1, 'gone'), step('The list row', 1, 'gone'), step('Approve on its page', 1)], 4, SOFT)
         + lane('After · the app', 'answer on the row', [step('Open the app', 1), step('Approved · 46,000 on the Needs-you row', 1, 'navy'), step('Undo 10 s', 0), step('Next comes by itself', 0)], 2, GOOD)
         + lane('After · the push', 'the lock screen', [step('Approved · 46,000 on the notification', 1, 'navy'), step('Approved · Undo 10 s', 0), step('Approved · Grace sees it', 0)], 1, GOOD))

# lock-screen notification, three states
def notif(state):
    head = (f'<div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: {ONNAVY}"><span style="width: 20px; height: 20px; border-radius: 6px; background: #fff; color: {NAVY}; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800">M</span>Manager · Decisions · now</div>')
    if state == 'ask':
        body = (f'<span style="font-size: 14px; font-weight: 800; color: #fff">Grace · Under the shop’s price · #0555</span>'
                f'<span style="font-family: {MONO}; font-size: 12px; color: #D5DBEA; line-height: 1.45">Iron sheet G28 · 46,000, shop’s 47,500<br>cost 38,000 · 30 sht</span>'
                f'<div style="display: flex; gap: 18px; padding-top: 4px"><span style="font-size: 13px; font-weight: 800; color: #9FC1FF">Approved · 46,000</span></div>')
    elif state == 'undo':
        body = (f'<div style="display: flex; align-items: center; justify-content: space-between"><span style="font-size: 14px; font-weight: 800; color: #fff">Approved · #0555</span><span style="font-family: {MONO}; font-size: 13px; font-weight: 600; color: {MINT}">10 s</span></div>'
                f'<div style="height: 4px; border-radius: 99px; background: rgba(255,255,255,.15); display: flex"><div style="width: 70%; border-radius: 99px; background: {MINT}"></div></div>'
                f'<span style="font-size: 13px; font-weight: 800; color: #9FC1FF; display: inline-flex; align-items: center; gap: 6px">{svg("undo", 14)}Undo</span>')
    else:
        body = (f'<div style="display: flex; align-items: center; gap: 8px"><span style="width: 22px; height: 22px; border-radius: 99px; background: {MINT}; color: {NAVY}; display: inline-flex; align-items: center; justify-content: center">{svg("check", 14, 2.5)}</span><span style="font-size: 14px; font-weight: 800; color: #fff">Approved · Grace sees it</span></div>')
    return f'<div style="background: #2A3350; border-radius: 18px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px">{head}{body}</div>'
lock = (f'<div style="background: #0E1426; border-radius: 22px; padding: 14px; display: flex; flex-direction: column; gap: 8px; box-sizing: border-box; margin-top: auto">'
        f'<div style="display: flex; align-items: center; justify-content: space-between; color: {ONNAVY}; font-size: 12px; font-weight: 600"><span style="display: inline-flex; align-items: center; gap: 6px">{svg("lock", 14)}Lock screen</span><span style="font-family: {MONO}">09:40</span></div>'
        + notif('ask')
        + f'<div style="display: flex; align-items: center; gap: 8px; color: {ONNAVY}; font-size: 12px; font-weight: 700; letter-spacing: .06em">TAP · 1 {svg("arrow", 12)}</div>'
        + notif('undo') + notif('sent') + '</div>')
path = card(sec('One decision · D-1 under the shop’s price', 'taps') + f'<div style="display: flex; flex-direction: column; gap: 10px">{lanes}</div>')
watch = card(sec('A watch · nobody waits', 'ends in one move') + wrows + lock, 'flex: 1 1 0; min-width: 0')

# ---------- per decision dumbbells ----------
D = [ # id, name, push b, push a, app b, app a, flag
 ('D-1','Under the shop’s price',2,1,4,2,''),('D-2','Price coming',4,1,6,2,''),('D-3','Price up',5,1,7,2,''),
 ('D-4','Counter sale',2,1,4,2,''),('D-5','On credit? · over / old bill',2,1,3,2,''),('D-6','On credit? · no limit set',5,1,6,2,''),
 ('D-7','Not paid yet · on credit?',5,1,6,2,''),('D-8','Delivered · bills itself at 24 h',2,0,3,0,''),('D-9','Only 567 · check it',3,1,4,2,''),
 ('D-10','A line at 0',5,2,6,2,''),('D-11','Can’t bill itself',None,None,None,None,'under'),('D-12','Packed short',2,1,4,2,''),
 ('D-13','Check-in differs',2,1,4,2,''),('D-14','Denis’s note alone',2,0,4,0,''),('D-15','Not on the list',None,1,None,2,'np'),
 ('D-16','Damaged · write off',2,2,4,2,'slide'),('D-17','A count to check',4,2,4,2,''),
 ('D-18','Return asked',2,2,4,2,'slide'),('D-19','Void asked',2,2,4,2,'slide'),('D-20','Cancel asked',4,2,4,2,''),
 ('D-21','Taken twice?',None,None,4,2,''),('D-22','Peter asks: fewer',2,1,4,2,''),('D-23','Restock: not yet',None,None,4,3,''),
 ('D-24','A carton for the shelf?',2,1,4,2,''),('D-25','Limit and terms',None,None,8,5,''),('D-26','Look alike',None,None,6,4,''),
 ('D-27','Opening balance',None,None,6,4,''),('D-28','Promise (Ruth’s)',None,None,6,4,''),('D-29','Goals',None,None,5,4,''),
 ('D-30','Chase debtors',None,None,5,2,''),('D-31','Stuck order',None,None,5,2,''),('D-32','Credit asked',None,1,None,2,'np'),
 ('D-33','A new item to price',None,1,7,2,''),
]
# check sums against day.md
ps = [(d[2], d[3]) for d in D if d[2] is not None]
ap = [(d[4], d[5]) for d in D if d[4] is not None]
assert len(ps) == 20 and sum(a for a, b in ps) == 59 and sum(b for a, b in ps) == 24, (len(ps), sum(a for a,b in ps), sum(b for a,b in ps))
assert len(ap) == 30 and sum(a for a, b in ap) == 145 and sum(b for a, b in ap) == 68

def track(b, a, mx, width):
    if b is None and a is None:
        return f'<span style="font-size: 13px; font-weight: 600; color: {FAINT}">—</span>'
    pos = lambda v: round(v / mx * 100, 2)
    dots = ''
    same = (b == a)
    if b is not None and a is not None and not same:
        lo, hi = pos(min(a, b)), pos(max(a, b))
        dots += f'<div style="position: absolute; left: {lo}%; width: {round(hi - lo, 2)}%; top: 7px; height: 4px; background: {GOODB}"></div>'
    if b is not None and not same:
        dots += f'<div style="position: absolute; left: {pos(b)}%; top: 3px; width: 12px; height: 12px; margin-left: -6px; border-radius: 99px; background: #B9BFCB"></div>'
    if a is not None:
        col = BAD if same else GOOD
        ring = f'box-shadow: 0 0 0 3px {BADB}; ' if same else ''
        hollow = f'background: #fff; border: 2px dashed {WARN}; ' if b is None else f'background: {col}; '
        dots += f'<div style="position: absolute; left: {pos(a)}%; top: 2px; width: 14px; height: 14px; margin-left: -7px; border-radius: 99px; box-sizing: border-box; {hollow}{ring}"></div>'
    ticks = ''.join(f'<div style="position: absolute; left: {pos(t)}%; top: 6px; width: 1px; height: 6px; background: {DASH}"></div>' for t in range(0, mx + 1))
    bl = '—' if b is None else str(b)
    ac = BAD if same else (WARN if b is None else GOOD)
    return (f'<div style="display: flex; align-items: center; gap: 14px"><div style="position: relative; width: {width}px; height: 18px; flex-shrink: 0"><div style="position: absolute; left: 0; right: 0; top: 8px; height: 2px; background: {LINE}"></div>{ticks}{dots}</div>'
            f'<span style="font-family: {MONO}; font-size: 13px; font-weight: 600; color: {SOFT}; white-space: nowrap">{bl} → <span style="color: {ac}">{a}</span></span></div>')

DCOLS = '64px minmax(0, 1fr) 236px 300px'
def drow(d):
    id, name, pb, pa, ab, aa, flag = d
    chip_bg = WARN if flag == 'np' else NAVY
    extra = ''
    if flag == 'np': extra = f'<span style="height: 20px; padding: 0 7px; border-radius: 999px; background: {WARNB}; color: {WARNI}; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center">not today</span>'
    if flag == 'slide': extra = f'<span style="height: 20px; padding: 0 7px; border-radius: 999px; background: {BADB}; color: {BAD}; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center">slide · keep → 1</span>'
    if flag == 'under': extra = f'<span style="font-family: {MONO}; font-size: 12px; color: {FAINT}">as D-1 · D-2 · D-12</span>'
    return (f'<div style="display: grid; grid-template-columns: {DCOLS}; gap: 14px; align-items: center; min-height: 29px; border-top: 1px solid {LINE}">'
            f'<span style="font-family: {MONO}; font-size: 12px; font-weight: 600; color: #fff; background: {chip_bg}; height: 22px; padding: 0 7px; border-radius: 99px; display: inline-flex; align-items: center; justify-self: start">{id}</span>'
            f'<div style="display: flex; align-items: center; gap: 8px; min-width: 0"><span style="font-size: 13px; font-weight: 700; white-space: nowrap">{e(name)}</span>{extra}</div>'
            f'{track(pb, pa, 5, 130)}{track(ab, aa, 8, 190)}</div>')
dh = (f'<div style="display: grid; grid-template-columns: {DCOLS}; gap: 14px; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: {SOFT}; padding-bottom: 4px">'
      '<span></span><span>Decision</span><span>From the push · 0–5</span><span>From the app · 0–8</span></div>')
colA = ''.join(drow(d) for d in D[:17]); colB = ''.join(drow(d) for d in D[17:])
def tot(label, pb, pa, ab, aa):
    return (f'<div style="display: grid; grid-template-columns: {DCOLS}; gap: 14px; align-items: center; min-height: 40px; border-top: 2px solid {NAVY}">'
            f'<span></span><span style="font-size: 14px; font-weight: 800">{e(label)}</span>'
            f'<span style="font-family: {MONO}; font-size: 15px; font-weight: 600; color: {SOFT}">{pb} → <span style="color: {GOOD}">{pa}</span></span>'
            f'<span style="font-family: {MONO}; font-size: 15px; font-weight: 600; color: {SOFT}">{ab} → <span style="color: {GOOD}">{aa}</span></span></div>')
legend = (f'<div style="display: flex; gap: 20px; align-items: center; font-size: 13px; font-weight: 600; color: {SOFT}">'
          f'<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 12px; height: 12px; border-radius: 99px; background: #B9BFCB"></span>before</span>'
          f'<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 14px; height: 14px; border-radius: 99px; background: {GOOD}"></span>after</span>'
          f'<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 14px; height: 14px; border-radius: 99px; background: {BAD}; box-shadow: 0 0 0 3px {BADB}"></span>no drop</span>'
          f'<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 14px; height: 14px; border-radius: 99px; border: 2px dashed {WARN}; box-sizing: border-box"></span>new path</span></div>')
per = card(f'<div style="display: flex; align-items: baseline; justify-content: space-between"><span style="font-size: 20px; font-weight: 800">Every decision · taps before → after</span>{legend}</div>'
           + f'<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0 40px"><div style="display: flex; flex-direction: column">{dh}{colA}</div>'
           + f'<div style="display: flex; flex-direction: column">{dh}{colB}{tot("Sum", "59", "24", "145", "68")}'
           + f'<div style="font-family: {MONO}; font-size: 12px; color: {SOFT}; padding-top: 6px">push: the 20 with a push today · app: the 30 possible today</div></div></div>')

# ---------- bottom three ----------
def lst(items, kind):
    out = ''
    for it in items:
        if kind == 'gone':
            ic = f'<span style="width: 26px; height: 26px; border-radius: 99px; background: {BADB}; color: {BAD}; display: flex; align-items: center; justify-content: center; flex-shrink: 0">{svg("x", 14, 2.5)}</span>'
            tx = f'<span style="font-size: 13px; font-weight: 600; text-decoration: line-through; color: {SOFT}">{e(it)}</span>'
        else:
            ic = f'<span style="width: 26px; height: 26px; border-radius: 99px; background: {GOODB}; color: {GOOD}; display: flex; align-items: center; justify-content: center; flex-shrink: 0">{svg("check", 14, 2.5)}</span>'
            tx = f'<span style="font-size: 13px; font-weight: 600">{e(it)}</span>'
        out += f'<div style="display: flex; align-items: center; gap: 10px; min-height: 31px; border-top: 1px solid {LINE}">{ic}{tx}</div>'
    return out
gone = ['A page opened to press one button', '4 pushes that open Today, not the ask', 'Six tiles as doors · the list as a step', 'Back to the next row', 'Keep held · Old bill first', 'Limit → terms → go', 'Set price → steppers → Use this', 'Seen on a yard note', 'Tell Grace after a customer edit', 'WhatsApp for a nudge']
auto = ['Bills itself 24 h after delivery · no push', 'Goals end on their day · one suggested each', 'The asker told in their own words', 'Price push only when the price moved', 'Taken twice: through cancel_order, all told', 'A note closes with its check-in', 'The next decision comes by itself']
SL = [('D-16', 'Written off · 102,000', 'Kept on the shelf', '2 → 2', '— → 1', 'MK'),
      ('D-18', 'Credit note raised · 56,250', 'Kept as sold', '2 → 2', '2 → 1', 'BO'),
      ('D-19', 'Voided', 'Kept as billed', '2 → 2', '2 → 1', 'EA')]
srows = ''
for id, slide, keep, p, k, who in SL:
    srows += (f'<div style="display: flex; flex-direction: column; gap: 6px; border-top: 1px solid {LINE}; padding: 10px 0">'
              f'<div style="display: flex; align-items: center; gap: 10px"><span style="font-family: {MONO}; font-size: 12px; font-weight: 600; color: #fff; background: {NAVY}; height: 22px; padding: 0 7px; border-radius: 99px; display: inline-flex; align-items: center">{id}</span>{av(who, 24)}{pill(slide, "slide")}</div>'
              f'<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-family: {MONO}; font-size: 13px; font-weight: 600; color: {SOFT}">'
              f'<span>push <span style="color: {BAD}">{p}</span></span><span>{e(keep)} <span style="color: {GOOD}">{k}</span></span></div></div>')
stays = (f'<div style="display: flex; align-items: baseline; justify-content: space-between"><span style="font-size: 17px; font-weight: 700">Stays a slide · no drop from the push</span><span style="font-family: {MONO}; font-size: 13px; color: {SOFT}">3 of 20</span></div>'
         + srows
         + f'<div style="display: flex; flex-wrap: wrap; gap: 6px; padding-top: 4px"><span style="font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: {SOFT}; width: 100%">never a notification action</span>'
         + ''.join(f'<span style="height: 26px; padding: 0 10px; border-radius: 999px; background: {TILE}; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center">{w}</span>' for w in ['write-off','credit note','void','refund','stock take','merge','opening balance','cancel'])
         + '</div>')
SEC = [('Price set · another figure', '5 → 3'), ('Bill it all', '3 → 2'), ('Cash first · from the app', '3 → 2'), ('Check-in with Denis’s note', '3 → 1'), ('Cancel with money', '5 → 3'), ('Void with money · push', '4 → 3'), ('Give it to Moses · a stuck order', '4 → 2')]
second = (f'<span style="font-size: 17px; font-weight: 700">Second choices also drop</span>'
          + ''.join(f'<div style="display: flex; align-items: center; justify-content: space-between; min-height: 36px; border-top: 1px solid {LINE}"><span style="font-size: 13px; font-weight: 600">{e(n)}</span><span style="font-family: {MONO}; font-size: 14px; font-weight: 600; color: {SOFT}">{t.split(" → ")[0]} → <span style="color: {GOOD}">{t.split(" → ")[1]}</span></span></div>' for n, t in SEC))
bottom = (f'<div style="display: grid; grid-template-columns: 1fr 1fr 1.15fr 0.9fr; gap: 24px">'
          + card(f'<div style="display: flex; justify-content: space-between; align-items: baseline"><span style="font-size: 17px; font-weight: 700">Gone</span><span style="font-family: {MONO}; font-size: 13px; color: {SOFT}">{len(gone)}</span></div>' + lst(gone, 'gone'))
          + card(f'<div style="display: flex; justify-content: space-between; align-items: baseline"><span style="font-size: 17px; font-weight: 700">The app does it</span><span style="font-family: {MONO}; font-size: 13px; color: {SOFT}">{len(auto)}</span></div>' + lst(auto, 'auto'))
          + card(stays) + card(second) + '</div>')

doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Manager's day</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&amp;family=IBM+Plex+Mono:wght@500;600&amp;display=swap">
<style>body{{margin:0}} a{{color:#16203C}}a:hover{{color:#C93A30}}</style>
</helmet>
<div style="width: {W}px; height: {H}px; box-sizing: border-box; background: {BG}; font-family: Figtree, system-ui, sans-serif; color: {INK}; display: flex; flex-direction: column; overflow: hidden">
{hero}
<div style="padding: 20px 40px 32px; display: flex; flex-direction: column; gap: 20px">
<div style="display: flex; gap: 24px; align-items: stretch">{queue}{watch}</div>
{path}
{per}
{bottom}
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{W},"height":{H}}}}}'>
class Component extends DCLogic {{ renderVals() {{ return {{}}; }} }}
</script>
</body>
</html>
'''
open(OUT, 'w').write(doc)
print('ok', len(doc), 'queue', sab, saa, spb, spa)
