# Building the Buyer app from this canvas — brief for every tab builder

Kevin approved the canvas "Buyer — Agent language" and asked for it built. It is built the way the
new Sales app was built (docs/rebuild.md, docs/spec/07-stack.md): Preact + signals, TypeScript, on the
shared parts in `src/ui/` and the Buyer core in `src/core/buyer/`. The old `buyer.html` stays as it is.

## Read first
1. This folder: your board(s) `<Tab>.dc.html` (the design, as code) and `<Tab>.png` (how it renders, 2040×1720:
   row 1 = the phones, row 2 = the states). `BRIEF.md` = the words and the shared sample data. `Main.dc.html` = the handover words.
2. `src/ui/README.md` — the shared parts. **Compose screens from them; never hand-roll a variant.** Read the files of
   the parts you use. Sales screens in `src/apps/sales/` show how they are composed (e.g. `today/Today.tsx`, `orders/`).
3. `src/core/buyer/types.ts`, `rules.ts`, `source.ts` — the shapes, the rules (use them; never work a rule out again in a
   screen), and the writes. `src/core/buyer/demo/` — the sample shop (`?demo`, `&state=midday|trip|empty`).
4. `src/apps/buyer/shell/` — `nav.ts` (stack: `nav.push(id, params)`, `nav.back()`, `nav.home()`, `nav.tab()`),
   `store.ts` (signals `books`, `now`, `online`, `kept`, `me`; writes: `await act('ask', supplierId, 'whatsapp')` …
   it goes through the outbox and re-reads), `App.tsx` (the bar: Today · red + (opens 'trip') · Suppliers).
5. `docs/spec/04-screens-buyer-data.md` — what the real books do (for words and rules; the data layer is not yours).

## Your folder and screen ids
Only edit your own folder `src/apps/buyer/<tab>/` (create files there; `index.tsx` exports `screens`). Do not edit
`src/core/buyer/*`, `src/ui/*`, the shell or another tab. If you need a new pure rule, put it in your folder
(`<tab>/rules.ts`) and say so in your reply; if you need a write the source does not have, say so — do not fake it.

| Tab | Ids |
|---|---|
| today | `today` |
| orders | `orders` (params `filter`), `orders/order` (`id`), `orders/switch` (`id`, `key`); export `openNotFound(orderId: number, key: string): void` from `orders/NotFound.tsx` (the sheet: other supplier · client waits · remove by slide) |
| replies | `replies`, `replies/price` (`supplier`) — the "No" path uses `openNotFound` from `../orders/NotFound.tsx` (it may not exist when you start: import it anyway, the Orders builder writes it with that exact signature) |
| trip | `trip` (Plan when no trip is on, On the trip when it is), `trip/handin`, `trip/done` |
| suppliers | `suppliers`, `suppliers/one` (`id`), `suppliers/fix` (`id`) |

Today opens Orders/Replies/Trip by these ids (`nav.push('replies')` etc.).

## Rules
- At 360 px wide, all states from your board: default, pressed, disabled, sending (act's promise), success (toast or
  end-of-flow `EndOfFlow` "Back to Today"), error (the refused reason, Try again), offline (`online` false / `kept`:
  `Notice kind="offline"`), empty (`EmptyState`). One red thing per screen. Tap targets ≥ 44 px. No text under 11 px.
  Money via `Money`/`fig` (Plex Mono). Words exactly the shared words: To ask · Asked · Found · Not found · Price up ·
  Ruth decides · Client waits · Removed · On the trip · Short · got N of M · Packing · Hand in (`rules.ts` WORD).
  People by display name from `books.team` (never emails). Order numbers `orderNo(id)` from `src/core/names.ts` → #0550.
- Every screen shows where its work came from in Sales ("From Grace · #0550") and what Sales gets back ("Grace sees: Found").
- Files 200–500 lines, never over 1,000. CSS beside the file, classes prefixed `ow-b-<tab>-…` (no clash with Sales).
- No `any`. `npx tsc -p tsconfig.json --noEmit` must pass.

## Check your work (you may render; do not publish anything)
```
npm run build:buyer          # (= node tools/build-app.js buyer) writes next/buyer.html
node /tmp/claude-0/-home-user-omni-ware/8aee87e2-dae9-53a6-b53f-76cee61ff937/scratchpad/sweep/buyer-shot.js '?demo&state=midday' out.png
```
The shot script opens `next/buyer.html` at 360×780 and prints page errors; to reach a deeper screen, copy it and add
clicks (Playwright). Compare with your board's PNG; fix until it matches. Then drive each action on the demo and see
the books change. Do not commit; reply (under 200 words) with the files you wrote, what works, any rule/write you
needed, and anything you could not match.
