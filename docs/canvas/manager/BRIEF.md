# Brief for every Manager design agent

You draw ONE tab (or one board) of the Manager app (manager.html) on a design canvas, in the
**Agent app's** design language (agent.html, live). Design only, no app code. The goal is
`docs/audit/manager/GOAL.md`: read it first.

## Read first (in this order)
1. `docs/audit/manager/GOAL.md` — the goal and what "done" means.
2. `docs/audit/buyer/agent-design-language.md` — THE design language. Follow it exactly. If the Manager
   needs a part it does not cover, draw it in the same language and say so in your reply (the part gets
   added to that file; never a second copy).
3. `agent.html` — `:root` tokens near line 236 and the `.ax-*` rules after it. Copy real values. Nothing under `.design/`.
4. `docs/audit/manager/day.md` — the Manager's day from first principles and the new path for each
   decision (taps before → after). Your screens MUST realise it.
5. `docs/audit/manager/handover.md` — every decision: who asks, what they send, the push, the choices,
   who is told and in which words (§3 = the agreed words). Use ONLY those words.
6. `docs/canvas/buyer/Today.dc.html` and `docs/canvas/buyer/Main.dc.html` — how an approved board in this
   language is built (structure, parts, the score panel). `docs/canvas/buyer/Today.png` shows it rendered.
7. Your tab's code in `manager.html` — only to know what the job contains (every state, every exception).
   Do not copy its look.
8. `docs/canvas-cast.md` and the shared data below — the only names and numbers you may use.
9. `docs/decision-rights.md` — who decides. Do not move a decision. Nothing waits on the owner.

## The app shape (fixed, all agents)
- Tab bar like the Agent's `.ax-tabbar`, widened for four tabs: **Today · Orders · red + FAB · Money · Team**
  (grid `1fr 1fr 96px 1fr 1fr`). The red + FAB is **Decide**: it opens the oldest waiting decision
  (navy count badge = decisions waiting); after an answer it moves to the next one.
- Today's hero: flat navy, radius 0 0 28 28, "Good morning, Ruth" + "Sat 17 Oct" + "● Live", overline
  "SALES INVOICED · OCTOBER ›", one mono figure, a 6px bar to the shop's goal with "x% of 105M · 14 days left".
- **On the move** tiles (4): Checking · Buying · Packing · On the road (the order stages) — a red need badge
  when an order there waits on Ruth, face dots of who holds them.
- **Needs you** rows: each decision is a row with its asker's avatar, the ask in a few words, the evidence in
  mono 11, the age, and the answer **on the row** where one tap can answer it (navy pill); otherwise the row opens
  the decision sheet. One red thing per screen.
- Every decision shows **who asked** ("From Grace · #0555", avatar dot + mono number) and **what they get back**
  ("Grace sees: Approved", bell icon when a push goes).
- A slide (`.ax-slide` in the navy `.ax-dock`) only for irreversible money moves: void/cancel with money,
  write-off, credit note, refund. Everything else is a tap (with Undo 10 s per the glossary).

## Shared words
Use `handover.md` §3 and `docs/audit/GLOSSARY.md`. Stage names: Checking · Buying · Packing · On the road ·
Delivered. Order numbers #0550. People by display name. Money in IBM Plex Mono with "UGX" small. Times like
"Asked · 09:05". "Try again" on every error. No push names on a phone (the bell + "Grace sees it").

## Your artboard file(s)
Write each file with the Write tool at `/home/user/omni-ware/docs/canvas/manager/<File>.dc.html`. Write ONLY
your own file(s). Do not publish. Do not commit.

Board: fixed root **2040 × 1720 px**, background `#F7F5F2`, padding 40, Figtree.
- Top strip (≈64px): tab title 28/800 · chips "Asks in: …" (navy) and "Answers out: …" (red-soft) naming the
  decisions this tab touches (handover.md D-numbers).
- Row 1: up to **4 phone screens 360 × 780** (radius 32, 1px #E6E3DD, overflow hidden, background #F7F5F2) —
  the default state of each page in the tab, gap 40. To their right a **score panel 360 wide**.
- Row 2 (≈760px): the **states** — default, pressed, disabled, sending, success, error, offline, empty — as 8
  cards in a 4×2 grid, each a cropped 360-wide piece of the screen showing the part that changes, its state
  name as a small caps label above. Every state drawn, not described.
- Under each phone: one line in mono 12 #5F6980 — taps for the job on this page, before → after
  ("Approve a price: 6 → 2 taps").

## File format (must follow; each mistake fails silently)
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
class Component extends DCLogic { renderVals() { return {}; } }
</script></body></html>
```
- **Literal markup only** (no `{{holes}}`, no sc-for/sc-if): the board is rendered by stripping the script.
- Keep the `./support.js` line exactly. Close every element, quote every attribute. Inline `style="…"`.
- Icons: inline stroke SVG, 24 viewBox, stroke-width 2, round caps/joins, `aria-hidden="true"`. No emoji.
- Real `<button>` for buttons (aria-label on icon-only), tap targets ≥ 44px. No text under 11px. Contrast ≥ 4.5:1.
- No fake phone status bar. No explanation paragraphs inside screens.
- Render and look at your own board before you reply:
  `cd /home/user/omni-ware/docs/canvas/manager && NODE_PATH=$(npm root -g) node ../sales-agent/tools/shot.cjs png <File>.dc.html`
  then Read `png/<File>.png`. Fix clipping, overlap, cut-off text, and anything that does not add up.

## Scores (show them; revise until you meet them)
Score panel (360 wide, white card, radius 16): per page, 5 rows — **Consistency with the Agent app · Taps per
decision · Glanceability · Polish · In step with the asking app** — each with three mono numbers out of 10 and a
bar: *Manager today* (grey) · *Agent app* (navy, the baseline) · *New* (red if below Agent, green if ≥). Then
the average. Score honestly; if any New is below the Agent number, change the design until it is not. Under it,
"Agent match" naming the Agent screen it mirrors.

Agent baselines (Consistency, Taps, Glance, Polish, In step):
- Today ↔ Agent Today: 9 9 8 9 8
- Orders ↔ Agent Clients: 9 8 8 8 8
- Decision sheets ↔ Agent Needs-you + basket dock: 9 9 8 8 8
- Money ↔ Agent Money: 9 8 8 9 8
- Team ↔ Agent Clients: 9 8 8 8 8

## Shared data — every board uses exactly these
Sample day: **Saturday 17 October 2026, 09:40**, Mukasa Hardware, Kampala. Ruth Nakato is the Manager (you).

People (avatar = two letters on its tint, everywhere; tints are for people only):
| Who | Role | Initials | Tint / ink |
|---|---|---|---|
| Ruth Nakato | Manager (you) | RN | #16203C / #FFFFFF |
| Grace Akello | Sales | GA | #DCEAF8 / #1A5A8A |
| Brian Ouma | Sales | BO | #DDF1EE / #0E5E57 |
| Faith Nambi | Sales | FN | #F6E4F1 / #7A3268 |
| Denis Okello | Buyer | DO | #E4E6FA / #3A3F9B |
| Musa Kiggundu | Store | MK | #E4F4EA / #0F6B43 |
| Joy Namata | Store | JN | #FDEEE1 / #7A4A02 |
| Esther Auma | Accounts | EA | #E8EBF0 / #3D4A5C |
| Moses Lubega | Sourcing | ML | #F1EEE8 / #1C2233 |
| Peter Sserwadda | Agent | PS | #F1EEE8 / #1C2233 |
Customers and suppliers use the neutral #F1EEE8 tile with #1C2233 initials.

Items: Iron sheet G28 (sht) · Ridge cap 3 m (pcs) · Cement 50 kg (bag) · Y12 rebar 12 m (pcs) · PVC pipe 4 in (pcs) · Timber 2×4 (pcs) · Wall plugs (pack).

**Waiting on Ruth at 09:40 (the decision queue, oldest first; 8 decisions):**
| # | Asker | Order / thing | The ask | Evidence | Age |
|---|---|---|---|---|---|
| 1 | Denis (Buyer) | #0552 Mukono Roofing (Faith's) | Price up · Ridge cap 3 m | cost 24,000 → 27,000, sells 26,000 (under cost by 1,000) · 10 pcs | 2 h 10 m |
| 2 | Grace (Sales) | #0555 Kyaligonza & Sons | Under the shop's price · Iron sheet G28 | Grace asks 46,000 · shop's 47,500 · cost 38,000 · 30 sht | 1 h 05 m |
| 3 | Musa (Store) | #0551 Nansana Hardware | Let it go on credit? (cash customer, not paid) | owes 0 · this order 1,240,000 · no limit · 1st order on credit · truck waits (Ssali) | 0 h 25 m |
| 4 | Grace (Sales) | #0556 Ggaba Stores | Cancel asked · "changed their mind" | 430,000 · nothing packed · not paid | 0 h 50 m |
| 5 | Musa (Store) | #0550 Kato Construction | Short pick · Iron sheet G28 got 36 of 40 | bill what went 36 × 47,500 or wait for 4 | 0 h 40 m |
| 6 | Musa (Store) | Write-off · Cement 50 kg | 3 bags broken in the yard | 3 × 34,000 = 102,000 at cost · photo | 1 h 30 m |
| 7 | Brian (Sales) | #0547 Lubowa Builders | Return · Timber 2×4 | 5 pcs back · credit note 5 × 11,250 = 56,250 | 3 h 00 m |
| 8 | Denis (Buyer) | Carton · Wall plugs | A carton to OK | order needs 1 pack · carton 200 packs · 199 for the shelf · 298,500 · ~14 months of selling | 0 h 15 m |

Done today by Ruth (for success / history states): 07:55 approved Iron sheet G28 price for Brian (#0549); 08:30 invoiced #0546 (auto at 24 h).

**Orders on the move:** Checking 3 (#0554 Lubowa · Timber asked 10:40 → Denis; #0555; #0556) · Buying 2 (#0552, #0553 Ggaba Stores Y12 not found → Katwe) · Packing 2 (#0550 short pick; #0551 waits on Ruth's credit answer) · On the road 1 (#0549 Kyaligonza, Ssali). Stuck: #0554 Checking 2 h 40 m over its 2 h limit (Denis holds it).

**Money:** In today 2,836,000 (cash 1,960,000 · mobile money 876,000). To collect 6,679,000 from 5 customers:
Kyaligonza & Sons 2,310,000 (oldest 38 days · held at 21) · Ggaba Stores 1,615,000 (16 d) · Mukono Roofing 1,214,000 (12 d) · Kato Construction 878,000 (4 d) · Lubowa Builders 662,000 (25 d, promised Mon 19 Oct).
Age bands: under 7 d 878,000 · 8–21 d 2,829,000 · 22–30 d 662,000 · over 30 d 2,310,000 (sum 6,679,000).

**Team (October so far, sales invoiced):** shop 61,110,000 of 105,000,000 (58%), pace 59,500,000 → ahead 1,610,000.
Grace 23,400,000 of 35M (ahead) · Brian 17,050,000 of 30M (behind 0.83M) · Faith 14,980,000 of 30M (behind 2.09M) · counter and agents 5,680,000. Off today: Hassan (driver). Store: Musa packing #0550, Joy free. Buying: Denis on the trip from 11:30.

## Keep the figures true
Any total adds up from the lines it shows; the same figure is the same on every board.

## Added during drawing (use these; they were fixed by the DecidePrice board)
- D-4 counter sale: Grace at the counter 11:20, Cement 50 kg, 10 bags at 40,000; shop's 42,500; cost 34,000.
- D-2 price coming: Brian, #0553 Ggaba Stores, Y12 rebar 12 m, 20 pcs, cost 31,000 (Katwe) → 38,750 at +25%.
- D-33 new item: PVC pipe 4 in, cost 28,000, rivals 34,000–36,000 → 35,000 at 25%.
- D-3 rungs: shop's price, "Same gain 29,000" (the old 2,000 gain a piece on the new cost).
- New parts (to add to agent-design-language.md): the price scale (cost · asker · shop's on one track, hatched "never under cost"), the rung row, the decision sheet head ("From Grace · #0555 · 2 of 8"), the dock with a tap (reversible) instead of a slide, the lock-screen notification card.
- From DecideOrders: D-19 (14:20) Esther asks to void #0545 Kato 320,000 (entered twice with #0544), 200,000 paid → Kato owes 878,000 → 758,000; D-10 (16:10) Brian's #0549 2 packs wall plugs at 0, cost 3,000; D-22 (11:25) Peter's #0557 Mukono Roofing cement 20 → 12 (288,000 less, 36,000 a bag), 300,000 paid.
- From Orders: page 4 at 10:05 (after the 10:00 invoice run): #0548 Kato Construction 430,000 (delivered Fri 16:10) and #0557 Lubowa Builders 318,000 (delivered 08:50) bill themselves; twins for D-21 #0558/#0559 Kato 612,000; order amounts #0555 1,380,000 · #0552 1,210,000 (selling) · #0550 1,900,000 · #0549 1,425,000; on the move 9,835,000.

## To reconcile in the review (clashes between boards)
- #0544/#0545: Orders uses #0545 Walk-in "Only 567" (Grace) and #0544 Mukono Roofing "Price coming" Cement 425,000 (Faith); DecideOrders uses #0545/#0544 as Kato's order entered twice (void, 320,000). Pick one meaning per number.
- D-21 twins: Orders #0558/#0559 Kato 612,000 vs DecideOrders' void of #0545 "entered twice with #0544".
- #0557: Orders = Lubowa Builders 318,000 delivered; DecideOrders = Peter's agent order for Mukono Roofing.
- #0549: DecideOrders has it given away (Brian, wall plugs at 0); Orders has it Kyaligonza 1,425,000 on the road.
- Dock primary: DecidePrice uses a white tap button; DecideOrders a red one. One rule for all boards.
- From DecideStock: cement shelf 26 → 23 after the write-off; D-13 PVC pipe 4 in 11 of 12 at Owino ("12 went on the truck at Owino" — Denis); D-15 2 cement bags from Nakawa 68,000 at cost; D-17 Aisle B Timber 2×4 −2, Wall plugs +4, net −12,000; D-23 Cement 40 bags 1,360,000, 6 weeks left.
- From Money: D-7 limit 1.5M · 14 d (500k can't cover 1,240,000); D-6 at 2M (Mukono would owe 1,551,500); Ggaba Stores limit 2M, Esther asks 3M (D-32), look-alike "Gaba Stores", opening balance 290,000 since 1 Oct; Kyaligonza bills 1,450,000 + 860,000 = 2,310,000.
