# Two environments, one codebase

The redesign needs somewhere to be wrong in. Not the repo — the repo was
never the thing at risk. The database was: every copy of these apps, on
any branch and any URL, opened the same Supabase project and wrote to the
real shop's books. A morning of clicking through a redesigned order flow
would have been a morning of real orders.

So there are two Supabase projects, and the apps choose between them at
run time.

## Why the hostname decides

There is no build step here. The apps are single HTML files served
exactly as they sit in the repo, so nothing can be injected into them at
deploy time. The choice has to be made by code that is already in the
file, from something the file can read when it opens — and the only such
thing that differs between the live site and the redesign copy is the
host it was served from.

That turns out to be the property worth having. Because the rule is in
the file rather than beside it, **both branches carry the same bytes**.
There is no constant to remember to change when the redesign takes a fix
from main, and no line that conflicts every time the two merge. One
codebase, two environments, no per-branch edits.

The rule names the **production** hosts and lets everything else fall to
staging. That direction is deliberate and is pinned by
`test/environment-switch.test.js`. A list of staging hosts with
production as the default would mean any host nobody thought of — a
fresh preview URL, a renamed project, a bookmark from before a move —
writing to the real books. Getting it backwards is silent, and stays
silent until a stock count comes out wrong.

While either half is unfilled, **every host gets production**. A
half-finished switch is the dangerous one: name the staging project
without naming the live site and the live site becomes "everything else",
pointed at an empty database. So it stays inert until it is whole, which
is also why this can sit on main today doing nothing.

On staging a small red strip sits in the bottom-left corner reading
*STAGING — test data, not the real books*. It is below the dropdown layer
and cannot swallow a tap.

## Everything here is done in a browser

There is no terminal in this setup. Two of the steps below genuinely need
the Supabase CLI — pushing 95 migrations and deploying 18 edge functions
— and neither has a button in the Supabase dashboard.

So the CLI runs in CI instead. `.github/workflows/staging.yml` is a
manual workflow: the credentials are typed into GitHub's settings page,
the button is on the Actions tab, and the log is the output. It refuses
by name to touch the live project, whatever is in its secrets, so a
mistyped ref fails the run instead of running 95 migrations against the
shop's real books.

It also runs the test suite *before* deploying, and one of those tests is
that `config.toml` still agrees with the functions about which of them may
be reached without a JWT — the thing a blanket deploy gets wrong.

## Part 1 — the staging Supabase project

1. **Create the project.** supabase.com → New project, in the same
   organisation. Call it `Omni-ware staging` and choose the same region;
   a different one only adds latency you would then design around. Set a
   database password and keep it — step 3 needs it.

2. **Copy two values** from Project Settings → API: the project ref (it is
   also in the dashboard URL) and the **publishable** key. Never the
   service role key.

3. **Add three GitHub secrets.** In the repo: Settings → Secrets and
   variables → Actions → New repository secret, three times.

   | name | value |
   | --- | --- |
   | `SUPABASE_ACCESS_TOKEN` | a personal access token from supabase.com/dashboard/account/tokens |
   | `STAGING_PROJECT_REF` | the staging project ref |
   | `STAGING_DB_PASSWORD` | the database password from step 1 |

   These are write credentials for the staging project. They are not the
   live project's, and the workflow could not use them against it anyway.

4. **Run the workflow.** Actions tab → **Set up staging** → Run workflow →
   leave "both" selected → Run.

   It pushes the schema (all 95 migrations, including `0005`, which
   creates the `product-images` bucket and its policies, so storage comes
   with it) and deploys all 18 edge functions with the right JWT setting
   on each.

   If the schema step fails on the migration filenames — they are
   `0001_name`, not the 14-digit timestamps the CLI now mints — the run
   still uploads a **`staging-bootstrap-sql`** artifact at the bottom of
   the page. That is the same 95 migrations as one script: download it,
   open the staging project's SQL editor, paste, run. It ends by writing
   the bookkeeping rows `db push` would have written, so the CLI will not
   later try to apply everything a second time. Then re-run the workflow
   with **functions** selected to finish the job.

5. **Set the three safe secrets.** Edge Functions → Secrets, in the
   staging project's dashboard:

   ```
   NOTIFY_WORKER_SECRET   any new random string
   AGENT_APP_URL          https://<staging-host>/agent.html
   WORKER_APP_URL         https://<staging-host>/worker.html
   ```

   The two URLs are the staging site's own — the domain you give Vercel in
   Part 2 — so come back for these once you have it.

6. **Leave the live credentials unset — deliberately.** Do not give
   staging `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`,
   `WHATSAPP_VERIFY_TOKEN`, `AIRTEL_CALLBACK_HMAC_KEY`,
   `FIREBASE_SERVICE_ACCOUNT_JSON`, or the MTN credentials.

   A redesign that sends a real WhatsApp message to a real customer, or
   charges a real phone, has defeated the entire point of having a second
   database. Those functions failing loudly on staging is the correct
   behaviour, not a bug to chase. Add a sandbox credential only when you
   are working on that one flow, and take it out after.

7. **Allow the staging host for auth redirects.** Authentication → URL
   Configuration → Redirect URLs: add `https://<staging-host>/**`.
   Invite and password-reset links land there, and without it every invite
   you test bounces the person to the live site.

8. **Make yourself an owner and a shop.** Sign up through the staging site
   as a new owner would, and add enough products, a customer and a
   supplier to exercise a screen.

   Do **not** restore a dump of the live database. Real customer names,
   phone numbers and debts in a test system is a leak looking for
   somewhere to happen, and the redesign does not need them. If you ever
   do need production-shaped data, anonymise it on the way in.

## Part 2 — the second Vercel project

Same repository, different branch, different domain. All of this is in the
Vercel dashboard.

1. **New Project** → import `turyasingurakevin94-dev/omni-ware` again — the
   same repo, not a fork. That is what keeps one history, so a fix on main
   reaches the redesign with a merge rather than by hand. Name it
   `omni-ware-next`.
2. Settings → Git → **Production Branch**: `claude/sweet-volta-k5dwoc`.
3. Settings → **Domains**: give it a host you will actually use, so it is
   stable and can be named in the switch. A generated preview hash changes
   per deployment and cannot be. (An unnamed host still falls to staging
   by design — it just shows the strip.)
4. Settings → **Environment Variables**, for that project only:

   ```
   SUPABASE_URL=https://<staging-ref>.supabase.co
   SUPABASE_PUBLISHABLE_KEY=<staging publishable key>
   ANTHROPIC_API_KEY=<a key you are willing to spend on tests>
   ```

   The two functions in `api/` run on the server, where there is no
   hostname to read, so they switch on these. Unset means production — the
   live project needs no configuration to go on working.

Leave the existing project exactly as it is. If you find yourself editing
it, something has gone wrong.

## Part 3 — turning the switch on

Three edits, in the `OW_ENV` block at the top of each app's script. The
block is copied into five files and they must stay byte-identical;
`test/environment-switch.test.js` fails if they drift, so make the change
once and copy it, then run the tests.

In `index.html`, `agent.html`, `worker.html` (and its packaged copy
`worker-www/index.html`), `client.html` and `catalogue.html`:

```js
const STAGING = {
  name: 'staging',
  url: 'https://<staging-ref>.supabase.co',
  anon: '<staging publishable key>',     // app files only
};

const PRODUCTION_HOSTS = ['<the live host>', 'www.<the live host>'];
```

Both halves, in the same commit. Either alone does nothing, by design.

Commit this to **main** as well as the redesign branch — identical
values on both. The host decides at run time; the checkout never does.

Six byte-identical edits is a poor thing to do in GitHub's web editor, and
`environment-switch.test.js` fails the moment two of them differ. Hand the
three values to Claude and let it make the edit, run the suite and push.

After it, the packaged Android copy has to be re-synced or
`worker-packaging.test.js` will say the bundle is stale — which the same
push handles.

## Part 4 — working on the redesign

The branch is long-lived and takes fixes from main as they land:

Without a terminal, a merge is a pull request. On GitHub: New pull
request, **base** `<redesign-branch>`, **compare** `main` — that is main
*into* the redesign, which is the direction that keeps the redesign
current — then Merge.

A merge, not a rebase: the branch is shared with a deployment, and
rewriting its history invalidates every checkout of it. GitHub's web UI
only offers merges here, which is the right default. Because the
environment block is identical on both sides, it never conflicts.

CI runs all 315 test files on every push to every branch
(`.github/workflows/test.yml`, deliberately with no `paths:` filter), so
the redesign is held to the same suite as main the whole way.

Two things a UI redesign will run into, and they are both intentional:

- `.claude/skills/ow-design/SKILL.md` is the house design system — the
  two-designs law, the 23-value palette — and it is the authority, not a
  suggestion.
- `test/design-system.test.js` enforces most of it mechanically, in 1,126
  lines.

If the redesign changes the system rather than applying it, the skill and
that test are part of the redesign. Change them deliberately, in the same
commit as the screens they describe. Leaving them stale is how a design
system quietly stops meaning anything.

## Part 5 — shipping it as the main site

New pull request, **base** `main`, **compare** the redesign branch, then
Merge. CI runs the full suite on it first, as it does on every push.

That is the whole of it. The live Vercel project builds from main and the
host is unchanged, so the switch hands the merged code the production
database on the live domain, exactly as it hands it to the code there
now.

Then, when you are ready to stop:

- Delete the `omni-ware-next` Vercel project, or repoint it at a new
  branch for the next round of work.
- Keep the staging Supabase project. The next redesign will want it, and
  an empty project costs nothing.

Nothing needs to be repointed, renamed, or cut over, because the redesign
was never a different site. It was the same site, reading a different
database.

## What does not switch, and must not

- **The Android APK.** Capacitor serves the bundle from `localhost`, so
  the hostname says nothing about which database it wants. A shipped APK
  is the real shop, and the block treats `window.Capacitor` as production
  for exactly that reason. Testing the worker app against staging means a
  separate build with the block edited — not a rule that could ever make
  a worker's phone show an empty shop.
- **Live third-party credentials.** Covered above, and worth repeating:
  the WhatsApp, MTN, Airtel and Firebase secrets belong to production
  only.
- **Customer data.** Staging should be data you invented. If you ever do
  need production-shaped data, anonymise the names and phone numbers on
  the way in.
