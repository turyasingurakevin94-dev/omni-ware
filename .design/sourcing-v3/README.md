# Sourcing engine — design canvas (v3, for sign-off)

These are the phone mockups for the Sourcing app, rebuilt from first principles. They are
for sign-off before any app code is written. Each `*.dc.html` is one artboard, and
`canvas.json` lays them out. The live canvas is the "Sourcing Engine" design artifact.
Nothing here is loaded by any app.

The core idea: **no item goes on sale until its passport is complete.** The passport has
six gates:

| Gate | Done when | Whose |
|---|---|---|
| Photo | a square photo passes the on-phone check (sharp, light, size) | Sourcing |
| Packing | how we sell it is set, and every supplier's quote converts to it | Sourcing |
| Suppliers | at least one priced supplier (two or more is the target) | Sourcing |
| Verdict | stock / per order / consign, chosen from the engine's recommendation | Sourcing |
| Name & aisle | set | Sourcing |
| Markup | the Manager prices it, and it goes live in the same write | Manager |

| Artboard | Screen |
|---|---|
| `Main` | Today: the funnel bar, price freshness, certified top sellers, next moves, waiting on you, coach |
| `Funnel` | Lanes Wanted → Hunting → Quoted → Ready → With Manager, each card with its passport ring; the Certify view |
| `Passport` | One item: the six gates, cost against the market, the verdict, who is waiting |
| `PhotoGate`, `PackingGate` | Two of the gate sheets |
| `ManagerItem` | The Manager app's "new item to price": markup stepper, then "Put it on sale" |
| `Capture` | The red + : supplier price, rival price, new item, photo, an ask |
| `QuickPrice` | A rival price in three taps |
| `Visit` | Every job at one supplier: confirm prices, ask for wanted items, proposals, photos, talking points |
| `Prices` | Freshness, today's share, the deal radar, supplier proposals |
| `Supplier` | Scorecard against the average of our suppliers, look-alikes, lines with their price trend |

The people and figures come from `docs/canvas-cast.md`. Totals add up across screens:
the radar's 392,000 is 210,000 + 182,000; the mesh is 118,000 cost and 147,500 at the
25% default; 40 sheets wait from three customers.

Screenshot one artboard: `node .design/shot.mjs .design/sourcing-v3/Main.dc.html`
