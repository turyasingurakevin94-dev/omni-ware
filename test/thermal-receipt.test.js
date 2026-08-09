#!/usr/bin/env node
'use strict';
/*
 * The receipt layout, and the paper profiles it lays out onto.
 *
 * Two things are worth testing here and they are both properties rather than
 * examples.
 *
 * The first: no line may be wider than the paper. Not for a long product
 * name, not for a nine-figure total, not on the 42-column head, not on the
 * 32-column one. A line one character too wide does not fail -- it wraps
 * where the printer decides, which moves every column below it.
 *
 * The second: the preview and the paper must say the same thing. The preview
 * exists so nobody has to burn a roll finding out what a receipt looks like,
 * and a preview that is generated separately from the print is a preview of a
 * different document. So the bytes are decoded back to text here and compared
 * against the preview, which is the only check that can actually catch the
 * two drifting apart.
 *
 * Run: node test/thermal-receipt.test.js   (or: npm test)
 */
const { createReporter } = require('./_extract');
const EscPos = require('../drivers/escpos.js');
const Profiles = require('../drivers/profiles.js');
const Receipt = require('../drivers/receipt.js');
const { SAMPLE_DOC } = require('../tools/thermal-print.js');

const t = createReporter('thermal receipt');

/* ---------- 1. the profiles are self-consistent --------------------- */
{
  const keys = Object.keys(Profiles.PAPER);
  t.check(keys.indexOf(Profiles.DEFAULT_PAPER) !== -1, 'the default profile exists');

  const bad = keys.filter((k) => {
    const p = Profiles.PAPER[k];
    const sum = p.itemColumns[0] + p.itemColumns[1] + p.itemColumns[2];
    return sum !== p.columns;
  });
  t.check(bad.length === 0, `every profile's item columns add up to its paper width (${bad.join(', ') || 'all do'})`);

  // 203dpi is what every one of these heads is. A column count that does not
  // follow from the dot count is a typo, and a typo here wraps every line.
  const widths = keys.filter((k) => {
    const p = Profiles.PAPER[k];
    const cell = p.font === 'B' ? 9 : 12;
    return Math.floor(p.widthDots / cell) !== p.columns;
  });
  t.check(widths.length === 0, `column counts follow from dots and font cell width (${widths.join(', ') || 'all do'})`);

  // Web Bluetooth silently ignores a malformed UUID, and the printer using it
  // then never appears in the chooser -- which looks exactly like a printer
  // that is switched off.
  const uuids = Profiles.bleServiceUuids();
  const malformed = uuids.filter((u) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(u));
  t.check(malformed.length === 0, `every BLE service UUID is lower-case and well formed (${malformed.join(', ') || 'all are'})`);
  t.check(new Set(uuids).size === uuids.length, 'no BLE service is listed twice');
  const noWrite = Profiles.BLE_SERVICES.filter((s) => !s.write.length);
  t.check(noWrite.length === 0, 'every BLE service names at least one characteristic to write to');
}

/* ---------- 2. an override cannot break the item table --------------
 *
 * The column count is a setting a shopkeeper can type into. Whatever they
 * type, the three columns still have to fit the line. */
{
  const broken = [];
  for (let W = 16; W <= 96; W++) {
    const { widths } = Receipt.fitItemColumns({ itemColumns: [12, 18, 18] }, W);
    const sum = widths[0] + widths[1] + widths[2];
    if (sum !== W || widths.some((x) => x < 1)) broken.push(`${W} -> ${widths.join('+')} = ${sum}`);
  }
  t.check(broken.length === 0, `item columns fit any width from 16 to 96 (${broken.slice(0, 3).join('; ') || 'all fit'})`);
}

/* ---------- 3. nothing overflows the paper, on any profile ---------- */
{
  // Chosen to be awkward on purpose: a name that has to wrap, a name with no
  // spaces to wrap at, an em dash the code page has to substitute, and a
  // total large enough to fill the money column on the narrowest paper.
  const hostile = {
    shop: { name: 'A Very Long Trading Company Name Limited', lines: ['Plot 44, Sixth Street Industrial Area, Kampala'] },
    title: 'Proforma Invoice',
    meta: [{ label: 'Customer', value: 'A Customer With A Rather Long Name Indeed' }],
    items: [
      { name: 'Supercalifragilisticexpialidociousroofingnailsfourinchgalvanised', qty: 1000, unit: 'Cartons', rate: 987654321 },
      { name: 'Black Wall Plug 8mm — box of 100', note: 'a note that is itself long enough to need wrapping onto another line', qty: 3, unit: 'Box', rate: 12500 },
    ],
    totals: [{ label: 'Total', value: 987691821, emphasis: true }],
    footer: ['A footer line long enough that it has to be wrapped and centred'],
    signatures: ['Received in good condition by'],
  };

  Object.keys(Profiles.PAPER).forEach((key) => {
    const profile = Profiles.make({ paper: key });
    const blocks = Receipt.describe(hostile, profile);
    const over = [];
    blocks.forEach((b) => {
      if (b.type !== 'text') return;
      // A double-width line uses two cells per character, so it may only be
      // half the columns wide. Measuring it against the full width is how a
      // double-height total silently wraps.
      const allowed = Math.floor(profile.columns / (b.width || 1));
      const w = EscPos.textWidth(b.text, profile.codepage);
      if (w > allowed) over.push(`${key} (${w}/${allowed}): ${b.text}`);
    });
    t.check(over.length === 0, `${key}: no block exceeds the paper (${over.slice(0, 2).join(' | ') || 'none'})`);
  });
}

/* ---------- 4. the preview says what the paper says ------------------
 *
 * The bytes are decoded back to text and compared with the preview, line for
 * line, ignoring the alignment the printer applies itself. If a change ever
 * makes the two renderers diverge, this is what notices. */
{
  Object.keys(Profiles.PAPER).forEach((key) => {
    const profile = Profiles.make({ paper: key });
    const preview = Receipt.preview(SAMPLE_DOC, profile).split('\n')
      .map((l) => l.trim()).filter((l) => l.length && !/^-+ {2}\[cut\]$/.test(l));
    const printed = decodeEscPos(Receipt.render(SAMPLE_DOC, profile), profile.codepage)
      .map((l) => l.trim()).filter((l) => l.length);

    const same = preview.length === printed.length
      && preview.every((l, i) => l === printed[i]);
    if (!same) {
      const at = preview.findIndex((l, i) => l !== printed[i]);
      t.fail(`${key}: preview and bytes agree — first difference at line ${at}: `
        + `preview ${JSON.stringify(preview[at])} vs printed ${JSON.stringify(printed[at])}`);
    } else {
      t.pass(`${key}: preview and bytes agree, line for line (${preview.length} lines)`);
    }
  });
}

/* ---------- 5. the parts of a receipt that carry meaning ------------ */
{
  const profile = Profiles.make({ paper: '80mm' });
  const text = Receipt.preview(SAMPLE_DOC, profile);

  t.check(/^\s*Omni-Ware/m.test(text), 'the shop name is on it');
  t.check(/TOTAL/.test(text) && /762,500 UGX/.test(text), 'the total prints with its currency');
  t.check(text.indexOf('TOTAL') < text.indexOf('762,500 UGX'),
    'the label comes above the number, not after it');

  // The grand total is the one number read across a counter. Single height at
  // arm's length on 72mm of print is genuinely hard to read.
  const blocks = Receipt.describe(SAMPLE_DOC, profile);
  const big = blocks.filter((b) => b.type === 'text' && b.width === 2 && /762,500/.test(b.text));
  t.check(big.length === 1, 'the grand total is the only double-width number');

  const amounts = text.split('\n').filter((l) => /^\d[\d,]*\s\w+\s+[\d,]+\s+[\d,]+$/.test(l));
  const ends = new Set(amounts.map((l) => l.length));
  t.check(amounts.length === 3 && ends.size === 1,
    `every item's amount ends in the same column (${amounts.length} rows, ${[...ends].join('/')})`);
}

/* ---------- 6. an empty-ish document still prints -------------------
 *
 * A walk-in sale has no customer, no title and no footer. Every one of those
 * absences should leave the section out, not print an empty heading or throw. */
{
  let bytes = null, err = null;
  try { bytes = Receipt.render({ items: [{ name: 'Sugar', qty: 1, unit: 'Kg', rate: 4500 }] }, Profiles.make({})); }
  catch (e) { err = e; }
  t.check(bytes && bytes.length > 0, `a bare document renders${err ? ` (${err.message})` : ''}`);

  const text = Receipt.preview({ items: [] }, Profiles.make({}));
  t.check(typeof text === 'string', 'a document with no items renders rather than throwing');
  t.check(!/QTY/.test(text), 'and prints no item heading over nothing');

  const noCut = Receipt.render(SAMPLE_DOC, Profiles.make({ paper: '58mm' }));
  t.check(findSeq(noCut, [0x1D, 0x56]) === -1, '58mm has no cutter, so no cut command is sent');
}

/* ---------- 7. money is formatted the same everywhere ---------------
 *
 * toLocaleString gives a different string on different platforms -- a thin
 * space instead of a comma on some ICU builds -- and a group separator one
 * character wider than the layout measured is a column that no longer lines
 * up. So the grouping is done by hand, and this is what holds it there. */
{
  const cases = [[0, '0'], [7, '7'], [999, '999'], [1000, '1,000'], [762500, '762,500'],
    [987654321, '987,654,321'], [-4500, '-4,500'], [1234.6, '1,235']];
  const wrong = cases.filter(([n, want]) => Receipt.money(n) !== want)
    .map(([n, want]) => `${n} -> ${Receipt.money(n)} (want ${want})`);
  t.check(wrong.length === 0, `money groups in threes without a currency symbol (${wrong.join(', ') || 'all correct'})`);
  t.check(Receipt.money(NaN) === '0', 'a bad number prints as 0, not as NaN on a customer receipt');
}

/* ---------- 8. the self-test carries its own answer ------------------ */
{
  [Profiles.make({ paper: '80mm' }), Profiles.make({ paper: '58mm' })].forEach((p) => {
    const lines = decodeEscPos(Receipt.selfTest(p), p.codepage);
    const ruler = lines.filter((l) => /^[.+\d]+$/.test(l) && l.length > 10)[0];
    t.check(!!ruler && ruler.length === p.columns,
      `${p.key}: the ruler is exactly ${p.columns} characters (${ruler ? ruler.length : 'missing'})`);
    t.check(lines.some((l) => l.indexOf(String(p.columns)) !== -1),
      `${p.key}: the page states the column count it was printed at`);
  });
}

/* ================= helpers =================
 *
 * A partial ESC/POS decoder: enough to skip the commands this driver emits
 * and recover the text between them. Deliberately explicit about argument
 * counts -- a command skipped by the wrong number of bytes turns the next
 * argument into text, and the test would then be comparing against noise.
 */
function decodeEscPos(bytes, codepage) {
  const page = EscPos.CODEPAGES[codepage || 'cp437'];
  const high = (page && page.high) || '';
  const data = Array.from(bytes);
  const lines = [];
  let current = '';
  let i = 0;

  while (i < data.length) {
    const b = data[i];

    if (b === 0x1B) {                                  // ESC
      const cmd = data[i + 1];
      if (cmd === 0x40 || cmd === 0x32) { i += 2; continue; }                    // ESC @ / ESC 2
      if ([0x61, 0x45, 0x2D, 0x4D, 0x64, 0x74, 0x33, 0x21].indexOf(cmd) !== -1) { // one argument
        if (cmd === 0x64) { for (let n = 0; n < data[i + 2]; n++) { lines.push(current); current = ''; } }
        i += 3; continue;
      }
      if (cmd === 0x70) { i += 5; continue; }                                    // ESC p m t1 t2
      i += 2; continue;
    }

    if (b === 0x1D) {                                  // GS
      const cmd = data[i + 1];
      if ([0x21, 0x42, 0x68, 0x77, 0x48, 0x4C, 0x57].indexOf(cmd) !== -1) { i += 3; continue; }
      if (cmd === 0x56) { i += (data[i + 2] === 66 || data[i + 2] === 65) ? 4 : 3; continue; }
      if (cmd === 0x6B) { i += 4 + data[i + 3]; continue; }                      // GS k m len data
      if (cmd === 0x28) { i += 5 + data[i + 3] + (data[i + 4] << 8); continue; } // GS ( fn pL pH ...
      if (cmd === 0x76) {                                                        // GS v 0 raster
        const bpr = data[i + 4] + (data[i + 5] << 8);
        const rows = data[i + 6] + (data[i + 7] << 8);
        i += 8 + bpr * rows; continue;
      }
      i += 2; continue;
    }

    if (b === 0x0A) { lines.push(current); current = ''; i++; continue; }
    current += b < 0x80 ? String.fromCharCode(b) : (high.charAt(b - 0x80) || '?');
    i++;
  }
  if (current.length) lines.push(current);
  return lines;
}

function findSeq(arr, seq) {
  const a = Array.from(arr);
  for (let i = 0; i <= a.length - seq.length; i++) {
    let ok = true;
    for (let j = 0; j < seq.length; j++) if (a[i + j] !== seq[j]) { ok = false; break; }
    if (ok) return i;
  }
  return -1;
}

process.exit(t.done() ? 1 : 0);
