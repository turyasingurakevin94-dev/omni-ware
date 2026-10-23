from ow import *

# one supplier proposal as a line, with its three answers; nothing is chosen for you
PROP_ROW = '''      <div style="display: flex; flex-direction: column; gap: 10px; padding: 12px 10px; border-top: {{p.rule}}">
        <div style="display: flex; align-items: center; gap: 12px">
          <span style="width: 42px; height: 42px; flex: none; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">{{p.ini}}</span>
          <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{p.item}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{p.sup}} · {{p.note}}</span></span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding-left: 54px"><span class="m" style="font-size: 13px; color: #9AA1AE; text-decoration: line-through">{{p.was}}</span>''' + svg('M5 12h14M13 6l6 6-6 6', 14, 2, '#5F6980') + '''<span class="m" style="font-size: 16px; font-weight: 600">{{p.now}}</span><span class="m" style="height: 22px; padding: 0 7px; border-radius: 999px; font-size: 11px; font-weight: 600; display: flex; align-items: center; {{p.chip}}">{{p.pct}}</span></div>
        <sc-if value="{{p.open}}" hint-placeholder-val="{{ true }}">
          <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding-left: 54px">
            <sc-if value="{{p.rise}}" hint-placeholder-val="{{ true }}"><a href="PushBack.dc.html" style="height: 38px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center">Push back</a></sc-if>
            <sc-if value="{{p.drop}}" hint-placeholder-val="{{ false }}"><span></span></sc-if>
            <button type="button" onClick="{{p.later}}" style="all: unset; cursor: pointer; height: 38px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center">Not now</button>
            <button type="button" onClick="{{p.accept}}" style="all: unset; cursor: pointer; height: 38px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center">Accept</button>
          </div>
        </sc-if>
        <sc-if value="{{p.done}}" hint-placeholder-val="{{ false }}">
          <div style="display: flex; align-items: center; gap: 8px; min-height: 38px; margin-left: 54px; padding: 0 12px; border-radius: 12px; {{p.resultStyle}}"><span style="flex: 1; font-size: 12px; font-weight: 700">{{p.result}}</span><button type="button" onClick="{{p.undo}}" style="all: unset; cursor: pointer; font-size: 12px; font-weight: 700; color: #16203C">Undo</button></div>
        </sc-if>
      </div>'''
PROPS_JS = '''const base = [
      { id: 'p1', ini: 'OP', item: 'PVC pipe 4" × 6m', sup: 'Owino Plumbing', was: '42,000', now: '44,000', pct: '+4.8%', rise: true,
        chip: 'background:#FDEEE1;color:#7A4A02', note: 'yesterday 16:05 · we buy ≈60 a month' },
      { id: 'p2', ini: 'KS', item: 'Binding wire 25kg', sup: 'Kiseka Steel', was: '96,000', now: '94,500', pct: '−1.6%', rise: false,
        chip: 'background:#E4F4EA;color:#0F6B43', note: 'today 09:40 · a lower price' }
    ];
    const pres = this.state.prop || {};
    const pset = (id, v) => () => this.setState({ prop: { ...pres, [id]: v } });
    const props = base.map((p, i) => {
      const r = pres[p.id];
      return { ...p, rule: i ? '1px solid #EFECE6' : 'none', drop: !p.rise, open: !r, done: !!r,
        result: r === 'later' ? 'Kept for later · it stays here' : 'Accepted · on the price list now',
        resultStyle: r === 'later' ? 'background:#F1EEE8;color:#5F6980' : 'background:#E4F4EA;color:#0F6B43',
        accept: pset(p.id, 'yes'), later: pset(p.id, 'later'), undo: pset(p.id, undefined) };
    });'''


def scorecard(name, ini, terms_hole, stats_cells, score_js, lines_js, extra_top, foot_html, script_extra_state='', script_extra_vals='', back='Suppliers.dc.html'):
    """A supplier's scorecard: who they are, how they score against our average, what we buy."""
    pic = title_block(name, terms_hole, face(ini, 'indigo', 56)) + '\n' + stats(stats_cells)
    hd = head('Supplier', circ(back, 'back', 'Back to Suppliers'), circ('tel:+256700000000', 'call', 'Call ' + name), pic)
    score_row = '''      <div style="display: flex; flex-direction: column; gap: 6px; padding: 11px 10px; border-top: {{s.rule}}">
        <span style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px"><span style="font-size: 14px; font-weight: 700">{{s.label}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980"><span class="m" style="font-size: 13px; color: #1C2233">{{s.fig}}</span> {{s.of}}</span></span>
        <span style="position: relative; height: 8px; border-radius: 4px; background: #EFECE6; display: block"><span style="display: block; height: 8px; border-radius: 4px; {{s.bar}}"></span><span style="position: absolute; top: -3px; width: 2px; height: 14px; border-radius: 1px; background: #5F6980; {{s.avg}}"></span></span>
      </div>'''
    line_row = '''        <a href="{{l.href}}" style="display: flex; align-items: center; gap: 10px; min-height: 62px; padding: 0 10px; border-radius: 16px">
          <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{l.name}}</span><span style="font-size: 12px; font-weight: 600; {{l.noteInk}}">{{l.note}}</span></span>
          <svg width="54" height="20" viewBox="0 0 54 20" aria-hidden="true"><polyline points="{{l.spark}}" fill="none" stroke="#6B7480" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"></polyline><circle cx="53" cy="{{l.lastY}}" r="2.4" fill="#1C2233"></circle></svg>
          <span class="m" style="width: 64px; text-align: right; font-size: 14px; font-weight: 600">{{l.price}}</span>
        </a>'''
    bd = body('\n'.join([
        extra_top,
        sec('Scorecard', '<span style="display: inline-flex; align-items: center; gap: 5px"><span style="width: 2px; height: 11px; background: #5F6980; display: inline-block"></span>our suppliers’ average</span>', first=not extra_top),
        '    <div style="' + LIST + '; padding: 0 6px">\n      <sc-for list="{{score}}" as="s" hint-placeholder-count="4">\n' + score_row + '\n      </sc-for>\n    </div>',
        sec('What we buy from them', 'what we paid, last 6 buys'),
        '    <div style="' + LIST + '; padding: 6px; display: flex; flex-direction: column; gap: 2px">\n      <sc-for list="{{lines}}" as="l" hint-placeholder-count="5">\n' + line_row + '\n      </sc-for>\n    </div>',
    ]))
    script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { ''' + script_extra_state + ''' }; }
  renderVals() {
    const S = this.state;
    const score = ''' + score_js + '''.map((s, i) => ({ ...s, rule: i ? '1px solid #EFECE6' : 'none', bar: 'width:' + s.v + '%;background:' + (s.v >= s.avg ? '#0F6B43' : '#95530C'), avg: 'left:' + s.avg + '%' }));
    const spark = (ys) => ys.map((y, i) => (i * 10.4 + 1).toFixed(1) + ',' + (18 - y).toFixed(1)).join(' ');
    const OK = 'color:#0F6B43', DIM = 'color:#5F6980', WARN = 'color:#7A4A02';
    const lines = ''' + lines_js + '''.map(l => ({ ...l, href: l.href || '#', spark: spark(l.ys), lastY: (18 - l.ys[5]).toFixed(1) }));
    return { score, lines''' + script_extra_vals + ''' };
  }
}'''
    return page('Supplier · ' + name, hd + '\n' + bd + '\n' + foot_html, script)
