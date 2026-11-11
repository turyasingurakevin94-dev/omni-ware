# Brief for every Buyer design agent

You draw ONE tab of the Buyer app (buyer.html) on a design canvas, in the
**Agent app's** design language (agent.html, live). Design only, no app code.

## Read first (in this order)
1. `/home/user/omni-ware/docs/audit/buyer/agent-design-language.md` — THE design language. Follow it exactly.
2. `/home/user/omni-ware/agent.html` — `:root` tokens near line 236 and the `.ax-*` CSS rules after it (hero, ax-move tiles, ax-nk Needs-you rows, ax-nx, ax-tabbar + ax-plus FAB, ax-dock, ax-seg, ax-slide, ax-pill, ax-empty). Copy the real values. Do NOT use anything under `.design/` (out of date).
3. `/home/user/omni-ware/docs/audit/buyer/flow.md` — the new flow (26 taps → 8). Your screens MUST realise it.
4. `/home/user/omni-ware/docs/audit/buyer/handover.md` — Sales ↔ Buyer words and pushes.
5. Your tab's code in `/home/user/omni-ware/buyer.html` (grep for it) — only to know what the job contains (every state, every exception). Do not copy its look.
6. `/home/user/omni-ware/docs/canvas-cast.md` — the sample shop people, orders and suppliers. Use only those names and numbers.
7. `/home/user/omni-ware/docs/decision-rights.md` — who decides (Ruth = Manager decides prices; Accounts gives cash; Moses = Sourcing). Do not move a decision.

## The app shape (fixed, all agents)
- Tab bar exactly like the Agent's `.ax-tabbar`: **Today · red + FAB · Suppliers**. The + FAB starts/opens the trip.
- Today's hero = navy, flat, radius 0 0 28 28, greeting "Good morning, Denis" + date + "● Live", overline "TO BUY TODAY ›", one mono figure (UGX to spend on found lines), a 6px bar "2 of 3 suppliers found".
- Today's **On the move** tiles (4): **To ask** (dashed) · **Asked** · **Found** · **On the trip**. A red need badge when it waits on Denis. Orders and Replies are the pages behind these tiles (not tabs).
- Rows act in place: a navy pill on the row ("Ask", "Yes · same"). One red thing per screen. A slide (ax-slide in the navy ax-dock) only for irreversible moves: send the cash ask, hand in, remove a line.
- Every screen shows **where the work came from Sales** (a small "From Grace · #0550" chip: avatar dot + mono order number) and **what Sales gets back** (a "Grace sees: Found" line, with a bell icon when a push goes).

## Shared words (both apps, never vary)
To ask · Asked · 10:40 · Found · Not found · Price up · Ruth decides · Switched · Removed · Client waits · Buying · On the trip · Short · got 5 of 6 · Packing · Hand in.
Stage names: Checking · Buying · Packing · On the road · Delivered. "Trip", never "round". Order numbers as #0550. Display names (Grace, Denis, Ruth, Moses, Esther — the Buyer is Denis Okello; Kato Construction is a customer), never emails. Money in IBM Plex Mono, "UGX" small.

## Your artboard file(s)
Write each file with the Write tool at:
`/tmp/claude-0/-home-user-omni-ware/8aee87e2-dae9-53a6-b53f-76cee61ff937/scratchpad/buyer-agent/project/<File>.dc.html`
Write ONLY your own file(s). Do not publish, do not render, do not screenshot, do not open a browser, do not read your file back to check. Do not touch the repo.

Board: fixed root **2040 × 1720 px**, background `#F7F5F2`, padding 40, Figtree.
- Top strip (≈64px): tab title 28/800 · chips "From Sales: …" (navy) and "Back to Sales: …" (red-soft) naming the hand-offs this tab touches (handover.md row numbers).
- Row 1: up to **4 phone screens 360 × 780** (radius 32, 1px #E6E3DD, overflow hidden, background #F7F5F2) — the default state of each page in the tab, gap 40. To their right a **score panel 360 wide** (see Scores).
- Row 2 (≈760px): the **states** — default, pressed, disabled, sending, success, error, offline, empty — as 8 cards in a 4×2 grid, each a cropped 360-wide piece of the screen showing just the part that changes, with its state name as a small caps label above. Every state must be drawn, not described.
- Under each phone: one line in mono 12 #5F6980 — taps for the job on this page ("1 tap · Ask on the row").

## File format (must follow, each fails silently)
- Skeleton:
```
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>…</title>
<script src="./support.js"></script></head><body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&amp;family=IBM+Plex+Mono:wght@500;600&amp;display=swap">
<style>body{margin:0} a{color:#16203C}a:hover{color:#C93A30}</style>
</helmet>
<div style="width: 2040px; height: 1720px; …"> … </div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":2040,"height":1720}}'>
class Component extends DCLogic { renderVals() { return { … }; } }
</script></body></html>
```
- Keep the `./support.js` line exactly. Close every element, quote every attribute. Inline `style="…"` for everything; `<helmet><style>` only for basics.
- `{{hole}}` is a dotted lookup into `renderVals()` only — never an expression. Repeats: `<sc-for list="{{rows}}" as="r" hint-placeholder-count="3">…{{r.name}}…</sc-for>`. Branches: `<sc-if value="{{x}}" hint-placeholder-val="{{ true }}">`. Per-item colours: precompute in renderVals.
- Copy is literal markup unless it is genuinely repeated data. No tweak props except `$preview`.
- Icons: inline stroke SVG, 24 viewBox, stroke-width 2, round caps/joins, `aria-hidden="true"`. No emoji. No `<iframe>`, no network except the font link.
- Real `<button>` for buttons (aria-label on icon-only), tap targets ≥ 44px. Text contrast ≥ 4.5:1 (#6B7480 only on white).
- No fake phone status bar. No explanation paragraphs inside screens: show, don't tell.

## Scores (show them; revise until you meet them)
Score panel (360 wide, white card, radius 16): for each page in your tab, 5 rows —
**Consistency with the Agent app · Steps to finish · Glanceability · Polish · In step with Sales** — each with three mono numbers out of 10 and a bar: *Buyer today* (grey) · *Agent app* (navy, the baseline below) · *New* (red if below Agent, green if ≥). Then the average. Score honestly against the baseline; if any New is below the Agent number, change the design until it is not, then score again. Under it, a 2-line "Agent match" naming the Agent screen it mirrors.

Agent baselines (Consistency, Steps, Glance, Polish, Sales):
- Today ↔ Agent Today: 9 9 8 9 8
- Orders ↔ Agent Clients: 9 8 8 8 8
- Replies ↔ Agent Needs-you: 9 9 8 8 8
- Trip Plan ↔ Agent basket + dock: 9 9 8 9 8
- On the trip ↔ Agent basket lines: 9 8 8 9 8
- Hand-in ↔ Agent send + done: 9 9 9 9 8
- Suppliers ↔ Agent Clients: 9 8 8 8 8

## When done
Reply with: the file(s) written, the final New scores per page, the tap count per job, and any change Sales would need that is not already in handover.md §5. Keep the reply under 200 words.

## Shared data — every board uses exactly these (round 2)
Sample day: Saturday 17 October 2026, Mukasa Hardware, Kampala.

People (avatar = two letters on its tint, everywhere):
| Who | Role | Initials | Tint / ink |
|---|---|---|---|
| Denis Okello | Buyer (you) | DO | #16203C / #FFFFFF |
| Grace Akello | Sales | GA | #DCEAF8 / #1A5A8A |
| Brian Ouma | Sales | BO | #DDF1EE / #0E5E57 |
| Faith Nambi | Sales | FN | #F6E4F1 / #7A3268 |
| Ruth Nakato | Manager | RN | #E4E6FA / #3A3F9B |
| Esther Auma | Accounts | EA | #E8EBF0 / #3D4A5C |
| Moses Lubega | Sourcing | ML | #FDEEE1 / #7A4A02 |
| Musa Kiggundu | Store | MK | #E4F4EA / #0F6B43 |

Items (one name each): "Iron sheet G28" (sht) · "Ridge cap 3 m" (pcs) · "Cement 50 kg" (bag) · "Y12 rebar 12 m" (pcs) · "PVC pipe 4 in" (pcs) · "Timber 2×4" (pcs).

Orders:
| Order | Client | Seller | Line | Supplier | Qty × cost | Line total | State |
|---|---|---|---|---|---|---|---|
| #0550 | Kato Construction | Grace | Iron sheet G28 | Namanve Sheets | 40 × 38,000 | 1,520,000 | Found |
| #0550 | Kato Construction | Grace | Cement 50 kg | Nakawa Cement Depot | 20 × 34,000 | 680,000 | Found |
| #0552 | Mukono Roofing | Faith | Iron sheet G28 | Namanve Sheets | 20 × 38,000 | 760,000 | Found |
| #0552 | Mukono Roofing | Faith | Ridge cap 3 m | Namanve Sheets | 10 × 24,000 → 27,000 (sells 26,000) | 270,000 | Price up · Ruth decides |
| #0553 | Ggaba Stores | Grace | Y12 rebar 12 m | Kiseka Steel | 30 × 42,000 | 1,260,000 | Not found → Katwe Fabricators 43,500 (other supplier) · Client waits · Remove |
| #0553 | Ggaba Stores | Grace | PVC pipe 4 in | Owino Plumbing | 12 × 45,000 | 540,000 | Found |
| #0554 | Lubowa Builders | Brian | Timber 2×4 | Ndeeba Timber Works | 50 × 9,000 | 450,000 | Asked · 10:40 (no reply yet) |
| #0551 | Nansana Hardware | Brian | — | — | — | — | Packing |

Asks: Namanve Sheets and Nakawa Cement Depot asked 09:05; Kiseka Steel and Owino Plumbing 09:20; Ndeeba Timber Works 10:40 (late after 30 min → "Ask again").
Today hero: "To buy today" 3,500,000 (the Found lines); bar "3 of 5 suppliers found".
Trip (Kampala, one trip, 3 stops in this order): Nakawa Cement Depot 680,000 · Owino Plumbing 540,000 · Namanve Sheets 2,280,000 (#0550 1,520,000 + #0552 760,000). Cash ask 3,500,000 → "Esther told · 11:30", given 11:45. Held off the trip: Ridge cap #0552 (Ruth decides), Timber #0554 (Asked).
On the trip: Nakawa paid 650,000 (30,000 less); Owino 540,000 got it all; Namanve: #0550 Iron sheet G28 **Short · got 36 of 40** (152,000 less) → paid 2,128,000. Paid 3,318,000 · cash back 182,000.
Hand in 14:40: orders #0550, #0552, #0553 · "Handed in · Musa counts it in" (push trip.back → Musa); each order shows **Packing** only after Musa's count. Grace gets trip.short for #0550.
Supplier stats (Suppliers tab): Namanve Sheets found 9 of 10 · replies in 12 min; Nakawa 8 of 10 · 20 min; Owino 7 of 10 · 35 min; Kiseka 6 of 10 · 25 min; Katwe 8 of 10 · 40 min; Ndeeba 5 of 10 · 1 h. Price list: Iron sheet G28 38,000 (Namanve); Y12 rebar 12 m 42,000 (Kiseka), 43,500 (Katwe).

Style fixes for all: times in mono and capitalised like "Asked · 09:05"; "Try again" on every error; no raw push names (price.waits) on a phone — the bell + "Ruth sees it" is enough; no rings; every tap target ≥ 44px; amber only from tokens (#95530C / #FDEEE1 / #7A4A02).

## Round 3 additions to the shared data
Answer times (a chip shows the ANSWER time, never the ask time): Nakawa Cement Depot Found · 09:25 · Namanve Sheets Found · 09:31 (and its Ridge cap line Price up · 09:31 — Namanve's supplier chip reads "Price up" while Ruth decides) · Kiseka Steel Not found · 09:35 · Owino Plumbing Found · 09:50 · Katwe Fabricators asked again 11:10 (the re-ask for #0553).
Katwe Y12 rebar 12 m: on the list 41,000 (34 days old) → Katwe says 43,500 today.
Suppliers are not people: supplier avatars/tiles use the neutral #F1EEE8 with #1C2233 initials; the people tints are only for people. No text under 11px anywhere.
