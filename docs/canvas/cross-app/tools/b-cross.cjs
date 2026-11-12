// Cross-app boards for round 1: X-1 cancel asks, X-2 + SAL-1 a line's buying word, X-3/X-4 Manager words.
const P = require('./parts.cjs');
const { T, ic, mono, pill, sq, row, chev, toast, tabbar, sheet, pushHead, desk } = P;

/* ---------- X-1 · Sales order page and the Buyer ---------- */
const orderHead = (stage) => `<header class="head" style="padding:12px 16px 18px"><div style="display:flex;align-items:center;gap:10px"><span class="hb">${ic('back', 18, 2.2)}</span><span class="col"><span style="font-size:17px;font-weight:700">Ggaba Stores</span><span style="font-size:12px;font-weight:600;color:${T.onN}">#0558 · taken 9:12 · Grace</span></span></div>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid rgba(255,255,255,.08);padding-top:12px"><span style="display:flex;flex-direction:column;gap:3px"><span style="font-size:24px;font-weight:700;letter-spacing:-.02em">${stage}</span><span style="font-size:13px;font-weight:600;color:${T.onN}">2 lines · pickup</span></span><span class="m" style="font-size:22px">430,000</span></div></header>`;
const lines2 = `<div class="grp">${row(sq('box', T.tile, T.soft), 'PVC pipe 4 in', `${mono('6 × 45,000')}`, `<span class="m" style="font-size:14px">270,000</span>`)}${row(sq('box', T.tile, T.soft), 'Elbow 4 in', `${mono('20 × 8,000')}`, `<span class="m" style="font-size:14px">160,000</span>`)}</div>`;
const takeBtn = `<span class="btn red">${ic('cash', 18)}Take payment · ${mono('430,000')}</span>`;
function salesOrder(st) {
  const stage = st === 'yes' ? 'Cancelled' : 'Checking';
  let card = '', foot = takeBtn, extra = '';
  if (st === 'asked' || st === 'sending') {
    card = `<div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px;box-shadow:0 1px 2px rgba(22,32,60,.05),inset 0 0 0 1.5px #BBD3EC">
      <div style="display:flex;gap:12px;align-items:center">${sq('clock', T.infoS, T.info)}<span class="col"><span class="tt">Cancel asked · Ruth decides</span><span class="sb">“Customer changed their mind” · asked ${mono('10:05')}</span></span>${pill('Waiting', 'info')}</div>
      <div style="display:flex;gap:6px;align-items:center;font-size:12px;font-weight:600;color:${T.soft}">${ic('lock', 14)}Payment and changes wait for Ruth’s answer</div></div>`;
    foot = `<span class="btn ghost">${st === 'sending' ? '<span class="spin dk"></span>Sending…' : 'Take the ask back'}</span>`;
  } else if (st === 'yes') {
    card = `<div class="card" style="padding:14px;display:flex;gap:12px;align-items:center">${sq('x', T.tile, T.soft)}<span class="col"><span class="tt">Ruth cancelled it · 10:21</span><span class="sb">Nothing was paid · nothing was packed</span></span></div>`;
    foot = `<span class="btn navy">Back to Orders</span>`;
    extra = toast('Ruth cancelled #0558');
  } else if (st === 'no') {
    card = `<div class="card" style="padding:14px;display:flex;gap:12px;align-items:center">${sq('ret', T.warnS, T.warn)}<span class="col"><span class="tt">Ruth kept the order</span><span class="sb">“Goods are already bought” · 10:21</span></span></div>`;
  }
  return `${orderHead(stage)}<div class="body">${card}${lines2}<div style="margin-top:8px">${foot}</div></div>${extra}`;
}
const buyerRow = (who, n, sub, right, dim) => `<div class="card row" style="min-height:66px;${dim ? 'opacity:.6' : ''}">${sq('box', T.tile, T.soft)}<span class="col"><span class="tt">${who} <span class="m" style="color:${T.soft};font-weight:600">${n}</span></span><span class="sb">${sub}</span></span>${right}</div>`;
const buyerHeadW = (t, sub) => `<div style="display:flex;align-items:center;gap:12px;padding:14px 16px 8px"><span class="xbtn">${ic('back', 18, 2.2)}</span><span class="col"><span style="font-size:20px;font-weight:700">${t}</span><span class="sb">${sub}</span></span><span style="width:40px;height:40px;border-radius:999px;background:${T.navy};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">DO</span></div>`;
const chips = (arr) => `<div style="display:flex;gap:6px;overflow:hidden">${arr.map(([t, n, on]) => `<span style="flex:none;height:44px;padding:0 14px;border-radius:999px;background:${on ? T.navy : '#fff'};color:${on ? '#fff' : T.ink};box-shadow:${on ? 'none' : 'inset 0 0 0 1px ' + T.line};font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px">${t}<b class="m" style="opacity:.7">${n}</b></span>`).join('')}</div>`;
function buyerOrders(st) {
  const held = buyerRow('Ggaba Stores', '#0558', `From Grace · ${mono('2')} lines · Owino Plumbing`, pill('Cancel asked · hold', 'info', 'pause'), true);
  const askBtn = `<span style="height:36px;padding:0 14px;border-radius:999px;background:${T.navy};color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center">Ask</span>`;
  const list = st === 'before'
    ? buyerRow('Ggaba Stores', '#0558', `From Grace · ${mono('2')} lines · Owino Plumbing`, askBtn) + buyerRow('Kato Construction', '#0552', `From Grace · ${mono('1')} line · Namanve Sheets`, askBtn)
    : buyerRow('Kato Construction', '#0552', `From Grace · ${mono('1')} line · Namanve Sheets`, askBtn) + `<div class="sec" style="font-size:14px">On hold <small>not asked, not on a trip</small></div>` + held;
  return `${buyerHeadW('Orders', 'Checking · Sat 17 Oct')}<div class="body" style="padding-top:6px">${chips(st === 'before' ? [['To ask', 2, true], ['Asked', 1], ['Found', 0]] : [['To ask', 1, true], ['Asked', 1], ['Found', 0], ['On hold', 1]])}${list}</div>`;
}
const cancelSB = P.board('Sales + Buyer · Cancel asked (X-1)', [
  { state: 'Sales · BEFORE', sub: 'After the ask the order looks the same; Take payment still red', html: salesOrder('before') },
  { state: 'Sales · AFTER default (asked)', sub: 'Blue “Cancel asked · Ruth decides”; payment locked; one quiet move', html: salesOrder('asked') },
  { state: 'Sales · sending (take back)', sub: 'Ghost button spins; the card stays', html: salesOrder('sending') },
  { state: 'Sales · Ruth said yes', sub: 'Pushed (order.cancelled); stage Cancelled', html: salesOrder('yes') },
  { state: 'Sales · Ruth said no', sub: 'Pushed (order.cancel.ask.decided); Take payment back', html: salesOrder('no') },
  { state: 'Buyer · BEFORE', sub: '#0558 still To ask; Denis could buy goods for a dead order', html: buyerOrders('before') },
  { state: 'Buyer · AFTER', sub: 'Held: out of To ask, Asked, Found and the trip until Ruth answers', html: buyerOrders('after') },
]);

/* ---------- X-1 · Manager: the ask in Decide now, and the answer ---------- */
const mgrTile = (n, w, bg, fg, icon, ring) => `<span style="display:flex;align-items:center;gap:8px;padding:9px 8px;border-radius:14px;background:${T.ground};${ring ? 'box-shadow:inset 0 0 0 1.5px ' + T.red : ''}${n ? '' : ';opacity:.5'}"><span style="width:30px;height:30px;flex:none;border-radius:10px;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center">${ic(icon, 16)}</span><span style="display:flex;flex-direction:column"><b class="m" style="font-size:16px">${n}</b><span style="font-size:11px;font-weight:600;color:${T.soft}">${w}</span></span></span>`;
function mgrToday(after) {
  return `<header style="background:${T.navy};color:#fff;border-radius:0 0 28px 28px;padding:16px 20px 20px;display:flex;flex-direction:column;gap:6px"><span style="font-size:20px;font-weight:700">Good morning, Ruth</span><span style="font-size:12px;font-weight:600;color:${T.onN}">Sat 17 Oct · Live</span></header>
  <div class="body"><div class="card" style="border-radius:20px;padding:14px;display:flex;flex-direction:column;gap:10px">
  <div style="display:flex;justify-content:space-between;align-items:center"><span style="display:flex;flex-direction:column"><b style="font-size:17px">Decide now</b><span class="sb">oldest waits <span class="m" style="color:${T.red}">${after ? '16 m' : '9 m'}</span></span></span>${pill(mono(after ? '5' : '4') + '&nbsp;waiting', 'bad')}</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${mgrTile(2, 'Prices', '#E4E6FA', '#3A3F9B', 'note')}${mgrTile(1, 'Credit', T.warnS, T.warnI, 'cash')}${mgrTile(1, 'Invoices', T.infoS, T.info, 'note')}${mgrTile(0, 'Picks', T.tile, T.soft, 'box')}${mgrTile(0, 'Stock', T.tile, T.soft, 'truck')}${mgrTile(after ? 1 : 0, after ? 'Returns · cancels' : 'Returns', T.badS, T.bad, 'ret', after)}</div>
  <span class="btn red" style="height:50px;font-size:15px;border-radius:16px">${ic('tick', 18)}Start with the oldest</span></div>
  ${after ? `<div class="sec" style="font-size:12px;letter-spacing:.08em;color:${T.soft}">AFTER DELIVERY · STOCK · ASKS</div><div class="grp">${row(sq('x', T.badS, T.bad), 'Cancel ask · Ggaba Stores', `Grace asks · <span class="m">430,000</span> · changed their mind`, `<span style="display:flex;flex-direction:column;align-items:flex-end;gap:3px"><span class="m" style="font-size:13px">430,000</span><span class="m" style="padding:1px 7px;border-radius:999px;font-size:11px;background:${T.badS};color:${T.bad}">16 m</span></span>`)}</div>` : `<div class="note" style="background:${T.badS};color:${T.bad}">#0604 waits since 10 Nov: cancel_asks is never read here</div>`}
  </div>`;
}
function mgrAnswer(st) {
  const btns = st === 'sending'
    ? `<span class="btn ghost off">Keep the order</span><span class="btn red"><span class="spin"></span>Cancelling…</span>`
    : `<span class="btn ghost">Keep the order</span><span class="btn red${st === 'pressed' ? ' pressed' : ''}${st === 'disabled' ? ' off' : ''}">${ic('x', 18)}Cancel #0558</span>`;
  const err = st === 'error' ? `<div class="card" style="padding:12px 14px;display:flex;gap:10px;align-items:center;box-shadow:inset 0 0 0 1.5px #E8B4AE">${sq('warn', T.badS, T.bad)}<span class="col"><span class="tt" style="color:${T.bad}">Not cancelled</span><span class="sb">#0558 was invoiced first: ask Grace for a void</span></span></div>` : '';
  const off = st === 'offline' ? `<div class="notice" style="background:${T.warnS}">${ic('offline', 18)}<span style="flex:1">No signal · a cancel waits for signal</span></div>` : '';
  return `<header class="head" style="padding:12px 16px 18px"><div style="display:flex;align-items:center;gap:10px"><span class="hb">${ic('back', 18, 2.2)}</span><span class="col"><span class="eye" style="color:${T.onN2}">Cancel ask · from Grace</span><span style="font-size:20px;font-weight:700">Ggaba Stores · #0558</span></span></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">${['Checking', 'Nothing paid', 'Nothing packed'].map((t) => `<span class="pill" style="height:26px;background:rgba(255,255,255,.1);color:#DDE3F0">${t}</span>`).join('')}</div></header>${off}
  <div class="body"><div class="card" style="padding:14px;display:flex;flex-direction:column;gap:6px"><span class="eye">Why</span><span class="tt" style="font-size:16px">“Customer changed their mind”</span><span class="sb">asked ${mono('10:05')} · waiting ${mono('16 m')}</span></div>
  ${lines2}<div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:8px"><span class="eye">If you cancel</span>
  ${[['box', 'Musa puts back what was packed (nothing yet)'], ['cart', 'Denis stops: off To ask and the trip'], ['person', 'Grace is told']].map(([i, t]) => `<span style="display:flex;gap:8px;align-items:center;font-size:13px;font-weight:600">${ic(i, 16)}${t}</span>`).join('')}</div>
  ${err}<div style="display:grid;grid-template-columns:1fr 1.3fr;gap:8px;margin-top:4px">${btns}</div>
  <span class="sb" style="display:flex;gap:6px;align-items:center;justify-content:center">${ic('note', 13)}Goes in the owner’s log</span></div>${st === 'done' ? toast('#0558 cancelled · Grace told') : ''}`;
}
const cancelM = P.board('Manager · Decide now · Cancel asks (X-1)', [
  { state: 'BEFORE · Today', sub: 'Asks from Sales reach no one', html: mgrToday(false) },
  { state: 'AFTER · Today (default)', sub: 'Counted in the Returns tile (“Returns · cancels”); one row, oldest first', html: mgrToday(true) },
  { state: 'The ask · default', sub: 'Why, what a cancel does, two answers; red is the one that ends it', html: mgrAnswer('default') },
  { state: 'Pressed', sub: '', html: mgrAnswer('pressed') },
  { state: 'Sending', sub: 'answer_cancel_ask(yes) → cancel_order (0177), one write', html: mgrAnswer('sending') },
  { state: 'Success', sub: 'Back to Decide now; the row is gone; toast', html: mgrToday(false).replace(/<div class="note"[^]*?<\/div>/, '') + toast('#0558 cancelled · Grace told') },
  { state: 'Error · refused', sub: 'The server’s reason in plain words; nothing changed', html: mgrAnswer('error') },
  { state: 'Offline / disabled', sub: 'No signal: buttons wait; the Manager app sends no kept money writes', html: mgrAnswer('offline').replace('class="btn red', 'class="btn red off') },
  { state: 'Laptop · 1280', sub: 'manager.html is one 520 px column, centred: the same screen', wide: true, html: desk(mgrAnswer('default'), 520, 'manager.html on a laptop: the phone column, centred (max-width 520). Nothing new is drawn for 1280.') },
]);

/* ---------- X-2 + SAL-1 · one word for a line's buying state ---------- */
const W = {
  shelf: ['On the shelf', 'good', 'tick'], asked: ['Asked · Owino', 'info', 'clock'], found: ['Found · Namanve', 'good', 'tick'], notfound: ['Not found', 'bad', 'x'],
  priceup: ['Price up · Ruth decides', 'warn', 'up'], needs: ['Needs a supplier', 'warn', 'search'], waits: ['Client waits · Moses looks', 'info', 'clock'],
};
const lineRow = (name, qty, w, sub) => row(sq('box', T.tile, T.soft), name, `${mono(qty)}${sub ? ' · ' + sub : ''}`, pill(W[w][0], W[w][1], W[w][2]));
function salesLines(after) {
  const head = `<header class="head" style="padding:12px 16px 18px"><div style="display:flex;align-items:center;gap:10px"><span class="hb">${ic('back', 18, 2.2)}</span><span class="col"><span style="font-size:17px;font-weight:700">Walk-in · #0561</span><span style="font-size:12px;font-weight:600;color:${T.onN}">Checking · Grace</span></span></div>
  <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,.08);padding-top:12px"><span style="font-size:24px;font-weight:700">Checking</span>${after ? `<span class="pill" style="height:28px;background:rgba(245,178,107,.16);color:${T.amberN}">${mono('1')}&nbsp;of&nbsp;${mono('2')} found</span>` : `<span class="pill" style="height:28px;background:rgba(111,220,176,.16);color:${T.mint}">${ic('tick', 12, 2.6)}${mono('2')}&nbsp;of&nbsp;${mono('2')}</span>`}</div></header>`;
  const rows = after
    ? lineRow('Iron sheet G28', '20 pcs', 'found') + lineRow('Soft close hinge', '2 prs', 'needs', 'Denis picks one')
    : row(sq('box', T.tile, T.soft), 'Iron sheet G28', mono('20 pcs'), pill('The supplier said yes', 'good', 'tick')) + row(sq('box', T.tile, T.soft), 'Soft close hinge', mono('2 prs'), pill('On the shelf', 'good', 'tick'));
  return `${head}<div class="body"><div class="grp">${rows}</div>${after ? `<div class="note" style="background:${T.tile};color:${T.soft}">Words come from what Denis sees (supplier answers, Not found, Client waits), not from a guess.</div>` : `<div class="note" style="background:${T.badS};color:${T.bad}">0 on the shelf and no supplier, yet ticked “On the shelf”</div>`}</div>`;
}
const salesWords = `${pushHead('What a line says', 'Sales sees the Buyer’s word')}<div class="body"><div class="grp">${lineRow('Cement 50 kg', '10 bags', 'shelf')}${lineRow('PVC pipe 4 in', '6 pcs', 'asked', '12 m ago')}${lineRow('Iron sheet G28', '20 pcs', 'found')}${lineRow('Ridge cap 3 m', '10 pcs', 'priceup')}${lineRow('Gate valve 2 in', '1 pc', 'notfound')}${lineRow('Soft close hinge', '2 prs', 'needs')}${lineRow('Roofing felt', '3 rolls', 'waits')}</div>
  <div class="note" style="background:${T.infoS};color:${T.info}">A tick only for On the shelf and Found. Same seven words in Sales, Buyer and Manager (glossary).</div></div>`;
function buyerToday(after) {
  const tile = (n, w, unit, tone) => `<span class="card" style="padding:12px;display:flex;flex-direction:column;gap:4px;${tone === 'warn' ? 'box-shadow:inset 0 0 0 1.5px #F3D3B0' : ''}"><b class="m" style="font-size:24px">${n}</b><span class="tt" style="font-size:13px">${w}</span><span class="sb">${unit}</span></span>`;
  return `<header style="background:${T.navy};color:#fff;border-radius:0 0 28px 28px;padding:16px 20px 20px;display:flex;flex-direction:column;gap:6px"><span style="font-size:20px;font-weight:700">Good morning, Denis</span><span style="font-size:12px;font-weight:600;color:${T.onN}">Sat 17 Oct · Live</span></header>
  <div class="body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${after
    ? tile(1, 'To ask', `supplier · ${mono('3')} orders`) + tile(1, 'Needs a supplier', `line · #0561`, 'warn') + tile(2, 'Asked', 'suppliers') + tile(1, 'Found', 'supplier · ready')
    : tile(2, 'To ask', 'suppliers') + tile(2, 'Asked', 'suppliers') + tile(1, 'Found', 'supplier') + tile(0, 'Not found', 'lines')}</div>
  ${after ? `<div class="sec">Needs a supplier <small>you pick one</small></div><div class="card row" style="min-height:66px">${sq('search', T.warnS, T.warn)}<span class="col"><span class="tt">Soft close hinge · ${mono('2 prs')}</span><span class="sb">From Grace · #0561 · Walk-in</span></span><span style="height:36px;padding:0 12px;border-radius:999px;background:${T.navy};color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center">Pick</span></div>`
    : `<div class="sec">To ask</div><div class="card row" style="min-height:66px">${sq('box', T.tile, T.soft)}<span class="col"><span class="tt">#0561 · Walk-in</span><span class="sb">To ask</span></span></div><div class="note" style="background:${T.badS};color:${T.bad}">“To ask” with no supplier and no button: a dead end</div>`}
  </div>`;
}
function pickSheet(st) {
  const sup = (n, p, d, on) => `<div class="card row" style="min-height:60px;${on ? 'box-shadow:inset 0 0 0 1.5px ' + T.ink : ''}">${sq('store', T.tile, T.soft)}<span class="col"><span class="tt">${n}</span><span class="sb">${mono(p)} a pair · on the list ${d}</span></span><span style="width:22px;height:22px;border-radius:999px;box-shadow:inset 0 0 0 ${on ? '7px ' + T.ink : '1.5px ' + T.dash}"></span></div>`;
  const body = st === 'none'
    ? `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 0;text-align:center"><span class="sq" style="width:56px;height:56px;border:1.5px dashed ${T.dash};color:${T.soft}">${ic('search', 24)}</span><span class="tt">Nobody on the price list sells it</span><span class="sb">Moses finds a supplier · Grace sees “Client waits”</span></div><span class="btn navy" style="margin-top:auto">Ask Moses to find it</span>`
    : `${sup('Owino Plumbing', '6,500', '· 3 days', st !== 'default')}${sup('Kiseka Steel', '7,200', '· 12 days', false)}<span class="sb" style="text-align:center">Not on the list? <u>Ask Moses to find it</u></span>
       <span class="btn navy${st === 'default' ? ' off' : ''}" style="margin-top:auto">${st === 'sending' ? '<span class="spin"></span>Sending…' : 'Ask Owino Plumbing'}</span>`;
  return buyerToday(true) + sheet(st === 'none' ? 360 : 300, 'Soft close hinge · 2 prs · #0561', 'Needs a supplier', body);
}
function mgrRow(after) {
  return `${pushHead('On the move', 'Checking · 3')}<div class="body"><div class="grp">${row(sq('check', T.infoS, T.info), 'Walk-in · #0561', after ? `<span style="color:${T.bad}">1 line needs a supplier</span> · Denis` : 'Denis · all found · waiting to move', `<span class="m" style="font-size:13px">430,000</span>`)}${row(sq('check', T.infoS, T.info), 'Kato Construction · #0552', 'Denis · asked Namanve 12 m ago', `<span class="m" style="font-size:13px">1,750,000</span>`)}</div>
  ${after ? '' : `<div class="note" style="background:${T.badS};color:${T.bad}">“all found” while a line has no supplier: supplierGroups() skips it</div>`}</div>`;
}
const needs = P.board('Sales + Buyer + Manager · Needs a supplier (X-2, SAL-1)', [
  { state: 'Sales · BEFORE', sub: '“2 of 2”, both ticked; the hinge has no stock and no supplier', html: salesLines(false) },
  { state: 'Sales · AFTER', sub: '“1 of 2 found”; the hinge says Needs a supplier · Denis picks one', html: salesLines(true) },
  { state: 'Sales · the seven words (SAL-1)', sub: 'Read from supplier answers and the order; never guessed', html: salesWords },
  { state: 'Buyer Today · BEFORE', sub: 'Counted in To ask, no action', html: buyerToday(false) },
  { state: 'Buyer Today · AFTER (default)', sub: 'Its own tile and row; To ask counts only lines with a supplier', html: buyerToday(true) },
  { state: 'Pick · default / disabled', sub: 'Suppliers on the price list for it, cheapest first; button waits for a pick', html: pickSheet('default') },
  { state: 'Pick · pressed → sending', sub: 'One tap asks that supplier (otherSupplier write + Ask)', html: pickSheet('sending') },
  { state: 'Pick · empty', sub: 'Nobody on the list: Ask Moses (Sourcing’s existing request; the line becomes Client waits)', html: pickSheet('none') },
  { state: 'Manager · BEFORE', sub: '“all found · waiting to move”', html: mgrRow(false) },
  { state: 'Manager · AFTER', sub: 'Says what the server gate says: “1 line needs a supplier”', html: mgrRow(true) },
]);

/* ---------- X-3 / X-4 · Manager words ---------- */
function mgrDay(after) {
  const tile = (v, w, sub, tone) => `<span class="card" style="padding:12px;display:flex;flex-direction:column;gap:3px"><span class="sb">${w}</span><b class="m" style="font-size:20px;color:${tone || T.ink}">${v}</b><span class="sb">${sub}</span></span>`;
  return `<header style="background:${T.navy};color:#fff;border-radius:0 0 28px 28px;padding:16px 20px 20px;display:flex;flex-direction:column;gap:6px"><span style="font-size:20px;font-weight:700">Good morning, Ruth</span><span style="font-size:12px;font-weight:600;color:${T.onN}">Sat 17 Oct · Live</span></header>
  <div class="body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${after
    ? tile('1,240,000', 'Sales invoiced today', 'the one sales figure', T.good) + tile('475,928', 'Taken today', `${mono('4')} orders · not sold yet`)
    : tile('475,928', 'Sold today', '4 orders') + tile('1,240,000', 'Money in', 'today')}</div>
  ${after ? '' : `<div class="note" style="background:${T.badS};color:${T.bad}">“Sold” counts drafts in Checking; Grace’s “Sold” counts only invoiced. One word, two sums.</div>`}
  <div class="sec">Orders taken</div><div class="grp">${row(`<span style="width:40px;height:40px;border-radius:999px;background:#E8EBF0;color:#3D4A5C;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">${after ? 'GA' : '?'}</span>`, 'Walk-in · #0561', after ? 'Taken by Grace · 9:12' : 'Taken by a login with no staff card', `<span class="m" style="font-size:13px">430,000</span>`)}
  ${row(sq('check', T.infoS, T.info), 'Checking', after ? 'Denis asks the suppliers · you decide price and credit' : 'Checking is the buyer’s · no buyer on the staff list', chev)}</div></div>`;
}
const words = P.board('Manager · Sold and who (X-3, X-4)', [
  { state: 'BEFORE', sub: 'Sold today includes Checking drafts; Grace shown as “no staff card”; no buyer', html: mgrDay(false) },
  { state: 'AFTER', sub: 'Sales invoiced (glossary) beside Taken; names from shop_members, as Sales and Buyer', html: mgrDay(true) },
]);

module.exports = { 'CancelSalesBuyer.dc.html': cancelSB, 'CancelManager.dc.html': cancelM, 'NeedsSupplier.dc.html': needs, 'ManagerWords.dc.html': words };
