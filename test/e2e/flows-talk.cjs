'use strict';
/*
 * Tell, Chats and Give, from Today, by taps (test/e2e/sales-flows.cjs runs them).
 * FACTS §4.2: #0552 was told 1,750,000; Ruth kept the shop's 38,000 a sheet, so it is 1,810,000 and
 * "Tell Kato · a new price" waits on Grace (TD04). §5: Needs you 7 = Take 2 + Tell 2 + Chats 3.
 * §3.4: 0701 552 904 ("Mama Shine") asked for 3m iron sheets at 10:37 (CH14).
 */
const NEEDS = /Needs you\s*(\d+)/;
const TELL = /Tell them\s*([^\n]*)\s*(\d+)\s*Tell/;

/** Today's Needs you count and its Tell them row. */
async function todayTell(ph) {
  const s = await ph.text();
  const n = NEEDS.exec(s), t = TELL.exec(s);
  return { needs: n ? +n[1] : null, tell: t ? +t[2] : 0, what: t ? t[1] : '', kato: /Kato · a new price/.test(s), s };
}

/** 4a. Today's tell card: Tell them → Tell Kato (TD04) → Send to Kato → Kato's new price is told. */
async function tellToday(open) {
  const ph = await open('');
  const { tap, check } = ph;
  let t = await todayTell(ph);
  check(t.tell === 2 && t.kato, 'tell today: Today starts with Tell them 2, Kato · a new price among them', t.s.slice(0, 900));
  await tap('Tell them');
  const sheet = await ph.all();
  check(/Tell Kato/.test(sheet) && /36,500 → 38,000/.test(sheet) && /1,810,000/.test(sheet), 'tell today: the sheet is Tell Kato, 36,500 → 38,000, pays 1,810,000', sheet.slice(-800));
  await tap('Send to Kato', 1200);
  check(/Sent to Kato/.test(await ph.all()), 'tell today: "Sent to Kato" shows');
  await tap('Close');
  await ph.tab('today');
  t = await todayTell(ph);
  check(!t.kato, 'tell today: Kato · a new price is gone from Today (told)', t.s.slice(0, 1200));
  check(t.tell === 1 && /an item is in/.test(t.what) && !/new price/.test(t.what), 'tell today: Tell them is 1 · an item is in', t.what + ' ' + t.tell);
  // The order agrees: #0552's own Tell no longer says the new price as news.
  await ph.tab('orders');
  await tap({ sel: 'button.ow-orow-main:has-text("#0552")' });
  await tap({ sel: 'button.ow-act:has-text("Tell Kato")' });
  const msg = await ph.p.locator('[aria-label="The message"]').innerText();
  check(!/not 36,500/.test(msg), '#0552 Tell no longer tells the new price once Kato was told', msg);
  return ph;
}

/**
 * 4b. An order's Tell (OR10 on #0552 at 10:41; OR11 on Nansana's #0556, chat shut).
 * OR10's message carries the new price, so once sent Kato counts as told on Today, as TD04's send does.
 */
async function tellOrder(open) {
  const ph = await open('');
  const { tap, check } = ph;
  let t = await todayTell(ph);
  check(t.kato && t.tell === 2, 'tell order: Today starts with Kato · a new price to tell', t.s.slice(0, 900));
  await ph.tab('orders');
  await tap({ sel: 'button.ow-orow-main:has-text("#0552")' });
  await tap({ sel: 'button.ow-act:has-text("Tell Kato")' });
  const msg = await ph.p.locator('[aria-label="The message"]').innerText();
  check(/38,000 each, not 36,500/.test(msg) && /1,810,000, not 1,750,000/.test(msg), 'OR10: the message tells the new price (38,000, not 36,500; 1,810,000, not 1,750,000)', msg);
  await tap('Send on WhatsApp', 1200);
  check(/Sent to Kato/.test(await ph.all()), 'OR10: "Sent to Kato" shows');
  // In Kato's chat, once.
  await tap('Back to Orders');
  await ph.tab('chats');
  await tap({ text: 'Kato Construction' });
  const thread = await ph.text();
  const sent = thread.split(msg.trim().slice(0, 40)).length - 1;
  check(sent === 1, 'OR10: the message is in Kato\'s chat once', thread.slice(-600));
  await tap('Back to Chats');
  await ph.tab('today');
  t = await todayTell(ph);
  check(!t.kato, 'OR10: Kato · a new price is marked told on Today after the order\'s Tell sent it', t.s.slice(0, 1200));
  check(t.tell === 1, 'OR10: Tell them drops to 1', `${t.tell} · ${t.what}`);

  // OR11: Nansana's chat is shut (2 days): SMS leads, with the message and her number.
  await ph.tab('orders');
  await tap('Show 2 more');
  await tap({ sel: 'button.ow-orow-main:has-text("#0556")' });
  await tap({ sel: 'button.ow-act:has-text("Tell Nansana")' });
  const sheet = await ph.all();
  check(/Chat shut\s*·\s*2 days/.test(sheet), 'OR11: the sheet says Chat shut · 2 days', sheet.slice(-500));
  const sms = await ph.p.locator('a.or-btn-n').getAttribute('href');
  check(/^sms:\+256\d{9}\?body=/.test(sms || '') && /%230556/.test(sms || ''), 'OR11: Send as SMS carries her number and the #0556 message', sms);
  const wa = await ph.p.locator('a.or-btn-w').getAttribute('href');
  check(/^https:\/\/wa\.me\/256\d{9}\?text=/.test(wa || ''), 'OR11: WhatsApp opens with it typed (wa.me)', wa);
  ph.note('OR11: Send as SMS hands the words to the phone and records nothing; a status tell has no "told" state to assert (orders/Tell.tsx, spec 04 l.100 "a send is never claimed")');

  // OR35: the order's paper (Receipt) on Lubowa's #0559 at 15:05 is as it stands; sending it tells Ruth's 35,000 (Q17).
  const p2 = await open('&clock=15:05');
  await p2.tab('orders');
  await p2.tap({ sel: 'button.ow-orow-main:has-text("#0559")' });
  p2.check(/Told them/.test(await p2.text()), 'OR13: #0559 waits to tell Lubowa the new price before the paper goes');
  await p2.tap({ sel: 'button.ow-act:has-text("Receipt")' });
  const paper = await p2.text();
  p2.check(/Order · #0559 · as it stands/.test(paper) && /UGX 880,000/.test(paper) && /Owes on it\s*880,000/.test(paper) && /Ruth set 35,000 · not told yet/.test(paper), 'OR35: the paper is as it stands, UGX 880,000, owes 880,000, Ruth set 35,000 · not told yet', paper);
  await p2.tap('Send on WhatsApp', 1200);
  p2.check(/Sent to Lubowa/.test(await p2.all()), 'OR35: "Sent to Lubowa" shows');
  const after = await p2.text();
  p2.check(!/Told them/.test(after) && /#0559/.test(after), 'OR35: the paper told the new price, so #0559 no longer asks to tell it (Q17)', after.slice(0, 900));
  return ph;
}

/** 5. Chats: reply to Kato; then the new number (CH14): Take → Start order → the chat's item once → placed. */
async function chats(open) {
  const ph = await open('');
  const { tap, type, slide, check, text } = ph;
  await ph.tab('chats');
  check(/Waiting\s*3/.test(await text()), 'chats: Waiting 3 to begin');
  await tap({ text: 'Kato Construction' });
  const reply = 'Yes, it can come to the Ntinda site.';
  await type(reply, { sel: '.ow-comp-field input' });
  await tap({ label: 'Send' }, 800);
  let s = await text();
  check(s.split(reply).length - 1 === 1, 'chats: the reply is in Kato\'s thread once', s.slice(-400));
  await tap('Back to Chats');
  s = await text();
  check(/Waiting\s*2/.test(s), 'chats: Waiting drops to 2 after the reply', s.slice(0, 600));

  await tap({ text: '0701 552 904' });
  s = await text();
  check(/Mama Shine wants to buy/.test(s) && /Iron sheet G28 · 3m/.test(s), 'CH14: the chat reads "wants to buy" Iron sheet G28 · 3m', s);
  await tap({ text: 'Take' });
  await tap('Start order', 800);
  const lines = (await ph.p.locator('a.sl-line').allInnerTexts()).map((x) => x.replace(/\s+/g, ' '));
  check(lines.length === 1, 'CH14: the order has exactly one line', lines.join(' / '));
  check(lines.filter((x) => x.includes('Iron sheet G28 · 3m')).length === 1 && /1 pc × 38,000/.test(lines[0] || ''), 'CH14: the line is Iron sheet G28 · 3m, 1 pc × 38,000, once', lines.join(' / '));
  check(/Slide to place · 1 item\b/.test(await text()), 'CH14: the slide says 1 item');
  await slide();
  await ph.wait('Placed');
  s = await text();
  check(/#0558/.test(s) && /38,000/.test(s), 'CH14: placed as #0558, 38,000', s);
  check((s.match(/Iron sheet/g) || []).length === 1, 'CH14: Placed lists the iron sheet once', s);
  // An order with no customer named still reads as English (the chat's number or "they", never "to They" / "They leaves").
  check(!/sent to They\b/.test(s) && !/They leaves\b/.test(s), 'CH14: Placed words read right for an unnamed buyer (no "Picture sent to They", "They leaves when paid")', s);
  await tap('Back to Today');
  await ph.tab('orders');
  const found = await ph.orderRow('#0558');
  check(found, 'CH14: #0558 is in Orders', await text());
  if (found) {
    await tap({ sel: 'button.ow-orow-main:has-text("#0558")' });
    s = await text();
    check((s.match(/Iron sheet G28 · 3m/g) || []).length === 1, 'CH14: #0558 carries Iron sheet G28 · 3m exactly once', s);
  }
  return ph;
}

/** 6. Give: Kato's chat → Grace's → Give to Brian with a note → the handover shows. */
async function give(open) {
  const ph = await open('');
  const { tap, type, check, text } = ph;
  await ph.tab('chats');
  check(/Mine\s*6/.test(await text()), 'give: Mine 6 to begin');
  await tap({ text: 'Kato Construction' });
  await tap({ label: 'Grace’s. Give Kato to a teammate' });
  const sheet = await ph.all();
  check(/Give Kato to…/.test(sheet) && /Give to Brian/.test(sheet), 'give: the sheet offers Brian', sheet.slice(-500));
  const note = 'Kato asks if it can come to the Ntinda site.';
  await type(note, { sel: 'textarea' });
  await tap({ text: 'Give to Brian' }, 900);
  const s = await text();
  check(/Grace gave Kato to Brian/.test(s), 'give: the thread shows "Grace gave Kato to Brian"', s.slice(-500));
  check(s.includes(note), 'give: the note to Brian is in the thread', s.slice(-500));
  check(await ph.p.locator('[aria-label="Brian’s customer now"]').count() === 1, 'give: the head says Brian’s', s.slice(0, 200));
  check(/Kato is Brian’s now/.test(await ph.all()), 'give: "Kato is Brian’s now" shows');
  await tap('Back to Chats');
  check(/Mine\s*5/.test(await text()), 'give: Mine drops to 5', (await text()).slice(0, 600));
  return ph;
}

module.exports = { tellToday, tellOrder, chats, give };
