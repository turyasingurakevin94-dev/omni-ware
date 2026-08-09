#!/usr/bin/env node
'use strict';
/*
 * The ESC/POS encoder.
 *
 * Nothing here can be checked by looking at it. A wrong constant in a command
 * is not a syntax error and not a crash -- it is a printer that feeds three
 * blank lines instead of cutting, or one that prints `V B` down the middle of
 * a receipt, and the only place that shows up is on paper in a shop.
 *
 * So the byte sequences are asserted directly against what the ESC/POS
 * specification says they are, and the column arithmetic is asserted against
 * the one property that matters on 80mm paper: no line may be wider than the
 * paper, ever, whatever is fed into it.
 *
 * Run: node test/thermal-escpos.test.js   (or: npm test)
 */
const { createReporter } = require('./_extract');
const EscPos = require('../drivers/escpos.js');

const t = createReporter('thermal escpos');

/* ---------- 1. the code page tables ------------------------------- */
{
  // A page whose high half is not exactly 128 characters maps every byte
  // above it to the wrong glyph, silently. The encoder throws on that; here
  // we check the shipped tables are the right size in the first place.
  t.check(EscPos.CODEPAGES.cp437.high.length === 128, 'CP437 high half is 128 characters');
  t.check(EscPos.CODEPAGES.cp1252.high.length === 128, 'CP1252 high half is 128 characters');
  t.check(EscPos.CODEPAGES.cp850.high === null, 'CP850 is selectable but has no reverse table');

  const e = (s, p) => EscPos.encodeText(s, p);
  t.check(e('A', 'cp437')[0] === 65, 'ASCII passes straight through');
  t.check(e('é', 'cp437')[0] === 0x82, 'é is 0x82 in CP437');
  t.check(e('é', 'cp1252')[0] === 0xE9, 'é is 0xE9 in CP1252');
  t.check(e('£', 'cp437')[0] === 0x9C, '£ is 0x9C in CP437');
  t.check(e('—', 'cp1252')[0] === 0x97, 'the em dash exists in CP1252 and is used');
}

/* ---------- 2. transliteration -------------------------------------
 *
 * The em dash is the app's house punctuation -- it is in shop straplines,
 * item notes and half the footers -- and CP437 has no byte for it. Left
 * alone it prints as a box-drawing character. */
{
  const dash = EscPos.encodeText('a—b', 'cp437');
  t.check(dash.length === 3 && dash[1] === 0x2D, 'an em dash becomes a hyphen on CP437');

  const ell = EscPos.encodeText('…', 'cp437');
  t.check(ell.length === 3 && ell.every((b) => b === 0x2E), 'an ellipsis becomes three dots');

  const quoted = EscPos.previewText('“quoted”', 'cp437');
  t.check(quoted === '"quoted"', `curly quotes become straight ones (${quoted})`);

  const emoji = EscPos.encodeText('a😀b', 'cp437');
  t.check(emoji.length === 3 && emoji[1] === 0x3F,
    `a surrogate pair produces ONE '?', not two (${emoji.length} bytes)`);

  t.check(EscPos.encodeText('a​b', 'cp437').length === 2, 'a zero-width space encodes to nothing');
}

/* ---------- 3. width is measured the way it is encoded --------------
 *
 * The whole layout rests on this. If textWidth() and encodeText() disagree by
 * one character, every column on the receipt is out by one -- and the two can
 * only be guaranteed to agree by measuring through the encoder. */
{
  const samples = ['plain', 'em—dash', 'ellipsis…', '“quoted”', 'Café', '', 'a​b', '😀'];
  const mismatches = samples.filter((s) =>
    EscPos.textWidth(s, 'cp437') !== EscPos.previewText(s, 'cp437').length);
  t.check(mismatches.length === 0,
    `measured width equals printed width for every sample (${mismatches.join(', ') || 'all match'})`);
}

/* ---------- 4. nothing ever exceeds the paper -----------------------
 *
 * The property, not the examples. A line one character too wide does not
 * error, it wraps in the printer's own way, and takes the alignment of
 * everything after it with it. */
{
  const nasty = [
    'Supercalifragilisticexpialidociousrooofingnailsfourinch',
    'a b c d e f g h i j k l m n o p q r s t u v w x y z',
    'Black Wall Plug 8mm — box of 100',
    'ends with an ellipsis…………………',
    '',
  ];
  [32, 42, 48, 64].forEach((W) => {
    const over = [];
    nasty.forEach((s) => {
      EscPos.wrapText(s, W, 'cp437').forEach((line) => {
        if (EscPos.textWidth(line, 'cp437') > W) over.push(`${W}: ${line}`);
      });
      if (EscPos.textWidth(EscPos.twoColumn(s, '1,234,567', W, 'cp437'), 'cp437') > W) {
        over.push(`${W} twoColumn: ${s}`);
      }
      if (EscPos.textWidth(EscPos.truncate(s, W, 'cp437'), 'cp437') > W) over.push(`${W} truncate: ${s}`);
    });
    t.check(over.length === 0, `nothing exceeds ${W} columns (${over.length} overflow)`);
  });
}

/* ---------- 5. two columns: money never truncates -------------------
 *
 * A clipped item name is a shorter name. A clipped price is a wrong receipt,
 * so when the two cannot both fit it is the name that gives way. */
{
  const line = EscPos.twoColumn('An item with a name far too long to sit beside a number', '1,234,567', 32, 'cp437');
  t.check(line.length === 32, `the line is exactly the paper width (${line.length})`);
  t.check(line.endsWith('1,234,567'), 'the money is intact and hard right');
  t.check(/\.\s+1,234,567$/.test(line), `the truncation is marked, not silent (${line})`);

  const spaced = EscPos.twoColumn('Total', '500', 20, 'cp437');
  t.check(spaced === 'Total            500', `short sides are filled with spaces (${JSON.stringify(spaced)})`);
}

/* ---------- 6. fixed columns line up -------------------------------- */
{
  const rows = [
    ['20 Bag', '34,000', '680,000'],
    ['3', '12,500', '37,500'],
    ['1,000 Pieces of something', '9', '9,000,000'],
  ].map((cells) => EscPos.columns(cells, [12, 18, 18], ['left', 'right', 'right'], 'cp437'));

  const ends = rows.map((r) => r.length);
  t.check(ends.every((n) => n <= 48), `no row exceeds 48 columns (${ends.join(', ')})`);
  t.check(rows.every((r) => r.length === 48 || /\S$/.test(r)), 'rows are right-trimmed, not space-padded');
  const amountCol = rows.map((r) => r.length);
  t.check(new Set(amountCol).size === 1, `every amount ends in the same column (${amountCol.join(', ')})`);
}

/* ---------- 7. the commands ----------------------------------------
 *
 * Checked against the specification, byte for byte. These are the ones whose
 * being wrong is invisible until a customer is standing at the counter. */
{
  const bytes = (arr) => Array.from(arr).join(',');

  t.check(bytes(EscPos.sizeCmd(2, 2)) === '29,33,17', 'GS ! packs 2x2 as 0x11');
  t.check(bytes(EscPos.sizeCmd(1, 1)) === '29,33,0', 'GS ! packs 1x1 as 0x00');
  t.check(bytes(EscPos.sizeCmd(99, 0)) === '29,33,112', 'GS ! clamps to the 1..8 the printers accept');

  // Function B, with a feed argument. `GS V 1` with no feed takes the blade
  // through the last two lines of the receipt.
  t.check(bytes(EscPos.cutCmd(0)) === '29,86,66,0', 'the cut is GS V 66 n (feed, then cut)');

  t.check(bytes(EscPos.drawerCmd(2)) === '27,112,0,25,250', 'the drawer kick is ESC p 0 25 250');
  t.check(bytes(EscPos.drawerCmd(5)) === '27,112,1,25,250', 'pin 5 selects connector 1');

  t.check(bytes(EscPos.codepageCmd(16)) === '27,116,16', 'the code page is ESC t n');
  t.check(bytes(EscPos.feedCmd(3)) === '27,100,3', 'the feed is ESC d n');
}

/* ---------- 8. barcode and QR --------------------------------------- */
{
  const bc = EscPos.barcode('INV-0142');
  const idx = bc.indexOf(0x6B);                       // GS k
  t.check(idx > 0 && bc[idx - 1] === 0x1D, 'the barcode uses GS k');
  t.check(bc[idx + 1] === 73, 'symbology 73 is CODE128');
  const len = bc[idx + 2];
  t.check(len === bc.length - idx - 3, `the length prefix matches the data (${len})`);
  t.check(bc[idx + 3] === 0x7B && bc[idx + 4] === 0x42,
    'the data is prefixed {B, or the first two characters are eaten as the code set');

  let threw = false;
  try { EscPos.barcode('x'.repeat(300)); } catch (e) { threw = true; }
  t.check(threw, 'a barcode too long for the one-byte length throws rather than truncating');

  const qr = EscPos.qrCode('https://example.test/r/1');
  const store = findSeq(qr, [0x1D, 0x28, 0x6B]);
  t.check(store >= 0, 'the QR uses GS ( k');
  // Store, then print: the data command must be followed by the print
  // command, or the code is held in the buffer and nothing appears.
  t.check(findSeq(qr, [0x31, 0x51, 0x30]) > findSeq(qr, [0x31, 0x50, 0x30]),
    'the print command (49 81 48) comes after the store command (49 80 48)');
}

/* ---------- 9. the job builder -------------------------------------- */
{
  const job = new EscPos.Job({ columns: 48, codepage: 'cp437', cutter: true });
  const out = Array.from(job.init().bold(true).line('Hi').bold(false).cut().toBytes());

  t.check(out[0] === 0x1B && out[1] === 0x40, 'a job starts with ESC @');
  t.check(findSeq(out, [0x1B, 0x74, 0x00]) > 0, 'the code page is selected up front');
  t.check(out[out.length - 4] === 0x1D && out[out.length - 3] === 0x56, 'a job ends with the cut');

  const noCut = new EscPos.Job({ columns: 32, cutter: false });
  const nb = Array.from(noCut.init().line('x').cut().toBytes());
  t.check(findSeq(nb, [0x1D, 0x56]) === -1, 'a printer declared without a cutter is never sent GS V');
  t.check(nb[nb.length - 3] === 0x1B && nb[nb.length - 2] === 0x64, 'it gets a feed instead');

  const rule = new EscPos.Job({ columns: 32 }).rule('-').toBytes();
  t.check(rule.length === 33, `a rule is exactly the column count plus its newline (${rule.length})`);
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
