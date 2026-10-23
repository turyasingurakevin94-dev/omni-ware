from ow import *

seg_nav = '''    <div role="tablist" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 3px; border-radius: 14px; background: rgba(255,255,255,.08)">
      <button type="button" role="tab" aria-selected="{{openSel}}" onClick="{{showOpen}}" style="{{openTab}}">New items <span class="m">30</span></button>
      <button type="button" role="tab" aria-selected="{{certSel}}" onClick="{{showCertify}}" style="{{certTab}}">Top sellers <span class="m">59</span></button>
    </div>'''
bar = '''    <sc-if value="{{isOpen}}" hint-placeholder-val="{{ true }}">
    <div role="img" aria-label="30 new items from asked to on sale: sent back 1, wanted 9, hunting 6, quoted 4, ready 3, with Ruth 2, live this week 5" style="display: flex; flex-direction: column; gap: 6px">
      <div style="display: flex; height: 12px; border-radius: 999px; overflow: hidden; gap: 3px">
        <sc-for list="{{segs}}" as="g" hint-placeholder-count="7"><span style="{{g.style}}"></span></sc-for>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #B3BCD2"><span>just asked</span><span style="display: flex; align-items: center; gap: 4px">''' + svg('M4 12h15M14 7l5 5-5 5', 12, 2.2) + '''on sale</span></div>
    </div>
    <div style="display: flex; gap: 6px; overflow-x: auto; margin: -6px -20px; padding: 6px 20px; -webkit-mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 44px), transparent); mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 44px), transparent)">
      <sc-for list="{{chips}}" as="c" hint-placeholder-count="8"><button type="button" onClick="{{c.pick}}" aria-pressed="{{c.on}}" style="{{c.style}}"><span style="width: 8px; height: 8px; border-radius: 999px; {{c.dot}}"></span>{{c.label}} <span class="m">{{c.n}}</span></button></sc-for>
    </div>
    </sc-if>
    <sc-if value="{{isCert}}" hint-placeholder-val="{{ false }}">
    <div style="display: flex; align-items: center; gap: 14px">
      ''' + ring(41 / 100, '41', 64, 7, '#6FDCB0', 'rgba(255,255,255,.1)', 16, '41 of the top 100 sellers certified') + '''
      <span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 700">41 of the top 100 certified</span><span style="font-size: 12px; font-weight: 600; color: #B3BCD2">Biggest sellers first · most need only a photo</span></span>
    </div>
    </sc-if>'''
right = f'<a href="Search.dc.html" aria-label="Search the funnel" style="width: 44px; height: 44px; border-radius: 999px; background: rgba(255,255,255,.08); color: #FFFFFF; display: flex; align-items: center; justify-content: center">{svg("search", 19, 2)}</a>'
hd = home_head('Funnel', 'Every new item passes six checks', right, seg_nav + '\n' + bar, gap=14)

item_row = '''        <a href="{{it.href}}" style="display: flex; align-items: center; gap: 12px; min-height: 66px; padding: 0 10px; border-radius: 16px">
          <span role="img" aria-label="{{it.aria}}" style="position: relative; width: 42px; height: 42px; flex: none; border-radius: 999px; background: {{it.ring}}"><span class="m" style="position: absolute; inset: 5px; border-radius: 999px; background: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600">{{it.done}}/6</span></span>
          <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span class="nm" style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{it.name}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980; white-space: nowrap; overflow: hidden; text-overflow: ellipsis"><span style="color: #1C2233; font-weight: 700">{{it.worth}}</span>{{it.sub}}</span></span>
          <span style="flex: none; height: 30px; padding: 0 11px; border-radius: 999px; font-size: 12px; font-weight: 700; display: flex; align-items: center; white-space: nowrap; {{it.rightStyle}}">{{it.right}}</span>
        </a>'''
groups = '''    <sc-for list="{{groups}}" as="g" hint-placeholder-count="3">
      <div style="display: flex; flex-direction: column; gap: 8px">
        <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 8px 4px 0"><span style="font-size: 13px; font-weight: 700; {{g.ink}}">{{g.label}} <span class="m">{{g.n}}</span></span><sc-if value="{{g.hasMore}}" hint-placeholder-val="{{ false }}"><span style="font-size: 12px; font-weight: 600; color: #5F6980">+<span class="m">{{g.more}}</span> more</span></sc-if></div>
        <div style="''' + LIST + '''; padding: 6px; display: flex; flex-direction: column; gap: 2px">
        <sc-for list="{{g.items}}" as="it" hint-placeholder-count="2">
''' + item_row + '''
        </sc-for>
        </div>
      </div>
    </sc-for>'''
shelf = ('''    <sc-if value="{{showShelf}}" hint-placeholder-val="{{ true }}">
    <div style="' + LIST + '; margin-top: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px">
      <div style="display: flex; align-items: baseline; gap: 8px"><span class="m" style="font-size: 28px; font-weight: 600; line-height: 1">11</span><span style="flex: 1; font-size: 13px; font-weight: 700">days from ask to on sale</span><span style="display: flex; align-items: center; gap: 3px; height: 22px; padding: 0 8px; border-radius: 999px; background: #E4F4EA; color: #0F6B43; font-size: 11px; font-weight: 700">''' + svg('M12 5v14M6 13l6 6 6-6', 11, 3) + '''2 d on September</span></div>
      <div role="img" aria-label="The middle item spends 3 days wanted, 4 hunting (the slowest), 2 quoted, 1 ready and 1 with Ruth" style="display: flex; flex-direction: column; gap: 5px">
        <sc-for list="{{stages}}" as="s" hint-placeholder-count="5"><div style="display: flex; align-items: center; gap: 10px"><span style="width: 64px; font-size: 11px; font-weight: 700; {{s.ink}}">{{s.label}}</span><span style="flex: 1; height: 8px; border-radius: 4px; background: #EFECE6; display: block"><span style="display: block; height: 8px; border-radius: 4px; {{s.bar}}"></span></span><span class="m" style="width: 30px; text-align: right; font-size: 12px; font-weight: 600; {{s.ink}}">{{s.d}} d</span></div></sc-for>
      </div>
      <span style="font-size: 12px; font-weight: 600; color: #5F6980">Hunting is the slow part · ≈ on each item is what its askers want, at the market price</span>
    </div>
    </sc-if>''')
inner = hd + '\n  <div style="padding: 10px 16px 24px; display: flex; flex-direction: column; gap: 4px">\n' + shelf + '\n' + groups + '\n  </div>'

script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { lane: 'all', view: 'open' }; }
  renderVals() {
    // one gate string per item, the same on every screen: Photo Packing Suppliers Verdict Name&aisle Markup
    // d kept, a filled for you and not kept yet (dashed, never counted), g a gap, t not started
    const COL = { d: '#0F6B43', a: '#0F6B43', g: '#95530C', t: '#E0DCD4' };
    const WORD = { d: 'done', a: 'filled for you, to check', g: 'a gap', t: 'not started' };
    const GATES = ['Photo', 'Packing', 'Suppliers', 'Verdict', 'Name and aisle', 'Markup'];
    const SOFT = 'background:#F1EEE8;color:#5F6980', GO = 'background:#16203C;color:#FFFFFF';
    const mk = (o) => {
      const s = o.gates.split('');
      const parts = [];
      s.forEach((k, i) => {
        const a = i * 60, b = a + 60;
        if (k === 'a') { for (let d = a; d < b; d += 10) parts.push('#FFFFFF ' + d + 'deg ' + (d + 5) + 'deg', COL[k] + ' ' + (d + 5) + 'deg ' + (d + 10) + 'deg'); return; }
        parts.push('#FFFFFF ' + a + 'deg ' + (a + 5) + 'deg', COL[k] + ' ' + (a + 5) + 'deg ' + (b - 5) + 'deg', '#FFFFFF ' + (b - 5) + 'deg ' + b + 'deg');
      });
      return {
        ...o, worth: o.worth || '', href: o.href || o.goHref || 'Funnel.dc.html',
        ring: 'conic-gradient(' + parts.join(',') + ')', done: s.filter(k => k === 'd').length,
        right: o.go || o.status, rightStyle: o.go ? GO : (o.statusStyle || SOFT),
        aria: s.map((k, i) => GATES[i] + ' ' + WORD[k]).join(', ')
      };
    };
    const open = [
      { key: 'back', label: 'Sent back', n: 1, ink: 'color:#7A4A02', items: [
        mk({ name: 'Door hinge 4" brass', worth: '≈ 360,000 · ', sub: 'photo too dark', gates: 'gddddt', go: 'Retake', goHref: 'SentBack.dc.html' })
      ] },
      { key: 'wanted', label: 'Wanted', n: 9, items: [
        mk({ name: 'Gutter bracket, galvanised', worth: '≈ 1.1 M a month · ', sub: '4 people', gates: 'tttttt', go: 'Hunt it', goHref: 'Hunt.dc.html' }),
        mk({ name: 'PPR pipe 25mm × 4m', worth: '≈ 380,000 · ', sub: '2 shops', gates: 'tttttt', go: 'On the walk', goHref: 'MarketRun.dc.html' })
      ] },
      { key: 'hunting', label: 'Hunting', n: 6, items: [
        mk({ name: 'Ridge cap G28, maroon', worth: '≈ 900,000 · ', sub: 'asked 2 days ago', gates: 'ttttdt', status: 'Waiting on 3' })
      ] },
      { key: 'quoted', label: 'Quoted', n: 4, items: [
        mk({ name: 'Wire mesh BRC A142', worth: '≈ 6.0 M · ', sub: '2 to check', gates: 'gadgat', href: 'Passport.dc.html', go: 'Fix 2 gaps', goHref: 'GapWalk.dc.html' }),
        mk({ name: 'Self-drilling screws 10×25', worth: '≈ 240,000 · ', sub: 'packing missing', gates: 'dgdtdt', go: 'Packing', goHref: 'PackingGate.dc.html' })
      ] },
      { key: 'ready', label: 'Ready', n: 3, items: [
        mk({ name: 'Tile cutter 600mm', worth: '≈ 520,000 · ', sub: 'Five checks done', gates: 'dddddt', go: 'Send to Ruth', goHref: 'SendToManager.dc.html' })
      ] },
      { key: 'manager', label: 'With Ruth', n: 2, items: [
        mk({ name: 'Paint roller 9"', worth: '≈ 300,000 · ', sub: '3 h with Ruth', gates: 'dddddt', status: 'With Ruth', statusStyle: 'background:#FDEEE1;color:#7A4A02' })
      ] },
      { key: 'live', label: 'Live this week', n: 5, items: [
        mk({ name: 'Tile adhesive 20kg', sub: 'On sale since Thursday', gates: 'dddddd', status: '2 told', statusStyle: 'background:#E4F4EA;color:#0F6B43' })
      ] }
    ].map(g => ({ ...g, ink: g.ink || 'color:#5F6980', more: g.n - g.items.length, hasMore: g.n > g.items.length }));
    const certify = [
      { key: 'certify', label: 'Top sellers with gaps', n: 59, items: [
        mk({ name: 'Iron sheet G28, 3m box profile', sub: '#1 by sales · needs a photo · 1 to check', gates: 'gddadd', go: 'Certify', goHref: 'Certify.dc.html' }),
        mk({ name: 'Cement 50kg', sub: '#2 by sales · one supplier', gates: 'ddgddd', status: '1 gap' }),
        mk({ name: 'Y12 rebar, 12m', sub: '#3 by sales · needs packing', gates: 'dgdddd', status: '1 gap' })
      ] }
    ].map(g => ({ ...g, ink: 'color:#5F6980', more: g.n - g.items.length, hasMore: true }));
    const isOpen = this.state.view === 'open';
    const DOTS = { all: 'background:transparent;display:none', back: 'background:#F5B26B', wanted: 'background:rgba(255,255,255,.35)', hunting: 'background:rgba(255,255,255,.5)', quoted: 'background:rgba(255,255,255,.7)', ready: 'background:#FFFFFF', manager: 'background:#F5B26B', live: 'background:#6FDCB0' };
    const lanes = [['all', 'All', 30], ['back', 'Sent back', 1], ['wanted', 'Wanted', 9], ['hunting', 'Hunting', 6], ['quoted', 'Quoted', 4], ['ready', 'Ready', 3], ['manager', 'With Ruth', 2], ['live', 'Live', 5]];
    const SEGBG = { back: '#F5B26B', wanted: 'rgba(255,255,255,.22)', hunting: 'rgba(255,255,255,.4)', quoted: 'rgba(255,255,255,.6)', ready: '#FFFFFF', manager: 'repeating-linear-gradient(135deg, rgba(245,178,107,.8) 0 4px, transparent 4px 8px)', live: '#6FDCB0' };
    // the bar is the same lanes as the chips, sized by how many items each holds; a picked chip lights its part
    const segs = lanes.slice(1).map(([k, , n]) => ({ style: 'flex:' + n + ';background:' + SEGBG[k] + ';opacity:' + (this.state.lane === 'all' || this.state.lane === k ? 1 : .2) }));
    const chips = lanes.map(([k, label, n]) => {
      const on = this.state.lane === k;
      return { label, n, on: String(on), dot: DOTS[k], pick: () => this.setState({ lane: k }),
        style: 'all:unset;cursor:pointer;flex:none;display:flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap;' +
          (on ? 'background:#FFFFFF;color:#16203C' : 'background:rgba(255,255,255,.08);color:#B3BCD2') };
    });
    const groups = isOpen ? open.filter(g => this.state.lane === 'all' || g.key === this.state.lane) : certify;
    const tab = (on) => 'all:unset;cursor:pointer;box-sizing:border-box;height:38px;border-radius:11px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;' + (on ? 'background:#FFFFFF;color:#16203C' : 'color:#B3BCD2');
    return {
      chips, segs, groups, isOpen, isCert: !isOpen, showShelf: isOpen && this.state.lane === 'all',
      stages: [['Wanted', 3], ['Hunting', 4], ['Quoted', 2], ['Ready', 1], ['With Ruth', 1]].map(([label, d]) => ({ label, d,
        bar: 'width:' + (d / 4 * 100) + '%;background:' + (d === 4 ? '#95530C' : '#6B7480'), ink: d === 4 ? 'color:#7A4A02' : 'color:#5F6980' })),
      openTab: tab(isOpen), certTab: tab(!isOpen), openSel: String(isOpen), certSel: String(!isOpen),
      showOpen: () => this.setState({ view: 'open' }),
      showCertify: () => this.setState({ view: 'certify' })
    };
  }
}'''
html = page('Funnel', home_scroll(inner) + '\n' + tabbar('Funnel', {'Prices': 2}), script)
