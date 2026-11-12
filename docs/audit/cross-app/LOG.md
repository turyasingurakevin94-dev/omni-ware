# Cross-app audit log

Rounds that test a hand-off between apps (Sales → Manager → Buyer → Store …), one entry per round, newest last. Each round's checklist is `docs/audit/cross-app/ROUND-<N>.md`; its boards are in `docs/canvas/cross-app/`. Words shared with the other apps are in `docs/audit/GLOSSARY.md`.

## Round 1 · Sales → Manager → Buyer handoff (brief 11 Nov 2026) · SAL-1, -3, -4, -5, -6, X-1..4, BUY-2..5

**Phase A (11 Nov 2026):** causes found for all 13 items, 10 boards drawn (`docs/canvas/cross-app/`, ~60 phone states), plan in `ROUND-1.md`. No server change needed. Waiting on Kevin's go-ahead and four answers (#0608 as the test case, #0212's real units, the cancel tile, #0148 as a test record).

**Phase B (11 Nov 2026):** all 13 built, no migration. Kevin chose Ruth's Cancel on #0608 as the live test; the other three questions took the drawn defaults (cancels in Returns, test orders never bought, a stop = its lines). New: `src/core/lineword.ts` (one line word for Sales, Buyer, Manager), `src/core/scope.ts` (the outbox per thing), `src/apps/sales/today/NotSent.tsx`, `src/apps/sales/shell/placing.ts`; tests `cross-app-round1-core`, `cross-app-round1-manager`, and the outbox's. Re-check first on live: seed nothing — open Sales with the stuck #0586 ask: it shows Not sent with Remove and nothing else waits; Ruth cancels #0608 from Decide now; #0212's stop reads 184,000; #0148 shows as a test order.

