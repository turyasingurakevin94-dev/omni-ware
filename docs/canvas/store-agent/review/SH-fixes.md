# Shelf boards · fixed with the app (critic 2026-11-12)

The Shelf critic (`docs/audit/store/CANVAS-PARITY.md` "## Shelf") found three faults the boards draw the same way as the app (F1, F11, F12). The app was fixed and each board below got the same change, nothing more. F4 changed one sample figure to the rule the spec now writes.

| Board | What changed | Why |
|---|---|---|
| SH01 Shelf | `#8D99B5` → `#B3BCD2` on the "1,153" beside the title, the aisle letters under the bars (not C's red) and the Find placeholder | F1: 3.07–3.89:1 on the navy hero; `#B3BCD2` is the hero's own secondary (5.83:1, 4.60:1 on the search field) |
| SH06 Nothing needs a look | the same three, `#8D99B5` → `#B3BCD2` | F1 |
| SH41 Shelf offline | the same three, `#8D99B5` → `#B3BCD2` | F1 |
| SH11 Sending | the Undo pill's button 40 → 44 px high | F11: tap target under 44 px |
| SH17 Not done | Try again 40 → 44 px high | F11 |
| SH27 Not done | Try again 40 → 44 px high; the pc/bundle switch: track padding 3 → 0, each button 38 → 44 px high and at least 44 px wide | F11 |
| SH20 Report | the pc/bundle switch: track padding 3 → 0, each button 38 → 44 px high and at least 44 px wide ("pc" was 43) | F11 |
| SH26 Not sent yet | the pc/bundle switch: track padding 3 → 0, each button 38 → 44 px high and at least 44 px wide | F11 |
| SH15 A count is waiting | the step times "9:21" and "now" `#6B7480` → `#5F6980` | F12: 11 px grey at 4.35:1 on `#F7F5F2`; `#5F6980` is 5.05:1 |
| SH30 We need more | "on the shelf · you ask for 10" `#6B7480` → `#5F6980` | F12 |
| SH40 Scan | the label's short code "A-014" → "A-3533" | F4: the code under a label's bars is the aisle letter and four digits from the item's key (`store.html:5814 labelShort`, the labels already on the shelves); "A-014" followed no rule. Now spec §4.5 and `core/store/shelf.ts labelShort`. Kevin can choose another numbering; the spec row is the one place to change |
