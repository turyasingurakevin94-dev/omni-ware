from ow import *

ring_e = '''      <span role="img" aria-label="No prices yet" style="position: relative; width: 124px; height: 124px; flex: none; display: block">
        <svg width="124" height="124" viewBox="0 0 124 124" aria-hidden="true"><circle cx="62" cy="62" r="52" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="10" stroke-dasharray="4 8"></circle></svg>
        <span style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px"><span class="m" style="font-size: 28px; font-weight: 600; line-height: 1; color: #A9B3CC">0</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">prices yet</span></span>
      </span>'''
right = '<span style="width: 46px; height: 46px; border-radius: 999px; background: #243052; color: #FFFFFF; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center">ML</span>'
pic = f'    <div style="display: flex; align-items: center; gap: 18px">\n{ring_e}\n      <span style="flex: 1; display: flex; flex-direction: column; gap: 6px"><span style="font-size: 17px; font-weight: 700">A new shop</span><span style="font-size: 12px; font-weight: 600; color: #B3BCD2">Three steps fill this screen</span></span>\n    </div>'
hd = home_head('Morning, Moses', f'Sat 17 Oct{DOT}Mukasa Hardware{DOT}{LIVE}', right, pic)
steps = lst('\n'.join(row(t, s, f'<span class="m" style="width: 42px; height: 42px; flex: none; border-radius: 999px; background: #F1EEE8; font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center">{n}</span>', chev(), href=h)
                      for n, t, s, h in [(1, 'Add your suppliers', 'Snap their cards, say what they sell', 'NewSupplier.dc.html'),
                                         (2, 'Visit one and capture prices', 'Each price fills the price list', 'Capture.dc.html'),
                                         (3, 'Certify your top sellers', 'Most need only a photo', 'Funnel.dc.html')]))
note = '    <span style="padding: 0 4px; font-size: 12px; font-weight: 600; color: #5F6980">Asks come in when Sales, agents or the website search for something we don’t sell</span>'
inner = hd + '\n  <div style="padding: 18px 16px 24px; display: flex; flex-direction: column; gap: 10px">\n' + '\n'.join([sec('Start here', first=True), steps, note, '    ' + pill('Add your first supplier', href='NewSupplier.dc.html', kind='red')]) + '\n  </div>'
html = page('A new shop', home_scroll(inner) + '\n' + tabbar('Today', fab_red=False, today_href='EmptyToday.dc.html'), 'class Component extends DCLogic {\n  renderVals() { return {}; }\n}')
