# THE DAYS THAT ARE NOT A BUSY TUESDAY. Four states the current screen
# either fudges or does not have at all, drawn at the content width of
# the console (1172) so they can be read against Main.
from parts import (HEAD, pan, pan_h, note, checkrow, btn, chip, ico, vtile, vstrip,
                   MONO, INK, INK6, INK4, RULE, HAIR, GOOD, WARN, BAD, OXIDE, CUT)
import mainparts as M

W = 1252
PAD = 40


def cap(t, s):
    return ('<div style="margin:0 0 10px"><div style="font-size:13px;font-weight:600;color:%s;'
            'letter-spacing:-.01em">%s</div><div style="font-size:12px;color:%s;margin-top:2px;'
            'max-width:76ch;line-height:1.5">%s</div></div>' % (INK, t, INK6, s))


def empty(title, body, action=''):
    return ('<div style="border:1px dashed %s;border-radius:8px;background:#F7F9FB;'
            'padding:26px 24px;display:flex;flex-direction:column;gap:6px;align-items:flex-start">'
            '<b style="font-size:14px;color:%s;font-weight:600">%s</b>'
            '<span style="font-size:12px;color:%s;line-height:1.55;max-width:76ch">%s</span>%s</div>'
            % (RULE, INK, title, INK6,
               body, ('<span style="margin-top:8px">%s</span>' % action) if action else ''))


# 1 -- a day with nothing in it
s1 = pan(M.day_head('Sunday 23 August 2026', chip('Shut', '', dot=True)),
         empty('Nothing was recorded on 23 August.',
               'No sale, no payment, no stock movement and no cash entry carries this date. '
               'Either the shop was shut, or the day never reached the books &mdash; the screen '
               'cannot tell you which, and does not guess.',
               btn('Open the cash book for this day', 'ghost',
                   '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>')))

# 2 -- a day that has not happened
s2 = pan(M.day_head('Thursday 3 September 2026', chip('Not yet', '', dot=True)),
         empty('27 September has not happened yet.'.replace('27 September', '3 September'),
               'Nothing is recorded against a day in the future, and nothing here is a forecast. '
               'What is already promised for that day &mdash; a bill you dated, a wage, an '
               'instalment &mdash; is on What&rsquo;s coming.',
               btn('See what falls due that day', 'ghost',
                   '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>')))

# 3 -- not enough same weekdays to compare against
NOBASE = [('Sales invoiced', '11,540,000'), ('Gross profit', '1,464,000'),
          ('Debt collected', '2,970,000'), ('Through the till', '5,240,000')]
s3 = pan(M.day_head('Tuesday 25 August 2026', chip('Closed and counted', 'good', dot=True)),
         vstrip([vtile(l, v, None,
                       'no Tuesday to compare with yet' if i == 0 else 'nothing to compare with',
                       first=(i == 0)) for i, (l, v) in enumerate(NOBASE)])
         + note('Two Tuesdays are on the books so far. A middle needs at least three, so there is '
                'no comparison here rather than one drawn from two days &mdash; the figures stand '
                'on their own until 8 September.'))

# 4 -- the books disagree
short_checks = ''.join([
  checkrow('done', 'Cash book opened at 08:04',
           'Opening 1,842,000 across cash, mobile money and bank.'),
  checkrow('bad', 'Cash counted 148,000 short',
           'Counted 1,466,000 against 1,614,000 in the book. Mobile money and bank agreed.'),
  checkrow('done', '31 movements recorded', '24 invoices, 4 collections, 3 payments out.'),
  checkrow('done', 'Nothing left undated',
           'No sale, payment or movement is sitting without a date.', last=True),
])
s4 = ('<div style="display:grid;grid-template-columns:minmax(0,1fr) 304px;gap:16px;align-items:start">'
      '<div>%s</div><div>%s</div></div>'
      % (pan(M.day_head('Wednesday 26 August 2026', chip('Short at the count', 'bad', dot=True)),
             vstrip([
               vtile('Sales invoiced', '8,940,000', (M.ARROWS['down'], '5% below', ''),
                     '5 Wednesdays, 22 Jul &ndash; 19 Aug', first=True),
               vtile('Gross profit', '1,104,000', (M.ARROWS['down'], '9% below', ''), '12.3% margin'),
               vtile('Debt collected', '640,000', (M.ARROWS['down'], '61% below', 'bad'),
                     'one paid, against two typical'),
               vtile('Through the till', '3,410,000', (M.ARROWS['down'], '148,000 short at the count', 'bad'),
                     'cash only &mdash; mobile money and bank agreed'),
             ])
             + note('A shortfall is a fact about the day, not a verdict on it. It sits on the till '
                    'figure because that is the figure it makes untrue, and nowhere else.')),
         pan(pan_h('How the day closed', right=chip('1 unexplained', 'bad')), short_checks)))

REMOVED = [
  ('The &ldquo;Insight&rdquo; eyebrow', 'The breadcrumb one line above already says Insight. '
   'The Manager screen dropped it for the same reason.'),
  ('The toolbar in a panel of its own', 'A bordered region, 82px tall, holding four controls. '
   'The day is what the screen is about, so walking it belongs in the header.'),
  ('.sum-strip, .ah-row, .pw-tail', 'Legacy components the app&rsquo;s own source already marks '
   '&ldquo;not to be reached for again&rdquo;. The screen now uses the strip, the panel and the '
   'row every other console screen uses.'),
  ('The 112px empty gutter', 'Every row carried an .ah-when cell that six of the eight lists '
   'left blank.'),
  ('&ldquo;Ran out on this day&rdquo; as a footnote', 'The most consequential line of a trading '
   'day, typeset at the weight of &ldquo;3 more not listed&rdquo;.'),
  ('The till as one sentence', '31 cash entries reduced to a sentence under the fold, while a '
   'till figure sat in the headline strip with nothing behind it.'),
]
KEPT = [
  ('As at that day, never as at now', 'The one law that separates this screen from the morning '
   'brief. Nothing added here reads a live balance; the comparison reads finished days only.'),
  ('Named rather than dropped', 'Every list still says how many it cut and what they came to.'),
  ('Nothing sends itself', 'Print, and rows that open what is behind them. Nothing on this '
   'screen posts, pays or closes anything on its own.'),
  ('The eight lists', 'All of them survive, with the same derivations. They are arranged, not '
   'rewritten.'),
]


def deflist(title, items, tone):
    rows = ''.join(
      '<div style="padding:9px 0;%s"><div style="font-size:12px;font-weight:600;color:%s">%s</div>'
      '<div style="font-size:12px;color:%s;margin-top:2px;line-height:1.5">%s</div></div>'
      % ('' if i == len(items) - 1 else 'border-bottom:1px solid %s;' % HAIR, INK, k, INK6, v)
      for i, (k, v) in enumerate(items))
    return ('<div><div style="display:flex;align-items:center;gap:7px;padding-bottom:8px;'
            'border-bottom:1px solid %s">%s<span style="font-size:11px;font-weight:600;'
            'letter-spacing:.07em;text-transform:uppercase;color:%s">%s</span></div>%s</div>'
            % (RULE, ico('<path d="M5 12h14"/>' if tone == 'cut' else '<path d="M4 12.5l5 5 11-11"/>',
                         14, BAD if tone == 'cut' else GOOD), INK6, title, rows))

ledger = ('<div style="background:#fff;border:1px solid %s;border-radius:8px;padding:16px 18px;'
          'display:grid;grid-template-columns:1fr 1fr;gap:28px">%s%s</div>'
          % (HAIR, deflist('What this removes', REMOVED, 'cut'),
             deflist('What it deliberately leaves alone', KEPT, 'keep')))

blocks = [
  (cap('A day with nothing in it',
       'A quiet Sunday is padded on no screen in this app. The state says which two things it '
       'cannot tell apart, and offers the one way to find out.'), s1),
  (cap('A day that has not happened yet',
       'The current screen says &ldquo;It has not happened yet&rdquo; inside the same grey box it '
       'uses for a shut shop. They are different facts and lead somewhere different.'), s2),
  (cap('Not enough Tuesdays to compare against',
       'The comparison is the new thing on this screen, so its absence has to be designed. A '
       'middle drawn from two days is worse than no middle.'), s3),
  (cap('The day the drawer disagreed with the book',
       'The one state the old screen could not show at all: it never read the count. The '
       'shortfall lands on the figure it makes untrue and is named, not toned.'), s4),
  (cap('What this redesign removes, and what it does not touch',
       'Every removal below is a component the app already carries elsewhere, or a device that '
       'signalled nothing. Nothing in the right-hand column changes.'), ledger),
]
inner = ''.join('<div style="margin-bottom:26px">%s%s</div>' % (c, b) for c, b in blocks)
H = 1780
page = ('<div style="width:%dpx;height:%dpx;background:#E9EBED;padding:%dpx;box-sizing:border-box;'
        'overflow:hidden">%s</div>' % (W, H, PAD, inner))
open('States.dc.html', 'w').write(HEAD + page + '\n</x-dc>\n</body>\n</html>\n')
print('States.dc.html', W, 'x', H)
