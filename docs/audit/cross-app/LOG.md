# Cross-app audit log (Sales ↔ Buyer)

Rounds that test two apps at once, at the point where one hands work to the
other. Each app keeps its own log too (`docs/audit/sales/LOG.md`; the Buyer's
goal and handover are in `docs/audit/buyer/`). Boards live on the Buyer canvas
beside the handover board (`docs/canvas/buyer/XR<N>*.dc.html`).

## Rounds

| Round | Aspect | Brief | Phase A | Phase B |
|---|---|---|---|---|
| 1 | The handoff (BUY-1 cancel asks, BUY-2 Today's counts, BUY-3 priceAsk, SAL-1 the Buyer's words in Sales, SAL-2 the goal bar) | 11 Nov 2026 | 11 Nov 2026: `ROUND-1.md`, boards `XR1Hold`, `XR1Today`, `XR1PriceComing`, `XR1SalesLines`, `XR1Goal` | 11 Nov 2026, with the hold pushes and question 2: migration 0182, the Buyer's holds, No supplier, price tags, the Buyer's words in Sales, the GoalBar |

## Deferred

- A quiet `supplier.found` push to the salesperson (handover.md §6). Sales re-reads every 45 s for now (round 1).
- A checked live script for 0182 (as `docs/live/apply-0179-0181.sql`): not made; 0182 is pasted after 0179-0181 (it leans on 0181's `cancel_asks`).
- The older canvases give #0550 two different orders (round 1, question 3).

## Decisions

- Today counts suppliers; Orders counts orders; the door between them is labelled ("Checking 3 ›"). Round 1.
- The Manager's "Price up" is only a cost over the selling price; every other price wait is a tag on a line the Buyer still asks. Round 1 (Kevin: "fix question 2 too").
- A cancel asked holds the order on the Buyer's side, pushed both ways (the hold, the Manager's no). Round 1 (Kevin: "with the hold pushes").
