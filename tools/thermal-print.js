#!/usr/bin/env node
'use strict';
/*
 * Printing to the thermal printer from a terminal.
 *
 * The browser driver is the one the shop uses. This is the one you use when
 * the browser driver is not printing and you need to know whose fault that
 * is: it takes the same code, the same profiles and the same layout, and
 * pushes the bytes at the COM port directly. If this prints and the app does
 * not, the printer and the pairing are fine and the problem is in the page.
 * If neither prints, stop looking at the app.
 *
 * No dependencies -- deliberately. This has to run on a shop's Windows
 * machine with nothing installed but Node, and `npm install` on a metered
 * connection at 9pm is not a step anyone should need.
 *
 *   node tools/thermal-print.js --list
 *   node tools/thermal-print.js --port COM5 --test
 *   node tools/thermal-print.js --port COM5 --receipt sample.json
 *   node tools/thermal-print.js --receipt sample.json --preview
 *   node tools/thermal-print.js --receipt sample.json --out receipt.bin
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const Profiles = require('../drivers/profiles.js');
const Receipt = require('../drivers/receipt.js');

/* ---------------- arguments ----------------
 *
 * Hand-parsed. A flag parser is fifty lines of dependency to save ten lines
 * of code, and this file's whole point is having no dependencies.
 */
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const eq = a.indexOf('=');
    const key = (eq === -1 ? a.slice(2) : a.slice(2, eq));
    let value = eq === -1 ? null : a.slice(eq + 1);
    if (value === null) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { value = next; i++; }
      else value = true;
    }
    out[key] = value;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

function usage(code) {
  console.log(`
Omni-Ware thermal printer — command line

  --list                    show serial ports this machine has
  --port <COM5|/dev/...>    where to print
  --test                    print the self-test page
  --receipt <file.json>     print a receipt document (see --sample)
  --sample                  write a sample receipt document to stdout
  --preview                 print to the screen instead of the printer
  --out <file.bin>          write the raw bytes to a file
  --paper <key>             ${Profiles.paperList().map((p) => p.key).join(' | ')}
  --columns <n>             override the profile's column count
  --codepage <cp437|cp1252> character set (default cp437)
  --baud <n>                default 9600
  --no-cut                  the printer has no cutter

Examples
  node tools/thermal-print.js --list
  node tools/thermal-print.js --port COM5 --test
  node tools/thermal-print.js --receipt quote.json --preview
`);
  process.exit(code === undefined ? 0 : code);
}

/* ---------------- ports ----------------
 *
 * Windows keeps every serial port, Bluetooth or otherwise, in one registry
 * key. Reading it is not elegant but it is present on every Windows since
 * XP, and it needs no module and no elevation.
 *
 * It cannot tell an outgoing Bluetooth port from an incoming one, which is
 * the distinction that actually matters -- that needs the PnP instance path,
 * which is what the PowerShell script in drivers/windows reads. So this
 * points at that rather than guessing.
 */
function listPorts() {
  if (process.platform === 'win32') {
    let out = '';
    try {
      out = execFileSync('reg', ['query', 'HKLM\\HARDWARE\\DEVICEMAP\\SERIALCOMM'], { encoding: 'utf8' });
    } catch (e) {
      console.error('Could not read the serial port list from the registry:', e.message);
      return [];
    }
    const ports = [];
    out.split(/\r?\n/).forEach((line) => {
      const m = /\s(COM\d+)\s*$/.exec(line);
      if (!m) return;
      const bluetooth = /BthModem|RFCOMM|BTHENUM/i.test(line);
      ports.push({ port: m[1], via: bluetooth ? 'Bluetooth' : 'Serial/USB', raw: line.trim() });
    });
    return ports;
  }

  // Linux and macOS: the Bluetooth SPP device is whatever rfcomm bound, and
  // a USB printer is a tty. Both are just files, which is why the write path
  // below needs no special case.
  const dirs = ['/dev'];
  const ports = [];
  dirs.forEach((dir) => {
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { return; }
    names.filter((n) => /^(rfcomm\d+|ttyUSB\d+|ttyACM\d+|tty\.|cu\.)/.test(n)).forEach((n) => {
      ports.push({ port: path.join(dir, n), via: n.startsWith('rfcomm') ? 'Bluetooth' : 'Serial/USB', raw: n });
    });
  });
  return ports;
}

/* ---------------- writing ----------------
 *
 * A COM port on Windows is openable as a file under the \\.\ namespace, so
 * the bytes go out through fs like anything else. The port's line settings
 * are not part of that, though, and an unconfigured port can be at 1200 baud
 * from something that used it last -- so `mode` sets them first.
 *
 * Written in chunks with a pause. These printers have a small buffer, the
 * Bluetooth link has no flow control to say when it is full, and the
 * symptom of overrunning it is a receipt that simply stops partway down.
 */
function writeToPort(portName, bytes, baud) {
  if (process.platform === 'win32') {
    try {
      execFileSync('mode', [`${portName}:`, `BAUD=${baud}`, 'PARITY=n', 'DATA=8', 'STOP=1',
        'xon=off', 'octs=off', 'rts=on', 'dtr=on'], { stdio: 'ignore', shell: true });
    } catch (e) {
      // Not fatal on a Bluetooth virtual port, which ignores line settings.
      // Fatal-looking, though, so it is worth saying rather than swallowing.
      console.error(`Note: could not configure ${portName} (${e.message.trim()}). Continuing.`);
    }
  } else {
    try {
      execFileSync('stty', ['-F', portName, String(baud), 'cs8', '-cstopb', '-parenb', 'raw', '-echo'],
        { stdio: 'ignore' });
    } catch (e) { /* rfcomm devices often reject stty; the write still works */ }
  }

  const target = process.platform === 'win32' ? `\\\\.\\${portName}` : portName;
  let fd;
  try {
    fd = fs.openSync(target, 'w');
  } catch (e) {
    throw new Error(`Could not open ${portName}: ${e.message}\n`
      + '  * Switch the printer on — Windows lists the port either way.\n'
      + '  * Close any other program holding the port.\n'
      + '  * Make sure this is the OUTGOING Bluetooth port. Windows makes two and only one prints;\n'
      + '    run drivers/windows/Setup-ThermalPrinter.ps1 -List to see which is which.');
  }

  try {
    const chunk = 256;
    for (let offset = 0; offset < bytes.length; offset += chunk) {
      fs.writeSync(fd, bytes, offset, Math.min(chunk, bytes.length - offset));
      sleep(30);
    }
    sleep(400);            // let the printer drain before the handle closes
  } finally {
    fs.closeSync(fd);
  }
}

// Blocking, on purpose. The pacing has to happen between writes to the same
// file descriptor, and an async pause would need the whole path rewritten
// around promises to buy nothing: this process has nothing else to do.
function sleep(ms) {
  const shared = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(shared), 0, 0, ms);
}

/* ---------------- documents ---------------- */

const SAMPLE_DOC = {
  shop: { name: 'Omni-Ware', lines: ['Nakawa, Kampala', 'Tel 0700 000 000'] },
  title: 'Receipt',
  meta: [
    { label: 'Date', value: new Date().toISOString().slice(0, 10) },
    { label: 'Receipt No', value: 'TEST-0001' },
    { label: 'Customer', value: 'Walk-in' },
  ],
  items: [
    { name: 'Cement (Tororo 50kg)', qty: 20, unit: 'Bag', rate: 34000 },
    { name: 'Black Wall Plug 8mm — box of 100', note: 'ordered in on request', qty: 3, unit: 'Box', rate: 12500 },
    { name: 'Roofing nails 4"', qty: 5, unit: 'Kg', rate: 9000 },
  ],
  totals: [
    { label: 'Subtotal', value: 762500 },
    { label: 'Paid (cash)', value: 800000 },
    { label: 'Change', value: 37500 },
    { label: 'Total', value: 762500, emphasis: true },
  ],
  signatures: ['Served by'],
  footer: ['Thank you for your business', 'Goods once sold are not returnable'],
};

function loadDoc(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) {
    throw new Error(`Could not read ${file}: ${e.message}`);
  }
  try { return JSON.parse(raw); } catch (e) {
    throw new Error(`${file} is not valid JSON: ${e.message}`);
  }
}

/* ---------------- main ---------------- */

function main() {
  if (args.help || args.h || (process.argv.length <= 2)) usage(0);

  if (args.sample) {
    console.log(JSON.stringify(SAMPLE_DOC, null, 2));
    return;
  }

  if (args.list) {
    const ports = listPorts();
    if (!ports.length) {
      console.log('No serial ports found.');
      if (process.platform === 'win32') {
        console.log('Pair the printer in Settings > Bluetooth & devices, then run');
        console.log('  powershell -ExecutionPolicy Bypass -File drivers\\windows\\Setup-ThermalPrinter.ps1 -List');
      }
      return;
    }
    console.log('Port        Via');
    ports.forEach((p) => console.log(`${p.port.padEnd(12)}${p.via}`));
    if (process.platform === 'win32') {
      console.log('\nWindows creates two ports per paired printer and only the outgoing one prints.');
      console.log('To see which is which:');
      console.log('  powershell -ExecutionPolicy Bypass -File drivers\\windows\\Setup-ThermalPrinter.ps1 -List');
    }
    return;
  }

  const profile = Profiles.make({
    paper: args.paper || Profiles.DEFAULT_PAPER,
    columns: args.columns ? Number(args.columns) : null,
    codepage: args.codepage || 'cp437',
    cutter: !args['no-cut'],
    baudRate: args.baud ? Number(args.baud) : 9600,
  });

  let bytes;
  let doc = null;
  if (args.test) {
    bytes = Receipt.selfTest(profile);
  } else if (args.receipt) {
    doc = args.receipt === true ? SAMPLE_DOC : loadDoc(String(args.receipt));
    bytes = Receipt.render(doc, profile);
  } else {
    console.error('Nothing to print. Use --test, --receipt <file.json>, or --list.\n');
    usage(1);
  }

  if (args.preview) {
    // The self-test is assembled as bytes directly -- there is no document
    // behind it -- so it previews as the hex it is rather than as text it
    // does not have.
    console.log(doc ? Receipt.preview(doc, profile) : hexDump(bytes));
    return;
  }

  if (args.out) {
    fs.writeFileSync(String(args.out), Buffer.from(bytes));
    console.log(`Wrote ${bytes.length} bytes to ${args.out}`);
    if (process.platform === 'win32') console.log(`Send it with:  copy /b ${args.out} COM5:`);
    return;
  }

  if (!args.port) {
    console.error('No --port given. Run --list to see what is available, or --preview to see the layout.');
    process.exit(1);
  }

  writeToPort(String(args.port), Buffer.from(bytes), profile.baudRate);
  console.log(`Sent ${bytes.length} bytes to ${args.port} at ${profile.baudRate} baud.`);
  if (args.test) {
    console.log(`If the ruler line wrapped, the printer is narrower than ${profile.columns} columns —`);
    console.log('  retry with --paper 80mm-narrow (42 cols) or --paper 58mm (32 cols).');
  }
}

function hexDump(bytes) {
  const lines = [];
  for (let i = 0; i < bytes.length; i += 16) {
    lines.push(Array.from(bytes.slice(i, i + 16))
      .map((b) => b.toString(16).padStart(2, '0')).join(' '));
  }
  return `${bytes.length} bytes\n${lines.join('\n')}`;
}

// Only when run, not when required. The tests pull SAMPLE_DOC out of here to
// check the layout against a real document, and a require that printed a
// receipt as a side effect would be a surprising way to find that out.
if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

module.exports = { parseArgs, listPorts, hexDump, SAMPLE_DOC };
