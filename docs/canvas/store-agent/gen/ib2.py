import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ib import shell, e, M, NAVY, INK, INK6, INK4, RULE, GROUND, face, OUT
COLS = ['Sales','Agent · Client','Store','Manager','Owner','Console']
# state, the shared word, per app: (word, old-or-None)
ROWS = [
 ('Checking','draft',['Checking',None],['Checking · With the shop',None],['Checking · look only',None],['Checking',None],['Checking',None],['Checking','Step 1. Draft']),
 ('Buying','awaiting_goods',['Buying · 1 of 2 came',None],['Buying · Getting your goods','Packing'],['Waiting on goods · Coming in',None],['Buying',None],['Buying',None],['Buying','Awaiting Goods']),
 ('Packing · to pack','preparing',['Packing · Musa',None],['Packing · Being packed',None],['To pack',None],['Packing · nobody has it',None],['Packing',None],['Packing','Being Prepared']),
 ('Packing · given to a packer','awaiting_accept',['Packing · Musa',None],['Packing · Being packed',None],['For you · Ruth gave it','To pack (no such state)'],['With Musa',None],['Packing',None],['Packing','Being picked']),
 ('Packed (we deliver)','done',['Packed · bay 2','Musa packing'],['Packed',"Being packed"],['Packed · To load',None],['Packed','stuck after 120 min'],['Packed','stuck'],['Packed','Being Prepared']),
 ('Not paid yet','money hold',['Not paid yet · Take payment','nothing in Packing'],['Not paid yet · Pay shop',None],['Not paid yet',None],['Not paid yet · let it go?','cash customer'],['Not paid yet',None],['Not paid yet',None]),
 ('Ready to collect','pending_delivery · pickup',['Ready to collect · bay 3','never reached'],['Ready · at the shop','never reached'],['Ready to collect','Packing · at the gate'],['Ready to collect',None],['Ready to collect','On road'],['Ready to collect','Being Prepared']),
 ('On the road','pending_delivery',['On the road · Ssali',None],['On the road · Ssali','On the way'],['On the road',None],['On the road','On road'],['On the road','On road'],['On the road','Pending Delivery']),
 ('Delivered · at the door','completed',['Delivered 14:05 · photo',None],['Delivered',None],['Delivered · photo',None],['Delivered',None],['Done today',None],['Delivered','Completed']),
 ('Delivered · collected','completed · gate',['Delivered · collected 10:47','At the door'],['Done · Collected',None],['Delivered · collected',None],['Delivered · collected',None],['Done today',None],['Delivered · collected','Completed']),
 ('Cancelled','cancelled',['Cancelled',None],['Cancelled',None],['Cancelled · put it back','called off · packer only'],['Cancelled',None],['in the log',None],['Cancelled',None]),
]
def cell(c):
    w, old = c
    o = f'<span style="font-size:11px;color:#A82D24;text-decoration:line-through;{"" }">{e(old)}</span>' if old else ''
    bg = 'background:#FEF8F2;box-shadow:inset 0 0 0 1px #F5D3AE;' if old else ''
    return f'<span style="display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:12px;{bg}">{o}<span style="font-size:13px;font-weight:600">{e(w)}</span></span>'
W=1440
head = (f'<div style="background:{NAVY};color:#fff;padding:40px 48px 32px;display:flex;flex-direction:column;gap:6px">'
        f'<span style="font-size:13px;font-weight:700;letter-spacing:.12em;color:#8D99B5">INTEGRATION · ONE WORD PER STATE</span>'
        f'<span style="font-size:38px;font-weight:700;letter-spacing:-.02em">The same order, the same word, in every app</span>'
        f'<span style="font-size:15px;color:#B3BCD2">Each row is one state of an order in the database. Each cell is what that app shows after the redesign. A tinted cell changed: the old word is struck through above it. Words follow docs/audit/GLOSSARY.md.</span></div>')
grid = 'grid-template-columns:200px repeat(6,minmax(0,1fr))'
colh = ''.join(f'<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:{INK4};padding:0 12px">{c.upper()}</span>' for c in ['State']+COLS)
rows=''
for i,r in enumerate(ROWS):
    st, db, *cells = r
    b = '' if i==len(ROWS)-1 else 'border-bottom:1px solid #EFECE6;'
    rows += (f'<div style="display:grid;{grid};gap:0 8px;align-items:center;padding:8px 20px;{b}">'
             f'<span style="display:flex;flex-direction:column;gap:2px;padding:0 12px"><span style="font-size:14px;font-weight:700">{e(st)}</span><span style="font-size:11px;color:{INK4};{M}">{e(db)}</span></span>'
             + ''.join(cell(c) for c in cells) + '</div>')
changed = sum(1 for r in ROWS for c in r[2:] if c[1])
table = (f'<div style="margin:24px 48px;background:#fff;border:1px solid {RULE};border-radius:20px;overflow:hidden">'
         f'<div style="display:grid;{grid};gap:0 8px;padding:12px 20px;background:{GROUND};border-bottom:1px solid {RULE}">{colh}</div>{rows}</div>')
foot = (f'<div style="margin:0 48px;display:flex;gap:12px">'
        + ''.join(f'<div style="flex:1;background:#fff;border:1px solid {RULE};border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:4px"><span style="font-size:30px;font-weight:600;{M}">{v}</span><span style="font-size:13px;color:{INK6}">{t}</span></div>'
                  for v,t in [(len(ROWS),'states, one word each'),(changed,'cells that change (the other apps\' list: docs/audit/store/OTHER-APPS.md)'),(5,'shared stages: Checking · Buying · Packing · On the road · Delivered')]) + '</div>')
h = 190 + 24 + 44 + len(ROWS)*74 + 24 + 110 + 10
open(os.path.join(OUT,'IB02StateWords.dc.html'),'w').write(shell('One word per state', W, h, head+table+foot))
print('IB02', h, changed)
