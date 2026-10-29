# The Agent app's design language (agent.html, live, 29 Oct 2026)

The one shared reference for the Buyer redesign. Values are copied from
`agent.html` (`:root` at line 236 and the `.ax-*` rules after it) and checked
against Kevin's phone screenshots of the live app (Today, and the basket).
The old `.design/agent-app/*` canvas is out of date: do not use it.

## 1. The idea in one breath

A navy hero that says how you are doing in one number, a warm paper body of
white cards, and **one red move** — the round + in the tab bar, or a red slide
in a dark dock. Lists are short rows you act on in place (a navy pill
"Ask" on the row). Counts sit in four small tiles ("On the move"), each with a
face-dot strip and a red badge when something waits. Money is IBM Plex Mono.

## 2. Tokens (`agent.html` :root)

| Token | Value | Use |
|---|---|---|
| `--navy` | `#16203C` | hero, dock, round pill buttons ("Ask", "Play all"), active chip |
| `--navy-2` | `#243052` | avatar on navy, raised navy |
| `--navy-3` | `#2A3350` | the strip behind a sheet |
| `--bg` | `#F7F5F2` | paper ground |
| `--panel` | `#FFFFFF` | cards |
| `--tile` | `#F1EEE8` | tiles inside a card, icon grounds |
| `--line` | `#E6E3DD` | card hairline |
| `--dash` | `#C9C4BA` | dashed "not yet" tiles (Baskets), empty picker |
| `--ink` / `--ink-soft` / `--ink-faint` | `#1C2233` / `#5F6980` / `#6B7480` | text (faint on white only) |
| `--on-navy` | `#B3BCD2` | text on navy |
| `--accent` | `#C93A30` (deep `#A82D24`, soft `#FDE8E4`) | the + FAB, slide knob, red count badges |
| `--good` / `--good-bg` | `#0F6B43` / `#E4F4EA` | done, in hand |
| `--warn` / `--warn-bg` / `--warn-ink` | `#95530C` / `#FDEEE1` / `#7A4A02` | waiting, late |
| `--bad` / `--bad-bg` | `#8E2A22` / `#FBE5E2` | problem |
| `--mint` | `#6FDCB0` | good on navy ("● Live", "+0 yours") |
| `--font-sans` | Figtree | everything |
| `--font-money` | IBM Plex Mono, tabular, `-.02em` | every number |
| `--shadow` | `0 6px 20px rgba(27,36,56,.18)` | lifted things |
| `--shadow-up` | `0 -8px 24px rgba(22,32,60,.18)` | the dock |

Avatar tints (identity only, by id): `#DCEAF8/#1A5A8A`, `#F6E4F1/#7A3268`,
`#DDF1EE/#0E5E57`, `#E4E6FA/#3A3F9B`, `#E8EBF0/#3D4A5C`.

**Same family as the Buyer app today** (navy + paper + oxide red + mint, Figtree
+ Plex Mono). The differences are in the parts and the flow, not the palette:
the Agent hero is flat `--navy` (no radial glow); cards are white with a 1px
`--line` and radius 16; one red thing per screen; counts are tiles, not rings.

## 3. Type

| Where | Size / weight |
|---|---|
| Hero greeting | 24–26 / 700 white |
| Hero date line | 15 / 600 `--on-navy`, with "● Live" chip (12/600, mint dot pulsing) |
| Hero overline | 12 / 600 caps +.06em `--on-navy` ("YOURS · OCTOBER ›") |
| Hero figure | mono 32–44 / 600, "UGX" at half size `--on-navy` |
| Section head (`.ax-sec h2`) | 17 / 700; count right 13 / 600 `--ink-soft` |
| Row title (`.ax-nk .n`) | 14–15 / 700 |
| Row sub (`.ax-nk .s`) | **mono 11** `--ink-faint` ("ask the shop in one message") |
| Row count (`.ax-nk .c`) | mono 18 / 600 in the state colour |
| Tile number / label | mono 18 / 600 · 11 / 600 |
| Pill (`.ax-pill`) | 13 / 700, h 30, radius 999 |
| Tab label | 12 / 600 (active 700, icon filled) |
| Dock total | mono 22 / 600; earn line mono 13 mint |
| Slide label | 16 / 700 white |

## 4. Parts

- **Hero** (`.ax-hero`): navy, radius `0 0 28px 28px`, padding `18 20 26`,
  gap 18. Top row: greeting + date/Live chip; avatar 44 round right (ring when
  you have a goal). Then overline, big figure, a 6px progress bar
  (`rgba(255,255,255,.12)` track, white fill) with "5% of your 1M goal · 2 days left ›".
- **Section head** (`.ax-sec`): 17/700 title left, mono count right.
- **On the move** (`.ax-move` in an `.ax-card`): four tiles in a grid,
  `repeat(4,1fr)` gap 6, each 64 tall, radius 12, `--bg` ground; icon 15 +
  mono number 18; label 11. The first ("Baskets", not sent yet) is a
  **dashed** tile. A tile waiting on you has a red **need badge** (22 round,
  top-right, mono 11) and a strip of face dots under the label.
- **Needs you** (`.ax-nk-h` + `.ax-nk`): red dot + 17/700 "Needs you" + count.
  Each row: white card, radius 16, min-h 60; 38px icon tile radius 12 on the
  state's soft ground; title 14/700; mono 11 sub; mono 18 count in state colour;
  a **navy pill** "Ask" (h 36, radius 999) — the action is on the row.
- **Next move** (`.ax-nx`, carousel): head with a navy pill "▶ Play all 1 +23k";
  cards 300 wide, scroll-snap; the lead card is navy with an amber chip
  ("Due for their usual"), a ring avatar and the reason ("+8 days past their
  rhythm").
- **Tab bar** (`.ax-tabbar`): white, hairline top, grid `1fr 96px 1fr`:
  Today · **red + FAB 64 round** (4px `--bg` border, `0 6px 20px rgba(201,58,48,.35)`,
  navy count badge) · Clients. Two tabs only.
- **Order/basket head** (`.ax-strip`): close circle · **dashed "Who's this
  for?"** picker (h 52, radius 16, `1.5px dashed --ink-soft`, ⇕) · avatar +
  basket button with a count.
- **Search row** (`.ax-qrow`): search field h 48 radius 14 white hairline,
  navy mic circle inside; a 48 square grid button beside it.
- **Item card**: photo tile, name 15/700, "1 Ctn × 160,000" mono, a soft chip
  at the end ("+0" amber = your earn).
- **Suggest row** ("Often with …"): link icon + 15/700 head, faint "in your
  orders"; a card with icon tile, name, thin green progress bar + "1/1", mono
  price "580,000 per ctn", **navy round +** (48).
- **Category chips**: white pills h 44 with a tinted line icon.
- **Dock** (`.ax-dock`): navy, radius `26 26 0 0`, padding 16, `--shadow-up`.
  Row: segmented control (`.ax-seg`, white pill on, icon + word: "Pickup" /
  truck) · total (mono 22) with mint earn line. Under it the **slide**
  (`.ax-slide` h 60 radius 999, `rgba(255,255,255,.08)`; red knob 50 with »,
  nudging 6px every 1.6s; label 16/700). Not ready: the knob greys and the label
  says what is missing ("Pick a client to send").
- **Pills** (`.ax-pill` good/warn/bad/soft): h 30, 13/700, icon 14.
- **Toasts / banners**: offline banner `--warn-bg`; paused banner navy with
  mint icon.
- **Empty** (`.ax-empty`): centred 14 `--ink-soft`, one fact.

## 5. Status

Status is a **tile count with a badge** (On the move: Baskets → Sent → Packing
→ Out) and a **row in Needs you** with the action on it. Words are short and
the same everywhere: Baskets, Sent, Packing, Out; "Packing 2+ days".
Colour always comes with a word or number.

## 6. How few taps

- Ask the shop about late packing: **1 tap** (Ask on the Needs-you row).
- Start an order: **1 tap** (+), add items **1 tap each** (+ on a row),
  pick who: **1 tap** (dashed picker), send: **1 slide**.
- Play the next move: **1 tap** (Play all).
- Nothing is a separate page if a row can carry it; the dock carries the money
  and the one move.

## 7. Do / don't for the Buyer redraw

- Do: navy hero with one figure; On-the-move tiles for the pipeline; Needs-you
  rows with the action on the row; two tabs + the red FAB; dark dock with a
  slide for the one irreversible move; mono for every number; dashed for "not
  started"; red badge for "waits on you".
- Don't: rings, torn-paper slips, stamps, radial hero glows, three-plus
  coloured chips on one row, explanation sentences, more than one red thing.
