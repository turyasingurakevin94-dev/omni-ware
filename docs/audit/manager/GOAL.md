# Manager app goal — redesign in the Agent app's language, in step with the apps it decides for

Set by Kevin on 12 Nov 2026. Every session that works on the Manager app (manager.html) reads this first and works toward it.

## Goal

Redesign the Manager app (manager.html) in the Agent app's design language (agent.html), rethink the Manager's decisions from first principles, and keep it in step with the apps that send it work: Sales, the Buyer, the Store and Accounts.

## Why

Someone who already knows the Agent app should be able to pick up the Manager app with no training. The Agent app shows rather than tells, gets each job done in the fewest steps, and looks polished and premium. The Manager app should feel like the same product. The Manager is where the other apps' questions land (a price under the shop's, credit, a void, a return, a short pick, a write-off). Every one of those is someone waiting, so each decision must be quick to make, and its answer must reach the person who asked, in the same words they used.

## How

1. **Start from the Agent app's design language.** It is already written down in `docs/audit/buyer/agent-design-language.md`. Use that one reference and don't write a second copy. If the Manager app needs something it doesn't cover, add it to that file.
2. **Map every hand-off into and out of the Manager.** Read docs/decision-rights.md and the apps on the other side of each decision (sales.html, buyer.html, store.html, accounts.html). For each decision, write down:
   - who asks, and what they send;
   - what the Manager decides, and the choices they have;
   - who is told, by which push, in which words.

   Then list every place the apps disagree: a different word for the same thing, a state one app shows and the other doesn't, a hand-off with no push, a decision asked twice. The redesign must close those gaps. Every app uses the same words (docs/audit/GLOSSARY.md), and every hand-off that waits on someone sends that person a push. Build on `docs/audit/cross-app/ROUND-1.md` (Sales → Manager → Buyer) rather than redoing it.
3. **Rethink the Manager's day before the screens.** The Manager's day is a queue of decisions plus watching the shop: debtors, goals, stuck orders, the team. For every step, ask whether it needs to exist, whether it can merge with another, and whether the app can do it for the Manager (for example, the automatic invoice 24 hours after delivery). Aim for the fewest taps per decision: see what is asked, see the evidence, then answer. Keep docs/decision-rights.md as it is: nothing waits on the owner.
4. **One design agent per Manager tab: Today, Orders, Money and Team.** Each agent:
   - redesigns every element that has an Agent app equivalent the way the Agent app would build it;
   - designs anything only the Manager app has with /design, in the same language;
   - shows on each decision who asked and what they get back;
   - draws every screen at 360px with all its states (default, pressed, disabled, sending, success, error, offline, empty).
5. **Work page by page and put the designs on ONE new canvas.** Add a board that maps every decision as one flow: who asks, the push, the Manager's choices, and the answer's push and words.
6. **Score every page** against the matching Agent app screen on five measures: visual consistency, taps per decision, glanceability, polish, and how well it stays in step with the asking app. Keep revising until each page scores as good as the Agent app or better, and show the scores beside each page.

## Focus

Decisions, from the ask arriving to the answer reaching the person who asked: the fewest taps, and nothing lost or said differently between the apps.

## Done when

- [x] every Manager page is on the canvas, and an independent reviewer scores it at or above the Agent app, from the rendered screens (round 4: 36 pages, 8.66 vs 8.37, 0 below on average or on any measure);
- [x] the decisions board names a push and one agreed word for every hand-off (33 of 33, `Main`), and the Manager pages use only those words (handover.md §3, checked by the reviewer and by script: `docs/canvas/manager/review/words-check.md`);
- [x] every push that doesn't exist yet is listed, ready for one migration after approval (handover.md §4: 14 kinds + push actions; **0184**, reserved);
- [x] every change the other apps need to reach the same words is listed for their sessions (handover.md §5: Sales 10 · Buyer 5 · Store 3 · Accounts 3; §6 the Android shell);
- [x] each decision takes fewer taps than it does today (counted before and after, day.md): from the app all 30 drop, 145 → 68; from the push 59 → 24 (write-off, credit note and void stay a 2-tap slide from the push, as money moves that can't be undone; they drop from the app); the next decision 2 → 1; the 3 not possible today become possible;
- [x] this progress table is up to date.

Then stop and ask Kevin to approve the canvas. No code, migrations or changes to the other apps until then. The build then follows docs/rebuild.md (spec first, `next/manager.html`, small files).

## Progress

| Step | State |
| --- | --- |
| 1. Agent app design language | reuse `docs/audit/buyer/agent-design-language.md` |
| 2. Decision hand-off map | done · `handover.md`: 33 decisions, 38 mismatches, 14 new push kinds + push actions (migration 0184, reserved), other apps: Sales 10 · Buyer 5 · Store 3 · Accounts 3, native shell §6 |
| 3. The Manager's day from first principles | done · `day.md`: from the app 145 → 68 taps (all 30 drop), from the push 59 → 24 (17 of 20 drop; write-off, credit note, void stay a slide at 2), next decision 2 → 1 |
| 4–5. Pages on the new canvas | done · [canvas "Manager — Agent language"](https://claude.ai/artifact/TgJSJfvHJskZw293Vzd2qW): 11 boards — decisions board (Main), the day (Flow), Scores, the tabs Today · Orders · Money · Team, the Decide sheets (prices, after the order, stock, credit); every screen at 360 px with all 8 states; sources `docs/canvas/manager/` (generators in `tools/`) |
| 6. Scores | done · independent review, 4 rounds from the rendered screens (`docs/canvas/manager/review/`): 7.94 → 8.44 → 8.62 → **8.66** vs the Agent app's 8.37; 28 → 8 → 0 → 0 pages below; Scores board |

## Build (Kevin's build goal, 12 Nov 2026)

| Step | State |
| --- | --- |
| B1. Spec | written · `docs/spec/04-screens-manager.md` (routes, the queue, the one Decide sheet, D-1…D-33, rules, Q1–Q7 for Kevin) and `04-screens-manager-data.md` (30 reads, 45 writes, §5 Q1–Q16) |
| B2. Core | `src/core/manager/`: types, words, queue, price, credit, watch, errors, source; the demo of BRIEF.md (09:40 and the later cards by moment) |
| B3. Pages not drawn | AD01–AD05 drawn (`Added`, `Added2`), reviewed at or above the Agent app (`review/added-1.md`, round 2) |
| B4. Shell | `src/apps/manager/shell/` on the shared stack (`src/ui/stack.ts`), Undo (`src/core/held.ts`), error words (`src/core/notdone.ts`), sign-in (`src/ui/Gate.tsx`); `next/manager.html` builds |
| B5. Tabs and Decide kinds | built: Today · Orders (+ Denis's restock list) · Money (+ limit, look alike, old books) · Team · the Decide sheet with all 19 kinds · All decided · sign in, could not reach, You; e2e 8 of 8 flows (`test/e2e/manager-flows.cjs`) |
| B6. Real books | built: `src/core/manager/supabase/` (every read, R30 store_asks included; every write as data §2's new-app column); `test/manager-supabase.test.js` 92 checks on a fake client; not yet driven on a test shop |
| B7. Migration 0184 | written and tested on Postgres (`test/manager-pushes-db.test.js`, 127 checks with OW_PG): the agreed words on every push, the new pushes, push actions + `answer_from_push`; `customer_asks` kept apart (`0184b`, Kevin's yes first). The other apps' lists sent to the Sales, Buyer, Store and Accounts sessions (12 Nov). The Android shell (handover §6) waits: the web app first (spec Q2) |
| B8. Proof | e2e done on the demo (every decision, offline, double tap, refusal, Someone else, Undo); the independent review of the built app against the boards in progress (`review/build-1-*.md`) |
| B9. Switch | when every page scores at or above its board and Kevin says switch |

## Waiting on Kevin

- ~~Approve the canvas before any code, migration or change to another app.~~ **Approved** by Kevin on 12 Nov 2026: "implement this design as it is" (he asked for the build goal; a page not drawn is drawn on the canvas first, in the Agent language, then built). Confirmed in plain words the same day: "Yes, I approve it".
- P-12: a credit-limit ask needs a new `customer_asks` table (handover.md §4).
- Three decisions stay 2 taps from the push (write-off, credit note, void): a money move that can't be undone is always a slide, and a notification can't hold one. They drop from the app.
- Push answers from the notification need a new Android shell build (handover.md §6).
- After approval: migration 0184, then the build per docs/rebuild.md (spec first, `next/manager.html`, small files); the other apps' lists (handover.md §5) go to their sessions.
