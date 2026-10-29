# Parity specs

One file per tab, written by that tab's builder: `today.json`, `chats.json`, `sell.json`, `counter.json`, `orders.json`, `customers.json`. Each is a list; one entry per board:

```json
[
  {
    "board": "TD05ToCollect.dc.html",
    "demo": "",
    "steps": [{ "tap": "1.9M to collect" }],
    "note": ""
  }
]
```

| Field | What |
|---|---|
| `board` | the file in `docs/canvas/sales-agent/boards/` |
| `demo` | flags after `?demo` (`src/core/demo/README.md`): `""`, `"&offline=1"`, `"&clock=15:40"`, `"&state=empty"` … |
| `steps` | real taps from Today, in order (below) |
| `region` | optional `[x, y, w, h]`: also measure this part on its own |
| `note` | anything the critic should know (a known difference, a FACTS gap) |

Steps:

| Step | Does |
|---|---|
| `{"tap": "Orders"}` | taps the element whose `aria-label` is that, else whose visible text is exactly that, else contains it |
| `{"tap": {"label": "Close"}}` · `{"tap": {"text": "Kato Construction"}}` · `{"tap": {"sel": "nav a:nth-child(2)"}}` | by aria-label, by text, by CSS selector |
| `{"type": "Kato", "into": "Customer or #0552"}` | fills a field found by its label or placeholder (`"into": {"sel": "…"}` works too) |
| `{"press": "Enter"}` | a key |
| `{"wait": 400}` · `{"wait": "Placed"}` | a pause; or until that text shows |
| `{"scroll": 300}` · `{"scroll": "Show 34 more"}` | scroll by pixels, or until that is in view |

Every step waits 350 ms after it (`"settle": n` changes that). Run one: `NODE_PATH=$(npm root -g) node tools/parity/run.cjs TD05ToCollect.dc.html`; a tab: `--tab today`; then `node tools/parity/report.cjs`.

Verdicts: `verdicts/<tab>.json`, written by the tab's critic, never by its builder:

```json
{ "TD05ToCollect.dc.html": { "verdict": "pass", "score": 9.0, "note": "", "by": "today critic", "at": "2026-10-30" } }
```
