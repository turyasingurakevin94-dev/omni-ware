from ow import *

# the head says it plainly: three places to go, how much is done, and what each place is
route = '''    <div role="img" aria-label="{{routeAria}}" style="position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr))">
      <span style="position: absolute; top: 21px; left: 16.7%; width: 33.3%; height: 2px; background: rgba(255,255,255,.3)"></span>
      <span style="position: absolute; top: 21px; left: 50%; width: 33.3%; height: 0; border-top: 2px dashed rgba(255,255,255,.3)"></span>
      <sc-for list="{{route}}" as="r" hint-placeholder-count="3">
        <span style="position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center">
          <span style="width: 44px; height: 44px; border-radius: 999px; display: flex; align-items: center; justify-content: center; {{r.dot}}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{r.icon}}"></path></svg></span>
          <span style="display: flex; flex-direction: column; gap: 1px"><span class="nm" style="font-size: 13px; font-weight: 700">{{r.short}}</span><span style="font-size: 11px; font-weight: 600; {{r.ink}}">{{r.word}}</span></span>
        </span>
      </sc-for>
    </div>'''
big = '''    <div style="display: flex; flex-direction: column; gap: 8px">
      <span style="display: flex; align-items: baseline; gap: 8px"><span class="m" style="font-size: 40px; font-weight: 600; line-height: 1">{{doneN}}</span><span class="m" style="font-size: 18px; font-weight: 600; color: #B3BCD2">/ 16</span><span style="font-size: 14px; font-weight: 600; color: #B3BCD2">things done on today’s walk</span></span>
      <span style="display: block; height: 8px; border-radius: 999px; background: rgba(255,255,255,.14)"><span style="display: block; height: 8px; border-radius: 999px; background: #6FDCB0; {{doneBar}}"></span></span>
    </div>'''
hd = head('Today’s walk', circ('Main.dc.html', 'back', 'Back to Today'), '', big + '\n' + route)
stop_row = '''        <div style="display: flex; align-items: center; gap: 12px; min-height: 72px; padding: 0 10px; border-top: {{s.rule}}">
          <a href="{{s.href}}" style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px">
            <span class="m" style="width: 42px; height: 42px; flex: none; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 600; {{s.well}}">{{s.n}}</span>
            <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px">
              <span class="nm" style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{s.name}}</span>
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
ask = lst(row('Kiseka Steel · 5 old prices', 'Visited 2 days ago · ask in their app, no trip', icon_well('phone', 'indigo'), chev(), href='AskConfirm.dc.html'))
bd = body(areas + '\n' + sec('Off the walk') + '\n' + ask, pad='10px 16px 24px', gap=6)
ft = foot('<a href="{{goHref}}" style="height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; {{goStyle}}">{{goLabel}}</a>')
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { done: {} }; }
  renderVals() {
    const D = this.state.done;
    const SUP = 'background:#E4E6FA;color:#3A3F9B', RIV = 'background:#F6E4F1;color:#7A3268', OK = 'background:#E4F4EA;color:#0F6B43', NEUT = 'background:#F1EEE8;color:#1C2233';
    // ordered by area, then by jobs: downtown first, Nateete last. Kiseka is off today's walk: asked in its app instead
    const stops = [
      { id: 'o', n: 1, area: 'Kikuubo and Owino', name: 'Owino Plumbing', kind: 'sup', jobs: 7, href: 'Visit.dc.html', tags: [['3 prices to check', NEUT], ['1 item to ask for', NEUT], ['1 offer to answer', SUP], ['2 photos', NEUT]] },
      { id: 'k', n: 2, area: 'Kikuubo and Owino', name: 'Kikuubo Hardware Mart', kind: 'riv', jobs: 5, href: 'RivalRun.dc.html', tags: [['5 prices to check', RIV], ['3 are top sellers', NEUT]] },
      { id: 'n', n: 3, area: 'Nateete', name: 'Nateete Builders’ Centre', kind: 'riv', jobs: 4, href: 'RivalRun.dc.html', tags: [['4 prices to check', RIV], ['wire mesh among them', NEUT]] }
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
      return { name, stops: l, sub: l.length + (l.length === 1 ? ' stop' : ' stops') + ' · ' + jobs(l) + ' things left' };
    });
    const SHORT = { o: 'Owino', k: 'Kikuubo', n: 'Nateete' };
    const ICON = { sup: 'M3 21V9l9-5 9 5v12M8 21v-7h8v7', riv: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' };
    const firstOpen = stops.find(s => s.on !== 'true');
    const route = stops.map(s => {
      const done = s.on === 'true', next = firstOpen && s.id === firstOpen.id;
      return { short: SHORT[s.id], icon: done ? 'M5 12.5l4.5 4.5L19 7.5' : ICON[s.kind],
        word: done ? 'done' : (next ? 'start · ' : '') + s.jobs + (s.kind === 'sup' ? ' · our supplier' : ' · a rival'),
        ink: done ? 'color:#6FDCB0' : next ? 'color:#F5B26B' : 'color:#B3BCD2',
        dot: done ? 'background:#6FDCB0;color:#16203C' : (s.kind === 'sup' ? 'background:#E4E6FA;color:#3A3F9B' : 'background:#F6E4F1;color:#7A3268') + (next ? ';box-shadow:0 0 0 3px #19223F,0 0 0 5px #F5B26B' : '') };
    });
    const next = stops.find(s => s.on !== 'true');
    return {
      areas, route, jobsLeft: jobs(stops), doneN: 16 - jobs(stops), doneBar: 'width:' + ((16 - jobs(stops)) / 16 * 100).toFixed(1) + '%', routeAria: stops.map(s => s.n + ' ' + s.name + (s.on === 'true' ? ', done' : '')).join('; '),
      goHref: next ? next.href : 'Main.dc.html', goLabel: next ? (Object.values(D).some(Boolean) ? 'Next: ' : 'Start at ') + next.name : 'Walk finished · back to Today',
      goStyle: next ? 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)' : 'background:#E4F4EA;color:#0F6B43'
    };
  }
}'''
html = page('Today’s walk', hd + '\n' + bd + '\n' + ft, script)
