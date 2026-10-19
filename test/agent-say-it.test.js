#!/usr/bin/env node
'use strict';
/*
 * Say it.
 *
 * The mic in the order box: "forty bags of cement and two cartons of
 * four-inch nails" becomes two lines, each with its quantity. The phone
 * does the listening, through its own speech service -- the Web Speech
 * API in a browser, the SpeechRecognition plugin inside the installed app,
 * which has no Web Speech -- so nothing here costs money. What it heard
 * goes through the same forgiving search as the box.
 *
 * Run: node test/agent-say-it.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent say it');
const src = read('agent.html');
const fn = (n) => extractFunction(src, n, 'agent.html');
const line = (re) => { const m = re.exec(src); if (!m) throw new Error(`missing ${re}`); return m[0]; };

const C = [['Cement · Hima 50kg', 'Cement'], ['Wire nails 4"', 'Fasteners'], ['Wire nails 3"', 'Fasteners'], ['Iron sheet G28 · 3m', 'Roofing', ['mabaati']],
  ['Nuts and bolts 10mm', 'Fasteners'], ['Binding wire', 'Fasteners'], ['Gloss paint white 4L', 'Paint']];
const catalog = C.map(([name, category, aliases], i) => ({ productId: `p${i}`, variantIdx: null, name, variantLabel: '', category, subcategory: '', aliases: aliases || [] }));
const env = {
  localStorage: { getItem: () => null, setItem() {} }, chosenClient: null, myOrders: [], cart: [], catalog,
  feedItemKey: (p, v) => `${p}::${v == null ? '' : v}`, agentLocalKey: (k) => k, promotedMap: () => new Map(),
  clientUsuals: () => ({ regs: [] }), itemCategory: (it) => it.category, catalogEntry: () => null, orderDate: () => '',
};
const NAMES = ['normFind', 'findStem', 'readFindQuery', 'findDistance', 'myTaughtNames', 'findHay', 'findWordFit', 'findScoreItem',
  'findLeanings', 'searchCatalog', 'findCommonName', 'findBaseName', 'voiceNumbers', 'voiceSegments', 'voiceLines'];
const S = compileScope([
  line(/const FIND_PACK_WORDS = [^\n]+/), line(/const FIND_SIZE_RE = [^\n]+/), 'let findHayCache = new WeakMap();',
  line(/const VOICE_FILLER = [^\n]+/), line(/const VOICE_NUM = \{[\s\S]*?\};/), ...NAMES.map(fn),
], env, NAMES);
const said = (s) => S.voiceLines(s).map((l) => `${l.qty}×${l.item ? l.item.name : '?'}`).join(' ; ');

/* ---------- 1. numbers as they are said -------------------------------- */
{
  t.check(S.voiceNumbers('forty bags of cement') === '40 bags of cement', 'forty is 40');
  t.check(S.voiceNumbers('twenty-five sheets') === '25 sheets' && S.voiceNumbers('twenty five sheets') === '25 sheets', 'twenty-five, with or without the dash');
  t.check(S.voiceNumbers('one hundred and fifty nails') === '150 nails', 'the "and" inside a number stays inside it');
  t.check(S.voiceNumbers('a bag of cement') === '1 bag of cement' && S.voiceNumbers('a dozen nails') === '12 nails', 'a bag is one, a dozen is twelve');
  t.check(S.voiceNumbers('a hammer') === 'a hammer', 'but "a" in front of a thing is just "a"');
}

/* ---------- 2. one sentence, several lines ----------------------------- */
{
  t.check(said('forty bags of cement and two cartons of four inch nails') === '40×Cement · Hima 50kg ; 2×Wire nails 4"',
    'forty bags of cement and two cartons of four-inch nails: two lines, each its quantity and size');
  t.check(said('one hundred and fifty nuts and bolts') === '150×Nuts and bolts 10mm', '"nuts and bolts" is one thing: it splits only where a quantity follows');
  t.check(said('three gloss white, two binding wire') === '3×Gloss paint white 4L ; 2×Binding wire', 'a comma splits too');
  t.check(said('twenty five mabaati G28 and a bag of cement') === '25×Iron sheet G28 · 3m ; 1×Cement · Hima 50kg', 'and the names clients use work by voice');
  t.check(said('a dozen four-inch nails') === '12×Wire nails 4"', 'a quantity in front of a size is still the quantity');
  t.check(S.voiceLines('two kilos of unobtainium')[0].item === null, 'something the shop does not have comes back unmatched, never guessed');
}

/* ---------- 3. the ear, and the sheet ----------------------------------- */
{
  const ear = fn('startListening');
  t.check(/nativeSpeech\(\)/.test(ear) && /requestPermissions\(\)/.test(ear) && /partialResults: true/.test(ear),
    'in the app it asks for the microphone, then listens through the plugin');
  t.check(/webSpeechCtor\(\)/.test(ear) && /interimResults = true/.test(ear), 'in a browser through the Web Speech API');
  t.check(/mic\.hidden = !voiceSupported\(\)/.test(src), 'and where the phone cannot listen, no mic is drawn');
  const sheet = fn('openVoiceSheet');
  t.check(/data-voice-add/.test(sheet) && /data-voice-on/.test(sheet) && /data-voice-q/.test(sheet) && /data-voice-pick/.test(sheet),
    'each line can be left out, its quantity changed, or a close call picked, before one button adds them');
  t.check(/onClose: \(\)=>\{ if\(ear\) ear\.stop\(\); \}/.test(sheet), 'closing the sheet stops listening');
  t.check(/The microphone is off for this app/.test(fn('voiceFailWords')), 'a refused microphone says how to fix it');
}

/* ---------- 4. the phone app can hear ---------------------------------- */
{
  const pkg = JSON.parse(read('apps/agent/package.json'));
  t.check(!!pkg.dependencies['@capgo/capacitor-speech-recognition'], 'the app carries the speech plugin');
  t.check(/capgo-capacitor-speech-recognition/.test(read('apps/agent/android/capacitor.settings.gradle')), 'in the Android build');
  const man = read('apps/agent/android/app/src/main/AndroidManifest.xml');
  t.check(/android\.permission\.RECORD_AUDIO/.test(man) && /android\.speech\.RecognitionService/.test(man),
    'Android may use the microphone and can see the phone\'s speech service');
  const plist = read('apps/agent/ios/App/App/Info.plist');
  t.check(/NSMicrophoneUsageDescription/.test(plist) && /NSSpeechRecognitionUsageDescription/.test(plist), 'and the iPhone says why it asks');
}

process.exit(t.done() ? 1 : 0);
