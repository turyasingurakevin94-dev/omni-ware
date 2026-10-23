from _shared import *

pic = '''    <div style="display: flex; align-items: center; gap: 14px">
      <span style="display: flex; align-items: baseline; gap: 8px"><span class="m" style="font-size: 40px; font-weight: 600; line-height: 1">{{left}}</span><span style="font-size: 14px; font-weight: 600; color: #B3BCD2">to answer</span></span>
      <span style="flex: 1"></span>
      <span role="img" aria-label="From Owino Plumbing and Kiseka Steel" style="display: flex">''' + face('OP', 'indigo', 40, '0 0 0 2px #1D2747') + '<span style="margin-left: -8px; display: flex">' + face('KS', 'indigo', 40, '0 0 0 2px #1D2747') + '''</span></span>
    </div>'''
hd = head('Supplier proposals', circ('Prices.dc.html', 'back', 'Back to Prices'), '', pic)
bd = body('\n'.join([
    sec('Sent from the supplier app', 'newest last', first=True),
    '    <div style="' + LIST + '; padding: 0 6px">\n      <sc-for list="{{props}}" as="p" hint-placeholder-count="2">\n' + PROP_ROW + '\n      </sc-for>\n    </div>',
    '    <div style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 14px; border-radius: 20px; box-shadow: inset 0 0 0 1px #E6E3DD">' + face('RN', 'manager', 32) + '<span style="flex: 1; font-size: 12px; font-weight: 600; color: #5F6980">Accepting a rise tells Ruth about every order line it puts under its sale price</span></div>',
]))
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { prop: {} }; }
  renderVals() {
    ''' + PROPS_JS + '''
    return { props, left: props.filter(p => p.open).length };
  }
}'''
html = page('Supplier proposals', hd + '\n' + bd, script)
