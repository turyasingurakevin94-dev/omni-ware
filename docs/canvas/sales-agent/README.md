# Sales — in the agent app's language (canvas source)

The approved canvas: https://claude.ai/artifact/SwqWmXv4c2KbB1zgErYsWQ (29 Oct 2026).
149 boards — 147 phone screens at 360 × 800 plus the two parts boards (`Main`, `Main2`) —
each scored at least 8.5 on fidelity, show-don't-tell, fewest steps, polish and Sales rules
by an independent final audit (`review/`).

| Path | What |
|---|---|
| `boards/*.dc.html` | every board, literal markup; `boards/canvas.json` is the layout (pages = tabs) |
| `LANGUAGE.md` | the agent app's design language, parts P01–P29 and Sales-only S01–S10, with copy-paste markup |
| `FACTS.md` | the sample shop every board draws (Grace, Sat 17 Oct 10:41, Kato #0552 …) and the lead rulings |
| `BRIEF.md` | the rules the designers worked to (links, words, money, 360 px, 44 px) |
| `manifest/<tab>.json` | rows, board titles, tap counts before/after, open questions for Kevin |
| `review/*.json` | the final audit's scores per board |
| `tools/shot.cjs` | renders boards to PNG: `NODE_PATH=$(npm root -g) node tools/shot.cjs <out> boards/X.dc.html` |
| `../agent-ref/` | the agent app's own canvas boards (390 × 844), the reference the language was taken from |

Board prefixes: TD Today · CH Chats · SL Sell (+) · KC Counter · OR Orders · CU Customers.
