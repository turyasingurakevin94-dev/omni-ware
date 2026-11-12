# Pack boards · fixed with the app (critic 2026-11-12)

The Pack critic (`docs/audit/store/CANVAS-PARITY.md` "## Pack") found three faults the boards draw the same way as the app (F6, F7, F8). The app was fixed and each board below got the same change, nothing more.

| Board | What changed | Why |
|---|---|---|
| PK06 Packed | "Next job" `#8D99B5` → `#B3BCD2` | F6: 11 px at 4.46:1 on the next-job card over navy; `#B3BCD2` is the hero's own secondary (as Shelf F1) |
| PK07 Ready to collect | the same, "Next job" `#8D99B5` → `#B3BCD2` | F6 |
| PK01 To pack | the copy's NH face (#0557): `opacity: .6` dropped, tint `#FDEEE1`/`#7A4A02` → the slate `#E8EBF0`/`#3D4A5C` | F7: the faded "NH" read 2.76:1 on a row that still opens Look only; the slate is the holder face (`yardFace`) at full strength, and the red "Don't pack" pill already says it is the copy |
| PK08 For you | the same copy face | F7 |
| PK13 Someone else | the same copy face | F7 |
| PK20 Offline | the same copy face | F7 |
| AD06 Unpack not saved | "After Unpack · Undo for 10 s", BO and "Brian sees: Packing again": `opacity: .5` dropped | F8: 2.08–3.17:1; it is still what Unpack does on Try again, so it is information, not an inactive control |
