# Products × suppliers — visualization directions

Six ways to draw the same bipartite relationship (products ↔ suppliers,
edges weighted by price and dated by when it was quoted).

- `Main.dc.html`      — A, the price matrix, at full console fidelity
- `Ribbon.dc.html`    — B, the bipartite linkage map
- `Spread.dc.html`    — C, the spread ladder (dumbbell, one shared axis)
- `Risk.dc.html`      — D, the dependency view
- `Freshness.dc.html` — E, the freshness grid
- `Shape.dc.html`     — F, supplier small multiples
- `Phone.dc.html`     — the phone design for A, per the two-designs law

Bodies live in `body_*.html`; `build.sh` wraps each in the Design Component
shell with the shared `_helmet.html`. The matrix, ribbon, spread, freshness
and shape grids are emitted by the `gen_*.mjs` scripts straight from the seed
figures, so no number here is hand-typed.

These are mockups, not app code. Nothing here is loaded by `index.html`.
Values are lifted from the `--ow-*` tokens and the `.ow-` component layer;
see `.claude/skills/ow-design/SKILL.md`.

To rebuild the canvas: `sh build.sh`, then re-run the `/design` seeder.
