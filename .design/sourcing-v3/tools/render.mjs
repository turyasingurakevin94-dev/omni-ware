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
  const res = await p.evaluate(({code, state, full}) => {
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
      r.style.height = 'auto'; r.style.minHeight = '844px'; r.style.overflow = 'visible';
      return { full: r.getBoundingClientRect().height };
    }
    const fr = r.getBoundingClientRect();
    let maxB = 0, maxR = 0, cut = [];
    r.querySelectorAll('*').forEach(el => {
      const bb = el.getBoundingClientRect(); if (!bb.width && !bb.height) return;
      maxB = Math.max(maxB, bb.bottom - fr.top); maxR = Math.max(maxR, bb.right - fr.left);
      if ((el.scrollWidth > el.clientWidth + 1) && getComputedStyle(el).overflow === 'visible' && el.children.length === 0) cut.push(el.textContent.slice(0, 40));
    });
    return {sh: r.scrollHeight, ch: r.clientHeight, maxB: Math.round(maxB), maxR: Math.round(maxR), w: fr.width};
  }, {code, state, full: !!process.env.FULL});
  await p.waitForTimeout(500);
  const name = path.basename(f).replace('.dc.html', '') + (state ? '_' + Object.keys(state).join('-') : '');
  await p.screenshot({path: path.join(outDir, name + '.png'), fullPage: !!process.env.FULL});
  if (process.env.FULL) { console.log('full', name, JSON.stringify(res)); await p.close(); continue; }
  const over = res.sh > res.ch || res.maxR > res.w + 1;
  if (over || errs.length) bad++;
  console.log((over ? 'OVER ' : 'ok   ') + name, JSON.stringify(res), errs.length ? errs : '');
  await p.close();
}
await b.close();
process.exit(bad ? 1 : 0);
