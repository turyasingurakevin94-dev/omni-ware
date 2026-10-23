from ow import *

def ktile(href, label, sub, icon, tint):
    bg, ink = TINT[tint]
    return (f'<a href="{href}" style="height: 96px; border-radius: 18px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; padding: 12px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between">'
            f'<span style="width: 36px; height: 36px; border-radius: 11px; background: {bg}; color: {ink}; display: flex; align-items: center; justify-content: center">{svg(icon, 18, 2.2)}</span>'
            f'<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 14px; font-weight: 700">{label}</span><span style="font-size: 11px; font-weight: 600; color: #5F6980">{sub}</span></span></a>')
dots = ''.join(f'<span style="width: 22px; height: 22px; flex: none; border-radius: 999px; background: {c}; color: #16203C; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center">{n}</span>' + ('<span style="flex: 1; height: 3px; margin: 0 3px; border-radius: 2px; background: rgba(255,255,255,.14)"></span>' if n < 3 else '')
               for n, c in [(1, '#A9AEF0'), (2, '#E7A6D6'), (3, '#E7A6D6')])
def wstop(name, kind, jobs, first=False):
    bg, ink = ('#E4E6FA', '#3A3F9B') if kind == 'sup' else ('#F6E4F1', '#7A3268')
    ring_ = '; box-shadow: 0 0 0 2px #19223F, 0 0 0 4px #F5B26B; animation: owRingA 2s infinite' if first else ''
    return (f'<span style="position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; text-align: center">'
            f'<span style="width: 34px; height: 34px; border-radius: 999px; background: {bg}; color: {ink}; display: flex; align-items: center; justify-content: center{ring_}">{svg("supplier" if kind == "sup" else "rival", 16, 2)}</span>'
            f'<span style="font-size: 12px; font-weight: 700">{name} <span class="m" style="color: {"#F5B26B" if first else "#B3BCD2"}; font-weight: 600">{jobs}</span></span></span>')
walk = f'''    <a href="MarketRun.dc.html" aria-label="Today’s walk: Owino Plumbing 7 jobs, Kikuubo Hardware Mart 5, Nateete Builders’ Centre 4. Start at Owino" style="border-radius: 22px; background: radial-gradient(120% 90% at 100% 0%, #2B3866 0%, #16203C 58%); color: #FFFFFF; padding: 14px 14px 12px; display: flex; align-items: center; gap: 10px; box-shadow: 0 14px 30px rgba(22,32,60,.22)">
      <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px">
        <span style="display: flex; align-items: center; gap: 8px"><span style="font-size: 15px; font-weight: 700">Today’s walk</span><span style="font-size: 12px; font-weight: 600; color: #B3BCD2"><span class="m" style="color: #FFFFFF">16</span> jobs · <span class="m" style="color: #FFFFFF">3</span> stops</span></span>
        <span aria-hidden="true" style="position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr))"><span style="position: absolute; top: 16px; left: 16.7%; width: 33.3%; height: 2px; background: rgba(255,255,255,.3)"></span><span style="position: absolute; top: 16px; left: 50%; width: 33.3%; height: 0; border-top: 2px dashed rgba(255,255,255,.3)"></span>{wstop('Owino', 'sup', 7, True)}{wstop('Kikuubo', 'riv', 5)}{wstop('Nateete', 'riv', 4)}</span>
      </span>
      <span style="width: 44px; height: 44px; flex: none; border-radius: 999px; background: #FFFFFF; color: #16203C; display: flex; align-items: center; justify-content: center">{svg('chev', 18, 2.6)}</span>
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
    <span style="display: flex; align-items: center; gap: 6px; padding: 0 4px; font-size: 12px; font-weight: 600; color: #5F6980">{svg('outbox', 14, 2)}Saved on this phone first · it goes up when there is signal</span>
  </div>'''
html = page('Capture', sheet, 'class Component extends DCLogic {\n  renderVals() { return {}; }\n}')
