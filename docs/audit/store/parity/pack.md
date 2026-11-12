# Store · Pack — canvas parity (builder's record)

Boards `PK01–PK22` (`docs/canvas/store-agent/boards/`), app `next/store.html?demo` at 360 × 800, reached by real taps from Today (`test/parity/store-pack.json`; `NODE_PATH=$(npm root -g) node tools/parity/run.cjs --tab store-pack`). Shots: `docs/audit/store/parity/PK*.png` (board left, app right) and `*.diff.png`. Date 2026-11-11; re-run 2026-11-12 after the critic's Pack findings F1–F9 (`CANVAS-PARITY.md` "## Pack"), each named in the table. An independent critic re-checks; this is the builder's own strict read.

**The way in.** The sheet boards are reached by the red Next job (#0552, Carry on) and that card's Close, which lands on To pack exactly as PK02's Close links to PK01. PK14 (nothing to pack, no job) starts from Today's To pack tile.

**Close and the back strip (F1, F9; `shell/nav.ts`).** Close goes to the board's place (`nav.to`: To pack for a pack card, Today for Put back and #0530 on its bay); the back strip goes to the screen really below and says its name (`backTo`): "Back to Today" when the red Next job opened #0552, "Back to To pack" when To pack's row did, "Back to the order" under the Unpack sheet. Any way the Unpack sheet goes but Unpack (its ×, Keep it packed, a tap on the dim head, a pull down, the phone's Back) is Keep it packed, back to #0552's Packed moment, so #0530's bare page is never left open.

**What every board shares and why it still differs:**
- *The item picture.* The boards draw an illustration (the wheelbarrow, the nail box); the demo's shelf has no photos (`ShelfItem.image` null), so the card shows the aisle's duotone on the same ground. ≈ 3–4 % of a pack card's pixels.
- *The rail icons* in the stage sheet head are the shell's (`shell/routes.ts` RAIL), not this area's; the boards draw other glyphs for Coming in and To load.
- *Board figures corrected to the data* (spec §2a): #0552's line 2 is the wheelbarrows (2 pc), where PK04/PK05/PK16/PK19 draw wire nails (2 ctn); #0530 was cancelled at 10:38 (FACTS §8 what-if), PK10/PK22 say 10:41; the demo's fail code is `PK-502`, the boards' samples `PK-0552-SAVE`, `PK-0530-BACK`.
- *No per-line pick time* in the books (items[] has no `pickedAt`): PK15's and PK17's "10:30 / 10:42 / 10:44" beside a tick are not drawn.

| Board | Route | Taps | Diff % | Verdict | Notes |
|---|---|---|---|---|---|
| PK01 To pack | `pack` | 2 | 5.91 | pass | Rail: To load's stack as drawn (integration 2026-11-11); else row for row. Waiting on goods keeps the books' order (#0549 first). F7: the copy's NH is the slate face at full strength, board redrawn. |
| PK02 Pack | `pack/order {552}` | 1 | 4.14 | pass | Picture only. Short → PK04, Packed → PK18/PK06, picture → `shelf/item`, Call is a tel: link, Close → To pack; the strip "Back to Today" → Today, the screen below (F1). |
| PK03 Pressed | `pack/order` | 1 | 8.57 | pass (by rule) | The tool cannot hold a press: the shot is PK02. The red button's `:active` (darker red, scale .97, 4 px ring) is in `pack/card.css`. |
| PK18 Sending | `pack/order` | 2 | 4.26 | pass | Shot 40 ms into the 250 ms write: Short disabled, "Sending…" with the spinner. |
| PK11 No signal | `pack/order` `&offline` | 2 | 3.91 | pass | Line kept on the phone, "Packed · not sent" stamp, amber "No signal · 1 not sent yet": the finish kept behind the line is not counted again (F2), "Back online to finish" says it. |
| PK12 Not saved | `pack/order` `&fail=pick` | 2 | 5.28 | pass | Code PK-502 (see above); Try again resends. |
| PK04 Pack short | `pack/order` (short) | 2 | 1.96 | pass | Wheelbarrows: "How many pieces are here?" 0 · 1 · 2 pc · all. |
| PK16 Short sending | `pack/order` (short) | 3 | 1.5 | pass | |
| PK19 Short not saved | `pack/order` `&fail=pick` | 3 | 3.6 | pass | |
| PK05 Short sent | `pack/order` (sent) | 3 | 2.42 | pass | The toast is the shared P28 (narrower than the board's full-width band). The finishing card finishes now. The short line has the mint bar and a white 700 label, no tick (F5). |
| PK06 Packed | `pack/order` (moment) | 2 | 1.98 | pass | Undo ring counts from 10 s (board 7 s). Bay 1 picked; To load row → `out/load`; Next job → #0556. "Next job" `#B3BCD2` (F6), board redrawn. |
| PK07 Ready to collect | `pack/order` (moment, pickup) | 5 | 5.44 | pass (data) | The board's #0554 (Peter, agent) is already at the gate in the demo, so the pickup packed by taps is #0556 Nansana: same layout, its own figures (no agent row, no code). "Next job" `#B3BCD2` (F6), board redrawn. |
| PK15 Unpack | `pack/order` (unpacked) | 3 | 1.39 | pass | Undo on PK06 cancels the held pack; toast "Unpacked · bay 1 free" with Undo; "Packed again" → PK06. |
| PK08 For you | `pack` `&state=for-you` | 2 | 6.77 | pass | New demo state. Rail icons; MK badge slate as drawn. The copy's face as PK01 (F7). |
| PK09 Look only (copy) | `pack/look {557}` | 3 | 0.08 | pass | "Pack this one" → `pack/order {556}`. |
| PK13 Someone else | `pack` `&state=okello-0556` | 4 | 6.94 | pass | New demo state: the first Packed on #0556 clashes; back on To pack, Packing now chosen and lit, "#0556 moved here". The copy's face as PK01 (F7). |
| PK17 Okello's | `pack/look {556}` | 5 | 2.14 | pass | Track's skipped stops are the shared part's outline (board: filled). |
| PK14 Empty | `pack` `&state=empty` | 1 | 6.37 | pass | Today's To pack tile. `&state=empty` now empties only To pack and Packing now (#0556, #0557 and #0530 gone, #0552 packed on bay 1), so the board's moment is the demo's (F3): Check in Denis's trip ~11:30 → `in/checkin`, To load 1 → Ntinda · 13:20 → `out/load`, At the gate 1 #0555 → `out/gate`, Next to pack #0549 Ggaba, "1 delivered today". To load is #0552 (the board's "→ Ntinda · 13:20"), not #0530, so the Packed chip reads 1 where the board's reads 0: the app counts To load and Packed from one list. The whole empty yard is now `&state=yard-empty` (OU14, OU15, TD29, TD30). |
| PK20 Offline | `pack` `&offline` | 2 | 5.8 | pass | "Updating · saved 7:52" amber. No signal: Waiting on goods folds to its head row, "Waiting on goods 2 · Denis ~11:30 ›" → #0549 (PK21), as drawn (F4). The copy's face as PK01 (F7). |
| PK21 Waits for the goods | `pack/order {549}` | 3 | 6.95 | pass | Drawn by `pack/order` for an order in Buying (routes §2 lists PK21 under `pack`: it is reached from the sheet's Waiting row). "Bought 9:50": the trip has no bought time, so "Bought · Owino". |
| PK10 Put it back | `pack/put-back {530}` | 4 | 0.58 | pass | Reached from the red "Cancelled · put it back" row in To pack's Packed group. Close → Today; the strip "Back to To pack" → To pack, the screen below (F1). |
| PK22 Put back not saved | `pack/put-back` `&fail=putBack` | 5 | 2.08 | pass | Slide committed from the keyboard (Tab, Enter): the tool cannot drag. `&fail=putBack` now works in the demo. |
| AD02 Unpack #0530 | `pack/order {530, unpack}` | 3 | 4.13 | pass | Added while building. PK06's bay 2 tile (#0530) opens #0530 on its bay with the sheet (Keep it packed / navy Unpack). Corrected to the data: the books' packer is Okello (board: Musa) and bay 3 is free (board: #0556). The page under: strip "Back to the order", Close → Today; a tap on the dim head is Keep it packed (F9). |
| AD05 Unpacked | `pack/order` (unpacked) | 4 | 6.89 | pass | W5 held 10 s with Undo (the shared toast, "Undo" without the board's seconds); #0530 listed under To pack now as drawn (spec §3 Q23: To pack or Packing, open). The track's Buying is skipped: #0530 has no Buying in the books (board: 30 Sep). |
| AD06 Unpack not saved | `pack/order` `&fail=unpack` | 4 | 10.08 | pass | The held unpack goes after 10 s and fails once: the sheet again, taller, with the shared Not done card (it carries a ×, the board has none) and the demo's code PK-502 (board sample PK-0530-UNPACK). "After Unpack" stays at full strength (F8), board redrawn without the 0.5. |

**Strict read (all boards):** every control is a 44 px target (chips, Pack/Carry on, Short/Packed, tick boxes, Change, Undo, Close, Call); text ≥ 11 px; the soft greys on white are #6B7480 (4.74:1) and #5F6980; nothing clipped at 360 except a long row name or the copy row's "copy of #0556", which ellipsize/clip beside their pills as the boards do.
