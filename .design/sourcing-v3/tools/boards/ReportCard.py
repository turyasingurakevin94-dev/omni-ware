from ow import *

# Did it sell? Every item Moses brought in gets a first look 30 days after it went on sale:
# what the verdict expected against what sold. The misses come back to him to decide.
pic = (title_block('Did it sell?', 'Items you brought in · the last <span class="m" style="color: #FFFFFF">90</span> days',
                   ring(11 / 14, '11/14', 60, 6, '#6FDCB0', 'rgba(255,255,255,.1)', 14, '11 of 14 calls right'))
       + '\n' + stats([('7/9', 'Stock calls right', '#6FDCB0'), ('3/3', 'Per order', '#6FDCB0'), ('1/2', 'Consign', '#F5B26B')]))
hd = head('Report card', circ('Main.dc.html', 'back', 'Back to Today'), '', pic)

# the miss: expected against sold, the cash it holds, and three ways out (nothing picked)
miss = '''    <div style="''' + LIST + '''; padding: 12px; display: flex; flex-direction: column; gap: 12px">
      <div style="display: flex; align-items: center; gap: 12px">''' + icon_well('warn', 'amber') + '''<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span class="nm" style="font-size: 14px; font-weight: 700">Masking tape 2"</span><span style="font-size: 12px; font-weight: 600; color: #7A4A02">Stock · on sale 45 days · 38 on the shelf</span></span><span style="flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 1px"><span class="m" style="font-size: 15px; font-weight: 600">152,000</span><span style="font-size: 11px; font-weight: 600; color: #5F6980">cash sitting</span></span></div>
      <div role="img" aria-label="Expected 60 sold by now, 22 sold" style="display: flex; flex-direction: column; gap: 6px; padding: 0 2px">
        <div style="display: flex; align-items: center; gap: 10px"><span style="width: 62px; font-size: 11px; font-weight: 700; color: #5F6980">Expected</span><span style="flex: 1; height: 10px; border-radius: 5px; box-shadow: inset 0 0 0 1.5px #C9C4BA"></span><span class="m" style="width: 26px; text-align: right; font-size: 13px; font-weight: 600">60</span></div>
        <div style="display: flex; align-items: center; gap: 10px"><span style="width: 62px; font-size: 11px; font-weight: 700; color: #5F6980">Sold</span><span style="flex: 1; height: 10px; border-radius: 5px; background: #EFECE6; display: block"><span style="display: block; width: 36.7%; height: 10px; border-radius: 5px; background: #95530C"></span></span><span class="m" style="width: 26px; text-align: right; font-size: 13px; font-weight: 600">22</span></div>
      </div>
      <sc-if value="{{undecided}}" hint-placeholder-val="{{ true }}">
      <div role="radiogroup" aria-label="What to do with it" style="display: flex; flex-direction: column; gap: 2px">
        <sc-for list="{{ways}}" as="w" hint-placeholder-count="3"><button type="button" role="radio" aria-checked="{{w.on}}" onClick="{{w.pick}}" style="{{w.style}}"><span style="width: 22px; height: 22px; flex: none; border-radius: 999px; {{w.dot}}"></span><span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; text-align: left"><span style="font-size: 14px; font-weight: 700">{{w.label}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">{{w.sub}}</span></span><span style="flex: none; height: 22px; padding: 0 8px; border-radius: 999px; font-size: 11px; font-weight: 700; display: flex; align-items: center; {{w.whoStyle}}">{{w.who}}</span></button></sc-for>
      </div>
      </sc-if>
      <sc-if value="{{decided}}" hint-placeholder-val="{{ false }}"><div style="display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 0 8px 0 14px; border-radius: 14px; background: #E4F4EA; color: #0F6B43">''' + svg('tick', 15, 3) + '''<span style="flex: 1; font-size: 13px; font-weight: 700">{{result}}</span><button type="button" onClick="{{undo}}" style="all: unset; cursor: pointer; height: 32px; padding: 0 8px; display: flex; align-items: center; font-size: 13px; font-weight: 700; color: #16203C">Undo</button></div></sc-if>
    </div>'''

# each call, 30 days on: an outlined bar for what was expected, filled for what sold
calls_row = '''      <div style="display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 0 10px; border-top: {{c.rule}}">
        <span style="width: 28px; height: 28px; flex: none; border-radius: 999px; display: flex; align-items: center; justify-content: center; {{c.mark}}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{c.icon}}"></path></svg></span>
        <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px"><span style="display: flex; justify-content: space-between; gap: 8px"><span class="nm" style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{c.name}}</span><span class="m" style="flex: none; font-size: 12px; font-weight: 600">{{c.fig}}</span></span>
          <span role="img" aria-label="{{c.aria}}" style="position: relative; height: 8px; border-radius: 4px; background: #EFECE6; display: block"><span style="position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; {{c.bar}}"></span><span style="position: absolute; top: -3px; bottom: -3px; width: 2px; border-radius: 1px; background: #1C2233; {{c.tick}}"></span></span>
          <span style="font-size: 12px; font-weight: 600; color: #5F6980">{{c.sub}}</span></span>
      </div>'''
calls = '    <div style="' + LIST + '; padding: 0 6px">\n      <sc-for list="{{calls}}" as="c" hint-placeholder-count="4">\n' + calls_row + '\n      </sc-for>\n    </div>'
soon = lst('\n'.join([
    row('Wire mesh BRC A142', 'Stock · expected 40 · first look 16 Nov', icon_well('clock', 'plain'), '', href='Live.dc.html'),
    row('Tile adhesive 20kg', 'Stock · by Ruth’s rule · first look 14 Nov', icon_well('clock', 'plain'), ''),
]))
bd = body('\n'.join([
    sec('Not selling', '<span class="m">1</span> to decide', first=True), miss,
    sec('Your calls, 30 days on', 'line: expected'), calls,
    sec('First look coming'), soon,
]))
ft = foot('<button type="button" onClick="{{decide}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{ctaStyle}}">{{cta}}</button>')

script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { way: null, done: false }; }
  renderVals() {
    const S = this.state;
    const MOSES = 'background:#DCEAF8;color:#1A5A8A', RUTH = 'background:#F6E4F1;color:#7A3268';
    const ways = [
      { k: 'order', label: 'Per order from now', sub: 'Sell the 38, then buy only when someone orders', who: 'you', whoStyle: MOSES, done: 'Per order from now · Denis stops buying it for the shelf' },
      { k: 'price', label: 'Ask Ruth for a lower price', sub: 'Kikuubo sells it for 5,500; ours is 6,000', who: 'Ruth', whoStyle: RUTH, done: 'Asked Ruth · she decides the price' },
      { k: 'drop', label: 'Off sale when the last one sells', sub: 'Then it leaves every app; the askers are kept', who: 'you', whoStyle: MOSES, done: 'Leaves sale with the last roll · Denis and Ruth are told' }
    ].map(w => ({ ...w, on: String(S.way === w.k), pick: () => this.setState({ way: w.k }),
      dot: S.way === w.k ? 'background:#16203C;box-shadow:inset 0 0 0 5px #FFFFFF,0 0 0 2px #16203C' : 'box-shadow:inset 0 0 0 2px #C9C4BA',
      style: 'all:unset;cursor:pointer;box-sizing:border-box;width:100%;display:flex;align-items:center;gap:12px;min-height:64px;padding:0 8px;border-radius:14px;' + (S.way === w.k ? 'background:#F7F5F2' : '') }));
    const pick = ways.find(w => w.k === S.way);
    const OK = { mark: 'background:#E4F4EA;color:#0F6B43', icon: 'M5 12.5l4.5 4.5L19 7.5', fill: '#0F6B43' };
    const NO = { mark: 'background:#FDEEE1;color:#95530C', icon: 'M7 7l10 10M17 7 7 17', fill: '#95530C' };
    const calls = [
      { name: 'Floor drain 4" chrome', hold: 'Stock', exp: 40, sold: 38, unit: '', r: OK },
      { name: 'Ceramic tile 40×40, grey', hold: 'Consign', exp: 300, sold: 340, unit: ' m²', r: OK },
      { name: 'Water tank 1,000 L', hold: 'Per order', exp: 5, sold: 6, unit: ' orders', r: OK },
      { name: 'Roof paint 4 L, red oxide', hold: 'Consign', exp: 20, sold: 9, unit: '', r: NO },
      { name: 'Masking tape 2"', hold: 'Stock', exp: 60, sold: 22, unit: '', r: NO }
    ].map((c, i) => {
      const max = Math.max(c.exp, c.sold) * 1.15;
      return { ...c, rule: i ? '1px solid #EFECE6' : 'none', mark: c.r.mark, icon: c.r.icon,
        fig: c.sold + ' of ' + c.exp + c.unit, sub: c.hold + (c.r === OK ? ' · right' : ' · fewer than expected'),
        bar: 'width:' + (c.sold / max * 100).toFixed(1) + '%;background:' + c.r.fill, tick: 'left:' + (c.exp / max * 100).toFixed(1) + '%',
        aria: 'Expected ' + c.exp + ', sold ' + c.sold };
    });
    return {
      ways, calls, undecided: !S.done, decided: S.done, result: pick ? pick.done : '',
      decide: () => { if (S.way) this.setState({ done: true }); }, undo: () => this.setState({ done: false }),
      cta: S.done ? 'Decided · back to Today' : !S.way ? 'Pick what to do with the tape' : pick.k === 'price' ? 'Ask Ruth' : 'Decide · Denis is told',
      ctaStyle: S.done ? 'background:#E4F4EA;color:#0F6B43' : S.way ? 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)' : 'background:#F3D3CF;color:#8E2A22'
    };
  }
}'''
html = page('Report card', hd + '\n' + bd + '\n' + ft, script)
