from ow import *

pic = title_block('Ruth’s price rule', 'Since <span class="m" style="color: #FFFFFF">23</span> Oct · Joseph sees each one in the log', face('RN', 'manager', 52, '0 0 0 3px #1D2747, 0 0 0 5px rgba(111,220,176,.55)')) + '\n' + stats([('{{byRule}}', 'on sale by the rule', '#6FDCB0'), ('{{changedN}}', 'changed by you', None), ('{{waitedN}}', 'waited for you', '#F5B26B')])
hd = head('Manager app · price rule', circ('ManagerItem.dc.html', 'back', 'Back'), '', pic)
toggle = '<button type="button" role="switch" aria-checked="{{onStr}}" aria-label="Price new items by the rule" onClick="{{toggle}}" style="all: unset; cursor: pointer; position: relative; width: 50px; height: 30px; flex: none; border-radius: 999px; {{track}}"><span style="position: absolute; top: 3px; width: 24px; height: 24px; border-radius: 999px; background: #FFFFFF; box-shadow: 0 1px 3px rgba(22,32,60,.25); {{knob}}"></span></button>'
rule = '''    <div style="''' + LIST + '''; padding: 6px; display: flex; flex-direction: column; gap: 2px">
''' + row('Put items that fit on sale', '{{toggleSub}}', icon_well('tag', 'manager'), toggle) + '''
      <sc-if value="{{on}}" hint-placeholder-val="{{ false }}">
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 6px 10px 12px">
        <span style="font-size: 12px; font-weight: 700; color: #5F6980">At this markup</span>
        ''' + stepper('mr_pct', '{{pct}}', '%', '{{less}}', '{{more}}', 'Markup in percent') + '''
        <span style="font-size: 12px; font-weight: 700; color: #5F6980">Only when the room under the cheapest rival is</span>
        <div role="radiogroup" aria-label="Room needed" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px"><sc-for list="{{bands}}" as="b" hint-placeholder-count="2"><button type="button" role="radio" aria-checked="{{b.on}}" onClick="{{b.pick}}" style="{{b.style}}"><span class="nm" style="font-size: 14px; font-weight: 700">{{b.label}}</span><span style="font-size: 11px; font-weight: 600; {{b.subInk}}">{{b.sub}}</span></button></sc-for></div>
        <span style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #5F6980">''' + svg('clock', 14, 2) + '''Each one can be changed for 24 hours after it goes on sale</span>
      </div>
      </sc-if>
    </div>'''
log_row = '''      <div style="display: flex; align-items: center; gap: 12px; min-height: 66px; padding: 0 10px; border-top: {{l.rule}}">
        <span role="img" aria-label="{{l.aria}}" style="position: relative; width: 42px; height: 42px; flex: none; display: block"><svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="17" fill="none" stroke="#EFECE6" stroke-width="4"></circle><circle cx="21" cy="21" r="17" fill="none" stroke="{{l.col}}" stroke-width="4" stroke-linecap="round" stroke-dasharray="{{l.dash}}" transform="rotate(-90 21 21)"></circle></svg><span class="m" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600">{{l.left}}</span></span>
        <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span class="nm" style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{l.name}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">{{l.sub}}</span></span>
        <span style="flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 4px"><span class="m" style="font-size: 14px; font-weight: 600">{{l.price}}</span><sc-if value="{{l.kept}}" hint-placeholder-val="{{ false }}"><span style="height: 22px; padding: 0 8px; border-radius: 999px; background: #E4F4EA; color: #0F6B43; font-size: 11px; font-weight: 700; display: flex; align-items: center">kept</span></sc-if><sc-if value="{{l.held}}" hint-placeholder-val="{{ false }}"><span style="height: 22px; padding: 0 8px; border-radius: 999px; background: #FDEEE1; color: #7A4A02; font-size: 11px; font-weight: 700; display: flex; align-items: center">held</span></sc-if></span>
      </div>
      <sc-if value="{{l.open}}" hint-placeholder-val="{{ true }}"><div style="display: flex; justify-content: flex-end; gap: 8px; padding: 0 10px 12px 64px"><button type="button" onClick="{{l.hold}}" style="all: unset; cursor: pointer; height: 32px; padding: 0 12px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; color: #16203C; font-size: 12px; font-weight: 700; display: flex; align-items: center">Hold this one</button><a href="ManagerItem.dc.html" style="height: 32px; padding: 0 12px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 12px; font-weight: 700; display: flex; align-items: center">Change</a></div></sc-if>'''
waited = lst(row('Paint roller 9"', 'Room <span class="m">14</span>% is Fair, the rule needs Strong · waits for you', icon_well('clock', 'amber'), chev('#95530C'), href='ManagerItem.dc.html', sub_style='color: #7A4A02'))
bd = body('\n'.join([
    sec('The rule', first=True), rule,
    sec('By the rule this week', 'ring: hours left to change it'),
    '    <sc-if value="{{on}}" hint-placeholder-val="{{ true }}"><div style="' + LIST + '; padding: 0 6px">\n      <sc-for list="{{log}}" as="l" hint-placeholder-count="3">\n' + log_row + '\n      </sc-for>\n    </div></sc-if>',
    '    <sc-if value="{{off}}" hint-placeholder-val="{{ false }}"><div style="' + LIST + '; padding: 18px; display: flex; align-items: center; gap: 12px">' + icon_well('tag', 'plain') + '<span style="font-size: 14px; font-weight: 700; color: #5F6980">Nothing on sale by a rule · every new item waits for you</span></div></sc-if>',
    '    <sc-if value="{{on}}" hint-placeholder-val="{{ true }}">' + sec('Did not fit the rule') + '</sc-if>', '    <sc-if value="{{on}}" hint-placeholder-val="{{ true }}">' + waited + '</sc-if>',
]))
ft = foot('<button type="button" onClick="{{save}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{saveStyle}}">{{saveLabel}}</button>')
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { on: true, pct: 25, band: 'strong', saved: true, held: {} }; }
  renderVals() {
    const S = this.state;
    const bands = [['strong', 'Strong only', '20% or more'], ['fair', 'Fair or better', '10% or more']].map(([k, label, sub]) => ({
      label, sub, on: String(S.band === k), pick: () => this.setState({ band: k, saved: false }),
      subInk: S.band === k ? 'color:#B3BCD2' : 'color:#5F6980',
      style: 'all:unset;cursor:pointer;box-sizing:border-box;height:64px;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;' + (S.band === k ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;box-shadow:inset 0 0 0 1.5px #E6E3DD')
    }));
    const C = 2 * 3.14159 * 17;
    const log = [
      { name: 'Grout, white 5kg', sub: 'Moses · at 25% · room strong', price: '18,500', h: 20 },
      { name: 'Tile spacers 3mm, bag of 100', sub: 'Moses · at 25% · room strong', price: '4,500', h: 9 },
      { name: 'Tile adhesive 20kg', sub: 'Moses · at 25% · on sale Thursday', price: '46,000', h: 0 }
    ].map((l, i) => ({ ...l, rule: i ? '1px solid #EFECE6' : 'none', open: l.h > 0 && !S.held[l.name], kept: l.h === 0, held: !!S.held[l.name],
      hold: () => this.setState({ held: { ...S.held, [l.name]: true } }), sub: S.held[l.name] ? 'Off sale · waits for you in New items' : l.sub,
      left: l.h ? l.h + 'h' : '', col: l.h ? '#95530C' : '#0F6B43', dash: (l.h ? C * l.h / 24 : C).toFixed(1) + ' ' + C.toFixed(1),
      aria: l.h ? l.h + ' of 24 hours left to change it' : 'Past 24 hours, kept' }));
    const ready = !S.on || !!S.band;
    return {
      on: S.on, off: !S.on, onStr: String(S.on), pct: S.pct, bands, log,
      byRule: S.on ? String(3 - Object.keys(S.held).length) : '0', changedN: '1', waitedN: S.on ? String(1 + Object.keys(S.held).length) : '0',
      toggleSub: S.on ? 'On · items that fit go on sale at once' : 'Off · each new item waits for you',
      toggle: () => this.setState({ on: !S.on, saved: false }),
      track: S.on ? 'background:#0F6B43' : 'background:#E0DCD4', knob: S.on ? 'left:23px' : 'left:3px',
      less: () => this.setState({ pct: Math.max(0, S.pct - 1), saved: false }), more: () => this.setState({ pct: S.pct + 1, saved: false }),
      save: () => { if (ready) this.setState({ saved: true }); },
      saveLabel: S.saved ? 'Saved · Joseph is told' : !ready ? 'Pick the room it needs' : S.on ? 'Save the rule' : 'Save · every item waits for you',
      saveStyle: S.saved ? 'background:#E4F4EA;color:#0F6B43' : ready ? 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)' : 'background:#F3D3CF;color:#8E2A22'
    };
  }
}'''
html = page('Manager app · price rule', hd + '\n' + bd + '\n' + ft, script)
