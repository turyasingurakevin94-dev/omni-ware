# Goods-in boards · fixed with the app (critic 2026-11-12)

The Goods-in critic (`docs/audit/store/CANVAS-PARITY.md` "## Goods in") found faults the boards draw too (G1, G3, G7, G8, G10, G11) and one link that was never written down (G2). The app was fixed and each board below got the same change, nothing more. The other findings (G4 Undo, G5 the saved time, G6 Close, G9 the torn bags' overlap, G12, G13) were the app's alone: the boards already draw them.

| Board | What changed | Why |
|---|---|---|
| IN01 Coming in | The head is PK01's (the shared `shell/StageSheet.tsx` head): the 40 px strip (was 24), the head's own padding and rounded foot, the title and count with the sub line in mono under it, "Close: back to Today", PK01's rail with Coming in lit; the Show chips (All · Back at the yard · Coming) sit under it as PK01's chips do. The body is unchanged | G1: one stage sheet, one head. Spec §2a now says so |
| IN40 Nothing coming | The same head ("Coming in 0 · nothing coming", no chips); "Ask Denis for more" links SH02 Find, not SH30 | G1; G2: an ask is for one item and this screen names none, so the person picks it in Find first. A ruling in spec §2a |
| IN05 Check-in sending | Scan dimmed (.45) and not a link while it sends, as "Not on the list" already was | G3: while sending, both head buttons are disabled (`disabled`, not a silent guard) |
| IN14 Delivery sending | Scan and "Not on the list" dimmed (.45), Scan disabled; the sub "at the yard 12:00" (was "· 1 line") | G3: drawn as IN05; G8 |
| IN10 Delivery | The app's "Torn?" (amber `#7A4A02`, 13 px bold, the damaged-box icon, 44 px tall) right of the name, linking IN11; the hint wraps under it as it does in the app. The sub "at the yard 12:00" | G7: the way from IN10 to IN11 was drawn by no board; G8: the sub was cut off ("at the yard 12:00 · …") and the section head already says "1 line · refill" |
| IN11 Some torn | The sub "at the yard 12:00" | G8 |
| IN15 Delivery no signal | The sub "at the yard 12:00" | G8 |
| IN20 Return | The first head chip "From Grace · Fri 15:40" (was "From Grace · asked Fri 15:40"); the "kept" bag fades its picture only, the word "kept" at full strength | G10: the two chips now fit one row (end ≈ 317 of 340); the card already says "Grace asked 2 of 3". G11: "kept" was 1.86:1, and it says what happens to the bag |
| IN23 Return sending | The same chip and "kept" | G10, G11 (the strip, the switch and the camera stay dimmed: that is all the board dims, G12) |
| IN24 Return no signal | The same chip and "kept" | G10, G11 |
| IN25 Return not done | The same chip and "kept" | G10, G11 |

`manifest/in.json` IN20's `words_here` reads the shorter chip too.
| IN40 | "3 checked in today" → 4 | FACTS gives 4 check-ins by 17:30 (Goods in critic re-check) |
