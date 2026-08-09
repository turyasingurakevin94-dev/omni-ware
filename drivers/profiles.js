/*
 * What "80mm" actually means, per printer.
 *
 * The paper is 80mm wide. The printed area is not, and it is not the same on
 * every unit: the common head is 576 dots (72mm at 203dpi, 48 characters in
 * Font A) but a large minority of the same-looking printers ship a 512-dot
 * head, which is 42 characters. Lay a 48-column receipt out on a 42-column
 * printer and every line wraps by six characters, which turns a tidy
 * two-column total into two ragged lines. There is no command that reliably
 * asks the printer which it is, so it is a setting -- with the majority as
 * the default, and a self-test that shows the answer in one glance.
 *
 * The transport half of a profile is here for the same reason. A Bluetooth
 * printer is either Classic (SPP, a serial port once Windows has paired it)
 * or Low Energy (GATT, a write characteristic), and the LE ones use one of a
 * small set of vendor UUIDs. Listing them is what makes "universal" true in
 * practice rather than in principle.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PrinterProfiles = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------- Paper / head profiles ---------------- */

  var PAPER = {
    /* The default, and the one to try first on anything sold as 80mm. */
    '80mm': {
      key: '80mm',
      label: '80mm — 48 columns (most common)',
      widthDots: 576,
      columns: 48,
      font: 'A',
      codepage: 'cp437',
      cutter: true,
      tailFeed: 3,
      // The item table: name gets its own line, and these three share the
      // row underneath it. Qty is narrow, money is wide, because money is
      // what must never truncate.
      itemColumns: [12, 18, 18],
    },
    '80mm-narrow': {
      key: '80mm-narrow',
      label: '80mm — 42 columns (512-dot head)',
      widthDots: 512,
      columns: 42,
      font: 'A',
      codepage: 'cp437',
      cutter: true,
      tailFeed: 3,
      itemColumns: [10, 16, 16],
    },
    /* Font B on an 80mm head: same paper, smaller type, 64 columns. Worth
     * having for long statements where fitting the table matters more than
     * being readable across a counter. */
    '80mm-small': {
      key: '80mm-small',
      label: '80mm — 64 columns (small font)',
      widthDots: 576,
      columns: 64,
      font: 'B',
      codepage: 'cp437',
      cutter: true,
      tailFeed: 3,
      itemColumns: [16, 24, 24],
    },
    /* Included because the same driver has to serve the pocket printers the
     * agents carry, and because someone will eventually plug one in and
     * wonder why every line wraps. */
    '58mm': {
      key: '58mm',
      label: '58mm — 32 columns',
      widthDots: 384,
      columns: 32,
      font: 'A',
      codepage: 'cp437',
      cutter: false,        // Almost none of the 58mm units have a cutter.
      tailFeed: 4,
      itemColumns: [8, 12, 12],
    },
  };

  var DEFAULT_PAPER = '80mm';

  function paper(key) {
    var p = PAPER[key || DEFAULT_PAPER];
    if (!p) throw new Error('unknown paper profile: ' + key);
    // Copied, not handed out: a caller that overrides codepage for one job
    // must not change it for every printer in the process.
    var out = {};
    Object.keys(p).forEach(function (k) { out[k] = p[k]; });
    out.itemColumns = p.itemColumns.slice();
    return out;
  }

  function paperList() {
    return Object.keys(PAPER).map(function (k) { return { key: k, label: PAPER[k].label }; });
  }

  /* ---------------- Bluetooth Low Energy ----------------
   *
   * Web Bluetooth can only reach GATT services it was told to ask for up
   * front, and it can only ask for services the page listed. So the list has
   * to be exhaustive rather than discovered: a printer whose UUID is missing
   * here does not appear in the chooser at all, and looks to the user like a
   * printer that is switched off.
   *
   * Ordered by how often they turn up on printers sold as "80mm Bluetooth".
   */
  var BLE_SERVICES = [
    {
      // By far the most common on the cheap Chinese boards (Goojprt, MTP,
      // many unbranded POS-80 units). 0x2AF1 is nominally "OTS Object Data";
      // the vendors reused it as a write pipe.
      service: '000018f0-0000-1000-8000-00805f9b34fb',
      write: ['00002af1-0000-1000-8000-00805f9b34fb'],
      note: 'Generic 18F0 printer service',
    },
    {
      // Microchip/ISSC "transparent UART", used by a lot of the BLE modules
      // these printers are built around.
      service: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      write: ['49535343-8841-43f4-a8d4-ecbe34729bb3', '49535343-aca3-481c-91ec-d85e28a60318'],
      note: 'ISSC transparent UART',
    },
    {
      // Nordic UART. Common on the pocket 58mm label printers.
      service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
      write: ['6e400002-b5a3-f393-e0a9-e50e24dcca9e'],
      note: 'Nordic UART',
    },
    {
      service: '0000ff00-0000-1000-8000-00805f9b34fb',
      write: ['0000ff02-0000-1000-8000-00805f9b34fb', '0000ff01-0000-1000-8000-00805f9b34fb'],
      note: 'FF00 vendor service',
    },
    {
      service: '0000ffe0-0000-1000-8000-00805f9b34fb',
      write: ['0000ffe1-0000-1000-8000-00805f9b34fb'],
      note: 'HM-10 style serial bridge',
    },
    {
      service: '0000ae30-0000-1000-8000-00805f9b34fb',
      write: ['0000ae01-0000-1000-8000-00805f9b34fb'],
      note: 'Zjiang / AE30 service',
    },
  ];

  function bleServiceUuids() {
    return BLE_SERVICES.map(function (s) { return s.service; });
  }
  function bleWriteUuids(serviceUuid) {
    var s = BLE_SERVICES.filter(function (x) { return x.service === String(serviceUuid).toLowerCase(); })[0];
    return s ? s.write.slice() : [];
  }

  /* Names these printers advertise. Used only to widen the Bluetooth chooser
   * with a name-prefix filter, never to decide behaviour -- a printer that
   * calls itself something new must still be selectable, so the chooser also
   * offers the accept-all path. */
  var BLE_NAME_PREFIXES = [
    'Printer', 'PRINTER', 'BlueTooth Printer', 'POS', 'POS-', 'MTP-', 'MPT-',
    'RPP', 'PT-', 'GP-', 'XP-', 'ZJ-', 'BTP', 'PTP', 'Thermal', 'InnerPrinter',
  ];

  /* ---------------- Bluetooth Classic / serial ----------------
   *
   * On Windows a paired Classic printer is a COM port, and Web Serial can
   * open it. Baud is nominally irrelevant over an SPP virtual port -- the
   * radio link runs at its own rate -- but the port still has to be opened
   * with some value, and a few USB-serial printers on the same code path do
   * care. 9600 is what the printers themselves are set to from the factory.
   */
  var SERIAL_DEFAULTS = {
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    // No hardware flow control: the SPP virtual port does not carry RTS/CTS,
    // and asking for it makes the open fail on some Windows builds rather
    // than fall back. Pacing in the transport takes its place.
    flowControl: 'none',
  };

  var SERIAL_BAUD_CHOICES = [9600, 19200, 38400, 57600, 115200];

  /* ---------------- Assembled profile ---------------- */

  /*
   * A profile is paper + transport settings + a name. The app stores one of
   * these per printer; everything else in the driver reads from it.
   */
  function make(opts) {
    var o = opts || {};
    var p = paper(o.paper);
    if (o.columns) p.columns = Math.max(16, Math.floor(o.columns));
    if (o.codepage) p.codepage = o.codepage;
    if (o.font) p.font = o.font;
    if (o.cutter !== undefined) p.cutter = !!o.cutter;
    p.name = o.name || 'Thermal printer';
    p.transport = o.transport || 'serial';
    p.baudRate = o.baudRate || SERIAL_DEFAULTS.baudRate;
    p.drawer = !!o.drawer;
    return p;
  }

  return {
    PAPER: PAPER, DEFAULT_PAPER: DEFAULT_PAPER,
    BLE_SERVICES: BLE_SERVICES, BLE_NAME_PREFIXES: BLE_NAME_PREFIXES,
    SERIAL_DEFAULTS: SERIAL_DEFAULTS, SERIAL_BAUD_CHOICES: SERIAL_BAUD_CHOICES,
    paper: paper, paperList: paperList, make: make,
    bleServiceUuids: bleServiceUuids, bleWriteUuids: bleWriteUuids,
  };
}));
