# The integration board and the flow board, literal markup, in the agent language.
import os, html
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'root', 'project')
M = "font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;letter-spacing:-.02em"
NAVY='#16203C'; INK='#1C2233'; INK6='#5F6980'; INK4='#6B7480'; RULE='#E6E3DD'; GROUND='#F7F5F2'; TILE='#F1EEE8'
APPS = {  # app: (initials, tint bg, ink, person)
 'Sales':   ('GA','#16203C','#FFFFFF','Grace'),
 'Store':   ('MK','#E8EBF0','#3D4A5C','Musa'),
 'Buyer':   ('DO','#E4E6FA','#3A3F9B','Denis'),
 'Manager': ('RN','#DDF1EE','#0E5E57','Ruth'),
 'Accounts':('EA','#FDEEE1','#7A4A02','Esther'),
 'Sourcing':('ML','#E8EBF0','#3D4A5C','Moses'),
 'Customer':('KC','#DCEAF8','#1A5A8A','Kato'),
 'Agent':   ('PA','#F6E4F1','#7A3268','Agent'),
 'Owner':   ('JM','#F6E4F1','#7A3268','Joseph'),
 'Driver':  ('SS','#E8EBF0','#3D4A5C','Ssali'),
}
def e(s): return html.escape(s, quote=True)
def face(app, size=30):
    i,bg,ink,_ = APPS[app]
    return f'<span style="width:{size}px;height:{size}px;border-radius:999px;background:{bg};color:{ink};font-size:{int(size*.36)}px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none">{i}</span>'
def who(apps):
    return ''.join(f'<span style="display:flex;align-items:center;gap:8px">{face(a)}<span style="display:flex;flex-direction:column"><span style="font-size:13px;font-weight:700">{APPS[a][3]}</span><span style="font-size:11px;color:{INK4}">{a}</span></span></span>' for a in apps)
ARROW = '<svg aria-hidden="true" width="28" height="12" viewBox="0 0 28 12" fill="none" stroke="#9AA1AE" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6h25M21 1l5 5-5 5"/></svg>'
CHIP = {'new':('#DDF1EE','#0E5E57','New push'), 'fix':('#FDEEE1','#7A4A02','Words fixed'), 'keep':('#E4F4EA','#0F6B43','Kept'), 'screen':('#E4E6FA','#3A3F9B','New screen')}
def chip(k): bg,ink,t = CHIP[k]; return f'<span style="height:22px;padding:0 8px;border-radius:999px;background:{bg};color:{ink};font-size:11px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap">{t}</span>'

PHASES = [
 ('1 · The order comes in', '#16203C', [
  ('Sales','Store','#0556 placed straight into Packing','order.pick · "New to pack · #0556 Nansana · they collect" → every yard phone, on insert and update','Packing · Musa','To pack · From Grace · #0556','IM-10, IM-09',['new','fix'],'PK01ToPack'),
  ('Manager','Store','Ruth gives the order to a packer','order.pick · "Ruth gave you #0552 · Kato" → that packer','With Musa','For you · Ruth gave it','IM-08',['new'],'PK08ForYou'),
  ('Sales','Store','Where · when · phone','order.pick carries it · "New to pack · #0552 Kato · Ntinda · today afternoon" · deliverTo passed to the yard','Ntinda site · today afternoon · 0772 418 220','Ntinda site · today afternoon · 0772 418 220','IM-01, IM-02',['fix'],'PK02Pack'),
  ('Manager','Store','Ruth cancels an order','order.cancelled · "#0550 cancelled · put it back" → whoever holds it: packer, bay, driver','Cancelled','Cancelled · put it back','IM-11, IM-39',['new','screen'],'PK10CalledOff'),
 ]),
 ('2 · Goods come in', '#3A3F9B', [
  ('Buyer','Store','Denis hands in a trip','trip.back · "Denis\'s trip is at the gate · 4 lines" → the yard','At the gate · Musa checks it in','At the gate · Check in Denis\'s trip','IM-25',['fix'],'IN02Checkin'),
  ('Store','Manager','The check-in differs from Denis\'s count','trip.difference · "Musa\'s check-in of Denis\'s trip · 1 differs" → Ruth; her answer → Musa','Seen','Sent to Ruth · 1 differs → Ruth saw it','IM-23, IM-24',['new','fix'],'IN06CheckedIn'),
  ('Store','Sales','Orders now whole move to Packing','order.pick to the yard; the salesperson sees the stage move','Packing · Musa','To pack','—',['keep'],'IN06CheckedIn'),
  ('Store','Manager','Goods on the truck not on the list','store.extra · "Not on the list · keep it?" → Ruth (a screen in her app)','Keep it · Send it back','Not on the list · Ruth decides','IM-17',['screen'],'IN04CheckinExtra'),
  ('Store','Sourcing','A new item at the gate','store.new_item · "A new item at the yard" → Moses (a screen in his app)','New item · list it','Not on the list · Moses lists it','IM-19',['screen'],'IN04CheckinExtra'),
  ('Store','Buyer','We need more','store.restock · "More wanted on the shelf · Gloss paint" → Denis; answer back','On the restock list · next trip','We need more · Denis: next trip','—',['keep'],'SH31AskSent'),
 ]),
 ('3 · Packing', '#8DA2D6', [
  ('Store','Manager','A line packed short','pick.short · "#0552 · 1 short · settle it" → Ruth; settled → the packer and Grace','Bill what went · Bill all','Pack short · Ruth settles','IM-37',['new'],'PK05PackShortSent'),
  ('Store','Sales','Packed (we deliver)','order.packed · "Kato\'s #0552 is packed · bay 2" → Grace','Packed · bay 2','Packed · bay 2 · Grace sees: Packed','IM-05, IM-28',['new'],'PK06Packed'),
  ('Store','Sales','Packed, they collect','order.ready · "#0556 ready to collect · bay 3" → Grace, the agent, the customer','Ready to collect','Ready to collect · at the gate','IM-03, IM-04',['new','fix'],'PK07PackedPickup'),
  ('Store','Sales','Packed but not paid yet','order.unpaid · "Kato\'s #0552 is packed · take the money" → Grace; credit.ask → Ruth','Not paid yet · Take payment','Not paid yet · Grace takes it · Ruth may let it go','IM-07, IM-35',['new','fix'],'OU01ToLoad'),
 ]),
 ('4 · Out of the gate', '#6FDCB0', [
  ('Store','Sales','Loaded on the truck','order.out · "#0552 on the road · Ssali" → Grace, the customer, the agent','On the road · Ssali','On the road · Ssali','IM-27',['new'],'OU05Loaded'),
  ('Store','Manager','Delivered at the door','order.delivered → Ruth and Grace · the bill goes by itself after 24 h (order.invoiced → Esther, Grace)','Delivered 14:05 · at the door','Delivered 14:05 · photo','IM-30, IM-33',['new'],'OU22Delivered'),
  ('Store','Sales','Collected at the gate','order.delivered → Grace, the agent · "#0555 collected 10:47"','Delivered · collected','Delivered · collected','IM-06, IM-31',['fix'],'OU12HandedOver'),
  ('Store','Manager','Can\'t deliver · bring it back','order.back · "#0547 coming back · Ggaba closed" → Ruth and Faith','Coming back','Bring it back','§4.4',['new','screen'],'OU24CantDeliver'),
  ('Manager','Store','Ruth marks a stage herself','order.moved · "Ruth marked #0538 delivered · Fri" → the yard','Mark done','Ruth marked it delivered','IM-29',['new'],'TD10Alerts'),
 ]),
 ('5 · Stock and books agree', '#F5B26B', [
  ('Store','Manager','A count (blind)','stock.count → Ruth only (the owner gets the log); accepted / count again → the counter','Accept · Ask again (the shelf, not the books)','Sent to Ruth → Ruth accepted / Count it again','IM-20, IM-21, IM-22',['new','fix'],'SH12CountSent'),
  ('Store','Manager','Damaged, lost or stolen','stock.report → Ruth; stock.report.decided → the reporter','Write off · Keep it','Sent to Ruth → Ruth wrote it off','—',['keep'],'SH21ReportSent'),
  ('Sales','Store','A return asked','invoice.ask (Sales) → Ruth; return.coming · "#0548 coming back · 2 bag" → the yard','Return asked','Coming back · #0548 · 2 bag','IM-15',['new'],'IN01ComingIn'),
  ('Store','Manager','The return at the gate','invoice.ask → Ruth with Good / Damaged per line; decided → the yard and Grace','Credit note · per line good or damaged','Send to Ruth → Ruth took it back','IM-12, IM-13, IM-14',['new','fix'],'IN22ReturnDecided'),
  ('Store','Store','Pass the yard','store.handover · "Musa passed you the yard" → the colleague','Musa passed you the yard · I\'ve got it','Pass the yard · Okello has it','IM-34',['fix'],'TD13PassYard'),
  ('Store','Manager','Close the yard','store.closed → Ruth (a log line) · the owner\'s log','The yard is closed','Close the yard','IM-18',['fix'],'TD16CloseYard'),
 ]),
]
W = 1440
def row(r, last):
    frm,to,what,push,there,here,ims,chips,board = r
    b = '' if last else f'border-bottom:1px solid #EFECE6;'
    return (f'<div style="display:grid;grid-template-columns:220px 235px 280px 165px 165px 139px;gap:0 20px;align-items:center;padding:14px 20px;{b}">'
            f'<span style="display:flex;align-items:center;gap:8px">{who([frm])}{ARROW}{who([to])}</span>'
            f'<span style="font-size:14px;font-weight:700;line-height:1.3">{e(what)}<br><a href="{board}.dc.html" style="font-size:11px;font-weight:600;color:#3A3F9B;{M}">{board} →</a></span>'
            f'<span style="font-size:12px;color:{INK6};line-height:1.4"><span style="{M};font-weight:600;color:{INK}">{e(push.split(" ")[0])}</span>{e(push[len(push.split(" ")[0]):])}</span>'
            f'<span style="font-size:12px;line-height:1.35"><span style="display:block;font-size:10px;font-weight:700;letter-spacing:.08em;color:{INK4}">{"THE COLLEAGUE" if to==frm else e(APPS[to if frm=="Store" else frm][3].upper())} SEES</span><span style="font-weight:600">{e(there)}</span></span>'
            f'<span style="font-size:12px;line-height:1.35"><span style="display:block;font-size:10px;font-weight:700;letter-spacing:.08em;color:{INK4}">THE YARD SEES</span><span style="font-weight:600">{e(here)}</span></span>'
            f'<span style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">{"".join(chip(c) for c in chips)}<span style="font-size:11px;color:{INK4};{M}">{e(ims)}</span></span></div>')

def shell(title, w, h, inner):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0}}
a{{color:inherit;text-decoration:none}}a:hover{{color:inherit}}
</style>
</helmet>
<div style="width: {w}px; height: {h}px; position: relative; overflow: hidden; background: {GROUND}; font-family: Figtree, system-ui, sans-serif; color: {INK}">
{inner}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
  renderVals() {{
    return {{}};
  }}
}}
</script>
</body>
</html>
'''
# ---- IB01
stages = ['Checking','Buying','Packing','On the road','Delivered']
ribbon = ''.join(f'<span style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px"><span style="width:36px;height:36px;border-radius:999px;background:{"#9BA3F0" if s=="Packing" else "rgba(255,255,255,.08)"};color:{NAVY if s=="Packing" else "#B3BCD2"};box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;{M}">{k+1}</span><span style="font-size:13px;font-weight:600;color:{"#FFFFFF" if s in ("Packing","On the road","Delivered") else "#8D99B5"}">{s}</span></span>' for k,s in enumerate(stages))
yard = '<span style="position:absolute;left:40%;right:0;top:-6px;bottom:-6px;border-radius:16px;box-shadow:inset 0 0 0 1.5px rgba(111,220,176,.55)"></span><span style="position:absolute;left:calc(40% + 14px);bottom:-30px;font-size:11px;font-weight:700;letter-spacing:.1em;color:#6FDCB0">THE YARD\'S PART</span>'
head = (f'<div style="background:{NAVY};color:#fff;padding:40px 48px 48px;display:flex;flex-direction:column;gap:24px">'
        f'<div style="display:flex;align-items:flex-end;gap:24px"><span style="flex:1;display:flex;flex-direction:column;gap:6px"><span style="font-size:13px;font-weight:700;letter-spacing:.12em;color:#8D99B5">INTEGRATION · EVERY HANDOVER</span>'
        f'<span style="font-size:38px;font-weight:700;letter-spacing:-.02em">The Store and every app, one flow</span>'
        f'<span style="font-size:15px;color:#B3BCD2">Each handover: who sends it, the push and who gets it, the words the other app shows, the words the yard shows. The same order, the same moment: Sat 17 Oct · 10:41.</span></span>'
        f'<span style="display:flex;gap:10px">{"".join(f"<span style=\"display:flex;flex-direction:column;align-items:center;gap:4px\">{face(a,40)}<span style=\"font-size:11px;color:#B3BCD2\">{a}</span></span>" for a in ["Sales","Buyer","Manager","Store","Accounts","Sourcing","Agent","Owner"])}</span></div>'
        f'<div style="position:relative;display:flex;padding:8px 0 0">{yard}{ribbon}</div></div>')
legend = (f'<div style="display:flex;gap:18px;align-items:center;padding:18px 48px;font-size:12px;color:{INK6}">'
          f'{chip("new")} a push the yard sends or gets that did not exist {chip("screen")} a screen the other app needs {chip("fix")} the two apps now use one word {chip("keep")} already right · IM-nn = docs/audit/store/INTEGRATION.md</div>')
cols = ''.join(f'<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:{INK4}">{c}</span>' for c in ['FROM → TO','THE HANDOVER · ITS BOARD','PUSH · TO WHOM','THE OTHER APP','THE YARD','CLOSES'])
body = ''
for title, color, rows in PHASES:
    body += (f'<div style="margin:0 48px 22px;background:#fff;border:1px solid {RULE};border-radius:20px;overflow:hidden">'
             f'<div style="display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid {RULE}"><i style="width:10px;height:10px;border-radius:999px;background:{color}"></i><span style="font-size:17px;font-weight:700">{title}</span><span style="font-size:13px;color:{INK4};{M}">{len(rows)}</span></div>'
             f'<div style="display:grid;grid-template-columns:220px 235px 280px 165px 165px 139px;gap:0 20px;padding:10px 20px;background:{GROUND}">{cols}</div>'
             + ''.join(row(r, i==len(rows)-1) for i,r in enumerate(rows)) + '</div>')
n = sum(len(r) for _,_,r in PHASES)
foot = (f'<div style="margin:6px 48px 0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">'
        + ''.join(f'<div style="background:#fff;border:1px solid {RULE};border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:4px"><span style="font-size:30px;font-weight:600;{M}">{v}</span><span style="font-size:13px;color:{INK6}">{t}</span></div>'
                  for v,t in [(n,'handovers, every one with a push'),(sum(1 for _,_,rs in PHASES for r in rs if 'new' in r[7]),'pushes that did not exist'),(sum(1 for _,_,rs in PHASES for r in rs if 'fix' in r[7]),'handovers now in one word'),(sum(1 for _,_,rs in PHASES for r in rs if 'screen' in r[7]),'screens other apps need')]) + '</div>')
h = 330 + 70 + sum(112 + len(r)*72 for _,_,r in PHASES) + 150
open(os.path.join(OUT,'IB01Handovers.dc.html'),'w').write(shell('Every handover', W, h, head+legend+body+foot))
print('IB01', h, n)
