/* The agent page inside the Android and iPhone app.

   Loaded first in <head>, and only does anything inside the app (the page
   is the same file the browser gets). Three jobs:

   1. Back (Android) closes what is on top -- a photo, a sheet, then the tab
      -- before it ever leaves the app, and leaving only puts it in the
      background so it reopens instantly.
   2. The status bar: the page draws to the top edge, so a strip behind the
      clock takes the colour of whatever is under it, and its icons stay
      readable against it.
   3. Staying current without a store release: the installed app checks the
      live agent.html now and then, keeps a copy of a new one on the phone,
      and switches to it the next time the app goes to the background --
      never in the middle of an order. */
(function(){
  'use strict';
  var C = window.Capacitor;
  if(!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return;
  var P = C.Plugins || {};
  var App = P.App, Bars = P.SystemBars, WebView = P.WebView, Http = P.CapacitorHttp, FS = P.Filesystem;
  var NAVY = '#16203C';

  /* ---- 1. back ---- */
  function back(){
    var tap = document.querySelector('.ag-lightbox') || document.querySelector('.ax-thanks [data-ty-close]') || document.querySelector('.ax-sent2');
    if(tap){ tap.click(); return; }
    if(typeof openSheets !== 'undefined' && openSheets.length){ openSheets[openSheets.length - 1].close(); return; }
    if(typeof currentView !== 'undefined' && currentView !== 'today' && typeof switchTab === 'function' && !document.querySelector('.ag-auth')){ switchTab('today'); return; }
    if(App) App.minimizeApp();
  }
  if(App) App.addListener('backButton', back);

  /* ---- 2. the strip behind the status bar ---- */
  var strip = null, lastStyle = '';
  function paintBar(){
    if(!strip) return;
    var hero = document.querySelector('#ag_todayView:not([hidden]) .ax-hero');
    var top = strip.offsetHeight;
    var onNavy = !!document.querySelector('.ag-auth, .ax-sent2, .ax-thanks, .ag-lightbox')
      || (hero && hero.getBoundingClientRect().bottom > top);
    strip.style.background = onNavy ? NAVY : 'var(--bg)';
    // Scrims dim the strip with the page, so the icons stay light then too.
    var style = onNavy || document.querySelector('.ax-scrim') ? 'DARK' : 'LIGHT';
    if(style !== lastStyle && Bars){ lastStyle = style; Bars.setStyle({ style: style }).catch(function(){}); }
  }
  var queued = false;
  function soon(){ if(queued) return; queued = true; requestAnimationFrame(function(){ queued = false; paintBar(); }); }
  document.addEventListener('DOMContentLoaded', function(){
    strip = document.createElement('div');
    strip.setAttribute('aria-hidden', 'true');
    strip.style.cssText = 'position:fixed;top:0;left:0;right:0;height:var(--safe-t, 0px);z-index:59;pointer-events:none;background:' + NAVY + ';';
    document.body.appendChild(strip);
    new MutationObserver(soon).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
    window.addEventListener('scroll', soon, { passive: true });
    paintBar();
  });

  /* ---- 3. staying current ---- */
  if(!(WebView && Http && FS && App && window.crypto && crypto.subtle)) return;
  var SOURCE = 'https://omni-ware.vercel.app/agent.html';
  var KEY = 'ow-app-bundle';
  var EVERY = 30 * 60 * 1000;
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)) || {}; }catch(_e){ return {}; } }
  function save(s){ try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(_e){} }
  function header(h, name){
    var k = Object.keys(h || {}).filter(function(x){ return x.toLowerCase() === name; })[0];
    return k ? h[k] : '';
  }
  function sha256(text){
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function(b){
      return Array.prototype.map.call(new Uint8Array(b), function(x){ return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  }
  // A file of the bundle running now, as base64 for the Filesystem plugin.
  function fileB64(name){
    return fetch(name, { cache: 'no-store' }).then(function(r){
      if(!r.ok) throw new Error(name + ': ' + r.status);
      return r.blob();
    }).then(function(blob){
      return new Promise(function(ok, fail){
        var fr = new FileReader();
        fr.onload = function(){ ok(String(fr.result).split(',')[1] || ''); };
        fr.onerror = fail;
        fr.readAsDataURL(blob);
      });
    });
  }
  function current(){ return fetch('bundle.json', { cache: 'no-store' }).then(function(r){ return r.json(); }); }

  // After a switch: make the new copy the one the app opens with, and drop
  // the copies nothing points at any more.
  function settle(){
    var s = load();
    if(!s.staged) return Promise.resolve();
    return WebView.getServerBasePath().then(function(cur){
      if(!cur || cur.path !== s.staged.path) return;
      return WebView.persistServerBasePath().then(function(){
        var keep = s.staged.dir;
        s.etag = s.staged.etag;
        delete s.staged;
        save(s);
        return FS.readdir({ path: 'live', directory: 'DATA' }).then(function(r){
          return Promise.all((r.files || []).map(function(f){
            var n = typeof f === 'string' ? f : f.name;
            return n === keep.split('/').pop() ? null : FS.rmdir({ path: 'live/' + n, directory: 'DATA', recursive: true }).catch(function(){});
          }));
        }).catch(function(){});
      });
    });
  }

  function check(){
    var s = load();
    if(s.staged || Date.now() - (s.checked || 0) < EVERY) return Promise.resolve();
    s.checked = Date.now();
    save(s);
    return Promise.all([current(), Http.request({ url: SOURCE, method: 'GET', responseType: 'text',
      headers: s.etag ? { 'If-None-Match': s.etag } : {} })]).then(function(pair){
      var mine = pair[0], res = pair[1];
      if(res.status !== 200) return;
      var html = typeof res.data === 'string' ? res.data : '';
      // Half a page is worse than an old page.
      if(html.length < 100000 || html.indexOf('</html>') === -1) return;
      var etag = header(res.headers, 'etag');
      return sha256(html).then(function(hash){
        if(hash === mine.source){ s.etag = etag; save(s); return; }
        var dir = 'live/' + hash.slice(0, 16);
        var rest = (mine.files || []).filter(function(f){ return f !== 'index.html' && f !== 'bundle.json'; });
        return FS.writeFile({ path: dir + '/index.html', data: window.owAppTransform(html), directory: 'DATA', encoding: 'utf8', recursive: true })
          .then(function(){
            return rest.reduce(function(p, f){
              return p.then(function(){ return fileB64(f); })
                .then(function(b64){ return FS.writeFile({ path: dir + '/' + f, data: b64, directory: 'DATA', recursive: true }); });
            }, Promise.resolve());
          })
          .then(function(){
            return FS.writeFile({ path: dir + '/bundle.json', data: JSON.stringify({ source: hash, files: mine.files }), directory: 'DATA', encoding: 'utf8', recursive: true });
          })
          .then(function(){ return FS.getUri({ path: dir, directory: 'DATA' }); })
          .then(function(u){
            var s2 = load();
            s2.staged = { dir: dir, path: decodeURI(String(u.uri).replace(/^file:\/\//, '')), etag: etag };
            save(s2);
          });
      });
    }).catch(function(){
      // No signal, or the server is down: the copy already here carries on.
    });
  }

  App.addListener('pause', function(){
    var s = load();
    if(s.staged) WebView.setServerBasePath({ path: s.staged.path }).catch(function(){});
  });
  App.addListener('resume', function(){ check(); });
  settle().catch(function(){}).then(function(){ setTimeout(check, 5000); });
})();
