# 07 · The stack

What this covers: the tools the new front end is built with, why each fits this shop, what they cost, and what we deliberately do not add.
Date: 2026-10-28
Status: **decided — Kevin approved all four answers in §7 on 2026-10-28**

> **Small files stay the rule.** Everything a session writes, reads and edits is in `src/`: small files, 200–500 lines, never over 1,000 (`docs/rebuild.md` rule 6). The **one page per role** in §0 is only what the build makes from them for the machines — Vercel, the phone apps, the offline cache — like an APK. Nobody edits it or needs to read it; it is made again from `src/` every time, and the size guard measures `src/`, not it.

---

## 0. The answer

| Part | Choice | Instead of |
|---|---|---|
| Language | **TypeScript**, plain annotations only (no `enum`, no `namespace`) | today's untyped JavaScript in one file per app |
| Screens | **Preact** with its hooks and **signals** (about 9 KB compressed together, measured 2026-10-28) | hand-written HTML strings redrawn whole (`render()`) |
| Build | **esbuild** and one script, `tools/build-app.js` | Vite (see Q2) |
| What ships | **one self-contained page per role**, built from `src/`, committed at the root as today (`store.html`), its first line `GENERATED from src/` | a build on Vercel (see Q3) |
| Data | **Supabase**, the same project and the same `supabase-js` (pinned) | — stays |
| Phone | **Capacitor 8** shells in `apps/<role>`, live updates of the page, push by FCM | — stays |
| Styles | plain CSS, the house tokens (`ow-design`) as CSS variables, one file per part | a CSS framework |
| Tests | the Node runner we have; the shared core imported **directly as TypeScript**; screens seen at 360 px with Playwright | — stays, minus copying functions out of HTML |

Everything else stays as it is: the database, migrations, edge functions, Vercel, GitHub Actions, the staging project.

---

## 1. What the stack has to fit

| Fact | Source | So the stack must |
|---|---|---|
| Kevin has no terminal; everything is done in a browser and GitHub Actions | `docs/environments.md` "Everything here is done in a browser" | build in CI or in a Claude session, never on Kevin's machine |
| Vercel serves the repo as it is: no build step | `docs/environments.md`; `vercel.json` has none | keep shipping finished files from the repo |
| The phone apps ship **one HTML page**, the pinned Supabase client and the fonts | `apps/store/scripts/build-www.js` | produce one self-contained page per role |
| Installed apps update by downloading the live page and switching to it | `apps/store/README.md` "Updates without a store release" | keep the page one file at the same address |
| A service worker keeps the page on the phone; data lives in IndexedDB | `store-sw.js` header | keep one page, versioned the same way |
| Yard on bad signal, cheap phones, 360 px | `CLAUDE.md`; `docs/audit/store/LOG.md` round 9 (speed) | send far less than today's 192–266 KB (compressed) per page |
| CI runs Node 22, and its tests install nothing | `.github/workflows/test.yml` | let tests import the code with no build and no `npm ci` |
| Node 22 runs `.ts` files directly when they use plain annotations only | checked 2026-10-28: a `.ts` import runs, an `enum` is refused | write TypeScript that Node can run as it is |
| No source file over 1,000 lines; a built file is measured by its `src/` | `test/file-size.test.js` (the `GENERATED from src/` rule) | build into one file, write in small ones |
| One rule, one place | `docs/rebuild.md` rules | keep the shared core in one folder every app imports |
| Any host but the live ones talks to the **staging** database | `store.html:852-857` (`PRODUCTION_HOSTS`) | try a new app away from the real books |

---

## 2. Each choice, and why

| Choice | Why it fits | Cost | Rejected, and why |
|---|---|---|---|
| **TypeScript** | Money is typed (`UGX`, an order, a line), so a wrong field is a red line before it is a wrong bill. Node 22 runs it in tests as it is. | `typescript` for the type check in CI only | JavaScript with JSDoc: weaker checks, noisier files |
| **Preact + signals** | Screens are small functions, not one `render()` of the whole page. Signals keep the phone's copy of the books on screen without a state library. About 9 KB. | 2 small packages | React: same model, about 5× the size. Lit, Svelte: fine, but a second way to think for every session |
| **esbuild** | Turns `src/` into one JS bundle in well under a second, TypeScript and JSX included, one package. The script inlines it into the page. | 1 package, 1 script (~150 lines) | **Vite** (the plan's first lean): its gain is a live dev server for a person at a terminal, which nobody here has; it runs esbuild inside anyway. Q2. |
| **Committed built pages** | Vercel, the APK builds, live updates and the service workers keep working untouched. A check fails if a page is not what `src/` builds. | the check needs `npm ci`, so it runs in its own workflow | Building on Vercel: changes the live deploy and the APK builds at once. Q3. |
| **Supabase as now** | One database (rule 1). Every write that matters is a server function, so the rule lives once, in SQL. | none | — |
| **Plain CSS + tokens** | The design language is already tokens and parts (`ow-design`); CSS variables carry them as they are. | none | Tailwind: a second vocabulary beside the tokens |
| **Playwright at 360 px** | Already on the session machines; the design rule is "every state, at 360 px". | none in CI (sessions only) | screenshot tests in CI: slow, flaky on fonts |

**Not added**, on purpose: a router library (one screen stack per app), a state library beyond signals, a UI kit, an ORM, server rendering (Next.js), React Native. Each would be a second way to do something we already do.

---

## 3. Where the code lives

```
src/
  core/        the shared rules, once: money (02), the order's journey (01),
               data and offline sync (06), log in, pushes. Plain TypeScript,
               no screens. Tests import it directly.
  ui/          the screen parts from the canvases: buttons, rows, the slide,
               chips, sheets, the navy hero. One part per file.
  apps/store/  the Store's screens (phase 4 starts here), then sales/, buyer/,
               manager/, accounts/.
tools/build-app.js   src/apps/<role> -> <role>.html at the root (one file)
tsconfig.json        strict; plain annotations only (erasableSyntaxOnly)
```

Each file stays at 200–500 lines; the size guard measures `src/`, not the built page.

---

## 4. Budgets

| Measure | Today (Store) | New app |
|---|---|---|
| Page, compressed | 208 KB (`store.html`, 773 KB raw) | **at most 80 KB**, Preact included |
| Supabase client | 54 KB, cached once | same file, same cache |
| Largest source file | 6,296 lines | 500 (hard limit 1,000) |
| A rule written in more than one app | money block in 4 apps | 0 |

The build check (§6) fails a page that goes over budget.

---

## 5. How a new app goes live

1. Built on a branch; seen at 360 px in every state (the canvas states) with Playwright, against **staging**.
2. Merged to `main` as **`/next/<role>.html`** — the old page untouched. On the live host it uses the live books, so it is tried by the role's own people for a day or two, with the old app beside it.
3. The switch: `<role>.html` becomes the built page (one commit). Installed phones pick it up through their live update. `next/` goes.
4. The old page stays one release as `/old/<role>.html`, then goes: the **retire list** in `docs/rebuild.md` dates it, and `test/retire-list.test.js` fails once it is late, if an old-app test is left behind, or if anything in `src/` reads an old page.

Vercel builds no preview for `claude/**` branches (`vercel.json`), so step 1 runs from the session's own server, which the host rule sends to staging.

---

## 6. What it costs

| Adds | Count |
|---|---|
| Packages | 4: `preact`, `@preact/signals` (shipped); `esbuild`, `typescript` (build only) |
| Files to start | `tools/build-app.js`, `tsconfig.json`, `package.json` scripts, one workflow (`build-check.yml`: install, type check, pages match `src/`, budgets), one test |
| Makes harder | there is now a build: a page changed by hand is overwritten. The check makes that a red run, not a surprise. |
| Makes easier | one rule in one place; tests on the real code, not copies cut out of HTML; screens a session can read whole |

---

## 7. Decided (Kevin, 2026-10-28)

| # | Question | Decided |
|---|---|---|
| Q1 | Approve the stack in §0? | **Yes** |
| Q2 | esbuild alone, or Vite as the plan first leaned? | **esbuild**: one package, same compiler, nothing we would use is missing |
| Q3 | Commit the built pages (as today), or build on Vercel? | **Commit**: nothing that ships today changes |
| Q4 | Try each new app at `/next/<role>.html` on the live site for a day before the switch? | **Yes** |
