'use strict';
/*
 * Loads a REAL edge function from supabase/functions/<name>/index.ts and
 * returns its Deno.serve handler, with createClient and fetch injected.
 * The only source rewrite is removing the npm: import line and `export `
 * keywords (both meaningless in a vm script); types are stripped by
 * Node's own module.stripTypeScriptTypes. No business logic is copied.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('module');

const ROOT = path.resolve(__dirname, '../../..');

function loadHandler(name, { createClient, fetch, env = {}, now } = {}) {
  const file = path.join(ROOT, 'supabase/functions', name, 'index.ts');
  let src = fs.readFileSync(file, 'utf8');
  const imports = src.match(/^import .*$/gm) || [];
  for (const line of imports) {
    if (!/npm:@supabase\/supabase-js@2/.test(line)) throw new Error('unexpected import in ' + name + ': ' + line);
  }
  src = src.replace(/^import .*$/gm, '').replace(/^export /gm, '');
  const js = stripTypeScriptTypes(src, { mode: 'strip' });
  let handler = null;
  const Deno = {
    env: { get: (k) => (k in env ? env[k] : { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'SERVICE', SUPABASE_ANON_KEY: 'ANON' }[k]) },
    serve: (h) => { handler = h; },
  };
  const ctx = {
    Deno, createClient, fetch: fetch || (async () => { throw new Error('network disabled in harness'); }),
    console: { log() {}, warn() {}, error: (...a) => ctx.__errors.push(a.map(String).join(' ')) }, __errors: [],
    crypto: globalThis.crypto, TextEncoder, Response, Request, Headers, URL, btoa, atob,
    Date, Math, JSON, Promise, Map, Set, Array, Object, String, Number, Boolean, Error, RegExp, Uint8Array, Uint32Array, Symbol,
    setTimeout, clearTimeout, parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent,
  };
  vm.createContext(ctx);
  vm.runInContext(js, ctx, { filename: file });
  if (!handler) throw new Error('no Deno.serve handler in ' + name);
  return { handler, ctx };
}

async function call(handler, body, headers = {}) {
  const req = new Request('https://fn.local/', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  const res = await handler(req);
  return { status: res.status, body: await res.json() };
}

module.exports = { loadHandler, call, ROOT };
