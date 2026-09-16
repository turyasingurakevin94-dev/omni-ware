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

/* QUOTE IS NOT ON THIS LIST ANY MORE, and that is the redesign rather
   than a gap. This file holds the SELL screens to the console header --
   .ow-ph, its title, its one-line sub, its spacer and the "i" that folds
   the longer explanation. Quote has been rebuilt on the card system,
   whose title block is a 24px name over one 13px line and has no "i" at
   all: what the paragraph used to explain is said by the screen itself
   now, per line, in the Cheaper-elsewhere card and the price on the row.
   
   A screen may be on one system or the other, never half of each, so
   quote leaves this list and joins the check below it. The rest of Sell
   is still the console's and is still held to it. */
/* INVOICES LEAVES THIS LIST TOO, for the same reason quote did and on the
   same terms. Its register is the card system's now -- a 58px top bar, the
   24px name over one 13px line, the lens group beside it -- so it cannot
   carry .ow-ph as well. A screen is on one system or the other, never half
   of each.

   What the folded paragraph explained is not simply gone. Void and undo
   invoice are two different acts and the difference is spelled out where
   the acts are, on the overflow menu's items. How an invoice gets here,
   including the 24 hours it lingers on the Order tracking board, is said
   by the empty state -- which is the moment somebody is actually asking.
   That is checked below rather than taken on trust. */
/* Customers joins them, and it absorbed a screen on the way: Debtors is
   its Owing lens now. The folded paragraph went the way Invoices' did --
   what it explained is said by the screen, per row. The two facts worth
   keeping are checked below rather than taken on trust. */
/* Sales agents joins them. Its folded paragraph explained the four
   prices an order line carries and which of the three profits is whose;
   the screen says that now where it matters -- the standing chip on the
   register, and the waterfall on the panel, which draws all five figures
   on one denominator so two equal bars always mean equal money. */
/* And Messages, which is the last of Sell to go and took two screens
   with it. Follow-ups and WhatsApp were never usable apart: Follow-ups
   is the list of people the shop owes a word, already tagged with a
   reason, and its only action was to open the box; WhatsApp is the box,
   and its only content came from that list. They were two console
   headers over one job. There is one screen now, on the card system,
   so both leave this list.

   THREE PARAGRAPHS DIED IN THAT MERGE and none of them is simply gone.
   Each is checked below at the address it moved to, which is the whole
   point of this file:

     the WhatsApp claim   every figure counted live from the shop's own
                          records, and nothing sent until you press send
                          -- this app's oldest two laws, now a footnote
                          under the desk they govern
     who is waiting       the live headline, still written by the render
                          and still unfoldable, at the top of the lens
                          that holds the inbox
     one message per      the rule the queue is built on, on the queue
     client               itself rather than behind an "i" */
const SELL = ['quote-saved'];
const CARD_SYSTEM = ['quote', 'invoices', 'customers', 'agents', 'messages'];
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
  /* ALL of them, not the first. foldInstruction has always taken a list
     -- the price form folds three notes into one bubble -- so the only
     thing that changed is the count. Follow-ups absorbed a screen's
     worth of argument, and one run-on paragraph is not a way to read it;
     every other console header carries exactly one, so this is a no-op
     for them. Still only what is MARKED, which is the claim. */
  t.check(/querySelectorAll\(':scope > p\.ow-ph-help'\)/.test(fn),
    'folding only what is MARKED as the longer explanation');
  t.check(/querySelector\(':scope > p'\)/.test(fn),
    'while the old shape still folds its whole paragraph, as it always did');

  /* The line that decides Today. Its sub is the moment the figures were
     read at; a fold that took any <p> would put that behind an "i". */
  const today = sectionOf('dashboard');
  t.check(/<p class="ow-ph-sub" id="dash_asof">/.test(today),
    'Today\'s one-liner is a sub, not a help — it is the reading time, and it must stay on screen');
  /* Same rule, same reason, at its new address. "The shop's online
     front desk" was as true of an empty inbox as of nine unanswered
     customers, so that line was replaced by who is waiting and how long
     the worst of them has waited -- the one fact on that desk that
     rots. It cannot be a .ow-ph-sub any more because there is no
     .ow-ph: Messages is a card screen. What made the old assertion
     worth having survives intact, and is the whole of what is checked
     -- the line is WRITTEN BY THE RENDER, it sits above the work rather
     than inside a panel that can scroll away, and no fold can reach it,
     because the card system has no "i" to fold anything behind. */
  const wa = sectionOf('messages');
  t.check(/<div class="om-subhead">[\s\S]{0,400}?id="wa_ph_sub"/.test(wa),
    'and WhatsApp\'s is who is waiting — a fact that goes stale, so it never folds');
  t.check(/function waRenderHeadline\(\)\{\s*\n\s*const el = document\.getElementById\('wa_ph_sub'\);/.test(src),
    'and it is still written every render, not typed into the page once');
  /* The act that went with it. No panel below can offer this one: the
     panes are queues, and an answered chat has left them. */
  t.check(/id="wa_find_btn"/.test(wa) && /getElementById\('wa_find_btn'\)\.addEventListener/.test(src),
    'and the search that reaches every chat, answered or not, came across with it — still bound');
  t.check(!/ow-ph-help/.test(today), 'and Today has no folded help at all');

  t.check(/foldInstruction\(h1, p, 'What this screen is for'\)/.test(fn),
    'and both shapes go through the one folding function rather than growing a second');
}

/* ---------- 2. every Sell screen wears the console header ---------- */
{
  SELL.forEach(tab => {
    const sec = sectionOf(tab);
    /* An id on the header itself is allowed, on the same grounds the
       sub's id is two lines below: Customers renders two views into one
       section -- the book and one customer's account -- and the book's
       header is hidden by id while the account is open. What matters is
       that the screen wears .ow-ph, not that nothing else is on the tag. */
    t.check(/<div class="ow-ph"[ >]/.test(sec), `${tab} has the console header`);
    t.check(!/<div class="page-head"/.test(sec), `${tab} has no old header left behind`);
    t.check(/<h1 class="ow-ph-t">/.test(sec), `${tab} names itself in it`);
    /* An id on the sub is allowed, and on two screens it is required:
       Today's is the moment the figures were read at, and WhatsApp's is
       how many people are waiting and how long the worst of them has
       waited. Both go stale, so both are written by the render. */
    t.check(/<p class="ow-ph-sub"[ >]/.test(sec), `${tab} says in one line what it is`);
    t.check(/<span class="ow-ph-sp"><\/span>/.test(sec),
      `${tab} carries the spacer, so anything on the right sits on the right`);
  });
}

/* ---------- 2b. the converted screens carry the other system ---------- */
{
  CARD_SYSTEM.forEach((tab) => {
    const sec = sectionOf(tab);
    t.check(/<div class="om-qtitle">/.test(sec), `${tab} has the card system's title block`);
    /* An id on the title or its sub is allowed, on the same grounds the
       console header's sub carries one two blocks above: a line the
       RENDER writes needs a handle. Messages needs both, because Posting
       is a different question from the queue -- "What to post today", not
       "Messages" -- and a screen whose name does not follow its lens is a
       screen that has not noticed which one it is on. What is asserted is
       unchanged: the screen names itself in the card system's title block
       and says in one line what it is. */
    t.check(/<(?:h1|div) class="om-qtitle-t"[ >]/.test(sec), `${tab} names itself in it`);
    t.check(/<(?:p|div) class="om-qtitle-s"[ >]/.test(sec), `${tab} says in one line what it is`);
    /* And it is NOT wearing both. A screen carrying the console header
       and the card title block would draw two names, one above the
       other, which is what a half-finished conversion looks like. */
    t.check(!/<div class="ow-ph">/.test(sec),
      `${tab} does not also carry the console header — a screen is on one system or the other`);
    t.check(!/ow-ph-help/.test(sec),
      `and has no "i" bubble: the card system explains per line, not in a folded paragraph`);
  });
}

/* AGENTS' privacy rule, at its new address. The folded paragraph said
   "clients' identities stay private to them"; the screen says it where
   somebody is actually deciding whether to invite one, and says it as the
   consequence rather than the policy: you see the order, never the buyer.
   That is the same rule in the words that make it actionable. */
{
  const ag = extractFunction(src, 'renderAgents', 'index.html');
  t.check(/Their clients stay private to them &mdash; you see the order, never the buyer/.test(ag),
    'agents keeps the agent privacy rule, on the screen that has not started yet');
}

/* MESSAGES' THREE, at their new addresses. Two of them are this app's
   oldest laws and the third is the rule its queue is built on, so none
   of the three is a paragraph anybody may quietly drop on the way to a
   new layout. */
{
  const msg = sectionOf('messages');
  t.check(/Every figure on this desk is counted live from the shop&rsquo;s own records/.test(msg),
    'messages keeps the derived-never-invented claim, on the screen that most needs it');
  t.check(/nothing leaves the shop until you press send/.test(msg),
    'and nothing-sends-itself with it, in the same breath it always was');
  /* ON THE QUEUE, not behind an "i". It was one paragraph of a folded
     block on the screen this one replaced, which meant the rule the
     whole queue obeys was readable only by somebody who already
     suspected it. */
  t.check(/One message per client, however many things they are waiting for/.test(msg),
    'and the rule the whole queue is built on, said on the queue');
  t.check(/grouped = groupByCustomer|groupBy|customerId/.test(extractFunction(src, 'followUpHubRows', 'index.html')),
    'which is a description of what the builder actually does, not a promise on top of it');
}

/* Invoices' two facts, checked at their new addresses rather than in a
   paragraph the card system does not have. */
{
  const inv = extractFunction(src, 'renderInvoices', 'index.html');
  t.check(/stays visible on the Order tracking board for 24 hours/.test(inv),
    'invoices keeps how a quote becomes an invoice, and how long it lingers — in the empty state, where it is asked');
  const side = extractFunction(src, 'renderInvoiceSide', 'index.html');
  t.check(/cancels the paper; the goods went, and money already received stays in the Cash Book/.test(side)
       && /puts the stock, the payments and their Cash Book entries back/.test(side),
    'and keeps void and undo as two different acts, said where the acts are');
}

/* ---------- 3. the rules in the old prose survived ---------- */
{
  const kept = [


    ['quote-saved', 'how it got here',
      'what opening a row shows, which nobody would guess from the table'],
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
