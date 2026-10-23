from ow import *

right = f'<a href="NewSupplier.dc.html" aria-label="New supplier" style="width: 44px; height: 44px; border-radius: 999px; background: rgba(255,255,255,.08); color: #FFFFFF; display: flex; align-items: center; justify-content: center">{svg("plus", 19, 2.2)}</a>'
field = ('    <label style="display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 14px; border-radius: 16px; background: rgba(255,255,255,.08)">' + svg('search', 17, 2.2, '#B3BCD2')
         + '<input type="search" placeholder="Find a supplier or what they sell" aria-label="Find a supplier" style="flex: 1; min-width: 0; border: none; outline: none; background: transparent; color: #FFFFFF; font: inherit; font-size: 15px"></label>')
sorts = '''    <div role="radiogroup" aria-label="Sort" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 3px; border-radius: 14px; background: rgba(255,255,255,.08)">
      <sc-for list="{{sorts}}" as="s" hint-placeholder-count="3"><button type="button" role="radio" aria-checked="{{s.on}}" onClick="{{s.pick}}" style="{{s.style}}">{{s.label}}</button></sc-for>
    </div>'''
hd = home_head('Suppliers <span class="m" style="font-size: 15px; color: #A9B3CC">6</span>', 'Who sells what, and how they score', right, field + '\n' + sorts, gap=14)
srow = '''        <a href="{{s.href}}" style="display: flex; align-items: center; gap: 12px; padding: 12px 10px; border-radius: 16px; border-top: {{s.rule}}">
          <span style="width: 42px; height: 42px; flex: none; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">{{s.ini}}</span>
          <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px">
            <span style="display: flex; align-items: center; gap: 8px"><span style="flex: 1; min-width: 0; font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{s.name}}</span><span style="flex: none; height: 24px; padding: 0 9px; border-radius: 999px; font-size: 11px; font-weight: 700; display: flex; align-items: center; {{s.jobStyle}}">{{s.jobs}}</span></span>
            <span style="font-size: 12px; font-weight: 600; color: #5F6980">{{s.sells}}</span>
            <span style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">
              <sc-for list="{{s.bars}}" as="b" hint-placeholder-count="3"><span style="display: flex; flex-direction: column; gap: 3px"><span style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; color: #5F6980"><span>{{b.k}}</span><span class="m" style="color: #1C2233">{{b.v}}</span></span><span style="height: 4px; border-radius: 2px; background: #EFECE6; display: block"><span style="display: block; height: 4px; border-radius: 2px; {{b.w}}"></span></span></span></sc-for>
            </span>
          </span>
        </a>'''
inner = hd + '\n  <div style="padding: 18px 16px 24px; display: flex; flex-direction: column; gap: 10px">\n' + '\n'.join([
    lst('\n'.join([
        row('Two records look like one supplier', 'Owino Plumbing · Owino Plumbing & Sanitary', icon_well('twins', 'amber'), chev(), href='Twins.dc.html', sub_style='color: #7A4A02'),
        row('Kiseka Steel has 5 old prices', 'They answer in the supplier app · no trip', icon_well('phone', 'indigo'), '<span style="flex: none; height: 30px; padding: 0 12px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 12px; font-weight: 700; display: flex; align-items: center">Ask</span>', href='AskConfirm.dc.html'),
    ])),
    sec('All suppliers', 'bars: cheapest on · fills · fresh'),
    '    <div style="' + LIST + '; padding: 0 6px">\n      <sc-for list="{{list}}" as="s" hint-placeholder-count="6">\n' + srow + '\n      </sc-for>\n    </div>',
]) + '\n  </div>'
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { sort: 'jobs' }; }
  renderVals() {
    const sort = this.state.sort;
    const base = [
      { ini: 'OP', name: 'Owino Plumbing', sells: 'Plumbing · PVC · taps', jobs: 7, ch: 79, fill: 93, fresh: 88, link: 'Supplier.dc.html' },
      { ini: 'KS', name: 'Kiseka Steel', sells: 'Rebar · mesh · wire', jobs: 3, ch: 58, fill: 94, fresh: 84, link: 'SupplierKiseka.dc.html' },
      { ini: 'NS', name: 'Namanve Sheets', sells: 'Iron sheets · gutters · roofing', jobs: 2, ch: 71, fill: 88, fresh: 90 },
      { ini: 'NC', name: 'Nakawa Cement Depot', sells: 'Cement', jobs: 1, ch: 100, fill: 97, fresh: 100 },
      { ini: 'KF', name: 'Katwe Fabricators', sells: 'Fabrication · hoop iron · fasteners', jobs: 1, ch: 44, fill: 76, fresh: 61 },
      { ini: 'NT', name: 'Ndeeba Timber Works', sells: 'Timber', jobs: 0, ch: 66, fill: 90, fresh: 72 }
    ];
    const AVG = { Cheapest: 70, Fills: 90, Fresh: 83 };
    const order = sort === 'jobs' ? (a, b) => b.jobs - a.jobs : sort === 'stale' ? (a, b) => a.fresh - b.fresh : (a, b) => a.name.localeCompare(b.name);
    const list = base.slice().sort(order).map((s, i) => ({
      ...s, href: s.link || 'Suppliers.dc.html', rule: i ? '1px solid #EFECE6' : 'none',
      bars: [['Cheapest', s.ch], ['Fills', s.fill], ['Fresh', s.fresh]].map(([k, v]) => ({ k, v, w: 'width:' + v + '%;background:' + (v >= AVG[k] ? '#0F6B43' : '#95530C') })),
      jobs: s.jobs ? s.jobs + (s.jobs === 1 ? ' job' : ' jobs') : 'none today',
      jobStyle: s.jobs ? 'background:#16203C;color:#FFFFFF' : 'background:#F1EEE8;color:#5F6980'
    }));
    const sorts = [['jobs', 'Most jobs'], ['stale', 'Oldest prices'], ['az', 'A–Z']].map(([k, label]) => ({
      label, on: String(sort === k), pick: () => this.setState({ sort: k }),
      style: 'all:unset;cursor:pointer;box-sizing:border-box;height:38px;border-radius:11px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;' + (sort === k ? 'background:#FFFFFF;color:#16203C' : 'color:#B3BCD2')
    }));
    return { list, sorts };
  }
}'''
html = page('Suppliers', home_scroll(inner) + '\n' + tabbar('Suppliers', {'Prices': 2}), script)
