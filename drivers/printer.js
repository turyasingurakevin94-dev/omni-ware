/*
 * The printer, as the rest of the app should see it.
 *
 * One object with connect / print / printReceipt / selfTest, a remembered
 * setting, and a queue. Everything underneath -- which transport, how many
 * columns, which code page, how to chunk the write -- is settled here so no
 * caller has to think about it.
 *
 * The queue is not decoration. Two prints started a moment apart on one
 * Bluetooth link interleave their bytes, and interleaved ESC/POS is not two
 * damaged receipts, it is one long one with commands from each taking effect
 * in the middle of the other. So jobs are serialised: a print waits for the
 * one before it, always.
 */
(function (root, factory) {
  'use strict';
  var req = typeof require === 'function' ? require : null;
  var api = factory(
    root.EscPos || (req && req('./escpos.js')),
    root.PrinterProfiles || (req && req('./profiles.js')),
    root.ThermalReceipt || (req && req('./receipt.js')),
    root.PrinterTransports || (req && req('./transports.js'))
  );
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ThermalPrinter = api;
}(typeof self !== 'undefined' ? self : this, function (EscPos, Profiles, Receipt, Transports) {
  'use strict';

  var STORAGE_KEY = 'omniware.thermalPrinter';

  /* ---------------- remembered settings ----------------
   *
   * The paper profile and the transport are remembered; the connection is
   * not, and cannot be -- a browser will not reopen a serial port or a GATT
   * connection without the user having granted it, and on serial that grant
   * does survive, so reconnecting is a matter of finding the port again
   * rather than asking again.
   */
  function loadSettings(storage) {
    var store = storage || defaultStorage();
    try {
      var raw = store && store.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      // A corrupt setting must not stop the app from starting. Defaults are
      // a working printer configuration; a thrown exception is not.
      return {};
    }
  }
  function saveSettings(settings, storage) {
    var store = storage || defaultStorage();
    try { if (store) store.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) { /* private mode */ }
  }
  function defaultStorage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  }

  /* ---------------- the printer ---------------- */

  function ThermalPrinter(opts) {
    if (!(this instanceof ThermalPrinter)) return new ThermalPrinter(opts);
    var o = opts || {};
    this.storage = o.storage;
    var saved = o.settings || loadSettings(this.storage);
    this.settings = {
      transport: saved.transport || 'serial',
      paper: saved.paper || (Profiles ? Profiles.DEFAULT_PAPER : '80mm'),
      columns: saved.columns || null,
      codepage: saved.codepage || 'cp437',
      baudRate: saved.baudRate || 9600,
      cutter: saved.cutter === undefined ? true : !!saved.cutter,
      drawer: !!saved.drawer,
      name: saved.name || '',
      // A fact about this counter's hardware, not about the business: the
      // same shop's tablet in the store room has no printer and should not
      // be waiting for one. So it lives with the printer's settings, which
      // are per-device, rather than with the shop's data, which is not.
      autoPrintCounterSale: saved.autoPrintCounterSale === undefined
        ? true : !!saved.autoPrintCounterSale,
    };
    this.transport = null;
    this.queue = Promise.resolve();
    this.listeners = [];
    this.lastError = null;
  }

  ThermalPrinter.prototype.profile = function () {
    return Profiles.make({
      paper: this.settings.paper,
      columns: this.settings.columns,
      codepage: this.settings.codepage,
      cutter: this.settings.cutter,
      drawer: this.settings.drawer,
      baudRate: this.settings.baudRate,
      transport: this.settings.transport,
      name: this.settings.name,
    });
  };

  ThermalPrinter.prototype.update = function (patch) {
    var self = this;
    Object.keys(patch || {}).forEach(function (k) { self.settings[k] = patch[k]; });
    saveSettings(this.settings, this.storage);
    this.emit();
    return this.settings;
  };

  // Subscribe to state changes -- connected, disconnected, error. Enough for
  // a settings panel to show the truth without polling.
  ThermalPrinter.prototype.onChange = function (fn) {
    this.listeners.push(fn);
    return function () { /* unsubscribe */ };
  };
  ThermalPrinter.prototype.emit = function () {
    var state = this.state();
    this.listeners.forEach(function (fn) { try { fn(state); } catch (e) { /* a bad listener is not a print failure */ } });
  };

  ThermalPrinter.prototype.state = function () {
    return {
      connected: !!(this.transport && this.transport.isOpen()),
      transport: this.settings.transport,
      label: this.transport ? this.transport.label : '',
      paper: this.settings.paper,
      columns: this.profile().columns,
      error: this.lastError ? String(this.lastError.message || this.lastError) : null,
    };
  };

  /*
   * Connect, asking the user to choose a device.
   *
   * Must be called from a click. Both Web Serial and Web Bluetooth require a
   * user gesture for the chooser and reject without one, and the rejection
   * arrives as a generic error that reads like a hardware fault.
   */
  ThermalPrinter.prototype.connect = function (kind) {
    var self = this;
    var which = kind || this.settings.transport;
    return this.disconnect().then(function () {
      self.transport = self.makeTransport(which);
      return self.transport.connect();
    }).then(function () {
      self.settings.transport = which;
      self.lastError = null;
      saveSettings(self.settings, self.storage);
      if (self.transport.onDisconnect !== undefined) {
        self.transport.onDisconnect = function () { self.emit(); };
      }
      self.emit();
      return self.state();
    }).catch(function (err) {
      self.lastError = err;
      self.transport = null;
      self.emit();
      throw err;
    });
  };

  /*
   * Reconnect without a chooser.
   *
   * Serial permission survives a reload, so a port the user picked yesterday
   * can be reopened today in silence. Only when exactly one port has been
   * granted, though: picking one of several would eventually pick the wrong
   * printer, and a receipt printed on the wrong machine is worse than a
   * dialog.
   */
  ThermalPrinter.prototype.reconnect = function () {
    var self = this;
    if (this.settings.transport !== 'serial' || !Transports.SerialTransport.isSupported()) {
      return Promise.resolve(null);
    }
    return Transports.SerialTransport.granted().then(function (ports) {
      if (ports.length !== 1) return null;
      self.transport = self.makeTransport('serial');
      return self.transport.connect(ports[0]).then(function () {
        self.lastError = null;
        self.emit();
        return self.state();
      });
    }).catch(function () {
      self.transport = null;
      return null;
    });
  };

  ThermalPrinter.prototype.makeTransport = function (kind) {
    var o = { baudRate: this.settings.baudRate };
    if (kind === 'bluetooth') return new Transports.BluetoothTransport(o);
    if (kind === 'file') return new Transports.FileTransport({ filename: 'omniware-receipt.bin' });
    return new Transports.SerialTransport(o);
  };

  ThermalPrinter.prototype.disconnect = function () {
    var self = this;
    if (!this.transport) return Promise.resolve();
    var t = this.transport;
    this.transport = null;
    return t.close().catch(function () {}).then(function () { self.emit(); });
  };

  ThermalPrinter.prototype.isConnected = function () {
    return !!(this.transport && this.transport.isOpen());
  };

  /*
   * The one place bytes leave. Everything queues here.
   *
   * A failed job does not poison the queue: the rejection is handed to the
   * caller and the chain is reset, so the next receipt still prints. The
   * alternative -- one dropped Bluetooth link silently killing every print
   * for the rest of the shift -- is the failure mode worth designing out.
   */
  ThermalPrinter.prototype.print = function (bytes) {
    var self = this;
    var run = this.queue.then(function () {
      if (!self.isConnected()) throw new Error('Printer is not connected');
      return self.transport.write(bytes);
    });
    this.queue = run.catch(function () {});
    return run.catch(function (err) {
      self.lastError = err;
      self.emit();
      throw err;
    });
  };

  ThermalPrinter.prototype.printReceipt = function (doc) {
    return this.print(Receipt.render(doc, this.profile()));
  };

  ThermalPrinter.prototype.previewReceipt = function (doc) {
    return Receipt.preview(doc, this.profile());
  };

  ThermalPrinter.prototype.selfTest = function () {
    return this.print(Receipt.selfTest(this.profile()));
  };

  ThermalPrinter.prototype.openDrawer = function () {
    var job = new EscPos.Job(this.profile());
    return this.print(job.init().drawer(2).toBytes());
  };

  /*
   * Print, or fall back to the browser's own print dialog.
   *
   * A shop with no thermal printer connected -- or one whose printer is
   * installed in Windows as an ordinary printer rather than reached over
   * serial -- still has to be able to print. So the caller hands over both
   * the receipt and a function that prints it the old way, and gets whichever
   * one works, plus which one it was.
   */
  ThermalPrinter.prototype.printReceiptOrFallback = function (doc, fallback) {
    var self = this;
    if (!this.isConnected()) {
      return this.reconnect().catch(function () { return null; }).then(function () {
        if (self.isConnected()) return self.printReceipt(doc).then(function () { return 'thermal'; });
        if (typeof fallback === 'function') { fallback(); return 'fallback'; }
        throw new Error('No thermal printer connected, and no fallback given');
      });
    }
    return this.printReceipt(doc).then(function () { return 'thermal'; }, function (err) {
      // The link dropped mid-job. Paper has already come out of the printer,
      // so the fallback is offered rather than taken silently -- printing the
      // same receipt twice by two routes is its own kind of wrong.
      self.lastError = err;
      throw err;
    });
  };

  ThermalPrinter.support = function () {
    return {
      serial: Transports.SerialTransport.isSupported(),
      bluetooth: Transports.BluetoothTransport.isSupported(),
      // Named because the answer to "why is there no Connect button" is
      // almost always this one, and it is worth saying out loud in the UI.
      secureContext: typeof window === 'undefined' ? true
        : (window.isSecureContext || location.protocol === 'file:'),
    };
  };

  ThermalPrinter.STORAGE_KEY = STORAGE_KEY;
  ThermalPrinter.loadSettings = loadSettings;
  ThermalPrinter.saveSettings = saveSettings;

  return ThermalPrinter;
}));
