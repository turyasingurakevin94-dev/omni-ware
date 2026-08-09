# 80mm Bluetooth thermal printer — universal driver

A brand-agnostic ESC/POS driver for the 80mm Bluetooth receipt printers, plus
the Windows setup it needs. Written against the command language rather than
against any one model, so a POS-80, XP-80, MTP-3, Goojprt, Zjiang or unbranded
unit off a market stall are all the same printer as far as this code is
concerned.

There is no `.inf` file here and there does not need to be one. These printers
do not have a Windows driver in the kernel sense — they take a byte stream of
ESC/POS commands and print it. Point the stream at them and they work. What
this folder gives you is the stream, the pairing, and a way to tell which of
those two is at fault when nothing comes out.

---

## Quick start on Windows

**1. Pair the printer.**
Switch it on, hold the feed button if it needs putting into pairing mode, then
Settings → Bluetooth & devices → Add device → Bluetooth. PIN is `0000` or
`1234` on almost all of them.

**2. Find the port.**

```powershell
powershell -ExecutionPolicy Bypass -File drivers\windows\Setup-ThermalPrinter.ps1 -List
```

Windows creates **two** COM ports for every paired Bluetooth printer, and only
one of them prints. The script says which:

```
Port   Direction  Device            Address
----   ---------  ------            -------
COM4   Incoming                     
COM5   Outgoing   POS-80            0C7A15B3F201
```

**3. Prove it prints.**

```powershell
powershell -ExecutionPolicy Bypass -File drivers\windows\Setup-ThermalPrinter.ps1 -Test -Port COM5
```

A self-test page comes out. Read the ruler line on it — it ends at column 48.
If the tail wrapped onto a second line, your printer is a 42-column head, and
every profile below should be `80mm-narrow` instead.

**4. Print from the app.**
Open `drivers/print-test.html` over `http://localhost` or `https://`, click
**Connect via COM port**, pick the outgoing port, and print. From there the
same driver is what the app uses.

That is the whole setup. Everything below is detail for when a step does not
go like that.

---

## The two ways to print, and which to use

| | Direct (this driver) | Windows printer |
|---|---|---|
| How | The page opens the COM port and writes ESC/POS | Installed as "Generic / Text Only", printed through the normal print dialog |
| Cutting | Yes | No |
| Double-height totals, bold, barcodes, QR | Yes | No |
| Cash drawer | Yes | No |
| Exact 80mm layout | Yes | Approximate |
| Works from other programs | No | Yes |
| Needs Chrome or Edge | Yes | No |

Direct is the better receipt. The Windows printer is worth adding as well —
it costs nothing, it survives the browser being the wrong one, and it is what
the app's existing `window.print()` path can use:

```powershell
# Run PowerShell as Administrator for this one
powershell -ExecutionPolicy Bypass -File drivers\windows\Setup-ThermalPrinter.ps1 -Install -Port COM5
```

Then in Printer properties → Advanced, set the paper size to 80 × 297mm, or
long receipts come out cut short.

---

## Bluetooth Classic vs Bluetooth LE

This is the single most useful thing to know about these printers, and nothing
in Windows tells you which one you have.

- **Classic (SPP)** — nearly every counter-top 80mm printer. Pairs in Windows,
  becomes a COM port, and is reached through **Connect via COM port**. Web
  Bluetooth *cannot see it at all*: the API has no RFCOMM, so a Classic
  printer will never appear in the Bluetooth chooser no matter how long you
  wait. That is not a fault to debug.
- **Low Energy (BLE)** — the pocket 58mm printers and a few newer 80mm units.
  No COM port; reached through **Connect via Bluetooth LE**.

Rule of thumb: if it paired and produced a COM port, use serial. If it paired
and produced nothing, or will not pair at all but is visible to phones, it is
LE.

---

## The files

| File | What it is |
|---|---|
| `escpos.js` | The command encoder. Text → bytes, code pages, column arithmetic, cut, barcode, QR, raster logo. No transport, no app. |
| `profiles.js` | What "80mm" means per printer — 48 vs 42 vs 64 columns, code page, cutter — plus the BLE service UUIDs the chooser has to ask for. |
| `receipt.js` | A receipt document → layout → bytes, and the same layout → a text preview, so the screen and the paper cannot disagree. |
| `transports.js` | Web Serial (COM port), Web Bluetooth (LE), and save-to-file. Same three methods on each. |
| `printer.js` | What the app uses: connect, print, printReceipt, selfTest, remembered settings, a queue so two prints cannot interleave. |
| `print-test.html` | Setup and diagnosis on one page. Connect, choose paper, see the exact bytes, print. |
| `windows/Setup-ThermalPrinter.ps1` | Find the outgoing port, test it, install it as a Windows printer. No dependencies. |
| `../tools/thermal-print.js` | The same driver from a terminal, for when you need to know whether the printer or the browser is at fault. |

---

## Using it from a page

Classic scripts, in this order — `escpos.js` first, `printer.js` last:

```html
<script src="drivers/escpos.js"></script>
<script src="drivers/profiles.js"></script>
<script src="drivers/receipt.js"></script>
<script src="drivers/transports.js"></script>
<script src="drivers/printer.js"></script>
```

```js
const printer = new ThermalPrinter();

// From a click — both browsers refuse a chooser without a user gesture.
document.getElementById('connect').addEventListener('click', () => {
  printer.connect('serial').catch(err => toast(err.message));
});

// A previously granted port reopens with no dialog. Safe to call on load.
printer.reconnect();

printer.printReceipt({
  shop: { name: 'Kevin Hardware', lines: ['Nakawa, Kampala', 'Tel 0700 000 000'] },
  title: 'Receipt',
  meta: [
    { label: 'Date',       value: '2026-08-09' },
    { label: 'Receipt No', value: 'INV-0142' },
    { label: 'Customer',   value: 'Musa Ssekandi' },
  ],
  items: [
    { name: 'Cement (Tororo 50kg)', qty: 20, unit: 'Bag', rate: 34000 },
    { name: 'Black Wall Plug 8mm',  qty: 3,  unit: 'Box', rate: 12500, note: 'ordered in' },
  ],
  totals: [
    { label: 'Subtotal', value: 717500 },
    { label: 'Total',    value: 717500, emphasis: true },   // double height
  ],
  signatures: ['Served by'],
  footer: ['Thank you for your business'],
  qr: { data: 'https://omni-ware.app/r/INV-0142', caption: 'Scan to verify' },
});
```

Every field is optional except `items`. A walk-in sale with no customer simply
leaves `meta` out rather than printing an empty heading.

To keep the existing print dialog as a fallback when no printer is connected:

```js
printer.printReceiptOrFallback(doc, () => window.print())
  .then(how => toast(how === 'thermal' ? 'Printed' : 'Sent to the print dialog'));
```

And to show the customer what will come out before it does:

```js
document.getElementById('preview').textContent = printer.previewReceipt(doc);
```

The preview is generated from the same layout as the bytes and round-tripped
through the encoder, so what it shows — including the substitutions, an em
dash printing as `-` — is exactly what the paper will say.

---

## Settings

`printer.update({ ... })`, remembered in `localStorage`:

| Setting | Default | Notes |
|---|---|---|
| `paper` | `80mm` | `80mm` (48 col), `80mm-narrow` (42), `80mm-small` (64, small font), `58mm` (32) |
| `columns` | from profile | Override when a printer is neither |
| `codepage` | `cp437` | `cp1252` if shop or customer names carry accents |
| `baudRate` | `9600` | Ignored over Bluetooth; matters for a wired serial printer |
| `cutter` | `true` | Off feeds paper instead of cutting |
| `drawer` | `false` | Kick the till on each receipt |

---

## When it does not work

**Nothing comes out, no error.**
You are on the incoming port. Windows makes two and does not label them; run
`-List` and use the one marked Outgoing.

**"Failed to open serial port".**
Something else has it open — a POS program, a printer utility, a second tab
of this app — or the printer is switched off. Windows keeps listing the port
either way.

**Prints a few lines then stops mid-receipt.**
Buffer overrun. The driver already paces its writes; if it still happens the
link is slow, so raise `chunkDelayMs` on the transport.

**Prints garbage / line-drawing characters.**
On a wired serial printer, the baud rate is wrong — try 115200. Over
Bluetooth, baud is irrelevant and garbage means the bytes are being widened
somewhere: something is sending UTF-8 rather than single-byte code page text.

**Every line wraps six characters early.**
The head is 42 columns, not 48. Switch the profile to `80mm-narrow`.

**Accented names print as `?`.**
CP437 does not have that character. Switch to `cp1252`.

**The Bluetooth chooser is empty.**
The printer is Bluetooth Classic — see above. Use the COM port.

**Web Serial button is missing or disabled.**
Firefox and Safari have no Web Serial. Use Chrome or Edge, and serve the page
over `https://` or `http://localhost` — Web Serial refuses on an insecure
origin, which looks the same as a missing printer.

**It prints from the terminal but not from the app.**

```
node tools/thermal-print.js --port COM5 --test
```

If that prints, the printer and the pairing are fine and the problem is in the
page — most often the port is still held open by another tab.

---

## Android

The worker app is Capacitor, and Android WebView has neither Web Serial nor
Web Bluetooth, so the browser transports do not apply there. The encoder,
profiles and receipt layout do: `receipt.js` produces the bytes, and a
Capacitor Bluetooth plugin writes them to the printer's SPP socket. That
plugin is not in this repo yet — the driver is written so that adding it is
one more transport with the same three methods, not a second layout.
