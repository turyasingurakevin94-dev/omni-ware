from ow import *

pic = title_block('Hoop iron 0.5mm', 'Switch to Katwe Fabricators · <span class="m" style="color: #FFFFFF">1,500</span> × <span class="m" style="color: #FFFFFF">140</span> rolls', icon_well('deal', 'indigo', 52, 16)) + '\n' + stats([('23,500', 'Kiseka · a roll', None), ('22,000', 'Katwe · a roll', '#6FDCB0'), ('210,000', 'a month', '#6FDCB0')])
hd = head('A deal', circ('Prices.dc.html', 'back', 'Back to Prices'), '', pic)
cmp = '''    <div style="''' + LIST + '''; padding: 4px 6px">
      <div style="display: grid; grid-template-columns: 1.1fr 1fr 1fr; gap: 6px; align-items: center; min-height: 40px; padding: 0 10px; font-size: 11px; font-weight: 700; color: #5F6980"><span></span><span style="text-align: right">Kiseka · now</span><span style="text-align: right">Katwe</span></div>
      <sc-for list="{{rows}}" as="r" hint-placeholder-count="4">
        <div style="display: grid; grid-template-columns: 1.1fr 1fr 1fr; gap: 6px; align-items: center; min-height: 46px; padding: 0 10px; border-top: 1px solid #EFECE6">
          <span style="font-size: 12px; font-weight: 600; color: #5F6980">{{r.k}}</span>
          <span class="m" style="text-align: right; font-size: 14px; font-weight: 600">{{r.a}}</span>
          <span class="m" style="text-align: right; font-size: 14px; font-weight: 600; {{r.bInk}}">{{r.b}}</span>
        </div>
      </sc-for>
    </div>'''
chart = '''    <div style="''' + LIST + '''; padding: 14px; display: flex; flex-direction: column; gap: 10px">
      <svg width="318" height="120" viewBox="0 0 326 120" role="img" aria-label="Kiseka rose from 20,000 to 23,500; Katwe's price held at 22,000">
        <line x1="0" y1="14" x2="326" y2="14" stroke="#EFECE6"></line><line x1="0" y1="60" x2="326" y2="60" stroke="#EFECE6"></line><line x1="0" y1="106" x2="326" y2="106" stroke="#EFECE6"></line>
        <polyline points="10,106 70,95 130,83 190,72 250,51 310,28" fill="none" stroke="#3A3F9B" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"></polyline><circle cx="310" cy="28" r="4" fill="#3A3F9B"></circle>
        <polyline points="190,60 250,60 310,60" fill="none" stroke="#0F6B43" stroke-width="2.4" stroke-dasharray="5 4"></polyline><circle cx="310" cy="60" r="4" fill="#0F6B43"></circle>
        <text x="0" y="10" font-family="IBM Plex Mono, monospace" font-size="11" fill="#5F6980">24,000</text><text x="0" y="118" font-family="IBM Plex Mono, monospace" font-size="11" fill="#5F6980">20,000</text>
      </svg>
      <div style="display: flex; gap: 14px; font-size: 11px; font-weight: 700; color: #5F6980"><span style="display: flex; align-items: center; gap: 5px"><i style="width: 14px; height: 3px; background: #3A3F9B; display: inline-block"></i>Kiseka, what we paid</span><span style="display: flex; align-items: center; gap: 5px"><i style="width: 14px; height: 3px; background: #0F6B43; display: inline-block"></i>Katwe, their price</span></div>
    </div>'''
risk = '    <div style="display: flex; align-items: center; gap: 12px; min-height: 62px; padding: 0 14px; border-radius: 20px; background: #FFFBF6; box-shadow: inset 0 0 0 1.5px #F3DCC4">' + icon_well('warn', 'amber', 40, 12) + '<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; font-weight: 700">Katwe fills <span class="m">76%</span> · our average is <span class="m">90%</span></span><span style="font-size: 12px; font-weight: 600; color: #7A4A02">≈5 days to deliver · keep Kiseka as second choice</span></span></div>'
ask = '    <button type="button" onClick="{{ask}}" style="all: unset; cursor: pointer; box-sizing: border-box; display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 14px; border-radius: 20px; box-shadow: inset 0 0 0 1px #E6E3DD">' + face('KF', 'indigo', 32) + '<span style="flex: 1; font-size: 13px; font-weight: 700">{{askLabel}}</span>' + chev() + '</button>'
form = ('  <sc-if value="{{open}}" hint-placeholder-val="{{ true }}">\n  <div style="position: absolute; inset: 0; display: flex; flex-direction: column">\n' + hd + '\n'
        + body('\n'.join([sec('Side by side', first=True), cmp, sec('A roll, over six months', 'what we paid · their price'), chart, risk, ask])) + '\n'
        + dock('Denis decides who we buy from', 'you pass it on', slide('Slide to pass it to Denis', '{{pass}}', 'send')) + '\n  </div>\n  </sc-if>')
tr = track([
    ('done', '', 'Passed', 'by you, 17:30', '#B3BCD2'),
    ('now', '<span style="width: 44px; height: 44px; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 3px #19223F, 0 0 0 5px #F5B26B; animation: owRingA 2s infinite">DO</span>', 'Denis', 'decides', '#F5B26B'),
    ('later', svg('supplier', 19, 2), 'Next buy', 'from Katwe, or not', '#B3BCD2'),
], 'A buzz on this phone when Denis decides')
done = ('  <sc-if value="{{passed}}" hint-placeholder-val="{{ false }}">\n'
        + done_screen('send', 'With Denis', 'Hoop iron 0.5mm · switch to Katwe',
                      '<div style="width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-radius: 20px; background: rgba(255,255,255,.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07)"><span style="height: 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px"><span class="m" style="font-size: 22px; font-weight: 600; line-height: 1; color: #6FDCB0">210,000</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">a month, if Denis switches</span></span><span style="height: 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; box-shadow: -1px 0 0 rgba(255,255,255,.07)"><span class="m" style="font-size: 22px; font-weight: 600; line-height: 1; color: #F5B26B">76%</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">Katwe fills</span></span></div>',
                      tr, 'Prices.dc.html', undo_click='{{undo}}', done_label='Back to Prices')
        + '\n  </sc-if>')
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { passed: false, asked: false }; }
  renderVals() {
    const GOOD = 'color:#0F6B43', WARN = 'color:#7A4A02';
    const rows = [
      { k: 'A roll', a: '23,500', b: '22,000', bInk: GOOD },
      { k: 'Fills lines', a: '94%', b: '76%', bInk: WARN },
      { k: 'Delivers in', a: '3 d', b: '5 d', bInk: WARN },
      { k: 'Orders, 6 mo', a: '14', b: '4', bInk: '' }
    ];
    const p = this.state.passed;
    return {
      rows, open: !p, passed: p,
      ask: () => this.setState({ asked: true }), askLabel: this.state.asked ? 'Asked Katwe on WhatsApp · 17:24' : 'Ask Katwe to confirm 22,000 first',
      pass: () => this.setState({ passed: true }), undo: () => this.setState({ passed: false })
    };
  }
}'''
html = page('A deal', form + '\n' + done, script)
