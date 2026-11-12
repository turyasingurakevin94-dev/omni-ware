# Out boards · fixed with the app (critic 2026-11-12)

The Out critic (`docs/audit/store/CANVAS-PARITY.md` "## Out", G1–G10) found faults the boards draw the same way as the app (G2, G9), a board the shared Track cannot draw (G5), and two empty boards the demo could not reach (G6). The app was fixed; each board below got the same change, nothing more. The rulings are in spec §2a.

| Board | What changed | Why |
|---|---|---|
| OU11 Peter's code | the eyebrow "#0554 · agent pickup" `#6B7480` → `#5F6980` | G2: 11 px at 4.35:1 on `#F7F5F2`; `--ink-faint` is for white only, `--ink-soft` is 5.05:1 |
| OU09 Wrong code | the same eyebrow, `#6B7480` → `#5F6980` | G2 |
| OU23 Why no photo | the eyebrow "#0552 · Kato · Ntinda site" `#6B7480` → `#5F6980` | G2 (the app: `.ow-lsheet.ground .ow-lsheet-eye`, `src/ui/sheet.css`) |
| OU31 Name this direction | the eyebrow "Load map · → Bweyogerere way" `#6B7480` → `#5F6980` | G2 |
| OU13 Not paid yet | Buying and Packing: the ticks → the skipped dash on the to-come disc (the shared Track, OR11); "now" under the gate → "ready" | G5: the walk-in came off the shelf, so those stops were skipped (`load.ts trackTimes`); "ready" is P18's word for a pickup at the gate (OR38). Spec §2a. The "Ask Ruth" disc stays teal: Ruth's face (FACTS §1), now in the app too |
| OU17 Slide held | the "Who drives · Ssali drove Ntinda last" row kept above the driver chips, as OU02 draws it | G9: nothing moves under the thumb while the knob is held (lead ruling; spec §2a) |
| OU14 Nobody on the road | "Next out · Ssali" → "Next out"; "#0534 · Ntinda site" → "#0534 · Ntinda"; "To load 2" → "To load 3" | G6, now reached at 9:30 (`&at=930`). The driver is chosen on Load per run (OU02), so the empty board names none; a stop is its short place, as OU20's rows; #0530 is packed on bay 2 too (FACTS §2), so To load counts 3 while Next out lists the two that can go |
| OU15 Nobody to hand over | "#0555 · ready 10:15" → "#0555 · they collect"; "To pack" → "To pack 2" | G6, now reached at 10:10 (`&at=1010`). At 10:10 the books keep no ready time for an order still packing; the way in carries its count, as OU14's |
| OU27 Cancelled on the truck | the "Put back at the gate · 3 lines" row: min-height 34 → 44 px (padding 4px 2px 0 → 0 2px) | G8: the app's row is 44 px; a tap target under 44 is drawn at 44 |
| AD07 Ready to collect, all held (new) | drawn on "Added while building" from OU10's layout and OU13's held parts: the gate locked with "10:15" in amber, #0555 with the "Not paid yet" pill, "2 pc · leaves when paid", the told card (Grace takes the money · Ruth may let it go), no Who collects, the locked "Stays until paid" slide (a tap opens OU13) over "Opens when paid"; head "Ready to collect 1 · oldest 26 m" | G11: OU13's Close (and the Ready chip at 10:41) landed on an undrawn gate that said "Nobody to hand over" under a count of 1. AD rule, spec §2 |

Not redrawn:
- **G3** (OU08, OU16): the grey "Code" pill is now an inactive control in the app (`aria-disabled`, no link) while a hand-over is held or kept, which is what the board's grey draws.
- **G1, G4, G10**: the back strip, Close and the slide's landing are links, not pixels. The strips now name the screen really below ("Back to On the road" over the gate; "Back to the door" on Coming back), by the rule in spec §4.9.
- **G5 OU24**: the app now draws the board (the return arrow and 9:55 at the now-stop, `Track` `nowIcon`/`nowTime`).
- **G7, G8**: the app now draws the boards (the gate under the code's scrim; Ruth's cancel at 10:38; the 44 px put-back row).
