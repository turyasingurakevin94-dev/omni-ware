from ow import *

pic = title_block('Kiseka Steel', 'On the supplier app · answers <span class="m" style="color: #FFFFFF">9</span> of <span class="m" style="color: #FFFFFF">10</span> asks within a day', face('KS', 'indigo', 52)) + '\n' + stats([('5', 'older than 30 days', '#F5B26B'), ('52 d', 'the oldest', None), ('0', 'trips needed', '#6FDCB0')])
hd = head('Ask instead of a visit', circ('SupplierKiseka.dc.html', 'back', 'Back to Kiseka Steel'), '', pic)
arow = '''      <button type="button" role="checkbox" aria-checked="{{r.onStr}}" onClick="{{r.toggle}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 12px; min-height: 66px; padding: 0 10px; border-top: {{r.rule}}">
        <span style="width: 28px; height: 28px; flex: none; border-radius: 9px; display: flex; align-items: center; justify-content: center; {{r.box}}">''' + svg('tick', 14, 3) + '''</span>
        <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span class="nm" style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{r.name}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980"><span class="m" style="color: #1C2233">{{r.price}}</span> {{r.per}}</span></span>
        <span style="flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 4px"><span style="width: 60px; height: 5px; border-radius: 3px; background: #EFECE6; display: block"><span style="display: block; height: 5px; border-radius: 3px; background: #95530C; {{r.age}}"></span></span><span style="font-size: 11px; font-weight: 700; color: #7A4A02"><span class="m">{{r.d}}</span> days</span></span>
      </button>'''
form = ('  <sc-if value="{{notSent}}" hint-placeholder-val="{{ true }}">\n  <div style="position: absolute; inset: 0; display: flex; flex-direction: column">\n' + hd + '\n'
        + body('\n'.join([sec('Pick the ones to ask about', '<span class="m">{{on}}</span> of 5', first=True),
                          '    <div style="' + LIST + '; padding: 0 6px">\n      <sc-for list="{{rows}}" as="r" hint-placeholder-count="5">\n' + arow + '\n      </sc-for>\n    </div>',
                          '    <span style="padding: 0 4px; font-size: 12px; font-weight: 600; color: #5F6980">Kiseka gets a push and taps Still the same or Changed for each</span>'])) + '\n'
        + dock('{{dockLine}}', '<a href="SupplierConfirm.dc.html" style="color: #FFFFFF; text-decoration: underline; text-underline-offset: 3px">what Kiseka sees</a>', slide('{{slideLabel}}', '{{send}}', 'send', disabled_hole='{{slideOff}}'))
        + '\n  </div>\n  </sc-if>')
tr = track([
    ('done', '', 'Asked', 'by you, 18:20', '#B3BCD2'),
    ('now', '<span style="width: 44px; height: 44px; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 3px #19223F, 0 0 0 5px #F5B26B; animation: owRingA 2s infinite">KS</span>', 'Kiseka', 'taps each one', '#F5B26B'),
    ('later', svg('tag', 19, 2), 'Proposals', 'you accept', '#B3BCD2'),
], 'A buzz on this phone when Kiseka answers')
done = ('  <sc-if value="{{sent}}" hint-placeholder-val="{{ false }}">\n'
        + done_screen('send', 'Asked Kiseka', '<span class="m">{{on}}</span> prices · no trip needed',
                      '<div style="width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-radius: 20px; background: rgba(255,255,255,.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07)"><span style="height: 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px"><span class="m" style="font-size: 22px; font-weight: 600; line-height: 1; color: #6FDCB0">{{on}}</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">asked</span></span><span style="height: 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; box-shadow: -1px 0 0 rgba(255,255,255,.07)"><span class="m" style="font-size: 22px; font-weight: 600; line-height: 1">≈1 d</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">Kiseka usually answers</span></span></div>',
                      tr, 'SupplierKiseka.dc.html', undo_click='{{undo}}', done_label='Back to Kiseka Steel')
        + '\n  </sc-if>')
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { on: {}, sent: false }; }
  renderVals() {
    const S = this.state;
    // the 5 of Kiseka's 31 lines that are not fresh (26 of 31 are), oldest first
    const base = [
      { id: 'a', name: 'Flat bar 25 × 3', price: '28,000', per: 'a bar', d: 52 },
      { id: 'b', name: 'Y10 rebar, 12m', price: '29,500', per: 'a bar', d: 41 },
      { id: 'c', name: 'Angle bar 40 × 40, 6m', price: '46,000', per: 'a length', d: 36 },
      { id: 'd', name: 'Wire mesh BRC A98', price: '96,000', per: 'a sheet', d: 33 },
      { id: 'e', name: 'Barbed wire 25kg', price: '135,000', per: 'a roll', d: 31 }
    ];
    const rows = base.map((r, i) => {
      const on = !!S.on[r.id];
      return { ...r, onStr: String(on), rule: i ? '1px solid #EFECE6' : 'none', age: 'width:' + Math.min(100, Math.round(r.d / 60 * 100)) + '%',
        box: on ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;color:transparent;box-shadow:inset 0 0 0 1.5px #C9C4BA',
        toggle: () => this.setState({ on: { ...S.on, [r.id]: !on } }) };
    });
    const on = rows.filter(r => r.onStr === 'true').length;
    return {
      rows, on, sent: S.sent, notSent: !S.sent,
      dockLine: on ? on + ' picked' : 'None picked yet',
      slideLabel: on ? 'Slide to ask Kiseka about ' + on : 'Pick the prices first',
      slideOff: String(!on), slideOpacity: on ? '1' : '.72',
      send: () => { if (on) this.setState({ sent: true }); }, undo: () => this.setState({ sent: false })
    };
  }
}'''
html = page('Ask instead of a visit', form + '\n' + done, script)
