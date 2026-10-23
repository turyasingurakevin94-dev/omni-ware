from ow import *

# The first run, once, after the first sign-in: five pictures of how the app works, each drawn
# with the app's own pieces, then the two permissions it needs. Skip is always there.
BG = 'radial-gradient(120% 80% at 50% 0%, #2B3866 0%, #16203C 62%)'
W = 'rgba(255,255,255,.07)'

def card(inner, pad='16px'):
    return f'<div style="width: 100%; box-sizing: border-box; border-radius: 22px; background: {W}; box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); padding: {pad}; display: flex; flex-direction: column; gap: 12px">{inner}</div>'

# 1 · one door: the funnel bar and the nine stamps
segs = ''.join(f'<span style="flex: {n}; background: {c}"></span>' for n, c in [(9, 'rgba(255,255,255,.22)'), (6, 'rgba(255,255,255,.4)'), (4, 'rgba(255,255,255,.6)'), (3, '#FFFFFF'), (2, 'repeating-linear-gradient(135deg, rgba(245,178,107,.8) 0 4px, transparent 4px 8px)'), (5, '#6FDCB0')])
nine = stamp_strip(['in'] * 7 + ['no', 'no'], 'Seven stamps from Moses, then Ruth prices it, then 30 days prove it')
pic0 = card('<span style="font-size: 12px; font-weight: 700; color: #B3BCD2">An ask comes in</span>'
            f'<div style="display: flex; height: 12px; border-radius: 999px; overflow: hidden; gap: 3px">{segs}</div>'
            '<div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #B3BCD2"><span>just asked</span><span>on sale</span></div>') + card(
            '<span style="font-size: 12px; font-weight: 700; color: #B3BCD2">It earns nine stamps in four rooms</span>'
            + nine)

# 2 · Today: the walk, three stops
def wstop(name, kind, jobs, first=False):
    bg, ink = ('#E4E6FA', '#3A3F9B') if kind == 'sup' else ('#F6E4F1', '#7A3268')
    ring_ = '; box-shadow: 0 0 0 3px #19223F, 0 0 0 5px #F5B26B; animation: owRingA 2s infinite' if first else ''
    return (f'<span style="position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 7px; text-align: center">'
            f'<span style="width: 44px; height: 44px; border-radius: 999px; background: {bg}; color: {ink}; display: flex; align-items: center; justify-content: center{ring_}">{svg("supplier" if kind == "sup" else "rival", 20, 2)}</span>'
            f'<span style="display: flex; flex-direction: column; gap: 1px"><span class="nm" style="font-size: 13px; font-weight: 700">{name}</span><span style="font-size: 11px; font-weight: 600; color: {"#F5B26B" if first else "#B3BCD2"}"><span class="m">{jobs}</span> jobs</span></span></span>')
pic1 = card('<div style="display: flex; align-items: center; justify-content: space-between"><span style="display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; background: rgba(111,220,176,.1); color: #6FDCB0; font-size: 12px; font-weight: 700">' + svg('route', 13, 2.4) + 'Today’s walk</span><span style="font-size: 12px; font-weight: 600; color: #B3BCD2"><span class="m" style="color: #FFFFFF">16</span> jobs</span></div>'
            '<div style="position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding-top: 4px"><span style="position: absolute; top: 25px; left: 16.7%; width: 33.3%; height: 2px; background: rgba(255,255,255,.3)"></span><span style="position: absolute; top: 25px; left: 50%; width: 33.3%; height: 0; border-top: 2px dashed rgba(255,255,255,.3)"></span>'
            + wstop('Owino', 'sup', 7, True) + wstop('Kikuubo', 'riv', 5) + wstop('Nateete', 'riv', 4) + '</div>'
            '<span style="height: 48px; border-radius: 999px; background: #FFFFFF; color: #16203C; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px">Start at Owino Plumbing' + svg('chev', 16, 2.4) + '</span>')

# 3 · a price in two taps: Same, New, or say it
pic2 = card('<div style="display: flex; align-items: center; gap: 12px"><span style="width: 42px; height: 42px; flex: none; border-radius: 13px; background: #E4E6FA; color: #3A3F9B; display: flex; align-items: center; justify-content: center">' + svg('tag', 19, 2) + '</span>'
            '<span style="flex: 1; display: flex; flex-direction: column; gap: 3px"><span class="nm" style="font-size: 14px; font-weight: 700">Gate valve 1"</span><span style="font-size: 12px; font-weight: 600; color: #B3BCD2">Owino · <span class="m">42,000</span> · 31 days old</span></span></div>'
            '<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px"><span style="height: 44px; border-radius: 999px; background: #FFFFFF; color: #16203C; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center">Same price</span><span style="height: 44px; border-radius: 999px; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.3); font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center">New price</span></div>') + (
       '<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; width: 100%">'
       + card('<span style="width: 44px; height: 44px; border-radius: 999px; background: #C93A30; display: flex; align-items: center; justify-content: center">' + svg('mic', 20, 2) + '</span><span style="font-size: 13px; font-weight: 700">“Owino, valve, same”</span>', '14px')
       + card('<span class="m" style="font-size: 28px; font-weight: 600; line-height: 1">118<span style="color: #6FDCB0">,000</span></span><span style="font-size: 13px; font-weight: 700">The 000 key</span>', '14px')
       + '</div>')

# 4 · seven stamps, then Ruth prices it
tr = track([
    ('done', '', 'You', 'seven stamps', '#B3BCD2'),
    ('now', '<span style="width: 44px; height: 44px; border-radius: 999px; background: #F6E4F1; color: #7A3268; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 3px #19223F, 0 0 0 5px #F5B26B; animation: owRingA 2s infinite">RN</span>', 'Ruth', 'sets the price', '#F5B26B'),
    ('later', svg('M3 21V8l9-5 9 5v13M7 21v-8h10v8M7 17h10', 19, 2), 'On sale', 'askers told', '#B3BCD2'),
], 'Your phone buzzes at each step')
pic3 = tr

# 5 · it learns: did it sell?
pic4 = card('<div style="display: flex; align-items: center; gap: 14px">' + ring(11 / 14, '11/14', 64, 7, '#6FDCB0', 'rgba(255,255,255,.1)', 15, '11 of 14 calls right')
            + '<span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 16px; font-weight: 700">Your calls, 30 days on</span><span style="font-size: 12px; font-weight: 600; color: #B3BCD2">Stock <span class="m">7/9</span> · Per order <span class="m">3/3</span></span></span></div>'
            + ''.join(f'<div style="display: flex; align-items: center; gap: 10px"><span class="nm" style="width: 96px; font-size: 12px; font-weight: 700">{n}</span><span style="flex: 1; position: relative; height: 8px; border-radius: 4px; background: rgba(255,255,255,.1)"><span style="position: absolute; left: 0; top: 0; bottom: 0; width: {w}%; border-radius: 4px; background: {c}"></span><span style="position: absolute; top: -3px; bottom: -3px; left: {e}%; width: 2px; background: #FFFFFF"></span></span></div>'
                      for n, w, e, c in [('Floor drain', 82, 87, '#6FDCB0'), ('Ceramic tile', 86, 76, '#6FDCB0'), ('Masking tape', 32, 87, '#F5B26B')]))

# 6 · the two permissions it needs, nothing switched on for you
perm = '''<div style="width: 100%; display: flex; flex-direction: column; gap: 10px">
      <sc-for list="{{perms}}" as="p" hint-placeholder-count="2">
      <div style="display: flex; align-items: center; gap: 12px; min-height: 76px; padding: 0 12px; border-radius: 20px; background: rgba(255,255,255,.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08)">
        <span style="width: 44px; height: 44px; flex: none; border-radius: 14px; background: rgba(255,255,255,.1); display: flex; align-items: center; justify-content: center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{p.icon}}"></path></svg></span>
        <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 700">{{p.label}}</span><span style="font-size: 12px; font-weight: 600; color: #B3BCD2">{{p.sub}}</span></span>
        <button type="button" onClick="{{p.allow}}" style="all: unset; cursor: pointer; flex: none; height: 40px; padding: 0 14px; border-radius: 999px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 5px; {{p.style}}">{{p.word}}</button>
      </div>
      </sc-for>
    </div>'''

pics = [pic0, pic1, pic2, pic3, pic4, perm]
# a story: segments fill along the top, the headline sits up top, the picture plays in the middle,
# each slide in its own glow. Tap Next, or the right half of the picture.
CSS = ('@keyframes owRise{0%{transform:translateY(18px) scale(.96);opacity:0}100%{transform:none;opacity:1}}'
       '@keyframes owFill{from{width:0}to{width:100%}}')
segs = '<div role="img" aria-label="{{dotsAria}}" style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 5px"><sc-for list="{{dots}}" as="d" hint-placeholder-count="6"><span style="height: 4px; border-radius: 2px; background: rgba(255,255,255,.2); overflow: hidden; display: block"><span style="display: block; height: 4px; border-radius: 2px; background: #FFFFFF; {{d}}"></span></span></sc-for></div>'
stage = '\n'.join(f'      <sc-if value="{{{{on{i}}}}}" hint-placeholder-val="{{{{ {"true" if i == 0 else "false"} }}}}"><div style="width: 100%; display: flex; flex-direction: column; gap: 12px; animation: owRise .55s cubic-bezier(.2,.8,.2,1) both">{p}</div></sc-if>' for i, p in enumerate(pics))
body_ = f'''  <div style="position: absolute; inset: 0; background: {{{{bg}}}}; color: #FFFFFF; display: flex; flex-direction: column; padding: 14px 20px 22px; box-sizing: border-box; transition: background .4s">
    {segs}
    <div style="display: flex; align-items: center; justify-content: space-between; height: 44px; margin-top: 6px">
      <span style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #B3BCD2">{face('ML', 'sky', 28)}Moses, your job in a minute</span>
      <sc-if value="{{{{notLast}}}}" hint-placeholder-val="{{{{ true }}}}"><a href="Main.dc.html" style="height: 44px; padding: 0 4px; display: flex; align-items: center; font-size: 13px; font-weight: 700; color: #FFFFFF">Skip</a></sc-if>
    </div>
    <span style="margin-top: 14px; font-size: 32px; font-weight: 700; letter-spacing: -.025em; line-height: 1.1">{{{{title}}}}</span>
    <span style="margin-top: 10px; font-size: 15px; font-weight: 600; color: #C9D0E2; line-height: 1.45">{{{{line}}}}</span>
    <div style="flex: 1; display: flex; align-items: center; position: relative">
      <span aria-hidden="true" style="position: absolute; left: 50%; top: 50%; width: 350px; height: 350px; margin: -175px 0 0 -175px; border-radius: 999px; background: {{{{glow}}}}"></span>
      <span aria-hidden="true" class="m" style="position: absolute; right: 0; top: -6px; font-size: 180px; font-weight: 600; line-height: 1; letter-spacing: -.06em; color: rgba(255,255,255,.06)">{{{{bigN}}}}</span>
      <div style="position: relative; width: 100%">
{stage}
      </div>
      <sc-if value="{{{{notLast}}}}" hint-placeholder-val="{{{{ true }}}}"><button type="button" onClick="{{{{next}}}}" aria-label="Next" style="all: unset; cursor: pointer; position: absolute; right: 0; top: 0; bottom: 0; width: 34%"></button></sc-if>
    </div>
    <div style="display: flex; gap: 10px">
      <sc-if value="{{{{hasBack}}}}" hint-placeholder-val="{{{{ false }}}}"><button type="button" onClick="{{{{back}}}}" aria-label="Back" style="all: unset; cursor: pointer; width: 58px; height: 58px; flex: none; border-radius: 999px; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.3); color: #FFFFFF; display: flex; align-items: center; justify-content: center">{svg('back', 20, 2.4)}</button></sc-if>
      <sc-if value="{{{{notLast}}}}" hint-placeholder-val="{{{{ true }}}}"><button type="button" onClick="{{{{next}}}}" style="all: unset; cursor: pointer; box-sizing: border-box; flex: 1; height: 58px; border-radius: 999px; background: #FFFFFF; color: #16203C; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px">{{{{nextLabel}}}}{svg('chev', 18, 2.4)}</button></sc-if>
      <sc-if value="{{{{last}}}}" hint-placeholder-val="{{{{ false }}}}"><a href="Main.dc.html" style="box-sizing: border-box; flex: 1; height: 58px; border-radius: 999px; background: #C93A30; color: #FFFFFF; box-shadow: 0 12px 28px rgba(201,58,48,.45); font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px">Start · Today{svg('chev', 18, 2.4)}</a></sc-if>
    </div>
  </div>'''

script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { i: 0, push: false, cam: false }; }
  renderVals() {
    const S = this.state, i = S.i, N = 6;
    const TXT = [
      ['One door for every new item', 'Asks from Sales, agents and searches come to you. You take each one to on sale.'],
      ['Today puts the next job first', 'The walk plans your stops by area. Every job shows the money behind it.'],
      ['A price in two taps', 'Same, or a new figure on the shillings keypad. Or just say it.'],
      ['Nine stamps, then it is proven', 'You stamp it asked, sourced, compared, packed, photographed, placed and held. Ruth prices it; 30 days on the shelf prove it.'],
      ['It learns what sells', 'Thirty days on, each item shows what sold against what you expected.'],
      ['Two things before you start', 'Both can be changed later in You.']
    ];
    const vals = {};
    for (let k = 0; k < N; k++) vals['on' + k] = i === k;
    const perm = (key, label, sub, icon) => ({ label, sub, icon, word: S[key] ? 'Allowed' : 'Allow',
      style: S[key] ? 'background:rgba(111,220,176,.16);color:#6FDCB0' : 'background:#FFFFFF;color:#16203C',
      allow: () => this.setState({ [key]: !S[key] }) });
    return {
      ...vals, title: TXT[i][0], line: TXT[i][1],
      dots: Array.from({ length: N }, (_, k) => k < i ? 'width:100%' : k === i ? 'width:100%;animation:owFill 1.2s ease-out both' : 'width:0'),
      bg: 'radial-gradient(120% 70% at 50% 100%, ' + ['#24345F', '#2A2F66', '#3A2A55', '#2B3866', '#1F3D47', '#2B3866'][i] + ' 0%, #16203C 60%, #111A33 100%)',
      glow: 'radial-gradient(circle, ' + ['rgba(111,220,176,.3)', 'rgba(169,174,240,.32)', 'rgba(231,166,214,.3)', 'rgba(245,178,107,.26)', 'rgba(111,220,176,.32)', 'rgba(255,255,255,.12)'][i] + ' 0%, rgba(0,0,0,0) 65%)',
      nextLabel: i === N - 2 ? 'Last thing' : 'Next', bigN: '0' + (i + 1),
      dotsAria: 'Step ' + (i + 1) + ' of ' + N,
      perms: [perm('push', 'Notifications', 'A buzz when Ruth decides or a supplier answers', 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0'),
              perm('cam', 'Camera', 'For item photos and reading price lists', 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z')],
      hasBack: i > 0, notLast: i < N - 1, last: i === N - 1,
      next: () => this.setState({ i: Math.min(N - 1, i + 1) }), back: () => this.setState({ i: Math.max(0, i - 1) })
    };
  }
}'''
html = page('How it works', body_, script, extra_css=CSS)
