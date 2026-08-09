#!/usr/bin/env node
'use strict';
/*
 * The three shelves on the Sell hub.
 *
 * Each answers "what should I be pushing?" rather than "what exists?",
 * which is the question an agent has with a customer in front of them.
 * None asks the server for anything new -- promotions, cluster and the
 * catalogue's own tier teaser were all already loaded.
 *
 * The judgement calls are what this file pins, because they are what makes
 * a shelf useful rather than noise:
 *
 *   - a promotion with a month left is not urgent, and marking everything
 *     urgent teaches an agent to ignore the mark
 *   - a cluster item already earning outranks one that is close
 *   - every tiered item drops a little, so a volume shelf with no floor is
 *     just the catalogue again
 *
 * Run: node test/agent-shelves.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent shelves');
const src = read('agent.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const fmtUGX = (n) => 'UGX ' + Math.round(Number(n) || 0).toLocaleString('en-US');

let f = null, err = null;
try {
  f = compileScope(
    [
      extractFunction(src, 'bonusFlagLabel', 'agent.html'),
      extractFunction(src, 'promoEndsSoonDays', 'agent.html'),
      extractFunction(src, 'volumeDropPct', 'agent.html'),
    ],
    { fmtUGX }, ['bonusFlagLabel', 'promoEndsSoonDays', 'volumeDropPct'],
  );
  // compileScope only hands back functions, so the threshold is read from
  // the source directly rather than exported.
  f.VOLUME_SHELF_MIN_PCT = Number(/const VOLUME_SHELF_MIN_PCT = (\d+);/.exec(src)[1]);
} catch (e) { err = e; }
t.check(!!f, `the shelf helpers compile${err ? ` (${err.message})` : ''}`);

const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

if (f) {
  /* ---------- 1. what a bonus flag says ---------------------------- */
  {
    // No currency on the badge -- a corner has room for the number, and
    // every figure in this app is UGX. The % stays, because without it
    // "+3" and "+900" are the same kind of thing and one of them is three
    // shillings.
    t.check(f.bonusFlagLabel({ bonusType: 'fixed', bonusValue: 900 }) === '+900',
      'a fixed bonus is just the number');
    t.check(f.bonusFlagLabel({ bonusType: 'fixed', bonusValue: 12500 }) === '+12,500',
      'grouped, so a four-figure bonus is still readable at badge size');
    t.check(f.bonusFlagLabel({ bonusType: 'percent', bonusValue: 3 }) === '+3%',
      'and a percentage keeps its sign, or it cannot be told from money');
    t.check(f.bonusFlagLabel(null) === '', 'no promotion, no flag');
  }

  /* ---------- 2. urgency is earned, not decorative ------------------ */
  {
    t.check(f.promoEndsSoonDays({ endsAt: inDays(3) }) === 3, 'three days out is worth saying');
    t.check(f.promoEndsSoonDays({ endsAt: inDays(0) }) === 0, 'so is ending today');
    t.check(f.promoEndsSoonDays({ endsAt: inDays(40) }) === null,
      'a month out is not urgent -- marking everything urgent teaches an agent to ignore the mark');
    t.check(f.promoEndsSoonDays({ endsAt: inDays(-2) }) === null, 'and one already over says nothing');
    t.check(f.promoEndsSoonDays({}) === null, 'an open-ended promotion has no countdown');
    t.check(f.promoEndsSoonDays(null) === null, 'nor does a missing one');
  }

  /* ---------- 3. the volume shelf has a floor ----------------------- */
  {
    t.check(f.VOLUME_SHELF_MIN_PCT >= 5,
      `the drop has to be worth an argument with a customer (${f.VOLUME_SHELF_MIN_PCT}%)`);
    t.check(f.volumeDropPct({ floorPrice: 4200, bestTierPrice: 3400 }) === 19, 'a real drop is measured');
    t.check(f.volumeDropPct({ floorPrice: 32000, bestTierPrice: 31500 }) === 2,
      'and a token one is measured honestly, so the floor can exclude it');
    t.check(f.volumeDropPct({ floorPrice: 32000, bestTierPrice: 31500 }) < f.VOLUME_SHELF_MIN_PCT,
      'which it does -- 2% is not a shelf-worthy saving');

    // Nothing that is not actually a drop may reach the shelf.
    t.check(f.volumeDropPct({ floorPrice: 4200, bestTierPrice: 4200 }) === 0, 'a flat ladder is no drop');
    t.check(f.volumeDropPct({ floorPrice: 4200, bestTierPrice: 5000 }) === 0,
      'and a RISING ladder is not a saving -- reachable whenever a bigger quantity crosses into a '
      + 'wholesale tier whose markup is fatter than the retail one it left');
    t.check(f.volumeDropPct({}) === 0 && f.volumeDropPct(null) === 0, 'missing figures do not throw');
  }
}

/* ---------- 4. wired in, and only on the hub ---------------------- */
{
  ['ag_sponsoredSection', 'ag_clusterSection', 'ag_volumeSection'].forEach(id => {
    t.check(new RegExp(`id="${id}"`).test(src), `${id} exists`);
  });
  t.check(/const clusterCards = discovery \? clusterShelfItems\(\) : \[\];/.test(code)
    && /const volumeCards = discovery \? volumeShelfItems\(\) : \[\];/.test(code),
    'both new shelves are built only on the hub, like the ones already there');

  // Empty shelves must not leave a heading behind.
  t.check(/ag_clusterSection'\)\.style\.display = clusterCards\.length \? 'block' : 'none'/.test(code)
    && /ag_volumeSection'\)\.style\.display = volumeCards\.length \? 'block' : 'none'/.test(code),
    'a shelf with nothing on it is hidden, heading and all');

  // Cluster ordering: what pays today, before what pays next week.
  t.check(/\.sort\(\(a,b\)=> \(b\.eligible\?1:0\)-\(a\.eligible\?1:0\) \|\| \(a\.daysLeft\|\|0\)-\(b\.daysLeft\|\|0\)\)/.test(code),
    'the cluster shelf leads with what is already earning');
  t.check(/\.sort\(\(a,b\)=> volumeDropPct\(b\)-volumeDropPct\(a\)\)/.test(code),
    'and the volume shelf leads with the biggest drop');
}

/* ---------- 5. the naming ------------------------------------------ */
/*
 * "Sponsored for you" named who paid for the placement. An agent cares
 * what it pays THEM.
 */
{
  t.check(/Earns you a bonus/.test(src), 'the promotions shelf is named from the agent\'s side');
  // Against the markup with comments stripped: the HTML comment above that
  // section quotes the old name while explaining why it went, and matching
  // prose rather than code has caught several checks in this suite.
  const markup = src.replace(/<!--[\s\S]*?-->/g, '');
  t.check(!/Sponsored for you/.test(markup), 'not the advertiser\'s');
  t.check(/Your cluster/.test(src) && /Buy more, pay less/.test(src), 'and the other two say what they are');

  // The unit is deliberately absent from the volume note.
  t.check(/shelfNote: `from \$\{it\.bestTierMinQty\}`/.test(code),
    'the volume note carries the quantity only -- "from 20 sheet" cannot be pluralised safely across pc, ctn and bag');
}

process.exit(t.done() ? 1 : 0);
