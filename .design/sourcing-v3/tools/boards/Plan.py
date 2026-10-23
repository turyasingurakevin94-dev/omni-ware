from ow import *
ARW = '<svg width="16" height="12" viewBox="0 0 16 12" aria-label="then" role="img" style="display: inline-block; vertical-align: -1px; margin: 0 2px"><path d="M1 6h13M9.5 1.5 14 6l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>'

X = [64, 400, 736, 1072, 1408]
W = 264
def box(x, y, w, h, inner, style):
    return f'<div style="position: absolute; left: {x}px; top: {y}px; width: {w}px; height: {h}px; box-sizing: border-box; {style}">{inner}</div>'
def varrow(x, y, h, col='#8D96A8', dash=False):
    d = 'stroke-dasharray: 6 6; ' if dash else ''
    return (f'<svg width="8" height="{h}" viewBox="0 0 8 {h}" style="position: absolute; left: {x}px; top: {y}px; overflow: visible; fill: none; stroke: {col}; stroke-width: 2; {d}stroke-linecap: round; stroke-linejoin: round" aria-hidden="true">'
            f'<path d="M4 0V{h-2}M0 {h-6}l4 4 4-4"></path></svg>')
def harrow(x, y, w):
    return (f'<svg width="{w}" height="8" viewBox="0 0 {w} 8" style="position: absolute; left: {x}px; top: {y}px; overflow: visible; fill: none; stroke: #16203C; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round" aria-hidden="true">'
            f'<path d="M0 4H{w-2}M{w-6} 0l4 4-4 4"></path></svg>')
def person(x, ini, tint, name, what):
    bg, ink = TINT[tint]
    inner = (f'<span style="width: 48px; height: 48px; flex: none; border-radius: 999px; background: {bg}; color: {ink}; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center">{ini}</span>'
             f'<span style="display: flex; flex-direction: column; gap: 3px; min-width: 0"><span style="font-size: 15px; font-weight: 700">{name}</span><span style="font-size: 13px; font-weight: 600; color: #5F6980">{what}</span></span>')
    return box(x, 224, W, 96, inner, 'padding: 0 16px; display: flex; align-items: center; gap: 12px; background: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 16px')
def job(x, n, title, what, how, icon, dashed=False):
    st = ('padding: 18px; display: flex; flex-direction: column; justify-content: space-between; background: #FFFFFF; color: #1C2233; border: 1.5px dashed #C9C4BA; border-radius: 20px' if dashed
          else 'padding: 18px; display: flex; flex-direction: column; justify-content: space-between; background: #16203C; color: #FFFFFF; border-radius: 20px')
    sub = '#5F6980' if dashed else '#B3BCD2'
    hc = '#0F6B43' if dashed else '#6FDCB0'
    inner = (f'{svg(icon, 26, 2)}<span style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 20px; font-weight: 700; letter-spacing: -.01em">{(str(n) + ' · ') if n else ''}{title}</span>'
             f'<span style="font-size: 14px; font-weight: 600; color: {sub}">{what}</span><span style="font-size: 13px; font-weight: 700; color: {hc}">{how}</span></span>')
    return box(x, 416, W, 168, inner, st)
def exc(x, text):
    return box(x, 680, W, 96, f'<span style="font-size: 14px; font-weight: 700; color: #7A4A02; line-height: 1.35">{text}</span>', 'padding: 0 16px; display: flex; align-items: center; background: #FEF8F2; border: 1px solid #F3DCC4; border-radius: 16px')
def taps(x, n, word, steps):
    s = ''.join(f'<span style="display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600"><span style="width: 24px; height: 24px; flex: none; border-radius: 999px; background: {"#C93A30" if i == len(steps) - 1 else "#16203C"}; color: #FFFFFF; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center">{i+1}</span>{t}</span>' for i, t in enumerate(steps))
    inner = (f'<div style="display: flex; align-items: baseline; gap: 8px"><span class="m" style="font-size: 48px; font-weight: 600; letter-spacing: -.04em; line-height: 1">{n}</span><span style="font-size: 14px; font-weight: 700; color: #5F6980">{word}</span></div>'
             f'<div style="display: flex; flex-direction: column; gap: 8px">{s}</div>')
    return box(x, 1088, W, 248, inner, 'padding: 18px; display: flex; flex-direction: column; gap: 14px; background: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 18px')

parts = []
for x in X[:4]:
    parts.append(varrow(x + 128, 320, 95))
parts.append(varrow(X[4] + 128, 320, 95))
for x in X[:3]:
    parts.append(harrow(x + W, 496, 72))
for x in [X[0], X[2], X[3], X[4]]:
    parts.append(varrow(x + 128, 584, 95, '#95530C', True))
    parts.append(varrow(x + 128, 776, 95, '#95530C', True))
parts += [
    '<div style="position: absolute; left: 64px; top: 64px; font-size: 40px; font-weight: 700; letter-spacing: -.02em; line-height: 48px">Sourcing · every new item passes one door</div>',
    '<div style="position: absolute; left: 64px; top: 124px; width: 1120px; font-size: 18px; font-weight: 500; line-height: 28px; color: #5F6980">Asks and searches come in. Moses finds the item and its suppliers, and seven stamps make it ready. Ruth prices it, it goes on sale in every app, and 30 days on the New-in shelf prove it. A decision that is someone else’s goes to them by push. Nothing waits for the owner.</div>',
    '<div style="position: absolute; left: 1408px; top: 72px; width: 264px; height: 40px; display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 700; color: #5F6980"><span style="display: inline-block; width: 28px; height: 2px; background: #16203C"></span>Sourcing’s line</div>',
    '<div style="position: absolute; left: 1408px; top: 112px; width: 264px; height: 40px; display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 700; color: #7A4A02"><span style="display: inline-block; width: 28px; border-top: 2px dashed #95530C"></span>a hand-off, by push</div>',
    person(X[0], 'GA', 'sky', 'Grace · Sales', 'asks for a customer'),
    person(X[1], 'PS', 'oxide', 'Peter · agent', 'asks from the field'),
    person(X[2], '5×', 'plain', 'Searches', 'that found nothing'),
    person(X[3], 'OP', 'indigo', 'Suppliers', 'propose in their app'),
    person(X[4], 'KH', 'manager', 'Rival shops', 'Kikuubo · Nateete'),
    job(X[0], 1, 'Hunt', 'Who sells it, by what they sell', 'one slide ' + ARW + ' asked on WhatsApp', 'search'),
    job(X[1], 2, 'Price', 'At the counter or on the walk', 'say it, tap Same, or read their list', 'tag'),
    job(X[2], 3, 'Seven stamps', 'Find and Prepare: asked to held', 'a round stamps many at once', 'tick'),
    job(X[3], 4, 'Ruth prices', 'Held stamped, it lands in her tray', 'her stamp ' + ARW + ' the New-in shelf', 'send'),
    job(X[4], None, 'Prices', 'Fresh prices and better deals', 'beside the line, any time', 'deal', dashed=True),
    exc(X[0], 'Nobody we know sells it ' + ARW + ' add the supplier, then ask'),
    exc(X[2], 'Consign ' + ARW + ' Kiseka must agree first'),
    exc(X[3], 'Ruth prices it, or sends it back with a note'),
    exc(X[4], 'A cheaper supplier ' + ARW + ' Denis decides the switch'),
    box(64, 872, 1608, 88, face('RN', 'manager', 48) + '<span style="font-size: 16px; font-weight: 700">Ruth Nakato · Manager</span><span style="font-size: 15px; font-weight: 600; color: #5F6980">prices each new item in the Manager app, or a standing rule set there does it. Denis decides suppliers and the first batch. The owner sees it all in the log.</span>',
        'padding: 0 20px; display: flex; align-items: center; gap: 14px; background: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 18px'),
    '<div style="position: absolute; left: 64px; top: 1032px; font-size: 22px; font-weight: 700; letter-spacing: -.01em">From the job to done</div>',
    taps(X[0], 1, 'tap a price', ['Same price · or All the same for a stop']),
    taps(X[1], 2, 'to say a price', ['Hold the mic and say it', 'Save · same price']),
    taps(X[2], 3, 'to stamp it held', ['Pick how we hold it', 'Suggest a first batch', 'Hold to ink the stamp']),
    taps(X[3], 2, 'to ask a supplier', ['Pick the old prices', 'Slide to ask Kiseka']),
    taps(X[4], 0, 'trips for old prices', ['They answer in the supplier app']),
]
html = page('The plan', '', 'class Component extends DCLogic {\n  renderVals() { return {}; }\n}', data_props='{"$preview":{"width":1760,"height":1400}}')
html = html.replace('<div style="width: 390px; height: 844px; position: relative; overflow: hidden; background: #F7F5F2; font-family: \'OW Figures\', Figtree, system-ui, sans-serif; color: #1C2233; display: flex; flex-direction: column">\n\n</div>',
                    '<div style="position: relative; width: 1760px; height: 1400px; overflow: hidden; background: #F7F5F2; font-family: \'OW Figures\', Figtree, system-ui, sans-serif; color: #1C2233">\n' + '\n'.join(parts) + '\n</div>')
