from ow import *

ring_svg = '''      <span role="img" aria-label="Prices fresh: 78 percent; 4 of today's 6 confirmed" style="position: relative; width: 124px; height: 124px; flex: none; display: block">
        <svg width="124" height="124" viewBox="0 0 124 124" aria-hidden="true">
          <circle cx="62" cy="62" r="52" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="10"></circle>
          <circle cx="62" cy="62" r="52" fill="none" stroke="#6FDCB0" stroke-width="10" stroke-linecap="round" stroke-dasharray="254.8 326.7" transform="rotate(-90 62 62)"></circle>
          <circle cx="62" cy="62" r="38" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="6"></circle>
          <circle cx="62" cy="62" r="38" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-dasharray="159.2 238.8" transform="rotate(-90 62 62)"></circle>
        </svg>
        <span style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px"><span class="m" style="font-size: 28px; font-weight: 600; line-height: 1">78<span style="font-size: 16px; color: #A9B3CC">%</span></span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">fresh</span></span>
      </span>'''

def tile(href, fig, label, icon, col='#B3BCD2', fig_col='', bg='rgba(255,255,255,.07)'):
    fc = f'; color: {fig_col}' if fig_col else ''
    return (f'<a href="{href}" style="height: 58px; border-radius: 14px; background: {bg}; padding: 0 10px; display: flex; align-items: center; gap: 8px">'
            f'{svg(icon, 18, 2, col)}<span style="display: flex; flex-direction: column; gap: 1px"><span class="m" style="font-size: 18px; font-weight: 600; line-height: 1{fc}">{fig}</span>'
            f'<span style="font-size: 11px; font-weight: 600; color: #B3BCD2">{label}</span></span></a>')

tiles = ('      <div style="flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px">'
         + tile('Wanted.dc.html', '9', 'wanted', 'ask')
         + tile('Funnel.dc.html', '6', 'hunting', 'search')
         + tile('Funnel.dc.html', '2', 'with Ruth', 'clock', '#F5B26B', '#F5B26B')
         + tile('Funnel.dc.html', '5', 'went live', 'tick', '#6FDCB0', '#6FDCB0')
         + '</div>')
legend = '''    <div style="display: flex; gap: 14px; font-size: 11px; font-weight: 600; color: #B3BCD2">
      <span style="display: flex; align-items: center; gap: 5px"><span style="width: 8px; height: 8px; border-radius: 999px; background: #6FDCB0"></span>prices fresh</span>
      <span style="display: flex; align-items: center; gap: 5px"><span style="width: 8px; height: 8px; border-radius: 999px; background: #FFFFFF"></span><span class="m">4/6</span> confirmed today</span>
    </div>'''
right = (f'<a href="Search.dc.html" aria-label="Search items, suppliers, rivals" style="width: 44px; height: 44px; border-radius: 999px; background: rgba(255,255,255,.08); color: #FFFFFF; display: flex; align-items: center; justify-content: center">{svg("search", 19, 2)}</a>'
         '<a href="Profile.dc.html" aria-label="You: Moses Lubega, settings" style="width: 46px; height: 46px; border-radius: 999px; background: #243052; box-shadow: 0 0 0 2px #16203C, 0 0 0 4px rgba(111,220,176,.55); color: #FFFFFF; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center">ML</a>')
hd = home_head('Morning, Moses', f'Sat 17 Oct{DOT}Mukasa Hardware{DOT}{LIVE}', right,
               f'    <div style="display: flex; align-items: center; gap: 18px">\n{ring_svg}\n{tiles}\n    </div>\n{legend}')

def stop(n, kind, last=False):
    bg = '#A9AEF0' if kind == 'sup' else '#E7A6D6'
    return f'<span style="width: 26px; height: 26px; flex: none; border-radius: 999px; background: {bg}; color: #16203C; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center">{n}</span>'
line = '<span style="flex: 1; height: 3px; margin: 0 4px; border-radius: 2px; background: rgba(255,255,255,.14)"></span>'
dash = '<span style="flex: 1; margin: 0 4px; border-top: 3px dashed rgba(255,255,255,.14)"></span>'
# the walk as three stops: what each is (supplier or rival), its name, how much work waits there; the first is where to start
def wstop(name, kind, jobs, first=False):
    bg, ink = ('#E4E6FA', '#3A3F9B') if kind == 'sup' else ('#F6E4F1', '#7A3268')
    ring = '; box-shadow: 0 0 0 3px #19223F, 0 0 0 5px #F5B26B; animation: owRingA 2s infinite' if first else ''
    icon = 'supplier' if kind == 'sup' else 'rival'
    return (f'<span style="position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 7px; text-align: center">'
            f'<span style="width: 44px; height: 44px; border-radius: 999px; background: {bg}; color: {ink}; display: flex; align-items: center; justify-content: center{ring}">{svg(icon, 20, 2)}</span>'
            f'<span style="display: flex; flex-direction: column; gap: 1px"><span class="nm" style="font-size: 13px; font-weight: 700">{name}</span>'
            f'<span style="font-size: 11px; font-weight: 600; color: {"#F5B26B" if first else "#B3BCD2"}"><span class="m">{jobs}</span> jobs{" · start" if first else ""}</span></span></span>')
route = ('<div role="img" aria-label="Start at Owino Plumbing, 7 jobs; then Kikuubo Hardware Mart, 5; then across town to Nateete Builders’ Centre, 4" style="position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr))">'
         '<span style="position: absolute; top: 21px; left: 16.7%; width: 33.3%; height: 2px; background: rgba(255,255,255,.3)"></span>'
         '<span style="position: absolute; top: 21px; left: 50%; width: 33.3%; height: 0; border-top: 2px dashed rgba(255,255,255,.3)"></span>'
         + wstop('Owino', 'sup', 7, True) + wstop('Kikuubo', 'riv', 5) + wstop('Nateete', 'riv', 4) + '</div>')
job = f'''    <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px">
      <span style="font-size: 17px; font-weight: 700">Next job</span>
      <span class="m" style="font-size: 13px; color: #5F6980">1 of 3</span>
    </div>
    <div style="border-radius: 22px; background: radial-gradient(120% 90% at 100% 0%, #2B3866 0%, #16203C 58%); color: #FFFFFF; padding: 16px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 14px 30px rgba(22,32,60,.22)">
      <div style="display: flex; align-items: center; justify-content: space-between">
        <span style="display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; background: rgba(111,220,176,.16); color: #6FDCB0; font-size: 12px; font-weight: 700">{svg("route", 13, 2.4)}Today's walk</span>
        <span style="font-size: 12px; font-weight: 600; color: #B3BCD2"><span class="m" style="color: #FFFFFF">16</span> jobs · <span class="m" style="color: #FFFFFF">3</span> stops</span>
      </div>
      <span style="font-size: 22px; font-weight: 700; letter-spacing: -.01em; line-height: 1.2">Kikuubo and Owino, then Nateete</span>
      {route}
      {pill('Start at Owino Plumbing', href='MarketRun.dc.html', kind='white', icon='chev')}
    </div>'''

def bars(vals, col, h=26, w=4, gap=3, top=None):
    out = ''.join(f'<i style="width: {w}px; height: {max(3, round(v / top * h)) if top else v}px; border-radius: 2px 2px 1px 1px; background: {col if v else "#EFECE6"}"></i>' for v in vals)
    return f'<span aria-hidden="true" style="flex: none; display: flex; align-items: flex-end; gap: {gap}px; height: {h}px">{out}</span>'

thumb = ('<span role="img" aria-label="The photo Ruth sent back, too dark" style="position: relative; width: 42px; height: 42px; flex: none; border-radius: 13px; background: radial-gradient(circle at 50% 45%, #4A3A22 0%, #241C12 60%, #120E09 100%)">'
         '<span style="position: absolute; right: -4px; top: -4px; width: 14px; height: 14px; border-radius: 999px; background: #F5B26B; box-shadow: 0 0 0 2px #FFFFFF; animation: owPulseA 2s infinite"></span></span>')
gauge = ('<span role="img" aria-label="Light 18, the pass mark is 30" style="position: relative; flex: none; width: 56px; height: 12px; display: block">'
         '<span style="position: absolute; left: 0; right: 0; top: 4px; height: 4px; border-radius: 2px; background: #EFECE6"></span>'
         '<span style="position: absolute; left: 0; top: 4px; width: 18%; height: 4px; border-radius: 2px; background: #95530C"></span>'
         '<span style="position: absolute; left: 30%; top: 0; width: 2px; height: 12px; border-radius: 1px; background: #5F6980"></span></span>')
faces = ('<span role="img" aria-label="Grace Akello, Peter Sserwadda and a search" style="flex: none; display: flex; width: 42px; height: 42px; position: relative">'
         '<span style="position: absolute; left: 0; top: 0; width: 28px; height: 28px; border-radius: 999px; background: #DCEAF8; color: #1A5A8A; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px #FFFFFF">GA</span>'
         '<span style="position: absolute; right: 0; bottom: 0; width: 28px; height: 28px; border-radius: 999px; background: #FDE8E4; color: #A82D24; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px #FFFFFF">PS</span></span>')
updown = ('<span style="flex: none; display: flex; flex-direction: column; gap: 3px; align-items: flex-end">'
          f'<span class="m" style="display: inline-flex; align-items: center; gap: 2px; height: 20px; padding: 0 6px; border-radius: 6px; background: #FDEEE1; color: #7A4A02; font-size: 11px; font-weight: 600">{svg("M12 19V5M6 11l6-6 6 6", 10, 3)}4.8%</span>'
          f'<span class="m" style="display: inline-flex; align-items: center; gap: 2px; height: 20px; padding: 0 6px; border-radius: 6px; background: #E4F4EA; color: #0F6B43; font-size: 11px; font-weight: 600">{svg("M12 5v14M6 13l6 6 6-6", 10, 3)}1.6%</span></span>')
ages = ('<span role="img" aria-label="5 prices, 31 to 52 days old; 30 days is the limit" style="position: relative; flex: none; display: flex; align-items: flex-end; gap: 3px; height: 26px">'
        + ''.join(f'<i style="width: 6px; height: {round(d / 60 * 26)}px; border-radius: 2px 2px 1px 1px; background: #95530C"></i>' for d in [52, 41, 36, 33, 31])
        + '<span style="position: absolute; left: -2px; right: -2px; bottom: 13px; border-top: 1.5px dashed #5F6980"></span></span>')

waits = lst('\n'.join([
    row('Door hinge 4" brass', 'Ruth sent it back · photo too dark', thumb, gauge, href='SentBack.dc.html', sub_style='color: #7A4A02'),
    row('3 new asks', 'Door closer · shower mixer · “pvc glue”', faces, chev(), href='Wanted.dc.html'),
    row('“gutter bracket”', '7 searches · 4 people · nobody sells it', icon_well('search', 'oxide'), bars([0, 1, 1, 0, 2, 1, 2], '#D98A80', h=26, top=2), href='Hunt.dc.html'),
    row('2 supplier proposals', 'Owino Plumbing · Kiseka Steel', icon_well('tag', 'indigo'), updown, href='Proposals.dc.html'),
    row('Kiseka Steel: 5 old prices', 'Ask in their app · no trip', icon_well('phone', 'indigo'), ages, href='AskConfirm.dc.html'),
]))
also = lst('\n'.join([
    row('Hoop iron 0.5mm · switch', 'Katwe is 1,500 a roll cheaper', icon_well('deal', 'indigo'),
        '<span style="flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 1px"><span class="m" style="font-size: 15px; font-weight: 600">210,000</span><span style="font-size: 11px; font-weight: 600; color: #5F6980">a month</span></span>', href='Deal.dc.html'),
    row('Iron sheet G28 · certify', 'No photo yet · 1 to check', icon_well('star', 'green'), ring(4/6, '4/6', 40, 4, '#0F6B43', '#EFECE6', 11, '4 of 6 checks kept, 1 to check', part=1/6), href='Certify.dc.html'),
]))
outbox = row('2 captures on this phone', 'They send when there is signal', icon_well('outbox', 'amber'), chev('#95530C'), href='Outbox.dc.html', sub_style='color: #7A4A02')
coach_rows = '\n'.join(
    row(t, s, f'<span class="m" style="width: 42px; height: 42px; flex: none; border-radius: 13px; background: #F6E4F1; color: #7A3268; font-size: 15px; font-weight: 600; display: flex; align-items: center; justify-content: center">{n}</span>', '')
    for n, t, s in [(1, 'Wire mesh: a photo and a hold', '3 customers wait for 40 sheets'),
                    (2, 'Cement: get a second price', 'One supplier · 600 bags a month'),
                    (3, 'Gutter brackets: find a supplier', '4 named people searched')])

inner = hd + '\n  <div style="padding: 18px 16px 24px; display: flex; flex-direction: column; gap: 10px">\n' + '\n'.join([
    job,
    sec('Waiting on you · <span class="m">5</span>', '<a href="SentBack.dc.html" style="display: inline-flex; align-items: center; gap: 4px; color: #16203C; font-weight: 700">' + svg('M8 5.5v13l10.5-6.5z', 12, 1.6) + 'One at a time</a>'),
    waits,
    sec('Also worth it'),
    also,
    f'    <div style="{LIST}; padding: 6px; background: #FFFBF6; box-shadow: inset 0 0 0 1.5px #F3DCC4">\n{outbox}\n    </div>',
    sec('Coach · from this week’s figures'),
    lst(coach_rows),
]) + '\n  </div>'

html = page('Today', home_scroll(inner) + '\n' + tabbar('Today', {'Prices': 2}),
            'class Component extends DCLogic {\n  renderVals() { return {}; }\n}')
