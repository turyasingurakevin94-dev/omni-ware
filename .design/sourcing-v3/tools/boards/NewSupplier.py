from ow import *

def big(onclick, title, sub, icon):
    return (f'<button type="button" onClick="{onclick}" style="all: unset; cursor: pointer; box-sizing: border-box; height: 84px; border-radius: 18px; background: rgba(255,255,255,.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); padding: 12px; display: flex; flex-direction: column; justify-content: space-between">'
            f'{svg(icon, 22, 2, "#FFFFFF")}<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 14px; font-weight: 700">{title}</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">{sub}</span></span></button>')
pic = ('    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">' + big('{{read}}', 'Snap their card', 'fills the fields', 'camera') + big('{{read}}', 'From contacts', 'name and phone', 'user') + '</div>\n'
       '    <sc-if value="{{filled}}" hint-placeholder-val="{{ false }}"><span style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #6FDCB0">' + svg('tick', 13, 3) + 'Read from the card · check each field</span></sc-if>')
hd = head('A new supplier', circ('Suppliers.dc.html', 'back', 'Back to Suppliers'), '', pic, gap=12)
field = lambda label, val, mono=False: ('    <label style="display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 14px; border-radius: 16px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD">'
                                        f'<span style="width: 54px; font-size: 12px; font-weight: 700; color: #5F6980">{label}</span><input value="{val}" aria-label="{label}" style="flex: 1; min-width: 0; border: none; outline: none; background: transparent; font: inherit; font-size: 15px; font-weight: 600{"; font-family: IBM Plex Mono, monospace" if mono else ""}"></label>')
twin = '''    <sc-if value="{{open}}" hint-placeholder-val="{{ true }}">
    <div style="border-radius: 20px; background: #FFFBF6; box-shadow: inset 0 0 0 1.5px #F3DCC4; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px">
      <span style="display: flex; align-items: center; gap: 10px">''' + face('KF', 'indigo', 36) + '''<span style="flex: 1; font-size: 13px; font-weight: 700; color: #7A4A02">Katwe Fabricators already has this phone</span></span>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
        <a href="Suppliers.dc.html" style="height: 42px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">Use that one</a>
        <button type="button" onClick="{{different}}" style="all: unset; cursor: pointer; height: 42px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">A different one</button>
      </div>
    </div>
    </sc-if>'''
chips = lambda key: '    <div style="display: flex; flex-wrap: wrap; gap: 6px"><sc-for list="{{' + key + '}}" as="t" hint-placeholder-count="4"><button type="button" aria-pressed="{{t.on}}" onClick="{{t.pick}}" style="{{t.style}}">{{t.label}}</button></sc-for></div>'
bd = body('\n'.join([
    field('Name', '{{nameVal}}'), field('Phone', '{{phoneVal}}', True), twin, field('Where', '{{whereVal}}'),
    sec('What they sell', 'pick any'), chips('tags'),
    sec('Days of credit'), chips('credit'),
]))
ft = foot('<button type="button" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{ctaStyle}}">{{cta}}</button>')
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { diff: false, tags: {}, credit: null, filled: false }; }
  renderVals() {
    const S = this.state;
    const chip = (on) => 'all:unset;cursor:pointer;box-sizing:border-box;height:36px;padding:0 14px;border-radius:999px;font-size:13px;font-weight:700;display:flex;align-items:center;' + (on ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;box-shadow:inset 0 0 0 1.5px #E6E3DD');
    const tags = ['Fabrication', 'Mesh', 'Fasteners', 'Hoop iron', 'Gutters'].map(label => ({ label, on: String(!!S.tags[label]), style: chip(!!S.tags[label]), pick: () => this.setState({ tags: { ...S.tags, [label]: !S.tags[label] } }) }));
    const credit = ['Cash', '7 d', '14 d', '30 d'].map(label => ({ label, on: String(S.credit === label), style: chip(S.credit === label), pick: () => this.setState({ credit: label }) }));
    const ready = S.diff && !!S.credit;
    return {
      tags, credit, open: !S.diff && S.filled, filled: S.filled,
      different: () => this.setState({ diff: true }),
      read: () => this.setState({ filled: true, tags: { Fabrication: true, Mesh: true } }),
      nameVal: S.filled ? 'Kawempe Metal Works' : '', phoneVal: S.filled ? '0772 418 220' : '', whereVal: S.filled ? 'Kawempe, by the market' : '',
      cta: !S.filled ? 'Snap their card, or type' : !S.diff ? 'Answer the look-alike first' : !S.credit ? 'Pick their credit days' : 'Add the supplier',
      ctaStyle: ready ? 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)' : 'background:#F3D3CF;color:#8E2A22'
    };
  }
}'''
html = page('A new supplier', hd + '\n' + bd + '\n' + ft, script)
