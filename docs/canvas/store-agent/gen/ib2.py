# IB02: one word per order state, in every app. A tinted cell changes: the old word is struck above it.
# Store words come from the approved Store boards; Sales words from the approved Sales boards;
# the others from docs/audit/store/OTHER-APPS.md (which lists every change).
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ib import shell, fit, e, M, NAVY, INK, INK6, INK4, RULE, GROUND, TILE, OUT, face
COLS = [('Sales','GA'),('Agent','PS'),('Client','KC'),('Store','MK'),('Manager','RN'),('Accounts','EA'),('Owner','JM'),('Console','CS')]
STAGE = {'Checking':'#9AA1AE','Buying':'#3A3F9B','Packing':'#5B6BD0','On the road':'#0F6B43','Delivered':'#0E5E57','Cancelled':'#A82D24'}
N = None
# (stage, state, db, Sales, Agent, Client, Store, Manager, Accounts, Owner, Console, where the Store word is drawn)
ROWS = [
 ('Checking','Checking','draft', ('Checking',N),('Checking',N),('With the shop',N),('Checking · look only',N),('Checking',N),('—',N),('Checking',N),('Checking','Step 1. Draft'),'PK09 (look only)'),
 ('Buying','Buying','awaiting_goods', ('Buying · 1 of 2 came',N),('Buying · getting your goods','Packing'),('Getting your goods',N),('Waiting on goods · Denis is buying',N),('Buying',N),('—',N),('Buying',N),('Buying','Step 2. Awaiting Goods'),'PK01 · PK21'),
 ('Packing','To pack','preparing · nobody', ('Packing','Store packing'),('Being packed now',N),('Being prepared',N),('To pack',N),('Packing · nobody has it',N),('—',N),('Packing',N),('Packing','Step 3. Being Prepared'),'PK01'),
 ('Packing','Given to a packer','awaiting_accept', ('Packing','Joy packing'),('Being packed now','Joy is packing it'),('Being prepared',N),('For you · Ruth\'s pick','To pack'),('With Musa',N),('—',N),('Packing',N),('Packing','Being picked'),'PK08'),
 ('Packing','Packing now','in_progress', ('Packing · Musa',N),('Musa is packing it',N),('Being prepared',N),('Packing now · yours',N),('With Musa',N),('—',N),('Packing',N),('Packing','Being picked'),'PK01 · PK02'),
 ('Packing','Packed · we deliver','done · delivery', ('Packed · bay 1','Musa packing'),('Packed','Joy is packing it'),('Being prepared',N),('Packed · Bay 1',N),('Packed · waits for the truck','stuck after 120 min'),('—',N),('Packed','Packing · stuck'),('Packed','Being Prepared'),'PK06'),
 ('Packing','Not paid yet','done · money hold', ('Not paid yet · Take payment','nothing in Packing'),('Not paid yet','Being packed now'),('Being prepared',N),('Not paid yet',N),('Not paid yet · let it go on credit?','cash customer'),('—',N),('Not paid yet','Packing'),('Not paid yet','Being Prepared'),'PK06 · OU01'),
 ('On the road','Ready to collect','pending_delivery · pickup', ('Ready to collect · at the gate','Musa packing'),('Ready to collect','Being packed now'),('Ready to collect at the shop','It has left the shop'),('Ready to collect · Gate','At the gate · bay B'),('Ready to collect','Packing'),('—',N),('Ready to collect','Packing'),('Ready to collect','Being Prepared'),'PK07 · OU10'),
 ('On the road','On the road · our driver','pending_delivery · staff', ('On the road · Ssali',N),('On the road · Ssali','On the way'),('On the way',N),('On the road · Ssali',N),('On the road','On road'),('—',N),('On the road','On road'),('On the road','Pending Delivery'),'OU05'),
 ('On the road','On the road · hired','pending_delivery · hired', ('On the road · Abudu (hired)','Ready to collect'),('On the road','Out for delivery'),('On the way',N),('On the road · Abudu (hired)',N),('On the road','On road'),('—',N),('On the road','On road'),('On the road','Out'),'OU03'),
 ('On the road','Coming back','pending_delivery · order.back', ('Coming back · Ggaba closed','On the road'),('Coming back to the shop','On the way'),('Coming back to the shop','On the way'),('Coming back · bring it back','no such job'),('Coming back · Ggaba closed','On road'),('—',N),('Coming back','On road'),('Coming back','Pending Delivery'),'OU24'),
 ('Delivered','Delivered · at the door','completed', ('Delivered · At the door 14:05',N),('Delivered','Done · Delivered'),('Delivered',N),('Delivered · at the door',N),('Delivered · photo','Delivered'),('—',N),('Delivered today','Done today'),('Delivered','Step 5. Completed'),'OU22'),
 ('Delivered','Delivered · collected','completed · gate', ('Delivered · collected','At the door'),('Delivered · collected','Done · Collected'),('Delivered',N),('Delivered · collected',N),('Delivered · collected','Delivered'),('—',N),('Delivered today','Done today'),('Delivered · collected','Completed'),'OU11 · OU12'),
 ('Delivered','Counter sale','completed · counter', ('Counter sale',N),('—',N),('—',N),('Counter sale · out','delivered · collected'),('Counter sale','Delivered'),('Counter sale · income','income'),('Counter sale','Done today'),('Counter sale','Completed'),'SH32'),
 ('Delivered','Invoiced','completed · invoiced', ('Bill #0552',N),('Delivered · settle up','Done · Settle up'),('Delivered',N),('The bill goes by itself · off the board',N),('Invoiced',N),('Invoice to send',N),('in the day\'s sales',N),('Delivered · invoiced','Completed'),'OU05 · OU22'),
 ('Cancelled','Cancelled · not left','cancelled', ('Cancelled',N),('Cancelled',N),('Cancelled',N),('Cancelled · put it back','called off · packer only'),('Cancelled',N),('Refund if paid',N),('in the log',N),('Cancelled',N),'PK10'),
 ('Cancelled','Cancelled on the truck','cancelled · on the road', ('Cancelled',N),('Cancelled',N),('Cancelled',N),('Cancelled · bring it back','not told'),('Cancelled',N),('Refund if paid',N),('in the log',N),('Cancelled',N),'OU27'),
]
def cell(c):
    w, old = c
    if w == '—':
        return f'<span style="padding:10px 10px;font-size:13px;color:#B6BCC6">—</span>'
    o = f'<span style="font-size:11px;color:#A82D24;text-decoration:line-through">{e(old)}</span>' if old else ''
    bg = 'background:#FEF8F2;box-shadow:inset 0 0 0 1px #F5D3AE;' if old else ''
    return f'<span style="display:flex;flex-direction:column;gap:2px;padding:8px 10px;border-radius:12px;{bg}">{o}<span style="font-size:13px;font-weight:600;line-height:1.3">{e(w)}</span></span>'
W = 1440
grid = 'grid-template-columns:196px repeat(8,minmax(0,1fr));gap:0 6px'
head = (f'<div style="background:{NAVY};color:#fff;padding:40px 48px 32px;display:flex;align-items:flex-end;gap:24px">'
        f'<span style="flex:1;display:flex;flex-direction:column;gap:6px"><span style="font-size:13px;font-weight:700;letter-spacing:.12em;color:#8D99B5">INTEGRATION · ONE WORD PER STATE</span>'
        f'<span style="font-size:38px;font-weight:700;letter-spacing:-.02em">The same order, the same word, in every app</span>'
        f'<span style="font-size:15px;color:#B3BCD2">One row per state. A tinted cell changes; its old word is struck above it. The five shared stages win.</span></span>'
        f'<span style="display:flex;gap:6px">' + ''.join(f'<span style="height:30px;padding:0 12px;border-radius:999px;background:rgba(255,255,255,.1);display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700"><i style="width:8px;height:8px;border-radius:999px;background:{c};box-shadow:0 0 0 1.5px #fff"></i>{s}</span>' for s, c in STAGE.items() if s != 'Cancelled') + '</span></div>')
colh = (f'<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:{INK4};padding:0 10px;align-self:end">STATE</span>'
        + ''.join(f'<span style="display:flex;align-items:center;gap:6px;padding:0 10px">{face(i, 26, "#FFFFFF" if i=="GA" else None)}<span style="font-size:11px;font-weight:700;letter-spacing:.08em;color:{INK4}">{c.upper()}</span></span>' for c, i in COLS))
rows = ''
prev = None
for k, r in enumerate(ROWS):
    stage, st, db, *cells, where = r
    top = f'border-top:1px solid {RULE};' if prev and prev != stage else ('border-top:1px solid #EFECE6;' if prev else '')
    band = (f'<div style="padding:10px 20px 2px;display:flex;align-items:center;gap:8px;{top}"><i style="width:10px;height:10px;border-radius:999px;background:{STAGE[stage]}"></i>'
            f'<span style="font-size:12px;font-weight:800;letter-spacing:.1em;color:{STAGE[stage]}">{stage.upper()}</span></div>') if stage != prev else ''
    line = '' if stage != prev else 'border-top:1px solid #F3F1EC;'
    rows += band + (f'<div style="display:grid;{grid};align-items:center;padding:4px 20px;{line}">'
             f'<span style="display:flex;flex-direction:column;gap:2px;padding:0 10px"><span style="font-size:14px;font-weight:700">{e(st)}</span><span style="font-size:11px;color:{INK4};{M}">{e(db)}</span>'
             f'<span style="font-size:11px;color:#3A3F9B;{M}">{e(where)}</span></span>'
             + ''.join(cell(c) for c in cells) + '</div>')
    prev = stage
changed = sum(1 for r in ROWS for c in r[3:11] if c[1])
store_ch = sum(1 for r in ROWS if r[6][1])
other_ch = changed - store_ch
table = (f'<div style="margin:24px 48px;background:#fff;border:1px solid {RULE};border-radius:20px;overflow:hidden">'
         f'<div style="display:grid;{grid};padding:12px 20px;background:{GROUND};border-bottom:1px solid {RULE}">{colh}</div>{rows}<div style="height:8px"></div></div>')
legend = (f'<div style="margin:0 48px 16px;display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center;font-size:12px;color:{INK6}">'
          f'<span style="display:inline-flex;flex-direction:column;padding:4px 10px;border-radius:10px;background:#FEF8F2;box-shadow:inset 0 0 0 1px #F5D3AE"><span style="font-size:11px;color:#A82D24;text-decoration:line-through">old word</span><span style="font-size:12px;font-weight:600;color:{INK}">new word</span></span> changes in that app'
          f'<span style="color:#B6BCC6;font-size:14px">—</span> the app never shows this state'
          f'<span style="color:#3A3F9B;{M}">PK06</span> the Store board that draws the yard\'s word'
          f'<span>Client and agent keep softer words, mapped to the same states</span></div>')
foot = (f'<div style="margin:0 48px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">'
        + ''.join(f'<div style="background:#fff;border:1px solid {RULE};border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:4px"><span style="font-size:30px;font-weight:600;{M}">{v}</span><span style="font-size:13px;color:{INK6}">{t}</span></div>'
                  for v, t in [(len(ROWS), 'states, one word each'), (other_ch, 'cells that change in other apps, each listed in docs/audit/store/OTHER-APPS.md'), (store_ch, 'cells that change in the Store itself (the Store session builds them)'), (5, 'shared stages: Checking · Buying · Packing · On the road · Delivered')]) + '</div>')
if __name__ == '__main__':
    h = fit(os.path.join(OUT, 'IB02StateWords.dc.html'), head + table + legend + foot, W, 'One word per state')
    print('IB02', h, other_ch, store_ch)
