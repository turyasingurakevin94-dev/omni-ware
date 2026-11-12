# Store — in the agent app's language (canvas source)

The canvas: https://claude.ai/artifact/8oCrpUTjvjLGqQT4V8rESr (drawn 11 Nov 2026, **waiting for Kevin's approval**; design only, no code until then).

145 boards: 142 phone screens at 360 × 800 in five areas, plus three summary boards (1440 wide). Every phone screen was scored by an independent reviewer against its matching agent screen (or the approved Sales board) on Consistency · Steps · Glance · Polish · In step, and revised until every axis was at least 8.5 and its total at least the agent screen's. Each board's score sits in its title on the canvas; the full table is in `docs/audit/store/GOAL.md`.

| Path | What |
|---|---|
| `boards/*.dc.html` | every board, literal markup; `boards/canvas.json` is the layout (pages = areas) |
| `BRIEF.md` | the rules the designers worked to (the agent's parts, the Store's shell, the lead rulings) |
| `FACTS.md` | the one sample day every board draws: Sat 17 Oct 2026, 10:41, the same moment as the Sales canvas |
| `REVIEW.md` | how the independent review scored |
| `manifest/<area>.json` | rows, board titles, taps before and after, handovers, kept audit fixes, other apps, open questions |
| `review/<area>.json` | the final review per board (`*.r1.json`, `*.r2.json`: earlier rounds) |
| `gen/` | the generators of the three summary boards (`ib.py` IB01, `ib2.py` IB02, `fl.py` FL01 with `flowdata.json`; they write to `../root/project/` in the working folder) |
| `tools/shot.cjs` | renders boards to PNG: `NODE_PATH=$(npm root -g) node tools/shot.cjs <out> boards/X.dc.html` |

Areas and prefixes: **TD** Today and the shell · **PK** Pack · **IN** Goods in (trips, deliveries, returns, rides) · **SH** Shelf (find, counts, losses, asks) · **OU** Out (load, gate, road, door). Summary boards: **IB01** every handover · **IB02** one word per state · **FL01** taps before and after.

The design work behind it: `docs/audit/store/` — `agent-design-language.md`, `STORE-TODAY.md`, `INTEGRATION.md`, `FLOW.md`, `OTHER-APPS.md`, `GOAL.md`.
