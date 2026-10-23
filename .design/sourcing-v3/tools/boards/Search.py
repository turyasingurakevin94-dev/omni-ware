from ow import *

field = ('    <label style="display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 14px; border-radius: 16px; background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.18)">' + svg('search', 18, 2.2, '#B3BCD2')
         + '<input id="q" type="search" value="pvc" aria-label="Search items, suppliers, rivals and hunts" style="flex: 1; min-width: 0; border: none; outline: none; background: transparent; color: #FFFFFF; font: inherit; font-size: 16px; font-weight: 600"></label>')
modes = '''    <div role="radiogroup" aria-label="Picking an item for" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 3px; border-radius: 14px; background: rgba(255,255,255,.08)">
      <sc-for list="{{modes}}" as="mo" hint-placeholder-count="3"><button type="button" role="radio" aria-checked="{{mo.on}}" onClick="{{mo.pick}}" style="{{mo.style}}">{{mo.label}}</button></sc-for>
    </div>'''
hd = head('Search and pick', circ('{{backHref}}', 'back', 'Back'), '', field + '\n' + modes, gap=12)
res_row = '''        <a href="{{r.href}}" style="display: flex; align-items: center; gap: 12px; min-height: 62px; padding: 0 10px; border-radius: 16px">
          <span style="width: 42px; height: 42px; flex: none; border-radius: 13px; display: flex; align-items: center; justify-content: center; {{r.well}}"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{r.icon}}"></path></svg></span>
          <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span class="nm" style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{r.name}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">{{r.sub}}</span></span>
          ''' + chev() + '''
        </a>'''
groups = '''    <sc-for list="{{groups}}" as="g" hint-placeholder-count="2">
      <div style="display: flex; flex-direction: column; gap: 8px">
        <span style="padding: 8px 4px 0; font-size: 13px; font-weight: 700; color: #5F6980">{{g.label}}</span>
        <div style="''' + LIST + '''; padding: 6px; display: flex; flex-direction: column; gap: 2px">
        <sc-for list="{{g.rows}}" as="r" hint-placeholder-count="2">
''' + res_row + '''
        </sc-for>
        </div>
      </div>
    </sc-for>'''
hunt = ('    <a href="NewItem.dc.html" style="display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 0 14px; border-radius: 20px; box-shadow: inset 0 0 0 1.5px #C9C4BA">' + icon_well('plus', 'oxide', 40, 12)
        + '<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Not here? Start a hunt for “pvc…”</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">The words are kept, so the next search finds it</span></span></a>')
bd = body(groups + '\n' + hunt, pad='8px 16px 24px')
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { mode: 'rival' }; }
  renderVals() {
    const MODES = { rival: { label: 'Rival price', href: 'QuickPrice.dc.html' }, photo: { label: 'Photo', href: 'PhotoGate.dc.html' }, supplier: { label: 'Supplier price', href: 'SupplierPrice.dc.html' } };
    const mode = this.state.mode, go = MODES[mode].href;
    const modes = Object.keys(MODES).map(k => ({
      label: MODES[k].label, on: String(mode === k), pick: () => this.setState({ mode: k }),
      style: 'all:unset;cursor:pointer;box-sizing:border-box;height:38px;border-radius:11px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;' + (mode === k ? 'background:#FFFFFF;color:#16203C' : 'color:#B3BCD2')
    }));
    const ITEM = 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9', SUP = 'M3 21V9l9-5 9 5v12M8 21v-7h8v7';
    const P = 'background:#F1EEE8;color:#1C2233', I = 'background:#E4E6FA;color:#3A3F9B';
    const groups = [
      { label: 'Items', rows: [
        { name: 'PVC pipe 4" × 6m', sub: 'Plumbing · 2 suppliers', href: go, well: P, icon: ITEM },
        { name: 'Solvent cement 500ml', sub: 'also found as “pvc glue”', href: go, well: P, icon: ITEM },
        { name: 'PVC elbow 4"', sub: 'Plumbing · 1 supplier', href: go, well: P, icon: ITEM }
      ] },
      { label: 'Suppliers', rows: [
        { name: 'Owino Plumbing', sub: 'sells PVC · 7 jobs today', href: 'Supplier.dc.html', well: I, icon: SUP }
      ] }
    ];
    return { groups, modes, backHref: go };
  }
}'''
html = page('Search and pick', hd + '\n' + bd, script)
