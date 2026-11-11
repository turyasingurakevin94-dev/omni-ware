# Buyer app goal — redesign in the Agent app's language, in step with Sales

Set by Kevin on 29 Oct 2026. Every session that works on the Buyer app (buyer.html) reads this first and works toward it.

## Goal

Redesign the Buyer app (buyer.html) in the Agent app's design language (agent.html), rethink the buying workflow from first principles, and keep it in step with the Sales app (sales.html) it gets its work from.

## Why

Someone who already knows the Agent app should be able to pick up the Buyer app with no training. The Agent app shows rather than tells, gets each job done in the fewest steps, and looks polished and premium. The Buyer app should feel like the same product. And because every order the Buyer works on comes from Sales, the two apps must hand work to each other cleanly, with the same words, the same order states and the same signals on both sides.

## How

1. **Study the Agent app first.** Read agent.html and its canvases and write down its design language: tokens, type, spacing, colours, components, icons, motion, how it shows status, and how few taps a job takes. Every design agent works from that one shared reference.
2. **Study the Sales → Buyer handover.** Read sales.html and map how work moves between the two apps:
   - what Sales sends: the order, its lines, the client, the price the client was quoted, the order's stage;
   - what the Buyer sends back: a supplier's yes or no, a price that went up, a switched item, a line removed or one the client waits for, goods that came back short;
   - how each side learns of it: which pushes, which statuses, which words.

   Then list every place the two apps disagree: a different word for the same thing, a state one app shows and the other doesn't, a hand-off with no push, a step done twice. The redesign must close those gaps. Both apps use the same words for the same order states and hand-offs (docs/audit/GLOSSARY.md), and any hand-off that waits on someone sends that person a push.
3. **Rethink the buying process before the screens.** Map the Buyer's job end to end, from when Sales hands over an order to when the goods are handed in and Sales is told. For every step, ask whether it needs to exist, whether it can merge with another, and whether the app can do it for the Buyer. Aim for the fewest steps and taps. Keep docs/decision-rights.md as it is.
4. **One design agent per Buyer tab:** Today, Orders, the trip (Plan, On the trip, Hand-in), Replies, and Suppliers. Each agent:
   - redesigns every element that has an Agent app equivalent the way the Agent app would build it;
   - designs anything only the Buyer app has with /design, in the same language;
   - shows on each screen where work came from Sales and what Sales gets back;
   - draws every screen at 360px with all its states (default, pressed, disabled, sending, success, error, offline, empty).
5. **Work page by page and put the designs on ONE new canvas.** Add a board that maps the Sales ↔ Buyer handover as one flow: each hand-off, its push, and the words both apps use.
6. **Score every page** against the matching Agent app screen on: visual consistency, steps to finish the job, glanceability, polish, and how well it stays in step with Sales. Keep revising until each page scores as good as the Agent app or better, and show the scores beside each page.

## Focus

The buying flow from Sales' handover to goods handed in: the fewest steps, and nothing lost or said differently between the two apps.

## Done when (revised by Kevin, 29 Oct 2026)

- [x] every Buyer page is on the canvas, and the independent reviewer scores it at or above the Agent app (round 5, scored from the rendered screens: 28 pages, 8.68, 0 below);
- [x] the handover board names a push and one agreed word for every hand-off (13 of 13), and the Buyer pages use only those words;
- [x] every push that does not exist yet is listed, ready for one migration after approval (6, in handover.md §6);
- [x] every change Sales needs to reach the same words is listed in handover.md §5 for the Sales session (11);
- [x] the end-to-end flow takes fewer steps than today (26 taps → 6 taps + 2 slides);
- [x] this progress table is up to date.

Then stop and ask Kevin to approve the canvas. No code, migrations or Sales changes until then.

## Progress

| Step | State |
| --- | --- |
| 1. Agent app design language | done · `agent-design-language.md` |
| 2. Sales ↔ Buyer handover map | done · `handover.md` (12 mismatches, 5 Sales changes) |
| 3. Buying flow from first principles | done · `flow.md` (26 taps → 6 taps + 2 slides) |
| 4–5. Pages on the new canvas | done · 7 tab boards (28 pages, all 8 states) + handover board + flow board on the [canvas](https://claude.ai/artifact/YDydRwAjmK6U3YsQhnjFz7) |
| 7. Build | done · `next/buyer.html` (Preact, `src/apps/buyer`, `src/core/buyer`), demo `?demo`, real books; only what is drawn (Gate, Additions, Additions2 boards added for what the build needed); e2e `test/buyer-e2e.test.js`. Switched 2026-11-11: `buyer.html` is the new app (old copy `old/buyer.html` until 2026-12-11); APK from `build-buyer-app.yml` |
| 8. Cross-app round 1 (Sales → Manager → Buyer) | Phase A done 2026-11-11 · `docs/audit/cross-app/ROUND-1.md` (BUY-2..5, X-1, X-2); waiting on Kevin's go-ahead |
| 6. Scores | done · independent review, 5 rounds (rounds 4–5 from rendered screens, overlap sweep clean): 8.39 → 8.68; 0 of 28 pages below the Agent app (Scores board) |

## Waiting on Kevin

- ~~Approve the canvas before any code.~~ Approved: "now implement" (2026-11-10).
- ~~Switch~~ Done 2026-11-11 on the branch; live when merged to main.
- Should a complete order handed in push the salesperson? (handover.md, open question.)
- The Sales changes (handover.md §5, 11 items) and three new pushes (order.check, supplier.no, sourcing.waits — one migration) go to the Sales session.

## Decided after the review (Kevin asked Claude to choose, 2026-11-11)

Each the smallest safe choice; change any by saying so.

| # | Question | Decision |
|---|---|---|
| 1 | Remove an order's only line? | No: it stays locked ("use Client waits"), as Orders draws. An order is never emptied from the Buyer app. |
| 2 | "To ask" counts suppliers or orders? | Suppliers: one Ask goes to one supplier (as now, `rules.ts` tiles). |
| 3 | Orders' head: Orders phone 1 or Additions C? | Orders phone 1 (the main board). |
| 4 | Switch item's aisles button | Left off: it was drawn but has nothing to open. |
| 5 | Katwe 43,500 (board) vs 41,000 (the list) | The books win: the app shows the list price and its age. |
| 6 | Plan with nothing found: dock or not | Additions E (no dock), the later board. |
| 7 | Correct a stop after the 5 s Undo | No correction in the Buyer app: what came is counted in by Musa at hand-in. |
| 8 | Take off a stop while the cash ask waits to send | Locked once the cash ask is sent or kept, as after it is sent: the amount asked never changes under Esther. |
| 9 | 09:50 or 9:50 | 9:50: the shared clock, the same in every new app. |
| 10 | Disabled button colour | The shared Button's, the same in every new app. |
| 11 | "Today 3/6" on a supplier row | Left out. |
| 12 | Suppliers search on a second tap of the tab | Kept: the search survives Back and tab switches. |

