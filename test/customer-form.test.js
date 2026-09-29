#!/usr/bin/env node
'use strict';
/*
 * Adding a customer.
 *
 * A customer record exists so the shop can hand over goods before being
 * paid and get the money back. Six equal boxes -- one of them a disabled
 * ID at the top -- said none of that, and three of them were wrong.
 *
 * THE OPENING BALANCE WAS DATED TODAY. The Debtors list ages every
 * balance from the date on its oldest open charge, and this form wrote
 * todayISO(). So a shop moving its book into the app on day one had
 * every balance, however old, land in "Under 30 days" -- the aging
 * screen uniformly wrong on the one day it matters most. Verified on the
 * running app: 450,000 owed since March went in at ageDays 0, band b30.
 * Dated properly it is 156 days old, band b90p.
 *
 * AGING_BANDS was written knowing this could happen: "a debt typed
 * straight in ... would otherwise land in under 30 days and flatter the
 * whole profile. That is the one band it must never quietly join." This
 * form was how it joined.
 *
 * THE DEBT BOX ON THE EDIT FORM DID NOTHING. editCustomer() filled it
 * with the real balance; the save handler spread the old record and never
 * read it back. Verified: box showed 250,000, 999,999 typed over it,
 * "Customer saved", balance still 250,000, no message.
 *
 * A NEGATIVE OPENING BALANCE SAVED. -500,000, and because the ledger
 * entry is only written when the amount is above zero, it saved with an
 * EMPTY history -- a balance nothing explains, which is the precise
 * definition of the drift the app raises a banner about. The form made a
 * corrupt record from a clean screen.
 *
 * And nothing stopped the same customer being entered twice, which is
 * worse here than for a supplier: resolveInvoiceCustomer() matches by
 * lowercased name and takes the FIRST hit, so every invoice for ever
 * charges the first record while the second sits at zero.
 *
 * Run: node test/customer-form.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter, winningDeclaration } = require('./_extract');

const t = createReporter('customer form');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const TODAY = '2026-08-05';
const data = { customers: [], presetLocations: [] };
const NAMES = ['cfNormalisedName', 'cfNormalisedPhone', 'cfFindDuplicate',
  'cfOpeningBalanceCheck', 'daysSinceDate', 'agingBandFor'];
let scope = null; let err = null;
try {
  scope = compileScope([
    ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
    extractDeclaration(src, 'AGING_BANDS', 'index.html'),
  ], { data, todayISO: () => TODAY }, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the customer form helpers compile${err ? ` (${err.message})` : ''}`);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const modal = (/<div class="modal-overlay" id="customerModal">[\s\S]*?\n<\/div>\n/.exec(src) || [''])[0];
const save = (/c_save'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];

/* ---------- 1. an opening balance has an age ------------------------- *
 * The amount was never the hard part.
 */
if (scope) {
  const carried = scope.cfOpeningBalanceCheck('450000', '2026-03-02', false);
  eq(carried.amount, 450000, 'a balance carried in from before is taken');
  eq(carried.ageDays, 156, 'aged from when it actually started');
  eq(carried.band, 'b90p', 'so it lands in Over 90 days, where it belongs');
  /* THE BUG, pinned as a fixture: the identical balance dated today
     lands three bands away. Nothing about the money changed. */
  eq(scope.cfOpeningBalanceCheck('450000', TODAY, false).band, 'b30',
    'while the same figure dated today lands in Under 30 days -- which is what the form used to write for every balance in the book');
  /* The MIDDLE bands, because they are what proves the form reads
     AGING_BANDS rather than guessing. A two-way old-or-new split agrees
     with both fixtures above and gets both of these wrong. */
  eq(scope.cfOpeningBalanceCheck('450000', '2026-06-21', false).band, 'b60',
    'and one 45 days old lands in 30 to 60');
  eq(scope.cfOpeningBalanceCheck('450000', '2026-05-22', false).band, 'b90',
    'and one 75 days old in 60 to 90, off the same bands the Debtors list uses');

  eq(scope.cfOpeningBalanceCheck('', '', false).amount, 0,
    'a customer who owes nothing needs no date and is not asked for one');
  eq(scope.cfOpeningBalanceCheck('0', '', false).problem, null, 'nor does a zero');
}

/* ---------- 2. not knowing is an answer, and it has a home ----------- *
 * The app already models it. AGING_BANDS keeps an `unknown` band, "No
 * date on record", precisely so a balance nobody can age is visible as
 * one rather than hidden inside a wrong number.
 */
if (scope) {
  const u = scope.cfOpeningBalanceCheck('200000', '', true);
  eq(u.amount, 200000, 'a balance nobody can date is still taken');
  eq(u.band, 'unknown', 'and files under No date on record rather than under a guess');
  eq(u.ageDays, null, 'with no age invented for it');
  eq(u.problem, null, 'and no complaint, because it is a legitimate answer');

  /* Which is only true because the saved charge carries no date. Writing
     today's date and calling it unknown would put it back in b30. */
  t.check(/date: document\.getElementById\('c_debt_undated'\)\.checked \? '' : document\.getElementById\('c_debt_since'\)\.value/.test(save),
    'the charge is saved with the date it started, or with none at all -- never with today');
  t.check(!/date: todayISO\(\), type:'charge', amount: openingDebt, note:'Opening balance'/.test(code),
    'and never again stamped with today');
}

/* ---------- 3. what it will not write -------------------------------- */
if (scope) {
  /* Refused, not silently corrected. -500,000 saved as a balance with an
     EMPTY ledger, because the log entry was only written above zero. */
  eq(scope.cfOpeningBalanceCheck('-500000', '2026-03-02', false).problem, 'negative',
    'a debt of less than nothing is refused');
  eq(scope.cfOpeningBalanceCheck('300000', '', false).problem, 'no-date',
    'an amount with no date and no I-do-not-know is refused rather than dated today');
  eq(scope.cfOpeningBalanceCheck('300000', '2026-12-01', false).problem, 'future',
    'and a debt cannot start after today, which would clamp to an age of zero');
  eq(scope.cfOpeningBalanceCheck('abc', '2026-03-02', false).problem, 'not-a-number',
    'nor can it be something that is not a number');

  // Each refusal has to actually stop the save, not merely be computed.
  ['negative', 'not-a-number', 'future', 'no-date'].forEach((p) => {
    /* [^{}] so the match cannot run out of this block and find the NEXT
       refusal's return. With [\s\S] it did, and deleting a return left
       the check passing while the record saved anyway. */
    t.check(new RegExp(`chk\\.problem === '${p}'\\)\\{[^{}]*?return;`).test(save),
      `and the save stops on ${p} rather than writing the record`);
  });
  t.check(/A debt cannot be less than nothing/.test(save),
    'saying what is wrong in the shop\'s terms, not "invalid input"');
}

/* ---------- 4. the same person, entered twice ------------------------ *
 * Worse than for a supplier. resolveInvoiceCustomer takes the FIRST name
 * match, so the second record is never charged -- it sits at zero while
 * the money piles up on the first, and both show in the Debtors list.
 */
if (scope) {
  data.customers = [
    { id: 'C001', name: 'Sarah Namono', phone: '0700 111 222', location: 'Ntinda', debt: 0 },
    { id: 'C002', name: 'Kato Construction Ltd', phone: '', location: 'Kyaliwajjala', debt: 250000 },
  ];
  t.check(!!scope.cfFindDuplicate('Sarah Namono', '', null), 'the same name is recognised');
  t.check(!!scope.cfFindDuplicate('  sarah   NAMONO ', '', null),
    'however it was typed the second time');
  eq(scope.cfNormalisedName('  Sarah   NAMONO '), 'sarah namono',
    'because the comparison is on the name as spoken');

  /* PHONE OUTRANKS NAME, and that ordering is the point: two customers
     called Kato is ordinary in this trade, two on one number is one
     person. Name-only matching would have missed this and charged the
     wrong record for ever. */
  eq(scope.cfFindDuplicate('Completely Different Name', '0700 111 222', null).on, 'phone',
    'and a number already on file is caught even under a different name');
  eq(scope.cfFindDuplicate('Sarah Namono', '0700 999 999', null).on, 'name',
    'while a known name with a new number is still caught');
  /* The case where the ORDER decides, and the only one that proves it:
     the name points at one record and the number at another. Checking
     the name first returns Kato; the number is the stronger claim and
     has to win, because that is the record an invoice would charge. */
  data.customers[1].phone = '0782 555 666';
  const clash = scope.cfFindDuplicate('Kato Construction Ltd', '0700 111 222', null);
  eq(clash.on, 'phone', 'and when the name says one customer and the number says another, the number wins');
  eq(clash.c.id, 'C001', 'naming the record the number belongs to');
  data.customers[1].phone = '';

  /* One phone written three ways is one phone. A check defeated by
     "+256" would half-work, which is worse than not existing. */
  eq(scope.cfNormalisedPhone('+256 700 111 222'), '700111222', 'a country code is not a different phone');
  eq(scope.cfNormalisedPhone('0700 111 222'), '700111222', 'nor is a leading zero');
  eq(scope.cfNormalisedPhone('700111222'), '700111222', 'nor is neither');
  t.check(!!scope.cfFindDuplicate('New Person', '+256 700 111 222', null),
    'so the same number in another format still matches');

  /* A short or empty box is not a phone, and must match nobody -- else
     the form accuses somebody before they have typed one. */
  eq(scope.cfNormalisedPhone(''), '', 'an empty box is not a number');
  eq(scope.cfNormalisedPhone('0700'), '', 'nor is a half-typed one');
  data.customers.push({ id: 'C009', name: '', phone: '', location: '', debt: 0 });
  t.check(scope.cfFindDuplicate('', '', null) === null, 'and an empty form matches nothing');
  t.check(scope.cfFindDuplicate('   ', '  ', null) === null, 'nor does one with only spaces');
  t.check(!!scope.cfFindDuplicate('Sarah Namono', '', null),
    'while a real name still finds its match with an unnamed customer on file');
  data.customers = data.customers.filter((c) => c.id !== 'C009');

  t.check(scope.cfFindDuplicate('Sarah Namono', '0700 111 222', 'C001') === null,
    'and a customer being edited is not their own duplicate');
}

/* ---------- 5. asked, not refused ------------------------------------ *
 * Two genuinely different people CAN share a name, and a shop that means
 * it has to be able to say so.
 */
{
  t.check(/const dup = cfFindDuplicate\(name, phone, editingCustomerId, phone2\);/.test(save),
    'saving checks for one — against BOTH numbers, or a second-line duplicate slips through');
  t.check(/if\(dup && !confirm\(/.test(save) && /Add them anyway\?/.test(save),
    'and asks rather than refusing');
  t.check(/the second record would never be charged/.test(save),
    'saying what actually goes wrong, not merely that the name is taken');
  /* The two are different failures and deserve different words: a shared
     name might be two people, a shared number is one. */
  t.check(/dup\.on === 'phone'/.test(save), 'with the phone case worded as the phone case');
  t.check(/\)\) return;/.test(save), 'and saying no adds nothing');

  const panel = (/function cfRenderDuplicate\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/id="c_duplicate"/.test(modal), 'the form warns as the name is typed, before Save is pressed');
  /* Pinned on the guard, not on the words below it: an unconditional
     early return leaves every string present and unreachable. */
  t.check(/if\(!dup\)\{ el\.innerHTML = ''; return; \}/.test(panel),
    'drawn only when there IS one, and reached when there is');
  t.check(/customerOutstandingInvoices\(dup\.c\.id\)/.test(panel) && /Number\(dup\.c\.debt\)/.test(panel),
    'showing what the existing record already carries — what they owe and on how many invoices');
  t.check(/Open the one you have instead/.test(panel) && /editCustomer\(dup\.c\.id\)/.test(panel),
    'and offers to open it, which is what they meant to do');
}

/* ---------- 6. the balance is stated on edit, not typed -------------- *
 * It was typed, and thrown away. Making it work would have been the
 * wrong fix: a balance typed over its own ledger is exactly the drift
 * the app raises a banner about.
 */
{
  const owed = (/function cfShowOwed\(c\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/owe\.style\.display = c \? 'none' : '';/.test(owed)
    && /owes\.style\.display = c \? '' : 'none';/.test(owed),
  'the opening-balance box belongs to a new record only, and swaps for a statement on an existing one');
  t.check(/cannot be typed here/.test(owed), 'which says so plainly');
  t.check(/Worked out from their invoices and debt history/.test(owed), 'and says where the figure comes from');
  /* Routes to the things that legitimately move a balance, so "you
     cannot type it" is not a dead end. */
  t.check(/openCustomerDebtModal\(c\.id, type\)/.test(owed),
    'with the two ways it can legitimately be changed offered from here');
  t.check(/id="c_owes_pay"/.test(owed) && /id="c_owes_charge"/.test(owed),
    'a payment and a charge');
  /* Nothing to pay means no pay button. Offering one would invite a
     payment against a balance with no room to move -- which the debt
     ledger has been burnt by before. */
  t.check(/cf-owes clear[\s\S]{0,260}?id="c_owes_charge"/.test(owed)
    && !/cf-owes clear[\s\S]{0,260}?id="c_owes_pay"/.test(owed),
  'and a customer who owes nothing is not offered a payment to record');

  t.check(/agingBandDef\(agingBandFor\(ageDays\)\)/.test(owed),
    'the age of what they owe is read the same way the Debtors list reads it');
  t.check(/const drift = customerDebtDrift\(c\);/.test(owed)
    && /drift !== 0 \?/.test(owed) && /than its own history explains/.test(owed),
  'and a balance its own ledger cannot explain says so here too');
  /* Which way it is out. "150,000 more than its history explains" and
     "150,000 less" are different problems with different causes. */
  t.check(/\$\{drift>0\?'more':'less'\}/.test(owed), 'saying which way it is out');

  // The edit branch must not write a debt from the form at all.
  const editBranch = (/if\(editingCustomerId\)\{[\s\S]*?\n  \} else \{/.exec(save) || [''])[0];
  t.check(!/c_debt/.test(editBranch),
    'editing writes no balance from this form, so there is no box that silently does nothing');
}

/* ---------- 7. it opens on something you can type in ----------------- */
{
  t.check(!/<input id="c_id" disabled>/.test(modal),
    'the generated id is no longer a disabled box at the top');
  t.check(/<input type="hidden" id="c_id">/.test(modal) && /id="c_id_note"/.test(modal),
    'it is a footnote, which still shows it');
  t.check(modal.indexOf('id="c_name"') < modal.indexOf('id="c_id_note"'), 'and the name comes first');
  /* Both ways in. A single presence check would pass with the add path --
     the one used most -- silently broken. */
  eq((code.match(/getElementById\('c_name'\)\.focus\(\)/g) || []).length, 3,
    'with the cursor in it whether opened to add or to edit, and put back there when the name is missing');
  /* fillIssuedId resolves after a round trip, so the footnote has to be
     redrawn or it sits on "being issued" for ever. */
  t.check(/function cfShowIssuedId\(\)\{[\s\S]*?setTimeout\(show, 400\);[\s\S]*?setTimeout\(show, 1500\);/.test(code),
    'and the id footnote fills in when the id arrives, rather than sitting on "being issued"');

  /* MEASURED, not matched. Every one of these forms asserted its rule
     was present and written after the general one; both were true and
     the field still rendered at 14px, because `input[type=text]` does
     not match an <input> that declares no type. winningDeclaration
     resolves the cascade the way a browser does. */
  eq(winningDeclaration(src, 'c_name', 'font-size').value, '19px',
    'the name actually renders set apart from the fields that merely describe the person');
  eq(winningDeclaration(src, 'c_phone', 'font-size').value, '14px',
    'which only means something because those fields do not');
  eq(winningDeclaration(src, 'c_debt', 'font-size').value, '18px',
    'and the amount, the other figure that carries weight here, is raised too');
}

/* ---------- 8. what it says while being filled in -------------------- */
{
  const cons = (/function cfRenderOpeningBalance\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
  /* The date field cannot explain itself. The live band does. */
  t.check(/it joins <b>\$\{esc\(band \? band\.label : ''\)\}<\/b> on the Debtors list/.test(cons),
    'the form says which aging band this balance is about to join');
  t.check(/ages every balance from that date/.test(cons),
    'and why the date is being asked for at all');
  /* agingDaysLabel(0) is "Today", which reads as "Today old". */
  t.check(/chk\.ageDays === 0 \? 'starting today'/.test(cons),
    'said the way it would be spoken, including on the day it starts');

  const loc = (/function cfRenderLocationHint\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/cannot be put on a run/.test(loc),
    'a blank location is named as an operational gap, not an empty field');
  t.check(/will be added to your places and offered next time/.test(loc),
    'and a new place says it is about to be added, rather than doing it silently');
  t.check(/<input id="c_location" list="dl_locations"/.test(modal),
    'off the same list of places the supplier and agent forms use');
  t.check(/const location = rememberLocation\(document\.getElementById\('c_location'\)\.value\);/.test(save),
    'and what is saved goes through it, so a new place is kept and a known one settles');

  /* Credit extended to somebody with no phone number. The shop cannot
     chase what it cannot ring, and this is the moment it is decided. */
  const chase = (/function cfRenderChaseHint\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/chk\.amount > 0 && !cfNormalisedPhone/.test(chase),
    'a balance given to somebody with no phone number is flagged');
  t.check(/nobody to ring about this/.test(chase), 'in terms of what it costs the shop');
}

/* ---------- a second phone, and the duplicate check that reads it ----
 * People here carry two lines -- a personal one and a shop one, or two
 * networks against a bad signal. The second number used to go in the
 * notes, where nothing could match it.
 *
 * THE TRAP: the duplicate check compares phones, and it has to compare
 * EVERY number on the form against EVERY number on file. Checking only
 * the first pair means typing somebody's second line is met with
 * silence, and the shop creates exactly the duplicate this check exists
 * to prevent -- one where invoices charge the old record while the new
 * one sits at zero.
 */
{
  const dupNames = ['cfNormalisedName', 'cfNormalisedPhone', 'contactPhones', 'cfFindDuplicate'];
  const dupData = { customers: [] };
  const dupScope = compileScope(
    dupNames.map((n) => extractFunction(src, n, 'index.html')), { data: dupData }, dupNames);

  eq(dupScope.contactPhones({ phone: '0772111222', phone2: '0700333444' }).length, 2,
    'a record with two numbers reports two');
  eq(dupScope.contactPhones({ phone: '0772111222', phone2: '   ' }).length, 1,
    'a blank second number is not a number');
  eq(dupScope.contactPhones({}).length, 0, 'and a record with none reports none');

  dupData.customers = [{ id: 'C1', name: 'Kato', phone: '0772111222', phone2: '0700333444' }];
  t.check(!!dupScope.cfFindDuplicate('Someone Else', '0772111222', null, ''),
    'their FIRST number is recognised');
  /* The whole point: matching their second number, from either box. */
  t.check(!!dupScope.cfFindDuplicate('Someone Else', '0700333444', null, ''),
    'and so is their SECOND, typed as somebody\'s first');
  t.check(!!dupScope.cfFindDuplicate('Someone Else', '0755000000', null, '0700333444'),
    'and their second matched against a second, which is the case that used to pass silently');
  t.check(dupScope.cfFindDuplicate('Someone Else', '0755000000', null, '0788000000') === null,
    'while two genuinely new numbers are not a duplicate');
  t.check(dupScope.cfFindDuplicate('Someone Else', '', null, '') === null,
    'and no number at all matches nobody by phone');
  /* Excluding yourself still works, or editing a customer accuses them
     of being their own duplicate. */
  t.check(dupScope.cfFindDuplicate('Kato', '0772111222', 'C1', '0700333444') === null,
    'a customer is never their own duplicate');
}

/* ---------- the second number is asked for, kept and shown ---------- */
{
  const code2 = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(/id="c_phone2"/.test(src) && /id="s_phone2"/.test(src),
    'both the customer and supplier forms offer a second number');
  t.check(/const phone2 = document\.getElementById\('c_phone2'\)\.value\.trim\(\);/.test(code2),
    'the customer save reads it');
  /* BOTH branches. Found live: the edit path kept it and the create path
     did not, so a customer entered with two numbers came out with one --
     and asserting the shared fragment alone was satisfied by whichever
     branch still had it. */
  t.check(/\.\.\.data\.customers\[idx\], id, name, location, phone, phone2,/.test(code2),
    'editing keeps it on the record');
  t.check(/data\.customers\.push\(\{[\s\S]{0,40}id, name, location, phone, phone2,/.test(code2),
    'and creating a new customer keeps it too');
  t.check(/phone2: document\.getElementById\('s_phone2'\)\.value\.trim\(\),/.test(code2),
    'the supplier save keeps it too');
  t.check(/document\.getElementById\('c_phone2'\)\.value = c\.phone2 \|\| '';/.test(code2)
    && /document\.getElementById\('s_phone2'\)\.value = s\.phone2 \|\| '';/.test(code2),
    'and editing either form fills it back');

  // Both directions, or the number empties itself on the next reload.
  t.check(/phone2:c\.phone2\|\|''/.test(code2) && /phone2:c\.phone2\|\|null/.test(code2),
    'the customer number round-trips to the server, both ways');
  t.check(/phone2:s\.phone2\|\|''/.test(code2) && /phone2:s\.phone2\|\|null/.test(code2),
    'and so does the supplier one');

  /* Read through the one helper everywhere, so a number the shop can
     see on screen is a number the duplicate check and the WhatsApp
     match can see too.

     The supplier side no longer says contactPhones(s) at the point of
     drawing: the card became a register row, and the row's account
     reads every number ONCE into supplierBookRow -- through the same
     helper -- and lists them from there. So the check follows it: the
     helper is still the only source, and the account still lists all of
     them rather than the first. Asserting the old call site would have
     asked for the shape rather than the guarantee. */
  /* The customer account went the same way when it became the hero at
     the head of the account: every number is read ONCE into
     customerBookRow through the helper, and the hero lists them all from
     there. The guarantee is unchanged; only the call site moved. */
  const cusRow = extractFunction(src, 'customerBookRow', 'index.html');
  const hero = extractFunction(src, 'customerHeroHTML', 'index.html');
  t.check(/phones: contactPhones\(c\),/.test(cusRow) && /\$\{phones\.map\(ph=>/.test(hero),
    'the customer account lists every number on the record, not just the first');
  const supRow = extractFunction(src, 'supplierBookRow', 'index.html');
  t.check(/phones: contactPhones\(s\),/.test(supRow),
    'and the supplier row reads its numbers through the same one helper');
  const supRail = extractFunction(src, 'supplierAccountRailHTML', 'index.html');
  t.check(/r\.phones\.map\(ph=>/.test(supRail),
    'so the supplier account lists all of them too, and not only the first');
  t.check(/!phones\.length && !c\.location/.test(hero),
    'and "no contact details" counts the second number as contact details');
}

process.exit(t.done() ? 1 : 0);
