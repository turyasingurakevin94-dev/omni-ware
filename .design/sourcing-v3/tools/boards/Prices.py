from _shared import *

big = '''      <span role="img" aria-label="78 percent of 400 lines fresh: 312" style="position: relative; width: 124px; height: 124px; flex: none; display: block">
        <svg width="124" height="124" viewBox="0 0 124 124" aria-hidden="true"><circle cx="62" cy="62" r="52" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="10"></circle><circle cx="62" cy="62" r="52" fill="none" stroke="#6FDCB0" stroke-width="10" stroke-linecap="round" stroke-dasharray="254.8 326.7" transform="rotate(-90 62 62)"></circle></svg>
        <span style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px"><span class="m" style="font-size: 28px; font-weight: 600; line-height: 1">78<span style="font-size: 16px; color: #A9B3CC">%</span></span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2"><span class="m">312</span> of <span class="m">400</span></span></span>
      </span>'''
def t(fig, label, col='', icon='tag', icol='#B3BCD2'):
    c = f'; color: {col}' if col else ''
    return (f'<span style="height: 58px; border-radius: 14px; background: rgba(255,255,255,.07); padding: 0 10px; display: flex; align-items: center; gap: 8px">{svg(icon, 18, 2, icol)}'
            f'<span style="display: flex; flex-direction: column; gap: 1px"><span class="m" style="font-size: 18px; font-weight: 600; line-height: 1{c}">{fig}</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">{label}</span></span></span>')
tiles = ('      <div style="flex: 1; min-width: 0; display: grid; grid-template-columns: 1fr; gap: 6px">'
         + t('4/6', 'today’s share', '', 'tick', '#B3BCD2') + t('2', 'proposals', '#F5B26B', 'tag', '#F5B26B') + '</div>')
pic = f'    <div style="display: flex; align-items: center; gap: 18px">\n{big}\n{tiles}\n    </div>\n' + stats([('392,000', 'a month on the table', '#6FDCB0'), ('+3.0%', 'cement cost', '#F5B26B'), ('−2.0%', 'iron sheet cost', '#6FDCB0')])
hd = home_head('Prices', 'Each line has its own fresh window', '', pic)
tabs = '''    <div role="tablist" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 3px; border-radius: 14px; background: #EFECE6">
      <sc-for list="{{tabs}}" as="t" hint-placeholder-count="3"><button type="button" role="tab" aria-selected="{{t.on}}" onClick="{{t.pick}}" style="{{t.style}}">{{t.label}} <span class="m">{{t.n}}</span></button></sc-for>
    </div>'''
radar_row = '''        <a href="{{r.href}}" style="display: flex; align-items: center; gap: 12px; padding: 12px 10px; border-radius: 16px; border-top: {{r.rule}}">
          <span style="width: 42px; height: 42px; flex: none; border-radius: 13px; display: flex; align-items: center; justify-content: center; {{r.tag}}"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{r.icon}}"></path></svg></span>
          <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px">
            <span style="font-size: 14px; font-weight: 700; line-height: 1.3">{{r.title}}</span>
            <span style="font-size: 12px; font-weight: 600; color: #5F6980">{{r.basis}}</span>
            <sc-if value="{{r.hasBar}}" hint-placeholder-val="{{ true }}"><span style="height: 5px; border-radius: 3px; background: #EFECE6; display: block"><span style="display: block; height: 5px; border-radius: 3px; background: #0F6B43; {{r.bar}}"></span></span></sc-if>
          </span>
          <span style="flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 1px"><span class="m" style="font-size: 15px; font-weight: 600">{{r.worth}}</span><span style="font-size: 11px; font-weight: 600; color: #5F6980">{{r.unit}}</span></span>
        </a>'''
share_row = '''        <div style="display: flex; align-items: center; gap: 12px; min-height: 62px; padding: 0 10px; border-top: {{s.rule}}">
          <span style="width: 42px; height: 42px; flex: none; border-radius: 13px; display: flex; align-items: center; justify-content: center; {{s.dot}}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{s.mark}}"></path></svg></span>
          <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span class="nm" style="font-size: 14px; font-weight: 700">{{s.name}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{s.sup}}</span></span>
          <span class="m" style="flex: none; font-size: 14px; font-weight: 600">{{s.price}}</span>
        </div>'''
inner = hd + '\n  <div style="padding: 18px 16px 24px; display: flex; flex-direction: column; gap: 10px">\n' + '\n'.join([
    tabs,
    '    <sc-if value="{{isRadar}}" hint-placeholder-val="{{ true }}">\n    <div style="' + LIST + '; padding: 0 6px">\n      <sc-for list="{{radar}}" as="r" hint-placeholder-count="5">\n' + radar_row + '\n      </sc-for>\n    </div>\n    </sc-if>',
    '    <sc-if value="{{isShare}}" hint-placeholder-val="{{ false }}">\n    <div style="' + LIST + '; padding: 0 6px">\n      <sc-for list="{{share}}" as="s" hint-placeholder-count="6">\n' + share_row + '\n      </sc-for>\n    </div>\n'
    + '    <a href="Visit.dc.html" style="display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 14px; border-radius: 20px; box-shadow: inset 0 0 0 1px #E6E3DD"><span style="flex: 1; font-size: 13px; font-weight: 700">Both left are at Owino Plumbing · stop 1</span>' + chev() + '</a>\n    </sc-if>',
    '    <sc-if value="{{isProps}}" hint-placeholder-val="{{ false }}">\n    <div style="' + LIST + '; padding: 0 6px">\n      <sc-for list="{{props}}" as="p" hint-placeholder-count="2">\n' + PROP_ROW + '\n      </sc-for>\n    </div>\n    </sc-if>',
]) + '\n  </div>'
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { tab: 'radar', prop: {} }; }
  renderVals() {
    const tab = this.state.tab;
    const tabs = [['radar', 'Deal radar', ''], ['share', 'Today', '4/6'], ['props', 'Proposals', '2']].map(([k, label, n]) => ({
      label, n, on: String(tab === k), pick: () => this.setState({ tab: k }),
      style: 'all:unset;cursor:pointer;box-sizing:border-box;height:40px;border-radius:11px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:5px;' + (tab === k ? 'background:#FFFFFF;color:#1C2233;box-shadow:0 1px 3px rgba(22,32,60,.12)' : 'color:#5F6980')
    }));
    // tints: indigo a supplier deal, plum a rival, amber a risk, oxide wanted
    const TAG = { Switch: 'background:#E4E6FA;color:#3A3F9B', Step: 'background:#E4E6FA;color:#3A3F9B', Rival: 'background:#F6E4F1;color:#7A3268', One: 'background:#FDEEE1;color:#95530C', Wanted: 'background:#FDE8E4;color:#A82D24' };
    const IC = { Switch: 'M4 17 9 12l4 4 7-7M14 9h6v6', Step: 'M4 20h4v-6h4v-4h4V6h4', Rival: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', One: 'M12 4 2.5 20h19zM12 10v4M12 17h.01', Wanted: 'M4 5h16v11H8l-4 4z' };
    const MAX = 210000;
    const radar = [
      { k: 'Switch', title: 'Hoop iron 0.5mm: Katwe is 1,500 cheaper a roll', basis: '1,500 × 140 rolls · Denis decides', v: 210000, worth: '210,000', unit: 'a month', href: 'Deal.dc.html' },
      { k: 'Step', title: 'Iron sheet G28: Namanve is 700 less at 100 or more', basis: '700 × 260 sheets', v: 182000, worth: '182,000', unit: 'a month', href: 'SuppliersGate.dc.html' },
      { k: 'Rival', title: 'Y12 rebar: Nateete sells at 45,000', basis: 'Ruth is told · check it on the walk', v: 0, worth: '3,500', unit: 'room · thin', href: 'RivalRun.dc.html' },
      { k: 'One', title: 'Cement 50kg: only Nakawa Cement Depot', basis: 'Find a second supplier', v: 0, worth: '600', unit: 'bags a month', href: 'Suppliers.dc.html' },
      { k: 'Wanted', title: 'Gutter bracket: none of our suppliers lists it', basis: '7 searches this week', v: 0, worth: '4', unit: 'named people', href: 'Hunt.dc.html' }
    ].map((r, i) => ({ ...r, rule: i ? '1px solid #EFECE6' : 'none', tag: TAG[r.k], icon: IC[r.k], hasBar: !!r.v, bar: 'width:' + Math.round(r.v / MAX * 100) + '%' }));
    const D = { dot: 'background:#E4F4EA;color:#0F6B43', mark: 'M5 12.5l4.5 4.5L19 7.5' }, L = { dot: 'background:#F1EEE8;color:#5F6980', mark: 'M7 12h10' };
    const share = [
      { name: 'Cement 50kg', sup: 'Nakawa Cement Depot · same price', price: '33,000', ...D },
      { name: 'Iron sheet G28 3m', sup: 'Namanve Sheets · new price', price: '34,200', ...D },
      { name: 'Y12 rebar 12m', sup: 'Kiseka Steel · same price', price: '41,500', ...D },
      { name: 'Timber 2×4, 12ft', sup: 'Ndeeba Timber Works · by phone, Denis', price: '12,000', ...D },
      { name: 'Gate valve ½"', sup: 'Owino Plumbing · 34 days old', price: '18,500', ...L },
      { name: 'Ball valve ¾"', sup: 'Owino Plumbing · 40 days old', price: '14,000', ...L }
    ].map((s, i) => ({ ...s, rule: i ? '1px solid #EFECE6' : 'none' }));
    ''' + PROPS_JS + '''
    return { tabs, radar, share, props, isRadar: tab === 'radar', isShare: tab === 'share', isProps: tab === 'props' };
  }
}'''
html = page('Prices', home_scroll(inner) + '\n' + tabbar('Prices', {'Prices': 2}), script)
