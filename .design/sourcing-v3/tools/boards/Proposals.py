from _shared import *

# Each proposal is a decision, so it shows what decides it: the new price for its unit,
# what it does to a month at our usage, where it sits against our other supplier and the
# cheapest rival, and how often this price has moved. The head adds them up.
pic = '''    <div style="display: flex; align-items: center; gap: 14px">
      <span style="display: flex; align-items: baseline; gap: 8px"><span class="m" style="font-size: 40px; font-weight: 600; line-height: 1">{{left}}</span><span style="font-size: 14px; font-weight: 600; color: #B3BCD2">to answer</span></span>
      <span style="flex: 1"></span>
      <span role="img" aria-label="From Owino Plumbing and Kiseka Steel" style="display: flex">''' + face('OP', 'indigo', 40, '0 0 0 2px #1D2747') + '<span style="margin-left: -8px; display: flex">' + face('KS', 'indigo', 40, '0 0 0 2px #1D2747') + '''</span></span>
    </div>
    <div style="display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 14px; border-radius: 16px; background: rgba(255,255,255,.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07)">
      <span style="flex: 1; font-size: 12px; font-weight: 600; color: #B3BCD2">Accept both and a month costs</span>
      <span class="m" style="font-size: 18px; font-weight: 600; color: #F5B26B">+{{net}}</span>
    </div>'''
hd = head('Supplier proposals', circ('Prices.dc.html', 'back', 'Back to Prices'), '', pic)

card = '''      <div style="display: flex; flex-direction: column; gap: 12px; padding: 14px 12px; border-top: {{p.rule}}">
        <div style="display: flex; align-items: center; gap: 12px">
          <span style="width: 42px; height: 42px; flex: none; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">{{p.ini}}</span>
          <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span class="nm" style="font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{p.item}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{p.sup}} · {{p.when}}</span></span>
        </div>
        <div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 10px">
          <span style="display: flex; flex-direction: column; gap: 3px">
            <span style="display: flex; align-items: center; gap: 8px"><span class="m" style="font-size: 13px; color: #5F6980; text-decoration: line-through">{{p.was}}</span>''' + svg('M5 12h14M13 6l6 6-6 6', 14, 2, '#5F6980') + '''<span class="m" style="font-size: 20px; font-weight: 600; line-height: 1">{{p.now}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980; white-space: nowrap">/ {{p.unit}}</span></span>
            <span style="font-size: 12px; font-weight: 600; color: #5F6980">we buy <span class="m" style="color: #1C2233">{{p.use}}</span> a month</span>
          </span>
          <span style="flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; padding: 8px 10px; border-radius: 14px; {{p.impactStyle}}"><span class="m" style="font-size: 16px; font-weight: 600; line-height: 1">{{p.impact}}</span><span style="font-size: 11px; font-weight: 700">{{p.impactWord}}</span></span>
        </div>
        <div role="img" aria-label="{{p.ladderAria}}" style="display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 14px; background: #F7F5F2">
          <sc-for list="{{p.ladder}}" as="l" hint-placeholder-count="3">
            <div style="display: flex; align-items: center; gap: 10px"><span class="nm" style="width: 96px; flex: none; font-size: 11px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; {{l.ink}}">{{l.name}}</span><span style="flex: 1; height: 8px; border-radius: 4px; background: #EFECE6; display: block"><span style="display: block; height: 8px; border-radius: 4px; {{l.bar}}"></span></span><span class="m" style="width: 52px; text-align: right; font-size: 12px; font-weight: 600">{{l.price}}</span></div>
          </sc-for>
          <span style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; {{p.verdictInk}}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{p.verdictIcon}}"></path></svg>{{p.verdict}}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px">
          <svg width="64" height="22" viewBox="0 0 64 22" aria-hidden="true"><polyline points="{{p.spark}}" fill="none" stroke="#6B7480" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"></polyline><circle cx="62" cy="{{p.lastY}}" r="2.6" fill="{{p.dotCol}}"></circle></svg>
          <span style="font-size: 12px; font-weight: 600; color: #5F6980">{{p.history}}</span>
        </div>
        <sc-if value="{{p.open}}" hint-placeholder-val="{{ true }}">
          <div style="display: grid; grid-template-columns: {{p.cols}}; gap: 8px">
            <sc-if value="{{p.rise}}" hint-placeholder-val="{{ true }}"><a href="PushBack.dc.html" style="height: 44px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">Push back</a></sc-if>
            <button type="button" onClick="{{p.later}}" style="all: unset; cursor: pointer; height: 44px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">Not now</button>
            <button type="button" onClick="{{p.accept}}" style="all: unset; cursor: pointer; height: 44px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">Accept</button>
          </div>
        </sc-if>
        <sc-if value="{{p.done}}" hint-placeholder-val="{{ false }}">
          <div style="display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 8px 0 12px; border-radius: 12px; {{p.resultStyle}}"><span style="flex: 1; font-size: 13px; font-weight: 700">{{p.result}}</span><button type="button" onClick="{{p.undo}}" style="all: unset; cursor: pointer; height: 32px; padding: 0 8px; display: flex; align-items: center; font-size: 13px; font-weight: 700; color: #16203C">Undo</button></div>
        </sc-if>
      </div>'''
bd = body('\n'.join([
    sec('Sent from the supplier app', 'biggest effect first', first=True),
    '    <div style="' + LIST + '; padding: 0 6px">\n      <sc-for list="{{props}}" as="p" hint-placeholder-count="2">\n' + card + '\n      </sc-for>\n    </div>',
    '    <div style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 14px; border-radius: 20px; box-shadow: inset 0 0 0 1px #E6E3DD">' + face('RN', 'manager', 32) + '<span style="flex: 1; font-size: 12px; font-weight: 600; color: #5F6980">Accepting a rise tells Ruth about every order line it puts under its sale price</span></div>',
]))
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { prop: {} }; }
  renderVals() {
    const fmt = (n) => n.toLocaleString('en-US');
    const base = [
      { id: 'p1', ini: 'OP', item: 'PVC pipe 4" × 6m', sup: 'Owino Plumbing', when: 'yesterday 16:05', unit: 'length', was: 42000, now: 44000, use: 60, rise: true,
        short: 'Owino', others: [['Owino · was', 42000, 'old'], ['Kikuubo · rival', 52000, 'riv']],
        hist: [40000, 40000, 41000, 41000, 42000, 44000], history: 'Third rise this year · was 40,000 in January' },
      { id: 'p2', ini: 'KS', item: 'Binding wire 25kg', sup: 'Kiseka Steel', when: 'today 09:40', unit: 'roll', was: 96000, now: 94500, use: 20, rise: false,
        short: 'Kiseka', others: [['Katwe', 97000, 'sup'], ['Nateete · rival', 110000, 'riv']],
        hist: [92000, 94000, 96000, 96000, 96000, 94500], history: 'First drop in 8 months' }
    ];
    const pres = this.state.prop || {};
    const pset = (id, v) => () => this.setState({ prop: { ...pres, [id]: v } });
    const props = base.map((p, i) => {
      const r = pres[p.id], d = (p.now - p.was) * p.use;
      const all = [[p.short + ' · new', p.now, 'new']].concat(p.others);
      const lo = Math.min(...all.map(a => a[1])) * 0.9, hi = Math.max(...all.map(a => a[1]));
      const COL = { new: '#3A3F9B', sup: '#5F6980', old: '#5F6980', riv: '#7A3268' };
      const ladder = all.map(([name, v, k]) => ({ name, price: fmt(v), ink: 'color:' + COL[k], bar: 'width:' + ((v - lo) / (hi - lo) * 100).toFixed(1) + '%;background:' + COL[k] }));
      const cheapestSup = Math.min(p.now, ...p.others.filter(o => o[2] === 'sup').map(o => o[1]));
      const other = p.others.find(o => o[2] === 'sup');
      const only = !other, still = p.now <= cheapestSup;
      const rival = p.others.find(o => o[2] === 'riv');
      const lo2 = Math.min(...p.hist), hi2 = Math.max(...p.hist);
      const pts = p.hist.map((v, k) => (2 + k * 12) + ',' + (19 - (v - lo2) / (hi2 - lo2 || 1) * 16).toFixed(1));
      const pct = ((p.now - p.was) / p.was * 100).toFixed(1);
      return { ...p, rule: i ? '1px solid #EFECE6' : 'none', open: !r, done: !!r, ladder,
        was: fmt(p.was), now: fmt(p.now), use: '≈ ' + p.use,
        impact: (d > 0 ? '+' : '−') + fmt(Math.abs(d)), impactWord: (d > 0 ? 'more a month · ' : 'less a month · ') + (d > 0 ? '+' : '−') + Math.abs(pct) + '%',
        impactStyle: d > 0 ? 'background:#FDEEE1;color:#7A4A02' : 'background:#E4F4EA;color:#0F6B43',
        verdict: only ? 'Our only supplier for it · ' + fmt(rival[1] - p.now) + ' still under Kikuubo · worth a second supplier' : still ? (p.rise ? 'Still our cheapest supplier' : 'Now our cheapest supplier') : other[0] + ' is ' + fmt(p.now - other[1]) + ' less · push back with it',
        verdictInk: still && !only ? 'color:#0F6B43' : 'color:#7A4A02', verdictIcon: still && !only ? 'M5 12.5l4.5 4.5L19 7.5' : 'M12 8v5M12 16.5h.01M12 3 2.5 20h19z',
        ladderAria: all.map(a => a[0] + ' ' + fmt(a[1])).join(', '),
        spark: pts.join(' '), lastY: pts[pts.length - 1].split(',')[1], dotCol: d > 0 ? '#95530C' : '#0F6B43',
        cols: p.rise ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
        result: r === 'later' ? 'Kept for later · it stays here' : 'Accepted · on the price list now',
        resultStyle: r === 'later' ? 'background:#F1EEE8;color:#5F6980' : 'background:#E4F4EA;color:#0F6B43',
        accept: pset(p.id, 'yes'), later: pset(p.id, 'later'), undo: pset(p.id, undefined) };
    });
    const net = base.reduce((t, p) => t + (p.now - p.was) * p.use, 0);
    return { props, left: props.filter(p => p.open).length, net: net.toLocaleString('en-US') };
  }
}'''
html = page('Supplier proposals', hd + '\n' + bd, script)
