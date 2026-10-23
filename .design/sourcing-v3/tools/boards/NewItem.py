from ow import *

segh = '''    <div role="radiogroup" aria-label="How you found it" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 3px; border-radius: 14px; background: rgba(255,255,255,.08)">
      <sc-for list="{{modes}}" as="m" hint-placeholder-count="2"><button type="button" role="radio" aria-checked="{{m.on}}" onClick="{{m.pick}}" style="{{m.style}}">{{m.label}}</button></sc-for>
    </div>'''
hd = head('A new item', circ('Capture.dc.html', 'back', 'Back'), '', segh)
chips = lambda lst_, item: ('    <div style="display: flex; flex-wrap: wrap; gap: 6px">\n      <sc-for list="{{' + lst_ + '}}" as="' + item + '" hint-placeholder-count="3"><button type="button" aria-pressed="{{' + item + '.on}}" onClick="{{' + item + '.pick}}" style="{{' + item + '.style}}">{{' + item + '.label}}</button></sc-for>\n    </div>')
photo = '    <a href="PhotoGate.dc.html" style="display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 0 14px; border-radius: 20px; box-shadow: inset 0 0 0 1.5px #C9C4BA; background: transparent">' + icon_well('camera', 'plain', 40, 12) + '<span style="flex: 1; font-size: 14px; font-weight: 700">Add a photo</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">optional now</span></a>'
name = ('    <label style="display: flex; flex-direction: column; gap: 6px"><span style="padding: 0 4px; font-size: 13px; font-weight: 700; color: #5F6980">What is it?</span>'
        '<input value="Grout float, rubber" aria-label="What is it?" style="box-sizing: border-box; height: 52px; padding: 0 14px; border-radius: 16px; border: none; box-shadow: inset 0 0 0 2px #16203C; background: #FFFFFF; font: inherit; font-size: 16px; font-weight: 600; color: #1C2233"></label>'
        '\n    <span style="display: flex; align-items: center; gap: 6px; padding: 0 4px; font-size: 12px; font-weight: 700; color: #0F6B43">' + svg('tick', 13, 3) + 'Not in the catalogue, and no hunt has it yet</span>')
seen = '''    <sc-if value="{{seen}}" hint-placeholder-val="{{ true }}">
    <div style="display: flex; flex-direction: column; gap: 10px">
''' + sec('Where you saw it') + '\n' + chips('wheres', 'w') + '\n' + sec('Their price, if you have it') + '''
    <div style="''' + LIST + '''; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px">
      <div style="display: flex; align-items: center; gap: 8px">
        <input value="" placeholder="0" inputmode="numeric" aria-label="Their price" style="box-sizing: border-box; flex: 1; min-width: 0; height: 52px; padding: 0 12px; border-radius: 14px; border: none; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 600">
        <span style="font-size: 14px; font-weight: 700; color: #5F6980">per</span>
        <button type="button" onClick="{{toggleUnits}}" aria-expanded="{{unitsStr}}" aria-label="What the price is for" style="all: unset; cursor: pointer; box-sizing: border-box; min-width: 116px; height: 52px; padding: 0 12px; border-radius: 14px; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: space-between; gap: 6px; {{unitBtn}}">{{unitLabel}}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></button>
      </div>
      <sc-if value="{{unitsOpen}}" hint-placeholder-val="{{ false }}">
      <div role="listbox" aria-label="Units" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px">
        <sc-for list="{{units}}" as="u" hint-placeholder-count="6"><button type="button" role="option" aria-selected="{{u.on}}" onClick="{{u.pick}}" style="{{u.style}}">{{u.label}}</button></sc-for>
        <label style="grid-column: span 3; display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 6px 0 12px; border-radius: 12px; background: #F7F5F2"><span style="flex: 1; font-size: 13px; font-weight: 700">A pack of</span><input value="" placeholder="how many" inputmode="numeric" aria-label="Pieces in a pack" style="width: 92px; height: 36px; border: none; border-radius: 10px; box-shadow: inset 0 0 0 1.5px #E6E3DD; background: #FFFFFF; text-align: center; font-family: 'IBM Plex Mono', monospace; font-size: 15px; font-weight: 600"><button type="button" onClick="{{pickPack}}" style="all: unset; cursor: pointer; height: 36px; padding: 0 12px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 12px; font-weight: 700; display: flex; align-items: center">Use</button></label>
      </div>
      </sc-if>
    </div>
    </div>
    </sc-if>'''
asked = '''    <sc-if value="{{asked}}" hint-placeholder-val="{{ false }}">
    <div style="display: flex; flex-direction: column; gap: 10px">
''' + sec('Who asked') + '\n' + chips('whos', 'w') + '\n' + sec('How many') + '''
    <div style="''' + LIST + '''; padding: 12px 14px">''' + stepper('ni_qty', '{{qty}}', 'pcs', '{{less}}', '{{more}}', 'How many they want') + '''</div>
    </div>
    </sc-if>'''
more_btn = '<button type="button" onClick="{{toggleMore}}" aria-expanded="{{moreStr}}" style="all: unset; cursor: pointer; box-sizing: border-box; height: 36px; padding: 0 14px; border-radius: 999px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; {{moreStyle}}">' + svg('search', 13, 2.4) + '{{moreLabel}}</button>'
more = '''    <sc-if value="{{moreOpen}}" hint-placeholder-val="{{ false }}">
    <div style="''' + LIST + '''; padding: 10px; display: flex; flex-direction: column; gap: 8px">
      <label style="display: flex; align-items: center; gap: 8px; height: 46px; padding: 0 12px; border-radius: 14px; box-shadow: inset 0 0 0 2px #16203C; color: #5F6980">''' + svg('search', 16, 2.2) + '''<input value="" placeholder="Find an aisle" aria-label="Find an aisle" style="flex: 1; min-width: 0; height: 44px; border: none; outline: none; background: transparent; font: inherit; font-size: 15px; font-weight: 600; color: #1C2233"><span style="font-size: 11px; font-weight: 600">all <span class="m">14</span></span></label>
      <div style="display: flex; flex-wrap: wrap; gap: 6px"><sc-for list="{{others}}" as="o" hint-placeholder-count="9"><button type="button" onClick="{{o.pick}}" style="all: unset; cursor: pointer; box-sizing: border-box; height: 36px; padding: 0 12px; border-radius: 999px; background: #F7F5F2; font-size: 13px; font-weight: 700; display: flex; align-items: center">{{o.label}}</button></sc-for></div>
      <div style="display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 12px; border-radius: 16px; background: #F7F5F2">''' + svg('plus', 16, 2.4, '#5F6980') + '''<input value="Garden & outdoor" aria-label="A new aisle" style="flex: 1; min-width: 0; height: 44px; border: none; outline: none; background: transparent; font: inherit; font-size: 15px; font-weight: 600; color: #1C2233"><button type="button" onClick="{{newAisle}}" style="all: unset; cursor: pointer; height: 40px; padding: 0 14px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center">New aisle</button></div>
      <span style="padding: 0 2px; font-size: 12px; font-weight: 600; color: #5F6980">Not sure? Leave it; you can set it on the passport later</span>
    </div>
    </sc-if>'''
aisle_chips = chips('aisles', 'a')
aisle_chips = aisle_chips[:aisle_chips.rindex('</div>')] + more_btn + '</div>'
bd = body('\n'.join([photo, name, sec('Aisle', 'pick one, or leave it'), aisle_chips, more, seen, asked]))
ft = foot('<a href="Funnel.dc.html" style="height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{ctaStyle}}">{{cta}}</a>')
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { mode: null, aisle: null, where: null, who: null, qty: 0, more: false, unit: null, unitsOpen: false }; }
  renderVals() {
    const { mode, aisle, where, who, qty, more, unit, unitsOpen } = this.state;
    const TOP = ['Tiles & finishing', 'Fasteners', 'Plumbing', 'Steel & mesh', 'Roofing'];
    const shown = !aisle || TOP.includes(aisle) ? TOP : TOP.slice(0, 4).concat([aisle]);
    const seg = (on) => 'all:unset;cursor:pointer;box-sizing:border-box;height:40px;border-radius:11px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;' + (on ? 'background:#FFFFFF;color:#16203C' : 'color:#B3BCD2');
    const chip = (on) => 'all:unset;cursor:pointer;box-sizing:border-box;height:36px;padding:0 14px;border-radius:999px;font-size:13px;font-weight:700;display:flex;align-items:center;' + (on ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;box-shadow:inset 0 0 0 1.5px #E6E3DD');
    const pickList = (key, cur, labels) => labels.map(label => ({ label, on: String(cur === label), pick: () => this.setState({ [key]: cur === label ? null : label }), style: chip(cur === label) }));
    const modes = [['seen', 'I saw it'], ['asked', 'Someone asked']].map(([k, label]) => ({ label, on: String(mode === k), pick: () => this.setState({ mode: k }), style: seg(mode === k) }));
    const ready = !!mode && (mode === 'seen' || !!who);
    return {
      modes, seen: mode === 'seen', asked: mode === 'asked', qty,
      aisles: pickList('aisle', aisle, shown),
      units: ['piece', 'metre', 'kg', 'roll', 'sheet', 'length'].map(label => ({ label, on: String(unit === label), pick: () => this.setState({ unit: label, unitsOpen: false }),
        style: 'all:unset;cursor:pointer;box-sizing:border-box;height:44px;border-radius:12px;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;' + (unit === label ? 'background:#16203C;color:#FFFFFF' : 'background:#F7F5F2;color:#1C2233') })),
      unitsOpen, unitsStr: String(unitsOpen), toggleUnits: () => this.setState({ unitsOpen: !unitsOpen }),
      pickPack: () => this.setState({ unit: 'pack of 12', unitsOpen: false }),
      unitLabel: unit || 'unit', unitBtn: unit ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;color:#5F6980;box-shadow:inset 0 0 0 1.5px #C9C4BA',
      moreOpen: more, moreStr: String(more), moreLabel: more ? 'Close' : 'Other aisle', toggleMore: () => this.setState({ more: !more }),
      moreStyle: more ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;color:#16203C;box-shadow:inset 0 0 0 1.5px #C9C4BA',
      others: ['Cement & sand', 'Timber', 'Paint', 'Electrical', 'Tools', 'Doors & locks', 'Gutters', 'Water tanks', 'Safety gear'].map(label => ({ label, pick: () => this.setState({ aisle: label, more: false }) })),
      newAisle: () => this.setState({ aisle: 'Garden & outdoor', more: false }),
      wheres: pickList('where', where, ['Katwe Fabricators', 'At a rival', 'Another supplier']),
      whos: pickList('who', who, ['Ggaba Stores', 'Nansana Hardware', 'Someone else']),
      less: () => this.setState({ qty: Math.max(0, qty - 10) }), more: () => this.setState({ qty: qty + 10 }),
      cta: !mode ? 'Say how you found it' : mode === 'asked' ? (who ? 'Add the ask' : 'Say who asked') : 'Start the hunt',
      ctaStyle: ready ? 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)' : 'background:#F3D3CF;color:#8E2A22;pointer-events:none'
    };
  }
}'''
html = page('A new item', hd + '\n' + bd + '\n' + ft, script)
