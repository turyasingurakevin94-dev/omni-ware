from ow import *

photo = ('<a href="PhotoGate.dc.html" aria-label="Selling with no photo: take it" style="width: 64px; height: 64px; flex: none; border-radius: 16px; box-shadow: inset 0 0 0 1.5px rgba(245,178,107,.7); background: rgba(255,255,255,.05); color: #F5B26B; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px">'
         + svg('camera', 22, 2) + '<span style="font-size: 10px; font-weight: 700">no photo</span></a>')
strip = '''    <div role="img" aria-label="4 of 6 checks kept; the hold is filled from sales, to check; the photo is missing" style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px">''' + ''.join(
    f'<span style="display: flex; flex-direction: column; align-items: center; gap: 6px"><span style="width: 100%; height: 8px; border-radius: 999px; background: {c}"></span><span style="font-size: 10px; font-weight: 700; color: #B3BCD2">{w}</span></span>'
    for c, w in [('#F5B26B', 'Photo'), ('#6FDCB0', 'Pack'), ('#6FDCB0', 'Supply'), ('repeating-linear-gradient(135deg,#6FDCB0 0 3px,rgba(111,220,176,.25) 3px 6px)', 'Hold'), ('#6FDCB0', 'Name'), ('#6FDCB0', 'Markup')]) + '</div>'
pic = title_block('Iron sheet G28, 3m box profile', 'Our #<span class="m" style="color: #FFFFFF">1</span> seller · on sale · markup set by Ruth', photo) + '\n' + strip
hd = head('Certify', circ('Funnel.dc.html', 'back', 'Back to the Funnel'), '<span style="flex: none; height: 30px; padding: 0 12px; border-radius: 999px; background: rgba(111,220,176,.16); color: #6FDCB0; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 5px"><span style="width: 7px; height: 7px; border-radius: 999px; background: #6FDCB0"></span>On sale</span>', pic)
ok = '<span style="flex: none; height: 26px; padding: 0 10px; border-radius: 999px; background: #E4F4EA; color: #0F6B43; font-size: 12px; font-weight: 700; display: flex; align-items: center">Done</span>'
chk = '<span style="flex: none; height: 26px; padding: 0 10px; border-radius: 999px; background: #FFFFFF; color: #0F6B43; box-shadow: inset 0 0 0 1.5px #0F6B43; font-size: 12px; font-weight: 700; display: flex; align-items: center">Check</span>'
gap = '<span style="flex: none; height: 26px; padding: 0 10px; border-radius: 999px; background: #FDEEE1; color: #7A4A02; font-size: 12px; font-weight: 700; display: flex; align-items: center">Gap</span>'
filled = lst('\n'.join([
    row('Photo', 'Selling with none · the only gap', icon_well('camera', 'amber'), gap, href='PhotoGate.dc.html', sub_style='color: #7A4A02'),
    row('How we hold it · Stock', 'Set from 90 days of sales · confidence 84', icon_well('gauge', 'green'), chk, href='Verdict.dc.html', sub_style='color: #0F6B43'),
    row('Packing', 'From the product: by the sheet', icon_well('box', 'green'), ok),
    row('Suppliers', 'Namanve Sheets · one price', icon_well('supplier', 'green'), ok),
    row('Name & aisle', 'Roofing', icon_well('name', 'green'), ok),
]))
weeks = [52, 58, 61, 55, 63, 60, 57, 66, 59, 62, 64, 58, 61]
chart = ('    <div style="' + LIST + '; padding: 14px; display: flex; flex-direction: column; gap: 10px">'
         '<div role="img" aria-label="About 60 sheets a week, steady" style="display: grid; grid-template-columns: repeat(13, minmax(0, 1fr)); gap: 4px; align-items: end; height: 76px">'
         + ''.join(f'<i style="height: {round(u/70*76)}px; border-radius: 3px 3px 1px 1px; background: #6B7480"></i>' for u in weeks)
         + '</div><span style="font-size: 12px; font-weight: 600; color: #5F6980">About <span class="m" style="color: #1C2233">60</span> a week · <span class="m" style="color: #1C2233">260</span> a month</span></div>')
mkt = lst('\n'.join([row(n, s, f'<span style="width: 10px; height: 10px; flex: none; border-radius: 999px; background: {c}; margin: 0 16px"></span>', f'<span class="m" style="flex: none; font-size: 14px; font-weight: 600">{p}</span>', min_h=52)
                     for n, s, c, p in [('Namanve Sheets', 'our cost · confirmed today', '#0F6B43', '34,200'), ('Nateete Builders’ Centre', 'rival', '#7A3268', '35,500'), ('Kikuubo Hardware Mart', 'rival', '#7A3268', '36,000')]])
           + '\n      <div style="display: flex; align-items: center; gap: 10px; min-height: 46px; margin: 4px; padding: 0 12px; border-radius: 14px; background: #FDEEE1; color: #7A4A02"><span style="flex: 1; font-size: 13px; font-weight: 700">Room under the cheapest rival</span><span class="m" style="font-size: 15px; font-weight: 600">1,300</span><span style="height: 22px; padding: 0 8px; border-radius: 999px; background: #95530C; color: #FFFFFF; font-size: 11px; font-weight: 700; display: flex; align-items: center">Thin</span></div>')
bd = body('\n'.join([sec('Filled from what it already sells', '<span class="m">4</span> of 6 kept · <span class="m">1</span> to check', first=True), filled, sec('Sheets sold a week', 'last 13 weeks, from invoices'), chart, sec('Cost against the market', 'a sheet'), mkt]))
ft = foot(pill('Take the photo · then certified', href='PhotoGate.dc.html', kind='red', icon='camera'))
html = page('Certify', hd + '\n' + bd + '\n' + ft, 'class Component extends DCLogic {\n  renderVals() { return {}; }\n}')
