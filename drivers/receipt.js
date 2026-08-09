/*
 * A receipt, laid out for whatever width the paper turns out to be.
 *
 * The layout is done twice, from one description: once into bytes for the
 * printer and once into plain text for the screen. That is the point of the
 * middle step -- a preview built separately from the print is a preview that
 * disagrees with the paper, and the disagreement is always discovered by a
 * customer holding a receipt whose total sits in the wrong place.
 *
 * So: describe(doc) -> blocks -> bytes, and blocks -> text. Two consumers,
 * one arrangement, and a test can assert on the text knowing the bytes said
 * the same thing.
 */
(function (root, factory) {
  'use strict';
  var api = factory(
    typeof require === 'function' ? require('./escpos.js') : root.EscPos
  );
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ThermalReceipt = api;
}(typeof self !== 'undefined' ? self : this, function (EscPos) {
  'use strict';

  if (!EscPos) throw new Error('receipt.js needs escpos.js loaded first');

  /* ---------------- money ----------------
   *
   * Grouped by hand rather than through toLocaleString. The app runs on
   * phones, desktop browsers and Node, and toLocaleString('en-UG') gives a
   * different string on some of them -- a thin space instead of a comma, on
   * the platforms whose ICU data has one. A receipt column that is one
   * character wider than it was measured to be is a column that no longer
   * lines up, so the width has to be decided here and not by the runtime.
   */
  function groupNumber(n) {
    var num = Number(n);
    if (!isFinite(num)) return '0';
    var neg = num < 0;
    var s = String(Math.round(Math.abs(num)));
    var out = '';
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) out += ',';
      out += s.charAt(i);
    }
    return (neg ? '-' : '') + out;
  }

  // Money on a receipt is bare. The currency belongs in the heading or on
  // the total line, not repeated down a column where it costs four
  // characters a row and tells nobody anything new.
  function money(n) { return groupNumber(n); }

  /* ---------------- the document ----------------
   *
   * Everything is optional except items. A walk-in sale has no customer, a
   * proforma has no payment, and a printer with no cutter has no cut -- and
   * each of those absences should simply leave the section out rather than
   * print an empty heading.
   */
  function normalise(doc) {
    var d = doc || {};
    return {
      shop: {
        name: str(d.shop && d.shop.name) || 'Omni-Ware',
        lines: arr(d.shop && d.shop.lines).map(str).filter(nonEmpty),
      },
      title: str(d.title),
      meta: arr(d.meta).filter(function (m) { return m && nonEmpty(str(m.value)); })
        .map(function (m) { return { label: str(m.label), value: str(m.value) }; }),
      items: arr(d.items).map(function (it) {
        return {
          name: str(it.name) || '(unnamed)',
          note: str(it.note),
          qty: it.qty === undefined || it.qty === null ? '' : String(it.qty),
          unit: str(it.unit),
          rate: it.rate === undefined || it.rate === null ? null : Number(it.rate),
          amount: it.amount === undefined || it.amount === null
            ? (it.rate === undefined || it.rate === null ? null : Number(it.qty || 0) * Number(it.rate))
            : Number(it.amount),
        };
      }),
      totals: arr(d.totals).filter(function (t) { return t && nonEmpty(str(t.label)); })
        .map(function (t) {
          return {
            label: str(t.label),
            value: typeof t.value === 'number' ? money(t.value) : str(t.value),
            emphasis: !!t.emphasis,
          };
        }),
      notes: arr(d.notes).map(str).filter(nonEmpty),
      signatures: arr(d.signatures).map(str).filter(nonEmpty),
      footer: arr(d.footer).map(str).filter(nonEmpty),
      qr: d.qr && str(d.qr.data || d.qr) ? { data: str(d.qr.data || d.qr), caption: str(d.qr.caption) } : null,
      barcode: d.barcode && str(d.barcode.data || d.barcode)
        ? { data: str(d.barcode.data || d.barcode), caption: str(d.barcode.caption) } : null,
      logo: d.logo || null,
      currency: d.currency === undefined ? 'UGX' : str(d.currency),
      cut: d.cut !== false,
      drawer: !!d.drawer,
    };
  }

  /* ---------------- blocks ----------------
   *
   * The intermediate form. A block is a line of text plus how it should be
   * printed, or one of the few things that are not text at all. Deliberately
   * flat: nesting would need a layout pass, and there is nothing on a receipt
   * that a list of lines cannot express.
   */
  function describe(doc, profile) {
    var p = profile || {};
    var W = Math.max(16, p.columns || 48);
    var page = p.codepage || 'cp437';
    var d = normalise(doc);
    var out = [];

    function text(t, opts) {
      var o = opts || {};
      out.push({
        type: 'text', text: t,
        align: o.align || 'left', bold: !!o.bold,
        width: o.width || 1, height: o.height || 1,
      });
    }
    function wrapped(t, opts) {
      var o = opts || {};
      // A double-width heading fits half as many characters. Wrapping it
      // against the full width is why long shop names come off the printer
      // broken across the middle of a word.
      var effective = Math.floor(W / (o.width || 1));
      EscPos.wrapText(t, effective, page).forEach(function (line) { text(line, o); });
    }
    function rule(ch) { out.push({ type: 'rule', ch: ch || '-' }); }

    /* -- letterhead -- */
    if (d.logo) out.push({ type: 'image', bitmap: d.logo, align: 'center' });
    wrapped(d.shop.name, { align: 'center', bold: true, width: 2, height: 2 });
    d.shop.lines.forEach(function (l) { wrapped(l, { align: 'center' }); });
    if (d.title) {
      out.push({ type: 'feed', lines: 1 });
      wrapped(d.title.toUpperCase(), { align: 'center', bold: true });
    }

    /* -- who and when --
     * Label left, value right, on one line each. Two per line would fit and
     * would be worse: "Date" and "Receipt No" are read by eye, one at a
     * time, and a customer checking a number should not have to find which
     * half of the line it is in. */
    if (d.meta.length) {
      rule();
      d.meta.forEach(function (m) {
        out.push({ type: 'text', text: EscPos.twoColumn(m.label + ':', m.value, W, page), align: 'left' });
      });
    }

    /* -- what was sold --
     * Name on its own line so it is never truncated, then the numbers
     * underneath in fixed columns so every row lines up down the page. The
     * obvious alternative -- name and numbers on one line -- costs about 20
     * characters of name, which on a hardware shop's stock list means most
     * items print as an unrecognisable prefix. */
    if (d.items.length) {
      rule();
      var cols = fitItemColumns(p, W);
      out.push({
        type: 'text', bold: true,
        text: EscPos.columns(['QTY', 'RATE', 'AMOUNT'], cols.widths, cols.aligns, page),
      });
      rule();
      d.items.forEach(function (it) {
        EscPos.wrapText(it.name, W, page).forEach(function (line) {
          text(line, { bold: true });
        });
        if (it.note) EscPos.wrapText(it.note, W, page).forEach(function (line) { text(line); });
        var qty = (it.qty + (it.unit ? ' ' + it.unit : '')).trim();
        out.push({
          type: 'text',
          text: EscPos.columns(
            [qty, it.rate === null ? '' : money(it.rate), it.amount === null ? '' : money(it.amount)],
            cols.widths, cols.aligns, page),
        });
      });
    }

    /* -- totals --
     * The grand total prints double height. It is the one number anyone
     * reads across a counter, and on 57mm-of-print at arm's length the
     * single-height version genuinely is hard to read. */
    if (d.totals.length) {
      rule('=');
      d.totals.forEach(function (t) {
        if (t.emphasis) {
          var half = Math.floor(W / 2);
          var value = t.value + (d.currency ? ' ' + d.currency : '');
          // Label first, then the number underneath in double height. The
          // other way round reads as a number with a stray word after it,
          // and the word is what tells you which number it was.
          out.push({ type: 'text', align: 'right', bold: true, text: t.label.toUpperCase() });
          out.push({
            type: 'text', bold: true, width: 2, height: 2, align: 'right',
            text: EscPos.truncate(value, half, page),
          });
        } else {
          out.push({ type: 'text', text: EscPos.twoColumn(t.label, t.value, W, page) });
        }
      });
    }

    /* -- notes, signatures, footer -- */
    if (d.notes.length) {
      rule();
      d.notes.forEach(function (n) { wrapped(n); });
    }
    if (d.signatures.length) {
      out.push({ type: 'feed', lines: 1 });
      d.signatures.forEach(function (s) {
        // The label is truncated to leave room for the line rather than the
        // line shortened to fit the label: "Received in good condition by"
        // on 32-column paper would otherwise push the row four characters
        // past the edge, and a signature line that wraps is two lines with
        // nowhere to sign on either.
        var room = Math.max(4, W - 6);
        var label = EscPos.truncate(String(s), room, page) + ': ';
        var dots = EscPos.repeat('.', Math.max(1, W - EscPos.textWidth(label, page)));
        out.push({ type: 'text', text: label + dots });
        out.push({ type: 'feed', lines: 1 });
      });
    }

    if (d.barcode) {
      out.push({ type: 'feed', lines: 1 });
      out.push({ type: 'barcode', data: d.barcode.data, align: 'center' });
      if (d.barcode.caption) wrapped(d.barcode.caption, { align: 'center' });
    }
    if (d.qr) {
      out.push({ type: 'feed', lines: 1 });
      out.push({ type: 'qr', data: d.qr.data, align: 'center' });
      if (d.qr.caption) wrapped(d.qr.caption, { align: 'center' });
    }

    if (d.footer.length) {
      out.push({ type: 'feed', lines: 1 });
      d.footer.forEach(function (f) { wrapped(f, { align: 'center' }); });
    }

    if (d.drawer) out.push({ type: 'drawer' });
    if (d.cut) out.push({ type: 'cut' });
    return out;
  }

  /*
   * The item table's three columns, checked against the paper rather than
   * trusted from the profile. A profile edited by hand (or a custom column
   * count typed into the settings) can easily add up to more than the line
   * holds, and columns that overflow do not error -- they wrap, and take the
   * rest of the receipt's alignment with them.
   */
  function fitItemColumns(profile, W) {
    var want = (profile && profile.itemColumns) || [12, 18, 18];
    var sum = want[0] + want[1] + want[2];
    var widths;
    if (sum === W) {
      widths = want.slice();
    } else {
      // Keep the two money columns whole and give the slack (or take it)
      // from qty, which is short text and can afford it.
      var money2 = Math.min(want[1] + want[2], Math.floor(W * 0.75));
      var each = Math.floor(money2 / 2);
      widths = [W - each * 2, each, each];
      if (widths[0] < 6) { widths = [6, Math.floor((W - 6) / 2), W - 6 - Math.floor((W - 6) / 2)]; }
    }
    return { widths: widths, aligns: ['left', 'right', 'right'] };
  }

  /* ---------------- blocks -> plain text ----------------
   *
   * The preview. Double-width text is shown as-is rather than stretched,
   * with the line right-aligned in half the width so it lands where it will
   * land on paper.
   */
  function toText(blocks, profile) {
    var W = Math.max(16, (profile && profile.columns) || 48);
    var page = (profile && profile.codepage) || 'cp437';
    var lines = [];
    blocks.forEach(function (b) {
      if (b.type === 'rule') { lines.push(EscPos.rule(W, b.ch)); return; }
      if (b.type === 'feed') { for (var i = 0; i < (b.lines || 1); i++) lines.push(''); return; }
      if (b.type === 'cut') { lines.push(EscPos.rule(W, '-') + '  [cut]'); return; }
      if (b.type === 'drawer') { lines.push('[open cash drawer]'); return; }
      if (b.type === 'qr') { lines.push(centre('[QR: ' + b.data + ']', W, page)); return; }
      if (b.type === 'barcode') { lines.push(centre('[barcode: ' + b.data + ']', W, page)); return; }
      if (b.type === 'image') { lines.push(centre('[logo]', W, page)); return; }
      // A double-width line occupies two cells per character, so it is
      // aligned inside half the paper and then that half is placed on the
      // paper -- which is what the printer does, and why a right-aligned
      // double-height total sits where the preview shows it.
      var mult = b.width || 1;
      var effective = Math.floor(W / mult);
      // Through the encoder and back, so the preview shows the substitutions
      // the printer will actually receive rather than the source text.
      var t = EscPos.previewText(b.text === undefined ? '' : String(b.text), page);
      if (b.align === 'center') t = centre(t, effective, page);
      else if (b.align === 'right') t = pad(t, effective, page);
      if (mult > 1 && b.align === 'right') t = EscPos.repeat(' ', W - effective) + t;
      lines.push(t);
    });
    return lines.join('\n');
  }

  function centre(t, w, page) {
    var pad0 = w - EscPos.textWidth(t, page);
    if (pad0 <= 0) return t;
    return EscPos.repeat(' ', Math.floor(pad0 / 2)) + t;
  }
  function pad(t, w, page) {
    var p = w - EscPos.textWidth(t, page);
    return p <= 0 ? t : EscPos.repeat(' ', p) + t;
  }

  /* ---------------- blocks -> bytes ---------------- */

  function toBytes(blocks, profile) {
    var job = new EscPos.Job(profile);
    job.init();
    var state = { align: 'left', bold: false, width: 1, height: 1 };

    blocks.forEach(function (b) {
      if (b.type === 'feed') { job.feed(b.lines || 1); return; }
      if (b.type === 'cut') { job.cut(); return; }
      if (b.type === 'drawer') { job.drawer(2); return; }
      if (b.type === 'rule') { apply(job, state, { align: 'left', bold: false, width: 1, height: 1 }); job.rule(b.ch); return; }
      if (b.type === 'qr') { apply(job, state, { align: b.align || 'center', bold: false, width: 1, height: 1 }); job.qr(b.data); job.line(''); return; }
      if (b.type === 'barcode') { apply(job, state, { align: b.align || 'center', bold: false, width: 1, height: 1 }); job.barcode(b.data); job.line(''); return; }
      if (b.type === 'image') { apply(job, state, { align: b.align || 'center', bold: false, width: 1, height: 1 }); job.image(b.bitmap); return; }
      apply(job, state, b);
      job.line(b.text === undefined ? '' : b.text);
    });

    // Leave the printer as it was found. The next job may come from another
    // program on the same COM port, and inheriting someone else's bold is
    // exactly the sort of fault that gets blamed on the printer.
    apply(job, state, { align: 'left', bold: false, width: 1, height: 1 });
    return job.toBytes();
  }

  // Only the differences are sent. Re-asserting every attribute per line
  // triples the byte count, and on a 9600-baud Bluetooth link byte count is
  // wall-clock time -- about a second per extra kilobyte.
  function apply(job, state, want) {
    var a = want.align || 'left', bold = !!want.bold;
    var w = want.width || 1, h = want.height || 1;
    if (a !== state.align) { job.align(a); state.align = a; }
    if (bold !== state.bold) { job.bold(bold); state.bold = bold; }
    if (w !== state.width || h !== state.height) { job.size(w, h); state.width = w; state.height = h; }
  }

  /* ---------------- one call ---------------- */

  function render(doc, profile) { return toBytes(describe(doc, profile), profile); }
  function preview(doc, profile) { return toText(describe(doc, profile), profile); }

  /*
   * The self-test page.
   *
   * Its job is to answer, on one piece of paper, every question that comes
   * up when a printer will not print properly: how many columns the head
   * really has, whether the code page is right, whether bold and double
   * height work, and whether the cutter fires. The ruler line is the
   * important one -- if its last visible character is not the profile's
   * column count, the profile is wrong and everything else follows from
   * that.
   */
  function selfTest(profile) {
    var p = profile || {};
    var W = Math.max(16, p.columns || 48);
    var job = new EscPos.Job(p);
    job.init();
    job.align('center').bold(true).size(2, 2).line('OMNI-WARE');
    job.size(1, 1).line('Printer self-test').bold(false);
    job.align('left').rule();

    job.line('Profile : ' + (p.key || '?') + '  (' + W + ' cols)');
    job.line('Codepage: ' + (p.codepage || 'cp437'));
    job.line('Font    : ' + (p.font || 'A') + '   Cutter: ' + (p.cutter === false ? 'no' : 'yes'));
    job.rule();

    // The ruler. Every tenth column is marked, and the line ends exactly at
    // the profile's width -- so a head that is narrower than the profile
    // wraps the tail onto a second line, visibly.
    var ruler = '';
    for (var i = 1; i <= W; i++) ruler += (i % 10 === 0) ? String((i / 10) % 10) : (i % 5 === 0 ? '+' : '.');
    job.line(ruler);
    job.line(EscPos.twoColumn('column ' + W + ' is', '<END|', W, p.codepage || 'cp437'));
    job.rule();

    job.bold(true).line('Bold text').bold(false);
    job.size(2, 1).line('Double width').size(1, 2).line('Double height').size(1, 1);
    job.line('Money: ' + money(1234567) + ' UGX');
    job.line('Accents: Cafe Munyonyo Nakawa');
    job.align('right').line('right').align('center').line('centre').align('left').line('left');
    job.rule('=');
    job.align('center').line('If this page reads correctly,').line('the printer is set up.');
    job.align('left');
    job.cut();
    return job.toBytes();
  }

  /* ---------------- helpers ---------------- */
  function str(x) { return x === null || x === undefined ? '' : String(x); }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function nonEmpty(s) { return String(s).trim().length > 0; }

  return {
    describe: describe, toText: toText, toBytes: toBytes,
    render: render, preview: preview, selfTest: selfTest,
    normalise: normalise, fitItemColumns: fitItemColumns,
    money: money, groupNumber: groupNumber,
  };
}));
