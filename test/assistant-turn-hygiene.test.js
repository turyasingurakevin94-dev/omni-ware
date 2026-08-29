#!/usr/bin/env node
'use strict';
/*
 * Nothing malformed may leave this app, and a rejected request must say
 * what was wrong with it.
 *
 * Live: holding a meeting came back with "The AI service returned an
 * error (400). Try again shortly." A 400 is a verdict on OUR OWN
 * REQUEST -- the API telling us which part of the payload it refused --
 * and the server threw that sentence away, leaving a number that
 * diagnoses nothing. The rule it was following ("raw error JSON in a
 * chat bubble helps nobody") is right for a 5xx, whose internals mean
 * nothing to a shop, and wrong for a 4xx, which describes the payload
 * this app built and contains none of the shop's data.
 *
 * The same pass fixes the two ways this send path can build a request
 * the API must refuse:
 *
 *   NO EMPTY TEXT BLOCK  the model's turn goes back verbatim so its
 *       tool calls survive -- but an empty text block among them is
 *       rejected on the NEXT call, and a model emits one readily when
 *       tools follow a pause. The panel already skipped empty text when
 *       rendering; the thread did not.
 *   A RESULT IS ALWAYS TEXT  JSON.stringify(undefined) is undefined,
 *       not a string, so one executor that falls through without
 *       returning builds a malformed tool_result -- and a circular
 *       result threw straight out of the loop, killing the panel.
 *
 * Run: node test/assistant-turn-hygiene.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('the turn hygiene');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const NAMES = ['apAssistantTurnContent', 'apToolResultText'];
const fns = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), { JSON, String, Array }, NAMES);
const { apAssistantTurnContent, apToolResultText } = fns;

/* ---------- 1. an empty text block never travels ---------------------- */
{
  const turn = [
    { type: 'text', text: '' },
    { type: 'thinking', thinking: 'weighing the two chases', signature: 'sig-abc' },
    { type: 'text', text: '   \n  ' },
    { type: 'tool_use', id: 'tu_1', name: 'manager_history', input: { limit: 3 } },
    { type: 'text', text: 'Reading the books now.' },
  ];
  const out = apAssistantTurnContent(turn);
  eq(out.length, 3, 'the empty and whitespace-only text blocks are gone');
  eq(out[0].type, 'thinking', 'thinking survives — dropping it would break the turn the API expects back');
  eq(out[0].signature, 'sig-abc', 'with its signature intact');
  eq(out[1].id, 'tu_1', 'the tool call survives');
  eq(out[2].text, 'Reading the books now.', 'and real text survives, in its own place');
  t.check(out[0] === turn[1] && out[1] === turn[3],
    'blocks pass through untouched — this filters, it never rebuilds');

  eq(apAssistantTurnContent([]).length, 0, 'an empty turn stays empty for the caller’s own guard');
  const allBlank = apAssistantTurnContent([{ type: 'text', text: ' ' }]);
  eq(allBlank.length, 0,
    'a turn of nothing but blank text becomes nothing — the caller then pushes no turn at all, which is the API’s own rule');
  eq(apAssistantTurnContent('a string'), 'a string', 'a non-array content is handed back as it came');

  const loop = extractFunction(src, 'apRunLoop', 'index.html');
  t.check(/const turnContent = apAssistantTurnContent\(resp\.content\);/.test(loop)
    && /content: turnContent/.test(loop),
    'the loop pushes the CLEANED turn, not the raw one');
  t.check(!/content: resp\.content/.test(loop),
    'and the raw turn no longer reaches the thread anywhere');
}

/* ---------- 2. a tool result is always non-empty text ----------------- */
{
  eq(apToolResultText({ ok: 1 }), '{"ok":1}', 'an ordinary result is its JSON');
  eq(apToolResultText(undefined), '{"ok":true}',
    'a tool that returned NOTHING still sends text — JSON.stringify(undefined) is undefined, and that block is malformed');
  eq(apToolResultText(null), 'null', 'a deliberate null is still text');
  eq(apToolResultText(''), '""', 'and an empty string result is quoted, never bare');

  const circular = { name: 'loop' };
  circular.self = circular;
  const enc = apToolResultText(circular);
  t.check(typeof enc === 'string' && /could not be encoded/.test(enc),
    'a result that cannot be encoded answers in words instead of throwing out of the loop and killing the panel');
  t.check(JSON.parse(enc).error, 'and it is valid JSON, so the model can read it as a result');

  const loop = extractFunction(src, 'apRunLoop', 'index.html');
  t.check(/content: apToolResultText\(result\)/.test(loop), 'the loop encodes every result through it');
  t.check(!/content: JSON\.stringify\(result\)/.test(loop), 'and never stringifies inline again');
}

/* ---------- 3. a rejected request names its own cause ----------------- */
{
  t.check(/const status = err\.status \|\| 0;/.test(api) && /if \(status >= 400 && status < 500\)/.test(api),
    'the API error branch separates a verdict on our request from the service’s own trouble');
  t.check(/The AI service rejected the request \(' \+ status \+ '\)/.test(api),
    'a 4xx says it was OUR request that was rejected');
  /* Computing the detail proves nothing — it has to reach the message.
     A mutation that built it and then left it out of the sentence
     passed an earlier version of this check. */
  const fourxx = api.slice(api.indexOf('if (status >= 400 && status < 500)'),
    api.indexOf("message: 'The AI service returned an error"));
  t.check(/\.replace\(\/\\s\+\/g, ' '\)\.trim\(\)\.slice\(0, 200\)/.test(fourxx),
    'the service’s own sentence is flattened and bounded');
  t.check(/\+ \(detail \? ' — ' \+ detail : ''\)/.test(fourxx),
    'and CONCATENATED INTO the message the owner reads — computing it and dropping it is the same as not having it');
  t.check(/None of it is the shop's\s+data/.test(api),
    'with the reason that is safe written down beside it');
  const fivexx = api.slice(api.indexOf('return res.status(502).json({ error: { type: \'api_error\', message: \'The AI service returned an error'));
  t.check(/Try again shortly/.test(fivexx.slice(0, 300)),
    'while a 5xx keeps its plain sentence — its internals mean nothing to a shop');
  t.check(api.indexOf('The AI service rejected the request') < api.indexOf('The AI service returned an error'),
    'and the 4xx branch is reached first, or the specific case could never fire');
}

/* ---------- 4. the photo chip stops lying ----------------------------- */
{
  ['runManagerMeeting', 'runManagerReview'].forEach((fn) => {
    const body = extractFunction(src, fn, 'index.html');
    t.check(/if\(apPendingPhoto\)\{ apClearPhoto\(\);/.test(body),
      `${fn} sets a pending photo aside — it pushes its own turn, so the photo would never have gone with it`);
    t.check(/Photo set aside/.test(body),
      `and ${fn} SAYS so — named rather than dropped, like every other quiet loss in this app`);
  });
}

process.exit(t.done() ? 1 : 0);
