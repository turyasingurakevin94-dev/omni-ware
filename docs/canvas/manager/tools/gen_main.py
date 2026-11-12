import html
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'Main.dc.html')
W, H = 2040, 2560

NAVY='#16203C'; INK='#1C2233'; SOFT='#5F6980'; FAINT='#6B7480'; LINE='#E6E3DD'; BG='#F7F5F2'; TILE='#F1EEE8'
RED='#C93A30'; REDS='#FDE8E4'; REDD='#A82D24'; GOOD='#0F6B43'; GOODB='#E4F4EA'; WARN='#95530C'; WARNB='#FDEEE1'; WARNI='#7A4A02'
BAD='#8E2A22'; BADB='#FBE5E2'; DASH='#C9C4BA'; MONO="'IBM Plex Mono', monospace"

P = {
 'RN':('Ruth','#16203C','#FFFFFF'), 'GA':('Grace','#DCEAF8','#1A5A8A'), 'BO':('Brian','#DDF1EE','#0E5E57'),
 'FN':('Faith','#F6E4F1','#7A3268'), 'DO':('Denis','#E4E6FA','#3A3F9B'), 'MK':('Musa','#E4F4EA','#0F6B43'),
 'JN':('Joy','#FDEEE1','#7A4A02'), 'EA':('Esther','#E8EBF0','#3D4A5C'), 'ML':('Moses','#F1EEE8','#1C2233'),
 'PS':('Peter','#F1EEE8','#1C2233'),
}
e = html.escape

ICON = {
 'clock':'<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
 'spark':'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"></path>',
 'bell':'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"></path><path d="M10 21h4"></path>',
 'bellx':'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"></path><path d="M4 4l16 16"></path>',
 'eye':'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
 'book':'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"></path><path d="M4 19V5"></path>',
 'arrow':'<path d="M5 12h14M13 6l6 6-6 6"></path>',
}
def svg(name, size=14, color='currentColor', sw=2):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICON[name]}</svg>'

def av(k, s=32, r=None):
    r = r if r is not None else (10 if s >= 30 else 99)
    n, bg, fg = P[k]
    fs = 13 if s >= 30 else 12
    return f'<span style="width: {s}px; height: {s}px; border-radius: {r}px; background: {bg}; color: {fg}; display: inline-flex; align-items: center; justify-content: center; font-size: {fs}px; font-weight: 800; flex-shrink: 0">{k}</span>'

def sysav(icon, s=32):
    return f'<span style="width: {s}px; height: {s}px; border-radius: 10px; background: {TILE}; color: {INK}; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px dashed {DASH}; box-sizing: border-box">{svg(icon, 16)}</span>'

def badge(text, bg, fg, border=None):
    b = f'border: 1.5px solid {border}; ' if border else ''
    return f'<span style="height: 20px; padding: 0 8px; border-radius: 999px; background: {bg}; color: {fg}; {b}font-size: 12px; font-weight: 800; letter-spacing: .04em; display: inline-flex; align-items: center; flex-shrink: 0; white-space: nowrap; box-sizing: border-box">{text}</span>'

NEW = lambda: badge('NEW', '#fff', NAVY, NAVY)
ROUTE = lambda: badge('NOT ROUTED', WARNB, WARNI)
RETIRE = lambda: badge('RETIRED', TILE, SOFT)
NOASK = lambda: badge('NO ASKER YET', WARNB, WARNI)
CHANGED = lambda: ''

def pill(label, kind='tap'):
    base = 'height: 28px; padding: 0 11px; border-radius: 999px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; box-sizing: border-box; flex-shrink: 0'
    if kind == 'primary':
        return f'<span style="{base}; background: {NAVY}; color: #fff">{e(label)}</span>'
    if kind == 'slide':
        return f'<span style="{base}; background: {NAVY}; color: #fff; padding-left: 4px"><span style="width: 22px; height: 22px; border-radius: 99px; background: {RED}; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800">»</span>{e(label)}</span>'
    if kind == 'missing':
        return f'<span style="{base}; background: {WARNB}; color: {WARNI}; border: 1px dashed {WARN}">{e(label)}</span>'
    if kind == 'gone':
        return f'<span style="{base}; background: transparent; color: {SOFT}; text-decoration: line-through; border: 1px solid {LINE}">{e(label)}</span>'
    if kind == 'note':
        return f'<span style="{base}; background: transparent; color: {SOFT}; font-weight: 600; padding: 0 2px">{e(label)}</span>'
    return f'<span style="{base}; background: #fff; color: {INK}; border: 1px solid {DASH}">{e(label)}</span>'

def tag(t):
    return {'new':NEW(),'route':ROUTE(),'retired':RETIRE(),'noask':NOASK(),'changed':CHANGED(),'':''}[t]

# ---------- the 33 rows ----------
# asker: (avatar key or ('sys',icon,label)), app label
# push: dict(kind, st, title, body, act, actkind)  or dict(none='where it is seen', body=...)
# choices: list of (label, kind)
# back: list of (kind, to keys, status)  status '', 'new', 'changed'
# sees: (words, who/app)
R = {}
def row(id, asker, app, push, choices, back, sees, np=False):
    R[id] = dict(id=id, asker=asker, app=app, push=push, choices=choices, back=back, sees=sees, np=np)

# TODAY
row('D-4', 'GA', 'Sales · counter', dict(kind='price.waits', st='changed', title='Grace · At the counter · under the shop’s price', body='Cement 50 kg · 10 bags at 40,000 · shop’s 42,500 · cost 34,000', act='Approved · 40,000'),
    [('Approved · 40,000','primary'),('Shop’s price','tap')], [('price.decided',['GA'],'')], ('Approved · or Shop’s price', 'Sales · counter'))
row('D-7', 'MK', 'Store · Load', dict(kind='credit.ask', st='changed', title='Musa · Not paid yet · on credit? · #0551', body='Nansana Hardware · owes 0 · 1,240,000 · no limit · truck waits', act='On credit · load it · 1.5M · 14 d'),
    [('On credit · load it','primary'),('Cash first · it stays','tap')], [('credit.ask.decided',['MK'],'changed'),('credit.decided',['GA'],'')], ('On credit · load it', 'Store · Musa · Sales · Grace'))
row('D-30', ('sys','spark','the app'), 'aging · over 30 d', dict(none='Today · watch row', body='1 over 30 d · Kyaligonza & Sons · 2,310,000 · 38 d · Grace’s'),
    [('Nudge Grace','primary')], [('team.nudge',['GA'],'new')], ('Ruth nudged you', 'Sales · Today'))
# ORDERS
row('D-1', 'GA', 'Sales · price', dict(kind='price.waits', st='changed', title='Grace · Under the shop’s price · #0555', body='Iron sheet G28 · 46,000, shop’s 47,500 · cost 38,000 · 30 sht', act='Approved · 46,000'),
    [('Approved · 46,000','primary'),('Shop’s price','tap'),('Another price','tap')], [('price.decided',['GA'],'changed')], ('Approved', 'Sales · the line · no push'))
row('D-2', 'BO', 'Sales · no price', dict(kind='price.waits', st='changed', title='Brian · Price coming · #0553', body='Y12 rebar 12 m · cost 31,000 + 25% = 38,750 · 20 pcs · Ggaba Stores', act='Price set · 38,750'),
    [('Price set · 38,750','primary'),('Another price','tap')], [('price.decided',['BO'],'changed')], ('Price set · 38,750 · Tell them', 'Sales · Today'))
row('D-3', 'DO', 'Buyer · replies', dict(kind='price.waits', st='changed', title='Denis · Price up · #0552', body='Ridge cap 3 m · cost 27,000, sells 26,000 · 10 pcs', act='Shop’s price · 33,750'),
    [('Shop’s price · 33,750','primary'),('Another price','tap')], [('price.decided',['FN','DO'],'changed')], ('Shop’s price · Tell them', 'Sales · Faith · Buyer · Denis'))
row('D-5', 'GA', 'Sales · order', dict(kind='credit.hold', st='changed', title='Grace · On credit? · Kyaligonza & Sons', body='Old bill · 38 d (held at 21) · owes 2,310,000', act='On credit'),
    [('On credit','primary'),('Cash first','tap'),('Keep held','gone')], [('credit.decided',['GA'],'')], ('On credit · or Cash first', 'Sales · order (S-1)'))
row('D-6', 'FN', 'Sales · order', dict(kind='credit.hold', st='changed', title='Faith · On credit? · Mukono Roofing', body='No limit set · #0552 1,287,500 · would owe 2,501,500', act='On credit · 3M · 30 d'),
    [('On credit · 3M · 30 d','primary'),('Cash first','tap')], [('credit.decided',['FN'],''),('customer.changed',['FN'],'')], ('On credit · 3M · 30 d', 'Sales · order (S-1)'))
row('D-8', ('sys','clock','bills itself'), 'at 24 h', dict(none='Orders row · no ask', body='#0546 · billed itself 08:30 · others: “bills itself in 18 h”', kind='order.delivered', st='retired'),
    [('Invoice now','tap')], [('order.invoiced',['EA','GA'],'')], ('Invoiced · to collect', 'Sales · Accounts'))
row('D-9', ('sys','clock','bills itself'), 'can’t bill itself', dict(kind='invoice.held', st='changed', title='Can’t bill itself · Only 567 · #0561', body='Walk-in · 1 line · 567 · Grace’s counter sale', act='Bill it · 567'),
    [('Bill it','primary'),('Fix the order','tap')], [('order.invoiced',['EA'],'')], ('Invoiced', 'Accounts'))
row('D-10', ('sys','clock','bills itself'), 'can’t bill itself', dict(kind='invoice.held', st='changed', title='Can’t bill itself · a line at 0 · #0563', body='Brian’s · 2 packs Wall plugs at 0 · cost 3,000', act=None, actnote='why = a choice'),
    [('Bill it','primary'),('Given away · why','tap')], [('order.invoiced',['EA'],'')], ('Invoiced', 'Accounts'))
row('D-11', ('sys','clock','bills itself'), 'can’t bill itself', dict(kind='invoice.held', st='changed', title='Price coming · decide it to bill', body='#0562 Mukono Roofing · Cement 425,000 · opens D-1 · D-2 · D-12', act=None, actnote='its ask’s action'),
    [('the underlying answer','note')], [('as D-1 · D-2 · D-12',[],'')], ('as the underlying ask', '—'))
row('D-12', 'MK', 'Store · pack short', dict(kind='pick.short', st='changed', title='Musa · Packed short · #0550', body='Iron sheet G28 36 of 40 · full 1,900,000', act='Bill what went · 1,710,000'),
    [('Bill what went','primary'),('Bill it all','tap')], [('pick.settled',['MK'],'new'),('pick.settled → salesperson',[],'new')], ('Bill what went · Tell them', 'Store · Sales'))
row('D-20', 'GA', 'Sales · Change', dict(kind='order.cancel.ask', st='route', title='Grace · Cancel asked · #0556', body='Ggaba Stores · 430,000 · Nothing paid · changed their mind', act='Kept', actnote='only'),
    [('Cancelled','primary'),('Kept','tap'),('Nothing paid · Undo 10 s','note')], [('order.cancelled',['GA','MK'],'changed'),('order.cancelled',['DO'],'new')], ('Cancelled · or Kept', 'Sales · Store · Buyer'))
row('D-21', ('sys','spark','the app'), 'spots it', dict(none='Today · row', body='Taken twice? #0544 & #0545 · Kato Construction · same 320,000'),
    [('Cancel #0545 · keep #0544','slide'),('Both are real','tap')], [('order.cancelled',['GA','MK'],'changed')], ('Cancelled', 'Sales · Store'))
row('D-22', 'PS', 'Agent app', dict(kind='agent.change', st='changed', title='Peter · asks for fewer · #0560', body='Cement 50 kg 20 → 12 · Y12 rebar 12 m 10 → 10', act='Agreed'),
    [('Agreed','primary'),('Kept · per line','tap')], [('agent.change.decided',['DO','PS'],'new')], ('Agreed · or Kept', 'Buyer · Agent'))
# STOCK
row('D-13', 'MK', 'Store · check-in', dict(kind='trip.difference', st='changed', title='Musa · Check-in differs · Denis’s trip', body='Owino · PVC pipe 4 in 11 of 12 · −28,000 at cost · Denis’s note', act='Take the check-in'),
    [('Take the check-in','primary'),('Nudge Denis','tap')], [('trip.difference.decided',['DO','MK'],'new')], ('Ruth took Musa’s check-in', 'Buyer · Store'))
row('D-14', 'DO', 'Buyer · yard note', dict(kind='trip.yard_note', st='noask', title='Why the trip’s count differs', body='goes in the trip’s history · closes with D-13', act=None, actnote='nothing to decide'),
    [('closes with the check-in','note')], [('nobody',[],'')], ('—', 'the trip’s history'))
row('D-15', 'MK', 'Store · Load', dict(kind='store.extra', st='route', title='Musa · Not on the list · keep it?', body='2 bags Cement 50 kg on Denis’s trip · not on the list', act='Keep it'),
    [('Keep it','primary'),('It goes back','tap')], [('store.ask.decided',['MK'],'')], ('Keep it · or It goes back', 'Store · Ruth decides'), np=True)
row('D-16', 'MK', 'Store · loss', dict(kind='stock.report', st='changed', title='Musa · Damaged · 3 Cement 50 kg', body='3 × 34,000 · −102,000 at cost · photo', act='Kept on the shelf', actnote='only'),
    [('Written off · 102,000','slide'),('Kept on the shelf','missing')], [('stock.report.decided',['MK'],'')], ('Written off · or Kept on the shelf', 'Store · Ruth decides'))
row('D-17', 'MK', 'Store · blind count', dict(kind='stock.count', st='new', title='Musa · A count to check · Aisle B', body='12 items counted · 2 differ', act='Count it again', actnote='only'),
    [('Count taken','slide'),('Count it again','tap')], [('stock.count.decided',['MK'],'new')], ('Count taken · or Count it again', 'Store · the count'))
row('D-23', 'DO', 'Buyer · restock list', dict(none='Orders · Stock row · nobody asks', body='Cement 50 kg · a restock line planned'),
    [('Not yet','primary'),('Go ahead','tap')], [('restock.held',['DO'],'changed')], ('Ruth: not yet · Cement 50 kg', 'Buyer · the order (B-1)'))
row('D-24', 'DO', 'Buyer · carton', dict(kind='carton.ask', st='noask', title='Denis · A carton for the shelf?', body='Wall plugs · 1 for the order, 199 shelf · 298,500', act='Shelf part OK'),
    [('Shelf part OK','primary'),('Order only','tap')], [('restock.released',['DO'],'changed'),('carton.refused',['DO'],'changed')], ('Shelf part OK · or Order only', 'Buyer · trip plan (B-3)'))
# MONEY
row('D-18', 'BO', 'Sales · Wrong', dict(kind='invoice.ask', st='changed', title='Brian · Return asked · #0547', body='5 Timber 2×4 · −56,250 · owes 662,000 → 605,750', act='Kept as sold', actnote='only'),
    [('Credit note raised · 56,250','slide'),('Kept as sold','tap')], [('invoice.ask.decided',['BO'],''),('credit_note.raised',['EA'],'new')], ('Credit note raised · or Kept as sold', 'Sales · order (S-2)'))
row('D-19', 'EA', 'Accounts · propose', dict(kind='invoice.ask', st='changed', title='Esther · Void asked · #0545', body='Kato · 320,000 · entered twice with #0544 · 200,000 paid', act='Kept as billed', actnote='only'),
    [('Voided','slide'),('Kept as billed','tap'),('Refund · Deposit','tap')], [('invoice.ask.decided',['EA'],''),('invoice.voided',['EA'],'new')], ('Voided · or Kept as billed', 'Accounts (A-1)'))
row('D-25', 'RN', 'Ruth · from a debtor', dict(none='Money · the customer · no ask', body='Ggaba Stores · owes 1,615,000 · oldest 16 d'),
    [('Limit 2,000,000 · 14 days','primary'),('Change','tap'),('Cash only','tap')], [('customer.changed',['GA'],'')], ('Limit 2,000,000 · 14 days', 'Sales · customer'))
row('D-32', 'EA', 'Accounts · customer', dict(kind='credit.limit.ask', st='new', title='Esther · Credit asked · Ggaba Stores', body='2M → 3,000,000 · 14 d · owes 1,615,000 · pays every 2 weeks', act='Limit 3,000,000 · 14 days'),
    [('Limit 3,000,000 · 14 days','primary'),('Cash only','tap')], [('credit.limit.ask.decided',['EA'],'new'),('customer.changed',['GA'],'')], ('Limit 3,000,000 · 14 days · or Cash only', 'Accounts · customer (S-8)'), np=True)
row('D-26', ('sys','spark','the app'), 'look-alike rules', dict(none='Money · Look alike card', body='Ggaba Stores ↔ Gaba Stores · same phone'),
    [('Merge into Ggaba Stores','slide'),('Not the same','tap')], [('owner’s log',[],'')], ('—', 'owner’s log'))
row('D-27', ('sys','book','fresh start'), 'old books', dict(none='Money · old-books card', body='Ggaba Stores · 290,000 since Thu 1 Oct'),
    [('Opening balance · 290,000','slide')], [('owner’s log',[],'')], ('—', 'owner’s log'))
row('D-28', 'BO', 'Sales · promise', dict(kind='promise.made', st='new', title='Lubowa Builders promised · Mon 19 Oct', body='Brian took the promise · they owe 662,000 · quiet', act=None, actnote='quiet · no answer'),
    [('Promise','tap'),('Promised · Mon 19 Oct','note')], [('—',[],'')], ('Promised · Mon 19 Oct', 'Sales · Money'))
row('D-33', 'ML', 'Sourcing · lists it', dict(kind='markup.wanted', st='new', title='Moses · A new item to price', body='PVC pipe 4 in · cost 28,000 · rivals 34,000–36,000', act='Markup 25% · 35,000'),
    [('Markup 25%','primary'),('another markup','tap')], [('owner’s log',[],'')], ('the price on every app', 'Sales · price list'))
# TEAM
row('D-29', 'RN', 'Ruth · monthly', dict(none='Team · goal rings', body='Faith 14,910,000 of 30M · suggested goal per person'),
    [('Goals · 35M · 30M · 30M','primary'),('Change','tap')], [('goal.set',['GA','BO','FN'],'new')], ('Your goal for November', 'Sales · Today (quiet)'))
row('D-31', ('sys','clock','stage limits'), 'stuck order', dict(none='Today · watch row · Team', body='#0554 Lubowa · 2 h 40 m in Checking · 40 m over · Denis holds it'),
    [('Nudge Denis','primary'),('Give it to Moses','tap')], [('team.nudge',['DO'],'new'),('job.given · trip.sent',[],'')], ('Ruth nudged you · or Given to Moses', 'Buyer · Today'))

GROUPS = [
 ('Today', 'standing there · watching', ['D-4','D-7','D-30']),
 ('Orders', 'prices · credit · bills itself · picks · cancels · agents', ['D-1','D-2','D-3','D-5','D-6','D-8','D-9','D-10','D-11','D-12','D-20','D-21','D-22']),
 ('Orders · Stock', 'check-ins · extras · losses · counts · restock · cartons', ['D-13','D-14','D-15','D-16','D-17','D-23','D-24']),
 ('Money', 'returns · voids · limits · look-alikes · promises · markups', ['D-18','D-19','D-25','D-32','D-26','D-27','D-28','D-33']),
 ('Team', 'goals · stuck orders', ['D-29','D-31']),
]
assert sum(len(g[2]) for g in GROUPS) == 33 and len(R) == 33

COLS = '84px 176px minmax(0, 1fr) 300px 292px 236px'
GAP = 14

def asker_cell(r):
    a = r['asker']
    if isinstance(a, tuple):
        avh = sysav(a[1]); name = a[2]
    else:
        avh = av(a); name = P[a][0]
    return f'<div style="display: flex; align-items: center; gap: 10px; min-width: 0">{avh}<div style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 14px; font-weight: 800; white-space: nowrap">{e(name)}</span><span style="font-family: {MONO}; font-size: 12px; color: {FAINT}; white-space: nowrap">{e(r["app"])}</span></div></div>'

def push_cell(p):
    if 'none' in p:
        top = f'<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: {SOFT}">{svg("eye", 14, SOFT)}no push · {e(p["none"])}</span>'
        if p.get('st') == 'retired':
            top = f'<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: {SOFT}">{svg("bellx", 14, SOFT)}<span style="font-family: {MONO}; font-size: 12px; text-decoration: line-through">{e(p["kind"])}</span>{RETIRE()}· {e(p["none"])}</span>'
        return f'<div style="border: 1px dashed {DASH}; border-radius: 12px; padding: 4px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; box-sizing: border-box">{top}<span style="font-family: {MONO}; font-size: 12px; color: {SOFT}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{e(p["body"])}</span></div>'
    st = tag(p['st'])
    if p.get('act'):
        actn = f'<span style="font-family: {MONO}; font-size: 12px; color: {FAINT}; white-space: nowrap">{e(p["kind"])}{" · only" if p.get("actnote")=="only" else ""}</span>'
        kept = p.get('actnote') == 'only'
        btn = f'<span style="height: 24px; padding: 0 9px; border-radius: 8px; background: {"#fff" if kept else "#E8EDFB"}; color: {"#1C2233" if kept else "#1F3A8A"}; border: 1px solid {"#C9C4BA" if kept else "#C7D2F2"}; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; white-space: nowrap; box-sizing: border-box">{e(p["act"])}</span>'
        right = f'<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0">{btn}{actn}</div>'
    else:
        right = f'<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0"><span style="font-size: 12px; font-weight: 700; color: {FAINT}; white-space: nowrap">{e(p.get("actnote","no action"))}</span><span style="font-family: {MONO}; font-size: 12px; color: {FAINT}; white-space: nowrap">{e(p["kind"])}</span></div>'
    return (f'<div style="background: #fff; border: 1px solid {LINE}; border-radius: 12px; padding: 4px 10px 4px 12px; display: flex; align-items: center; gap: 10px; min-width: 0; box-sizing: border-box">'
            f'<span style="color: {NAVY}; flex-shrink: 0; display: flex">{svg("bell", 16)}</span>'
            f'<div style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex-grow: 1">'
            f'<div style="display: flex; align-items: center; gap: 6px; min-width: 0"><span style="font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{e(p["title"])}</span>{st}</div>'
            f'<div style="display: flex; align-items: center; gap: 8px; min-width: 0"><span style="font-family: {MONO}; font-size: 12px; color: {SOFT}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{e(p["body"])}</span></div>'
            f'</div>{right}</div>')

def choices_cell(cs):
    return '<div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; align-content: center">' + ''.join(pill(l, k) for l, k in cs) + '</div>'

def back_cell(bs):
    out = []
    for kind, to, st in bs:
        faces = ''.join(av(k, 24) for k in to)
        t = tag(st)
        arrow = f'<span style="color: {SOFT}; display: flex">{svg("arrow", 12)}</span>' if to else ''
        out.append(f'<div style="display: flex; align-items: center; gap: 6px; min-width: 0"><span style="font-family: {MONO}; font-size: 12px; font-weight: 600; color: {INK}; white-space: nowrap">{e(kind)}</span>{arrow}<span style="display: flex; gap: 2px">{faces}</span>{t}</div>')
    return '<div style="display: flex; flex-direction: column; gap: 4px; justify-content: center">' + ''.join(out) + '</div>'

def sees_cell(s):
    w, who = s
    if w == '—':
        return f'<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; color: {SOFT}">—</span><span style="font-family: {MONO}; font-size: 12px; color: {FAINT}">{e(who)}</span></div>'
    return f'<div style="display: flex; flex-direction: column; gap: 3px; min-width: 0"><span style="font-size: 13px; font-weight: 700; line-height: 1.25">{e(w)}</span><span style="font-family: {MONO}; font-size: 12px; color: {FAINT}; white-space: nowrap">{e(who)}</span></div>'

def drow(r):
    idchip = f'<span style="font-family: {MONO}; font-size: 12px; font-weight: 600; color: #fff; background: {NAVY if not r["np"] else WARN}; height: 24px; padding: 0 8px; border-radius: 99px; display: inline-flex; align-items: center; white-space: nowrap">{r["id"]}</span>'
    npb = badge('NOT TODAY', WARNB, WARNI) if r['np'] else ''
    bg = '#FFFBF6' if r['np'] else 'transparent'
    return (f'<div style="display: grid; grid-template-columns: {COLS}; gap: 0 {GAP}px; align-items: center; min-height: 48px; padding: 3px 16px; border-top: 1px solid {LINE}; background: {bg}; box-sizing: border-box">'
            f'<div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start">{idchip}{npb}</div>'
            f'{asker_cell(r)}{push_cell(r["push"])}{choices_cell(r["choices"])}{back_cell(r["back"])}{sees_cell(r["sees"])}</div>')

def ghead(name, sub, ids):
    return (f'<div style="display: flex; align-items: baseline; gap: 12px; padding: 8px 16px 4px; border-top: 2px solid {NAVY}">'
            f'<span style="font-size: 18px; font-weight: 800">{e(name)}</span>'
            f'<span style="font-family: {MONO}; font-size: 13px; font-weight: 600; color: {SOFT}">{len(ids)}</span>'
            f'<span style="font-size: 13px; font-weight: 600; color: {SOFT}">{e(sub)}</span></div>')

# counts
n_new = 13
stat = lambda big, small, color='#fff', bg='rgba(255,255,255,.08)', sc='#B3BCD2': f'<div style="background: {bg}; border-radius: 16px; padding: 14px 18px; display: flex; flex-direction: column; gap: 4px; min-width: 150px"><span style="font-family: {MONO}; font-size: 30px; font-weight: 600; color: {color}">{big}</span><span style="font-size: 13px; font-weight: 600; color: {sc}">{small}</span></div>'

hero = (f'<div style="background: {NAVY}; color: #fff; border-radius: 0 0 28px 28px; padding: 24px 40px 22px; display: flex; align-items: flex-end; justify-content: space-between; gap: 32px">'
        f'<div style="display: flex; flex-direction: column; gap: 10px"><div style="font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #B3BCD2">Who asks · the push · Ruth’s answer · who hears it</div>'
        f'<div style="font-size: 36px; font-weight: 800">Every decision that lands on Ruth</div></div>'
        f'<div style="display: flex; gap: 10px">'
        + stat('33', 'hand-offs · D-1 … D-33')
        + stat('<span style="color:#B3BCD2;text-decoration:line-through;font-size:22px">145</span> 68', 'taps · from the app', '#6FDCB0')
        + stat('<span style="color:#B3BCD2;text-decoration:line-through;font-size:22px">59</span> 24', 'taps · from the push', '#6FDCB0')
        + stat('<span style="color:#B3BCD2;text-decoration:line-through;font-size:22px">2</span> 1', 'each next in the queue', '#6FDCB0')
        + stat(f'{n_new} + 1', 'new pushes · 0182', '#fff', 'rgba(255,255,255,.16)', '#D5DBEA')
        + '</div></div>')

colhead = (f'<div style="display: grid; grid-template-columns: {COLS}; gap: 0 {GAP}px; padding: 12px 16px; background: {TILE}; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: {SOFT}; border-radius: 16px 16px 0 0">'
           '<span>#</span><span>Who asks</span><span>The push Ruth reads · its one action</span><span>Ruth’s choices</span><span>Push back → who</span><span>The asker’s app then shows</span></div>')

body = ''.join(ghead(n, s, ids) + ''.join(drow(R[i]) for i in ids) for n, s, ids in GROUPS)

legend_items = [
 (pill('Approved','primary'), 'a tap · Undo 10 s'),
 (pill('Written off','slide'), 'a slide · money or books'),
 (pill('Open'), 'a slide’s row · opens the sheet'),
 (f'<span style="height: 26px; padding: 0 10px; border-radius: 8px; background: #E8EDFB; color: #1F3A8A; border: 1px solid #C7D2F2; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center">APPROVED · 46,000</span>', 'notification action'),
 (f'<span style="height: 26px; padding: 0 10px; border-radius: 8px; background: #fff; color: {INK}; border: 1px solid {DASH}; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center">KEPT AS SOLD</span>', 'only the safe “keep”'),
 (NEW(), 'push 0182 adds'),
 (ROUTE(), 'sent, opens nothing'),
 (NOASK(), 'live app sends none'),
 (pill('Kept on the shelf','missing'), 'not possible today'),
]
legend = (f'<div style="display: flex; flex-wrap: wrap; gap: 10px 22px; align-items: center; padding: 10px 20px; background: #fff; border: 1px solid {LINE}; border-radius: 16px">'
          + ''.join(f'<span style="display: inline-flex; align-items: center; gap: 8px">{a}<span style="font-size: 13px; font-weight: 600; color: {SOFT}">{e(b)}</span></span>' for a, b in legend_items)
          + '</div>')

QUEUE = [('MK','Not paid yet · on credit?','#0551','truck waits',True),('BO','Return asked','#0547','3 h',False),('DO','Price up','#0552','2 h 10',False),
 ('MK','Damaged · Cement 50 kg','3 bags','1 h 30',False),('GA','Under the shop’s price','#0555','1 h 05',False),('GA','Cancel asked','#0556','50 m',False),
 ('MK','Packed short','#0550','40 m',False),('DO','A carton for the shelf?','Wall plugs','15 m',False)]
QD = ['D-7','D-18','D-3','D-16','D-1','D-20','D-12','D-24']
def qchip(i, q, d):
    k, ask, ref, age, st = q
    agec = WARNI if (st or ' h' in age) else SOFT
    agebg = WARNB if agec == WARNI else TILE
    return (f'<div style="min-width: 0; display: flex; align-items: center; gap: 10px; padding: 6px 12px; border: 1px solid {LINE}; border-radius: 14px; background: {"#fff" if not st else "#F3F5FA"}; box-sizing: border-box">'
            f'<span style="font-family: {MONO}; font-size: 14px; font-weight: 600; color: {NAVY}; width: 14px; flex-shrink: 0">{i}</span>{av(k, 28)}'
            f'<div style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{e(ask)}</span>'
            f'<span style="font-family: {MONO}; font-size: 11px; color: {SOFT}; white-space: nowrap"><span style="color: {INK}; font-weight: 600">{P[k][0]}</span> · {d} · {e(ref)} · <span style="background: {agebg}; color: {agec}; border-radius: 6px; padding: 0 4px">{e(age)}</span></span></div></div>')
qstrip = (f'<div style="display: flex; flex-direction: column; gap: 8px; padding: 12px 16px; background: #fff; border: 1px solid {LINE}; border-radius: 16px">'
          f'<div style="display: flex; align-items: baseline; gap: 12px"><span style="font-size: 16px; font-weight: 800">The queue at 09:40 · 8 wait</span><span style="font-family: {MONO}; font-size: 13px; font-weight: 600; color: {SOFT}">standing first · then oldest</span><span style="font-family: {MONO}; font-size: 12px; color: {SOFT}; margin-left: auto">the + opens 1 · each answer slides in the next</span></div>'
          f'<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px">' + ''.join(qchip(i + 1, q, d) for i, (q, d) in enumerate(zip(QUEUE, QD))) + '</div></div>')

doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Manager decisions</title>
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
<div style="padding: 18px 40px 0; display: flex; flex-direction: column; gap: 12px">
{legend}
{qstrip}
<div style="background: #fff; border: 1px solid {LINE}; border-radius: 16px; display: flex; flex-direction: column">
{colhead}
{body}
</div>
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
print('ok', len(doc))
