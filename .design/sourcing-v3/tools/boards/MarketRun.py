from ow import *

route = '''    <div role="img" aria-label="{{routeAria}}" style="display: flex; align-items: center">
      <sc-for list="{{route}}" as="r" hint-placeholder-count="4">
        <span style="display: flex; align-items: center; flex: 1">
          <span style="flex: none; width: 32px; height: 32px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; {{r.dot}}">{{r.n}}</span>
          <sc-if value="{{r.join}}" hint-placeholder-val="{{ true }}"><span style="flex: 1; height: 3px; margin: 0 4px; border-radius: 2px; {{r.line}}"></span></sc-if>
        </span>
      </sc-for>
    </div>
    <div style="display: flex; gap: 14px; font-size: 11px; font-weight: 600; color: #B3BCD2">
      <span style="display: flex; align-items: center; gap: 5px"><span style="width: 8px; height: 8px; border-radius: 999px; background: #A9AEF0"></span>supplier</span>
      <span style="display: flex; align-items: center; gap: 5px"><span style="width: 8px; height: 8px; border-radius: 999px; background: #E7A6D6"></span>rival shop</span>
      <span style="display: flex; align-items: center; gap: 5px"><span style="width: 8px; height: 8px; border-radius: 999px; background: #6FDCB0"></span>done</span>
    </div>'''
big = '    <div style="display: flex; align-items: baseline; gap: 8px; padding: 0 4px"><span class="m" style="font-size: 40px; font-weight: 600; line-height: 1">{{jobsLeft}}</span><span style="font-size: 14px; font-weight: 600; color: #B3BCD2">jobs left · <span class="m">4</span> stops · <span class="m">2</span> areas</span></div>'
hd = head('Today’s walk', circ('Main.dc.html', 'back', 'Back to Today'), '', big + '\n' + route)
stop_row = '''        <div style="display: flex; align-items: center; gap: 12px; min-height: 72px; padding: 0 10px; border-top: {{s.rule}}">
          <a href="{{s.href}}" style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px">
            <span class="m" style="width: 42px; height: 42px; flex: none; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 600; {{s.well}}">{{s.n}}</span>
            <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px">
              <span style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{s.name}}</span>
              <span style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap"><sc-for list="{{s.tags}}" as="t" hint-placeholder-count="2"><span style="height: 20px; padding: 0 7px; border-radius: 999px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; {{t.style}}">{{t.label}}</span></sc-for></span>
            </span>
          </a>
          <button type="button" role="checkbox" aria-checked="{{s.on}}" aria-label="{{s.doneAria}}" onClick="{{s.toggle}}" style="all: unset; cursor: pointer; width: 32px; height: 32px; flex: none; border-radius: 999px; display: flex; align-items: center; justify-content: center; {{s.box}}">''' + svg('tick', 15, 3) + '''</button>
        </div>'''
areas = '''    <sc-for list="{{areas}}" as="ar" hint-placeholder-count="2">
      <div style="display: flex; flex-direction: column; gap: 8px">
        <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 8px 4px 0"><span style="font-size: 13px; font-weight: 700; color: #5F6980">{{ar.name}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">{{ar.sub}}</span></div>
        <div style="''' + LIST + '''; padding: 0 6px">
        <sc-for list="{{ar.stops}}" as="s" hint-placeholder-count="2">
''' + stop_row + '''
        </sc-for>
        </div>
      </div>
    </sc-for>'''
ask = lst(row('Kiseka Steel has 5 old prices', 'Ask them in the supplier app, not at the counter', icon_well('phone', 'indigo'), chev(), href='AskConfirm.dc.html'))
bd = body(areas + '\n' + sec('Off the walk') + '\n' + ask, pad='10px 16px 24px', gap=6)
ft = foot('<a href="{{goHref}}" style="height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; {{goStyle}}">{{goLabel}}</a>')
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { done: {} }; }
  renderVals() {
    const D = this.state.done;
    const SUP = 'background:#E4E6FA;color:#3A3F9B', RIV = 'background:#F6E4F1;color:#7A3268', OK = 'background:#E4F4EA;color:#0F6B43', NEUT = 'background:#F1EEE8;color:#1C2233';
    // ordered by area, then by jobs: the downtown three first, Nateete last
    const stops = [
      { id: 'o', n: 1, area: 'Kikuubo and Owino', name: 'Owino Plumbing', kind: 'sup', jobs: 7, href: 'Visit.dc.html', tags: [['3 prices', NEUT], ['1 wanted', NEUT], ['1 proposal', SUP], ['2 photos', NEUT]] },
      { id: 'k', n: 2, area: 'Kikuubo and Owino', name: 'Kikuubo Hardware Mart', kind: 'riv', jobs: 5, href: 'RivalRun.dc.html', tags: [['5 to check', RIV], ['3 are top sellers', NEUT]] },
      { id: 's', n: 3, area: 'Kikuubo and Owino', name: 'Kiseka Steel', kind: 'sup', jobs: 3, href: 'SupplierKiseka.dc.html', tags: [['2 wanted', NEUT], ['1 photo', NEUT]] },
      { id: 'n', n: 4, area: 'Nateete', name: 'Nateete Builders’ Centre', kind: 'riv', jobs: 4, href: 'RivalRun.dc.html', tags: [['4 to check', RIV], ['wire mesh among them', NEUT]] }
    ].map(s => {
      const on = !!D[s.id];
      return { ...s, on: String(on), doneAria: 'Mark ' + s.name + ' done', well: on ? OK : (s.kind === 'sup' ? SUP : RIV),
        tags: on ? [{ label: 'done', style: OK }] : s.tags.map(([label, style]) => ({ label, style })),
        box: on ? 'background:#0F6B43;color:#FFFFFF' : 'background:#FFFFFF;color:transparent;box-shadow:inset 0 0 0 1.5px #C9C4BA',
        toggle: () => this.setState({ done: { ...D, [s.id]: !D[s.id] } }) };
    });
    const jobs = (l) => l.filter(s => s.on !== 'true').reduce((t, s) => t + s.jobs, 0);
    const areas = ['Kikuubo and Owino', 'Nateete'].map(name => {
      const l = stops.filter(s => s.area === name).map((s, i) => ({ ...s, rule: i ? '1px solid #EFECE6' : 'none' }));
      return { name, stops: l, sub: l.length + (l.length === 1 ? ' stop' : ' stops') + ' · ' + jobs(l) + ' jobs left' };
    });
    const route = stops.map((s, i) => ({ n: s.n, join: i < stops.length - 1,
      dot: s.on === 'true' ? 'background:#6FDCB0;color:#16203C' : s.kind === 'sup' ? 'background:#A9AEF0;color:#16203C' : 'background:#E7A6D6;color:#16203C',
      line: i === 2 ? 'background:transparent;border-top:3px dashed rgba(255,255,255,.18);height:0' : (s.on === 'true' ? 'background:#6FDCB0' : 'background:rgba(255,255,255,.14)') }));
    const next = stops.find(s => s.on !== 'true');
    return {
      areas, route, jobsLeft: jobs(stops), routeAria: stops.map(s => s.n + ' ' + s.name + (s.on === 'true' ? ', done' : '')).join('; '),
      goHref: next ? next.href : 'Main.dc.html', goLabel: next ? 'Start at ' + next.name : 'Walk finished · back to Today',
      goStyle: next ? 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)' : 'background:#E4F4EA;color:#0F6B43'
    };
  }
}'''
html = page('Today’s walk', hd + '\n' + bd + '\n' + ft, script)
