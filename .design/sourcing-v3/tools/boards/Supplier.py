from _shared import *

terms = '''    <div style="''' + LIST + '''; padding: 6px">
      <button type="button" onClick="{{toggleEdit}}" aria-expanded="{{editOn}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 12px; min-height: 62px; padding: 0 10px; border-radius: 16px">''' + icon_well('clock', 'plain') + '''<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700"><span class="m">{{credit}}</span> days credit · delivers {{days}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">Plumbing · PVC · taps{{extraTag}}</span></span><span style="flex: none; font-size: 12px; font-weight: 700; color: #16203C">{{editWord}}</span></button>
      <sc-if value="{{editing}}" hint-placeholder-val="{{ false }}">
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 4px 10px 12px">
        <span style="font-size: 12px; font-weight: 700; color: #5F6980">Days of credit</span>
        <div style="display: flex; gap: 6px"><sc-for list="{{creditOpts}}" as="c" hint-placeholder-count="3"><button type="button" aria-pressed="{{c.on}}" onClick="{{c.pick}}" style="{{c.style}}">{{c.label}}</button></sc-for></div>
        <span style="font-size: 12px; font-weight: 700; color: #5F6980">Delivers on</span>
        <div style="display: flex; flex-wrap: wrap; gap: 6px"><sc-for list="{{dayOpts}}" as="d" hint-placeholder-count="6"><button type="button" aria-pressed="{{d.on}}" onClick="{{d.pick}}" style="{{d.style}}">{{d.label}}</button></sc-for></div>
        <button type="button" onClick="{{addTag}}" style="all: unset; cursor: pointer; align-self: flex-start; height: 34px; padding: 0 12px; border-radius: 999px; box-shadow: inset 0 0 0 1.5px #C9C4BA; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px">''' + svg('plus', 13, 2.4) + '''what they sell</button>
      </div>
      </sc-if>
    </div>
    <a href="Twins.dc.html" style="display: flex; align-items: center; gap: 12px; min-height: 62px; padding: 0 14px; border-radius: 20px; background: #FFFBF6; box-shadow: inset 0 0 0 1.5px #F3DCC4">''' + icon_well('twins', 'amber', 40, 12) + '''<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">“Owino Plumbing &amp; Sanitary” · the same?</span><span style="font-size: 12px; font-weight: 600; color: #7A4A02">same phone · 3 lines of its own</span></span>''' + chev('#95530C') + '''</a>'''
ft = foot(pill('Start a visit', href='Visit.dc.html', kind='red', icon='chev'))
score = '''[
      { label: 'Cheapest on', fig: '15 of 19', of: 'lines we buy from 2+', v: 79, avg: 70 },
      { label: 'Fills the order', fig: '41 of 44', of: 'lines', v: 93, avg: 90 },
      { label: 'Prices fresh', fig: '21 of 24', of: 'lines', v: 88, avg: 83 },
      { label: 'Delivers in', fig: '1 day', of: 'median', v: 85, avg: 70 }
    ]'''
lines = '''[
      { name: 'PPR elbow 25mm', note: 'cheapest · 21 days old', noteInk: OK, price: '1,200', ys: [8, 8, 9, 9, 9, 9] },
      { name: 'Gate valve ½"', note: '34 days old · in today’s share', noteInk: WARN, price: '18,500', ys: [6, 7, 7, 8, 9, 9] },
      { name: 'Ball valve ¾"', note: '40 days old · in today’s share', noteInk: WARN, price: '14,000', ys: [9, 9, 9, 9, 9, 9] },
      { name: 'PVC pipe 4" × 6m', note: 'proposes 44,000', noteInk: DIM, price: '42,000', ys: [7, 8, 9, 10, 11, 11], href: 'Proposals.dc.html' },
      { name: 'Pillar tap ½"', note: 'no photo yet', noteInk: WARN, price: '9,500', ys: [10, 10, 9, 9, 9, 9] }
    ]'''
extra_vals = ''',
      credit: S.credit, days: S.days.slice().sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join(', ') || 'no set days',
      extraTag: S.extra ? ' · fittings' : '',
      editing: S.edit, editOn: String(S.edit), editWord: S.edit ? 'Done' : 'Edit',
      toggleEdit: () => this.setState({ edit: !S.edit }), addTag: () => this.setState({ extra: true }),
      creditOpts: [7, 14, 30].map(n => ({ label: n + ' d', on: String(S.credit === n), pick: () => this.setState({ credit: n }), style: CHIP(S.credit === n) })),
      dayOpts: ORDER.map(d => ({ label: d, on: String(S.days.includes(d)), style: CHIP(S.days.includes(d)), pick: () => this.setState({ days: S.days.includes(d) ? S.days.filter(x => x !== d) : S.days.concat(d) }) }))'''
html = scorecard('Owino Plumbing', 'OP', '<span class="m" style="color: #FFFFFF">{{credit}}</span> days credit · delivers {{days}}',
                 [('22', 'orders in 6 months', None), ('24', 'lines priced', None), ('12 d', 'since a visit', '#F5B26B')],
                 score, lines, terms, ft, "edit: false, credit: 14, days: ['Tue', 'Fri'], extra: false", extra_vals)
html = html.replace("    const S = this.state;", "    const S = this.state;\n    const ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];\n    const CHIP = (on) => 'all:unset;cursor:pointer;box-sizing:border-box;height:34px;padding:0 12px;border-radius:999px;font-size:12px;font-weight:700;display:flex;align-items:center;' + (on ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;box-shadow:inset 0 0 0 1.5px #E6E3DD');", 1)
