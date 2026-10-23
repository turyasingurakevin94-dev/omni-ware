from ow import *
from _keypad import KEYPAD, KEYS_JS, TOAST

fig = '''    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 2px 0">
      <span style="display: flex; align-items: baseline; gap: 10px"><span class="m" style="font-size: 44px; font-weight: 600; line-height: 1; letter-spacing: -.03em">{{shown}}</span><span style="font-size: 14px; font-weight: 600; color: #B3BCD2">{{unitWord}}</span></span>
      <span style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #B3BCD2">last seen <span class="m" style="color: #FFFFFF">147,000</span> · 8 Oct
        <sc-if value="{{hasDelta}}" hint-placeholder-val="{{ true }}"><span class="m" style="display: inline-flex; align-items: center; gap: 2px; height: 22px; padding: 0 7px; border-radius: 999px; background: rgba(245,178,107,.16); color: #F5B26B">{{deltaWord}}</span></sc-if>
        <button type="button" onClick="{{useLast}}" style="all: unset; cursor: pointer; height: 26px; padding: 0 10px; border-radius: 999px; background: rgba(255,255,255,.1); color: #FFFFFF; font-size: 12px; font-weight: 700; display: flex; align-items: center">Same</button>
      </span>
    </div>'''
pic = title_block('Wire mesh BRC A142', 'Kikuubo Hardware Mart · a rival', face('KH', 'manager', 52)) + '\n' + fig
hd = head('Rival price', circ('MarketRun.dc.html', 'back', 'Back to the walk'), '', pic, gap=14)
segp = lambda lst_, item, n=2: '    <div role="radiogroup" style="display: grid; grid-template-columns: repeat(' + str(n) + ', minmax(0, 1fr)); gap: 4px; padding: 3px; border-radius: 14px; background: #F1EEE8"><sc-for list="{{' + lst_ + '}}" as="' + item + '" hint-placeholder-count="' + str(n) + '"><button type="button" role="radio" aria-checked="{{' + item + '.on}}" onClick="{{' + item + '.pick}}" style="{{' + item + '.style}}">{{' + item + '.label}}</button></sc-for></div>'
recent = lst('\n'.join(row(i, '', icon_well('rival', 'manager', 34, 10), f'<span style="flex: none; display: flex; align-items: baseline; gap: 8px"><span class="m" style="font-size: 14px; font-weight: 600">{p}</span><span style="font-size: 11px; font-weight: 600; color: #5F6980">{w}</span></span>', min_h=48)
                       for i, p, w in [('Gate valve ½"', '19,500', '14 Oct'), ('Y12 rebar, 12m', '47,500', '10 Oct'), ('Iron sheet G28, 3m', '36,000', '9 Oct')]))
bd = body('\n'.join([sec('Sold by', first=True), segp('units', 'u'), sec('Do they have it?'), segp('stock', 's', 3), sec('Last seen here'), recent]))
ft = '''  <div style="flex: none; padding: 10px 16px 18px; display: flex; flex-direction: column; gap: 8px; background: #EFECE6; border-radius: 26px 26px 0 0">
    <sc-if value="{{notSaved}}" hint-placeholder-val="{{ true }}">
    ''' + KEYPAD + '''
    <button type="button" onClick="{{save}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 56px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{ctaStyle}}">{{cta}}</button>
    </sc-if>
    <sc-if value="{{saved}}" hint-placeholder-val="{{ false }}">
      ''' + TOAST + '''
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
        <a href="Search.dc.html" style="height: 52px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center">Next item here</a>
        <a href="MarketRun.dc.html" style="height: 52px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center">Back to the walk</a>
      </div>
    </sc-if>
  </div>'''
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { v: '149000', stock: null, unit: null, saved: false }; }
  renderVals() {
    const { v, unit, stock, saved } = this.state;
    const n = Number(v || 0), fmt = (x) => x.toLocaleString('en-US');
    const d = n - 147000;
    ''' + KEYS_JS + '''
    const seg = (on) => 'all:unset;cursor:pointer;box-sizing:border-box;height:40px;border-radius:11px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;' + (on ? 'background:#FFFFFF;color:#1C2233;box-shadow:0 1px 3px rgba(22,32,60,.12)' : 'color:#5F6980');
    const stockL = ['Yes', 'A few', 'No'].map(label => ({ label, on: String(stock === label), pick: () => this.setState({ stock: label }), style: seg(stock === label) }));
    const units = ['a sheet', 'a bundle of 10'].map(label => ({ label, on: String(unit === label), pick: () => this.setState({ unit: label }), style: seg(unit === label) }));
    const ready = n > 0 && !!unit && !!stock;
    return {
      shown: n ? fmt(n) : '0', keys, stock: stockL, units, unitWord: unit || '',
      hasDelta: !!n && d !== 0 && unit === 'a sheet', deltaWord: (d > 0 ? '+' : '−') + fmt(Math.abs(d)),
      useLast: () => this.setState({ v: '147000', unit: 'a sheet' }),
      saved, notSaved: !saved,
      cta: !unit ? 'Pick how they sell it' : !stock ? 'Do they have it?' : 'Save the price',
      ctaStyle: ready ? 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)' : 'background:#F3D3CF;color:#8E2A22',
      save: () => { if (ready) this.setState({ saved: true }); },
      undo: () => this.setState({ saved: false }),
      savedWord: 'Saved · Kikuubo ' + fmt(n) + ' ' + (unit || '')
    };
  }
}'''
html = page('Rival price', hd + '\n' + bd + '\n' + ft, script)
