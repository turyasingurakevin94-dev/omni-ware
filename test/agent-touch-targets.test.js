#!/usr/bin/env node
'use strict';
/*
 * The agent app's density profile.
 *
 * This surface is used standing up, in a customer's shop, one-handed, in
 * direct equatorial sun. That is not a mood -- it sets two hard numbers:
 * nothing tappable below 44px, and nothing readable below 11px.
 *
 * Measuring the rendered app found six interactive controls under 44,
 * and they were the high-traffic secondary ones rather than the primary
 * buttons: back at 32x32, month nav at 31x31, segment tabs at 35, the
 * view toggle and recent-client chips at 32. A thumb aimed at a 31px
 * target while holding a phone one-handed at a counter misses.
 *
 * Fixing it exposed a second bug worth pinning: `all:unset` resets
 * box-sizing to content-box, so min-height and padding ADD instead of the
 * padding sitting inside the target. A 44px minimum first rendered as 56,
 * which costs a row of content on a phone.
 *
 * Run: node test/agent-touch-targets.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('agent touch targets');
const src = read('agent.html');

// Only the <style> block -- the file also carries inline styles in JS
// template strings, which are a separate concern.
const styleBlock = (/<style>([\s\S]*?)<\/style>/.exec(src) || ['', ''])[1];

/* ---------- 1. nothing tappable is under 44px ------------------------ */
{
  const CONTROLS = [
    // The screens were rebuilt; these are the controls an agent's thumb
    // actually reaches for on them. Each is checked for its HEIGHT -- a
    // fixed height or a min-height -- of at least 44px.
    ['.ax-tab', 'a tab'],
    ['.ax-iconbtn', 'the round icon buttons (close, back, call)'],
    ['.ax-tile', 'the On-the-move tiles'],
    ['.ax-needrow', 'a row of something waiting on you'],
    ['.ax-who', 'the client pill on an order'],
    ['.ax-ob', 'the other orders in the strip'],
    ['.ax-step button', 'the quantity stepper'],
    ['.ax-cheaper', 'the cheaper-quantity pill'],
    ['.ax-sub', 'the shelf chips in Find'],
    ['.ax-flt button', 'the Find filters'],
    ['.ax-add', 'the add button on a tile'],
    ['.ax-fchips button', 'the client filters'],
    ['.ax-bar', 'a month in the chart'],
    ['.ax-act', 'Call, Update and Receipt on a track'],
    ['.ax-prov button', 'the payment choices'],
    ['.ag-inquiry-done', 'the tick on a request'],
  ];
  CONTROLS.forEach(([sel, what]) => {
    const rule = new RegExp('\\n\\s*' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}').exec(styleBlock);
    const body = rule ? rule[1] : '';
    const m = /(?:^|;|\s)(?:min-)?height:(\d+)px/.exec(body);
    t.check(m && Number(m[1]) >= 44,
      `${what} is at least 44px tall (${m ? m[1] + 'px' : 'none'})`);
  });
}

/* ---------- 2. and the minimum is the whole control ------------------ */
/*
 * The bug that made a 44px rule render as 56. Any control that resets with
 * `all:unset` and then sets a min-height must restore border-box, or the
 * padding lands outside the number.
 */
{
  // Vertical padding is what actually breaks it. `padding:0 16px` under
  // content-box still renders at exactly the min-height, so flagging every
  // all:unset rule cries wolf -- which this did on .ag-inquiry-call before
  // it was narrowed.
  const verticalPadding = (body) => {
    const m = /padding:([^;]+);/.exec(body);
    if (!m) return 0;
    return parseFloat(m[1].trim().split(/\s+/)[0]) || 0;
  };
  const rules = styleBlock.match(/\.[^{}]*\{[^}]*all:unset[^}]*\}/g) || [];
  const offenders = rules
    .filter(r => /min-height:/.test(r))
    .filter(r => !/box-sizing:border-box/.test(r))
    .filter(r => verticalPadding(r) > 0)
    .map(r => (r.replace(/\/\*[\s\S]*?\*\//g, '').match(/\.[^{]*/) || [''])[0].trim());
  t.check(offenders.length === 0,
    `every all:unset control with a min-height restores border-box${offenders.length ? ` (missing on ${offenders.join(', ')})` : ''}`);

  // The arithmetic that goes wrong, stated plainly.
  const rendered = (minH, padY, boxSizing) => boxSizing === 'border-box' ? minH : minH + padY * 2;
  t.check(rendered(44, 6, 'content-box') === 56, 'content-box turns a 44px minimum into 56');
  t.check(rendered(44, 6, 'border-box') === 44, 'border-box keeps it at 44');
}

/* ---------- 3. nothing readable is under 11px ------------------------ */
/*
 * 9 and 9.5px were in use on the ladder heads, the bonus pill and the
 * sponsor tag. These are uppercase micro-labels, which is the usual excuse
 * for going that small -- but the excuse assumes an office.
 */
{
  const sizes = [...styleBlock.matchAll(/font-size:([\d.]+)px/g)].map(m => Number(m[1]));
  const tooSmall = sizes.filter(v => v < 11);
  t.check(tooSmall.length === 0,
    `no declared type below 11px${tooSmall.length ? ` (found ${[...new Set(tooSmall)].sort().join(', ')}px)` : ''}`);
  t.check(sizes.length > 100, `and the sweep actually looked at the stylesheet (${sizes.length} declarations)`);
}

/* ---------- 4. the primary action stays the biggest thing ------------ */
/*
 * Raising the secondary controls to 44 must not leave them competing with
 * the button that submits the order.
 */
{
  const btn = /\.btn\{([^}]*)\}/.exec(styleBlock);
  t.check(btn && /padding:13px 18px/.test(btn[1]),
    'the primary button keeps its own generous padding');
  t.check(btn && /box-sizing:border-box/.test(btn[1]),
    'and it was already sizing correctly, which is how the bug stayed hidden');
}

process.exit(t.done() ? 1 : 0);
