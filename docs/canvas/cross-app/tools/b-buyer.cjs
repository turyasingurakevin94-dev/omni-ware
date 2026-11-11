// Buyer boards for round 1: BUY-4 (a stop's total is the sum of its lines), BUY-2 + BUY-5 (counts that agree; old invoiced orders still to buy).
const P = require('./parts.cjs');
const { T, ic, mono, pill, sq, row, chev, toast } = P;

const planHead = `<div style="display:flex;align-items:center;gap:12px;padding:14px 16px 8px"><span class="xbtn">${ic('x', 16, 2.2)}</span><span class="col"><span style="font-size:20px;font-weight:700">Plan the trip</span><span class="sb">Sat 17 Oct</span></span><span style="width:40px;height:40px;border-radius:999px;background:${T.navy};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">DO</span></div>`;
const stop = (n, name, sub, total, open, lines, bad) => `<div class="card" style="padding:12px;display:flex;flex-direction:column;gap:10px;${bad ? 'box-shadow:inset 0 0 0 1.5px #E8B4AE' : ''}"><div style="display:flex;align-items:center;gap:12px"><span class="m" style="width:34px;height:34px;border-radius:10px;background:${T.tile};display:flex;align-items:center;justify-content:center">${n}</span><span class="col"><span class="tt">${name}</span><span class="sb">${sub}</span></span><span class="m" style="font-size:15px;${bad ? 'color:' + T.bad : ''}">${total}</span>${ic(open ? 'up' : 'chev', 16, 2.2)}</div>${open ? lines : ''}</div>`;
const line = (name, how, sum) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0 0 46px;border-top:1px solid ${T.tile}"><span class="col"><span class="tt" style="font-size:13px">${name}</span><span class="sb">${pill('GA', 'info')} #0212 · ${mono(how)}</span></span><span class="m" style="font-size:13px">${sum}</span></div>`;
const katwe = line('Door hinge 4 in', '2 pack × 42,000', '84,000') + line('Padlock 50 mm', '2 pack × 50,000', '100,000');
const sumRow = (v, bad) => `<div style="display:flex;justify-content:space-between;padding:8px 0 0 46px;border-top:1px dashed ${T.dash};font-size:13px;font-weight:700"><span>Lines add up to</span><span class="m" style="${bad ? 'color:' + T.bad : 'color:' + T.good}">${v}</span></div>`;
const dock = (amt, label, st) => `<div class="dock"><div style="display:flex;justify-content:space-between;align-items:center"><span style="display:flex;align-items:center;gap:10px"><span style="width:36px;height:36px;border-radius:999px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">EA</span><span class="col"><span class="eye" style="color:${T.onN2}">Cash from</span><span style="font-weight:700">Esther</span></span></span><span style="display:flex;flex-direction:column;align-items:flex-end"><span class="m" style="font-size:22px">${amt}</span><span class="m" style="font-size:12px;color:${T.mint}">2 stops · 3 lines</span></span></div>
  <div class="slide">${st === 'sending' ? `<span style="position:absolute;inset:0;border-radius:999px;background:rgba(201,58,48,.35)"></span><span class="knob" style="margin-left:auto;position:relative"><span class="spin"></span></span>` : `<span class="knob"${st === 'off' ? ' style="background:#59627A"' : ''}>${ic('chev', 22, 2.4)}</span>`}<span class="lb">${label}</span></div></div>`;
function plan(st) {
  const bad = st === 'before';
  const t1 = bad ? '920,000' : '184,000', all = bad ? '1,460,000' : '724,000';
  const open = st !== 'default' && st !== 'sending' && st !== 'kept';
  const body = `${planHead}<div class="body" style="padding-top:6px">
    ${stop(1, 'Katwe Fabricators', `2 lines · #0212`, t1, open, katwe + (open ? sumRow('184,000', false) : ''), bad)}
    ${stop(2, 'Owino Plumbing', '1 line · #0553', '540,000', false, '')}
    ${bad ? `<div class="note" style="background:${T.badS};color:${T.bad}">Stop says ${mono('920,000')}: each line counted as a full carton of ${mono('10')} (10 × 42,000 + 10 × 50,000), while the lines show 2 packs.</div>` : ''}
    ${st === 'carton' ? `<div class="note" style="background:${T.infoS};color:${T.info}">A carton bought for the shelf is its own line, asked of Ruth first (“A carton to OK”); it is never folded into an order’s line.</div>` : ''}
  </div>`;
  const label = st === 'kept' ? 'Sends when back' : st === 'sending' ? 'Sending…' : 'Send cash ask to Esther';
  return body + dock(all, label, st) + (st === 'kept' ? `<div class="notice" style="position:absolute;left:0;right:0;bottom:170px;background:${T.warnS}">${ic('offline', 18)}<span style="flex:1">Offline · saved · ${mono('1')} to send</span></div>` : '');
}
const trip = P.board('Buyer · Plan the trip · stop total (BUY-4)', [
  { state: 'BEFORE · #0212', sub: 'Stop and cash ask 920,000; Today 184,000', html: plan('before') },
  { state: 'AFTER · default', sub: 'Stop = its lines = 184,000; the ask = sum of stops', html: plan('default') },
  { state: 'Expanded (pressed)', sub: 'Lines and their sum, in the same figures as the stop', html: plan('open') },
  { state: 'Sending', sub: 'Esther is asked for exactly 724,000', html: plan('sending') },
  { state: 'Offline', sub: 'Kept; sends when back; figure unchanged', html: plan('kept') },
  { state: 'A forced carton', sub: 'Stays the Manager’s carton ask (0151), never a silent ×10', html: plan('carton') },
]);

/* BUY-2 + BUY-5 */
const tile = (n, w, unit, extra = '') => `<span class="card" style="padding:12px;display:flex;flex-direction:column;gap:4px;${extra}"><b class="m" style="font-size:24px">${n}</b><span class="tt" style="font-size:13px">${w}</span><span class="sb">${unit}</span></span>`;
function today(st) {
  const head = `<header style="background:${T.navy};color:#fff;border-radius:0 0 28px 28px;padding:16px 20px 20px;display:flex;flex-direction:column;gap:6px"><span style="font-size:20px;font-weight:700">Good morning, Denis</span><span style="font-size:12px;font-weight:600;color:${T.onN}">Sat 17 Oct · Live</span></header>`;
  if (st === 'before') return `${head}<div class="body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${tile(1, 'To ask', 'supplier')}${tile(2, 'Asked', 'suppliers')}</div>
    <div class="card row">${sq('tick', T.goodS, T.good)}<span class="col"><span class="tt">Every supplier asked</span><span class="sb">waiting for answers</span></span></div>
    <div class="note" style="background:${T.badS};color:${T.bad}">Tile 1 (suppliers, counting “no supplier” as one) · the list shows 3 orders · “Every supplier asked” while To ask is 1 · #0148 (invoiced, still to buy) is nowhere</div></div>`;
  const empty = st === 'empty';
  return `${head}<div class="body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${empty ? tile(0, 'To ask', 'nothing to ask') + tile(2, 'Asked', `suppliers · ${mono('4')} orders`) : tile(1, 'To ask', `supplier · ${mono('3')} orders`, 'box-shadow:inset 0 0 0 1.5px ' + T.ink) + tile(2, 'Asked', `suppliers · ${mono('4')} orders`)}</div>
    ${empty ? `<div class="card row">${sq('tick', T.goodS, T.good)}<span class="col"><span class="tt">Every supplier asked</span><span class="sb">only when To ask and Needs a supplier are both 0</span></span></div>`
      : `<div class="sec">To ask <small>${mono('1')} supplier · ${mono('3')} orders</small></div><div class="card row" style="min-height:66px">${sq('store', T.tile, T.soft)}<span class="col"><span class="tt">Owino Plumbing</span><span class="sb">#0553 · #0560 · #0562</span></span><span style="height:36px;padding:0 14px;border-radius:999px;background:${T.navy};color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center">Ask</span></div>`}
    <div class="sec">To buy <small>${mono('2')} orders</small></div>
    <div class="grp">${row(sq('cart', T.infoS, T.info), 'Adinan · #0148', `Shafik + Roto · invoiced · goods not in`, `<span class="m" style="padding:2px 8px;border-radius:999px;font-size:11px;background:${T.badS};color:${T.bad}">94 days</span>`)}${row(sq('cart', T.infoS, T.info), 'Kato Construction · #0552', 'Namanve Sheets · found', chev)}</div></div>`;
}
const supHead = `<header class="head"><div style="display:flex;align-items:center;gap:10px"><span class="col"><span style="font-size:26px;font-weight:800;letter-spacing:-.02em">Suppliers</span></span></div>`;
function suppliers(after) {
  const hero = after
    ? `<div style="display:flex;align-items:baseline;gap:8px"><b class="m" style="font-size:30px">18</b><span style="color:${T.onN}">of</span><b class="m" style="font-size:30px">22</b><span style="font-size:13px;font-weight:600;color:${T.onN}">asked said yes · last 30 days</span></div><span style="display:flex;height:8px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden"><span style="width:82%;background:${T.mint}"></span></span>`
    : `<div style="display:flex;align-items:baseline;gap:8px"><b class="m" style="font-size:30px">31</b><span style="color:${T.onN}">of</span><b class="m" style="font-size:30px">3</b><span style="font-size:13px;font-weight:600;color:${T.onN}">Found · last 10 asks</span></div>`;
  const r = (n, f, a) => row(sq('store', T.tile, T.soft), n, `${mono(f)} of ${mono(a)} said yes`, `<span style="display:flex;gap:2px">${Array.from({ length: Math.min(a, 10) }, (_, i) => `<span style="width:6px;height:16px;border-radius:2px;background:${i < f ? T.good : T.line}"></span>`).join('')}</span>`);
  return `${supHead}${hero}</header><div class="body"><div class="grp">${after ? r('Namanve Sheets', 9, 10) + r('Owino Plumbing', 6, 8) + r('Katwe Fabricators', 3, 4) : r('Namanve Sheets', 9, 1) + r('Owino Plumbing', 6, 0) + r('Katwe Fabricators', 3, 2)}</div>
  ${after ? `<div class="note" style="background:${T.tile};color:${T.soft}">A yes always counts as asked: found ≤ asked, both in the last 30 days, live orders only.</div>` : `<div class="note" style="background:${T.badS};color:${T.bad}">Found counts every yes ever (supplier-app answers have no ask time); asked counts only asks with a time</div>`}</div>`;
}
const counts = P.board('Buyer · counts that agree, nothing aged off (BUY-2, BUY-5)', [
  { state: 'Today · BEFORE', sub: 'Tile 1 vs list 3; “Every supplier asked”; #0148 missing', html: today('before') },
  { state: 'Today · AFTER default', sub: 'Tile says what it counts; list matches; old invoiced orders still to buy stay', html: today('default') },
  { state: 'Today · empty', sub: '“Every supplier asked” only at 0 and 0', html: today('empty') },
  { state: 'Suppliers · BEFORE', sub: '“31 of 3”, a page “6 of 0”', html: suppliers(false) },
  { state: 'Suppliers · AFTER', sub: 'Said yes of asked, one window', html: suppliers(true) },
]);
module.exports = { 'BuyerTripTotal.dc.html': trip, 'BuyerCounts.dc.html': counts };
