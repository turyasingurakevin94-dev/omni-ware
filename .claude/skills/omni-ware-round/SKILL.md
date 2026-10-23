---
name: omni-ware-round
description: Run one fix round of the Omni-ware audit loop for any Omni-ware app (store, owner, sales, buyer, manager). Use when Kevin pastes a "<App> round N fix brief" from Cowork, or says "start the round", "go ahead" or "implement round N".
---

# Omni-ware: fix round (any app)

Cowork tests one live Omni-ware app at a time, one aspect per round. It sends a fix brief that starts with the app name, for example "Owner round 2 fix brief". Each issue has an ID with the app's prefix, for example `OWN-DATA-03` or `STO-UI-07`. Each issue also has a severity (P1/P2/P3), steps to reproduce, the expected behaviour and an acceptance check.

Your job is to fix that brief in two phases. **Never start Phase B without Kevin's explicit go-ahead.**

The goal across all rounds and all apps is a 10/10 suite: correct books, reliable on bad signal, fast, easy for each role, and premium on its target screen. All apps share one design language and one glossary.

## Files

- **App file:** the app's own file (`store.html`, `owner.html`, …), named in the brief.
- **Round checklist:** `docs/audit/<app>/ROUND-<N>.md`, one per round.
- **App log:** `docs/audit/<app>/LOG.md`, which holds the rounds, design decisions and deferred items.
- **Shared glossary:** `docs/audit/GLOSSARY.md`, one term per concept, shared by every app. Read it first. Add to it, never fork it.
- **Design canvas:** the source of truth for every screen, in every app.

---

## Phase A: design and plan (no app code changes)

1. **Read before designing.**
   - Read the brief, the app's LOG.md, GLOSSARY.md and the "Design language" section of CLAUDE.md.
   - Open the canvas boards the brief touches.
   - For the owner/sales screens, check what the store app already does for the same concept and reuse it.

2. **Split the issues into two groups.**
   - **UI-affecting:** layout, copy, states, sheets, flows or controls.
   - **Logic-only:** data, sync, search, performance or security.

3. **Design every UI-affecting change on the canvas.**
   - Name each board `<App> · <Screen> · <State>`.
   - Show before and after.
   - Draw every state: default, pressed, disabled, sending, success, error, offline and empty.
   - Draw it at the app's target width:
     - 360px for phone apps: store, buyer, delivery.
     - 360px **and** 1280px for owner, sales and manager, if they are used on a laptop.
   - Use only existing tokens and components. Anything new becomes a reusable component on the canvas, with a reason.

4. **Write `docs/audit/<app>/ROUND-<N>.md`** using the template below. Every issue ID must appear exactly once.

5. **Stop.** Reply with:
   - the boards you changed or added
   - the checklist
   - any blocking questions (for example data clean-ups that need Kevin's approval)

   Do not edit app code in Phase A.

### ROUND-<N>.md template

```
# <App> · Round <N>: <aspect>   (brief received <date>, build <last-modified>)

## Design changes (canvas)
| ID | Board(s) | Before → After | States drawn | Tokens/components used | New component? |

## Code changes planned
| ID | Sev | File / function | Change (one line) | UI? | Acceptance check |

## Server / SQL changes planned
| ID | Migration / function / policy | Change | Test |

## Glossary changes
| Term | Meaning | Replaces |

## Not changing / pushed back
| ID | Why |

## Phase B result (filled after implementing)
| ID | Done? | What changed | How verified |
```

---

## Phase B: implement (only after Kevin says go ahead)

1. **Implement in severity order** (P1, then P2, then P3), staying inside the plan.
   - Make surgical edits only.
   - Match the canvas exactly.
   - If something the canvas didn't show is needed, stop, draw it, and tell Kevin.

2. **Add a test for server changes.** For any SQL, policy or RPC change, write an SQL test that runs as each affected role.

3. **Verify every acceptance check.** Check UI changes at the app's target widths.

4. **Record the round.**
   - Fill in "Phase B result".
   - Append to the app's LOG.md.
   - Update GLOSSARY.md.

5. **Commit** with message `<App> round <N>: <aspect> — <IDs>`.

6. **Reply** with what to deploy and what Cowork should re-check first.

---

## Rules for every app and every round

- **One name per thing.** Use one word per concept everywhere: a line is a line, packed is packed. Use the person's display name, never the email handle. Use one order number format (#0550). If the glossary has a term for it, use the term.
- **No false success.** Show "Sending…", then the result. On failure, keep the work and offer Retry, or save it to the outbox.
- **Protect against mistakes.** Destructive or irreversible actions get a confirm sheet or an Undo, and the list must not shift under the finger.
- **Nothing lost.** Drafts survive reload.
- **Money is shown only to roles allowed to see it.** This is enforced in SQL by role, never just hidden in the browser.
- **Do not regress earlier rounds or other apps.** Before committing, re-run the previous round's checks that touch the same functions, and the store app's checks if shared code or SQL changed.
