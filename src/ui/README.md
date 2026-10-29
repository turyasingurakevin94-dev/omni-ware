# src/ui — the shared parts

Every part on the canvas's two parts boards (`docs/canvas/sales-agent/boards/Main.dc.html`, P01–P29, and `Main2.dc.html`, S01–S10), built once from `docs/canvas/sales-agent/LANGUAGE.md`. **Compose screens from these; never hand-roll a variant.** If a screen needs something a part cannot do, add a prop to the part (and to this file), so every tab gets it.

- One part per file, its CSS beside it (`Part.tsx` + `part.css`), classes `ow-…`. Colours, radii, shadows from `tokens.css`.
- Each part's file header has its LANGUAGE.md number, what it shows, and usage. This table is the index.
- See them: `next/sales.html?demo&parts=main` and `&parts=main2` (the boards, from these parts; parity 0.02% / 0%), `&parts=try` (the parts that act, live).
- Proof: `tools/parity/run.cjs Main.dc.html` · `Main2.dc.html` (specs `test/parity/parts.json`); `NODE_PATH=$(npm root -g) node test/ui-parts.test.js` drives the slide, sheets, Undo, stepper, keypad, chips and checks 44 px targets, names and 11 px text.

## Basics

| File | Exports | What | Usage |
|---|---|---|---|
| `tokens.css` | CSS variables, `.mono`, `.ow-word`, keyframes | LANGUAGE §1. **No global border-box**: parts are content-box like the boards and say `box-sizing` where they need it. | `color: var(--ink-soft)` |
| `icons.tsx` | `Icon`, `Duo`, `ph…` (28 duotone), `AISLE`, `aisleKey`, `AisleIcon`, `STAGE_ICON`, `IconName` | §2: the one icon module. Stroke by name (`today chats orders orders-tab customers plus minus search mic grid close back chevron-right chevron-down updown arrow-right slide phone whatsapp message send basket truck store cash mobile bank receipt check checking cart delivered clock hourglass warning tag return undo person person-plus filter sort camera spark pin list hand-over pen trash share lock note attach backspace offline flag trophy trend bell link star sign-out calendar void swap`); duotone as named exports (tree-shaken: a screen ships only what it imports). | `<Icon name="phone" size={18} stroke={2} />` · `<Duo i={phCoins} size={20} color="#95530C" />` · `<AisleIcon aisle="Roofing" />` |
| `util.tsx` | `Tap`, `cx`, `Fig` | `Tap`: the board's `<a href>` that runs `on`. `Fig`: a number (written in full) or a string (drawn as given). | `<Tap on={go} label="Open Orders">…</Tap>` |
| `Money.tsx` | `Money`, `fig`, `QtyLine` | Plex Mono, tabular; full or short (`src/core/money.ts`). | `<Money n={3240000} short sign />` → +3.2M |
| `Avatar.tsx` | `Avatar`, `FaceStack`, `RingAvatar`, `avatarStyle`, `RING_TONE`, `Face` | P11 avatars (`size` 18–52, tint, `onNavy`, `ring="me"|"basket"|box-shadow`), P07 face stack, P10 due ring. | `<Avatar initials="KC" tint="t0" size={40} />` · `<FaceStack faces={f} more={2} />` · `<RingAvatar … tone="late" fill={1} />` |
| `Bar.tsx` | `SplitBar`, `Meter` | Split bar (parts by value, `'hatch'` for being checked); meter on a track. | `<SplitBar parts={[{ value: 165000, color: '#F5B26B' }, { value: 125000, color: 'hatch' }]} h={10} label="…" />` |
| `ItemSquare.tsx` | `ItemSquare` | §2.4: the aisle's icon on its soft gradient (or a photo; `dropped`: crimson). | `<ItemSquare aisle="Roofing" size={40} />` |

## P parts (Main.dc.html)

| P | File | Exports · props | Usage |
|---|---|---|---|
| P01 | — | Ground and gutters are the screen's own `<main>`: `padding: 18px 16px 100px; gap: 10px` (12 on the order, 16 between list groups). | |
| P02 | `Hero.tsx` | `Hero` greeting, date, `status` live/updating, `savedAt`, `me`, `onMe`, `month`, `sold`, `onSold`, `goal` `{pct, movePct, target, daysLeft}` · `{hit, over}` · `null`, `manager`, `onGoal`, `doors[]` `{tone, icon, value, label, on}` | `<Hero greeting="Good morning, Grace" date="Sat 17 Oct" me={me} onMe={…} month="October" sold={12480000} onSold={…} goal={{ pct: 36, movePct: 9, target: '35M', daysLeft: 14 }} onGoal={…} doors={…} />` |
| P02b | `GoalRing.tsx` | `GoalRing` pct, movePct, hit, size (120; scales), caption, label, on | `<GoalRing pct={36} movePct={9} />` |
| P03 | `PageHead.tsx` | `PageHead` title, count, `actions[]` `{icon, label, on, white}`, `search` (SearchProps), children = the picture. Pictures: `HeadStat` amount, word, label, pill, `bar` `{parts, legend, label}` (P03a + the owed bar); `StageBar` counts (P03b); `WeekStrip` days `{name, count, faces, kind, selected, on}`, title, hint (P03c); `STAGE_BAR` | `<PageHead title="Customers" count={38} actions={…} search={…}><HeadStat amount={1910000} word="owed" pill="4 owe" /></PageHead>` |
| P04 | `FullSheet.tsx` | `FullSheet` onBack, backLabel, head, pad, gap, ground, foot, inline (the 40 px strip = back; pull down = back). `SheetHead` face, name, sub, subMono, onName, phone, callLabel, onClose, chips, `pad="chat"`, children = picture. `HeadChip` on, label (S01's glass chips) | `<FullSheet onBack={nav.back} backLabel="Back to Orders" head={<SheetHead … />}>…</FullSheet>` |
| P05 | `TopBar.tsx` | `TopBar` onClose, who, baskets[], search, onAisles. `WhoPill` on, face, name, sub, dot, isNew, empty. `BasketChip` face, count, label, on | `<TopBar onClose={…} who={<WhoPill on={pick} />} search={{ placeholder: 'Add an item', label: 'Add an item: type its name', onMic: … }} onAisles={…} />` |
| P05/P03 | `Search.tsx` | `Search` tone light/navy, placeholder, label, value, onInput, onEnter, onMic (focus: navy outline, clear replaces mic) | `<Search tone="navy" placeholder="Name, phone or place" label="Find a customer" value={q} onInput={setQ} />` |
| P06 | `SectionHead.tsx` | `SectionHead` title, meta, metaTone, dot + count ("Needs you"), after, right. `PlayAll` count, amount, on. `GroupHead` dot, title, count, sum | `<SectionHead title="Needs you" dot count={7} after />` |
| P07 | `StageTiles.tsx` | `StageTiles` tiles[] `{stage, count, faces, more, mark money/ready/late, need, label, on}`, children (MiniRows). `GhostTiles` title, meta (P24) | `<StageTiles tiles={…}><MiniRow … /></StageTiles>` |
| P08 | `NeedsRow.tsx` | `NeedsRow` kind take/tell/collect/packing/chats/notsent, title, sub, count, pill, on | `<NeedsRow kind="take" title="Take payment" sub="3 customers · 1,910,000" count={3} on={…} />` |
| P09 | `NextMove.tsx` | `NextMove` tag, pos, face, rhythm, late, name, big, bigSub, legend, usual[] `{aisle, text}`, footLabel, footValue, phone, act. `Dial` | `<NextMove … act={{ label: 'Order usual', on: … }} />` |
| P10 | `CustomerRow.tsx` | `CustomerRow` face, tone due/late/quiet/early/null, fill, name, sub, owes, owesWord, on, onWhatsApp | inside `<GroupCard>` |
| P10b | `ActRow.tsx` | `ActRow` lead, title, aside, sub, act `{icon, label, on, kind navy/tile}`, on. `GroupCard` pad 12/14 (rows split by 1px). `MiniRow` (P07's 48 px row). `IconTile` tone, icon/duo, size. `Chevron`. `TILE_TONE` | `<ActRow lead={<IconTile icon="message" tone="info" size={42} />} title="Lubowa Builders" aside="· asked" sub="…" act={{ icon: 'whatsapp', label: 'Reply to Lubowa Builders', on: … }} />` |
| P11 | `Avatar.tsx` | above | |
| P12 | `LineCard.tsx` | `LineCard` aisle, photo, name, qty, unit, price, chip `{kind amount/under/out/coming/orderin/shelf, v}`, open, on, children. `LineChip`. `LineNote` | `<LineCard aisle="Cement" name="Cement · Hima 50kg" qty={40} unit="bag" price={33500} chip={{ kind: 'amount', v: 1340000 }} on={…} />` |
| P12b | `Stepper.tsx` | `Stepper` value, unit, onChange, min, max, step, what | `<Stepper value={qty} unit="pc" what="iron sheets" onChange={setQty} />` |
| P13 | `OftenWith.tsx` | `OftenWithHead` item, whose. `OftenWith` aisle, name, had, of, price, unit, onAdd | `<OftenWith aisle="Roofing" name="Ridge cap G28" had={7} of={14} price={18000} unit="pc" onAdd={…} />` |
| P14 | `Aisles.tsx` | `AisleChips` aisles[] `{name, on}`. `AisleTiles` tiles[] `{name, count, on}`, all `{count, on}` | `<AisleChips aisles={…} />` |
| P15 | `Dock.tsx` | `Dock` mode `{value, onChange}` or words, total (null = empty), sub `{text, tone mint/amber/rose}`, address, slide (SlideProps), inline, children (S02 inside). `ModeSwitch` | `<Dock mode={{ value, onChange }} total={1750000} sub={{ text: '1 price coming', tone: 'amber' }} slide={{ label: 'Slide to place · 3 items', knobLabel: 'Place this order', onCommit: place }} />` |
| P15 | `Slide.tsx` | `Slide` label, knobLabel, onCommit (may return a promise), onHint, state ready/sending/blocked/offline/empty. Drag ≥ 85% commits; a tap without a drag calls onHint; Enter/Space commits. | `<Slide label="Slide to record 420,000" knobLabel="Record this payment" onCommit={record} />` |
| P16 | `TabBar.tsx` | `TabBar` active, waiting, notPlaced, onTab, onPlus, items, plusLabel, inline (the shell owns it) | — |
| P17 | `sheet.tsx` | `sheet.open(render, {label, top, onClose})`, `sheet.close()`, `SheetHost`, `LightSheet` title, eyebrow, onClose, pad, gap, foot, ground. `useDragClose(el, onClose, scrim?, when?)` | `sheet.open(() => <LightSheet title="Who is it for?" onClose={sheet.close}>…</LightSheet>, { label: 'Who is it for?', top: 300 })` |
| P18 | `Track.tsx` | `Track` stage, sub, waits, times, word. `StageDots` stage, waits, ready (P18b) | `<Track stage="packing" sub="Musa · since 10:05" times={{ checking: '9:14', buying: '9:31' }} />` |
| P19 | `MoneyTiles.tsx` | `MoneyTiles` tiles[] `{k, v, note, old, tone good/warn/info, on}` | `<MoneyTiles tiles={[{ k: 'Kato pays', v: 1810000, note: '2 lines' }, { k: 'Not paid yet', v: 1810000, tone: 'warn' }]} />` |
| P20 | `CheckList.tsx` | `CheckList` title, bar (colours), summary, lines[] `{aisle, name, qty, unit, amount, note, mark confirmed/checking/waiting/short/dropped, at, word, got, markLabel}` | `<CheckList title="What Kato gets" … />` |
| P21 | `ActTiles.tsx` | `ActBar` acts[] `{tone call/tell/receipt/change/wrong/plain, icon/duo, word, sub, on/href, label}`. `ActGrid` (separate tiles, 3 or 4) | `<ActBar acts={…} />` |
| P22 | `Moment.tsx` | `Moment` title, onClose, who `{face, name, ref, on, label}`, note, items `{aisles, title, sub, amount}`, next[], end, card. `WhatsNext` steps. | `<Moment title="Placed" … end={<EndOfFlow on={nav.home} ms={8000} />} />` |
| P22/P26 | `Moment.tsx` | `EndOfFlow` label ("Back to Today", always), on, ms (goes back by itself), pct, quiet `{label, icon, on}` — the one end-of-flow block | `<EndOfFlow on={nav.home} ms={8000} quiet={{ label: 'Sell again', on: … }} />` |
| P23 | `Pill.tsx` | `StatusPill` tone good/caution/bad/info/neutral, size sm/md/lg, icon, tick. `DarkPill` amount. `FilterChip` on, dot, count, dim, onClick. `ChipRow` label, wrap. `ActionPill` tone, word, amount, h. `NavyPill` tone mint/amber/glass, icon, small. `EarnChip`, `CodeChip` | `<StatusPill tone="good" tick>Paid</StatusPill>` |
| P24 | `Empty.tsx` | `EmptyState` ghost, title, steps[] `{done, icon, stroke, title, sub, on}`, way `{label, icon, on}`. `Checklist` | `<EmptyState ghost={<GhostTiles title="On the move" meta="fills as you sell" />} steps={…} way={{ label: 'New order', icon: 'plus', on: … }} />` |
| P25 | `Skeleton.tsx` | `Shim` w, h, round, navy, r. `Loading` text. `LoadingHead` text. `SkeletonRows` rows | `<LoadingHead text="Getting your customers" /><SkeletonRows rows={4} />` |
| P26 | `Button.tsx` | `Button` kind navy/red/white/ghost/green, icon, stroke, duo, h 56/52/48, fs 15/16, state idle/sending/disabled, onClick, label. `FinishBar` label, chip, on | `<Button kind="red" icon="cash" state={busy ? 'sending' : 'idle'} onClick={take}>Take 420,000</Button>` |
| P27 | `Notice.tsx` | `Notice` kind offline/someone/paused, action `{label, on}`. `Callout` tone, icon (a one-line note inside a card or sheet) | `<Notice kind="offline" action={{ label: 'Try again', on: flush }}>No signal · <b class="mono">2</b> not sent yet</Notice>` |
| P28 | `toast.tsx` | `toast.show(text, {kind ok/warn/error, sub, undo, retry, ms})`, `toast.hide()`, `ToastHost` (the shell mounts it), `ToastView` | `toast.show('Added 40 bags', { undo: () => removeLine() })` |
| P29 | `UsualCard.tsx` | `UsualCard` title, items[] `{aisle, name, qty, in, note, label, on}`, onAll. `UsualOne` aisle, name, sub, onAdd | `<UsualCard title="Kato's usual" items={…} onAll={…} />` |

## S parts (Main2.dc.html)

| S | File | Exports · props | Usage |
|---|---|---|---|
| S01 | `Chat.tsx` | `ChatThread`, `ChatDay`, `Bubble` from theirs/ours, who, at, read, notSent. `TeamNote` who. `Typing` face. The head is `SheetHead pad="chat"` with `HeadChip`s. | `<Bubble from="ours" who="Grace" at="9:06" read>…</Bubble>` |
| S01 | `Composer.tsx` | `Composer` to, toName, value, onInput, onSend, onNote, note, onAttach, onMic (shown when empty), sending, disabled | `<Composer to="Kato" toName="Kato Construction" value={t} onInput={setT} onSend={send} onMic={…} />` |
| S02 | `PayMethod.tsx` | `MethodPicker` value, onChange, navy. `AmountField` who, value, options[] `{word, amount, on}`, chosen, onOther. `TheyGave` notes, value (number or 'exact'), onPick, change, onKeep | `<MethodPicker value="cash" onChange={setM} />` |
| S03 | `Keypad.tsx` | `PriceLadder` pct, shop, label, shopWord, shopPct. `ladderPct(price, cost, shop)`. `PriceField` label, value, diff. `Outcome` words, was, now. `Keypad` value (digits), onChange, max | in a `LightSheet`, with `Callout` and a ghost/navy `Button` pair (`h={52} fs={15}`) |
| S04 | `PersonPicker.tsx` | `PersonPicker` people[] `{id, face, name, line, load, heavy, presence, self}`, value, onChange, name | then a note field and `<Button h={52} icon="hand-over">Give to Brian</Button>` |
| S05 | `PageHead.tsx` + `Pill.tsx` | `StageBar` in the Orders head; `ChipRow` of `FilterChip`s with `dot={STAGE_DOT[stage]}` | |
| S06 | `MoneySplit.tsx` | `MoneySplit` owes, collect, checked, checker `{face, name}`, onCollect, onChecked (on navy: a head or `NavyCard`) | |
| — | `NavyCard.tsx` | `NavyCard` ground flat/head/dark: a navy card on light for a navy picture | `<NavyCard><MoneySplit … /></NavyCard>` |
| S07 | `ReasonCard.tsx` | `ReasonCard` kind return/void/payment, title, sub, on, off | `<ReasonCard kind="void" off="Delivered · use a return" />` |
| S08 | `DayBlocks.tsx` | `DayBlocks` title, pill, rhythm, late, ahead, labels, label, onNavy | |
| S09 | `StageGroup.tsx` | `StageGroup` stage, count, sum, children. `OrderRow` face, name, no, status `{text, face, tone}`, amount, time, act `{word, amount, label, on, tone}`, on. `STAGE_DOT` | |
| S10 | `BillMatch.tsx` | `BillMatch` bill `{k, v, sub}`, paid, label, eyebrow, sign | |

## What the tab builders must know

- **Layout is the screen's.** Parts have no outer margins; the screen's `<main>` sets gutter and gap (P01). A part that sits on navy (Track, MoneySplit, StageBar, HeadStat) goes inside a head or a `NavyCard`.
- **Words and numbers come in as props; money as numbers.** `fig()` writes them (`1,810,000`, `short` → `1.8M`, a true minus). A string is drawn as given. Build a sentence that mixes values into one string (`` `${n} checking` ``), not `{n} checking`: separate text nodes shape differently from the board.
- **Names, not roles**: parts with a default person ("Ruth decides", "Esther checks it") take the name as a prop; pass the shop's real people.
- **Every control has a name**: icon-only parts take a `label`; pass one that says what and whom ("Call Kato Construction").
- **Interactions are real.** Slide commits only at 85%, then waits on your promise; the sheet host and `FullSheet` close on a pull; `toast.show(…, { undo })` keeps Undo 10 s. Wire `onHint` to `toast.show('Slide the red button across', { kind: 'warn' })`.
- **Known differences from the boards**, on purpose: the navy search placeholder is LANGUAGE.md's `#8D99B5` (the board leaves Chrome's default grey, 3.6:1 on navy); the board's 36 px "All / Other" chips and the 40 px Pickup/Delivery segments are 44–46 px targets that take no more room; the parts board's P04 head uses gap 14 and its price field 64 px (the real boards: 16 and 60, which are the parts' defaults).
- **Budget**: the page is 31.6 KB of 80 KB compressed. The duotone icons are separate exports so a screen ships only what it imports; the gallery is `next/sales-parts.js`, never the page.
