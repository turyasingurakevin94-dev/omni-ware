#!/usr/bin/env node
'use strict';
/*
 * An order's acts, as the Done board draws them: one joined bar --
 * Call, Tell <client> on WhatsApp with where the order is, Receipt with
 * what it comes to, and Change while it still can -- with Finish under
 * it on a done order, saying what it earned.
 *
 * Run: node test/agent-track-acts.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent track acts');
const src = read('agent.html');
const fn = (n) => extractFunction(src, n, 'agent.html');
const S = compileScope([fn('trackActsHTML')], {
  esc: (v) => String(v), fmtNum: (n) => Math.round(n).toLocaleString('en-US'),
  firstWord: (n) => String(n).split(/\s+/)[0],
  AX_ICON: { phone: '', whatsapp: '', receipt: '', pencil: '' },
}, ['trackActsHTML']);

const c = { name: 'Kato Construction', phone: '+256700000000' };
const done = S.trackActsHTML({ deliveryMode: 'agent_pickup' }, c, { key: 'done' }, 3620000, false);
t.check(/class="ax-tk-acts"/.test(done), 'the acts are one joined bar');
t.check(/>Call<\/span><span class="s">Kato</.test(done) && /href="tel:\+256700000000"/.test(done), 'Call names who it rings');
t.check(/>Tell Kato<\/span><span class="s">it's collected</.test(done), 'Tell says what the message is about');
t.check(/>Receipt<\/span><span class="s m">3,620,000</.test(done), 'Receipt says what it comes to');
t.check(!/data-change/.test(done), 'a done order has no Change');
const out = S.trackActsHTML({ deliveryMode: 'shop_delivery' }, { name: 'Opio' }, { key: 'out' }, 100, true);
t.check(/it's on the way/.test(out) && /data-change/.test(out) && /aria-disabled="true"/.test(out),
  'on the way it says so, Change shows while the order can change, and Call without a number is greyed');
const track = fn('openTrackSheet');
t.check(/\$\{trackActsHTML\(o, c, st, total, canChange\)\}\s*\$\{finish\}/.test(track), 'Finish sits under the bar, in thumb reach');
t.check(/<span class="y m">\$\{fmtSigned\(yours\)\} yours<\/span>/.test(track), 'and says what the order earned');

process.exit(t.done() ? 1 : 0);
