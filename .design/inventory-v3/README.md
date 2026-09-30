# Inventory page — design canvas, third pass

Working files for the visual-first redesign of the Inventory screen. Each
`*.dc.html` is one artboard; `canvas.json` lays them out.

- `Main.dc.html`      — the desktop console (1440) with the shelf in lanes: the
                        position strip, the map, the three lanes, the open line
- `Register.dc.html`  — the same screen as a register, every row carrying its
                        cover bar, share bar and 30-day bars; one line open
- `Movements.dc.html` — the Movements lens: kinds as counted chips, in/out by
                        day, the log with a size bar per row
- `States.dc.html`    — settled, filtered-empty, failed read, brand new
- `Phone.dc.html`     — the phone (390), its own design per the two-designs law
- `PhoneLine.dc.html` — one line opened on the phone

These are mockups, not app code. Nothing here is loaded by `index.html`.
Values are lifted from the `--ow-*` tokens and the `.ow-` component layer so
the design and the app cannot drift; see `.claude/skills/ow-design/SKILL.md`.

`python3 build.py` assembles the artboards from `_chrome.css`, `_inv.css`,
`_phone.css`, `_rail.html` and the `body_*.html` files.
