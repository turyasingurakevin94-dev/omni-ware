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

## Done when

- Every Buyer page is on the new canvas and scores at or above the Agent app's matching screen.
- The handover board shows every hand-off with a push and the same words on both sides.
- The end-to-end flow needs fewer steps than today.
- Design only: no code until Kevin approves the canvas.
- Any change the Sales app needs is listed separately for Sales, not built here.

## Progress

| Step | State |
| --- | --- |
| 1. Agent app design language | not started |
| 2. Sales ↔ Buyer handover map | not started |
| 3. Buying flow from first principles | not started |
| 4–5. Pages on the new canvas | not started |
| 6. Scores | not started |
