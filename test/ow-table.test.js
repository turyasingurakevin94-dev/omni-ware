#!/usr/bin/env node
'use strict';
/*
 * THE TABLE.
 *
 * This file has fifty-nine hand-built <table>s in sixteen class
 * families — sp-table, cs-table, bo-table, pi-table-wrap,
 * qp-items-table-wrap, cmp-x-table, fg-table, op-table, st-table,
 * tr-table, age-table, cons-goods-table, dash-mini-table and more — and
 * every one settles its own type, its own hairlines, its own numeric
 * alignment and its own idea of a header row. It is the largest source
 * of drift left in the app, and every screen still to be redesigned is
 * mostly table.
 *
 * .ow-tbl is the one that replaces them, and these are the things about
 * it that are not style. Each was found by rendering it, not by reading
 * it.
 *
 * Run: node test/ow-table.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('the table');
const src = read('index.html');
const styleEnd = src.indexOf('\n</style>\n');
const markAt = src.indexOf('THE OW LAYER');
const layer = src.slice(src.lastIndexOf('/*', markAt), styleEnd);
const rule = (sel) => {
  const i = layer.indexOf('\n  ' + sel + '{');
  const j = i < 0 ? -1 : layer.indexOf('}', i);
  return i < 0 ? '' : layer.slice(i, j + 1);
};

/* ---------- 1. the container owns the tracks ---------- */
/*
 * THE BUG THIS EXISTS FOR, and it was measured rather than reasoned.
 *
 * The first build gave every row its own grid with the same template.
 * That looks equivalent and is not: `auto` and `1fr` resolve per ROW, so
 * a total row whose action cell is empty computed a wider first column
 * and put its figure 77 pixels right of the figures it was totalling.
 * A column of money that does not line up is unreadable at exactly the
 * glance it is read at — and nothing about it looks broken until you
 * put a straight edge on it.
 */
{
  t.check(/\.ow-tbl\{[^}]*display:grid/.test(layer),
    'the container is the grid — it is what owns the tracks');
  t.check(/\.ow-tbl\{[^}]*grid-template-columns:var\(--ow-tbl-cols\)/.test(layer),
    'declared once, in a custom property the caller sets');
  const rows = rule('.ow-tbl-h,.ow-tbl-r,.ow-tbl-f');
  t.check(/grid-column:1\/-1/.test(rows),
    'and every row spans all of them');
  t.check(/@supports \(grid-template-columns:subgrid\)\{[\s\S]{0,200}?grid-template-columns:subgrid;/.test(layer),
    'borrowing the container’s own tracks through subgrid, so header, row and total share one edge');
  t.check(/grid-template-columns:var\(--ow-tbl-cols\)/.test(rows),
    'with the template repeated as the fallback where subgrid is missing');

  /* A row that spans the tracks but lays itself out as a flex line —
     the group heading, the caution line — has to say so or it lands in
     the first column and the rest of the row goes empty. */
  t.check(/grid-column:1\/-1/.test(rule('.ow-tbl-g')),
    'the group heading spans the whole width');
  t.check(/grid-column:1\/-1/.test(rule('.ow-tbl-note')),
    'and so does the line the table has to say something about');
}

/* ---------- 2. money never gives way ---------- */
/*
 * A clipped figure is not a shortened figure, it is a WRONG one:
 * "1,240,00" is a tenth of "1,240,000" and looks entirely plausible. So
 * in every table the figure column is sized to its content and the
 * words beside it are what yields.
 */
{
  const n = rule('.ow-tbl-n');
  t.check(/white-space:nowrap/.test(n), 'the figure cell never wraps');
  t.check(!/text-overflow:ellipsis/.test(n), 'and is never given permission to truncate');
  t.check(/font-family:'IBM Plex Mono'/.test(n) && /font-variant-numeric:tabular-nums/.test(n),
    'it is mono and tabular, so a column of it lines up digit under digit');
  t.check(/text-align:right/.test(n) && /justify-self:end/.test(n),
    'and right-aligned, which is the only way a column of money is read');

  /* The words, on the other hand, must yield — and truncation is three
     declarations, never two. nowrap plus hidden without ellipsis is a
     hard cut with no sign that anything was removed. */
  ['.ow-tbl-p', '.ow-tbl-s'].forEach((sel) => {
    const r = rule(sel);
    t.check(/overflow:hidden/.test(r) && /text-overflow:ellipsis/.test(r) && /white-space:nowrap/.test(r),
      `${sel} truncates with all three declarations, not two`);
    t.check(/min-width:0/.test(r),
      `and ${sel} may shrink — a grid item without min-width:0 pushes its neighbours out of the box instead`);
  });
  t.check(/min-width:0/.test(rule('.ow-tbl-c')),
    'and so may the cell that holds them');
}

/* ---------- 3. one call, two skins ---------- */
/*
 * The same guarantee .ow-q already gives. Below 820px the header row
 * goes and each row becomes a card — not a horizontal scroll, which is
 * how a table stops being read at all under a thumb, and not a second
 * template, which is how the console and the phone come to say
 * different things.
 */
{
  const phone = (/@media \(max-width:820px\)\{[\s\S]*$/.exec(layer) || [''])[0];
  t.check(/\.ow-tbl-h\{display:none;\}/.test(phone),
    'the column names go, because there are no columns left');
  t.check(/\.ow-tbl\{display:block;\}/.test(phone),
    'and the container stops being a grid at all');
  t.check(/content:attr\(data-l\)/.test(phone),
    'every cell carries the name it lost, from the attribute it was emitted with');
  t.check(/\.ow-tbl-c\[data-l\]::before,\.ow-tbl-n\[data-l\]::before\{[\s\S]{0,300}?margin-right:auto/.test(phone),
    'the label takes the slack — space-between stranded "/bag" at the right edge, reading as a column of its own rather than as part of the number');
}

/* ---------- 4. the figure, in its one fixed relationship ---------- */
{
  const f = rule('.ow-fig');
  t.check(/font-family:'IBM Plex Mono'/.test(f) && /font-variant-numeric:tabular-nums/.test(f),
    'money is mono and tabular wherever it appears, not only in tables');
  t.check(/white-space:nowrap/.test(f), 'and never breaks');
  t.check(/\.ow-fig-u\{/.test(layer) && /\.ow-fig-b\{/.test(layer),
    'with its unit and its basis, in that order and that relationship');

  /* good = verdigris, caution = amber, bad = crimson. There is no
     fourth, and a figure with none of them is a SIZE. */
  const states = ['bad', 'good', 'warn'].filter((c) => new RegExp(`\\.ow-fig\\.ow-${c}\\{color:`).test(layer));
  t.check(states.length === 3, `three states and no more (${states.join(', ')})`);
  t.check(!/\.ow-fig\.ow-(?!bad|good|warn)[a-z]+\{color:/.test(layer),
    'and no fourth was invented');
}

/* ---------- 5. it stays inside its own namespace ---------- */
{
  /* The second of the three layer laws. .btn.ow-sm grows to half a
     row's width on a phone, which is right in the queue and wrong in a
     table row — and the rule that says so has to reach the button
     through .ow-sm, never through .btn alone. */
  t.check(!/\.ow-tbl-a \.btn\{/.test(layer),
    'no rule here reaches .btn on its own');
  t.check(/\.ow-tbl-a \.btn\.ow-sm\{/.test(layer),
    'the one that reaches a button goes through .ow-sm, which keeps it in the namespace');
}

process.exit(t.done() ? 1 : 0);
