#!/usr/bin/env node
'use strict';
/*
 * The shape of the agent's quote screen.
 *
 * The alternative considered was Items / Client / Delivery as tabs.
 * Measured at 375x812 the whole screen is 752px with one item and 886px
 * with four, so tabs would have added navigation to something that barely
 * scrolls. And they would have hidden what Submit requires: pressed on a
 * Delivery tab with no client chosen, the complaint is about a tab you
 * cannot see.
 *
 * So the sections FOLD instead. The distinction that makes folding worth
 * doing rather than tabbing is that a shut section still shows its
 * answer -- "Dickson Muwanga", "Shop delivers, Plot 12" -- so everything
 * Submit needs stays readable from one screen. A fold that hid its answer
 * would be a tab with extra steps.
 *
 * And Submit is pinned, which is what actually helps the long-quote case:
 * on a 25-line quote the scrolling is through the agent's own items, and
 * no tab arrangement would shorten that.
 *
 * Run: node test/agent-quote-layout.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('agent quote layout');
const src = read('agent.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const sums = (new Function(
  extractFunction(src, 'quoteFoldSummaries', 'agent.html') + '\nreturn quoteFoldSummaries;'))();

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. a shut section still answers its own question --------- */
{
  eq(sums({ name: 'Dickson Muwanga' }, 'agent_pickup', '').client, 'Dickson Muwanga',
    'the client section names the client while shut');
  eq(sums(null, 'agent_pickup', '').client, null,
    'and says nothing rather than something, when there is nobody yet');
  eq(sums({ name: '   ' }, 'agent_pickup', '').client, null,
    'a name of only spaces is no name');

  eq(sums(null, 'agent_pickup', '').delivery, "I'll pick it up myself",
    'collecting it yourself is a complete answer on its own');

  /* For a shop delivery the ADDRESS is the answer. "Shop delivers" alone
     would leave the one thing that can still block the send out of
     sight -- which is the trap tabs would have set everywhere. */
  eq(sums(null, 'shop_delivery', 'Plot 12, Ntinda Road').delivery, 'Shop delivers · Plot 12, Ntinda Road',
    'a shop delivery reads as the address it is going to');
  eq(sums(null, 'shop_delivery', '').delivery, null,
    'and counts as unanswered until there is one, since the send needs it');
  eq(sums(null, 'shop_delivery', '   ').delivery, null, 'spaces being no address');
}

/* ---------- 2. open when it still needs something -------------------- */
{
  const fn = extractFunction(src, 'renderQuoteFolds', 'agent.html');
  t.check(/if\(!card\.dataset\.touched\) card\.classList\.toggle\('open', !answer\);/.test(fn),
    'a section starts open while unanswered and shuts once answered');
  /* Without this a fold would spring back open under the finger that had
     just shut it. */
  t.check(/card\.dataset\.touched = '1';/.test(code),
    'and stays where it is put once it has been opened or shut by hand');
  t.check(/ans\.textContent = answer \|\| prompt;/.test(fn)
    && /ans\.classList\.toggle\('empty', !answer\);/.test(fn),
    'an unanswered section shows a prompt, styled apart from a real answer');
  t.check(/Choose a client/.test(fn) && /How does it get there\?/.test(fn),
    'and the prompt asks for what is missing');

  // Kept current by everything that could change either answer.
  ['renderCartTab'].forEach((f) => {
    t.check(/renderQuoteFolds\(\);/.test(extractFunction(src, f, 'agent.html')),
      `${f} refreshes the summaries`);
  });
  /* Named individually rather than counted: a count is satisfied while
     any one of them quietly stops, and the summary going stale is the one
     way a fold turns back into a tab — showing an answer that is no
     longer true is worse than showing none. */
  t.check(/document\.getElementById\('ag_delivery_address'\)\.addEventListener\('input', \(\)=>\{ saveQuoteDraft\(\); renderQuoteFolds\(\); \}\);/.test(code),
    'typing an address updates what the shut section says');
  t.check(/saveQuoteDraft\(\);\s*\r?\n\s*renderQuoteFolds\(\);\s*\r?\n\s*\}\);\s*\r?\n\}\);/.test(code),
    'and so does switching between collecting it and having it delivered');
  t.check((code.match(/renderQuoteFolds\(\)/g) || []).length >= 5,
    'along with choosing a client and clearing one');
}

/* ---------- 3. Submit is pinned, and honest about the figure --------- */
{
  t.check(/\.ag-submit-bar\{[^}]*position:sticky/.test(src),
    'the submit bar is pinned rather than sitting at the end of the scroll');
  t.check(/\.ag-submit-bar\{[^}]*env\(safe-area-inset-bottom\)/.test(src),
    'clearing the home indicator on a phone that has one');
  t.check(/id="ag_submitBarTotal"/.test(src), 'and carries the total, so pressing it is not blind');

  /* One figure, set in one place. Two totals that could disagree about
     what is being sent is worse than no total at all. */
  const cart = extractFunction(src, 'renderCart', 'agent.html');
  t.check(/document\.getElementById\('ag_cartTotalValue'\)\.textContent = fmtUGX\(total\);\s*\r?\n[\s\S]{0,220}?bar\.textContent = fmtUGX\(total\);/.test(cart),
    'the pinned total is set from the same line as the card total');
  t.check((code.match(/ag_submitBarTotal/g) || []).length >= 3,
    'and is kept in step where the rate is edited in place, too');

  // Only one Submit button, or two could disagree about being enabled.
  t.check((src.match(/id="ag_submit_btn"/g) || []).length === 1,
    'there is one Submit button, not one per section');
}

/* ---------- 4. what was deliberately NOT done ------------------------ */
{
  /* Pinned here so the decision is not quietly reversed by someone who
     did not see the measurements. */
  t.check(/Items \/ Client \/ Delivery as tabs/.test(src),
    'the tabs alternative and the reason against it are recorded in the stylesheet');
  t.check(/hide what Submit requires/.test(src),
    'naming the reason, which is that a tab hides the thing that blocks the send');
  // The Items card keeps its own toggle: two readings of one thing, which
  // is what a toggle is genuinely for.
  t.check(/id="ag_quoteview_yours_btn"/.test(src) && /id="ag_quoteview_client_btn"/.test(src),
    'and the Your view / Client view toggle inside Items is untouched');
}

process.exit(t.done() ? 1 : 0);
