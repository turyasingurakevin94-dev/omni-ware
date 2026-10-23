from ow import *

def ktile(href, label, sub, icon, tint):
    bg, ink = TINT[tint]
    return (f'<a href="{href}" style="height: 96px; border-radius: 18px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; padding: 12px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between">'
            f'<span style="width: 36px; height: 36px; border-radius: 11px; background: {bg}; color: {ink}; display: flex; align-items: center; justify-content: center">{svg(icon, 18, 2.2)}</span>'
            f'<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 14px; font-weight: 700">{label}</span><span style="font-size: 11px; font-weight: 600; color: #5F6980">{sub}</span></span></a>')
dots = ''.join(f'<span style="width: 22px; height: 22px; flex: none; border-radius: 999px; background: {c}; color: #16203C; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center">{n}</span>' + ('<span style="flex: 1; height: 3px; margin: 0 3px; border-radius: 2px; background: rgba(255,255,255,.14)"></span>' if n < 3 else '')
               for n, c in [(1, '#A9AEF0'), (2, '#E7A6D6'), (3, '#E7A6D6')])
walk = f'''    <a href="MarketRun.dc.html" style="border-radius: 22px; background: radial-gradient(120% 90% at 100% 0%, #2B3866 0%, #16203C 58%); color: #FFFFFF; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 14px 30px rgba(22,32,60,.22)">
      <span style="display: flex; align-items: center; justify-content: space-between"><span style="font-size: 15px; font-weight: 700">Today’s walk · start at Owino</span><span style="font-size: 12px; font-weight: 600; color: #6FDCB0"><span class="m">16</span> jobs</span></span>
      <span role="img" aria-label="3 stops" style="display: flex; align-items: center">{dots}</span>
    </a>'''
tiles = ('    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">'
         + ktile('SupplierPrice.dc.html', 'Supplier price', 'price, steps, pack', 'tag', 'indigo')
         + ktile('QuickPrice.dc.html', 'Rival price', 'what a rival charges', 'rival', 'manager')
         + ktile('NewItem.dc.html', 'New item seen', 'starts a hunt', 'plus', 'plain')
         + ktile('PhotoGate.dc.html', 'Photo', 'for an item you pick', 'camera', 'plain') + '</div>')
fast = lst('\n'.join([
    row('Say it', '“Kiseka, mesh, one eighteen”', icon_well('mic', 'plain'), chev(), href='Voice.dc.html', min_h=58),
    row('Read their list', 'A photo of it, or a WhatsApp quote', icon_well('doc', 'plain'), chev(), href='ReadPaper.dc.html', min_h=58),
    row('Someone asked for an item', 'Joins its hunt', icon_well('ask', 'oxide'), chev(), href='NewItem.dc.html', min_h=58),
]))
sheet = f'''  <div aria-hidden="true" style="position: absolute; inset: 0; background: radial-gradient(130% 60% at 50% 0%, #2B3866 0%, #16203C 55%); opacity: .55"></div>
  <div role="dialog" aria-label="What did you find?" style="position: absolute; left: 0; right: 0; bottom: 0; top: 70px; background: #F7F5F2; border-radius: 28px 28px 0 0; padding: 10px 16px 22px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto">
    <span aria-hidden="true" style="align-self: center; width: 40px; height: 5px; border-radius: 3px; background: #D9D4CB"></span>
    <div style="display: flex; align-items: center; justify-content: space-between"><span style="font-size: 22px; font-weight: 700; letter-spacing: -.01em">What did you find?</span>
      <a href="Main.dc.html" aria-label="Close" style="width: 44px; height: 44px; border-radius: 999px; background: #EFECE6; display: flex; align-items: center; justify-content: center">{svg('close', 18, 2.2)}</a></div>
{walk}
{tiles}
{fast}
    <span style="display: flex; align-items: center; gap: 6px; padding: 0 4px; font-size: 12px; font-weight: 600; color: #5F6980">{svg('outbox', 14, 2)}Saved on this phone first · it sends when there is signal</span>
  </div>'''
html = page('Capture', sheet, 'class Component extends DCLogic {\n  renderVals() { return {}; }\n}')
