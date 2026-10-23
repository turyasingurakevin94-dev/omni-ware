from ow import *

# The head: before the card is read, two ways in; after, the supplier as a card being built,
# with four pips for what is known (who, where, what they sell, terms).
def big(onclick, title, sub, icon):
    return (f'<button type="button" onClick="{onclick}" style="all: unset; cursor: pointer; box-sizing: border-box; height: 84px; border-radius: 18px; background: rgba(255,255,255,.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); padding: 12px; display: flex; flex-direction: column; justify-content: space-between">'
            f'{svg(icon, 22, 2, "#FFFFFF")}<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 14px; font-weight: 700">{title}</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">{sub}</span></span></button>')
empty = ('    <sc-if value="{{notFilled}}" hint-placeholder-val="{{ false }}"><div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">'
         + big('{{read}}', 'Snap their card', 'fills the fields', 'camera') + big('{{read}}', 'From contacts', 'name and phone', 'user') + '</div></sc-if>')
card = '''    <sc-if value="{{filled}}" hint-placeholder-val="{{ true }}">
    <div style="display: flex; flex-direction: column; gap: 14px">
      <div style="display: flex; align-items: center; gap: 14px">
        ''' + face('KM', 'indigo', 56, '0 0 0 3px #1D2747, 0 0 0 5px rgba(169,174,240,.55)') + '''
        <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px">
          <span class="nm" style="font-size: 22px; font-weight: 700; letter-spacing: -.01em; line-height: 1.2">Kawempe Metal Works</span>
          <span style="font-size: 12px; font-weight: 600; color: #B3BCD2">0772 418 220 · Kawempe, by the market</span>
        </span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px">
        <span style="display: flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px; border-radius: 999px; background: rgba(111,220,176,.16); color: #6FDCB0; font-size: 12px; font-weight: 700">''' + svg('tick', 12, 3) + '''Read from their card</span>
        <span style="flex: 1"></span>
        <button type="button" onClick="{{unread}}" style="all: unset; cursor: pointer; height: 30px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,.1); font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 5px">''' + svg('camera', 13, 2.2) + '''Snap again</button>
      </div>
      <div role="img" aria-label="{{pipsAria}}" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px">
        <sc-for list="{{pips}}" as="p" hint-placeholder-count="4"><span style="display: flex; flex-direction: column; align-items: center; gap: 6px"><span style="width: 100%; height: 8px; border-radius: 999px; {{p.bar}}"></span><span style="font-size: 10px; font-weight: 700; color: #B3BCD2">{{p.label}}</span></span></sc-for>
      </div>
    </div>
    </sc-if>'''
hd = head('A new supplier', circ('Suppliers.dc.html', 'back', 'Back to Suppliers'), '', empty + '\n' + card, gap=14)

# Already ours? The card's phone is on Katwe Fabricators: the two side by side, the match marked.
cmp_rows = ''.join(
    f'<span style="font-size: 11px; font-weight: 700; color: #5F6980; align-self: center">{k}</span>'
    f'<span class="{"" if k != "Name" else "nm"}" style="min-height: 36px; padding: 0 8px; border-radius: 10px; display: flex; align-items: center; font-size: 12px; font-weight: 700; {st}">{a}</span>'
    f'<span class="{"" if k != "Name" else "nm"}" style="min-height: 36px; padding: 0 8px; border-radius: 10px; display: flex; align-items: center; font-size: 12px; font-weight: 700; {st}">{b}</span>'
    for k, a, b, st in [
        ('Phone', '0772 418 220', '0772 418 220', 'background: #FDEEE1; color: #7A4A02'),
        ('Name', 'Kawempe Metal Works', 'Katwe Fabricators', 'background: #F7F5F2; color: #1C2233'),
        ('Area', 'Kawempe', 'Katwe', 'background: #F7F5F2; color: #1C2233'),
        ('Sells', 'gutters, roofing', 'hoop iron, mesh', 'background: #F7F5F2; color: #1C2233')])
twin = '''    <sc-if value="{{askTwin}}" hint-placeholder-val="{{ true }}">
''' + sec('Already one of ours?', 'one field matches') + '''
    <div style="''' + LIST + '''; padding: 12px; display: flex; flex-direction: column; gap: 10px">
      <div style="display: grid; grid-template-columns: 44px minmax(0, 1fr) minmax(0, 1fr); gap: 6px 8px">
        <span></span><span style="font-size: 11px; font-weight: 700; color: #3A3F9B">This card</span><span style="font-size: 11px; font-weight: 700; color: #3A3F9B">On our books</span>
        ''' + cmp_rows + '''
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
        <a href="Suppliers.dc.html" style="height: 44px; border-radius: 999px; background: #FFFFFF; box-shadow: inset 0 0 0 1.5px #E6E3DD; color: #16203C; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">Same · go to Katwe</a>
        <button type="button" onClick="{{different}}" style="all: unset; cursor: pointer; height: 44px; border-radius: 999px; background: #16203C; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center">A different one</button>
      </div>
    </div>
    </sc-if>
    <sc-if value="{{twinDone}}" hint-placeholder-val="{{ false }}"><div style="display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 0 8px 0 14px; border-radius: 16px; background: #E4F4EA; color: #0F6B43">''' + svg('tick', 15, 3) + '''<span style="flex: 1; font-size: 13px; font-weight: 700">Not Katwe · the phone is shared, both keep it</span><button type="button" onClick="{{undoTwin}}" style="all: unset; cursor: pointer; padding: 0 8px; height: 32px; display: flex; align-items: center; font-size: 13px; font-weight: 700; color: #16203C">Undo</button></div></sc-if>'''

# Where they are, against the walk: our suppliers indigo, rivals plum, the new one a red pin.
def dot(x, y, c, label, lx=8, anchor='start'):
    return (f'<circle cx="{x}" cy="{y}" r="5" fill="{c}"></circle>'
            f'<text x="{x + lx}" y="{y + 4}" text-anchor="{anchor}" font-size="10" font-weight="700" fill="#5F6980">{label}</text>')
mapsvg = ('<svg viewBox="0 0 334 150" width="100%" height="150" role="img" aria-label="Kawempe is north of town, away from today’s walk through Kikuubo, Owino and Nateete" style="display: block">'
          '<path d="M167 18c40 4 92 18 118 52s-6 66-56 72-120 4-160-14S10 82 40 52 120 14 167 18z" fill="#F7F5F2"></path>'
          '<path d="M150 86 182 92 96 104" fill="none" stroke="#C9C4BA" stroke-width="2" stroke-dasharray="4 4"></path>'
          + dot(150, 86, '#3A3F9B', 'Owino', -8, 'end') + dot(182, 92, '#7A3268', 'Kikuubo') + dot(96, 104, '#7A3268', 'Nateete', -8, 'end')
          + dot(170, 120, '#3A3F9B', 'Katwe') + dot(292, 88, '#3A3F9B', 'Namanve', -8, 'end') + dot(206, 74, '#3A3F9B', 'Kiseka')
          + '<path d="M160 22c-7 0-12 5-12 12 0 9 12 20 12 20s12-11 12-20c0-7-5-12-12-12z" fill="#C93A30"></path><circle cx="160" cy="34" r="4" fill="#FFFFFF"></circle>'
          '<text x="178" y="38" font-size="11" font-weight="700" fill="#1C2233">Kawempe</text></svg>')
where = ('    <div style="' + LIST + '; padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px">' + mapsvg
         + '<div style="display: flex; gap: 14px; font-size: 11px; font-weight: 600; color: #5F6980">'
           '<span style="display: flex; align-items: center; gap: 5px"><span style="width: 8px; height: 8px; border-radius: 999px; background: #3A3F9B"></span>our suppliers</span>'
           '<span style="display: flex; align-items: center; gap: 5px"><span style="width: 8px; height: 8px; border-radius: 999px; background: #7A3268"></span>rivals</span>'
           '<span style="display: flex; align-items: center; gap: 5px"><span style="width: 8px; height: 2px; border-top: 2px dashed #C9C4BA"></span>today’s walk</span></div>'
           '<span style="font-size: 12px; font-weight: 700; color: #1C2233">Kawempe · a new area · asked by app until a walk goes north</span></div>')

# What they sell, each tag with what it could fill for us; the picked tags list the items.
chips = '''    <div style="display: flex; flex-wrap: wrap; gap: 6px"><sc-for list="{{tags}}" as="t" hint-placeholder-count="6"><button type="button" aria-pressed="{{t.on}}" onClick="{{t.pick}}" style="{{t.style}}">{{t.label}}<sc-if value="{{t.hasN}}" hint-placeholder-val="{{ false }}"><span style="height: 20px; padding: 0 7px; border-radius: 999px; font-size: 11px; font-weight: 700; display: flex; align-items: center; {{t.nStyle}}">{{t.n}}</span></sc-if></button></sc-for></div>'''
fills = '''    <sc-if value="{{hasFills}}" hint-placeholder-val="{{ true }}">
    <div style="''' + LIST + '''; padding: 6px; display: flex; flex-direction: column; gap: 2px">
      <sc-for list="{{fills}}" as="f" hint-placeholder-count="2">
        <div style="display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 0 10px"><span style="width: 42px; height: 42px; flex: none; border-radius: 13px; display: flex; align-items: center; justify-content: center; {{f.well}}"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{f.icon}}"></path></svg></span><span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span class="nm" style="font-size: 14px; font-weight: 700">{{f.name}}</span><span style="font-size: 12px; font-weight: 600; color: #5F6980">{{f.sub}}</span></span><span style="flex: none; height: 24px; padding: 0 9px; border-radius: 999px; font-size: 11px; font-weight: 700; display: flex; align-items: center; {{f.chip}}">{{f.lane}}</span></div>
      </sc-for>
    </div>
    </sc-if>'''
terms = ('    <div style="' + LIST + '; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px">'
         '<span style="font-size: 12px; font-weight: 700; color: #5F6980">Days of credit</span>'
         + seg('credit', 'c').replace('repeat(var(--n, 2)', 'repeat(4') +
         '<span style="font-size: 12px; font-weight: 700; color: #5F6980">Delivers in</span>'
         + stepper('ns_days', '{{days}}', 'days', '{{less}}', '{{more}}', 'Days to deliver') + '</div>')
bd = body('\n'.join([twin, '    <sc-if value="{{filled}}" hint-placeholder-val="{{ true }}">', sec('Where they are', 'for the walk'), where,
                     sec('What they sell', '{{sellsRight}}'), chips, fills,
                     sec('Their terms'), terms, '    </sc-if>',
                     '    <sc-if value="{{notFilled}}" hint-placeholder-val="{{ false }}"><div style="' + LIST + '; padding: 18px; display: flex; align-items: center; gap: 12px">' + icon_well('supplier', 'indigo') + '<span style="font-size: 14px; font-weight: 700; color: #5F6980">Their card fills the name, phone, area and what they sell; you check the rest</span></div></sc-if>']))
ft = foot('<button type="button" onClick="{{add}}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; height: 58px; border-radius: 999px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; {{ctaStyle}}">{{cta}}</button>')
form = '  <sc-if value="{{editing}}" hint-placeholder-val="{{ true }}">\n  <div style="position: absolute; inset: 0; display: flex; flex-direction: column">\n' + hd + '\n' + bd + '\n' + ft + '\n  </div>\n  </sc-if>'

tr = track([
    ('done', '', 'Added', 'by you, 18:40', '#B3BCD2'),
    ('now', '<span style="width: 44px; height: 44px; border-radius: 999px; background: #E4E6FA; color: #3A3F9B; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 3px #19223F, 0 0 0 5px #F5B26B; animation: owRingA 2s infinite">KM</span>', 'Kawempe', 'asked for 2 prices', '#F5B26B'),
    ('later', svg('route', 19, 2), 'A walk', 'when one goes north', '#B3BCD2'),
], 'A buzz on this phone when they answer')
stats_html = ('<div style="width: 100%; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-radius: 20px; background: rgba(255,255,255,.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07)">'
              + ''.join(f'<span style="height: 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px{"; box-shadow: -1px 0 0 rgba(255,255,255,.07)" if i else ""}"><span class="m" style="font-size: 22px; font-weight: 600; line-height: 1{"; color: #6FDCB0" if i == 0 else ""}">{v}</span><span style="font-size: 11px; font-weight: 600; color: #B3BCD2">{l}</span></span>'
                        for i, (v, l) in enumerate([('7', 'suppliers now'), ('{{fillsN}}', 'items to ask'), ('{{creditWord}}', 'credit')]))
              + '</div>')
done = ('  <sc-if value="{{added}}" hint-placeholder-val="{{ false }}">\n'
        + done_screen('supplier', 'Added', 'Kawempe Metal Works · Kawempe', stats_html, tr, 'Hunt.dc.html', undo_click='{{undoAdd}}', done_label='Ask about the gutter bracket')
        + '\n  </sc-if>')

script = '''class Component extends DCLogic {
  constructor(p) { super(p); this.state = { filled: true, diff: false, tags: { Gutters: true, Roofing: true }, credit: null, days: 2, added: false }; }
  renderVals() {
    const S = this.state;
    ''' + JS_STYLES + '''
    const chip = (on) => 'all:unset;cursor:pointer;box-sizing:border-box;height:36px;padding:0 6px 0 14px;border-radius:999px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;' + (on ? 'background:#16203C;color:#FFFFFF' : 'background:#FFFFFF;color:#1C2233;box-shadow:inset 0 0 0 1.5px #E6E3DD');
    // what each tag could fill: from the Funnel's Wanted and Hunting lanes
    const MATCH = {
      Gutters: { name: 'Gutter bracket, galvanised', sub: '7 searches · 4 named people', lane: 'Wanted', chip: 'background:#FDE8E4;color:#A82D24', well: 'background:#FDE8E4;color:#A82D24', icon: 'M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.2-4.2' },
      Roofing: { name: 'Ridge cap G28, maroon', sub: 'Asked 2 days ago · waiting on 3', lane: 'Hunting', chip: 'background:#F1EEE8;color:#5F6980', well: 'background:#E4E6FA;color:#3A3F9B', icon: 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9' }
    };
    const tags = ['Gutters', 'Roofing', 'Fabrication', 'Fasteners', 'Hoop iron', 'Mesh'].map(label => {
      const on = !!S.tags[label], m = MATCH[label];
      return { label, on: String(on), style: chip(on), pick: () => this.setState({ tags: { ...S.tags, [label]: !on } }),
        hasN: !!m, n: m ? '1 ' + m.lane.toLowerCase() : '', nStyle: on ? 'background:rgba(255,255,255,.16);color:#FFFFFF' : 'background:#FDE8E4;color:#A82D24' };
    });
    const fills = Object.keys(MATCH).filter(k => S.tags[k]).map(k => MATCH[k]);
    const credit = ['Cash', '7 d', '14 d', '30 d'].map(label => ({ label, on: String(S.credit === label), style: SEG(S.credit === label), pick: () => this.setState({ credit: label }) }));
    const nTags = Object.keys(S.tags).filter(k => S.tags[k]).length;
    const PIP = (s) => s === 'd' ? 'background:#6FDCB0' : s === 'a' ? 'background:repeating-linear-gradient(135deg,#6FDCB0 0 3px,rgba(111,220,176,.25) 3px 6px)' : 'background:rgba(255,255,255,.14)';
    const pipState = { Who: S.diff ? 'd' : 'a', Where: 'd', Sells: nTags ? 'd' : 't', Terms: S.credit ? 'd' : 't' };
    const pips = Object.keys(pipState).map(label => ({ label, bar: PIP(pipState[label]) }));
    const ready = S.diff && !!S.credit && nTags > 0;
    return {
      filled: S.filled, notFilled: !S.filled, pips, tags, fills, credit, days: S.days,
      pipsAria: Object.keys(pipState).map(k => k + (pipState[k] === 'd' ? ' known' : pipState[k] === 'a' ? ' to check' : ' not yet')).join(', '),
      askTwin: S.filled && !S.diff, twinDone: S.filled && S.diff,
      editing: !S.added, added: S.added,
      hasFills: fills.length > 0, fillsN: String(fills.length), creditWord: S.credit || '—',
      sellsRight: fills.length ? fills.length + ' things we are looking for' : 'pick any',
      read: () => this.setState({ filled: true, tags: { Gutters: true, Roofing: true } }), unread: () => this.setState({ filled: false, diff: false, tags: {}, credit: null }),
      different: () => this.setState({ diff: true }), undoTwin: () => this.setState({ diff: false }),
      less: () => this.setState({ days: Math.max(0, S.days - 1) }), more: () => this.setState({ days: S.days + 1 }),
      add: () => { if (ready) this.setState({ added: true }); }, undoAdd: () => this.setState({ added: false }),
      cta: !S.filled ? 'Snap their card, or type' : !S.diff ? 'Answer the look-alike first' : !nTags ? 'Pick what they sell' : !S.credit ? 'Pick their credit days' : 'Add Kawempe Metal Works',
      ctaStyle: ready ? 'background:#C93A30;color:#FFFFFF;box-shadow:0 10px 22px rgba(201,58,48,.26)' : 'background:#F3D3CF;color:#8E2A22'
    };
  }
}'''
html = page('A new supplier', form + '\n' + done, script)
