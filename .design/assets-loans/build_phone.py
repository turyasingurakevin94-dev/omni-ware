# -*- coding: utf-8 -*-
# THE PHONE IS ITS OWN DESIGN, not the console reflowed. 820px is a
# switch: cards instead of rows, the action visible on the card rather
# than behind an expansion, and every target a thumb wide.
from parts import HEAD, MONO, CRESTS, chip, btn

W, H = 390, 1900

def tile(label, value, sub, tone, first_row, first_col):
    col = {'bad': '#7F1D1A', 'good': '#1C6B58'}.get(tone, '#14171B')
    return ('<div style="padding:12px;%s%s">'
            '<p style="font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;'
            'color:#59626B;margin:0 0 4px">%s</p>'
            '<span style="%sfont-size:19px;font-weight:500;letter-spacing:-.03em;line-height:1.1;'
            'display:block;color:%s">%s</span>'
            '<p style="font-size:12px;color:#59626B;margin:4px 0 0;line-height:1.35">%s</p></div>'
            % ('' if first_row else 'border-top:1px solid #E3E7EA;',
               '' if first_col else 'border-left:1px solid #E3E7EA;', label, MONO, col, value, sub))

STRIP = ('<div style="display:grid;grid-template-columns:1fr 1fr;background:#fff;'
         'border:1px solid #E3E7EA;border-radius:8px;overflow:hidden">%s%s%s%s</div>' % (
  tile('Still owed', '9,143,300', 'two loans', '', 1, 1),
  tile('Due this month', '1,346,200', '5 Sep &middot; 12 Sep', '', 1, 0),
  tile('Behind', '1,546,600', 'Centenary, two', 'bad', 0, 1),
  tile('Worth', '15,985,000', 'three things held', '', 0, 0)))

def card(crest, name, meta, lines, chips='', action='', dim=False, last=False):
    ink = '#8A939C' if dim else '#14171B'
    L = ''.join(
        '<div style="display:flex;align-items:baseline;gap:8px;margin-top:6px">'
        '<span style="font-size:12px;color:#59626B;flex:none">%s</span>'
        '<span style="flex:1;border-bottom:1px dotted #DCE0E4;height:8px"></span>'
        '<span style="%sfont-size:15px;font-weight:600;color:%s">%s</span></div>'
        % (k, MONO, {'bad': '#7F1D1A', 'good': '#1C6B58'}.get(t, ink), v) for k, v, t in lines)
    return ('<div style="padding:14px;%s">'
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
            '<svg class="ico18" viewBox="0 0 24 24" style="color:%s">%s</svg>%s'
            '<svg class="ico" viewBox="0 0 24 24" style="margin-left:auto;width:14px;height:14px;'
            'color:#8A939C"><path d="M9 6l6 6-6 6"/></svg></div>'
            '<div style="font-size:15px;font-weight:600;letter-spacing:-.01em;line-height:1.3;'
            'color:%s;margin:0 0 2px">%s</div>'
            '<div style="font-size:12px;color:#59626B;line-height:1.4">%s</div>'
            '%s%s</div>'
            % ('' if last else 'border-bottom:1px solid #E3E7EA;',
               '#8A939C' if dim else '#59626B', crest, chips, ink, name, meta, L,
               ('<div style="margin-top:12px">%s</div>' % action) if action else ''))

def tap(label, kind='accent'):
    skin = ('background:#B23A26;color:#fff;border:1px solid #B23A26;' if kind == 'accent'
            else 'background:#fff;color:#14171B;border:1px solid #CFD5DA;')
    return ('<span style="display:flex;align-items:center;justify-content:center;gap:6px;'
            'min-height:44px;border-radius:6px;font-size:15px;font-weight:600;%s">%s</span>'
            % (skin, label))

CARDS = (
  card(CRESTS['bank'], 'Centenary Bank &mdash; working capital',
       'Flat 16% &middot; 5 of 12 paid &middot; next 5 Sep',
       [('Still owed', '5,413,300', ''), ('Behind', '1,546,600', 'bad')],
       chips=chip('Behind', 'bad', dot=True), action=tap('Record repayment')) +
  card(CRESTS['van'], 'Toyota Hiace van &middot; UBK 442F',
       'Straight line, 5 years &middot; Stanbic 22%',
       [('Worth', '12,000,000', ''), ('Owed', '3,730,000', ''), ('Yours', '8,270,000', '')],
       chips=chip('Due 12 Sep')) +
  card(CRESTS['shelf'], 'Steel shelving &amp; racking',
       'Straight line, 8 years &middot; paid outright',
       [('Worth', '2,625,000', ''), ('Yours', '2,625,000', '')]) +
  card(CRESTS['laptop'], 'Lenovo laptop &amp; POS printer',
       'Straight line, 3 years &middot; paid outright',
       [('Worth', '1,360,000', ''), ('Yours', '1,360,000', '')]) +
  '<div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;'
  'color:#59626B;padding:10px 14px;background:#F7F9FB;border-top:1px solid #CFD5DA;'
  'border-bottom:1px solid #E3E7EA;display:flex"><span>Settled and sold</span>'
  '<span style="margin-left:auto;%s">1</span></div>' % MONO +
  card(CRESTS['weld'], 'Welding plant &amp; compressor', 'Sold 30 Jun 2026 for 900,000',
       [('Gain on sale', '300,000', 'good')], chips=chip('Sold'), dim=True, last=True))

def pan(title, note, rows, foot=''):
    R = ''.join('<div style="display:flex;align-items:center;gap:8px;height:40px;padding:0 14px;'
                '%s"><span style="flex:1;min-width:0;font-size:14px;color:#59626B;overflow:hidden;'
                'text-overflow:ellipsis;white-space:nowrap">%s</span>'
                '<span style="%sfont-size:14px;font-weight:%d">%s</span></div>'
                % ('' if i == len(rows) - 1 and not foot else 'border-bottom:1px solid #E3E7EA;',
                   k, MONO, 600 if strong else 500, v)
                for i, (k, v, strong) in enumerate(rows))
    return ('<div style="background:#fff;border:1px solid #E3E7EA;border-radius:8px;overflow:hidden">'
            '<div style="display:flex;align-items:center;gap:8px;height:40px;padding:0 14px;'
            'border-bottom:1px solid #E3E7EA;background:#F7F9FB">'
            '<span style="font-size:12px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;'
            'color:#59626B">%s</span><span style="margin-left:auto;font-size:11px;color:#59626B;%s">%s</span>'
            '</div>%s%s</div>'
            % (title, MONO, note, R,
               ('<p style="font-size:12px;color:#59626B;line-height:1.45;margin:0;padding:10px 14px;'
                'border-top:1px solid #E3E7EA">%s</p>' % foot) if foot else ''))

TABS = [
  ('Today', '<path d="M12 3v4M5 8l2.5 2.5M19 8l-2.5 2.5"/><path d="M4 17h16"/><path d="M7 17a5 5 0 0 1 10 0"/>', 0),
  ('Sell', '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="8" cy="8" r="1.4"/>', 0),
  ('Money', '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/>', 0),
  ('Manager', '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', 0),
  ('More', '<path d="M5 8.5l7-3.5 7 3.5-7 3.5z"/><path d="M5 12.5l7 3.5 7-3.5"/>'
            '<path d="M5 16.5l7 3.5 7-3.5"/>', 1),
]
tb = ''.join(
  '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;'
  'color:%s"><svg viewBox="0 0 24 24" style="width:23px;height:23px;stroke:currentColor;stroke-width:1.8;'
  'stroke-linecap:round;stroke-linejoin:round;fill:%s">%s</svg>'
  '<span style="font-size:10px;font-weight:%d">%s</span></div>'
  % ('#B23A26' if act else '#59626B', 'rgba(178,58,38,.13)' if act else 'none', p, 600 if act else 500, n)
  for n, p, act in TABS)

body = '''
<div style="width:%dpx;height:%dpx;position:relative;background:#E9EBED;overflow:hidden;
  box-shadow:inset 0 0 0 1px #DCE0E4">
  <div style="height:44px;background:#14171B;display:flex;align-items:center;padding:0 16px;gap:10px">
    <div style="width:22px;height:22px;border-radius:6px;background:#B23A26;color:#fff;display:flex;
      align-items:center;justify-content:center;font-family:'Archivo Black',sans-serif;font-size:9px">OW</div>
    <div style="color:#fff;font-size:13px;font-weight:600">Omni&#8209;Ware</div>
    <div style="margin-left:auto;color:#8E9BA8"><svg class="ico" viewBox="0 0 24 24" style="width:20px;height:20px"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></div>
  </div>

  <div style="padding:12px 16px 76px;box-sizing:border-box">
    <div style="display:flex;align-items:center;gap:8px">
      <h1 style="font-family:'Archivo Black',sans-serif;font-size:28px;margin:0;line-height:1.2;letter-spacing:-.02em">Assets &amp; loans</h1>
      <span style="width:18px;height:18px;border-radius:50%%;border:1px solid #CFD5DA;color:#59626B;
        font-size:11px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex:none">i</span>
    </div>
    <p style="font-size:12px;color:#59626B;margin:4px 0 12px;line-height:1.4">What the shop owns, what is still owed on it, and what falls due next</p>

    %s

    <div style="margin-top:12px;background:#fff;border:1px solid #E3E7EA;border-radius:8px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:8px;height:40px;padding:0 14px;
        border-bottom:1px solid #E3E7EA;background:#F7F9FB">
        <span style="font-size:12px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#59626B">The register</span>
        <span style="margin-left:auto;font-size:11px;color:#59626B;%s">5</span></div>
      %s
    </div>
    <p style="font-size:12px;color:#59626B;line-height:1.45;margin:8px 2px 12px">Behind first, then what falls due soonest, then what it is worth.</p>

    %s
    <div style="height:12px"></div>
    %s
    <div style="height:12px"></div>
    <div style="display:flex;gap:8px">%s%s</div>
  </div>

  <div style="position:absolute;left:0;right:0;bottom:0;height:60px;background:#fff;
    border-top:1px solid #DCE0E4;display:flex;align-items:center">%s</div>
</div>''' % (W, H, STRIP, MONO, CARDS,
             pan('The position', 'today',
                 [('What they cost', '28,080,000', 0), ('Written off so far', '12,095,000', 0),
                  ('Worth on the books', '15,985,000', 0), ('Still owed on them', '9,143,300', 0),
                  ('Yours, free of debt', '6,841,700', 1)],
                 'The same three figures the Balance sheet carries, from the same records.'),
             pan('This year', '1 Jan &ndash; 3 Sep',
                 [('Depreciation charged', '3,750,000', 0), ('Interest paid', '1,392,700', 0),
                  ('Repaid off the principal', '7,056,900', 0)],
                 'Depreciation and interest are costs. Principal repaid is not &mdash; it only moves.'),
             '<span style="flex:1">%s</span>' % tap('Add an asset', 'ghost'),
             '<span style="flex:1">%s</span>' % tap('Record a loan', 'ghost'),
             tb)

open('Phone.dc.html', 'w').write(HEAD + body + '\n</x-dc>\n</body>\n</html>\n')
print('Phone.dc.html', W, 'x', H)
