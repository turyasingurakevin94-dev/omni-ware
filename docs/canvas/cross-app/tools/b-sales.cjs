// Sales boards for cross-app round 1: SAL-3 (Not sent), SAL-4 (Placed, waiting to send), SAL-5 (price keypad), SAL-6 (copy, loading).
const P = require('./parts.cjs');
const { T, ic, mono, pill, sq, row, chev, toast, tabbar, sheet, anno } = P;

/** Today's hero (P02), with its status word: Live, Updating, or "N waiting to send". */
function hero(status, opt = {}) {
  const st = status === 'live'
    ? `<span style="display:flex;align-items:center;gap:5px;color:${T.mint}"><span style="width:7px;height:7px;border-radius:999px;background:${T.mint}"></span>Live</span>`
    : status === 'off'
      ? `<span style="display:flex;align-items:center;gap:5px;color:${T.amberN}">${ic('offline', 13, 2.2)}No signal</span>`
      : `<span style="display:flex;align-items:center;gap:5px;color:${T.amberN}"><span style="width:7px;height:7px;border-radius:999px;background:${T.amberN}"></span>${status}</span>`;
  const sold = opt.sold || '12,480,000', pct = opt.pct == null ? 36 : opt.pct, mv = opt.mv == null ? 9 : opt.mv;
  return `<header style="background:${T.navy};border-radius:0 0 28px 28px;padding:14px 20px 18px;display:flex;flex-direction:column;gap:16px;color:#fff">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><div style="display:flex;flex-direction:column;gap:3px"><span style="font-size:20px;font-weight:700;letter-spacing:-.01em">Good morning, Grace</span>
  <span style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:${T.onN}">Sat 17 Oct<span style="width:3px;height:3px;border-radius:999px;background:#5F6A85"></span>${st}</span></div>
  <span style="width:46px;height:46px;border-radius:999px;background:${T.navy2};box-shadow:0 0 0 2px ${T.navy},0 0 0 4px rgba(111,220,176,.55);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700">GA</span></div>
  <div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${T.onN}">Sold · October</span>
  <span style="display:flex;align-items:baseline;gap:8px"><span style="font-size:14px;font-weight:700;color:${T.onN2}">UGX</span><span class="m" style="font-size:38px;letter-spacing:-.04em;line-height:1">${sold}</span></span></div>
  <div style="display:flex;flex-direction:column;gap:9px"><span style="display:flex;height:8px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden">${pct ? `<span style="width:${pct}%;min-width:8px;background:#fff;border-radius:999px"></span>` : ''}<span style="width:${mv}%;background:${opt.ghost ? 'repeating-linear-gradient(135deg,rgba(111,220,176,.45) 0 3px,transparent 3px 6px)' : 'rgba(111,220,176,.45)'};border-radius:0 999px 999px 0"></span></span>
  <span style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:${T.onN}"><span>${mono(pct + '%', 'color:#fff')} of your ${mono('35M')} goal</span>${opt.moveWord ? `<span style="color:${T.mint}">${mono(opt.moveWord)} on the move</span>` : '<span>14 days left</span>'}</span></div>
</header>`;
}

const needsRow = (kind, title, sub, right) => `<div class="card row" style="min-height:64px">${kind}<span class="col"><span class="tt">${title}</span><span class="sb">${sub}</span></span>${right}</div>`;
const amberSq = sq('up', T.warnS, T.warn), badSq = sq('warn', T.badS, T.bad);
const countB = (n, bg = T.warnS, fg = T.warnI) => `<span class="m" style="min-width:32px;height:28px;padding:0 9px;border-radius:999px;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-size:13px">${n}</span>`;

function today(state) {
  const top = state === 'off' ? hero('off') : (state === 'empty' || state === 'gone') ? hero('live') : hero(state === 'sending' ? 'Sending 2…' : '2 waiting to send');
  const notice = state === 'off'
    ? `<div class="notice" role="status" style="background:${T.warnS}"><span style="display:flex;color:${T.warn}">${ic('offline', 18)}</span><span style="flex:1">No signal · ${mono('2')} not sent yet</span><span style="height:32px;padding:0 12px;border-radius:999px;background:#fff;color:${T.warnI};font-size:13px;font-weight:700;display:flex;align-items:center">Try again</span></div>` : '';
  const ns = (state === 'empty' || state === 'gone') ? '' : state === 'sending'
    ? needsRow(sq('up', T.warnS, T.warn), 'Sending 2…', 'oldest first · the rest of the app works', `<span class="spin dk"></span>`)
    : needsRow(state === 'off' ? amberSq : badSq, state === 'off' ? 'Not sent yet' : '2 not sent', state === 'off' ? 'kept on this phone · sends itself' : `${mono('1')} the books refused · ${mono('1')} waiting`, countB(2, state === 'off' ? T.warnS : T.badS, state === 'off' ? T.warnI : T.bad) + chev);
  return `${top}${notice}<div class="body" style="padding-top:14px">
  <div class="sec">Needs you <small>${mono((state === 'empty' || state === 'gone') ? '2' : '3')}</small></div>
  ${ns}
  ${needsRow(sq('cash', T.warnS, T.warn), 'Kato Construction', `owes ${mono('1,100,000')} · 12 days`, countB('Take'))}
  ${needsRow(sq('check', T.infoS, T.info), '#0552 waits for Ruth', 'price under the shop’s', chev)}
  <div class="sec">On the move <small>${mono('3.2M')}</small></div>
  <div class="card" style="height:86px;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:8px">${['Checking 2', 'Buying 1', 'Packing 1', 'On the road 0'].map((s) => `<span style="border-radius:12px;background:${T.ground};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:11px;font-weight:600;color:${T.soft}"><b class="m" style="font-size:18px;color:${T.ink}">${s.split(' ').pop()}</b>${s.replace(/ \d+$/, '')}</span>`).join('')}</div>
  </div>${tabbar('Today')}${state === 'gone' ? toast('Sent · #0560 is on the books') : ''}`;
}

/** The Waiting to send sheet: one row per kept write, newest last; a refused one says why and offers Remove / Try again. */
function waitingSheet(state) {
  const refused = `<div class="card" style="padding:12px;display:flex;flex-direction:column;gap:10px;box-shadow:0 1px 2px rgba(22,32,60,.05),inset 0 0 0 1.5px #E8B4AE">
    <div style="display:flex;gap:12px;align-items:flex-start">${sq('warn', T.badS, T.bad)}<span class="col"><span class="tt">Ask Ruth to cancel #0586</span><span class="sb" style="color:${T.bad}">Not sent · #0586 is no longer in the books</span><span class="sb">tried ${mono('8')} times · since Thu 5 Nov</span></span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><span class="btn ghost" style="height:44px;font-size:14px">${ic('bin', 16)}Remove</span><span class="btn ghost" style="height:44px;font-size:14px;color:${T.ink}">${ic('retry', 16)}Try again</span></div></div>`;
  const placing = (st) => `<div class="card row" style="min-height:66px">${sq('box', T.warnS, T.warn)}<span class="col"><span class="tt">Place order · Kato Construction</span><span class="sb">${st === 'sending' ? 'Sending…' : `waiting · kept ${mono('9:41')} · ${mono('1,750,000')}`}</span></span>${st === 'sending' ? '<span class="spin dk"></span>' : pill('Waiting', 'warn', 'clock')}</div>`;
  let body;
  if (state === 'confirm') {
    body = `<div style="display:flex;flex-direction:column;gap:6px;padding:4px 4px 8px"><span class="tt" style="font-size:16px">Remove it from this phone?</span><span class="sb">The ask to cancel #0586 never reached the books. Nothing else changes.</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:auto"><span class="btn ghost">Keep it</span><span class="btn red" style="height:52px;font-size:15px">Remove</span></div>`;
    return sheet(500, 'Waiting to send', 'Remove it?', body);
  }
  body = `<div style="display:flex;align-items:center;gap:8px">${pill(mono('1') + '&nbsp;not sent', 'bad')}${pill(mono('1') + '&nbsp;waiting', 'warn')}<span class="sb" style="margin-left:auto">oldest first</span></div>
  ${refused}${placing(state)}
  <div class="note" style="background:${T.tile};color:${T.soft};display:flex;gap:8px;align-items:center">${ic('lock', 14)}One that is not sent never holds up the others.</div>
  <span class="btn navy" style="margin-top:auto">${state === 'sending' ? '<span class="spin"></span>Sending…' : `${ic('retry', 18)}Send now`}</span>`;
  return sheet(212, 'Waiting to send', `${mono('2')} not on the books yet`, body);
}

const sal3 = P.board('Sales · Today · Waiting to send (SAL-3)', [
  { state: 'BEFORE · online, 8 refused tries jam it', sub: 'Header says Live; nothing says the writes are stuck; #0608 never left', html: today('empty').replace('</header>', '</header>') + anno('!', 22) },
  { state: 'AFTER · default (online, 2 waiting)', sub: 'The head never says Live while a write waits; Needs you leads with it', html: today('default') },
  { state: 'Pressed → Waiting to send sheet', sub: 'Refused: says why, Remove / Try again. Waiting: its own pill', html: today('default') + waitingSheet('default') },
  { state: 'Sending', sub: 'Send now (also on open, on focus, every 30 s)', html: today('sending') + waitingSheet('sending') },
  { state: 'Remove: confirm (glossary)', sub: 'Keep it / Remove — nothing is lost by a slip', html: today('default') + waitingSheet('confirm') },
  { state: 'Success · empty', sub: 'Placed order went; refused one removed → Live again', html: today('gone') },
  { state: 'Offline', sub: 'No signal: amber, kept, sends itself (P27 as before)', html: today('off') },
]);

/* SAL-4: the Placed screen when the place was kept (no signal or the server slow). */
function placed(state) {
  const disc = state === 'kept' ? `background:${T.warnS};color:${T.warn}` : state === 'refused' ? `background:${T.badS};color:${T.bad}` : `background:${T.mint};color:${T.navy}`;
  const icon = state === 'kept' ? 'clock' : state === 'refused' ? 'warn' : 'tick';
  const title = state === 'kept' ? 'Waiting to send' : state === 'refused' ? 'Not placed' : 'Placed · #0560';
  const sub = state === 'kept' ? 'Kept on this phone · it sends itself when there is signal' : state === 'refused' ? 'The books said no: a line is under its cost' : 'All on the shelf · Musa packs it now';
  const steps = ['Checking', 'Buying', 'Packing', 'On the road', 'Delivered'];
  return `<div style="position:absolute;inset:0;background:${T.navy};color:#fff;padding:16px 20px 24px;display:flex;flex-direction:column;gap:16px">
  <div style="display:flex;justify-content:flex-end"><span class="hb">${ic('x', 16, 2.2)}</span></div>
  <div style="display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;margin-top:-10px">
    <span style="width:68px;height:68px;border-radius:999px;${disc};display:flex;align-items:center;justify-content:center">${ic(icon, 30, 2.6)}</span>
    <span style="font-size:24px;font-weight:700">${title}</span><span style="font-size:13px;font-weight:600;color:${T.onN};max-width:280px">${sub}</span></div>
  <div style="border-radius:18px;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);padding:14px;display:flex;flex-direction:column;gap:10px">
    <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:15px;font-weight:700">Kato Construction</span><span class="m" style="font-size:18px">1,750,000</span></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;color:${T.onN}"><span>3 items · pickup</span><span>${state === 'kept' ? `${ic('lock', 12, 2.2)} locked while it waits` : state === 'refused' ? 'back on the order to fix' : 'on the books 9:41'}</span></div>
    ${state === 'placed' ? `<div style="display:flex;gap:4px">${steps.map((s, i) => `<span style="flex:1;height:6px;border-radius:999px;background:${i === 0 ? T.mint : 'rgba(255,255,255,.14)'}"></span>`).join('')}</div>` : ''}
  </div>
  ${state === 'kept' ? `<div style="display:flex;align-items:center;gap:10px;border-radius:14px;background:rgba(245,178,107,.12);padding:12px;font-size:13px;font-weight:600;color:${T.amberN}">${ic('offline', 18)}<span style="flex:1">Placed once only: sending again is never a second order</span></div>` : ''}
  ${state === 'refused' ? `<div style="display:flex;align-items:center;gap:10px;border-radius:14px;background:rgba(247,161,150,.12);padding:12px;font-size:13px;font-weight:600;color:#F7A196">${ic('warn', 18)}<span style="flex:1">Wire mesh 1.2 m · 9,000 is under its cost 9,400</span></div>` : ''}
  <span class="btn" style="margin-top:auto;background:#fff;color:${T.navy}">${state === 'refused' ? 'Fix the order' : 'Back to Today'}</span></div>`;
}
function dockState(st) {
  const lb = { default: 'Slide to place · 3 items', pressed: 'Slide to place · 3 items', sending: 'Sending…', locked: 'Waiting to send · locked', off: 'Slide to place · 3 items' }[st];
  const knob = st === 'sending' ? `<span style="position:absolute;inset:0;border-radius:999px;background:rgba(201,58,48,.35)"></span><span class="knob" style="margin-left:auto;position:relative"><span class="spin"></span></span>`
    : st === 'locked' ? `<span class="knob" style="background:#59627A">${ic('lock', 20, 2.2)}</span>` : `<span class="knob"${st === 'pressed' ? ' style="margin-left:90px;background:#A82D24"' : ''}>${ic('chev', 22, 2.4)}</span>`;
  return `<div class="dock"><div style="display:flex;justify-content:space-between;align-items:center"><span class="pill" style="height:40px;padding:0 12px;background:rgba(255,255,255,.08);color:#fff">${ic('store', 18, 1.8)}Pickup</span><span style="display:flex;flex-direction:column;align-items:flex-end;gap:2px"><span class="m" style="font-size:22px">1,750,000</span><span class="m" style="font-size:13px;color:${T.mint}">all on the shelf</span></span></div>
  <div class="slide">${knob}<span class="lb"${st === 'locked' ? ` style="color:${T.onN}"` : ''}>${lb}</span></div></div>`;
}
const order = (st) => `${P.pushHead('Kato Construction', 'New order · 3 items')}<div class="body">${['Iron sheet G28 3 m · 20 × 52,000', 'Ridge cap 3 m · 10 × 27,000', 'Nails 4" 25 kg · 1 × 160,000'].map((l) => `<div class="card row" style="min-height:58px;${st === 'locked' ? 'opacity:.55' : ''}"><span class="col"><span class="tt">${l.split(' · ')[0]}</span><span class="sb m">${l.split(' · ')[1]}</span></span>${st === 'locked' ? ic('lock', 16) : chev}</div>`).join('')}</div>${dockState(st)}`;

const sal4 = P.board('Sales · Place order · one place per draft (SAL-4)', [
  { state: 'Default', sub: 'One slide = one place. Enter / a 2nd tap does nothing while one is out', html: order('default') },
  { state: 'Pressed (sliding)', sub: 'The knob follows the finger; a tap alone never places', html: order('pressed') },
  { state: 'Sending', sub: 'The draft is locked from here; the key is sent once', html: order('sending') },
  { state: 'Kept (no signal / slow) → Placed, waiting', sub: 'Shows Placed in its waiting state; the draft stays locked', html: placed('kept') },
  { state: 'Disabled · the draft while it waits', sub: 'Opening the draft again shows it locked, nothing to edit', html: order('locked') },
  { state: 'Success · it went', sub: 'Same screen turns green; the draft is cleared', html: placed('placed') },
  { state: 'Error · refused', sub: 'Unlocks and goes back to the order with the reason', html: placed('refused') },
]);

/* SAL-5: price keypad with a reserved warning slot (never pushes the keys). */
function keypad(val, warn) {
  const slot = warn === 'cost' ? `<div class="note" style="height:44px;box-sizing:border-box;display:flex;align-items:center;gap:8px;background:${T.badS};color:${T.bad}">${ic('warn', 16)}<span>Under its cost ${mono('9,400')} · the books refuse it</span></div>`
    : warn === 'zero' ? `<div class="note" style="height:44px;box-sizing:border-box;display:flex;align-items:center;gap:8px;background:${T.warnS};color:${T.warnI}">${ic('warn', 16)}<span>${mono('0')} is not a price · only Ruth gives a line away</span></div>`
      : warn === 'shop' ? `<div class="note" style="height:44px;box-sizing:border-box;display:flex;align-items:center;gap:8px;background:${T.warnS};color:${T.warnI}">${ic('clock', 16)}<span>Under the shop’s ${mono('12,000')} · Ruth decides</span></div>`
        : `<div class="note" style="height:44px;box-sizing:border-box;display:flex;align-items:center;gap:8px;background:${T.tile};color:${T.soft}"><span>Shop’s price ${mono('12,000')} · cost hidden</span></div>`;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'];
  return `${P.pushHead('Kato Construction', 'New order')}<div class="body" style="opacity:.35"><div class="card row"><span class="col"><span class="tt">Wire mesh 1.2 m</span><span class="sb">10 rolls</span></span></div></div>
  <div class="scrim"></div><div class="sheet" style="top:250px"><span class="grab"></span><div class="shd"><span style="display:flex;flex-direction:column;gap:4px"><span class="eye">Wire mesh 1.2 m · 10 rolls</span><h2>Price each</h2></span>${P.xbtn}</div>
  <div class="shb" style="gap:10px"><div style="height:58px;border-radius:14px;box-shadow:inset 0 0 0 1.5px ${warn === 'cost' ? T.bad : T.ink};display:flex;align-items:center;justify-content:flex-end;padding:0 16px;font-size:22px" class="m">${val}</div>
  ${slot}
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${keys.map((k) => `<span class="m" style="height:52px;border-radius:12px;background:${T.ground};display:flex;align-items:center;justify-content:center;font-size:20px">${k}</span>`).join('')}</div>
  <span class="btn navy${warn === 'cost' || warn === 'zero' ? ' off' : ''}">${warn === 'cost' ? 'Can’t sell under cost' : warn === 'zero' ? 'Type a price' : 'Use ' + val}</span></div></div>`;
}
const sal5 = P.board('Sales · Price keypad · reserved warning slot (SAL-5)', [
  { state: 'Default · empty slot holds the shop’s price', sub: 'The 44 px slot is always there: the keys never move', html: keypad('12,000', '') },
  { state: 'Typing · under the shop’s price', sub: 'Same slot, amber; keys stay put', html: keypad('11,000', 'shop') },
  { state: 'Error · under cost', sub: 'Slot red, button disabled with the reason', html: keypad('9,000', 'cost') },
  { state: 'Value 0', sub: 'Before: nothing said, Use just greyed. After: why, in the same slot', html: keypad('0', 'zero') },
]);

/* SAL-6: copy and the first load. */
const cancelSheet = (st) => `${P.pushHead('#0560 · Kato Construction', 'Checking · 1,750,000')}<div class="body"></div>` + sheet(st === 'else' ? 230 : 300, 'Order #0560 · Kato Construction', 'Ask Ruth to cancel?', `
  <div style="display:flex;flex-direction:column;gap:8px">${['Customer changed their mind', 'Entered twice', 'Something else'].map((r) => `<div class="card row" style="min-height:52px;${(st === 'else' && r === 'Something else') ? 'box-shadow:inset 0 0 0 1.5px ' + T.ink : ''}"><span class="col"><span class="tt">${r}</span></span><span style="width:22px;height:22px;border-radius:999px;box-shadow:inset 0 0 0 ${st === 'else' && r === 'Something else' ? '7px ' + T.ink : '1.5px ' + T.dash}"></span></div>`).join('')}</div>
  ${st === 'else' ? `<div style="height:76px;border-radius:14px;box-shadow:inset 0 0 0 1.5px ${T.ink};padding:12px;font-size:14px;font-weight:600;color:${T.faint}">Say why, for Ruth…</div>` : ''}
  <div class="sb" style="display:flex;gap:6px;align-items:center">${ic('box', 14)}If anything was packed, Musa puts it back.</div>
  <span class="btn navy${st === 'else' ? ' off' : ''}" style="margin-top:auto">${st === 'else' ? 'Say why to send' : 'Ask Ruth to cancel'}</span>`);
const loading = `<header style="background:${T.navy};border-radius:0 0 28px 28px;padding:14px 20px 18px;display:flex;flex-direction:column;gap:16px;color:#fff;height:212px;box-sizing:border-box">
  <div style="display:flex;justify-content:space-between"><div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:20px;font-weight:700">Good morning, Grace</span><span style="font-size:12px;font-weight:600;color:${T.amberN};display:flex;gap:6px;align-items:center"><span class="spin" style="width:10px;height:10px;border-color:rgba(245,178,107,.4);border-top-color:${T.amberN}"></span>Updating…</span></div><span style="width:46px;height:46px;border-radius:999px;background:${T.navy2}"></span></div>
  <span class="shimn" style="height:12px;width:40%"></span><span class="shimn" style="height:34px;width:70%"></span><span class="shimn" style="height:8px;width:100%"></span></header>
  <div class="body"><div class="sec">Needs you <small><span class="shim" style="width:20px"></span></small></div>${[1, 2, 3].map(() => `<div class="card row" style="min-height:64px"><span class="shim" style="width:40px;height:40px;border-radius:12px"></span><span class="col" style="gap:8px"><span class="shim" style="width:70%"></span><span class="shim" style="width:40%"></span></span></div>`).join('')}
  <div class="sec">On the move</div><div class="card" style="height:86px"></div></div>${tabbar('Today')}`;
const addCust = `${P.pushHead('Who is it for?', 'New order')}<div class="body"><div class="card row" style="min-height:52px">${ic('search', 18)}<span class="sb" style="font-size:14px">Name or phone</span></div>
  <div class="card row" style="min-height:56px;box-shadow:inset 0 0 0 1.5px ${T.ink}">${sq('person', T.tile, T.ink)}<span class="col"><span class="tt">Add a customer</span><span class="sb">name and phone</span></span>${chev}</div>
  <div class="note" style="background:${T.infoS};color:${T.info}">Before: a person-plus icon with no words (it is spoken, never written). After: “Add a customer”, written and spoken.</div></div>`;
const goalCmp = `${hero('live', { sold: '0', pct: 0, mv: 14, ghost: true, moveWord: '+4.9M' })}<div class="body"><div class="note" style="background:${T.tile};color:${T.soft}">Sold ${mono('0')}: the bar has no white. The on-the-move part is hatched and named “+4.9M on the move”, so it never reads as sold.</div></div>${tabbar('Today')}`;
const sal6 = P.board('Sales · Copy, first load, goal bar (SAL-6, X-3)', [
  { state: 'Placed · words', sub: 'Before “The packs it” → the Store lead’s name; Checking names the Manager', html: placed('placed') },
  { state: 'Cancel ask · default', sub: '“If anything was packed, Musa puts it back”', html: cancelSheet('default') },
  { state: 'Cancel ask · Something else', sub: 'A note box; the button waits for words', html: cancelSheet('else') },
  { state: 'First load (was 5 s blank)', sub: 'P25 skeleton from the first frame; Updating…, never Live', html: loading },
  { state: 'Add a customer', sub: 'A visible, spoken label', html: addCust },
  { state: 'Goal bar · sold 0', sub: 'On the move hatched and named, white only for sold', html: goalCmp },
]);

module.exports = { 'SalesNotSent.dc.html': sal3, 'SalesPlaceOnce.dc.html': sal4, 'SalesPriceKeypad.dc.html': sal5, 'SalesCopy.dc.html': sal6 };
