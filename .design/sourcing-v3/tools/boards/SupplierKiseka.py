from _shared import *

top = '\n'.join([
    lst('\n'.join([
        row('They proposed a lower price', 'Binding wire 25kg · 96,000 to 94,500', icon_well('tag', 'indigo'), '<span class="m" style="flex: none; height: 22px; padding: 0 7px; border-radius: 999px; background: #E4F4EA; color: #0F6B43; font-size: 11px; font-weight: 600; display: flex; align-items: center">−1.6%</span>', href='Proposals.dc.html'),
        row('5 prices older than 30 days', 'They answer in the supplier app · no trip', icon_well('phone', 'indigo'),
            '<span style="flex: none; height: 30px; padding: 0 12px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 12px; font-weight: 700; display: flex; align-items: center">Ask</span>', href='AskConfirm.dc.html'),
    ])),
])
ft = '''  <div style="flex: none; padding: 12px 16px 22px">
    <button type="button" onClick="{{plan}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{planStyle}}">{{planLabel}}</button>
  </div>'''
score = '''[
      { label: 'Cheapest on', fig: '18 of 31', of: 'lines', v: 58, avg: 70 },
      { label: 'Fills the order', fig: '47 of 50', of: 'lines', v: 94, avg: 90 },
      { label: 'Prices fresh', fig: '26 of 31', of: 'lines', v: 84, avg: 83 },
      { label: 'Delivers in', fig: '3 days', of: 'median', v: 62, avg: 70 }
    ]'''
lines = '''[
      { name: 'Y12 rebar, 12m', note: 'cheapest · confirmed today', noteInk: OK, price: '41,500', ys: [6, 6, 8, 9, 9, 10] },
      { name: 'Wire mesh BRC A142', note: 'cheapest · priced 2 days ago', noteInk: OK, price: '118,000', ys: [9, 9, 9, 9, 9, 9], href: 'Passport.dc.html' },
      { name: 'Binding wire 25kg', note: 'proposes 94,500', noteInk: DIM, price: '96,000', ys: [8, 10, 11, 12, 12, 12], href: 'Proposals.dc.html' },
      { name: 'Hoop iron 0.5mm', note: 'Katwe is 1,500 cheaper', noteInk: WARN, price: '23,500', ys: [2, 4, 6, 8, 12, 15], href: 'Deal.dc.html' },
      { name: 'Flat bar 25 × 3', note: '52 days since a price', noteInk: WARN, price: '28,000', ys: [7, 7, 7, 7, 7, 7], href: 'AskConfirm.dc.html' }
    ]'''
extra_vals = (",\n      plan: () => this.setState({ planned: !S.planned }),"
              "\n      planLabel: S.planned ? 'On tomorrow’s walk · tap to take off' : 'Put Kiseka on the next walk',"
              "\n      planStyle: S.planned ? 'background:#E4F4EA;color:#0F6B43' : 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)'")
html = scorecard('Kiseka Steel', 'KS', '<span class="m" style="color: #FFFFFF">7</span> days credit · delivers in about <span class="m" style="color: #FFFFFF">3</span> days',
                 [('14', 'orders in 6 months', None), ('31', 'lines priced', None), ('2 d', 'since a visit', '#6FDCB0')],
                 score, lines, top, ft, 'planned: false', extra_vals)
