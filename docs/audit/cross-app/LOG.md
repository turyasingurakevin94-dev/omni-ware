# Cross-app audit log (Sales ↔ Buyer)

Rounds that test two apps at once, at the point where one hands work to the
other. Each app keeps its own log too (`docs/audit/sales/LOG.md`; the Buyer's
goal and handover are in `docs/audit/buyer/`). Boards live on the Buyer canvas
beside the handover board (`docs/canvas/buyer/XR<N>*.dc.html`).

## Rounds

| Round | Aspect | Brief | Phase A | Phase B |
|---|---|---|---|---|
| 1 | The handoff (BUY-1 cancel asks, BUY-2 Today's counts, BUY-3 priceAsk, SAL-1 the Buyer's words in Sales, SAL-2 the goal bar) | 11 Nov 2026 | 11 Nov 2026: `ROUND-1.md`, boards `XR1Hold`, `XR1Today`, `XR1PriceComing`, `XR1SalesLines`, `XR1Goal` | waiting for Kevin's go-ahead |

## Deferred

- A quiet `supplier.found` push to the salesperson (handover.md §6). Sales re-reads every 45 s for now (round 1).
- The Buyer's word for a line Sales priced under the shop's price ("Price up"): round 1, question 2.
