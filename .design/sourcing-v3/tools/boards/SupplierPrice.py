from ow import *
from _keypad import KEYPAD, KEYS_JS, TOAST

fig = '''    <div style="display: flex; align-items: baseline; justify-content: center; gap: 10px; padding: 4px 0 2px">
      <span class="m" style="font-size: 40px; font-weight: 600; line-height: 1; letter-spacing: -.03em">{{shown}}</span><span style="font-size: 14px; font-weight: 600; color: #B3BCD2">{{unitWord}}</span>
    </div>'''
pic = title_block('PPR pipe 25mm × 4m', 'Owino Plumbing · our first price for it', face('OP', 'indigo', 52)) + '\n' + fig
hd = head('Their price', circ('Visit.dc.html', 'back', 'Back to the visit'), '', pic, gap=14)
segp = lambda lst_, item: '    <div role="radiogroup" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 3px; border-radius: 14px; background: #F1EEE8"><sc-for list="{{' + lst_ + '}}" as="' + item + '" hint-placeholder-count="2"><button type="button" role="radio" aria-checked="{{' + item + '.on}}" onClick="{{' + item + '.pick}}" style="{{' + item + '.style}}">{{' + item + '.label}}</button></sc-for></div>'
has_block = '''    <sc-if value="{{has}}" hint-placeholder-val="{{ false }}">
    <div style="display: flex; flex-direction: column; gap: 10px">
''' + sec('Sold by') + '\n' + segp('units', 'u') + '\n    ' + KEYPAD + '\n' + sec('Cheaper when you buy more') + '''
    <div style="''' + LIST + '''; padding: 6px; display: flex; flex-direction: column; gap: 2px">
      <sc-for list="{{steps}}" as="s" hint-placeholder-count="2">
        <div style="display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 10px">
          <span style="flex: 1; font-size: 13px; font-weight: 600; color: #5F6980"><span class="m" style="color: #1C2233">{{s.from}}</span> or more</span>
          <span style="width: 70px; height: 6px; border-radius: 3px; background: #EFECE6; display: block"><span style="display: block; height: 6px; border-radius: 3px; background: #3A3F9B; {{s.w}}"></span></span>
          <span class="m" style="width: 70px; text-align: right; font-size: 15px; font-weight: 600">{{s.price}}</span>
        </div>
      </sc-for>
      <button type="button" onClick="{{addStep}}" style="all: unset; cursor: pointer; display: flex; align-items: center; gap: 8px; min-height: 46px; padding: 0 10px; color: #3A3F9B; font-size: 13px; font-weight: 700">''' + svg('plus', 16, 2.2) + '''Add a step</button>
    </div>
''' + sec('Delivers in', 'optional') + '''
    <div style="display: flex; gap: 6px"><sc-for list="{{lead}}" as="l" hint-placeholder-count="3"><button type="button" aria-pressed="{{l.on}}" onClick="{{l.pick}}" style="{{l.style}}">{{l.label}}</button></sc-for></div>
    </div>
    </sc-if>
    <sc-if value="{{hasNot}}" hint-placeholder-val="{{ false }}">
''' + lst(row('Owino Plumbing doesn’t sell it', 'Nobody asks them again for 90 days', icon_well('close', 'plain'), '')) + '''
    </sc-if>'''
bd = body('\n'.join([sec('Do they have it?', first=True), segp('haves', 'h'), has_block]))
ft = '''  <div style="flex: none; padding: 12px 16px 22px; display: flex; flex-direction: column; gap: 8px">
    <sc-if value="{{notSaved}}" hint-placeholder-val="{{ true }}">
      <button type="button" onClick="{{save}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{ctaStyle}}">{{cta}}</button>
    </sc-if>
    <sc-if value="{{saved}}" hint-placeholder-val="{{ false }}">
      ''' + TOAST + '''
      ''' + pill('Back to the visit', href='Visit.dc.html', kind='ghost') + '''
    </sc-if>
  </div>'''
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { has: null, unit: null, lead: null, extra: false, v: '', saved: false }; }
  renderVals() {
    const { has, unit, lead, extra, v, saved } = this.state;
    const n = Number(v || 0), fmt = (x) => x.toLocaleString('en-US');
    const seg = (on) => 'all:unset;cursor:pointer;box-sizing:border-box;height:40px;border-radius:11px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;' + (on ? 'background:#FFFFFF;color:#1C2233;box-shadow:0 1px 3px rgba(22,32,60,.12)' : 'color:#5F6980');
    const chip = (on) => 'all:unset;cursor:pointer;box-sizing:border-box;height:36px;padding:0 14px;border-radius:999px;font-size:13px;font-weight:700;display:flex;align-items:center;' + (on ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;box-shadow:inset 0 0 0 1.5px #E6E3DD');
    const haves = [[true, 'They have it'], [false, 'They don’t']].map(([k, label]) => ({ label, on: String(has === k), pick: () => this.setState({ has: k }), style: seg(has === k) }));
    const units = ['a length', 'a bundle of 10'].map(label => ({ label, on: String(unit === label), pick: () => this.setState({ unit: label }), style: seg(unit === label) }));
    const leadOpts = ['Same day', '2 d', '7 d'].map(label => ({ label, on: String(lead === label), pick: () => this.setState({ lead: lead === label ? null : label }), style: chip(lead === label) }));
    ''' + KEYS_JS + '''
    const raw = [{ from: '1', p: n }, { from: '10', p: 13800 }].concat(extra ? [{ from: '50', p: 13200 }] : []);
    const top = Math.max(...raw.map(s => s.p), 1);
    const steps = raw.map(s => ({ from: s.from, price: fmt(s.p), w: 'width:' + Math.round(s.p / top * 100) + '%' }));
    const ready = has === false || (has === true && n > 0 && !!unit);
    const cta = has === null ? 'Do they have it?' : has === false ? 'Save: they don’t sell it' : !n ? 'Type their price' : !unit ? 'Pick how they sell it' : 'Save ' + fmt(n) + ' ' + unit;
    return {
      haves, units, lead: leadOpts, steps, keys, has: has === true, hasNot: has === false,
      shown: n ? fmt(n) : '0', unitWord: unit || '',
      addStep: () => this.setState({ extra: true }),
      saved, notSaved: !saved, cta,
      ctaStyle: ready ? 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)' : 'background:#F3D3CF;color:#8E2A22',
      save: () => { if (ready) this.setState({ saved: true }); },
      undo: () => this.setState({ saved: false }),
      savedWord: has ? 'Saved · ' + fmt(n) + ' ' + (unit || '') : 'Saved · Owino doesn’t sell it'
    };
  }
}'''
html = page('Their price', hd + '\n' + bd + '\n' + ft, script)
