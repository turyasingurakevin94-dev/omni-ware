# Fastener studio

The guide keeps the existing size router, reference tables and catalogue lookup. Its drawing now leads the page, with configuration alongside it and full specifications behind a native disclosure.

- **Overview** shows the selected finish and matching parts separately. Nut and washer visibility no longer depends on screen width.
- **Dimensions** marks nominal length and diameter. Countersunk screw length includes the head; pan and truss lengths start at the bearing face. See [Accu's measurement guide](https://www.accu.co.uk/p/123-how-to-measure-a-screw).
- Spanner, drilling and washer diagrams explain what each figure refers to. Numeric recommendations still come from the existing tables.
- SVG materials, wood-screw pitch, plug length and tool silhouettes are illustrative. This is not a calibrated screen ruler or a load-rating calculator.
- Controls use native buttons with pressed states and retain focus after redraw. Full specifications use native `details`; reduced-motion preferences suppress the entrance effect.

No new dependencies or database changes. The renderer uses the existing palette, type, spacing and corner tokens. `test/fastener-studio.test.js` checks both drawing modes across phone/desktop widths, every table size, length datums, SVG references, custom lengths and bounded thread rendering.
