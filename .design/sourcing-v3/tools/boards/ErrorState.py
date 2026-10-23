from ow import *

right = '<span style="width: 46px; height: 46px; border-radius: 999px; background: #243052; color: #FFFFFF; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center">ML</span>'
off = '<span style="display: flex; align-items: center; gap: 5px; color: #F5B26B"><span style="width: 7px; height: 7px; border-radius: 999px; background: #F5B26B; animation: owPulseA 2s infinite"></span>Offline</span>'
pic = '''    <div style="display: flex; align-items: center; gap: 14px">
      ''' + badge('M3 3l18 18M8.5 8.6A12 12 0 0 0 4 9M20 9a12 12 0 0 0-6.6-3.3M7 12.5a7.5 7.5 0 0 1 3.4-1.8M10 16a3 3 0 0 1 4 0M12 19h.01', '#FBE5E2', '#8E2A22', 56) + '''
      <span style="flex: 1; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 17px; font-weight: 700">Couldn’t reach the shop’s books</span><span style="font-size: 12px; font-weight: 600; color: #B3BCD2">Showing the copy from <span class="m" style="color: #FFFFFF">17:55</span> · <span class="m" style="color: #FFFFFF">45</span> min old</span></span>
    </div>
    <button type="button" onClick="{{retry}}" style="all: unset; cursor: pointer; align-self: flex-start; height: 40px; padding: 0 16px; border-radius: 999px; background: #FFFFFF; color: #16203C; font-size: 13px; font-weight: 700; display: flex; align-items: center">{{retryLabel}}</button>'''
hd = home_head('Morning, Moses', f'Sat 17 Oct{DOT}Mukasa Hardware{DOT}{off}', right, pic, gap=16)
need = '<span style="flex: none; height: 26px; padding: 0 10px; border-radius: 999px; background: #F1EEE8; color: #5F6980; font-size: 12px; font-weight: 700; display: flex; align-items: center">needs signal</span>'
waits = lst('\n'.join(row(t, s, icon_well(i, 'plain'), need) for i, t, s in [
    ('returned', 'Door hinge 4" brass', 'Ruth sent it back'), ('ask', 'New asks', '3 at 17:55 · there may be more'), ('tag', 'Supplier proposals', 'Owino Plumbing · Kiseka Steel')]))
keep = '    <div style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 14px; border-radius: 20px; box-shadow: inset 0 0 0 1px #E6E3DD">' + svg('tick', 16, 2.6, '#0F6B43') + '<span style="flex: 1; font-size: 12px; font-weight: 600; color: #5F6980">You can still capture prices, photos and asks · they wait on this phone</span></div>'
outbox = '    <a href="Outbox.dc.html" style="display: flex; align-items: center; gap: 12px; min-height: 62px; padding: 0 14px; border-radius: 20px; background: #FFFBF6; box-shadow: inset 0 0 0 1.5px #F3DCC4">' + icon_well('outbox', 'amber', 40, 12) + '<span style="flex: 1; font-size: 14px; font-weight: 700"><span class="m">2</span> captures safe on this phone</span>' + chev('#95530C') + '</a>'
inner = hd + '\n  <div style="padding: 18px 16px 24px; display: flex; flex-direction: column; gap: 10px">\n' + '\n'.join([sec('Waiting on you', 'as of <span class="m">17:55</span>', first=True), waits, keep, outbox]) + '\n  </div>'
script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { tried: false }; }
  renderVals() { return { retry: () => this.setState({ tried: true }), retryLabel: this.state.tried ? 'Still no signal · 18:41' : 'Try again' }; }
}'''
html = page('Loading failed', home_scroll(inner) + '\n' + tabbar('Today', today_href='ErrorState.dc.html'), script)
