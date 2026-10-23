from ow import *

words = '''    <div style="display: flex; flex-wrap: wrap; gap: 6px">
      <sc-for list="{{names}}" as="n" hint-placeholder-count="2"><span style="height: 30px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,.08); font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px">{{n.w}}<span class="m" style="color: #6FDCB0">{{n.n}}</span></span></sc-for>
    </div>'''
pic = title_block('Wire mesh BRC A142', 'Searched for as · each word finds it', icon_well('name', 'plain', 52, 16).replace('background: #F1EEE8; color: #5F6980', 'background: rgba(255,255,255,.08); color: #FFFFFF')) + '\n' + words
hd = head('Name & aisle', circ('Passport.dc.html', 'back', 'Back to the passport'), '', pic)
chips = ('    <div style="display: flex; flex-wrap: wrap; gap: 6px"><sc-for list="{{aisles}}" as="a" hint-placeholder-count="5"><button type="button" aria-pressed="{{a.on}}" onClick="{{a.pick}}" style="{{a.style}}">{{a.label}}</button></sc-for>'
         '<button type="button" onClick="{{toggleMore}}" aria-expanded="{{moreStr}}" style="all: unset; cursor: pointer; box-sizing: border-box; height: 36px; padding: 0 14px; border-radius: 999px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; {{moreStyle}}">' + svg('search', 13, 2.4) + '{{moreLabel}}</button></div>')
more = '''    <sc-if value="{{more}}" hint-placeholder-val="{{ false }}">
    <div style="''' + LIST + '''; padding: 10px; display: flex; flex-direction: column; gap: 8px">
      <label style="display: flex; align-items: center; gap: 8px; height: 46px; padding: 0 12px; border-radius: 14px; box-shadow: inset 0 0 0 2px #16203C; color: #5F6980">''' + svg('search', 16, 2.2) + '''<input value="" placeholder="Find an aisle" aria-label="Find an aisle" style="flex: 1; min-width: 0; height: 44px; border: none; outline: none; background: transparent; font: inherit; font-size: 15px; font-weight: 600; color: #1C2233"><span style="font-size: 11px; font-weight: 600">all <span class="m">14</span></span></label>
      <div style="display: flex; flex-wrap: wrap; gap: 6px"><sc-for list="{{others}}" as="o" hint-placeholder-count="9"><button type="button" onClick="{{o.pick}}" style="all: unset; cursor: pointer; box-sizing: border-box; height: 36px; padding: 0 12px; border-radius: 999px; background: #F7F5F2; font-size: 13px; font-weight: 700; display: flex; align-items: center">{{o.label}}</button></sc-for></div>
      <div style="display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 12px; border-radius: 16px; background: #F7F5F2">''' + svg('plus', 16, 2.4, '#5F6980') + '''<input value="Reinforcement" aria-label="A new aisle" style="flex: 1; min-width: 0; height: 44px; border: none; outline: none; background: transparent; font: inherit; font-size: 15px; font-weight: 600; color: #1C2233"><button type="button" onClick="{{newAisle}}" style="all: unset; cursor: pointer; height: 40px; padding: 0 14px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center">New aisle</button></div>
      <span style="padding: 0 2px; font-size: 12px; font-weight: 600; color: #5F6980">A new aisle shows in every app's aisle list from today</span>
    </div>
    </sc-if>'''
twin = '''    <div style="''' + LIST + '''; padding: 6px">
''' + row('Welded mesh A142', '2.4 × 6.0 m sheet · on sale · Kiseka Steel', icon_well('twins', 'amber'), '') + '''
      <sc-if value="{{open}}" hint-placeholder-val="{{ true }}">
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 2px 6px 8px">
        <button type="button" onClick="{{same}}" style="all: unset; cursor: pointer; height: 42px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">The same item</button>
        <button type="button" onClick="{{diff}}" style="all: unset; cursor: pointer; height: 42px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">Different items</button>
      </div>
      </sc-if>
      <sc-if value="{{decided}}" hint-placeholder-val="{{ false }}"><div style="display: flex; align-items: center; gap: 8px; min-height: 42px; margin: 2px 6px 8px; padding: 0 12px; border-radius: 12px; {{resultStyle}}"><span style="flex: 1; font-size: 12px; font-weight: 700">{{result}}</span><button type="button" onClick="{{undo}}" style="all: unset; cursor: pointer; font-size: 12px; font-weight: 700; color: #16203C">Undo</button></div></sc-if>
    </div>'''
teach = '''    <div style="display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 14px; border-radius: 20px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD">
      <input value="welded mesh" aria-label="Teach a name" style="flex: 1; min-width: 0; height: 44px; border: none; outline: none; background: transparent; font: inherit; font-size: 15px; font-weight: 600">
      <button type="button" onClick="{{teach}}" style="all: unset; cursor: pointer; height: 40px; padding: 0 16px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center">{{teachLabel}}</button>
    </div>'''
bd = body('\n'.join([
    sec('Name', first=True),
    '    <input value="Wire mesh BRC A142" aria-label="Name" style="flex: none; box-sizing: border-box; height: 52px; padding: 0 14px; border-radius: 16px; border: none; box-shadow: inset 0 0 0 2px #16203C; background: #FFFFFF; font: inherit; font-size: 16px; font-weight: 600; color: #1C2233">',
    sec('Aisle', '{{aisleNote}}'), chips, more,
    sec('Teach a name people search with'), teach,
    sec('Looks like an item we already sell'), twin,
]))
ft = foot(pill('Done', href='Passport.dc.html', kind='red'))
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { aisle: 'Steel & mesh', touched: false, taught: false, twin: null, more: false }; }
  renderVals() {
    const S = this.state;
    const TOP = ['Steel & mesh', 'Roofing', 'Fasteners', 'Tools', 'Plumbing'];
    const shown = TOP.includes(S.aisle) ? TOP : TOP.slice(0, 4).concat([S.aisle]);
    const aisles = shown.map(label => ({
      label, on: String(S.aisle === label), pick: () => this.setState({ aisle: label, touched: true }),
      style: 'all:unset;cursor:pointer;box-sizing:border-box;height:36px;padding:0 14px;border-radius:999px;font-size:13px;font-weight:700;display:flex;align-items:center;' +
        (S.aisle === label ? (S.touched ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;color:#0F6B43;box-shadow:inset 0 0 0 1.5px #0F6B43') : 'background:#FFFFFF;box-shadow:inset 0 0 0 1.5px #E6E3DD')
    }));
    const names = [{ w: 'brc mesh', n: '3' }, { w: 'a142', n: '2' }].concat(S.taught ? [{ w: 'welded mesh', n: 'new' }] : []);
    return {
      aisles, names, aisleNote: S.touched ? 'chosen' : 'filled for you · check',
      more: S.more, moreStr: String(S.more), moreLabel: S.more ? 'Close' : 'Other aisle', toggleMore: () => this.setState({ more: !S.more }),
      moreStyle: S.more ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;color:#16203C;box-shadow:inset 0 0 0 1.5px #C9C4BA',
      others: ['Cement & sand', 'Timber', 'Paint', 'Electrical', 'Tiles & finishing', 'Doors & locks', 'Gutters', 'Water tanks', 'Safety gear'].map(label => ({ label, pick: () => this.setState({ aisle: label, touched: true, more: false }) })),
      newAisle: () => this.setState({ aisle: 'Reinforcement', touched: true, more: false }),
      teach: () => this.setState({ taught: true }), teachLabel: S.taught ? 'Taught' : 'Teach',
      open: !S.twin, decided: !!S.twin,
      result: S.twin === 'same' ? 'One item · this hunt joins Welded mesh A142' : 'Two items, kept apart · Denis sees both',
      resultStyle: S.twin === 'same' ? 'background:#E4F4EA;color:#0F6B43' : 'background:#F1EEE8;color:#5F6980',
      same: () => this.setState({ twin: 'same' }), diff: () => this.setState({ twin: 'diff' }), undo: () => this.setState({ twin: null })
    };
  }
}'''
html = page('Name & aisle', hd + '\n' + bd + '\n' + ft, script)
