from ow import *

segh = '''    <div role="radiogroup" aria-label="How you found it" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 3px; border-radius: 14px; background: rgba(255,255,255,.08)">
      <sc-for list="{{modes}}" as="m" hint-placeholder-count="2"><button type="button" role="radio" aria-checked="{{m.on}}" onClick="{{m.pick}}" style="{{m.style}}">{{m.label}}</button></sc-for>
    </div>'''
hd = head('A new item', circ('Capture.dc.html', 'back', 'Back'), '', segh)
chips = lambda lst_, item: ('    <div style="display: flex; flex-wrap: wrap; gap: 6px">\n      <sc-for list="{{' + lst_ + '}}" as="' + item + '" hint-placeholder-count="3"><button type="button" aria-pressed="{{' + item + '.on}}" onClick="{{' + item + '.pick}}" style="{{' + item + '.style}}">{{' + item + '.label}}</button></sc-for>\n    </div>')
photo = '    <a href="PhotoGate.dc.html" style="display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 0 14px; border-radius: 20px; box-shadow: inset 0 0 0 1.5px #C9C4BA; background: transparent">' + icon_well('camera', 'plain', 40, 12) + '<span style="flex: 1; font-size: 14px; font-weight: 700">Add a photo</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">optional now</span></a>'
name = ('    <label style="display: flex; flex-direction: column; gap: 6px"><span style="padding: 0 4px; font-size: 13px; font-weight: 700; color: #5F6980">What is it?</span>'
        '<input value="Tile spacers 3mm" aria-label="What is it?" style="box-sizing: border-box; height: 52px; padding: 0 14px; border-radius: 16px; border: none; box-shadow: inset 0 0 0 2px #16203C; background: #FFFFFF; font: inherit; font-size: 16px; font-weight: 600; color: #1C2233"></label>'
        '\n    <span style="display: flex; align-items: center; gap: 6px; padding: 0 4px; font-size: 12px; font-weight: 700; color: #0F6B43">' + svg('tick', 13, 3) + 'Not in the catalogue, and no hunt has it yet</span>')
seen = '''    <sc-if value="{{seen}}" hint-placeholder-val="{{ true }}">
    <div style="display: flex; flex-direction: column; gap: 10px">
''' + sec('Where you saw it') + '\n' + chips('wheres', 'w') + '\n' + sec('Their price, if you have it') + '''
    <div style="''' + LIST + '''; padding: 12px 14px; display: flex; align-items: center; gap: 10px">
      <input value="" placeholder="0" inputmode="numeric" aria-label="Their price" style="box-sizing: border-box; flex: 1; min-width: 0; height: 48px; padding: 0 12px; border-radius: 14px; border: none; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 600">
      <span style="font-size: 13px; font-weight: 700; color: #5F6980">a bag of</span>
      <input value="100" inputmode="numeric" aria-label="Pieces in a bag" style="box-sizing: border-box; width: 64px; height: 48px; padding: 0 8px; border-radius: 14px; border: none; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-family: 'IBM Plex Mono', monospace; font-size: 16px; font-weight: 600; text-align: center">
    </div>
    </div>
    </sc-if>'''
asked = '''    <sc-if value="{{asked}}" hint-placeholder-val="{{ false }}">
    <div style="display: flex; flex-direction: column; gap: 10px">
''' + sec('Who asked') + '\n' + chips('whos', 'w') + '\n' + sec('How many') + '''
    <div style="''' + LIST + '''; padding: 12px 14px">''' + stepper('ni_qty', '{{qty}}', 'pcs', '{{less}}', '{{more}}', 'How many they want') + '''</div>
    </div>
    </sc-if>'''
bd = body('\n'.join([photo, name, sec('Aisle'), chips('aisles', 'a'), seen, asked]))
ft = foot('<a href="Funnel.dc.html" style="height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{ctaStyle}}">{{cta}}</a>')
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { mode: null, aisle: null, where: null, who: null, qty: 0 }; }
  renderVals() {
    const { mode, aisle, where, who, qty } = this.state;
    const seg = (on) => 'all:unset;cursor:pointer;box-sizing:border-box;height:40px;border-radius:11px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;' + (on ? 'background:#FFFFFF;color:#16203C' : 'color:#B3BCD2');
    const chip = (on) => 'all:unset;cursor:pointer;box-sizing:border-box;height:36px;padding:0 14px;border-radius:999px;font-size:13px;font-weight:700;display:flex;align-items:center;' + (on ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;box-shadow:inset 0 0 0 1.5px #E6E3DD');
    const pickList = (key, cur, labels) => labels.map(label => ({ label, on: String(cur === label), pick: () => this.setState({ [key]: cur === label ? null : label }), style: chip(cur === label) }));
    const modes = [['seen', 'I saw it'], ['asked', 'Someone asked']].map(([k, label]) => ({ label, on: String(mode === k), pick: () => this.setState({ mode: k }), style: seg(mode === k) }));
    const ready = !!mode && (mode === 'seen' || !!who);
    return {
      modes, seen: mode === 'seen', asked: mode === 'asked', qty,
      aisles: pickList('aisle', aisle, ['Tiles & finishing', 'Fasteners', 'Plumbing', 'Steel & mesh', 'Roofing']),
      wheres: pickList('where', where, ['Katwe Fabricators', 'At a rival', 'Another supplier']),
      whos: pickList('who', who, ['Ggaba Stores', 'Nansana Hardware', 'Someone else']),
      less: () => this.setState({ qty: Math.max(0, qty - 10) }), more: () => this.setState({ qty: qty + 10 }),
      cta: !mode ? 'Say how you found it' : mode === 'asked' ? (who ? 'Add the ask' : 'Say who asked') : 'Start the hunt',
      ctaStyle: ready ? 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)' : 'background:#F3D3CF;color:#8E2A22;pointer-events:none'
    };
  }
}'''
html = page('A new item', hd + '\n' + bd + '\n' + ft, script)
