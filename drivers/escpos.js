/*
 * ESC/POS — the command language every 80mm thermal printer already speaks.
 *
 * There is no such thing as a driver for one of these printers in the sense
 * Windows means the word. The cheap 80mm Bluetooth units sold as "POS-80",
 * "XP-80", "MTP-3", "Goojprt", "Zjiang" and a hundred other names are all the
 * same handful of boards, and they all take the same thing over the wire: a
 * byte stream of Epson ESC/POS commands. Point that stream at the printer and
 * it prints. That is the whole contract, and it is why one encoder can be
 * universal where a per-model driver could not.
 *
 * So this file is the driver. It knows nothing about Bluetooth, serial ports
 * or the app -- it turns text and layout into the bytes, and something else
 * carries them (see transports.js).
 *
 * Loads as a plain <script> in the browser (window.EscPos) and as a module in
 * Node (module.exports), because this repo has no build step and the tests
 * run under bare node.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EscPos = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------- The command bytes ----------------
   *
   * Named rather than inlined. `[0x1D, 0x56, 66, 0]` at a call site is
   * unreadable and, worse, unverifiable -- nobody reviewing it can tell a
   * partial cut from a full one, so a wrong constant survives review. */
  var ESC = 0x1B, GS = 0x1D, LF = 0x0A;

  var CMD = {
    INIT: [ESC, 0x40],                 // ESC @   -- reset: clears leftover bold,
                                       //            size and alignment from a
                                       //            print that failed halfway.
    ALIGN_LEFT: [ESC, 0x61, 0],        // ESC a n
    ALIGN_CENTER: [ESC, 0x61, 1],
    ALIGN_RIGHT: [ESC, 0x61, 2],
    BOLD_ON: [ESC, 0x45, 1],           // ESC E n
    BOLD_OFF: [ESC, 0x45, 0],
    UNDERLINE_OFF: [ESC, 0x2D, 0],     // ESC - n
    UNDERLINE_ON: [ESC, 0x2D, 1],
    FONT_A: [ESC, 0x4D, 0],            // ESC M n -- 12x24 dots
    FONT_B: [ESC, 0x4D, 1],            //            9x17 dots, ~33% more columns
    LINESPACING_DEFAULT: [ESC, 0x32],  // ESC 2
    INVERT_ON: [GS, 0x42, 1],          // GS B n  -- white on black
    INVERT_OFF: [GS, 0x42, 0],
  };

  // GS ! n -- one nibble each for width and height multiplier, 1..8.
  function sizeCmd(w, h) {
    var cw = clampInt(w, 1, 8) - 1, ch = clampInt(h, 1, 8) - 1;
    return [GS, 0x21, (cw << 4) | ch];
  }
  // ESC t n -- which character table the following bytes are read against.
  function codepageCmd(n) { return [ESC, 0x74, clampInt(n, 0, 255)]; }
  // ESC d n -- feed n lines.
  function feedCmd(n) { return [ESC, 0x64, clampInt(n, 0, 255)]; }

  /* GS V m n -- cut.
   *
   * Function B (m=66) is used rather than the bare `GS V 1`, because it feeds
   * n dots BEFORE cutting. The cutter on these units sits roughly 15mm above
   * the print head, so a cut issued the instant the last line is printed
   * takes the blade through the last two lines of the receipt. Feeding first
   * is what puts the tear below the text.
   *
   * Printers with no cutter ignore the command, which is why it is safe to
   * send unconditionally -- but a profile can still turn it off, since a few
   * clones respond to an unknown GS V by printing its arguments as text. */
  function cutCmd(feedDots) { return [GS, 0x56, 66, clampInt(feedDots, 0, 255)]; }

  // ESC p m t1 t2 -- kick the cash drawer on pin 2 or 5. The two times are in
  // 2ms units: on for 50ms, off for 500ms suits every drawer solenoid we have
  // met and is the value the drawers themselves document.
  function drawerCmd(pin) { return [ESC, 0x70, pin === 5 ? 1 : 0, 25, 250]; }

  /* ---------------- Character encoding ----------------
   *
   * A thermal printer has no idea what UTF-8 is. It reads one byte per glyph
   * against whichever of its built-in code pages is selected, so text has to
   * be transcoded on this side. Send UTF-8 straight through and every accent,
   * every curly quote and -- the one that bites here -- every em dash comes
   * out as two pieces of line-drawing garbage.
   *
   * CP437 is the default because it is the one page every clone has. CP1252
   * is offered for shops whose names carry Western European accents, since it
   * holds them all in one byte where CP437 only has some. */
  var CP437_HIGH =
    'ÇüéâäàåçêëèïîìÄÅ' +
    'ÉæÆôöòûùÿÖÜ¢£¥₧ƒ' +
    'áíóúñÑªº¿⌐¬½¼¡«»' +
    '░▒▓│┤╡╢╖╕╣║╗╝╜╛┐' +
    '└┴┬├─┼╞╟╚╔╩╦╠═╬╧' +
    '╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀' +
    'αßΓπΣσµτΦΘΩδ∞φε∩' +
    '≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';

  // CP1252 differs from Latin-1 only in 0x80-0x9F. Above that it IS Latin-1,
  // so the rest is generated rather than typed out -- a hand-copied 96-entry
  // table is a place for a single wrong character to hide for years.
  var CP1252_80_9F =
    '€�‚ƒ„…†‡ˆ‰Š‹Œ�Ž�' +
    '�‘’“”•–—˜™š›œ�žŸ';

  /* Characters that have no byte in the target page but do have an honest
   * plain-ASCII stand-in. Applied before the page lookup, so a receipt reads
   * as intended instead of as a row of question marks.
   *
   * The em dash is here for a concrete reason: it is the app's house
   * punctuation, it appears in shop straplines and item notes, and it is the
   * single character most likely to reach a printer from this codebase. */
  var TRANSLITERATE = {
    '—': '-', '–': '-', '−': '-', '‐': '-', '‑': '-',
    '‘': "'", '’': "'", '‛': "'", 'ʼ': "'",
    '“': '"', '”': '"', '„': '"',
    '…': '...', '•': '*', '·': '.', '‹': '<', '›': '>',
    '×': 'x', '→': '->', '←': '<-', '€': 'EUR',
    ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
    'Œ': 'OE', 'œ': 'oe', '™': '(TM)', '‰': '%%',
    // Invisible characters, which are the ones nobody thinks to look for: on
    // screen the text is ordinary words with ordinary gaps, and on paper it
    // is words with '?' between them. The zero-width ones map to nothing.
    '​': '', '‌': '', '‍': '', '﻿': '',
  };

  var CODEPAGES = {
    // name        ESC t n   high half (0x80-0xFF)
    cp437: { n: 0, high: CP437_HIGH },
    cp850: { n: 2, high: null },   // Selectable, but no reverse table: text is
                                   // ASCII-folded rather than silently wrong.
    cp1252: { n: 16, high: CP1252_80_9F + buildLatin1Tail() },
  };

  function buildLatin1Tail() {
    var s = '';
    for (var c = 0xA0; c <= 0xFF; c++) s += String.fromCharCode(c);
    return s;
  }

  // Built once per page, on first use. A 128-entry scan per character would
  // be invisible on a ten-line receipt and very visible on a 200-line
  // statement.
  var reverseCache = {};
  function reverseTable(pageName) {
    if (reverseCache[pageName]) return reverseCache[pageName];
    var page = CODEPAGES[pageName];
    var map = {};
    if (page && page.high) {
      if (page.high.length !== 128) {
        throw new Error('code page ' + pageName + ' high half is ' + page.high.length + ' chars, expected 128');
      }
      for (var i = 0; i < 128; i++) {
        var ch = page.high.charAt(i);
        // � marks the undefined slots in CP1252. Mapping them would let
        // a replacement character print as a real glyph.
        if (ch !== '�' && map[ch] === undefined) map[ch] = 0x80 + i;
      }
    }
    reverseCache[pageName] = map;
    return map;
  }

  /*
   * Text -> bytes for the selected page.
   *
   * Anything with no byte and no stand-in becomes '?'. That is deliberate:
   * dropping it would silently shorten a line that the column arithmetic has
   * already measured, and a receipt whose columns no longer line up is harder
   * to trust than one with a visible question mark in a name.
   */
  function encodeText(text, pageName) {
    var map = reverseTable(pageName || 'cp437');
    var out = [];
    var s = String(text === null || text === undefined ? '' : text);
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      var code = s.charCodeAt(i);
      if (code === 0x0A) { out.push(LF); continue; }
      if (code === 0x0D) continue;                      // CR alone feeds nothing
      if (code >= 0x20 && code < 0x7F) { out.push(code); continue; }
      var mapped = map[ch];
      if (mapped !== undefined) { out.push(mapped); continue; }
      var alt = TRANSLITERATE[ch];
      if (alt !== undefined) {
        for (var j = 0; j < alt.length; j++) out.push(alt.charCodeAt(j) & 0x7F);
        continue;
      }
      // Surrogate pair (an emoji, most likely): consume both halves so the
      // trailing half does not produce a second '?'.
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < s.length) i++;
      out.push(0x3F);
    }
    return out;
  }

  /* Printable width of a string, in character cells.
   *
   * Not the same as .length once a transliteration expands: '…' is one
   * character and prints as three. Column arithmetic that used .length would
   * be off by two on every line carrying an ellipsis, so measurement and
   * encoding have to agree -- and the only way to guarantee that is to
   * measure through the same table that encodes. */
  function textWidth(text, pageName) {
    return encodeText(text, pageName).filter(function (b) { return b !== LF; }).length;
  }

  /*
   * What the paper will say, as a string.
   *
   * An on-screen preview built from the original text is a preview of a
   * different document: the printer never sees the em dash, it sees the
   * hyphen this file substituted, and it never sees the ellipsis, it sees
   * three dots occupying three columns the layout has already accounted for.
   * Round-tripping through the encoder is the only way the preview and the
   * receipt can be guaranteed to agree -- so the preview is generated from
   * the bytes, not from the source text.
   */
  function previewText(text, pageName) {
    var page = CODEPAGES[pageName || 'cp437'];
    var high = (page && page.high) || '';
    return encodeText(text, pageName).map(function (b) {
      if (b === LF) return '\n';
      if (b < 0x80) return String.fromCharCode(b);
      var ch = high.charAt(b - 0x80);
      return ch && ch !== '�' ? ch : '?';
    }).join('');
  }

  /* ---------------- Layout ----------------
   *
   * Everything below counts in character cells, because that is the only unit
   * the printer honours for text. How many cells fit across the paper comes
   * from the profile (48 for a true 80mm head in Font A), never from a
   * constant here -- the same physical "80mm" printer ships with 576-dot and
   * 512-dot heads, and hard-coding either one guarantees wrong output on the
   * other. */

  // Word wrap. Words longer than the line (a 60-character product name with
  // no spaces) are hard-split rather than allowed to overflow, since an
  // overflowing line wraps in the printer's own way and takes the column
  // alignment of everything after it with it.
  function wrapText(text, width, pageName) {
    var w = Math.max(1, Math.floor(width));
    var lines = [];
    String(text === null || text === undefined ? '' : text).split(/\r?\n/).forEach(function (para) {
      var words = para.split(/\s+/).filter(function (x) { return x.length; });
      if (!words.length) { lines.push(''); return; }
      var cur = '';
      words.forEach(function (word) {
        var candidate = cur ? cur + ' ' + word : word;
        if (textWidth(candidate, pageName) <= w) { cur = candidate; return; }
        if (cur) { lines.push(cur); cur = ''; }
        while (textWidth(word, pageName) > w) {
          var cut = w;
          while (cut > 1 && textWidth(word.slice(0, cut), pageName) > w) cut--;
          lines.push(word.slice(0, cut));
          word = word.slice(cut);
        }
        cur = word;
      });
      if (cur) lines.push(cur);
    });
    return lines;
  }

  /*
   * Left text, right text, one line, filled with spaces between.
   *
   * The right-hand side wins when the two cannot both fit, because the right
   * hand side is the money. A truncated price is a wrong receipt; a truncated
   * item name is a shorter one. Truncation marks itself with a trailing '.'
   * so nobody reads a clipped name as the whole name.
   */
  function twoColumn(left, right, width, pageName) {
    var w = Math.max(1, Math.floor(width));
    var r = String(right === null || right === undefined ? '' : right);
    var rw = textWidth(r, pageName);
    if (rw >= w) return r.slice(Math.max(0, r.length - w));
    var room = w - rw - 1;
    var l = String(left === null || left === undefined ? '' : left);
    if (textWidth(l, pageName) > room) l = truncate(l, room, pageName);
    var gap = w - textWidth(l, pageName) - rw;
    return l + repeat(' ', gap) + r;
  }

  // Three cells with fixed widths -- the item row's qty / rate / amount.
  // Widths are given, not computed, so every row on a receipt lines up even
  // when one of them happens to be short.
  function columns(cells, widths, aligns, pageName) {
    var parts = [];
    for (var i = 0; i < widths.length; i++) {
      var w = Math.max(0, Math.floor(widths[i]));
      var text = String(cells[i] === null || cells[i] === undefined ? '' : cells[i]);
      if (textWidth(text, pageName) > w) text = truncate(text, w, pageName);
      var pad = w - textWidth(text, pageName);
      var align = (aligns && aligns[i]) || 'left';
      if (align === 'right') parts.push(repeat(' ', pad) + text);
      else if (align === 'center') {
        var l = Math.floor(pad / 2);
        parts.push(repeat(' ', l) + text + repeat(' ', pad - l));
      } else parts.push(text + repeat(' ', pad));
    }
    return parts.join('').replace(/\s+$/, '');
  }

  function truncate(text, width, pageName) {
    if (width <= 0) return '';
    var s = String(text);
    if (textWidth(s, pageName) <= width) return s;
    if (width === 1) return s.charAt(0);
    var cut = s.length;
    while (cut > 0 && textWidth(s.slice(0, cut) + '.', pageName) > width) cut--;
    return s.slice(0, cut) + '.';
  }

  function repeat(ch, n) {
    var s = '';
    for (var i = 0; i < Math.max(0, n); i++) s += ch;
    return s;
  }

  function rule(width, ch) { return repeat(ch || '-', width); }

  /* ---------------- Images, codes ---------------- */

  /*
   * GS v 0 -- raster bit image, used for a shop logo.
   *
   * `GS ( L` is the modern, better-specified way and roughly half the clones
   * do not implement it. `GS v 0` is obsolete in Epson's own documentation
   * and is the one that works everywhere, which is the trade this whole file
   * keeps making.
   *
   * Takes 1-bit-per-pixel packed rows: bit set means a dot is burned.
   */
  function rasterImage(bitmap) {
    var width = bitmap.width | 0, height = bitmap.height | 0;
    var bytesPerRow = Math.ceil(width / 8);
    if (!width || !height) throw new Error('rasterImage: empty bitmap');
    if (bitmap.data.length < bytesPerRow * height) {
      throw new Error('rasterImage: data is ' + bitmap.data.length + ' bytes, need ' + (bytesPerRow * height));
    }
    var head = [GS, 0x76, 0x30, 0x00,
      bytesPerRow & 0xFF, (bytesPerRow >> 8) & 0xFF,
      height & 0xFF, (height >> 8) & 0xFF];
    return head.concat(Array.prototype.slice.call(bitmap.data, 0, bytesPerRow * height));
  }

  /*
   * QR code via GS ( k. Four separate commands, in this order, or nothing
   * prints: choose the model, set the module size, set the error correction,
   * store the data, print what was stored.
   */
  function qrCode(data, opts) {
    var o = opts || {};
    var moduleSize = clampInt(o.moduleSize || 6, 1, 16);
    var ecc = { L: 48, M: 49, Q: 50, H: 51 }[(o.ecc || 'M').toUpperCase()] || 49;
    var bytes = encodeText(data, 'cp437');
    var len = bytes.length + 3;                       // + the three-byte cn/fn/m
    var out = [];
    push(out, [GS, 0x28, 0x6B, 4, 0, 49, 65, 50, 0]);            // model 2
    push(out, [GS, 0x28, 0x6B, 3, 0, 49, 67, moduleSize]);       // module size
    push(out, [GS, 0x28, 0x6B, 3, 0, 49, 69, ecc]);              // error correction
    push(out, [GS, 0x28, 0x6B, len & 0xFF, (len >> 8) & 0xFF, 49, 80, 48]);
    push(out, bytes);                                            // store
    push(out, [GS, 0x28, 0x6B, 3, 0, 49, 81, 48]);               // print
    return out;
  }

  /*
   * CODE128 barcode via GS k function B (the length-prefixed form). The
   * older function A is NUL-terminated, which cannot carry arbitrary data and
   * silently truncates at the first zero byte.
   *
   * Data is prefixed with the code set selector {B: the printers do not pick
   * a code set for you, and without it the first two characters are eaten as
   * one.
   */
  function barcode(data, opts) {
    var o = opts || {};
    var payload = '{B' + String(data);
    var bytes = encodeText(payload, 'cp437');
    if (bytes.length > 255) throw new Error('barcode: data too long (' + bytes.length + ' bytes)');
    var out = [];
    push(out, [GS, 0x68, clampInt(o.height || 64, 1, 255)]);          // GS h -- height in dots
    push(out, [GS, 0x77, clampInt(o.width || 2, 2, 6)]);              // GS w -- module width
    push(out, [GS, 0x48, o.hri === false ? 0 : 2]);                   // GS H -- print the digits below
    push(out, [GS, 0x6B, 73, bytes.length]);
    push(out, bytes);
    return out;
  }

  /* ---------------- Assembling a job ----------------
   *
   * A tiny builder rather than string concatenation, because a print job is a
   * byte stream with modes in it: bold has to be turned back off, size has to
   * be returned to 1x, and the place those get forgotten is in the middle of
   * a template literal.
   */
  function Job(profile) {
    if (!(this instanceof Job)) return new Job(profile);
    this.profile = profile || {};
    this.page = this.profile.codepage || 'cp437';
    this.width = this.profile.columns || 48;
    this.bytes = [];
  }

  Job.prototype.raw = function (arr) { push(this.bytes, arr); return this; };

  Job.prototype.init = function () {
    this.raw(CMD.INIT);
    var cp = CODEPAGES[this.page];
    if (cp) this.raw(codepageCmd(cp.n));
    this.raw(CMD.LINESPACING_DEFAULT);
    if (this.profile.font === 'B') { this.raw(CMD.FONT_B); } else { this.raw(CMD.FONT_A); }
    return this;
  };

  Job.prototype.align = function (a) {
    this.raw(a === 'center' ? CMD.ALIGN_CENTER : a === 'right' ? CMD.ALIGN_RIGHT : CMD.ALIGN_LEFT);
    return this;
  };
  Job.prototype.bold = function (on) { this.raw(on ? CMD.BOLD_ON : CMD.BOLD_OFF); return this; };
  Job.prototype.underline = function (on) { this.raw(on ? CMD.UNDERLINE_ON : CMD.UNDERLINE_OFF); return this; };
  Job.prototype.invert = function (on) { this.raw(on ? CMD.INVERT_ON : CMD.INVERT_OFF); return this; };
  Job.prototype.size = function (w, h) { this.raw(sizeCmd(w, h)); return this; };

  // One line of text plus its newline. Text is NOT wrapped here -- wrapping
  // needs the effective width, which depends on the size multiplier in force,
  // and guessing it silently is how double-height headings overflow.
  Job.prototype.line = function (text) {
    this.raw(encodeText(text === undefined ? '' : text, this.page));
    this.bytes.push(LF);
    return this;
  };

  Job.prototype.text = function (text) { this.raw(encodeText(text, this.page)); return this; };
  Job.prototype.feed = function (lines) { this.raw(feedCmd(lines === undefined ? 1 : lines)); return this; };
  Job.prototype.rule = function (ch) { return this.line(rule(this.width, ch)); };

  Job.prototype.cut = function () {
    if (this.profile.cutter === false) { return this.feed(this.profile.tailFeed || 4); }
    this.feed(this.profile.tailFeed === undefined ? 3 : this.profile.tailFeed);
    return this.raw(cutCmd(0));
  };

  Job.prototype.drawer = function (pin) { return this.raw(drawerCmd(pin)); };
  Job.prototype.qr = function (data, opts) { return this.raw(qrCode(data, opts)); };
  Job.prototype.barcode = function (data, opts) { return this.raw(barcode(data, opts)); };
  Job.prototype.image = function (bitmap) { return this.raw(rasterImage(bitmap)); };

  Job.prototype.toBytes = function () { return toUint8(this.bytes); };

  /* ---------------- small helpers ---------------- */

  function push(target, arr) {
    for (var i = 0; i < arr.length; i++) target.push(arr[i] & 0xFF);
    return target;
  }
  function clampInt(n, lo, hi) {
    n = Math.round(Number(n) || 0);
    return n < lo ? lo : n > hi ? hi : n;
  }
  function toUint8(arr) {
    var out = new Uint8Array(arr.length);
    for (var i = 0; i < arr.length; i++) out[i] = arr[i] & 0xFF;
    return out;
  }

  return {
    CMD: CMD, CODEPAGES: CODEPAGES, TRANSLITERATE: TRANSLITERATE,
    Job: Job,
    encodeText: encodeText, textWidth: textWidth, previewText: previewText,
    wrapText: wrapText, twoColumn: twoColumn, columns: columns,
    truncate: truncate, rule: rule, repeat: repeat,
    sizeCmd: sizeCmd, codepageCmd: codepageCmd, feedCmd: feedCmd,
    cutCmd: cutCmd, drawerCmd: drawerCmd,
    qrCode: qrCode, barcode: barcode, rasterImage: rasterImage,
    toUint8: toUint8,
  };
}));
