# Sales app in the agent app's language: the shared brief

Kevin (the owner) wants the Sales app (`/home/user/omni-ware/sales.html`) redrawn so that it looks and works like the **agent app** (`/home/user/omni-ware/agent.html`).

The bar Kevin set: the agent app shows more than it tells, does everything in the fewest possible steps, and looks polished and premium. Your screens must score as close to the agent app as possible, or better.

- **Elements the two apps share** must look exactly the same as the agent app's. Shared elements include:
  - the head;
  - the tab bar and the red +;
  - client and customer rows and avatars;
  - search;
  - order lines;
  - the dock and the slide;
  - sheets;
  - the order tracker;
  - goal rings and progress bars;
  - chips;
  - money;
  - empty and loading states.
- **Elements only Sales has** are redesigned in the same language, so they look like they came from the agent app's designer.

## Where everything is

`SX` = `/tmp/claude-0/-home-user-omni-ware/da9c4df5-f420-5c30-8b17-d5368191f886/scratchpad/sx`

| What | Where |
|---|---|
| The agent app's design language, codified, with copy-paste parts | `SX/LANGUAGE.md` (read it first; it wins over your own reading) |
| Agent app canvas, every screen as source (390×844, literal markup) | `/tmp/claude-0/-home-user-omni-ware/da9c4df5-f420-5c30-8b17-d5368191f886/scratchpad/agentref/project/*.dc.html` |
| The same screens rendered as PNG (look at them) | `SX/shots/ref/*.png` |
| The live agent app on Kevin's phone (Order, Today) | `SX/userref/agent-order-live.jpg`, `SX/userref/agent-today-live.jpg` |
| The agent app's code | `/home/user/omni-ware/agent.html` (`renderToday`, `renderTodayHero`, `renderMove`, `renderNext`, `renderOrder`, `renderClientStrip`, `renderCart`, `renderDock`, `renderFind`, `renderClientsListScreen`, …) and its `:root` tokens at line ~236 |
| The current Sales app | `/home/user/omni-ware/sales.html` (`PAGE.*`, `SHEET.*`, `K.*` kit) |
| The current approved Sales boards: what each screen must DO, its states and rules (keep the substance, replace the look, cut the steps) | `/tmp/claude-0/-home-user-omni-ware/da9c4df5-f420-5c30-8b17-d5368191f886/scratchpad/salesref/project/*.dc.html` (T Today, S Sourcing, C Chats, N Sell, P Price, K Counter, O Orders, U Customers and payments, G* the gaps) |
| Render tool | `cd SX && NODE_PATH=$(npm root -g) node tools/shot.cjs <out_dir> <file.dc.html> [more…]` (screenshots each artboard at its `$preview` size; it prints the number of fonts loaded) |

## Binding rules for the content

These come from the repository, and you must read them:

- `/home/user/omni-ware/CLAUDE.md`
- `/home/user/omni-ware/docs/decision-rights.md`, which says who decides what:
  - Sales takes orders, takes payments and talks to customers;
  - the Manager prices, gives credit, handles returns and voids;
  - Accounts checks money;
  - Sourcing finds items.
- `/home/user/omni-ware/docs/audit/GLOSSARY.md`. The shared words always win: customer (not "client", in Sales), Take payment, Give change, Deposit, Not paid yet, Price coming, Being checked, Owes, Try again, Not sent yet, Back online to sell, and the stages Checking · Buying · Packing · On the road · Delivered.
- `/home/user/omni-ware/docs/canvas-cast.md`, the sample shop's people and customers. Use those names.

The Sales person earns no commission. Never show "+yours" earnings. The Sales app has a monthly sales goal (see `T5Goal`), and its hero may use the agent's goal ring for that goal.

Money:
- Mono (IBM Plex Mono), tabular.
- An amount someone acts on is written in full ("1,250,000"). A tile or a summary may shorten it the way the agent app does ("1.2M").

Copy:
- Short plain words for low-literacy users.
- One word per concept.
- People's display names.
- Order numbers as `#0550`.

## How to draw

- One screen per artboard, phone at **360 × 800** (Kevin's rule: design at 360; nothing clipped at 360).
  - Root element: `width: 360px; height: 800px; position: relative; overflow: hidden`.
  - `data-props='{"$preview":{"width":360,"height":800}}'`.
- Use the file shape of the agent reference files exactly:
  - `<!doctype html>`…`<script src="./support.js"></script>`…`<x-dc><helmet>` with the Google Fonts link and `body{margin:0}`;
  - literal inline-styled markup;
  - the `<script type="text/x-dc" data-dc-script …>` block with `renderVals(){ return {}; }`.
- **Literal markup only.** No `sc-for`, `sc-if` or `{{holes}}`, so the render tool shows exactly what the canvas will.
- Links between your own screens: `<a href="OtherFile.dc.html">`. Use `<a>` or `<button>` for anything tappable, and an `aria-label` on icon-only controls.
- Tap targets at least 44px. Text at least 11px. Text contrast at least 4.5:1. Nothing clipped, and nothing hidden under the dock or the tab bar.
- Icons are inline SVG in the agent app's style (see LANGUAGE.md). Never emoji.
- Every board must be **filled to the bottom** with real content, the way the agent screens are. No half-empty screens, unless the state really is empty, and then it is designed the agent's way (a ghost of what is coming, plus one way in).
- Show, don't tell:
  - rings, bars, dots, face stacks, step tiles, tiles with counts;
  - one line of words where a picture cannot carry it.
- Fewest steps:
  - act from the list;
  - prefill what the app knows;
  - slide to commit money or an order;
  - undo instead of a confirm.
- Count the taps of each main flow, before and after.

## Your output

1. Files go to `SX/root/project/<Prefix><NN><Name>.dc.html`, using your tab's prefix, for example `TD01Today.dc.html`. Write only files with your own prefix. Never touch `SX/root/project/canvas.json`, another tab's files, the repository, or any artifact (do not publish; the lead publishes).
2. Render every screen with the tool into `SX/shots/<tab>/` and **look at each PNG**. Fix:
   - clipping;
   - overlap;
   - misalignment;
   - empty bottoms;
   - text under 11px;
   - anything that looks less premium than the agent references.
3. Score each screen against the agent reference screens, out of 10 on each of:
   - **Fidelity**: shared parts are identical and unique parts are in the same language;
   - **Show**: show, don't tell;
   - **Steps**: fewest taps;
   - **Polish**: premium, aligned, rich but calm;
   - **Truth**: Sales rules and glossary words are right.

   Keep revising until every screen scores at least **8.5 on every axis**. Be a harsh judge. The agent app is the bar.
4. Write `SX/manifest/<tab>.json` in this shape:

```json
{"tab": "...", "rows": [{"title": "row title", "boards": [{"file": "TD01Today.dc.html", "title": "short title → what it does"}]}],
 "flows": [{"name": "...", "taps_before": 0, "taps_after": 0}],
 "scores": [{"file": "...", "fidelity": 0, "show": 0, "steps": 0, "polish": 0, "truth": 0}],
 "open_questions": ["anything that needs Kevin's decision (a job with no role, a new word)"]}
```

   Group the rows by flow, about 4–9 boards per row.
5. Reply with a short summary: the screens, the biggest changes, the tap savings, and any open questions.

## Kevin: "all the designing should be done using /design"

Every screen is a `/design` artboard, drawn the way the `/design` (Design canvas) instructions say and published by the lead to Kevin's `/design` canvas, "Sales — in the agent app's language" (https://claude.ai/artifact/SwqWmXv4c2KbB1zgErYsWQ).

Before you draw, read and follow the `/design` instructions in `SX/design/`:

- `SKILL.md`: the artboard skeleton, the "Rules that bite" and "Designing well";
- `artifact-type/reference/craft.md`: the craft; in particular "Recreating an existing UI", "Mobile prototypes" (no fake status bar) and "Accessible as drawn";
- `artifact-type/reference/format.md`: the file format.

Kevin asked for scoring, so rendering your own boards locally to check them is part of the job here.

## Lead rulings (apply everywhere)

- **Buttons.** "Ask Ruth", "Ask Esther", "Send to Ruth" and every other ask are NAVY. Red is only for taking money (Take payment, slide to sell or record) or ending a flow (P26).
- **Passing a chat.** The word is "Give". The Manager's word is "Move".
- **Sample data.** Every figure follows `SX/FACTS.md`, once it exists: names, owed amounts, rhythms, order numbers, times, totals, counts, stock and prices. A board that disagrees with FACTS.md fails Truth.
- **The end of a flow.** One button, "Back to Today".

## Lead ruling · links (final, applies to every tab)

- Write real file names in every `href`. Never use SX* placeholders.
- A link opens THAT customer's or THAT order's own board. If none exists, the control is a plain `<button>` with no href.
- Generic list boards are allowed only for a list action: OR01Orders, CU01Customers, CH01Chats, SL01Who.
- Kato's #0552 at 10:41 is OR07Packing.
- Toast Undo and composer attach buttons are 44×44.
- The "Something wrong" sheet keeps that title. The order action-bar tile that opens it may say "Fix it".
