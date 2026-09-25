/*
 * Products as a readiness pipeline.
 *
 * The four text tiles and the amber sentence over the register became one
 * strip: the gates a line passes on its way to being sold -- variants
 * built, supplier price, markup rule -- ending in "ready to sell". These
 * checks hold the three things the strip can get wrong without anybody
 * noticing on screen:
 *
 *   1. it is a FUNNEL. A line is counted at the first gate it fails, so
 *      what passes one gate is what reaches the next and the last number is
 *      exactly the lines with no fault. A strip whose gates were counted
 *      independently would show 31 priced and 31 ruled and 27 ready and
 *      leave the reader to guess where the other four went.
 *   2. each gate is the set-up filter's own value, so pressing it lists
 *      exactly the lines it counts -- never a second filter that could
 *      drift from the select.
 *   3. the "one setting" callout appears only when a shop default would
 *      actually fix something, and writes nothing until its button.
 *
 * And the register now turns pages like the invoice registers.
 *
 * Run: node test/products-readiness.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('products readiness');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/* ---------- 1. the strip is a funnel -------------------------------- */
{
  const scope = compileScope([
    extractDeclaration(src, 'PG_GATES', 'index.html'),
    extractFunction(src, 'productPipelineHTML', 'index.html'),
  ], { esc }, ['productPipelineHTML']);
  const s = { lines: 37, unbuilt: 1, unpriced: 5, unruled: 2, notReady: 8, photos: 12 };
  const html = scope.productPipelineHTML(s, 'unpriced');
  const passed = [...html.matchAll(/class="pg-gate-v">(\d+)<span class="ow-u">\/37/g)].map((m) => Number(m[1]));
  // built, priced, ruled, ready, photographs
  eq(passed.join(','), '36,31,29,29,12',
    'each gate passes what the one before it passed, less what is stuck at it');
  eq(passed[3], s.lines - s.notReady, 'and the ready count is exactly the lines with no fault');
  t.check(/data-product-gate="unbuilt"/.test(html) && /data-product-gate="unpriced"/.test(html)
    && /data-product-gate="unruled"/.test(html) && /data-product-gate="unready"/.test(html)
    && /data-product-gate="nophoto"/.test(html),
    'every gate carries the set-up filter value it lists, so the strip and the select cannot disagree');
  t.check(/class="pg-gate ow-on" data-product-gate="unpriced" aria-pressed="true"/.test(html),
    'the gate that is filtering says so, in its state and to a screen reader');
  t.check(/5 have no quote/.test(html) && /1 not built/.test(html) && /2 have no rule/.test(html),
    'each gate names how many are stuck at it');
  eq(scope.productPipelineHTML({ lines: 0 }, ''), '', 'an empty register draws no strip at all');
  t.check(/pg-gate-opt/.test(html) && /not needed to sell/.test(html),
    'photographs stand apart from the funnel, because a line sells without one');
}

/* ---------- 2. the marks read each gate ------------------------------ */
{
  const env = {
    esc,
    productPriceRows: (id) => (id === 'priced' ? [{ id: 1 }] : []),
    effectiveMarkupRule: (p) => (p.rule ? { source: 'default' } : null),
  };
  const scope = compileScope([
    extractDeclaration(src, 'PG_GATES', 'index.html'),
    extractFunction(src, 'productGateStates', 'index.html'),
    extractFunction(src, 'pgPipsHTML', 'index.html'),
  ], env, ['productGateStates', 'pgPipsHTML']);
  const st = (row) => JSON.stringify(scope.productGateStates(row));
  eq(st({ kind: 'variable-empty', p: { id: 'x' }, idx: null }),
    JSON.stringify({ unbuilt: 'miss', unpriced: 'wait', unruled: 'wait' }),
    'a product with no variants fails the first gate and cannot yet be asked the other two');
  eq(st({ kind: 'simple', p: { id: 'x', rule: false }, idx: null }),
    JSON.stringify({ unbuilt: 'ok', unpriced: 'miss', unruled: 'miss' }),
    'a line missing a quote AND a rule shows both, not only the first');
  const pips = scope.pgPipsHTML({ kind: 'simple', p: { id: 'priced', rule: true }, idx: null });
  eq((pips.match(/pg-pip-ok/g) || []).length, 3, 'a finished line draws three done marks');
  t.check(/class="sr-only">Markup rule: done\./.test(pips),
    'and each mark says what it means in words, so nothing rests on colour');
}

/* ---------- 3. one setting, only when it would help ------------------ */
{
  let defaults = { wholesale: null, retail: null };
  const env = {
    esc,
    shopDefaultMarkupRule: (kind) => defaults[kind],
    productSetupFault: (r) => r.fault,
    productBestBuy: (id) => ({ price: id === 'a' ? 41000 : null }),
    variantLabel: () => '',
    pgFig: (v) => String(Math.round(v)),
  };
  const scope = compileScope([extractFunction(src, 'productFixLineHTML', 'index.html')], env, ['productFixLineHTML']);
  const rows = [{ p: { id: 'a', name: 'Cement' }, fault: 'unruled', kind: 'simple' }];
  const on = scope.productFixLineHTML({ unruled: 1 }, rows);
  t.check(/Set a shop default markup/.test(on) && /id="p_dm_set" disabled/.test(on),
    'with lines stuck for want of a rule and no default, the callout offers one -- and its button starts disabled');
  t.check(/data-dm-cost="41000"/.test(on), 'the preview is built from each line’s own cost');
  eq(scope.productFixLineHTML({ unruled: 0 }, rows), '', 'nothing stuck at the rule gate: no callout');
  defaults = { wholesale: { type: 'percent', value: 15 }, retail: null };
  eq(scope.productFixLineHTML({ unruled: 1 }, rows), '',
    'and a shop that already has a default is not asked to set one');
}

/* ---------- 4. wiring: saved only on the button ---------------------- */
{
  const code = src;
  const click = (/if\(e\.target\.closest\('#p_dm_set'\)\)\{[\s\S]*?\n  \}/.exec(code) || [''])[0];
  t.check(/data\.presetDefaultMarkup\.wholesaleValue = w/.test(click) && /saveData\(\);/.test(click),
    'the default is written, through the same fields Settings writes, when the button is pressed');
  const input = (/addEventListener\('input', \(e\)=>\{\n  if\(!e\.target\.closest\('#p_dm_wholesale, #p_dm_retail'\)\) return;[\s\S]*?\n\}\);/.exec(code) || [''])[0];
  t.check(input && !/saveData|presetDefaultMarkup/.test(input),
    'typing changes only the preview -- nothing sends itself');
}

/* ---------- 5. the register turns pages ------------------------------ */
{
  const paged = compileScope([extractDeclaration(src, 'LIST_PAGED', 'index.html'), 'function __p(){ return LIST_PAGED; }'], {}, ['__p']);
  eq(paged.__p().products, true, 'Products turns pages with the shared pager, like the invoice registers');
}

process.exit(t.done() ? 1 : 0);
