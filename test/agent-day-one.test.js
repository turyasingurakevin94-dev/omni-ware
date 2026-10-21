#!/usr/bin/env node
'use strict';
/*
 * What landed from the boards on one day: the You page, the trip card,
 * the door, the four-step tour, the tips on the first order and the
 * first order in, and variants that have names.
 *
 *   - Your link is a QR code made in the page (the phone app ships no
 *     outside scripts). It is pinned against a code a real decoder read.
 *   - The trip card's arrival time comes from this agent's own past
 *     deliveries; with fewer than three there is no "usually" at all.
 *   - A size stays a compact figure chip; a name (a colour, "Clear · 1L")
 *     gets a word chip with a dot of its colour, on one row.
 *   - An empty shelf says what it means for the agent, not the stock count.
 *   - The tour, the tips and the first-order screen each show once, and
 *     only to an agent with nothing yet.
 *
 * Run: node test/agent-day-one.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent day one');
const src = read('agent.html');
const fn = (n) => extractFunction(src, n, 'agent.html');

/* ---------- 1. the QR code, made here ---------------------------------- */
{
  const consts = src.slice(src.indexOf('const QR_M = ['), src.indexOf('function qrMatrix(text){'));
  const S = compileScope([consts, fn('qrMatrix')], { TextEncoder }, ['qrMatrix']);
  // Read back by OpenCV's QR decoder as "hi" when this was written.
  const HI = ['111111100111101111111', '100000100110101000001', '101110101101101011101', '101110101100101011101', '101110101001101011101',
    '100000101100101000001', '111111101010101111111', '000000001011100000000', '101111100000101111100', '011101010010100100001',
    '001100110101010011110', '111010000100000110100', '111010100001010010101', '000000001001111001001', '111111100010101100010',
    '100000101111111001001', '101110101000100100100', '101110101110100100100', '101110101001010011100', '100000100110000110100',
    '111111101011010011110'];
  t.check(S.qrMatrix('hi').map((r) => r.join('')).join() === HI.join(), 'the code for "hi" is the one a decoder read back');
  const url = 'https://omni-ware.vercel.app/catalogue.html?a=brian-k';
  const g = S.qrMatrix(url);
  t.check(g.length === 33, 'a shop link fits version 4 (33 modules), small enough to scan off a phone at arm\'s length');
  const finder = (r0, c0) => [0, 6].every((i) => g[r0 + i].slice(c0, c0 + 7).join('') === '1111111') && g[r0 + 3].slice(c0, c0 + 7).join('') === '1011101';
  t.check(finder(0, 0) && finder(0, 26) && finder(26, 0), 'with its three finder squares in the corners');
  t.check(g[6].slice(8, 25).join('') === '10101010101010101', 'and the timing line between them');
  const fmtA = [0, 1, 2, 3, 4, 5, 7, 8].map((r) => g[r][8]).concat([7, 5, 4, 3, 2, 1, 0].map((c) => g[8][c]));
  const fmtB = [32, 31, 30, 29, 28, 27, 26, 25].map((c) => g[8][c]).concat([26, 27, 28, 29, 30, 31, 32].map((r) => g[r][8]));
  t.check(fmtA.join('') === fmtB.join(''), 'both copies of the format bits agree');
  t.check(g[25][8] === 1, 'the dark module is set');
  t.check(S.qrMatrix('x'.repeat(300)) === null, 'a text too long for version 10 gives no code, not a broken one');
  t.check(/meQRHTML\(link\)/.test(fn('openProfileSheet')) && !/cdn\.|https:\/\/cdnjs/.test(fn('meQRHTML')), 'the You page draws it from the link, with nothing fetched');
}

/* ---------- 2. the You page ------------------------------------------- */
{
  const you = fn('openProfileSheet');
  t.check(/meRingSVG\(share\)/.test(you) && /esc\(agentInitials\(\)\)/.test(you), 'your initials sit in a ring of the month');
  t.check(/goal by \$\{Math\.ceil\(g\.finishDay\)\}/.test(you) && /Set a goal for/.test(you), 'the pace says when the goal is reached, or offers to set one');
  t.check(/gapToNext/.test(you) && /sell by Sun → \$\{streak \+ 1\}/.test(you), 'standing says what the next place takes; the streak what keeps it');
  t.check(/data-p="copy"/.test(you) && /Share my card/.test(you), 'the link shares or copies');
  const term = fn('termCardHTML');
  t.check(/\['cash', 'You pay', 1\], \['box', 'Packed'\]/.test(term) && /\['truck', 'Delivered'\], \['cash', 'You pay', 1\]/.test(term),
    'the term is drawn as the order things happen in: prepay pays before packing, the other on delivery');
  const url = compileScope([fn('catalogueUrl')], { location: { origin: 'capacitor://localhost' } }, ['catalogueUrl']);
  t.check(/^https:\/\/omni-ware\.vercel\.app\/catalogue\.html\?a=bk$/.test(url.catalogueUrl('bk')),
    'in the phone app the link points at the site, not at the app\'s own page -- a client could not open that');
}

/* ---------- 3. the trip ------------------------------------------------ */
{
  const now = Date.now();
  const trip = (outAgo, took) => ({ deliveryMode: 'shop_delivery', voided: false, stageLog: [{ status: 'pending_delivery', at: now - outAgo }, { status: 'completed', at: now - outAgo + took * 60000 }] });
  const mk = (orders) => compileScope([fn('tripUsualMinutes'), fn('tripNow')], { myOrders: orders, toMs: (v) => Number(v) }, ['tripUsualMinutes', 'tripNow']);
  t.check(mk([trip(9e7, 30), trip(8e7, 40)]).tripUsualMinutes() === null, 'two past trips are not enough to say "usually"');
  t.check(mk([trip(9e7, 30), trip(8e7, 41), trip(7e7, 55)]).tripUsualMinutes() === 40, 'three give the middle one, to the nearest five minutes');
  const S = mk([trip(9e7, 30), trip(8e7, 40), trip(7e7, 50)]);
  const o = { stageLog: [{ status: 'pending_delivery', at: now - 20 * 60000 }] };
  const r = S.tripNow(o);
  t.check(Math.abs(r.share - .5) < .02 && r.eta, 'twenty minutes into a usual forty, the truck is halfway, with an arrival time');
  const none = mk([]).tripNow(o);
  t.check(!none.eta && none.usual === null, 'with no history, no arrival time is claimed');
  const card = fn('deliveryCardHTML');
  t.check(/class="map"/.test(card) && /Call \$\{esc\(firstWord\(name\)\)\}/.test(card) && !/data-tellclient/.test(card.split("if(st.key === 'out')")[1].split('return `<section class="ax-card ax-dcard soon"')[0]),
    'the trip card draws the road and the driver; telling the client is the bar\'s job, said once');
}

/* ---------- 4. variants with names ------------------------------------ */
{
  const S = compileScope([`const FIND_SWATCH = ${src.match(/const FIND_SWATCH = (\{[\s\S]*?\});/)[1]};`, fn('findIsSizeLabel'), fn('findSwatch'), fn('findVariantFace')],
    { esc: (v) => String(v) }, ['findIsSizeLabel', 'findSwatch', 'findVariantFace']);
  t.check(['4"', '32.5', '4L', '20mm', '3m'].every(S.findIsSizeLabel), 'sizes stay sizes');
  t.check(!['Brilliant white', 'Clear · 1L', 'Mahogany', 'Signal red'].some(S.findIsSizeLabel), 'names are names');
  t.check(S.findSwatch('Signal red') === '#C0281F' && S.findSwatch('Mahogany · 1L') === '#6B2A1A' && S.findSwatch('Gloss') === null, 'a colour gets its dot; a word that is not one gets none');
  const face = S.findVariantFace('Clear · 1L');
  t.check(/sw clear/.test(face) && /<span class="nm">Clear<\/span><span class="sz m">1L<\/span>/.test(face), '"Clear · 1L" is a name and a size, drawn as both');
  const row = fn('findRowHTML');
  t.check(/ax-fd-sizes named/.test(row) && /colours' : 'more'/.test(row), 'named variants sit on one row, the rest behind "+N colours"');
  t.check(/in later · shop confirms/.test(row) && !/' dim'/.test(row), 'an empty shelf is said in the agent\'s terms, and the row is not greyed -- it can still be ordered');
}

/* ---------- 5. day one, once ------------------------------------------ */
{
  const store = {};
  const env = (orders, clients) => ({
    myOrders: orders, agentClients: clients, document: { querySelector: () => null },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    agentLocalKey: (k) => k,
  });
  let opened = 0;
  const run = (orders, clients) => compileScope([fn('dayOneOrders'), fn('dayOneGet'), fn('dayOneSet'), fn('maybeTour')],
    Object.assign(env(orders, clients), { openTour: () => { opened++; } }), ['maybeTour', 'dayOneSet']);
  run([{ id: 1 }], []).maybeTour();
  run([], [{ id: 1 }]).maybeTour();
  t.check(opened === 0, 'an agent with an order or a client is not toured');
  run([], []).maybeTour();
  t.check(opened === 1, 'a brand-new agent is');
  const S = run([], []);
  S.dayOneSet('agentTourSeen', 1);
  S.maybeTour();
  t.check(opened === 1, 'and only once');
  t.check(/openNewClientPanel\('', null\)/.test(fn('openTour')), 'the tour ends on adding the first client');
  const tick = fn('coachTick');
  t.check(/dayOneOrders\(\) > 0/.test(tick) && /st\.done/.test(tick), 'the tips stop for good once skipped, or once any order exists');
  t.check(/data-coach="skip"/.test(fn('coachShow')), 'every tip can be skipped');
  t.check(/agentFirstSent/.test(src) && /String\(o\.id\) !== String\(orderId\)\)\.length === 0/.test(src), 'the first-order screen is for the first order only');
  t.check(/You pay the shop/.test(fn('showFirstSent')) && /3 of 3/.test(fn('showFirstSent')), 'it says what happens next, and the checklist is done');
}

/* ---------- 6. the door ------------------------------------------------ */
{
  const login = fn('showLoginScreen');
  const toasts = login.slice(login.indexOf('class="aa-float"'), login.indexOf('</div>', login.indexOf('class="aa-float"')));
  t.check(toasts.length > 0 && !/\d/.test(toasts.replace(/\$\{AA_ICON\.\w+\}/g, '')), 'what the door shows of the app has no figures and no names -- there are none yet');
  t.check(/id="auth_eye"/.test(login) && /aria-pressed/.test(login), 'the password can be shown, and says whether it is');
  const setpw = fn('showSetPasswordScreen');
  t.check(/saveBtn\.disabled = true;/.test(setpw) && /catch\(e\)/.test(setpw), 'the invite\'s password cannot be double-sent, and a thrown save is reported');
  t.check(/pw1\.length < 6/.test(setpw) && /data-r="num"/.test(setpw), 'six characters is still the rule; the others are advice, ticked when taken');
  /* Signed in, but not an agent -- the owner's own login, on 21 Oct. It
     was a red line ending ".." and "Reload to try again", with no way to
     another login: reloading signs the same login in again. */
  const auth = fn('ensureAgentAuth'), boot = fn('boot');
  t.check(/err\.code = 'not-agent';/.test(auth) && /if\(e && e\.code === 'not-agent'\)\{ showNotAgentScreen\(e\.email\); return; \}/.test(boot),
    'a login with no agent behind it gets its own screen, not a failure to retry');
  t.check(/signOutAndReload\(\)/.test(fn('showNotAgentScreen')) && /Running the shop\?/.test(fn('showNotAgentScreen')),
    'which offers another login, and points the shop to its own app');
  t.check(/replace\(\/\[\.\\s\]\+\$\/, ''\)/.test(fn('showBootFailScreen')) && !/Reload to try again<\/div>/.test(boot),
    'and any other failure is said once, with one full stop and a way back to the door');
}

process.exit(t.done() ? 1 : 0);
