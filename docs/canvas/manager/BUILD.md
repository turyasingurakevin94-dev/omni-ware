# Building the Manager app from this canvas: the brief for every builder

Kevin approved the canvas "Manager — Agent language" on 12 Nov 2026 and asked for it built "as it is". It is built the way the Store and the Buyer were (docs/rebuild.md, docs/spec/07-stack.md): Preact with signals and TypeScript, on the shared parts in `src/ui/` and the Manager core in `src/core/manager/`. The old `manager.html` stays as it is.

## Read first
1. **Your board**, two files in this folder:
   - `<Board>.dc.html`: the design, as code. Copy its real values: sizes, colours, gaps, words.
   - `png/<Board>.png`: how it renders, 2040×1720. Row 1 is the phones; row 2 is the states.
   - `BRIEF.md` holds the shared sample data.
2. **The spec.** `docs/spec/04-screens-manager.md`: §2 routes, §3 the queue and the one Decide sheet, §4 every decision (ask → evidence → answers → who is told), §6 rules. `docs/spec/04-screens-manager-data.md` says what the real books do.
3. **The shared parts.** `src/ui/README.md`. **Compose from them; never hand-roll a variant.** A part that can't do something gets a prop in `src/ui/`; tell the lead, never copy it.
4. **The core.** `src/core/manager/`:
   - `types.ts`: ManagerBooks, Ask, …
   - `words.ts`: **every** ask and answer word.
   - `queue.ts`, `price.ts`, `credit.ts`, `watch.ts`: the rules. Use them; never work a rule out again in a screen.
   - `source.ts`: the writes (`WRITES`).
   - `demo/`: the sample day.
5. **The shell.** `src/apps/manager/shell/`:
   - `nav.ts`: `nav.push(id, params)`, `nav.back()`, `nav.home()`, `nav.tab()`.
   - `store.ts`: the signals `books`, `now`, `online`, `kept`, `waiting` (the queue, less what was just answered). Two ways to write:
     - `answer(key, label, kind, args)`: a tap, held 10 s with Undo, then sent;
     - `await act(kind, ...args)`: a slide or a Save, sent now.
   - `routes.ts`: the ids.
6. **The Decide sheet.** `src/apps/manager/decide/`:
   - `kit.ts`: the Kind API. A kind returns `{ chip, title, evidence, dock }`.
   - `Decide.tsx`, `Head.tsx`, `DockView.tsx`, `decide.css`: the frame (head, NEXT row, dock, the Undo strip after an answer).
   - **`kinds/short.tsx`** is the worked example (D-12): copy its shape.

## Rules
- **Your folder only.** Make files in your own folder. Each area exports its routes from `index.tsx` as `screens`. A Decide kind builder writes `decide/kinds/<kind>.tsx` (+ css) exporting `kind`, and must **not** edit `kinds/index.ts`: the lead registers them.
- **Hands off:**
  - Do not edit `src/core/manager/*.ts` (existing files), `src/ui/*`, the shell, or another area.
  - A new pure rule goes in a NEW file `src/core/manager/<your-area>.ts`, with a test-friendly function. Say so in your reply.
  - A write the source lacks: say so; never fake it.
  - A demo figure you need that is missing: say so. The lead adds it to `demo/`.
- **At 360 px, all states from your board:**
  - default and pressed (the white answer greys 8%, scales .97);
  - disabled, with the reason in the button's words ("Pick a limit to load it");
  - sending (a spinner in the answer);
  - success (the Undo 10 strip, or a toast with Undo);
  - error: "Not sent · Try again", or "Someone else just did this";
  - offline: the amber "No signal · it sends when back", the row says "Waits";
  - empty: e.g. "Nothing waits on you", "Nobody owes".
- **Look and size:**
  - One red per screen: the + or one slide knob.
  - Tap targets ≥ 44 px. No text under 11 px.
  - Money in IBM Plex Mono via `money()` / `Money`.
  - Times as "09:15", from `hm()` in words.ts.
  - People by display name, first word ("Grace"). Orders as #0550 (`orderNo`).
- **Words: only `words.ts` and handover.md §3.** Every answer shows who is told: "{names} see(s) {word}" with the bell.
- **Files and types:**
  - Files 200–500 lines, never over 1,000.
  - CSS sits beside its file, with classes prefixed `mg-<area>-…`.
  - No `any`. `npx tsc -p tsconfig.json --noEmit` must pass.
- **Never improvise a screen.** If you need a page, sheet or state the boards don't draw, stop and say so. It gets drawn first.

## Check your work (you may render; do not publish, do not commit)
```
node tools/build-app.js manager          # writes next/manager.html
NODE_PATH=$(npm root -g) node tools/manager-shot.cjs '?demo' out.png ['.ow-plus' …click selectors]
```
- The shot is 360×780 and prints page errors.
- `?demo&push=x:<ask key>` opens Decide on that ask, e.g. `price:555:0`, `storecredit:551`, `short:550`.
- `&at=HHMM` gives a later card's moment (`src/core/manager/demo/asks.ts` MOMENTS: 1005, 1015, 1020, 1120, 1125, 1140, 1220, 1310, 1420, 1610, 1620).
- Other switches: `&state=markup|twins|empty`, `&offline`, `&fail=<write>`, `&clash=<write>`, `&slow=1` (Sending…).

Compare with your board's PNG and fix until it matches. Then drive each answer on the demo and see the books change. Reply in under 200 words:
- the files you wrote;
- what works;
- any rule or write you needed;
- anything you could not match.
