#!/usr/bin/env node
'use strict';
/*
 * The Sell group takes the console header, and the rules in the old
 * prose survive the move.
 *
 * Thirty-three screens still wear the shape the app grew up in: a
 * .page-head with a display-face title and a paragraph of explanation
 * above the work. Today and the Manager wear .ow-ph -- name, one line,
 * a hairline, and the screen's own action on the right. The seven
 * screens of the Sell group go first because they are the ones opened
 * most.
 *
 * The conversion has one real hazard, and it is a quiet one.
 * foldPageInstructions folds `.page-head > p` behind the "i" bubble.
 * Converting a header to .ow-ph without teaching the fold about it
 * would DELETE that paragraph from the app -- silently, seven times
 * over. And three of those seven paragraphs are not decoration:
 *
 *   the invoice rule      how a completed quote becomes an invoice, and
 *                         that it lingers on the board for 24 hours
 *   the agent rule        that an agent's clients stay private to them
 *   the WhatsApp claim    that every number there is counted from the
 *                         shop's own records -- this app's oldest law,
 *                         stated on the screen it matters most
 *
 * So the fold learned the new header, and it folds ONLY what is marked
 * as the longer explanation. Not the one-line description beside the
 * title, which is meant to be read: Today's is the moment its figures
 * were taken at, and hiding that behind an "i" would conceal the one
 * thing on that screen that goes stale.
 *
 * Run: node test/sell-headers.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('sell headers');
const src = read('index.html');

const SELL = ['quote', 'quote-saved', 'invoices', 'customers', 'followups', 'agents', 'whatsapp'];
const sectionOf = (tab) => {
  const i = src.indexOf(`<section id="tab-${tab}"`);
  const next = src.slice(i + 10).search(/<section id="tab-/);
  return src.slice(i, next < 0 ? undefined : i + 10 + next);
};

/* ---------- 1. the fold learned the new header ---------- */
{
  const fn = extractFunction(src, 'foldPageInstructions', 'index.html');
  t.check(/querySelectorAll\('\.page-head, \.ow-ph'\)/.test(fn),
    'the fold walks both header shapes, so converting one does not delete its explanation');
  t.check(/head\.classList\.contains\('ow-ph'\)/.test(fn),
    'and tells them apart explicitly');
  t.check(/querySelector\(':scope > p\.ow-ph-help'\)/.test(fn),
    'folding only what is MARKED as the longer explanation');
  t.check(/querySelector\(':scope > p'\)/.test(fn),
    'while the old shape still folds its whole paragraph, as it always did');

  /* The line that decides Today. Its sub is the moment the figures were
     read at; a fold that took any <p> would put that behind an "i". */
  const today = sectionOf('dashboard');
  t.check(/<p class="ow-ph-sub" id="dash_asof">/.test(today),
    'Today\'s one-liner is a sub, not a help — it is the reading time, and it must stay on screen');
  t.check(!/ow-ph-help/.test(today), 'and Today has no folded help at all');

  t.check(/foldInstruction\(h1, p, 'What this screen is for'\)/.test(fn),
    'and both shapes go through the one folding function rather than growing a second');
}

/* ---------- 2. every Sell screen wears the console header ---------- */
{
  SELL.forEach(tab => {
    const sec = sectionOf(tab);
    t.check(/<div class="ow-ph">/.test(sec), `${tab} has the console header`);
    t.check(!/<div class="page-head"/.test(sec), `${tab} has no old header left behind`);
    t.check(/<h1 class="ow-ph-t">/.test(sec), `${tab} names itself in it`);
    t.check(/<p class="ow-ph-sub">/.test(sec), `${tab} says in one line what it is`);
    t.check(/<span class="ow-ph-sp"><\/span>/.test(sec),
      `${tab} carries the spacer, so anything on the right sits on the right`);
  });
}

/* ---------- 3. the rules in the old prose survived ---------- */
{
  const kept = [
    ['invoices', 'stays visible on the Order tracking board for 24 hours',
      'how a quote becomes an invoice, and how long it lingers'],
    ['agents', "clients' identities stay private to them",
      "the agent privacy rule"],
    ['whatsapp', "counted live from the shop's own records",
      'the derived-never-invented claim, on the screen that most needs it'],
    ['quote', 'shows the cheapest supplier and a suggested price',
      'what each line of a quote is telling you'],
    ['quote-saved', 'how it got here',
      'what opening a row shows, which nobody would guess from the table'],
    /* Follow-ups moved up from the list below. It was one line because
       there was one thing to say -- "clients who asked to be kept
       posted". The screen now has a rule worth stating and no room in a
       header for it: ONE MESSAGE PER CLIENT however many things they are
       waiting for, and the four kinds of news that put somebody in the
       queue at all. That is not the sub repeating itself, which is the
       only thing the rule below was guarding against. */
    ['followups', 'One message per client',
      'the rule the whole queue is built on, which will not fit a header line'],
  ];
  kept.forEach(([tab, needle, why]) => {
    const sec = sectionOf(tab);
    t.check(sec.includes(needle), `${tab} keeps ${why}`);
    const help = (/<p class="ow-ph-help">([\s\S]*?)<\/p>/.exec(sec) || ['', ''])[1];
    t.check(help.includes(needle), `and it is behind the "i" rather than loose on the page`);
  });

  /* The rule this list held is unchanged and still worth having: a
     bubble holding the same sentence as the line beside it is a bubble
     worth nothing. It is asserted from the other side now -- every
     screen that HAS a bubble must say something its sub does not -- so
     that it keeps biting with the list empty. */
  kept.forEach(([tab, needle]) => {
    const sec = sectionOf(tab);
    const sub = (/<p class="ow-ph-sub">([\s\S]*?)<\/p>/.exec(sec) || ['', ''])[1];
    t.check(!sub.includes(needle),
      `${tab}'s bubble says something the line beside it does not`);
  });
}

/* ---------- 4. the header pays for its own space ---------- */
{
  /* Today paid for it on its stack and the Manager on its grid, which
     meant every screen converted afterwards had to remember. Seven at
     once is exactly where that goes wrong. */
  t.check(/\.ow-ph\{[\s\S]{0,240}?margin-bottom:var\(--ow-sp-16\)/.test(src),
    'the gap under the header belongs to the header');
  t.check(!/\.ow-rec\{[^}]*padding-top/.test(src),
    'so the Manager\'s record no longer adds its own');
  t.check(!/class="ow-stack" style="padding-top/.test(src),
    'and neither does Today\'s stack');
}

process.exit(t.done() ? 1 : 0);
