# Cross-app canvas (audit rounds that cross apps)

Boards for `docs/audit/cross-app/ROUND-<N>.md`. Each board is a strip of 360 × 800 phones, each with its state written above it (before, then default, pressed, disabled, sending, success, error, offline, empty as the change needs). At 1280 px the apps are their phone column centred, drawn once where it matters.

Built from the Sales and Buyer canvases' parts and tokens (`docs/canvas/sales-agent/LANGUAGE.md`, `docs/canvas/buyer/`), the sample shop of `docs/canvas-cast.md`:

```
node docs/canvas/cross-app/tools/build.cjs                 # writes the .dc.html boards
cd docs/canvas/cross-app && NODE_PATH=$(npm root -g) node ../sales-agent/tools/shot.cjs png *.dc.html
```

| Board | Round 1 items |
|---|---|
| `SalesNotSent` | SAL-3 |
| `SalesPlaceOnce` | SAL-4 |
| `SalesPriceKeypad` | SAL-5 |
| `SalesCopy` | SAL-6, X-3 (Sales words) |
| `CancelSalesBuyer` | X-1 (Sales, Buyer) |
| `CancelManager` | X-1 (Manager, with the 1280 view) |
| `NeedsSupplier` | X-2, SAL-1 |
| `BuyerTripTotal` | BUY-4 |
| `BuyerCounts` | BUY-2, BUY-5 |
| `ManagerWords` | X-3, X-4 |
