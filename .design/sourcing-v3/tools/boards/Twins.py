from ow import *

pair = '''    <div style="display: flex; align-items: center; gap: 10px">
      <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 8px; border-radius: 18px; background: rgba(255,255,255,.07)">''' + face('OP', 'indigo', 44) + '''<span style="font-size: 13px; font-weight: 700; text-align: center">Owino Plumbing</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2"><span class="m">24</span> lines · <span class="m">22</span> orders</span></span>
      <span style="flex: none; width: 34px; height: 34px; border-radius: 999px; background: rgba(245,178,107,.16); color: #F5B26B; display: flex; align-items: center; justify-content: center">''' + svg('twins', 18, 2.2) + '''</span>
      <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 8px; border-radius: 18px; background: rgba(255,255,255,.07)">''' + face('OS', 'indigo', 44) + '''<span style="font-size: 13px; font-weight: 700; text-align: center">Owino Plumbing &amp; Sanitary</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2"><span class="m">3</span> lines · <span class="m">1</span> order</span></span>
    </div>'''
hd = head('One supplier, or two?', circ('Suppliers.dc.html', 'back', 'Back to Suppliers'), '', pair)
cmp_row = '''      <div style="display: grid; grid-template-columns: 1.1fr 1fr 1fr; gap: 6px; align-items: center; min-height: 48px; padding: 0 10px; border-top: {{r.rule}}">
        <span style="font-size: 12px; font-weight: 600; color: #5F6980">{{r.k}}</span>
        <span style="font-size: 13px; font-weight: 600; text-align: right; {{r.ink}}{{r.face}}">{{r.a}}</span>
        <span style="font-size: 13px; font-weight: 600; text-align: right; {{r.ink}}{{r.face}}">{{r.b}}</span>
      </div>'''
bd = body('\n'.join([
    sec('Side by side', 'green: the same', first=True),
    '    <div style="' + LIST + '; padding: 4px 6px">\n      <sc-for list="{{rows}}" as="r" hint-placeholder-count="5">\n' + cmp_row + '\n      </sc-for>\n    </div>',
    sec('If they are one'),
    lst(row('Owino Plumbing is kept', '3 lines move across · its prices win where both price', icon_well('tick', 'green'), '')),
    '    <sc-if value="{{done}}" hint-placeholder-val="{{ false }}"><div style="display: flex; align-items: center; gap: 8px; min-height: 46px; padding: 0 14px; border-radius: 16px; {{resultStyle}}"><span style="flex: 1; font-size: 13px; font-weight: 700">{{result}}</span><button type="button" onClick="{{undo}}" style="all: unset; cursor: pointer; font-size: 13px; font-weight: 700; color: #16203C">Undo</button></div></sc-if>',
]))
ft = '''  <div style="flex: none; padding: 12px 16px 22px; display: grid; grid-template-columns: 1fr 1.3fr; gap: 8px">
    ''' + pill('Two suppliers', onclick='{{apart}}', kind='ghost') + '''
    ''' + pill('Merge into one', onclick='{{merge}}', kind='red') + '''
  </div>'''
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { res: null }; }
  renderVals() {
    const SAME = 'color:#0F6B43';
    const rows = [
      { k: 'Phone', a: 'same', b: 'same', ink: SAME },
      { k: 'Where', a: 'Owino market', b: 'Owino market', ink: SAME },
      { k: 'Lines', a: '24', b: '3', ink: '' },
      { k: 'PPR elbow 25mm', a: '1,200', b: '1,250', ink: '' },
      { k: 'Last order', a: '9 Oct', b: '3 Jun', ink: '' }
    ].map((r, i) => ({ ...r, rule: i ? '1px solid #EFECE6' : 'none', face: /[0-9]/.test(r.a) ? ";font-family:'IBM Plex Mono',monospace" : '' }));
    const res = this.state.res;
    return {
      rows, done: !!res,
      result: res === 'merge' ? 'Merged · one supplier, Owino Plumbing' : 'Kept apart · not offered again',
      resultStyle: res === 'merge' ? 'background:#E4F4EA;color:#0F6B43' : 'background:#F1EEE8;color:#5F6980',
      merge: () => this.setState({ res: 'merge' }), apart: () => this.setState({ res: 'apart' }), undo: () => this.setState({ res: null })
    };
  }
}'''
html = page('One supplier, or two?', hd + '\n' + bd + '\n' + ft, script)
