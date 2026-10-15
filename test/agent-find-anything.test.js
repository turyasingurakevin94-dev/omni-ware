#!/usr/bin/env node
'use strict';
/*
 * Finding any item.
 *
 * The order box found an item only when what was typed sat, letter for
 * letter and in the same order, inside its name: "sheet 28" missed Iron
 * sheet G28, "cemnt" found nothing, "4 inch nails" missed Wire nails 4",
 * and "mabaati" -- what clients actually call iron sheets -- missed every
 * sheet in the shop. These pin what replaced it: words in any order and in
 * part, a near miss forgiven only when nothing matches as typed, sizes read
 * the way they are said, a number in front taken as the quantity unless it
 * is part of a name, and the names the shop approved counted as names.
 *
 * Run: node test/agent-find-anything.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent find anything');
const src = read('agent.html');
const board = read('index.html');
const fn = (n) => extractFunction(src, n, 'agent.html');
const line = (re) => { const m = re.exec(src); if (!m) throw new Error(`missing ${re}`); return m[0]; };

const NAMES = ['normFind', 'findStem', 'readFindQuery', 'findDistance', 'myTaughtNames', 'findHay', 'findWordFit',
  'findScoreItem', 'findLeanings', 'searchCatalog', 'findCommonName', 'findBaseName', 'findSizeLabel', 'findRows', 'findSizeNum'];
const C = [['Iron sheet G28 · 3m', 'Roofing', ['mabaati']], ['Iron sheet G28 · 2.5m', 'Roofing', ['mabaati']], ['Iron sheet G30 · 3m', 'Roofing', ['mabaati']],
  ['Cement · Hima 50kg', 'Cement'], ['Cement · Tororo 50kg', 'Cement'],
  ['Wire nails 2"', 'Fasteners'], ['Wire nails 3"', 'Fasteners'], ['Wire nails 4"', 'Fasteners'], ['Wire nails 6"', 'Fasteners'],
  ['Roofing nails', 'Fasteners'], ['Concrete nails 4"', 'Fasteners'], ['PPR pipe 20mm', 'Plumbing']];
const catalog = C.map(([name, category, aliases], i) => ({ productId: `p${i}`, variantIdx: null, name, variantLabel: '', category, subcategory: '', aliases: aliases || [] }));
const usualKey = 'p7::';
const env = {
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  chosenClient: { id: 'c1', name: 'Kato Construction' }, myOrders: [], cart: [], catalog,
  feedItemKey: (p, v) => `${p}::${v == null ? '' : v}`, agentLocalKey: (k) => k, promotedMap: () => new Map(),
  clientUsuals: () => ({ regs: [{ productId: 'p7', variantIdx: null, key: usualKey, qtys: [2] }] }),
  itemCategory: (it) => it.category, catalogEntry: () => null, orderDate: () => '',
};
const S = compileScope([
  line(/const FIND_PACK_WORDS = [^\n]+/), line(/const FIND_SIZE_RE = [^\n]+/), 'let findHayCache = new WeakMap();',
  ...NAMES.map(fn),
], env, NAMES);
const names = (q, o) => S.searchCatalog(q, o).hits.map((h) => h.it.name);

/* ---------- 1. words, in any order, in part ---------------------------- */
{
  t.check(names('sheet 28').length === 2 && names('sheet 28').every((n) => /G28/.test(n)), 'sheet 28 finds both G28 sheets, and not the G30');
  t.check(names('28 sheet').length === 2, 'so does 28 sheet: a number that is part of a name is never a quantity');
  t.check(names('pipe 20 mm')[0] === 'PPR pipe 20mm', 'and 20 mm is 20mm');
}

/* ---------- 2. a near miss, only when nothing matches as typed ---------- */
{
  const r = S.searchCatalog('cemnt');
  t.check(r.hits.length === 2 && r.typo && r.typo.meant === 'cement', 'cemnt shows cement and says which word it read');
  t.check(S.searchCatalog('nials').typo.meant === 'nails', 'two letters swapped is one slip, not two');
  t.check(S.searchCatalog('cemnt', { exact: true }).hits.length === 0, '"search what I typed" turns the forgiveness off');
  t.check(!S.searchCatalog('cement').typo, 'a word that matches as typed is never second-guessed');
  t.check(S.findDistance('cement', 'comment', 1) > 1 && S.findDistance('nails', 'nials', 1) === 1, 'distance stops at its limit');
}

/* ---------- 3. sizes, said the way people say them --------------------- */
{
  t.check(S.normFind('4 inch nails') === '4" nails' && S.normFind('nails 4in') === 'nails 4"' && S.normFind('2½ inches') === '2.5"',
    'inch, in and inches all read as "');
  t.check(S.normFind('50 kgs') === '50kg' && S.normFind('gauge 28') === 'g28' && S.normFind('3 metres') === '3m', 'and kg, gauge and metres');
  const four = names('4 inch nails');
  t.check(four.length === 2 && four.every((n) => /4"/.test(n)), `4 inch nails finds the 4" nails and only those (${four.join(', ')})`);
}

/* ---------- 4. a quantity in front ------------------------------------- */
{
  const r = S.searchCatalog('40 cement');
  t.check(r.read.qty === 40 && r.hits.length === 2, '40 cement is forty of the cement');
  const p = S.searchCatalog('2 ctn nails 4"');
  t.check(p.read.qty === 2 && p.read.packWord === 'ctn' && p.hits[0].it.name === 'Wire nails 4"', '2 ctn nails 4" is two cartons of 4" nails, the client\'s usual first');
}

/* ---------- 5. the names clients use ----------------------------------- */
{
  const r = S.searchCatalog('mabaati');
  t.check(r.hits.length === 3 && r.alias && r.alias.word === 'mabaati' && r.alias.means === 'Iron sheet', 'mabaati finds every iron sheet and says what it means');
  t.check(/aliases/.test(fn('findHay')) && /taughtNames/.test(fn('myTaughtNames')), 'the shop\'s names, and the ones this agent taught, both count');
}

/* ---------- 6. ranked, then shown as families --------------------------- */
{
  t.check(names('nails')[0] === 'Wire nails 4"', 'the client\'s usual comes first');
  const rows = S.findRows(S.searchCatalog('nails').hits);
  const wire = rows.find((r) => r.name === 'Wire nails');
  t.check(wire && wire.sizes.map((s) => S.findSizeLabel(s)).join(' ') === '2" 3" 4" 6"', 'the wire nails are one row, their sizes as chips in order');
  const one = S.findRows(S.searchCatalog('4 inch nails').hits).find((r) => r.name === 'Wire nails');
  t.check(one && one.sizes.length === 4 && one.hits.length === 1, 'and a search for one size still shows the others beside it');
}

/* ---------- 7. the screen --------------------------------------------- */
{
  const render = fn('renderOrderResults');
  t.check(/findReadHTML\(r\.read\)/.test(render) && /Showing <b>/.test(render) && /a name clients use · set by the shop/.test(render),
    'it says what it read, which word it corrected, and what a client\'s word means');
  t.check(/findQtyHTML\(r\.hits\[0\], qty\)/.test(render) && /findUsualHTML\(r\.hits\)/.test(render), 'a quantity gets its own card, else the client\'s usual leads');
  t.check(/findNoneHTML\(q, r\.read\)/.test(render) && /Ask the shop to stock it/.test(fn('findNoneHTML')) && /data-fd-teach/.test(fn('findNoneHTML')),
    'nothing found: the closest, ask the shop to stock it, or teach it the word');
  t.check(/You searched/.test(fn('findRecentHTML')) && /You added lately/.test(fn('findRecentHTML')), 'the empty box offers what was searched and added lately');
  t.check(/none on the shelf/.test(fn('findTagsHTML')) && /yours/.test(fn('findTagsHTML')), 'a bonus says what it earns; an empty shelf says so');
  t.check(/searchCatalog\(document\.getElementById\('ag_browse_search'\)\.value\)/.test(fn('findItems')), 'Browse searches the same way');
}

/* ---------- 8. the server and the shop --------------------------------- */
{
  const sql = read('supabase/migrations/0112_item_names_and_agent_requests.sql');
  t.check(/alter table item_names enable row level security/.test(sql) && /alter table agent_requests enable row level security/.test(sql), 'both new tables are locked down');
  t.check(/agent_id = current_agent_id\(shop_id\)\s*and status = 'open' and resolved_at is null/.test(sql), 'an agent adds only open requests, as themselves');
  t.check(!/create policy[^;]*item_names[^;]*for (insert|all)[^;]*current_agent_id/i.test(sql), 'and never writes a name straight into the catalogue');
  const cat = read('supabase/functions/agent-catalog/index.ts');
  t.check(/from\("item_names"\)/.test(cat) && /aliases: /.test(cat) && /onShelf: /.test(cat), 'agent-catalog hands each item its names and whether the shelf is empty');
  t.check(/onShelf: shelf\.has\([^)]*\)\) \? [^:]+> 0 : null/.test(cat), 'never the stock count itself, and null when nobody counted');
  t.check(/function renderAgentRequests\(/.test(board) && /Words to learn/.test(board) && /Asked to stock/.test(board), 'the board shows what agents asked');
  t.check(/from\('item_names'\)\.insert/.test(extractFunction(board, 'answerAgentRequest', 'index.html')), 'a word is added only when the shop taps yes');
  t.check(/id="p_names"/.test(board) && /function pnAdd\(/.test(board), 'and the product form lists the names clients use');
}

process.exit(t.done() ? 1 : 0);
