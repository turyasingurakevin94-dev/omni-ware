#!/usr/bin/env node
'use strict';
/*
 * THE PHONE'S SHELL — the bar along the bottom, and what it carries.
 *
 * This file exists because of a specific failure. The owner approved a
 * phone design in a canvas of five artboards, and then seven build
 * sessions went into the desktop console and the phone got only what
 * fell out of them for free. The bar that shipped was the one drawn
 * before any of that: Home / Orders / Inventory / Cash / More, plus a
 * red + button in the corner.
 *
 * What was approved instead: the two loops the shop actually runs on
 * all day (selling, and the cash), the brain, and everything else. The
 * + button goes, because with Sell in the bar it is the same door twice
 * — and a floating button that covers the last line of whatever is
 * under it is a poor way to offer a door you already have.
 *
 * So these are not style assertions. Each one is a decision the owner
 * made, written down where it cannot be quietly undone by a later
 * session that never saw the canvas.
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('the phone’s shell');
const src = read('index.html');
const bar = (/<nav class="mobile-bottomnav"[\s\S]*?<\/nav>/.exec(src) || [''])[0];

/* ---------- 1. what the bar carries ---------------------------------- */
{
  t.check(!!bar, 'the phone has a bottom bar');

  const slots = [...bar.matchAll(/<button[^>]*?(?:data-tab="([a-z-]+)"|id="(mobileMoreBtn)")[^>]*>[\s\S]*?<span class="mbn-label">([^<]+)<\/span>/g)]
    .map((m) => ({ tab: m[1] || m[2], label: m[3] }));

  const expected = [
    ['dashboard', 'Today'],
    ['quote', 'Sell'],
    ['cashbook', 'Money'],
    ['manager', 'Manager'],
    ['mobileMoreBtn', 'More'],
  ];
  t.check(slots.length === 5, `five slots, in order (${slots.map((s) => s.label).join(' · ')})`);
  expected.forEach(([tab, label], i) => {
    t.check(slots[i] && slots[i].tab === tab && slots[i].label === label,
      `slot ${i + 1} is ${label} → ${tab}`);
  });

  /* Sell is New quote, not the saved list: the owner's own decision,
     taken when the + button was removed. Money is the cash book, which
     is the screen the day is closed on. */
  t.check(/data-tab="quote"[^>]*>[\s\S]{0,600}?Sell/.test(bar),
    'Sell opens New quote — the act, not the archive of it');
  t.check(/data-tab="cashbook"[^>]*>[\s\S]{0,600}?Money/.test(bar),
    'Money opens the cash book — where the day is counted');
  t.check(/data-tab="manager"/.test(bar),
    'the Manager is a destination in the bar, not an icon in a corner');
}

/* ---------- 2. the sheet is the rail minus the bar ------------------- */
{
  /* The invariant, not the list: whatever the bar carries, the sheet
     leaves out — so the two can never both grow a door to the same
     room, and neither can silently lose one. Order tracking and
     Inventory came BACK to the sheet by this arithmetic the moment they
     left the bar; nothing had to be added anywhere. */
  const declared = (/const MMS_BAR_TABS = \[([^\]]*)\]/.exec(src) || ['', ''])[1]
    .split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);
  const inBar = [...bar.matchAll(/data-tab="([a-z-]+)"/g)].map((m) => m[1]);

  t.check(declared.length === inBar.length && declared.every((d) => inBar.includes(d)),
    `MMS_BAR_TABS is exactly what the bar carries (declared ${declared.join(', ')} | bar ${inBar.join(', ')})`);
}

/* ---------- 3. More lights for the screens it is the door to --------- */
{
  /* The bar carries five of forty-one screens. On the other thirty-six
     nothing in it would be lit at all, which reads as a screen that
     arrived from nowhere. More has no data-tab, so the filter that
     lights the rest cannot reach it and it must be told. */
  const sync = (/function mmsSyncLit\(\)\{[\s\S]*?\n\}/.exec(src) || [''])[0];
  t.check(/!MMS_BAR_TABS\.includes\(currentActiveTab\)/.test(sync),
    'More is lit whenever the open screen is not one of the bar’s own');
  t.check(/sheetOpen\s*\?\s*isMore/.test(sync),
    'and while its own sheet is open, More is the ONLY thing lit — the tab underneath goes dark, or two are lit and neither is where you are');
  /* Decided in ONE place. The sheet opening, the sheet closing and a tab
     change can all happen in a single tap, and two of them writing this
     class from two places is how a bar comes to show a tab that is not
     the one you are on. */
  t.check(/\.mbn-btn'\)\.forEach/.test(sync) || /querySelectorAll\('\.mbn-btn'\)/.test(sync),
    'because it writes the whole bar, not one button of it');
  t.check(/function closeMobileMoreSheet\(\)\{[\s\S]{0,200}?mmsSyncLit\(\);/.test(src)
    && /function openMobileMoreSheet\(\)\{[\s\S]{0,200}?mmsSyncLit\(\);/.test(src),
    'both the opening and the closing go through it');
}

/* ---------- 4. the + button is gone, and stays gone ------------------ */
{
  /* Eleven references in the stylesheet and the markup, four in the
     suite. Each one had a reason; every reason was "the FAB exists".
     A rule naming an element that no longer exists is worse than no
     rule — it reads as cover for chrome that IS still escaping, which
     is exactly how the print block came to need auditing. */
  t.check(!/mobile-fab|mobileFab/.test(src),
    'the + button is gone from markup, stylesheet and script alike — Sell in the bar is the same door');
}

/* ---------- 5. filled when you are on it ----------------------------- */
{
  /* A colour change alone is a poor active state on a phone held at
     arm's length in daylight. A shape change is not, and it is what
     every phone in the shop already teaches its owner to expect. So
     every mark carries both path sets and the bar shows one. */
  const marks = [...bar.matchAll(/<svg class="mbn-icon"[\s\S]*?<\/svg>/g)];
  t.check(marks.length === 5, `all five slots carry a mark (${marks.length})`);
  t.check(marks.every((m) => /class="mbn-o"/.test(m[0]) && /class="mbn-f"/.test(m[0])),
    'and each carries both an outline set and a filled set');
  t.check(/\.mbn-icon \.mbn-f\{display:none;\}/.test(src)
    && /\.mbn-btn\.active \.mbn-icon \.mbn-o\{display:none;\}/.test(src)
    && /\.mbn-btn\.active \.mbn-icon \.mbn-f\{display:inline;\}/.test(src),
    'the swap is one rule each way — outline at rest, filled on the open tab');
  t.check(/\.mbn-icon \.sld\{fill:currentColor;stroke:none;fill-rule:evenodd;\}/.test(src),
    'and a solid shape can carry its own hole, rather than needing the bar’s background painted over itself');

  /* Every mark on the same 24 box and the same stroke as the rest of
     the app's icons, or the bar reads as five sets rather than one. */
  t.check(marks.every((m) => /viewBox="0 0 24 24"/.test(m[0])),
    'every mark is drawn on the same 24 box');
  t.check(marks.every((m) => !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(m[0])),
    'and drawn, not typed — an emoji renders differently on every phone the shop owns');
}

/* ---------- 6. the bar is still a <nav>, and still tappable ---------- */
{
  /* Load-bearing: goToTab lights buttons by querying `nav
     button[data-tab]`, and the bar is a <nav> on purpose so that one
     query reaches both it and the rail. */
  t.check(/<nav class="mobile-bottomnav"/.test(src),
    'the bar is a <nav>, so the one live query that lights the rail lights it too');
  const tap = /\.mobile-bottomnav\{[^}]*height:calc\(var\(--mobile-bottomnav-h\)/.test(src)
    && /--mobile-bottomnav-h:(\d+)px/.exec(src);
  t.check(tap && Number(tap[1]) >= 56,
    `and it is at least 56px tall, so a fifth of it is still a thumb-sized target (${tap && tap[1]}px)`);
}

process.exit(t.done() ? 1 : 0);
