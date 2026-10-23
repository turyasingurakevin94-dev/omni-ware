from ow import *

slots = '''    <div style="display: flex; align-items: center; gap: 12px">
      <div role="img" aria-label="{{count}} suppliers priced; two is the target" style="flex: 1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px"><sc-for list="{{slots}}" as="s" hint-placeholder-count="3"><span style="display: flex; flex-direction: column; gap: 6px; align-items: center"><span style="width: 100%; height: 10px; border-radius: 999px; {{s.bar}}"></span><span style="font-size: 10px; font-weight: 700; color: #B3BCD2">{{s.word}}</span></span></sc-for></div>
      <span class="m" style="font-size: 20px; font-weight: 600">{{count}}<span style="font-size: 13px; color: #A9B3CC">/2</span></span>
    </div>'''
pic = title_block('Wire mesh BRC A142', 'Two is the target · a third makes the verdict surer', icon_well('supplier', 'indigo', 52, 16)) + '\n' + slots
hd = head('Who sells it', circ('Passport.dc.html', 'back', 'Back to the passport'), '', pic)
srow = '''      <a href="{{s.href}}" style="display: flex; align-items: center; gap: 12px; padding: 12px 10px; border-radius: 16px; border-top: {{s.rule}}">
        <span style="width: 42px; height: 42px; flex: none; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">{{s.ini}}</span>
        <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px">
          <span style="display: flex; align-items: center; gap: 6px"><span class="nm" style="font-size: 14px; font-weight: 700">{{s.name}}</span><sc-if value="{{s.cheapest}}" hint-placeholder-val="{{ false }}"><span style="height: 20px; padding: 0 7px; border-radius: 999px; background: #E4F4EA; color: #0F6B43; font-size: 11px; font-weight: 700; display: flex; align-items: center">cheapest</span></sc-if></span>
          <span style="font-size: 12px; font-weight: 600; color: #5F6980">{{s.steps}} · {{s.pack}} · {{s.lead}}</span>
          <span style="font-size: 11px; font-weight: 600; color: #5F6980">{{s.age}}</span>
        </span>
        <span class="m" style="flex: none; font-size: 15px; font-weight: 600">{{s.price}}</span>
      </a>'''
have = '''    <sc-if value="{{canAdd}}" hint-placeholder-val="{{ true }}">
    <div style="''' + LIST + '''; padding: 6px">
      <div style="display: flex; align-items: center; gap: 12px; min-height: 66px; padding: 0 10px">
        ''' + face('NS', 'indigo') + '''
        <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 700">Namanve Sheets</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">A price you already have · a sheet</span></span>
        <input value="124,000" inputmode="numeric" aria-label="Namanve's price a sheet" style="box-sizing: border-box; width: 96px; height: 44px; padding: 0 10px; border-radius: 12px; border: none; box-shadow: inset 0 0 0 1.5px #16203C; font-family: 'IBM Plex Mono', monospace; font-size: 15px; font-weight: 600; text-align: right">
        <button type="button" onClick="{{save}}" style="all: unset; cursor: pointer; height: 40px; padding: 0 14px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center">Save</button>
      </div>
    </div>
    </sc-if>'''
bd = body('\n'.join([
    sec('Priced', 'a sheet', first=True),
    '    <div style="' + LIST + '; padding: 0 6px">\n      <sc-for list="{{sups}}" as="s" hint-placeholder-count="2">\n' + srow + '\n      </sc-for>\n    </div>',
    sec('Add one'), have,
    lst('\n'.join([row('Ask another supplier', 'Pick who, then slide to ask on WhatsApp', icon_well('send', 'plain'), chev(), href='Hunt.dc.html'),
                   row('A supplier we don’t have yet', 'Snap their card', icon_well('plus', 'plain'), chev(), href='NewSupplier.dc.html')])),
]))
ft = foot(pill('Done · {{count}} priced', href='Passport.dc.html', kind='red'))
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { third: false }; }
  renderVals() {
    const S = this.state;
    const sups = [
      { ini: 'KS', name: 'Kiseka Steel', href: 'SupplierKiseka.dc.html', price: '118,000', steps: 'one price', pack: 'by the sheet', lead: '≈3 days', age: 'Priced 2 days ago, at their shop', cheapest: true },
      { ini: 'KF', name: 'Katwe Fabricators', href: 'Suppliers.dc.html', price: '121,500', steps: '50+ 119,000', pack: 'bundles of 10', lead: '≈5 days', age: 'Priced 5 days ago, by phone', cheapest: false }
    ].concat(S.third ? [{ ini: 'NS', name: 'Namanve Sheets', href: 'Suppliers.dc.html', price: '124,000', steps: 'one price', pack: 'by the sheet', lead: 'not known yet', age: 'Added just now · saved on this phone', cheapest: false }] : [])
      .map((s, i) => ({ ...s, rule: i ? '1px solid #EFECE6' : 'none' }));
    const count = sups.length;
    return {
      sups, count, canAdd: !S.third,
      slots: [0, 1, 2].map(i => ({ bar: i < count ? 'background:#6FDCB0' : 'background:rgba(255,255,255,.14)', word: i < 2 ? (i === 0 ? 'first' : 'target') : 'surer' })),
      save: () => this.setState({ third: true })
    };
  }
}'''
html = page('Who sells it', hd + '\n' + bd + '\n' + ft, script)
