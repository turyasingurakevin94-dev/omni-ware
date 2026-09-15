# Charges on the quote — design canvas

Working files for making the service-charge block belong to the quote
document instead of sitting under it. Each `*.dc.html` is one artboard;
`canvas.json` lays them out.

- `Before.dc.html`  — what shipped (1240), redrawn from the owner's screenshot
- `Main.dc.html`    — the change: a charge is a row of the table (1240)
- `Percent.dc.html` — the case the fixed row does not show (1240)
- `Phone.dc.html`   — the phone (390), its own design per the two-designs law

## What the canvas argues

A charge was a panel below the table, and three things followed from that:

1. Its figure sat outside the table's eight-track grid, so `5,000 UGX`
   landed ~280px right of the `155,000 UGX` it was added to. The foot
   already keeps the opposite law — `index.html:6185`, *"the figure in
   the line-total column so it sits under the figures it totals."*
2. Its input was a permanently boxed control with a native stepper, so a
   5,000 shilling fee out-weighed a 155,000 shilling line. Every other
   figure in the table uses the ghost input (`index.html:12749`), which
   is transparent until the row is hovered.
3. The shop-side divider that runs the length of the document
   (`index.html:6117`) stopped dead above it.

The change: a charge rides the same eight tracks as every other row. What
marks it as NOT A GOOD is what it has not got — no number in the gutter,
no quantity, no supplier, no margin — rather than a tint, a badge or a
second state colour.

## Conventions

These are mockups, not app code. Nothing here is loaded by `index.html`.
`_base.css` is lifted from the app rather than drawn to taste, and every
rule in it names the line it came from, so the canvas and the screen
cannot drift; the palette is `.claude/skills/ow-design/SKILL.md`.

Rebuild the artboards with `python3 build.py`, then re-run the `/design`
skill's seeder over them. The seeded page is a build output and is
ignored, like every other canvas here.
