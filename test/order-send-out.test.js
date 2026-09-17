#!/usr/bin/env node
'use strict';
/*
 * Sending a packed order out, from the order's own dialog.
 *
 * Before this, the only thing on a console that could move an order from
 * Preparing to Out lived inside #savedQuotesWrap -- which is the PHONE's
 * order screen (.ow-ot-fone is display:none above 820px). The act ran, the
 * hidden row was rewritten, and nothing the owner could see moved. The
 * form now lives in the order's dialog, as the pane that replaces the
 * lines while the question is who is carrying it.
 *
 * Three things went wrong the first time it was built, and each is a
 * check here:
 *
 *  1. The answer decides which boxes are drawn. Reading the form wholesale
 *     reports '' for a box that is not on screen, so re-picking hired
 *     transport after a look at "the client's person" came back with the
 *     vehicle wiped. Only what is drawn may speak for itself.
 *
 *  2. The act is dead until the form says enough, and the only thing that
 *     re-decided that was a redraw -- which typing never causes. Hired
 *     transport could be named in full and the move stayed grey. It has to
 *     answer the typing itself.
 *
 *  3. Once it has gone the pane is the answer, not the question, which is
 *     right until the lorry that was named is not the lorry that came.
 *     "Somebody else" has to be able to put one order back to the
 *     question -- and that is a state of the open dialog, not a record, so
 *     it is forgotten when the dialog closes and when the move lands.
 *
 * Run: node test/order-send-out.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('order send-out');
const admin = read('index.html');
const shared = read('shared-worker.js');

/* ---------- a form the size of a page, without a page ------------------
   Enough DOM for the two readers to work on: a root that can be asked for
   its [data-car] boxes, and boxes that carry a name and a value. */
function form(kind, fields) {
  const boxes = [{ dataset: { car: 'kind' }, value: kind }]
    .concat(Object.keys(fields).map((k) => ({ dataset: { car: k }, value: fields[k] })));
  return {
    dataset: { load: '364' },
    querySelectorAll() { return boxes; },
    querySelector(sel) {
      const m = /\[data-car="([^"]+)"\]/.exec(sel);
      return m ? boxes.find((b) => b.dataset.car === m[1]) || null : null;
    },
  };
}

const data = { savedQuotes: [], staff: [] };
const scope = compileScope(
  [
    extractDeclaration(shared, 'CARRIER_KINDS', 'shared-worker.js'),
    extractFunction(shared, 'carrierKindsFor', 'shared-worker.js'),
    extractFunction(shared, 'carrierAsks', 'shared-worker.js'),
    extractFunction(shared, 'staffEligibleForRole', 'shared-worker.js'),
    extractDeclaration(admin, 'otLoadDrafts', 'index.html'),
    extractDeclaration(admin, 'OT_CARRIER_NAME', 'index.html'),
    extractDeclaration(admin, 'OT_CARRIER_WHY', 'index.html'),
    extractFunction(admin, 'otLoadHarvest', 'index.html'),
    extractFunction(admin, 'otLoadReady', 'index.html'),
    extractFunction(admin, 'otLoadPaneHTML', 'index.html'),
    extractFunction(admin, 'otGoneePaneHTML', 'index.html'),
    // The draft store is a Map the screen writes and these read; the test
    // needs the same door into it that otLoadLive and otDlgAct use.
    'function __draft(id, v){ if(arguments.length > 1) otLoadDrafts.set(id, v); return otLoadDrafts.get(id); }',
  ],
  {
    data,
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    itemDisplayName: (it) => it.productName,
    quoteLineQtyText: (it) => ({ text: `${it.qty} ${it.unit}` }),
    deliveryAssigneeLabel: () => 'somebody',
    otWhen: () => '13:39',
    otDlgGhost: (act, label, ds) => `<button data-dlg="${act}"${ds || ''}>${label}</button>`,
  },
  ['carrierKindsFor', 'carrierAsks', 'otLoadHarvest', 'otLoadReady', 'otLoadPaneHTML', 'otGoneePaneHTML', '__draft'],
);
// What the screen does on every keystroke and every pick: harvest, keep.
const put = (id, kind, fields) => scope.__draft(id, scope.otLoadHarvest(id, form(kind, fields || {})));

const ORDER = { id: 364, status: 'preparing', items: [{ productName: 'Gloss Paint', unit: 'Tin', qty: 8 }] };
const seedStaff = () => { data.staff = [
  { id: 'ST001', name: 'Musa Kato', role: 'worker' },
  { id: 'ST002', name: 'Grace Namuli', role: 'delivery' },
]; };
seedStaff();

/* ---------- 1. only what is drawn may speak for itself ---------------- */
{
  // Hired transport: all three boxes are on screen, all three are read.
  const d = put(364, 'hired', { name: 'Kasule', what: 'Fuso UAX 123K', phone: '0772 418 220' });
  t.check(d.name === 'Kasule' && d.what === 'Fuso UAX 123K' && d.phone === '0772 418 220',
    'a drawn box says what it says');
  t.check(d.kind === 'hired' && d.staffId === '',
    'and the hidden kind box is read when the draft has no answer yet');

  // Now the client's own person -- no vehicle box. The vehicle is not
  // gone, it is simply not being asked about.
  const kept = put(364, 'client', { name: 'Kasule', phone: '0772 418 220' });
  t.check(kept.what === 'Fuso UAX 123K',
    'a box that is not on screen cannot wipe what it holds');

  // A box that IS on screen and empty means empty -- clearing a field is
  // an answer too, and must not be undone by the draft.
  const cleared = put(364, 'client', { name: '', phone: '0772 418 220' });
  t.check(cleared.name === '', 'while clearing a drawn box is an answer, and stands');

  // A staff pick is 'staff' plus the id, from one value.
  const st = put(999, 'staff:ST002', {});
  t.check(st.kind === 'staff' && st.staffId === 'ST002', 'one of ours arrives as a kind and an id');
}

/* ---------- 2. when the act is allowed to be live --------------------- */
{
  const ready = (draft) => { scope.__draft(364, null); put(364, draft.k, draft.f); return scope.otLoadReady(ORDER); };
  t.check(scope.otLoadReady({ id: 7, status: 'preparing' }) === false,
    'nothing answered, nothing to press');
  t.check(ready({ k: 'staff:ST002' }) === true,
    'one of ours needs nothing more, so the move is live at once');
  t.check(ready({ k: 'hired', f: { name: '', what: '', phone: '' } }) === false,
    'hired transport with nobody named is not ready');
  t.check(ready({ k: 'hired', f: { name: 'Kasule', what: 'Fuso UAX 123K', phone: '' } }) === false,
    'nor with no way to reach them');
  t.check(ready({ k: 'hired', f: { name: 'Kasule', what: 'Fuso UAX 123K', phone: '0772 418 220' } }) === true,
    'named and reachable, and it is live');
  t.check(ready({ k: 'client', f: { name: 'Their driver', phone: '0772 418 220' } }) === true,
    'the client\'s own person is asked the two that apply, not the three');
  // An agent collecting their own answers the question by existing.
  t.check(scope.otLoadReady({ id: 8, status: 'pending_delivery', deliveryMode: 'agent_pickup' }) === true,
    'an agent collecting their own needs no answer at all');

  /* AND THE ACT ANSWERS THE TYPING. otLoadReady is only as good as what
     calls it: nothing did, between draws, until this listener. */
  t.check(/addEventListener\('input'/.test(admin) && /otLoadLive\(f\.closest\('\[data-load\]'\)\)/.test(admin),
    'the dialog listens to the typing itself');
  const live = extractFunction(admin, 'otLoadLive', 'index.html');
  t.check(/otLoadDrafts\.set\(id, otLoadHarvest\(id, root\)\)/.test(live),
    'every keystroke is kept, so a redraw from anywhere finds it');
  t.check(/go\.disabled = !otLoadReady\(q\)/.test(live),
    'and the move goes live the moment the form says enough');
}

/* ---------- 3. the pane asks one question, people first --------------- */
{
  put(401, '', {});
  const blank = scope.otLoadPaneHTML(Object.assign({}, ORDER, { id: 401 }));
  const names = [];
  blank.replace(/class="ow-ld-n">([^<]*)</g, (_, n) => names.push(n));
  t.check(names[0] === 'Musa Kato' && names[1] === 'Grace Namuli',
    'the list names the people first, by name');
  t.check(names.includes('Hired transport') && names.includes('The client’s person'),
    'and the ways it goes out with somebody who is not ours after them');
  t.check(!names.some((n) => n.length > 22),
    'each card\'s name fits the card it is drawn in');
  t.check(!/ow-on/.test(blank) && !/data-car="name"/.test(blank),
    'nothing is chosen for you, and nothing further is asked until something is');
  t.check(/aria-checked="false"/.test(blank) && /role="radiogroup"/.test(blank),
    'it is one question with one answer, and says so');

  put(402, 'staff:ST002', {});
  const ours = scope.otLoadPaneHTML(Object.assign({}, ORDER, { id: 402 }));
  t.check(/data-pick="staff:ST002"[^>]*>/.test(ours.replace(/\s+/g, ' ')) && /ow-ld-o ow-on/.test(ours),
    'picking one of ours marks that card');
  t.check(!/data-car="name"/.test(ours), 'and asks nothing further');

  put(403, 'hired', { name: '', what: '', phone: '' });
  const hired = scope.otLoadPaneHTML(Object.assign({}, ORDER, { id: 403 }));
  ['name', 'what', 'phone'].forEach((k) => t.check(hired.includes(`data-car="${k}"`),
    `hired transport is asked for its ${k}`));
  t.check(/Driver or company/.test(hired) && /Vehicle/.test(hired) && />Phone</.test(hired),
    'each box is labelled with what goes in it');
  t.check(hired.indexOf('Gloss Paint') > hired.indexOf('data-car="phone"'),
    'the lines stay underneath, as what is being sent rather than what is being asked');
}

/* ---------- 4. once it has gone, the pane is the answer ---------------- */
{
  const out = Object.assign({}, ORDER, { status: 'pending_delivery',
    carrier: { kind: 'hired', name: 'Kasule', what: 'Fuso UAX 123K', phone: '0772 418 220', at: 1 } });
  const gone = scope.otGoneePaneHTML(out);
  t.check(/class="ow-ld-gone-n">Kasule has it</.test(gone),
    'the heading is the person, not the person and their lorry run together');
  t.check(/0772 418 220/.test(gone) && /Loaded 13:39/.test(gone),
    'with when it went and how to reach them underneath');
  t.check(/data-dlg="reask"/.test(gone),
    'and a quiet way back to the question when the lorry that came is not the one that was named');
  t.check(!/btn-accent/.test(gone), 'which is not where the accent goes');

  const nameless = scope.otGoneePaneHTML(Object.assign({}, out, { carrier: { kind: 'staff' } }));
  t.check(/somebody has it/.test(nameless),
    'a carrier with no name of its own falls back to the board\'s reading rather than going blank');
}

/* ---------- 5. re-asking is a state of the dialog, not a record -------- */
{
  const spec = extractFunction(admin, 'otPreviewSpec', 'index.html');
  t.check(/const reask = q\.status === 'pending_delivery' && otLoadReask\.has\(q\.id\);/.test(spec),
    'the question can be reopened on an order that has already gone');
  t.check(/const loading = \(!!act && act\.act === 'loaded'\) \|\| reask;/.test(spec)
    && /&& !reask;/.test(spec),
    'and while it is open the pane is the question again, not the answer');
  t.check(/label: q\.status === 'pending_delivery' \? 'That is who has it' : 'Send it out'/.test(spec),
    'the move says which of the two it is doing');
  t.check(/case 'reask': otLoadReask\.add\(id\); otDlgDraw\(\); break;/.test(extractFunction(admin, 'otDlgAct', 'index.html')),
    '"Somebody else" is what opens it');
  t.check(/if\(otDlgNow\) otLoadReask\.delete\(otDlgNow\.id\);/.test(extractFunction(admin, 'otDlgClose', 'index.html')),
    'closing the dialog forgets it — it was never a fact about the order');
  t.check(/if\(went\)\{ otLoadDrafts\.delete\(id\); otLoadReask\.delete\(id\); \}/.test(extractFunction(admin, 'otLoadGo', 'index.html')),
    'and naming somebody answers it');
  t.check(/const otLoadReask = new Set\(\);/.test(admin) && !/otLoadReask/.test(shared),
    'so it lives with the screen, and never reaches the books');
}

/* ---------- 6. the move itself is still the form's -------------------- */
{
  const go = extractFunction(admin, 'otLoadGo', 'index.html');
  t.check(/document\.querySelector\('#otDlg \[data-load\]'\)/.test(go),
    'the act in the dialog foot finds the form a pane away from it');
  t.check(/const went = loadOrder\(id, car\);/.test(go),
    'and it is loadOrder that moves the order, carrying who has it');
  t.check(/else if\(root\) otLoadDrafts\.set\(id, car\);/.test(go),
    'a refused load keeps what was typed');
}

process.exit(t.done() ? 1 : 0);
