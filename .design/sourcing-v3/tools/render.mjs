// Renders a .dc.html board with its renderVals filled in, screenshots it, and
// reports whether content overflows the frame.
//   node render.mjs out_dir file.dc.html[@{"state":"json"}] ...
import {chromium} from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
const [outDir, ...args] = process.argv.slice(2);
fs.mkdirSync(outDir, {recursive: true});
const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
let bad = 0;
for (const arg of args) {
  const at = arg.indexOf('@');
  const f = at < 0 ? arg : arg.slice(0, at);
  const state = at < 0 ? null : JSON.parse(arg.slice(at + 1));
  const s = fs.readFileSync(f, 'utf8');
  const style = s.match(/<style>([\s\S]*?)<\/style>/)[1];
  const link = s.match(/<link[^>]*>/)[0];
  const body = s.split('</helmet>')[1].split('</x-dc>')[0];
  const code = s.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
  const m = body.match(/width:\s*(\d+)px;\s*height:\s*(\d+)px/);
  const html = `<!doctype html><html><head><meta charset="utf-8">${link}<style>${style}</style></head><body style="margin:0"><div id="tpl">${body}</div></body></html>`;
  const tmp = path.join(outDir, '_r.html'); fs.writeFileSync(tmp, html);
  const p = await b.newPage({viewport: {width: +m[1], height: +m[2]}, deviceScaleFactor: 1});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(tmp));
  const res = await p.evaluate(({code, state, full, audit}) => {
    class DCLogic { constructor(pr) { this.props = pr; this.state = {}; } setState(u) { Object.assign(this.state, u); } }
    const C = new Function('DCLogic', code + ';return Component')(DCLogic);
    const c = new C({}); if (state) Object.assign(c.state, state);
    const vals = c.renderVals();
    const get = (expr, scope) => {
      expr = expr.trim();
      if (expr === 'true') return true; if (expr === 'false') return false;
      return expr.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
    };
    const fill = (str, scope) => str.replace(/\{\{([^}]*)\}\}/g, (_, e) => { const v = get(e, scope); return v == null || typeof v === 'function' ? '' : String(v); });
    const walk = (node, scope) => {
      for (const ch of [...node.childNodes]) {
        if (ch.nodeType === 3) { if (ch.data.includes('{{')) ch.data = fill(ch.data, scope); continue; }
        if (ch.nodeType !== 1) continue;
        const tag = ch.tagName.toLowerCase();
        if (tag === 'sc-for') {
          const list = get(ch.getAttribute('list').replace(/[{}]/g, ''), scope) || [];
          const as = ch.getAttribute('as');
          for (const item of list) {
            const frag = document.createElement('div');
            for (const k of ch.childNodes) frag.appendChild(k.cloneNode(true));
            walk(frag, {...scope, [as]: item});
            while (frag.firstChild) node.insertBefore(frag.firstChild, ch);
          }
          ch.remove(); continue;
        }
        if (tag === 'sc-if') {
          const v = get(ch.getAttribute('value').replace(/[{}]/g, ''), scope);
          if (v && v !== 'false') { walk(ch, scope); while (ch.firstChild) node.insertBefore(ch.firstChild, ch); }
          ch.remove(); continue;
        }
        for (const a of [...ch.attributes]) {
          if (/^on/i.test(a.name)) { ch.removeAttribute(a.name); continue; }
          if (a.value.includes('{{')) ch.setAttribute(a.name, fill(a.value, scope));
        }
        walk(ch, scope);
      }
    };
    const tpl = document.getElementById('tpl');
    walk(tpl, vals);
    const root = tpl.firstElementChild;
    while (root && root.nodeType === 1 && root.tagName === 'DIV' && root !== tpl) break;
    const r = tpl.querySelector(':scope > div');
    // the deepest bottom edge of anything in normal flow or absolute, against the frame
    if (full) {
      // unroll the scrolling area so the whole screen can be looked at
      r.querySelectorAll('*').forEach(el => { const cs = getComputedStyle(el); if (cs.overflowY === 'auto') { el.style.overflow = 'visible'; el.style.flex = 'none'; if (cs.position === 'absolute') { el.style.position = 'relative'; el.style.inset = 'auto'; } } });
      [...r.children].forEach(ch => { const cs = getComputedStyle(ch); if (cs.position === 'absolute' && cs.display === 'flex' && cs.top === '0px' && cs.bottom === '0px') { ch.style.position = 'relative'; ch.style.inset = 'auto'; } });
      r.style.height = 'auto'; r.style.minHeight = '844px'; r.style.overflow = 'visible';
      return { full: r.getBoundingClientRect().height };
    }
    if (audit) {
      // rule 10: 44px targets (or a .hit area) and 4.5:1 text
      const out = [];
      const rgba = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
      const lum = ([r, g, b]) => { const f = (x) => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
      const blend = (top, bot) => [0, 1, 2].map(i => top[i] * top[3] + bot[i] * (1 - top[3])).concat(1);
      const bgOf = (el) => {
        const stack = [];
        for (let e = el; e && e !== document.body; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (cs.backgroundImage && cs.backgroundImage !== 'none') { const m = cs.backgroundImage.match(/rgba?\([^)]+\)|#[0-9a-f]{6}/i); stack.push(m && m[0].startsWith('rgb') ? rgba(m[0]) : [22, 32, 60, 1]); if (stack[stack.length - 1][3] >= 1) break; continue; }
          const c = rgba(cs.backgroundColor); if (c && c[3] > 0) { stack.push(c); if (c[3] >= 1) break; }
        }
        let bg = [247, 245, 242, 1];
        for (let i = stack.length - 1; i >= 0; i--) bg = stack[i][3] >= 1 ? stack[i] : blend(stack[i], bg);
        return bg;
      };
      const label = (el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 34);
      r.querySelectorAll('a, button, input, [role=radio], [role=tab], [role=switch], [role=checkbox]').forEach(el => {
        if (el.closest('[aria-hidden=true]')) return;
        const bb = el.getBoundingClientRect(); if (!bb.width || !bb.height) return;
        if (el.matches('input') && el.closest('label')) return;
        let w = bb.width, h = bb.height;
        const pb = getComputedStyle(el, '::before'); if (pb.content !== 'none' && pb.position === 'absolute') { w = Math.max(w, parseFloat(pb.width) || 0); h = Math.max(h, parseFloat(pb.height) || 0); }
        if (w < 43.5 || h < 43.5) out.push('TARGET ' + Math.round(bb.width) + 'x' + Math.round(bb.height) + ' ' + label(el));
      });
      const seen = new Set();
      r.querySelectorAll('*').forEach(el => {
        if (el.closest('svg')) return;
        const own = [...el.childNodes].some(n => n.nodeType === 3 && n.data.trim());
        if (!own) return;
        const bb = el.getBoundingClientRect(); if (!bb.width || !bb.height) return;
        const cs = getComputedStyle(el); let fg = rgba(cs.color); if (!fg) return;
        let op = 1; for (let e = el; e && e !== r; e = e.parentElement) op *= +getComputedStyle(e).opacity;
        const bg = bgOf(el); fg = blend([fg[0], fg[1], fg[2], fg[3] * op], bg);
        const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
        const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
        if (ratio < (big ? 3 : 4.5)) { const k = el.textContent.trim().slice(0, 30) + ' ' + ratio.toFixed(1); if (!seen.has(k)) { seen.add(k); out.push('CONTRAST ' + ratio.toFixed(2) + ' ' + cs.color + ' "' + el.textContent.trim().replace(/\s+/g, ' ').slice(0, 30) + '"'); } }
      });
      return { audit: out };
    }
    const fr = r.getBoundingClientRect();
    let maxB = 0, maxR = 0, cut = [];
    r.querySelectorAll('*').forEach(el => {
      const bb = el.getBoundingClientRect(); if (!bb.width && !bb.height) return;
      maxB = Math.max(maxB, bb.bottom - fr.top); maxR = Math.max(maxR, bb.right - fr.left);
      if ((el.scrollWidth > el.clientWidth + 1) && getComputedStyle(el).overflow === 'visible' && el.children.length === 0) cut.push(el.textContent.slice(0, 40));
    });
    return {sh: r.scrollHeight, ch: r.clientHeight, maxB: Math.round(maxB), maxR: Math.round(maxR), w: fr.width};
  }, {code, state, full: !!process.env.FULL, audit: !!process.env.AUDIT});
  await p.waitForTimeout(500);
  const name = path.basename(f).replace('.dc.html', '') + (state ? '_' + Object.keys(state).join('-') : '');
  await p.screenshot({path: path.join(outDir, name + '.png'), fullPage: !!process.env.FULL});
  if (process.env.AUDIT) { if (res.audit.length) bad++; console.log((res.audit.length ? 'FAIL ' : 'ok   ') + name + (res.audit.length ? '\n    ' + res.audit.join('\n    ') : '')); await p.close(); continue; }
  if (process.env.FULL) { console.log('full', name, JSON.stringify(res)); await p.close(); continue; }
  const over = res.sh > res.ch || res.maxR > res.w + 1;
  if (over || errs.length) bad++;
  console.log((over ? 'OVER ' : 'ok   ') + name, JSON.stringify(res), errs.length ? errs : '');
  await p.close();
}
await b.close();
process.exit(bad ? 1 : 0);
