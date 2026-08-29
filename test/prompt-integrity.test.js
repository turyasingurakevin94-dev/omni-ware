#!/usr/bin/env node
'use strict';
/*
 * Guard the rules the way the books are guarded.
 *
 * Every figure in this app is defended by a test that bites. The
 * Manager's own rulebook — the thing that decides what it says to the
 * owner every morning — was defended by whatever assertions happened to
 * exist, and building the last change I found out what that is worth.
 *
 * Splitting the prompt into three blocks I silently deleted FOUR rules:
 * the entire targets rule, the order of work, the clause explaining
 * what pace means, and the rule retiring a lesson the owner keeps
 * passing on. Every check still passed. They passed because every
 * assertion in this suite asks whether a rule SAYS the right thing —
 * and a rule that has been deleted says nothing, so there is nothing
 * left to be wrong. Two of the four were caught by topic tests that
 * happened to quote them. The other two I found by reading.
 *
 * So this file guards the rulebook itself, on four counts, and every
 * one of them is DERIVED from the prompt rather than listed by hand —
 * a hand-written inventory is one more thing to forget to update:
 *
 *   NOTHING UNGUARDED   every paragraph must be quoted by some test.
 *       A rule nothing checks can be weakened or deleted in silence,
 *       and this names the ones that are exposed.
 *   THE ENUMS AGREE     every list the prompt gives the model must be
 *       exactly the keys the code accepts, BOTH WAYS. A value the code
 *       knows and the prompt omits can never be used; one the prompt
 *       offers and the code refuses becomes nothing, silently.
 *   THE CAPS AGREE      "AT MOST TWO" in the prompt and .slice(0, 2)
 *       in the saver are the same rule written twice, and two writings
 *       of one rule drift.
 *   NO EMPTY PROMISES   every field name the prompt tells the model to
 *       read must exist in the app that has to produce it.
 *
 * Run: node test/prompt-integrity.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('the manager’s rulebook');
const api = read('api/assistant.js');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const BLOCKS = ['MANAGER_COMMON', 'MANAGER_MEETING', 'MANAGER_REVIEW'];
const blockText = (n) => {
  const i = api.indexOf('const ' + n + ' = [');
  t.check(i > -1, `${n} exists`);
  return api.slice(i, api.indexOf('\n];', i));
};

/* Every paragraph of every block, derived. Adding a rule adds it here
   with no list to remember. */
const paragraphs = [];
BLOCKS.forEach((n) => blockText(n).split('\n').forEach((line) => {
  const s = line.trim();
  if (s.startsWith("'") && s.length > 60) paragraphs.push({ block: n.replace('MANAGER_', ''), text: s });
}));

/* ---------- 1. nothing unguarded ------------------------------------- */
{
  /* A floor, and not an arbitrary one: if a block were renamed or its
     shape changed so nothing parsed, `paragraphs` would be empty and
     every check below would pass VACUOUSLY — nought unguarded rules,
     nought disagreements, a clean run over a rulebook nobody read. */
  t.check(paragraphs.length >= 20,
    `the rulebook is READ WHOLE before anything is judged about it — ${paragraphs.length} paragraphs across three blocks, and a check over nothing passes for the wrong reason`);

  /* Both sides reduced to bare words before comparing. A test quotes a
     rule inside a regex, full of escapes and quote marks; the rule
     itself carries unicode escapes and punctuation. Comparing the raw
     text of either would miss a quotation that is plainly there. */
  const bare = (txt) => txt.replace(/\\u[0-9a-f]{4}/gi, ' ')
    .split(/[^A-Za-z0-9_%'’-]+/).filter(Boolean).join(' ');
  const corpus = bare(fs.readdirSync('test').filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join('test', f), 'utf8')).join('\n'));

  /* Six consecutive words, because that is short enough that a test
     quoting the rule matches and long enough that an unrelated line of
     English does not. Unicode escapes are blanked: a test may quote
     either the escape or the character it stands for. */
  const windows = (txt) => {
    const words = bare(txt).split(' ');
    const out = [];
    for (let i = 0; i + 6 <= words.length; i++) out.push(words.slice(i, i + 6).join(' '));
    return out;
  };
  const unguarded = paragraphs.filter((p) => !windows(p.text).some((w) => corpus.includes(w)));
  unguarded.forEach((p) => t.check(false,
    `UNGUARDED RULE — nothing in the suite quotes it, so deleting it would pass in silence: ${p.block} | ${p.text.slice(1, 78)}`));
  eq(unguarded.length, 0,
    'every rule in the manager’s rulebook is quoted by some test — the check that would have caught the four I deleted');
}

/* ---------- 2. the enums agree, both ways ---------------------------- */
{
  /* Top-level keys only: MANAGER_METRICS holds objects with their own
     label: and measure:, and those are not enum values. */
  const topKeys = (decl) => {
    const i = src.indexOf('const ' + decl + ' = ');
    const open = src.indexOf('{', i);
    let d = 0, end = -1;
    for (let k = open; k < src.length; k++) {
      const c = src[k];
      if (c === '{') d++;
      else if (c === '}') { d--; if (!d) { end = k; break; } }
    }
    const body = src.slice(open + 1, end);
    const keys = []; d = 0; let cur = '';
    for (let k = 0; k < body.length; k++) {
      const c = body[k];
      if (c === '{' || c === '[') { d++; continue; }
      if (c === '}' || c === ']') { d--; continue; }
      if (d) continue;
      if (c === ',') { cur = ''; continue; }
      if (c === ':') {
        const m = cur.trim().replace(/^'|'$/g, '');
        if (/^[a-z][a-z0-9_-]*$/.test(m)) keys.push(m);
        cur = ''; continue;
      }
      cur += c;
    }
    return keys;
  };
  const arrValues = (decl) => {
    const i = src.indexOf('const ' + decl + ' = [');
    return [...src.slice(i, src.indexOf('];', i)).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  };
  const promptList = (label) => {
    const i = api.indexOf(label);
    if (i < 0) return null;
    const rest = api.slice(i + label.length);
    const stop = rest.search(/\.(?:\s|$|\\)/);
    return rest.slice(0, stop < 0 ? rest.length : stop).split(',').map((x) => x.trim())
      .filter((x) => /^[a-z][a-z0-9_-]*$/.test(x));
  };

  const ENUMS = [
    ['worth_basis', 'worth_basis is one of: ', () => topKeys('MANAGER_WORTH_BASES')],
    ['lever', 'lever is one of: ', () => arrValues('MANAGER_LEVERS')],
    ['objective.name', 'objective.name is one of: ', () => topKeys('MANAGER_OBJECTIVES')],
    ['targets[].metric', 'targets[].metric is one of: ', () => topKeys('MANAGER_METRICS')],
    ['plays[].treats', 'plays[].treats is one of: ', () => topKeys('MANAGER_PROBLEMS')],
    ['door', 'door is one of: ', () => topKeys('MANAGER_DOORS')],
  ];
  ENUMS.forEach(([name, label, codeSide]) => {
    const said = promptList(label);
    const known = codeSide();
    t.check(Array.isArray(said) && said.length > 0, `the prompt spells out the ${name} values`);
    t.check(known.length > 0, `and the code declares them for ${name}`);
    const missing = known.filter((k) => !(said || []).includes(k));
    const invented = (said || []).filter((k) => !known.includes(k));
    eq(missing.join(','), '',
      `${name}: every value the code accepts is offered to the model — one it never hears of can never be used`);
    eq(invented.join(','), '',
      `${name}: and every value the model is offered is one the code accepts — one it refuses becomes nothing, silently`);
  });
}

/* ---------- 3. the caps agree ---------------------------------------- */
{
  const WORD = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  const save = src.slice(src.indexOf('async function managerSaveMeeting'));
  const codeCap = (re) => { const m = save.match(re); return m ? Number(m[1]) : null; };
  const promptCap = (phrase) => {
    const m = api.match(new RegExp('AT MOST ([A-Z]+)' + phrase));
    return m ? WORD[m[1]] : null;
  };

  const CAPS = [
    ['moves', ' moves', /\(plan\.moves\|\|\[\]\)\.slice\(0, (\d+)\)/],
    ['targets', ' targets for the week', /plan\.targets : \[\][\s\S]{0,400}?\.slice\(0, (\d+)\)/],
    ['plays', ' plays in a meeting', /plan\.plays : \[\][\s\S]{0,400}?\.slice\(0, (\d+)\)/],
    ['holds', ' holds in a meeting', /plan\.holds : \[\][\s\S]{0,400}?\.slice\(0, (\d+)\)/],
    ['asks', ' such questions in asks', /plan\.asks : \[\][\s\S]{0,400}?\.slice\(0, (\d+)\)/],
  ];
  CAPS.forEach(([name, phrase, re]) => {
    const said = promptCap(phrase);
    const enforced = codeCap(re);
    t.check(said != null, `the prompt states a ceiling for ${name}`);
    t.check(enforced != null, `and the saver enforces one for ${name}`);
    eq(enforced, said,
      `${name}: the ceiling the model is told and the ceiling the journal enforces are the same number — two writings of one rule drift`);
  });
}

/* ---------- 4. no empty promises ------------------------------------- */
{
  const descOf = (n) => {
    const i = api.indexOf("name: '" + n + "'");
    return i < 0 ? '' : api.slice(i, api.indexOf('input_schema', i));
  };
  const hay = BLOCKS.map(blockText).join('\n') + '\n'
    + ['manager_history', 'week_review_data', 'purchase_plan', 'month_and_quarter', 'standing_policies']
      .map(descOf).join('\n');
  const names = [...new Set([...hay.matchAll(/\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/g)].map((m) => m[1]))];
  t.check(names.length > 25, `the prompt names ${names.length} fields and tools by their machine names`);
  const absent = names.filter((n) => !src.includes(n));
  absent.forEach((n) => t.check(false,
    `EMPTY PROMISE — the prompt tells the model to read "${n}" and nothing in the app produces it`));
  eq(absent.length, 0,
    'every field and tool the prompt promises exists in the app that has to produce it');
}

/* ---------- 5. the four rules that had no other home ----------------- */
/* Each of these was unguarded when this file was written — including
   the order of work, which is the paragraph I deleted by accident and
   which nothing in the suite would have missed. They are asserted here
   because they belong to no topic file, not because assertions belong
   in a coverage check. */
{
  const common = blockText('MANAGER_COMMON');
  const meeting = blockText('MANAGER_MEETING');

  t.check(/argue only from what is recorded/.test(common),
    'NEVER FORECAST: the manager argues from the books and never from what it expects');
  t.check(/"sales will grow" is a guess and forbidden/.test(common),
    'with the forbidden shape named, so it cannot be reasoned around');
  t.check(/You move nothing and send nothing — the owner acts\./.test(common),
    'and nothing sends itself — the law this whole app is built on, restated where the manager will read it');
  t.check(/Never claim an action happened, and never present a move as already done/.test(common),
    'and a move is never described as done');

  t.check(/Follow-up questions in the same conversation stay with you as the manager/.test(common),
    'a follow-up is answered by the manager who made the plan, not by a fresh assistant');
  t.check(/emit a fresh \[plan:\] block only when the owner asks you to re-plan/.test(common),
    'and answering a question does not quietly rewrite the day — a second plan block would journal a second meeting');

  t.check(/When the message is "Hold the morning meeting"/.test(meeting),
    'the morning meeting knows itself by the sentence that opens it');
  t.check(/Everything above still binds — tools first, resolved names, speakable prose/.test(meeting),
    'and the base rules still bind — the manager is the same assistant on a different occasion, never a looser one');

  t.check(/PRICING HAS TWO SIDES/.test(meeting),
    'PRICING HAS TWO SIDES: a thin margin argues for lifting a price only if the line is not already dearer than the shop up the road');
  t.check(/put it in asks when it is missing on a line you are arguing about/.test(meeting),
    'and where the shop has never looked, the manager asks — a walk down the street answers what no book can');
  t.check(/Never treat an empty record as proof this shop is the cheapest: it is proof that nobody has looked/.test(meeting),
    'and an empty record is never read as proof of being cheapest — the difference between no evidence and evidence of none');

  t.check(/Order of work: call manager_history FIRST, then shop_pulse for the whole position/.test(meeting),
    'THE ORDER OF WORK — the paragraph I deleted in the last build, which nothing would have caught');
  t.check(/at most two or three narrower tools where a figure needs support/.test(meeting),
    'with the drilling bounded, so a meeting does not become a tool crawl');
  t.check(/Do not re-tell the owner their dashboard/.test(meeting),
    'and never reads the dashboard back — the owner can see it; the job is judgement');
  t.check(/Advice the owner keeps skipping is advice to rethink, not repeat/.test(meeting),
    'and advice the owner keeps passing on is rethought rather than repeated');
}

process.exit(t.done() ? 1 : 0);
