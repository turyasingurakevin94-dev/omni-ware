from ow import *

hd = home_head('Funnel', 'Long names, big figures', '', '')
def gring(g):
    COL = {'d': '#0F6B43', 'g': '#95530C', 't': '#E0DCD4'}
    parts = []
    for i, k in enumerate(g):
        a, b = i * 60, i * 60 + 60
        parts += [f'#FFFFFF {a}deg {a+5}deg', f'{COL[k]} {a+5}deg {b-5}deg', f'#FFFFFF {b-5}deg {b}deg']
    done = g.count('d')
    return f'<span style="position: relative; width: 42px; height: 42px; flex: none; border-radius: 999px; background: conic-gradient({",".join(parts)})"><span class="m" style="position: absolute; inset: 5px; border-radius: 999px; background: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600">{done}/6</span></span>'
fig = lambda f: f'<span class="m" style="flex: none; font-size: 14px; font-weight: 600; white-space: nowrap">{f}</span>'
cards = lst('\n'.join(row(n, s, gring(g), fig(f)) for n, s, f, g in [
    ('Iron sheet G28 3m box profile, maroon, Namanve finish', 'Kyaligonza & Sons · Mukono Roofing · Lubowa Builders · 4 more', '1,240 sheets', 'tddtdt'),
    ('Galvanised gutter bracket, heavy duty, 150mm', '7 searches · 4 named people · last 2 hours ago', '7', 'tttttt'),
    ('PPR pipe 25mm × 4m PN20 hot and cold', 'Ggaba Stores · Nansana Hardware', '200', 'ttttdt'),
    ('Self-drilling screws 10×25, hex head, galvanised', 'Faith Nambi asked for Kato Construction', '12,000', 'dgdtdt')]))
askers = lst('\n'.join(row(n, v, face(i, t), fig(q)) for i, t, n, v, q in [
    ('KS', 'crimson', 'Kyaligonza & Sons Construction and Hardware Supplies', 'via Brian Ouma', '1,000,000'),
    ('MR', 'teal', 'Mukono Roofing', 'via Aisha Namutebi, agent', '120'),
    ('LB', 'manager', 'Lubowa Builders', 'via Brian Ouma', '40')]))
inner = hd + '\n  <div style="padding: 18px 16px 24px; display: flex; flex-direction: column; gap: 10px">\n' + '\n'.join([
    sec('Wanted <span class="m">1,214</span>', '+<span class="m">1,210</span> more', first=True), cards,
    sec('Waiting for it', 'names cut, figures never'), askers]) + '\n  </div>'
html = page('Long names', home_scroll(inner) + '\n' + tabbar('Funnel', {'Prices': 2}), 'class Component extends DCLogic {\n  renderVals() { return {}; }\n}')
