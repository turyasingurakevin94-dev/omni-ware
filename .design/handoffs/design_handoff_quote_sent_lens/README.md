# Handoff: Quote — the Sent lens, and what it shares with the stage board

## Overview

Quote's third lens had a chip reading `12` and no design. This bundle specifies it — and answers the question
that drawing it raised: **does this duplicate Order tracking?**

The short answer: **the object does not duplicate, the machinery does.** A sent quote and an order in progress
are different things, so Sent is not a sixth lane on the board. But three mechanics currently exist — or would
exist — twice, and each must be written once.

Artboard in `Quote.dc.html` (turn 2, top of the file):

| Id | What it is |
| --- | --- |
| **2a** | The Sent lens · content area, 1040 wide |

Turn 1 below it is the console, the Saved lens and the phone, specified in
`design_handoff_quote_page/README.md`. Order tracking is specified in `design_handoff_order_tracking/`. The
rail is specified in `design_handoff_catalogue_and_rail/` and is the authority. This bundle is additive to all
three, and **supersedes one line** of the first (see *Corrections*).

## About the design file

A **design reference written as HTML** — layout, copy and state, not production code. Recreate it in the
existing codebase (`tab-quote` and the `quote-saved` resolution). `support.js` is the prototype runtime and has
no role in the implementation.

**Fidelity: high.** Colours, type, spacing, grid tracks and copy are final. Figures are **plausible demo
data**; the conversion rates are the shape the real ones must take, and all of them derive from the books.

---

## 1 · The three lenses, now that the third exists

| Lens | What is in it | Whose move it is | Its action |
| --- | --- | --- | --- |
| **Building** | The quote in your hands, one at a time | Yours | the dock — this is the only lens with one |
| **Saved** | Written, and **nobody has seen it** | Yours | **send** |
| **Sent** | With the client, waiting on a yes | Theirs | **ask again**, **requote**, or **let it go** |

Drawing Sent is what exposed that Saved and Sent were conflated. A quote nobody has seen is not waiting on a
yes.

## 2 · The Sent lens (2a)

- Breadcrumb `Sell › New quote`. Search placeholder: `Client, item, or "sent over a week ago"`. Top-bar action
  `New quote` in coral.
- Title **Out with clients**; subtitle *"Twelve quotes sent and unanswered · 9,180,000 waiting on a yes ·
  longest wait first"*.
- **KPIs** — Waiting on a yes `9,180,000` ("12 quotes · 1,940,000 of margin in them") · Sent quotes that
  became orders `44%` (good card, "61% when answered inside a week") · Past two weeks, no reply `3 quotes`
  (bad card, "4,270,000 · these convert 8% of the time").
- **Grid** `30px minmax(0,1fr) 116px 92px 80px 104px`, `column-gap: 10px`:
  avatar · **Client, and what for** · Value · **Sent** · You keep · **Next**.
- Row line 2 carries the fact that decides the action: *"iron sheets, 200 Pcs · they also owe 2,410,000"*,
  *"cement, 150 bags · price has since risen 500"*, *"binding wire, 40 rolls · asked twice, no answer"*.
- **You keep** is a chip per row — good `#e2f5ec`/`#0f7a56`, caution `#fff3d9`/`#96600f` — so a thin quote is
  visible before you chase it.
- **Next** is the action the row earned, never one action repeated: `Ask again` · `Requote` (the cost moved
  since it was priced) · `Let it go` (ghost) · `waiting` as plain text where nothing is due.
- **Groups:** **Past its limit · 14 days** (3 · `4,270,000` · oldest 21 days) then **Waiting, still in time**
  (9 · `4,910,000` · none over 6 days), closing with a dimmed tail row for the six sent this week.
- Card header states the boundary where somebody hunting a won quote will read it: *"a yes moves the quote to
  Order tracking, so nothing won is listed here."*
- Below the card, the reading: **Why fourteen days is the limit** — quotes answered inside a week became
  orders 61% of the time, past fourteen days 8%; so the top group is not simply the old one, it is the one
  where asking again is still worth the message. It also names the limit's home (see below).

## 3 · Sent is not a sixth lane on the board

The board's five lanes — Taken, Buying, Preparing, Out, Delivered — are all **work the shop is doing**: Taken
waits on a supplier, Buying on a trip, Preparing on a packer. A sent quote waits on somebody who has not
agreed to buy anything.

**The decisive evidence is the board's own figures**, every one of them derived over *live orders*: `54 live`,
`cash to buy in 2,180,000`, `18 to invoice`. Put twelve unaccepted quotes in a lane and all three inflate by
work nobody commissioned.

So: a yes turns the quote into an order and it leaves this screen. **Sent lists only what is unanswered; the
board lists only what was agreed.** Neither ever shows the same piece of work.

## 4 · Three mechanics that must be written once

This is the part the first version of this argument missed. The boundary above is about the *object*; these are
about the *machinery*, and this is where the duplication actually is.

### 4.1 The clock — one age-and-limit function

The board already measures how long a thing has sat in its state and flags `5 past their stage limit`. Sent's
fourteen days is **that same limit for a different state**. Do not write a second timer.

- One function: given a state and the moment it was entered, return the age and whether it is past that
  state's limit.
- The limit is **configuration, not code**: Sent's fourteen days belongs in **Setup beside the board's stage
  limits**.
- The group is titled **"Past its limit · 14 days"** deliberately — not "No reply, two weeks or more" — so it
  reads as the app's own limit rather than a threshold invented for this screen.

### 4.2 The decision — one needs-you queue

A quote gone cold needs the owner exactly as an order whose supplier has gone quiet does. Both belong in
whichever **single** needs-you queue the app keeps.

**The `Next` column is a reminder on the row, never a second queue.** It tells you what this row earned; it
does not become a rival inbox.

### 4.3 The words — one composer

`Ask again` uses the **Messages** composer and stamp: the draft is editable, the box is what ships, the app
cannot see WhatsApp, and nothing is recorded until the owner stamps whether it went. Do not build a second
composer here.

## 5 · Two questions left open — yours to call

Both are flagged in the prototype's cut card. I have not acted on either.

1. **Two answers to "what needs me now".** The board carries its own needs-you dock serving twenty decisions
   one at a time; **Today** carries a badge of eight. Those are two queues answering one question. Following
   §4.2, one of them should own it — but which is a product decision, not a styling one.
2. **Order tracking is the only screen still in the older palette.** It is on Inter with verdigris `#1C6B58`
   and oxide `#B23A26`; the other twelve screens of this pass are on IBM Plex with the navy-and-coral card
   idiom. Converting it is a turn of its own.

## 6 · Corrections this bundle makes

| What | Was | Now | Why |
| --- | --- | --- | --- |
| The Saved lens subtitle | "Eight quotes saved and not yet ordered · 6,240,000 waiting on a yes" | "Eight quotes **written and not yet sent** · 6,240,000 **the client has not seen**" | "Waiting on a yes" is the Sent lens's job; a quote nobody has seen is waiting on *you* |
| 1a's breadcrumb | `Sell › Quote` | `Sell › New quote` | Matches the rail's row label (the rail is the authority) and `design_handoff_quote_page/README.md`. **The H1 stays "Quote"** — it names the document being built, not the rail row |
| The palette count | "the other thirteen" | "the other **twelve**" | Thirteen screens exist in the pass *including* Order tracking; excluding it leaves twelve |

## Behaviour

- **Lens switch** re-sorts in place and never navigates; it belongs in tab state so `resolveTab('quote-saved')`
  can arm Saved directly.
- **Sorted by how long it has waited**, longest first, within groups; the groups come from the limit function,
  not from a hand-written date test.
- **`Requote`** opens the quote on **Building** with the current costs applied and the change stated — a
  requote is a new document, not an edit of a sent one, so the client's copy stays true to what they were sent.
- **`Let it go`** closes the quote with a reason and drops it off every count. Nothing is deleted.
- **A yes** converts the quote to an order, puts it in the board's first lane, and removes it from Sent — one
  transition, one place.

## State

The active lens, the selected row, and per-column scroll. Everything derived and never stored twice: group
membership and subtotals, the age of every quote, the past-limit flag, the kept-% per row, the conversion
rates, and the `Next` action each row earned.

## Tokens

Unchanged: surface `#ffffff` · ground `#f6f5f2` · sunken `#faf9f6` · rules `#ecebe6` / `#f0eeea` · ink
`#1b2233` / `#40465a` / `#535d70` / `#5f6a7d` · navy `#17223c` · coral `#ef4b39` (fill and icon only) · coral
text-safe `#c2311f` · bad `#ffe1dc`/`#b2301f`, card `#fff1ec`/`#fadbd1`/`#7a4436` · caution
`#fff3d9`/`#96600f` · good `#e2f5ec`/`#0f7a56`, card `#ecf8f2`/`#d3ebe0`/`#39544b` · studied
`#eaf1ff`/`#1d5bb8` · selected row `#f4f1ff`.

Two classes this turn added to Quote's helmet, matching the values every other frame uses:

```css
.grow{display:flex;align-items:center;gap:9px;padding:8px 14px;background:#faf9f6;
      border-top:1px solid #f0eeea;border-bottom:1px solid #f0eeea}
.av{width:30px;height:30px;border-radius:999px;display:flex;align-items:center;
    justify-content:center;font-size:11px;font-weight:700;flex:none}
```

IBM Plex Sans throughout, IBM Plex Mono for every figure. Radius: cards 14, chips 999, buttons 9. Lucide
icons, stroke 2.

## Files

| File | Contents |
| --- | --- |
| `Quote.dc.html` | 2a and the machinery argument (top of file) · turn 1's 1a/1b/1c below |
| `support.js` | Prototype runtime only |

## Suggested order of work

1. **The age-and-limit function first**, with Sent's fourteen days added to Setup beside the board's stage
   limits. Both screens then read one clock.
2. The Sent list and its two groups, off that function.
3. The `Next` column, with `Ask again` wired to the Messages composer.
4. `Requote` as a new document on Building.
5. The two corrections in §6 — one line each.
