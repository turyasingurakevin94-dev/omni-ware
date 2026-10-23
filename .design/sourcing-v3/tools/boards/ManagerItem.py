from ow import *

line = '''    <div role="img" aria-label="Cost 118,000, our price {{price}}, Kikuubo 149,000" style="position: relative; height: 72px; margin: 0 6px">
      <span style="position: absolute; left: 0; right: 0; top: 34px; height: 4px; border-radius: 2px; background: rgba(255,255,255,.12)"></span>
      <span style="position: absolute; top: 34px; height: 4px; border-radius: 2px; background: #6FDCB0; {{marginBand}}"></span>
      <sc-for list="{{marks}}" as="k" hint-placeholder-count="3">
        <span style="position: absolute; display: flex; gap: 5px; {{k.pos}}">
          <span style="display: flex; align-items: baseline; gap: 5px; white-space: nowrap"><span style="font-size: 11px; font-weight: 700; {{k.ink}}">{{k.label}}</span><span class="m" style="font-size: 11px; font-weight: 600; color: #B3BCD2">{{k.v}}</span></span>
          <span style="width: 12px; height: 12px; border-radius: 999px; {{k.dot}}"></span>
        </span>
      </sc-for>
    </div>'''
pic = title_block('Wire mesh BRC A142', 'From Moses Lubega · <span class="m" style="color: #FFFFFF">2</span> h ago · sent with <span class="m" style="color: #FFFFFF">5</span> of 6 checks', face('ML', 'sky', 52, '0 0 0 3px #1D2747, 0 0 0 5px rgba(111,220,176,.55)')) + '\n' + line + '\n' + stats([('{{price}}', 'shelf price', None), ('{{margin}}', 'margin a sheet', '#6FDCB0'), ('{{vsRival}}', '{{vsWord}}', None)])
hd = head('Manager app · new item', circ('Main.dc.html', 'close', 'Close'), '', pic, gap=14)

fact_rows = '\n'.join(row(k, v, icon_well(ic, 'plain'), f'<span class="m" style="flex: none; font-size: 12px; font-weight: 600; color: #5F6980">{n}</span>' if n else '')
                      for ic, k, v, n in [('M4 18a8 8 0 0 1 16 0M12 18l4-6', 'Hold · Moses chose Stock', 'Denis decides the first batch · ≈40 suggested', ''),
                                          ('supplier', 'Suppliers', 'Kiseka Steel · Katwe Fabricators', '2'),
                                          ('box', 'Packing', 'By the sheet, 2.4 × 4.8 m', ''),
                                          ('ask', 'Waiting', '3 customers · 40 sheets', ''),
                                          ('rival', 'Rivals', 'Kikuubo 149,000 · Nateete 152,000', '')])
back_block = '''    <sc-if value="{{showBack}}" hint-placeholder-val="{{ false }}">
    <span style="padding: 8px 4px 0; font-size: 13px; font-weight: 700; color: #5F6980">What needs fixing?</span>
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
      <sc-for list="{{reasons}}" as="r" hint-placeholder-count="4"><button type="button" aria-pressed="{{r.on}}" onClick="{{r.pick}}" style="{{r.style}}">{{r.label}}</button></sc-for>
    </div>
    <a href="SentBack.dc.html" style="height: 52px; border-radius: 999px; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{backStyle}}">{{backLabel}}</a>
    </sc-if>'''
bd = body('\n'.join([
    sec('Markup', '{{ruleNote}}', first=True),
    '    <div style="' + LIST + '; padding: 12px 14px">' + stepper('mk_pct', '{{pct}}', '%', '{{less}}', '{{more}}', 'Markup in percent') + '</div>',
    sec('What Moses sent'), lst(fact_rows),
    '    <button type="button" onClick="{{toggleBack}}" style="all: unset; cursor: pointer; box-sizing: border-box; display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 14px; border-radius: 20px; box-shadow: inset 0 0 0 1px #E6E3DD">' + svg('returned', 18, 2, '#5F6980') + '<span style="flex: 1; font-size: 13px; font-weight: 700">Not ready? Send it back to Moses</span>' + chev() + '</button>',
    back_block,
    '    <a href="ManagerRule.dc.html" style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 14px; border-radius: 20px; box-shadow: inset 0 0 0 1px #E6E3DD">' + svg('tag', 18, 2, '#5F6980') + '<span style="flex: 1; font-size: 13px; font-weight: 700">Put items like this on sale by a rule</span>' + chev() + '</a>',
]))
ft = foot(pill('Put it on sale at <span class="m">{{price}}</span>', href='Live.dc.html', kind='red'))

script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { pct: 25, back: false, reason: null }; }
  renderVals() {
    // Moses chose Stock, so the cost is Kiseka's own 118,000 (a consigned cost would be 125,100)
    const COST = 118000, RIVAL = 149000;
    const fmt = (n) => Math.round(n).toLocaleString('en-US');
    const pct = this.state.pct;
    const price = Math.round(COST * (1 + pct / 100) / 500) * 500;
    const lo = 112000, hi = 156000;
    const at = (v) => ((v - lo) / (hi - lo) * 100);
    const under = RIVAL - price;
    // labels hang away from each other: cost to the right of its dot, our price to the left, the rival right-anchored
    const marks = [
      { label: 'Cost', v: fmt(COST), p: COST, dot: 'background:#8D99B5', ink: 'color:#B3BCD2', side: 'left' },
      { label: 'Ours', v: fmt(price), p: price, dot: 'background:#FFFFFF;box-shadow:0 0 0 3px rgba(255,255,255,.2)', ink: 'color:#FFFFFF', side: 'right' },
      { label: 'Kikuubo', v: fmt(RIVAL), p: RIVAL, dot: 'background:#E7A6D6', ink: 'color:#E7A6D6', side: 'rival' }
    ].map(k => ({ ...k, pos: k.side === 'left' ? 'top:12px;flex-direction:column;left:calc(' + at(k.p).toFixed(1) + '% - 6px);align-items:flex-start'
      : k.side === 'rival' ? 'top:30px;flex-direction:column-reverse;right:calc(' + (100 - at(k.p)).toFixed(1) + '% - 6px);align-items:flex-end'
      : 'top:12px;flex-direction:column;right:calc(' + (100 - at(k.p)).toFixed(1) + '% - 6px);align-items:flex-end' }));
    const reason = this.state.reason;
    const reasons = ['The photo', 'Packing is wrong', 'Needs a second price', 'Hold it differently'].map(label => ({
      label, on: String(reason === label), pick: () => this.setState({ reason: label }),
      style: 'all:unset;cursor:pointer;box-sizing:border-box;min-height:52px;padding:0 12px;border-radius:16px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;text-align:center;' +
        (reason === label ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;box-shadow:inset 0 0 0 1.5px #E6E3DD')
    }));
    return {
      pct, price: fmt(price), margin: fmt(price - COST), marks, reasons,
      vsRival: fmt(Math.abs(under)), vsWord: under >= 0 ? 'under Kikuubo' : 'over Kikuubo',
      ruleNote: pct === 25 ? 'the shop’s default, 25%' : 'its own markup · logged',
      marginBand: 'left:' + at(COST).toFixed(1) + '%;width:' + ((price - COST) / (hi - lo) * 100).toFixed(1) + '%',
      showBack: this.state.back,
      toggleBack: () => this.setState({ back: !this.state.back }),
      backLabel: reason ? 'Send it back · ' + reason.toLowerCase() : 'Pick what needs fixing',
      backStyle: reason ? 'background:#FFFFFF;color:#16203C;box-shadow:inset 0 0 0 1.5px #16203C' : 'background:#F1EEE8;color:#5F6980;pointer-events:none',
      less: () => this.setState({ pct: Math.max(0, pct - 1) }),
      more: () => this.setState({ pct: pct + 1 })
    };
  }
}'''
html = page('Manager app · new item', hd + '\n' + bd + '\n' + ft, script)
