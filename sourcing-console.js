/* ============================================================
   The Sourcing console
   ------------------------------------------------------------
   What people ask for that the shop does not sell yet, followed
   from the ask to the shelf: capture, the five-step funnel, each
   item's verdict and plan, today's checklist of evidence to find
   or re-confirm, recommendations for every item, and the demand
   map.

   Built from the design canvas the owner signed off: the markup
   below IS that canvas's markup (classes renamed into ow-sv-), read
   by a small runtime, and the logic is the canvas's logic reading
   the shop's own records instead of a sample. Loaded after the
   main script, so every books helper it calls already exists.
   ============================================================ */
'use strict';
/* ---------------- The template runtime ----------------
   The Sourcing console was designed as a canvas: one markup file whose
   {{holes}}, <sc-for> and <sc-if> are filled from a single renderVals()
   object. Rather than re-typing that markup as string templates -- and
   letting the screen drift from the design the owner signed off -- the
   app interprets the same markup here.

   Each render builds a fresh tree from the template and MORPHS the live
   DOM into it, so a field being typed in keeps its focus and caret and a
   scrolled panel keeps its place. Handlers are stored on the element and
   reached through one listener per event type, so a morph that swaps a
   handler never stacks a second listener. */
const OWSV_EVENTS = {
  onclick: 'click', ondoubleclick: 'dblclick', onpointerdown: 'pointerdown', onpointermove: 'pointermove',
  onpointerup: 'pointerup', onpointerleave: 'pointerleave', ondragstart: 'dragstart', ondragover: 'dragover',
  ondrop: 'drop', ondragend: 'dragend', onkeydown: 'keydown', onsubmit: 'submit',
};
const OWSV_BOOL = { disabled: 1, checked: 1, hidden: 1, readonly: 1, selected: 1 };
function owsvResolve(scopes, path) {
  path = path.trim();
  if (path === 'true') return true;
  if (path === 'false') return false;
  const parts = path.split('.');
  let v;
  for (let i = scopes.length - 1; i >= 0; i--) {
    const s = scopes[i];
    if (s && Object.prototype.hasOwnProperty.call(s, parts[0])) { v = s[parts[0]]; break; }
  }
  for (let i = 1; i < parts.length && v != null; i++) v = v[parts[i]];
  return v;
}
function owsvText(scopes, str) {
  return str.replace(/\{\{([^}]+)\}\}/g, (m, p) => { const v = owsvResolve(scopes, p); return v == null || v === false ? '' : String(v); });
}
function owsvEventFor(el, attr) {
  if (attr === 'onchange') {
    const tag = el.localName, type = (el.getAttribute('type') || '').toLowerCase();
    return tag === 'select' || type === 'checkbox' || type === 'radio' || type === 'file' ? 'change' : 'input';
  }
  return OWSV_EVENTS[attr] || attr.slice(2);
}
function owsvBuild(node, scopes, out) {
  if (node.nodeType === 3) {
    const t = node.nodeValue;
    out.push(document.createTextNode(t.indexOf('{{') < 0 ? t : owsvText(scopes, t)));
    return;
  }
  if (node.nodeType !== 1) return;
  const tag = node.localName;
  if (tag === 'sc-for') {
    const list = owsvResolve(scopes, (node.getAttribute('list') || '').replace(/^\{\{|\}\}$/g, ''));
    const as = node.getAttribute('as');
    (Array.isArray(list) ? list : []).forEach(item => {
      const sc = scopes.concat([{ [as]: item }]);
      node.childNodes.forEach(ch => owsvBuild(ch, sc, out));
    });
    return;
  }
  if (tag === 'sc-if') {
    const v = owsvResolve(scopes, (node.getAttribute('value') || '').replace(/^\{\{|\}\}$/g, ''));
    if (v && v !== 'false') node.childNodes.forEach(ch => owsvBuild(ch, scopes, out));
    return;
  }
  const el = node.cloneNode(false);
  el.__svOn = null; el.__svVal = undefined;
  for (const a of Array.from(node.attributes)) {
    const name = a.name, val = a.value;
    if (name.indexOf('hint-placeholder') === 0) { el.removeAttribute(name); continue; }
    if (name.slice(0, 2) === 'on') {
      el.removeAttribute(name);
      const fn = owsvResolve(scopes, val.replace(/^\{\{|\}\}$/g, ''));
      if (typeof fn === 'function') (el.__svOn || (el.__svOn = {}))[owsvEventFor(node, name)] = fn;
      continue;
    }
    if (val.indexOf('{{') < 0) continue;
    const whole = /^\{\{[^}]+\}\}$/.test(val);
    const v = whole ? owsvResolve(scopes, val.slice(2, -2)) : owsvText(scopes, val);
    if (name === 'value' && (tag === 'input' || tag === 'textarea' || tag === 'select')) { el.removeAttribute(name); el.__svVal = v == null ? '' : String(v); continue; }
    if (OWSV_BOOL[name]) { if (v && v !== 'false') el.setAttribute(name, ''); else el.removeAttribute(name); continue; }
    if (v == null || v === false) el.removeAttribute(name); else el.setAttribute(name, String(v));
  }
  const kids = [];
  node.childNodes.forEach(ch => owsvBuild(ch, scopes, kids));
  kids.forEach(k => el.appendChild(k));
  out.push(el);
}
function owsvListen(el) {
  const on = el.__svOn;
  if (!on) return;
  const has = el.__svHas || (el.__svHas = {});
  Object.keys(on).forEach(type => {
    if (has[type]) return;
    has[type] = true;
    el.addEventListener(type, e => { const fn = el.__svOn && el.__svOn[type]; if (fn) fn(e); });
  });
}
function owsvSetValue(el, v) {
  if (v === undefined) return;
  if (el.value !== v) el.value = v;
}
function owsvMorph(oldEl, newEl) {
  // attributes
  const oa = oldEl.attributes, na = newEl.attributes;
  for (let i = oa.length - 1; i >= 0; i--) { const n = oa[i].name; if (!newEl.hasAttribute(n)) oldEl.removeAttribute(n); }
  for (let i = 0; i < na.length; i++) { const { name, value } = na[i]; if (oldEl.getAttribute(name) !== value) oldEl.setAttribute(name, value); }
  oldEl.__svOn = newEl.__svOn; owsvListen(oldEl);
  owsvMorphChildren(oldEl, newEl);
  if (newEl.__svVal !== undefined) owsvSetValue(oldEl, newEl.__svVal);
}
function owsvSame(a, b) {
  return a.nodeType === b.nodeType && (a.nodeType !== 1 || (a.namespaceURI === b.namespaceURI && a.localName === b.localName));
}
function owsvAdopt(el) {
  // a freshly built subtree going in whole: wire its listeners and values
  if (el.nodeType !== 1) return;
  owsvListen(el);
  el.childNodes.forEach(owsvAdopt);
  if (el.__svVal !== undefined) owsvSetValue(el, el.__svVal);
}
function owsvMorphChildren(oldP, newP) {
  const o = Array.from(oldP.childNodes), n = Array.from(newP.childNodes);
  for (let i = 0; i < n.length; i++) {
    const nn = n[i], on = o[i];
    if (!on) { oldP.appendChild(nn); owsvAdopt(nn); continue; }
    if (!owsvSame(on, nn)) { oldP.replaceChild(nn, on); owsvAdopt(nn); continue; }
    if (nn.nodeType === 3) { if (on.nodeValue !== nn.nodeValue) on.nodeValue = nn.nodeValue; continue; }
    owsvMorph(on, nn);
  }
  for (let i = n.length; i < o.length; i++) oldP.removeChild(o[i]);
}
/* Mount a component class (DCLogic shape: this.state, setState,
   renderVals) onto an element, rendering the given markup. */
class OwsvLogic {
  constructor(props) { this.props = props || {}; this.state = {}; }
  setState(patch) {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = Object.assign({}, this.state, p);
    this.__owsvSchedule && this.__owsvSchedule();
  }
  forceUpdate() { this.__owsvSchedule && this.__owsvSchedule(); }
}
function owsvMount(host, markup, comp) {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup;
  const root = tpl.content;
  let queued = false;
  const render = () => {
    queued = false;
    let vals;
    try { vals = comp.renderVals(); host.removeAttribute('data-sv-error'); }
    catch (e) {
      /* A failure must name itself, and must not leave the page stuck on
         the item that broke it: close what was open and draw again, and
         say what failed in the status line. */
      console.error('Sourcing console render failed', e);
      host.setAttribute('data-sv-error', e.message);
      comp.state = Object.assign({}, comp.state, { task: null, psOpen: false, clPreview: false, log: `Something on this screen failed to draw (${e.message}) — the item was closed.` });
      try { vals = comp.renderVals(); } catch (e2) { host.innerHTML = '<div class="ow-empty"><b>The Sourcing screen could not be drawn.</b> ' + String(e2.message).replace(/[<>&]/g, '') + '</div>'; return; }
    }
    const out = [];
    root.childNodes.forEach(ch => owsvBuild(ch, [vals], out));
    const frag = document.createElement('div');
    out.forEach(n => frag.appendChild(n));
    owsvMorphChildren(host, frag);
  };
  comp.__owsvSchedule = () => { if (queued) return; queued = true; Promise.resolve().then(render); };
  comp.__owsvRenderNow = render;
  render();
  return { render, comp };
}

/* ---------------- Small things the console needs from the page ---------------- */
/* Today's ticks on the checklist are a per-device convenience -- what
   you ticked this morning -- so they live in this browser, keyed by shop
   and day, and start fresh tomorrow. Everything the checklist CHANGES
   (a confirmed price, a buyer who dropped out) is a real write. */
function owsvDayKey(k) {
  const shop = (typeof currentShopId !== 'undefined' && currentShopId) ? currentShopId : '';
  return `ow-sv-${k}-${shop}-${new Date().toISOString().slice(0, 10)}`;
}
function owsvDayGet(k, dflt) { try { const v = localStorage.getItem(owsvDayKey(k)); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; } }
function owsvDaySet(k, v) { try { localStorage.setItem(owsvDayKey(k), JSON.stringify(v)); } catch (e) {} }
/* Nothing sends itself: this opens WhatsApp with the words written, and
   the owner presses send there. False when there is no number to open. */
function owsvWhatsApp(phone, text) {
  let d = String(phone || '').replace(/[^0-9]/g, '');
  if (d.length < 9) return false;
  if (d.startsWith('0')) d = '256' + d.slice(1); else if (!d.startsWith('256')) d = '256' + d;
  try { window.open(`https://wa.me/${d}?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); } catch (e) { return false; }
  return true;
}
/* Print one sheet and nothing else: a copy goes to the end of the body,
   everything else is hidden for the print, and the copy is removed. */
function owsvPrint(sel) {
  const src = document.querySelector('#sourcingWrap ' + sel);
  if (!src) return;
  const host = document.createElement('div');
  host.className = 'ow-sv-print-host';
  const clone = src.cloneNode(true);
  clone.style.display = 'block';
  host.appendChild(clone);
  document.body.appendChild(host);
  document.body.classList.add('ow-sv-printing');
  try { window.print(); } catch (e) {} finally { document.body.classList.remove('ow-sv-printing'); host.remove(); }
}

class OwSourcingConsole extends OwsvLogic {
  constructor(p){ super(p); this.state = { filter: 'all', open: null, capItem: '', capPick: null, capVars: [], capVarNew: '', capQty: '', capPack: '', capUnit: 'pcs', capNote: '', capChannel: 'c', capClient: null, capClientQ: '', capPhone: '', capWalkin: false, capWhen: 'week', capMax: '', capFollow: true, capFrom: null, rail: null, holdMode: null, psOpen: false, psTo: null, psQ: '', psDays: 7, psShow: {}, actPage: 0, vdMore: false, rivalsAdd: {}, rivalsCut: {}, rvName: '', rvPrice: '', rvArea: '', rvStock: 'In stock', rvHow: 'visit', taskQS: '', taskTerms: {}, taskTiers: {}, taskOpenSup: null, taskPacks: {}, taskTrans: {}, supMarks: {}, supQ: '', newSup: null, extraSups: [], mTab: 'overview', follow: {}, events: {}, expanded: {}, snoozed: [], told: [], renaming: null, renameVal: '', addAsk: false, askWho: '', askQty: '', mergeOpen: false, task: null, taskSup: '', taskSups: [], taskPrices: {}, taskMin: '', taskShelf: '', dragging: null, hint: null, log: null, hist: [], dropped: [], who: 'all', dropAsk: false, moved: {}, added: [], taken: [], draftName: '', draftWho: '', draftQty: '', sortKey: 'rank', dir: 1, page: 0, per: 5, vx0: 0, vx1: 30, vy0: 0, vy1: 8, sel: null, limitsOpen: false, limDraft: {}, clDone: owsvDayGet('done', []), clGone: owsvDayGet('gone', {}) }; this.drag = null; }
  /* ---------------- The shop's own records, in the console's shape ----------------
     The console was designed against a fixed sample; here every one of
     those shapes is built from the books instead. A lead keeps its rank
     (its place in the order it was first asked for) for as long as it
     exists, so the console can key its view state on a number.

     What the books did not have before this screen -- competitor prices
     with their stock and volume breaks, when a quote was last confirmed,
     a snooze -- rides in the lead's candidates list as kind-tagged rows.
     loadData() lifts them out into lead.research before anything else
     sees the list, so every supplier-reading function in the app keeps
     reading suppliers only. */
  owLeads() {
    return sourcingLeadsAll().slice().sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id).localeCompare(String(b.id)));
  }
  owData() {
    const DAY = 86400000, now = Date.now();
    const leads = this.owLeads();
    const byRank = {}, rankOf = {};
    leads.forEach((l, i) => { byRank[i + 1] = l; rankOf[l.id] = i + 1; });
    this._byRank = byRank; this._rankOf = rankOf;
    const daysSince = t => { const ms = typeof t === 'number' ? t : new Date(t).getTime(); return isNaN(ms) ? 0 : Math.max(0, Math.floor((now - ms) / DAY)); };
    const STAGE = { asked: 0, looking: 1, sourced: 2, priced: 3, listed: 4 };
    const staffAll = (data.staff || []).filter(s => s && s.name && !s.archived && s.active !== false);
    const staffById = {}; (data.staff || []).forEach(s => { staffById[String(s.id)] = s; });
    const PAL = [['#E4E6FA', '#3A3F9B'], ['#DCEAF8', '#1A5A8A'], ['#E4F4EA', '#0F6B43'], ['#F6E4F1', '#7A3268'], ['#FDEEE1', '#7A4A02']];
    const iniOf = n => String(n).split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    const AV = {}; staffAll.forEach((s, i) => { AV[s.name] = [PAL[i % PAL.length][0], PAL[i % PAL.length][1], iniOf(s.name)]; });
    const limits = data.presetSourcingStageLimits || {};
    const LIM = [Number(limits.asked) || 2, Number(limits.looking) || 7, Number(limits.sourced) || 5, Number(limits.priced) || 3];
    const research = l => (l.research || (l.research = { rivals: [], meta: {} }));
    const metaOf = l => { const r = research(l); return r.meta || (r.meta = {}); };
    const supRec = c => (c.supplierId && (data.suppliers || []).find(s => String(s.id) === String(c.supplierId))) || null;
    const candName = c => String((supRec(c) || {}).name || c.supplierName || '').trim();
    const SRCMAP = { quote: 'q', whatsapp: 'w', wa: 'w', assistant: 'w', copilot: 'w', phone: 'p' };
    const srcOf = r => r.channel || SRCMAP[String(r.source || '').toLowerCase()] || 'c';
    const custById = {}; (data.customers || []).forEach(c => { custById[String(c.id)] = c; });
    const askerName = r => { const n = sourcingAskerName(r); return n || (srcOf(r) === 'q' ? 'Quote search' : 'Walk-in'); };
    const personKey = r => r.customerId ? 'c:' + r.customerId : sourcingPhoneKey(r.phone) ? 'p:' + sourcingPhoneKey(r.phone) : String(askerName(r)).trim().toLowerCase();
    /* one row per PERSON, the way the console reads asks: their total, how
       they asked, and how fresh the ask is (a confirmation resets it) */
    const askRows = l => {
      const rows = [], idx = {};
      (l.requests || []).forEach(r => {
        if (r.withdrawn) return;
        const k = personKey(r);
        const fresh = daysSince(r.confirmedAt || r.at);
        if (idx[k] == null) { idx[k] = rows.length; rows.push([askerName(r), Number(r.qty) || 0, srcOf(r), fresh, k]); }
        else { const x = rows[idx[k]]; x[1] += Number(r.qty) || 0; x[3] = Math.min(x[3], fresh); }
      });
      return rows;
    };
    const unitOfLead = l => metaOf(l).unit || ((l.candidates || []).map(c => String(c.unit || '').trim()).find(Boolean)) || 'pcs';
    const items = [], det = {}, riv = {}, quoteAge = {}, vars = {};
    leads.forEach((l, i) => {
      const rank = i + 1, meta = metaOf(l);
      const cands = (l.candidates || []).filter(c => candName(c));
      const stage = l.voided ? Math.min(3, STAGE[l.status] || 0) : (STAGE[l.status] == null ? 0 : STAGE[l.status]);
      const staff = l.assignedStaffId ? staffById[String(l.assignedStaffId)] : null;
      const owner = staff ? staff.name : '';
      const days = stage < 4 && l.stageEnteredAt ? daysSince(Number(l.stageEnteredAt)) : 0;
      const asks = askRows(l);
      const firstAt = (l.requests || []).map(r => new Date(r.at).getTime()).filter(t => !isNaN(t));
      const wait = firstAt.length ? daysSince(Math.min(...firstAt)) : daysSince(l.createdAt);
      const unit = unitOfLead(l);
      const qtyTot = asks.reduce((a, x) => a + x[1], 0);
      const priced = cands.filter(c => candidateTiers(c).length);
      const low = c => { const t = candidateTiers(c); return t.length ? t[0] : null; };
      const prices = {}; priced.forEach(c => { const t = low(c); if (t && prices[candName(c)] == null) prices[candName(c)] = t.price; });
      const tiers = {}; priced.forEach(c => { const n = candName(c); if (!tiers[n]) tiers[n] = candidateTiers(c).map(t => ({ q: Math.max(1, t.minQty), p: t.price })); });
      const trans = {}, packs = {}, terms = {};
      cands.forEach(c => { const n = candName(c);
        if (c.transport) trans[n] = c.transport;
        if (Number(c.packQty) > 0) packs[n] = `${c.packQty}${c.packUnit ? ' ' + c.packUnit : ''}`;
        terms[n] = { lead: c.leadTimeDays == null ? (c.leadText || '2 days') : c.leadTimeDays === 0 ? 'Same day' : c.leadTimeDays >= 21 ? '3 weeks' : c.leadTimeDays >= 7 ? '1 week' : `${c.leadTimeDays} days`, valid: `${Number(c.validDays) || 7} days` }; });
      const known = [cands.length ? 1 : 0, priced.length ? 1 : 0, cands.some(c => Number(c.packQty) > 0) ? 1 : 0, l.image ? 1 : 0];
      const kind = stage === 0 || (stage === 1 && !owner) ? 'assign' : stage === 1 ? 'supplier' : stage === 2 ? 'price' : 'list';
      const unpriced = cands.find(c => !candidateTiers(c).length);
      const move = stage >= 4 ? 'Listed' : kind === 'assign' ? (owner && stage === 0 ? `${owner} to start looking` : 'Give it to someone')
        : kind === 'supplier' ? 'Find who has it' : kind === 'price' ? (unpriced ? `Get ${candName(unpriced).split(' ')[0]}’s price` : 'Get their price') : 'Add it to what we sell';
      const over = stage < 3 && days > LIM[Math.min(stage, 3)];
      const best = Object.values(prices).length ? Math.min(...Object.values(prices)) : 0;
      const maxAsk = Math.max(0, ...(l.requests || []).map(r => Number(r.maxPrice) || 0));
      items.push({ rank, id: l.id, name: l.name || 'Unnamed item', stage, state: stage >= 3 ? 'ready' : over ? 'over' : owner ? 'track' : 'nobody', known, days, limit: LIM[Math.min(stage, 3)],
        askers: asks.length, wait, qty: qtyTot ? `${qtyTot} ${unit}` : '', cost: best && qtyTot ? `UGX ${(best * qtyTot).toLocaleString('en-US')}` : '', owner, move,
        isNew: stage === 0 && daysSince(l.createdAt) < 1, former: meta.former || '', askList: asks.map(x => x.slice(0, 4)),
        ...(priced.length ? { prices, tiers, trans, packs, terms } : {}), ...(cands.length ? { suppliers: cands.map(candName).filter((n, j, a) => a.indexOf(n) === j) } : {}),
        shelf: meta.shelf || 0, maxPrice: maxAsk || 0, voided: !!l.voided });
      det[rank] = { unit, room: null, askers: asks.map(x => x.slice(0, 4)),
        sups: cands.map(c => { const t = low(c); return [candName(c), t ? t.price : null, t ? (t.minQty > 1 ? `min ${t.minQty}` : 'any qty') : 'has it · no price']; })
          .filter((x, j, a) => a.findIndex(y => y[0] === x[0]) === j),
        known: [cands.length ? `${cands.length} ${cands.length === 1 ? 'source' : 'sources'}` : '', priced.length ? `${priced.length} of ${cands.length} priced` : '',
          (cands.find(c => Number(c.packQty) > 0) || {}).packQty ? `${cands.find(c => Number(c.packQty) > 0).packUnit || 'pack'} of ${cands.find(c => Number(c.packQty) > 0).packQty}` : '', l.image ? 'on file' : ''] };
      riv[rank] = (research(l).rivals || []).map(r => [r.name, Number(r.price) || 0, r.stock || 'In stock', r.area || '—', daysSince(r.seenAt || l.createdAt), r.how || 'visit', (r.breaks || []).map(b => [Number(b.q), Number(b.p)])]);
      quoteAge[rank] = {}; priced.forEach(c => { const n = candName(c); if (quoteAge[rank][n] == null) quoteAge[rank][n] = daysSince(c.quotedAt || c.at || l.createdAt); });
      vars[rank] = leadVariantChoices(l);
    });
    /* suppliers: what they sell is what they already price for you */
    const prodById = {}; (data.products || []).forEach(p => { prodById[String(p.id)] = p; });
    const words = s => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
    const supProducts = {}; (data.prices || []).forEach(p => { if (!p.supplierId) return; const pr = prodById[String(p.productId)]; if (!pr) return; (supProducts[String(p.supplierId)] || (supProducts[String(p.supplierId)] = new Set())).add(pr); });
    const invBySup = {}; (data.purchaseInvoices || []).forEach(pi => { if (pi.voided || !pi.supplierId) return; (invBySup[String(pi.supplierId)] || (invBySup[String(pi.supplierId)] = [])).push(pi); });
    const importers = new Set(); leads.forEach(l => (l.candidates || []).forEach(c => { if (c.role === 'importer' && c.supplierId) importers.add(String(c.supplierId)); }));
    const sups = (data.suppliers || []).filter(s => s && s.name).map(s => {
      const prods = [...(supProducts[String(s.id)] || [])];
      const cats = [...new Set(prods.map(p => String(p.category || '').trim().toLowerCase()).filter(Boolean))].slice(0, 6);
      const inv = invBySup[String(s.id)] || [];
      const lastD = inv.length ? Math.min(...inv.map(pi => daysSince(pi.date))) : null;
      return { id: s.id, name: s.name, cats: cats.length ? cats : ['general'], orders: inv.length, last: lastD == null ? '—' : lastD, lead: '2 days',
        phone: s.phone || '', loc: s.location || '—', kind: importers.has(String(s.id)) ? 'Importer' : '', _words: new Set(prods.flatMap(p => words(p.name))) };
    });
    const supHits = (sp, itemName) => { const w = words(itemName); const hit = w.filter(x => sp._words && sp._words.has(x)); return hit.length ? [...new Set(hit)].slice(0, 3) : []; };
    /* clients: orders and what they owe from the books; a regular is five orders or more */
    const ordersBy = {}; (data.savedQuotes || []).forEach(q => { if (q.voided || !q.customerId || q.status === 'draft') return; ordersBy[String(q.customerId)] = (ordersBy[String(q.customerId)] || 0) + 1; });
    const asksBy = {}; leads.forEach(l => { const seen = new Set(); (l.requests || []).forEach(r => { if (r.customerId && !seen.has(r.customerId)) { seen.add(r.customerId); asksBy[String(r.customerId)] = (asksBy[String(r.customerId)] || 0) + 1; } }); });
    const clients = (data.customers || []).filter(c => c && c.name).map(c => ({ id: c.id, name: c.name, phone: c.phone || '', orders: ordersBy[String(c.id)] || 0, owes: Number(c.debt) || 0, asks: asksBy[String(c.id)] || 0, regular: (ordersBy[String(c.id)] || 0) >= 5 }))
      .sort((a, b) => b.orders - a.orders);
    const areas = [...new Set([...(data.suppliers || []).map(s => String(s.location || '').trim()), ...leads.flatMap(l => ((l.research || {}).rivals || []).map(r => r.area))].filter(a => a && a !== '—'))].slice(0, 12);
    const catalog = (data.products || []).filter(p => p && p.name && !p.voided && !p.archived).map(p => ({ id: p.id, name: p.name, stock: Object.keys(data.stock || {}).filter(k => k === String(p.id) || k.indexOf(String(p.id) + '::') === 0).reduce((t, k) => t + (Number(data.stock[k]) || 0), 0), unit: p.unit || 'pcs' }));
    return { items, det, riv, quoteAge, vars, staff: staffAll.map(s => s.name), AV, LIM, sups, supHits, clients, areas, catalog, byRank, rankOf, iniOf, now };
  }
  /* ---------------- Writing it back ----------------
     The console speaks in view state -- moved, dropped, rivalsAdd,
     quoteFix -- because that is how it was designed. Those keys are not
     kept here: every render reads them fresh from the books (owDerived),
     and every setState that carries one is turned into a real write on
     the lead (owPersist), then saved. So a change made on this screen is
     the same change the rest of the app, and the next device, sees. */
  owDerived() {
    const now = Date.now(), leads = this.owLeads();
    const d = { dropped: [], snoozed: [], told: [], rivalsAdd: {}, rivalsCut: {}, rivalsFix: {}, quoteFix: {}, buyerFix: {}, extraSups: [], moved: {}, added: [], supMarks: {}, events: {}, follow: {} };
    leads.forEach((l, i) => {
      const rank = i + 1, meta = ((l.research || {}).meta) || {};
      if (l.voided) d.dropped.push(rank);
      if (meta.snoozedUntil && meta.snoozedUntil > now) d.snoozed.push(rank);
      if (meta.told) d.told.push(rank);
      if (meta.supMarks) d.supMarks[rank] = meta.supMarks;
      if (Array.isArray(meta.events) && meta.events.length) d.events[rank] = meta.events.map(e => (e && e.t) || String(e));
      Object.keys(meta.follow || {}).forEach(n => { d.follow[`${rank}:${n}`] = meta.follow[n]; });
    });
    return d;
  }
  setState(patch) {
    const p = typeof patch === 'function' ? patch(this.state) : Object.assign({}, patch);
    const KEYS = ['__leads', 'moved', 'dropped', 'snoozed', 'told', 'rivalsAdd', 'rivalsCut', 'rivalsFix', 'quoteFix', 'buyerFix', 'extraSups', 'added', 'supMarks', 'events', 'follow'];
    const hit = KEYS.filter(k => Object.prototype.hasOwnProperty.call(p, k));
    if (hit.length && !this._inner) {
      try { this.owPersist(p, hit); } catch (e) { console.error('Sourcing console could not save', e); p.log = `That change did not save — ${e.message}`; }
      hit.forEach(k => { delete p[k]; });
    }
    if (Object.prototype.hasOwnProperty.call(p, 'clDone')) owsvDaySet('done', p.clDone);
    if (Object.prototype.hasOwnProperty.call(p, 'clGone')) owsvDaySet('gone', p.clGone);
    super.setState(p);
  }
  owLead(rank) { return (this._byRank || {})[rank] || null; }
  owMeta(l) { const r = l.research || (l.research = { rivals: [], meta: {} }); if (!r.rivals) r.rivals = []; return r.meta || (r.meta = {}); }
  owCandName(c) { const s = c.supplierId && (data.suppliers || []).find(x => String(x.id) === String(c.supplierId)); return String((s && s.name) || c.supplierName || '').trim(); }
  owCand(l, name) {
    const hit = (l.candidates || []).find(c => this.owCandName(c).toLowerCase() === String(name).toLowerCase());
    if (hit) return hit;
    const sup = (data.suppliers || []).find(s => String(s.name).toLowerCase() === String(name).toLowerCase());
    const c = { id: 'C' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(), at: new Date().toISOString(),
      role: /importer/i.test(name) ? 'importer' : 'supplier', supplierId: sup ? sup.id : null, supplierName: sup ? sup.name : String(name),
      phone: sup ? (sup.phone || '') : '', where: sup ? (sup.location || '') : '', note: '', unit: '', tiers: [], skus: [], packQty: 0, packUnit: '',
      supplierSku: '', leadTimeDays: null, packOverrides: [], piecesPerUnit: null, variantOverrides: [] };
    (l.candidates || (l.candidates = [])).push(c);
    return c;
  }
  owStaffId(name) { const s = (data.staff || []).find(x => x.name === name); return s ? s.id : null; }
  owClient(name) {
    const n = x => String(x || '').toLowerCase().replace(/\b(ltd|limited|co)\b\.?/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const k = n(name); if (!k) return null;
    return (data.customers || []).find(c => { const m = n(c.name); return m === k || m.startsWith(k) || k.startsWith(m); }) || null;
  }
  owAskerOf(r) { const n = sourcingAskerName(r); return n || (r.channel === 'q' || r.source === 'quote' ? 'Quote search' : 'Walk-in'); }
  owSamePerson(r, name) {
    const n = x => String(x || '').toLowerCase().replace(/\b(ltd|limited|co)\b\.?/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const a = n(this.owAskerOf(r)), b = n(name); return !!a && !!b && (a === b || a.startsWith(b) || b.startsWith(a));
  }
  owAsk(l, name, qty, src, extra) {
    const c = name && name !== 'Walk-in' && name !== '—' ? this.owClient(name) : null;
    const x = extra || {};
    const r = { at: new Date().toISOString(), source: 'sourcing', channel: src || 'c', customerId: c ? c.id : null,
      customerName: name === 'Walk-in' || name === '—' ? '' : (c ? c.name : String(name || '')), phone: c ? (c.phone || '') : (x.phone || ''),
      variant: x.variant || '', qty: qty == null ? null : Number(qty), orderId: null, conversationId: null, note: x.note || '',
      ...(x.maxPrice ? { maxPrice: x.maxPrice } : {}), ...(x.when ? { when: x.when } : {}) };
    (l.requests || (l.requests = [])).push(r);
    if (c && x.follow !== false && typeof addFollowUp === 'function') { try { addFollowUp(c.id, { leadId: l.id }, { qty: r.qty, note: r.variant }); } catch (e) {} }
    return r;
  }
  owSetStage(l, stage) {
    const ST = ['asked', 'looking', 'sourced', 'priced'];
    const next = ST[stage];
    if (!next || l.status === next) return;
    if (l.status === 'listed') { l.productId = null; l.graduatedAt = null; }
    l.status = next; l.stageEnteredAt = Date.now();
  }
  owApply(l, patch) {
    const meta = this.owMeta(l);
    if (patch.name && patch.name !== l.name) { meta.former = patch.former || meta.former || l.name; l.name = patch.name; }
    if (Object.prototype.hasOwnProperty.call(patch, 'owner')) l.assignedStaffId = patch.owner ? this.owStaffId(patch.owner) : null;
    (patch.suppliers || []).forEach(n => this.owCand(l, n));
    if (patch.tiers || patch.prices) {
      const T = patch.tiers || Object.fromEntries(Object.entries(patch.prices).map(([n, p]) => [n, [{ q: 1, p }]]));
      Object.keys(T).forEach(n => { const c = this.owCand(l, n); const ts = (T[n] || []).filter(t => Number(t.p) > 0);
        if (ts.length) { c.tiers = ts.map(t => ({ minQty: Math.max(1, Number(t.q) || 1), price: Number(t.p) })).sort((a, b) => a.minQty - b.minQty); c.quotedAt = new Date().toISOString(); } });
    }
    Object.entries(patch.packs || {}).forEach(([n, v]) => { const m = String(v || '').match(/(\d+)\s*(.*)/); if (!m) return; const c = this.owCand(l, n); c.packQty = Number(m[1]) || 0; c.packUnit = (m[2] || '').trim() || c.packUnit || 'pack'; });
    Object.entries(patch.trans || {}).forEach(([n, v]) => { const t = parseInt(String(v || '').replace(/[^0-9]/g, ''), 10); if (!isNaN(t)) this.owCand(l, n).transport = t; });
    Object.entries(patch.terms || {}).forEach(([n, t]) => { const c = this.owCand(l, n); if (!t) return;
      const lead = String(t.lead || ''); c.leadTimeDays = /same/i.test(lead) ? 0 : /3 week/i.test(lead) ? 21 : /week/i.test(lead) ? 7 : (parseInt((lead.match(/\d+/) || [''])[0], 10) || null);
      c.validDays = parseInt((String(t.valid || '').match(/\d+/) || ['7'])[0], 10) || 7; });
    if (patch.askList) {
      const extra = this._capExtra || {};
      patch.askList.forEach(x => {
        const [name, qty, src] = x;
        const mine = (l.requests || []).filter(r => !r.withdrawn && this.owSamePerson(r, name));
        const had = mine.reduce((a, r) => a + (Number(r.qty) || 0), 0);
        if (!mine.length) this.owAsk(l, name, qty, src, extra);
        else if (qty > had) this.owAsk(l, name, qty - had, src, extra);
      });
    }
    if (patch.shelf) meta.shelf = patch.shelf;
    if (patch.shelfTiers) meta.shelfTiers = patch.shelfTiers;
    if (patch.stage != null) {
      if (patch.stage >= 4) { this._graduate = l.id; }
      else this.owSetStage(l, patch.stage);
    }
  }
  owMerge(keepRank, goneRank) {
    const keep = this.owLead(keepRank), gone = this.owLead(goneRank);
    if (!keep || !gone || keep === gone) return;
    keep.requests = [...(keep.requests || []), ...(gone.requests || [])];
    (gone.candidates || []).forEach(c => { if (!(keep.candidates || []).some(k => this.owCandName(k).toLowerCase() === this.owCandName(c).toLowerCase())) (keep.candidates || (keep.candidates = [])).push(c); });
    const km = this.owMeta(keep), gr = ((gone.research || {}).rivals) || [];
    gr.forEach(r => { if (!keep.research.rivals.some(x => x.name === r.name)) keep.research.rivals.push(r); });
    gone.voided = true; gone.droppedAt = new Date().toISOString(); gone.droppedReason = `Merged into ${keep.name}`;
    km.events = [...(km.events || []), { t: `Merged “${gone.name}” into this card`, at: Date.now() }].slice(-60);
    saveData();
  }
  owPersist(p, hit) {
    const now = Date.now(), iso = new Date().toISOString();
    const before = this.owDerived();
    let graduate = null;
    this._graduate = null;
    if (p.__leads) {
      data.sourcingLeads = JSON.parse(p.__leads);
    }
    if (p.moved) Object.keys(p.moved).forEach(rank => { const l = this.owLead(+rank); if (l) this.owApply(l, p.moved[rank] || {}); });
    if (p.dropped) {
      const reason = (String(p.log || this.state.log || '').match(/dropped — ([^.]+)\./) || [])[1] || '';
      p.dropped.filter(r => !before.dropped.includes(r)).forEach(r => { const l = this.owLead(r); if (l && !l.voided) { l.voided = true; l.droppedAt = iso; l.droppedReason = reason ? reason.charAt(0).toUpperCase() + reason.slice(1) : (l.droppedReason || 'Not stocking'); } });
      before.dropped.filter(r => !p.dropped.includes(r)).forEach(r => { const l = this.owLead(r); if (l) { l.voided = false; l.droppedAt = null; } });
    }
    if (p.snoozed) {
      p.snoozed.filter(r => !before.snoozed.includes(r)).forEach(r => { const l = this.owLead(r); if (l) this.owMeta(l).snoozedUntil = now + 14 * 86400000; });
      before.snoozed.filter(r => !p.snoozed.includes(r)).forEach(r => { const l = this.owLead(r); if (l) delete this.owMeta(l).snoozedUntil; });
    }
    if (p.told) {
      p.told.filter(r => !before.told.includes(r)).forEach(r => { const l = this.owLead(r); if (l) this.owMeta(l).told = iso; });
      before.told.filter(r => !p.told.includes(r)).forEach(r => { const l = this.owLead(r); if (l) delete this.owMeta(l).told; });
    }
    if (p.rivalsAdd) Object.keys(p.rivalsAdd).forEach(rank => { const l = this.owLead(+rank); if (!l) return; this.owMeta(l);
      (p.rivalsAdd[rank] || []).forEach(r => { if (!r || !r.name) return; const row = { name: r.name, price: Number(r.price) || 0, stock: r.stock || 'In stock', area: r.area || '—', how: r.how || 'visit', seenAt: iso, breaks: (r.breaks || []).map(b => ({ q: Number(b.q), p: Number(b.p) })) };
        const i = l.research.rivals.findIndex(x => x.name.toLowerCase() === row.name.toLowerCase()); if (i >= 0) l.research.rivals[i] = row; else l.research.rivals.push(row); }); });
    if (p.rivalsCut) Object.keys(p.rivalsCut).forEach(rank => { const l = this.owLead(+rank); if (!l) return; this.owMeta(l); const cut = p.rivalsCut[rank] || []; l.research.rivals = l.research.rivals.filter(r => !cut.includes(r.name)); });
    if (p.rivalsFix) Object.keys(p.rivalsFix).forEach(rank => { const l = this.owLead(+rank); if (!l) return; this.owMeta(l);
      Object.entries(p.rivalsFix[rank] || {}).forEach(([name, fx]) => { const r = l.research.rivals.find(x => x.name === name); if (!r) return;
        if (fx.price != null) r.price = Number(fx.price); if (fx.stock) r.stock = fx.stock; if (fx.days === 0 || fx.price != null || fx.stock) r.seenAt = iso; }); });
    if (p.quoteFix) Object.keys(p.quoteFix).forEach(rank => { const l = this.owLead(+rank); if (!l) return;
      Object.keys(p.quoteFix[rank] || {}).forEach(name => (l.candidates || []).filter(c => this.owCandName(c) === name).forEach(c => { c.quotedAt = iso; })); });
    if (p.buyerFix) Object.keys(p.buyerFix).forEach(rank => { const l = this.owLead(+rank); if (!l) return;
      Object.entries(p.buyerFix[rank] || {}).forEach(([name, fx]) => { const mine = (l.requests || []).filter(r => !r.withdrawn && this.owSamePerson(r, name)); if (!mine.length) return;
        if (fx.gone) { mine.forEach(r => { r.withdrawn = iso; }); return; }
        if (fx.qty != null) { const first = mine[0]; mine.forEach(r => { r.withdrawn = iso; }); const r2 = { ...first, qty: Number(fx.qty), confirmedAt: iso }; delete r2.withdrawn; l.requests.push(r2); return; }
        if (fx.days === 0) mine.forEach(r => { r.confirmedAt = iso; }); }); });
    if (p.supMarks) Object.keys(p.supMarks).forEach(rank => { const l = this.owLead(+rank); if (l) this.owMeta(l).supMarks = p.supMarks[rank]; });
    if (p.events) Object.keys(p.events).forEach(rank => { const l = this.owLead(+rank); if (!l) return; const m = this.owMeta(l); const had = (m.events || []).length;
      const texts = p.events[rank] || []; m.events = [...(m.events || []), ...texts.slice(had).map(t => ({ t, at: now }))].slice(-60); });
    if (p.follow) Object.keys(p.follow).forEach(k => { const i = k.indexOf(':'); const l = this.owLead(+k.slice(0, i)); if (!l) return; const m = this.owMeta(l); m.follow = { ...(m.follow || {}), [k.slice(i + 1)]: p.follow[k] }; });
    if (p.added) p.added.forEach(item => {
      if (!item || !item.name) return;
      const x = item;
      const lead = { id: 'SRC-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase(), name: x.name, notes: x.note || '', status: 'asked', voided: false,
        droppedReason: '', droppedAt: null, assignedStaffId: null, createdAt: iso, stageEnteredAt: now, productId: null, graduatedAt: null,
        requests: [], candidates: [], variantAttrs: (x.variants && x.variants.length) ? [{ name: 'Size', values: x.variants }] : [], image: null,
        research: { rivals: [], meta: { unit: x.unit || 'pcs', ...(x.when ? { when: x.when } : {}) } } };
      sourcingLeadsAll().push(lead);
      (x.askList || []).forEach(a => this.owAsk(lead, a[0], a[1], a[2], { maxPrice: x.maxPrice, when: x.when, note: x.note, follow: this._capExtra ? this._capExtra.follow : true, variant: (x.variants || []).join(', ') }));
    });
    if (p.extraSups) p.extraSups.forEach(sp => { if (sp && sp.name && !(data.suppliers || []).some(s => String(s.name).toLowerCase() === sp.name.toLowerCase())) this.owNewSupplier(sp); });
    graduate = this._graduate;
    this._capExtra = null;
    saveData();
    if (typeof renderSourcingBadge === 'function') renderSourcingBadge();
    if (graduate && typeof openSourcingGraduate === 'function') setTimeout(() => openSourcingGraduate(graduate), 0);
  }
  async owNewSupplier(sp) {
    const id = firstFreeEntityId('S', 3, data.suppliers, await issueEntityId('supplier', 'S', 3, data.suppliers));
    if ((data.suppliers || []).some(s => String(s.name).toLowerCase() === sp.name.toLowerCase())) return;
    data.suppliers.push({ id, name: sp.name, phone: sp.phone || '', location: sp.loc || '', notes: [sp.kind, (sp.cats || []).join(', ')].filter(Boolean).join(' · ') });
    saveData();
    this.forceUpdate();
  }
  zoomBy(f, cx, cy) {
    const st = this.state;
    const mx = cx == null ? (st.vx0 + st.vx1) / 2 : cx, my = cy == null ? (st.vy0 + st.vy1) / 2 : cy;
    let w = (st.vx1 - st.vx0) * f, h = (st.vy1 - st.vy0) * f;
    const XM = this._mx || 30, YM = this._my || 8;
    w = Math.min(XM, Math.max(3, w)); h = Math.min(YM, Math.max(0.8, h));
    let x0 = mx - (mx - st.vx0) / (st.vx1 - st.vx0) * w, y0 = my - (my - st.vy0) / (st.vy1 - st.vy0) * h;
    x0 = Math.min(Math.max(x0, -1), XM + 1 - w); y0 = Math.min(Math.max(y0, -0.5), YM + 0.5 - h);
    this.setState({ vx0: x0, vx1: x0 + w, vy0: y0, vy1: y0 + h });
  }
  toData(e) {
    const svg = e.currentTarget.ownerSVGElement || e.currentTarget;
    const r = svg.getBoundingClientRect(), k = 796 / r.width;
    const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k, st = this.state;
    return { px, py, x: st.vx0 + (px - 44) / 732 * (st.vx1 - st.vx0), y: st.vy0 + (222 - py) / 206 * (st.vy1 - st.vy0) };
  }
  /* runs the verdict + plan for each item (same code the popup uses), cached until the evidence changes */
  verdicts(ranks) {
    const S0 = this.state, C = this._vdCache || (this._vdCache = {});
    const base = JSON.stringify([S0.moved, S0.dropped, S0.snoozed, S0.rivalsAdd, S0.rivalsCut, S0.rivalsFix, S0.quoteFix, S0.buyerFix, S0.extraSups, S0.added]);
    const own = r => r === S0.task ? JSON.stringify([S0.taskTerms, S0.taskTiers, S0.taskShelf, S0.holdMode, S0.taskPrices, S0.taskSups]) : '';
    const out = {};
    this._inner = true;
    try {
      for (const r of ranks) {
        const key = base + '|' + own(r);
        if (C[r] && C[r].key === key) { out[r] = C[r].val; continue; }
        this.state = r === S0.task ? S0 : { ...S0, task: r, taskSups: [], taskPrices: {}, taskShelf: '', holdMode: null, taskTerms: {}, taskTiers: {}, taskOpenSup: null, taskPacks: {}, taskTrans: {} };
        let v; try { v = this.renderVals(); } catch (e) { console.error('Verdict failed for', r, e); v = {}; }
        out[r] = { vd: v.vd || {}, pl: v.pl || {} }; C[r] = { key, val: out[r] };
      }
    } finally { this.state = S0; this._inner = false; }
    return out;
  }
  renderVals() {
    if (!this._inner) { this.state = { ...this.state, ...this.owDerived() }; this._ad = null; }
    const AD = this._ad || (this._ad = this.owData());
    const ST = {
      ready:  { label:'Ready to sell', ink:'#0F6B43', soft:'#E4F4EA', o:0 },
      over:   { label:'Over time',     ink:'#8E2A22', soft:'#FBE5E2', o:1 },
      nobody: { label:'Nobody on it',  ink:'#7A4A02', soft:'#FDEEE1', o:2 },
      track:  { label:'On track',      ink:'#5F6980', soft:'#EFECE6', o:3 }
    };
    const STEPS = ['Asked for','Looking','Source found','Priced','Listed'];
    const ITEMS = AD.items;
    const MOVED = this.state.moved;
    const ALL = [...ITEMS, ...this.state.added].map(it => MOVED[it.rank] ? { ...it, ...MOVED[it.rank] } : it);
    const LIVE = ALL.filter(it => it.stage < 4 && !this.state.dropped.includes(it.rank));
    const KN = ['Who has it','Their price','Pack size','Photo'];
    const f = this.state.filter, sk = this.state.sortKey, dir = this.state.dir;
    const KEYF = {
      rank: it => it.rank, name: it => it.name.toLowerCase(), state: it => ST[it.state].o, stage: it => it.stage,
      known: it => it.known.filter(Boolean).length, days: it => it.days / it.limit, askers: it => it.askers,
      wait: it => it.wait, owner: it => it.owner || '~'
    };
    const matched = LIVE.filter(it => f === 'all' || it.state === f)
      .sort((a, b) => { const x = KEYF[sk](a), y = KEYF[sk](b); return (x < y ? -1 : x > y ? 1 : a.rank - b.rank) * dir; });
    const per = this.state.per, pageCount = Math.max(1, Math.ceil(matched.length / per));
    const page = Math.min(this.state.page, pageCount - 1);
    const shown = matched.slice(page * per, page * per + per);

    const SRC = { q:'#3A3F9B', w:'#1A5A8A', c:'#7A3268' };
    const DET = AD.det;
    const fmt = n => n.toLocaleString('en-US');
    const detail = (it) => {
      const D = DET[it.rank] || { unit:'', sups:[], room:null, askers: it.askList || [], known:['','','',''] };
      const priced = D.sups.filter(x => x[1] != null), mx = Math.max(1, ...priced.map(x => x[1]));
      const best = priced.length ? Math.min(...priced.map(x => x[1])) : null;
      const sups = D.sups.map(([name, price, note]) => {
        const isBest = price != null && price === best;
        return { name, note: isBest ? 'cheapest · ' + note : note, price: price == null ? '—' : fmt(price),
          nameStyle: `font-size:12px;font-weight:600;color:${price == null ? '#5F6980' : '#1C2233'}`,
          noteStyle: `font-size:11px;color:${isBest ? '#0F6B43' : price == null ? '#95530C' : '#767F91'};font-weight:${isBest || price == null ? 600 : 400}`,
          track: price == null ? 'display:block;height:8px;border:1px dashed #B3BCD2;border-radius:2px;box-sizing:border-box' : 'display:flex;height:8px;background:#EFECE6;border-radius:2px',
          bar: price == null ? 'display:none' : `width:${(price / mx * 100).toFixed(0)}%;background:${isBest ? '#0F6B43' : '#5F6980'};border-radius:2px`,
          priceStyle: `text-align:right;font-size:12px;font-weight:600;color:${price == null ? '#767F91' : '#1C2233'}` };
      });
      let room = {};
      if (D.room) {
        const [c, sh, rv] = D.room, lo = c * 0.9, hi = rv * 1.08, P = v => ((v - lo) / (hi - lo) * 100).toFixed(1);
        const mk = (v, col, sz) => `position:absolute;top:${9 - sz / 2}px;left:calc(${P(v)}% - ${sz / 2}px);width:${sz}px;height:${sz}px;border-radius:999px;background:${col};border:2px solid #FFFFFF;box-sizing:content-box`;
        room = { cost: fmt(c), shelf: fmt(sh), rival: fmt(rv),
          gain: `position:absolute;top:7px;height:4px;background:#0F6B43;left:${P(c)}%;width:${(P(sh) - P(c)).toFixed(1)}%`,
          costMark: mk(c, '#1C2233', 8), shelfMark: mk(sh, '#C93A30', 10), rivalMark: `position:absolute;top:4px;left:calc(${P(rv)}% - 5px);width:10px;height:10px;background:#FFFFFF;border:2px solid #8E2A22;transform:rotate(45deg);box-sizing:border-box` };
      }
      const qtyTotal = D.unit ? D.askers.reduce((a, x) => a + x[1], 0) + ' ' + D.unit + (D.unit === 'kg' ? '' : 's') : (it.qty || 'no quantity yet');
      const KL = ['Who has it','Their price','Pack size','Photo'];
      return {
        sups, hasSup: sups.length > 0, noSup: sups.length === 0, hasRoom: !!D.room, ...room, qtyTotal,
        askers: D.askers.slice(0, 5).map(([name, qty, src, days]) => ({ name, qty, days,
          dot: `width:8px;height:8px;border-radius:999px;background:${SRC[src]}`,
          dayStyle: `text-align:right;font-size:11px;color:${days >= 14 ? '#8E2A22' : '#767F91'};font-weight:${days >= 14 ? 600 : 400}` })),
        hasMore: D.askers.length > 5, more: `+${D.askers.length - 5} more`,
        known: it.known.map((ok, k) => ({ label: KL[k] + (ok && D.known[k] ? ' · ' + D.known[k] : ok ? '' : ' — not yet'),
          box: ok ? 'width:14px;height:14px;border-radius:3px;background:#0F6B43' : 'width:14px;height:14px;border-radius:3px;border:1px dashed #767F91;box-sizing:border-box',
          text: `color:${ok ? '#1C2233' : '#767F91'}` }))
      };
    };
    const rows = shown.map(it => {
      const s = ST[it.state];
      const scale = Math.max(it.limit * 1.5, it.days, 1);
      const over = it.days > it.limit;
      const primary = false;
      return {
        isOpen: this.state.open === it.rank, expanded: this.state.open === it.rank ? 'true' : 'false',
        d: this.state.open === it.rank ? detail(it) : {},
        toggle: () => this.setState({ open: this.state.open === it.rank ? null : it.rank }),
        rowStyle: `display:grid;grid-template-columns:28px minmax(0,1fr) 96px 100px 48px 84px 48px 50px 58px 150px;align-items:center;height:52px;padding:0 8px;border-bottom:1px solid ${this.state.open === it.rank ? '#FCFBF9' : '#EFECE6'};background:${this.state.open === it.rank ? '#FCFBF9' : 'transparent'}`,
        chevBtn: `width:28px;height:44px;border:0;background:transparent;padding:0 0 0 2px;display:flex;align-items:center;gap:1px;color:${this.state.open === it.rank ? '#1C2233' : '#767F91'}`,
        chevStyle: `flex-shrink:0;transition:transform .15s;transform:rotate(${this.state.open === it.rank ? 90 : 0}deg)`,
        doMove: () => this.setState({ task: it.rank, taskSup: '', taskSups: [], taskPrices: {}, taskMin: '', taskShelf: '', dropAsk: false }),
        rank: it.rank, name: it.name, askers: it.askers, wait: it.wait, move: it.move, limit: it.limit, days: String(it.days),
        sub: it.isNew ? 'just added' + (it.qty ? ' · ' + it.qty : '') : it.cost ? `${it.qty} · ${it.cost}` : it.qty,
        owner: it.owner || 'Nobody',
        ownerStyle: it.owner ? 'font-size:12px;color:#1C2233' : 'font-size:12px;font-weight:600;color:#95530C',
        stateLabel: s.label, stepLabel: STEPS[it.stage],
        pillStyle: `display:inline-block;font-size:11px;font-weight:600;color:${s.ink};background:${s.soft};border-radius:999px;padding:1px 7px;white-space:nowrap`,
        segs: [0,1,2,3,4].map(k => ({ style: `width:16px;height:6px;border-radius:2px;background:${k < it.stage ? '#767F91' : k === it.stage ? '#1C2233' : '#E6E3DD'}` })),
        kn: it.known.map((ok, k) => ({ t: KN[k] + (ok ? '' : ' — not yet'), style: ok ? 'width:9px;height:9px;border-radius:2px;background:#0F6B43' : 'width:9px;height:9px;border-radius:2px;border:1px dashed #767F91;box-sizing:border-box' })),
        knownLabel: `${it.known.filter(Boolean).length} of 4 known`,
        dayCells: Array.from({ length: Math.min(Math.max(it.limit, it.days), it.limit + 6) }, (_, k) => ({ style:
          `width:5px;height:10px;border-radius:1px;box-sizing:border-box;${k === it.limit ? 'margin-left:3px;' : ''}` +
          (k >= it.limit ? 'background:#8E2A22' : k < it.days ? 'background:#5F6980' : 'border:1px solid #CFCAC1;background:#FFFFFF') })),
        dayText: over ? `${it.days}d · ${it.days - it.limit} over` : it.days === it.limit ? `${it.days}d · last day` : `${it.days === 0 ? 'today' : it.days + 'd'} · ${it.limit - it.days} left`,
        dayTextStyle: `font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;font-size:11px;white-space:nowrap;font-weight:${over ? 600 : 500};color:${over ? '#8E2A22' : it.days === it.limit ? '#95530C' : '#5F6980'}`,
        dayTitle: `${it.days} ${it.days === 1 ? 'day' : 'days'} in ${STEPS[it.stage]} — you allow ${it.limit}`,
        gFill: `position:absolute;left:0;top:0;height:4px;border-radius:2px;width:${Math.min(100, it.days / scale * 100).toFixed(0)}%;background:${over ? '#8E2A22' : '#5F6980'}`,
        gTick: `position:absolute;top:-3px;width:2px;height:10px;background:#1C2233;left:${(it.limit / scale * 100).toFixed(0)}%`,
        gText: `font-size:11px;font-weight:${over ? 600 : 500};color:${over ? '#8E2A22' : '#1C2233'}`,
        btnStyle: primary
          ? 'height:30px;padding:0 10px;border-radius:9px;border:1px solid #C93A30;background:#C93A30;color:#FFFFFF;font-size:12px;font-weight:600;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis'
          : 'height:30px;padding:0 10px;border-radius:9px;border:1px solid #E6E3DD;background:#FFFFFF;color:#1C2233;font-size:12px;font-weight:600;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis'
      };
    });
    const COLS = [['rank','#',0],['name','Item',0],['state','State',0],['stage','Step',0],['known','Known',0],['days','Days in step',0],['askers','People',1],['wait','Waited',1],['owner','Owner',0],[null,'Next move',1]];
    const cols = COLS.map(([k, label, right]) => {
      const on = k === sk;
      return {
        label, sortable: !!k, plain: !k,
        aria: on ? (dir === 1 ? 'ascending' : 'descending') : 'none',
        arrow: on ? (dir === 1 ? '↑' : '↓') : '↕',
        arrowStyle: `font-size:10px;color:${on ? '#1C2233' : '#B3BCD2'}`,
        cellStyle: `padding:0 6px;display:flex;justify-content:${right ? 'flex-end' : 'flex-start'};min-width:0`,
        btnStyle: `border:0;background:transparent;padding:0;display:flex;align-items:center;gap:3px;font-size:11px;font-weight:600;white-space:nowrap;color:${on ? '#1C2233' : '#5F6980'}`,
        sort: () => this.setState({ sortKey: k, dir: on ? -dir : (k === 'askers' || k === 'wait' || k === 'days' ? -1 : 1), page: 0 })
      };
    });
    const count = k => k === 'all' ? LIVE.length : LIVE.filter(it => it.state === k).length;
    const FL = [['all','All'],['ready','Ready'],['over','Over time'],['nobody','Nobody on it']];
    const filters = FL.map(([k, label]) => {
      const on = f === k;
      const dotC = k === 'ready' ? '#0F6B43' : k === 'over' ? '#8E2A22' : k === 'nobody' ? '#95530C' : null;
      return {
        label, count: count(k), pressed: on ? 'true' : 'false',
        pick: () => this.setState({ filter: k, page: 0 }),
        dot: dotC ? `width:7px;height:7px;border-radius:2px;background:${on ? '#FFFFFF' : dotC}` : 'display:none',
        style: `height:28px;display:flex;align-items:center;gap:6px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}`
      };
    });

    /* ---- intake: asks not yet in the funnel ---- */
    const CLIENTS_ALL = AD.clients.map(c => c.name);
    const SRCL = { q:['Quote search','#3A3F9B'], w:['WhatsApp','#1A5A8A'], c:['Counter','#7A3268'] };
    const INTAKE = [];
    const addNew = (name, people, qty, who, src, n) => {
      const rank = 100000 + this.state.added.length + 1;
      const item = { rank, name, stage:0, state:'nobody', known:[0,0,0,0], days:0, limit:2, askers: people, wait:0, qty, cost:'', owner:'', move:'Give it to someone', isNew:true,
        askList: [[who || '—', n || 0, src, 0]] };
      return item;
    };
    const taken = this.state.taken;
    const intake = INTAKE.filter(x => !taken.includes(x.id)).map(x => ({
      ...x, srcLabel: SRCL[x.src][0], dot: `width:8px;height:8px;border-radius:999px;background:${SRCL[x.src][1]}`,
      add: () => this.setState({ taken: [...taken, x.id], added: [...this.state.added, addNew(x.text, x.people, x.qty, x.whoName, x.src, x.n)] }),
      capture: () => this.setState({ capItem: x.text, capPick: null, capVars: [], capChannel: x.src, capClient: CLIENTS_ALL.includes(x.whoName) ? x.whoName : (x.src === 'q' ? null : x.whoName), capWalkin: false, capQty: x.n ? String(x.n) : '', capUnit: ({ pcs:'pcs', bags:'bag', rolls:'roll', tins:'tin', pairs:'pair', boxes:'box' })[(x.qty || '').split(' ')[1]] || 'pcs', capFrom: x.id }),
      dismiss: () => this.setState({ taken: [...taken, x.id] })
    }));
    const quickAdd = e => {
      if (e && e.preventDefault) e.preventDefault();
      const name = (this.state.draftName || '').trim(); if (!name) return;
      const n = parseInt(this.state.draftQty, 10);
      this.setState({ added: [...this.state.added, addNew(name, 1, (this.state.draftQty || '').trim(), (this.state.draftWho || '').trim(), 'c', isNaN(n) ? 0 : n)], draftName: '', draftWho: '', draftQty: '' });
    };

    /* ---- funnel board: an item moves on by doing its step's job ----
       Asked for → someone is looking · Looking → we know who has it ·
       Source found → we know their price · Priced → it becomes a product.
       Drag a card one step on and its job opens; drag it back to correct.
       Every change can be undone; a dropped item is kept, not deleted. */
    const S = this.state;
    const DOT = { ready:'#0F6B43', over:'#8E2A22', nobody:'#95530C', track:'#767F91' };
    const LIM = [2, 7, 5, 3];
    const COLT = ['Asked for','Looking','Source found','Priced','On the shelf'];
    const fmtN = n => Number(n).toLocaleString('en-US');
    const short = n => n >= 1e6 ? (n / 1e6).toFixed(2).replace(/0$/, '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n);
    const num = v => { const n = parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10); return isNaN(n) ? 0 : n; };
    const qtyN = it => num(String(it.qty || '').split(' ')[0]) || (DET[it.rank] ? DET[it.rank].askers.reduce((a, x) => a + x[1], 0) : 0);
    const supsOf = it => it.suppliers || (DET[it.rank] ? DET[it.rank].sups.map(x => x[0]) : []);
    const pricesOf = it => it.prices || (DET[it.rank] ? Object.fromEntries(DET[it.rank].sups.filter(x => x[1] != null).map(x => [x[0], x[1]])) : {});
    const costOf = it => { const p = Object.values(pricesOf(it)); return p.length ? Math.min(...p) : 0; };
    const RIV_BASE = AD.riv;
    const rivalsOf = it => { const cut = (this.state.rivalsCut || {})[it.rank] || [];
      const fix = (this.state.rivalsFix || {})[it.rank] || {};
      return [...(RIV_BASE[it.rank] || []).map(r => ({ name: r[0], price: r[1], stock: r[2], area: r[3], days: r[4], how: r[5], breaks: (r[6] || []).map(b => ({ q: b[0], p: b[1] })) })), ...(((this.state.rivalsAdd || {})[it.rank]) || [])].filter(r => !cut.includes(r.name)).map(r => fix[r.name] ? { ...r, ...fix[r.name] } : r); };
    /* freshness: evidence goes stale and has to be re-confirmed — competitor prices after 14 days, supplier quotes after their validity (7 days unless agreed), buyer asks after 14 days */
    const FRESH = { rival: 14, quote: 7, buyer: 14 };
    const QUOTE_AGE = AD.quoteAge;
    const quoteAgeOf = (it, n) => { const fx = ((S.quoteFix || {})[it.rank] || {})[n]; if (fx != null) return fx; const a = (QUOTE_AGE[it.rank] || {})[n]; return a != null ? a : 0; };
    const quoteValidOf = n => num((((S.taskTerms || {})[n]) || {}).valid) || FRESH.quote;
    const quoteExpired = (it, n) => quoteAgeOf(it, n) > quoteValidOf(n);
    const askersOf = it => { const fx = (S.buyerFix || {})[it.rank] || {};
      return (it.askList || (DET[it.rank] ? DET[it.rank].askers : [])).filter(a => !(fx[a[0]] && fx[a[0]].gone)).map(a => fx[a[0]] ? [a[0], fx[a[0]].qty != null ? fx[a[0]].qty : a[1], a[2], fx[a[0]].days != null ? fx[a[0]].days : a[3]] : a); };
    /* confidence behind a verdict — one formula for the verdict and the checklist; sim asks "what if this were confirmed / added?" */
    const REGS = AD.clients.filter(c => c.regular).map(c => c.name.toLowerCase().split(/[^a-z]+/)[0]).filter(Boolean);
    const confOf = (it, sim = {}) => {
      const pr = Object.keys(pricesOf(it)), pN = pr.length + (sim.addQuote || 0);
      const qF = pr.filter(n => sim.quote === n || !quoteExpired(it, n)).length + (sim.addQuote || 0);
      const rs = rivalsOf(it), rN = rs.length + (sim.addRival || 0);
      const rF = rs.filter(r => sim.rival === r.name || r.days <= FRESH.rival).length + (sim.addRival || 0);
      const as = askersOf(it), q = qtyN(it);
      const bStale = as.filter(a => a[3] > FRESH.buyer && sim.buyer !== a[0]).length;
      const nB = Math.max(0, it.askers - bStale) + (sim.addBuyer || 0);
      const reg = as.filter(a => REGS.includes(a[0].toLowerCase().split(/[^a-z]+/)[0])), regQty = reg.reduce((t, a) => t + a[1], 0);
      const allSearch = as.length > 0 && as.every(a => a[2] === 'q');
      const cS = [0, 35, 70, 100][Math.min(3, qF)];
      const cR = Math.max(0, [0, 35, 70, 100][Math.min(3, rN)] - (rN && rF === 0 ? 20 : 0));
      const cB = Math.max(0, Math.min(100, [0, 20, 40, 60, 80, 100][Math.min(5, nB)] + (reg.length ? 10 : 0) + (q && regQty / q >= 0.6 ? 20 : 0) - (allSearch ? 25 : 0)));
      /* one missing kind of evidence caps the whole: no quote at all is never better than low, no competitor price never better than medium */
      const conf = Math.min(Math.round(cS * 0.35 + cR * 0.3 + cB * 0.35), pN === 0 ? 40 : 100, rN === 0 ? 54 : 100);
      return { conf, cS, cR, cB, bStale };
    };
    const KWCAT = { ridge:'roofing', cap:'roofing', roofing:'roofing', gutter:'roofing', nail:'fasteners', nails:'fasteners', pipe:'plumbing', ppr:'plumbing', valve:'plumbing', trap:'plumbing',
      solar:'electrical', floodlight:'electrical', light:'electrical', door:'doors & locks', closer:'doors & locks', hinge:'doors & locks', padlock:'doors & locks',
      waterproofing:'chemicals', additive:'chemicals', cement:'chemicals', chain:'fencing', 'chain-link':'fencing', fence:'fencing', wire:'fencing', binding:'fencing',
      tile:'tiles & tools', cutter:'tiles & tools', spacers:'tiles & tools', grinder:'tools', disc:'tools', weld:'steel', galvanised:'steel' };

    /* a rival's price for a given quantity: their unit price, or the best volume break that quantity reaches */
    const rivalAt = (r, q) => Math.min(r.price, ...((r.breaks || []).filter(b => q >= b.q).map(b => b.p)));
    const cheapestAt = (it, q) => { const rs = rivalsOf(it), pool = rs.filter(r => r.stock !== 'Out of stock').length ? rs.filter(r => r.stock !== 'Out of stock') : rs;
      if (!pool.length) return null; const best = pool.map(r => ({ r, p: rivalAt(r, q) })).sort((a, b) => a.p - b.p)[0]; return { name: best.r.name, p: best.p, isBreak: best.p < best.r.price }; };
    const rivalOf = it => { const rs = rivalsOf(it); if (rs.length) return Math.min(...rs.map(r => r.price)); return (DET[it.rank] && DET[it.rank].room) ? DET[it.rank].room[2] : Math.round(costOf(it) * 1.35 / 500) * 500; };
    /* recommended shelf price: healthy margin, but never above the cheapest rival in stock or what the askers said they'd pay */
    const recPriceInfo = it => { const cost = costOf(it); if (!cost) return { rec: 0 };
      const r500 = v => Math.round(v / 500) * 500, f500 = v => Math.floor(v / 500) * 500, c500 = v => Math.ceil(v / 500) * 500;
      const rs = rivalsOf(it), inS = rs.filter(r => r.stock !== 'Out of stock');
      const rivalRef = inS.length ? Math.min(...inS.map(r => r.price)) : rs.length ? Math.min(...rs.map(r => r.price)) : 0;
      const floor = c500(cost * 1.12), target = r500(cost * 1.3);
      const undercut = rivalRef ? f500(rivalRef - Math.max(500, rivalRef * 0.03)) : 0;
      let rec = rivalRef ? Math.min(target, undercut) : target, why;
      if (it.maxPrice) rec = Math.min(rec, f500(it.maxPrice));
      const squeezed = rec < floor; if (squeezed) rec = floor;
      why = !rivalRef ? `A 30% margin — no competitor prices yet, so check shops before you commit.`
        : squeezed ? `Rivals are at ${rivalRef.toLocaleString('en-US')}. Beating them costs too much margin, so this is your floor (12%). Compete on availability, not price.`
        : rec < target ? `Just under the cheapest rival in stock (${rivalRef.toLocaleString('en-US')}) — you win the sale and still keep ${Math.round((rec - cost) / cost * 100)}%.`
        : `A 30% margin still sits under the cheapest rival (${rivalRef.toLocaleString('en-US')}).`;
      return { rec, why, rivalRef, undercut: undercut > cost ? undercut : 0, target, floor, squeezed }; };
    const recPriceOf = it => recPriceInfo(it).rec || Math.round(costOf(it) * 1.25 / 500) * 500;
    const kindOf = it => it.stage === 0 || (it.stage === 1 && !it.owner) ? 'assign' : it.stage === 1 ? 'supplier' : it.stage === 2 ? 'price' : 'list';
    const JOB = { assign: it => it.owner && it.stage === 0 ? `${it.owner} to start looking` : 'Give it to someone', supplier: () => 'Find who has it', price: () => 'Get their price', list: () => 'Add it to what we sell' };
    const Q = { assign: 'Who will look for it?', supplier: 'Who has it?', price: 'What do they charge?', list: 'Your shelf price' };
    const dropped = S.dropped;
    const snap = () => ({ __leads: JSON.stringify(sourcingLeadsAll()) });
    const commit = (patch, logText) => { const r = S.task; const ev = r && logText ? { events: { ...S.events, [r]: [...(S.events[r] || []), logText] } } : {}; this.setState({ ...patch, ...ev, hist: [...S.hist.slice(-9), snap()], log: logText, hint: null }); };
    const undo = () => { const h = S.hist; if (!h.length) return; this.setState({ ...h[h.length - 1], hist: h.slice(0, -1), log: 'Undone', task: null }); };
    const apply = (it, patch, logText) => {
      const merged = { ...it, ...patch };
      const state = merged.stage >= 3 ? 'ready' : merged.owner ? 'track' : 'nobody';
      const next = { ...(S.moved[it.rank] || {}), ...patch, state, days: patch.stage !== undefined && patch.stage !== it.stage ? 0 : it.days, move: merged.stage >= 4 ? 'Listed' : JOB[kindOf(merged)](merged) };
      commit({ moved: { ...S.moved, [it.rank]: next }, task: merged.stage >= 4 ? null : S.task, taskSups: [], taskPrices: {}, taskQS: '', taskTerms: {}, taskTiers: {}, taskOpenSup: null, taskPacks: {}, taskTrans: {}, taskSup: '', taskMin: '', taskShelf: '', dropAsk: false }, logText);
    };
    const STAFF = AD.staff;
    const AV = AD.AV;
    const avatar = (name, sz) => name && AV[name]
      ? `flex-shrink:0;width:${sz}px;height:${sz}px;border-radius:999px;background:${AV[name][0]};color:${AV[name][1]};font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center`
      : `flex-shrink:0;width:${sz}px;height:${sz}px;border-radius:999px;border:1px dashed #95530C;box-sizing:border-box;color:#95530C;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center`;
    const T = ALL.find(it => it.rank === S.task);
    const dragIt = ALL.find(it => it.rank === S.dragging);
    const who = S.who;
    const matchWho = it => who === 'all' || (who === 'nobody' ? !it.owner : it.owner === who);
    const handleDrop = k => {
      const it = dragIt; if (!it) return;
      if (k === it.stage) { this.setState({ dragging: null }); return; }
      if (k < it.stage) { apply(it, { stage: k }, `${it.name} moved back to ${COLT[k]}`); this.setState({ dragging: null }); return; }
      if (k === it.stage + 1 && !(it.stage === 1 && !it.owner)) { this.setState({ dragging: null, task: it.rank, hint: null, taskSups: [], taskPrices: {}, taskShelf: '', dropAsk: false }); return; }
      this.setState({ dragging: null, hint: { rank: it.rank, text: `One step at a time — ${JOB[kindOf(it)](it).toLowerCase()} first` } });
    };
    const SUPS_BASE = AD.sups;
    const SUPS_ALL = [...SUPS_BASE, ...(S.extraSups || [])];
    const SUP_CATS = ['roofing','plumbing','fasteners','doors & locks','fencing','steel','electrical','chemicals','tiles & tools','tools'];
    const SUP_KINDS = ['Wholesaler','Importer','Manufacturer','Retail shop'];
    const SUP_LOCS = AD.areas.length ? AD.areas.slice(0, 6) : ['Kikuubo','Nakivubo','Industrial Area','Nakawa','Kawempe','Ntinda'];
    const REASONS = ['No supplier found','Minimum order too big','Rivals sell it cheaper','Asker went elsewhere'];
    const board = COLT.map((title, k) => {
      const base = k < 4 ? LIVE.filter(it => it.stage === k && !S.snoozed.includes(it.rank)) : ALL.filter(it => it.stage === 4 && !dropped.includes(it.rank) && !S.told.includes(it.rank));
      const items = base.slice().sort((a, b) => ((b.days > b.limit) - (a.days > a.limit)) || (b.askers * Math.max(1, b.wait) - a.askers * Math.max(1, a.wait)));
      const CAP = 3, openAll = !!S.expanded[k];
      const shown = openAll ? items : items.slice(0, CAP);
      const cards = shown.map(it => {
        const kind = k === 4 ? 'done' : kindOf(it), open = S.task === it.rank && k < 4;
        const limit = LIM[Math.min(k, 3)], over = k < 4 && it.days > limit;
        const job = kind === 'done' ? 'On sale now' : JOB[kind](it);
        const jobC = k === 4 || kind === 'list' ? '#0F6B43' : it.state === 'nobody' ? '#95530C' : over ? '#8E2A22' : '#1C2233';
        const dim = !matchWho(it);
        const c = {
          name: it.name, askers: it.askers, qty: it.qty || 'qty not said', closed: !open, isOpen: open, job,
          waitText: it.wait ? `first asked ${it.wait}d ago` : 'asked today',
          aria: `${it.name}: ${job}`,
          draggable: k < 4 ? 'true' : 'false',
          dragStart: e => { try { e.dataTransfer.setData('text/plain', String(it.rank)); e.dataTransfer.effectAllowed = 'move'; } catch (_) {} this.setState({ dragging: it.rank, hint: null }); },
          _it: it, _k: k, _over: over,
          wrapStyle: `min-width:0;overflow:hidden;border-radius:8px;box-shadow:${S.task === it.rank ? '0 0 0 2px #1C2233' : 'none'};border:1px solid ${S.task === it.rank ? '#1C2233' : it.isNew && k === 0 ? '#C93A30' : '#E6E3DD'};background:${k === 4 ? '#E4F4EA' : it.isNew && k === 0 ? '#FDE8E4' : '#FFFFFF'};opacity:${S.dragging === it.rank ? .45 : dim ? .35 : 1};cursor:${k < 4 ? 'grab' : 'default'}`,
          thumb: `flex-shrink:0;position:relative;width:28px;height:28px;border-radius:6px;background:#F7F5F2;border:1px solid #E6E3DD;box-sizing:border-box;display:flex;align-items:center;justify-content:center;color:#767F91;${it.known[3] ? '' : 'border-style:dashed;'}`,
          ownerIni: it.owner ? AV[it.owner][2] : '+', ownerTitle: it.owner ? `${it.owner} is on it` : 'Nobody on it',
          ownerStyle: avatar(it.owner, 22),
          kn: it.known.map(ok => ({ style: ok ? 'width:7px;height:7px;border-radius:2px;background:#0F6B43' : 'width:7px;height:7px;border-radius:2px;border:1px dashed #767F91;box-sizing:border-box' })),
          knownLabel: `${it.known.filter(Boolean).length} of 4 known`,
          dayCells: k === 4 ? [] : Array.from({ length: Math.min(Math.max(limit, it.days), limit + 6) }, (_, j) => ({ style:
            `width:4px;height:8px;border-radius:1px;box-sizing:border-box;${j === limit ? 'margin-left:2px;' : ''}` + (j >= limit ? 'background:#8E2A22' : j < it.days ? 'background:#5F6980' : 'border:1px solid #CFCAC1') })),
          dayText: k === 4 ? `tap when ${it.askers} told` : it.days >= limit * 2 ? `stale · ${it.days}d — decide` : over ? `${it.days - limit}d over` : it.days === limit ? 'last day' : `${limit - it.days}d left`,
          dayTextStyle: `font-size:10px;font-weight:600;color:${over ? '#8E2A22' : it.days === limit ? '#95530C' : '#767F91'}`,
          jobStyle: `display:flex;align-items:center;gap:6px;width:100%;padding-top:6px;border-top:1px solid #EFECE6;font-size:11px;font-weight:700;color:${jobC}`,
          jobDot: `width:6px;height:6px;border-radius:999px;background:${jobC}`,
          hasHint: !!(S.hint && S.hint.rank === it.rank), hint: S.hint && S.hint.rank === it.rank ? S.hint.text : '',
          select: () => { if (k === 4) { commit({ told: [...S.told, it.rank] }, `Everyone waiting on ${it.name} has been told — it leaves the board`); return; } this.setState({ holdMode: null, actPage: 0, mTab: it.stage === 3 ? 'verdict' : 'overview', renaming: null, addAsk: false, mergeOpen: false, task: it.rank, hint: null, taskSups: [], taskPrices: {}, taskQS: '', taskTerms: {}, taskTiers: {}, taskOpenSup: null, taskPacks: {}, taskTrans: {}, taskSup: '', taskMin: '', taskShelf: '', dropAsk: false }); }
        };

        if (open) {
        /* rename, another ask, merge */
        const asks = it.askList || (DET[it.rank] ? DET[it.rank].askers : []);
        const unitW = (it.qty || '').split(' ')[1] || 'pcs';
        const REGS = (AD.clients.filter(cc => cc.regular).length ? AD.clients.filter(cc => cc.regular) : AD.clients).slice(0, 5).map(cc => cc.name);
        const AVP = [['#E4E6FA','#3A3F9B'],['#DCEAF8','#1A5A8A'],['#F6E4F1','#7A3268'],['#E4F4EA','#0F6B43']];
        const iniOf = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
        const colOf = n => AVP[[...n].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 4];
        const renaming = S.renaming === it.rank;
        const rv = (S.renameVal || '').trim(), rvl = rv.toLowerCase();
        const rw = rvl.split(/[^a-z0-9]+/).filter(w => w.length > 2);
        const dup = renaming && rw.length ? LIVE.find(o => o.rank !== it.rank && rw.filter(w => o.name.toLowerCase().includes(w)).length >= Math.min(2, rw.length)) : null;
        const mergeInto = (target) => {
          const keep = target.stage >= it.stage ? target : it, gone = keep === target ? it : target;
          const q1 = qtyN(keep), q2 = qtyN(gone), u1 = (keep.qty || '').split(' ')[1], u2 = (gone.qty || '').split(' ')[1];
          const gAsks = gone.askList || (DET[gone.rank] ? DET[gone.rank].askers : []), kAsks = keep.askList || (DET[keep.rank] ? DET[keep.rank].askers : []);
          const kNames = kAsks.map(x => x[0]);
          const extra = gAsks.filter(x => !kNames.includes(x[0]));
          const h0 = snap(); this.owMerge(keep.rank, gone.rank);
          this.setState({ task: keep.rank, renaming: null, mergeOpen: false, hist: [...S.hist.slice(-9), h0], hint: null,
            log: `Merged “${gone.name}” into “${keep.name}” — ${keep.askers + extra.length} people, one card` });
        };
        const pickedAsk = (S.askWho || '').trim();
        const sameP = (a, b) => { const n = x => x.toLowerCase().replace(/\b(ltd|limited|co)\b\.?/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); const x = n(a), y = n(b); return !!x && !!y && (x === y || x.startsWith(y) || y.startsWith(x)); };
        const repeat = pickedAsk && asks.some(x => sameP(x[0], pickedAsk));
        const aq = num(S.askQty);
        const askOk = !!pickedAsk && aq > 0;
        Object.assign(c, {
          notRenaming: !renaming, renaming, dupHit: !!dup, dupName: dup ? dup.name : '', dupMeta: dup ? `${COLT[dup.stage]} · ${dup.askers} asking · ${dup.qty || ''}` : '',
          dupMerge: () => dup && mergeInto(dup),
          startRename: () => this.setState({ renaming: it.rank, renameVal: it.name }),
          renameOff: !rv || rv === it.name,
          renameStyle: `height:28px;padding:0 10px;border-radius:7px;font-size:11px;font-weight:600;border:1px solid ${rv && rv !== it.name ? '#1C2233' : '#E6E3DD'};background:${rv && rv !== it.name ? '#1C2233' : '#FFFFFF'};color:${rv && rv !== it.name ? '#FFFFFF' : '#767F91'}`,
          saveRename: () => { if (!rv || rv === it.name) return; apply(it, { name: rv, former: it.former || it.name }, `Renamed “${it.name}” → “${rv}” · everything else kept`); this.setState({ renaming: null }); },
          hasFormer: !!it.former && !renaming, former: it.former || '',
          askAv: [...asks.slice(0, 5).map((x, j) => { const cc = colOf(x[0]); return { ini: x[0] === 'Walk-in' ? '?' : iniOf(x[0]), title: `${x[0]} · ${x[1]}`,
            style: `width:22px;height:22px;border-radius:999px;border:2px solid #FFFFFF;box-sizing:border-box;margin-left:${j ? -6 : 0}px;background:${cc[0]};color:${cc[1]};font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center` }; }),
            ...(asks.length > 5 ? [{ ini: `+${asks.length - 5}`, title: `${asks.length - 5} more`, style: 'width:22px;height:22px;border-radius:999px;border:2px solid #FFFFFF;box-sizing:border-box;margin-left:-6px;background:#EFECE6;color:#5F6980;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center' }] : [])],
          toggleAsk: () => this.setState({ addAsk: !S.addAsk, askWho: '', askQty: '', mergeOpen: false }), addingAsk: S.addAsk,
          askBtnStyle: `height:24px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid ${S.addAsk ? '#1C2233' : '#E6E3DD'};background:${S.addAsk ? '#1C2233' : '#FFFFFF'};color:${S.addAsk ? '#FFFFFF' : '#1C2233'}`,
          askRegs: REGS.map(n => { const on = pickedAsk === n, already = asks.some(x => sameP(x[0], n)); return { label: (already ? '↻ ' : '') + n.split(' ')[0], pressed: on ? 'true' : 'false',
            pick: () => this.setState({ askWho: n }),
            style: `height:24px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : already ? '#5F6980' : '#1C2233'}` }; }),
          unit: unitW, askOff: !askOk,
          askRepeat: !!repeat, askRepeatText: `${pickedAsk.split(' ')[0]} already asked — this adds to their quantity, not a new person`,
          askGoLabel: repeat ? 'Add to theirs' : 'Add ask',
          askGoStyle: `margin-left:auto;height:28px;padding:0 10px;border-radius:7px;font-size:11px;font-weight:700;border:1px solid ${askOk ? '#1C2233' : '#E6E3DD'};background:${askOk ? '#1C2233' : '#FFFFFF'};color:${askOk ? '#FFFFFF' : '#767F91'}`,
          addAsk: () => { if (!askOk) return;
            const list = repeat ? asks.map(x => sameP(x[0], pickedAsk) ? [x[0], x[1] + aq, x[2], x[3]] : x) : [...asks, [pickedAsk, aq, 'c', 0]];
            apply(it, { askers: it.askers + (repeat ? 0 : 1), qty: `${qtyN(it) + aq} ${unitW}`, askList: list },
              repeat ? `${pickedAsk.split(' ')[0]} now wants ${aq} more ${it.name}` : `${pickedAsk.split(' ')[0]} also wants ${it.name} — ${it.askers + 1} people now`);
            this.setState({ addAsk: false, askWho: '', askQty: '' }); },
          mergeOpen: S.mergeOpen, toggleMerge: () => this.setState({ mergeOpen: !S.mergeOpen, addAsk: false, dropAsk: false }),
          mergeTargets: LIVE.filter(o => o.rank !== it.rank).slice().sort((a, b) => {
              const sim = o => (it.name.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && o.name.toLowerCase().includes(w)).length);
              return sim(b) - sim(a); }).slice(0, 4)
            .map(o => ({ name: o.name, meta: `${COLT[o.stage]} · ${o.askers}`, pick: () => mergeInto(o) }))
        });
        }
        if (!open) return c;
        /* the open card: this step's job */
        const cost = costOf(it), rival = rivalOf(it), qn = qtyN(it);
        const shelf = S.taskShelf !== '' ? num(S.taskShelf) : recPriceOf(it);
        const chosen = S.taskSups.length ? S.taskSups : [];
        const priceRowsSrc = supsOf(it).length ? supsOf(it) : ['Supplier'];
        const known0 = pricesOf(it);
        const TTX = (DET[it.rank] ? Object.fromEntries(DET[it.rank].sups.map(x => [x[0], x[2]])) : {});
        const tiersOf = n => S.taskTiers[n] || (it.tiers && it.tiers[n] ? it.tiers[n].map(t => ({ q: String(t.q), p: fmtN(t.p) })) : known0[n] != null ? [{ q: String(num((TTX[n] || '').match(/\d+/) || 1) || 1), p: fmtN(known0[n]) }] : [{ q: '1', p: '' }]);
        const qAt = num(S.taskQS) || qn || 1;
        const rung = n => { const ts = tiersOf(n).map(t => ({ q: num(t.q) || 1, p: num(t.p) })).filter(t => t.p > 0).sort((a, b) => b.q - a.q);
          const hitT = ts.find(t => t.q <= qAt); return { ts, hitT, minQ: ts.length ? Math.min(...ts.map(t => t.q)) : 0 }; };
        const transOf = n => num((S.taskTrans || {})[n]);
        const termOf = n => ({ pay: 'Cash', lead: '2 days', valid: '7 days', ...(((S.taskTerms || {})[n]) || {}) });
        const SCOL = ['#3A3F9B','#1A5A8A','#7A3268','#0F6B43'];
        const optChip = (on) => `height:22px;padding:0 7px;border-radius:6px;font-size:10px;font-weight:600;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}`;
        const setTerm = (n, k2, v) => this.setState({ taskTerms: { ...(S.taskTerms || {}), [n]: { ...termOf(n), [k2]: v } } });
        const entered = priceRowsSrc.map(n => { const r = rung(n); return { n, v: r.hitT ? r.hitT.p : 0, r }; }).filter(x => x.v > 0);
        const best = entered.length ? Math.min(...entered.map(x => x.v)) : 0;
        const totals = entered.map(x => ({ n: x.n, t: x.v * qAt + transOf(x.n) }));
        const bestT = totals.length ? Math.min(...totals.map(x => x.t)) : 0;
        const minQ = num(S.taskMin);
        const ok = { assign: false, supplier: chosen.length > 0, price: entered.length > 0, list: shelf > cost && cost > 0 }[kind];
        const P = v => { const lo = cost * 0.9, hi = Math.max(rival, shelf) * 1.06; return Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)).toFixed(1); };
        const TOPS = AD.sups.slice().sort((a, b) => b.orders - a.orders).slice(0, 4).map(sp => sp.name);
        const SUGG = [...TOPS, 'An importer'];
        const oc0likely = AD.sups.map(sp => ({ n: sp.name, h: AD.supHits(sp, it.name).length, o: sp.orders })).sort((x, y) => y.h - x.h || y.o - x.o).slice(0, 3).map(x => x.n);
        const oc = { ...c,
          stepN: k + 1, stepBadge: 'width:18px;height:18px;flex-shrink:0;border-radius:999px;background:#1C2233;color:#FFFFFF;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center',
          question: Q[kind], kAssign: kind === 'assign', kSupplier: kind === 'supplier', kPrice: kind === 'price', kList: kind === 'list',
          staff: STAFF.map(name => ({ name, ini: AV[name][2], avatar: avatar(name, 22),
            load: LIVE.filter(x => x.owner === name).length + ' on',
            style: `height:34px;display:flex;align-items:center;gap:8px;padding:0 8px;border-radius:9px;font-size:12px;font-weight:600;color:#1C2233;border:1px solid ${it.owner === name ? '#1C2233' : '#E6E3DD'};background:${it.owner === name ? '#F7F5F2' : '#FFFFFF'}`,
            pick: () => apply(it, { owner: name, stage: it.stage === 0 ? 1 : it.stage }, it.stage === 0 ? `${it.name} → Looking · ${name} is on it` : `${name} is on ${it.name}`) })),
          supLikely: (() => {
            const SUPS = SUPS_ALL;
            const KW = KWCAT;
            const want = [...new Set(it.name.toLowerCase().split(/[^a-z0-9-]+/).map(w => KW[w] || KW[w.replace(/s$/, '')]).filter(Boolean))];
            const marks = (S.supMarks || {})[it.rank] || {};
            return SUPS.map(sp => ({ ...sp, hit: AD.supHits(sp, it.name) }))
              .sort((x, y) => y.hit.length - x.hit.length || y.orders - x.orders).slice(0, 3)
              .map((sp, i) => { const on = chosen.includes(sp.name), mk = marks[sp.name];
                const mark = (v) => this.setState({ supMarks: { ...(S.supMarks || {}), [it.rank]: { ...marks, [sp.name]: v } } });
                return { name: sp.name, ini: sp.name.split(/\s+/).slice(0, 2).map(w => w[0]).join(''),
                  av: `flex-shrink:0;width:26px;height:26px;border-radius:7px;background:${sp.hit.length ? '#E4E6FA' : '#EFECE6'};color:${sp.hit.length ? '#3A3F9B' : '#5F6980'};font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center`,
                  fit: sp.hit.length ? (sp.hit.length > 1 ? 'strong match' : 'sells this kind') : 'long shot',
                  fitStyle: `flex-shrink:0;font-size:10px;font-weight:700;border-radius:999px;padding:1px 6px;${sp.hit.length ? 'background:#E4F4EA;color:#0F6B43' : 'background:#EFECE6;color:#767F91'}`,
                  cats: [...sp.hit, ...sp.cats.filter(ct => !sp.hit.includes(ct))].slice(0, 4).map(ct => ({ label: ct, style: `font-size:10px;border-radius:5px;padding:1px 5px;${sp.hit.includes(ct) ? 'background:#1C2233;color:#FFFFFF;font-weight:600' : 'background:#F7F5F2;color:#5F6980'}` })),
                  meta: `Sells ${sp.cats.join(', ')} · ${sp.orders} orders with you · ${sp.last === '—' ? 'no bills yet' : `last ${sp.last}d ago`}${sp.phone ? ' · ' + sp.phone : ''}`,
                  line: `${sp.kind ? sp.kind + ' · ' : ''}${sp.hit.length ? 'already sells ' + sp.hit.join(', ') : sp.cats[0]} · ${sp.orders} orders${sp.last === '—' ? '' : ` · last ${sp.last}d`}`,
                  status: on ? 'has it ✓' : mk === 'no' ? 'doesn’t have it' : mk === 'asked' ? 'asked · waiting' : '',
                  statusStyle: `font-size:10px;font-weight:700;color:${on ? '#0F6B43' : mk === 'no' ? '#767F91' : '#95530C'}`,
                  rowStyle: `display:flex;align-items:center;gap:10px;padding:6px 10px;${i ? 'border-top:1px solid #EFECE6;' : ''}background:${on ? '#F4FAF6' : '#FFFFFF'};opacity:${mk === 'no' && !on ? .5 : 1}`,
                  yesPressed: on ? 'true' : 'false',
                  yesStyle: `height:26px;padding:0 8px;border-radius:7px;font-size:11px;font-weight:700;border:1px solid ${on ? '#0F6B43' : '#1C2233'};background:${on ? '#0F6B43' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}`,
                  noStyle: 'height:26px;padding:0 8px;border-radius:7px;font-size:11px;border:1px solid #E6E3DD;background:#FFFFFF;color:#5F6980',
                  yes: () => { this.setState({ taskSups: on ? chosen.filter(x => x !== sp.name) : [...chosen, sp.name] }); if (!on) mark('yes'); },
                  no: () => { this.setState({ taskSups: chosen.filter(x => x !== sp.name) }); mark('no'); },
                  _open: !on && !mk, _hit: sp.hit.length > 0 }; });
          })(),
          supHits: (() => { const q = (S.supQ || '').trim().toLowerCase(); if (q.length < 2) return [];
            const qd = q.replace(/\s/g, '');
            return SUPS_ALL.filter(sp => sp.name.toLowerCase().includes(q) || sp.phone.replace(/\s/g, '').includes(qd) || sp.loc.toLowerCase().includes(q) || sp.cats.some(ct => ct.includes(q))).slice(0, 4)
              .map((sp, i) => { const on = chosen.includes(sp.name); return { name: sp.name, ini: sp.name.split(/\s+/).slice(0, 2).map(w => w[0]).join(''),
                line: `${sp.kind ? sp.kind + ' · ' : ''}${sp.loc} · ${sp.phone} · ${sp.cats.slice(0, 2).join(', ')}${sp.isNew ? ' · new' : ` · ${sp.orders} orders`}`,
                av: 'flex-shrink:0;width:26px;height:26px;border-radius:7px;background:#EFECE6;color:#5F6980;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center',
                rowStyle: `display:flex;align-items:center;gap:10px;padding:6px 10px;${i ? 'border-top:1px solid #EFECE6;' : ''}background:${on ? '#F4FAF6' : '#FFFFFF'}`,
                pressed: on ? 'true' : 'false', btnLabel: on ? 'Has it ✓' : 'Has it',
                btnStyle: `height:26px;padding:0 8px;border-radius:7px;font-size:11px;font-weight:700;border:1px solid ${on ? '#0F6B43' : '#1C2233'};background:${on ? '#0F6B43' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}`,
                pick: () => this.setState({ taskSups: on ? chosen.filter(x => x !== sp.name) : [...chosen, sp.name] }) }; }); })(),
          supOther: SUGG.filter(n => !TOPS.includes(n)).concat(chosen.filter(n => !SUGG.includes(n) && !(oc0likely || []).includes(n))).map(name => { const on = chosen.includes(name); return {
            label: (on ? '✓ ' : '+ ') + (name === 'An importer' ? 'An importer' : name), pressed: on ? 'true' : 'false',
            style: `height:26px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#F7F5F2'};color:${on ? '#FFFFFF' : '#1C2233'}`,
            toggle: () => this.setState({ taskSups: on ? chosen.filter(x => x !== name) : [...chosen, name] }) }; }),
          supSugg: [...SUGG, ...chosen.filter(n => !SUGG.includes(n))].map(name => { const on = chosen.includes(name); return {
            label: (on ? '✓ ' : '+ ') + (name === 'An importer' ? 'Importer' : name.split(' ')[0]), pressed: on ? 'true' : 'false',
            style: `height:26px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#F7F5F2'};color:${on ? '#FFFFFF' : '#1C2233'}`,
            toggle: () => this.setState({ taskSups: on ? chosen.filter(x => x !== name) : [...chosen, name] }) }; }),
          qAt: `${fmtN(qAt)} ${(it.qty || '').split(' ')[1] || 'units'}`,
          ladders: priceRowsSrc.map((n, si) => { const r = rung(n), tiers = tiersOf(n), open = (S.taskOpenSup || priceRowsSrc[0]) === n;
            const tot = totals.find(x => x.n === n), isBest = !!tot && tot.t === bestT && totals.length > 1;
            const setT = (i, key, v) => this.setState({ taskTiers: { ...S.taskTiers, [n]: tiers.map((t, j) => j === i ? { ...t, [key]: v } : t) } });
            return { name: n, open, expanded: open ? 'true' : 'false',
              toggle: () => this.setState({ taskOpenSup: open ? '-' : n }),
              chev: `flex-shrink:0;width:14px;font-size:14px;font-weight:700;color:#5F6980;transition:transform .15s;transform:rotate(${open ? 90 : 0}deg)`,
              summary: r.ts.length ? r.ts.slice().reverse().map(t => `${t.q}+ ${fmtN(t.p)}`).join(' · ') : 'no prices yet',
              at: r.hitT ? fmtN(r.hitT.p) : r.ts.length ? `min ${r.minQ}` : '—',
              atStyle: `font-size:13px;font-weight:700;color:${r.hitT ? (isBest ? '#0F6B43' : '#1C2233') : '#8E2A22'}`,
              tag: !r.ts.length ? 'waiting' : !r.hitT ? `won’t sell ${qAt}` : isBest ? 'cheapest delivered' : tot && tot.t === bestT ? 'only quote so far' : tot ? `+${short(tot.t - bestT)} total` : '',
              tagStyle: `font-size:10px;font-weight:700;color:${!r.ts.length ? '#95530C' : !r.hitT ? '#8E2A22' : isBest ? '#0F6B43' : '#767F91'}`,
              wrapStyle: `${si ? 'border-top:1px solid #EFECE6;' : ''}background:${open ? '#FCFBF9' : '#FFFFFF'}`,
              tiers: tiers.map((t, i) => { const used = r.hitT && num(t.q) === r.hitT.q && num(t.p) === r.hitT.p; return {
                q: t.q, p: t.p, qAria: `${n} price break ${i + 1}, from quantity`, pAria: `${n} price break ${i + 1}, UGX a unit`,
                setQ: e => setT(i, 'q', e.target.value), setP: e => setT(i, 'p', e.target.value),
                qStyle: `height:28px;width:100%;border:1px solid #E6E3DD;border-radius:7px;padding:0 8px;font-size:11px;box-sizing:border-box;text-align:right`,
                pStyle: `height:28px;width:100%;border:1px solid ${used ? '#0F6B43' : '#CFCAC1'};border-radius:7px;padding:0 8px;font-size:12px;font-weight:600;box-sizing:border-box;text-align:right;background:${used ? '#F4FAF6' : '#FFFFFF'}`,
                rmStyle: `width:26px;height:26px;border-radius:7px;border:1px solid #E6E3DD;background:#FFFFFF;color:#767F91;font-size:14px;visibility:${tiers.length > 1 ? 'visible' : 'hidden'}`,
                remove: () => this.setState({ taskTiers: { ...S.taskTiers, [n]: tiers.filter((_, j) => j !== i) } }) }; }),
              addTier: () => { const lastQ = num(tiers[tiers.length - 1].q) || 1; this.setState({ taskTiers: { ...S.taskTiers, [n]: [...tiers, { q: String(lastQ < 10 ? 10 : lastQ * 5), p: '' }] } }); },
              pack: (S.taskPacks || {})[n] || '', setPack: e => this.setState({ taskPacks: { ...(S.taskPacks || {}), [n]: e.target.value } }),
              trans: (S.taskTrans || {})[n] || '', setTrans: e => this.setState({ taskTrans: { ...(S.taskTrans || {}), [n]: e.target.value } }),
              pays: ['Cash','7 days','30 days'].map(o => ({ label: o, pressed: termOf(n).pay === o ? 'true' : 'false', style: optChip(termOf(n).pay === o), pick: () => setTerm(n, 'pay', o) })),
              leads: ['Same day','2 days','1 week','3 weeks'].map(o => ({ label: o, pressed: termOf(n).lead === o ? 'true' : 'false', style: optChip(termOf(n).lead === o), pick: () => setTerm(n, 'lead', o) })),
              valids: ['3 days','7 days','30 days'].map(o => ({ label: `valid ${o}`, pressed: termOf(n).valid === o ? 'true' : 'false', style: optChip(termOf(n).valid === o), pick: () => setTerm(n, 'valid', o) })) }; }),
          ...(() => {
            const sups2 = priceRowsSrc.map((n, i) => ({ n, col: SCOL[i % 4], ts: rung(n).ts.slice().sort((a, b) => a.q - b.q) })).filter(x => x.ts.length);
            const allP = sups2.flatMap(x => x.ts.map(t => t.p)), allQ = sups2.flatMap(x => x.ts.map(t => t.q));
            const xMax = Math.max(10, Math.ceil(Math.max(qAt * 1.5, ...(allQ.length ? allQ : [1])) * 1.25));
            const lo = allP.length ? Math.min(...allP) * 0.96 : 0, hi = allP.length ? Math.max(...allP) * 1.03 : 1;
            const X = q => (36 + Math.min(q, xMax) / xMax * 314).toFixed(1), Y = pp => (10 + (1 - (pp - lo) / Math.max(1, hi - lo)) * 84).toFixed(1);
            const lines = sups2.map(x => { const pts = []; x.ts.forEach((t, i) => { const nx = i + 1 < x.ts.length ? x.ts[i + 1].q : xMax; pts.push(`${X(t.q)},${Y(t.p)}`, `${X(nx)},${Y(t.p)}`); if (i + 1 < x.ts.length) pts.push(`${X(nx)},${Y(x.ts[i + 1].p)}`); }); return { pts: pts.join(' '), col: x.col }; });
            const hitDots = sups2.map(x => { const h = x.ts.slice().reverse().find(t => t.q <= qAt); return h ? { x: X(qAt), y: Y(h.p), col: x.col } : null; }).filter(Boolean);
            const scenQ = [...new Set([qn || 1, ...allQ.filter(q => q > (qn || 1)).sort((a, b) => a - b).slice(0, 2)])];
            const scen = scenQ.map(q => { const on = q === qAt; return { label: q === qn ? `${fmtN(q)} · asked` : fmtN(q), pressed: on ? 'true' : 'false', pick: () => this.setState({ taskQS: q === qn ? '' : String(q) }),
              style: `height:26px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:700;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}` }; });
            const table = entered.map(x => { const i = priceRowsSrc.indexOf(x.n), tt = x.v * qAt + transOf(x.n), win = tt === bestT; return { t: tt,
              name: x.n.split(' ')[0], unit: fmtN(x.v), landed: fmtN(Math.round(tt / qAt)), total: short(tt), pay: termOf(x.n).pay, lead: termOf(x.n).lead.replace(' days', 'd').replace(' day', 'd').replace(' weeks', 'w').replace(' week', 'w').replace('Same d', '0d'),
              sw: `flex-shrink:0;width:8px;height:8px;border-radius:2px;background:${SCOL[i % 4]}`,
              badge: win && entered.length > 1 ? 'best' : '', badgeStyle: win && entered.length > 1 ? 'flex-shrink:0;font-size:9px;font-weight:700;border-radius:999px;padding:0 5px;background:#E4F4EA;color:#0F6B43' : 'display:none',
              rowStyle: `display:grid;grid-template-columns:minmax(0,1fr) 62px 62px 56px 40px;gap:0 6px;align-items:center;padding:5px 0;font-size:11px;border-bottom:1px solid #EFECE6;background:${win && entered.length > 1 ? '#F4FAF6' : 'transparent'}` }; }).sort((a, b) => a.t - b.t);
            let tip = null;
            sups2.forEach(x => { const cur = x.ts.slice().reverse().find(t => t.q <= qAt); const nxt = x.ts.find(t => t.q > qAt && (!cur || t.p < cur.p));
              if (cur && nxt) { const extra = nxt.p * nxt.q - cur.p * qAt, perUnit = extra / (nxt.q - qAt);
                if (perUnit < cur.p && (!tip || perUnit < tip.perUnit)) tip = { perUnit, n: x.n, q: nxt.q, p: nxt.p, extra }; } });
            return { lines, hitDots, scen, table, xMax: fmtN(xMax), yHi: short(Math.round(hi)), yLo: short(Math.round(lo)),
              markX: X(qAt), markLabel: `${fmtN(qAt)}${qAt === qn ? ' asked' : ''}`,
              chartKey: sups2.map(x => ({ name: x.n.split(' ')[0], sw: `width:10px;height:3px;border-radius:2px;background:${x.col}` })),
              chartAria: `Price breaks for ${sups2.map(x => x.n).join(', ')}`,
              hasTip: !!tip, tipQ: tip ? fmtN(tip.q) : '', tipGo: () => tip && this.setState({ taskQS: String(tip.q) }),
              tip: tip ? `${tip.n.split(' ')[0]} drops to ${fmtN(tip.p)} at ${fmtN(tip.q)} — the extra ${fmtN(tip.q - qAt)} cost only ${fmtN(Math.round(tip.perUnit))} each (${short(tip.extra)} more). Stock for the next person who asks.` : '' };
          })(),
          hasCompare: totals.length > 0,
          compare: totals.slice().sort((a, b) => a.t - b.t).map(x => ({ name: x.n.split(' ')[0], val: short(x.t),
            bar: `width:${(x.t / Math.max(...totals.map(y => y.t)) * 100).toFixed(0)}%;background:${x.t === bestT ? '#0F6B43' : '#5F6980'};border-radius:2px`,
            valStyle: `text-align:right;font-weight:700;color:${x.t === bestT ? '#0F6B43' : '#1C2233'}` })),
          compareNote: totals.length > 1 ? `${totals.find(x => x.t === bestT).n.split(' ')[0]} saves ${short(Math.max(...totals.map(x => x.t)) - bestT)} on this order` : priceRowsSrc.some(n => rung(n).ts.length && !rung(n).hitT) ? 'Some suppliers’ smallest order is more than what was asked' : 'Get a second quote to compare',
          compareNoteStyle: 'font-size:11px;font-weight:600;color:#0F6B43',
          minWarn: minQ > 0 && qn > 0 && minQ > qn, minWarnText: `Minimum ${minQ} is more than the ${qn} asked for`,
          cost: fmtN(cost), rival: fmtN(rival),
          gainBar: `position:absolute;top:6px;height:4px;background:${shelf > cost ? '#0F6B43' : '#8E2A22'};left:${P(Math.min(cost, shelf))}%;width:${Math.abs(P(shelf) - P(cost)).toFixed(1)}%`,
          costDot: `position:absolute;top:4px;left:calc(${P(cost)}% - 4px);width:8px;height:8px;border-radius:999px;background:#1C2233`,
          shelfDot: `position:absolute;top:2px;left:calc(${P(shelf)}% - 6px);width:12px;height:12px;border-radius:999px;background:#C93A30;border:2px solid #FFFFFF;box-sizing:border-box`,
          rivalDot: `position:absolute;top:3px;left:calc(${P(rival)}% - 5px);width:10px;height:10px;background:#FFFFFF;border:2px solid #8E2A22;transform:rotate(45deg);box-sizing:border-box`,
          margin: shelf > cost ? `+${fmtN(shelf - cost)}` : 'below cost', profit: shelf > cost && qn ? `+${short((shelf - cost) * qn)}` : '—', cash: qn && cost ? short(cost * qn) : '—',
          marginStyle: `font-weight:600;color:${shelf <= cost || shelf >= rival ? '#8E2A22' : '#0F6B43'}`,
          hasGo: kind !== 'assign', goOff: !ok,
          go: { supplier: () => apply(it, { stage: 2, suppliers: chosen, known: [1, it.known[1], it.known[2], it.known[3]] }, `${it.name} → Source found · ${chosen.length} ${chosen.length === 1 ? 'source' : 'sources'}`),
            price: () => { const prices = Object.fromEntries(entered.map(x => [x.n, x.v])); const bestN = (totals.find(x => x.t === bestT) || entered[0]).n;
              const tiers = Object.fromEntries(priceRowsSrc.map(n => [n, rung(n).ts.slice().reverse()]).filter(x => x[1].length));
              apply(it, { stage: 3, prices, tiers, packs: S.taskPacks || {}, trans: S.taskTrans || {}, terms: Object.fromEntries(priceRowsSrc.map(n => [n, termOf(n)])), known: [1, 1, Object.values(S.taskPacks || {}).some(v => v) ? 1 : it.known[2], it.known[3]] }, `${it.name} → Priced · ${fmtN(prices[bestN])} a unit from ${bestN.split(' ')[0]}, cheapest delivered`); },
            list: () => apply(it, { stage: 4, shelf }, `${it.name} is on the shelf at ${fmtN(shelf)} · ${it.askers} ${it.askers === 1 ? 'person' : 'people'} to tell`) }[kind],
          goLabel: { supplier: chosen.length > 1 ? `Found ${chosen.length} sources` : 'Found it', price: entered.length > 1 ? `Save ${entered.length} suppliers’ prices` : 'Save prices', list: 'Add it to what we sell' }[kind] || '',
          goStyle: `height:36px;border-radius:9px;font-size:12px;font-weight:700;border:1px solid ${ok ? (kind === 'list' ? '#0F6B43' : '#1C2233') : '#E6E3DD'};background:${ok ? (kind === 'list' ? '#0F6B43' : '#1C2233') : '#F7F5F2'};color:${ok ? '#FFFFFF' : '#767F91'};cursor:${ok ? 'pointer' : 'not-allowed'}`,
          nextNote: { assign: it.stage === 0 ? '→ moves to Looking' : '→ stays in Looking, then find who has it', supplier: '→ moves to Source found', price: '→ moves to Priced, cheapest wins', list: '→ becomes a product · askers get a draft' }[kind],
          snooze: () => commit({ snoozed: [...S.snoozed, it.rank], task: null }, `${it.name} snoozed for 2 weeks — it comes back on its own`),
          canBack: k > 0, back: () => apply(it, { stage: k - 1 }, `${it.name} moved back to ${COLT[k - 1]}`),
          askDrop: S.dropAsk, toggleDrop: () => this.setState({ dropAsk: !S.dropAsk }),
          reasons: REASONS.map(r => ({ label: r, pick: () => commit({ dropped: [...dropped, it.rank], task: null, dropAsk: false }, `${it.name} dropped — ${r.toLowerCase()}. Kept for the next person who asks.`) })),
          message: () => this.setState({ log: `Message drafted for ${it.askers} ${it.askers === 1 ? 'person' : 'people'} waiting on ${it.name} — nothing is sent until you press send` })
        };
        const openAll = (oc.supLikely || []).filter(x => x._open); const openSups = openAll.some(x => x._hit) ? openAll.filter(x => x._hit) : openAll;
        const marksNow = (S.supMarks || {})[it.rank] || {};
        oc.hasSupHits = (oc.supHits || []).length > 0;
        { const q = (S.supQ || '').trim().toLowerCase(); oc.canCreate = q.length > 1 && !S.newSup && !SUPS_ALL.some(sp => sp.name.toLowerCase() === q); }
        oc.askAllOff = openSups.length === 0;
        oc.askAllLabel = openSups.length ? (openSups.every(x => x._hit) ? `Ask the ${openSups.length} likely` : `Ask all ${openSups.length}`) : 'All asked';
        oc.askAllStyle = `margin-left:auto;height:24px;padding:0 9px;border-radius:7px;font-size:11px;font-weight:700;border:1px solid ${openSups.length ? '#1C2233' : '#E6E3DD'};background:${openSups.length ? '#1C2233' : '#FFFFFF'};color:${openSups.length ? '#FFFFFF' : '#767F91'}`;
        oc.askAll = () => { if (!openSups.length) return; const nm = { ...marksNow }; openSups.forEach(x => { nm[x.name] = 'asked'; });
          this.setState({ supMarks: { ...(S.supMarks || {}), [it.rank]: nm }, log: `One WhatsApp drafted to ${openSups.map(x => x.name.split(' ')[0]).join(', ')}: “Do you have ${it.name}? ${it.qty || ''}” — nothing sent until you press send` }); };
        return oc;
      });
      const avg = items.length && k < 4 ? items.reduce((a, it) => a + it.days, 0) / items.length : 0;
      const lim = LIM[Math.min(k, 3)], overN = k < 4 ? items.filter(it => it.days > lim).length : 0;
      const target = dragIt ? (k === dragIt.stage ? 'self' : k < dragIt.stage ? 'back' : k === dragIt.stage + 1 ? 'next' : 'far') : null;
      const scale = lim * 2;
      return {
        n: k < 4 ? k + 1 : '✓', title, cards, count: k < 4 ? items.length : ALL.filter(it => it.stage === 4 && !dropped.includes(it.rank)).length,
        hasMore: items.length > CAP, moreLabel: openAll ? 'Show fewer' : `+${items.length - CAP} more`,
        toggleMore: () => this.setState({ expanded: { ...S.expanded, [k]: !openAll } }),
        staleN: k < 4 ? items.filter(it => it.days >= LIM[k] * 2).length : 0,
        empty: cards.length === 0, emptyText: k === 4 ? 'everyone told · nothing to do' : 'nothing here',
        health: k === 4 ? `${items.length} to tell` : items.length ? `avg ${avg.toFixed(0)}d / ${lim}${overN ? ` · ${overN} over` : ''}` : `limit ${lim}d`,
        healthText: `font-size:10px;white-space:nowrap;font-weight:${overN ? 700 : 500};color:${overN ? '#8E2A22' : k === 4 ? '#0F6B43' : '#767F91'}`,
        healthTrack: `position:relative;flex:1 1 auto;min-width:24px;height:4px;border-radius:2px;background:${k === 4 ? '#E4F4EA' : '#EFECE6'};display:${k === 4 ? 'none' : 'block'}`,
        healthFill: `position:absolute;left:0;top:0;height:4px;border-radius:2px;width:${Math.min(100, avg / scale * 100).toFixed(0)}%;background:${avg > lim ? '#8E2A22' : avg >= lim * .8 ? '#95530C' : '#5F6980'}`,
        healthTick: 'position:absolute;left:50%;top:-2px;width:2px;height:8px;background:#1C2233',
        note: target === 'next' ? `Drop to ${dragIt ? JOB[kindOf(dragIt)](dragIt).toLowerCase() : ''}` : target === 'back' ? 'Drop to move it back' : target === 'far' ? 'One step at a time' : '',
        noteStyle: `height:${target && target !== 'self' ? 18 : 6}px;white-space:nowrap;text-overflow:ellipsis;font-size:11px;font-weight:700;color:${target === 'far' ? '#8E2A22' : '#1C2233'};overflow:hidden`,
        numStyle: `width:20px;height:20px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;${k === 4 ? 'background:#0F6B43;color:#FFFFFF' : 'background:#FFFFFF;border:1px solid #CFCAC1;box-sizing:border-box;color:#1C2233'}`,
        titleStyle: `flex:1 1 auto;min-width:0;font-size:12px;font-weight:700;color:${k === 4 ? '#0F6B43' : '#1C2233'}`,
        colStyle: `display:flex;flex-direction:column;padding:10px;min-width:0;border-radius:8px;background:${target === 'next' ? '#F7F5F2' : target === 'far' ? '#FBE5E2' : k === 4 ? '#F4FAF6' : '#FCFBF9'};outline:${target === 'next' ? '2px dashed #1C2233' : target === 'back' ? '1px dashed #767F91' : target === 'far' ? '1px dashed #8E2A22' : '1px solid #EFECE6'};outline-offset:-1px`,
        over: e => { e.preventDefault(); },
        drop: e => { e.preventDefault(); handleDrop(k); }
      };
    });

    /* ---- rail + queue + journey ---- */
    const railK = S.rail;
    const rail = board.map((col, k) => { const on = railK === k; const its = k < 4 ? LIVE.filter(it => it.stage === k) : [];
      return { n: col.n, title: col.title, count: col.count, pressed: on ? 'true' : 'false',
        pick: () => this.setState({ rail: on ? null : k }),
        sq: its.map(it => ({ style: `width:10px;height:10px;border-radius:2px;background:${DOT[it.state]}` })),
        health: col.health, healthStyle: col.healthText + ';width:100%;text-align:left',
        numStyle: col.numStyle,
        style: `min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:10px;border-radius:8px;font:inherit;color:#1C2233;cursor:pointer;text-align:left;border:1px solid ${on ? '#1C2233' : k === 2 ? '#E0C9B0' : '#E6E3DD'};background:${on ? '#F7F5F2' : k === 4 ? '#F4FAF6' : k === 2 ? '#FEF8F2' : '#FFFFFF'};box-shadow:${on ? '0 0 0 1px #1C2233' : 'none'}` }; });
    const urg = c => (c._over ? 0 : 100) + (c._it.state === 'nobody' ? 0 : 50) + (c._it.stage === 3 ? 0 : 20) - Math.min(19, c._it.askers * Math.max(1, c._it.wait) / 10);
    const pool = railK === 4 ? board[4].cards : board.slice(0, 4).filter((_, k) => railK == null || railK === k).flatMap(col => col.cards);
    const queue = pool.filter(c => matchWho(c._it)).slice().sort((a, b) => urg(a) - urg(b));
    const w = board.flatMap(col => col.cards).find(c => c.isOpen) || null;
    const NEEDS = ['someone to look for it','who has it','their price','your shelf price'];
    const journey = !T ? [] : COLT.map((title, i) => {
      const status = i < T.stage ? 'done' : i === T.stage ? 'current' : 'next';
      const sups = supsOf(T), cost = costOf(T);
      const summary = status === 'done'
        ? [ `${T.askers} ${T.askers === 1 ? 'person' : 'people'} · first asked ${T.wait}d ago`, T.owner ? `${T.owner} looked` : 'looked', sups.length ? sups.slice(0, 3).map(n => n.split(' ')[0]).join(' · ') : 'source found', cost ? `cheapest ${fmtN(cost)}` : 'priced', 'on sale' ][i]
        : status === 'current' ? `${T.days}d here · limit ${LIM[Math.min(i, 3)]}d${T.days > LIM[Math.min(i, 3)] ? ' · over' : ''}` : `needs ${NEEDS[i - 1]}`;
      const col = status === 'done' ? '#0F6B43' : status === 'current' ? '#1C2233' : '#CFCAC1';
      return { title, summary, current: status === 'current' && !!w,
        mark: status === 'done' ? '✓' : String(i + 1),
        dot: `flex-shrink:0;width:26px;height:26px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-sizing:border-box;${status === 'done' ? 'background:#0F6B43;color:#FFFFFF' : status === 'current' ? 'background:#1C2233;color:#FFFFFF' : 'background:#FFFFFF;border:1.5px dashed #CFCAC1;color:#767F91'}`,
        line: `flex-grow:1;width:2px;min-height:${i === 4 ? 0 : 14}px;background:${i < T.stage ? '#0F6B43' : '#E6E3DD'};${i === 4 ? 'display:none;' : ''}`,
        bodyStyle: `display:flex;flex-direction:column;gap:8px;padding:3px 0 ${i === 4 ? 0 : 14}px;min-width:0`,
        titleStyle: `font-size:13px;font-weight:700;color:${status === 'next' ? '#767F91' : '#1C2233'}`,
        sumStyle: `font-size:11px;font-weight:${status === 'current' && T.days > LIM[Math.min(i, 3)] ? 700 : 500};color:${status === 'current' && T.days > LIM[Math.min(i, 3)] ? '#8E2A22' : status === 'done' ? col : '#767F91'}` };
    });

    /* ---- the item popup ---- */
    const mCard = board.flatMap(col => col.cards).find(c => c.isOpen) || null;
    const SINCE = d => d === 0 ? 'today' : d === 1 ? '1 day' : `${d} days`;
    const mSteps = !T ? [] : COLT.map((label, i) => {
      const st = i < T.stage ? 'done' : i === T.stage ? 'now' : 'todo';
      const lim = LIM[Math.min(i, 3)], over = st === 'now' && T.days > lim;
      const col = st === 'done' ? '#0F6B43' : st === 'now' ? (over ? '#8E2A22' : '#1C2233') : '#CFCAC1';
      return { label, mark: st === 'done' ? '✓' : String(i + 1),
        sub: st === 'now' ? `${SINCE(T.days)}${over ? ` · ${T.days - lim} over` : ` of ${lim}`}` : st === 'done' ? 'done' : '',
        dot: `flex-shrink:0;width:26px;height:26px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-sizing:border-box;${st === 'todo' ? 'background:#FFFFFF;border:1.5px solid #CFCAC1;color:#767F91' : `background:${col};color:#FFFFFF`}${st === 'now' ? `;box-shadow:0 0 0 4px ${over ? '#FBE5E2' : '#E6E3DD'}` : ''}`,
        line: `flex:1 1 auto;height:2px;margin:0 6px;background:${i < T.stage ? '#0F6B43' : '#E6E3DD'};${i === 4 ? 'visibility:hidden;' : ''}`,
        labelStyle: `font-size:12px;font-weight:${st === 'now' ? 700 : 600};color:${st === 'todo' ? '#767F91' : '#1C2233'}`,
        subStyle: `font-size:11px;font-weight:${over ? 700 : 500};color:${over ? '#8E2A22' : st === 'done' ? '#0F6B43' : '#5F6980'}` };
    });
    const KNL = ['Who has it','Their price','Pack size','Photo'];
    const DK = T && DET[T.rank] ? DET[T.rank].known : ['','','',''];
    const mKnown = !T ? [] : T.known.map((ok, k) => ({ short: KNL[k], chip: `display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 7px;border-radius:999px;font-size:11px;font-weight:600;background:${ok ? '#E4F4EA' : '#F7F5F2'};color:${ok ? '#0F6B43' : '#767F91'}`, label: KNL[k] + (ok && DK[k] ? ' · ' + DK[k] : ok ? '' : ' — not yet'),
      box: ok ? 'flex-shrink:0;width:8px;height:8px;border-radius:2px;background:#0F6B43' : 'flex-shrink:0;width:8px;height:8px;border-radius:2px;border:1px dashed #767F91;box-sizing:border-box',
      text: `color:${ok ? '#1C2233' : '#767F91'}` }));
    const SLB = { ready:['Ready to sell','#0F6B43','#E4F4EA'], over:['Over time','#8E2A22','#FBE5E2'], nobody:['Nobody on it','#7A4A02','#FDEEE1'], track:['On track','#5F6980','#EFECE6'] };
    const mState = T ? (T.days > LIM[Math.min(T.stage, 3)] && T.stage < 3 ? 'over' : T.state) : 'track';

    /* ---- popup: numbers, tabs, suppliers, demand, money, activity ---- */
    const TABS = [['verdict','Verdict'],['overview','Next step'],['suppliers','Suppliers'],['rivals','Competitors'],['demand','Who’s waiting'],['money','Money'],['activity','Activity']];
    const mt = S.mTab;
    const Tasks = T ? askersOf(T) : [];
    const Tsups = T ? supsOf(T) : [], Tprices = T ? pricesOf(T) : {}, Tcost = T ? costOf(T) : 0;
    const Tq = T ? qtyN(T) : 0, Trival = T ? rivalOf(T) : 0;
    const Tshelf = T ? (T.shelf || (S.taskShelf !== '' && T.stage === 3 ? num(S.taskShelf) : recPriceOf(T))) : 0;
    const Tpay = T ? (T.maxPrice || (Tcost ? Math.round(Trival * 0.98 / 500) * 500 : 0)) : 0;
    const daysIn = T ? T.wait : 0;
    const kpiCell = i => `display:flex;flex-direction:column;gap:2px;padding:10px 16px;min-width:0;${i ? 'border-left:1px solid #EFECE6;' : ''}`;
    const mKpis = !T ? [] : [
      { label: 'People waiting', value: String(T.askers), sub: `longest ${daysIn}d`, c: '#1C2233' },
      { label: 'Quantity asked', value: Tq ? fmtN(Tq) : '—', sub: (T.qty || '').split(' ').slice(1).join(' ') || 'not said', c: '#1C2233' },
      { label: 'Best cost', value: Tcost ? fmtN(Tcost) : '—', sub: Tcost ? `from ${(Object.entries(Tprices).find(e => e[1] === Tcost) || ['—'])[0].split(' ')[0]}` : `${Tsups.length} ${Tsups.length === 1 ? 'source' : 'sources'}, no price`, c: '#1C2233' },
      { label: 'Profit on the ask', value: Tcost && Tq ? `+${short((Tshelf - Tcost) * Tq)}` : '—', sub: Tcost ? `at ${fmtN(Tshelf)} a unit` : 'needs a price', c: Tcost ? '#0F6B43' : '#767F91' },
      { label: 'Days in funnel', value: String(daysIn), sub: `${T.days}d in this step`, c: T.days > LIM[Math.min(T.stage, 3)] ? '#8E2A22' : '#1C2233' }
    ].map((k, i) => ({ ...k, cell: kpiCell(i), valStyle: `font-size:20px;font-weight:600;line-height:1.2;color:${k.c}` }));
    const mTabs = TABS.map(([k, label]) => { const on = mt === k; const badge = k === 'rivals' ? (T ? rivalsOf(T).length : 0) : k === 'suppliers' ? Tsups.length : k === 'demand' ? Tasks.length : k === 'activity' ? ((S.events[T && T.rank] || []).length || '') : '';
      return { label, badge: badge === 0 ? '' : String(badge), selected: on ? 'true' : 'false', pick: () => this.setState({ mTab: k }),
        badgeStyle: badge ? `font-size:10px;font-weight:700;border-radius:999px;padding:0 6px;background:${on ? '#1C2233' : '#EFECE6'};color:${on ? '#FFFFFF' : '#5F6980'}` : 'display:none',
        style: `height:40px;display:flex;align-items:center;gap:6px;padding:0 12px;border:0;border-bottom:2px solid ${on ? '#C93A30' : 'transparent'};background:transparent;font-size:12px;font-weight:${on ? 700 : 600};color:${on ? '#1C2233' : '#5F6980'}` }; });
    /* suppliers */
    const DS = T && DET[T.rank] ? Object.fromEntries(DET[T.rank].sups.map(x => [x[0], x[2]])) : {};
    const pricedV = Object.values(Tprices), maxP = pricedV.length ? Math.max(...pricedV) : 1;
    const AVP2 = [['#E4E6FA','#3A3F9B'],['#DCEAF8','#1A5A8A'],['#F6E4F1','#7A3268'],['#E4F4EA','#0F6B43']];
    const avS = (n, sz) => { const c2 = AVP2[[...n].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 4]; return `flex-shrink:0;width:${sz}px;height:${sz}px;border-radius:${sz > 24 ? 8 : 999}px;background:${c2[0]};color:${c2[1]};font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center`; };
    const iniS = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const mSup = Tsups.map(n => { const pr = Tprices[n]; const best = pr != null && pr === Tcost; const terms = T.tiers && T.tiers[n] ? T.tiers[n].map(t => `${t.q}+ ${fmtN(t.p)}`).join(' · ') : (DS[n] || '').replace('has it · no price', '').trim();
      return { name: n, ini: iniS(n), av: avS(n, 30), price: pr != null ? fmtN(pr) : '—',
        status: pr == null ? 'has it · waiting for a price' : best && pricedV.length > 1 ? 'cheapest' : 'priced',
        statusStyle: `font-size:11px;font-weight:600;color:${pr == null ? '#95530C' : best ? '#0F6B43' : '#767F91'}`,
        priceStyle: `text-align:right;font-size:14px;font-weight:600;color:${pr == null ? '#767F91' : '#1C2233'}`,
        bar: pr == null ? 'display:none' : `width:${(pr / maxP * 100).toFixed(0)}%;background:${best ? '#0F6B43' : '#5F6980'};border-radius:2px`,
        delta: pr == null ? '' : best ? 'best' : `+${fmtN(pr - Tcost)}`, deltaStyle: `flex-shrink:0;font-size:11px;font-weight:600;color:${best ? '#0F6B43' : '#767F91'}`,
        terms: terms || '—', askLabel: pr == null ? 'Ask for price' : 'Ask to beat it',
        ask: () => { const sp = SUPS_ALL.find(x => x.name === n) || {}; const ok = owsvWhatsApp(sp.phone, `Hello ${n.split(' ')[0]}, do you have ${T.name}? ${pr == null ? 'What is your price' : 'Can you do better than ' + fmtN(pr)}${Tq ? ' for ' + fmtN(Tq) + ' ' + ((T.qty || '').split(' ')[1] || 'pcs') : ''}?`);
          this.setState({ log: ok ? `WhatsApp opened for ${n} — nothing is sent until you press send there` : `${n} has no phone number on file — add one in Suppliers` }); } }; });
    const mSupNote = pricedV.length > 1 ? `Buying the ${fmtN(Tq)} asked for from the cheapest saves ${short((maxP - Tcost) * Tq)} over the dearest.` : Tsups.length ? 'One quote isn’t a comparison — ask another supplier to be sure.' : '';
    /* demand */
    const CHL = { w:['WhatsApp','#1A5A8A'], c:['Counter','#7A3268'], q:['Search','#3A3F9B'], p:['Phone','#5F6980'] };
    const fKey = n => `${T ? T.rank : 0}:${n}`;
    const mAsks = Tasks.slice().sort((a, b) => b[3] - a[3]).map(x => { const on = S.follow[fKey(x[0])] !== false; return {
      name: x[0], ini: x[0] === 'Walk-in' ? '?' : iniS(x[0]), av: avS(x[0], 24), qty: fmtN(x[1]), channel: (CHL[x[2]] || CHL.c)[0],
      dot: `width:7px;height:7px;border-radius:999px;background:${(CHL[x[2]] || CHL.c)[1]}`, days: x[3],
      dayStyle: `text-align:right;font-size:11px;font-weight:${x[3] >= 14 ? 700 : 500};color:${x[3] >= 14 ? '#8E2A22' : '#5F6980'}`,
      pressed: on ? 'true' : 'false', followLabel: on ? '✓ Tell them' : 'Don’t tell',
      followStyle: `height:26px;border-radius:7px;font-size:11px;font-weight:600;border:1px solid ${on ? '#0F6B43' : '#E6E3DD'};background:${on ? '#E4F4EA' : '#FFFFFF'};color:${on ? '#0F6B43' : '#767F91'}`,
      toggle: () => this.setState({ follow: { ...S.follow, [fKey(x[0])]: !on } }) }; });
    const chanN = {}; Tasks.forEach(x => { chanN[x[2]] = (chanN[x[2]] || 0) + 1; });
    const mChan = Object.entries(chanN).map(([k, n]) => ({ label: (CHL[k] || CHL.c)[0], n, dot: `width:8px;height:8px;border-radius:999px;background:${(CHL[k] || CHL.c)[1]}`,
      bar: `flex:${n} 1 0;background:${(CHL[k] || CHL.c)[1]}` }));
    const topQ = Math.max(1, ...Tasks.map(x => x[1]));
    const mTop = Tasks.slice().sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => ({ name: x[0].split(' ')[0], qty: fmtN(x[1]), bar: `width:${(x[1] / topQ * 100).toFixed(0)}%;background:#1C2233;border-radius:2px` }));
    const tellN = mAsks.filter(a => a.pressed === 'true').length;
    const mFollowNote = `${tellN} of ${mAsks.length} will get a message draft when it’s on the shelf — you press send.`;
    /* money */
    let mm = {};
    if (T && Tcost) {
      const lo = Math.min(Tcost, Tshelf) * 0.9, hi = Math.max(Trival, Tshelf, Tpay) * 1.06, P = v => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)).toFixed(1);
      const mg = Tshelf - Tcost, pct = Tcost ? Math.round(mg / Tcost * 100) : 0;
      const tile = (i, label, value, sub, c) => ({ label, value, sub, cell: `display:flex;flex-direction:column;gap:2px;padding:12px 14px;${i ? 'border-left:1px solid #EFECE6;' : ''}`, valStyle: `font-size:18px;font-weight:600;color:${c}` });
      mm = { cost: fmtN(Tcost), shelf: fmtN(Tshelf), rival: fmtN(Trival), pay: Tpay ? fmtN(Tpay) : '—',
        gain: `position:absolute;top:12px;height:4px;background:${mg > 0 ? '#0F6B43' : '#8E2A22'};left:${P(Math.min(Tcost, Tshelf))}%;width:${Math.abs(P(Tshelf) - P(Tcost)).toFixed(1)}%`,
        costDot: `position:absolute;top:10px;left:calc(${P(Tcost)}% - 4px);width:8px;height:8px;border-radius:999px;background:#1C2233`,
        shelfDot: `position:absolute;top:7px;left:calc(${P(Tshelf)}% - 7px);width:14px;height:14px;border-radius:999px;background:#C93A30;border:2px solid #FFFFFF;box-sizing:border-box`,
        rivalDot: `position:absolute;top:8px;left:calc(${P(Trival)}% - 6px);width:12px;height:12px;background:#FFFFFF;border:2px solid #8E2A22;transform:rotate(45deg);box-sizing:border-box`,
        payDot: Tpay ? `position:absolute;top:8px;left:calc(${P(Tpay)}% - 6px);width:12px;height:12px;border-radius:2px;background:#FFFFFF;border:2px solid #3A3F9B;box-sizing:border-box` : 'display:none',
        tiles: [tile(0, 'Margin a unit', `${mg >= 0 ? '+' : ''}${fmtN(mg)}`, `${pct}% on cost`, mg > 0 ? '#0F6B43' : '#8E2A22'),
          tile(1, `Profit on ${fmtN(Tq)} asked`, Tq ? `+${short(mg * Tq)}` : '—', 'if everyone buys', '#0F6B43'),
          tile(2, 'Cash to stock it', Tq ? short(Tcost * Tq) : '—', 'tied up until sold', '#1C2233'),
          tile(3, 'Room under rivals', `${fmtN(Math.max(0, Trival - Tshelf))}`, Tshelf >= Trival ? 'you’re above them' : 'a unit cheaper than them', Tshelf >= Trival ? '#8E2A22' : '#1C2233')],
        note: Tshelf >= Trival ? 'Your price is at or above what rivals charge — people who waited may still buy elsewhere.' : Tpay && Tshelf > Tpay ? 'Your price is above what the askers said they’d pay.' : 'Priced between your cost and the rivals — room to sell and still beat them.' };
    }
    /* activity */
    const acts = [];
    if (T) {
      Tasks.slice().sort((a, b) => b[3] - a[3]).forEach(x => acts.push({ t: `${x[0]} asked for ${fmtN(x[1])} (${(CHL[x[2]] || CHL.c)[0]})`, d: x[3], c: '#3A3F9B' }));
      if (T.owner) acts.push({ t: `${T.owner} started looking`, d: Math.max(0, T.wait - 2), c: '#5F6980' });
      if (T.stage >= 2) acts.push({ t: `Source found: ${Tsups.slice(0, 3).map(n => n.split(' ')[0]).join(', ') || '—'}`, d: Math.max(0, T.days + (T.stage > 2 ? 3 : 0)), c: '#243052' });
      if (T.stage >= 3 && Tcost) acts.push({ t: `Priced — cheapest ${fmtN(Tcost)}`, d: T.days, c: '#1C2233' });
      acts.sort((a, b) => b.d - a.d);
      (S.events[T.rank] || []).forEach(t => acts.push({ t, d: -1, c: '#C93A30' }));
    }
    /* ---- competitors + the go / no-go verdict ---- */
    const Triv = T ? rivalsOf(T) : [];
    const shelfV = Tshelf, costV = Tcost;
    const inStock = Triv.filter(r => r.stock !== 'Out of stock'), outStock = Triv.filter(r => r.stock === 'Out of stock');
    const rMin = Triv.length ? Math.min(...Triv.map(r => r.price)) : 0, rMinIn = inStock.length ? Math.min(...inStock.map(r => r.price)) : 0;
    const rv = (() => {
      if (!T) return {};
      const vals = [...Triv.map(r => r.price), ...(costV ? [costV, shelfV] : [])];
      const lo = vals.length ? Math.min(...vals) * 0.94 : 0, hi = vals.length ? Math.max(...vals) * 1.04 : 1;
      const X = v => (14 + (v - lo) / Math.max(1, hi - lo) * 492).toFixed(1);
      const pts = Triv.slice().sort((a, b) => a.price - b.price).map((r, i) => ({ x: X(r.price), x0: (Number(X(r.price)) - 6).toFixed(1), rot: `rotate(45 ${X(r.price)} 30)`,
        fill: r.stock === 'Out of stock' ? '#FFFFFF' : '#FBE5E2', ly: i % 2 ? 58 : 12, label: `${r.name.split(' ')[0]} ${short(r.price)}` }));
      const rows = Triv.map(r => { const d = shelfV && costV ? r.price - shelfV : 0; return { name: r.name, price: fmtN(r.price),
        vs: !costV ? '—' : d > 0 ? `you −${fmtN(d)}` : d < 0 ? `you +${fmtN(-d)}` : 'same',
        vsStyle: `font-size:11px;font-weight:700;color:${!costV ? '#767F91' : d > 0 ? '#0F6B43' : d < 0 ? '#8E2A22' : '#5F6980'}`,
        stock: r.stock, stockStyle: `font-size:11px;font-weight:600;color:${r.stock === 'Out of stock' ? '#0F6B43' : r.stock === 'Low stock' ? '#95530C' : '#5F6980'}`,
        area: r.area, when: `${r.days}d · ${r.how}`, hasBreaks: !!(r.breaks || []).length, breaks: (r.breaks || []).map(b => `${fmtN(b.q)}+ ${fmtN(b.p)}`).join(' · '),
        remove: () => this.setState({ rivalsCut: { ...S.rivalsCut, [T.rank]: [...((S.rivalsCut || {})[T.rank] || []), r.name] } }) }; });
      const note = !Triv.length ? '' : !costV ? `${Triv.length} ${Triv.length === 1 ? 'shop' : 'shops'} checked · cheapest ${fmtN(rMin)} — get a supplier price to compare`
        : shelfV < (rMinIn || rMin) ? `Your price ${fmtN(shelfV)} is ${Math.round(((rMinIn || rMin) - shelfV) / (rMinIn || rMin) * 100)}% under the cheapest rival in stock${outStock.length ? ` · ${outStock.length} ${outStock.length === 1 ? 'rival is' : 'rivals are'} out of stock right now` : ''}.`
        : `Your price is at or above ${fmtN(rMinIn || rMin)} — rivals will win unless you’re closer or faster.`;
      return { has: Triv.length > 0, none: Triv.length === 0, pts, rows, hasCost: !!costV, costX: X(costV || lo), shelfX: X(shelfV || lo), cost: short(costV), shelf: short(shelfV),
        aria: `Competitor prices from ${fmtN(rMin)}`, note, noteStyle: `font-size:12px;font-weight:600;color:${!costV ? '#5F6980' : shelfV < (rMinIn || rMin) ? '#0F6B43' : '#8E2A22'}` };
    })();
    const vd = (() => {
      if (!T) return {};
      const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
      const sc = [];
      const dem = clamp(T.askers * 11 + (T.wait >= 14 ? 12 : T.wait >= 7 ? 6 : 0) + Math.min(15, Tq / 10));
      sc.push({ k: 'demand', label: 'Demand', w: 25, s: dem, value: `${T.askers} people`, reason: `${T.askers} asked for ${T.qty || 'some'} over ${T.wait}d${T.askers >= 5 ? ' — steady demand' : T.askers <= 1 ? ' — one person so far' : ''}`, tab: 'demand' });
      const pct = costV ? (shelfV - costV) / costV : 0;
      sc.push({ k: 'margin', label: 'Margin', w: 25, s: costV ? clamp(pct / 0.3 * 100) : 0, value: costV ? `${Math.round(pct * 100)}%` : '—', reason: costV ? `+${fmtN(shelfV - costV)} a unit at ${fmtN(shelfV)}` : 'needs a supplier price', tab: costV ? 'money' : 'suppliers', missing: !costV });
      const ref = rMinIn || rMin;
      const posS = !Triv.length ? 45 : !costV ? 50 : clamp(50 + (ref - shelfV) / ref * 400);
      sc.push({ k: 'price', label: 'Price vs rivals', w: 20, s: posS, value: !Triv.length ? '—' : costV ? `${shelfV < ref ? '−' : '+'}${Math.abs(Math.round((ref - shelfV) / ref * 100))}%` : '—',
        reason: !Triv.length ? 'no competitor prices yet' : costV ? `cheapest rival ${fmtN(ref)} vs your ${fmtN(shelfV)}` : `cheapest rival ${fmtN(ref)}`, tab: 'rivals', missing: Triv.length < 2 });
      const compS = !Triv.length ? 50 : clamp(90 - inStock.length * 18 + outStock.length * 10);
      sc.push({ k: 'comp', label: 'Competition', w: 10, s: compS, value: `${inStock.length} in stock`, reason: !Triv.length ? 'unknown — check shops' : `${inStock.length} of ${Triv.length} rivals have it${outStock.length ? `, ${outStock.length} out` : ''}`, tab: 'rivals' });
      const pricedN = Object.keys(Tprices).length, minBlock = T.tiers ? Object.values(T.tiers).every(ts => ts.length && Math.min(...ts.map(t => t.q)) > Tq) : false;
      sc.push({ k: 'supply', label: 'Supply', w: 10, s: clamp((pricedN >= 2 ? 85 : pricedN === 1 ? 55 : Tsups.length ? 30 : 5) - (minBlock ? 40 : 0)), value: `${pricedN} ${pricedN === 1 ? 'quote' : 'quotes'}`,
        reason: pricedN ? `${pricedN} priced of ${Tsups.length} ${Tsups.length === 1 ? 'source' : 'sources'}${minBlock ? ' · minimum order above demand' : ''}` : Tsups.length ? 'sources found, no prices yet' : 'nobody found yet', tab: 'suppliers', missing: pricedN < 2 });
      const cash = costV * Tq, prof = (shelfV - costV) * Tq;
      sc.push({ k: 'cash', label: 'Cash payback', w: 10, s: !costV ? 0 : clamp(100 - cash / 50000 + prof / cash * 60), value: costV ? short(cash) : '—', reason: costV ? `ties up ${short(cash)} to earn ${short(prof)}` : 'needs a price', tab: 'money' });
      const total = Math.round(sc.reduce((a, x) => a + x.s * x.w, 0) / sc.reduce((a, x) => a + x.w, 0));
      const V0 = !costV ? ['Not enough to decide', '#5F6980', '#EFECE6'] : total >= 70 ? ['Stock it', '#0F6B43', '#E4F4EA'] : total >= 55 ? ['Stock a small first batch', '#95530C', '#FEF8F2'] : total >= 40 ? ['Special order only', '#95530C', '#FEF8F2'] : ['Don’t stock', '#8E2A22', '#FBE5E2'];
      const V = V0;
      const best = sc.filter(x => !x.missing).sort((a, b) => b.s - a.s)[0], worst = sc.slice().sort((a, b) => a.s - b.s)[0];
      const why = !costV ? 'Get at least one supplier price and two competitor prices — then this gives you a straight answer.'
        : `Strongest: ${best.label.toLowerCase()} (${best.reason}). Weakest: ${worst.label.toLowerCase()} (${worst.reason}).`;
      /* confidence: how much evidence stands behind the verdict.
         Enough = 3 supplier quotes, 3 competitor prices (checked in the last 14 days), 5 buyers — or fewer buyers if regulars have committed most of the quantity. */
      const REG = REGS;
      const regN = Tasks.filter(x => REG.includes(x[0].toLowerCase().split(/[^a-z]+/)[0])).length;
      const regQty = Tasks.filter(x => REG.includes(x[0].toLowerCase().split(/[^a-z]+/)[0])).reduce((a, x) => a + x[1], 0);
      const fresh = Triv.filter(r => r.days <= 14).length;
      const allSearch = Tasks.length > 0 && Tasks.every(x => x[2] === 'q');
      const pricedFresh = Object.keys(Tprices).filter(n => !quoteExpired(T, n)).length;
      const CF = confOf(T), cS = CF.cS, cR = CF.cR, cB = CF.cB, conf = CF.conf;
      const CL = conf >= 80 ? ['High confidence', '#0F6B43', '#E4F4EA'] : conf >= 55 ? ['Medium confidence', '#95530C', '#FEF8F2'] : ['Low confidence', '#8E2A22', '#FBE5E2'];
      const need = [ ...(pricedFresh < pricedN ? [`${pricedN - pricedFresh} expired ${pricedN - pricedFresh === 1 ? 'quote' : 'quotes'} to re-confirm`] : []), ...(CF.bStale ? [`${CF.bStale} ${CF.bStale === 1 ? 'buyer' : 'buyers'} to re-confirm`] : []), ...(pricedN < 3 ? [`${3 - pricedN} more supplier ${3 - pricedN === 1 ? 'quote' : 'quotes'}`] : []), ...(Triv.length < 3 ? [`${3 - Triv.length} more competitor ${3 - Triv.length === 1 ? 'price' : 'prices'}`] : Triv.length && fresh === 0 ? ['fresher competitor prices'] : []),
        ...(cB < 80 ? [allSearch ? 'a buyer who actually promised' : regN ? 'a regular to confirm their quantity' : `${Math.max(1, 5 - T.askers)} more ${5 - T.askers === 1 ? 'buyer' : 'buyers'}`] : []) ];
      const dotRow = (have, target, col) => Array.from({ length: target }, (_, i) => ({ style: `width:8px;height:8px;border-radius:999px;${i < have ? `background:${col}` : 'border:1.5px solid #CFCAC1;box-sizing:border-box'}` }));
      const evItem = (label, have, target, score, tab, hint) => { const col = score >= 80 ? '#0F6B43' : score >= 40 ? '#95530C' : '#8E2A22'; return { label, hint, count: `${have}/${target}`, dots: dotRow(Math.min(have, target), target, col),
        countStyle: `font-size:11px;font-weight:700;color:${col}`, go: () => this.setState({ mTab: tab }),
        style: `height:30px;display:flex;align-items:center;gap:8px;padding:0 10px;border-radius:999px;border:1px solid #E6E3DD;background:#FFFFFF;color:#1C2233;font:inherit;cursor:pointer` }; };
      const ev = [ evItem('Supplier quotes', pricedN, 3, cS, 'suppliers', '3 quotes tell you the real going price'),
        evItem('Competitor prices', Triv.length, 3, cR, 'rivals', '3 shops, checked in the last 2 weeks'),
        evItem('Buyers', T.askers, 5, cB, 'demand', '5 people — or fewer if regulars commit most of the quantity') ];
      const gaps = [ ...(pricedN < 2 ? [{ label: pricedN ? 'Get a second supplier quote' : 'Get a supplier price', go: () => this.setState({ mTab: pricedN ? 'suppliers' : 'overview' }) }] : []),
        ...(Triv.length < 2 ? [{ label: `Check ${2 - Triv.length} more ${2 - Triv.length === 1 ? 'shop' : 'shops'}`, go: () => this.setState({ mTab: 'rivals' }) }] : []) ];
      const canList = T.stage === 3 && costV && shelfV > costV;
      const bandC = s => s >= 70 ? '#0F6B43' : s >= 45 ? '#95530C' : '#8E2A22';
      return { ev, confLabel: `${CL[0]} · ${conf}%`, confPill: `flex-shrink:0;height:22px;display:inline-flex;align-items:center;padding:0 9px;border-radius:999px;font-size:11px;font-weight:700;background:${CL[2]};color:${CL[1]}`,
        confWhy: need.length ? `To be sure: ${need.join(', ')}.` : 'Enough evidence on all three counts.', conf,
        title: costV && conf < 55 && V[0] !== 'Not enough to decide' ? `Leaning: ${V[0].toLowerCase()}` : V[0], col: V[1], score: costV ? String(total) : '—', dash: `${(costV ? total : 0) / 100 * 163.4} 163.4`,
        titleStyle: `font-size:22px;font-weight:700;line-height:1.1;color:${V[1]}`,
        banner: `display:flex;align-items:center;gap:16px;padding:14px 16px;border-radius:10px;background:${V[2]};border:1px solid ${V[1]}33`,
        why, hasGaps: gaps.length > 0, gaps,
        rows: sc.map((x, i) => ({ label: x.label, weight: `${x.w}% weight`, value: x.value, reason: x.reason, hint: 'Open the details',
          go: () => this.setState({ mTab: x.tab }),
          bar: `position:absolute;left:0;top:0;height:8px;border-radius:4px;width:${x.s}%;background:${x.missing && x.s === 0 ? '#CFCAC1' : bandC(x.s)}`,
          valStyle: `font-size:14px;font-weight:700;color:${x.missing && !costV ? '#767F91' : bandC(x.s)}`,
          rowStyle: `display:grid;grid-template-columns:120px 160px 70px minmax(0,1fr);gap:12px;align-items:center;width:100%;padding:9px 12px;border:0;${i ? 'border-top:1px solid #EFECE6;' : ''}background:#FFFFFF;font:inherit;text-align:left;cursor:pointer` })),
        mainLabel: T.stage < 3 ? 'Needs a price first' : V[0] === 'Don’t stock' ? 'Stock it anyway' : 'Stock it · add to shop',
        mainOff: !canList,
        mainStyle: `height:38px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:9px;font-size:12px;font-weight:700;text-align:left;border:1px solid ${canList ? '#0F6B43' : '#E6E3DD'};background:${canList ? '#0F6B43' : '#F7F5F2'};color:${canList ? '#FFFFFF' : '#767F91'}`,
        goMain: () => { if (!canList) return; apply(T, { stage: 4, shelf: shelfV, shelfTiers: (pl && pl.ladder) || null, verdict: V[0] }, `${T.name} is on the shelf at ${fmtN(shelfV)} — verdict ${total}/100`); },
        special: () => commit({ snoozed: [...S.snoozed, T.rank], task: null }, `${T.name}: special order only — we’ll order when someone pays a deposit`),
        pass: () => commit({ dropped: [...S.dropped, T.rank], task: null }, `${T.name}: not stocking (${total ? total + '/100' : 'not enough margin'}). Kept for next time.`),
        foot: 'Scores use the recommended price unless you pick another. Demand and margin count most.' };
    })();
    /* ---- the plan: price, first batch, who to call, who to buy from ---- */
    const pl = (() => {
      if (!T || !Tcost) return { ok: false, notYet: !!T };
      const cInfo = n => { const k = String(n).toLowerCase(); const c = AD.clients.find(x => x.name.toLowerCase() === k) || AD.clients.find(x => x.name.toLowerCase().split(/[^a-z]+/)[0] === k.split(/[^a-z]+/)[0] && k.split(/[^a-z]+/)[0].length > 2); return c ? [c.orders, c.owes] : [0, 0]; };
      const unitW = (T.qty || '').split(' ')[1] || 'units';
      const P = recPriceInfo(T);
      const price = Tshelf, mg = price - Tcost;
      const probOf = x => { const [orders] = cInfo(x[0]); return x[0] === 'Walk-in' ? 0.45 : orders >= 5 ? 0.9 : orders >= 1 ? 0.75 : x[2] === 'q' ? 0.5 : 0.65; };
      const score = Number(vd.score) || 0;
      const sure = Tasks.filter(x => probOf(x) >= 0.9).reduce((a, x) => a + x[1], 0);
      const likely = score < 55 ? 0 : Math.round(Tasks.filter(x => probOf(x) < 0.9).reduce((a, x) => a + x[1] * probOf(x), 0));
      const perMonthAsks = T.askers / Math.max(7, T.wait) * 30, avgQ = Tq / Math.max(1, T.askers);
      const buffer = score < 70 ? 0 : Math.min(Math.round(perMonthAsks / 2 * avgQ * 0.5), Math.round((sure + likely) * 0.25));
      let batch = Math.max(1, sure + likely + buffer);
      // buy from: cheapest delivered at the batch size, from saved ladders or quoted prices
      const ladders = T.tiers || Object.fromEntries(Object.entries(Tprices).map(([n, p0]) => { const mq = num(((DET[T.rank] ? (DET[T.rank].sups.find(x => x[0] === n) || [])[2] : '') || '').match(/\d+/) || 1) || 1; return [n, [{ q: mq, p: p0 }]]; }));
      const at = (n, q) => { const ts = (ladders[n] || []).slice().sort((a, b) => b.q - a.q); const h = ts.find(t => t.q <= q); return h ? h.p : null; };
      const minOf = n => { const ts = ladders[n] || []; return ts.length ? Math.min(...ts.map(t => t.q)) : 1; };
      const trans = n => num((T.trans || {})[n]);
      const quote = q => Object.keys(ladders).map(n => ({ n, p: at(n, q), t: at(n, q) != null ? at(n, q) * q + trans(n) : null })).filter(x => x.p != null).sort((a, b) => a.t - b.t);
      let forced = '';
      if (!quote(batch).length) { const mins = Object.keys(ladders).map(minOf); const m = Math.min(...mins); forced = `their smallest order is ${m}`; batch = m; }
      // round up to a price break when the extra units cost little
      let rounded = 0;
      const best0 = quote(batch)[0];
      Object.keys(ladders).forEach(n => (ladders[n] || []).forEach(t => { if (t.q > batch && t.q <= batch * 1.35) { const extraCost = t.p * t.q + trans(n) - best0.t; const perU = extraCost / (t.q - batch); if (perU < Tcost * 0.5 && t.q - batch > rounded) rounded = t.q - batch; } }));
      batch += rounded;
      const pack = num(Object.values(T.packs || {}).find(v => /\d/.test(v || '')) || '');
      if (pack > 1 && batch % pack) { rounded += pack - (batch % pack); batch += pack - (batch % pack); }
      const bq = quote(batch)[0] || best0;
      const cash = bq.t, prof = price * batch - cash;
      const perDay = Math.max(0.2, perMonthAsks * avgQ / 30);
      const committed = sure + likely;
      const daysSell = Math.max(1, Math.round(Math.max(0, batch - committed) / perDay) + 7);
      // who to call
      const calls = Tasks.map(x => { const [orders, owes] = cInfo(x[0]); const p = probOf(x);
        const score = x[1] * p + (orders >= 5 ? 20 : 0) - (owes ? 15 : 0) + x[3] * 0.6;
        const big = x[1] >= batch * 0.25 && x[1] * price >= 1000000;
        const why = [`${fmtN(x[1])} ${unitW}`, orders >= 5 ? `regular · ${orders} orders` : orders ? `${orders} orders` : 'new', `waited ${x[3]}d`].join(' · ')
          + (owes ? ` · owes ${short(owes)} — ask a deposit` : big ? ' · big order — ask 30% deposit' : '');
        return { x, score, why, warn: !!owes };
      }).sort((a, b) => b.score - a.score).slice(0, 3).map((c, i) => ({ n: i + 1, name: c.x[0], why: c.why,
        whyStyle: `font-size:10px;color:${c.warn ? '#95530C' : '#5F6980'};font-weight:${c.warn ? 700 : 400}`,
        msg: () => this.setState({ log: `Message drafted to ${c.x[0]}: “${T.name} is coming in at ${fmtN(price)} — shall we reserve your ${fmtN(c.x[1])}?” Nothing sent until you press send.` }) }));
      const risks = [];
      if (forced) risks.push(`The supplier’s minimum (${forced}) is more than the demand — you carry the extra.`);
      if (P.squeezed) risks.push(`Rivals sell at ${fmtN(P.rivalRef)}; beating them leaves only ${Math.round((P.rec - Tcost) / Tcost * 100)}% margin.`);
      if (Tasks.length && Tasks.every(x => x[2] === 'q')) risks.push('Every ask came from quote searches — nobody has promised to buy yet.');
      if (daysSell > 60) risks.push(`At the current pace the extra stock takes about ${daysSell} days to sell.`);
      if (Object.keys(ladders).length < 2) risks.push('Only one supplier quote — you may be overpaying.');
      const opt = (label, p, sub) => { const on = price === p; return { label, price: fmtN(p), sub, pressed: on ? 'true' : 'false', pick: () => this.setState({ taskShelf: String(p) }),
        style: `display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:6px 8px;border-radius:8px;border:1px solid ${on ? '#C93A30' : '#E6E3DD'};background:${on ? '#FDE8E4' : '#FFFFFF'};color:${on ? '#A82D24' : '#1C2233'};text-align:left;font:inherit` }; };
      const options = [
        ...(P.undercut ? [opt('Win on price', P.undercut, `${Math.round((P.undercut - Tcost) / Tcost * 100)}% margin`)] : []),
        ...(P.rivalRef ? [opt('Match rivals', P.rivalRef, `${Math.round((P.rivalRef - Tcost) / Tcost * 100)}% margin`)] : []),
        opt('Healthy margin', P.target, '30% margin')
      ].filter((o, i, a) => a.findIndex(z => z.price === o.price) === i).slice(0, 3);
      const segW = v => `${Math.max(0, v / batch * 100).toFixed(1)}%`;

      /* sell-side volume ladder: break points from how people actually order; bigger orders give back part of the margin, never below the 12% floor */
      const nice = n => [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].reduce((a, b) => Math.abs(b - n) < Math.abs(a - n) ? b : a, 5);
      const qsA = Tasks.map(x => x[1]).filter(q => q > 0).sort((a, b) => a - b);
      const med = qsA.length ? qsA[Math.floor(qsA.length / 2)] : 0, top = qsA.length ? qsA[qsA.length - 1] : 0;
      let b2 = med >= 4 ? nice(med * 0.8) : 0; let b3 = top >= Math.max(10, b2 * 2) ? nice(top * 0.75) : 0;
      if (b3 && b2 && b3 <= b2) b3 = 0; if (b2 && b2 < 2) b2 = 0;
      const unitCost = bq.p, floorP = Math.ceil(unitCost * 1.12 / 100) * 100, rm = price - unitCost;
      const r100 = v => Math.round(v / 100) * 100;
      const tiers = [{ tier: 'Retail', from: 1, p: price }];
      if (b2 && b2 > 1) tiers.push({ tier: 'Trade', from: b2, p: Math.max(floorP, r100(unitCost + rm * 0.7)) });
      if (b3) tiers.push({ tier: 'Bulk', from: b3, p: Math.max(floorP, r100(unitCost + rm * 0.45)) });
      const pulled = [];
      /* a rival's volume break that our ladder doesn't answer, at a size people actually order, becomes a tier of its own */
      const tierAt = q => tiers.slice().reverse().find(t => q >= t.from) || tiers[0];
      [...new Set(Triv.filter(r => r.stock !== 'Out of stock').flatMap(r => (r.breaks || []).map(b => b.q)))].filter(q => q > 1 && q <= top).sort((a, b) => a - b).forEach(q => {
        const cr = cheapestAt(T, q), cur = tierAt(q); if (!cr || tiers.some(t => t.from === q) || cur.p < cr.p) return;
        const np = Math.max(floorP, Math.floor((cr.p - Math.max(100, cr.p * 0.02)) / 100) * 100); if (np >= cur.p) return;
        tiers.push({ tier: '', from: q, p: np }); tiers.sort((x, y) => x.from - y.from); pulled.push(`a ${fmtN(q)}+ price of ${fmtN(np)} answers ${cr.name.split(' ')[0]}’s ${fmtN(cr.p)}`); });
      tiers.forEach((t, i) => { t.tier = ['Retail', 'Trade', 'Bulk', 'Bulk+'][i] || 'Bulk+'; if (i && t.p > tiers[i - 1].p) t.p = tiers[i - 1].p; });
      tiers.forEach((t, i) => { if (!i) return; const cr = cheapestAt(T, t.from); if (!cr) return; t.rival = cr;
        if (t.p >= cr.p) { const np = Math.max(floorP, Math.floor((cr.p - Math.max(100, cr.p * 0.02)) / 100) * 100); if (np < t.p) { pulled.push(`${t.tier} to ${fmtN(np)} to stay under ${cr.name.split(' ')[0]}’s ${fmtN(cr.p)} at ${fmtN(t.from)}+`); t.p = np; } t.squeezed = np >= cr.p; } });
      if (tiers[0]) tiers[0].rival = cheapestAt(T, 1);
      const tierFor = q => tiers.slice().reverse().find(t => q >= t.from) || tiers[0];
      const ladder = tiers.map(t => { const who = Tasks.filter(x => tierFor(x[1]) === t).map(x => `${x[0].split(' ')[0]} ${x[1]}`);
        const m = Math.round((t.p - unitCost) / unitCost * 100);
        const rv2 = t.rival, gap = rv2 ? rv2.p - t.p : 0;
        return { tier: t.tier, from: fmtN(t.from), price: fmtN(t.p), margin: `${m}%`, who: who.length ? who.join(', ') : '—',
          rival: rv2 ? short(rv2.p) : '—', rivalTitle: rv2 ? `Cheapest rival at ${fmtN(t.from)}+: ${rv2.name} ${fmtN(rv2.p)}${rv2.isBreak ? ' (their volume price)' : ''}` : 'No competitor price yet',
          rStyle: `text-align:right;font-weight:700;color:${!rv2 ? '#767F91' : gap > 0 ? '#0F6B43' : '#8E2A22'}`,
          mStyle: `text-align:right;font-weight:700;color:${m >= 20 ? '#0F6B43' : m >= 12 ? '#95530C' : '#8E2A22'}` }; });
      const flatProfit = Tasks.reduce((a, x) => a + (price - unitCost) * x[1], 0);
      const ladProfit = Tasks.reduce((a, x) => a + (tierFor(x[1]).p - unitCost) * x[1], 0);
      const ladderWhy = tiers.length === 1 ? 'Everyone asks in small amounts — one price is enough for now.'
        : `Breaks at ${tiers.slice(1).map(t => fmtN(t.from)).join(' and ')} follow how people actually order.${pulled.length ? ` Rivals discount too, so ${pulled.join('; ')}.` : ''} On today’s asks the discounts cost ${short(flatProfit - ladProfit)} of margin — worth it to keep the big buyers from going to rivals${Triv.length ? ` at ${fmtN(rMinIn || rMin)}` : ''}.`;
      const expQty = Math.min(batch, Tasks.reduce((a, x) => a + x[1] * probOf(x), 0));
      const expRev = Tasks.reduce((a, x) => a + tierFor(x[1]).p * x[1] * probOf(x), 0) * (expQty / Math.max(1, Tasks.reduce((a, x) => a + x[1] * probOf(x), 0))) + Math.max(0, batch - expQty) * price;
      const profLad = Math.round(expRev - cash);

      /* how to hold it: stock (buy and keep), consignment (supplier's goods, pay as sold), or order per client (back-to-back) */
      const supRec = (SUPS_ALL || []).find(x => x.name === bq.n) || {};
      const leadTxt = ((T.terms || {})[bq.n] || {}).lead || supRec.lead || '2 days';
      const leadDays = /same/i.test(leadTxt) ? 0 : /3 week|2–3 week/i.test(leadTxt) ? 21 : /week/i.test(leadTxt) ? 7 : (parseInt((String(leadTxt).match(/\d+/) || ['2'])[0], 10) || 2);
      const supOrders = supRec.orders || 0;
      const consUnit = Math.round(bq.p * 1.06 / 50) * 50;
      const holdRec = score < 55 ? 'demand'
        : (leadDays <= 2 && T.askers < 5) ? 'demand'
        : (((cash > 2000000 && daysSell > 21) || daysSell > 45) && supOrders >= 10) ? 'consign' : 'stock';
      const holdWhyMap = {
        stock: `Buy and keep: it sells through in about ${daysSell} days${T.askers >= 5 ? ` to ${T.askers} people asking` : ''}${leadDays >= 3 ? `, and ${bq.n.split(' ')[0]} takes ${leadTxt} to deliver — too slow for clients who want it today` : ''}. Full margin, and the ${short(cash)} comes back quickly.`,
        consign: `Ask ${bq.n.split(' ')[0]} to leave it on consignment: you’ve placed ${supOrders} orders with them, and it saves tying up ${short(cash)}${daysSell > 30 ? ` for ~${daysSell} days` : ''}. Costs about 6% more a unit (${fmtN(consUnit)}).`,
        demand: score < 55 ? `Don’t hold stock yet — the case isn’t strong enough. Take a deposit, then order from ${bq.n.split(' ')[0]} for each client.` : `${bq.n.split(' ')[0]} delivers ${leadTxt === 'Same day' ? 'the same day' : `in ${leadTxt}`} and only ${T.askers} ${T.askers === 1 ? 'person has' : 'people have'} asked — order per client with a deposit, no money sitting on the shelf.` };
      const hSel = S.holdMode || holdRec;
      const holds = [
        { k: 'stock', label: 'Stock it', cash: short(cash), sub: `margin ${Math.round((price - bq.p) / bq.p * 100)}% · ready now` },
        { k: 'consign', label: 'Consignment', cash: '0 upfront', sub: `margin ${Math.round((price - consUnit) / consUnit * 100)}% · pay as sold` },
        { k: 'demand', label: 'Order per client', cash: '0 held', sub: `margin ${Math.round((price - bq.p) / bq.p * 100)}% · ${leadDays === 0 ? 'same day' : `${leadDays}d wait`}` }
      ].map(h => { const on = hSel === h.k, rec = holdRec === h.k; return { ...h, pressed: on ? 'true' : 'false', hint: holdWhyMap[h.k],
        pick: () => this.setState({ holdMode: h.k }),
        tagStyle: rec ? `margin-left:auto;font-size:9px;font-weight:700;border-radius:999px;padding:0 5px;background:${on ? '#FFFFFF' : '#E4F4EA'};color:#0F6B43` : 'display:none',
        style: `display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:6px 8px;border-radius:8px;font:inherit;text-align:left;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}` }; });
      const holdWhy = (hSel !== holdRec ? `Your choice (recommended: ${holds.find(h => h.k === holdRec).label.toLowerCase()}). ` : '') + holdWhyMap[hSel];
      const volQs = [...new Set([1, ...Triv.flatMap(r => (r.breaks || []).map(b => b.q)), ...tiers.map(t => t.from)])].sort((a, b) => a - b).slice(0, 6);
      const vol = Triv.length ? volQs.map(q => { const cr = cheapestAt(T, q), ours = tierFor(q).p, d = cr ? cr.p - ours : 0;
        return { q: `${fmtN(q)}+`, rival: cr ? fmtN(cr.p) : '—', who: cr ? `${cr.name.split(' ')[0]}${cr.isBreak ? ' · volume' : ''}` : '', ours: fmtN(ours), tier: tierFor(q).tier,
          gap: !cr ? '—' : d > 0 ? `you −${fmtN(d)}` : d < 0 ? `you +${fmtN(-d)}` : 'same', gapStyle: `font-size:11px;font-weight:700;color:${!cr ? '#767F91' : d > 0 ? '#0F6B43' : '#8E2A22'}` }; }) : [];
      const _ret = { ok: true, notYet: false, holds, holdWhy, ladder, ladderWhy, vol, hasVol: vol.length > 1,
        price: fmtN(price), priceMargin: `+${fmtN(mg)} · ${Math.round(mg / Tcost * 100)}%`,
        priceWhy: S.taskShelf !== '' && num(S.taskShelf) !== P.rec ? `Your choice. Recommended was ${fmtN(P.rec)} — ${P.why}` : P.why,
        options,
        batch: fmtN(batch), batchUnit: `${unitW} · ${short(cash)} cash`, cash: '',
        barSure: `width:${segW(sure)};background:#0F6B43`, barLikely: `width:${segW(likely)};background:#5F6980`, barBuffer: `width:${segW(buffer)};background:#B3BCD2`, barRound: `width:${segW(Math.max(0, batch - sure - likely - buffer))};background:#E0C9B0`,
        batchKey: [{ label: `${Math.round(sure)} promised by regulars`, sw: 'width:8px;height:8px;border-radius:2px;background:#0F6B43' }, { label: `${Math.round(likely)} likely`, sw: 'width:8px;height:8px;border-radius:2px;background:#5F6980' },
          { label: `${buffer} for the next asks`, sw: 'width:8px;height:8px;border-radius:2px;background:#B3BCD2' }, ...(batch - sure - likely - buffer > 0 ? [{ label: `${batch - sure - likely - buffer} to reach ${forced ? 'the supplier’s minimum' : 'a cheaper price break or whole pack'}`, sw: 'width:8px;height:8px;border-radius:2px;background:#E0C9B0' }] : [])],
        batchWhy: score < 55 ? `Only what regulars have promised — order it against deposits, don’t carry stock yet.` : score < 70 ? `A test batch: the people likely to buy, nothing extra. If it sells in two weeks, reorder with a buffer.` : `The people likely to buy${buffer ? ` plus about two weeks of new asks (${buffer})` : ''} — not the full ${fmtN(Tq)} asked, because walk-ins and search-only asks don’t all turn into sales.`,
        calls,
        sup: bq.n, supDeal: `${fmtN(bq.p)} a unit × ${fmtN(batch)}${trans(bq.n) ? ` + ${short(trans(bq.n))} transport` : ''} = ${short(bq.t)}`,
        supWhy: quote(batch).length > 1 ? `Cheapest delivered at ${fmtN(batch)} — ${short(quote(batch)[1].t - bq.t)} less than ${quote(batch)[1].n.split(' ')[0]}.` : 'The only quote at this quantity.',
        payback: `~${daysSell} days`, profit: `+${short(profLad)}`,
        hasRisks: risks.length > 0, risks: risks.map(t => ({ t })) };
      _ret.batchKey = _ret.batchKey.filter(x => !/^0 /.test(x.label));
      return _ret;
    })();
    const mActs = acts.slice().reverse().map(a => ({ text: a.t, when: a.d < 0 ? 'just now' : a.d === 0 ? 'today' : `${a.d}d ago`, dot: `flex-shrink:0;width:10px;height:10px;border-radius:999px;background:${a.c}` }));

    /* rail detail + item-to-item navigation */
    const NEEDS2 = ['', 'needs someone looking', 'needs a source', 'needs a price', 'needs your price'];
    const DONE_SUB = T ? [`${T.askers} asked`, T.owner || 'looked', `${Tsups.length} ${Tsups.length === 1 ? 'source' : 'sources'}`, Tcost ? `cost ${short(Tcost)}` : 'priced', 'listed'] : [];
    const GO_TAB = ['demand', 'overview', 'suppliers', 'money', 'money'];
    const mSteps2 = mSteps.map((st, i) => ({ ...st,
      sub: st.sub === 'done' ? DONE_SUB[i] : st.sub || NEEDS2[i],
      hint: st.sub === 'done' ? `See ${TABS.find(t => t[0] === GO_TAB[i])[1]}` : '',
      go: () => this.setState({ mTab: st.mark === '✓' ? GO_TAB[i] : 'overview' }) }));
    const NAV = LIVE.slice().sort((a, b) => a.stage - b.stage || b.askers - a.askers);
    const navI = T ? NAV.findIndex(it => it.rank === T.rank) : -1;
    const goNav = d => { if (!NAV.length) return; const n = NAV[(navI + d + NAV.length) % NAV.length]; this.setState({ task: n.rank, mTab: S.mTab, renaming: null, addAsk: false, mergeOpen: false, dropAsk: false, taskSups: [], taskPrices: {}, taskSup: '', taskMin: '', taskShelf: '' }); };
    const PEOPLE = [['all','All'], ...STAFF.map(n => [n, n.split(' ')[0]]), ['nobody','Nobody']];
    const boardPeople = PEOPLE.map(([k, label]) => { const on = who === k; return {
      label, pressed: on ? 'true' : 'false', ini: k === 'all' ? '' : k === 'nobody' ? '+' : AV[k][2],
      n: k === 'all' ? LIVE.length : LIVE.filter(it => k === 'nobody' ? !it.owner : it.owner === k).length,
      av: k === 'all' ? 'display:none' : avatar(k === 'nobody' ? '' : k, 16).replace('font-size:10px', 'font-size:8px'),
      style: `height:28px;display:flex;align-items:center;gap:5px;padding:0 9px 0 ${k === 'all' ? 9 : 5}px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}`,
      pick: () => this.setState({ who: k }) }; });
    /* ---- capture: one ask, recorded properly ----
       The item is matched against what is already being sourced (add as
       another ask, never a duplicate) and what is already in stock (sell
       it instead). The client is picked from the shop's own records, so
       a regular is never typed twice. Sizes each carry their own count. */
    const CATALOG = AD.catalog.filter(c => c.stock > 0);
    const CLIENTS = AD.clients;
    const VARS = AD.vars;
    const kwVars = n => { n = n.toLowerCase();
      return /pipe/.test(n) ? ['20mm','25mm','32mm'] : /wire/.test(n) ? ['1kg','5kg','25kg'] : /disc/.test(n) ? ['7in','9in'] : /valve/.test(n) ? ['1in','1.5in','2in']
        : /spacer/.test(n) ? ['2mm','3mm','5mm'] : /nail/.test(n) ? ['2in','3in','4in'] : /bracket|hinge/.test(n) ? ['Small','Large'] : /paint|colour|color/.test(n) ? ['White','Grey','Black'] : []; };
    const UNITS = ['pcs','box','bundle','roll','kg','m','length','tin','pair','bag'];
    const normU = u => { u = String(u || '').toLowerCase(); return UNITS.includes(u) ? u : UNITS.includes(u.replace(/e?s$/, '')) ? u.replace(/e?s$/, '') : UNITS.includes(u.replace(/s$/, '')) ? u.replace(/s$/, '') : 'pcs'; };
    const PACKABLE = ['box','bundle','roll','bag'];
    const CH = [['c','Counter','#7A3268'],['w','WhatsApp','#1A5A8A'],['p','Phone','#5F6980'],['q','Search','#3A3F9B']];
    const WHEN = [['today','Today'],['week','This week'],['month','This month'],['any','No rush']];
    const q = (S.capItem || '').trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    const hit = name => words.length > 0 && words.every(w => name.toLowerCase().includes(w));
    const pick = S.capPick;
    const pickedFunnel = pick && pick.kind === 'funnel' ? ALL.find(it => it.rank === pick.rank) : null;
    const pickedStock = pick && pick.kind === 'stock' ? CATALOG.find(c => c.name === pick.name) : null;
    const pickName = pickedFunnel ? pickedFunnel.name : pickedStock ? pickedStock.name : pick ? pick.name : '';
    const BADGE = { funnel:['Sourcing','#3A3F9B','#E4E6FA'], stock:['In stock','#0F6B43','#E4F4EA'], new:['New item','#A82D24','#FDE8E4'] };
    const badge = k => `display:inline-flex;justify-content:center;font-size:10px;font-weight:700;border-radius:999px;padding:2px 6px;color:${BADGE[k][1]};background:${BADGE[k][2]};white-space:nowrap`;
    const capMatches = q.length < 2 ? [] : [
      ...LIVE.filter(it => hit(it.name)).slice(0, 3).map(it => ({ kind:'funnel', name: it.name, meta: `${COLT[it.stage]} · ${it.askers} asking · ${it.qty || 'qty not said'} — add as another ask`, rank: it.rank })),
      ...CATALOG.filter(c => hit(c.name)).slice(0, 2).map(c => ({ kind:'stock', name: c.name, meta: `${c.stock} ${c.unit} on the shelf — sell it instead` })),
      { kind:'new', name: S.capItem.trim(), meta: 'Nothing like it yet — start sourcing it' }
    ].map(m => ({ ...m, kindLabel: BADGE[m.kind][0], badge: badge(m.kind),
      pick: () => this.setState({ capPick: m.kind === 'funnel' ? { kind:'funnel', rank: m.rank } : { kind: m.kind, name: m.name }, capVars: [],
        capUnit: m.kind === 'funnel' ? normU((ALL.find(x => x.rank === m.rank).qty || '').split(' ')[1]) : S.capUnit }) }));
    const unit = S.capUnit;
    const varBase = pickedFunnel ? ((VARS[pickedFunnel.rank] || []).length ? VARS[pickedFunnel.rank] : kwVars(pickedFunnel.name)) : kwVars(pickName || S.capItem || '');
    const vars = S.capVars;
    const capVarSugg = [...varBase, ...vars.map(v => v.label).filter(l => !varBase.includes(l))].map(label => { const on = vars.some(v => v.label === label); return {
      label: (on ? '✓ ' : '') + label, pressed: on ? 'true' : 'false',
      style: `height:24px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}`,
      toggle: () => this.setState({ capVars: on ? vars.filter(v => v.label !== label) : [...vars, { label, qty: '' }] }) }; });
    const setVarQty = (i, v) => this.setState({ capVars: vars.map((x, j) => j === i ? { ...x, qty: String(Math.max(0, v)) } : x) });
    const capQtyRows = vars.length
      ? vars.map((v, i) => ({ label: v.label, aria: `How many ${v.label}`, value: v.qty, set: e => this.setState({ capVars: vars.map((x, j) => j === i ? { ...x, qty: e.target.value } : x) }),
          dec: () => setVarQty(i, num(v.qty) - 1), inc: () => setVarQty(i, num(v.qty) + 1) }))
      : [{ label: 'Quantity', aria: 'How many', value: S.capQty, set: e => this.setState({ capQty: e.target.value }),
          dec: () => this.setState({ capQty: String(Math.max(0, num(S.capQty) - 1)) }), inc: () => this.setState({ capQty: String(num(S.capQty) + 1) }) }];
    const capN = vars.length ? vars.reduce((a, v) => a + num(v.qty), 0) : num(S.capQty);
    const plural = (n, u) => `${n} ${u}${n === 1 || u === 'kg' || u === 'm' || u === 'pcs' ? '' : u === 'box' ? 'es' : 's'}`;
    const packN = PACKABLE.includes(unit) ? num(S.capPack) : 0;
    const client = CLIENTS.find(c => c.name === S.capClient) || (S.capClient ? { name: S.capClient, phone: S.capPhone || 'no phone', orders: 0, asks: 0, owes: 0, fresh: true } : null);
    const cq = (S.capClientQ || '').trim().toLowerCase();
    const clientList = (cq ? CLIENTS.filter(c => c.name.toLowerCase().includes(cq) || (c.phone && c.phone.replace(/\s/g, '').includes(cq.replace(/\s/g, '')))) : (CLIENTS.filter(c => c.regular).length ? CLIENTS.filter(c => c.regular) : CLIENTS)).slice(0, 4);
    const ini = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const avC = n => { const P = [['#E4E6FA','#3A3F9B'],['#DCEAF8','#1A5A8A'],['#F6E4F1','#7A3268'],['#E4F4EA','#0F6B43']]; const h = [...n].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 4; return P[h]; };
    const av = (n, sz) => { const c = avC(n); return `flex-shrink:0;width:${sz}px;height:${sz}px;border-radius:999px;background:${c[0]};color:${c[1]};font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center`; };
    const chipS = (bg, fg) => `font-size:10px;font-weight:600;border-radius:999px;padding:2px 7px;background:${bg};color:${fg};white-space:nowrap`;
    const ready = !!pickName && capN > 0;
    const repeatCap = pickedFunnel && client && !S.capWalkin && (pickedFunnel.askList || (DET[pickedFunnel.rank] ? DET[pickedFunnel.rank].askers : [])).some(x => { const n = y => y.toLowerCase().replace(/\b(ltd|limited|co)\b\.?/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); const a = n(x[0]), b = n(client.name); return a === b || a.startsWith(b) || b.startsWith(a); });
    const goLabel = pickedStock ? 'Sell it from stock instead' : pickedFunnel ? (repeatCap ? `Add to ${client.name.split(' ')[0]}’s existing ask` : `Add as ask #${pickedFunnel.askers + 1} on this item`) : 'Add to funnel';
    const asker = S.capWalkin ? 'A walk-in' : client ? client.name.split(' ')[0] : 'the client';
    const whenL = WHEN.find(w => w[0] === S.capWhen)[1].toLowerCase();
    const summary = !pickName ? 'Pick or type the item to start.' : pickedStock
      ? `${pickedStock.stock} ${pickedStock.unit} on the shelf now — quote ${asker} from stock, no sourcing needed.`
      : `${asker.charAt(0).toUpperCase() + asker.slice(1)} wants ${capN ? plural(capN, unit) : 'some'}${packN ? ` (${unit} of ${packN})` : ''}${vars.length ? ` in ${vars.length} ${vars.length === 1 ? 'size' : 'sizes'}` : ''} of ${pickName}, ${whenL}${S.capMax ? `, up to ${fmtN(num(S.capMax))} each` : ''}.${S.capFollow ? ' We’ll draft them a message when it’s in.' : ''}`;
    const resetCap = { capItem: '', capPick: null, capVars: [], capVarNew: '', capQty: '', capPack: '', capNote: '', capMax: '', capClient: null, capClientQ: '', capPhone: '', capWalkin: false, capFrom: null };
    const capSubmit = () => {
      if (!ready && !pickedStock) return;
      this._capExtra = { follow: !!S.capFollow && !S.capWalkin, maxPrice: num(S.capMax), when: S.capWhen, note: S.capNote, variant: vars.map(v => `${v.label}${num(v.qty) ? ' × ' + num(v.qty) : ''}`).join(', '), phone: S.capPhone || '' };
      const taken = S.capFrom ? [...S.taken, S.capFrom] : S.taken;
      if (pickedStock) { this.setState({ ...resetCap, taken, log: `${pickedStock.name}: ${pickedStock.stock} ${pickedStock.unit} in stock — quote ${asker} from stock` }); return; }
      const askRow = [S.capWalkin ? 'Walk-in' : client ? client.name : '—', capN, S.capChannel === 'p' ? 'c' : S.capChannel, 0];
      if (pickedFunnel) {
        const it = pickedFunnel, newQty = qtyN(it) + capN, u = (it.qty || '').split(' ')[1] || plural(2, unit).split(' ')[1];
        const prevAsks = it.askList || (DET[it.rank] ? DET[it.rank].askers : []);
        const nm = x => x.toLowerCase().replace(/\b(ltd|limited|co)\b\.?/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
        const again = !S.capWalkin && client && prevAsks.some(x => { const a = nm(x[0]), b = nm(client.name); return a === b || a.startsWith(b) || b.startsWith(a); });
        const list = again ? prevAsks.map(x => { const a = nm(x[0]), b = nm(client.name); return a === b || a.startsWith(b) || b.startsWith(a) ? [x[0], x[1] + capN, x[2], x[3]] : x; }) : [...prevAsks, askRow];
        const people = it.askers + (again ? 0 : 1);
        commit({ ...resetCap, taken, moved: { ...S.moved, [it.rank]: { ...(S.moved[it.rank] || {}), askers: people, qty: `${newQty} ${u}`, askList: list } } },
          again ? `${asker} already asked for ${it.name} — added ${capN} to their quantity (${newQty} ${u} in all)` : `${asker}’s ask added to ${it.name} — now ${people} people, ${newQty} ${u}`);
        return;
      }
      const rank = ITEMS.length + S.added.length + 1;
      const name = pickName.charAt(0).toUpperCase() + pickName.slice(1);
      const item = { rank, name, stage: 0, state: 'nobody', known: [0, 0, 0, 0], days: 0, limit: 2, askers: 1, wait: 0, qty: plural(capN, unit), cost: '', owner: '', move: 'Give it to someone', isNew: true,
        askList: [askRow], variants: vars.map(v => v.label), unit, pack: packN, when: S.capWhen, maxPrice: num(S.capMax), note: S.capNote };
      commit({ ...resetCap, taken, added: [...S.added, item] }, `${name} is in the funnel — ${plural(capN, unit)} for ${asker}${vars.length ? `, ${vars.length} sizes` : ''}`);
    };
    const capture = {
      capItem: S.capItem, setCapItem: e => this.setState({ capItem: e.target.value }),
      capNoPick: !pick, capHasPick: !!pick, capShowMatches: capMatches.length > 0, capMatches,
      capPickName: pickName, capPickKind: pick ? BADGE[pick.kind][0] : '', capPickBadge: pick ? badge(pick.kind) : '',
      capPickMeta: pickedFunnel ? `${COLT[pickedFunnel.stage]} · ${pickedFunnel.askers} already asking · ${pickedFunnel.owner || 'nobody on it'}` : pickedStock ? `${pickedStock.stock} ${pickedStock.unit} on the shelf` : 'New — goes into Asked for',
      capPickStyle: `display:flex;align-items:center;gap:8px;padding:8px 8px 8px 10px;border-radius:9px;border:1px solid ${pick ? BADGE[pick.kind][1] : '#E6E3DD'};background:#FFFFFF`,
      capUnpick: () => this.setState({ capPick: null, capVars: [] }),
      capUnits: UNITS.map(u => ({ label: u, pressed: u === unit ? 'true' : 'false', pick: () => this.setState({ capUnit: u }),
        style: `height:24px;padding:0 8px;border-radius:7px;font-size:11px;font-weight:600;border:1px solid ${u === unit ? '#1C2233' : '#E6E3DD'};background:${u === unit ? '#1C2233' : '#FFFFFF'};color:${u === unit ? '#FFFFFF' : '#1C2233'}` })),
      capPackable: PACKABLE.includes(unit), capPack: S.capPack, setCapPack: e => this.setState({ capPack: e.target.value }),
      capVarSugg, capVarNew: S.capVarNew, setCapVarNew: e => this.setState({ capVarNew: e.target.value }),
      capAddVar: () => { const l = (S.capVarNew || '').trim(); if (!l || vars.some(v => v.label === l)) return; this.setState({ capVars: [...vars, { label: l, qty: '' }], capVarNew: '' }); },
      capNote: S.capNote, setCapNote: e => this.setState({ capNote: e.target.value }),
      capChannels: CH.map(([k, label, col]) => { const on = S.capChannel === k; return { label, pressed: on ? 'true' : 'false', pick: () => this.setState({ capChannel: k }),
        dot: `width:6px;height:6px;border-radius:999px;background:${on ? '#FFFFFF' : col}`,
        style: `height:30px;border:0;border-left:1px solid #EFECE6;display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;font-weight:600;background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}` }; }),
      capHasClient: !!client || S.capWalkin, capNoClient: !client && !S.capWalkin,
      capClientName: S.capWalkin ? 'Walk-in' : client ? client.name : '', capClientPhone: S.capWalkin ? 'no name kept — can’t tell them when it’s in' : client ? client.phone : '',
      capClientIni: S.capWalkin ? '?' : client ? ini(client.name) : '', capClientAv: S.capWalkin ? 'flex-shrink:0;width:30px;height:30px;border-radius:999px;border:1px dashed #767F91;box-sizing:border-box;color:#767F91;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center' : client ? av(client.name, 30) : '',
      capClientFacts: S.capWalkin || !client ? [] : client.fresh ? [{ label: 'New client — saved with this ask', style: chipS('#FDE8E4', '#A82D24') }] : [
        { label: `${client.orders} orders`, style: chipS('#EFECE6', '#5F6980') },
        ...(client.asks ? [{ label: `asked for ${client.asks} other ${client.asks === 1 ? 'item' : 'items'}`, style: chipS('#E4E6FA', '#3A3F9B') }] : []),
        ...(client.owes ? [{ label: `owes ${short(client.owes)}`, style: chipS('#FDEEE1', '#7A4A02') }] : []),
        ...(client.regular ? [{ label: 'regular', style: chipS('#E4F4EA', '#0F6B43') }] : []) ],
      capClearClient: () => this.setState({ capClient: null, capWalkin: false, capClientQ: '', capPhone: '' }),
      capClientQ: S.capClientQ, setCapClientQ: e => this.setState({ capClientQ: e.target.value }),
      capClientHead: cq ? (clientList.length ? 'Your clients' : 'Not in your clients yet') : 'Regulars — one tap',
      capClientList: clientList.map(c => ({ name: c.name, ini: ini(c.name), av: av(c.name, 20), tag: c.regular ? `${c.orders} orders` : 'new-ish',
        tagStyle: 'font-size:10px;color:#767F91;white-space:nowrap', pick: () => this.setState({ capClient: c.name, capClientQ: '', capWalkin: false }) })),
      capCanNew: cq.length > 1 && !CLIENTS.some(c => c.name.toLowerCase() === cq), capPhone: S.capPhone, setCapPhone: e => this.setState({ capPhone: e.target.value }),
      capNewClient: () => { const n = (S.capClientQ || '').trim(); if (!n) return; this.setState({ capClient: n.replace(/\b\w/g, ch => ch.toUpperCase()), capClientQ: '' }); },
      capWalkIn: () => this.setState({ capWalkin: true, capFollow: false }),
      capQtyRows, capUnitLabel: unit,
      capTotal: vars.length ? `Total ${plural(capN, unit)} across ${vars.length} ${vars.length === 1 ? 'size' : 'sizes'}` : packN && capN ? `${plural(capN, unit)} = ${fmtN(capN * packN)} units` : '',
      capTotalStyle: `font-size:11px;font-weight:600;color:${capN ? '#1C2233' : '#767F91'}`,
      capWhens: WHEN.map(([k, label]) => { const on = S.capWhen === k; return { label, pressed: on ? 'true' : 'false', pick: () => this.setState({ capWhen: k }),
        style: `height:28px;border-radius:7px;font-size:11px;font-weight:600;border:1px solid ${on ? (k === 'today' ? '#8E2A22' : '#1C2233') : '#E6E3DD'};background:${on ? (k === 'today' ? '#8E2A22' : '#1C2233') : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}` }; }),
      capMax: S.capMax, setCapMax: e => this.setState({ capMax: e.target.value }),
      capFollowPressed: S.capFollow ? 'true' : 'false', capToggleFollow: () => this.setState({ capFollow: !S.capFollow }),
      capFollowLabel: S.capFollow ? '✓ Tell them when in' : 'Tell them when in',
      capFollowStyle: `height:30px;padding:0 9px;border-radius:9px;font-size:11px;font-weight:600;white-space:nowrap;border:1px solid ${S.capFollow ? '#0F6B43' : '#E6E3DD'};background:${S.capFollow ? '#E4F4EA' : '#FFFFFF'};color:${S.capFollow ? '#0F6B43' : '#5F6980'}`,
      capGoOff: !(ready || pickedStock), capSubmit, capGoLabel: goLabel, capSummary: summary,
      capGoStyle: `flex-shrink:0;min-width:220px;padding:0 16px;height:36px;border-radius:9px;font-size:13px;font-weight:700;border:1px solid ${ready || pickedStock ? (pickedStock ? '#0F6B43' : '#C93A30') : '#E6E3DD'};background:${ready || pickedStock ? (pickedStock ? '#0F6B43' : '#C93A30') : '#F7F5F2'};color:${ready || pickedStock ? '#FFFFFF' : '#767F91'};cursor:${ready || pickedStock ? 'pointer' : 'not-allowed'}`
    };
    /* ---- today's checklist: what to go and find, and what it no longer trusts — same evidence rules as the verdict ---- */
    const cl = (() => {
      const TY = { rival: ['Competitors', '#7A3268', '#F6E4F1'], quote: ['Suppliers', '#1A5A8A', '#DCEAF8'], buyer: ['Buyers', '#3A3F9B', '#E4E6FA'], decide: ['Decisions', '#0F6B43', '#E4F4EA'], team: ['Team', '#5F6980', '#EFECE6'] };
      const DUE = { over: ['Overdue', '#8E2A22', '#FBE5E2', 0], today: ['Today', '#95530C', '#FDEEE1', 1], week: ['This week', '#5F6980', '#EFECE6', 2] };
      const TYO = Object.keys(TY);
      const openIt = (rank, tab) => this.setState({ task: rank, mTab: tab, holdMode: null, actPage: 0, renaming: null, addAsk: false, mergeOpen: false, hint: null, taskSups: [], taskPrices: {}, taskQS: '', taskTerms: {}, taskTiers: {}, taskOpenSup: null, taskPacks: {}, taskTrans: {}, taskSup: '', taskMin: '', taskShelf: '', dropAsk: false });
      const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
      const supOf = n => SUPS_ALL.find(x => x.name === n) || {};
      const cliOf = n => { const k = String(n).toLowerCase().split(/[^a-z]+/)[0]; return CLIENTS.find(c => c.name.toLowerCase().split(/[^a-z]+/)[0] === k) || {}; };
      const unitOf = it => (String(it.qty || '').split(' ').slice(1).join(' ')) || (DET[it.rank] && DET[it.rank].unit) || 'pcs';
      const CHN = { q: 'search', w: 'WhatsApp', c: 'the counter', p: 'phone' };
      const gone = S.clGone || {};
      const fixR = (rank, name, v) => ({ rivalsFix: { ...(S.rivalsFix || {}), [rank]: { ...((S.rivalsFix || {})[rank] || {}), [name]: { ...(((S.rivalsFix || {})[rank] || {})[name] || {}), ...v, days: 0 } } } });
      const settle = (row, patch, text) => this.setState({ ...patch, clGone: { ...gone, [row.id]: { title: row.title, type: row.type, detail: text, item: row.item } }, clEdit: null, clVal: '', log: text });
      const pool = ALL.filter(it => !S.dropped.includes(it.rank) && !S.snoozed.includes(it.rank));
      const live = pool.filter(it => it.stage < 4);
      const out = [];
      const ageEv = (age, valid) => ({ kind: 'age', age, valid, text: `${age}d / ${valid}d`, title: age > valid ? `Expired ${age - valid}d ago — it no longer counts toward confidence` : `Expires in ${valid - age}d` });
      const dotEv = (have, need) => ({ kind: 'dots', have, need, text: `${have} of ${need}`, title: `${have} of the ${need} the verdict needs to be confident` });
      live.forEach(it => {
        /* competitor prices: fresh for 14 days, then re-confirm */
        const rs = rivalsOf(it);
        rs.forEach(r => { const left = FRESH.rival - r.days; if (left > 3) return;
          const row = { id: `r:${it.rank}:${r.name}`, type: 'rival', rank: it.rank, item: it.name, due: left < 0 ? 'over' : left <= 1 ? 'today' : 'week', confirm: left < 0,
            title: left < 0 ? `Is ${r.name} still at ${fmtN(r.price)}?` : `Re-check ${r.name} before it expires`,
            detail: `${it.name} · ${r.area} · ${r.stock.toLowerCase()} · checked ${r.days}d ago by ${r.how}`,
            who: r.name, area: r.area, contact: `${r.area} · ${r.how}`, last: `${fmtN(r.price)} · ${r.stock}`, checked: `${r.days}d ago`, ev: ageEv(r.days, FRESH.rival), editLabel: 'Their price', old: r.price,
            ask: `Still ${fmtN(r.price)}? In stock?`, sim: { rival: r.name }, how: r.how === 'visit' ? 'visit' : 'phone', sets: r.stock !== 'Out of stock' && r.price === recPriceInfo(it).rivalRef ? 'Sets your price' : '' };
          row.acts = [
            { kind: 'yes', label: 'Still true', hint: 'Same price today — resets the clock', go: () => settle(row, fixR(it.rank, r.name, {}), `${r.name} still sells ${it.name} at ${fmtN(r.price)} — re-confirmed`) },
            { kind: 'edit', label: 'New price', hint: 'Type what they charge now', go: () => this.setState({ clEdit: row.id, clVal: '' }) },
            { kind: 'no', label: 'Out now', hint: 'They no longer have it', go: () => settle(row, fixR(it.rank, r.name, { stock: 'Out of stock' }), `${r.name} is out of ${it.name}`) } ];
          row.save = () => { const v = num(S.clVal); if (!v) return; settle(row, fixR(it.rank, r.name, { price: v }), `${r.name} now sells ${it.name} at ${fmtN(v)} (was ${fmtN(r.price)})`); };
          out.push(row); });
        if (it.stage >= 1 && rs.length < 3) { const have = rs.map(r => `${r.name.split(' ')[0]} ${short(r.price)}`);
          const areas = (AD.areas.length ? AD.areas : ['Kikuubo','Nakivubo','Ntinda']).filter(a => !rs.some(r => r.area === a)).slice(0, 3);
          const row = { id: `mr:${it.rank}`, type: 'rival', rank: it.rank, item: it.name, due: it.stage >= 2 ? 'today' : 'week',
            title: `Find ${plural(3 - rs.length, 'more competitor price', 'more competitor prices')}`,
            detail: `${it.name} · ${have.length ? 'have ' + have.join(', ') : 'none yet'} · try ${areas.join(', ')}`,
            who: `Shops in ${areas.join(', ')}`, areas: areas.join(', '), contact: '', last: have.join(', ') || '—', checked: '', ev: dotEv(rs.length, 3), sim: { addRival: 1 }, how: 'visit' };
          row.acts = [{ kind: 'open', label: 'Add price', hint: 'Open Competitors', go: () => openIt(it.rank, 'rivals') }];
          out.push(row); }
        /* supplier quotes: valid for the agreed days (7 unless set), then re-confirm */
        const pr = pricesOf(it), names = Object.keys(pr);
        if (it.stage >= 2) names.forEach(n => { const age = quoteAgeOf(it, n), valid = quoteValidOf(n), left = valid - age; if (left > 2) return; const sp = supOf(n);
          const row = { id: `q:${it.rank}:${n}`, type: 'quote', rank: it.rank, item: it.name, due: left < 0 ? 'over' : left <= 1 ? 'today' : 'week', confirm: left < 0,
            title: left < 0 ? `Is ${n} still at ${fmtN(pr[n])}?` : `Lock in ${n}’s price before it lapses`,
            detail: `${it.name} · quoted ${age}d ago, valid ${valid}d${sp.phone ? ' · ' + sp.phone : ''}`,
            who: n, contact: [sp.phone, sp.loc].filter(Boolean).join(' · '), last: `${fmtN(pr[n])} a ${unitOf(it).replace(/s$/, '')}`, checked: `${age}d ago`, ev: ageEv(age, valid), editLabel: 'Their price', old: pr[n],
            ask: `Still ${fmtN(pr[n])} a ${unitOf(it).replace(/s$/, '')}? Valid how long?`, sim: { quote: n }, how: 'phone', phone: sp.phone, sets: pr[n] === costOf(it) ? 'Your cost' : '' };
          row.acts = [
            { kind: 'yes', label: 'Still valid', hint: 'Same price — resets the clock', go: () => settle(row, { quoteFix: { ...(S.quoteFix || {}), [it.rank]: { ...((S.quoteFix || {})[it.rank] || {}), [n]: 0 } } }, `${n} confirmed ${fmtN(pr[n])} for ${it.name}`) },
            { kind: 'edit', label: 'New price', hint: 'Type their new price', go: () => this.setState({ clEdit: row.id, clVal: '' }) },
            { kind: 'no', label: 'Can’t supply', hint: 'Remove their quote', go: () => { const p2 = { ...pr }; delete p2[n]; apply(it, { prices: p2, suppliers: supsOf(it).filter(x => x !== n) }, `${n} can no longer supply ${it.name}`); settle(row, {}, `${n} can no longer supply ${it.name}`); } } ];
          row.save = () => { const v = num(S.clVal); if (!v) return; apply(it, { prices: { ...pr, [n]: v } }, `${n}: ${it.name} now ${fmtN(v)} (was ${fmtN(pr[n])})`); settle(row, { quoteFix: { ...(S.quoteFix || {}), [it.rank]: { ...((S.quoteFix || {})[it.rank] || {}), [n]: 0 } } }, `${n}: ${it.name} now ${fmtN(v)}`); };
          out.push(row); });
        if (it.stage >= 1 && names.length < 3) {
          const ask = [...supsOf(it).filter(n => !(n in pr)), ...SUPS_ALL.filter(sp => AD.supHits(sp, it.name).length && !supsOf(it).includes(sp.name)).sort((a, b) => b.orders - a.orders).map(sp => sp.name)].slice(0, 3 - names.length);
          const row = { id: `mq:${it.rank}`, type: 'quote', rank: it.rank, item: it.name, due: it.stage === 2 && !names.length ? 'today' : 'week',
            title: `Get ${plural(3 - names.length, 'more supplier quote', 'more supplier quotes')}`,
            detail: `${it.name} · ${ask.length ? 'call ' + ask.map(n => `${n}${supOf(n).phone ? ' ' + supOf(n).phone : ''}`).join(', ') : 'nobody likely yet — ask around'}`,
            who: ask.join(', ') || 'Ask around', contact: ask.map(n => supOf(n).phone).filter(Boolean).join(', '), last: names.map(n => `${n.split(' ')[0]} ${fmtN(pr[n])}`).join(', ') || '—', checked: '', ev: dotEv(names.length, 3), calls: ask.map(n => ({ who: n, phone: supOf(n).phone || '' })), sim: { addQuote: 1 }, how: ask.length ? 'phone' : 'desk', phone: ask.length ? supOf(ask[0]).phone : '' };
          row.acts = [{ kind: 'open', label: 'Add quote', hint: 'Open Suppliers', go: () => openIt(it.rank, names.length ? 'suppliers' : 'overview') }];
          out.push(row); }
        /* buyers: an ask older than 14 days needs a yes before it counts */
        if (it.stage >= 1) { const asks = askersOf(it);
          asks.forEach(a => { if (a[3] <= FRESH.buyer) return; const c = cliOf(a[0]), u = unitOf(it);
            const row = { id: `b:${it.rank}:${a[0]}`, type: 'buyer', rank: it.rank, item: it.name, due: 'over', confirm: true,
              title: `Does ${a[0]} still want ${a[1]} ${u}?`, detail: `${it.name} · asked ${a[3]}d ago via ${CHN[a[2]] || 'phone'}${c.phone ? ' · ' + c.phone : ''}`,
              who: a[0], contact: c.phone || '', last: `${a[1]} ${u}`, checked: `${a[3]}d ago`, ev: ageEv(a[3], FRESH.buyer), editLabel: 'How many now', old: a[1],
              ask: `Still want ${a[1]} ${u}? By when?`, sim: { buyer: a[0] }, how: 'phone', phone: c.phone || '', sets: asks.length > 1 && a[1] === Math.max(...asks.map(x => x[1])) ? 'Biggest order' : '' };
            const fixB = v => ({ buyerFix: { ...(S.buyerFix || {}), [it.rank]: { ...((S.buyerFix || {})[it.rank] || {}), [a[0]]: v } } });
            row.acts = [
              { kind: 'yes', label: 'Still wants', hint: 'Same quantity — resets the clock', go: () => settle(row, fixB({ days: 0 }), `${a[0]} still wants ${a[1]} ${u} of ${it.name}`) },
              { kind: 'edit', label: 'New qty', hint: 'Type the quantity they want now', go: () => this.setState({ clEdit: row.id, clVal: '' }) },
              { kind: 'no', label: 'Dropped out', hint: 'No longer wants it', go: () => { apply(it, { askers: Math.max(0, it.askers - 1) }, `${a[0]} no longer wants ${it.name}`); settle(row, fixB({ gone: true }), `${a[0]} no longer wants ${it.name}`); } } ];
            row.save = () => { const v = num(S.clVal); if (!v) return; settle(row, fixB({ qty: v, days: 0 }), `${a[0]} now wants ${v} ${u} of ${it.name} (was ${a[1]})`); };
            out.push(row); });
          if (it.stage >= 2 && it.askers < 5) { const regs = CLIENTS.filter(c => c.regular && !asks.some(a => cliOf(a[0]).name === c.name)).sort((a, b) => b.orders - a.orders).slice(0, 2);
            const row = { id: `mb:${it.rank}`, type: 'buyer', rank: it.rank, item: it.name, due: 'week',
              title: `Find ${plural(5 - it.askers, 'more buyer', 'more buyers')}`, detail: `${it.name} · ask regulars ${regs.map(c => `${c.name} ${c.phone}`).join(', ')}`,
              who: regs.map(c => c.name).join(', '), contact: regs.map(c => c.phone).join(', '), last: `${plural(it.askers, 'buyer', 'buyers')} · ${it.qty}`, checked: '', ev: dotEv(it.askers, 5), calls: regs.map(c => ({ who: c.name, phone: c.phone })), sim: { addBuyer: 1 }, how: 'phone', phone: regs.length ? regs[0].phone : '' };
            row.acts = [{ kind: 'open', label: 'Add buyer', hint: 'Open Who’s waiting', go: () => openIt(it.rank, 'demand') }];
            out.push(row); } }
        /* team and decisions */
        if (it.stage <= 1 && !it.owner) { const row = { id: `as:${it.rank}`, type: 'team', rank: it.rank, item: it.name, due: 'today', title: `Give ${it.name} to someone`,
            detail: `${plural(it.askers, 'person', 'people')} waiting · first asked ${it.wait}d ago`, who: '', contact: '', how: 'desk', last: 'nobody on it', checked: '', ev: { kind: 'text', text: `${it.askers} waiting`, title: '' } };
          row.acts = STAFF.map(s => ({ kind: 'staff', label: s, hint: `Give it to ${s}`, go: () => { apply(it, { owner: s }, `${it.name} is now ${s}’s`); settle(row, {}, `${it.name} → ${s}`); } }));
          out.push(row); }
        else if (it.days > it.limit) { const row = { id: `ot:${it.rank}`, type: 'team', rank: it.rank, item: it.name, due: 'over', title: `${it.name} is ${it.days - it.limit}d over in ${COLT[it.stage]}`,
            detail: `${it.owner || 'Nobody'} · step limit ${it.limit}d · ${it.move}`, who: it.owner || '', contact: '', how: 'desk', last: `${it.days}d in step`, checked: '', ev: ageEv(it.days, it.limit) };
          row.acts = [{ kind: 'open', label: 'Open', hint: 'Push it on or drop it', go: () => openIt(it.rank, 'overview') }];
          out.push(row); }
        if (it.stage === 3) { const row = { id: `dc:${it.rank}`, type: 'decide', rank: it.rank, item: it.name, due: 'today', title: `Decide on ${it.name}`,
            detail: `Priced · ${plural(it.askers, 'person', 'people')} waiting ${it.wait}d · the verdict is ready`, who: '', contact: '', how: 'desk', last: `best cost ${fmtN(costOf(it))}`, checked: '', ev: { kind: 'text', text: `${it.wait}d waiting`, title: '' } };
          row.acts = [{ kind: 'open', label: 'Open verdict', hint: 'See the verdict and the plan', go: () => openIt(it.rank, 'verdict') }];
          out.push(row); }
      });
      pool.filter(it => it.stage === 4 && !S.told.includes(it.rank)).forEach(it => { const row = { id: `tl:${it.rank}`, type: 'buyer', rank: it.rank, item: it.name, due: 'today',
          title: `Tell ${plural(it.askers, 'person', 'people')} ${it.name} is in`, detail: `On the shelf${it.shelf ? ' at ' + fmtN(it.shelf) : ''} · they asked ${it.wait}d ago`, who: askersOf(it).map(a => a[0]).join(', '), contact: '', how: 'phone', last: 'on the shelf', checked: '', ev: { kind: 'text', text: `${it.askers} waiting`, title: '' } };
        row.acts = [{ kind: 'yes', label: 'Mark told', hint: 'Drafts are in Who’s waiting', go: () => { commit({ told: [...S.told, it.rank] }, `Everyone waiting on ${it.name} has been told`); settle(row, {}, `Told everyone about ${it.name}`); } }];
        out.push(row); });
      /* what each answer is worth: how far it moves the verdict's confidence */
      const base = {};
      out.forEach(r => { const it = ALL.find(x => x.rank === r.rank); if (!it || !r.sim) { r.gain = 0; return; }
        if (base[r.rank] == null) base[r.rank] = confOf(it).conf;
        const to = confOf(it, r.sim).conf; r.gain = Math.max(0, to - base[r.rank]); r.gainWhy = `Confidence in the verdict on ${it.name}: ${base[r.rank]}% → ${to}%`; });
      const doneIds = S.clDone || [];
      const open = out.filter(r => !doneIds.includes(r.id));
      const done = [...out.filter(r => doneIds.includes(r.id)), ...Object.keys(gone).filter(id => !out.some(r => r.id === id)).map(id => ({ id, type: gone[id].type, title: gone[id].title, detail: gone[id].detail, item: gone[id].item, due: 'done', settled: true, acts: [], ev: { kind: 'text', text: 'done', title: '' } }))];
      const ft = S.clType || 'all', fd = S.clDue || 'all', gm = S.clGroup || 'due';
      const HOW = { visit: ['Out visiting', '#7A3268', '#F6E4F1', 0], phone: ['On the phone', '#1A5A8A', '#DCEAF8', 1], desk: ['At the desk', '#5F6980', '#EFECE6', 2] };
      const byType = r => ft === 'all' || r.type === ft;
      const byDue = (a, b) => DUE[a.due][3] - DUE[b.due][3] || (b.confirm ? 1 : 0) - (a.confirm ? 1 : 0) || (b.sets ? 1 : 0) - (a.sets ? 1 : 0) || b.gain - a.gain || TYO.indexOf(a.type) - TYO.indexOf(b.type) || a.rank - b.rank;
      const sortR = (a, b) => gm === 'how' ? HOW[a.how || 'desk'][3] - HOW[b.how || 'desk'][3] || byDue(a, b) : gm === 'item' ? a.rank - b.rank || byDue(a, b) : byDue(a, b);
      const openF = fd === 'done' ? [] : open.filter(byType).filter(r => fd === 'all' || r.due === fd).sort(sortR);
      const doneF = done.filter(byType);
      const list = fd === 'done' || fd === 'all' ? [...openF, ...doneF] : openF;
      const PER = 8, pc = Math.max(1, Math.ceil(list.length / PER)), pg = Math.min(S.clPage || 0, pc - 1);
      const shown = list.slice(pg * PER, pg * PER + PER);
      const gk = r => r.settled || doneIds.includes(r.id) ? 'done' : gm === 'how' ? r.how || 'desk' : gm === 'item' ? 'i' + r.rank : r.due;
      const GL = { ...DUE, ...HOW, ...Object.fromEntries(pool.map(it => ['i' + it.rank, [it.name, '#1C2233', '#EFECE6']])), done: ['Done today', '#0F6B43', '#E4F4EA'] };
      const cnt = k => k === 'done' ? doneF.length : openF.filter(r => gk(r) === k).length;
      /* priority: not every task matters equally — overdue, number-setting and verdict-moving work comes first */
      const PR = { 1: ['Must', '●●●'], 2: ['Should', '●●○'], 3: ['If time', '●○○'] };
      const scoreOf = r => (r.due === 'over' ? 40 : r.due === 'today' ? 25 : 10) + (r.sets ? 20 : 0) + Math.min(30, r.gain || 0) + (r.confirm ? 5 : 0) + (r.type === 'decide' ? 15 : 0) + Math.min(10, (ALL.find(x => x.rank === r.rank) || {}).askers || 0);
      const pOf = r => { const sc = scoreOf(r); return sc >= 55 ? 1 : sc >= 35 ? 2 : 3; };
      const GRID = '22px minmax(0,1.75fr) minmax(0,1fr) minmax(0,1.05fr) 108px 88px 104px 176px';
      const rowsV = shown.map((r, i) => { const isDone = gk(r) === 'done', g = GL[gk(r)], ty = TY[r.type] || TY.team, e = r.ev || {};
        const ageCol = e.kind === 'age' ? (e.age > e.valid ? '#8E2A22' : e.valid - e.age <= 3 ? '#95530C' : '#0F6B43') : '#5F6980';
        return { id: r.id, head: i === 0 || gk(shown[i - 1]) !== gk(r), headLabel: g[0], headCount: cnt(gk(r)),
          headStyle: `display:flex;align-items:center;height:26px;padding:0 16px;background:#FCFBF9;border-bottom:1px solid #EFECE6;font-size:11px;font-weight:700;color:${g[1]}`,
          headDot: `width:7px;height:7px;border-radius:999px;background:${g[1]}`,
          style: `display:grid;grid-template-columns:${GRID};gap:10px;align-items:center;min-height:50px;padding:6px 16px;box-sizing:border-box;border-bottom:1px solid #EFECE6;${r.confirm && !isDone ? 'box-shadow:inset 3px 0 0 #8E2A22;' : ''}${isDone ? 'opacity:.55;' : ''}`,
          done: isDone ? 'true' : 'false', tickMark: isDone ? '✓' : '',
          box: `width:18px;height:18px;padding:0;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;${isDone ? 'border:1px solid #0F6B43;background:#0F6B43;color:#FFFFFF' : (r.confirm ? 'border:1.5px solid #8E2A22;background:#FFFFFF;color:#FFFFFF' : 'border:1.5px solid #CFCAC1;background:#FFFFFF;color:#FFFFFF')}`,
          tickHint: isDone ? 'Done' : r.confirm ? `Tick = ${((r.acts || []).find(a => a.kind === 'yes') || {}).label || 'done'} (confirms it and resets the clock)` : 'Mark done',
          tick: () => { if (r.settled) return; const yes = !isDone && r.confirm && (r.acts || []).find(a => a.kind === 'yes'); if (yes) { yes.go(); return; } this.setState({ clDone: doneIds.includes(r.id) ? doneIds.filter(x => x !== r.id) : [...doneIds, r.id] }); },
          typeLabel: ty[0], typeStyle: `flex-shrink:0;font-size:10px;font-weight:700;padding:0 6px;border-radius:4px;line-height:16px;background:${ty[2]};color:${ty[1]}`,
          item: r.item || '', detailShort: String(r.detail || '').replace((r.item || '\u0000') + ' · ', '').replace(r.phone ? ' · ' + r.phone : '\u0000', ''), whoLabel: r.who || '—', contactLine: r.phone || r.contact || '', last: r.last || '',
          confirm: !!r.confirm && !isDone, title: r.title, titleStyle: `font-size:13px;font-weight:600;color:#1C2233;${isDone ? 'text-decoration:line-through;' : ''}`, detail: r.detail,
          isAge: e.kind === 'age' && !isDone, isDots: e.kind === 'dots' && !isDone, evTitle: e.title || '',
          ageBar: `position:absolute;left:0;top:0;bottom:0;border-radius:3px;width:${e.kind === 'age' ? Math.min(100, Math.round(e.age / e.valid * 100)) : 0}%;background:${ageCol}`,
          dots: e.kind === 'dots' ? Array.from({ length: e.need }, (_, j) => ({ style: `width:7px;height:7px;border-radius:999px;${j < e.have ? `background:${ty[1]}` : 'border:1.5px solid #CFCAC1;box-sizing:border-box'}` })) : [],
          evText: e.text || '', evTextStyle: `font-size:11px;font-weight:600;color:${e.kind === 'age' ? ageCol : '#5F6980'}`,
          pDots: isDone ? '' : PR[pOf(r)][1], pTitle: isDone ? '' : `Priority: ${PR[pOf(r)][0]}`, pStyle: `font-size:9px;letter-spacing:1px;color:${isDone ? '#767F91' : ['', '#8E2A22', '#95530C', '#767F91'][pOf(r)]}`,
          dueLabel: isDone ? 'Done' : DUE[r.due][0], dueStyle: `display:inline-flex;height:20px;align-items:center;padding:0 8px;border-radius:999px;font-size:11px;font-weight:700;background:${g[2]};color:${g[1]}`,
          tags: isDone ? [] : [...(r.sets ? [{ label: r.sets, title: 'This number drives the recommendation', style: 'flex-shrink:0;font-size:10px;font-weight:700;padding:0 6px;border-radius:999px;line-height:16px;background:#E4E6FA;color:#3A3F9B' }] : []),
            ...(r.gain ? [{ label: `+${r.gain}% sure`, title: r.gainWhy, style: 'flex-shrink:0;font-size:10px;font-weight:700;padding:0 6px;border-radius:999px;line-height:16px;background:#E4F4EA;color:#0F6B43' }] : [])],
          contacts: isDone || !r.phone ? [] : (() => { const d = String(r.phone).replace(/[^0-9]/g, ''); const intl = d.startsWith('0') ? '256' + d.slice(1) : d;
            const cs = 'width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;text-decoration:none;';
            return [{ href: `tel:+${intl}`, call: true, wa: false, label: `Call ${r.who.split(',')[0]} · ${r.phone}`, style: cs + 'border:1px solid #DCEAF8;background:#DCEAF8;color:#1A5A8A' },
              { href: `https://wa.me/${intl}`, call: false, wa: true, label: `WhatsApp ${r.who.split(',')[0]}`, style: cs + 'border:1px solid #E4F4EA;background:#E4F4EA;color:#0F6B43' }]; })(),
          was: r.old != null ? `was ${fmtN(r.old)}` : '',
          ...(() => { const v = num(S.clVal); if (S.clEdit !== r.id || !v || r.old == null) return { hasDelta: false, delta: '', deltaStyle: '' };
            const p = Math.round((v - r.old) / r.old * 100), up = v > r.old;
            return { hasDelta: true, delta: v === r.old ? 'same' : `${up ? '▲' : '▼'} ${Math.abs(p)}%`, deltaStyle: `font-size:11px;font-weight:700;color:${v === r.old ? '#5F6980' : r.type === 'rival' ? (up ? '#0F6B43' : '#8E2A22') : r.type === 'quote' ? (up ? '#8E2A22' : '#0F6B43') : (up ? '#0F6B43' : '#8E2A22')}` }; })(),
          editing: S.clEdit === r.id && !isDone, notEditing: !(S.clEdit === r.id) || isDone, editLabel: r.editLabel || '', save: r.save || (() => {}),
          ...(() => { const A = isDone ? [] : (r.acts || []), pri = A.find(a => a.kind === 'yes' || a.kind === 'open'), sec = A.filter(a => a.kind === 'edit' || a.kind === 'no'), st = A.filter(a => a.kind === 'staff');
            return { primary: pri ? [{ ...pri, isYes: pri.kind === 'yes', isOpen: pri.kind === 'open',
                style: `width:100%;height:28px;padding:0 8px;border-radius:7px;font-size:11px;font-weight:700;white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:5px;${pri.kind === 'yes' ? 'border:1px solid #0F6B43;background:#FFFFFF;color:#0F6B43' : 'border:1px solid #1C2233;background:#FFFFFF;color:#1C2233'}` }] : [],
              second: sec.map((a, j) => ({ ...a, isEdit: a.kind === 'edit', isNo: a.kind === 'no',
                style: `width:28px;height:26px;padding:0;border:0;${j ? 'border-left:1px solid #E6E3DD;' : ''}background:#FFFFFF;color:${a.kind === 'no' ? '#8E2A22' : '#1C2233'};display:flex;align-items:center;justify-content:center` })),
              secGroup: sec.length ? 'display:flex;border:1px solid #E6E3DD;border-radius:7px;overflow:hidden;height:28px;box-sizing:border-box' : 'display:none',
              staff: st.map(a => ({ ...a, ini: String(a.label)[0], style: 'width:28px;height:28px;padding:0;border-radius:999px;border:1px solid #16203C;background:#FFFFFF;color:#16203C;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center' })) }; })(),
          acts: isDone ? [] : (r.acts || []).map(a => { const k = a.kind || 'open';
            const look = { yes: 'border:1px solid #0F6B43;background:#FFFFFF;color:#0F6B43;font-weight:700', edit: 'border:1px solid #E6E3DD;background:#FFFFFF;color:#1C2233;font-weight:600',
              no: 'border:1px solid #E6E3DD;background:#FFFFFF;color:#8E2A22;font-weight:600', open: 'border:1px solid #1C2233;background:#FFFFFF;color:#1C2233;font-weight:700', staff: 'border:1px solid #E6E3DD;background:#FFFFFF;color:#1C2233;font-weight:600' }[k];
            const icon = (k === 'edit' || k === 'no') && (r.acts || []).length > 2;
            return { ...a, text: icon ? '' : a.label, isYes: k === 'yes', isEdit: k === 'edit', isNo: k === 'no', isOpen: k === 'open', isStaff: k === 'staff', ini: String(a.label)[0],
              av: 'width:16px;height:16px;border-radius:999px;background:#16203C;color:#FFFFFF;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center',
              style: `height:26px;${icon ? 'width:26px;padding:0;justify-content:center;' : 'padding:0 8px 0 6px;'}border-radius:7px;font-size:11px;white-space:nowrap;display:flex;align-items:center;gap:4px;${look}` }; }) }; });
      const allOpen = open.filter(byType);
      const tot = allOpen.length + doneF.length;
      const now = new Date(), iso = now.toISOString().slice(0, 10);
      const dateL = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      const wsSrc = fd === 'done' ? open.filter(byType).sort(sortR) : openF;
      const E = [];
      wsSrc.forEach(r => { const sc = scoreOf(r), p = pOf(r), b = { p, sc, item: r.item || '', due: DUE[r.due][0], last: r.last || '' };
        const desk = () => E.push({ ...b, how: 'desk', who: 'You', contact: '', ask: r.title });
        if (r.type === 'team' || r.type === 'decide' || r.id.startsWith('tl:')) return desk();
        if (r.calls) { if (!r.calls.length) return desk();
          const isQ = r.id.startsWith('mq:');
          r.calls.forEach(c => E.push({ ...b, how: 'call', who: c.who, contact: c.phone, ask: isQ ? 'Price? Breaks for bigger orders?' : 'Would you buy it? How many?', last: isQ ? (b.last === '—' ? 'no quote yet' : 'others: ' + b.last) : '' }));
          return; }
        if (r.id.startsWith('mr:')) return E.push({ ...b, how: 'visit', area: 'Shops you haven’t checked', who: 'Any hardware shop', contact: 'try ' + r.areas, ask: 'Price? In stock?' });
        if (r.id.startsWith('r:') && r.how === 'visit') return E.push({ ...b, how: 'visit', area: r.area, who: r.who, contact: r.area, ask: r.ask || r.title });
        E.push({ ...b, how: 'call', who: r.who, contact: r.phone || r.contact || '', ask: r.ask || r.title }); });
      const wsAll = !!S.wsAll, EF = wsAll ? E : E.filter(e => e.p <= 2);
      const SEC = [['call', 'Calls & messages', 'one call per person — every question to them in one go', 'Who · phone'], ['visit', 'Shop visits', 'one trip per area', 'Shop · area'], ['desk', 'At the desk', 'before or after the rounds', 'Who']];
      let lineN = 0;
      const wsSecs = SEC.map(([k, title, sub, whoHead]) => { const es = EF.filter(e => e.how === k); if (!es.length) return null;
        const key = e => k === 'visit' ? e.area : k === 'desk' ? 'desk' : (String(e.contact).replace(/[^0-9]/g, '') || e.who);
        const gs = [...new Set(es.map(key))].map(g => { const ls = es.filter(e => key(e) === g).sort((a, b) => a.p - b.p || b.sc - a.sc); return { g, ls, p: ls[0].p, sc: Math.max(...ls.map(l => l.sc)) }; })
          .sort((a, b) => a.p - b.p || b.sc - a.sc);
        const mins = k === 'call' ? gs.length * 5 : k === 'visit' ? gs.length * 25 : es.length * 5;
        const lines = [];
        gs.forEach(g => g.ls.forEach((e, i) => { lineN++; lines.push({ ...e, n: lineN, first: i === 0, dots: PR[e.p][1], pLabel: PR[e.p][0],
          who: k === 'desk' ? '' : i === 0 ? (k === 'visit' ? (e.area === 'Shops you haven’t checked' ? e.area : e.who) : e.who) : k === 'visit' && e.area !== 'Shops you haven’t checked' ? e.who : '',
          contact: i === 0 ? e.contact : k === 'visit' && e.area !== 'Shops you haven’t checked' ? '' : '',
          style: `display:grid;grid-template-columns:58px minmax(0,1.25fr) minmax(0,2.2fr) minmax(0,1.1fr) minmax(0,1fr) 22px;min-height:34px;break-inside:avoid;border-top:${i === 0 ? '1px solid #1C2233' : '1px dotted #CFCAC1'}` }); }));
        return { k, title, whoHead, mins, n: es.length, groups: gs.length, lines,
          sub: `${k === 'desk' ? plural(es.length, 'job', 'jobs') : plural(gs.length, k === 'call' ? 'person' : 'area', k === 'call' ? 'people' : 'areas') + ' · ' + plural(es.length, 'question', 'questions')} · ≈ ${mins} min — ${sub}` }; }).filter(Boolean);
      const allMins = wsSecs.reduce((t, x) => t + x.mins, 0);
      const wsList = openF.map((r, i) => ({ n: i + 1, due: DUE[r.due][0], type: TY[r.type][0], task: r.title, item: r.item, who: r.who || '', contact: r.contact || '', last: r.last || '', checked: r.checked || '' }));
      const esc = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const csv = [['#','Priority','How','Who','Phone / area','Ask','Item','Due','Last known','Found','Notes'], ...wsSecs.flatMap(sec => sec.lines.map(w => [w.n, PR[w.p][0], sec.title, w.who || (sec.k === 'desk' ? 'You' : ''), w.contact, w.ask, w.item, w.due, w.last, '', '']))].map(r => r.map(esc).join(',')).join('\r\n');
      const pgStyle = on => `min-width:28px;height:28px;border-radius:8px;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'};font-size:12px;font-weight:600`;
      const navS = off => `width:28px;height:28px;border-radius:8px;border:1px solid #E6E3DD;background:#FFFFFF;color:${off ? '#CFCAC1' : '#1C2233'};display:flex;align-items:center;justify-content:center`;
      const dueKeys = ['over', 'today', 'week'];
      const openT = open.filter(byType);
      const groups = [['due', 'When'], ['how', 'How'], ['item', 'Item']].map(([k, l]) => ({ label: l, pressed: gm === k ? 'true' : 'false', pick: () => this.setState({ clGroup: k, clPage: 0 }),
        style: `height:26px;padding:0 10px;border:0;border-radius:7px;font-size:12px;font-weight:${gm === k ? 700 : 500};background:${gm === k ? '#FFFFFF' : 'transparent'};color:${gm === k ? '#1C2233' : '#5F6980'};${gm === k ? 'box-shadow:0 1px 2px rgba(22,32,60,.15)' : ''}` }));
      return { headStyle: `display:grid;grid-template-columns:${GRID};gap:10px;align-items:center;height:30px;padding:0 16px;background:#F7F5F2;border-bottom:1px solid #E0DCD4;font-size:11px;font-weight:600;color:#5F6980`, date: dateL, total: tot, rows: rowsV, csv, ws: wsList, groups, wsSecs, wsEmpty: !wsSecs.length,
        wsPri: [1, 2, 3].map(p => ({ dots: PR[p][1], label: PR[p][0], n: E.filter(e => e.p === p).length, sub: ['', 'do these first', 'today if you can', wsAll ? 'when there’s a gap' : 'not on this sheet'][p] })),
        wsPlan: wsSecs.map(x => x.k === 'desk' ? plural(x.n, 'desk job', 'desk jobs') : plural(x.groups, x.k === 'call' ? 'call' : 'area to visit', x.k === 'call' ? 'calls' : 'areas to visit')).join(' · ') || 'Nothing to chase',
        wsAll, wsAllOpts: [[false, 'Must + Should'], [true, 'Everything']].map(([v, l]) => ({ label: l, pressed: wsAll === v ? 'true' : 'false', pick: () => this.setState({ wsAll: v }), style: `height:26px;padding:0 10px;border:0;border-radius:7px;font-size:12px;font-weight:${wsAll === v ? 700 : 500};background:${wsAll === v ? '#FFFFFF' : 'transparent'};color:${wsAll === v ? '#1C2233' : '#5F6980'};${wsAll === v ? 'box-shadow:0 1px 2px rgba(22,32,60,.15)' : ''}` })),
        wsTime: `≈ ${Math.floor(allMins / 60) ? Math.floor(allMins / 60) + 'h ' : ''}${allMins % 60}m${wsAll ? '' : ` · ${E.filter(e => e.p === 3).length} “if time” left off`}`,
        wsScope: `${ft === 'all' ? 'All tasks' : TY[ft][0]}${fd === 'all' || fd === 'done' ? '' : ' · ' + DUE[fd][0]} · ${plural(wsList.length, 'task', 'tasks')}`,
        bar: [...dueKeys.map(k => ({ label: `${DUE[k][0]}: ${openT.filter(r => r.due === k).length}`, style: `flex:${openT.filter(r => r.due === k).length} 0 0;background:${DUE[k][1]};${k === 'week' ? 'opacity:.45' : ''}` })),
          { label: `Done: ${doneF.length}`, style: `flex:${doneF.length} 0 0;background:#0F6B43` }],
        dues: [...dueKeys, 'done'].map(k => { const on = fd === k, g = GL[k], n = k === 'done' ? doneF.length : openT.filter(r => r.due === k).length;
          const sub = { over: 'expired or late — do first', today: 'due today', week: 'coming up this week', done: `of ${tot} ticked off today` }[k];
          return { label: g[0], count: n, sub, pressed: on ? 'true' : 'false', pick: () => this.setState({ clDue: on ? 'all' : k, clPage: 0 }), isDone: k === 'done',
            prog: `position:absolute;left:0;top:0;bottom:0;border-radius:2px;width:${tot ? Math.round(doneF.length / tot * 100) : 0}%;background:#0F6B43`,
            numStyle: `font-size:24px;font-weight:700;line-height:1;color:${n ? g[1] : '#CFCAC1'}`,
            style: `position:relative;display:flex;align-items:center;gap:12px;padding:10px 12px 10px 16px;border-radius:9px;text-align:left;font:inherit;cursor:pointer;overflow:hidden;border:1px solid ${on ? g[1] : '#E6E3DD'};background:${on ? g[2] : '#FFFFFF'};box-shadow:inset 4px 0 0 ${g[1]}` }; }),
        typeHead: ft === 'all' ? 'Every kind' : TY[ft][0],
        types: ['all', ...TYO].map(k => { const on = ft === k, ty = k === 'all' ? ['All', '#1C2233', '#EFECE6'] : TY[k], n = k === 'all' ? open.length : open.filter(r => r.type === k).length;
          return { label: ty[0], count: n, pressed: on ? 'true' : 'false', pick: () => this.setState({ clType: k, clPage: 0 }),
            dot: k === 'all' ? 'display:none' : `width:7px;height:7px;border-radius:2px;background:${ty[1]}`,
            style: `height:28px;display:flex;align-items:center;gap:6px;padding:0 10px;border:0;border-radius:7px;font-size:12px;background:${on ? '#FFFFFF' : 'transparent'};color:${on ? ty[1] : '#5F6980'};font-weight:${on ? 700 : 500};${on ? 'box-shadow:0 1px 2px rgba(22,32,60,.15)' : ''}` }; }),
        empty: list.length === 0, emptyText: fd === 'all' ? 'Nothing to chase — every price and ask is fresh' : fd === 'done' ? 'Nothing ticked off yet today' : `Nothing ${DUE[fd][0].toLowerCase()}`,
        range: list.length ? `${pg * PER + 1}–${Math.min(list.length, pg * PER + PER)} of ${list.length}` : '0 of 0',
        doneLabel: `${doneF.length} of ${tot} done`, doneBar: `position:absolute;left:0;top:0;bottom:0;width:${tot ? Math.round(doneF.length / tot * 100) : 0}%;background:#0F6B43`,
        pages: Array.from({ length: pc }, (_, i) => ({ n: i + 1, aria: `Page ${i + 1}`, current: i === pg ? 'page' : 'false', style: pgStyle(i === pg), go: () => this.setState({ clPage: i }) })),
        prev: () => this.setState({ clPage: Math.max(0, pg - 1) }), next: () => this.setState({ clPage: Math.min(pc - 1, pg + 1) }),
        prevOff: pg === 0, nextOff: pg >= pc - 1, prevStyle: navS(pg === 0), nextStyle: navS(pg >= pc - 1),
        editVal: S.clVal || '', setEdit: e => this.setState({ clVal: e.target.value }), cancelEdit: () => this.setState({ clEdit: null, clVal: '' }),
        download: () => { try { const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sourcing-checklist-${iso}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); this.setState({ log: `Checklist saved — ${plural(wsList.length, 'task', 'tasks')}` }); } catch (_) { this.setState({ log: 'Download blocked here — use Print worksheet' }); } },
        wsOpen: !!S.clPreview, preview: () => this.setState({ clPreview: true }), closePreview: () => this.setState({ clPreview: false }),
        print: () => owsvPrint('.ow-sv-ws') };
    })();
    /* ---- recommendations board: every live item's verdict and plan at a glance ---- */
    const rec = this._inner ? {} : (() => {
      const items = LIVE.filter(it => !S.snoozed.includes(it.rank));
      const V = this.verdicts(items.map(it => it.rank));
      const SOFT = { '#0F6B43': '#E4F4EA', '#95530C': '#FEF8F2', '#8E2A22': '#FBE5E2', '#5F6980': '#EFECE6' };
      const STEPD = ['#767F91', '#1A5A8A', '#3A3F9B', '#0F6B43'];
      const kindOfV = t => /^Not enough/.test(t) ? 'none' : /Don’t/.test(t) ? 'no' : /special|small/i.test(t) || /^Leaning/.test(t) ? 'maybe' : 'yes';
      const KV = { yes: ['Stock it', '#0F6B43'], maybe: ['Careful / leaning', '#95530C'], no: ['Don’t stock', '#8E2A22'], none: ['Needs evidence', '#5F6980'] };
      const fk = S.recFilter || 'all';
      const all = items.map(it => { const { vd, pl } = V[it.rank] || {}; const t = vd.title || 'Not enough to decide', k = kindOfV(t), col = vd.col || '#5F6980', conf = vd.conf || 0;
        const hold = (pl.holds || []).find(h => h.pressed === 'true'); const call = (pl.calls || [])[0];
        const cc = conf >= 80 ? '#0F6B43' : conf >= 55 ? '#95530C' : '#8E2A22';
        return { rank: it.rank, k, sc: vd.score && vd.score !== '—' ? +vd.score : -1, confN: conf,
          name: it.name, step: COLT[it.stage], askers: it.askers, stepDot: `width:7px;height:7px;border-radius:999px;background:${STEPD[it.stage]}`,
          verdict: t, pill: `flex-shrink:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:${SOFT[col] || '#EFECE6'};color:${col}`,
          score: vd.score || '—', scoreStyle: `font-size:12px;font-weight:700;color:${col}`,
          why: pl.ok ? (pl.priceWhy || vd.why || '') : (vd.confWhy || vd.why || ''),
          conf: `${conf}%`, confWhy: vd.confWhy || '', confBar: `position:absolute;left:0;top:0;bottom:0;border-radius:3px;width:${conf}%;background:${cc}`, confText: `font-size:11px;font-weight:700;color:${cc}`,
          price: pl.ok ? pl.price : '—', margin: pl.ok ? pl.priceMargin : '',
          batch: pl.ok ? pl.batch : '—', batchSub: pl.ok ? pl.batchUnit : '',
          sup: pl.ok ? pl.sup : '—', supSub: pl.ok ? `payback ${pl.payback} · ${pl.profit}` : '', supWhy: pl.supWhy || '',
          call: call ? call.name : '—', callWhy: call ? call.why : '',
          hold: pl.ok && hold ? hold.label : '—', holdWhy: hold ? hold.hint : '',
          holdStyle: `display:inline-flex;height:22px;align-items:center;padding:0 8px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;${pl.ok && hold ? 'background:#F7F5F2;border:1px solid #E6E3DD;color:#1C2233' : 'color:#767F91'}`,
          open: () => this.setState({ task: it.rank, mTab: 'verdict', holdMode: null, actPage: 0, renaming: null, addAsk: false, mergeOpen: false, hint: null, taskSups: [], taskPrices: {}, taskQS: '', taskTerms: {}, taskTiers: {}, taskOpenSup: null, taskPacks: {}, taskTrans: {}, taskSup: '', taskMin: '', taskShelf: '', dropAsk: false }) }; })
        .sort((a, b) => (a.k === 'none') - (b.k === 'none') || b.sc - a.sc || b.confN - a.confN);
      const GR = 'minmax(0,1.25fr) minmax(0,1.5fr) 96px 84px 96px minmax(0,1fr) minmax(0,1fr) 112px 64px';
      const rows = all.filter(r => fk === 'all' || r.k === fk).map((r, i) => ({ ...r, style: `display:grid;grid-template-columns:${GR};gap:10px;align-items:center;min-height:52px;padding:6px 16px;box-sizing:border-box;border-bottom:1px solid #EFECE6;${r.k === 'none' ? 'background:#FCFBF9;' : ''}` }));
      const chips = Object.keys(KV).map(k => { const on = fk === k, n = all.filter(r => r.k === k).length;
        return { label: KV[k][0], n, pressed: on ? 'true' : 'false', pick: () => this.setState({ recFilter: on ? 'all' : k }), dot: `width:8px;height:8px;border-radius:999px;background:${KV[k][1]}`,
          style: `height:28px;display:${n ? 'flex' : 'none'};align-items:center;gap:6px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid ${on ? KV[k][1] : '#E6E3DD'};background:${on ? (SOFT[KV[k][1]] || '#EFECE6') : '#FFFFFF'};color:${on ? KV[k][1] : '#1C2233'}` }; });
      const ready = all.filter(r => r.k !== 'none'), lowC = ready.filter(r => r.confN < 55).length;
      return { rows, chips, headStyle: `display:grid;grid-template-columns:${GR};gap:10px;align-items:center;height:30px;padding:0 16px;background:#F7F5F2;border-bottom:1px solid #E0DCD4;font-size:11px;font-weight:600;color:#5F6980`,
        foot: `${ready.length} of ${all.length} items have enough to decide${lowC ? ` · ${lowC} of those on thin evidence — see Today’s checklist` : ''} · updates as soon as a price, quote or buyer changes` };
    })();
    const funnel = {
      cl, rec,
      intake, hasIntake: intake.length > 0, noIntake: intake.length === 0, intakeCount: intake.length,
      inboxShown: this.state.inboxAll ? intake : intake.slice(0, 4), inboxHasMore: intake.length > 4, inboxMore: this.state.inboxAll ? 'Show fewer' : `+${intake.length - 4} more`, inboxToggle: () => this.setState({ inboxAll: !this.state.inboxAll }),
      intakeBadge: `font-size:11px;font-weight:700;border-radius:999px;padding:1px 8px;${intake.length ? 'background:#C93A30;color:#FFFFFF' : 'background:#E4F4EA;color:#0F6B43'}`,
      quickAdd, draftName: this.state.draftName, draftWho: this.state.draftWho, draftQty: this.state.draftQty,
      setDraftName: e => this.setState({ draftName: e.target.value }),
      setDraftWho: e => this.setState({ draftWho: e.target.value }),
      setDraftQty: e => this.setState({ draftQty: e.target.value }),
      board, boardPeople, liveCount: LIVE.length, peopleCount: LIVE.reduce((t, it) => t + (it.askers || 0), 0),
      vdMore: !!S.vdMore, vdToggle: () => this.setState({ vdMore: !S.vdMore }), vdToggleLabel: S.vdMore ? 'Hide reasons' : 'Show reasons',
      ...(() => { if (!T || !pl || !pl.ok) return { psOpen: false, psOpenIt: () => {} };
        const unitW = (T.qty || '').split(' ')[1] || 'pcs';
        const tiers = pl.ladder.map(t => ({ from: num(t.from), p: num(t.price) }));
        const toQ = (() => { const x = Tasks.find(y => y[0] === S.psTo); return x ? x[1] : 0; })();
        const rows = tiers.map((t, i) => { const nx = tiers[i + 1]; const mine = toQ && toQ >= t.from && (!nx || toQ < nx.from); const off = Math.round((1 - t.p / tiers[0].p) * 100);
          return { tier: (pl.ladder[i] || {}).tier ? pl.ladder[i].tier.toUpperCase() : '', range: nx ? `${fmtN(t.from)} – ${fmtN(nx.from - 1)} ${unitW}` : `${fmtN(t.from)}+ ${unitW}`, price: fmtN(t.p), isYours: !!mine,
            save: off > 0 ? `save ${off}%` : '', saveStyle: off > 0 ? `font-size:10px;font-weight:700;border-radius:999px;padding:1px 6px;background:${mine ? '#FFFFFF' : '#E4F4EA'};color:#0F6B43` : 'display:none',
            cardStyle: `display:flex;flex-direction:column;gap:4px;padding:12px 14px;border-radius:10px;border:1.5px solid ${mine ? '#1C2233' : '#E6E3DD'};background:${mine ? '#1C2233' : i === tiers.length - 1 && tiers.length > 1 ? '#F7F5F2' : '#FFFFFF'};color:${mine ? '#FFFFFF' : '#1C2233'}` }; });
        const top = Tasks.slice().sort((a, b) => b[1] - a[1]).slice(0, 4);
        const to = Tasks.find(x => x[0] === S.psTo);
        const tierFor = q => tiers.slice().reverse().find(t => q >= t.from) || tiers[0];
        const d = new Date(), dv = new Date(d.getTime() + (S.psDays || 7) * 86400000);
        const f = x => x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        return { psOpen: !!S.psOpen, psOpenIt: () => this.setState({ psOpen: true }), psClose: () => this.setState({ psOpen: false }),
          psPrint: () => owsvPrint('.ow-sv-ps'),
          psItem: T.name, psSpec: [ (T.packs && Object.values(T.packs).find(v => v)) || '', T.note || '' ].filter(Boolean).join(' · ') || 'Available to order',
          psRows: rows, psGrid: `display:grid;gap:8px;grid-template-columns:repeat(${rows.length},minmax(0,${rows.length === 1 ? '220px' : '1fr'}))`, psDate: f(d), psValid: f(dv),
          psQ: S.psQ || '', setPsQ: e => this.setState({ psQ: e.target.value }),
          psTo: (() => { const q = (S.psQ || '').trim().toLowerCase();
            const pool = q ? Tasks.filter(x => x[0].toLowerCase().includes(q)) : top;
            const opts = [{ v: null, label: 'Anyone', sub: 'general price list', total: '' }, ...pool.slice(0, 4).map(x => ({ v: x[0], label: x[0], sub: `${fmtN(x[1])} ${unitW} · ${(pl.ladder.slice().reverse().find(t => x[1] >= num(t.from)) || pl.ladder[0]).tier}`, total: short(x[1] * tierFor(x[1]).p) }))];
            if (q && !pool.length) { const nm = (S.psQ || '').trim().replace(/\b\w/g, ch => ch.toUpperCase()); opts.push({ v: nm, label: nm, sub: 'not an asker — no order line', total: '' }); }
            return opts.map(o => { const on = (S.psTo || null) === o.v;
              return { ...o, pressed: on ? 'true' : 'false', ini: o.v ? o.label.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() : '∗',
                av: `flex-shrink:0;width:26px;height:26px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;background:${on ? '#FFFFFF' : '#EFECE6'};color:${on ? '#1C2233' : '#5F6980'}`,
                pick: () => this.setState({ psTo: o.v }),
                style: `display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border-radius:9px;font:inherit;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}` }; }); })(),
          psValids: [3, 7, 14].map(dd => { const on = (S.psDays || 7) === dd; return { label: `${dd} days`, pressed: on ? 'true' : 'false', pick: () => this.setState({ psDays: dd }),
            style: `height:28px;border-radius:8px;font-size:11px;font-weight:600;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}` }; }),
          psShows: [['total', 'Their order total'], ['spec', 'Pack size / spec'], ['delivery', 'Delivery on request']].map(([k, label]) => { const on = (S.psShow || {})[k] !== false; return { label, pressed: on ? 'true' : 'false', tick: on ? '✓' : '',
            pick: () => this.setState({ psShow: { ...(S.psShow || {}), [k]: !on } }),
            box: `width:16px;height:16px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;${on ? 'background:#1C2233;color:#FFFFFF' : 'border:1.5px solid #CFCAC1;box-sizing:border-box;color:transparent'}` }; }),
          psShowTotal: !!to && (S.psShow || {}).total !== false, psShowSpec: (S.psShow || {}).spec !== false, psDelivery: (S.psShow || {}).delivery !== false ? ' · Delivery on request' : '',
          psWaLabel: to ? `WhatsApp ${to[0].split(' ')[0]}` : 'Copy for WhatsApp',
          psHasTo: !!S.psTo, psToName: S.psTo || '', psQtyLine: to ? `${fmtN(to[1])} ${unitW} × ${fmtN(tierFor(to[1]).p)}` : '', psTotal: to ? `UGX ${fmtN(to[1] * tierFor(to[1]).p)}` : '',
          psWhatsApp: () => this.setState({ log: `WhatsApp text ready${to ? ` for ${to[0]}` : ''}: “${T.name}: ${rows.map(r => `${r.range} @ ${r.price}`).join(' · ')}${to ? `. Your ${fmtN(to[1])}: UGX ${fmtN(to[1] * tierFor(to[1]).p)}` : ''}. Valid to ${f(dv)}.” — nothing sent until you press send` }) }; })(),
      pl, vd, rv, tabVerdict: mt === 'verdict', tabRivals: mt === 'rivals',
      vdOpen: () => this.setState({ mTab: 'verdict' }), vdPillText: vd.title ? `${vd.title}${vd.score !== '—' ? ' · ' + vd.score : ''}` : '',
      vdPill: vd.title ? `flex-shrink:0;height:24px;padding:0 10px;border-radius:999px;border:1px solid ${vd.col};background:#FFFFFF;color:${vd.col};font-size:11px;font-weight:700;white-space:nowrap` : 'display:none',
      rvName: S.rvName, rvPrice: S.rvPrice, rvArea: S.rvArea,
      setRvName: e => this.setState({ rvName: e.target.value }), setRvPrice: e => this.setState({ rvPrice: e.target.value }), setRvArea: e => this.setState({ rvArea: e.target.value }),
      rvStocks: ['In stock','Low stock','Out of stock'].map(o => { const on = S.rvStock === o; return { label: o, pressed: on ? 'true' : 'false', pick: () => this.setState({ rvStock: o }),
        style: `height:26px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}` }; }),
      rvHows: ['visit','call','WhatsApp'].map(o => { const on = S.rvHow === o; return { label: o === 'visit' ? 'Visited' : o === 'call' ? 'Called' : 'WhatsApp', pressed: on ? 'true' : 'false', pick: () => this.setState({ rvHow: o }),
        style: `height:26px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}` }; }),
      rvOff: !((S.rvName || '').trim() && num(S.rvPrice) > 0),
      rvBreakRows: (S.rvBreaks || []).map((b, i) => { const set = (k, v) => this.setState({ rvBreaks: (S.rvBreaks || []).map((x, j) => j === i ? { ...x, [k]: v } : x) });
        return { q: b.q, p: b.p, setQ: e => set('q', e.target.value), setP: e => set('p', e.target.value), remove: () => this.setState({ rvBreaks: (S.rvBreaks || []).filter((x, j) => j !== i) }) }; }),
      rvAddBreak: () => this.setState({ rvBreaks: [...(S.rvBreaks || []), { q: '', p: '' }] }),
      rvAddStyle: `margin-left:auto;height:30px;padding:0 12px;border-radius:8px;font-size:12px;font-weight:700;border:1px solid ${(S.rvName || '').trim() && num(S.rvPrice) > 0 ? '#1C2233' : '#E6E3DD'};background:${(S.rvName || '').trim() && num(S.rvPrice) > 0 ? '#1C2233' : '#F7F5F2'};color:${(S.rvName || '').trim() && num(S.rvPrice) > 0 ? '#FFFFFF' : '#767F91'}`,
      rvAdd: () => { if (!T || !((S.rvName || '').trim() && num(S.rvPrice) > 0)) return; const r = { name: S.rvName.trim(), price: num(S.rvPrice), stock: S.rvStock, area: (S.rvArea || '').trim() || '—', days: 0, how: S.rvHow, breaks: (S.rvBreaks || []).map(b => ({ q: num(b.q), p: num(b.p) })).filter(b => b.q > 1 && b.p > 0).sort((a, b) => a.q - b.q) };
        commit({ rivalsAdd: { ...(S.rivalsAdd || {}), [T.rank]: [...(((S.rivalsAdd || {})[T.rank]) || []), r] }, rvName: '', rvPrice: '', rvArea: '', rvBreaks: [] }, `${r.name} sells ${T.name} at ${fmtN(r.price)}${r.breaks.length ? ` (${r.breaks.map(b => `${fmtN(b.q)}+ ${fmtN(b.p)}`).join(', ')})` : ''} (${r.stock.toLowerCase()})`); },
      ...(() => { const PER = 6, n = mActs.length, pages = Math.max(1, Math.ceil(n / PER)), pg = Math.min(S.actPage || 0, pages - 1);
        const b = off => `height:26px;padding:0 10px;border-radius:7px;font-size:11px;font-weight:600;border:1px solid #E6E3DD;background:#FFFFFF;color:${off ? '#B3BCD2' : '#1C2233'};cursor:${off ? 'default' : 'pointer'}`;
        return { actPage: mActs.slice(pg * PER, pg * PER + PER), actRange: n ? `${pg * PER + 1}–${Math.min(n, pg * PER + PER)} of ${n}` : 'nothing yet',
          actPrevOff: pg === 0, actNextOff: pg >= pages - 1, actPrevStyle: b(pg === 0), actNextStyle: b(pg >= pages - 1),
          actPrev: () => this.setState({ actPage: Math.max(0, pg - 1) }), actNext: () => this.setState({ actPage: Math.min(pages - 1, pg + 1) }) }; })(),
      mKpis, mTabs, tabOverview: mt === 'overview', tabSuppliers: mt === 'suppliers', tabDemand: mt === 'demand', tabMoney: mt === 'money', tabActivity: mt === 'activity',
      mSup, mNoSup: mSup.length === 0, mSupNote, mAsks, mChan, mTop, mFollowNote, mm, mHasMoney: !!(T && Tcost), mNoMoney: !(T && Tcost), mActs,
      m: mCard || {}, hasM: !!mCard, mSteps: mSteps2, mPos: navI >= 0 ? `${navI + 1} of ${NAV.length}` : '', mPrev: () => goNav(-1), mNext: () => goNav(1), mKnown, mOwner: T && T.owner ? `${T.owner} is on it` : 'Nobody on it',
      mStateLabel: SLB[mState][0], mStatePill: `flex-shrink:0;font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px;color:${SLB[mState][1]};background:${SLB[mState][2]}`,
      rail, queue, w: w || {}, hasW: !!w, noW: !w, journey, wStepOf: T ? `Step ${Math.min(T.stage + 1, 5)} of 5 · ${COLT[Math.min(T.stage, 4)]}` : '',
      queueTitle: railK == null ? `${queue.length} cards` : `${queue.length} in ${COLT[railK]}`, queueEmpty: queue.length === 0,
      queueEmptyText: railK === 4 ? 'Items listed here this session show up here' : who !== 'all' ? 'Nothing here for this person' : 'Nothing at this step',
      railAll: () => this.setState({ rail: null }), railAllPressed: railK == null ? 'true' : 'false',
      railAllStyle: `display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;gap:6px;padding:10px;border-radius:8px;font:inherit;cursor:pointer;border:1px solid ${railK == null ? '#1C2233' : '#E6E3DD'};background:${railK == null ? '#1C2233' : '#FFFFFF'};color:${railK == null ? '#FFFFFF' : '#1C2233'}`,
      boardGrid: 'display:grid;gap:8px;padding:12px;grid-template-columns:repeat(5,minmax(0,1fr))',
      snoozedCount: S.snoozed.length, hasSnoozed: S.snoozed.length > 0, wakeAll: () => commit({ snoozed: [] }, 'Snoozed items are back on the board'),
      shelfTotal: ALL.filter(it => it.stage === 4 && !dropped.includes(it.rank)).length, droppedCount: dropped.length,
      hasLog: !!S.log, logText: S.log || '', canUndo: S.hist.length > 0 && S.log !== 'Undone', undo, clearLog: () => this.setState({ log: null }),
      dragEnd: () => this.setState({ dragging: null }),
      taskQSText: S.taskQS && !(T && num(S.taskQS) === qtyN(T)) ? S.taskQS : '', setTaskQS: e => this.setState({ taskQS: e.target.value }),
      supQ: S.supQ, setSupQ: e => this.setState({ supQ: e.target.value }),
      newSupOpen: !!S.newSup, openNewSup: () => this.setState({ newSup: { name: (S.supQ || '').trim().replace(/\b\w/g, ch => ch.toUpperCase()), phone: '', loc: '', locOther: '', cats: [], kind: 'Wholesaler' } }),
      nsKinds: SUP_KINDS.map(k => { const on = S.newSup && S.newSup.kind === k; return { label: k, pressed: on ? 'true' : 'false', pick: () => this.setState({ newSup: { ...S.newSup, kind: k } }),
        style: `height:24px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}` }; }),
      cancelNewSup: () => this.setState({ newSup: null }),
      nsName: S.newSup ? S.newSup.name : '', nsPhone: S.newSup ? S.newSup.phone : '', nsLocOther: S.newSup ? S.newSup.locOther : '',
      setNsName: e => this.setState({ newSup: { ...S.newSup, name: e.target.value } }), setNsPhone: e => this.setState({ newSup: { ...S.newSup, phone: e.target.value } }),
      setNsLocOther: e => this.setState({ newSup: { ...S.newSup, locOther: e.target.value, loc: '' } }),
      nsLocs: SUP_LOCS.map(l => { const on = S.newSup && S.newSup.loc === l; return { label: l, pressed: on ? 'true' : 'false', pick: () => this.setState({ newSup: { ...S.newSup, loc: on ? '' : l, locOther: '' } }),
        style: `height:24px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}` }; }),
      nsCats: SUP_CATS.map(ct => { const on = S.newSup && S.newSup.cats.includes(ct); return { label: ct, pressed: on ? 'true' : 'false',
        pick: () => this.setState({ newSup: { ...S.newSup, cats: on ? S.newSup.cats.filter(x => x !== ct) : [...S.newSup.cats, ct] } }),
        style: `height:24px;padding:0 8px;border-radius:7px;font-size:11px;font-weight:600;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}` }; }),
      ...(() => { const n = S.newSup; const loc = n ? (n.loc || (n.locOther || '').trim()) : ''; const digits = n ? n.phone.replace(/[^0-9]/g, '') : '';
        const ok = !!n && n.name.trim().length > 1 && digits.length >= 9 && !!loc;
        const miss = !n ? '' : [n.name.trim().length > 1 ? '' : 'name', digits.length >= 9 ? '' : 'phone', loc ? '' : 'area'].filter(Boolean);
        return { nsOff: !ok, nsHint: n && miss.length ? `needs ${miss.join(', ')}` : 'goes into Suppliers, too',
          nsSaveStyle: `height:30px;padding:0 12px;border-radius:8px;font-size:12px;font-weight:700;border:1px solid ${ok ? '#1C2233' : '#E6E3DD'};background:${ok ? '#1C2233' : '#F7F5F2'};color:${ok ? '#FFFFFF' : '#767F91'}`,
          saveNewSup: () => { if (!ok) return; const sup = { name: n.name.trim(), kind: n.kind || 'Wholesaler', phone: n.phone.trim(), loc, cats: n.cats.length ? n.cats : ['general'], orders: 0, last: 0, lead: '—', isNew: true };
            this.setState({ extraSups: [...(S.extraSups || []), sup], taskSups: [...S.taskSups.filter(x => x !== sup.name), sup.name], newSup: null, supQ: '',
              log: `${sup.name} added to your suppliers (${loc} · ${sup.phone}) and marked as having it` }); } }; })(),
      closeTask: () => this.setState({ task: null, dropAsk: false, renaming: null, addAsk: false, mergeOpen: false }),
      renameVal: S.renameVal, setRenameVal: e => this.setState({ renameVal: e.target.value }), cancelRename: () => this.setState({ renaming: null }),
      askWho: S.askWho, setAskWho: e => this.setState({ askWho: e.target.value }), askQty: S.askQty, setAskQty: e => this.setState({ askQty: e.target.value }),
      taskSup: S.taskSup, taskMin: S.taskMin, taskShelf: S.taskShelf !== '' ? S.taskShelf : (T ? String(recPriceOf(T)) : ''),
      setTaskSup: e => this.setState({ taskSup: e.target.value }), setTaskMin: e => this.setState({ taskMin: e.target.value }), setTaskShelf: e => this.setState({ taskShelf: e.target.value }),
      addCustomSup: e => { if (e && e.preventDefault) e.preventDefault(); const n = (S.taskSup || '').trim(); if (!n) return; this.setState({ taskSups: [...S.taskSups.filter(x => x !== n), n], taskSup: '' }); }
    };
    /* ---- the phone: its own design, the same books ---- */
    const ph = (() => {
      if (this._inner) return {};
      const PST = { ready: ['Ready', '#0F6B43', '#E4F4EA'], over: ['Over time', '#8E2A22', '#FBE5E2'], nobody: ['Nobody on it', '#7A4A02', '#FDEEE1', '#95530C'], track: ['On track', '#5F6980', '#EFECE6', '#767F91'] };
      const live = LIVE.filter(it => !S.snoozed.includes(it.rank));
      const pf = S.phFilter || 'all';
      const matchedP = live.filter(it => pf === 'all' || it.state === pf).sort((a, b) => (b.state === 'ready') - (a.state === 'ready') || b.askers * Math.max(1, b.wait) - a.askers * Math.max(1, a.wait));
      const capP = S.phAll ? matchedP.length : 6;
      const openLead = it => () => { if (typeof openSourcingLead === 'function') openSourcingLead(it.id); };
      const cardsP = matchedP.slice(0, capP).map((it, i) => { const st = PST[it.state]; const over = it.days > it.limit; const primary = pf === 'all' && i === 0;
        return { name: it.name, meta: [it.qty, it.owner].filter(Boolean).join(' · ') || 'qty not said', askers: it.askers, wait: it.wait, move: it.move, days: it.days, limit: it.limit,
          stateLabel: st[0], stepLabel: STEPS[it.stage], open: openLead(it),
          dotStyle: `position:absolute;right:-4px;top:-4px;width:12px;height:12px;border-radius:999px;border:2px solid #FFFFFF;background:${st[3] || st[1]}`,
          pillStyle: `flex-shrink:0;font-size:12px;font-weight:600;color:${st[1]};background:${st[2]};border-radius:999px;padding:1px 8px`,
          segs: [0, 1, 2, 3, 4].map(k => ({ style: `width:14px;height:6px;border-radius:2px;background:${k < it.stage ? '#767F91' : k === it.stage ? '#1C2233' : '#E6E3DD'}` })),
          kn: it.known.map(ok => ({ style: ok ? 'width:10px;height:10px;border-radius:2px;background:#0F6B43' : 'width:10px;height:10px;border-radius:2px;border:1px dashed #767F91;box-sizing:border-box' })),
          knownLabel: `${it.known.filter(Boolean).length} of 4 known`, dayStyle: `font-size:12px;font-weight:600;color:${over ? '#8E2A22' : '#5F6980'}`,
          btnStyle: primary ? 'height:44px;border-radius:9px;border:1px solid #C93A30;background:#C93A30;color:#FFFFFF;font-size:15px;font-weight:600' : 'height:44px;border-radius:9px;border:1px solid #E6E3DD;background:#FFFFFF;color:#1C2233;font-size:15px;font-weight:600' }; });
      const FLP = [['all', 'All'], ['ready', 'Ready'], ['over', 'Late'], ['nobody', 'Nobody']];
      const filtersP = FLP.map(([k, label]) => { const on = pf === k; return { label, count: k === 'all' ? live.length : live.filter(it => it.state === k).length, pressed: on ? 'true' : 'false',
        pick: () => this.setState({ phFilter: k, phAll: false }),
        style: `height:44px;flex-grow:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 8px;border-radius:999px;font-size:14px;font-weight:600;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : '#1C2233'}` }; });
      const ready = live.filter(it => it.stage === 3), readyV = ready.reduce((t, it) => t + costOf(it) * qtyN(it), 0);
      const since = AD.now - 90 * 86400000, recent = ALL.filter(it => { const l = AD.byRank[it.rank]; return l && new Date(l.createdAt).getTime() >= since; });
      const reached = [0, 1, 2, 3, 4].map(k => recent.filter(it => it.stage >= k).length), maxR = Math.max(1, reached[0]);
      const BC = ['#767F91', '#5F6980', '#243052', '#1C2233', '#0F6B43'];
      const disc = ALL.filter(it => !it.voided && it.stage < 4).map(it => ({ it, n: (AD.byRank[it.rank].requests || []).filter(r => r.source === 'quote' && !r.withdrawn).length })).filter(x => x.n)
        .sort((a, b) => b.n - a.n).slice(0, 3).map(x => ({ name: x.it.name, n: x.n, open: openLead(x.it) }));
      return { sub: `${live.length} ${live.length === 1 ? 'item' : 'items'} in motion`, logAsk: () => { if (typeof openSourcingLead === 'function') openSourcingLead(null); },
        ready: ready.length, readyValue: readyV ? short(readyV) : '', people: live.reduce((t, it) => t + it.askers, 0), maxWait: live.length ? `max ${Math.max(...live.map(it => it.wait))}d` : '',
        over: live.filter(it => it.state === 'over').length, nobody: live.filter(it => it.state === 'nobody').length,
        listedPct: reached[0] ? `${Math.round(reached[4] / reached[0] * 100)}% listed` : '',
        bars: reached.map((n, k) => ({ n, style: `height:${Math.max(18, Math.round(n / maxR * 76))}px;background:${BC[k]};border-radius:4px;display:flex;align-items:flex-start;justify-content:center;padding-top:${k === 4 ? 4 : 6}px;box-sizing:border-box` })),
        now: [0, 1, 2, 3].map(k => ({ sq: live.filter(it => it.stage === k).map(it => ({ style: `width:10px;height:10px;border-radius:2px;background:${DOT[it.state]}` })) })),
        disc, noDisc: !disc.length, filters: filtersP, cards: cardsP, more: matchedP.length > cardsP.length, moreLabel: `Show ${matchedP.length - cardsP.length} more`, showAll: () => this.setState({ phAll: true }) };
    })();
    /* ---- the three panels under the map, from the books ---- */
    const panels = (() => {
      if (this._inner) return {};
      const DAY = 86400000, now = Date.now(), leadsAll = this.owLeads();
      const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
      const today0 = dayStart(now), wd = (new Date(now).getDay() + 6) % 7, week0 = today0 - wd * DAY, lastWeek0 = week0 - 7 * DAY;
      const asksAt = leadsAll.flatMap(l => (l.requests || []).map(r => new Date(r.at).getTime()).filter(t => !isNaN(t)));
      const perDay = (from) => Array.from({ length: 7 }, (_, i) => asksAt.filter(t => t >= from + i * DAY && t < from + (i + 1) * DAY).length);
      const thisW = perDay(week0), lastW = perDay(lastWeek0), top = Math.max(1, ...thisW, ...lastW);
      const LB = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      const days = LB.map((label, i) => ({ label, title: `${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][i]}: ${thisW[i]} this week, ${lastW[i]} last week`,
        last: `position:absolute;bottom:0;left:2px;right:2px;height:${Math.round(lastW[i] / top * 26)}px;border-radius:2px;border:1px dashed #B3BCD2;box-sizing:border-box`,
        now: `position:relative;width:60%;height:${i > wd ? 0 : Math.max(2, Math.round(thisW[i] / top * 26))}px;border-radius:2px;background:${thisW[i] ? '#3A3F9B' : '#E0DCD4'}`,
        labelStyle: `font-size:11px;color:${i === wd ? '#1C2233' : '#767F91'};font-weight:${i === wd ? 700 : 400}` }));
      const inW = (t, from, to) => { const ms = typeof t === 'number' ? t : new Date(t).getTime(); return !isNaN(ms) && ms >= from && ms < to; };
      const cnt = (from, to) => ({ asks: asksAt.filter(t => inW(t, from, to)).length,
        moved: leadsAll.filter(l => !l.voided && l.status !== 'asked' && inW(Number(l.stageEnteredAt), from, to)).length,
        listed: leadsAll.filter(l => l.graduatedAt && inW(l.graduatedAt, from, to)).length,
        dropped: leadsAll.filter(l => l.voided && l.droppedAt && inW(l.droppedAt, from, to)).length });
      const cw = cnt(week0, now + 1), lw = cnt(lastWeek0, week0);
      const dlt = (a, b, goodUp) => a === b ? [a ? '=' : '', '#5F6980'] : [`${a > b ? '▲' : '▼'}${Math.abs(a - b)}`, (a > b) === goodUp ? '#0F6B43' : '#5F6980'];
      const TL = [['asks', 'new asks', '#E4E6FA', '#3A3F9B', true, '+'], ['moved', 'moved on', '#F7F5F2', '#1C2233', true, ''], ['listed', 'listed', '#E4F4EA', '#0F6B43', true, ''], ['dropped', 'dropped', '#EFECE6', '#5F6980', false, '']];
      const tiles = TL.map(([k, label, bg, ink, up, pre]) => { const d = dlt(cw[k], lw[k], up); return { label, value: `${cw[k] && pre ? pre : ''}${cw[k]}`, delta: d[0], title: `${cw[k]} this week, ${lw[k]} last week`,
        style: `background:${bg};border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:2px`, valStyle: `font-size:18px;font-weight:600;color:${ink};line-height:1.1`,
        deltaStyle: `font-size:11px;color:${d[1]}`, labelStyle: `font-size:11px;color:${ink}` }; });
      const SL = { asked: 'Asked', looking: 'Looking', sourced: 'Found', priced: 'Priced', listed: 'Listed' }, ORD = ['asked', 'looking', 'sourced', 'priced', 'listed'];
      const chip = (label, good) => `font-size:11px;font-weight:600;color:${good ? '#0F6B43' : '#5F6980'};background:${good ? '#E4F4EA' : '#EFECE6'};border-radius:999px;padding:1px 6px;white-space:nowrap`;
      const moves = leadsAll.filter(l => !l.voided && l.status !== 'asked' && l.stageEnteredAt).sort((a, b) => Number(b.stageEnteredAt) - Number(a.stageEnteredAt)).slice(0, 3).map(l => {
        const i = ORD.indexOf(l.status), from = SL[ORD[Math.max(0, i - 1)]], to = SL[l.status], ago = Math.floor((now - Number(l.stageEnteredAt)) / DAY);
        return { name: l.name, from, to, fromStyle: chip(from, false), toStyle: chip(to, l.status === 'listed'), ago: ago ? `${ago}d` : 'today',
          open: () => { const r = (this._rankOf || {})[l.id]; if (r && l.status !== 'listed') this.setState({ task: r, mTab: 'overview', dropAsk: false }); } }; });
      /* where asks come from, 90 days */
      const SRC = [['q', 'Quote search, no match', '#3A3F9B'], ['w', 'WhatsApp', '#1A5A8A'], ['c', 'At the counter', '#7A3268'], ['p', 'Phone', '#5F6980']];
      const MAPS = { quote: 'q', whatsapp: 'w', wa: 'w', assistant: 'w', copilot: 'w', phone: 'p' };
      const recent = leadsAll.flatMap(l => l.requests || []).filter(r => { const t = new Date(r.at).getTime(); return !isNaN(t) && now - t <= 90 * DAY; });
      const tally = {}; recent.forEach(r => { const k = r.channel || MAPS[String(r.source || '').toLowerCase()] || 'c'; tally[k] = (tally[k] || 0) + 1; });
      const tot = recent.length;
      const srcRows = SRC.filter(x => tally[x[0]]).map(([k, label, col]) => ({ label, n: tally[k], pct: `${Math.round(tally[k] / Math.max(1, tot) * 100)}%`,
        seg: `width:${(tally[k] / Math.max(1, tot) * 100).toFixed(1)}%;background:${col}`, sw: `width:10px;height:10px;border-radius:2px;background:${col}` }));
      /* waiting on suppliers: named on a live lead, no price yet */
      const lim = AD.LIM[2], byS = {};
      leadsAll.filter(l => !l.voided && l.status !== 'listed').forEach(l => (l.candidates || []).forEach(c => {
        if (candidateTiers(c).length) return; const n = this.owCandName(c); if (!n) return;
        const d = l.stageEnteredAt ? Math.floor((now - Number(l.stageEnteredAt)) / DAY) : 0, over = l.status === 'sourced' && d > lim;
        (byS[n] || (byS[n] = { n, phone: c.phone || '', items: [] })).items.push({ label: `${String(l.name).split(/,| — /)[0].slice(0, 22)} · ${d}d`, title: `${l.name} — ${d} days in ${SL[l.status]}${over ? ', over the limit' : ''}`, over, lead: l.name,
          style: `max-width:100%;font-size:11px;font-weight:600;border-radius:6px;padding:2px 6px;background:${over ? '#FBE5E2' : '#F7F5F2'};color:${over ? '#8E2A22' : '#1C2233'}` });
      }));
      const PAL = [['#E4E6FA', '#3A3F9B'], ['#DCEAF8', '#1A5A8A'], ['#F6E4F1', '#7A3268'], ['#E4F4EA', '#0F6B43']];
      const wosRows = Object.values(byS).sort((a, b) => b.items.filter(i => i.over).length - a.items.filter(i => i.over).length || b.items.length - a.items.length).slice(0, 5).map((w, i) => {
        const sp = (data.suppliers || []).find(s => String(s.name).toLowerCase() === w.n.toLowerCase()) || {}; const phone = sp.phone || w.phone;
        return { name: w.n, ini: AD.iniOf(w.n), items: w.items,
          av: `grid-row: span 2;width:28px;height:28px;border-radius:8px;background:${PAL[i % 4][0]};color:${PAL[i % 4][1]};font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center`,
          rowStyle: `display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:4px 10px;align-items:center;padding:10px 14px;${i ? 'border-top:1px solid #EFECE6;' : ''}`,
          askTitle: phone ? `Opens WhatsApp to ${w.n} with the question written — nothing sends until you press send` : `${w.n} has no phone number on file`,
          ask: () => { const ok = owsvWhatsApp(phone, `Hello ${w.n.split(' ')[0]}, what is your price for ${w.items.map(x => x.lead).join(', ')}?`); this.setState({ log: ok ? `WhatsApp opened for ${w.n} — nothing is sent until you press send there` : `${w.n} has no phone number on file — add one in Suppliers` }); } }; });
      /* stage limits, kept in the shop's presets */
      const LN = [['asked', 'Asked for'], ['looking', 'Looking'], ['sourced', 'Source found'], ['priced', 'Priced']];
      const limRows = LN.map(([k, label], i) => ({ label, value: S.limDraft[k] != null ? S.limDraft[k] : String(AD.LIM[i]), set: e => this.setState({ limDraft: { ...S.limDraft, [k]: e.target.value } }) }));
      const lastAsk = asksAt.length ? Math.max(...asksAt) : 0, quietDays = lastAsk ? Math.floor((now - lastAsk) / DAY) : null;
      return { wk: { days, tiles, moves, noMoves: !moves.length, quiet: !thisW.some(Boolean), quietText: quietDays == null ? 'No asks recorded yet' : `No new asks this week · last one ${quietDays}d ago` }, srcs: { rows: srcRows, total: tot, none: !tot },
        wos: { rows: wosRows, n: Object.keys(byS).length, none: !wosRows.length },
        limitsOpen: !!S.limitsOpen, limRows, toggleLimits: () => this.setState({ limitsOpen: !S.limitsOpen, limDraft: {} }),
        saveLimits: () => { const out = {}; LN.forEach(([k], i) => { const v = parseInt(String(S.limDraft[k] != null ? S.limDraft[k] : AD.LIM[i]).replace(/[^0-9]/g, ''), 10); if (v > 0) out[k] = v; });
          data.presetSourcingStageLimits = out; saveData(); this.setState({ limitsOpen: false, limDraft: {}, log: `Step limits saved — ${LN.map(([k, l]) => `${l} ${out[k] || '—'}d`).join(', ')}` }); } };
    })();
    const pgBtn = (on, off) => `min-width:30px;height:30px;padding:0 6px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;border:1px solid ${on ? '#1C2233' : '#E6E3DD'};background:${on ? '#1C2233' : '#FFFFFF'};color:${on ? '#FFFFFF' : off ? '#B3BCD2' : '#1C2233'};cursor:${off ? 'default' : 'pointer'}`;
    const pages = Array.from({ length: pageCount }, (_, i) => ({
      n: i + 1, aria: `Page ${i + 1}`, current: i === page ? 'page' : 'false', style: pgBtn(i === page, false),
      go: () => this.setState({ page: i })
    }));
    const total = matched.length;
    const table = {
      rows, cols, filters, pages, total,
      sortNote: sk === 'rank' ? 'ranked: ready first, then people × days waiting' : 'sorted by ' + COLS.find(c => c[0] === sk)[1].toLowerCase(),
      rangeLabel: total ? `${page * per + 1}–${Math.min(total, page * per + per)} of ${total}` : '0 of 0',
      perVal: String(per),
      setPer: e => this.setState({ per: Number(e.target.value) || 5, page: 0 }),
      prevOff: page === 0, nextOff: page >= pageCount - 1,
      prevStyle: pgBtn(false, page === 0), nextStyle: pgBtn(false, page >= pageCount - 1),
      prev: () => this.setState({ page: Math.max(0, page - 1) }),
      next: () => this.setState({ page: Math.min(pageCount - 1, page + 1) })
    };
    const emptyText = { ready:'Nothing is ready to sell yet.', over:'Nothing is over the time you allow.', nobody:'Every item has somebody on it.' }[f] || 'Nothing matches.';
    /* ---- demand map, zoomable ---- */
    /* demand map: live items — where they sit (people × days waiting), how much money they represent, and how far along they are */
    const STEPC = [['Asked for', '#EFECE6', '#767F91'], ['Looking', '#DCEAF8', '#1A5A8A'], ['Source found', '#E4E6FA', '#3A3F9B'], ['Priced', '#E4F4EA', '#0F6B43']];
    const shortName = n => n.split(/,|\s(?=\d)/)[0].split(' ').slice(0, 3).join(' ');
    const MAP = LIVE.filter(it => !S.snoozed.includes(it.rank)).map(it => { const q = qtyN(it), p = it.shelf || (costOf(it) ? recPriceOf(it) : 0) || rivalOf(it) || 0;
      return { rank: it.rank, name: shortName(it.name), full: it.name, stage: it.stage, wait: it.wait, askers: it.askers, qty: q, unit: it.qty || '', price: p, value: q * p, known: p > 0, owner: it.owner, move: it.move }; });
    const XM = Math.max(30, Math.ceil((Math.max(0, ...MAP.map(m => m.wait)) + 3) / 5) * 5), YM = Math.max(8, Math.max(0, ...MAP.map(m => m.askers)) + 2);
    if (!this._inner && (this._mx !== XM || this._my !== YM)) { this._mx = XM; this._my = YM; this.state = { ...this.state, vx0: 0, vx1: XM, vy0: 0, vy1: YM }; }
    const st = this.state, sx = 732 / (st.vx1 - st.vx0), sy = 206 / (st.vy1 - st.vy0);
    const X = v => 44 + (v - st.vx0) * sx, Y = v => 222 - (v - st.vy0) * sy;
    const zoom = XM / (st.vx1 - st.vx0);
    const rad = m => m.known ? Math.min(30, 6 + Math.sqrt(m.value / 1e6) * 9) : 7;
    /* Real items sit on the same spot more often than the design's
       sample did -- three asked for on one day by one person each -- so
       a stack is fanned out a few pixels apart rather than drawn as one. */
    const placedB = [];
    const bubbles = MAP.slice().sort((a, b) => rad(b) - rad(a)).map(m => {
      const on = st.sel === m.name, c = STEPC[m.stage], r = rad(m), bx = X(m.wait), by = Y(m.askers);
      /* A bubble that would sit on one already drawn moves out onto a ring
         round its true spot, nearest free place first, so a pile of items
         asked for on the same day reads as a pile, not as one blot. */
      let x = bx, y = by, home = null;
      const hit = (px, py) => placedB.find(p => Math.hypot(p.x - px, p.y - py) < p.r + r + 2);
      const first = hit(x, y);
      if (first) { home = first.home || first;
        search: for (let ring = 1; ring < 8; ring++) { const d = ring * (r + 4), n = Math.max(6, ring * 6);
          for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / n, px = bx + d * Math.cos(a), py = by + d * Math.sin(a);
            if (py - r >= 16 && py + r <= 222 && px - r >= 44 && px + r <= 776 && !hit(px, py)) { x = px; y = py; break search; } } } }
      const me = { x, y, r, home, name: m.name, n: 1 }; if (home) home.n++; placedB.push(me);
      return { name: m.name, me, x: x.toFixed(1), y: y.toFixed(1), r: r.toFixed(1), fill: c[1], stroke: c[2], sw: on ? 3 : 1.5, dash: m.known ? '' : '3 3',
        pick: () => this.setState({ sel: on ? null : m.name }) };
    });
    const TH = { days: 14, people: 4 };
    const hot = m => m.wait >= TH.days && m.askers >= TH.people;
    const top = MAP.slice().sort((a, b) => b.value - a.value).slice(0, 5).map(m => m.name);
    /* A label that would print over one already placed is left off --
       its bubble still names itself on hover -- because two names drawn
       on top of each other read as neither. */
    /* the two lower corner names sit just under the people line, where a
       one-person ask never lands, so they never print over a bubble */
    const qy = Math.min(212, Y(TH.people) + 16);
    const placed = zoom < 1.05 ? [{ x: 776 - 150, y: qy, w: 150 }, { x: 44, y: qy, w: 60 }] : [];
    const labels = bubbles.filter(b => !b.me.home && (zoom >= 1.6 || top.includes(b.name) || MAP.some(m => m.name === b.name && hot(m)) || st.sel === b.name || b.me.n > 1))
      .sort((a, b) => (b.name === st.sel) - (a.name === st.sel) || b.me.n - a.me.n || b.r - a.r)
      .map(b => { const grp = placedB.filter(p => p === b.me || p.home === b.me);
        const text = b.me.n > 1 ? `${b.name} +${b.me.n - 1}` : b.name, w = Math.min(190, text.length * 6.2);
        const x0 = Math.min(...grp.map(p => p.x - p.r)), x1 = Math.max(...grp.map(p => p.x + p.r)), cy = b.me.y;
        /* right of the pile, else left of it, else above it: never across a bubble */
        const tries = [[x1 + 5, cy + 4, 'start', x1 + 5], [x0 - 5, cy + 4, 'end', x0 - 5 - w], [(x0 + x1) / 2, Math.min(...grp.map(p => p.y - p.r)) - 5, 'middle', (x0 + x1) / 2 - w / 2]];
        const ok = ([tx, ty, , left]) => left >= 44 && left + w <= 776 && ty > 18 && ty < 226
          && !placed.some(p => Math.abs(p.y - ty) < 13 && left < p.x + p.w && p.x < left + w)
          && !placedB.some(p => p.x + p.r > left && p.x - p.r < left + w && p.y + p.r > ty - 10 && p.y - p.r < ty + 2);
        const t = tries.find(ok); if (!t) return null; placed.push({ x: t[3], y: t[1], w });
        return { name: text, lx: t[0].toFixed(1), ly: t[1].toFixed(1), anchor: t[2] }; }).filter(Boolean);
    const nice = span => { const raw = span / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p; return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p; };
    const ticks = (a, b, step) => { const out = []; for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(Math.round(v * 100) / 100); return out; };
    const xs = Math.max(1, nice(st.vx1 - st.vx0)), ys = Math.max(0.5, nice(st.vy1 - st.vy0));
    const xTicks = ticks(Math.max(0, st.vx0), st.vx1, xs).map(v => ({ p: X(v).toFixed(1), v: v === 0 ? '0' : v + 'd' }));
    const yTicks = ticks(Math.max(0, st.vy0), st.vy1, ys).map(v => ({ p: Y(v).toFixed(1), ty: (Y(v) + 4).toFixed(1), v: String(v) }));
    const ax0 = X(TH.days), ay1 = Y(TH.people);
    const act = { x: ax0.toFixed(1), y: '-2000', w: Math.max(0, 5000).toFixed(0), h: Math.max(0, ay1 + 2000).toFixed(1) };
    const whole = zoom < 1.05;
    const quads = [{ t: 'Act now', x: 768, y: 32, a: 'end', c: '#7A4A02' }, { t: 'Popular, still new', x: 52, y: 32, a: 'start', c: '#5F6980' },
      { t: 'Few, waiting long', x: 768, y: qy, a: 'end', c: '#5F6980' }, { t: 'Watch', x: 52, y: qy, a: 'start', c: '#767F91' }]
      .map(q => ({ ...q, x: String(q.x), y: String(q.y), style: whole ? '' : 'display:none' }));
    const splits = { vx: ax0.toFixed(1), hy: ay1.toFixed(1) };
    const selM = MAP.find(m => m.name === st.sel);
    const sel = selM ? { name: selM.full, askers: selM.askers, people: `${selM.askers} ${selM.askers === 1 ? 'person' : 'people'}`, wait: selM.wait, qty: selM.unit, stateLabel: STEPC[selM.stage][0],
      value: selM.known ? `≈ UGX ${fmtN(Math.round(selM.value / 1000) * 1000)}` : 'value unknown — no price yet', owner: selM.owner || 'nobody', move: selM.move,
      zone: hot(selM) ? 'Act now' : selM.askers >= TH.people ? 'Popular, still new' : selM.wait >= TH.days ? 'Few, waiting long' : 'Watch',
      pill: `font-size:11px;font-weight:600;color:${STEPC[selM.stage][2]};background:${STEPC[selM.stage][1]};border-radius:999px;padding:1px 7px`,
      dot: `width:10px;height:10px;border-radius:999px;background:${STEPC[selM.stage][2]}` } : {};
    const totV = MAP.reduce((t, m) => t + m.value, 0), totN = MAP.length || 1;
    const stepMoney = STEPC.map((c, k) => { const ms = MAP.filter(m => m.stage === k), v = ms.reduce((t, m) => t + m.value, 0);
      return { label: c[0], v: v ? short(v) : 'no price yet', n: ms.length, unknown: ms.filter(m => !m.known).length, style: `flex:${totV ? Math.max(v / totV, ms.length ? 0.06 : 0) : ms.length / totN} 0 0;min-width:${ms.length ? 64 : 0}px;background:${c[1]};border-top:3px solid ${c[2]};padding:6px 8px;display:${ms.length ? 'flex' : 'none'};flex-direction:column;gap:1px;overflow:hidden`,
        ink: `font-size:11px;font-weight:700;color:${c[2]};white-space:nowrap` }; });
    const hotM = MAP.filter(hot);
    const mapInsight = hotM.length ? `${hotM.length} ${hotM.length === 1 ? 'item needs' : 'items need'} action now — ${hotM.map(m => m.name).join(', ')} · ≈ UGX ${short(hotM.reduce((t, m) => t + m.value, 0))} of demand waiting`
      : 'Nothing in “Act now” — no item has 4+ people waiting 2+ weeks';
    const legendSteps = STEPC.map(c => ({ label: c[0], style: `width:10px;height:10px;border-radius:999px;background:${c[1]};border:1.5px solid ${c[2]};box-sizing:border-box` }));
    const map = {
      bubbles, labels, xTicks, yTicks, act, sel, hasSel: !!selM, quads, splits, stepMoney, mapInsight, hasHot: hotM.length > 0, legendSteps,
      zoomLabel: zoom < 1.05 ? 'whole map' : zoom.toFixed(1) + '×',
      actLabelStyle: 'display:none',
      svgStyle: `display:block;width:100%;max-width:1000px;height:auto;margin:0 auto;font-family:Figtree,sans-serif;touch-action:none;user-select:none;cursor:${this.drag ? 'grabbing' : 'grab'}`,
      zoomIn: () => this.zoomBy(0.6), zoomOut: () => this.zoomBy(1 / 0.6),
      fit: () => this.setState({ vx0: 0, vx1: this._mx || 30, vy0: 0, vy1: this._my || 8 }),
      clearSel: () => this.setState({ sel: null }),
      openSel: () => { const m = MAP.find(x => x.name === st.sel); if (!m) return; this.setState({ task: m.rank, mTab: m.stage === 3 ? 'verdict' : 'overview', holdMode: null, actPage: 0, renaming: null, addAsk: false, mergeOpen: false, hint: null, taskSups: [], taskPrices: {}, taskQS: '', taskTerms: {}, taskTiers: {}, taskOpenSup: null, taskPacks: {}, taskTrans: {}, taskSup: '', taskMin: '', taskShelf: '', dropAsk: false }); },
      dblZoom: e => { const d = this.toData(e); this.zoomBy(0.5, d.x, d.y); },
      panStart: e => { if (e.target.tagName === 'circle') return; const d = this.toData(e); this.drag = { px: d.px, py: d.py, st: { ...this.state } }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} this.forceUpdate(); },
      panMove: e => { if (!this.drag) return; const d = this.toData(e), s0 = this.drag.st;
        const w = s0.vx1 - s0.vx0, h = s0.vy1 - s0.vy0;
        let x0 = s0.vx0 - (d.px - this.drag.px) / 732 * w, y0 = s0.vy0 + (d.py - this.drag.py) / 206 * h;
        x0 = Math.min(Math.max(x0, -1), (this._mx || 30) + 1 - w); y0 = Math.min(Math.max(y0, -0.5), (this._my || 8) + 0.5 - h);
        this.setState({ vx0: x0, vx1: x0 + w, vy0: y0, vy1: y0 + h }); },
      panEnd: () => { if (this.drag) { this.drag = null; this.forceUpdate(); } }
    };
    return { ...table, ...funnel, ...capture, empty: rows.length === 0, emptyText, ...map, ...panels, ph };
  }
}


const OWSV_MARKUP = "<div class=\"ow-sv-root\">\n<div class=\"ow-sv-desk\">\n\n<!-- PAGE HEADER -->\n<header style=\"display: flex; align-items: flex-end; gap: 16px; padding-bottom: 14px; border-bottom: 1px solid #E6E3DD\">\n<div style=\"display: flex; flex-direction: column; gap: 4px\">\n<h1 style=\"margin: 0; font-size: 19px; font-weight: 700; color: #1C2233\">Sourcing</h1>\n<div style=\"color: #5F6980; font-size: 12px\">What people ask for that you don\u2019t sell yet \u2014 and how close each one is to the shelf</div>\n</div>\n<div style=\"margin-left: auto; display: flex; gap: 8px\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{toggleLimits}}\" aria-pressed=\"{{limitsOpen}}\" style=\"height: 34px; padding: 0 12px; border-radius: 9px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; display: flex; align-items: center; gap: 6px\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 6h16M7 12h10M10 18h4\"></path></svg>Stage limits</button>\n</div>\n</header>\n<sc-if value=\"{{limitsOpen}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 10px 14px; border: 1px solid #E6E3DD; border-radius: 8px; background: #FFFFFF\">\n<span style=\"font-size: 12px; font-weight: 700; color: #1C2233\">Days allowed in each step</span>\n<sc-for list=\"{{limRows}}\" as=\"l\" hint-placeholder-count=\"4\"><label style=\"display: flex; align-items: center; gap: 6px; font-size: 12px; color: #5F6980\">{{l.label}}<input type=\"text\" inputmode=\"numeric\" aria-label=\"{{l.label}} days\" value=\"{{l.value}}\" onChange=\"{{l.set}}\" class=\"ow-sv-mono\" style=\"width: 44px; height: 28px; box-sizing: border-box; border: 1px solid #CFCAC1; border-radius: 7px; padding: 0 6px; text-align: right; font-size: 12px\"></label></sc-for>\n<span style=\"margin-left: auto; display: flex; gap: 6px\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{toggleLimits}}\" style=\"height: 30px; padding: 0 12px; border-radius: 8px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; font-size: 12px; font-weight: 600\">Cancel</button><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{saveLimits}}\" style=\"height: 30px; padding: 0 12px; border-radius: 8px; border: 1px solid #1C2233; background: #1C2233; color: #FFFFFF; font-size: 12px; font-weight: 700\">Save limits</button></span>\n</div>\n</sc-if>\n\n<!-- INTAKE: get asks into the funnel -->\n<section aria-label=\"Waiting to enter the funnel\" style=\"background: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 8px\">\n<div style=\"height: 40px; display: flex; align-items: center; gap: 10px; padding: 0 16px; border-bottom: 1px solid #EFECE6\">\n<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#1C2233\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 4h18l-7 8v6l-4 2v-8L3 4z\"></path></svg>\n<span style=\"font-weight: 700; font-size: 14px\">Into the funnel</span>\n<span class=\"ow-sv-mono\" style=\"{{intakeBadge}}\">{{intakeCount}}</span>\n<span style=\"font-size: 11px; color: #767F91\">asks that aren\u2019t being sourced yet</span>\n<span style=\"margin-left: auto; display: flex; gap: 12px; font-size: 11px; color: #5F6980\">\n<span style=\"display: flex; align-items: center; gap: 5px\"><span style=\"width: 8px; height: 8px; border-radius: 999px; background: #3A3F9B\"></span>Quote search</span>\n<span style=\"display: flex; align-items: center; gap: 5px\"><span style=\"width: 8px; height: 8px; border-radius: 999px; background: #1A5A8A\"></span>WhatsApp</span>\n<span style=\"display: flex; align-items: center; gap: 5px\"><span style=\"width: 8px; height: 8px; border-radius: 999px; background: #7A3268\"></span>Counter</span>\n</span>\n</div>\n<div style=\"padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 12px\">\n<div aria-label=\"Inbox\" style=\"display: flex; align-items: flex-start; gap: 8px; min-height: 30px\">\n<span style=\"flex-shrink: 0; height: 30px; display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #5F6980\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5\"></path></svg>Inbox</span>\n<sc-if value=\"{{hasIntake}}\" hint-placeholder-val=\"{{true}}\">\n<span style=\"display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; flex: 1 1 auto\">\n<sc-for list=\"{{inboxShown}}\" as=\"i\" hint-placeholder-count=\"4\">\n<span style=\"display: inline-flex; align-items: center; height: 30px; border: 1px solid #E6E3DD; border-radius: 999px; background: #FFFFFF; max-width: 300px; min-width: 0\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{i.capture}}\" title=\"{{i.text}} \u00b7 {{i.who}} \u00b7 {{i.srcLabel}}, {{i.when}} \u2014 tap to capture\" style=\"display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 4px 0 10px; border: 0; background: transparent; min-width: 0; font: inherit; text-align: left\"><span style=\"{{i.dot}}\"></span><span class=\"ow-sv-ell\" style=\"font-size: 12px; font-weight: 600; color: #1C2233\">{{i.text}}</span><span class=\"ow-sv-ell\" style=\"font-size: 11px; color: #767F91; max-width: 90px\">{{i.who}}</span></button>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{i.dismiss}}\" aria-label=\"Not worth sourcing\" title=\"Not worth sourcing\" style=\"flex-shrink: 0; width: 24px; height: 24px; margin-right: 3px; border: 0; border-radius: 999px; background: transparent; color: #767F91; display: flex; align-items: center; justify-content: center\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M6 6l12 12M18 6L6 18\"></path></svg></button>\n</span>\n</sc-for>\n<sc-if value=\"{{inboxHasMore}}\" hint-placeholder-val=\"{{true}}\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{inboxToggle}}\" style=\"height: 30px; padding: 0 10px; border-radius: 999px; border: 1px dashed #B3BCD2; background: transparent; color: #5F6980; font-size: 11px; font-weight: 600\">{{inboxMore}}</button></sc-if>\n</span>\n</sc-if>\n<sc-if value=\"{{noIntake}}\" hint-placeholder-val=\"{{false}}\"><span style=\"height: 30px; display: flex; align-items: center; gap: 6px; color: #0F6B43; font-size: 12px; font-weight: 600\"><svg width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12l5 5 9-10\"></path></svg>Every ask is in the funnel</span></sc-if>\n</div>\n<div aria-label=\"Capture an ask\" style=\"display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 1fr); border: 1px solid #E6E3DD; border-radius: 8px; background: #FCFBF9\">\n\n<!-- 1 \u00b7 the item -->\n<div style=\"padding: 12px; display: flex; flex-direction: column; gap: 8px; min-width: 0\">\n<span style=\"display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700\"><span style=\"width: 18px; height: 18px; border-radius: 999px; background: #1C2233; color: #FFFFFF; font-size: 10px; display: flex; align-items: center; justify-content: center\">1</span>What do they want?</span>\n<sc-if value=\"{{capNoPick}}\" hint-placeholder-val=\"{{true}}\">\n<div style=\"position: relative\">\n<label style=\"display: flex; align-items: center; gap: 8px; height: 38px; border: 1px solid #1C2233; border-radius: 9px; padding: 0 10px; background: #FFFFFF\">\n<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#767F91\" stroke-width=\"1.8\" stroke-linecap=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><path d=\"M20 20l-4-4\"></path></svg>\n<input type=\"text\" aria-label=\"Item\" placeholder=\"Type the item \u2014 we check what you already have\" value=\"{{capItem}}\" onChange=\"{{setCapItem}}\" style=\"border: 0; outline: 0; font: inherit; font-size: 13px; flex-grow: 1; min-width: 0; background: transparent; color: #1C2233\">\n</label>\n<sc-if value=\"{{capShowMatches}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"margin-top: 4px; border: 1px solid #E6E3DD; border-radius: 8px; background: #FFFFFF; overflow: hidden; box-shadow: 0 1px 2px rgba(27,36,56,.06), 0 6px 20px rgba(27,36,56,.09)\">\n<sc-for list=\"{{capMatches}}\" as=\"m\" hint-placeholder-count=\"3\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{m.pick}}\" style=\"width: 100%; display: grid; grid-template-columns: 74px minmax(0, 1fr); gap: 8px; align-items: center; padding: 8px 10px; border: 0; border-bottom: 1px solid #EFECE6; background: #FFFFFF; text-align: left; font: inherit\">\n<span style=\"{{m.badge}}\">{{m.kindLabel}}</span>\n<span style=\"display: flex; flex-direction: column; min-width: 0\"><span class=\"ow-sv-ell\" style=\"font-size: 12px; font-weight: 600; color: #1C2233\">{{m.name}}</span><span class=\"ow-sv-ell\" style=\"font-size: 11px; color: #5F6980\">{{m.meta}}</span></span>\n</button>\n</sc-for>\n</div>\n</sc-if>\n</div>\n</sc-if>\n<sc-if value=\"{{capHasPick}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"{{capPickStyle}}\">\n<span style=\"{{capPickBadge}}\">{{capPickKind}}</span>\n<span style=\"display: flex; flex-direction: column; min-width: 0; flex-grow: 1\"><span class=\"ow-sv-ell\" style=\"font-size: 13px; font-weight: 700\">{{capPickName}}</span><span class=\"ow-sv-ell\" style=\"font-size: 11px; color: #5F6980\">{{capPickMeta}}</span></span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{capUnpick}}\" aria-label=\"Change item\" style=\"width: 26px; height: 26px; border: 0; background: transparent; color: #767F91; display: flex; align-items: center; justify-content: center\"><svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M6 6l12 12M18 6L6 18\"></path></svg></button>\n</div>\n</sc-if>\n<div style=\"display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 6px; align-items: start\">\n<span style=\"font-size: 11px; font-weight: 600; color: #5F6980; line-height: 24px\">Sold by</span>\n<span style=\"display: flex; flex-wrap: wrap; gap: 4px; align-items: center\">\n<sc-for list=\"{{capUnits}}\" as=\"u\" hint-placeholder-count=\"8\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{u.pick}}\" aria-pressed=\"{{u.pressed}}\" style=\"{{u.style}}\">{{u.label}}</button></sc-for>\n<sc-if value=\"{{capPackable}}\" hint-placeholder-val=\"{{false}}\"><span style=\"display: flex; align-items: center; gap: 4px; font-size: 11px; color: #5F6980\">of<input type=\"text\" inputmode=\"numeric\" aria-label=\"Pack size\" placeholder=\"50\" value=\"{{capPack}}\" onChange=\"{{setCapPack}}\" class=\"ow-sv-mono\" style=\"width: 44px; height: 24px; border: 1px solid #CFCAC1; border-radius: 6px; padding: 0 6px; font-size: 11px; box-sizing: border-box\"></span></sc-if>\n</span>\n</div>\n<div style=\"display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 6px; align-items: start\">\n<span title=\"Sizes, colours, gauges \u2014 each gets its own count\" style=\"font-size: 11px; font-weight: 600; color: #5F6980; line-height: 24px\">Sizes</span>\n<span style=\"display: flex; flex-wrap: wrap; gap: 4px; align-items: center\">\n<sc-for list=\"{{capVarSugg}}\" as=\"v\" hint-placeholder-count=\"3\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{v.toggle}}\" aria-pressed=\"{{v.pressed}}\" style=\"{{v.style}}\">{{v.label}}</button></sc-for>\n<span style=\"display: flex; align-items: center; gap: 2px\"><input type=\"text\" aria-label=\"Another size or colour\" placeholder=\"+ other\" value=\"{{capVarNew}}\" onChange=\"{{setCapVarNew}}\" style=\"width: 72px; height: 24px; border: 1px dashed #B3BCD2; border-radius: 999px; padding: 0 8px; font: inherit; font-size: 11px; box-sizing: border-box; background: #FFFFFF\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{capAddVar}}\" aria-label=\"Add variant\" style=\"width: 24px; height: 24px; border-radius: 999px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; font-weight: 700; font-size: 12px\">+</button></span>\n</span>\n</div>\n<span style=\"display: flex; gap: 6px\">\n<button type=\"button\" class=\"ow-sv-btn\" style=\"height: 28px; padding: 0 10px; border-radius: 9px; border: 1px dashed #B3BCD2; background: #FFFFFF; color: #5F6980; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 5px\"><svg width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"></rect><circle cx=\"9\" cy=\"10\" r=\"2\"></circle><path d=\"M21 16l-5-5-8 8\"></path></svg>Photo</button>\n<input type=\"text\" aria-label=\"Brand or spec\" placeholder=\"Brand, spec, anything they said\" value=\"{{capNote}}\" onChange=\"{{setCapNote}}\" style=\"flex-grow: 1; min-width: 0; height: 28px; border: 1px solid #E6E3DD; border-radius: 9px; padding: 0 8px; font: inherit; font-size: 11px; box-sizing: border-box; background: #FFFFFF\">\n</span>\n</div>\n\n<!-- 2 \u00b7 who asked -->\n<div style=\"padding: 12px; display: flex; flex-direction: column; gap: 8px; border-left: 1px solid #EFECE6; min-width: 0\">\n<span style=\"display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700\"><span style=\"width: 18px; height: 18px; border-radius: 999px; background: #1C2233; color: #FFFFFF; font-size: 10px; display: flex; align-items: center; justify-content: center\">2</span>Who asked?</span>\n<span role=\"group\" aria-label=\"How they asked\" style=\"display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid #E6E3DD; border-radius: 9px; overflow: hidden; background: #FFFFFF\">\n<sc-for list=\"{{capChannels}}\" as=\"ch\" hint-placeholder-count=\"4\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{ch.pick}}\" aria-pressed=\"{{ch.pressed}}\" style=\"{{ch.style}}\"><span style=\"{{ch.dot}}\"></span>{{ch.label}}</button></sc-for>\n</span>\n<sc-if value=\"{{capHasClient}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid #1C2233; border-radius: 9px; background: #FFFFFF\">\n<span style=\"{{capClientAv}}\">{{capClientIni}}</span>\n<span style=\"display: flex; flex-direction: column; min-width: 0; flex-grow: 1\"><span class=\"ow-sv-ell\" style=\"font-size: 13px; font-weight: 700\">{{capClientName}}</span><span class=\"ow-sv-mono ow-sv-ell\" style=\"font-size: 11px; color: #5F6980\">{{capClientPhone}}</span></span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{capClearClient}}\" aria-label=\"Change client\" style=\"width: 26px; height: 26px; border: 0; background: transparent; color: #767F91; display: flex; align-items: center; justify-content: center\"><svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M6 6l12 12M18 6L6 18\"></path></svg></button>\n</div>\n<span style=\"display: flex; flex-wrap: wrap; gap: 4px\"><sc-for list=\"{{capClientFacts}}\" as=\"fct\" hint-placeholder-count=\"3\"><span style=\"{{fct.style}}\">{{fct.label}}</span></sc-for></span>\n</sc-if>\n<sc-if value=\"{{capNoClient}}\" hint-placeholder-val=\"{{true}}\">\n<label style=\"display: flex; align-items: center; gap: 8px; height: 34px; border: 1px solid #CFCAC1; border-radius: 9px; padding: 0 10px; background: #FFFFFF\">\n<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#767F91\" stroke-width=\"1.8\" stroke-linecap=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><path d=\"M20 20l-4-4\"></path></svg>\n<input type=\"text\" aria-label=\"Client\" placeholder=\"Name or phone\" value=\"{{capClientQ}}\" onChange=\"{{setCapClientQ}}\" style=\"border: 0; outline: 0; font: inherit; font-size: 12px; flex-grow: 1; min-width: 0; background: transparent; color: #1C2233\">\n</label>\n<div style=\"display: flex; flex-direction: column; gap: 4px\">\n<span style=\"font-size: 11px; color: #767F91\">{{capClientHead}}</span>\n<div style=\"display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px\">\n<sc-for list=\"{{capClientList}}\" as=\"cl\" hint-placeholder-count=\"4\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{cl.pick}}\" title=\"{{cl.name}} \u00b7 {{cl.tag}}\" style=\"display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 6px; border: 1px solid #E6E3DD; border-radius: 8px; background: #FFFFFF; text-align: left; font: inherit; min-width: 0\">\n<span style=\"{{cl.av}}\">{{cl.ini}}</span>\n<span style=\"display: flex; flex-direction: column; min-width: 0; line-height: 1.1\"><span class=\"ow-sv-ell\" style=\"font-size: 11px; font-weight: 600; color: #1C2233\">{{cl.name}}</span><span class=\"ow-sv-ell\" style=\"{{cl.tagStyle}}\">{{cl.tag}}</span></span>\n</button>\n</sc-for>\n</div>\n<sc-if value=\"{{capCanNew}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px\">\n<input type=\"tel\" aria-label=\"Phone for new client\" placeholder=\"Phone (for when it arrives)\" value=\"{{capPhone}}\" onChange=\"{{setCapPhone}}\" class=\"ow-sv-mono\" style=\"height: 30px; border: 1px solid #E6E3DD; border-radius: 9px; padding: 0 8px; font-size: 11px; box-sizing: border-box; min-width: 0\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{capNewClient}}\" style=\"height: 30px; padding: 0 8px; border-radius: 9px; border: 1px solid #1C2233; background: #FFFFFF; color: #1C2233; font-size: 11px; font-weight: 600; white-space: nowrap\">+ New client</button>\n</div>\n</sc-if>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{capWalkIn}}\" style=\"height: 28px; border: 1px dashed #B3BCD2; border-radius: 9px; background: transparent; color: #5F6980; font-size: 11px; font-weight: 600\">Walk-in, no name</button>\n</div>\n</sc-if>\n</div>\n\n<!-- 3 \u00b7 how many, by when -->\n<div style=\"padding: 12px; display: flex; flex-direction: column; gap: 8px; border-left: 1px solid #EFECE6; min-width: 0\">\n<span style=\"display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700\"><span style=\"width: 18px; height: 18px; border-radius: 999px; background: #1C2233; color: #FFFFFF; font-size: 10px; display: flex; align-items: center; justify-content: center\">3</span>How many, by when?</span>\n<div style=\"display: flex; flex-direction: column; gap: 4px\">\n<sc-for list=\"{{capQtyRows}}\" as=\"q\" hint-placeholder-count=\"1\">\n<div style=\"display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center\">\n<span class=\"ow-sv-ell\" style=\"font-size: 12px; font-weight: 600\">{{q.label}}</span>\n<span style=\"display: flex; align-items: center; border: 1px solid #CFCAC1; border-radius: 9px; overflow: hidden; background: #FFFFFF\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{q.dec}}\" aria-label=\"Fewer\" style=\"width: 28px; height: 30px; border: 0; background: #F7F5F2; color: #1C2233; font-weight: 700\">\u2212</button>\n<input type=\"text\" inputmode=\"numeric\" aria-label=\"{{q.aria}}\" value=\"{{q.value}}\" onChange=\"{{q.set}}\" class=\"ow-sv-mono\" style=\"width: 46px; height: 30px; border: 0; text-align: center; font-size: 12px; font-weight: 600; color: #1C2233; outline: 0\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{q.inc}}\" aria-label=\"More\" style=\"width: 28px; height: 30px; border: 0; background: #F7F5F2; color: #1C2233; font-weight: 700\">+</button>\n<span class=\"ow-sv-mono\" style=\"padding: 0 8px; font-size: 11px; color: #5F6980\">{{capUnitLabel}}</span>\n</span>\n</div>\n</sc-for>\n<span class=\"ow-sv-mono\" style=\"{{capTotalStyle}}\">{{capTotal}}</span>\n</div>\n<div style=\"display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 6px; align-items: center\">\n<span style=\"font-size: 11px; font-weight: 600; color: #5F6980\">Needed</span>\n<span style=\"display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px\"><sc-for list=\"{{capWhens}}\" as=\"w\" hint-placeholder-count=\"4\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{w.pick}}\" aria-pressed=\"{{w.pressed}}\" style=\"{{w.style}}\">{{w.label}}</button></sc-for></span>\n</div>\n<div style=\"display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; align-items: center\">\n<label style=\"display: flex; align-items: center; gap: 6px; height: 30px; border: 1px solid #E6E3DD; border-radius: 9px; padding: 0 8px; background: #FFFFFF\"><span style=\"font-size: 11px; color: #767F91; white-space: nowrap\">Pays up to</span><input type=\"text\" inputmode=\"numeric\" aria-label=\"Most they will pay, UGX\" placeholder=\"UGX\" value=\"{{capMax}}\" onChange=\"{{setCapMax}}\" class=\"ow-sv-mono\" style=\"border: 0; outline: 0; width: 100%; min-width: 0; font-size: 11px; background: transparent\"></label>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{capToggleFollow}}\" aria-pressed=\"{{capFollowPressed}}\" style=\"{{capFollowStyle}}\">{{capFollowLabel}}</button>\n</div>\n</div>\n<div style=\"grid-column: 1 / -1; display: flex; align-items: center; gap: 14px; padding: 8px 12px; border-top: 1px solid #EFECE6; background: #FFFFFF; border-radius: 0 0 8px 8px\">\n<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#767F91\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 4h18l-7 8v6l-4 2v-8L3 4z\"></path></svg>\n<span class=\"ow-sv-ell\" title=\"{{capSummary}}\" style=\"flex: 1 1 auto; font-size: 12px; color: #1C2233\">{{capSummary}}</span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{capSubmit}}\" disabled=\"{{capGoOff}}\" style=\"{{capGoStyle}}\">{{capGoLabel}}</button>\n</div>\n</div>\n</div>\n</section>\n\n<!-- FUNNEL BOARD: cards move by doing each step's job; drag or tap -->\n<section aria-label=\"Funnel\" style=\"position: relative; background: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 8px\">\n<div style=\"height: 44px; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid #EFECE6\">\n<span style=\"font-weight: 700; font-size: 14px\">Funnel</span>\n<span class=\"ow-sv-mono\" style=\"font-size: 12px; color: #5F6980\">{{liveCount}} in motion \u00b7 {{peopleCount}} people waiting</span>\n<div role=\"group\" aria-label=\"Show whose items\" style=\"margin-left: auto; display: flex; align-items: center; gap: 4px\">\n<span style=\"font-size: 11px; color: #767F91; margin-right: 4px\">Whose</span>\n<sc-for list=\"{{boardPeople}}\" as=\"p\" hint-placeholder-count=\"5\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{p.pick}}\" aria-pressed=\"{{p.pressed}}\" style=\"{{p.style}}\"><span style=\"{{p.av}}\">{{p.ini}}</span>{{p.label}}<span class=\"ow-sv-mono\" style=\"font-size: 11px; opacity: .75\">{{p.n}}</span></button>\n</sc-for>\n</div>\n</div>\n<sc-if value=\"{{hasLog}}\" hint-placeholder-val=\"{{false}}\">\n<div role=\"status\" style=\"display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: #F7F5F2; border-bottom: 1px solid #EFECE6; font-size: 12px\">\n<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#0F6B43\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12l5 5 9-10\"></path></svg>\n<span style=\"color: #1C2233\">{{logText}}</span>\n<sc-if value=\"{{canUndo}}\" hint-placeholder-val=\"{{false}}\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{undo}}\" style=\"margin-left: auto; height: 26px; padding: 0 10px; border-radius: 9px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 4px\"><svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M9 14L4 9l5-5\"></path><path d=\"M4 9h11a5 5 0 0 1 0 10h-3\"></path></svg>Undo</button></sc-if>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{clearLog}}\" aria-label=\"Dismiss\" style=\"width: 24px; height: 24px; border: 0; background: transparent; color: #767F91; display: flex; align-items: center; justify-content: center\"><svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M6 6l12 12M18 6L6 18\"></path></svg></button>\n</div>\n</sc-if>\n\n<div style=\"{{boardGrid}}\">\n<sc-for list=\"{{board}}\" as=\"col\" hint-placeholder-count=\"5\">\n<div onDragOver=\"{{col.over}}\" onDrop=\"{{col.drop}}\" style=\"{{col.colStyle}}\">\n<div style=\"display: flex; align-items: center; gap: 6px\">\n<span class=\"ow-sv-mono\" style=\"{{col.numStyle}}\">{{col.n}}</span>\n<span class=\"ow-sv-ell\" style=\"{{col.titleStyle}}\">{{col.title}}</span>\n<span class=\"ow-sv-mono\" style=\"flex-shrink: 0; font-size: 18px; font-weight: 600; color: #1C2233\">{{col.count}}</span>\n</div>\n<div style=\"display: flex; align-items: center; gap: 6px; margin: 6px 0 2px\">\n<span style=\"{{col.healthTrack}}\"><span style=\"{{col.healthFill}}\"></span><span style=\"{{col.healthTick}}\"></span></span>\n<span class=\"ow-sv-mono\" style=\"{{col.healthText}}\">{{col.health}}</span>\n</div>\n<div style=\"{{col.noteStyle}}\">{{col.note}}</div>\n<div style=\"display: flex; flex-direction: column; gap: 8px; min-height: 160px\">\n<sc-for list=\"{{col.cards}}\" as=\"c\" hint-placeholder-count=\"2\">\n<div draggable=\"{{c.draggable}}\" onDragStart=\"{{c.dragStart}}\" onDragEnd=\"{{dragEnd}}\" style=\"{{c.wrapStyle}}\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{c.select}}\" aria-label=\"{{c.aria}}\" style=\"width: 100%; height: 96px; border: 0; background: transparent; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; font: inherit; text-align: left; color: #1C2233\">\n<span style=\"display: flex; align-items: flex-start; gap: 8px; width: 100%\">\n<span style=\"{{c.jobDot}};flex-shrink:0;margin-top:5px\"></span>\n<span title=\"{{c.name}}\" style=\"flex: 1 1 auto; min-width: 0; font-size: 12px; font-weight: 700; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden\">{{c.name}}</span>\n<span title=\"{{c.ownerTitle}}\" style=\"{{c.ownerStyle}}\">{{c.ownerIni}}</span>\n</span>\n<span style=\"display: flex; align-items: center; gap: 6px; width: 100%; min-width: 0; font-size: 11px; color: #5F6980\">\n<svg style=\"flex-shrink: 0\" width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#767F91\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"9\" cy=\"8\" r=\"3.5\"></circle><path d=\"M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5\"></path></svg>\n<b class=\"ow-sv-mono\" style=\"color: #1C2233; flex-shrink: 0\">{{c.askers}}</b><span class=\"ow-sv-mono ow-sv-ell\" style=\"flex: 1 1 auto; min-width: 0\">{{c.qty}}</span>\n</span>\n<span style=\"display: flex; align-items: center; gap: 6px; width: 100%\">\n<span aria-hidden=\"true\" style=\"display: flex; gap: 1px; flex-shrink: 0\"><sc-for list=\"{{c.dayCells}}\" as=\"d\" hint-placeholder-count=\"4\"><span style=\"{{d.style}}\"></span></sc-for></span>\n<span class=\"ow-sv-mono ow-sv-ell\" style=\"{{c.dayTextStyle}}\">{{c.dayText}}</span>\n</span>\n</button>\n<sc-if value=\"{{c.hasHint}}\" hint-placeholder-val=\"{{false}}\"><div style=\"margin: 0 10px 10px; padding: 6px 8px; border-radius: 6px; background: #FEF8F2; color: #7A4A02; font-size: 11px; font-weight: 600\">{{c.hint}}</div></sc-if>\n</div>\n</sc-for>\n<sc-if value=\"{{col.hasMore}}\" hint-placeholder-val=\"{{false}}\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{col.toggleMore}}\" style=\"height: 30px; border-radius: 8px; border: 1px dashed #B3BCD2; background: #FFFFFF; color: #1C2233; font-size: 11px; font-weight: 700\">{{col.moreLabel}}</button></sc-if>\n<sc-if value=\"{{col.empty}}\" hint-placeholder-val=\"{{false}}\"><div style=\"height: 40px; border: 1px dashed #E0DCD4; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #767F91\">{{col.emptyText}}</div></sc-if>\n</div>\n</div>\n</sc-for>\n</div>\n<div style=\"display: flex; align-items: center; gap: 12px; padding: 0 16px 14px; font-size: 12px; color: #5F6980\">\n<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#767F91\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M8 7h8M8 12h8M8 17h8\"></path></svg>\n<span style=\"white-space: nowrap\">Tap a card to work on it \u00b7 3 per step, most urgent first</span>\n<span style=\"flex-grow: 1; height: 6px; border-radius: 3px; background: #EFECE6; display: flex; margin-left: 12px\"><span style=\"width: 19%; background: #0F6B43; border-radius: 3px\"></span></span>\n<span style=\"white-space: nowrap\"><b class=\"ow-sv-mono\" style=\"color: #1C2233\">31</b> asked for \u2192 <b class=\"ow-sv-mono\" style=\"color: #0F6B43\">{{shelfTotal}}</b> made it \u00b7 90 days</span>\n<span class=\"ow-sv-mono\" style=\"white-space: nowrap; padding-left: 12px; border-left: 1px solid #EFECE6\">{{droppedCount}} dropped</span>\n<sc-if value=\"{{hasSnoozed}}\" hint-placeholder-val=\"{{false}}\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{wakeAll}}\" style=\"height: 26px; padding: 0 10px; border-radius: 9px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; font-size: 11px; font-weight: 600; white-space: nowrap\">{{snoozedCount}} snoozed \u00b7 wake</button></sc-if>\n</div>\n\n<!-- ITEM POPUP: the order-preview pattern -->\n<sc-if value=\"{{hasM}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"position: fixed; inset: 0; z-index: 1000\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{closeTask}}\" aria-label=\"Close details\" style=\"position: absolute; inset: 0; width: 100%; height: 100%; border: 0; border-radius: 0; background: rgba(22,32,60,.28); cursor: default\"></button>\n<div role=\"dialog\" aria-label=\"{{m.name}}\" style=\"position: absolute; left: 50%; top: 24px; transform: translateX(-50%); width: min(980px, calc(100vw - 48px)); background: #FFFFFF; border-radius: 12px; box-shadow: 0 1px 2px rgba(27,36,56,.06), 0 6px 20px rgba(27,36,56,.09), 0 24px 60px rgba(22,32,60,.22); display: flex; flex-direction: column; overflow: hidden; max-height: calc(100vh - 48px)\">\n<div style=\"display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid #EFECE6\">\n<span style=\"width: 44px; height: 44px; flex-shrink: 0; border-radius: 8px; background: #F7F5F2; border: 1px dashed #CFCAC1; display: flex; align-items: center; justify-content: center; color: #767F91\"><svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21 8l-9-5-9 5 9 5 9-5z\"></path><path d=\"M3 8v8l9 5 9-5V8\"></path></svg></span>\n<div style=\"display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1 1 auto\">\n<span style=\"display: flex; align-items: center; gap: 8px; min-width: 0\"><span class=\"ow-sv-ell\" style=\"font-size: 17px; font-weight: 700\">{{m.name}}</span><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{vdOpen}}\" style=\"{{vdPill}}\">{{vdPillText}}</button><span style=\"{{mStatePill}}\">{{mStateLabel}}</span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{m.startRename}}\" aria-label=\"Rename item\" title=\"Rename\" style=\"width: 28px; height: 28px; flex-shrink: 0; border: 0; background: transparent; color: #5F6980; display: flex; align-items: center; justify-content: center\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 20h4L19 9l-4-4L4 16v4z\"></path><path d=\"M14 6l4 4\"></path></svg></button></span>\n<span class=\"ow-sv-mono\" style=\"font-size: 12px; color: #5F6980\">{{m.askers}} waiting \u00b7 {{m.qty}} \u00b7 {{m.waitText}}</span>\n</div>\n<span style=\"display: flex; align-items: center; gap: 6px; flex-shrink: 0; white-space: nowrap; font-size: 12px; color: #5F6980\"><span title=\"{{m.ownerTitle}}\" style=\"{{m.ownerStyle}}\">{{m.ownerIni}}</span>{{mOwner}}</span>\n<span style=\"display: flex; flex-shrink: 0; align-items: center; border: 1px solid #E6E3DD; border-radius: 9px; overflow: hidden\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{mPrev}}\" aria-label=\"Previous item\" style=\"width: 30px; height: 32px; border: 0; background: #FFFFFF; color: #1C2233; display: flex; align-items: center; justify-content: center\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M15 6l-6 6 6 6\"></path></svg></button>\n<span class=\"ow-sv-mono\" style=\"padding: 0 6px; font-size: 11px; color: #5F6980; border-left: 1px solid #EFECE6; border-right: 1px solid #EFECE6; height: 32px; display: flex; align-items: center; white-space: nowrap\">{{mPos}}</span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{mNext}}\" aria-label=\"Next item\" style=\"width: 30px; height: 32px; border: 0; background: #FFFFFF; color: #1C2233; display: flex; align-items: center; justify-content: center\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M9 6l6 6-6 6\"></path></svg></button>\n</span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{closeTask}}\" aria-label=\"Close\" style=\"width: 34px; height: 34px; border-radius: 9px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; display: flex; align-items: center; justify-content: center\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M6 6l12 12M18 6L6 18\"></path></svg></button>\n</div>\n<ol aria-label=\"Steps\" style=\"list-style: none; margin: 0; padding: 16px 20px 14px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); background: #FCFBF9; border-bottom: 1px solid #EFECE6\">\n<sc-for list=\"{{mSteps}}\" as=\"st\" hint-placeholder-count=\"5\">\n<li style=\"min-width: 0\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{st.go}}\" title=\"{{st.hint}}\" style=\"width: 100%; border: 0; background: transparent; padding: 0; display: flex; flex-direction: column; gap: 6px; text-align: left; font: inherit; min-width: 0\">\n<span style=\"display: flex; align-items: center; width: 100%\"><span style=\"{{st.dot}}\">{{st.mark}}</span><span style=\"{{st.line}}\"></span></span>\n<span class=\"ow-sv-ell\" style=\"{{st.labelStyle}}\">{{st.label}}</span>\n<span class=\"ow-sv-mono ow-sv-ell\" style=\"{{st.subStyle}}\">{{st.sub}}</span>\n</button>\n</li>\n</sc-for>\n</ol>\n<div style=\"display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border-bottom: 1px solid #EFECE6\">\n<sc-for list=\"{{mKpis}}\" as=\"kp\" hint-placeholder-count=\"5\">\n<div style=\"{{kp.cell}}\"><span style=\"font-size: 11px; color: #767F91; font-weight: 500\">{{kp.label}}</span><span class=\"ow-sv-mono\" style=\"{{kp.valStyle}}\">{{kp.value}}</span><span class=\"ow-sv-ell\" style=\"font-size: 11px; color: #767F91\">{{kp.sub}}</span></div>\n</sc-for>\n</div>\n<div role=\"tablist\" aria-label=\"Item details\" style=\"display: flex; gap: 2px; padding: 0 16px; border-bottom: 1px solid #EFECE6; background: #FFFFFF\">\n<sc-for list=\"{{mTabs}}\" as=\"tb\" hint-placeholder-count=\"5\">\n<button type=\"button\" role=\"tab\" class=\"ow-sv-btn\" onClick=\"{{tb.pick}}\" aria-selected=\"{{tb.selected}}\" style=\"{{tb.style}}\">{{tb.label}}<span class=\"ow-sv-mono\" style=\"{{tb.badgeStyle}}\">{{tb.badge}}</span></button>\n</sc-for>\n</div>\n<div style=\"flex: 1 1 auto; min-height: 0; overflow-y: auto\">\n<sc-if value=\"{{tabOverview}}\" hint-placeholder-val=\"{{true}}\">\n<div style=\"display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 0\">\n<div style=\"padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; border-right: 1px solid #EFECE6\">\n<span style=\"font-size: 11px; font-weight: 700; color: #767F91; letter-spacing: .04em\">NEXT</span>\n<span style=\"font-size: 16px; font-weight: 700; color: #1C2233\">{{m.question}}</span>\n<sc-if value=\"{{m.kAssign}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; flex-direction: column; gap: 5px\">\n<sc-for list=\"{{m.staff}}\" as=\"p\" hint-placeholder-count=\"3\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{p.pick}}\" style=\"{{p.style}}\"><span style=\"{{p.avatar}}\">{{p.ini}}</span>{{p.name}}<span class=\"ow-sv-mono\" style=\"margin-left: auto; font-size: 11px; color: #767F91; font-weight: 400\">{{p.load}}</span></button>\n</sc-for>\n</div>\n</sc-if>\n\n<sc-if value=\"{{m.kSupplier}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; flex-direction: column; gap: 8px\">\n<span style=\"display: flex; align-items: center; gap: 8px\"><span style=\"font-size: 11px; font-weight: 700; color: #767F91; letter-spacing: .04em\">YOUR SUPPLIERS \u00b7 LIKELY TO HAVE IT</span><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{m.askAll}}\" disabled=\"{{m.askAllOff}}\" style=\"{{m.askAllStyle}}\">{{m.askAllLabel}}</button></span>\n<div style=\"display: flex; flex-direction: column; border: 1px solid #E6E3DD; border-radius: 8px; overflow: hidden\">\n<sc-for list=\"{{m.supLikely}}\" as=\"sl\" hint-placeholder-count=\"4\">\n<div style=\"{{sl.rowStyle}}\">\n<span style=\"{{sl.av}}\">{{sl.ini}}</span>\n<span style=\"display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1 1 auto\">\n<span style=\"display: flex; align-items: center; gap: 6px; min-width: 0\"><span class=\"ow-sv-ell\" style=\"font-size: 12px; font-weight: 700\">{{sl.name}}</span><span style=\"{{sl.fitStyle}}\">{{sl.fit}}</span></span>\n<span class=\"ow-sv-ell\" title=\"{{sl.meta}}\" style=\"font-size: 11px; color: #5F6980\">{{sl.line}}</span>\n</span>\n<span style=\"display: flex; align-items: center; gap: 6px; flex-shrink: 0\">\n<span style=\"{{sl.statusStyle}}\">{{sl.status}}</span>\n<span style=\"display: flex; gap: 4px\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{sl.yes}}\" aria-pressed=\"{{sl.yesPressed}}\" style=\"{{sl.yesStyle}}\">Has it</button>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{sl.no}}\" aria-label=\"Doesn\u2019t have it\" style=\"{{sl.noStyle}}\">No</button>\n</span>\n</span>\n</div>\n</sc-for>\n</div>\n<label style=\"display: flex; align-items: center; gap: 8px; height: 34px; border: 1px solid #CFCAC1; border-radius: 9px; padding: 0 10px; background: #FFFFFF\">\n<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#767F91\" stroke-width=\"1.8\" stroke-linecap=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><path d=\"M20 20l-4-4\"></path></svg>\n<input type=\"text\" aria-label=\"Search suppliers\" placeholder=\"Search all your suppliers \u2014 name, phone or area\" value=\"{{supQ}}\" onChange=\"{{setSupQ}}\" style=\"border: 0; outline: 0; font: inherit; font-size: 12px; flex-grow: 1; min-width: 0; background: transparent; color: #1C2233\">\n</label>\n<sc-if value=\"{{m.hasSupHits}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; flex-direction: column; border: 1px solid #E6E3DD; border-radius: 8px; overflow: hidden\">\n<sc-for list=\"{{m.supHits}}\" as=\"h\" hint-placeholder-count=\"2\">\n<div style=\"{{h.rowStyle}}\">\n<span style=\"{{h.av}}\">{{h.ini}}</span>\n<span style=\"display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto\"><span class=\"ow-sv-ell\" style=\"font-size: 12px; font-weight: 700\">{{h.name}}</span><span class=\"ow-sv-ell\" style=\"font-size: 11px; color: #5F6980\">{{h.line}}</span></span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{h.pick}}\" aria-pressed=\"{{h.pressed}}\" style=\"{{h.btnStyle}}\">{{h.btnLabel}}</button>\n</div>\n</sc-for>\n</div>\n</sc-if>\n<sc-if value=\"{{m.canCreate}}\" hint-placeholder-val=\"{{false}}\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{openNewSup}}\" style=\"height: 32px; border-radius: 9px; border: 1px dashed #1C2233; background: #FFFFFF; color: #1C2233; font-size: 12px; font-weight: 700; text-align: left; padding: 0 10px\">+ Add \u201c{{supQ}}\u201d as a new supplier</button>\n</sc-if>\n<sc-if value=\"{{newSupOpen}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid #1C2233; border-radius: 8px; background: #FCFBF9\">\n<span style=\"font-size: 11px; font-weight: 700; color: #767F91; letter-spacing: .04em\">NEW SUPPLIER \u00b7 SAVED TO YOUR SUPPLIERS</span>\n<div style=\"display: grid; grid-template-columns: minmax(0, 1fr) 150px; gap: 6px\">\n<input type=\"text\" aria-label=\"Supplier name\" placeholder=\"Business name\" value=\"{{nsName}}\" onChange=\"{{setNsName}}\" style=\"height: 32px; border: 1px solid #CFCAC1; border-radius: 8px; padding: 0 8px; font: inherit; font-size: 12px; font-weight: 600; box-sizing: border-box; min-width: 0\">\n<input type=\"tel\" aria-label=\"Phone\" placeholder=\"Phone\" value=\"{{nsPhone}}\" onChange=\"{{setNsPhone}}\" class=\"ow-sv-mono\" style=\"height: 32px; border: 1px solid #CFCAC1; border-radius: 8px; padding: 0 8px; font-size: 12px; box-sizing: border-box; min-width: 0\">\n</div>\n<span style=\"display: flex; flex-direction: column; gap: 4px\">\n<span style=\"font-size: 11px; font-weight: 600; color: #5F6980\">Where</span>\n<span style=\"display: flex; flex-wrap: wrap; gap: 4px; align-items: center\"><sc-for list=\"{{nsLocs}}\" as=\"l\" hint-placeholder-count=\"5\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{l.pick}}\" aria-pressed=\"{{l.pressed}}\" style=\"{{l.style}}\">{{l.label}}</button></sc-for><input type=\"text\" aria-label=\"Other area\" placeholder=\"other area\" value=\"{{nsLocOther}}\" onChange=\"{{setNsLocOther}}\" style=\"width: 96px; height: 24px; border: 1px dashed #B3BCD2; border-radius: 999px; padding: 0 8px; font: inherit; font-size: 11px; box-sizing: border-box; background: #FFFFFF\"></span>\n</span>\n<span style=\"display: flex; flex-direction: column; gap: 4px\">\n<span style=\"font-size: 11px; font-weight: 600; color: #5F6980\">What kind of supplier</span>\n<span style=\"display: flex; flex-wrap: wrap; gap: 4px\"><sc-for list=\"{{nsKinds}}\" as=\"kd\" hint-placeholder-count=\"4\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{kd.pick}}\" aria-pressed=\"{{kd.pressed}}\" style=\"{{kd.style}}\">{{kd.label}}</button></sc-for></span>\n<span style=\"font-size: 11px; font-weight: 600; color: #5F6980\">What they sell</span>\n<span style=\"display: flex; flex-wrap: wrap; gap: 4px\"><sc-for list=\"{{nsCats}}\" as=\"ct\" hint-placeholder-count=\"6\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{ct.pick}}\" aria-pressed=\"{{ct.pressed}}\" style=\"{{ct.style}}\">{{ct.label}}</button></sc-for></span>\n</span>\n<span style=\"display: flex; align-items: center; gap: 6px\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{saveNewSup}}\" disabled=\"{{nsOff}}\" style=\"{{nsSaveStyle}}\">Save \u00b7 they have it</button>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{cancelNewSup}}\" style=\"height: 30px; padding: 0 10px; border-radius: 8px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #5F6980; font-size: 11px\">Cancel</button>\n<span style=\"font-size: 10px; color: #767F91\">{{nsHint}}</span>\n</span>\n</div>\n</sc-if>\n</div>\n</sc-if>\n\n<sc-if value=\"{{m.kPrice}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; flex-direction: column; gap: 8px\">\n<div style=\"display: flex; align-items: center; gap: 6px; flex-wrap: wrap\">\n<span style=\"font-size: 11px; font-weight: 700; color: #767F91; letter-spacing: .04em\">IF WE BUY</span>\n<sc-for list=\"{{m.scen}}\" as=\"sc\" hint-placeholder-count=\"3\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{sc.pick}}\" aria-pressed=\"{{sc.pressed}}\" style=\"{{sc.style}}\">{{sc.label}}</button></sc-for>\n<input type=\"text\" inputmode=\"numeric\" aria-label=\"Another quantity\" placeholder=\"other\" value=\"{{taskQSText}}\" onChange=\"{{setTaskQS}}\" class=\"ow-sv-mono\" style=\"width: 58px; height: 26px; border: 1px dashed #B3BCD2; border-radius: 999px; padding: 0 8px; font-size: 11px; box-sizing: border-box\">\n</div>\n<div style=\"display: flex; flex-direction: column; border: 1px solid #E6E3DD; border-radius: 8px; overflow: hidden\">\n<sc-for list=\"{{m.ladders}}\" as=\"ld\" hint-placeholder-count=\"2\">\n<div style=\"{{ld.wrapStyle}}\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{ld.toggle}}\" aria-expanded=\"{{ld.expanded}}\" style=\"width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 0; background: transparent; font: inherit; text-align: left\">\n<span style=\"{{ld.chev}}\">\u203a</span>\n<span style=\"display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto\"><span class=\"ow-sv-ell\" style=\"font-size: 12px; font-weight: 700; color: #1C2233\">{{ld.name}}</span><span class=\"ow-sv-mono ow-sv-ell\" style=\"font-size: 10px; color: #767F91\">{{ld.summary}}</span></span>\n<span style=\"display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0\"><span class=\"ow-sv-mono\" style=\"{{ld.atStyle}}\">{{ld.at}}</span><span style=\"{{ld.tagStyle}}\">{{ld.tag}}</span></span>\n</button>\n<sc-if value=\"{{ld.open}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; flex-direction: column; gap: 5px; padding: 0 10px 10px 28px\">\n<div style=\"display: grid; grid-template-columns: 78px minmax(0, 1fr) 26px; gap: 4px 6px; align-items: center; font-size: 10px; font-weight: 700; color: #767F91\"><span>From qty</span><span>UGX a unit</span><span></span></div>\n<sc-for list=\"{{ld.tiers}}\" as=\"t\" hint-placeholder-count=\"2\">\n<div style=\"display: grid; grid-template-columns: 78px minmax(0, 1fr) 26px; gap: 4px 6px; align-items: center\">\n<input type=\"text\" inputmode=\"numeric\" aria-label=\"{{t.qAria}}\" value=\"{{t.q}}\" onChange=\"{{t.setQ}}\" class=\"ow-sv-mono\" style=\"{{t.qStyle}}\">\n<input type=\"text\" inputmode=\"numeric\" aria-label=\"{{t.pAria}}\" placeholder=\"price\" value=\"{{t.p}}\" onChange=\"{{t.setP}}\" class=\"ow-sv-mono\" style=\"{{t.pStyle}}\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{t.remove}}\" aria-label=\"Remove this price break\" style=\"{{t.rmStyle}}\">\u00d7</button>\n</div>\n</sc-for>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{ld.addTier}}\" style=\"align-self: flex-start; height: 24px; padding: 0 8px; border-radius: 7px; border: 1px dashed #B3BCD2; background: #FFFFFF; color: #1C2233; font-size: 11px; font-weight: 600\">+ price break</button>\n<div style=\"display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; padding-top: 4px\">\n<label style=\"display: flex; align-items: center; gap: 6px; height: 28px; border: 1px solid #E6E3DD; border-radius: 7px; padding: 0 8px; background: #FFFFFF\"><span style=\"font-size: 10px; color: #767F91; white-space: nowrap\">Sold in</span><input type=\"text\" aria-label=\"Pack\" placeholder=\"e.g. bundle of 10\" value=\"{{ld.pack}}\" onChange=\"{{ld.setPack}}\" style=\"border: 0; outline: 0; font: inherit; font-size: 11px; width: 100%; min-width: 0; background: transparent\"></label>\n<label style=\"display: flex; align-items: center; gap: 6px; height: 28px; border: 1px solid #E6E3DD; border-radius: 7px; padding: 0 8px; background: #FFFFFF\"><span style=\"font-size: 10px; color: #767F91; white-space: nowrap\">Transport</span><input type=\"text\" inputmode=\"numeric\" aria-label=\"Transport cost\" placeholder=\"UGX\" value=\"{{ld.trans}}\" onChange=\"{{ld.setTrans}}\" class=\"ow-sv-mono\" style=\"border: 0; outline: 0; font-size: 11px; width: 100%; min-width: 0; background: transparent\"></label>\n</div>\n<div style=\"display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 5px 8px; align-items: center; padding-top: 2px\">\n<span style=\"font-size: 10px; font-weight: 700; color: #767F91\">Delivers</span><span style=\"display: flex; gap: 3px; flex-wrap: wrap\"><sc-for list=\"{{ld.leads}}\" as=\"o\" hint-placeholder-count=\"4\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{o.pick}}\" aria-pressed=\"{{o.pressed}}\" style=\"{{o.style}}\">{{o.label}}</button></sc-for></span>\n<span style=\"font-size: 10px; font-weight: 700; color: #767F91\">Quote</span><span style=\"display: flex; gap: 3px; flex-wrap: wrap\"><sc-for list=\"{{ld.valids}}\" as=\"o\" hint-placeholder-count=\"3\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{o.pick}}\" aria-pressed=\"{{o.pressed}}\" style=\"{{o.style}}\">{{o.label}}</button></sc-for></span>\n</div>\n</div>\n</sc-if>\n</div>\n</sc-for>\n</div>\n<sc-if value=\"{{m.hasCompare}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; flex-direction: column; gap: 8px; padding: 10px; border-radius: 8px; border: 1px solid #E6E3DD; background: #FFFFFF\">\n<span style=\"display: flex; align-items: center; gap: 10px\"><span style=\"font-size: 10px; font-weight: 700; color: #767F91; letter-spacing: .04em\">PRICE BREAKS</span><span style=\"display: flex; gap: 10px; margin-left: auto\"><sc-for list=\"{{m.chartKey}}\" as=\"ky\" hint-placeholder-count=\"2\"><span style=\"display: flex; align-items: center; gap: 4px; font-size: 10px; color: #5F6980\"><span style=\"{{ky.sw}}\"></span>{{ky.name}}</span></sc-for></span></span>\n<svg width=\"100%\" height=\"118\" viewBox=\"0 0 360 118\" role=\"img\" aria-label=\"{{m.chartAria}}\" style=\"display: block; font-family: IBM Plex Mono, monospace\">\n<line x1=\"36\" y1=\"98\" x2=\"350\" y2=\"98\" stroke=\"#E0DCD4\" stroke-width=\"1\"></line>\n<text x=\"32\" y=\"16\" text-anchor=\"end\" font-size=\"9\" fill=\"#767F91\">{{m.yHi}}</text>\n<text x=\"32\" y=\"98\" text-anchor=\"end\" font-size=\"9\" fill=\"#767F91\">{{m.yLo}}</text>\n<line x1=\"{{m.markX}}\" y1=\"6\" x2=\"{{m.markX}}\" y2=\"98\" stroke=\"#1C2233\" stroke-width=\"1.5\" stroke-dasharray=\"3 3\"></line>\n<text x=\"{{m.markX}}\" y=\"112\" text-anchor=\"middle\" font-size=\"9\" font-weight=\"600\" fill=\"#1C2233\">{{m.markLabel}}</text>\n<text x=\"36\" y=\"112\" text-anchor=\"start\" font-size=\"9\" fill=\"#767F91\">1</text>\n<text x=\"350\" y=\"112\" text-anchor=\"end\" font-size=\"9\" fill=\"#767F91\">{{m.xMax}}</text>\n<sc-for list=\"{{m.lines}}\" as=\"ln\" hint-placeholder-count=\"2\"><polyline points=\"{{ln.pts}}\" fill=\"none\" stroke=\"{{ln.col}}\" stroke-width=\"2\" stroke-linejoin=\"round\"></polyline></sc-for>\n<sc-for list=\"{{m.hitDots}}\" as=\"hd\" hint-placeholder-count=\"2\"><circle cx=\"{{hd.x}}\" cy=\"{{hd.y}}\" r=\"4\" fill=\"#FFFFFF\" stroke=\"{{hd.col}}\" stroke-width=\"2\"></circle></sc-for>\n</svg>\n<div style=\"display: grid; grid-template-columns: minmax(0, 1fr) 62px 62px 56px 40px; gap: 0 6px; font-size: 10px; font-weight: 700; color: #767F91; padding-bottom: 4px; border-bottom: 1px solid #E0DCD4\"><span>At {{m.qAt}}</span><span style=\"text-align: right\">Unit</span><span style=\"text-align: right\">Landed</span><span style=\"text-align: right\">Total</span><span>Days</span></div>\n<sc-for list=\"{{m.table}}\" as=\"tr\" hint-placeholder-count=\"2\">\n<div style=\"{{tr.rowStyle}}\"><span style=\"display: flex; align-items: center; gap: 5px; min-width: 0\"><span style=\"{{tr.sw}}\"></span><span class=\"ow-sv-ell\" style=\"font-weight: 700\">{{tr.name}}</span><span style=\"{{tr.badgeStyle}}\">{{tr.badge}}</span></span><span class=\"ow-sv-mono\" style=\"text-align: right\">{{tr.unit}}</span><span class=\"ow-sv-mono\" style=\"text-align: right; font-weight: 700\">{{tr.landed}}</span><span class=\"ow-sv-mono\" style=\"text-align: right\">{{tr.total}}</span><span class=\"ow-sv-mono\" style=\"font-size: 10px; color: #5F6980\">{{tr.lead}}</span></div>\n</sc-for>\n<sc-if value=\"{{m.hasTip}}\" hint-placeholder-val=\"{{false}}\"><div style=\"display: flex; align-items: flex-start; gap: 6px; padding: 6px 8px; border-radius: 6px; background: #F6E4F1; color: #7A3268; font-size: 11px; font-weight: 600\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" style=\"flex-shrink: 0; margin-top: 1px\"><path d=\"M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z\"></path></svg><span>{{m.tip}}</span><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{m.tipGo}}\" style=\"margin-left: auto; flex-shrink: 0; height: 22px; padding: 0 8px; border-radius: 6px; border: 1px solid #7A3268; background: #FFFFFF; color: #7A3268; font-size: 10px; font-weight: 700\">See {{m.tipQ}}</button></div></sc-if>\n<span style=\"{{m.compareNoteStyle}}\">{{m.compareNote}}</span>\n</div>\n</sc-if>\n</div>\n</sc-if>\n\n<sc-if value=\"{{m.kList}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; flex-direction: column; gap: 6px\">\n<span style=\"position: relative; display: block; height: 16px\">\n<span style=\"position: absolute; left: 0; right: 0; top: 6px; height: 4px; border-radius: 2px; background: #EFECE6\"></span>\n<span style=\"{{m.gainBar}}\"></span><span style=\"{{m.costDot}}\"></span><span style=\"{{m.shelfDot}}\"></span><span style=\"{{m.rivalDot}}\"></span>\n</span>\n<span class=\"ow-sv-mono\" style=\"display: flex; justify-content: space-between; font-size: 10px; color: #5F6980\"><span>cost {{m.cost}}</span><span style=\"color: #8E2A22\">rivals {{m.rival}}</span></span>\n<label style=\"display: flex; align-items: center; gap: 6px; height: 32px; border: 1px solid #CFCAC1; border-radius: 9px; padding: 0 8px\"><span style=\"font-size: 11px; color: #767F91\">Sell at</span><input type=\"text\" inputmode=\"numeric\" aria-label=\"Shelf price, UGX\" value=\"{{taskShelf}}\" onChange=\"{{setTaskShelf}}\" class=\"ow-sv-mono\" style=\"border: 0; outline: 0; font-size: 12px; font-weight: 600; color: #1C2233; flex-grow: 1; min-width: 0; background: transparent\"></label>\n<span style=\"display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; font-size: 11px; color: #5F6980\">\n<span>Per unit</span><span class=\"ow-sv-mono\" style=\"{{m.marginStyle}}\">{{m.margin}}</span>\n<span>On {{m.qty}} asked</span><span class=\"ow-sv-mono\" style=\"{{m.marginStyle}}\">{{m.profit}}</span>\n<span>Cash to stock</span><span class=\"ow-sv-mono\" style=\"color: #1C2233; font-weight: 600\">{{m.cash}}</span>\n</span>\n</div>\n</sc-if>\n\n<sc-if value=\"{{m.hasGo}}\" hint-placeholder-val=\"{{true}}\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{m.go}}\" disabled=\"{{m.goOff}}\" style=\"{{m.goStyle}}\">{{m.goLabel}}</button>\n</sc-if>\n<span style=\"font-size: 11px; color: #767F91\">{{m.nextNote}}</span>\n\n</div>\n<div style=\"padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; background: #FFFFFF\">\n\n<sc-if value=\"{{m.renaming}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; flex-direction: column; gap: 6px; padding: 8px; border-radius: 8px; background: #F7F5F2\">\n<input type=\"text\" aria-label=\"Item name\" value=\"{{renameVal}}\" onChange=\"{{setRenameVal}}\" style=\"height: 32px; border: 1px solid #1C2233; border-radius: 8px; padding: 0 8px; font: inherit; font-size: 12px; font-weight: 600; color: #1C2233; box-sizing: border-box; width: 100%\">\n<sc-if value=\"{{m.dupHit}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; flex-direction: column; gap: 4px; padding: 6px 8px; border-radius: 6px; background: #FEF8F2; border: 1px solid #E6E3DD\">\n<span style=\"font-size: 11px; color: #7A4A02; font-weight: 600\">Already in the funnel:</span>\n<span class=\"ow-sv-ell\" style=\"font-size: 11px; color: #1C2233; font-weight: 600\">{{m.dupName}}</span>\n<span style=\"font-size: 10px; color: #5F6980\">{{m.dupMeta}}</span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{m.dupMerge}}\" style=\"height: 26px; border-radius: 7px; border: 1px solid #1C2233; background: #1C2233; color: #FFFFFF; font-size: 11px; font-weight: 600\">Merge the two instead</button>\n</div>\n</sc-if>\n<span style=\"display: flex; gap: 4px\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{m.saveRename}}\" disabled=\"{{m.renameOff}}\" style=\"{{m.renameStyle}}\">Save name</button>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{cancelRename}}\" style=\"height: 28px; padding: 0 10px; border-radius: 7px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #5F6980; font-size: 11px\">Cancel</button>\n</span>\n<span style=\"font-size: 10px; color: #767F91\">Keeps its step, research and everyone waiting</span>\n</div>\n</sc-if>\n<sc-if value=\"{{m.hasFormer}}\" hint-placeholder-val=\"{{false}}\"><span style=\"font-size: 10px; color: #767F91\">was \u201c{{m.former}}\u201d</span></sc-if>\n<div style=\"display: flex; align-items: center; gap: 6px\">\n<span style=\"display: flex; flex-shrink: 0\">\n<sc-for list=\"{{m.askAv}}\" as=\"a\" hint-placeholder-count=\"3\"><span title=\"{{a.title}}\" style=\"{{a.style}}\">{{a.ini}}</span></sc-for>\n</span>\n<span class=\"ow-sv-mono ow-sv-ell\" style=\"font-size: 11px; color: #5F6980; flex: 1 1 auto; min-width: 0\">{{m.askers}} \u00b7 {{m.qty}}</span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{m.toggleAsk}}\" style=\"{{m.askBtnStyle}}\">+ Ask</button>\n</div>\n<sc-if value=\"{{m.addingAsk}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; flex-direction: column; gap: 5px; padding: 8px; border-radius: 8px; background: #F7F5F2\">\n<span style=\"font-size: 11px; font-weight: 600; color: #5F6980\">Who else wants it?</span>\n<span style=\"display: flex; flex-wrap: wrap; gap: 4px\"><sc-for list=\"{{m.askRegs}}\" as=\"r\" hint-placeholder-count=\"4\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{r.pick}}\" aria-pressed=\"{{r.pressed}}\" style=\"{{r.style}}\">{{r.label}}</button></sc-for></span>\n<input type=\"text\" aria-label=\"Another client\" placeholder=\"Or type a name\" value=\"{{askWho}}\" onChange=\"{{setAskWho}}\" style=\"height: 28px; border: 1px solid #E6E3DD; border-radius: 7px; padding: 0 8px; font: inherit; font-size: 11px; box-sizing: border-box; width: 100%; background: #FFFFFF\">\n<span style=\"display: flex; gap: 4px; align-items: center\">\n<input type=\"text\" inputmode=\"numeric\" aria-label=\"How many\" placeholder=\"How many\" value=\"{{askQty}}\" onChange=\"{{setAskQty}}\" class=\"ow-sv-mono\" style=\"width: 70px; height: 28px; border: 1px solid #E6E3DD; border-radius: 7px; padding: 0 8px; font-size: 11px; box-sizing: border-box; background: #FFFFFF\">\n<span class=\"ow-sv-mono\" style=\"font-size: 11px; color: #5F6980\">{{m.unit}}</span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{m.addAsk}}\" disabled=\"{{m.askOff}}\" style=\"{{m.askGoStyle}}\">{{m.askGoLabel}}</button>\n</span>\n<sc-if value=\"{{m.askRepeat}}\" hint-placeholder-val=\"{{false}}\"><span style=\"font-size: 10px; font-weight: 600; color: #7A4A02\">{{m.askRepeatText}}</span></sc-if>\n</div>\n</sc-if>\n\n<div style=\"display: flex; flex-wrap: wrap; gap: 4px; padding-top: 8px; border-top: 1px solid #EFECE6\"><sc-for list=\"{{mKnown}}\" as=\"k\" hint-placeholder-count=\"4\"><span title=\"{{k.label}}\" style=\"{{k.chip}}\"><span style=\"{{k.box}}\"></span>{{k.short}}</span></sc-for></div>\n<sc-if value=\"{{m.mergeOpen}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; flex-direction: column; gap: 4px; padding: 8px; border-radius: 8px; background: #F7F5F2\">\n<span style=\"font-size: 11px; font-weight: 600; color: #5F6980\">Same thing as\u2026? Asks join; the further step wins.</span>\n<sc-for list=\"{{m.mergeTargets}}\" as=\"mt\" hint-placeholder-count=\"3\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{mt.pick}}\" style=\"display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 8px; border-radius: 7px; border: 1px solid #E6E3DD; background: #FFFFFF; font: inherit; text-align: left\"><span class=\"ow-sv-ell\" style=\"flex-grow: 1; font-size: 11px; font-weight: 600; color: #1C2233\">{{mt.name}}</span><span style=\"font-size: 10px; color: #767F91; white-space: nowrap\">{{mt.meta}}</span></button></sc-for>\n</div>\n</sc-if>\n<sc-if value=\"{{m.askDrop}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; flex-direction: column; gap: 4px; padding: 8px; border-radius: 8px; background: #F7F5F2\">\n<span style=\"font-size: 11px; font-weight: 600; color: #5F6980\">Why drop it? It\u2019s kept, not deleted.</span>\n<sc-for list=\"{{m.reasons}}\" as=\"rs\" hint-placeholder-count=\"4\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{rs.pick}}\" style=\"height: 26px; text-align: left; padding: 0 8px; border-radius: 7px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; font-size: 11px\">{{rs.label}}</button></sc-for>\n</div>\n</sc-if>\n<div style=\"display: flex; flex-direction: column; gap: 6px; padding-top: 8px; border-top: 1px solid #EFECE6\">\n<div style=\"display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px\">\n<button type=\"button\" class=\"ow-sv-btn ow-sv-ell\" onClick=\"{{m.message}}\" title=\"Draft a message to everyone waiting\" style=\"height: 28px; padding: 0 4px; border-radius: 7px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; font-size: 11px; font-weight: 600\">Message</button>\n<button type=\"button\" class=\"ow-sv-btn ow-sv-ell\" onClick=\"{{m.toggleMerge}}\" title=\"Merge with another card\" style=\"height: 28px; padding: 0 4px; border-radius: 7px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #5F6980; font-size: 11px\">Merge</button>\n<button type=\"button\" class=\"ow-sv-btn ow-sv-ell\" onClick=\"{{m.toggleDrop}}\" title=\"Drop, with a reason\" style=\"height: 28px; padding: 0 4px; border-radius: 7px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #5F6980; font-size: 11px\">Drop</button>\n</div>\n<span style=\"display: flex; align-items: center; gap: 12px\"><sc-if value=\"{{m.canBack}}\" hint-placeholder-val=\"{{false}}\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{m.back}}\" style=\"align-self: flex-start; height: 24px; border: 0; background: transparent; padding: 0; font-size: 11px; color: #5F6980; text-decoration: underline\">\u2190 Back a step</button></sc-if><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{m.snooze}}\" title=\"Hide it for 2 weeks; it returns by itself\" style=\"margin-left: auto; height: 24px; border: 0; background: transparent; padding: 0; font-size: 11px; color: #5F6980; text-decoration: underline\">Snooze 2 weeks</button></span>\n</div>\n\n</div>\n</div>\n</sc-if>\n\n<sc-if value=\"{{tabVerdict}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 16px\">\n<div style=\"{{vd.banner}}\">\n<svg width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" aria-hidden=\"true\" style=\"flex-shrink: 0\"><circle cx=\"32\" cy=\"32\" r=\"26\" fill=\"none\" stroke=\"#EFECE6\" stroke-width=\"7\"></circle><circle cx=\"32\" cy=\"32\" r=\"26\" fill=\"none\" stroke=\"{{vd.col}}\" stroke-width=\"7\" stroke-linecap=\"round\" stroke-dasharray=\"{{vd.dash}}\" transform=\"rotate(-90 32 32)\"></circle><text x=\"32\" y=\"37\" text-anchor=\"middle\" font-size=\"16\" font-weight=\"700\" fill=\"#1C2233\" font-family=\"IBM Plex Mono, monospace\">{{vd.score}}</text></svg>\n<div style=\"display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1 1 auto\">\n<span style=\"font-size: 11px; font-weight: 700; color: #767F91; letter-spacing: .04em\">VERDICT</span>\n<span style=\"{{vd.titleStyle}}\">{{vd.title}}</span>\n<span style=\"font-size: 12px; color: #1C2233; line-height: 1.4\">{{vd.why}}</span>\n<div style=\"display: flex; flex-direction: column; gap: 6px; padding-top: 8px; border-top: 1px solid rgba(28,34,51,.1)\">\n<span style=\"display: flex; align-items: center; gap: 8px\"><span style=\"{{vd.confPill}}\">{{vd.confLabel}}</span><span style=\"font-size: 11px; color: #5F6980\">{{vd.confWhy}}</span></span>\n<div style=\"display: flex; gap: 6px; flex-wrap: wrap\">\n<sc-for list=\"{{vd.ev}}\" as=\"e\" hint-placeholder-count=\"3\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{e.go}}\" title=\"{{e.hint}}\" style=\"{{e.style}}\">\n<span style=\"font-size: 11px; font-weight: 700\">{{e.label}}</span>\n<span style=\"display: flex; gap: 3px\"><sc-for list=\"{{e.dots}}\" as=\"d\" hint-placeholder-count=\"3\"><span style=\"{{d.style}}\"></span></sc-for></span>\n<span class=\"ow-sv-mono\" style=\"{{e.countStyle}}\">{{e.count}}</span>\n</button>\n</sc-for>\n</div>\n</div>\n</div>\n<div role=\"group\" aria-label=\"Decision\" style=\"display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; width: 220px; padding-left: 16px; border-left: 1px solid rgba(28,34,51,.12)\">\n<span style=\"font-size: 10px; font-weight: 700; color: #767F91; letter-spacing: .04em\">YOUR DECISION</span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{vd.goMain}}\" disabled=\"{{vd.mainOff}}\" style=\"{{vd.mainStyle}}\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12l5 5 9-10\"></path></svg>{{vd.mainLabel}}</button>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{vd.special}}\" style=\"height: 32px; display: flex; align-items: center; gap: 8px; padding: 0 12px; border-radius: 9px; border: 1px solid #CFCAC1; background: #FFFFFF; color: #1C2233; font-size: 12px; font-weight: 600\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"8\"></circle><path d=\"M12 8v4l3 2\"></path></svg>Special order only</button>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{vd.pass}}\" style=\"height: 32px; display: flex; align-items: center; gap: 8px; padding: 0 12px; border-radius: 9px; border: 1px solid #CFCAC1; background: #FFFFFF; color: #8E2A22; font-size: 12px; font-weight: 600\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M6 6l12 12M18 6L6 18\"></path></svg>Don\u2019t stock</button>\n</div>\n</div>\n<sc-if value=\"{{pl.ok}}\" hint-placeholder-val=\"{{true}}\">\n<div style=\"display: flex; flex-direction: column; gap: 10px\">\n<span style=\"display: flex; align-items: baseline; gap: 8px\"><span style=\"font-size: 11px; font-weight: 700; color: #767F91; letter-spacing: .04em\">THE PLAN</span><span style=\"font-size: 11px; color: #767F91\">what to do if you go ahead</span></span>\n<div style=\"display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px\">\n\n<div style=\"border: 1px solid #E6E3DD; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px\">\n<span style=\"display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #5F6980\"><span style=\"width: 20px; height: 20px; border-radius: 6px; background: #FDE8E4; color: #A82D24; display: flex; align-items: center; justify-content: center; font-size: 11px\">1</span>SELL AT</span>\n<span style=\"display: flex; align-items: baseline; gap: 8px\"><span class=\"ow-sv-mono\" style=\"font-size: 26px; font-weight: 700; color: #1C2233\">{{pl.price}}</span><span class=\"ow-sv-mono\" style=\"font-size: 12px; font-weight: 700; color: #0F6B43\">{{pl.priceMargin}}</span></span>\n<span style=\"font-size: 11px; color: #5F6980; line-height: 1.4\">{{pl.priceWhy}}</span>\n<div style=\"display: flex; flex-direction: column; border: 1px solid #E6E3DD; border-radius: 8px; overflow: hidden\">\n<div style=\"display: grid; grid-template-columns: 50px 40px 60px 36px 48px minmax(0, 1fr); gap: 6px; padding: 5px 8px; background: #F7F5F2; font-size: 10px; font-weight: 700; color: #767F91\"><span>Tier</span><span>From</span><span style=\"text-align: right\">Each</span><span style=\"text-align: right\">Margin</span><span style=\"text-align: right\" title=\"Cheapest competitor at that quantity\">Rival</span><span>Who it fits</span></div>\n<sc-for list=\"{{pl.ladder}}\" as=\"t\" hint-placeholder-count=\"3\">\n<div style=\"display: grid; grid-template-columns: 50px 40px 60px 36px 48px minmax(0, 1fr); gap: 6px; align-items: center; padding: 6px 8px; border-top: 1px solid #EFECE6; font-size: 11px\">\n<span style=\"font-weight: 700\">{{t.tier}}</span><span class=\"ow-sv-mono\" style=\"color: #5F6980\">{{t.from}}+</span><span class=\"ow-sv-mono\" style=\"text-align: right; font-weight: 700\">{{t.price}}</span><span class=\"ow-sv-mono\" style=\"{{t.mStyle}}\">{{t.margin}}</span><span class=\"ow-sv-mono\" title=\"{{t.rivalTitle}}\" style=\"{{t.rStyle}}\">{{t.rival}}</span><span class=\"ow-sv-ell\" title=\"{{t.who}}\" style=\"font-size: 10px; color: #5F6980\">{{t.who}}</span>\n</div>\n</sc-for>\n</div>\n<span style=\"font-size: 10px; color: #5F6980; line-height: 1.4\">{{pl.ladderWhy}}</span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{psOpenIt}}\" style=\"align-self: flex-start; height: 30px; padding: 0 12px; border-radius: 9px; border: 1px solid #1C2233; background: #FFFFFF; color: #1C2233; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M6 9V3h12v6\"></path><rect x=\"3\" y=\"9\" width=\"18\" height=\"8\" rx=\"2\"></rect><path d=\"M6 14h12v7H6z\"></path></svg>Price sheet for a client</button>\n<div style=\"display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px\">\n<sc-for list=\"{{pl.options}}\" as=\"o\" hint-placeholder-count=\"3\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{o.pick}}\" aria-pressed=\"{{o.pressed}}\" style=\"{{o.style}}\"><span style=\"font-size: 10px; font-weight: 700\">{{o.label}}</span><span class=\"ow-sv-mono\" style=\"font-size: 12px; font-weight: 700\">{{o.price}}</span><span class=\"ow-sv-mono\" style=\"font-size: 10px\">{{o.sub}}</span></button></sc-for>\n</div>\n</div>\n\n<div style=\"border: 1px solid #E6E3DD; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px\">\n<span style=\"display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #5F6980\"><span style=\"width: 20px; height: 20px; border-radius: 6px; background: #E4E6FA; color: #3A3F9B; display: flex; align-items: center; justify-content: center; font-size: 11px\">2</span>FIRST BATCH</span>\n<span style=\"display: flex; align-items: baseline; gap: 8px\"><span class=\"ow-sv-mono\" style=\"font-size: 26px; font-weight: 700; color: #1C2233\">{{pl.batch}}</span><span style=\"font-size: 12px; color: #5F6980\">{{pl.batchUnit}}</span><span class=\"ow-sv-mono\" style=\"margin-left: auto; font-size: 12px; font-weight: 700; color: #1C2233\">{{pl.cash}}</span></span>\n<span style=\"display: flex; height: 10px; border-radius: 3px; overflow: hidden; gap: 2px; background: #EFECE6\"><span style=\"{{pl.barSure}}\"></span><span style=\"{{pl.barLikely}}\"></span><span style=\"{{pl.barBuffer}}\"></span><span style=\"{{pl.barRound}}\"></span></span>\n<span style=\"display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 10px; color: #5F6980\"><sc-for list=\"{{pl.batchKey}}\" as=\"k\" hint-placeholder-count=\"3\"><span style=\"display: flex; align-items: center; gap: 4px\"><span style=\"{{k.sw}}\"></span>{{k.label}}</span></sc-for></span>\n<span style=\"font-size: 11px; color: #5F6980; line-height: 1.4\">{{pl.batchWhy}}</span>\n<div style=\"display: flex; flex-direction: column; gap: 6px; padding-top: 8px; border-top: 1px solid #EFECE6\">\n<span style=\"font-size: 10px; font-weight: 700; color: #767F91; letter-spacing: .05em\">HOW TO HOLD IT</span>\n<div style=\"display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px\">\n<sc-for list=\"{{pl.holds}}\" as=\"h\" hint-placeholder-count=\"3\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{h.pick}}\" aria-pressed=\"{{h.pressed}}\" title=\"{{h.hint}}\" style=\"{{h.style}}\">\n<span style=\"display: flex; align-items: center; gap: 4px; width: 100%\"><span style=\"font-size: 11px; font-weight: 700\">{{h.label}}</span><span style=\"{{h.tagStyle}}\">best</span></span>\n<span class=\"ow-sv-mono\" style=\"font-size: 11px; font-weight: 700\">{{h.cash}}</span>\n<span style=\"font-size: 10px; opacity: .8\">{{h.sub}}</span>\n</button>\n</sc-for>\n</div>\n<span style=\"font-size: 11px; color: #1C2233; line-height: 1.4\">{{pl.holdWhy}}</span>\n</div>\n</div>\n\n<div style=\"border: 1px solid #E6E3DD; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 6px\">\n<span style=\"display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #5F6980\"><span style=\"width: 20px; height: 20px; border-radius: 6px; background: #E4F4EA; color: #0F6B43; display: flex; align-items: center; justify-content: center; font-size: 11px\">3</span>CALL FIRST</span>\n<sc-for list=\"{{pl.calls}}\" as=\"cl\" hint-placeholder-count=\"3\">\n<div style=\"display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 5px 0; border-top: 1px solid #EFECE6\">\n<span class=\"ow-sv-mono\" style=\"font-size: 12px; font-weight: 700; color: #767F91\">{{cl.n}}</span>\n<span style=\"display: flex; flex-direction: column; min-width: 0\"><span class=\"ow-sv-ell\" style=\"font-size: 12px; font-weight: 700\">{{cl.name}}</span><span class=\"ow-sv-ell\" style=\"{{cl.whyStyle}}\">{{cl.why}}</span></span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{cl.msg}}\" style=\"height: 26px; padding: 0 8px; border-radius: 7px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; font-size: 11px; font-weight: 600\">Message</button>\n</div>\n</sc-for>\n</div>\n\n<div style=\"border: 1px solid #E6E3DD; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px\">\n<span style=\"display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #5F6980\"><span style=\"width: 20px; height: 20px; border-radius: 6px; background: #DCEAF8; color: #1A5A8A; display: flex; align-items: center; justify-content: center; font-size: 11px\">4</span>BUY FROM</span>\n<span class=\"ow-sv-ell\" style=\"font-size: 16px; font-weight: 700; color: #1C2233\">{{pl.sup}}</span>\n<span class=\"ow-sv-mono\" style=\"font-size: 12px; color: #1C2233\">{{pl.supDeal}}</span>\n<span style=\"font-size: 11px; color: #5F6980; line-height: 1.4\">{{pl.supWhy}}</span>\n<span style=\"display: flex; align-items: center; gap: 8px; padding-top: 6px; border-top: 1px solid #EFECE6\"><span style=\"font-size: 11px; color: #5F6980\">Pays back in</span><span class=\"ow-sv-mono\" style=\"font-size: 13px; font-weight: 700; color: #1C2233\">{{pl.payback}}</span><span style=\"margin-left: auto; font-size: 11px; color: #5F6980\">profit</span><span class=\"ow-sv-mono\" style=\"font-size: 13px; font-weight: 700; color: #0F6B43\">{{pl.profit}}</span></span>\n</div>\n</div>\n<sc-if value=\"{{pl.hasRisks}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border-radius: 8px; background: #FEF8F2\">\n<span style=\"font-size: 11px; font-weight: 700; color: #7A4A02\">Watch out</span>\n<sc-for list=\"{{pl.risks}}\" as=\"r\" hint-placeholder-count=\"2\"><span style=\"font-size: 11px; color: #7A4A02; line-height: 1.4\">\u2022 {{r.t}}</span></sc-for>\n</div>\n</sc-if>\n</div>\n</sc-if>\n<sc-if value=\"{{pl.notYet}}\" hint-placeholder-val=\"{{false}}\"><div style=\"padding: 12px; border: 1px dashed #CFCAC1; border-radius: 8px; font-size: 12px; color: #5F6980\">The plan \u2014 price, first batch, who to call, who to buy from \u2014 appears once a supplier has given a price.</div></sc-if>\n<div style=\"display: flex; flex-direction: column; gap: 8px\">\n<span style=\"display: flex; align-items: center; gap: 8px\"><span style=\"font-size: 11px; font-weight: 700; color: #767F91; letter-spacing: .04em\">WHY THIS VERDICT</span><span style=\"font-size: 11px; color: #767F91\">tap a score to see its evidence</span><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{vdToggle}}\" style=\"margin-left: auto; height: 24px; padding: 0 8px; border-radius: 7px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; font-size: 11px; font-weight: 600\">{{vdToggleLabel}}</button></span>\n<div style=\"display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px\">\n<sc-for list=\"{{vd.rows}}\" as=\"r\" hint-placeholder-count=\"6\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{r.go}}\" title=\"{{r.reason}}\" style=\"display: flex; flex-direction: column; gap: 5px; padding: 8px; border-radius: 8px; border: 1px solid #E6E3DD; background: #FFFFFF; font: inherit; text-align: left; min-width: 0\">\n<span class=\"ow-sv-ell\" style=\"font-size: 11px; font-weight: 700; color: #1C2233\">{{r.label}}</span>\n<span class=\"ow-sv-mono ow-sv-ell\" style=\"{{r.valStyle}}\">{{r.value}}</span>\n<span style=\"position: relative; height: 6px; border-radius: 3px; background: #EFECE6; display: block\"><span style=\"{{r.bar}}\"></span></span>\n<span style=\"font-size: 10px; color: #767F91\">{{r.weight}}</span>\n</button>\n</sc-for>\n</div>\n<sc-if value=\"{{vdMore}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; flex-direction: column; border: 1px solid #E6E3DD; border-radius: 8px; overflow: hidden\">\n<sc-for list=\"{{vd.rows}}\" as=\"r\" hint-placeholder-count=\"6\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{r.go}}\" title=\"{{r.hint}}\" style=\"{{r.rowStyle}}\">\n<span style=\"display: flex; flex-direction: column; min-width: 0\"><span style=\"font-size: 12px; font-weight: 700; color: #1C2233\">{{r.label}}</span><span style=\"font-size: 10px; color: #767F91\">{{r.weight}}</span></span>\n<span style=\"position: relative; height: 8px; border-radius: 4px; background: #EFECE6; display: block\"><span style=\"{{r.bar}}\"></span></span>\n<span class=\"ow-sv-mono\" style=\"{{r.valStyle}}\">{{r.value}}</span>\n<span class=\"ow-sv-ell\" style=\"font-size: 11px; color: #5F6980; text-align: left\">{{r.reason}}</span>\n</button>\n</sc-for>\n</div>\n</sc-if>\n</div>\n<span style=\"font-size: 11px; color: #767F91\">{{vd.foot}}</span>\n</div>\n</sc-if>\n\n<sc-if value=\"{{tabRivals}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 12px\">\n<sc-if value=\"{{rv.has}}\" hint-placeholder-val=\"{{true}}\">\n<div style=\"display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border: 1px solid #E6E3DD; border-radius: 8px\">\n<svg width=\"100%\" height=\"64\" viewBox=\"0 0 520 64\" role=\"img\" aria-label=\"{{rv.aria}}\" style=\"display: block; font-family: IBM Plex Mono, monospace\">\n<line x1=\"10\" y1=\"30\" x2=\"510\" y2=\"30\" stroke=\"#E0DCD4\" stroke-width=\"2\"></line>\n<sc-if value=\"{{rv.hasCost}}\" hint-placeholder-val=\"{{true}}\"><circle cx=\"{{rv.costX}}\" cy=\"30\" r=\"5\" fill=\"#1C2233\"></circle><text x=\"{{rv.costX}}\" y=\"54\" text-anchor=\"middle\" font-size=\"9\" fill=\"#1C2233\">cost {{rv.cost}}</text></sc-if>\n<sc-if value=\"{{rv.hasCost}}\" hint-placeholder-val=\"{{true}}\"><circle cx=\"{{rv.shelfX}}\" cy=\"30\" r=\"7\" fill=\"#C93A30\" stroke=\"#FFFFFF\" stroke-width=\"2\"></circle><text x=\"{{rv.shelfX}}\" y=\"14\" text-anchor=\"middle\" font-size=\"9\" font-weight=\"700\" fill=\"#A82D24\">you {{rv.shelf}}</text></sc-if>\n<sc-for list=\"{{rv.pts}}\" as=\"pt\" hint-placeholder-count=\"3\"><rect x=\"{{pt.x0}}\" y=\"24\" width=\"12\" height=\"12\" rx=\"2\" fill=\"{{pt.fill}}\" stroke=\"#8E2A22\" stroke-width=\"2\" transform=\"{{pt.rot}}\"></rect><text x=\"{{pt.x}}\" y=\"{{pt.ly}}\" text-anchor=\"middle\" font-size=\"9\" fill=\"#8E2A22\">{{pt.label}}</text></sc-for>\n</svg>\n<span style=\"display: flex; gap: 14px; font-size: 10px; color: #5F6980; flex-wrap: wrap\"><span>\u25cf your cost</span><span style=\"color: #A82D24\">\u25cf your price</span><span style=\"color: #8E2A22\">\u25c6 rival in stock</span><span style=\"color: #8E2A22\">\u25c7 rival out of stock</span></span>\n</div>\n<div style=\"display: flex; flex-direction: column\">\n<div style=\"display: grid; grid-template-columns: minmax(0, 1fr) 80px 84px 100px 70px 64px 24px; gap: 0 10px; font-size: 11px; font-weight: 700; color: #767F91; padding-bottom: 6px; border-bottom: 1px solid #E0DCD4\"><span>Shop</span><span style=\"text-align: right\">Price</span><span>vs you</span><span>Stock</span><span>Area</span><span>Checked</span><span></span></div>\n<sc-for list=\"{{rv.rows}}\" as=\"r\" hint-placeholder-count=\"3\">\n<div style=\"display: grid; grid-template-columns: minmax(0, 1fr) 80px 84px 100px 70px 64px 24px; gap: 0 10px; align-items: center; padding: 7px 0; border-bottom: 1px solid #EFECE6; font-size: 12px\">\n<span style=\"display: flex; flex-direction: column; min-width: 0\"><span class=\"ow-sv-ell\" style=\"font-weight: 600\">{{r.name}}</span><sc-if value=\"{{r.hasBreaks}}\" hint-placeholder-val=\"{{false}}\"><span class=\"ow-sv-mono ow-sv-ell\" style=\"font-size: 10px; color: #3A3F9B\">{{r.breaks}}</span></sc-if></span><span class=\"ow-sv-mono\" style=\"text-align: right; font-weight: 700\">{{r.price}}</span><span class=\"ow-sv-mono\" style=\"{{r.vsStyle}}\">{{r.vs}}</span><span style=\"{{r.stockStyle}}\">{{r.stock}}</span><span class=\"ow-sv-ell\" style=\"font-size: 11px; color: #5F6980\">{{r.area}}</span><span style=\"font-size: 11px; color: #767F91\">{{r.when}}</span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{r.remove}}\" aria-label=\"Remove\" style=\"width: 24px; height: 24px; border: 0; background: transparent; color: #767F91\">\u00d7</button>\n</div>\n</sc-for>\n</div>\n</sc-if>\n<sc-if value=\"{{pl.hasVol}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; flex-direction: column; border: 1px solid #E6E3DD; border-radius: 8px; overflow: hidden\">\n<div style=\"display: flex; align-items: center; gap: 8px; padding: 7px 10px; background: #F7F5F2; border-bottom: 1px solid #E0DCD4\"><span style=\"font-size: 11px; font-weight: 700; color: #1C2233\">At volume</span><span style=\"font-size: 10px; color: #767F91\">cheapest rival vs your ladder, by quantity</span></div>\n<div style=\"display: grid; grid-template-columns: 56px minmax(0, 1fr) 84px 70px 90px; gap: 0 10px; padding: 5px 10px; font-size: 10px; font-weight: 700; color: #767F91\"><span>Qty</span><span>Cheapest rival</span><span style=\"text-align: right\">Their price</span><span style=\"text-align: right\">Yours</span><span>Gap</span></div>\n<sc-for list=\"{{pl.vol}}\" as=\"v\" hint-placeholder-count=\"3\">\n<div style=\"display: grid; grid-template-columns: 56px minmax(0, 1fr) 84px 70px 90px; gap: 0 10px; align-items: center; padding: 6px 10px; border-top: 1px solid #EFECE6; font-size: 12px\"><span class=\"ow-sv-mono\" style=\"font-weight: 700\">{{v.q}}</span><span class=\"ow-sv-ell\" style=\"font-size: 11px; color: #5F6980\">{{v.who}}</span><span class=\"ow-sv-mono\" style=\"text-align: right\">{{v.rival}}</span><span class=\"ow-sv-mono\" style=\"text-align: right; font-weight: 700\" title=\"{{v.tier}}\">{{v.ours}}</span><span class=\"ow-sv-mono\" style=\"{{v.gapStyle}}\">{{v.gap}}</span></div>\n</sc-for>\n</div>\n</sc-if>\n<sc-if value=\"{{rv.none}}\" hint-placeholder-val=\"{{false}}\"><div style=\"padding: 14px; border: 1px dashed #CFCAC1; border-radius: 8px; text-align: center; font-size: 12px; color: #5F6980\">No competitor prices yet. Check at least two shops before deciding.</div></sc-if>\n<div style=\"display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 8px; background: #FCFBF9; border: 1px solid #E6E3DD\">\n<span style=\"font-size: 11px; font-weight: 700; color: #767F91; letter-spacing: .04em\">ADD A COMPETITOR PRICE</span>\n<div style=\"display: grid; grid-template-columns: minmax(0, 1fr) 110px 120px; gap: 6px\">\n<input type=\"text\" aria-label=\"Shop name\" placeholder=\"Shop name\" value=\"{{rvName}}\" onChange=\"{{setRvName}}\" style=\"height: 30px; border: 1px solid #CFCAC1; border-radius: 8px; padding: 0 8px; font: inherit; font-size: 12px; box-sizing: border-box; min-width: 0\">\n<input type=\"text\" inputmode=\"numeric\" aria-label=\"Their price, UGX\" placeholder=\"Their price\" value=\"{{rvPrice}}\" onChange=\"{{setRvPrice}}\" class=\"ow-sv-mono\" style=\"height: 30px; border: 1px solid #CFCAC1; border-radius: 8px; padding: 0 8px; font-size: 12px; box-sizing: border-box; min-width: 0\">\n<input type=\"text\" aria-label=\"Area\" placeholder=\"Area\" value=\"{{rvArea}}\" onChange=\"{{setRvArea}}\" style=\"height: 30px; border: 1px solid #E6E3DD; border-radius: 8px; padding: 0 8px; font: inherit; font-size: 12px; box-sizing: border-box; min-width: 0\">\n</div>\n<div style=\"display: flex; align-items: center; gap: 6px; flex-wrap: wrap\">\n<span style=\"font-size: 10px; font-weight: 700; color: #767F91\">VOLUME PRICES</span>\n<sc-for list=\"{{rvBreakRows}}\" as=\"b\" hint-placeholder-count=\"1\"><span style=\"display: inline-flex; align-items: center; gap: 3px; height: 28px; padding: 0 3px 0 6px; border: 1px solid #E6E3DD; border-radius: 8px; background: #FFFFFF\"><input type=\"text\" inputmode=\"numeric\" aria-label=\"From quantity\" placeholder=\"qty\" value=\"{{b.q}}\" onChange=\"{{b.setQ}}\" class=\"ow-sv-mono\" style=\"width: 38px; height: 22px; border: 0; outline: 0; font-size: 11px; text-align: right\"><span style=\"font-size: 10px; color: #767F91\">+ at</span><input type=\"text\" inputmode=\"numeric\" aria-label=\"Price at that quantity\" placeholder=\"price\" value=\"{{b.p}}\" onChange=\"{{b.setP}}\" class=\"ow-sv-mono\" style=\"width: 64px; height: 22px; border: 0; outline: 0; font-size: 11px\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{b.remove}}\" aria-label=\"Remove break\" style=\"width: 20px; height: 20px; border: 0; background: transparent; color: #767F91\">\u00d7</button></span></sc-for>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{rvAddBreak}}\" style=\"height: 28px; padding: 0 10px; border-radius: 8px; border: 1px dashed #B3BCD2; background: transparent; color: #5F6980; font-size: 11px; font-weight: 600\">+ price for bigger orders</button>\n</div>\n<div style=\"display: flex; align-items: center; gap: 6px; flex-wrap: wrap\">\n<sc-for list=\"{{rvStocks}}\" as=\"o\" hint-placeholder-count=\"3\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{o.pick}}\" aria-pressed=\"{{o.pressed}}\" style=\"{{o.style}}\">{{o.label}}</button></sc-for>\n<span style=\"width: 1px; height: 18px; background: #E6E3DD\"></span>\n<sc-for list=\"{{rvHows}}\" as=\"o\" hint-placeholder-count=\"3\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{o.pick}}\" aria-pressed=\"{{o.pressed}}\" style=\"{{o.style}}\">{{o.label}}</button></sc-for>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{rvAdd}}\" disabled=\"{{rvOff}}\" style=\"{{rvAddStyle}}\">Add price</button>\n</div>\n</div>\n<span style=\"{{rv.noteStyle}}\">{{rv.note}}</span>\n</div>\n</sc-if>\n\n<sc-if value=\"{{tabSuppliers}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 10px\">\n<div style=\"display: grid; grid-template-columns: minmax(0, 1.4fr) 110px minmax(0, 1fr) 96px 110px; gap: 0 14px; align-items: center; font-size: 11px; color: #767F91; font-weight: 600; padding: 0 0 6px; border-bottom: 1px solid #E0DCD4\">\n<span>Supplier</span><span style=\"text-align: right\">UGX / unit</span><span>vs cheapest</span><span>Terms</span><span></span>\n</div>\n<sc-for list=\"{{mSup}}\" as=\"sp\" hint-placeholder-count=\"3\">\n<div style=\"display: grid; grid-template-columns: minmax(0, 1.4fr) 110px minmax(0, 1fr) 96px 110px; gap: 0 14px; align-items: center; padding: 8px 0; border-bottom: 1px solid #EFECE6\">\n<span style=\"display: flex; align-items: center; gap: 8px; min-width: 0\"><span style=\"{{sp.av}}\">{{sp.ini}}</span><span style=\"display: flex; flex-direction: column; min-width: 0\"><span class=\"ow-sv-ell\" style=\"font-size: 13px; font-weight: 600\">{{sp.name}}</span><span style=\"{{sp.statusStyle}}\">{{sp.status}}</span></span></span>\n<span class=\"ow-sv-mono\" style=\"{{sp.priceStyle}}\">{{sp.price}}</span>\n<span style=\"display: flex; align-items: center; gap: 6px; min-width: 0\"><span style=\"flex: 1 1 auto; height: 8px; border-radius: 2px; background: #EFECE6; display: flex\"><span style=\"{{sp.bar}}\"></span></span><span class=\"ow-sv-mono\" style=\"{{sp.deltaStyle}}\">{{sp.delta}}</span></span>\n<span style=\"font-size: 11px; color: #5F6980\">{{sp.terms}}</span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{sp.ask}}\" style=\"height: 28px; border-radius: 8px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; font-size: 11px; font-weight: 600\">{{sp.askLabel}}</button>\n</div>\n</sc-for>\n<sc-if value=\"{{mNoSup}}\" hint-placeholder-val=\"{{false}}\"><div style=\"padding: 18px; border: 1px dashed #CFCAC1; border-radius: 8px; text-align: center; font-size: 12px; color: #5F6980\">Nobody found yet. Once someone is looking, suppliers they find land here.</div></sc-if>\n<span style=\"font-size: 11px; color: #767F91\">{{mSupNote}}</span>\n</div>\n</sc-if>\n\n<sc-if value=\"{{tabDemand}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"padding: 16px 20px 20px; display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 20px\">\n<div style=\"display: flex; flex-direction: column\">\n<div style=\"display: grid; grid-template-columns: minmax(0, 1fr) 70px 90px 56px 118px; gap: 0 10px; font-size: 11px; color: #767F91; font-weight: 600; padding-bottom: 6px; border-bottom: 1px solid #E0DCD4\"><span>Who</span><span style=\"text-align: right\">Wants</span><span>How</span><span style=\"text-align: right\">Waiting</span><span>When it\u2019s in</span></div>\n<sc-for list=\"{{mAsks}}\" as=\"a\" hint-placeholder-count=\"4\">\n<div style=\"display: grid; grid-template-columns: minmax(0, 1fr) 70px 90px 56px 118px; gap: 0 10px; align-items: center; padding: 7px 0; border-bottom: 1px solid #EFECE6; font-size: 12px\">\n<span style=\"display: flex; align-items: center; gap: 8px; min-width: 0\"><span style=\"{{a.av}}\">{{a.ini}}</span><span class=\"ow-sv-ell\" style=\"font-weight: 600\">{{a.name}}</span></span>\n<span class=\"ow-sv-mono\" style=\"text-align: right; font-weight: 600\">{{a.qty}}</span>\n<span style=\"display: flex; align-items: center; gap: 5px; font-size: 11px; color: #5F6980\"><span style=\"{{a.dot}}\"></span>{{a.channel}}</span>\n<span class=\"ow-sv-mono\" style=\"{{a.dayStyle}}\">{{a.days}}d</span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{a.toggle}}\" aria-pressed=\"{{a.pressed}}\" style=\"{{a.followStyle}}\">{{a.followLabel}}</button>\n</div>\n</sc-for>\n</div>\n<div style=\"display: flex; flex-direction: column; gap: 12px\">\n<div style=\"display: flex; flex-direction: column; gap: 6px\">\n<span style=\"font-size: 11px; font-weight: 700; color: #767F91; letter-spacing: .04em\">WHERE THE ASKS CAME FROM</span>\n<span style=\"display: flex; height: 10px; border-radius: 3px; overflow: hidden; gap: 2px\"><sc-for list=\"{{mChan}}\" as=\"ch\" hint-placeholder-count=\"3\"><span style=\"{{ch.bar}}\"></span></sc-for></span>\n<sc-for list=\"{{mChan}}\" as=\"ch\" hint-placeholder-count=\"3\"><span style=\"display: flex; align-items: center; gap: 6px; font-size: 12px\"><span style=\"{{ch.dot}}\"></span>{{ch.label}}<span class=\"ow-sv-mono\" style=\"margin-left: auto; font-weight: 600\">{{ch.n}}</span></span></sc-for>\n</div>\n<div style=\"display: flex; flex-direction: column; gap: 6px; padding-top: 10px; border-top: 1px solid #EFECE6\">\n<span style=\"font-size: 11px; font-weight: 700; color: #767F91; letter-spacing: .04em\">BIGGEST ASKS</span>\n<sc-for list=\"{{mTop}}\" as=\"tp\" hint-placeholder-count=\"3\"><span style=\"display: grid; grid-template-columns: 90px minmax(0, 1fr) 36px; gap: 8px; align-items: center; font-size: 11px\"><span class=\"ow-sv-ell\">{{tp.name}}</span><span style=\"height: 8px; display: flex\"><span style=\"{{tp.bar}}\"></span></span><span class=\"ow-sv-mono\" style=\"text-align: right\">{{tp.qty}}</span></span></sc-for>\n</div>\n<span style=\"font-size: 11px; color: #5F6980; padding-top: 10px; border-top: 1px solid #EFECE6\">{{mFollowNote}}</span>\n</div>\n</div>\n</sc-if>\n\n<sc-if value=\"{{tabMoney}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"padding: 18px 20px 22px; display: flex; flex-direction: column; gap: 16px\">\n<sc-if value=\"{{mHasMoney}}\" hint-placeholder-val=\"{{true}}\">\n<div style=\"display: flex; flex-direction: column; gap: 6px\">\n<span style=\"position: relative; display: block; height: 28px\">\n<span style=\"position: absolute; left: 0; right: 0; top: 12px; height: 4px; border-radius: 2px; background: #EFECE6\"></span>\n<span style=\"{{mm.gain}}\"></span><span style=\"{{mm.costDot}}\"></span><span style=\"{{mm.shelfDot}}\"></span><span style=\"{{mm.rivalDot}}\"></span><span style=\"{{mm.payDot}}\"></span>\n</span>\n<span style=\"display: flex; gap: 16px; font-size: 11px; color: #5F6980; flex-wrap: wrap\">\n<span style=\"display: flex; align-items: center; gap: 5px\"><span style=\"width: 8px; height: 8px; border-radius: 999px; background: #1C2233\"></span>cost <b class=\"ow-sv-mono\" style=\"color: #1C2233\">{{mm.cost}}</b></span>\n<span style=\"display: flex; align-items: center; gap: 5px\"><span style=\"width: 10px; height: 10px; border-radius: 999px; background: #C93A30\"></span>your price <b class=\"ow-sv-mono\" style=\"color: #A82D24\">{{mm.shelf}}</b></span>\n<span style=\"display: flex; align-items: center; gap: 5px\"><span style=\"width: 9px; height: 9px; border: 2px solid #8E2A22; transform: rotate(45deg); box-sizing: border-box\"></span>rivals <b class=\"ow-sv-mono\" style=\"color: #8E2A22\">{{mm.rival}}</b></span>\n<span style=\"display: flex; align-items: center; gap: 5px\"><span style=\"width: 9px; height: 9px; border-radius: 2px; border: 2px solid #3A3F9B; box-sizing: border-box\"></span>they\u2019ll pay up to <b class=\"ow-sv-mono\" style=\"color: #3A3F9B\">{{mm.pay}}</b></span>\n</span>\n</div>\n<div style=\"display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid #E6E3DD; border-radius: 8px\">\n<sc-for list=\"{{mm.tiles}}\" as=\"t\" hint-placeholder-count=\"4\"><div style=\"{{t.cell}}\"><span style=\"font-size: 11px; color: #767F91\">{{t.label}}</span><span class=\"ow-sv-mono\" style=\"{{t.valStyle}}\">{{t.value}}</span><span style=\"font-size: 11px; color: #767F91\">{{t.sub}}</span></div></sc-for>\n</div>\n<span style=\"font-size: 11px; color: #767F91\">{{mm.note}}</span>\n</sc-if>\n<sc-if value=\"{{mNoMoney}}\" hint-placeholder-val=\"{{false}}\"><div style=\"padding: 18px; border: 1px dashed #CFCAC1; border-radius: 8px; text-align: center; font-size: 12px; color: #5F6980\">No price yet \u2014 money shows here once a supplier has quoted.</div></sc-if>\n</div>\n</sc-if>\n\n<sc-if value=\"{{tabActivity}}\" hint-placeholder-val=\"{{false}}\">\n<ol style=\"list-style: none; margin: 0; padding: 16px 20px 20px; display: flex; flex-direction: column\">\n<sc-for list=\"{{actPage}}\" as=\"ev\" hint-placeholder-count=\"5\">\n<li style=\"display: grid; grid-template-columns: 22px minmax(0, 1fr) 80px; gap: 10px; align-items: start; padding-bottom: 10px\">\n<span style=\"display: flex; flex-direction: column; align-items: center; align-self: stretch\"><span style=\"{{ev.dot}}\"></span><span style=\"flex: 1 1 auto; width: 2px; background: #EFECE6; margin-top: 3px\"></span></span>\n<span style=\"font-size: 12px; color: #1C2233; line-height: 1.4\">{{ev.text}}</span>\n<span class=\"ow-sv-mono\" style=\"font-size: 11px; color: #767F91; text-align: right\">{{ev.when}}</span>\n</li>\n</sc-for>\n</ol>\n<div style=\"display: flex; align-items: center; gap: 8px; padding: 0 20px 16px; font-size: 11px; color: #5F6980\">\n<span class=\"ow-sv-mono\">{{actRange}}</span>\n<span style=\"margin-left: auto; display: flex; gap: 4px\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{actPrev}}\" disabled=\"{{actPrevOff}}\" aria-label=\"Newer\" style=\"{{actPrevStyle}}\">\u2039 Newer</button>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{actNext}}\" disabled=\"{{actNextOff}}\" aria-label=\"Older\" style=\"{{actNextStyle}}\">Older \u203a</button>\n</span>\n</div>\n</sc-if>\n</div>\n</div>\n</div>\n</sc-if>\n<!-- CLIENT PRICE SHEET: selling prices only \u2014 never cost, margin or other clients -->\n<sc-if value=\"{{psOpen}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"position: fixed; inset: 0; z-index: 1000; overflow: auto\">\n<button type=\"button\" class=\"ow-sv-btn ow-sv-noprint\" onClick=\"{{psClose}}\" aria-label=\"Close price sheet\" style=\"position: fixed; inset: 0; width: 100%; height: 100%; border: 0; border-radius: 0; background: rgba(22,32,60,.4); cursor: default\"></button>\n<div style=\"position: relative; margin: 24px auto; width: min(940px, calc(100vw - 48px)); display: grid; grid-template-columns: minmax(0, 1fr) 270px; gap: 14px; align-items: start\">\n<div class=\"ow-sv-noprint\" style=\"order: 2; display: flex; flex-direction: column; gap: 14px; padding: 14px; border-radius: 12px; background: #FFFFFF; box-shadow: 0 24px 60px rgba(22,32,60,.25)\">\n<span style=\"display: flex; align-items: center; gap: 8px\"><span style=\"font-size: 14px; font-weight: 700\">Share this quote</span><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{psClose}}\" aria-label=\"Close\" style=\"margin-left: auto; width: 28px; height: 28px; border-radius: 8px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233\">\u2715</button></span>\n<div style=\"display: flex; flex-direction: column; gap: 6px\">\n<span style=\"font-size: 10px; font-weight: 700; color: #767F91; letter-spacing: .05em\">ADDRESSED TO</span>\n<label style=\"display: flex; align-items: center; gap: 6px; height: 30px; border: 1px solid #E6E3DD; border-radius: 8px; padding: 0 8px\"><svg width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#767F91\" stroke-width=\"1.8\" stroke-linecap=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><path d=\"M20 20l-4-4\"></path></svg><input type=\"text\" aria-label=\"Any client\" placeholder=\"Any client\u2026\" value=\"{{psQ}}\" onChange=\"{{setPsQ}}\" style=\"border: 0; outline: 0; font: inherit; font-size: 12px; width: 100%; min-width: 0; background: transparent\"></label>\n<sc-for list=\"{{psTo}}\" as=\"o\" hint-placeholder-count=\"4\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{o.pick}}\" aria-pressed=\"{{o.pressed}}\" style=\"{{o.style}}\">\n<span style=\"{{o.av}}\">{{o.ini}}</span>\n<span style=\"display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; text-align: left\"><span class=\"ow-sv-ell\" style=\"font-size: 12px; font-weight: 700\">{{o.label}}</span><span class=\"ow-sv-mono ow-sv-ell\" style=\"font-size: 10px; opacity: .8\">{{o.sub}}</span></span>\n<span class=\"ow-sv-mono\" style=\"font-size: 11px; font-weight: 700\">{{o.total}}</span>\n</button>\n</sc-for>\n</div>\n<div style=\"display: flex; flex-direction: column; gap: 6px\">\n<span style=\"font-size: 10px; font-weight: 700; color: #767F91; letter-spacing: .05em\">VALID FOR</span>\n<span style=\"display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px\"><sc-for list=\"{{psValids}}\" as=\"o\" hint-placeholder-count=\"3\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{o.pick}}\" aria-pressed=\"{{o.pressed}}\" style=\"{{o.style}}\">{{o.label}}</button></sc-for></span>\n</div>\n<div style=\"display: flex; flex-direction: column; gap: 6px\">\n<span style=\"font-size: 10px; font-weight: 700; color: #767F91; letter-spacing: .05em\">ON THE SHEET</span>\n<sc-for list=\"{{psShows}}\" as=\"o\" hint-placeholder-count=\"3\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{o.pick}}\" aria-pressed=\"{{o.pressed}}\" style=\"display: flex; align-items: center; gap: 8px; height: 28px; padding: 0; border: 0; background: transparent; font: inherit; font-size: 12px; color: #1C2233; text-align: left\"><span style=\"{{o.box}}\">{{o.tick}}</span>{{o.label}}</button></sc-for>\n</div>\n<div style=\"display: flex; flex-direction: column; gap: 6px; padding-top: 12px; border-top: 1px solid #EFECE6\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{psPrint}}\" style=\"height: 38px; border-radius: 9px; border: 1px solid #1C2233; background: #1C2233; color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M6 9V3h12v6\"></path><rect x=\"3\" y=\"9\" width=\"18\" height=\"8\" rx=\"2\"></rect><path d=\"M6 14h12v7H6z\"></path></svg>Print</button>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{psWhatsApp}}\" style=\"height: 34px; border-radius: 9px; border: 1px solid #0F6B43; background: #FFFFFF; color: #0F6B43; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z\"></path></svg>{{psWaLabel}}</button>\n<span style=\"font-size: 10px; color: #767F91; text-align: center\">Cost and margin never appear on the sheet</span>\n</div>\n</div>\n\n<div class=\"ow-sv-ps\" style=\"order: 1; background: #FFFFFF; border-radius: 10px; padding: 32px 36px; display: flex; flex-direction: column; gap: 18px; color: #1C2233; box-shadow: 0 24px 60px rgba(22,32,60,.25)\">\n<div style=\"display: flex; align-items: flex-start; gap: 12px; padding-bottom: 14px; border-bottom: 2px solid #1C2233\">\n<div style=\"width: 40px; height: 40px; border-radius: 9px; background: #C93A30; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px\">O</div>\n<div style=\"display: flex; flex-direction: column; gap: 2px\"><span style=\"font-size: 18px; font-weight: 700\">[Shop name]</span><span style=\"font-size: 12px; color: #5F6980\">[Phone] \u00b7 [Location]</span></div>\n<div style=\"margin-left: auto; text-align: right; display: flex; flex-direction: column; gap: 2px\"><span style=\"font-size: 11px; font-weight: 700; color: #767F91; letter-spacing: .06em\">PRICE QUOTE</span><span class=\"ow-sv-mono\" style=\"font-size: 12px\">{{psDate}}</span></div>\n</div>\n<sc-if value=\"{{psHasTo}}\" hint-placeholder-val=\"{{false}}\"><span style=\"font-size: 13px\">For <b>{{psToName}}</b></span></sc-if>\n<div style=\"display: flex; gap: 14px; align-items: center\">\n<div style=\"width: 56px; height: 56px; border-radius: 8px; background: #F7F5F2; border: 1px solid #E6E3DD; display: flex; align-items: center; justify-content: center; color: #767F91\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21 8l-9-5-9 5 9 5 9-5z\"></path><path d=\"M3 8v8l9 5 9-5V8\"></path></svg></div>\n<div style=\"display: flex; flex-direction: column; gap: 3px\"><span style=\"font-size: 20px; font-weight: 700\">{{psItem}}</span><sc-if value=\"{{psShowSpec}}\" hint-placeholder-val=\"{{true}}\"><span style=\"font-size: 12px; color: #5F6980\">{{psSpec}}</span></sc-if></div>\n</div>\n<div style=\"display: flex; flex-direction: column; gap: 8px\">\n<span style=\"font-size: 11px; font-weight: 700; color: #767F91; letter-spacing: .06em\">PRICE EACH \u00b7 THE MORE YOU BUY, THE LESS YOU PAY</span>\n<div style=\"{{psGrid}}\">\n<sc-for list=\"{{psRows}}\" as=\"r\" hint-placeholder-count=\"3\">\n<div style=\"{{r.cardStyle}}\">\n<span style=\"display: flex; align-items: center; gap: 6px\"><span style=\"font-size: 11px; font-weight: 700; letter-spacing: .04em\">{{r.tier}}</span><span style=\"{{r.saveStyle}}\">{{r.save}}</span></span>\n<span class=\"ow-sv-mono\" style=\"font-size: 22px; font-weight: 700; line-height: 1.1\">{{r.price}}</span>\n<span style=\"font-size: 12px; opacity: .8\">{{r.range}}</span>\n<sc-if value=\"{{r.isYours}}\" hint-placeholder-val=\"{{false}}\"><span style=\"font-size: 10px; font-weight: 700; letter-spacing: .04em\">\u2713 YOUR ORDER</span></sc-if>\n</div>\n</sc-for>\n</div>\n</div>\n<sc-if value=\"{{psShowTotal}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 8px; background: #F7F5F2\">\n<span style=\"font-size: 13px\">Your order: <b class=\"ow-sv-mono\">{{psQtyLine}}</b></span><span class=\"ow-sv-mono\" style=\"font-size: 18px; font-weight: 700\">{{psTotal}}</span>\n</div>\n</sc-if>\n<div style=\"display: flex; justify-content: space-between; gap: 16px; font-size: 11px; color: #5F6980; padding-top: 10px; border-top: 1px solid #E6E3DD\">\n<span>Prices valid until <b style=\"color: #1C2233\">{{psValid}}</b>{{psDelivery}}</span>\n<span>Thank you for asking us</span>\n</div>\n</div>\n</div>\n</div>\n</sc-if>\n</section>\n\n<!-- RECOMMENDATIONS: the verdict + plan for every live item, without opening it -->\n<section aria-label=\"Recommendations\" style=\"background: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 8px\">\n<div style=\"height: 52px; display: flex; align-items: center; gap: 10px; padding: 0 16px; border-bottom: 1px solid #EFECE6\">\n<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#1C2233\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 19V9M10 19V5M16 19v-7M22 19H2\"></path></svg>\n<span style=\"font-weight: 700; font-size: 15px\">Recommendations</span>\n<span style=\"font-size: 12px; color: #767F91\">what the numbers say about each item</span>\n<span role=\"group\" aria-label=\"Verdicts\" style=\"margin-left: auto; display: flex; gap: 6px\">\n<sc-for list=\"{{rec.chips}}\" as=\"k\" hint-placeholder-count=\"4\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{k.pick}}\" aria-pressed=\"{{k.pressed}}\" style=\"{{k.style}}\"><span style=\"{{k.dot}}\"></span>{{k.label}}<span class=\"ow-sv-mono\" style=\"font-weight: 700\">{{k.n}}</span></button></sc-for>\n</span>\n</div>\n<div role=\"table\" aria-label=\"Recommendations\">\n<div role=\"row\" style=\"{{rec.headStyle}}\"><span role=\"columnheader\">Item</span><span role=\"columnheader\">Verdict</span><span role=\"columnheader\" title=\"How much evidence stands behind the verdict: 3 supplier quotes, 3 competitor prices, 5 buyers\">Confidence</span><span role=\"columnheader\">Sell at</span><span role=\"columnheader\">First batch</span><span role=\"columnheader\">Buy from</span><span role=\"columnheader\">Call first</span><span role=\"columnheader\">Hold it</span><span role=\"columnheader\"></span></div>\n<sc-for list=\"{{rec.rows}}\" as=\"r\" hint-placeholder-count=\"6\">\n<div role=\"row\" class=\"ow-sv-qrow\" style=\"{{r.style}}\">\n<span role=\"cell\" style=\"display: flex; flex-direction: column; gap: 3px; min-width: 0\"><span class=\"ow-sv-ell\" title=\"{{r.name}}\" style=\"font-size: 13px; font-weight: 600; color: #1C2233\">{{r.name}}</span><span style=\"display: flex; align-items: center; gap: 6px; font-size: 11px; color: #5F6980\"><span style=\"{{r.stepDot}}\"></span>{{r.step}} \u00b7 {{r.askers}} waiting</span></span>\n<span role=\"cell\" style=\"display: flex; flex-direction: column; gap: 3px; min-width: 0\"><span style=\"display: flex; align-items: center; gap: 6px; min-width: 0\"><span style=\"{{r.pill}}\">{{r.verdict}}</span><span class=\"ow-sv-mono\" title=\"Score out of 100\" style=\"{{r.scoreStyle}}\">{{r.score}}</span></span><span class=\"ow-sv-ell\" title=\"{{r.why}}\" style=\"font-size: 11px; color: #5F6980\">{{r.why}}</span></span>\n<span role=\"cell\" title=\"{{r.confWhy}}\" style=\"display: flex; align-items: center; gap: 6px\"><span style=\"position: relative; display: block; flex: 1 1 auto; height: 6px; border-radius: 3px; background: #EFECE6; overflow: hidden\"><span style=\"{{r.confBar}}\"></span></span><span class=\"ow-sv-mono\" style=\"{{r.confText}}; min-width: 28px; text-align: right\">{{r.conf}}</span></span>\n<span role=\"cell\" style=\"display: flex; flex-direction: column; gap: 2px; min-width: 0\"><span class=\"ow-sv-mono\" style=\"font-size: 13px; font-weight: 700; color: #1C2233\">{{r.price}}</span><span class=\"ow-sv-mono ow-sv-ell\" style=\"font-size: 10px; color: #0F6B43\">{{r.margin}}</span></span>\n<span role=\"cell\" style=\"display: flex; flex-direction: column; gap: 2px; min-width: 0\"><span class=\"ow-sv-mono\" style=\"font-size: 13px; font-weight: 700; color: #1C2233\">{{r.batch}}</span><span class=\"ow-sv-mono ow-sv-ell\" style=\"font-size: 10px; color: #5F6980\">{{r.batchSub}}</span></span>\n<span role=\"cell\" style=\"display: flex; flex-direction: column; gap: 2px; min-width: 0\"><span class=\"ow-sv-ell\" title=\"{{r.supWhy}}\" style=\"font-size: 12px; font-weight: 600; color: #1C2233\">{{r.sup}}</span><span class=\"ow-sv-mono ow-sv-ell\" style=\"font-size: 10px; color: #5F6980\">{{r.supSub}}</span></span>\n<span role=\"cell\" style=\"display: flex; flex-direction: column; gap: 2px; min-width: 0\"><span class=\"ow-sv-ell\" style=\"font-size: 12px; font-weight: 600; color: #1C2233\">{{r.call}}</span><span class=\"ow-sv-ell\" title=\"{{r.callWhy}}\" style=\"font-size: 10px; color: #5F6980\">{{r.callWhy}}</span></span>\n<span role=\"cell\" title=\"{{r.holdWhy}}\"><span style=\"{{r.holdStyle}}\">{{r.hold}}</span></span>\n<span role=\"cell\" style=\"display: flex; justify-content: flex-end\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{r.open}}\" style=\"height: 28px; padding: 0 10px; border-radius: 7px; border: 1px solid #1C2233; background: #FFFFFF; color: #1C2233; font-size: 11px; font-weight: 700; white-space: nowrap\">Open \u2197</button></span>\n</div>\n</sc-for>\n</div>\n<div style=\"height: 36px; display: flex; align-items: center; gap: 14px; padding: 0 16px; font-size: 11px; color: #5F6980\">\n<span>{{rec.foot}}</span>\n</div>\n</section>\n\n<!-- GRID: checklist full width, then the map with the side rail beside it -->\n<div style=\"display: flex; flex-direction: column; gap: 20px; min-width: 0\">\n\n<!-- TODAY'S CHECKLIST (derived from the verdict's evidence rules) -->\n<section aria-label=\"Today\u2019s checklist\" style=\"position: relative; background: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 8px\">\n<div style=\"height: 52px; display: flex; align-items: center; gap: 10px; padding: 0 16px; border-bottom: 1px solid #EFECE6\">\n<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#1C2233\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2\"></rect><path d=\"M8 8l1.5 1.5L12 7M8 14l1.5 1.5L12 13M14 8h3M14 14h3\"></path></svg>\n<span style=\"font-weight: 700; font-size: 15px\">Today\u2019s checklist</span>\n<span class=\"ow-sv-mono\" style=\"font-size: 12px; color: #767F91\">{{cl.date}}</span>\n<span style=\"margin-left: auto; display: flex; gap: 6px\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{cl.download}}\" title=\"A spreadsheet file (.csv) \u2014 opens in Excel or Google Sheets\" style=\"height: 30px; padding: 0 11px; border-radius: 9px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 4v11M7 10l5 5 5-5M5 20h14\"></path></svg>Download sheet</button>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{cl.preview}}\" title=\"See the printable worksheet, then print it\" style=\"height: 30px; padding: 0 11px; border-radius: 9px; border: 1px solid #1C2233; background: #1C2233; color: #FFFFFF; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M6 9V3h12v6\"></path><rect x=\"3\" y=\"9\" width=\"18\" height=\"8\" rx=\"2\"></rect><path d=\"M6 14h12v7H6z\"></path></svg>Print worksheet</button>\n</span>\n</div>\n<div style=\"display: flex; flex-direction: column; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #EFECE6\">\n<div role=\"group\" aria-label=\"Show by urgency\" style=\"display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px\">\n<sc-for list=\"{{cl.dues}}\" as=\"d\" hint-placeholder-count=\"4\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{d.pick}}\" aria-pressed=\"{{d.pressed}}\" style=\"{{d.style}}\">\n<span class=\"ow-sv-mono\" style=\"{{d.numStyle}}\">{{d.count}}</span>\n<span style=\"display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1 1 auto\"><span style=\"font-size: 13px; font-weight: 700; color: #1C2233\">{{d.label}}</span><span class=\"ow-sv-ell\" style=\"font-size: 11px; color: #5F6980\">{{d.sub}}</span>\n<sc-if value=\"{{d.isDone}}\" hint-placeholder-val=\"{{false}}\"><span style=\"position: relative; display: block; height: 4px; border-radius: 2px; background: #EFECE6; overflow: hidden\"><span style=\"{{d.prog}}\"></span></span></sc-if></span>\n</button>\n</sc-for>\n</div>\n<div style=\"display: flex; align-items: center; gap: 16px\">\n<span style=\"display: flex; align-items: center; gap: 8px\"><span style=\"font-size: 11px; font-weight: 600; color: #767F91\">Show</span>\n<span role=\"group\" aria-label=\"Kind of task\" style=\"display: flex; align-items: center; gap: 2px; padding: 2px; border-radius: 9px; background: #EFECE6\">\n<sc-for list=\"{{cl.types}}\" as=\"f\" hint-placeholder-count=\"6\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{f.pick}}\" aria-pressed=\"{{f.pressed}}\" style=\"{{f.style}}\"><span style=\"{{f.dot}}\"></span>{{f.label}}<span class=\"ow-sv-mono\" style=\"font-size: 11px; opacity: .7\">{{f.count}}</span></button>\n</sc-for>\n</span></span>\n<span style=\"margin-left: auto; display: flex; align-items: center; gap: 8px\"><span style=\"font-size: 11px; font-weight: 600; color: #767F91\">Arrange by</span>\n<span role=\"group\" aria-label=\"Arrange by\" style=\"display: flex; align-items: center; gap: 2px; padding: 2px; border-radius: 9px; background: #EFECE6\"><sc-for list=\"{{cl.groups}}\" as=\"g\" hint-placeholder-count=\"3\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{g.pick}}\" aria-pressed=\"{{g.pressed}}\" style=\"{{g.style}}\">{{g.label}}</button></sc-for></span></span>\n</div>\n</div>\n<div role=\"table\" aria-label=\"Checklist\" aria-rowcount=\"{{cl.total}}\">\n<div role=\"row\" style=\"{{cl.headStyle}}\"><span role=\"columnheader\"></span><span role=\"columnheader\">Task</span><span role=\"columnheader\">Item</span><span role=\"columnheader\">Who \u00b7 contact</span><span role=\"columnheader\">Last known</span><span role=\"columnheader\" title=\"Bar = age against its limit (green fresh, amber expiring, red expired). Dots = how many of the needed pieces you have.\">Freshness</span><span role=\"columnheader\">Priority \u00b7 due</span><span role=\"columnheader\" style=\"text-align: right\">Do it</span></div>\n<sc-for list=\"{{cl.rows}}\" as=\"r\" hint-placeholder-count=\"8\">\n<sc-if value=\"{{r.head}}\" hint-placeholder-val=\"{{false}}\">\n<div role=\"row\" style=\"{{r.headStyle}}\"><span role=\"cell\" style=\"display: flex; align-items: center; gap: 6px\"><span style=\"{{r.headDot}}\"></span>{{r.headLabel}}<span class=\"ow-sv-mono\" style=\"font-weight: 500; opacity: .75\">{{r.headCount}}</span></span></div>\n</sc-if>\n<div role=\"row\" class=\"ow-sv-qrow\" style=\"{{r.style}}\">\n<span role=\"cell\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{r.tick}}\" aria-pressed=\"{{r.done}}\" aria-label=\"{{r.tickHint}}\" title=\"{{r.tickHint}}\" style=\"{{r.box}}\">{{r.tickMark}}</button></span>\n<span role=\"cell\" style=\"display: flex; flex-direction: column; gap: 3px; min-width: 0\">\n<span style=\"display: flex; align-items: center; gap: 6px; min-width: 0\"><span style=\"{{r.typeStyle}}\">{{r.typeLabel}}</span><sc-if value=\"{{r.confirm}}\" hint-placeholder-val=\"{{false}}\"><span title=\"Past its freshness limit \u2014 it no longer counts until you confirm it\" style=\"flex-shrink: 0; display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 700; color: #8E2A22; background: #FBE5E2; border-radius: 4px; padding: 0 6px; line-height: 16px; cursor: default\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M12 7v5l3 2\"></path></svg>Expired</span></sc-if><span class=\"ow-sv-ell\" title=\"{{r.title}}\" style=\"{{r.titleStyle}}\">{{r.title}}</span></span>\n<span style=\"display: flex; align-items: center; gap: 5px; min-width: 0; padding-left: 2px\"><sc-for list=\"{{r.tags}}\" as=\"t\" hint-placeholder-count=\"1\"><span title=\"{{t.title}}\" style=\"{{t.style}}\">{{t.label}}</span></sc-for><span class=\"ow-sv-ell\" title=\"{{r.detail}}\" style=\"font-size: 11px; color: #5F6980\">{{r.detailShort}}</span></span>\n</span>\n<span role=\"cell\" class=\"ow-sv-ell\" title=\"{{r.item}}\" style=\"font-size: 12px; color: #1C2233\">{{r.item}}</span>\n<span role=\"cell\" style=\"display: flex; flex-direction: column; gap: 3px; min-width: 0\">\n<span class=\"ow-sv-ell\" title=\"{{r.who}}\" style=\"font-size: 12px; font-weight: 600; color: #1C2233\">{{r.whoLabel}}</span>\n<span style=\"display: flex; align-items: center; gap: 4px; min-width: 0\"><sc-for list=\"{{r.contacts}}\" as=\"k\" hint-placeholder-count=\"2\"><a href=\"{{k.href}}\" target=\"_blank\" rel=\"noopener\" title=\"{{k.label}}\" aria-label=\"{{k.label}}\" style=\"{{k.style}}\"><sc-if value=\"{{k.call}}\" hint-placeholder-val=\"{{true}}\"><svg width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z\"></path></svg></sc-if><sc-if value=\"{{k.wa}}\" hint-placeholder-val=\"{{false}}\"><svg width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 20l1.3-4A8 8 0 1 1 8.5 19z\"></path></svg></sc-if></a></sc-for><span class=\"ow-sv-mono ow-sv-ell\" style=\"font-size: 11px; color: #5F6980\">{{r.contactLine}}</span></span>\n</span>\n<span role=\"cell\" style=\"display: flex; flex-direction: column; gap: 2px; min-width: 0\">\n<sc-if value=\"{{r.notEditing}}\" hint-placeholder-val=\"{{true}}\"><span class=\"ow-sv-mono ow-sv-ell\" title=\"{{r.last}}\" style=\"font-size: 12px; color: #1C2233\">{{r.last}}</span></sc-if>\n<sc-if value=\"{{r.editing}}\" hint-placeholder-val=\"{{false}}\"><span class=\"ow-sv-mono\" style=\"font-size: 11px; color: #767F91\">{{r.was}}</span><sc-if value=\"{{r.hasDelta}}\" hint-placeholder-val=\"{{false}}\"><span class=\"ow-sv-mono\" style=\"{{r.deltaStyle}}\">{{r.delta}}</span></sc-if></sc-if>\n</span>\n<span role=\"cell\" title=\"{{r.evTitle}}\" style=\"display: flex; flex-direction: column; gap: 4px\">\n<sc-if value=\"{{r.isAge}}\" hint-placeholder-val=\"{{false}}\"><span style=\"display: block; position: relative; height: 5px; border-radius: 3px; background: #EFECE6; overflow: hidden\"><span style=\"{{r.ageBar}}\"></span></span></sc-if>\n<sc-if value=\"{{r.isDots}}\" hint-placeholder-val=\"{{false}}\"><span style=\"display: flex; gap: 3px\"><sc-for list=\"{{r.dots}}\" as=\"d\" hint-placeholder-count=\"3\"><span style=\"{{d.style}}\"></span></sc-for></span></sc-if>\n<span class=\"ow-sv-mono\" style=\"{{r.evTextStyle}}\">{{r.evText}}</span>\n</span>\n<span role=\"cell\" style=\"display: flex; align-items: center; gap: 5px\"><span title=\"{{r.pTitle}}\" class=\"ow-sv-mono\" style=\"{{r.pStyle}}\">{{r.pDots}}</span><span style=\"{{r.dueStyle}}\">{{r.dueLabel}}</span></span>\n<span role=\"cell\" style=\"display: flex; gap: 4px; justify-content: flex-end; align-items: center; min-width: 0\">\n<sc-if value=\"{{r.editing}}\" hint-placeholder-val=\"{{false}}\">\n<input type=\"text\" inputmode=\"numeric\" aria-label=\"{{r.editLabel}}\" placeholder=\"{{r.editLabel}}\" value=\"{{cl.editVal}}\" onChange=\"{{cl.setEdit}}\" style=\"width: 84px; height: 26px; box-sizing: border-box; border: 1px solid #1C2233; border-radius: 7px; padding: 0 7px; font: inherit; font-size: 12px\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{r.save}}\" style=\"height: 26px; padding: 0 9px; border-radius: 7px; border: 1px solid #0F6B43; background: #0F6B43; color: #FFFFFF; font-size: 11px; font-weight: 700\">Save</button>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{cl.cancelEdit}}\" aria-label=\"Cancel\" style=\"height: 26px; width: 26px; border-radius: 7px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #5F6980; font-size: 11px\">\u2715</button>\n</sc-if>\n<sc-if value=\"{{r.notEditing}}\" hint-placeholder-val=\"{{true}}\">\n<span style=\"display: grid; grid-template-columns: 58px 104px; gap: 6px; align-items: center; justify-content: end; width: 100%\"><span style=\"display: flex; justify-content: flex-end\"><span style=\"{{r.secGroup}}\"><sc-for list=\"{{r.second}}\" as=\"a\" hint-placeholder-count=\"2\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{a.go}}\" title=\"{{a.hint}}\" aria-label=\"{{a.label}}\" style=\"{{a.style}}\"><sc-if value=\"{{a.isEdit}}\" hint-placeholder-val=\"{{true}}\"><svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 20h4L19 9l-4-4L4 16zM13 7l4 4\"></path></svg></sc-if><sc-if value=\"{{a.isNo}}\" hint-placeholder-val=\"{{false}}\"><svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M6 6l12 12M18 6L6 18\"></path></svg></sc-if></button></sc-for></span></span><span style=\"display: flex; justify-content: flex-end; gap: 6px\"><sc-for list=\"{{r.primary}}\" as=\"a\" hint-placeholder-count=\"1\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{a.go}}\" title=\"{{a.hint}}\" style=\"{{a.style}}\"><sc-if value=\"{{a.isYes}}\" hint-placeholder-val=\"{{true}}\"><svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12l5 5 9-10\"></path></svg></sc-if><sc-if value=\"{{a.isOpen}}\" hint-placeholder-val=\"{{false}}\"><svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M8 16L16 8M9 8h7v7\"></path></svg></sc-if>{{a.label}}</button></sc-for><sc-for list=\"{{r.staff}}\" as=\"a\" hint-placeholder-count=\"0\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{a.go}}\" title=\"{{a.hint}}\" aria-label=\"{{a.hint}}\" style=\"{{a.style}}\">{{a.ini}}</button></sc-for></span></span>\n</sc-if>\n</span>\n</div>\n</sc-for>\n<sc-if value=\"{{cl.empty}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"padding: 28px 16px; display: flex; flex-direction: column; align-items: center; gap: 6px; color: #0F6B43; border-bottom: 1px solid #EFECE6\"><svg width=\"26\" height=\"26\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M8 12l3 3 5-6\"></path></svg><span style=\"font-weight: 600\">{{cl.emptyText}}</span></div>\n</sc-if>\n</div>\n<div style=\"height: 44px; display: flex; align-items: center; gap: 12px; padding: 0 16px; font-size: 12px; color: #5F6980\">\n<span class=\"ow-sv-mono\">{{cl.range}}</span>\n<span style=\"display: flex; align-items: center; gap: 6px\"><span style=\"width: 60px; height: 5px; border-radius: 3px; background: #EFECE6; position: relative; overflow: hidden; display: block\"><span style=\"{{cl.doneBar}}\"></span></span><span class=\"ow-sv-mono\">{{cl.doneLabel}}</span></span>\n<span style=\"margin-left: auto; display: flex; align-items: center; gap: 4px\">\n<button type=\"button\" class=\"ow-sv-btn\" aria-label=\"Previous page\" onClick=\"{{cl.prev}}\" disabled=\"{{cl.prevOff}}\" style=\"{{cl.prevStyle}}\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M15 6l-6 6 6 6\"></path></svg></button>\n<sc-for list=\"{{cl.pages}}\" as=\"p\" hint-placeholder-count=\"3\">\n<button type=\"button\" class=\"ow-sv-btn\" aria-label=\"{{p.aria}}\" aria-current=\"{{p.current}}\" onClick=\"{{p.go}}\" style=\"{{p.style}}\">{{p.n}}</button>\n</sc-for>\n<button type=\"button\" class=\"ow-sv-btn\" aria-label=\"Next page\" onClick=\"{{cl.next}}\" disabled=\"{{cl.nextOff}}\" style=\"{{cl.nextStyle}}\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M9 6l6 6-6 6\"></path></svg></button>\n</span>\n</div>\n<sc-if value=\"{{cl.wsOpen}}\" hint-placeholder-val=\"{{false}}\">\n<div class=\"ow-sv-noprint\" style=\"position: absolute; left: 0; right: 0; top: 0; min-height: 100%; z-index: 40; border-radius: 8px\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{cl.closePreview}}\" aria-label=\"Close preview\" style=\"position: absolute; inset: 0; width: 100%; height: 100%; border: 0; border-radius: 8px; background: rgba(22,32,60,.45); cursor: default\"></button>\n<div style=\"position: relative; margin: 16px auto 24px; width: 1000px; display: flex; flex-direction: column; gap: 10px\">\n<div style=\"display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; background: #FFFFFF; box-shadow: 0 8px 24px rgba(22,32,60,.2)\">\n<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#1C2233\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M6 9V3h12v6\"></path><rect x=\"3\" y=\"9\" width=\"18\" height=\"8\" rx=\"2\"></rect><path d=\"M6 14h12v7H6z\"></path></svg>\n<span style=\"font-weight: 700\">Print preview</span>\n<span role=\"group\" aria-label=\"What to include\" style=\"margin-left: 12px; display: flex; gap: 2px; padding: 2px; border-radius: 9px; background: #EFECE6\"><sc-for list=\"{{cl.wsAllOpts}}\" as=\"o\" hint-placeholder-count=\"2\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{o.pick}}\" aria-pressed=\"{{o.pressed}}\" style=\"{{o.style}}\">{{o.label}}</button></sc-for></span>\n<span style=\"margin-left: auto; display: flex; gap: 6px\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{cl.download}}\" style=\"height: 30px; padding: 0 11px; border-radius: 9px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; font-size: 12px; font-weight: 600\">Download sheet</button>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{cl.print}}\" style=\"height: 30px; padding: 0 14px; border-radius: 9px; border: 1px solid #1C2233; background: #1C2233; color: #FFFFFF; font-size: 12px; font-weight: 700\">Print</button>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{cl.closePreview}}\" aria-label=\"Close\" style=\"width: 30px; height: 30px; border-radius: 9px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233\">\u2715</button>\n</span>\n</div>\n<div style=\"background: #FFFFFF; color: #1C2233; padding: 28px 32px; font-size: 11px; border-radius: 4px; box-shadow: 0 24px 60px rgba(22,32,60,.3)\">\n<div style=\"display: flex; align-items: flex-end; gap: 12px; padding-bottom: 10px; border-bottom: 2px solid #1C2233\">\n<div style=\"width: 30px; height: 30px; border-radius: 7px; background: #C93A30; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px\">O</div>\n<div style=\"display: flex; flex-direction: column\"><span style=\"font-size: 16px; font-weight: 700\">Sourcing worksheet</span><span style=\"font-size: 11px; color: #5F6980\">Omni-Ware \u00b7 {{cl.date}} \u00b7 {{cl.wsScope}}</span></div>\n<span style=\"margin-left: auto; display: flex; gap: 18px; font-size: 11px\"><span>Taken by ____________</span><span>Back by ______</span></span>\n</div>\n<div style=\"display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 1.3fr); gap: 8px; margin-top: 10px\">\n<sc-for list=\"{{cl.wsPri}}\" as=\"p\" hint-placeholder-count=\"3\">\n<div style=\"border: 1px solid #1C2233; border-radius: 6px; padding: 6px 8px; display: flex; align-items: center; gap: 8px\"><span class=\"ow-sv-mono\" style=\"font-size: 12px; letter-spacing: 1px\">{{p.dots}}</span><span style=\"display: flex; flex-direction: column; line-height: 1.15\"><span style=\"font-weight: 700; font-size: 12px\">{{p.label}} \u00b7 {{p.n}}</span><span style=\"font-size: 10px; color: #5F6980\">{{p.sub}}</span></span></div>\n</sc-for>\n<div style=\"border: 1px solid #1C2233; border-radius: 6px; padding: 6px 8px; display: flex; flex-direction: column; justify-content: center; line-height: 1.2\"><span style=\"font-weight: 700; font-size: 12px\">{{cl.wsPlan}}</span><span style=\"font-size: 10px; color: #5F6980\">{{cl.wsTime}}</span></div>\n</div>\n<sc-for list=\"{{cl.wsSecs}}\" as=\"sec\" hint-placeholder-count=\"3\">\n<div style=\"margin-top: 12px; break-inside: avoid-page\">\n<div style=\"display: flex; align-items: baseline; gap: 8px; padding: 4px 0; border-bottom: 2px solid #1C2233\"><span style=\"font-size: 13px; font-weight: 700\">{{sec.title}}</span><span style=\"font-size: 10px; color: #5F6980\">{{sec.sub}}</span></div>\n<div role=\"table\" aria-label=\"{{sec.title}}\">\n<div role=\"row\" style=\"display: grid; grid-template-columns: 58px minmax(0, 1.25fr) minmax(0, 2.2fr) minmax(0, 1.1fr) minmax(0, 1fr) 22px; background: #EFECE6; font-weight: 700; font-size: 10px; border-bottom: 1px solid #1C2233\">\n<span role=\"columnheader\" style=\"padding: 4px\">Priority</span><span role=\"columnheader\" style=\"padding: 4px\">{{sec.whoHead}}</span><span role=\"columnheader\" style=\"padding: 4px\">Ask \u00b7 item</span><span role=\"columnheader\" style=\"padding: 4px\">Last known</span><span role=\"columnheader\" style=\"padding: 4px; background: #FFFFFF\">Found</span><span role=\"columnheader\" style=\"padding: 4px\">\u2713</span>\n</div>\n<sc-for list=\"{{sec.lines}}\" as=\"w\" hint-placeholder-count=\"4\">\n<div role=\"row\" style=\"{{w.style}}\">\n<span role=\"cell\" style=\"padding: 5px 4px; display: flex; flex-direction: column; line-height: 1.15\"><span class=\"ow-sv-mono\" style=\"font-size: 11px; letter-spacing: 1px\">{{w.dots}}</span><span style=\"font-size: 9px; font-weight: 700\">{{w.pLabel}}</span></span>\n<span role=\"cell\" style=\"padding: 5px 4px; display: flex; flex-direction: column; line-height: 1.2; min-width: 0\"><span style=\"font-weight: 700\">{{w.who}}</span><span class=\"ow-sv-mono\" style=\"font-size: 10px\">{{w.contact}}</span></span>\n<span role=\"cell\" style=\"padding: 5px 4px; line-height: 1.25\"><span style=\"font-weight: 600\">{{w.ask}}</span><span style=\"display: block; color: #5F6980; font-size: 10px\">{{w.item}} \u00b7 {{w.due}}</span></span>\n<span role=\"cell\" style=\"padding: 5px 4px\">{{w.last}}</span>\n<span role=\"cell\" style=\"padding: 5px 4px; border-left: 1px solid #CFCAC1\"></span>\n<span role=\"cell\" style=\"padding: 5px 4px\"><span style=\"display: block; width: 11px; height: 11px; border: 1.5px solid #1C2233\"></span></span>\n</div>\n</sc-for>\n</div>\n</div>\n</sc-for>\n<sc-if value=\"{{cl.wsEmpty}}\" hint-placeholder-val=\"{{false}}\"><div style=\"margin-top: 14px; padding: 14px; border: 1px dashed #1C2233; text-align: center\">Nothing to chase today.</div></sc-if>\n<div style=\"margin-top: 10px; font-size: 10px; color: #5F6980\">\u25cf\u25cf\u25cf Must: overdue, or it sets your price or cost, or it moves a verdict a lot \u00b7 \u25cf\u25cf\u25cb Should \u00b7 \u25cf\u25cb\u25cb If time. Prices go stale after 14 days, quotes after their validity (7 days), buyer asks after 14 days.</div>\n</div>\n</div>\n</div>\n</sc-if>\n</section>\n\n<div style=\"display: flex; flex-direction: column; gap: 20px; min-width: 0\">\n\n<div style=\"display: flex; flex-direction: column; gap: 20px; min-width: 0\">\n\n<!-- DEMAND MAP (zoomable) -->\n<section aria-label=\"Demand map\" style=\"background: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 8px\">\n<div style=\"height: 34px; display: flex; align-items: center; gap: 10px; padding: 0 16px; border-bottom: 1px solid #EFECE6\">\n<span style=\"font-weight: 600\">Demand map</span>\n<span style=\"display: flex; align-items: center; gap: 10px; font-size: 11px; color: #5F6980\"><span style=\"display: flex; align-items: center; gap: 4px\"><svg width=\"22\" height=\"12\" viewBox=\"0 0 22 12\" aria-hidden=\"true\"><circle cx=\"4\" cy=\"8\" r=\"3\" fill=\"#EFECE6\" stroke=\"#767F91\"></circle><circle cx=\"15\" cy=\"6\" r=\"5.5\" fill=\"#EFECE6\" stroke=\"#767F91\"></circle></svg>size = money waiting</span><sc-for list=\"{{legendSteps}}\" as=\"l\" hint-placeholder-count=\"4\"><span style=\"display: flex; align-items: center; gap: 4px\"><span style=\"{{l.style}}\"></span>{{l.label}}</span></sc-for><span style=\"display: flex; align-items: center; gap: 4px\"><span style=\"width: 10px; height: 10px; border-radius: 999px; border: 1.5px dashed #767F91; box-sizing: border-box\"></span>no price yet</span></span>\n<div role=\"group\" aria-label=\"Zoom\" style=\"margin-left: auto; display: flex; align-items: center; gap: 6px\">\n<span class=\"ow-sv-mono\" style=\"font-size: 11px; color: #767F91; min-width: 64px; text-align: right\">{{zoomLabel}}</span>\n<button type=\"button\" class=\"ow-sv-btn\" aria-label=\"Zoom out\" onClick=\"{{zoomOut}}\" style=\"width: 28px; border-radius: 9px 0 0 9px; height: 26px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; display: flex; align-items: center; justify-content: center\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M5 12h14\"></path></svg></button>\n<button type=\"button\" class=\"ow-sv-btn\" aria-label=\"Zoom in\" onClick=\"{{zoomIn}}\" style=\"width: 28px; margin-left: -7px; border-radius: 0 9px 9px 0; height: 26px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; display: flex; align-items: center; justify-content: center\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"></path></svg></button>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{fit}}\" style=\"padding: 0 8px; gap: 4px; border-radius: 9px; font-size: 12px; font-weight: 600; height: 26px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; display: flex; align-items: center; justify-content: center\"><svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5\"></path></svg>Fit</button>\n</div>\n</div>\n<div style=\"padding: 12px 16px 8px\">\n<svg width=\"796\" height=\"256\" viewBox=\"0 0 796 256\" role=\"img\" aria-label=\"Items by days waiting and number of people asking\" onPointerDown=\"{{panStart}}\" onPointerMove=\"{{panMove}}\" onPointerUp=\"{{panEnd}}\" onPointerLeave=\"{{panEnd}}\" onDoubleClick=\"{{dblZoom}}\" style=\"{{svgStyle}}\">\n<defs><clipPath id=\"dmclip\"><rect x=\"44\" y=\"16\" width=\"732\" height=\"206\"></rect></clipPath></defs>\n<g clip-path=\"url(#dmclip)\">\n<rect x=\"{{act.x}}\" y=\"{{act.y}}\" width=\"{{act.w}}\" height=\"{{act.h}}\" rx=\"4\" fill=\"#FEF8F2\" stroke=\"#95530C\" stroke-dasharray=\"4 4\" stroke-width=\"1\"></rect>\n<sc-for list=\"{{yTicks}}\" as=\"t\" hint-placeholder-count=\"5\"><line x1=\"44\" x2=\"776\" y1=\"{{t.p}}\" y2=\"{{t.p}}\" stroke=\"#EFECE6\" stroke-width=\"1\"></line></sc-for>\n<sc-for list=\"{{xTicks}}\" as=\"t\" hint-placeholder-count=\"5\"><line y1=\"16\" y2=\"222\" x1=\"{{t.p}}\" x2=\"{{t.p}}\" stroke=\"#F7F5F2\" stroke-width=\"1\"></line></sc-for>\n<line x1=\"{{splits.vx}}\" x2=\"{{splits.vx}}\" y1=\"16\" y2=\"222\" stroke=\"#95530C\" stroke-opacity=\".35\" stroke-dasharray=\"4 4\" stroke-width=\"1\"></line>\n<line x1=\"44\" x2=\"776\" y1=\"{{splits.hy}}\" y2=\"{{splits.hy}}\" stroke=\"#95530C\" stroke-opacity=\".35\" stroke-dasharray=\"4 4\" stroke-width=\"1\"></line>\n<sc-for list=\"{{bubbles}}\" as=\"b\" hint-placeholder-count=\"9\">\n<circle cx=\"{{b.x}}\" cy=\"{{b.y}}\" r=\"{{b.r}}\" fill=\"{{b.fill}}\" stroke=\"{{b.stroke}}\" stroke-width=\"{{b.sw}}\" stroke-dasharray=\"{{b.dash}}\" onClick=\"{{b.pick}}\" style=\"cursor: pointer\"><title>{{b.name}}</title></circle>\n</sc-for>\n<sc-for list=\"{{labels}}\" as=\"b\" hint-placeholder-count=\"5\">\n<text x=\"{{b.lx}}\" y=\"{{b.ly}}\" text-anchor=\"{{b.anchor}}\" font-size=\"11\" font-weight=\"600\" fill=\"#1C2233\" style=\"pointer-events: none\">{{b.name}}</text>\n</sc-for>\n</g>\n<sc-for list=\"{{quads}}\" as=\"q\" hint-placeholder-count=\"4\"><text x=\"{{q.x}}\" y=\"{{q.y}}\" text-anchor=\"{{q.a}}\" font-size=\"11\" font-weight=\"700\" fill=\"{{q.c}}\" style=\"{{q.style}}\">{{q.t}}</text></sc-for>\n<line x1=\"44\" y1=\"222\" x2=\"776\" y2=\"222\" stroke=\"#E0DCD4\" stroke-width=\"1\"></line>\n<sc-for list=\"{{yTicks}}\" as=\"t\" hint-placeholder-count=\"5\"><text x=\"36\" y=\"{{t.ty}}\" text-anchor=\"end\" font-size=\"11\" fill=\"#767F91\" font-family=\"IBM Plex Mono, monospace\">{{t.v}}</text></sc-for>\n<sc-for list=\"{{xTicks}}\" as=\"t\" hint-placeholder-count=\"5\"><text x=\"{{t.p}}\" y=\"238\" text-anchor=\"middle\" font-size=\"11\" fill=\"#767F91\" font-family=\"IBM Plex Mono, monospace\">{{t.v}}</text></sc-for>\n<text x=\"410\" y=\"254\" text-anchor=\"middle\" font-size=\"11\" fill=\"#5F6980\">days the first person has waited \u2192</text>\n<text x=\"10\" y=\"120\" font-size=\"11\" fill=\"#5F6980\" transform=\"rotate(-90 10 120)\" text-anchor=\"middle\">people asking \u2192</text>\n</svg>\n<sc-if value=\"{{hasSel}}\" hint-placeholder-val=\"{{false}}\">\n<div style=\"margin-top: 8px; display: flex; align-items: center; gap: 12px; padding: 8px 12px; border: 1px solid #E6E3DD; border-radius: 8px; background: #FCFBF9\">\n<span style=\"{{sel.dot}}\"></span>\n<span style=\"display: flex; flex-direction: column; min-width: 0\"><span class=\"ow-sv-ell\" style=\"font-weight: 700\">{{sel.name}}</span><span style=\"font-size: 11px; color: #5F6980\">{{sel.zone}} \u00b7 next: {{sel.move}} \u00b7 {{sel.owner}}</span></span>\n<span style=\"{{sel.pill}}\">{{sel.stateLabel}}</span>\n<span class=\"ow-sv-mono\" style=\"font-size: 12px; color: #1C2233\">{{sel.people}} \u00b7 {{sel.wait}}d \u00b7 {{sel.qty}}</span>\n<span class=\"ow-sv-mono\" style=\"font-size: 12px; font-weight: 700; color: #1C2233\">{{sel.value}}</span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{openSel}}\" style=\"margin-left: auto; height: 28px; padding: 0 12px; border-radius: 7px; border: 1px solid #1C2233; background: #FFFFFF; color: #1C2233; font-size: 12px; font-weight: 700\">Open item \u2197</button>\n<button type=\"button\" class=\"ow-sv-btn\" aria-label=\"Close\" onClick=\"{{clearSel}}\" style=\"width: 28px; height: 28px; border: 0; background: transparent; color: #767F91; display: flex; align-items: center; justify-content: center\">\u2715</button>\n</div>\n</sc-if>\n<div style=\"margin-top: 10px; display: flex; flex-direction: column; gap: 6px\">\n<span style=\"display: flex; align-items: center; gap: 8px; font-size: 12px; color: #1C2233\"><span style=\"width: 8px; height: 8px; border-radius: 999px; background: #95530C\"></span><span class=\"ow-sv-ell\" style=\"font-weight: 600\">{{mapInsight}}</span></span>\n<div style=\"display: flex; flex-direction: column; gap: 4px\"><span style=\"font-size: 11px; font-weight: 600; color: #767F91\">Money waiting at each step</span>\n<div style=\"display: flex; gap: 3px; border-radius: 6px; overflow: hidden\"><sc-for list=\"{{stepMoney}}\" as=\"m\" hint-placeholder-count=\"4\"><span title=\"{{m.n}} items \u00b7 {{m.unknown}} without a price yet\" style=\"{{m.style}}\"><span style=\"{{m.ink}}\">{{m.label}}</span><span class=\"ow-sv-mono\" style=\"font-size: 12px; font-weight: 700; color: #1C2233\">{{m.v}}</span><span style=\"font-size: 10px; color: #5F6980\">{{m.n}} items</span></span></sc-for></div>\n</div>\n</div>\n</div>\n</section>\n\n</div>\n\n<!-- BELOW THE MAP: three panels side by side -->\n<aside style=\"display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; align-items: stretch\">\n\n<section aria-label=\"This week\" style=\"background: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 8px\">\n<div style=\"height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 14px; border-bottom: 1px solid #EFECE6\"><span style=\"font-weight: 600\">This week</span><span style=\"margin-left: auto; display: flex; align-items: center; gap: 10px; font-size: 11px; color: #767F91\"><span style=\"display: flex; align-items: center; gap: 4px\"><span style=\"width: 8px; height: 8px; border-radius: 2px; background: #3A3F9B\"></span>new asks</span><span style=\"display: flex; align-items: center; gap: 4px\"><span style=\"width: 8px; height: 8px; border-radius: 2px; border: 1px dashed #B3BCD2; box-sizing: border-box\"></span>last week</span></span></div>\n<div style=\"padding: 12px 14px; display: flex; flex-direction: column; gap: 10px\">\n<div style=\"position: relative; display: flex; gap: 2px; align-items: flex-end\"><sc-if value=\"{{wk.quiet}}\" hint-placeholder-val=\"{{false}}\"><span style=\"position: absolute; left: 0; right: 0; top: 4px; text-align: center; font-size: 11px; color: #5F6980\">{{wk.quietText}}</span></sc-if><sc-for list=\"{{wk.days}}\" as=\"d\" hint-placeholder-count=\"7\"><span title=\"{{d.title}}\" style=\"flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 3px\"><span style=\"position: relative; width: 100%; height: 30px; display: flex; align-items: flex-end; justify-content: center\"><span style=\"{{d.last}}\"></span><span style=\"{{d.now}}\"></span></span><span style=\"{{d.labelStyle}}\">{{d.label}}</span></span></sc-for></div>\n<div style=\"display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px\"><sc-for list=\"{{wk.tiles}}\" as=\"t\" hint-placeholder-count=\"4\"><span title=\"{{t.title}}\" style=\"{{t.style}}\"><span style=\"display: flex; align-items: baseline; gap: 4px\"><span class=\"ow-sv-mono\" style=\"{{t.valStyle}}\">{{t.value}}</span><span class=\"ow-sv-mono\" style=\"{{t.deltaStyle}}\">{{t.delta}}</span></span><span style=\"{{t.labelStyle}}\">{{t.label}}</span></span></sc-for></div>\n<div style=\"display: flex; flex-direction: column\">\n<span style=\"font-size: 11px; font-weight: 600; color: #5F6980; padding-bottom: 4px\">Latest moves</span>\n<sc-for list=\"{{wk.moves}}\" as=\"m\" hint-placeholder-count=\"3\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{m.open}}\" style=\"display: grid; grid-template-columns: minmax(0, 1fr) auto 22px; gap: 8px; align-items: center; padding: 6px 0; border: 0; border-top: 1px solid #EFECE6; background: transparent; text-align: left; color: #1C2233; width: 100%\"><span class=\"ow-sv-ell\" title=\"{{m.name}}\" style=\"font-size: 12px; font-weight: 600\">{{m.name}}</span><span style=\"display: flex; align-items: center; gap: 4px\"><span style=\"{{m.fromStyle}}\">{{m.from}}</span><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#767F91\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h14M13 6l6 6-6 6\"></path></svg><span style=\"{{m.toStyle}}\">{{m.to}}</span></span><span class=\"ow-sv-mono\" style=\"font-size: 11px; color: #767F91; text-align: right\">{{m.ago}}</span></button></sc-for>\n<sc-if value=\"{{wk.noMoves}}\" hint-placeholder-val=\"{{false}}\"><span style=\"padding: 6px 0; border-top: 1px solid #EFECE6; font-size: 12px; color: #767F91\">Nothing moved this week</span></sc-if>\n</div>\n</div>\n</section>\n\n<section aria-label=\"Where asks come from\" style=\"background: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 8px\">\n<div style=\"height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 14px; border-bottom: 1px solid #EFECE6\"><span style=\"font-weight: 600\">Where asks come from</span><span class=\"ow-sv-mono\" style=\"margin-left: auto; font-size: 11px; color: #767F91\">{{srcs.total}} \u00b7 90d</span></div>\n<div style=\"padding: 12px 14px; display: flex; flex-direction: column; gap: 10px\">\n<div style=\"display: flex; height: 12px; border-radius: 3px; overflow: hidden; gap: 2px; background: #EFECE6\"><sc-for list=\"{{srcs.rows}}\" as=\"s\" hint-placeholder-count=\"3\"><span style=\"{{s.seg}}\"></span></sc-for></div>\n<div style=\"display: grid; grid-template-columns: 10px minmax(0, 1fr) auto auto; gap: 6px 8px; align-items: center; font-size: 12px\">\n<sc-for list=\"{{srcs.rows}}\" as=\"s\" hint-placeholder-count=\"3\"><span style=\"{{s.sw}}\"></span><span>{{s.label}}</span><span class=\"ow-sv-mono\" style=\"font-weight: 600\">{{s.n}}</span><span class=\"ow-sv-mono\" style=\"color: #767F91; font-size: 11px; width: 30px; text-align: right\">{{s.pct}}</span></sc-for>\n</div>\n<sc-if value=\"{{srcs.none}}\" hint-placeholder-val=\"{{false}}\"><span style=\"font-size: 12px; color: #767F91\">No asks in the last 90 days</span></sc-if>\n</div>\n</section>\n\n<section aria-label=\"Waiting on suppliers\" style=\"background: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 8px\">\n<div style=\"height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 14px; border-bottom: 1px solid #EFECE6\"><span style=\"font-weight: 600\">Waiting on suppliers</span><span style=\"font-size: 11px; color: #767F91\">prices not in yet</span><span class=\"ow-sv-mono\" style=\"margin-left: auto; font-size: 11px; font-weight: 700; color: #FFFFFF; background: #1C2233; border-radius: 999px; padding: 1px 7px\">{{wos.n}}</span></div>\n<div style=\"display: flex; flex-direction: column\">\n<sc-for list=\"{{wos.rows}}\" as=\"w\" hint-placeholder-count=\"3\">\n<div style=\"{{w.rowStyle}}\">\n<span style=\"{{w.av}}\">{{w.ini}}</span>\n<span class=\"ow-sv-ell\" title=\"{{w.name}}\" style=\"font-size: 12px; font-weight: 700\">{{w.name}}</span>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{w.ask}}\" style=\"grid-row: span 2; height: 30px; padding: 0 10px; border-radius: 9px; border: 1px solid #E6E3DD; background: #FFFFFF; color: #1C2233; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 5px\" title=\"{{w.askTitle}}\"><svg width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z\"></path></svg>Ask</button>\n<span style=\"display: flex; flex-wrap: wrap; gap: 4px; min-width: 0\"><sc-for list=\"{{w.items}}\" as=\"i\" hint-placeholder-count=\"2\"><span class=\"ow-sv-ell\" title=\"{{i.title}}\" style=\"{{i.style}}\">{{i.label}}</span></sc-for></span>\n</div>\n</sc-for>\n<sc-if value=\"{{wos.none}}\" hint-placeholder-val=\"{{false}}\"><div style=\"padding: 14px; font-size: 12px; color: #767F91\">No supplier owes you a price</div></sc-if>\n</div>\n<div style=\"padding: 8px 14px 12px; border-top: 1px solid #EFECE6; font-size: 11px; color: #767F91\">Red = the item is already over its time in \u201cSource found\u201d</div>\n</section>\n\n</aside>\n</div>\n</div>\n</div>\n<div class=\"ow-sv-phone\" style=\"font-size: 15px; line-height: 1.35; color: #1C2233\">\n<div style=\"display: flex; flex-direction: column; gap: 16px\">\n\n<header style=\"display: flex; align-items: center; gap: 12px\">\n<div style=\"display: flex; flex-direction: column; gap: 2px\">\n<h1 style=\"margin: 0; font-size: 20px; font-weight: 700\">Sourcing</h1>\n<span style=\"font-size: 12px; color: #5F6980\">{{ph.sub}}</span>\n</div>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{ph.logAsk}}\" style=\"margin-left: auto; height: 44px; padding: 0 14px; border-radius: 9px; border: 1px solid #1C2233; background: #1C2233; color: #FFFFFF; font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"></path></svg>Log an ask</button>\n</header>\n\n<!-- 2x2 metrics -->\n<section aria-label=\"At a glance\" style=\"background: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 8px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr))\">\n<div style=\"padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; border-bottom: 1px solid #EFECE6\"><span style=\"font-size: 12px; color: #0F6B43; font-weight: 600; display: flex; align-items: center; gap: 6px\"><span style=\"width: 8px; height: 8px; border-radius: 2px; background: #0F6B43\"></span>Ready to sell</span><span style=\"display: flex; align-items: baseline; gap: 6px\"><span class=\"ow-sv-mono\" style=\"font-size: 24px; font-weight: 600\">{{ph.ready}}</span><span class=\"ow-sv-mono\" style=\"font-size: 12px; color: #5F6980\">{{ph.readyValue}}</span></span></div>\n<div style=\"padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; border-bottom: 1px solid #EFECE6; border-left: 1px solid #EFECE6\"><span style=\"font-size: 12px; color: #767F91; font-weight: 500\">People waiting</span><span style=\"display: flex; align-items: baseline; gap: 6px\"><span class=\"ow-sv-mono\" style=\"font-size: 24px; font-weight: 600\">{{ph.people}}</span><span style=\"font-size: 12px; color: #767F91\">{{ph.maxWait}}</span></span></div>\n<div style=\"padding: 14px 16px; display: flex; flex-direction: column; gap: 4px\"><span style=\"font-size: 12px; color: #8E2A22; font-weight: 600; display: flex; align-items: center; gap: 6px\"><span style=\"width: 8px; height: 8px; border-radius: 2px; background: #8E2A22\"></span>Over time</span><span class=\"ow-sv-mono\" style=\"font-size: 24px; font-weight: 600\">{{ph.over}}</span></div>\n<div style=\"padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; border-left: 1px solid #EFECE6\"><span style=\"font-size: 12px; color: #95530C; font-weight: 600; display: flex; align-items: center; gap: 6px\"><span style=\"width: 8px; height: 8px; border-radius: 2px; background: #95530C\"></span>Nobody on it</span><span class=\"ow-sv-mono\" style=\"font-size: 24px; font-weight: 600\">{{ph.nobody}}</span></div>\n</section>\n\n<!-- Funnel -->\n<section aria-label=\"Funnel\" style=\"background: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px\">\n<div style=\"display: flex; align-items: baseline; gap: 8px\"><span style=\"font-weight: 600; font-size: 15px\">Funnel</span><span style=\"font-size: 12px; color: #767F91\">90 days</span><span class=\"ow-sv-mono\" style=\"margin-left: auto; font-size: 13px; font-weight: 600; color: #0F6B43\">{{ph.listedPct}}</span></div>\n<div style=\"display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; align-items: end; height: 76px\">\n<sc-for list=\"{{ph.bars}}\" as=\"b\" hint-placeholder-count=\"5\"><div style=\"{{b.style}}\"><span class=\"ow-sv-mono\" style=\"color: #FFFFFF; font-weight: 600; font-size: 14px\">{{b.n}}</span></div></sc-for>\n</div>\n<div style=\"display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; font-size: 11px; color: #5F6980; text-align: center\">\n<span>Asked</span><span>Looking</span><span>Found</span><span>Priced</span><span style=\"color: #0F6B43; font-weight: 600\">Listed</span>\n</div>\n<div style=\"display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; padding-top: 10px; border-top: 1px solid #EFECE6\">\n<sc-for list=\"{{ph.now}}\" as=\"n\" hint-placeholder-count=\"4\"><span style=\"display: flex; gap: 3px; justify-content: center; flex-wrap: wrap\"><sc-for list=\"{{n.sq}}\" as=\"q\" hint-placeholder-count=\"2\"><span style=\"{{q.style}}\"></span></sc-for></span></sc-for>\n<span style=\"font-size: 11px; color: #767F91; text-align: center\">now</span>\n</div>\n</section>\n\n<!-- Discovery -->\n<section aria-label=\"Discovery\" style=\"background: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px\">\n<div style=\"display: flex; align-items: center; gap: 8px\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7A3268\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><path d=\"M20 20l-4-4M8 11h6\"></path></svg><span style=\"font-weight: 600\">Searched, not stocked</span><span style=\"margin-left: auto; font-size: 12px; color: #767F91\">tap to open</span></div>\n<div style=\"display: flex; flex-wrap: wrap; gap: 8px\">\n<sc-for list=\"{{ph.disc}}\" as=\"d\" hint-placeholder-count=\"3\"><button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{d.open}}\" style=\"height: 44px; padding: 0 12px; border-radius: 999px; border: 1px solid #E6E3DD; background: #F6E4F1; color: #7A3268; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; max-width: 100%\"><span class=\"ow-sv-ell\">+ {{d.name}}</span><span class=\"ow-sv-mono\" style=\"font-size: 12px\">{{d.n}}</span></button></sc-for>\n<sc-if value=\"{{ph.noDisc}}\" hint-placeholder-val=\"{{false}}\"><span style=\"font-size: 13px; color: #767F91\">No quote searches came up empty this month</span></sc-if>\n</div>\n</section>\n\n<!-- Filter -->\n<div role=\"group\" aria-label=\"Filter\" style=\"display: flex; gap: 6px; overflow: hidden\">\n<sc-for list=\"{{ph.filters}}\" as=\"f\" hint-placeholder-count=\"4\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{f.pick}}\" aria-pressed=\"{{f.pressed}}\" style=\"{{f.style}}\">{{f.label}}<span class=\"ow-sv-mono\" style=\"font-size: 12px; opacity: .8\">{{f.count}}</span></button>\n</sc-for>\n</div>\n\n<!-- Cards -->\n<div style=\"display: flex; flex-direction: column; gap: 10px\">\n<sc-for list=\"{{ph.cards}}\" as=\"c\" hint-placeholder-count=\"6\">\n<article style=\"background: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px\">\n<div style=\"display: flex; gap: 12px; align-items: flex-start\">\n<div style=\"position: relative; width: 40px; height: 40px; flex-shrink: 0; border-radius: 8px; background: #F7F5F2; border: 1px solid #E6E3DD; box-sizing: border-box; display: flex; align-items: center; justify-content: center; color: #767F91\">\n<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21 8l-9-5-9 5 9 5 9-5z\"></path><path d=\"M3 8v8l9 5 9-5V8\"></path><path d=\"M12 13v8\"></path></svg>\n<span style=\"{{c.dotStyle}}\"></span>\n</div>\n<div style=\"flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px\">\n<span class=\"ow-sv-ell\" style=\"font-weight: 600; font-size: 15px\">{{c.name}}</span>\n<span style=\"display: flex; align-items: center; gap: 6px; font-size: 12px; color: #767F91; min-width: 0\"><span style=\"{{c.pillStyle}}\">{{c.stateLabel}}</span><span class=\"ow-sv-ell\">{{c.meta}}</span></span>\n</div>\n<span role=\"img\" aria-label=\"{{c.knownLabel}}\" style=\"display: flex; gap: 3px; padding-top: 4px\"><sc-for list=\"{{c.kn}}\" as=\"k\" hint-placeholder-count=\"4\"><span style=\"{{k.style}}\"></span></sc-for></span>\n</div>\n<div style=\"display: flex; align-items: center; gap: 10px\">\n<span style=\"display: flex; gap: 3px\"><sc-for list=\"{{c.segs}}\" as=\"s\" hint-placeholder-count=\"5\"><span style=\"{{s.style}}\"></span></sc-for></span>\n<span style=\"font-size: 12px; color: #5F6980\">{{c.stepLabel}}</span>\n<span class=\"ow-sv-mono\" style=\"{{c.dayStyle}}\">{{c.days}}/{{c.limit}}d</span>\n<span style=\"margin-left: auto; display: flex; align-items: center; gap: 4px; font-size: 12px; color: #5F6980\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#767F91\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"9\" cy=\"8\" r=\"3.5\"></circle><path d=\"M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5\"></path></svg><span class=\"ow-sv-mono\" style=\"font-weight: 600; color: #1C2233\">{{c.askers}}</span><span class=\"ow-sv-mono\">\u00b7 {{c.wait}}d</span></span>\n</div>\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{c.open}}\" style=\"{{c.btnStyle}}\">{{c.move}}</button>\n</article>\n</sc-for>\n<sc-if value=\"{{ph.more}}\" hint-placeholder-val=\"{{true}}\">\n<button type=\"button\" class=\"ow-sv-btn\" onClick=\"{{ph.showAll}}\" style=\"height: 44px; border-radius: 9px; border: 1px dashed #E0DCD4; background: transparent; color: #5F6980; font-size: 14px; font-weight: 600\">{{ph.moreLabel}}</button>\n</sc-if>\n</div>\n\n</div>\n</div>\n<!-- PRINTABLE FIELD WORKSHEET (screen: hidden; print: the only thing on the page) -->\n<div class=\"ow-sv-ws\" style=\"display: none; background: #FFFFFF; color: #1C2233; padding: 18px 22px; font-size: 11px\">\n<div style=\"display: flex; align-items: flex-end; gap: 12px; padding-bottom: 10px; border-bottom: 2px solid #1C2233\">\n<div style=\"width: 30px; height: 30px; border-radius: 7px; background: #C93A30; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px\">O</div>\n<div style=\"display: flex; flex-direction: column\"><span style=\"font-size: 16px; font-weight: 700\">Sourcing worksheet</span><span style=\"font-size: 11px; color: #5F6980\">Omni-Ware \u00b7 {{cl.date}} \u00b7 {{cl.wsScope}}</span></div>\n<span style=\"margin-left: auto; display: flex; gap: 18px; font-size: 11px\"><span>Taken by ____________</span><span>Back by ______</span></span>\n</div>\n<div style=\"display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 1.3fr); gap: 8px; margin-top: 10px\">\n<sc-for list=\"{{cl.wsPri}}\" as=\"p\" hint-placeholder-count=\"3\">\n<div style=\"border: 1px solid #1C2233; border-radius: 6px; padding: 6px 8px; display: flex; align-items: center; gap: 8px\"><span class=\"ow-sv-mono\" style=\"font-size: 12px; letter-spacing: 1px\">{{p.dots}}</span><span style=\"display: flex; flex-direction: column; line-height: 1.15\"><span style=\"font-weight: 700; font-size: 12px\">{{p.label}} \u00b7 {{p.n}}</span><span style=\"font-size: 10px; color: #5F6980\">{{p.sub}}</span></span></div>\n</sc-for>\n<div style=\"border: 1px solid #1C2233; border-radius: 6px; padding: 6px 8px; display: flex; flex-direction: column; justify-content: center; line-height: 1.2\"><span style=\"font-weight: 700; font-size: 12px\">{{cl.wsPlan}}</span><span style=\"font-size: 10px; color: #5F6980\">{{cl.wsTime}}</span></div>\n</div>\n<sc-for list=\"{{cl.wsSecs}}\" as=\"sec\" hint-placeholder-count=\"3\">\n<div style=\"margin-top: 12px; break-inside: avoid-page\">\n<div style=\"display: flex; align-items: baseline; gap: 8px; padding: 4px 0; border-bottom: 2px solid #1C2233\"><span style=\"font-size: 13px; font-weight: 700\">{{sec.title}}</span><span style=\"font-size: 10px; color: #5F6980\">{{sec.sub}}</span></div>\n<div role=\"table\" aria-label=\"{{sec.title}}\">\n<div role=\"row\" style=\"display: grid; grid-template-columns: 58px minmax(0, 1.25fr) minmax(0, 2.2fr) minmax(0, 1.1fr) minmax(0, 1fr) 22px; background: #EFECE6; font-weight: 700; font-size: 10px; border-bottom: 1px solid #1C2233\">\n<span role=\"columnheader\" style=\"padding: 4px\">Priority</span><span role=\"columnheader\" style=\"padding: 4px\">{{sec.whoHead}}</span><span role=\"columnheader\" style=\"padding: 4px\">Ask \u00b7 item</span><span role=\"columnheader\" style=\"padding: 4px\">Last known</span><span role=\"columnheader\" style=\"padding: 4px; background: #FFFFFF\">Found</span><span role=\"columnheader\" style=\"padding: 4px\">\u2713</span>\n</div>\n<sc-for list=\"{{sec.lines}}\" as=\"w\" hint-placeholder-count=\"4\">\n<div role=\"row\" style=\"{{w.style}}\">\n<span role=\"cell\" style=\"padding: 5px 4px; display: flex; flex-direction: column; line-height: 1.15\"><span class=\"ow-sv-mono\" style=\"font-size: 11px; letter-spacing: 1px\">{{w.dots}}</span><span style=\"font-size: 9px; font-weight: 700\">{{w.pLabel}}</span></span>\n<span role=\"cell\" style=\"padding: 5px 4px; display: flex; flex-direction: column; line-height: 1.2; min-width: 0\"><span style=\"font-weight: 700\">{{w.who}}</span><span class=\"ow-sv-mono\" style=\"font-size: 10px\">{{w.contact}}</span></span>\n<span role=\"cell\" style=\"padding: 5px 4px; line-height: 1.25\"><span style=\"font-weight: 600\">{{w.ask}}</span><span style=\"display: block; color: #5F6980; font-size: 10px\">{{w.item}} \u00b7 {{w.due}}</span></span>\n<span role=\"cell\" style=\"padding: 5px 4px\">{{w.last}}</span>\n<span role=\"cell\" style=\"padding: 5px 4px; border-left: 1px solid #CFCAC1\"></span>\n<span role=\"cell\" style=\"padding: 5px 4px\"><span style=\"display: block; width: 11px; height: 11px; border: 1.5px solid #1C2233\"></span></span>\n</div>\n</sc-for>\n</div>\n</div>\n</sc-for>\n<sc-if value=\"{{cl.wsEmpty}}\" hint-placeholder-val=\"{{false}}\"><div style=\"margin-top: 14px; padding: 14px; border: 1px dashed #1C2233; text-align: center\">Nothing to chase today.</div></sc-if>\n<div style=\"margin-top: 10px; font-size: 10px; color: #5F6980\">\u25cf\u25cf\u25cf Must: overdue, or it sets your price or cost, or it moves a verdict a lot \u00b7 \u25cf\u25cf\u25cb Should \u00b7 \u25cf\u25cb\u25cb If time. Prices go stale after 14 days, quotes after their validity (7 days), buyer asks after 14 days.</div>\n</div>\n</div>\n</div>";

/* ---------------- Mounting ----------------
   One console per page load. renderSourcing() (and the 30-second refresh
   that calls it) re-renders in place, so what is open stays open. */
let owSourcingConsole = null;
function renderSourcingConsole() {
  const wrap = document.getElementById('sourcingWrap');
  if (!wrap) return;
  if (!owSourcingConsole || !wrap.__owsv) {
    owSourcingConsole = new OwSourcingConsole({});
    wrap.innerHTML = '';
    wrap.__owsv = owsvMount(wrap, OWSV_MARKUP, owSourcingConsole);
  } else {
    wrap.__owsv.render();
  }
}
