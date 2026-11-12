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

- [ ] every Manager page is on the canvas, and an independent reviewer scores it at or above the Agent app, from the rendered screens;
- [ ] the decisions board names a push and one agreed word for every hand-off, and the Manager pages use only those words;
- [ ] every push that doesn't exist yet is listed, ready for one migration after approval (using the Manager's reserved number in docs/decision-rights.md);
- [ ] every change the other apps need to reach the same words is listed for their sessions;
- [ ] each decision takes fewer taps than it does today (counted before and after);
- [ ] this progress table is up to date.

Then stop and ask Kevin to approve the canvas. No code, migrations or changes to the other apps until then. The build then follows docs/rebuild.md (spec first, `next/manager.html`, small files).

## Progress

| Step | State |
| --- | --- |
| 1. Agent app design language | reuse `docs/audit/buyer/agent-design-language.md` |
| 2. Decision hand-off map | not started |
| 3. The Manager's day from first principles | not started |
| 4–5. Pages on the new canvas | not started |
| 6. Scores | not started |

## Waiting on Kevin

- Nothing yet.
