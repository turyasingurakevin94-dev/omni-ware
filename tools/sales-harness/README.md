# Sales app harness

Runs the real `sales.html` in a browser with a fake Supabase, so every screen
can be opened, tapped and screenshotted without a login or a database.

- `stub.js` stands in for `supabase.js`: the sample shop from
  `docs/canvas-cast.md` (Mukasa Hardware, customers, orders in every stage,
  chats, sourcing requests, payment asks). Writes go to `window.__T` and RPCs are
  logged to `window.__rpcLog`; nothing leaves the browser.
- `shot.cjs` serves as a starting point: it opens the five tabs and screenshots
  them at 390×844.

```bash
python3 -m http.server 8790 &          # from the repo root
PW=/path/to/node_modules/playwright OUT=/tmp/shots node tools/sales-harness/shot.cjs
```

In the page, the app's globals drive it: `S` (state), `ACT` (every tap, by its
`data-act` name), `render()`, `push(page, args)`, `openSheet(type, args)`.
