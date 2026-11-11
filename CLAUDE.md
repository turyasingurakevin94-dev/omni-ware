# Who decides what — read first

Before changing any role app (sales, buyer, store, manager, accounts, the console) or any migration that touches `role_tasks`, read **`docs/decision-rights.md`**. It is binding and it overrides older comments that say "stays the owner's". **Nothing day-to-day waits for the owner**: the owner watches and sets policy, gets a log and never a queue. In short:
- the **Manager** decides prices (anything at or above cost), markups, credit, invoicing (plus an automatic invoice 24 hours after delivery), returns, voids, credit notes, short picks and stock write-offs, edits customers, watches debtors and sets goals;
- **Accounts** is the treasurer and runs everything finance (expenses, income, transfers, payroll, loans, assets, supplier and agent payments, the daily close);
- **Sourcing** finds items and suppliers and keeps the price list right.

Actions live in the phone apps. The Owner app holds only the owner's governance and the decision log. The desktop console is the intelligence centre (analytics, the AI manager, reports). Every handoff that waits on someone sends that person a push. Each build has a reserved migration number in that file; use yours. Role canvases draw the sample shop in `docs/canvas-cast.md`.

If a day-to-day job has no role in that file, ask the owner which role takes it; never default it to the owner. `test/decision-rights.test.js` fails if the migrations and that file disagree.

# What we are building

One wholesale hardware shop in Uganda, run from phones. An order's journey is **receive → buy → yard → deliver → get paid**, and each role app is one view of that journey (Sales takes it, Sourcing and the Buyer find and buy it, the Store packs and sends it, Accounts books the money, the Manager decides, the Owner watches). The people are in a yard in daylight, often on bad signal, some read little; every figure is real money. Great means **correct books, fast, obvious, and calm** — not more features.

# The rebuild (standing goal) — read `docs/rebuild.md`

A new front end is being built from a written spec (`docs/spec/`) on the **same database**, one role at a time; each new app replaces its old one only when it is clearly better. Before touching app code, read `docs/rebuild.md` and follow it:
- **Spec first.** Build to `docs/spec/`, not to the old app. A rule found in old code that is not in the spec goes into the spec first, with its source.
- **One database.** Never copy the backend. Database changes go through `supabase/migrations/` as now.
- **Small files.** No source file over 1,000 lines (aim 200–500). `test/file-size.test.js` guards this; its ceilings only go down.
- **One rule, one place.** Never copy a function between apps. If two copies disagree, list it as an open question for Kevin; never pick silently.
- **The old app is frozen while its new one is built**: urgent fixes only. Update the Log in `docs/rebuild.md` with each step.

# Keep it reasonable — coach Kevin

Kevin wants a great app, not a big one. Before building anything, and in plain words:
- **Say the smallest version** that solves the real problem, and build that unless Kevin picks bigger.
- **Name the cost**: how many screens, files, migrations and tests it adds, and what it makes harder later.
- **Push back, with one sentence of why**, when a request adds a second way to do something that already exists, a new screen where a state on an existing one would do, a setting nobody will change, or work for a role or case the shop does not have yet.
- **Prefer removing to adding.** When something can be deleted or merged, say so.
- **Finish before starting.** Point out open work (blocked sessions, red tests, unanswered decisions) before taking on new work.

# Permanent UI/UX Design Preference — Visual-First Communication

Remember and apply the following design preference across all my projects, interfaces, dashboards, pages, and future UI/UX work.

## Core Design Philosophy

I strongly prefer visual-first interfaces over text-heavy layouts.

I believe great interface design should communicate information visually rather than relying on paragraphs, excessive labels, explanations, or blocks of plain text.

Whenever you design, redesign, or improve an interface for me, prioritize communicating information through visual tools, thoughtful layouts, and intuitive interactions.

The goal is to make information immediately understandable at a glance.

## Design Principles to Always Follow

1. **Show, don't explain.** Whenever information can be communicated through a visual element instead of a paragraph, prefer the visual approach.
2. **Use visual communication tools.** Consider charts, graphs, progress indicators, timelines, status badges, relationship diagrams, icons, illustrations, interactive cards, visual comparisons, and other appropriate visual components.
3. **Design information, not just containers.** Don't simply place text inside cards and call it a dashboard. Think deeply about how the information itself can be represented visually.
4. **Prioritize glanceability.** A user should understand the state of a page, its important information, and available actions within seconds of opening it.
5. **Make layouts self-explanatory.** The interface should communicate its purpose through structure, hierarchy, visual relationships, and intuitive controls rather than instructional text.
6. **Use visual hierarchy intelligently.** Important information should naturally attract attention. Secondary information should remain accessible without competing with primary content.
7. **Make insights visible.** Whenever the system contains useful data, identify opportunities to transform that data into meaningful visual insights rather than simply displaying raw numbers or text.
8. **Keep designs professional and clean.** Visual-first does not mean adding unnecessary graphics, excessive colors, decorative icons, or clutter. Every visual element should serve a functional communication purpose.
9. **Reduce cognitive load.** Use visual grouping, spacing, alignment, progressive disclosure, and intuitive interactions to make complex information feel simple.
10. **Use text intentionally.** Text is still important for precision, accessibility, and clarity. However, avoid using lengthy explanations as a substitute for thoughtful interface design.

## Important Instruction

Whenever I ask you to improve a page, do not limit yourself to rearranging existing text or making cosmetic changes.

Think from first principles:

- What is the user trying to understand?
- What information matters most?
- What relationships exist between the information?
- What visual representation would communicate this information most effectively?
- How can the user understand and act on this information with the least possible effort?

Be creative in finding visual solutions, but always prioritize usability, functionality, simplicity, and professional execution.

My ideal interface is visually rich in meaningful information, yet visually simple in presentation.

Treat this as a persistent design requirement, not a one-time instruction. Apply it proactively to all future UI/UX decisions unless I explicitly request otherwise.

## Mockups

Always make mockups with **/design**. Do not hand-build design canvases.

## Buyer app goal

Before any work on the Buyer app (`buyer.html`), read **`docs/audit/buyer/GOAL.md`**: the standing goal is to redesign it in the Agent app's design language, with the fewest steps, in step with the Sales app. Update its Progress table as steps are done.

## Audit loop (Store app)

The Store app (`store.html`) is improved in rounds, one aspect per round:
1. Data integrity
2. Core workflows
3. Reliability
4. Search and navigation
5. Roles and privacy
6. Wording
7. Premium UI at 360px
8. Accessibility
9. Speed
10. Final regression

Cowork tests the live site and sends a "Round N fix brief". When one arrives, use the `omni-ware-round` skill:
- **Phase A**: design the changes on the canvas and write `docs/audit/<app>/ROUND-<N>.md`, then stop.
- **Phase B**: implement only after Kevin says "go ahead".

The Store history lives in `docs/audit/store/LOG.md`; each app gets its own folder. The words every app shares are in `docs/audit/GLOSSARY.md`.

## Design language (do not drift)

- **Canvas first.** The design canvas is the source of truth. Every UI change is drawn there before it is coded, at 360px, with all states (default, pressed, disabled, sending, success, error, offline, empty).
- **Reuse before inventing.** Use the existing tokens, components and icon set (24 box, round ends). A new component is added to the canvas first, with a reason.
- **Navy hero, warm light body.** One primary action per screen. A slide is used for irreversible yard actions. End-of-flow screens use one button with one label, the same on every screen.
- **Copy.** Short plain words for low-literacy users. One word per concept. The person's display name, never the email handle. Order numbers as #0550.
- **Layout.** Tap targets at least 44px. Nothing clipped at 360px. Nothing hidden under the floating play button. Consistent spacing between list rows.
