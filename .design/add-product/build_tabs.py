import sys; sys.path.insert(0,'.')
from gen_tabs import dialog, FULL, EMPTY, REFUSED
from gen_panes import BASICS, PHOTO_SET, MARKUP, AGENT
from _pane_variants import VARIANTS

NOTE = 'Saving files it in the register. Nothing is sent, and nothing is priced.'

# ---- Main: the Basics section ----
main = dialog('basics', FULL, BASICS, NOTE)
open('body_main.html','w').write(f'''<div class="b-bg"></div>

<div style="position:absolute;left:40px;top:40px;width:1040px;">
  {main}
  <span class="mk" style="left:-9px;top:82px;">1</span>
  <span class="mk" style="left:-9px;top:134px;">2</span>
  <span class="mk" style="left:-9px;top:166px;">3</span>
  <span class="mk" style="left:-9px;top:606px;">4</span>
  <span class="mk" style="left:1046px;top:20px;">5</span>
  <span class="mk" style="left:1046px;top:84px;">6</span>
  <span class="mk" style="left:1046px;top:700px;">7</span>
</div>

<div class="leg" style="left:1140px;">
  <p class="leg-h">The sections, done properly</p>
  <p class="leg-s">The rail stays. What changes is that it now earns its width: it says what is
    in every section without your opening one, and the dialog never moves.</p>

  <div class="leg-g">The rail</div>
  <div class="leg-i"><span class="leg-n">1</span><span class="leg-t"><b>Grouped by what the setting affects</b>
    — the product, the money, what it comes in. The same grammar the Presets rail already uses,
    and it scales past five where a flat list of five equals does not.</span></div>
  <div class="leg-i"><span class="leg-n">2</span><span class="leg-t"><b>Photo carries its thumbnail, on the rail.</b>
    The one section whose state is a picture shows the picture, at 26px. Nothing else needs opening
    to be checked.</span></div>
  <div class="leg-i"><span class="leg-n">3</span><span class="leg-t"><b>Every section reports its own contents, in words.</b>
    "<span class="mono">+18%</span> wholesale · <span class="mono">+12%</span> retail", not a tick; the product's actual name, not "Named".
    A section with nothing in it says so — "None", "No rule — the supplier price stands" — because
    a blank chip reads as a broken screen and a tick on an empty section is a lie.</span></div>
  <div class="leg-i"><span class="leg-n">4</span><span class="leg-t"><b>The leftover rail space says the thing the form never said</b>
    — that a price is entered afterwards, per supplier. It sits where a rail normally wastes 200px.</span></div>

  <div class="leg-g">The dialog</div>
  <div class="leg-i"><span class="leg-n">5</span><span class="leg-t"><b>One size, always: 1040 × 760.</b>
    The body height never changes between sections, so the dialog cannot leap under the pointer —
    the old one went 340px on Markup to 900px on Variants. Each pane scrolls inside itself — and the shortest section, Basics, simply has slack at the bottom. That is what a fixed frame costs, and it is cheaper than a dialog that jumps.</span></div>
  <div class="leg-i"><span class="leg-n">6</span><span class="leg-t"><b>The heading is written once.</b>
    The rail is the section's name; the pane opens with the sentence that explains it. The old form
    wrote "Basics" twice and hid the sentence behind an "i" bubble.</span></div>
  <div class="leg-i"><span class="leg-n">7</span><span class="leg-t"><b>The accent appears once.</b>
    The active section is steel — a paper ground and an inset rule, a shape change rather than a
    colour one. Oxide is left for Save, which is reachable from every section.</span></div>

  <div class="leg-g">Kept from the old form</div>
  <div class="leg-i"><span class="leg-n">·</span><span class="leg-t">The rail itself, the modal shell, the
    <span class="mono">.btn</span> family, the Required chip and the app's field ink. This is the shipped
    idea finished, not replaced.</span></div>
</div>
''')

# ---- Variants ----
var = dialog('variants', FULL, VARIANTS, 'Saving files all 24 in the register. None has a price yet.',
             save='Save product · 24 variants')
open('body_variants.html','w').write(f'''<div class="b-bg"></div>

<div style="position:absolute;left:40px;top:32px;width:1040px;">
  {var}
  <span class="mk" style="left:1046px;top:310px;">1</span>
  <span class="mk" style="left:-9px;top:306px;">2</span>
  <span class="mk" style="left:-9px;top:406px;">3</span>
  <span class="mk" style="left:1046px;top:400px;">4</span>
</div>

<div style="position:absolute;left:1120px;top:32px;width:380px;color:#C7CFD8;">
  <p class="leg-h">Twenty-four, and the dialog has not moved</p>
  <p class="leg-s">This is the section the old form handled worst: twenty-four stacked cards,
    410px each, roughly 9,800px of scrolling inside a modal that grew to hold them.</p>
  <div class="leg-g">What a fixed pane buys</div>
  <div class="leg-i"><span class="leg-n">1</span><span class="leg-t"><b>The table scrolls; nothing else does.</b>
    The rail, the head, the attribute builder and Save all stay exactly where they were on Basics.
    Ten rows are in view and the column header stays put above them.</span></div>
  <div class="leg-i"><span class="leg-n">2</span><span class="leg-t"><b>A filter, in the panel head.</b>
    At forty variants scrolling is not finding. It costs no vertical space because it sits in
    the 38px header the panel already had.</span></div>
  <div class="leg-i"><span class="leg-n">3</span><span class="leg-t"><b>The two touched rows are marked by shape</b>
    — an inset steel rule and a tinted ground — so "which of these has its own markup" is answered
    without reading twenty-four of anything.</span></div>
  <div class="leg-i"><span class="leg-n">4</span><span class="leg-t"><b>A variant's photo is set from its own row</b>
    — a 20px thumbnail button that opens the media picker for that variant. A bordered, ringed
    thumbnail means its own; a plain one means it is using the product's.</span></div>
  <div class="leg-g">The cost, said plainly</div>
  <div class="leg-i"><span class="leg-n">·</span><span class="leg-t">Ten rows in view rather than a
    full-width twelve, because the rail keeps its 204px on every section. That is the price of the
    dialog never moving, and it is the right trade.</span></div>
  <div class="leg-i"><span class="leg-n">·</span><span class="leg-t">Height is
    <span class="mono">min(760, 100vh − 96)</span>: on a 768px laptop the dialog is 672 and the table
    shows seven. It shrinks the table, never the rail and never the footer.</span></div>
</div>
''')

# ---- Sections and states: four more dialogs ----
cells = [
 (0,   0, 'Photo — chosen', 'The state that was missing. A 104px preview, the file the library holds, and the three things you can do to it. The rail shows the same picture at 26px, so this section rarely needs opening twice.', dialog('photo', FULL, PHOTO_SET, NOTE)),
 (1100,0, 'Markup rules', 'Two rules, and under each one what it actually does to a real supplier price. A rule you cannot picture is a rule set wrong.', dialog('markup', FULL, MARKUP, NOTE)),
 (0,  900, 'Agent share', 'The most misread setting in the app — a share of your margin, not a discount off the price. The sentence says so, and the hint puts a figure on it.', dialog('agent', FULL, AGENT, NOTE)),
 (1100,900,'Nothing set, and a refused save', 'Opened fresh, then Save pressed empty. The rail carries an amber dot on the only section that is blocking, crimson once Save has actually refused — and every section still says what it holds.',
   dialog('basics', REFUSED, BASICS.replace('''<div class="f-in big foc" style="margin-top:6px;">Iron sheets — G28, 3m box profile<span class="car"></span></div>
              <div class="f-hint">Written exactly like this on quotes, the catalogue and the agent app.</div>''',
   '''<div class="f-in big err ph" style="margin-top:6px;">e.g. Iron sheets — G28, 3m box profile<span class="car" style="background:var(--ow-crimson);"></span></div>
              <div class="f-err"><svg viewBox="0 0 24 24"><path d="M12 8v5m0 3.5v.01M12 3l9 16H3z"/></svg>A product with no name cannot be found again. Type what you would call it on a quote.</div>''')
   .replace('<div class="sold-o"><span class="rd"></span>','<div class="sold-o on"><span class="rd"></span>',1)
   .replace('<div class="sold-o on"><span class="rd"></span>\n                  <span><span class="sold-t">Sizes','<div class="sold-o"><span class="rd"></span>\n                  <span><span class="sold-t">Sizes')
   .replace('<div class="f-in" style="margin-top:6px;">Building materials<span class="dd"></span></div>','<div class="f-in ph" style="margin-top:6px;">Choose or type one<span class="dd"></span></div>')
   .replace('<div class="f-in" style="margin-top:6px;">Roofing<span class="dd"></span></div>','<div class="f-in ph" style="margin-top:6px;">Choose or type one<span class="dd"></span></div>')
   .replace('<span class="ct">41 / 120</span>','<span class="ct">0 / 120</span>')
   .replace('<div class="f-in" style="margin-top:6px;">Gauge 28 box profile, 3 metres, per sheet</div>','<div class="f-in ph" style="margin-top:6px;">e.g. Gauge 28 box profile, 3 metres, per sheet</div>'),
   'Not saved — the product has no name. The section is marked on the rail and the field below.',
   save_cls='dis', variable=False)),
]
out=['<div class="b-bg"></div>\n']
for x,y,cap,sub,m in cells:
    out.append(f'''<div style="position:absolute;left:{x+30}px;top:{y+36}px;width:1040px;">
  <p class="st-cap">{cap}</p>
  <p class="st-sub">{sub}</p>
  {m}
</div>
''')
open('body_sections.html','w').write('\n'.join(out))
print('generated')
