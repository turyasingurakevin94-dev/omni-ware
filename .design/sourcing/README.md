# Sourcing page — design canvas

Working files for the sourcing redesign. Each `*.dc.html` is one artboard;
`canvas.json` lays them out.

- `Main.dc.html`  — the desktop console (1440), the deliverable
- `Item.dc.html`  — one item's own screen, replacing the wide modal
- `Phone.dc.html` — the phone (390), its own design per the two-designs law
- `Empty.dc.html` — nothing being sourced yet

These are mockups, not app code. Nothing here is loaded by `index.html`.
Values are lifted from the `--ow-*` tokens and the `.ow-` component layer so
the design and the app cannot drift; see `.claude/skills/ow-design/SKILL.md`.

To rebuild the canvas, re-run the `/design` skill's seeder over these files.
