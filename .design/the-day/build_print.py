# THE DAY SHEET. A4 at 96 px/inch, one page. This is the artefact that
# leaves the building -- handed to an accountant, kept in a file, or put
# in front of somebody who is arguing about a Tuesday -- so it carries
# its own provenance and nothing it cannot stand behind.
from parts import HEAD, MONO, INK, INK6, INK4, RULE, HAIR, GOOD, BAD, CUT
import day_data as D

W, H = 794, 1123
M = 48


def lab(t, right=False):
    return ('<span style="font-size:12px;font-weight:600;letter-spacing:.06em;'
            'text-transform:uppercase;color:%s;%s">%s</span>'
            % (INK6, 'text-align:right' if right else '', t))


def h2(t):
    return ('<div style="font-size:13px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;'
            'color:%s;padding:0 0 4px;border-bottom:1.5px solid %s;margin:15px 0 0">%s</div>'
            % (INK, INK, t))


def trow(cells, cols, last=False, strong=False):
    return ('<div style="display:grid;grid-template-columns:%s;gap:14px;align-items:baseline;'
            'padding:4px 0;%s">%s</div>'
            % (cols, '' if last else 'border-bottom:1px solid %s;' % HAIR, ''.join(cells)))


def tx(t, right=False, size=16, weight=400, colour=None, mono=False):
    return ('<span style="font-size:%dpx;font-weight:%d;color:%s;%s%s%s">%s</span>'
            % (size, weight, colour or INK, MONO if mono else '',
               'text-align:right;' if right else '', CUT, t))


BUYCOLS = 'minmax(0,1fr) 52px 128px 116px'
PAYCOLS = 'minmax(0,1fr) 130px 128px'

buyers = [trow([lab('Customer'), lab('Orders', True), lab('Sales', True), lab('Gross profit', True)],
               BUYCOLS)]
for n, o, s, p, r in D.BUYERS:
    buyers.append(trow([tx(n), tx(str(o), True, mono=True), tx(s, True, weight=500, mono=True),
                        tx(p, True, weight=500, mono=True)], BUYCOLS))
buyers.append(trow([tx('Two more buyers, not listed individually', colour=INK6),
                    tx('2', True, mono=True), tx('307,500', True, weight=500, mono=True),
                    tx('60,000', True, weight=500, mono=True)], BUYCOLS))
buyers.append(trow([tx('All buyers', weight=600), tx('24', True, weight=600, mono=True),
                    tx(D.SALES_TOTAL, True, weight=600, mono=True),
                    tx(D.PROFIT, True, weight=600, mono=True)], BUYCOLS, last=True))

payers = [trow([lab('Customer'), lab('Arrived by'), lab('Amount', True)], PAYCOLS)]
for n, ag, a, how in D.PAYERS_ROWS:
    payers.append(trow([tx(n), tx(how, size=16, colour=INK6), tx(a, True, weight=500, mono=True)],
                       PAYCOLS))
payers.append(trow([tx('Collected on the day', weight=600), tx(''),
                    tx(D.COLLECTED, True, weight=600, mono=True)], PAYCOLS, last=True))

TILL = [('Cash', '4,120,000', '2,650,000'), ('Mobile money', '2,300,000', '530,000'),
        ('Bank', '2,000,000', '&mdash;')]
till = [trow([lab('Account'), lab('In', True), lab('Out', True), lab('Counted', True)],
             'minmax(0,1fr) 118px 118px 108px')]
for a, i, o in TILL:
    till.append(trow([tx(a), tx(i, True, weight=500, mono=True), tx(o, True, weight=500, mono=True),
                      tx('agreed', True, size=14, colour=GOOD, weight=600)],
                     'minmax(0,1fr) 118px 118px 108px'))
till.append(trow([tx('Net through the till', weight=600), tx('8,420,000', True, weight=600, mono=True),
                  tx('3,180,000', True, weight=600, mono=True),
                  tx('5,240,000', True, weight=600, mono=True)],
                 'minmax(0,1fr) 118px 118px 108px', last=True))

SHCOLS = 'minmax(0,1fr) 118px 118px 108px'
shelf = [trow([lab('Line'), lab('Moved', True), lab('Left', True), lab('', True)], SHCOLS)]
for line, mv, when in D.RAN_OUT:
    shelf.append(trow([tx(line), tx(mv, True, weight=500, mono=True),
                       tx('0', True, weight=600, colour=BAD, mono=True),
                       tx('ran out ' + when, True, size=14, colour=BAD, weight=600)], SHCOLS))
shelf.append('<p style="font-size:14px;color:%s;margin:6px 0 0">11 lines sold across the day, '
             '3 deliveries received, 2 counts corrected. Nothing else fell to nil.</p>' % INK6)

fig = lambda l, v, s: (
  '<div style="flex:1"><div style="font-size:12px;font-weight:600;letter-spacing:.06em;'
  'text-transform:uppercase;color:%s">%s</div>'
  '<div style="%sfont-size:24px;font-weight:500;letter-spacing:-.03em;color:%s;margin-top:4px">%s</div>'
  '<div style="font-size:13px;color:%s;margin-top:3px">%s</div></div>' % (INK6, l, MONO, INK, v, INK6, s))

page = '''
<div style="width:%dpx;height:%dpx;background:#fff;padding:%dpx;box-sizing:border-box;
  font-family:'Inter',system-ui,sans-serif;color:%s;overflow:hidden;
  display:flex;flex-direction:column">

  <div style="display:flex;align-items:flex-start;gap:14px;padding-bottom:12px;
    border-bottom:2px solid %s">
    <div style="width:30px;height:30px;border-radius:8px;background:#B23A26;color:#fff;
      display:flex;align-items:center;justify-content:center;font-family:'Archivo Black',sans-serif;
      font-size:12px;flex:none">OW</div>
    <div style="flex:1;min-width:0">
      <div style="font-family:'Archivo Black',sans-serif;font-size:20px;letter-spacing:-.015em;
        line-height:1.15">%s</div>
      <div style="font-size:14px;color:%s;margin-top:3px">Omni&#8209;Ware &middot; the day as the
        books recorded it</div>
    </div>
    <div style="text-align:right;flex:none">
      <div style="font-size:13px;font-weight:600;color:%s">Closed and counted</div>
      <div style="font-size:13px;color:%s;margin-top:2px">Opened 08:04 &middot; counted 18:40</div>
    </div>
  </div>

  <div style="display:flex;gap:22px;padding:14px 0 12px;border-bottom:1px solid %s">
    %s%s%s%s
  </div>

  %s%s
  %s%s
  %s%s
  %s%s

  <div style="margin-top:auto;padding-top:12px;
    border-top:1px solid %s;display:flex;gap:14px;align-items:flex-end">
    <div style="flex:1;font-size:13px;color:%s;line-height:1.5;max-width:62ch">
      Every figure is what the books recorded on 25 August 2026, not how things stand today.
      Two buyers are summarised rather than listed; their totals are included.
      Printed 26 August 2026, 07:15.</div>
    <div style="flex:none;text-align:right;font-size:13px;color:%s">
      <div style="border-bottom:1px solid %s;width:190px;height:26px"></div>
      <div style="margin-top:4px">Checked by</div></div>
  </div>
</div>''' % (W, H, M, INK, INK, D.DAY_LONG, INK6, GOOD, INK6, RULE,
             fig('Sales invoiced', D.SALES_TOTAL, '24 sales &middot; 23% above a typical Tuesday'),
             fig('Gross profit', D.PROFIT, '12.7% margin'),
             fig('Debt collected', D.COLLECTED, 'four people paid'),
             fig('Through the till', D.TILL_NET, '31 entries &middot; counted, agreed'),
             h2('Who bought'), ''.join(buyers),
             h2('Who paid'), ''.join(payers),
             h2('The till'), ''.join(till),
             h2('The shelf'), ''.join(shelf),
             RULE, INK6, INK6, INK)

open('Print.dc.html', 'w').write(HEAD + page + '\n</x-dc>\n</body>\n</html>\n')
print('Print.dc.html', W, 'x', H)
