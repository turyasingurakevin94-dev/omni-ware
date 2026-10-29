# 04 · Screens — Sales

What this covers: every screen of the Sales app, and the questions still open on them.
Date: 2026-10-29
Status: **screens decided** (the approved canvas). **Ten questions open** (§3): until Kevin answers, the new app builds what the canvas draws, which is the default listed beside each one.

---

## 1. The screens are the canvas

The approved canvas is "Sales — in the agent app's language" (https://claude.ai/artifact/SwqWmXv4c2KbB1zgErYsWQ). Its source is in [`docs/canvas/sales-agent/`](../canvas/sales-agent/README.md).
- It has 149 boards: 147 phone screens at 360 × 800, plus the two parts boards.
- Every board scored at least 8.5 out of 10 on fidelity, show-don't-tell, fewest steps, polish and Sales rules, in an independent audit on 29 Oct 2026 (`review/`).

| Tab | Prefix | Boards | Main flows (taps before → after) |
|---|---|---|---|
| Today | TD | 25 | 32 → 21 |
| Chats | CH | 19 | 36 → 26 |
| Sell (the red +) | SL | 31 | 91 → 40 |
| Counter | KC | 19 | 66 → 51 |
| Orders | OR | 25 | 51 → 46 |
| Customers | CU | 28 | 39 → 31 |
| Parts | Main, Main2 | 2 | — |

| Where the rest lives | File |
|---|---|
| The design language: parts P01–P29, the Sales-only parts S01–S10, and the tokens | `LANGUAGE.md` |
| The sample shop every board draws; the demo mode is seeded from it | `FACTS.md` |
| The rules each screen follows: links, words, money, 360 px, 44 px | `BRIEF.md` |

**Proof that the app matches.** [`docs/audit/sales/CANVAS-PARITY.md`](../audit/sales/CANVAS-PARITY.md) lists one row per board. Each row has:
- the board beside the app at 360 × 800, with the app reached by taps from Today;
- the difference between them;
- the verdict of an independent critic.

## 2. A screen the canvas does not draw

The app sometimes needs a state, sheet, error, empty view or step that the canvas does not draw. When it does:
- it is **drawn first** with `/design` on the same canvas, in the same language;
- it is then scored by the tab's critic, and needs at least 8.5 on every axis;
- only then is it built.

Nothing is improvised in code.

## 3. Open questions (Kevin)

Each row names the default being built until Kevin answers.

| # | Question | Default being built | Source |
|---|---|---|---|
| Q1 | Who connects the shop's WhatsApp number? No role in `decision-rights.md` holds this job. | CH06 shows "connected", with no name | `manifest/chats.json` |
| Q2 | May Sales change the delivery fee that the app fills in, or is that the Manager's call, like a price? | Sales may edit it (SL17) | `manifest/sell.json` |
| Q3 | Is loading charged per bag, at 20 bags × 500? Is anything else on the order loaded free? | Per bag (SL16) | `manifest/sell.json` |
| Q4 | What is the one word for an order not placed yet: "basket", "draft" or "Still open"? | "Still open" | `manifest/sell.json` |
| Q5 | May Sales edit the items while an order is in Checking? | No: greyed, "Ruth changes items in Checking" (OR17) | `manifest/orders.json` |
| Q6 | Is the transaction ID for a mobile money payment required? | Required (CU33). The old app treats it as optional. | `manifest/customers.json` |
| Q7 | Do counter sales count toward the salesperson's goal? | No ("Today at the counter", no ring) | `manifest/counter.json` |
| Q8 | May Sales see the searches that found nothing for them (TD20)? | Yes, their own searches only | `manifest/today.json` |
| Q9 | Should "To collect" (1,910,000, which includes 125,000 still being checked) be called "Owes"? | "To collect", with "Being checked" shown apart | `manifest/today.json` |
| Q10 | When an item is not in stock: Moses finds the cost, Ruth prices it at Checking, then Denis buys it. Is that order right? | That order ("Price coming") | `manifest/sell.json` |

Smaller notes from the designers are in each `manifest/<tab>.json` under `open_questions`. Examples:
- Mama Shine is not yet in `docs/canvas-cast.md`;
- counter tender notes start at the next likely note (52,000 → 55,000 / 60,000).
