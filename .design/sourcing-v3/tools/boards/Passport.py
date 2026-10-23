from ow import *

photo = ('<a href="PhotoGate.dc.html" aria-label="No photo yet: take it" style="width: 64px; height: 64px; flex: none; border-radius: 16px; box-shadow: inset 0 0 0 1.5px rgba(245,178,107,.7); background: rgba(255,255,255,.05); color: #F5B26B; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px">'
         + svg('camera', 22, 2) + '<span style="font-size: 10px; font-weight: 700">no photo</span></a>')
strip = '''    <div role="img" aria-label="{{stripAria}}" style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px">
      <sc-for list="{{gates}}" as="g" hint-placeholder-count="6">
        <span style="display: flex; flex-direction: column; align-items: center; gap: 6px">
          <span style="width: 100%; height: 8px; border-radius: 999px; {{g.pip}}"></span>
          <span style="font-size: 10px; font-weight: 700; color: #B3BCD2; white-space: nowrap">{{g.short}}</span>
        </span>
      </sc-for>
    </div>'''
pic = title_block('Wire mesh BRC A142', '2.4 × 4.8 m sheet · Steel &amp; mesh · {{gapLine}}', photo) + '\n' + strip
hd = head('Item passport', circ('Funnel.dc.html', 'back', 'Back to the Funnel'), '<span style="flex: none; height: 30px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,.1); font-size: 12px; font-weight: 700; display: flex; align-items: center">Quoted</span>', pic)

gate_row = '''      <a href="{{g.href}}" style="display: flex; align-items: center; gap: 12px; min-height: 62px; padding: 0 10px; border-radius: 16px">
        <span style="width: 42px; height: 42px; flex: none; border-radius: 13px; display: flex; align-items: center; justify-content: center; {{g.well}}"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{g.icon}}"></path></svg></span>
        <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span class="nm" style="font-size: 14px; font-weight: 700">{{g.label}}</span><span style="font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; {{g.subInk}}">{{g.state}}</span></span>
        <span style="flex: none; height: 26px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 4px; {{g.chip}}">{{g.chipWord}}</span>
      </a>'''
keep = '''      <sc-if value="{{hasAuto}}" hint-placeholder-val="{{ true }}">
      <div style="display: flex; align-items: center; gap: 10px; margin: 4px 4px 6px; padding: 10px 12px; border-radius: 14px; background: #F4FAF6; box-shadow: inset 0 0 0 1px #D3EBDD">
        <span style="flex: 1; font-size: 12px; font-weight: 700; color: #0F6B43"><span class="m">{{autoN}}</span> filled for you, from Kiseka’s price row and the askers’ words</span>
        <button type="button" onClick="{{keepAll}}" style="all: unset; cursor: pointer; flex: none; height: 34px; padding: 0 14px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center">Keep {{autoWord}}</button>
      </div>
      </sc-if>'''
ladder = '''    <div style="''' + LIST + '''; padding: 14px; display: flex; flex-direction: column; gap: 12px">
      <div style="position: relative; display: flex; flex-direction: column; gap: 10px">
        <div aria-hidden="true" style="position: absolute; top: 0; bottom: 18px; left: 30%; width: 51.7%; background: #E4F4EA; border-radius: 6px"></div>
        <sc-for list="{{ladder}}" as="r" hint-placeholder-count="4">
          <div style="position: relative; display: flex; flex-direction: column; gap: 3px">
            <span style="display: flex; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 600"><span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0">{{r.name}}</span><span class="m">{{r.price}}</span></span>
            <span style="display: block; height: 10px; border-radius: 6px; {{r.bar}}"></span>
          </div>
        </sc-for>
        <div class="m" style="position: relative; display: flex; justify-content: space-between; font-size: 11px; color: #5F6980"><span>100,000</span><span>130,000</span><span>160,000</span></div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 12px; border-radius: 14px; background: #E4F4EA; color: #0F6B43">
        <span style="flex: 1; font-size: 13px; font-weight: 700">Room under the cheapest rival</span>
        <span class="m" style="font-size: 15px; font-weight: 600">31,000</span>
        <span style="height: 24px; padding: 0 8px; border-radius: 999px; background: #0F6B43; color: #FFFFFF; font-size: 11px; font-weight: 700; display: flex; align-items: center">Strong</span>
      </div>
    </div>'''
mini_gauge = '''<span role="img" aria-label="Score 68" style="position: relative; width: 42px; height: 42px; flex: none; border-radius: 13px; background: #E4F4EA; overflow: hidden"><span style="position: absolute; left: 5px; top: 8px; width: 32px; height: 32px; border-radius: 999px; background: conic-gradient(from 270deg, #0F6B43 0deg 122deg, #C9E5D5 122deg 180deg, transparent 180deg)"></span><span style="position: absolute; left: 10px; top: 13px; width: 22px; height: 22px; border-radius: 999px; background: #E4F4EA"></span><span class="m" style="position: absolute; left: 0; right: 0; top: 18px; text-align: center; font-size: 11px; font-weight: 600; color: #0F6B43">68</span></span>'''
verdict = lst(row('Stock is recommended', 'Not chosen yet · your Stock calls: 7 of 9 right', mini_gauge,
                  '<span style="flex: none; height: 30px; padding: 0 12px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 12px; font-weight: 700; display: flex; align-items: center">Choose</span>',
                  href='Verdict.dc.html', sub_style='color: #7A4A02'))
askers = lst('\n'.join(row(n, v, face(i, t), f'<span style="flex: none; display: flex; align-items: center; gap: 8px"><span style="width: 56px; height: 6px; border-radius: 3px; background: #EFECE6; display: block"><span style="display: block; height: 6px; border-radius: 3px; background: #5F6980; width: {round(q/20*100)}%"></span></span><span class="m" style="width: 22px; text-align: right; font-size: 14px; font-weight: 600">{q}</span></span>')
                       for i, t, n, v, q in [('KC', 'sky', 'Kato Construction', 'via Grace Akello', 20), ('LB', 'manager', 'Lubowa Builders', 'via Brian Ouma', 12), ('MR', 'teal', 'Mukono Roofing', 'via Aisha Namutebi, agent', 8)]))
bd = body('\n'.join([
    sec('Six checks', '{{doneLine}}', first=True),
    '    <div style="' + LIST + '; padding: 6px; display: flex; flex-direction: column; gap: 2px">\n      <sc-for list="{{gates}}" as="g" hint-placeholder-count="6">\n' + gate_row + '\n      </sc-for>\n' + keep + '\n    </div>',
    sec('How we hold it'), verdict,
    sec('Cost against the market', 'a sheet'), ladder,
    sec('Waiting for it', '<span class="m">40</span> sheets · <span class="m">9</span> days'), askers,
]))
ft = foot(pill('{{fixLabel}}', href='GapWalk.dc.html', kind='red', icon='chev'))

script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { kept: false }; }
  renderVals() {
    const kept = this.state.kept;
    const AUTO = kept ? 'd' : 'a';
    const S = {
      d: { pip: 'background:#6FDCB0', well: 'background:#E4F4EA;color:#0F6B43', chip: 'background:#E4F4EA;color:#0F6B43', word: 'Done', sub: 'color:#5F6980' },
      a: { pip: 'background:repeating-linear-gradient(135deg,#6FDCB0 0 3px,rgba(111,220,176,.25) 3px 6px)', well: 'background:#FFFFFF;color:#0F6B43;box-shadow:inset 0 0 0 1.5px #0F6B43', chip: 'background:#FFFFFF;color:#0F6B43;box-shadow:inset 0 0 0 1.5px #0F6B43', word: 'Check', sub: 'color:#0F6B43' },
      g: { pip: 'background:#F5B26B', well: 'background:#FDEEE1;color:#95530C', chip: 'background:#FDEEE1;color:#7A4A02', word: 'Gap', sub: 'color:#7A4A02' },
      t: { pip: 'background:rgba(255,255,255,.14)', well: 'background:#F1EEE8;color:#5F6980', chip: 'background:#F1EEE8;color:#5F6980', word: 'Ruth', sub: 'color:#5F6980' }
    };
    const gates = [
      { label: 'Photo', short: 'Photo', s: 'g', state: 'Not taken', href: 'PhotoGate.dc.html', icon: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z' },
      { label: 'Packing', short: 'Pack', s: AUTO, state: kept ? 'By the sheet' : 'By the sheet · filled for you', href: 'PackingGate.dc.html', icon: 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9' },
      { label: 'Suppliers', short: 'Supply', s: 'd', state: 'Kiseka Steel · Katwe Fabricators', href: 'SuppliersGate.dc.html', icon: 'M3 21V9l9-5 9 5v12M8 21v-7h8v7' },
      { label: 'How we hold it', short: 'Hold', s: 'g', state: 'Not chosen · Stock recommended', href: 'Verdict.dc.html', icon: 'M4 18a8 8 0 0 1 16 0M12 18l4-6' },
      { label: 'Name & aisle', short: 'Name', s: AUTO, state: kept ? 'Steel & mesh' : 'Steel & mesh · filled for you', href: 'NameAisle.dc.html', icon: 'M4 6h16M4 12h10M4 18h7' },
      { label: 'Markup', short: 'Markup', s: 't', state: 'Ruth sets it once you send', href: 'SendToManager.dc.html', icon: 'M3 12V4h8l10 10-8 8zM7.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z' }
    ].map(g => ({ ...g, pip: S[g.s].pip, well: S[g.s].well, chip: S[g.s].chip, chipWord: S[g.s].word, subInk: S[g.s].sub }));
    const done = gates.filter(g => g.s === 'd').length, gaps = gates.filter(g => g.s === 'g').length, auto = gates.filter(g => g.s === 'a').length;
    const pos = (p) => ((p - 100000) / 60000 * 100).toFixed(1) + '%';
    const ladder = [
      { name: 'Kiseka Steel · 2 days ago', p: 118000, c: '#0F6B43' },
      { name: 'Katwe Fabricators · 5 days ago', p: 121500, c: '#6B7480' },
      { name: 'Kikuubo Hardware Mart · rival', p: 149000, c: '#7A3268' },
      { name: 'Nateete Builders’ Centre · rival', p: 152000, c: '#7A3268' }
    ].map(r => ({ ...r, price: r.p.toLocaleString('en-US'), bar: 'width:' + pos(r.p) + ';background:' + r.c }));
    return {
      gates, ladder, hasAuto: auto > 0, autoN: auto, autoWord: auto === 1 ? 'it' : 'both',
      keepAll: () => this.setState({ kept: true }),
      doneLine: done + ' of 6 kept' + (auto ? ' · ' + auto + ' to check' : ''),
      gapLine: gaps + ' gaps before Ruth',
      fixLabel: auto ? 'Check ' + auto + ', fix ' + gaps + ' gaps' : 'Fix ' + gaps + ' gaps',
      stripAria: gates.map(g => g.label + ': ' + S[g.s].word).join(', ')
    };
  }
}'''
html = page('Item passport', hd + '\n' + bd + '\n' + ft, script)
