#!/usr/bin/env node
'use strict';
/*
 * The WhatsApp connection: a setup job, said as an intention.
 *
 * The live Messages desk carried a fourth area whose entire content was
 * the fact that nothing was connected. It said "nothing to show" three
 * times -- a line above the band, the band's own NOT CONNECTED heading,
 * and the sentence inside it -- then tabulated three absences as
 *
 *     Chats readable here            none
 *     Products customers can browse  none
 *     Broadcasts                     not available
 *
 * in a house style that everywhere else refuses to print a 0, and
 * offered "Check the connection" as the primary act, for a connection
 * that nobody had made. It held a quarter of a screen worked every day
 * to carry a decision taken once.
 *
 * THE FINDING THIS FILE PROTECTS: an unbuilt feature does not get a
 * place in a working screen. Three consequences, each checked below.
 *
 *   The connection -> Setup.  Linking a number is done once, with the
 *   phone in your hand, often by somebody other than the owner. It
 *   belongs beside the other things configured once.
 *
 *   Absences -> intentions.  You do not tabulate the absence of things
 *   that were never switched on. The three `none` rows are three lines
 *   in the FUTURE tense, each naming what the shop would actually get,
 *   and each figure in them is derived from the books rather than from
 *   the feature being argued for.
 *
 *   Check -> Link.  The primary act is to make the connection. Checking
 *   one is a secondary act inside the flow, where something has been
 *   attempted.
 *
 * Run: node test/whatsapp-link.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('whatsapp link');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const eq = (a, b, m) => t.check(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* The card's markup, pinned to the screen it is on. Sliced by section so
   "it is in the file somewhere" can never pass for "it is on Setup". */
function section(id) {
  const open = src.indexOf(`<section id="${id}"`);
  if (open < 0) throw new Error(`no section ${id}`);
  const next = src.indexOf('\n    <section id="', open + 10);
  return src.slice(open, next < 0 ? src.length : next);
}
const presets = section('tab-presets');
const messages = section('tab-messages');

/* ---------- 1. it is on Setup, and it is not on Messages ------------- */
{
  t.check(/<div class="om-walink"/.test(presets),
    'the connection is one card on Setup › The shop, where a thing configured once belongs');
  t.check(!/om-walink/.test(messages) && !/wa_connect_pan/.test(src),
    'and the Messages desk has no connection area at all — not a smaller one, none');
  t.check(!/id="wa_connect"/.test(src) && !/function waRenderConnect/.test(src),
    'the panel that drew it is gone rather than hidden, along with the div it wrote into');
  /* It has to be FINDABLE, or moving it to a page with a dozen folds on
     it is the same as deleting it. The page's own search reads
     [data-find], so the card carries the words somebody would type. */
  const card = (/<div class="om-walink"[^>]*>/.exec(presets) || [''])[0];
  t.check(/data-find="[^"]*whatsapp[^"]*"/.test(card) && /link/.test(card) && /connect/.test(card),
    'and it answers to the setup page’s own search, which is the only index that page has');
}

/* ---------- 2. the one sentence that is kept ------------------------- */
{
  /* The real reason a shop does not link is the fear that it breaks the
     number the business runs on. This sentence is the only thing
     anywhere that answers that fear, so it is READ BEFORE THE DECISION
     rather than after it: it is in the header row, above the three
     lines and above the button. */
  const head = (/<div class="om-wa-h">[\s\S]*?<\/div>\s*<\/div>/.exec(presets) || [''])[0];
  t.check(/Linking changes nothing on your phone/.test(head),
    'the sentence that answers the actual fear is kept, at the top of the card');
  t.check(/The same number keeps working there, chats keep arriving as they do now/.test(head),
    'with the promise it makes intact — the same number, the same chats');
  /* The one substitution: "this screen" became "Omni-Ware", because the
     screen in front of you in Setup is not the one that would start
     seeing the chats. Anything else here would be a rewrite of the
     owner's own words. */
  t.check(/Omni&#8209;Ware starts seeing them too/.test(head) && !/this screen simply starts seeing/.test(presets),
    'and the only change to it is the one the move forces: “this screen” is Omni-Ware now');
  t.check(/Nothing leaves the shop until you press send, and linking does not change that/.test(presets),
    'the footer promise is kept and extended to cover the new question');
  const promise = (/<div class="om-wa-promise">[\s\S]*?<\/div>/.exec(presets) || [''])[0];
  t.check(/<svg/.test(promise) && !/om-card/.test(promise),
    'and it sits BELOW the card rather than inside it — it is the app’s oldest law, not a note about this feature');
}

/* ---------- 3. absences became intentions --------------------------- */
{
  const lines = extractFunction(src, 'waLinkLinesHTML', 'index.html');
  eq((lines.match(/om-wa-line"/g) || []).length, 1,
    'the three capabilities are drawn from one template rather than three copies of a row');
  ['Read and answer chats here', 'Let customers browse what you sell', 'Send one message to a picked list']
    .forEach((k) => t.check(lines.includes(k), `“${k}” — said as what linking would turn on, in the future tense`));
  /* Read with the svg stripped: fill="none" is a drawing instruction,
     not a value printed at a shopkeeper. */
  const words = lines.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/\$\{path\}/g, '');
  t.check(!/\bnone\b/.test(words) && !/not available/.test(words),
    'and NOT as none · none · not available — a house that refuses to print a 0 does not tabulate three absences either');
  /* THE TILE STATE IS THE WHOLE ARGUMENT. Dashed and unfilled says "not
     yet"; a FILLED tile with a grey glyph says "broken", which is the
     opposite of what this card is for. */
  t.check(/\.om-wa-slot\{[^}]*border:1px dashed var\(--om-dashed\)/.test(code),
    'an unlinked capability wears a dashed, unfilled tile — the “not yet” state');
  t.check(/\.om-wa-slot\.om-on\{[^}]*background:var\(--om-good\)[^}]*color:var\(--om-good-ink\)/.test(code),
    'and fills on linking, ground and glyph together — never a filled tile with a grey glyph, which reads as broken');
  t.check(/om-wa-slot\$\{on \? ' om-on' : ''\}/.test(lines),
    'with the switch driven by the link status itself');
  t.check(/on \? 'Chats are read and answered here'/.test(lines)
    && /on \? 'Customers browse what you sell'/.test(lines),
    'and the copy switching to the present tense with it');
}

/* ---------- 3b. and every figure in them is derived ------------------ */
{
  /* The frame's own figures are demo data except the browsable count,
     which is real. Both of ours are read off the books, and the rule is
     the app's oldest: derived, never invented. */
  const browsable = extractFunction(src, 'waBrowsableCount', 'index.html');
  t.check(/waCatalogItems\(\)\.items\.length/.test(browsable),
    'how many products could be browsed is counted by the same function the sync itself uses, so the card and the push cannot disagree');

  /* "A price change to the 24 people who buy that line" cannot be read
     off the chat list: there IS no chat list until the number is
     linked, and a figure that needs the thing being argued for is the
     absence-table fault wearing a number. It is read off the invoices
     instead. */
  const big = extractFunction(src, 'waBiggestBuyerList', 'index.html');
  t.check(/data\.savedQuotes/.test(big) && !/waInbox\.convs/.test(big),
    'the biggest list one message could go to is counted from the shop’s own invoices, not from a chat list that does not exist yet');
  t.check(/q\.voided \|\| !q\.invoiced/.test(big),
    'over invoiced, unvoided orders only');
  t.check(/new Set\(\)/.test(big) && /\.set\.add\(cid\)/.test(big),
    'counting DISTINCT customers per product — one person buying a line ten times is one person to message');
  t.check(/best\.set\.size < 2\) return null/.test(big),
    'and returning null rather than a 1 or a 0 when the books cannot answer');

  const lines = extractFunction(src, 'waLinkLinesHTML', 'index.html');
  t.check(/n \? `Your catalogue, with the \$\{n\}/.test(lines) && /so there would be nothing to browse/.test(lines),
    'a shop with no photographed, priced product is told that, rather than shown a 0');
  t.check(/big \? `A price change to the \$\{big\.n\}/.test(lines) && /the books do not yet show a line two people have both bought/.test(lines),
    'and one whose books show no shared line is told THAT — named rather than dropped, which is the law');
}

/* ---------- 4. check became link ------------------------------------ */
{
  const footer = (/<div class="om-wa-f">[\s\S]*?<\/div>\s*<div class="om-wa-flow"/.exec(presets) || [''])[0];
  t.check(/id="wa_link_go"[^>]*>Link the number</.test(footer),
    'the primary act is to MAKE the connection, not to check one nobody has made');
  t.check(/class="om-btn om-btn-p" id="wa_link_go"/.test(footer),
    'and it is the accent — .om-btn-p is the coral, and this is the one thing to do on this card');
  eq((footer.match(/om-btn-p/g) || []).length, 1,
    'which appears exactly once: the hand-off beside it is a secondary act, not a second decision');
  t.check(/About ten minutes &middot; you will need the phone in your hand/.test(footer),
    'with the cost stated beside it — ten minutes, and the phone in your hand');
  /* Check the connection still exists, because a link that was
     attempted and did not take has to be askable about. It is inside
     the flow, which is only open once somebody has started. */
  const flow = extractFunction(src, 'waRenderLinkFlow', 'index.html');
  t.check(/id="wa_check"/.test(flow) && !/id="wa_check"/.test(footer),
    'checking is a secondary act inside the flow, where something has been attempted');
  /* And the flow is not drawn until it is opened: it reads four values
     off the server, and a setup panel nobody has opened should not be
     asking the database anything. */
  t.check(/if\(open && !flow\.dataset\.drawn\)\{ flow\.dataset\.drawn = '1'; waRenderLinkFlow\(\); \}/.test(code),
    'and the flow is drawn on first opening rather than on every render, because it asks the server four questions');
}

/* ---------- 4b. the steps are handed over, not disclosed -------------- */
{
  /* "THE TECHNICAL STEPS — FOR WHOEVER SET UP THIS COMPUTER" was the
     right instinct and the wrong mechanism: a fold requires that person
     to be sitting at this screen to expand it, which is exactly who is
     not there. */
  const hand = extractFunction(src, 'waSendTheSteps', 'index.html');
  t.check(/waStepsText\(\)/.test(hand) && /window\.open\(waComposeUrl\(/.test(hand),
    'the steps can be sent to whoever does them, through the app’s own hand-off');
  t.check(/waComposeUrl\('', text\)/.test(hand),
    'with no recipient, on purpose — the shop’s own number is not the person who does this, so WhatsApp’s picker is the right next screen');
  t.check(/the app cannot see the send/.test(hand),
    'and nothing is stamped, because the app cannot see the send — the same law every other send on this desk obeys');
  /* Written once, read twice: the person doing the work and the person
     reading about it must not be given two different instructions. */
  const steps = extractFunction(src, 'waStepsText', 'index.html');
  const flow = extractFunction(src, 'waRenderLinkFlow', 'index.html');
  ['developers.facebook.com', 'WHATSAPP_ACCESS_TOKEN', 'Phone number ID', 'business.facebook.com/commerce']
    .forEach((k) => t.check(steps.includes(k) && flow.includes(k),
      `“${k}” is in both the sent words and the shown ones — one instruction, two readers`));
}

/* ---------- 5. what it leaves in Messages ---------------------------- */
{
  const render = extractFunction(src, 'renderMessages', 'index.html');
  t.check(/if\(!waLinked\(\)\)\{\s*\n\s*html \+= `<div class="om-linkline">/.test(render),
    'one line in Messages, and only while the number is not linked');
  t.check(/Chats could be answered here too\. Link your number and the replies to these messages arrive on this screen\./.test(render),
    'saying what linking would do for THIS screen, in the handoff’s own words');
  /* At the FOOT. It sits after the sent line, which is after every
     group, so it is read after the work rather than instead of it --
     and it is not a lens, not a tab, and not a band announcing a void. */
  const foot = render.indexOf('om-linkline');
  const sent = render.indexOf('om-sentline');
  const list = render.indexOf('list.innerHTML = html');
  t.check(sent > 0 && foot > sent && list > foot,
    'at the foot of a list that has real work in it, below the last group');
  t.check(!/data-msglens="inbox"/.test(messages) && !/om-linkline[\s\S]{0,200}om-lens/.test(render),
    'and it is a line rather than a lens or a tab — a void does not get a place beside the work');
  t.check(/data-msglink="1"[^>]*>Link WhatsApp</.test(render),
    'with one button on it, which goes where the decision lives');
  const door = extractFunction(src, 'waOpenLinkSetup', 'index.html');
  t.check(/goToTab\('presets'\)/.test(door),
    'and that is Setup, not a pane opening inside this screen');
}

/* ---------- 5b. no door without a room ------------------------------- */
{
  /* Everything behind the Posting lens's own door -- who is waiting, who
     was answered, the broadcast arithmetic, the channel's health -- is
     read off an inbox, and there is no inbox until the number is
     linked. A door that opens onto one grey sentence saying so is the
     same fault as the old connection panel, in miniature. */
  const render = extractFunction(src, 'renderMessages', 'index.html');
  t.check(/const linked = waLinked\(\);/.test(render) && /phubBtn\.hidden = !linked;/.test(render),
    'the inbox door is not drawn at all until there is something behind it');
  t.check(/phub\.hidden = !onPost \|\| !postHubOpen \|\| !linked;/.test(render),
    'and cannot be left open across the change');
}

/* ---------- 6. the link status is the only stored fact --------------- */
{
  const linked = extractFunction(src, 'waLinked', 'index.html');
  t.check(/waInbox\.configured === true/.test(linked),
    'one reading of one stored fact — and === true, so "not asked yet" is not "linked"');
  /* Everything else derives: whether the line shows, whether the door
     exists, how many products could be browsed. None of it is a second
     copy of the same truth waiting to disagree. */
  t.check(!/presetWaLinked|data\.waLinked|presetWaConnected/.test(src),
    'and nothing writes a second copy of it into the presets blob');
  /* The register asks once a session and never polls. The old interval
     was guarded by a tab name that stopped existing when WhatsApp and
     Follow-ups became Messages, so it cleared itself on its first tick
     and refreshed nothing after -- reading, to anyone who looked, like
     a live poller. */
  const enter = extractFunction(src, 'waInboxEnter', 'index.html');
  t.check(/if\(waInbox\.configured == null\) waInbox\.configured = await waInboxStatus\(\);/.test(enter),
    'the status is resolved once a session, because the Waiting figure is read off the inbox and there is no other way to know');
  t.check(!/setInterval/.test(enter),
    'and never polled from the register — it must not sit asking about a connection it does not need');
}

process.exit(t.done() ? 1 : 0);
