# Store app in the agent app's language: the shared brief

Kevin (the owner) wants the Store app (`/home/user/omni-ware/store.html`) redrawn so that it looks and works like the **agent app** (`/home/user/omni-ware/agent.html`), the same way the Sales app was redrawn (`/home/user/omni-ware/docs/canvas/sales-agent/`, 201 approved boards). Someone who knows the Agent app must pick up the Store app with no training.

The bar: the agent app shows more than it tells, does every job in the fewest steps, and looks polished and premium. Every board must score as well as the matching agent screen, or better.

The Store sits in the middle of the order's journey (Sales takes it → Checking → Buying → **Packing → On the road → Delivered** → paid). Most of its work arrives from another app and goes back out to one. So every board also shows **where the work came from** ("From Grace · #0552") and **what goes back** ("Grace sees: Packed"), in the same words the other app uses.

## Where everything is

`SX` = `/tmp/claude-0/-home-user-omni-ware/11b18423-d239-564a-81b7-c16ec0e211d4/scratchpad/stx`

| What | Where |
|---|---|
| The agent language, codified, parts P01–P29 with copy-paste markup | `SX/LANGUAGE.md` (the Sales canvas's; read it first, it wins over your own reading) |
| What LANGUAGE.md lacks for the Store (states, motion, taps) | `/home/user/omni-ware/docs/audit/store/agent-design-language.md` |
| The agent app's own boards (390 × 844, literal markup) | `/home/user/omni-ware/docs/canvas/agent-ref/*.dc.html` |
| The approved Sales boards (360 × 800): copy shared parts from these when LANGUAGE.md is not enough | `/home/user/omni-ware/docs/canvas/sales-agent/boards/*.dc.html` (Main, Main2 = the parts boards; OR07Packing, OR08Road, OR38PickupGate are the Store's handovers seen from Sales) |
| The Store app today: every page, its states, jobs and taps, the audit fixes to keep | `/home/user/omni-ware/docs/audit/store/STORE-TODAY.md` |
| Every handover with every other app, the words both sides use, the mismatches | `/home/user/omni-ware/docs/audit/store/INTEGRATION.md` |
| The new job, step by step (what was cut, merged, automated) | `/home/user/omni-ware/docs/audit/store/FLOW.md` |
| The one sample day every board draws | `SX/FACTS.md` |
| The current Store code | `/home/user/omni-ware/store.html` (`PAGE.*`, `ACT.*`) |
| Render tool | `cd SX && NODE_PATH=/opt/node-tools/node_modules node tools/shot.cjs <out_dir> <file.dc.html> [more…]` (Chromium is at /opt/pw-browsers) |

## Binding rules for the content

Read these:

- `/home/user/omni-ware/CLAUDE.md`
- `/home/user/omni-ware/docs/decision-rights.md`. The Store just does its work (check in, count, pick, pack, load, deliver, name directions) and no one waits on it. The Store **proposes** and **Ruth (Manager) decides** short picks, write-offs, returns and count differences. Accounts takes the money. Nothing waits on the owner.
- `/home/user/omni-ware/docs/audit/GLOSSARY.md`. Its words always win. The ones that bite most on Store boards:
  - stages **Checking · Buying · Packing · On the road · Delivered**;
  - **To pack**, **Waiting on goods**, **Packing now**, **Packed**, **Pack short**;
  - **Trip** (never "round"), **Check-in**, **Coming in** (goods into the yard), **On the road** (orders going out), **Hand over** (at the gate), **Pass the yard** (the shift);
  - **On the shelf**, "12 on shelf · Order in · Out";
  - **Not paid yet** (one label; never "waits on money", "cash customer", "holds");
  - **Sending… · Not sent yet · Sent · Waiting to send · Try again · Updating · saved 7:52 · Live**;
  - "41 m", "2 days" for how long; "15:20", "Thu 23:28" for when.
- **The yard's phone shows no money at all** (GLOSSARY "Money on a phone"). No prices, no totals, no amounts owed. "Not paid yet" is a label, never a figure.
- `/home/user/omni-ware/docs/canvas-cast.md`, the sample shop's people. Use those names.

## How to draw

- One screen per artboard, phone at **360 × 800**.
  - Root element: `width: 360px; height: 800px; position: relative; overflow: hidden`.
  - `data-props='{"$preview":{"width":360,"height":800}}'`.
- Use LANGUAGE.md's file shell exactly: `<!doctype html>` … `<script src="./support.js"></script>` … `<x-dc><helmet>` with the Google Fonts link and `body{margin:0}`; literal inline-styled markup; the `<script type="text/x-dc" data-dc-script …>` block with `renderVals(){ return {}; }`.
- **Literal markup only.** No `sc-for`, `sc-if` or `{{holes}}`.
- Links between screens: `<a href="OtherFile.dc.html">`, real file names only. `<a>` or `<button type="button">` for anything tappable; never a link inside a link; `aria-label` on icon-only controls.
- Tap targets at least 44px. Text at least 11px. Text contrast at least 4.5:1. Nothing clipped at 360, nothing hidden under the dock or the tab bar.
- Buttons are not oversized: the agent's sizes (P26). Navy for an in-content primary; **red only for the one commit** (the slide, or ending a flow).
- Icons: inline SVG in the agent's style (LANGUAGE.md §2). Never emoji.
- Every board is **filled to the bottom** with real content, as the agent screens are, unless the state is really empty, and then it is the agent's empty state (P24: a ghost of what is coming, plus one way in).
- Show, don't tell: rings, bars, dots, face stacks, step tiles, item pictures, tiles with counts; one line of words where a picture can't carry it.
- Fewest steps: act from the list; prefill what the app knows; everything starts "all there" and you tap only the exception; slide to commit; Undo instead of a confirm.
- **States.** Each flow draws its states as their own boards: default, pressed (show it on the control that matters), disabled, sending, success, error, offline, empty. Group them in your manifest rows.
- **Handover strip.** Where work came from another app or goes back to one, show it the agent way, compactly: a face, a name, the order number, the other app's word ("From Grace · #0552", "Ruth decides", "Grace sees: Packed").

## Your output

1. Files go to `SX/root/project/<Prefix><NN><Name>.dc.html` using your area's prefix (e.g. `TD01Today.dc.html`). Write only files with your own prefix. Never touch `SX/root/project/canvas.json`, another area's files, the repository, or any artifact (the lead publishes).
2. Render every board with the tool into `SX/shots/<area>/` and **look at each PNG**. Fix clipping, overlap, misalignment, empty bottoms, text under 11px, anything less premium than the agent references.
3. Score each board against the matching agent screen, 0–10, on:
   - **Fidelity**: shared parts identical to the agent's; Store-only parts in the same language;
   - **Steps**: fewest taps;
   - **Show**: glanceable; shows, doesn't tell;
   - **Polish**: premium, aligned, rich but calm;
   - **In step**: same words, states and pushes as the apps it hands work to or takes it from; GLOSSARY and decision rights right.
   Keep revising until every board scores at least **8.5 on every axis**. Be harsh. The agent app is the bar. An independent reviewer re-scores after you.
4. Write `SX/manifest/<area>.json`:

```json
{"area": "...", "prefix": "TD",
 "rows": [{"title": "row title", "boards": [{"file": "TD01Today.dc.html", "title": "short title → what it does", "agent_match": "Today.dc.html (agent-ref)"}]}],
 "flows": [{"name": "...", "taps_before": 0, "taps_after": 0, "steps_before": 0, "steps_after": 0}],
 "scores": [{"file": "...", "fidelity": 0, "steps": 0, "show": 0, "polish": 0, "in_step": 0}],
 "handovers": [{"board": "...", "from_or_to": "Sales/Grace", "words_here": "...", "words_there": "...", "push": "kind → who"}],
 "kept_fixes": ["audit item ids from STORE-TODAY.md this area keeps, and how"],
 "other_apps": ["any change another app needs, with the app name"],
 "open_questions": ["anything that needs Kevin's decision"]}
```

5. Reply with a short summary: the boards, the biggest changes, the tap savings, open questions.

## Lead rulings (apply everywhere)

- The phone holder is **Musa Kiggundu (MK)**, Store lead. "Good morning, Musa".
- **One "now": Sat 17 Oct 2026, 10:41**, the same moment as the Sales canvas. Every order number, time and line follows `SX/FACTS.md`.
- **The end of a flow**: one button, "Back to Today".
- **Asks** ("Ask Ruth", "Send to Ruth") are NAVY.
- Counting is in the unit you can see (cartons and boxes, bundles and pieces); the books keep the line's unit.
- **The Store's shell.** The tab bar is the agent's (P16): **Today · the red centre button · Shelf**. The red centre opens **the Next job** (a play-arrow mark, aria-label "Start the next job"), with a badge of jobs waiting. Today's hero is the agent's P02 with "Good morning, Musa", "Sat 17 Oct · Live", and the yard's figure in place of money: **"7 jobs left · 5 done"** with a segmented bar. Today's "On the move" tiles (P07) are the yard's stages: **Coming in · To pack · To load · On the road** (meta "1 delivered today").
- **The yard's stage sheets** (the agent's "Packing 7" sheet, see `agent-design-language.md`) use the rail **Coming in · To pack · To load · On the road · Delivered**, and the shared order-stage words where an order's own stage shows (Checking · Buying · Packing · On the road · Delivered).
- **The order's own track** (P18) shows the shared stages, so a Store order page and Grace's OR07Packing read the same.
- Follow `docs/audit/store/FLOW.md`: it is the job you draw. Its "Closes" column names the mismatches each board must close.
- **One rule for sends (lead ruling, round 2).** A send that changes nothing until Ruth decides (a count, a loss report, an ask for more, a return) is a NAVY "Send to Ruth" button with Undo 10 s. A commit that moves goods (check-in, pack, load, hand over, deliver, put back, ride hand-in) is the RED slide. "Pack short" stays amber (GLOSSARY).
- **Never "held"** for stock: "412 on shelf" (the figure Sales shows), with "packed for #0552 · bay 1" apart. **The blind rule stays**: an item due for a count shows "Count due" in place of its figure on the yard's phone.
- **No signal** is the amber P27 bar with a white Try again; **a save that failed** is red "That did not save · tell Kevin · code". Before a commit, who will be told sits in a dashed "After the slide · X sees …" strip; after it, "X sees" rows. Never past tense before the commit.
- Every flow ends on ONE button, "Back to Today" (or the real next job).
