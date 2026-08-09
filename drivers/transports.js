/*
 * Getting the bytes to the printer.
 *
 * There are two Bluetooth stacks and they are not variations on a theme.
 *
 *   Classic (SPP)  -- what nearly every 80mm printer uses. Windows pairs it
 *                     and hands back a COM port; from a browser that port is
 *                     reachable through the Web Serial API. This is the path
 *                     to try first on a Windows PC, and the one the setup
 *                     guide is written around.
 *
 *   Low Energy     -- what the pocket printers and a few newer 80mm units
 *                     use. No COM port; the browser talks GATT and writes to
 *                     a vendor characteristic. Reachable through Web
 *                     Bluetooth, which works on Chrome and Edge, including
 *                     on Windows.
 *
 * Both are exposed through the same three methods -- connect, write, close --
 * so the rest of the driver never has to know which one it got.
 *
 * Browser only. The Node side of the project talks to a COM port directly;
 * see tools/thermal-print.js.
 */
(function (root, factory) {
  'use strict';
  var api = factory(root.PrinterProfiles || (typeof require === 'function' ? require('./profiles.js') : null));
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PrinterTransports = api;
}(typeof self !== 'undefined' ? self : this, function (Profiles) {
  'use strict';

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ================= Web Serial =================
   *
   * The Windows path. A paired Classic printer shows up in the port chooser
   * as "Standard Serial over Bluetooth link (COMn)"; picking it is the whole
   * of the connection ceremony.
   */
  function SerialTransport(opts) {
    this.opts = opts || {};
    this.port = null;
    this.writer = null;
    this.kind = 'serial';
    this.label = '';
  }

  SerialTransport.isSupported = function () {
    return typeof navigator !== 'undefined' && !!navigator.serial;
  };

  /*
   * Ports the user has already granted, newest last. Used to reconnect
   * without a chooser: permission for a serial port survives a reload, so
   * asking again on every page load would be a dialog the user has already
   * answered.
   */
  SerialTransport.granted = function () {
    if (!SerialTransport.isSupported()) return Promise.resolve([]);
    return navigator.serial.getPorts();
  };

  // Opens the chooser. Must be called from a click -- the browser refuses
  // otherwise, and the refusal looks exactly like a printer that is not
  // there, so callers wire this straight to a button.
  SerialTransport.prototype.request = function () {
    if (!SerialTransport.isSupported()) return Promise.reject(new Error('This browser has no Web Serial. Use Chrome or Edge on Windows.'));
    var self = this;
    return navigator.serial.requestPort().then(function (port) { self.port = port; return port; });
  };

  SerialTransport.prototype.connect = function (port) {
    var self = this;
    var settings = Object.assign({}, (Profiles && Profiles.SERIAL_DEFAULTS) || {}, {
      baudRate: this.opts.baudRate || 9600,
    });
    var p = port ? Promise.resolve(port) : (this.port ? Promise.resolve(this.port) : this.request());
    return p.then(function (chosen) {
      self.port = chosen;
      return chosen.open(settings);
    }).then(function () {
      self.writer = self.port.writable.getWriter();
      self.label = describeSerialPort(self.port);
      return self;
    }).catch(function (err) {
      // "Failed to open serial port" on Windows is nearly always one of two
      // things, and the browser says neither. Saying them here saves the
      // half hour that otherwise goes into suspecting the printer.
      if (/open/i.test(err && err.message || '')) {
        throw new Error(err.message + ' — the port is either already open in another program '
          + '(close any POS or printer utility), or it is the printer\'s incoming port rather than '
          + 'the outgoing one. Windows creates two; the outgoing one is the one to pick.');
      }
      throw err;
    });
  };

  /*
   * Writes in chunks with a pause between them.
   *
   * A Bluetooth SPP virtual port accepts bytes far faster than the print head
   * can burn them, has no flow control to say so, and these printers have a
   * buffer of a few kilobytes. Send a long receipt in one go and the tail is
   * dropped -- which prints as a receipt that stops mid-item, a fault that
   * looks like corrupt data and is really just too much of it at once.
   */
  SerialTransport.prototype.write = function (bytes) {
    var self = this;
    if (!this.writer) return Promise.reject(new Error('Printer is not connected'));
    var data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var chunk = this.opts.chunkSize || 512;
    var pause = this.opts.chunkDelayMs === undefined ? 20 : this.opts.chunkDelayMs;
    var offset = 0;
    function step() {
      if (offset >= data.length) return Promise.resolve();
      var slice = data.subarray(offset, offset + chunk);
      offset += chunk;
      return self.writer.write(slice)
        .then(function () { return offset < data.length ? delay(pause) : null; })
        .then(step);
    }
    return step();
  };

  SerialTransport.prototype.close = function () {
    var self = this;
    if (!this.port) return Promise.resolve();
    var done = this.writer
      ? this.writer.close().catch(function () {}).then(function () { self.writer.releaseLock(); })
      : Promise.resolve();
    return done.then(function () { return self.port.close(); })
      .catch(function () {})
      .then(function () { self.writer = null; });
  };

  SerialTransport.prototype.isOpen = function () { return !!this.writer; };

  function describeSerialPort(port) {
    try {
      var info = port.getInfo ? port.getInfo() : {};
      if (info.usbVendorId) {
        return 'USB ' + hex4(info.usbVendorId) + ':' + hex4(info.usbProductId || 0);
      }
    } catch (e) { /* getInfo is optional; a missing label is not a failure */ }
    return 'Serial port';
  }
  function hex4(n) { return ('000' + Number(n).toString(16)).slice(-4); }

  /* ================= Web Bluetooth (BLE) =================
   *
   * Only for Low Energy printers. Web Bluetooth cannot reach a Classic SPP
   * printer at all -- the API has no RFCOMM -- so a Classic printer paired in
   * Windows will simply not appear in this chooser however long you wait.
   * That is not a bug to debug, it is the wrong transport, and the setup
   * guide says so in as many words.
   */
  function BluetoothTransport(opts) {
    this.opts = opts || {};
    this.device = null;
    this.characteristic = null;
    this.kind = 'bluetooth';
    this.label = '';
    this.chunkSize = this.opts.chunkSize || 180;
    this.onDisconnect = null;
  }

  BluetoothTransport.isSupported = function () {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  };

  /*
   * The chooser.
   *
   * Two passes, because the filtered form and the accept-all form cannot be
   * combined in one call. Filtered first, so known printers appear with
   * their services already granted; accept-all as the fallback, because a
   * printer whose service UUID is not in our list is still a printer and the
   * user should be able to pick it.
   */
  BluetoothTransport.prototype.request = function (acceptAll) {
    if (!BluetoothTransport.isSupported()) {
      return Promise.reject(new Error('This browser has no Web Bluetooth. Use Chrome or Edge.'));
    }
    var services = Profiles ? Profiles.bleServiceUuids() : [];
    var request = acceptAll
      ? { acceptAllDevices: true, optionalServices: services }
      : {
        filters: services.map(function (s) { return { services: [s] }; })
          .concat((Profiles ? Profiles.BLE_NAME_PREFIXES : []).map(function (n) { return { namePrefix: n }; })),
        optionalServices: services,
      };
    var self = this;
    return navigator.bluetooth.requestDevice(request).then(function (device) {
      self.device = device;
      return device;
    });
  };

  BluetoothTransport.prototype.connect = function (device) {
    var self = this;
    var p = device ? Promise.resolve(device) : (this.device ? Promise.resolve(this.device) : this.request(false));
    return p.then(function (dev) {
      self.device = dev;
      self.label = dev.name || 'Bluetooth printer';
      dev.addEventListener('gattserverdisconnected', function () {
        self.characteristic = null;
        if (self.onDisconnect) self.onDisconnect();
      });
      return dev.gatt.connect();
    }).then(function (server) {
      return findWritable(server);
    }).then(function (found) {
      self.characteristic = found.characteristic;
      self.serviceUuid = found.serviceUuid;
      // writeValueWithoutResponse is several times faster and is what these
      // printers expect; not every characteristic offers it, so the slower
      // acknowledged write stays as the fallback rather than an error.
      self.useAck = !found.characteristic.properties.writeWithoutResponse;
      return self;
    });
  };

  /*
   * Finds something to write to.
   *
   * The known list is tried first, in the order it is written -- the
   * likeliest vendors first. If none of them are present the services are
   * walked and the first writable characteristic is taken, which is how a
   * printer nobody has seen before still works.
   */
  function findWritable(server) {
    var known = Profiles ? Profiles.BLE_SERVICES : [];
    var i = 0;
    function tryKnown() {
      if (i >= known.length) return sweep();
      var entry = known[i++];
      return server.getPrimaryService(entry.service)
        .then(function (service) {
          var writes = entry.write.slice();
          function tryChar(j) {
            if (j >= writes.length) return tryKnown();
            return service.getCharacteristic(writes[j])
              .then(function (ch) { return { characteristic: ch, serviceUuid: entry.service }; })
              .catch(function () { return tryChar(j + 1); });
          }
          return tryChar(0);
        })
        .catch(function () { return tryKnown(); });
    }
    function sweep() {
      return server.getPrimaryServices().then(function (services) {
        var k = 0;
        function next() {
          if (k >= services.length) {
            throw new Error('Connected, but this device has no characteristic that accepts data. '
              + 'If it is an 80mm counter-top printer it is probably Bluetooth Classic, '
              + 'which has to be paired in Windows and used as a COM port instead.');
          }
          var service = services[k++];
          return service.getCharacteristics().then(function (chars) {
            var writable = chars.filter(function (c) {
              return c.properties.write || c.properties.writeWithoutResponse;
            })[0];
            if (writable) return { characteristic: writable, serviceUuid: service.uuid };
            return next();
          }).catch(next);
        }
        return next();
      });
    }
    return tryKnown();
  }

  /*
   * BLE carries about twenty bytes per packet unless the connection
   * negotiated something larger, and the browser will not say which it got.
   * So: send optimistically large, and on the first rejection drop to the
   * size that is always safe and carry on rather than failing the print.
   */
  BluetoothTransport.prototype.write = function (bytes) {
    var self = this;
    if (!this.characteristic) return Promise.reject(new Error('Printer is not connected'));
    var data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var pause = this.opts.chunkDelayMs === undefined ? 12 : this.opts.chunkDelayMs;
    var offset = 0;
    var shrunk = false;

    function send(slice) {
      return self.useAck
        ? self.characteristic.writeValue(slice)
        : self.characteristic.writeValueWithoutResponse(slice);
    }
    function step() {
      if (offset >= data.length) return Promise.resolve();
      var size = self.chunkSize;
      var slice = data.slice(offset, offset + size);
      return send(slice).then(function () {
        offset += slice.length;
        return delay(pause);
      }, function (err) {
        if (!shrunk && self.chunkSize > 20) {
          shrunk = true;
          self.chunkSize = 20;
          return delay(50);            // retry the same offset, smaller
        }
        throw err;
      }).then(step);
    }
    return step();
  };

  BluetoothTransport.prototype.close = function () {
    if (this.device && this.device.gatt && this.device.gatt.connected) this.device.gatt.disconnect();
    this.characteristic = null;
    return Promise.resolve();
  };

  BluetoothTransport.prototype.isOpen = function () {
    return !!(this.characteristic && this.device && this.device.gatt && this.device.gatt.connected);
  };

  /* ================= File =================
   *
   * Not a printer. Writes the job to a .bin the user can send to the printer
   * by other means -- `copy /b receipt.bin COM3` on Windows, or attaching it
   * to a bug report. When something prints wrongly this is what makes the
   * question answerable: the bytes are either right or they are not, and
   * that decides whether to look at this code or at the printer.
   */
  function FileTransport(opts) {
    this.opts = opts || {};
    this.kind = 'file';
    this.label = 'Save to file';
    this.chunks = [];
  }
  FileTransport.isSupported = function () { return true; };
  FileTransport.prototype.connect = function () { return Promise.resolve(this); };
  FileTransport.prototype.isOpen = function () { return true; };
  FileTransport.prototype.write = function (bytes) {
    var data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.chunks.push(data);
    if (typeof document !== 'undefined' && this.opts.download !== false) {
      var blob = new Blob([data], { type: 'application/octet-stream' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = this.opts.filename || 'receipt.bin';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    }
    return Promise.resolve();
  };
  FileTransport.prototype.close = function () { return Promise.resolve(); };

  return {
    SerialTransport: SerialTransport,
    BluetoothTransport: BluetoothTransport,
    FileTransport: FileTransport,
    delay: delay,
  };
}));
