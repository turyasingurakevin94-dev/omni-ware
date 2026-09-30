# Inventory page — design canvas, third pass (simplified)

Working files for the visual-first redesign of the Inventory screen. Each
`*.dc.html` is one artboard; `canvas.json` lays them out.

- `Main.dc.html`      — the desktop console (1440): four tiles with one picture
                        each, one row of tools, one table with a cover bar on
                        every row, and the pressed line open on the right
- `Movements.dc.html` — the Movements lens: two tiles and the in/out chart,
                        kinds as counted chips, the log with a size bar per row
- `Consigned.dc.html` — the open-line panel for a line holding goods on
                        consignment: ownership bar, settle and return
- `Phone.dc.html`     — the phone (390), its own design per the two-designs law

These are mockups, not app code. Nothing here is loaded by `index.html`.
Values are lifted from the `--ow-*` tokens and the `.ow-` component layer so
the design and the app cannot drift; see `.claude/skills/ow-design/SKILL.md`.

`python3 build.py` assembles the artboards from `_chrome.css`, `_inv.css`,
`_phone.css`, `_rail.html` and the `body_*.html` files.
