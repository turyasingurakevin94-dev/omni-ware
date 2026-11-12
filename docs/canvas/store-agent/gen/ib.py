# The integration board (IB01): every handover between the yard and another app,
# its push (kind + who gets it) and the words both apps show, keyed to the order's stage.
# Words are taken from the approved Store boards (SX/root/project/{TD,PK,IN,SH,OU}*) and,
# for the other app, the approved Sales boards or docs/audit/store/OTHER-APPS.md.
import os, sys, html, json, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
SX = os.path.join(HERE, '..')
OUT = os.path.join(SX, 'root', 'project')
M = "font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;letter-spacing:-.02em"
NAVY='#16203C'; INK='#1C2233'; INK6='#5F6980'; INK4='#6B7480'; RULE='#E6E3DD'; GROUND='#F7F5F2'; TILE='#F1EEE8'
# people: initials -> (bg, ink, name, app)
P = {
 'GA': ('#16203C','#FFFFFF','Grace','Sales'),
 'BO': ('#E4E6FA','#3A3F9B','Brian','Sales'),
 'FN': ('#F6E4F1','#7A3268','Faith','Sales'),
 'MK': ('#E8EBF0','#3D4A5C','Musa','Store'),
 'OP': ('#DCEAF8','#1A5A8A','Okello','Store'),
 'YD': ('#E8EBF0','#3D4A5C','The yard','Store'),
 'SS': ('#E8EBF0','#3D4A5C','Ssali','Driver'),
 'DO': ('#E4E6FA','#3A3F9B','Denis','Buyer'),
 'RN': ('#DDF1EE','#0E5E57','Ruth','Manager'),
 'EA': ('#FDEEE1','#7A4A02','Esther','Accounts'),
 'ML': ('#E8EBF0','#3D4A5C','Moses','Sourcing'),
 'PS': ('#DDF1F0','#0E6A6A','Peter','Agent'),
 'KC': ('#DCEAF8','#1A5A8A','Kato','Customer'),
 'JM': ('#F1EEE8','#5F6980','Joseph','Owner'),
 'CS': ('#F1EEE8','#5F6980','Console','Console'),
 'WK': ('#F1EEE8','#5F6980','Worker app','Worker'),
}
def e(s): return html.escape(s, quote=True)
YARD_SVG = '<svg aria-hidden="true" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="#3D4A5C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-6 9 6v10H3z"/><path d="M9 20v-6h6v6"/></svg>'
def face(ini, size=30, ring=None):
    bg, ink, _, _ = P[ini]
    sh = f'box-shadow:0 0 0 2px {ring};' if ring else ''
    inner = YARD_SVG.format(s=int(size*.5)) if ini == 'YD' else ini
    return (f'<span style="width:{size}px;height:{size}px;border-radius:999px;background:{bg};color:{ink};{sh}'
            f'font-size:{max(11,int(size*.38))}px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none">{inner}</span>')
def stack(inis, size=26, ring='#FFFFFF'):
    return ('<span style="display:flex;align-items:center">' + ''.join(
        f'<span style="margin-left:{0 if i==0 else 3}px;display:flex">{face(x, size, ring)}</span>' for i, x in enumerate(inis)) + '</span>')
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
def fit(path, build, w, title):
    """Write the board at a generous height, measure its content, write it again at that height."""
    open(path, 'w').write(shell(title, w, 9000, build))
    r = subprocess.run(['node', os.path.join(SX, 'tools', 'measure.cjs'), path], capture_output=True, text=True,
                       env={**os.environ, 'NODE_PATH': '/opt/node-tools/node_modules'})
    h = int(r.stdout.strip().split()[-1])
    open(path, 'w').write(shell(title, w, h, build))
    return h

CHIP = {'new':('#DDF1EE','#0E5E57','New push'), 'fix':('#FDEEE1','#7A4A02','Words fixed'),
        'keep':('#E4F4EA','#0F6B43','Kept'), 'screen':('#E4E6FA','#3A3F9B','New screen'),
        'live':('#F1EEE8','#5F6980','Read live'), 'open':('#FBE7E5','#A82D24','Still open')}
def chip(k): bg,ink,t = CHIP[k]; return f'<span style="height:22px;padding:0 8px;border-radius:999px;background:{bg};color:{ink};font-size:11px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap">{t}</span>'
BELL = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16203C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>'
EYE = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7480" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
ARROW = '<svg aria-hidden="true" width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="#9AA1AE" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 5h15M12 1l4 4-4 4"/></svg>'

# One row: f sender, to push recipients, t title, b boards [(file, label)], at the time its board draws,
# kind/say the push (kind None = read live, nobody waits), also more pushes [(kind, say, [who])],
# there [(initials, word)] the other app's words, here the yard's words, im, c chips.
def R(f, to, t, b, at, kind, say, there, here, im, c, also=()):
    return dict(f=f, to=to, t=t, b=b, at=at, kind=kind, say=say, there=there, here=here, im=im, c=c, also=also)
STAGES = ['Checking', 'Buying', 'Packing', 'On the road', 'Delivered']
PHASES = [
 ('1', 'The order reaches the yard', '#16203C', ['Packing'], [
  R('GA',['YD'],'Placed straight into Packing',['PK01ToPack'],'10:02','order.pick','New to pack · #0556 Nansana · they collect · every yard phone, on insert too',
    [('GA','Packing')],'To pack · #0556 · they collect','IM-10 · IM-09',['new','fix']),
  R('RN',['MK'],'Ruth gives it to a packer',['PK08ForYou'],'10:40','order.pick','Ruth gave you #0556 to pack · Musa only',
    [('RN','With Musa')],'For you · Ruth gave you #0556 to pack','IM-08 · IM-09',['new']),
  R('GA',['YD'],'Where · when · phone',['PK02Pack'],'10:05','order.pick','carries deliverTo · deliverWhen · deliverPhone',
    [('GA','Ntinda site · Today afternoon · 0772 418 220')],'Ntinda site · today afternoon · we deliver · 0772 418 220','IM-01 · IM-02',['fix']),
  R('RN',['YD'],'A copy order · don\'t pack it',['PK09LookOnly'],'10:16','order.copy','#0557 is a copy · don\'t pack it',
    [('GA','Packing · copy')],'Look only · the copy of #0556 · Don\'t pack','—',['new']),
  R('RN',['YD','BO'],'Ruth cancels a packed order',['PK10CalledOff'],'10:41 · what-if','order.cancelled','Cancelled · put it back · #0530 · to whoever holds it: packer, bay, driver',
    [('BO','Cancelled')],'#0530 cancelled · put it back · bay 2','IM-11 · IM-39',['new','fix']),
 ]),
 ('2', 'Goods come in', '#3A3F9B', ['Buying'], [
  R('DO',['YD'],'Denis hands in a trip',['IN02Checkin','TD02TodayNextCheckin'],'11:30','trip.back','Denis\'s trip is back at the yard · 3 lines',
    [('DO','Back at the yard · Musa checks it in')],'Check in Denis\'s trip · back at the yard','IM-25 · IM-26',['fix']),
  R('MK',['DO'],'Checked in · Denis is told',['IN02Checkin','IN06CheckedIn'],'11:34','trip.checked','Checked in · Denis\'s trip · 3 lines',
    [('DO','Checked in')],'Checked in · Denis told','IM-25',['new']),
  R('MK',['RN'],'The check-in differs from Denis\'s count',['IN03CheckinShort','IN06CheckedIn'],'11:34','trip.difference','Musa\'s check-in of Denis\'s trip · 2 pc differ',
    [('RN','Musa\'s check-in of Denis\'s trip · decide the 2 pc')],'Sent to Ruth · 1 differs → Ruth decides the 2 pc','IM-23 · IM-24',['new','fix'],
    also=[('trip.difference.decided','Ruth decided the 2 pc',['MK'])]),
  R('MK',['GA','YD'],'Orders now whole move to Packing',['IN06CheckedIn'],'11:34','order.all_in','Ggaba\'s #0549 is all in · Packing · to Grace',
    [('GA','Packing')],'#0549 · pack it now · Packing · Grace told','—',['new'],
    also=[('order.pick','New to pack · #0549 Ggaba',['YD'])]),
  R('MK',['GA'],'A trip line came short',['IN06CheckedIn'],'11:34','trip.short','#0546 Lubowa · 18 of 20 came · pack 18',
    [('GA','Short · 18 of 20')],'#0546 · pack 18 of 20 · Grace told','IM-36',['fix']),
  R('MK',['RN','EA'],'Not on the list',['IN04CheckinExtra','IN13ExtraAnswered'],'11:33 → 11:48','store.extra','Not on the list · Binding wire 20kg · keep it?',
    [('RN','Keep it · the shelf  /  Send it back · Kiseka'),('EA','pays Kiseka for it')],'Not on the list · Ask Ruth → Ruth: keep it','IM-17',['screen'],
    also=[('store.ask.decided','Ruth: keep it · to Musa, Denis and Esther (she pays Kiseka for it)',['MK','DO','EA'])]),
  R('MK',['ML'],'Not one of ours · a new item',['IN04CheckinExtra','SH42FindNone'],'11:33','store.new_item','A new item at the yard · with a photo',
    [('ML','A new item at the yard · list it')],'New item · Moses adds it','IM-19',['screen']),
  R('MK',['ML','EA','RN'],'A supplier\'s delivery checked in',['IN10Delivery','IN11DeliveryDiffers','IN12DeliveryDone'],'12:00 → 12:05','delivery.checked','Hima Cement · 100 bag came in · to Moses; the delivery note to Esther',
    [('ML','Came in · 100 bag · 4 torn'),('EA','the delivery note')],'Checked in · Hima Cement · 100 bag · Ruth decides the 4 torn','—',['new'],
    also=[('stock.report','Hima Cement · 4 torn',['RN'])]),
  R('MK',['DO'],'We need more',['SH30Ask','SH31AskSent','SH32AskAnswered'],'10:41','store.restock','We need more · Gloss paint · about 10 tin',
    [('DO','On the restock list · next trip')],'We need more → Sent to Denis','—',['fix'],
    also=[('store.ask.decided','On the restock list · next trip',['MK'])]),
  R('DO',['MK'],'Denis sends a storekeeper on a trip',['TD03TodayNextRide','IN30Ride','IN32RideDone'],'15:09 → 15:53','trip.sent','Denis sent you · Katwe Timber · 1 line · also trip.taken, trip.cancelled',
    [('DO','Buying · Musa rides it → Handed in')],'Start the trip → Handed in · Okello checks it in','—',['keep'],
    also=[('trip.back','At the hand-in · to Okello, who checks it in blind',['OP'])]),
 ]),
 ('3', 'Packing', '#5B6BD0', ['Packing'], [
  R('MK',['RN','GA'],'A line packed short',['PK04PackShort','PK05PackShortSent'],'10:42','pick.short','#0552 · 1 short · Ruth settles · to Ruth and Grace',
    [('RN','Bill what went  /  Bill the full quantity'),('GA','1 short · Ruth settles')],'Pack short → Sent to Ruth · Grace told','IM-37',['new'],
    also=[('pick.settled','Ruth settled #0552\'s short',['MK','GA'])]),
  R('MK',['GA'],'Packed · we deliver',['PK06Packed'],'10:42','order.packed','Kato\'s #0552 is packed · bay 1',
    [('GA','Packed · bay 1')],'Packed · Bay 1 · Grace sees: Packed','IM-05 · IM-28',['new']),
  R('MK',['GA','RN'],'Packed · not paid yet',['PK06Packed','OU01ToLoad','OU13GateNotPaid'],'10:42 · #0555 10:15','order.unpaid_at_gate','Kato\'s #0552 is packed · take the money · to Grace',
    [('GA','Not paid yet · leaves when paid · Take payment'),('RN','Let it go on credit?')],'Not paid yet · Grace takes the money · Ruth may let it go','IM-07 · IM-35',['new','fix'],
    also=[('credit.ask','Not paid yet · let it go on credit?',['RN'])]),
  R('MK',['PS','GA'],'Packed · they collect',['PK07PackedPickup','OU10Gate'],'10:20 · #0555 10:15','order.ready','#0554 ready to collect · at the gate · code 0554 · to Peter and Grace (a walk-in\'s: Grace and the customer)',
    [('PS','Ready to collect'),('GA','Ready to collect · at the gate')],'Ready to collect · Gate · code 0554','IM-03 · IM-04',['new','fix']),
  R('MK',['GA','BO'],'Unpacked in the yard',['PK15Unpack','AD02Unpack','AD05Unpacked'],'what-if','',"read live · the order's track goes back to Packing, Undo 10 s, so nobody waits",
    [('GA','Packing again'),('BO','Packing again')],'Unpacked · bay free · your ticks stay · To pack','FLOW-02',['live']),
 ]),
 ('4', 'Out of the gate', '#0F6B43', ['On the road', 'Delivered'], [
  R('MK',['GA','KC'],'Loaded · our driver',['OU02Load','OU05Loaded'],'13:20','order.out','#0552 on the road · Ssali · to Grace, Kato (and the agent on an agent\'s order)',
    [('GA','On the road · Ssali · left 13:20'),('KC','On the road · Ssali')],'On the road · Ssali · left 13:20','IM-27',['new']),
  R('MK',['GA','KC'],'Loaded · hired transport',['OU03LoadHired','AD03SomeoneNewFilled'],'13:20 · what-if','order.out','#0552 on the road · Abudu (hired) · someone new gets the same push with his name',
    [('GA','On the road · Abudu (hired)')],'Abudu drives · Abudu gets the drop on WhatsApp','IM-04',['new','fix']),
  R('MK',['GA','RN'],'Collected at the gate',['OU10Gate','OU12HandedOver'],'10:47','order.delivered','#0555 collected 10:47 · to Grace and Ruth',
    [('GA','Delivered · collected')],'Handed over · Delivered · collected 10:47','IM-06',['fix']),
  R('MK',['PS','GA'],'An agent collects with the code',['OU11GateAgent'],'~10:47','order.delivered','#0554 collected · Peter · to Grace and Peter',
    [('PS','Delivered · collected'),('GA','Delivered · collected')],'Peter\'s code · Matches #0554 → Slide to hand over to Peter','IM-03',['new','fix']),
  R('MK',['RN','GA','EA'],'Delivered at the door',['OU21Door','OU22Delivered'],'14:05','order.delivered','#0552 delivered 14:05 · photo · to Ruth and Grace',
    [('GA','Delivered · at the door'),('RN','Delivered · photo')],'Delivered · at the door 14:05 · photo kept','IM-06',['new'],
    also=[('order.invoiced','the bill by itself after 24 h · Sun 14:05',['EA','GA'])]),
  R('MK',['GA','RN'],'Delivered with no photo',['OU23NoPhoto'],'14:05','order.delivered','#0552 delivered · no photo · the reason rides on it',
    [('GA','No photo · Kato said no'),('RN','No photo · Kato said no')],'Slide · Delivered, no photo · Kato said no photo','IM-30',['fix']),
  R('MK',['RN','FN'],'Can\'t deliver · coming back',['OU24CantDeliver'],'what-if','order.back','#0547 coming back · Ggaba closed',
    [('RN','Coming back · Ggaba closed'),('FN','Coming back · Ggaba closed')],'Slide to bring it back · Check it in at the gate','—',['new']),
  R('RN',['SS','YD','GA'],'Cancelled on the truck',['OU27CancelledOnTruck'],'10:38 · what-if','order.cancelled','#0534 cancelled · bring it back · to Ssali, the yard and Grace',
    [('RN','Cancel'),('GA','Cancelled')],'Cancelled · bring it back · Put back at the gate','IM-11',['new']),
  R('RN',['YD'],'Ruth marks a stage herself',['TD10Alerts'],'Fri 15:10','order.moved','Ruth marked #0538 delivered',
    [('RN','Mark done · who delivered it?')],'Ruth marked it delivered · #0538 · Fri 15:10','IM-29',['new']),
  R('GA',['YD'],'A counter sale',['SH32AskAnswered'],'9:12','',"pay and go from the shelf · nothing to pack or hand over, so nobody waits",
    [('GA','Counter sale · pay and go')],'Counter sale · out · today 9:12','IM-31',['live','fix']),
 ]),
 ('5', 'The shelf and the shift', '#B4691C', [], [
  R('MK',['RN'],'A blind count',['SH10Count','SH12CountSent','SH13CountAgain','SH16CountAccepted'],'9:21','stock.count.sent','Your count of Wire nails 4" · 17 ctn · Ruth only; Joseph gets the log',
    [('RN','shelf 18 → counted 17 · Accept the count  /  Count it again')],'Sent to Ruth → Ruth accepted your count  /  Count it again','IM-20 · IM-21 · IM-22',['new','fix'],
    also=[('stock.count.decided','Ruth accepted your count',['MK']),('stock.recount','Ruth asked: count it again',['MK'])]),
  R('MK',['RN'],'Damaged, lost or stolen',['SH20Report','SH21ReportSent','SH22ReportDecided'],'10:41','stock.report','Iron sheet G28 · 3 pc bent · photo',
    [('RN','Write off  /  Keep on the shelf')],'Sent to Ruth → Ruth wrote off 3 pc · bent','—',['keep'],
    also=[('stock.report.decided','Ruth wrote off 3 pc · bent',['MK'])]),
  R('GA',['MK'],'One figure for the shelf',['SH03Item'],'10:41','','one figure, read by both apps · nobody waits',
    [('GA','412 on shelf')],'412 pc on shelf · packed for #0552 · 40','IM-32',['live','fix']),
  R('GA',['YD'],'A return asked',['IN01ComingIn','TD11WithRuth'],'Fri 15:40 → ~11:00','return.coming','#0548 coming back · 2 bag',
    [('GA','Return asked · Ruth checks it')],'Coming back · #0548 · 2 bag · with Ssali ~11:00','IM-15',['new']),
  R('MK',['RN','GA'],'The return at the gate',['IN20Return','IN21ReturnSent','IN22ReturnDecided'],'11:02 → 11:20','invoice.ask','#0548 · 2 bag damaged · photo · Good or Damaged per line',
    [('RN','Not billed yet · settle it once the bill is out · per line Good or Damaged'),('GA','Taken back · 2 bag')],'Send to Ruth → Ruth took it back · put aside','IM-12 · IM-13 · IM-14',['new','fix'],
    also=[('invoice.ask.decided','Ruth took it back · 2 bag',['MK','GA'])]),
  R('MK',['OP'],'Pass the yard',['TD13PassYard','TD14PassYardSent','TD15PassYardGot'],'10:42','store.handover','Musa passed you the yard',
    [('OP','Musa passed you the yard · I\'ve got it')],'Slide to pass to Okello → Okello has it','IM-34',['fix'],
    also=[('store.ask.decided','Okello has it',['MK'])]),
  R('MK',['RN'],'Close the yard',['TD16CloseYard','TD17Closed'],'17:42','store.closed','The yard is closed · a line in Ruth\'s log, nothing to answer',
    [('RN','The yard is closed (her log)')],'Slide to close the yard → In Ruth\'s log','IM-18',['screen']),
 ]),
]
# Handovers in INTEGRATION.md the yard takes no part in (or that a Store board does not draw), and why.
OUT_OF_SCOPE = [
 ('DO',['EA'],'Trip cash','trip.cash','The same hand-in rings Esther. The yard takes no money (IN31: "Esther checks his receipt · no money here").'),
 ('—',['EA'],'Money at the gate or door','none','By design: a yard phone shows no money. "Not paid yet" is a label, never a figure.'),
 ('EA',['EA'],'Esther\'s daily close','none','Hers. The yard\'s close is goods only (TD16).'),
 ('PS',['EA'],'Agent paid on delivery','agent.pay','Between Accounts and the agent. The yard only delivers the order.'),
 ('DO',['RN'],'Buyer\'s yard note','trip.yard_note','Denis\'s own note. The yard\'s reason rides on its check-in (IN03 why chips).'),
 ('DO',['RN'],'A big carton kept off a trip','carton.ask · carton.refused','Denis and Ruth decide. The yard sees only "Waiting on goods · Denis is looking" (PK21).'),
 ('RN',['SS'],'Ruth gives a driver a drop','job.given','The yard chooses the driver (order.load, decision rights). Ruth\'s push goes to the driver; no Store board draws it.'),
 ('RN',['JM'],'The decision log','owner digest 19:00','The owner watches. He gets a log, never a queue (SH12: "Joseph · in the log only").'),
 ('JM',['JM'],'Stage words and stuck clocks','none · reads','The owner reads stages. His words are on IB02.'),
 ('CS',['CS'],'The console checks trips in itself','none','Retired: only the yard checks in. The console shows trips read-only (IM-24).'),
 ('WK',['WK'],'The worker app packs and loads too','notify-worker','Retired for the yard. The Store app replaces it (IM-08).'),
 ('KC',['PS'],'The client and the agent read the stage','none · reads','Their words are on IB02.'),
]
W = 1440
GRID = 'grid-template-columns:128px 250px 290px 450px 136px;gap:0 12px'
def board_links(bs):
    return '<span style="display:flex;flex-wrap:wrap;gap:2px 8px">' + ''.join(
        f'<a href="{b}.dc.html" style="font-size:11px;font-weight:600;color:#3A3F9B;{M}">{b[:4]}</a>' for b in bs) + '</span>'
def word(ini, w):
    bg, ink, name, app = P[ini]
    light = bg if bg != NAVY else '#E9ECF3'
    return (f'<span style="display:flex;align-items:flex-start;gap:7px;padding:7px 10px 7px 7px;border-radius:12px;background:{light if ini!="MK" and ini!="YD" else "#F1F3F6"}">'
            f'{face(ini, 28)}<span style="display:flex;flex-direction:column;gap:1px;min-width:0"><span style="font-size:11px;font-weight:700;letter-spacing:.05em;color:{INK4}">{e(name.upper())} · {e(app.upper())}</span>'
            f'<span style="font-size:12.5px;font-weight:600;line-height:1.3;color:{INK}">{e(w)}</span></span></span>')
def pushcell(r):
    if not r['kind']:
        return (f'<span style="display:flex;flex-direction:column;gap:3px"><span style="display:flex;align-items:center;gap:6px">{EYE}'
                f'<span style="font-size:12px;font-weight:700;color:{INK6}">No push · read live</span></span>'
                f'<span style="font-size:12px;color:{INK6};line-height:1.35">{e(r["say"])}</span></span>')
    out = (f'<span style="display:flex;flex-direction:column;gap:3px"><span style="display:flex;align-items:center;gap:6px">{BELL}'
           f'<span style="{M};font-size:12.5px;font-weight:600">{e(r["kind"])}</span></span>'
           f'<span style="font-size:12px;color:{INK6};line-height:1.35">“{e(r["say"])}”</span>')
    for k, s, who in r['also']:
        out += (f'<span style="display:flex;align-items:center;gap:6px;margin-top:3px">{BELL}<span style="{M};font-size:11.5px;font-weight:600">{e(k)}</span>'
                f'{ARROW}{stack(who, 26)}</span><span style="font-size:11.5px;color:{INK6};line-height:1.3">“{e(s)}”</span>')
    return out + '</span>'
def row(r, last):
    b = '' if last else 'border-bottom:1px solid #EFECE6;'
    there = ''.join(word(i, w) for i, w in r['there'])
    yard = 'MK' if r['f'] in ('MK',) or 'MK' in r['to'] else 'YD'
    return (f'<div style="display:grid;{GRID};align-items:center;padding:12px 20px;{b}">'
            f'<span style="display:flex;align-items:center;gap:6px">{face(r["f"], 28) if r["f"] in P else ""}{ARROW}{stack(r["to"], 26)}</span>'
            f'<span style="display:flex;flex-direction:column;gap:4px"><span style="font-size:14px;font-weight:700;line-height:1.3">{e(r["t"])}</span>'
            f'<span style="display:flex;align-items:center;gap:8px"><span style="height:20px;padding:0 7px;border-radius:6px;background:{TILE};font-size:11px;font-weight:600;color:{INK};display:inline-flex;align-items:center;white-space:nowrap;{M}">{e(r["at"])}</span>{board_links(r["b"])}</span></span>'
            f'{pushcell(r)}'
            f'<span style="display:grid;grid-template-columns:minmax(0,1fr) 16px minmax(0,1fr);gap:6px;align-items:center">'
            f'<span style="display:flex;flex-direction:column;gap:4px">{there}</span>'
            f'<span style="color:#9AA1AE;font-size:14px;text-align:center" aria-hidden="true">⇄</span>'
            f'<span style="display:flex;flex-direction:column">{word(yard, r["here"])}</span></span>'
            f'<span style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">{"".join(chip(c) for c in r["c"])}<span style="font-size:11px;color:{INK4};{M}">{e(r["im"])}</span></span></div>')

def build():
    rows = [r for *_, rs in PHASES for r in rs]
    # header: faces (Sales ringed so it shows on navy), the ribbon keyed to the phases
    faces = ''.join(f'<span style="display:flex;flex-direction:column;align-items:center;gap:5px">{face(i, 38, "#FFFFFF" if P[i][0]==NAVY else "rgba(255,255,255,.35)")}<span style="font-size:11px;color:#B3BCD2">{a}</span></span>'
                    for i, a in [('GA','Sales'),('DO','Buyer'),('RN','Manager'),('MK','Store'),('EA','Accounts'),('ML','Sourcing'),('PS','Agent'),('KC','Customer'),('JM','Owner')])
    def tags(stage):
        out = ''
        for n, name, col, st, rs in PHASES:
            if stage in st:
                out += f'<span style="height:24px;padding:0 9px;border-radius:999px;background:{col};box-shadow:0 0 0 1.5px rgba(255,255,255,.5);color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:5px;white-space:nowrap"><b style="{M}">{n}</b>{e(name)} · {len(rs)}</span>'
        return out or '<span style="font-size:11px;color:#A9B3CB">look only</span>'
    yard_on = {'Buying','Packing','On the road','Delivered'}
    ribbon = ''.join(
        f'<span style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;position:relative">'
        f'<span style="width:34px;height:34px;border-radius:999px;background:{"#FFFFFF" if s in yard_on else "rgba(255,255,255,.08)"};color:{NAVY if s in yard_on else "#8D99B5"};box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;{M}">{k+1}</span>'
        f'<span style="font-size:13px;font-weight:700;color:{"#FFFFFF" if s in yard_on else "#8D99B5"}">{s}</span>'
        f'<span style="display:flex;flex-wrap:wrap;justify-content:center;gap:4px;min-height:24px">{tags(s)}</span></span>' for k, s in enumerate(STAGES))
    n5 = PHASES[4]
    shelf = (f'<span style="width:190px;display:flex;flex-direction:column;align-items:center;gap:8px;border-left:1px dashed rgba(255,255,255,.25)">'
             f'<span style="width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg></span>'
             f'<span style="font-size:13px;font-weight:700;color:#fff">Any time · no stage</span>'
             f'<span style="height:24px;padding:0 9px;border-radius:999px;background:{n5[2]};box-shadow:0 0 0 1.5px rgba(255,255,255,.5);color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:5px"><b style="{M}">5</b>{e(n5[1])} · {len(n5[4])}</span></span>')
    bracket = ('<span style="position:absolute;left:20%;right:190px;top:-10px;height:6px;border:1.5px solid rgba(111,220,176,.7);border-bottom:0;border-radius:6px 6px 0 0"></span>'
               '<span style="position:absolute;left:calc(20% + 12px);top:-30px;font-size:11px;font-weight:700;letter-spacing:.1em;color:#6FDCB0">THE YARD\'S PART · FROM THE CHECK-IN OF BOUGHT GOODS TO THE DOOR</span>')
    head = (f'<div style="background:{NAVY};color:#fff;padding:40px 48px 30px;display:flex;flex-direction:column;gap:44px">'
            f'<div style="display:flex;align-items:flex-end;gap:24px"><span style="flex:1;display:flex;flex-direction:column;gap:6px"><span style="font-size:13px;font-weight:700;letter-spacing:.12em;color:#8D99B5">INTEGRATION · EVERY HANDOVER</span>'
            f'<span style="font-size:38px;font-weight:700;letter-spacing:-.02em">The Store and every app, one flow</span>'
            f'<span style="font-size:15px;color:#B3BCD2">The sample day, Sat 17 Oct 2026 (now 10:41). Each row carries the time its board draws; later moments and what-ifs are marked.</span></span>'
            f'<span style="display:flex;gap:10px">{faces}</span></div>'
            f'<div style="position:relative;display:flex;align-items:flex-start">{bracket}{ribbon}{shelf}</div></div>')
    legend = (f'<div style="display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;padding:18px 48px;font-size:12px;color:{INK6}">'
              f'<span style="display:flex;align-items:center;gap:6px">{BELL} the push and who gets it</span>'
              f'<span style="display:flex;align-items:center;gap:6px">{face("GA",20)} ⇄ {face("MK",20)} the other app\'s words · the yard\'s words</span>'
              f'{chip("new")} did not exist {chip("screen")} the other app needs a screen {chip("fix")} one word now {chip("keep")} already right {chip("live")} nobody waits, so no push'
              f'<span style="{M}">IM-nn = docs/audit/store/INTEGRATION.md §3</span></div>')
    cols = ''.join(f'<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:{INK4}">{c}</span>' for c in ['FROM → TO','THE HANDOVER · WHEN · BOARDS','THE PUSH','THE OTHER APP  ⇄  THE YARD','CLOSES'])
    body = ''
    for n, title, color, st, rs in PHASES:
        stp = ''.join(f'<span style="height:24px;padding:0 10px;border-radius:999px;background:{TILE};font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px"><i style="width:8px;height:8px;border-radius:999px;background:{NAVY}"></i>Stage · {s}</span>' for s in st) or f'<span style="height:24px;padding:0 10px;border-radius:999px;background:{TILE};font-size:12px;font-weight:700;display:inline-flex;align-items:center">Any time · no stage</span>'
        body += (f'<div style="margin:0 48px 20px;background:#fff;border:1px solid {RULE};border-radius:20px;overflow:hidden">'
                 f'<div style="display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid {RULE}"><span style="width:26px;height:26px;border-radius:999px;background:{color};color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;{M}">{n}</span><span style="font-size:17px;font-weight:700">{e(title)}</span>{stp}<span style="flex:1"></span><span style="font-size:13px;color:{INK4};{M}">{len(rs)} handovers</span></div>'
                 f'<div style="display:grid;{GRID};padding:9px 20px;background:{GROUND}">{cols}</div>'
                 + ''.join(row(r, i == len(rs)-1) for i, r in enumerate(rs)) + '</div>')
    oos = ''.join(
        f'<div style="display:flex;flex-direction:column;gap:8px;padding:14px 16px;border-radius:14px;background:{GROUND}">'
        f'<span style="display:flex;align-items:center;gap:6px">{(face(f,24)+ARROW) if f in P and [f]!=to else ""}{stack(to,24,GROUND)}<span style="flex:1"></span><span style="{M};font-size:11px;font-weight:600;color:{INK6}">{e(k)}</span></span>'
        f'<span style="font-size:14px;font-weight:700">{e(t)}</span><span style="font-size:12px;color:{INK6};line-height:1.4">{e(why)}</span></div>'
        for f, to, t, k, why in OUT_OF_SCOPE)
    oospanel = (f'<div style="margin:0 48px 20px;background:#fff;border:1px solid {RULE};border-radius:20px;overflow:hidden">'
                f'<div style="display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid {RULE}"><span style="width:26px;height:26px;border-radius:999px;background:{TILE};display:flex;align-items:center;justify-content:center"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5F6980" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg></span><span style="font-size:17px;font-weight:700">Out of the yard\'s scope</span><span style="font-size:13px;color:{INK6}">handovers in INTEGRATION.md the yard takes no part in, and why</span><span style="flex:1"></span><span style="font-size:13px;color:{INK4};{M}">{len(OUT_OF_SCOPE)}</span></div>'
                f'<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:16px 20px">{oos}</div></div>')
    npush = sum(1 for r in rows if r['kind'])
    nlive = len(rows) - npush
    foot = (f'<div style="margin:0 48px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px">'
            + ''.join(f'<div style="background:#fff;border:1px solid {RULE};border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:4px"><span style="font-size:30px;font-weight:600;{M}">{v}</span><span style="font-size:13px;color:{INK6}">{t}</span></div>'
                      for v, t in [(npush, f'handovers that wait on someone, each with its push'),
                                   (nlive, 'read live: nobody waits, so no push'),
                                   (sum(1 for r in rows if 'new' in r['c']), 'pushes that did not exist'),
                                   (sum(1 for r in rows if 'screen' in r['c']), 'screens other apps need'),
                                   (len(OUT_OF_SCOPE), 'handovers out of the yard\'s scope')]) + '</div>')
    return head + legend + body + oospanel + foot, rows

if __name__ == '__main__':
    inner, rows = build()
    h = fit(os.path.join(OUT, 'IB01Handovers.dc.html'), inner, W, 'Every handover')
    print('IB01', h, len(rows))
