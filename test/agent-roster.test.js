#!/usr/bin/env node
'use strict';
/*
 * The sales agent roster.
 *
 * IT WAS A CONTACT LIST. Name, id, phone, email, and a payment-terms
 * dropdown -- identical for every agent. Verified on the running app with
 * four of them: the agent who had brought in 2,800,000 and was sitting on
 * 2,500,000 of unpaid stock rendered byte for byte the same as the one
 * who had brought 150,000 and last sold in February. Sorted by name, so a
 * dead invite that had never sold anything sat above both.
 *
 * The screen exists for four decisions and could answer none of them: is
 * this agent selling, are we exposed to them, when did they last do
 * anything, and should they be allowed to take goods before paying.
 *
 * "MARK INACTIVE" DID NOTHING. `unavailable` was written to the agents
 * table by this roster and read by NOTHING -- not current_agent_id(), not
 * agent-submit-order, not agent.html. It greyed a card in the admin's own
 * browser while the agent went on signing in and placing orders. And it
 * sat next to Retire, which really does close everything, looking like
 * the gentler version of it.
 *
 * PAYMENT TERMS WAS A CREDIT DECISION MADE FROM A BARE DROPDOWN.
 * "Pay on delivery" means stock leaves the building before any money
 * arrives. It was changed with no sight of what that agent already owed
 * -- a figure that was on no screen at all -- and confirmed with a toast
 * reading "payment terms updated", the same sentence in either direction.
 *
 * Run: node test/agent-roster.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent roster');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const submitSrc = read('supabase/functions/agent-submit-order/index.ts');

const TODAY = '2026-08-05';
const data = { savedQuotes: [], agents: [], customers: [] };
const NAMES = ['agentOrders', 'agentStanding', 'agentRosterPosition', 'agentPhantomCustomer',
  'agentLinePriced', 'orderEarnings', 'agentTermConsequence',
  'savedQuoteTotal', 'quoteItemSellPrice', 'invoiceBalanceDue', 'daysSinceDate'];
let scope = null; let err = null;
try {
  scope = compileScope([
    ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
    extractDeclaration(src, 'AGENT_IDLE_DAYS', 'index.html'),
  ], { data, todayISO: () => TODAY }, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the roster helpers compile${err ? ` (${err.message})` : ''}`);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
/* THE CARD BECAME A ROW, AND THE ROW OPENS.
 *
 * agentCardHTML built one card in a grid of equal cards, and that grid
 * was the fault: the agent holding 2,500,000 of the shop's stock and the
 * one who has never sold anything rendered at the same size, in cards of
 * different heights, so the careful sort below could not be seen at all.
 *
 * It is now agentRowHTML -- a row in a table whose figure columns line
 * up, and which .ow-tbl turns back into a card on a phone from the SAME
 * call, so the two can never say different things. What does not fit a
 * row -- the case for the figure, the invoices behind it, the credit
 * decision and the two acts -- moved into agentOpenHTML, which the row
 * opens in place and which the queue at the top of the screen renders
 * from the same builder.
 *
 * So the checks below are split by where the thing genuinely lives now,
 * and `card` is kept as the name for both halves together: every
 * assertion that was true of the card is still asserted, none is
 * dropped. */
const row = (/function agentRowHTML\(a\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const body = (/function agentOpenHTML\(a, s\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const card = row + body;
const render = (/function renderAgents\(filter=''\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const posHTML = (/function agentRosterPositionHTML\(\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const retire = (/function retireAgent\(id\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
const pause = (/function toggleAgentAvailability\(id\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];

const agent = (id, over) => Object.assign({ id, name: id, phone: '', location: 'Ntinda',
  paymentTerm: 'prepay', unavailable: false, retiredAt: null }, over || {});
// One line, so the order total is whatever `total` says.
const order = (id, agentId, total, agentPrice, paid, status, date, over) => Object.assign({
  id, status, invoiced: status === 'completed', invoicedAt: date, date,
  client: { name: agentId }, originAgentId: agentId,
  items: [{ qty: 1, sellPrice: total, agentSellPrice: agentPrice }],
  amountPaid: paid, voided: false,
}, over || {});

/* ---------- 1. where one agent stands -------------------------------- */
if (scope) {
  data.agents = [agent('AG001')];
  data.savedQuotes = [
    order(1, 'AG001', 1200000, 1350000, 1200000, 'completed', '2026-07-28'),
    order(2, 'AG001', 800000, 900000, 800000, 'completed', '2026-08-01'),
    order(3, 'AG001', 450000, 500000, 0, 'preparing', '2026-08-04'),
    // Somebody else's, and a voided one of theirs. Neither is their money.
    order(4, 'AG002', 9000000, 9900000, 0, 'completed', '2026-08-03'),
    order(5, 'AG001', 7000000, 7700000, 0, 'completed', '2026-08-02', { voided: true }),
  ];
  const s = scope.agentStanding(data.agents[0]);
  eq(s.orders, 3, 'their orders are theirs alone, and a voided one is nobody\'s');
  eq(s.revenue, 2000000, 'what the shop earned is counted at the shop\'s own prices, over completed orders');
  eq(s.live, 1, 'and an order still in progress is counted apart from one that has landed');
  eq(s.earned, 250000, 'what the AGENT made is their margin over those prices, not the shop\'s money');
  eq(s.lastAt, '2026-08-04', 'the last thing they did is the latest of everything, not only what completed');
  eq(s.idleDays, 1, 'said as an age, from the same arithmetic every other list ages by');

  /* THE NUMBER THE SCREEN EXISTS FOR. Unpaid on their invoiced orders,
     from invoiceBalanceDue -- the same arithmetic the Invoices screen
     uses, so the two cannot disagree about one order. */
  data.savedQuotes.push(order(6, 'AG001', 2500000, 2900000, 500000, 'completed', '2026-06-02'));
  eq(scope.agentStanding(data.agents[0]).owed, 2000000, 'what they still owe is what is unpaid on the orders they have taken');
  /* AN OVERPAID ORDER. Nothing clamps a payment to the balance due, so
     paid can exceed the total -- and the difference between reading
     invoiceBalanceDue (clamped) and subtracting here (not) is invisible
     until it happens. Unclamped, one agent's overpayment quietly cancels
     what they owe on another order and the roster under-reports the
     shop's exposure. */
  data.savedQuotes.push(order(7, 'AG001', 400000, 450000, 900000, 'completed', '2026-06-10'));
  eq(scope.agentStanding(data.agents[0]).owed, 2000000,
    'and an order they overpaid does not cancel out what they owe elsewhere');
  data.savedQuotes = data.savedQuotes.filter((q) => q.id !== 7);
  /* An order not yet invoiced is not yet owed -- the goods have not been
     billed for. Counting it would report exposure the shop does not have. */
  eq(scope.agentStanding(data.agents[0]).live, 1, 'while an order still being prepared is not money owed');
}

/* ---------- 2. never sold is not sold long ago ----------------------- *
 * One is an invite that never took, the other is a working relationship
 * going cold. They need different conversations, and a raw 0 or a raw ''
 * makes them the same row.
 */
if (scope) {
  data.agents = [agent('NEW')];
  data.savedQuotes = [];
  const s = scope.agentStanding(data.agents[0]);
  eq(s.idleDays, null, 'an agent who has never sold has no age, rather than an age of zero');
  eq(s.lastAt, null, 'and no last date invented for them');
  eq(s.revenue, 0, 'while the money really is nothing');
  /* The distinction survives the move to a row: the Last order cell
     prints "never" for one and an age for the other, and the open body
     says in words that a dead invite and a relationship going cold are
     different conversations. */
  t.check(/const never = s\.idleDays == null;/.test(card) && /never \? 'never'/.test(card),
    'and the row says which of the two it is');
  t.check(/They have never placed an order/.test(card),
    'in words as well, where there is room for them');
  t.check(/esc\(agingDaysLabel\(s\.idleDays\)\) \+ \(s\.idleDays===0\?'':' ago'\)/.test(card),
    'against a plain age for somebody who has sold');
}

/* ---------- 3. the roster at a glance -------------------------------- */
if (scope) {
  data.agents = [agent('SELLING'), agent('QUIET'), agent('NEVER'),
    agent('CREDIT', { paymentTerm: 'pay_on_delivery' }),
    agent('GONE', { retiredAt: '2026-05-01T00:00:00Z' })];
  data.savedQuotes = [
    order(1, 'SELLING', 1000000, 1100000, 1000000, 'completed', '2026-08-01'),
    order(2, 'QUIET', 500000, 550000, 500000, 'completed', '2026-01-01'),
    order(3, 'CREDIT', 2000000, 2200000, 0, 'completed', '2026-07-20'),
    order(4, 'GONE', 9000000, 9900000, 0, 'completed', '2026-04-01'),
    /* An agent on PREPAY who is also owing. Without one, every shilling
       outstanding happens to be on credit terms and the split is
       unprovable -- the two figures agree by accident of the fixture. */
    order(5, 'QUIET', 300000, 330000, 0, 'completed', '2026-01-05'),
  ];
  const p = scope.agentRosterPosition();
  eq(p.total, 4, 'a retired agent is not on the roster the position describes');
  eq(p.selling, 2, 'and it counts who has actually sold recently, not how many were invited');
  eq(p.neverSold, 1, 'keeping the ones who never started');
  eq(p.goneQuiet, 1, 'apart from the ones who stopped');
  eq(p.owed, 2300000, 'with the whole exposure totalled');
  /* Exposure that exists BECAUSE of a decision somebody made here, split
     out from the rest: it is the part the shop chose to take on. */
  eq(p.owedOnCredit, 2000000, 'and the part of it that is out on credit terms named separately');
  eq(p.onCredit, 1, 'along with how many agents are on those terms');

  t.check(/const p = agentRosterPosition\(\);/.test(posHTML), 'the header is drawn from it');
  t.check(/sold in the last \$\{AGENT_IDLE_DAYS\} days/.test(posHTML),
    'saying how many of the roster is actually working');
  /* It used to be a follow-on line under a total: "X of that is with the
     N agents who take goods before paying". Out on trust is now the
     FIRST tile of the strip and the leading figure on the screen, so the
     sentence is that tile's own basis rather than a footnote to another
     one -- same pluralisation, same claim, no longer subordinate to a
     figure it is more important than. */
  t.check(/with the \$\{p\.onCredit\} agent\$\{p\.onCredit===1\?' who takes':'s who take'\} goods before paying/.test(posHTML),
    'and reading as English for one agent as well as several');
}

/* ---------- 4. the roster is ordered by what needs doing -------------- */
{
  t.check(/if\(!!a\.retiredAt !== !!b\.retiredAt\) return a\.retiredAt \? 1 : -1;/.test(render),
    'retired agents sink below the working roster');
  t.check(/if\(sa\.owed !== sb\.owed\) return sb\.owed - sa\.owed;/.test(render),
    'and above that line the agent holding the most of the shop\'s money comes first');
  /* Never sold has no position on a recency axis. Left as a raw '' it
     sorted as the OLDEST date there is, putting dead invites among the
     agents who have gone quiet -- which is the one distinction the
     position header exists to draw. */
  t.check(/if\(\(sa\.lastAt == null\) !== \(sb\.lastAt == null\)\) return sa\.lastAt == null \? 1 : -1;/.test(render),
    'an agent with no history sorts below everyone who has one, whichever way the rest points');
  t.check(!/\.sort\(\(a,b\)=>\s*\(!!a\.retiredAt - !!b\.retiredAt\) \|\| a\.name\.localeCompare\(b\.name\)\)/.test(code),
    'and the plain alphabetical order, which put a dead invite above an agent owing millions, is gone');
}

/* ---------- 5. letting an agent take goods before paying -------------- *
 * The one genuine decision on this screen, made from a dropdown that
 * said nothing.
 */
if (scope) {
  eq(scope.agentTermConsequence('pay_on_delivery').cls, 'warn', 'credit terms are marked as the risk they are');
  t.check(/Goods leave the shop before any money arrives/.test(scope.agentTermConsequence('pay_on_delivery').text),
    'and said in terms of what physically happens');
  eq(scope.agentTermConsequence('prepay').cls, 'ok', 'while paying first is the safe one');
  t.check(/cannot be prepared until the money is in/.test(scope.agentTermConsequence('prepay').text),
    'described by what it stops');

  t.check(/if\(sel\.value === 'pay_on_delivery' && prior !== 'pay_on_delivery'\)\{/.test(render),
    'the question is asked when the terms are LOOSENED');
  /* Tightening needs no confirmation -- there is nothing to warn about
     in asking somebody to pay first, and a question there would train
     people to dismiss the one that matters. */
  t.check(/sel\.value = prior; return;/.test(render), 'and declining puts the dropdown back rather than leaving it lying');
  t.check(/s\.owed > 0 \? `\\n\\nThey already owe \$\{fmtUGX\(Math\.round\(s\.owed\)\)\}\.`/.test(render),
    'with what they already owe named, since that is the figure the answer turns on');
  t.check(/s\.idleDays == null \? '\\n\\nThey have never sold anything yet\.'/.test(render),
    'and an agent who has never sold flagged, because that is the other way this goes wrong');
  /* The toast said "payment terms updated" for both directions. */
  t.check(/can now take goods before paying/.test(render) && /must now pay before anything is prepared/.test(render),
    'and the confirmation says which way it went');
}

/* ---------- 6. pausing an agent actually stops them ------------------- *
 * The flag was written here and read nowhere. An admin who wanted to stop
 * somebody short of the permanent option got a grey card and an agent who
 * carried on trading.
 */
{
  t.check(/if \(agent\.unavailable\) \{/.test(submitSrc),
    'a paused agent\'s order is refused by the server, not merely greyed in the admin browser');
  t.check(/paused: true/.test(submitSrc) && /403/.test(submitSrc),
    'as a refusal the agent app can recognise');
  t.check(/Talk to the shop before placing new orders/.test(submitSrc),
    'telling them what to do rather than that something failed');
  /* Deliberately NOT in current_agent_id(): that is what every
     agent-scoped policy resolves through, so failing it closes their
     clients, goals, catalogues and history at once -- which is
     retirement, and retirement already does it. */
  t.check(/current_agent_id/.test(submitSrc.slice(0, submitSrc.indexOf('if (agent.unavailable)'))),
    'while retirement stays where it closes everything at once');

  t.check(/keep their clients and history but cannot place new orders/.test(pause),
    'and the roster says what a pause does');
  t.check(/can sell again/.test(pause), 'and what lifting it does');
  t.check(/Pause — they keep their clients and history but cannot place new orders/.test(card)
    && /Retire — permanent/.test(card),
  'with the two buttons no longer reading as degrees of one thing');
}

/* ---------- 7. retiring somebody who owes you money ------------------- */
{
  /* Not refused -- an agent who has stopped paying is a reason TO retire
     them. But retiring closes their access, and the balance stays owed by
     somebody who can no longer sign in to settle it. */
  t.check(/const s = agentStanding\(a\);/.test(retire), 'retiring looks at where they stand first');
  t.check(/THEY STILL OWE \$\{fmtUGX\(Math\.round\(s\.owed\)\)\}/.test(retire),
    'and names what is outstanding at the moment of the decision');
  t.check(/Retiring does not collect it, and they will not be able to sign in to settle it/.test(retire),
    'saying what retiring does not do');
  t.check(/s\.live > 0 \?/.test(retire), 'and flags orders still in progress');
  t.check(/\)\) return;/.test(retire), 'while declining retires nobody');
}

/* ---------- 8. where the money actually sits -------------------------- *
 * Invoicing an agent order runs through resolveInvoiceCustomer(), which
 * matches on the name on the order -- the AGENT's name -- finds no
 * customer, and CREATES one. Verified on the running app: one unpaid
 * agent order produced "Joan Akello, debt 2,500,000, location ''", who
 * then appeared in the Debtors list among the shop's retail customers.
 */
if (scope) {
  data.agents = [agent('AG001', { name: 'Joan Akello' })];
  data.customers = [{ id: 'C004', name: 'Joan Akello', debt: 2500000, location: '' }];
  const found = scope.agentPhantomCustomer(data.agents[0]);
  t.check(!!found && found.id === 'C004', 'the record that got made is findable from the agent it was made for');
  /* Matched EXACTLY the way resolveInvoiceCustomer matches -- trimmed and
     lowercased, and deliberately NOT collapsing inner spaces, which is
     the one thing that function does not do either. This helper's job is
     to name the record that function created, so its rule is the spec.
     Matching more loosely would claim a record that is not the one, and
     print somebody else's id on the card.

     That is the opposite call from cfNormalisedName on the customer form,
     which does collapse them -- because it asks a different question. One
     asks "is this the same person?", this asks "which row did that code
     make?". */
  t.check(!!scope.agentPhantomCustomer({ name: '  Joan Akello ' }),
    'found however the name was spaced around the outside or cased');
  t.check(scope.agentPhantomCustomer({ name: 'Joan   Akello' }) === null,
    'and not claimed on an inner-space difference, which resolveInvoiceCustomer treats as a different customer too');
  /* An unnamed customer on file is what makes the empty-key guard load
     bearing. Without one, a blank name finds nothing anyway and the
     missing guard is invisible; with one, a nameless agent claims them
     and the card prints a stranger's id beside somebody's money. */
  data.customers.push({ id: 'C009', name: '', debt: 0, location: '' });
  t.check(scope.agentPhantomCustomer({ name: '' }) === null,
    'and an unnamed agent matches nobody, even with an unnamed customer on file');
  t.check(scope.agentPhantomCustomer({ name: '   ' }) === null, 'nor does a name of only spaces');
  t.check(!!scope.agentPhantomCustomer(data.agents[0]),
    'while a real name still finds its match with that customer there');
  data.customers = data.customers.filter((c) => c.id !== 'C009');
  data.customers = [];
  t.check(scope.agentPhantomCustomer(data.agents[0]) === null, 'with nothing claimed when there is no such record');

  t.check(/also appears on <b>Debtors<\/b>, under a customer record called/.test(card),
    'and the roster says where else that money appears, rather than leaving two screens disagreeing in silence');
  t.check(/s\.owed > 0 \? agentPhantomCustomer\(a\) : null/.test(card),
    'only when there is money to explain');
}

/* ---------- 9. the card answers the four questions -------------------- */
{
  t.check(/data-l="Brought in"/.test(card) && /data-l="Owed to you"/.test(card) && /data-l="In flight"/.test(card),
    'the row leads with what they brought, what they owe and what is still moving');
  /* Money owed reads differently depending on how it came to be owed:
     unpaid on prepay terms is a hiccup, unpaid on credit terms is the
     shop's own decision coming due. */
  t.check(/s\.onCredit\?'ow-bad':'ow-warn'/.test(card),
    'with what is owed marked by how it came to be owed');
  /* It was a coloured note stacked under four others on the card. It is
     now the first sentence of the case the row opens into, which is
     where somebody deciding what to do about the money is reading. */
  t.check(/They take goods before paying, so their orders are prepared and handed over before any money arrives/.test(card),
    'and credit exposure named as exposure');
  t.check(/They made <b>\$\{money\(s\.earned\)\}<\/b> of their own on top of your prices/.test(card),
    'while the agent\'s own margin is shown as theirs, not as the shop\'s takings');
  t.check(!/<div class="sc-notes">\$\{esc\(a\.email\)\}<\/div>/.test(card),
    'and the email, which nobody was deciding anything from, is off the card');
}

process.exit(t.done() ? 1 : 0);
