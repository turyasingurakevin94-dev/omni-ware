#!/usr/bin/env node
'use strict';
/*
 * The assistant's shell: where the panel sits, who can see it, and the
 * two disciplines the loop must never lose.
 *
 * The loop's disciplines, because they are invisible until they fail:
 *
 *   one gate, honored    a write executor runs ONLY behind its card.
 *                        The loop checks .confirm; Cancel becomes a
 *                        declined result the model reads gracefully.
 *   one message back     every tool result of a turn returns in ONE
 *                        user message. Split across messages they would
 *                        quietly teach the model to stop calling tools
 *                        in parallel.
 *
 * And the shell's: the panel overlays every tab below the modals, is
 * invisible to workers, the loading screen and the printer, holds the
 * background refresh off while a confirmation is being read, and never
 * keeps a hot microphone after the tab hides or the panel closes.
 *
 * Run: node test/assistant-ui-wiring.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter, winningDeclaration } = require('./_extract');

const t = createReporter('assistant ui wiring');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. who can see it ---------------------------------------- */
{
  const workerBlock = (/body\.worker-only-mode[\s\S]{0,700}?display:none !important;\}/.exec(src) || [''])[0];
  t.check(/\.assistant-panel/.test(workerBlock) && /#assistantOpenBtn/.test(workerBlock)
    && /#assistantOpenBtnMobile/.test(workerBlock),
    'a worker-only login sees neither the panel nor its launchers — the topbar survives worker mode, so the launcher must be named');
  const loadingBlock = (/body\.app-loading[\s\S]{0,400}?display:none !important;\}/.exec(src) || [''])[0];
  t.check(/\.assistant-panel/.test(loadingBlock), 'nor does the loading screen');
  t.check(/\.mobile-topbar, \.mobile-bottomnav, \.mobile-fab, \.mobile-more-sheet, \.assistant-panel\{display:none !important;\}/.test(src),
    'nor the printer — fixed chrome on an invoice sheet is the fault this block exists for');
}

/* ---------- 2. where it sits ----------------------------------------- */
{
  const panelZ = winningDeclaration(src, 'assistantPanel', 'z-index');
  t.check(panelZ && Number(panelZ.value) === 80,
    `the panel sits at 80 — above every tab (topbar 60, tb-menu 70) (got ${panelZ && panelZ.value})`);
  const modalZ = winningDeclaration(src, 'itemPickerModal', 'z-index');
  t.check(modalZ && Number(modalZ.value) === 100 && Number(panelZ.value) < Number(modalZ.value),
    'and below every modal, so a dialog opened after a tool’s render still lands on top');
  t.check(/@media \(max-width:820px\)\{\s*\n\s*\.assistant-panel\{\s*\n\s*inset:0;/.test(src),
    'on a phone it becomes the full-screen sheet, the More sheet’s own pattern');
  const backdrop = (/\['supplierModal','productModal'[\s\S]{0,400}?\]\.forEach/.exec(src) || [''])[0];
  t.check(!/assistantPanel/.test(backdrop),
    'and it is NOT in the modal backdrop array — it is deliberately not a modal');
}

/* ---------- 3. the confirm gate -------------------------------------- */
{
  const loop = extractFunction(src, 'apRunLoop', 'index.html');
  t.check(/tool\.confirm/.test(loop), 'the loop asks each tool whether it needs the owner');
  t.check(/await apAskConfirm\(tool, block\.input/.test(loop), 'and waits on the card when it does');
  t.check(/declined: true, reason: 'owner declined'/.test(loop),
    'Cancel becomes a declined result — not an error, so the model acknowledges instead of retrying');
  t.check((loop.match(/assistantThread\.push\(\{ role: 'user', content: results \}\)/g) || []).length === 1,
    'ALL tool results of a turn go back in ONE user message');
  t.check(/goToTab\(currentActiveTab\)/.test(loop) && /refreshNavBadges\(\)/.test(loop),
    'a confirmed write refreshes the visible tab through the app’s own idiom');
  t.check(/AP_MAX_STEPS/.test(loop) && /too many steps/.test(loop),
    'and the loop is bounded, with a sentence when the bound bites');

  const ask = extractFunction(src, 'apAskConfirm', 'index.html');
  t.check(/classList\.add\('ap-confirm-pending'\)/.test(ask)
    && /classList\.remove\('ap-confirm-pending'\)/.test(ask),
    'a pending card marks the panel, and the mark comes off however the card resolves');
  t.check(/if\(settled\) return;/.test(ask) && /b\.disabled = true/.test(ask),
    'a card settles exactly once — the second press of a nervous thumb does nothing');
  const poll = extractFunction(src, 'pollForUpdatesNow', 'index.html');
  t.check(/\.ap-confirm-pending/.test(poll),
    'and the background refresh reads that mark and holds off — it replaces `data` wholesale, and a card is a decision being asked about');
}

/* ---------- 4. money comes from the moment, not the card -------------- */
{
  const map = code.slice(code.indexOf('const ASSISTANT_TOOLS'), code.indexOf('function apLogEl'));
  t.check(/apCustomerById\(input\.customer_id\)/.test(map),
    'executors re-resolve records from the tool INPUT’s ids at run time');
  t.check(!/resolveInvoiceCustomer/.test(map),
    'and never through resolveInvoiceCustomer, which CREATES a customer on a name miss');
  const paySup = map.slice(map.indexOf('pay_supplier'), map.indexOf('pay_staff_or_rent'));
  t.check((paySup.match(/creditorTotalOwed\(input\.supplier_id\)/g) || []).length >= 2,
    'pay_supplier reads what is owed fresh in BOTH summary and run — the card may sit across a background refresh');
}

/* ---------- 5. the date rides in the turn, not the prefix ------------- */
{
  const send = extractFunction(src, 'apSend', 'index.html');
  t.check(/\[Today is ' \+ todayISO\(\)/.test(send),
    'the composer stamps today inside the user turn');
  const promptBlock = read('api/assistant.js').split('SYSTEM_PROMPT')[1].split('const ACCOUNT_ENUM')[0];
  t.check(!/20\d\d-\d\d-\d\d/.test(promptBlock) && !/todayISO/.test(promptBlock),
    'while the server’s prompt holds no actual date and computes none — the cached prefix stays byte-stable');
}

/* ---------- 6. the thread stays whole and bounded --------------------- */
{
  const trim = extractFunction(src, 'apTrimThread', 'index.html');
  t.check(/AP_MAX_THREAD/.test(trim), 'history is capped');
  t.check(/typeof m\.content === 'string'/.test(trim),
    'and trimmed only at a plain-string user turn — a tool_use split from its result is an API error on the next call');
  t.check(/AP_MAX_THREAD = 24/.test(code) && /AP_MAX_STEPS = 10/.test(code),
    'both bounds are named constants — steps at 10, since a product heard by sound costs a re-call');
}

/* ---------- 7. voice: two ways, never a hot mic ----------------------- */
{
  t.check(/const AP_SR = window\.SpeechRecognition \|\| window\.webkitSpeechRecognition \|\| null;/.test(code),
    'speech-in is feature-detected');
  t.check(/if\(!AP_SR\)\{\s*\n\s*document\.getElementById\('apMicBtn'\)\.hidden = true;/.test(code),
    'and its buttons vanish where the browser has none — the chat itself stays whole');

  const speak = extractFunction(src, 'apSpeak', 'index.html');
  t.check(/replace\(\/\\bUGX\\b\/g, 'shillings'\)/.test(speak),
    'spoken money says shillings — UGX reads as letters');
  t.check(/AP_TTS\.cancel\(\)/.test(speak), 'a new reply silences the old one');

  const listen = extractFunction(src, 'apListenOnce', 'index.html');
  t.check(/not-allowed/.test(listen) && /apStopVoice\(\)/.test(listen),
    'a denied microphone stops hands-free entirely — a hot mic nobody granted is not a state this panel may be in');

  const stop = extractFunction(src, 'apStopVoice', 'index.html');
  t.check(/abort\(\)/.test(stop) && /AP_TTS\.cancel\(\)/.test(stop),
    'stopping voice kills both the mic and the speech');
  t.check(/document\.addEventListener\('visibilitychange'[\s\S]{0,200}apStopVoice\(\)/.test(code),
    'a hidden tab stops listening');
  const close = extractFunction(src, 'apClosePanel', 'index.html');
  t.check(/apStopVoice\(\)/.test(close), 'and so does closing the panel');

  const confirm = extractFunction(src, 'apAskConfirm', 'index.html');
  t.check(/\^\(yes\|yeah\|yep\|confirm\|ok\|okay\|do it\)/.test(confirm)
    && /\^\(no\|nope\|cancel\|stop\|don't\)/.test(confirm),
    'a voice confirmation accepts only a clear yes or no');
  t.check(/Say yes to confirm, or no\./.test(confirm),
    'anything else re-prompts — it never guesses which way the owner meant');
  t.check(/settle\(true\)/.test(confirm) && /settle\(false\)/.test(confirm),
    'and voice resolves the SAME settle the buttons do — one gate, two inputs');

  const turn = extractFunction(src, 'apVoiceListenTurn', 'index.html');
  t.check(/if\(!apVoiceMode \|\| assistantBusy\) return;/.test(turn),
    'hands-free never talks over a running turn');
  t.check(/apVoiceListenTurn\(\)/.test(extractFunction(src, 'apRunLoop', 'index.html')),
    'and the loop hands the mic back after speaking — the turn-taking that makes it a conversation');
}

/* ---------- 7b. key figures highlighted, never spoken ------------------ */
/*
 * The owner reads replies as often as he hears them, and what he reads
 * for is the pack size, the cost, the suggested price. Money amounts
 * are chipped automatically off their UGX shape; everything else that
 * decides is marked **so** by the model and rendered strong. The
 * emphasis is for the eye only — apSpeak strips the marks, so the
 * headset hears the same plain sentence as before.
 */
{
  const fmt = extractFunction(src, 'apFormatText', 'index.html');
  t.check(/<strong>\$1<\/strong>/.test(fmt),
    'model-marked **key info** renders strong');
  t.check(/class="num"/.test(fmt),
    'while every UGX amount is chipped automatically, markers or none');
  const speak2 = extractFunction(src, 'apSpeak', 'index.html');
  t.check(/replace\(\/\\\*\\\*\/g, ''\)/.test(speak2),
    'and the asterisks are stripped before speech');
  t.check(/\.ap-msg\.bot \.num\{[^}]*color:var\(--accent-ink\)/.test(src)
    && /\.ap-msg\.bot strong\{[^}]*var\(--accent-ink\)/.test(src),
    'both faces carry the theme accent, in bot bubbles only — the owner’s own words stay plain');
}

/* ---------- 7c. a question offers its answers -------------------------- */
/*
 * The assistant's clarifying questions ("10,000 or 100,000?") should be
 * answerable with a tap. The model ends an asking reply with a
 * [choices: ...] line; the client strips it from screen and speech and
 * turns it into chips that SEND the answer. Voice answering unchanged.
 */
{
  const fn = compileScope([extractFunction(src, 'apExtractChoices', 'index.html')], {}, ['apExtractChoices']);
  const parsed = fn.apExtractChoices('Is that 10,000 or 100,000 added per pack?\n[choices: 10,000 | 100,000]');
  t.check(parsed.choices.length === 2 && parsed.choices[1] === '100,000',
    'the trailing [choices:] line becomes tap options');
  t.check(!/\[choices/.test(parsed.clean) && /added per pack\?$/.test(parsed.clean),
    'and is stripped from what the owner reads');
  t.check(fn.apExtractChoices('Mulongo owes 250,000 UGX.').choices.length === 0,
    'a plain answer carries no buttons');
  t.check(fn.apExtractChoices('Which?\n[choices: a | b | c | d | e]').choices.length === 4,
    'capped at four — chips, not a menu');

  const rc = extractFunction(src, 'apRenderChoices', 'index.html');
  t.check(/apRecognition\.abort\(\)/.test(rc) && /apSend\(c\)/.test(rc),
    'a tap kills any live listen before it answers — no half-heard duplicate');
  t.check(/apClearChoices\(\);/.test(extractFunction(src, 'apSend', 'index.html')),
    'and any send clears the buttons — an answered question keeps no stale options');
  t.check(/\[choices:/.test(extractFunction(src, 'apSpeak', 'index.html')),
    'the choices line is never spoken');
  t.check(/\.ap-choices\{[^}]*flex/.test(src), 'and the chip row is styled with the panel');
}

/* ---------- 8. keys and escape ---------------------------------------- */
{
  t.check(/\(e\.ctrlKey \|\| e\.metaKey\) && !e\.shiftKey && !e\.altKey && \(e\.key === 'j' \|\| e\.key === 'J'\)/.test(code),
    'Ctrl+J opens it — the bare-key namespace (q, r, c, p) is spoken for');
  const esc = (/getElementById\('assistantPanel'\)\.addEventListener\('keydown'[\s\S]{0,500}?\}\);/.exec(code) || [''])[0];
  t.check(/stopPropagation\(\)/.test(esc),
    'Escape inside the panel never reaches the modal chain');
  t.check(/if\(input\.value\)\{ input\.value = ''; \}\s*\n\s*else apClosePanel\(\)/.test(esc),
    'first press clears the composer, second closes — the nav search’s own shape');
}

/* ---------- 9. the loop’s failure sentences --------------------------- */
{
  const call = extractFunction(src, 'apCallServer', 'index.html');
  t.check(/not_configured/.test(call) && /apRenderSetupCard\(\)/.test(call),
    'the dark server renders the setup card, not an error');
  t.check(/login has expired/.test(call), 'a dead session says what to do');
  t.check(/check the internet/.test(call), 'and so does a dead connection');
  t.check(/Bearer ' \+ token/.test(call), 'every request carries the owner’s own login');
  t.check(/JSON\.stringify\(\{ messages: assistantThread \}\)/.test(call),
    'and only the thread — tools and prompt live server-side where they cache');
}

/* ---------- 10. the professional pass --------------------------------- */
/*
 * The polish the owner asked for, pinned so it cannot quietly regress:
 * the conversation sits on the app's grey ground; the empty state
 * teaches by offering first questions that go through the SAME send
 * path as typing; the always-on footer is gone; the composer grows
 * instead of sprouting a Windows scrollbar; waiting shows dots that
 * every outcome clears; and a repeated error becomes a count, not a
 * stack of four identical boxes.
 */
{
  const logBg = winningDeclaration(src, 'apLog', 'background');
  t.check(logBg && /var\(--bg\)/.test(logBg.value),
    'the conversation sits on the app’s own grey ground — white panels on it, like every other screen');

  t.check(!/ap-cost-note/.test(src),
    'the permanent footer line is gone — its words live in the welcome block instead');

  const welcome = extractFunction(src, 'apRenderWelcome', 'index.html');
  t.check(/ap-chip/.test(welcome) && /apSend\(q\)/.test(welcome),
    'the empty state offers first questions, and a tapped chip goes through apSend — the same gates as typing');
  t.check(/input\.value = q;/.test(welcome) && /input\.focus\(\)/.test(welcome),
    'the open-ended chip seeds the box for the owner to finish, never sends a half question');
  t.check(/apClearWelcome\(\)/.test(extractFunction(src, 'apSend', 'index.html')),
    'the first send clears the welcome');
  t.check(/apRenderWelcome\(\)/.test(extractFunction(src, 'apOpenPanel', 'index.html')),
    'and New chat / first open bring it back');

  const errFn = extractFunction(src, 'apRenderError', 'index.html');
  t.check(/dataset\.errText === msg/.test(errFn) && /ap-err-count/.test(errFn),
    'the same error twice in a row bumps a ×N badge instead of stacking another box');

  const call = extractFunction(src, 'apCallServer', 'index.html');
  t.check(/apShowTyping\(\)/.test(call),
    'waiting shows the typing dots');
  t.check((call.match(/apHideTyping\(\)/g) || []).length >= 2,
    'and every outcome clears them — the no-token return and the response paths alike');
  const hideAt = call.indexOf('apHideTyping();', call.indexOf('await resp.json'));
  const setupAt = call.indexOf('apRenderSetupCard');
  t.check(hideAt > 0 && setupAt > hideAt,
    'including before the setup card, so dots never sit beside it');

  t.check(/el\.style\.height = h \+ 'px';/.test(code) && /Math\.min\(el\.scrollHeight, 120\)/.test(code),
    'the composer grows with the text to a 120px lid');
  t.check(/inputEl\.style\.height = '';/.test(extractFunction(src, 'apSend', 'index.html')),
    'and snaps back after each send');
  t.check(/overflow-y:hidden/.test((/\.ap-composer textarea\{[\s\S]{0,400}?\}/.exec(src) || [''])[0]),
    'no inner scrollbar until the lid — the Windows arrow artifact cannot return');
}

process.exit(t.done() ? 1 : 0);
