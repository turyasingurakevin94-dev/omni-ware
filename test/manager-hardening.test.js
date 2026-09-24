#!/usr/bin/env node
'use strict';
/*
 * The Manager's plumbing, held to what it now promises.
 *
 *   - A plan's words are whitelisted and its ids resolved against the
 *     shop's own records -- an invented customer is never journalled.
 *   - A new chat is the counter assistant again, not the meeting.
 *   - The weekly review is not handed this morning's day line.
 *   - The answer streams, and a failure a second try can cure is tried
 *     again, quietly -- while one that would fail the same way is said.
 *   - Words already written when the server's time runs out are kept as
 *     a cut-off turn, so "continue" resumes from them.
 *
 * Run: node test/manager-hardening.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager hardening');
const src = read('index.html');
const api = read('api/assistant.js');

(async () => {
  /* ---------- 1. a subject only names what is on file ----------------- */
  {
    const { managerResolvedSubject } = compileScope([
      extractFunction(src, 'managerResolvedSubject', 'index.html'),
      extractFunction(src, 'buyKeyParts', 'index.html'),
    ], {
      data: {
        customers: [{ id: 7 }], suppliers: [{ id: 's-2' }],
        savedQuotes: [{ id: 91 }], products: [{ id: 'p1', variants: [{}, {}] }],
      },
    }, ['managerResolvedSubject']);

    const kept = managerResolvedSubject({ customerId: '7', supplierId: 's-2', key: 'p1::1', orderId: 91 });
    t.check(kept.customerId === 7, 'a customer on file is kept, with the id type the record carries (got ' + JSON.stringify(kept.customerId) + ')');
    t.check(kept.supplierId === 's-2' && kept.orderId === 91 && kept.key === 'p1::1',
      'and so are a supplier, an order and a stock key that resolve');
    const gone = managerResolvedSubject({ customerId: 999, supplierId: 'nobody', key: 'p1::5', orderId: 3 });
    t.check(Object.keys(gone).length === 0,
      'an invented id of every kind becomes absent, never a verdict about someone who does not exist (got ' + JSON.stringify(gone) + ')');
    t.check(Object.keys(managerResolvedSubject(null)).length === 0
      && Object.keys(managerResolvedSubject('customer 7')).length === 0,
      'and a subject that is not an object is nothing');
  }

  /* ---------- 2. a move's words are whitelisted ----------------------- */
  {
    const inserted = [];
    const save = compileScope([
      extractFunction(src, 'managerSaveMeeting', 'index.html'),
      extractDeclaration(src, 'MANAGER_DOORS', 'index.html'),
      extractDeclaration(src, 'MANAGER_MOVE_KINDS', 'index.html'),
      extractFunction(src, 'managerResolvedSubject', 'index.html'),
      extractFunction(src, 'buyKeyParts', 'index.html'),
      extractDeclaration(src, 'MANAGER_WORTH_BASES', 'index.html'),
      extractDeclaration(src, 'MANAGER_LEVERS', 'index.html'),
      extractDeclaration(src, 'MANAGER_OBJECTIVES', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
    ], {
      managerNotesTable: true, currentShopId: 'shop-1', todayISO: () => '2026-09-24',
      data: { customers: [{ id: 7 }], products: [] },
      apRound: (n) => Math.round(Number(n) || 0),
      toast: () => {}, setBuyHold: () => {}, stockKey: () => '',
      managerInsertProposals: async () => ({ error: null }),
      sb: { from: () => ({ insert: (row) => { inserted.push(row); return {
        select: () => ({ single: () => Promise.resolve({ data: { id: 5 }, error: null }) }) }; } }) },
      console, Promise, JSON, Math, Number, String, Array, Object, Set,
    }, ['managerSaveMeeting']).managerSaveMeeting;

    await save({ keyline: 'k', moves: [
      { title: 'Chase Milly', door: 'chase', kind: 'chase', worth: 840000, subject: { customerId: 7 } },
      { title: 'Ring Kato', door: 'telephone', kind: 'phone', worth: -5, subject: { customerId: 12 } },
      { title: 'Something', door: 'debtors', kind: 'settle', worth: 'a lot' },
    ] });
    const moves = inserted.find(r => Array.isArray(r) && r[0] && r[0].kind === 'move') || [];
    t.check(moves.length === 3, 'every move is kept (got ' + moves.length + ')');
    const [a, b, c] = moves.map(m => m.body);
    t.check(a.door === 'chase' && a.mkind === 'chase' && a.worth === 840000 && a.subject.customerId === 7,
      'a well-formed move is stored as written');
    t.check(b.door === '' && b.mkind === 'other',
      'an unknown door stores no door and an unknown kind stores "other" (got ' + b.door + ' / ' + b.mkind + ')');
    t.check(b.worth === 0 && c.worth === 0, 'a negative or wordy worth is 0, "no honest figure", never a debt the screen prints');
    t.check(!('customerId' in b.subject), 'a customer the shop has never had is not journalled');
    t.check(c.door === 'debtors' && c.mkind === 'settle', 'and the known words of a thin move survive');
  }

  /* ---------- 3. the modes ------------------------------------------- */
  {
    const newChat = src.slice(src.indexOf("getElementById('apNewChatBtn').addEventListener"));
    const body = newChat.slice(0, newChat.indexOf('});'));
    t.check(/apMode = null;/.test(body), 'New chat returns the panel to the counter assistant — the meeting\'s rulebook does not follow every later question');
    t.check(/if\(assistantBusy\) return;/.test(body), 'and a New chat mid-answer is ignored rather than tearing the thread out from under the loop');
    const loop = extractFunction(src, 'apRunLoop', 'index.html');
    t.check(/if\(!apDaySeeded && !apMode && assistantThread\.length === 1\)/.test(loop),
      'the day line goes to the counter assistant only — neither the meeting nor the review is handed it');
  }

  /* ---------- 4. the server: model, stream, retryable ------------------ */
  {
    t.check(/model: process\.env\.ANTHROPIC_MODEL \|\| 'claude-opus-5'/.test(api),
      'the model is a setting with the current default, not a literal only a code change can move');
    t.check(/req\.body\.stream === true/.test(api) && /client\.beta\.messages\.stream\(params\)/.test(api),
      'streaming is opt-in, so a page cached from before still gets the one JSON body it reads');
    t.check(/if \(!started\) return res\.status\(out\.status\)\.json\(\{ error: out\.error \}\)/.test(api),
      'a failure before the first byte still leaves as the worded JSON error, with its status');
    t.check(/line\(\{ type: 'done', content: final\.content/.test(api),
      'and the whole message arrives last, as the only thing the browser keeps');
    const reply = extractFunction(api, 'apiErrorReply', 'api/assistant.js');
    const retryables = (reply.match(/retryable: true/g) || []).length;
    t.check(retryables === 3, 'exactly three failures are marked retryable — busy, unreachable, the service\'s 5xx (got ' + retryables + ')');
    const badKey = reply.slice(reply.indexOf('AuthenticationError'), reply.indexOf('RateLimitError'));
    t.check(!/retryable/.test(badKey), 'a rejected key is never retried — it fails the same way every time');
    const fourxx = reply.slice(reply.indexOf('status >= 400 && status < 500'), reply.indexOf("error: { type: 'api_error', retryable: true"));
    t.check(!/retryable/.test(fourxx), 'nor is a malformed request');
  }

  /* ---------- 5. the stream reader ------------------------------------ */
  const shown = [];
  const reader = compileScope([extractFunction(src, 'apReadStream', 'index.html'), extractFunction(src, 'apIsNoCredit', 'index.html')], {
    apLiveShow: (x) => shown.push(x), TextDecoder, JSON, String, AP_NO_CREDIT: 'no credit',
  }, ['apReadStream']).apReadStream;
  const respOf = (lines, opts) => {
    const enc = new TextEncoder();
    const chunks = lines.map(l => enc.encode(l));
    let i = 0;
    return { body: { getReader: () => ({ read: async () => {
      if (i < chunks.length) return { done: false, value: chunks[i++] };
      if (opts && opts.drop) throw new Error('reset');
      return { done: true };
    } }) } };
  };
  {
    const done = { type: 'done', content: [{ type: 'text', text: 'Hello there' }], stop_reason: 'end_turn', usage: {} };
    // A line split across two chunks must still be read whole.
    const whole = JSON.stringify({ type: 'text', text: 'Hello ' }) + '\n' + JSON.stringify({ type: 'text', text: 'there' }) + '\n' + JSON.stringify(done) + '\n';
    const out = await reader(respOf([whole.slice(0, 20), whole.slice(20, 61), whole.slice(61)]));
    t.check(out.body && out.body.stop_reason === 'end_turn' && out.body.content[0].text === 'Hello there',
      'a finished stream returns the whole message, even when lines are split across chunks');
    t.check(shown[shown.length - 1] === 'Hello there', 'and the preview showed the words as they came');
  }
  {
    const out = await reader(respOf([JSON.stringify({ type: 'error', error: { message: 'busy', retryable: true } }) + '\n']));
    t.check(out.error === 'busy' && out.retry === true, 'a retryable error before any words is tried again');
    const out2 = await reader(respOf([JSON.stringify({ type: 'text', text: 'Half' }) + '\n',
      JSON.stringify({ type: 'error', error: { message: 'busy', retryable: true } }) + '\n']));
    t.check(out2.error && out2.retry === false, 'but not once words were written — a retry would say them twice');
  }
  {
    const out = await reader(respOf([JSON.stringify({ type: 'text', text: 'Chase Milly first, then' }) + '\n'], { drop: true }));
    t.check(out.body && out.body.stop_reason === 'max_tokens' && out.body.content[0].text === 'Chase Milly first, then',
      'words already written when the time runs out are kept as a cut-off turn, so "continue" resumes from them');
    const out2 = await reader(respOf([], { drop: true }));
    t.check(!out2.body && out2.retry === true, 'a connection that dropped before any word is simply tried again');
  }

  {
    const once = extractFunction(src, 'apCallServerOnce', 'index.html');
    t.check(/\[429, 502, 503\]\.includes\(resp\.status\)/.test(once) && !/504/.test(once.replace(/\/\*[\s\S]*?\*\//g, '')),
      'a bodyless 504 is the function\'s own time running out and is not paid for again');
  }

  /* ---------- 6. the retrying caller ---------------------------------- */
  {
    const script = [];
    const seen = { errors: [], setup: 0, typingOff: 0 };
    const call = compileScope([
      extractFunction(src, 'apCallServer', 'index.html'),
    ], {
      AP_RETRY_WAITS: [0, 0],
      apCallServerOnce: async () => script.shift(),
      apShowTyping: () => {}, apHideTyping: () => { seen.typingOff++; }, apLiveEnd: () => {},
      apRenderSetupCard: () => { seen.setup++; }, apRenderError: (m) => seen.errors.push(m),
      apCreditMark: () => {}, apRenderNoCredit: () => seen.errors.push('NO CREDIT'),
      setTimeout, Promise,
    }, ['apCallServer']).apCallServer;

    script.push({ error: 'x', retry: true }, { error: 'y', retry: true }, { body: { ok: 1 } });
    const got = await call();
    t.check(got && got.ok === 1 && seen.errors.length === 0, 'two curable failures then an answer: the owner sees only the answer');

    script.push({ error: 'a', retry: true }, { error: 'b', retry: true }, { error: 'still busy', retry: true });
    const got2 = await call();
    t.check(got2 === null && seen.errors.join() === 'still busy', 'a third failure is said, once — two retries at most');

    script.push({ error: 'The AI key on the server was rejected.', retry: false }, { body: { never: 1 } });
    const got3 = await call();
    t.check(got3 === null && seen.errors[seen.errors.length - 1].startsWith('The AI key') && script.length === 1,
      'a failure that is not retryable is said at once and never re-sent');
    t.check(seen.typingOff >= 3, 'and the typing dots are cleared on every outcome');
  }

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
