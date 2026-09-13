#!/usr/bin/env node
'use strict';
/*
 * One stray closing tag, and forty screens stacked on top of each other.
 *
 * Converting a page header, I replaced an opening <div> and its contents
 * but left the </div> that used to close it. HTML does not complain. The
 * browser does what browsers do: it closed <section id="tab-quote">
 * early, and every section written after it became a CHILD of the quote
 * screen instead of a sibling.
 *
 * goToTab hides screens with `document.querySelectorAll('main > section')`
 * -- a DIRECT-CHILD selector. Nested sections stopped matching it, so
 * they were never hidden. Opening Customers left the quote screen open
 * above it and pushed Customers eleven hundred pixels down the page, off
 * the bottom of the viewport. The screen was fine. It was rendered,
 * populated and correct. You just could not see it, and nothing threw.
 *
 * That is the shape of every bad afternoon in this file: not a wrong
 * figure, but a structure that quietly stopped being what the code
 * assumed. So the structure is checked.
 *
 * The check is deliberately narrow. Balancing every tag in 66,000 lines
 * of HTML needs a real parser and this project has none; but the defect
 * class is one unbalanced <div> inside one screen, and THAT is countable
 * exactly. Comments are stripped first, because prose about markup is
 * not markup.
 *
 * Run: node test/section-structure.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('section structure');
const src = read('index.html');

const starts = [...src.matchAll(/<section id="tab-([a-z0-9-]+)"/g)];
/* A FLOOR, NOT A COUNT. What this guards is the regex above: if it ever
   stopped matching, every check below it would pass by walking nothing.
   The floor sits two screens under the real total so that removing one
   does not have to be argued here -- and merging three into one did have
   to be. What's coming, What to buy and The day became the three lenses
   of Forecasts, so the total went 37 -> 35 and the floor 35 -> 33. */
t.check(starts.length > 33, `every screen is checked (${starts.length})`);

/* The screens live under <main>; the slice for each runs to the next
   one, which is how goToTab's own sibling assumption reads too. */
const mainEnd = src.indexOf('\n  </main>');
t.check(mainEnd > 0, 'and <main> closes where the walk can stop');

const bad = [];
starts.forEach((m, i) => {
  const from = m.index;
  const to = i + 1 < starts.length ? starts[i + 1].index : mainEnd;
  const body = src.slice(from, to).replace(/<!--[\s\S]*?-->/g, ' ');
  const open = (body.match(/<div\b/g) || []).length;
  const close = (body.match(/<\/div>/g) || []).length;
  if (open !== close) bad.push(`${m[1]}: ${open} <div> vs ${close} </div>`);
});
t.check(bad.length === 0,
  `every screen closes exactly the divs it opens${bad.length ? ' — ' + bad.join(' | ') : ''}`);

/* The consequence, stated where it can be read: this is only a defect
   because goToTab uses a direct-child selector. If that ever becomes a
   descendant selector the nesting stops mattering -- and so does this
   file, which should then be deleted rather than left reassuring. */
t.check(/querySelectorAll\('main > section'\)/.test(src),
  'goToTab still hides screens by direct child, which is what makes the balance above matter');

/* Section tags themselves, counted across the whole file: an unclosed
   </section> is the same defect one level up and just as invisible. */
t.check((src.match(/<section\b/g) || []).length === (src.match(/<\/section>/g) || []).length,
  'and every <section> in the file is closed');

process.exit(t.done() ? 1 : 0);
