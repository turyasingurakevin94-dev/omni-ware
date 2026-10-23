---
name: omni-ware-round
description: Run one fix round of the Omni-ware Store audit loop. Use when Kevin pastes a "Round N fix brief" from Cowork, or says "start the round", "go ahead" or "implement round N".
---

# Omni-ware Store: fix round

Cowork tests the live app at https://omni-ware.vercel.app/store.html one aspect at a time. It sends a fix brief with issue IDs (DATA-03, UI-07…), severity (P1/P2/P3), steps to reproduce, expected behaviour and an acceptance check.

Your job is to fix that brief in two phases. **Never start Phase B without Kevin's explicit go-ahead.**

The goal across all rounds is a 10/10 app: correct books, reliable on bad signal, fast, easy for low-literacy yard staff, and premium at 360px. It must keep one design language throughout.

---

## Phase A: design and plan (no app code changes)

1. **Read before designing.**
   - Read the brief.
   - Read `docs/audit/LOG.md`, which lists rounds so far, the design decisions taken and the open issues.
   - Read the "Design language" section of CLAUDE.md.
   - Open the design canvas and look at the boards the brief touches (Today, TodayIn, TodayPack, BayFree, ReceiveOver, ReceiveExtraNew, the slides, and so on).

2. **Split the issues into two groups.**
   - **UI-affecting**: anything that changes what a person sees or taps. This includes layout, copy, a new state (empty, error, sending, offline), a new confirm sheet, a changed flow or a new control.
   - **Logic-only**: data, sync, search ranking, performance or security, with no visible change.

3. **Design every UI-affecting change on the canvas first.**
   - Update an existing board, or add a new board named after the screen and state (for example `ReturnTakeBackConfirm`, `ReportSending`).
   - Show the before and after side by side when it is a change to something that already exists.
   - Draw every state the change needs: default, pressed, disabled, sending, success, error, offline and empty.
   - Draw it at 360px wide. Make sure nothing is clipped and nothing sits under the floating play button.
   - Use only existing tokens, components, icons and patterns. If something truly new is needed, add it to the canvas as a reusable component, with a one-line reason.

4. **Write the round checklist** to `docs/audit/ROUND-<N>.md`, using the template below. Every issue ID in the brief must appear exactly once.

5. **Stop.** Reply to Kevin with:
   - the canvas boards you changed or added
   - the checklist, or a link to it
   - any question that blocks you (for example "should Take back undo instead of confirm?")

   Then wait. Do not edit `store.html` in Phase A.

### ROUND-<N>.md template

```
# Round <N>: <aspect>   (brief received <date>, build <last-modified>)

## Design changes (canvas)
| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |

## Code changes planned
| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |

## Not changing / pushed back
| ID | Why |

## Risks
- …

## Phase B result (filled after implementing)
| ID | Done? | What changed (function names) | How verified |
```

---

## Phase B: implement (only after Kevin says go ahead)

1. **Implement in severity order** (P1, then P2, then P3), and stay inside the agreed plan.
   - Make surgical, targeted edits. No rewrites, renames or reformatting of code you were not asked to touch.
   - Match the canvas exactly: same copy, spacing, tokens and states.
   - If the code needs something the canvas did not show, stop, add it to the canvas and tell Kevin before going on.

2. **Verify each item against its acceptance check.**
   - Test logic directly where you can.
   - For UI, check the screen at 360px and at desktop width.

3. **Fill in "Phase B result"** in ROUND-<N>.md.

4. **Append to `docs/audit/LOG.md`**: the round number, the aspect, the IDs fixed, the design decisions that are now part of the language, and anything deferred.

5. **Commit with message** `Round <N>: <aspect> — <IDs>`.

6. **Reply with a short summary**: what to deploy, and what Cowork should re-check first.

---

## Rules that hold in every round

- **One name per thing.** Use one word per concept everywhere: a line is a line, packed is packed. Use the person's display name, never the email handle. Use one order number format (#0550).
- **No false success.** Never show a success screen before the server confirms. Show "Sending…", then the result. On failure, keep the work and offer Retry, or save it to the outbox.
- **Protect against mistakes.** Destructive or irreversible actions get a confirm sheet or an Undo, and the list must not shift under the finger.
- **Nothing lost.** Drafts survive reload, as check-in drafts already do.
- **No prices or payments on the store phone.** This is enforced by role on the server, not just hidden in the UI.
- **Do not regress earlier rounds.** Before committing, re-run the acceptance checks for the previous round's IDs that touch the same functions.
