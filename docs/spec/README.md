# Omni-ware — the spec

What the system does, pulled from the system itself (migrations, server
functions, app code, tests, audit logs, canvases), so the new front end
can be built cleanly without losing a rule the shop depends on.

**How to use it**
- Building anything new: read the chapter first; build to it, not to the old app.
- A chapter says what IS, with a source for every rule. Where the old apps
  disagree, the chapter lists it under *Open questions*; Kevin answers, and the
  answer replaces the question.
- Found a rule in old code that is not here? Add it, with its source. The spec
  grows; the old apps do not.

## Chapters

| # | Chapter | What it answers | Status |
|---|---|---|---|
| 01 | [The order's journey](01-order-journey.md) | The stages an order goes through, who moves it, what each step writes and who gets a push | draft — 14 questions for Kevin |
| 02 | [Money](02-money.md) | Every money rule: totals, prices, cost, debt, payments, the treasurer's books | draft — 17 questions for Kevin |
| 03 | Roles | Who does what. **[`docs/decision-rights.md`](../decision-rights.md) is that chapter** and stays binding; this one only adds each role's daily jobs | to do |
| 04 | Screens | Every screen per role, from the approved canvases | to do |
| 05 | Data | Tables, what is in an order's `payload`, who can read and write what | to do |
| 06 | Offline, sync and pushes | Bad signal, the queue, the phone's copy of the books, every push | to do |
| 07 | The stack | Tools for the new front end — **Kevin approves** | to do |
| 08 | What we leave behind | Features the new apps do not carry over — **Kevin decides each** | to do |

Words: [`docs/audit/GLOSSARY.md`](../audit/GLOSSARY.md) — one word per idea, shared by every app.

## Rules for the spec itself

- Plain short words. Tables and diagrams before paragraphs.
- Every rule names its source (`file:line` or a function / migration) and the test that proves it, or says *no test*.
- No chapter over ~500 lines. Split a chapter before it gets long.
- Describe the shop as it is (one business, two shops in the picker, a few dozen staff). Do not plan for scale nobody has.
