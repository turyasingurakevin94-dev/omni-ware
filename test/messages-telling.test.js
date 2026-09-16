#!/usr/bin/env node
'use strict';
/*
 * The Telling lens: messages where nothing is owed.
 *
 * THE FINDING THIS FILE EXISTS FOR. Telling ranks on the OPPOSITE of
 * what Money ranks on. On Money a message left unsent gets more urgent
 * every day, because the debt is still there tomorrow. Here it gets
 * LESS worth sending, because the reason expires:
 *
 *   goods somebody asked for   news for a day
 *   a delivery on the run      news until the van arrives
 *   a price that fell          news only while the price holds
 *
 * So the column that ranks this list is GOOD UNTIL, the sort is
 * soonest-to-go-stale first, and THERE IS NO VALUE COLUMN. That last one
 * is a decision rather than an omission, and it is the one most likely
 * to be undone by somebody who thinks a list of messages should say what
 * each is worth: one of the three kinds, a delivery on today's run,
 * earns no order at all. It prevents a phone call. Ranked by what it
 * might sell it comes last for ever, which is exactly wrong, because its
 * entire worth is that it is true today and worthless tomorrow.
 *
 * Run: node test/messages-telling.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('messages telling');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const eq = (a, b, m) => t.check(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const rows = extractFunction(src, 'msgTellRows', 'index.html');
const row = extractFunction(src, 'tellRowHTML', 'index.html');
const screen = extractFunction(src, 'renderMessages', 'index.html');
const render = extractFunction(src, 'renderTelling', 'index.html');
const kpis = extractFunction(src, 'renderTellKpis', 'index.html');

/* ---------- 1. good until is the ranking, and there is no amount ----- */
{
  t.check(/out\.sort\(\(a,b\)=> \(\(a\.hold == null \? 9999 : a\.hold\) - \(b\.hold == null \? 9999 : b\.hold\)\)/.test(rows),
    'the list is sorted by how soon the reason stops being true, ascending');
  t.check(/while it holds/.test(rows),
    'and a reason with no day — a price, which holds until it moves — sorts last rather than being given an invented one');
  /* A tie is broken on the evidence, not on a coin: a fulfilled ask
     beats a weekly pattern when both expire tonight. */
  t.check(/const rank = \{asked: 3, delivery: 2, back: 1, rhythm: 0, price: -1\};/.test(rows)
    && /\(\(rank\[b\.kind\] \|\| 0\) - \(rank\[a\.kind\] \|\| 0\)\)/.test(rows),
    'and two reasons expiring the same day are ordered by the strength of the evidence — a fulfilled ask beats a weekly pattern');

  /* THE COLUMN THAT MUST NEVER EXIST. Five tracks, and not one of them
     is money. This is checked against the grid itself rather than
     against a comment, because a comment does not stop anybody. */
  const grid = (/\.om-trow,\.om-cols-t\{grid-template-columns:([^}]*)\}/.exec(code) || [])[1] || '';
  eq(grid.trim().split(/\s+/).length, 5, 'the row has five tracks');
  const header = (/<div class="om-cols om-cols-t">([\s\S]*?)<\/div>\s*<div[^>]*id="tell_list"/.exec(src) || [''])[0];
  ['Who, and what you would say', 'Why them', 'Good until', 'Next'].forEach((h) => {
    t.check(header.includes(h), `the header names ${h}`);
  });
  t.check(!/At stake|Value|Worth|Amount/i.test(header),
    'and NONE of them is an amount — a delivery on today’s run earns no order at all, and a value column would bury that kind for ever');
  t.check(!/om-fig[^>]*>\$\{esc\(fmtUGX/.test(row),
    'nor does a row carry a money figure of its own');
}

/* ---------- 2. the three kinds, each from its own condition ---------- */
{
  /* Nobody adds a row here by hand. Each kind becomes true when its own
     condition does, and vanishes when it stops. */
  t.check(/openFollowUps\(\)\.forEach/.test(rows)
    && /x\.kind === 'back_in_stock' \|\| x\.kind === 'companion_in' \|\| x\.kind === 'sourcing_progress'/.test(rows),
    'WHAT YOU ASKED FOR IS IN comes from a follow-up the client took out themselves, for something that has since landed');
  t.check(/pendingDeliveryOrders\(\)\.forEach/.test(rows),
    'A DELIVERY ON TODAY’S RUN comes from the order board, not from anything typed here');
  t.check(/briefQueue\(\)\.concat\(held\)\.forEach/.test(rows),
    'and what they take every week comes from the customer book’s own queue');
  /* The delivery kind carries no figure at all, and the comment beside
     it says why — that is the line most likely to be "fixed" by
     somebody adding the order total. */
  t.check(/worth: 0,\s*\n\s*order: q,/.test(rows) && /an order already placed is not an order/.test(rows),
    'the delivery kind carries no worth, because an order already placed is not an order this message wins');
  t.check(/const TELL_HOLD = \{asked: 0, delivery: 0, back: 3, rhythm: 3, price: null\};/.test(code),
    'and each kind knows how long it stays worth saying — 0 is today and only today, null is "while it holds"');
}

/* ---------- 2b. the sentence and the column are two forms of one truth  */
{
  /* A line that reads well in a column is not a sentence: the row has
     the client's name above it and a header over each part, and the
     draft has neither. */
  t.check(/fact: `the \$\{esc\(low\)\} you asked for \$\{be\} in/.test(rows)
    && /say: `The \$\{low\} you asked about \$\{be\} now in stock/.test(rows),
    'every row carries both a fact for the column and a sentence for the draft');
  const draft = extractFunction(src, 'tellDraftFor', 'index.html');
  t.check(/String\(r\.say \|\|/.test(draft),
    'and the draft is built from the sentence, falling back rather than going blank');
  /* THE PLAIN NAME. productDisplayLabel carries the SKU — "P006 — Barbed
     Wire" — which is the shop's own filing reference, and both of these
     lines are read by a customer. */
  /* Read with the comment stripped: the note that says WHY names the
     function it is warning against, and naming a fault is not
     committing it. */
  const rowsLive = rows.replace(/\/\*[\s\S]*?\*\//g, '');
  t.check(/productVariantLabel\(s\.product, s\.variantIdx\)/.test(rowsLive)
    && !/productDisplayLabel/.test(rowsLive),
    'and the product is named the way a customer would say it, never by its SKU');
  const be = extractFunction(src, 'tellBe', 'index.html');
  t.check(/\? 'are' : 'is'/.test(be),
    'with a verb that agrees — "the gutters you asked for is in" is how a customer knows a machine wrote it');
  t.check(/You asked to be told, so I kept you in mind/.test(draft),
    'and the ask draft says the one thing no broadcast can say, which is why that kind converts');
}

/* ---------- 3. the routing rule, computed ---------------------------- */
{
  const route = extractFunction(src, 'msgTellRoute', 'index.html');
  t.check(/kind === 'price' \? 'post' : 'tell'/.test(route),
    'a fact about a PRODUCT routes to the posting queue; a fact about a person stays a word');
  t.check(/function msgPostQueuePos/.test(src) && /waPickView\(todayISO\(\)\)/.test(extractFunction(src, 'msgPostQueuePos', 'index.html')),
    'and it says where that product already stands in the queue, so nothing is duplicated');
  const next = extractFunction(src, 'tellNextHTML', 'index.html');
  t.check(/if\(r\.route === 'post'\)/.test(next) && /in the queue/.test(next)
    && /data-tellwrite/.test(next),
    'so the Next cell is a queue position rather than a button — the column is named Next, not "Write it", because not every row’s next step is writing');

  /* A PERSON WHO OWES IS FLAGGED, NOT EXCLUDED — but only where the fact
     is one that will never be sent to them. The picture queue holds a
     debtor back for a good reason: somebody being asked for money does
     not also get a picture of cement, they get the statement. A
     product-level fact goes on the posting queue, to whoever is looking,
     so that rule is not in play — and hiding the row would leave the
     owner wondering where a real price cut went. */
  t.check(/briefHeldList\(\)\.filter\(b=> b\.reason && msgTellRoute\(b\.reason\.key\) === 'post'\)/.test(rows),
    'a client the picture queue holds back appears only for a fact that routes away from them');
  t.check(/r\.owes = Math\.max\(0, Number\(r\.customer && r\.customer\.debt\) \|\| 0\);/.test(rows),
    'and what they owe is carried on the row');
  const pill = extractFunction(src, 'tellWhyPill', 'index.html');
  t.check(/r\.owes > 0 \? `they owe/.test(pill) && /--om-caution/.test(pill),
    'said in the caution ink where the evidence would be, so the shop knows it is about to offer goods to somebody who has not paid');

  /* OUTSIDE THE THREE, and outside the badge. */
  t.check(/msgGroupHTML\('Better posted'/.test(render) && /outside the three/.test(render),
    'the better-posted rows are a band below the three rather than mixed into them');
  t.check(/const tell = narrow\(all\.filter\(r=> r\.route === 'tell'\)\);/.test(render)
    && /const posted = narrow\(all\.filter\(r=> r\.route === 'post'\)\);/.test(render),
    'and the two are separated by the route, not by hand');
}

/* ---------- 4. the sweep, and why it needs a stamp ------------------- */
{
  const sweep = extractFunction(src, 'msgTellSweep', 'index.html');
  /* Every other figure on this lens is read from the books when
     somebody looks. This one cannot be: the condition that made a
     reason true is precisely what has gone. */
  t.check(/data\.presetTellSeen/.test(extractFunction(src, 'msgTellSeen', 'index.html')),
    'the sweep keeps a stamp, because you cannot derive "this was true last week"');
  t.check(/presets\.tellSeen/.test(src) && /tellSeen:d\.presetTellSeen/.test(src),
    'and it survives a reload, both ways');
  t.check(/age > TELL_GONE_DAYS\)\{ delete seen\[k\]; dirty = true; return; \}/.test(sweep),
    'a lapsed reason is pruned on read at seven days, so the ledger never grows');
  t.check(/const TELL_GONE_DAYS = 7;/.test(code),
    'and seven days is what it is: a queue that silently drops what it failed to do teaches nothing');
  t.check(/if\(dirty\) saveData\(\);/.test(sweep),
    'with a write only when something actually changed — this runs on every render');
  t.check(/worth: Math\.round\(r\.worth \|\| 0\)/.test(sweep),
    'and each stamp carries what the reason was worth, because that is the part the books can no longer answer afterwards');
  t.check(/msgGroupHTML\('No longer worth saying'/.test(extractFunction(src, 'tellGoneHTML', 'index.html')),
    'and they are shown as a group, dimmed, with what they were worth');
}

/* ---------- 5. the cards, and the one with no figure ----------------- */
{
  eq((kpis.match(/<div class="om-kpi["$]/g) || []).length, 3, 'three cards, the frame’s own count');
  ['Say today, or not at all', 'Telling led to an order', 'Best reason to speak'].forEach((k) => {
    t.check(kpis.includes(k), `the cards name ${k.toLowerCase()}`);
  });
  /* THE THIRD ONE CARRIES NO FIGURE. It answers "what should I say",
     which is a phrase; a percentage in its place would be a fourth
     number on a lens whose whole argument is that it does not rank by
     numbers. */
  t.check(/NO FIGURE ON THIS ONE/.test(kpis) && /om-kpi-w/.test(kpis),
    'and the best reason is a phrase, not a rate');
  t.check(/briefScoreboard\(\)/.test(kpis),
    'with both rates read off the same stamps, so the two cards cannot disagree');
  t.check(/v\.told >= 2/.test(kpis) && /too few have been stamped/.test(kpis),
    'and a reason with one send behind it does not get ranked — it says so instead');
  /* The first card says what its count is MADE OF: "2" alone does not
     say whether today is two deliveries or two people waiting on goods,
     and those are different afternoons. */
  t.check(/a delivery on today&rsquo;s run/.test(kpis) && /goods somebody asked for/.test(kpis),
    'the count that matters is broken into the kinds behind it');
}

/* ---------- 5b. the lens chips, left to right ------------------------ */
{
  /* THE LENS YOU ARE ON WEARS ITS OWN COLOUR; the other two go quiet.
     Money is a debt, so its colour is the bad tint; Telling is news, so
     its colour is the studied blue — the same one the Good until column
     and the Say today card wear, which is what makes the chip and the
     lens it opens visibly the same thing; Posting is a suggestion about
     a product rather than a word anybody is owed, so it is neutral
     whether you are on it or not.

     Two frames draw this: the register has Money active and coral beside
     a grey Posting, and Telling has Telling blue beside a grey Money.
     The one frame that contradicts it is turn 1's, which its own handoff
     marks as superseded. */
  t.check(/setN\('msgSegMoney', money\.length, 'bad', msgLens === 'money'\);/.test(screen)
    && /setN\('msgSegTelling', telling\.length, 'studied', msgLens === 'telling'\);/.test(screen)
    && /setN\('msgSegPosting', nominated, 'neutral', msgLens === 'posting'\);/.test(screen),
    'each lens chip is tinted only while that lens is the one being read, in that lens’s own colour');
  t.check(/const t = TONE\[\(on && n\) \? tone : 'neutral'\] \|\| TONE\.neutral;/.test(screen),
    'and the other two go neutral rather than competing with it');

  /* A CHIP WITH NOTHING IN IT IS NOT A ZERO, IT IS NOTHING — and
     `hidden` alone did not do it. .om-chip sets display:inline-flex from
     the author stylesheet, which outranks the user agent's
     [hidden]{display:none} on cascade origin, so the attribute was set,
     assistive tech was told, and the eye still saw an empty grey pill on
     the lens with no work waiting. */
  t.check(/el\.hidden = !n;\s*\n\s*el\.style\.display = n \? '' : 'none';/.test(screen),
    'a count of nought removes the chip from the row as well as from the accessibility tree');
  t.check(/\.om-chip\{display:inline-flex/.test(code),
    'which is necessary because the chip class sets its own display and would otherwise win');
}

/* ---------- 6. it is its own view, on both designs ------------------- */
{
  t.check(/const onTell = msgLens === 'telling';/.test(screen)
    && /tellBody\.style\.display = onTell \? '' : 'none';/.test(screen),
    'Telling has a body of its own rather than borrowing the register’s');
  t.check(/if\(t\) t\.textContent = onPost \? 'What to post today' : onTell \? 'Worth telling someone' : 'Messages';/.test(screen),
    'with its own title');
  t.check(/Nothing is owed on these &middot; soonest to stop being true at the top/.test(src)
    || /'Nothing is owed on these · soonest to stop being true at the top'/.test(src),
    'and its own sub, which says what the ranking is');
  /* NOT A RIGHT RAIL. On the register the panel is where the work
     happens; here it is an explanation, and five columns need the
     width. */
  t.check(/class="om-tell-body"/.test(src) && /class="om-tell-panels"/.test(src)
    && /\.om-tell-panels\{display:grid;grid-template-columns:1fr 1fr/.test(code),
    'the list takes the whole width and the two readings sit under it, half and half');
  /* The two designs are emitted from ONE call, which is the law. */
  t.check(/<div class="om-trow-ph">/.test(row),
    'the phone card is emitted from the same call as the desktop row, so they can never say different things');
  t.check(/\.om-trow > :not\(\.om-trow-ph\)\{display:none\}/.test(code)
    && /\.om-trow-ph-a\{[^}]*height:44px/.test(code),
    'and at the 820px switch it is a card per reason with a thumb-sized act, not five columns narrower');
  /* The composer is the register's. A second box that sends is a second
     thing to keep in step with the stamp, and the stamp is what every
     figure on this lens is counted from. */
  const write = extractFunction(src, 'tellWriteIt', 'index.html');
  t.check(/msgLens = 'money';/.test(write) && /fupDrafts\[String\(r\.customerId\)\] = tellDraftFor\(r\);/.test(write),
    'Write it hands the draft to the register’s own composer rather than building a second one');
  t.check(!/waComposeUrl/.test(render) && !/recordFollowUpClient/.test(render),
    'and nothing is sent or stamped from this lens at all');
}

process.exit(t.done() ? 1 : 0);
