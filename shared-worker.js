// Shared between index.html (the admin app's "Worker view" tab) and
// worker.html (the standalone worker app) -- this is the actual pick &
// pack UI/logic, iterated on heavily, that both apps must stay identical
// on. It expects the HOST page to already have declared these globals
// before this script runs any of its top-level side effects: `sb`,
// `data`, `saveData`, `currentShopId`, `currentUser`, `currentMemberRole`,
// `myStaff`, `hasPushSubscription`,
// `initialAuthLinkType`, `lastSynced` -- plus the matching DOM elements
// (#toast, #wv_pendingWrap, #wv_activeWrap, #wv_enablePushWrap,
// #wv_enablePushBtn, #wv_pageHead, #wv_signout_btn, #authOverlay mount
// point via ensureAuthOverlay()).

/* ---------------- Small generic utilities ---------------- */

function esc(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function toast(msg, duration){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._h);
  toast._h = setTimeout(()=>t.classList.remove('show'), duration || 2200);
}

function cloneJSON(x){ return x === undefined ? x : JSON.parse(JSON.stringify(x)); }

function keyRowsById(rows, field){
  const m = {};
  rows.forEach(r=> m[String(r[field])] = cloneJSON(r));
  return m;
}

/* Two safety latches, set by the host app around a save:
   - syncAbsentCollections: collections MISSING from `data` this save (a
     partial rebuild, an old backup, a bug). Absence is not emptiness --
     addDiffOps refuses to speak for them rather than reading the gap as
     "delete every row".
   - __owAllowMassDelete: raised only around an INTENTIONAL wipe (the
     typed-out Clear, a backup restore) so the mass-delete breaker below
     does not interrogate a deliberate act collection by collection. */
let syncAbsentCollections = null;
let __owAllowMassDelete = false;

// Diffs `rows` (keyed by `idField`) against lastSynced[collectionKey] and
// pushes at most one upsert op and one delete op onto `ops` for whatever
// actually changed. Each op carries its own commit(), so lastSynced only
// advances for the parts of the write that actually succeeded -- a part
// that fails gets re-diffed (and retried) on the next save call.
// opts.neverDelete is for a caller that has no way to remove a row at all.
// A delete there is not an instruction, it is the symptom of `data` and
// `lastSynced` having drifted apart -- and the diff turns that into "delete
// everything the snapshot still remembers".
function addDiffOps(ops, collectionKey, tableName, idField, shopId, rows, opts){
  if(syncAbsentCollections && syncAbsentCollections.has(collectionKey)){
    console.error(`REFUSING to sync ${collectionKey}: the collection is absent from data — a partial data object is not an instruction to empty the shop`);
    return;
  }
  const prev = lastSynced[collectionKey] || (lastSynced[collectionKey] = {});
  const currById = {};
  rows.forEach(r=> currById[String(r[idField])] = r);

  const toUpsert = rows.filter(r=> JSON.stringify(r) !== JSON.stringify(prev[String(r[idField])]));
  const removedKeys = Object.keys(prev).filter(k=> !(k in currById));
  const toDeleteValues = removedKeys.map(k=> prev[k][idField]);

  if(toUpsert.length){
    ops.push({
      run: ()=> sb.from(tableName).upsert(toUpsert),
      commit: ()=> toUpsert.forEach(r=> prev[String(r[idField])] = cloneJSON(r))
    });
  }
  if(toDeleteValues.length){
    if(opts && opts.neverDelete){
      // Deliberately does not touch `prev`. Leaving lastSynced alone means
      // the next refresh -- which rebuilds both together -- puts them back
      // in step on its own, and until it does this keeps saying so on every
      // save rather than going quiet about a shop's orders being one bug
      // away from deletion.
      console.error(`Refusing to delete ${toDeleteValues.length} ${tableName} row(s): this app never removes them, so data and lastSynced have drifted`, toDeleteValues);
      return;
    }
    /* The mass-delete breaker. Deleting a row or two is normal work;
       deleting ten, or half of what the snapshot remembers, is almost
       always the sync about to repeat the wipes (products deleted 11
       times over, orders 174, before this existed). Ask the human in
       plain words. Blocking is recoverable -- the rows are still on the
       server and the next honest diff can try again; deleting is not. */
    const remembered = Object.keys(prev).length;
    const massDelete = toDeleteValues.length >= 10
      || (toDeleteValues.length >= 3 && toDeleteValues.length * 2 >= remembered);
    if(massDelete && !__owAllowMassDelete){
      const ok = (typeof confirm === 'function') && confirm(`This save wants to permanently DELETE ${toDeleteValues.length} of the shop's ${remembered} ${tableName.replace(/_/g,' ')} record(s) — from the server, for every device and every member.\n\nUnless you just deleted these yourself on purpose, something has gone wrong and you should press Cancel.\n\nDelete them?`);
      if(!ok){
        console.error(`Mass delete of ${toDeleteValues.length} ${tableName} row(s) BLOCKED — not confirmed by the user`, toDeleteValues);
        return;
      }
    }
    ops.push({
      run: ()=> sb.from(tableName).delete().eq('shop_id', shopId).in(idField, toDeleteValues),
      commit: ()=> removedKeys.forEach(k=> delete prev[k])
    });
  }
}

// Once a quote has been marked invoiced for 24 hours, it should stop
// cluttering active views. Uses q.invoicedTs (a precise timestamp) rather
// than q.invoicedAt (a display-only date string) so the cutoff is accurate.
const SQ_BOARD_HIDE_AFTER_MS = 24*60*60*1000;
function quoteAgedOffBoard(q){
  return !!(q.invoiced && q.invoicedTs && (Date.now() - q.invoicedTs) >= SQ_BOARD_HIDE_AFTER_MS);
}

// Which photo actually represents a product (and, for a variable product,
// one specific variant of it): that variant's own photo if it has one,
// else the product's own photo, else this product's category's shared
// default, else nothing (callers fall back to a placeholder icon).
// Shared by both host apps -- worker.html's slimmer product fetch simply
// never populates `.variants`/`.category`, so those branches just no-op
// there and it degrades to today's plain `.image` lookup.
function resolveProductImage(p, variantIdx){
  if(!p) return null;
  if(variantIdx!=null && Array.isArray(p.variants) && p.variants[variantIdx] && p.variants[variantIdx].image) return p.variants[variantIdx].image;
  if(p.image) return p.image;
  const cat = p.category && data.presetCategories ? data.presetCategories.find(c=>c.name===p.category) : null;
  return (cat && cat.image) || null;
}
function ipStageThumbHTML(product, variantIdx){
  const src = resolveProductImage(product, variantIdx);
  if(src) return `<img class="q-stage-thumb img-zoomable" src="${src}" alt="${esc(product.name)}">`;
  return `<div class="q-stage-thumb-placeholder"><svg class="icon" viewBox="0 0 24 24"><path d="M4 16l4.5-4.5a2 2 0 0 1 2.8 0L16 16M14 14l1.5-1.5a2 2 0 0 1 2.8 0L21 16M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM9 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg></div>`;
}

/* ---------------- Auth + shop membership bootstrap ---------------- */

/* The overlay every auth step draws into.

   The default look is re-applied on every call, not just on creation.
   showLoginScreen paints its own ground over it, and the steps that can
   follow a sign-in -- set a password, create a shop, pick a shop -- reuse
   this same element. Without the reset, whichever of those came next
   inherited the login screen's layout and its own inline styles landed on
   top of it, half applied. */
function ensureAuthOverlay(){
  let el = document.getElementById('authOverlay');
  if(!el){
    el = document.createElement('div');
    el.id = 'authOverlay';
    document.body.appendChild(el);
  }
  el.className = '';
  el.removeAttribute('data-role');
  el.style.cssText = 'position:fixed;inset:0;background:#14171B;color:#DCE0E4;display:flex;align-items:center;justify-content:center;z-index:99999;font-family:system-ui,-apple-system,sans-serif;';
  return el;
}
function hideAuthOverlay(){
  const el = document.getElementById('authOverlay');
  if(el) el.remove();
}

// Authoritative "am I really logged in" check. sb.auth.getSession() only
// reads whatever's cached in local storage and does NOT talk to the
// server -- a stale, corrupted, or not-yet-fully-established session can
// make it return a truthy session object even when there's no valid user
// server-side, which is exactly what let ensureAuthAndShop() skip the
// login screen while every subsequent write got rejected by RLS
// (auth.uid() NULL). getUser() re-validates the JWT against Supabase Auth
// before returning, so it's the only safe gate for this decision.
async function getAuthedUser(){
  const { data, error } = await sb.auth.getUser();
  if(error || !data || !data.user) return null;
  return data.user;
}

/* ---------------- The sign-in screens ----------------

   Two apps load this file and they are two different jobs, so they get
   two different doors.

   Everything below is written in literal hex and ships its own <style>.
   It cannot read the host's design tokens: --ow-steel-950 exists in
   index.html and not in worker.html, and a var() that resolves to
   nothing takes its whole declaration with it -- which is how the admin
   board's Assign button once turned white-on-white. A sign-in screen is
   the one surface with no app behind it to fall back on, so it depends
   on nothing but itself.

   The display face is the one the host already loads -- Archivo Black in
   the admin app, Manrope in the worker app. Naming both in one stack
   means each app's door is set in that app's own voice and neither pays
   for a font it does not already have.

   The look comes from the yard rather than from software: mabati, the
   corrugated iron every hardware shop in Kampala sells and is roofed
   with. Pressed into the ground as light-mid-shadow-mid bands so it
   reads as sheet metal rather than as stripes. */
function authAppRole(){
  // Declared by the host below this file in load order, so it is read at
  // call time rather than parse time. Admin is the safe default: it is
  // the only app that can legitimately create an account.
  return (typeof OW_APP_ROLE !== 'undefined' && OW_APP_ROLE === 'worker') ? 'worker' : 'admin';
}
function injectAuthStyles(){
  if(document.getElementById('owAuthStyles')) return;
  const s = document.createElement('style');
  s.id = 'owAuthStyles';
  s.textContent = `
  #authOverlay.ow-auth{padding:0;display:block;overflow-y:auto;}
  .ow-auth *{box-sizing:border-box;}
  .ow-auth .oa-shell{min-height:100%;display:flex;}
  .ow-auth .oa-form{display:flex;flex-direction:column;}
  .ow-auth label{
    display:block;font-size:11px;font-weight:700;letter-spacing:.08em;
    text-transform:uppercase;margin:0 0 6px;
  }
  .ow-auth input{
    width:100%;font-family:inherit;font-size:16px;border-radius:9px;
    border:1px solid;outline:none;transition:border-color .15s,box-shadow .15s;
  }
  .ow-auth input::placeholder{opacity:.55;}
  .ow-auth .oa-field + .oa-field{margin-top:14px;}
  .ow-auth button{
    all:unset;box-sizing:border-box;cursor:pointer;display:flex;
    align-items:center;justify-content:center;width:100%;
    border-radius:9px;font-family:inherit;font-weight:700;
    transition:background .15s,color .15s,opacity .15s;
  }
  .ow-auth button:disabled{opacity:.55;cursor:default;}
  .ow-auth .oa-status{
    min-height:18px;font-size:13px;line-height:1.4;margin:14px 0 0;
  }
  .ow-auth .oa-status:empty{margin:0;min-height:0;}
  .ow-auth .oa-ghost{background:transparent;font-weight:600;font-size:13.5px;}

  /* ---- admin: the yard at first light ---------------------------- */
  .ow-auth[data-role="admin"]{
    background:#14171B;color:#DCE0E4;
    font-family:'Inter',system-ui,-apple-system,sans-serif;
  }
  .ow-auth[data-role="admin"] .oa-shell{align-items:stretch;}
  .ow-auth[data-role="admin"] .oa-side{
    flex:1 1 46%;display:flex;flex-direction:column;justify-content:space-between;
    padding:48px 44px;position:relative;overflow:hidden;
    background:#101317;border-right:1px solid #22272E;
  }
  /* Mabati. Vertical, low contrast, behind everything. */
  .ow-auth[data-role="admin"] .oa-side::before{
    content:'';position:absolute;inset:0;pointer-events:none;
    background:repeating-linear-gradient(90deg,
      rgba(255,255,255,.050) 0px, rgba(255,255,255,.012) 9px,
      rgba(0,0,0,.16) 20px, rgba(0,0,0,.055) 27px,
      rgba(255,255,255,.050) 36px);
  }
  .ow-auth[data-role="admin"] .oa-side > *{position:relative;}
  .ow-auth[data-role="admin"] .oa-mark{
    display:inline-flex;align-items:center;gap:11px;
  }
  .ow-auth[data-role="admin"] .oa-mark i{
    width:34px;height:34px;border-radius:9px;background:#B23A26;color:#fff;
    display:flex;align-items:center;justify-content:center;font-style:normal;
    font-family:'Archivo Black','Manrope',system-ui,sans-serif;font-size:13px;
  }
  .ow-auth[data-role="admin"] .oa-mark span{
    font-family:'Archivo Black','Manrope',system-ui,sans-serif;
    font-size:17px;letter-spacing:.3px;color:#fff;
  }
  .ow-auth[data-role="admin"] .oa-pitch{
    font-family:'Archivo Black','Manrope',system-ui,sans-serif;
    font-size:clamp(30px,4.2vw,46px);line-height:1.04;color:#fff;
    margin:0;letter-spacing:-.4px;text-wrap:balance;
  }
  .ow-auth[data-role="admin"] .oa-pitch em{font-style:normal;color:#C9573F;}
  .ow-auth[data-role="admin"] .oa-sub{
    margin:16px 0 0;font-size:14px;line-height:1.6;color:#8A939C;max-width:34ch;
  }
  .ow-auth[data-role="admin"] .oa-foot{font-size:11.5px;color:#5D666F;letter-spacing:.02em;}
  .ow-auth[data-role="admin"] .oa-main{
    flex:1 1 54%;display:flex;align-items:center;justify-content:center;padding:40px 32px;
  }
  .ow-auth[data-role="admin"] .oa-card{
    width:100%;max-width:380px;background:#1B1F25;border:1px solid #2A3038;
    border-radius:14px;padding:30px 30px 26px;
    box-shadow:0 24px 60px rgba(0,0,0,.45);position:relative;
  }
  /* Primer on a cut edge. */
  .ow-auth[data-role="admin"] .oa-card::before{
    content:'';position:absolute;left:22px;right:22px;top:-1px;height:3px;
    background:#B23A26;border-radius:0 0 3px 3px;
  }
  .ow-auth[data-role="admin"] h1{
    margin:0 0 4px;font-size:19px;font-weight:700;color:#fff;letter-spacing:-.2px;
  }
  .ow-auth[data-role="admin"] .oa-hint{margin:0 0 22px;font-size:13px;color:#8A939C;}
  .ow-auth[data-role="admin"] label{color:#8A939C;}
  .ow-auth[data-role="admin"] input{
    padding:12px 13px;background:#12151A;border-color:#333A43;color:#F2F4F6;
  }
  .ow-auth[data-role="admin"] input:focus{border-color:#B23A26;box-shadow:0 0 0 3px rgba(178,58,38,.22);}
  .ow-auth[data-role="admin"] .oa-primary{
    background:#B23A26;color:#fff;padding:13px;margin-top:20px;font-size:14.5px;
  }
  .ow-auth[data-role="admin"] .oa-primary:hover:not(:disabled){background:#C9573F;}
  .ow-auth[data-role="admin"] .oa-secondary{
    background:transparent;color:#DCE0E4;padding:12px;margin-top:9px;
    font-size:14px;box-shadow:inset 0 0 0 1px #333A43;
  }
  .ow-auth[data-role="admin"] .oa-secondary:hover:not(:disabled){background:#22272E;}
  .ow-auth[data-role="admin"] .oa-ghost{color:#8A939C;padding:11px;margin-top:4px;}
  .ow-auth[data-role="admin"] .oa-ghost:hover{color:#DCE0E4;}
  @media (max-width:820px){
    .ow-auth[data-role="admin"] .oa-shell{flex-direction:column;}
    .ow-auth[data-role="admin"] .oa-side{
      flex:0 0 auto;padding:30px 26px 26px;border-right:0;border-bottom:1px solid #22272E;
    }
    .ow-auth[data-role="admin"] .oa-pitch{font-size:27px;margin-top:22px;}
    .ow-auth[data-role="admin"] .oa-sub{font-size:13.5px;margin-top:10px;}
    .ow-auth[data-role="admin"] .oa-foot{display:none;}
    .ow-auth[data-role="admin"] .oa-main{padding:26px 20px 40px;}
  }

  /* ---- worker: painted steel, read in the sun -------------------- */
  /* Light on purpose. This is a phone held at arm's length in a yard at
     midday, where a dark screen is a mirror. */
  .ow-auth[data-role="worker"]{
    background:#E9EBED;color:#14171B;
    font-family:'Inter',system-ui,-apple-system,sans-serif;
  }
  .ow-auth[data-role="worker"] .oa-shell{flex-direction:column;}
  .ow-auth[data-role="worker"] .oa-band{
    background:#B23A26;color:#fff;padding:30px 24px 34px;position:relative;overflow:hidden;
  }
  .ow-auth[data-role="worker"] .oa-band::before{
    content:'';position:absolute;inset:0;pointer-events:none;
    background:repeating-linear-gradient(90deg,
      rgba(255,255,255,.10) 0px, rgba(255,255,255,.025) 9px,
      rgba(0,0,0,.13) 20px, rgba(0,0,0,.04) 27px,
      rgba(255,255,255,.10) 36px);
  }
  .ow-auth[data-role="worker"] .oa-band > *{position:relative;}
  .ow-auth[data-role="worker"] .oa-mark{
    font-family:'Manrope','Archivo Black',system-ui,sans-serif;
    font-weight:800;font-size:13px;letter-spacing:.16em;text-transform:uppercase;
    opacity:.85;margin:0 0 10px;
  }
  .ow-auth[data-role="worker"] .oa-pitch{
    font-family:'Manrope','Archivo Black',system-ui,sans-serif;
    font-weight:800;font-size:clamp(26px,7.4vw,34px);line-height:1.1;
    margin:0;letter-spacing:-.3px;
  }
  .ow-auth[data-role="worker"] .oa-main{
    flex:1;display:flex;justify-content:center;padding:26px 22px 40px;
  }
  .ow-auth[data-role="worker"] .oa-card{width:100%;max-width:420px;}
  .ow-auth[data-role="worker"] .oa-hint{
    margin:0 0 22px;font-size:14.5px;line-height:1.55;color:#59626B;
  }
  .ow-auth[data-role="worker"] label{color:#59626B;font-size:12px;}
  .ow-auth[data-role="worker"] input{
    padding:16px 15px;background:#fff;border-color:#CFD5DA;color:#14171B;
    font-size:17px;min-height:56px;
  }
  .ow-auth[data-role="worker"] input:focus{border-color:#B23A26;box-shadow:0 0 0 3px rgba(178,58,38,.18);}
  .ow-auth[data-role="worker"] .oa-primary{
    background:#B23A26;color:#fff;min-height:56px;margin-top:24px;font-size:17px;
  }
  .ow-auth[data-role="worker"] .oa-primary:active:not(:disabled){background:#8E2C1C;}
  .ow-auth[data-role="worker"] .oa-ghost{
    color:#59626B;min-height:48px;margin-top:10px;font-size:14.5px;
  }
  .ow-auth[data-role="worker"] .oa-help{
    margin:26px 0 0;padding-top:18px;border-top:1px solid #D7DBDF;
    font-size:13px;line-height:1.6;color:#59626B;
  }

  @media (prefers-reduced-motion:reduce){
    .ow-auth *{transition:none !important;}
  }`;
  document.head.appendChild(s);
}

function showLoginScreen(){
  return new Promise((resolve)=>{
    const role = authAppRole();
    injectAuthStyles();
    const el = ensureAuthOverlay();
    el.className = 'ow-auth';
    el.setAttribute('data-role', role);
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;';

    /* Only the admin app offers "Create account", and that is a fix
       rather than a trim. A worker reaching this screen was invited to a
       shop that already exists; creating an account here makes a login
       attached to no shop at all, which lands them on the dead-end
       no-shop screen with nothing to do. The button was an invitation to
       get stuck. */
    const isAdmin = role === 'admin';
    el.innerHTML = isAdmin ? `
      <div class="oa-shell">
        <aside class="oa-side">
          <div class="oa-mark"><i>OW</i><span>Omni-Ware</span></div>
          <div>
            <h2 class="oa-pitch">Every bag, every shilling, <em>one board.</em></h2>
            <p class="oa-sub">Stock, prices, orders, the cash book and the people who move it — the whole shop, in one place.</p>
          </div>
          <div class="oa-foot">Hardware shop management · Uganda</div>
        </aside>
        <main class="oa-main">
          <div class="oa-card">
            <h1>Sign in</h1>
            <p class="oa-hint">Use the email your shop is registered to.</p>
            <div class="oa-form">
              <div class="oa-field">
                <label for="auth_email">Email</label>
                <input id="auth_email" type="email" autocomplete="username" placeholder="you@example.com">
              </div>
              <div class="oa-field">
                <label for="auth_password">Password</label>
                <input id="auth_password" type="password" autocomplete="current-password" placeholder="••••••••">
              </div>
              <div class="oa-status" id="auth_status" role="status" aria-live="polite"></div>
              <button id="auth_signin_btn" class="oa-primary">Sign in</button>
              <button id="auth_signup_btn" class="oa-secondary">Create a new shop</button>
              <button id="auth_forgot_btn" type="button" class="oa-ghost">Forgot password?</button>
            </div>
          </div>
        </main>
      </div>` : `
      <div class="oa-shell">
        <header class="oa-band">
          <p class="oa-mark">Omni-Ware</p>
          <h2 class="oa-pitch">Sign in to pick and pack.</h2>
        </header>
        <main class="oa-main">
          <div class="oa-card">
            <p class="oa-hint">Today's orders, what to pull off the shelf, and where each one is going.</p>
            <div class="oa-form">
              <div class="oa-field">
                <label for="auth_email">Email</label>
                <input id="auth_email" type="email" autocomplete="username" inputmode="email" placeholder="you@example.com">
              </div>
              <div class="oa-field">
                <label for="auth_password">Password</label>
                <input id="auth_password" type="password" autocomplete="current-password" placeholder="••••••••">
              </div>
              <div class="oa-status" id="auth_status" role="status" aria-live="polite"></div>
              <button id="auth_signin_btn" class="oa-primary">Sign in</button>
              <button id="auth_forgot_btn" type="button" class="oa-ghost">Forgot password?</button>
            </div>
            <p class="oa-help">No account yet? Your manager adds you from the shop's Staff tab, and you'll get an email invite.</p>
          </div>
        </main>
      </div>`;
    // The worker screen has no signup button; every reference below is
    // guarded so one markup can drive both without a null blowing up the
    // only screen standing between a person and their work.
    const signupBtn = el.querySelector('#auth_signup_btn');
    const signinBtn = el.querySelector('#auth_signin_btn');
    const statusEl = el.querySelector('#auth_status');
    const setStatus = (msg, kind)=>{
      statusEl.textContent = msg;
      statusEl.style.color = kind==='ok' ? '#1C6B58' : kind==='busy' ? '#8A939C' : '#C9573F';
    };
    const busy = (on)=>{
      signinBtn.disabled = on;
      if(signupBtn) signupBtn.disabled = on;
    };
    const doAuth = async (mode)=>{
      const email = el.querySelector('#auth_email').value.trim();
      const password = el.querySelector('#auth_password').value;
      if(!email || !password){ setStatus('Enter an email and password', 'err'); return; }
      busy(true);
      setStatus(mode==='signup' ? 'Creating account…' : 'Signing in…', 'busy');
      const { error } = mode==='signup'
        ? await sb.auth.signUp({email, password})
        : await sb.auth.signInWithPassword({email, password});
      if(error){
        busy(false);
        setStatus(error.message, 'err');
        return;
      }
      // Confirm there's a real, server-validated user before declaring
      // success -- a signUp() on a project with email confirmation ON
      // returns no error but also no usable session yet.
      const user = await getAuthedUser();
      busy(false);
      if(!user){
        setStatus('Check your email to confirm your account, then sign in.', 'err');
        return;
      }
      setStatus('Signed in — loading your shop…', 'ok');
      resolve();
    };
    signinBtn.addEventListener('click', ()=>doAuth('signin'));
    if(signupBtn) signupBtn.addEventListener('click', ()=>doAuth('signup'));
    // Enter submits from either field. On a phone the keyboard's own "go"
    // key is the obvious way to finish, and it did nothing.
    ['auth_email','auth_password'].forEach(id=>{
      el.querySelector('#'+id).addEventListener('keydown', (e)=>{
        if(e.key==='Enter'){ e.preventDefault(); doAuth('signin'); }
      });
    });
    el.querySelector('#auth_forgot_btn').addEventListener('click', async ()=>{
      const email = (el.querySelector('#auth_email').value||'').trim();
      if(!email){ setStatus('Enter your email above first, then tap "Forgot password?"', 'err'); return; }
      setStatus('Sending reset link…', 'busy');
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      setStatus(error ? error.message : 'Check your email for a password reset link.', error ? 'err' : 'ok');
    });
    el.querySelector('#auth_email').focus();
  });
}

// Shown right after a fresh session was established from an invite or
// password-reset email link (see initialAuthLinkType) -- those links log
// the user in but never set a password, so without this step a worker
// would have no way to sign back in once that one-time session expires.
function showSetPasswordScreen(){
  return new Promise((resolve)=>{
    const el = ensureAuthOverlay();
    el.innerHTML = `
      <div style="background:#1c1c1c;padding:32px;border-radius:12px;width:320px;max-width:90vw;color:#eee;font-family:sans-serif;">
        <h2 style="margin:0 0 8px;font-size:18px;">Set your password</h2>
        <p style="margin:0 0 16px;font-size:13px;color:#aaa;">Choose a password so you can sign back in next time.</p>
        <input id="setpw_pw1" type="password" autocomplete="new-password" placeholder="New password" style="width:100%;padding:10px;margin-bottom:8px;border-radius:6px;border:1px solid #444;background:#111;color:#eee;box-sizing:border-box;">
        <input id="setpw_pw2" type="password" autocomplete="new-password" placeholder="Confirm password" style="width:100%;padding:10px;margin-bottom:8px;border-radius:6px;border:1px solid #444;background:#111;color:#eee;box-sizing:border-box;">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:#aaa;margin-bottom:12px;cursor:pointer;">
          <input type="checkbox" id="setpw_show">
          Show password
        </label>
        <div id="setpw_error" style="color:#f66;font-size:13px;margin-bottom:8px;min-height:16px;"></div>
        <button id="setpw_save_btn" style="width:100%;padding:10px;border-radius:6px;border:none;background:#2F7FBF;color:#fff;cursor:pointer;">Save password</button>
      </div>`;
    const errEl = el.querySelector('#setpw_error');
    el.querySelector('#setpw_show').addEventListener('change', (e)=>{
      const t = e.target.checked ? 'text' : 'password';
      el.querySelector('#setpw_pw1').type = t;
      el.querySelector('#setpw_pw2').type = t;
    });
    const saveBtn = el.querySelector('#setpw_save_btn');
    saveBtn.addEventListener('click', async ()=>{
      errEl.textContent = '';
      const pw1 = el.querySelector('#setpw_pw1').value;
      const pw2 = el.querySelector('#setpw_pw2').value;
      if(pw1.length < 6){ errEl.textContent = 'Password must be at least 6 characters'; return; }
      if(pw1 !== pw2){ errEl.textContent = 'Passwords do not match'; return; }
      saveBtn.disabled = true;
      try{
        const { error } = await sb.auth.updateUser({ password: pw1 });
        if(error){ saveBtn.disabled = false; errEl.textContent = error.message; return; }
        resolve();
      }catch(e){
        saveBtn.disabled = false;
        errEl.textContent = (e && e.message) || String(e);
      }
    });
  });
}

// Only reachable if a login has zero shop_members rows -- normal signup
// (admin app) creates one immediately, and invited workers already have
// one from invite-worker, so in practice this is a rare fallback rather
// than the worker app's main path. seedData() (the full default price
// book) only exists in the admin app; the worker app has nothing sensible
// to seed, so it just starts that shop with an empty savedQuotes list.
// A shop row whose shop_members row never landed is stranded for good: the
// picker reads shop_members so it never appears, and "owners can delete
// shop" needs an owner membership row that does not exist, so nobody --
// including its creator -- can remove it. Only 0004's `created_by =
// auth.uid()` branch on the shops select policy makes it visible at all.
//
/* The Create-shop era is over. Shop creation was the one door a stranger
   could walk through: with email verification off, any visitor to the
   login page could sign up and be OFFERED a blank shop — and the old RLS
   policy let them take it (one did; deleted 2026-08-07, and migration
   0059 locked the door server-side). A new shop is created by the
   operator in the Supabase SQL editor, never from a login screen. An
   account with no membership is told to ask the owner — the same dead
   end the worker app already gives, with its own wording. Deliberately
   never resolves: there is nothing to load behind it. */
function showNoShopDefaultScreen(){
  return new Promise(()=>{
    const el = ensureAuthOverlay();
    el.innerHTML = `
      <div style="background:#1c1c1c;padding:32px;border-radius:12px;width:320px;max-width:90vw;color:#eee;font-family:sans-serif;text-align:center;">
        <h2 style="margin:0 0 8px;font-size:18px;">No shop on this account</h2>
        <p style="margin:0 0 18px;font-size:13px;color:#aaa;line-height:1.5;">This login isn't a member of any shop. If you work here, ask the shop owner to add you — shops can't be created from this screen.</p>
        <button id="noshop_signout_btn" style="width:100%;padding:10px;border-radius:6px;border:1px solid #444;background:transparent;color:#eee;cursor:pointer;">Sign out</button>
      </div>`;
    // A way out, since this is a dead end otherwise -- most often reached
    // by signing in with the wrong account.
    document.getElementById('noshop_signout_btn').addEventListener('click', signOutAndReload);
  });
}

function showShopPicker(memberships){
  return new Promise((resolve)=>{
    const el = ensureAuthOverlay();
    // Shop names are free text typed by whoever created the shop, and this
    // list is the one place they are rendered. Unescaped, a shop you were
    // invited to could inject markup into your own picker.
    const options = memberships.map(m=>`<option value="${esc(m.shop_id)}">${esc((m.shops && m.shops.name) || m.shop_id)}</option>`).join('');
    el.innerHTML = `
      <div style="background:#1c1c1c;padding:32px;border-radius:12px;width:320px;max-width:90vw;color:#eee;font-family:sans-serif;">
        <h2 style="margin:0 0 16px;font-size:18px;">Choose a shop</h2>
        <select id="shop_select" style="width:100%;padding:10px;margin-bottom:12px;border-radius:6px;border:1px solid #444;background:#111;color:#eee;box-sizing:border-box;">${options}</select>
        <button id="shop_pick_btn" style="width:100%;padding:10px;border-radius:6px;border:none;background:#2F7FBF;color:#fff;cursor:pointer;">Continue</button>
      </div>`;
    el.querySelector('#shop_pick_btn').addEventListener('click', ()=>{
      resolve(el.querySelector('#shop_select').value);
    });
  });
}

async function ensureAuthAndShop(){
  let user = await getAuthedUser();
  if(!user){
    await showLoginScreen();
    user = await getAuthedUser();
    // showLoginScreen() only resolves after its own getAuthedUser() check
    // passed, so this should always succeed -- but never trust a session
    // enough to skip re-checking right before using it for a write.
    if(!user) throw new Error('Sign-in did not complete');
  } else if(initialAuthLinkType==='invite' || initialAuthLinkType==='recovery'){
    // An invite/reset link just logged this session in without a password
    // ever being set -- make them choose one now, or they'd have no way
    // back in once this one-time link's session eventually expires.
    await showSetPasswordScreen();
  }
  currentUser = user;

  const { data: memberships, error } = await sb.from('shop_members').select('shop_id, role, shops(name)').eq('user_id', user.id);
  if(error) throw error;
  // The shop's own name was already being fetched here and only used to
  // label the picker. It is what belongs at the top of a quotation or an
  // invoice -- a customer has no reason to care what software the shop
  // runs, and those documents were headed with the product's name.
  const shopNameOf = (m)=> (m && m.shops && m.shops.name) || null;

  if(!memberships.length){
    // "Create your shop" is the admin app's answer, and it is the wrong one
    // in a picker's hands. A worker reaches here when their membership is
    // missing -- an invite not yet processed, an admin removing them, a
    // personal account signed in by mistake -- and creating a shop would
    // make them the owner of an empty one, cut off from the orders they
    // were trying to reach, with a junk shop left behind. What they need is
    // an invite, which only their admin can send.
    //
    // So the host answers this, not the shared file. A host that offers no
    // opinion gets the original behaviour.
    if(typeof showNoShopScreen === 'function'){ await showNoShopScreen(); return; }
    await showNoShopDefaultScreen(); return;
  } else if(memberships.length === 1){
    currentShopId = memberships[0].shop_id;
    currentMemberRole = memberships[0].role;
    currentShopName = shopNameOf(memberships[0]);
  } else {
    currentShopId = await showShopPicker(memberships);
    const chosen = memberships.find(m=>m.shop_id===currentShopId);
    currentMemberRole = (chosen||{}).role || null;
    currentShopName = shopNameOf(chosen);
  }
  hideAuthOverlay();
  // Before the first screen, so a device appears in the monitor the
  // moment it gets in rather than at the first heartbeat.
  await owSessionBeat(true);
}

/* ================= WHO IS SIGNED IN =================================

   Three apps sign in against one shop and nothing recorded that a
   sign-in had happened: a phone left in a taxi, a password shared
   between two workers, or somebody still signed in months after they
   stopped working here were all invisible to the person who owns the
   data.

   One row per (person, device, app), kept fresh by a heartbeat. Not a
   log of every sign-in -- that grows without limit and buries the
   question actually being asked, which is what is signed in RIGHT NOW.
*/
const OW_DEVICE_KEY = 'owDeviceId';
/* Minted once per browser profile and kept in its own storage. NOT a
   fingerprint: clearing storage makes a new one, and the monitor shows
   that as a new device rather than pretending to recognise it. Private
   browsing can refuse storage entirely, so a failure falls back to a
   per-tab id rather than throwing on the way into the app. */
let owFallbackDeviceId = null;
function owDeviceId(){
  let id = null;
  try { id = localStorage.getItem(OW_DEVICE_KEY); } catch(e){ /* storage refused */ }
  if(id) return id;
  id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  try { localStorage.setItem(OW_DEVICE_KEY, id); }
  catch(e){
    if(!owFallbackDeviceId) owFallbackDeviceId = id;
    return owFallbackDeviceId;
  }
  return id;
}
/* "Chrome on Android" -- enough for an owner to recognise their own
   phone in a list, and no more. ORDER IS THE WHOLE THING here: Edge's
   user agent contains "Chrome", Chrome's contains "Safari", and every
   Android browser's contains "Linux". Each test therefore has to come
   before the one it would be mistaken for. */
function owDeviceLabel(ua){
  const s = String(ua || '');
  const browser = /Edg\//.test(s) ? 'Edge'
    : /OPR\/|Opera/.test(s) ? 'Opera'
    : /Chrome\//.test(s) ? 'Chrome'
    : /Firefox\//.test(s) ? 'Firefox'
    : /Safari\//.test(s) ? 'Safari'
    : '';
  const os = /Android/.test(s) ? 'Android'
    : /iPhone/.test(s) ? 'iPhone'
    : /iPad/.test(s) ? 'iPad'
    : /Windows/.test(s) ? 'Windows'
    : /Mac OS X/.test(s) ? 'Mac'
    : /Linux/.test(s) ? 'Linux'
    : '';
  if(browser && os) return `${browser} on ${os}`;
  return browser || os || 'Unknown device';
}

let owSessionRowId = null;
let owSessionLastBeat = 0;
/* How often a signed-in device says it is still here. Frequent enough
   that "last seen" means something to somebody watching, rare enough
   that it is not a write every poll. */
const OW_SESSION_BEAT_MS = 120000;

/* Registers this device against the shop, and answers whether it has
   been revoked.

   Read-then-write rather than an upsert, deliberately: an upsert writes
   the whole row, so a revoked device would clear its own revoked_at just
   by reloading. (The database trigger refuses that too -- this is the
   half that keeps the client from asking.) */
async function owTouchSession(force){
  if(!currentUser || !currentShopId || typeof sb === 'undefined') return false;
  const now = Date.now();
  if(!force && now - owSessionLastBeat < OW_SESSION_BEAT_MS) return false;
  owSessionLastBeat = now;
  const app = typeof owSessionApp === 'function' ? owSessionApp() : authAppRole();
  try {
    const { data: mine } = await sb.from('login_sessions')
      .select('id, revoked_at')
      .eq('shop_id', currentShopId).eq('user_id', currentUser.id)
      .eq('device_id', owDeviceId()).eq('app', app)
      .maybeSingle();
    if(mine && mine.revoked_at) return true;          // revoked: caller signs out
    const stamp = new Date().toISOString();
    if(mine){
      owSessionRowId = mine.id;
      await sb.from('login_sessions').update({ last_seen_at: stamp }).eq('id', mine.id);
    } else {
      const { data: made } = await sb.from('login_sessions').insert({
        shop_id: currentShopId, user_id: currentUser.id, device_id: owDeviceId(),
        app, label: owDeviceLabel(typeof navigator !== 'undefined' ? navigator.userAgent : ''),
        started_at: stamp, last_seen_at: stamp,
      }).select('id').maybeSingle();
      if(made) owSessionRowId = made.id;
    }
  } catch(e){
    /* Never block the app on this. A shop that cannot record who is
       signed in must still be able to sell things. */
    console.error('login session heartbeat failed', e);
  }
  return false;
}

/* The heartbeat, and the thing that acts on a revocation. Called from
   each app's existing poll, so a revoked device signs itself out within
   one beat rather than staying live until someone closes the tab. */
async function owSessionBeat(force){
  const revoked = await owTouchSession(force);
  if(revoked){
    alert('This device has been signed out by the shop owner.');
    await signOutAndReload();
  }
}

// This device's FCM token, once the OS has handed it over. Set by the
// registration listener below; null in the admin app and anywhere that is
// not the native build, which is why the sign-out below has to check.
let myPushToken = null;

async function signOutAndReload(){
  // Asked, because this is a one-tap end to the session sitting in the top
  // corner of a screen used one-handed at a shelf. Signing back in needs a
  // password the worker may not be carrying, and it now takes their push
  // subscription with it, so the next order would not reach their phone
  // either. Nothing else on this screen costs that much to touch by
  // mistake.
  if(!confirm('Sign out of Omni-ware on this device?')) return;
  // Before the sign-out, not after: the row's policy is user_id =
  // auth.uid(), and there is no auth.uid() once signed out.
  //
  // Left behind, the row keeps pointing this device at the worker who just
  // signed out. The phone goes on buzzing for their orders and putting a
  // customer's name on the lock screen of a device nobody is signed in to.
  // The other ways a subscription ends were already covered -- a different
  // worker signing in here replaces the row, since it is keyed on the
  // token, and removing a staff member cascades -- so signing out was the
  // one way to leave one stranded.
  //
  // Scoped to this device's token so a worker with a second phone keeps
  // notifications there. A failure is logged and ignored: signing out has
  // to work regardless.
  if(myPushToken){
    const { error } = await sb.from('push_subscriptions').delete().eq('fcm_token', myPushToken);
    if(error) console.error("Could not remove this device's push subscription:", error);
  }
  await sb.auth.signOut();
  location.reload();
}

/* ================= WORKER PICK & PACK ================= */
// Orders assigned to the logged-in worker (myStaff, resolved by the host
// page's boot()), walked one item at a time via a swipeable photo
// carousel: accept/deny a new assignment, then mark each item picked
// (forward/back navigation, no forced order) until every item's done.

function myWorkerOrders(){
  if(!myStaff) return [];
  return data.savedQuotes.filter(q=>q.assignedWorkerId===myStaff.id && !q.voided && !quoteAgedOffBoard(q));
}
/* MINE, PACKED. Picked and packed, still in Preparing, waiting for the
   transport. The pick is over -- so it is not the picker's open work and
   it does not keep them from the next order -- but it stays theirs until
   somebody says it has gone: "Loaded, it has gone" is that tap, from this
   phone or from the desk. */
function myPackedOrders(){
  return myWorkerOrders().filter(q=> q.status==='preparing' && q.pickingStatus==='done');
}
/* THE PICKERS' QUEUE. Every order in Preparing that nobody holds and that
   can actually be walked -- goods in, agent paid -- oldest first. One
   rule, read by everything that hands work out: the "Next to pick" panel
   on every worker's phone, "Take the next one", and the hand-over after a
   finished pick (autoAssignNextOrder). Draft is not in it: Taken means the
   suppliers have not all answered yet, and it is the last confirmation
   that moves an order into this queue. stageEnteredAt rather than savedAt,
   because savedAt is rewritten by every edit and an order corrected once
   used to go to the back of the line. */
function workerPickQueue(){
  const waitingSince = (q)=> q.stageEnteredAt || new Date(q.savedAt||0).getTime() || 0;
  return data.savedQuotes
    .filter(q=> !q.voided && !quoteAgedOffBoard(q) && q.status==='preparing' && !q.assignedWorkerId
      && q.pickingStatus !== 'done' && !agentPaymentBlocksPreparing(q) && !goodsBlockPreparing(q))
    .sort((a, b)=> waitingSince(a) - waitingSince(b));
}

function renderWorkerView(){
  if(!myStaff){
    document.getElementById('wv_pendingWrap').innerHTML = `<div class="empty">This login isn't linked to a staff profile yet. Ask an admin to send you a login invite from the Staff tab.</div>`;
    document.getElementById('wv_activeWrap').innerHTML = '';
    ['wv_packedWrap','wv_queueWrap'].forEach(id=>{ const el = document.getElementById(id); if(el) el.innerHTML = ''; });
    return;
  }
  const greetingEl = document.getElementById('wv_greeting');
  if(greetingEl) greetingEl.textContent = `${timeOfDayGreeting()}, ${(myStaff.name||'').split(' ')[0] || 'there'}`;
  const mine = myWorkerOrders();
  const pending = mine.filter(q=>q.pickingStatus==='awaiting_accept');
  const active = mine.find(q=>q.pickingStatus==='in_progress');
  // What is packed and what is waiting for anybody -- neither is a pick,
  // so neither is in the two lists above; each has its own panel below.
  const packed = myPackedOrders();
  const queue = workerPickQueue();
  // The notifications prompt is a setup task, and it shows on every render
  // until it is done -- which on the Android build is every worker's state
  // until they tap it once. It sat at the top of the body, so mid-pick it
  // wedged itself between the "Now picking" header and the card being
  // worked on: the same interruption the waiting-order card made, from a
  // banner that has nothing to do with the shelf they are standing at.
  //
  // Still shown, because turning notifications on matters -- just after the
  // work rather than through it, the same way the up-next strip is.
  const pushWrap = document.getElementById('wv_enablePushWrap');
  pushWrap.style.display = (isNativeApp() && !hasPushSubscription) ? '' : 'none';
  pushWrap.classList.toggle('is-deferred', !!active);
  // Client name + progress live in the persistent header, not inside the
  // scrolling carousel -- swapping which of these two shows (rather than
  // having them scroll past as part of the carousel content) keeps that
  // header area visually stable as a worker moves between items or on to
  // their next order; only its content changes, never its position.
  const pageHead = document.getElementById('wv_pageHead');
  const activeHeader = document.getElementById('wv_activeHeader');
  if(pageHead) pageHead.style.display = active ? 'none' : '';
  if(activeHeader){
    activeHeader.style.display = active ? '' : 'none';
    if(active){
      const items = active.items||[];
      // Answered, not done: an item recorded as short has been walked to and
      // dealt with, and counting it as outstanding would leave the bar stuck
      // below full on an order that is finished and ready to go out.
      const answered = items.filter(itemPickAnswered).length;
      const shortCount = pickShortfallLines(active).length;
      const pct = items.length ? Math.round(answered/items.length*100) : 0;
      activeHeader.innerHTML = `
        <div class="wv-hero">
          <p class="wv-hero-label">Now picking</p>
          <p class="wv-hero-name">${esc(active.client.name||'Unnamed client')}</p>
          <p class="wv-hero-progress-label">${answered} of ${items.length} picked${shortCount ? ` · ${shortCount} Short` : ''}</p>
          <div class="wv-hero-track"><div class="wv-hero-fill" style="width:${pct}%;"></div></div>
        </div>`;
    }
  }
  renderWorkerTrips();
  renderWorkerPendingList(pending, !!active, queue.length > 0);
  renderWorkerPickStepper(active);
  renderWorkerPacked(packed);
  renderWorkerQueue(queue, !!active);
}

/* Trips, above the picking. A worker who has been sent out is not on the
   shop floor, and what they need on their phone in Katwe is the list in
   their hand -- not the order they will pick when they get back.

   Rendered into the pending wrap's own container so a host page that
   predates trips (an older APK still on somebody's phone) simply does not
   show them, rather than throwing on a missing element. */
function renderWorkerTrips(){
  const wrap = document.getElementById('wv_tripsWrap');
  if(!wrap) return;
  const trips = tripsForWorker(myStaff && myStaff.id);
  if(!trips.length){ wrap.innerHTML = ''; return; }
  wrap.innerHTML = trips.map(trip=>{
    const sup = (data.suppliers||[]).find(s=> s.id === trip.supplierId);
    const where = sup ? [sup.location, sup.shopNo ? 'Shop ' + sup.shopNo : ''].filter(Boolean).join(' · ') : '';
    const lines = tripLines(trip);
    const answered = lines.filter(l=> tripLineGot(l) != null).length;
    return `<div class="wv-trip" data-trip="${esc(trip.id)}">
      <div class="wv-trip-head">
        <div>
          <div class="wv-trip-label">${esc(TRIP_STATUS_LABELS[trip.status] || trip.status)}</div>
          <div class="wv-trip-name">${esc(sup ? sup.name : 'Supplier')}</div>
          ${where ? `<div class="wv-trip-where">${esc(where)}</div>` : ''}
        </div>
        ${trip.status==='assigned'
          ? `<button type="button" class="wv-trip-accept" data-accept="${esc(trip.id)}">Accept</button>`
          : `<div class="wv-trip-progress">${answered} of ${lines.length}</div>`}
      </div>
      ${trip.status==='collecting' ? `<div class="wv-trip-lines">${lines.map((l,i)=>{
        const got = tripLineGot(l);
        const short = got != null && got < (Number(l.qty)||0);
        return `<button type="button" class="wv-trip-line ${got==null?'':(short?'short':'done')}"
          data-trip="${esc(trip.id)}" data-idx="${i}">
          <span class="wv-trip-item">${esc(l.productName)}</span>
          <span class="wv-trip-qty">${got==null
            ? `${esc(l.qty)} ${esc(l.unit||'')}`
            : `${got} of ${esc(l.qty)} ${esc(l.unit||'')}`}</span>
          <span class="wv-trip-for">for ${esc(l.clientName||'an order')}</span>
        </button>`;
      }).join('')}</div>
      <button type="button" class="wv-trip-finish" data-finish="${esc(trip.id)}"
        ${answered < lines.length ? 'disabled' : ''}>Hand in what I got</button>` : ''}
    </div>`;
  }).join('');

  wrap.querySelectorAll('[data-accept]').forEach(b=> b.addEventListener('click', ()=>{
    if(acceptCollectionTrip(b.dataset.accept)) renderWorkerView();
  }));
  wrap.querySelectorAll('[data-finish]').forEach(b=> b.addEventListener('click', ()=>{
    if(finishCollectionTrip(b.dataset.finish)) renderWorkerView();
  }));
  wrap.querySelectorAll('.wv-trip-line').forEach(b=> b.addEventListener('click', ()=>{
    const trip = (data.collectionTrips||[]).find(x=> x.id === b.dataset.trip);
    const l = trip && tripLines(trip)[Number(b.dataset.idx)];
    if(!l) return;
    const got = prompt(`${l.productName}\nHow many ${l.unit||'units'} did you get?`, String(l.qty));
    if(got === null) return;
    const paid = prompt(`What did each ${l.unit||'unit'} cost?`, String(l.expectedPrice == null ? '' : l.expectedPrice));
    if(paid === null) return;
    if(setTripLineGot(b.dataset.trip, Number(b.dataset.idx), got, paid)) renderWorkerView();
  }));
}

// "Requested 12 min ago" etc, from the real timestamp set when an order
// was actually assigned (manual assignment or autoAssignNextOrder) --
// never fabricated, so an order with no timestamp (shouldn't happen for
// any order assigned since this field existed, but safe for older data)
// just omits the line rather than showing a made-up time.
function timeAgoLabel(ts){
  if(!ts) return null;
  const mins = Math.floor((Date.now()-ts)/60000);
  if(mins < 1) return 'Requested just now';
  if(mins < 60) return `Requested ${mins} min${mins===1?'':'s'} ago`;
  const hrs = Math.floor(mins/60);
  if(hrs < 24) return `Requested ${hrs} hr${hrs===1?'':'s'} ago`;
  const days = Math.floor(hrs/24);
  return `Requested ${days} day${days===1?'':'s'} ago`;
}

function renderWorkerPendingList(pending, hasActive, hasQueue){
  const wrap = document.getElementById('wv_pendingWrap');
  wrap.classList.toggle('is-upnext', !!(hasActive && pending.length));
  // Mid-pick, a waiting order is news, not a decision.
  //
  // It used to render its full card -- avatar, item count, Deny and Accept
  // -- wedged between the "Now picking" header and the card being worked
  // on, splitting the one flow on the screen in half. And the Accept on it
  // could not work: one open pick at a time has been the rule since
  // 0f31c2c, so pressing it earned a toast telling the worker to finish
  // what they were holding. A button that exists to be refused, sitting
  // over the thing it is refusing on behalf of.
  //
  // So it collapses to a strip, and the CSS moves it below the pick card --
  // out of the middle of the flow and into the place that matches what it
  // says. The full card, with both its actions, comes back the moment the
  // current pick is finished, which is when the decision is actually
  // theirs to make.
  if(hasActive && pending.length){
    const next = pending[0];
    const more = pending.length - 1;
    const count = (next.items||[]).length;
    wrap.innerHTML = `
      <div class="wv-upnext" role="status">
        <span class="wv-upnext-label">Up next</span>
        <span class="wv-upnext-name">${esc(next.client.name || 'Unnamed client')}</span>
        <span class="wv-upnext-meta">${count} item${count===1?'':'s'}${more>0 ? ` · +${more} more waiting` : ''}</span>
      </div>`;
    return;
  }
  if(!pending.length){
    // With a pick open the carousel fills the screen and an empty pending
    // list needs no comment. With nothing open it left the page blank below
    // the title, which reads as a screen that failed to load rather than a
    // shop with no work waiting -- and this app loads once and never
    // refreshes itself, so a worker had no way to tell the two apart or any
    // reason to think waiting would help.
    //
    // Unless the queue below has something in it: "nothing to pick" over a
    // panel that says what to pick would be the screen arguing with itself.
    wrap.innerHTML = (hasActive || hasQueue) ? '' : `<div class="empty">Nothing to pick right now. New orders appear here as they come in — the next free picker takes the top one.</div>`;
    return;
  }
  wrap.innerHTML = pending.map(q=>{
    const name = q.client.name || 'Unnamed client';
    const initial = (name.trim().charAt(0) || '?').toUpperCase();
    const count = (q.items||[]).length;
    const meta = timeAgoLabel(q.pickingAssignedAt);
    return `
    <div class="wv-pending-card" data-id="${q.id}">
      <div class="wv-pending-top">
        <div class="wv-avatar">${esc(initial)}</div>
        <div class="wv-pending-text">
          <div class="wv-pending-name">${esc(name)}</div>
          ${meta ? `<div class="wv-pending-meta">${esc(meta)}</div>` : ''}
        </div>
        <span class="wv-count-pill">${count} item${count===1?'':'s'}</span>
      </div>
      <div class="wv-actions">
        <button type="button" class="btn btn-ghost wv-deny-btn">Deny</button>
        <button type="button" class="btn btn-accent wv-accept-btn">Accept</button>
      </div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.wv-accept-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>acceptOrderAssignment(Number(btn.closest('[data-id]').dataset.id)));
  });
  wrap.querySelectorAll('.wv-deny-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>denyOrderAssignment(Number(btn.closest('[data-id]').dataset.id)));
  });
}

// Only ever acts on an order actually assigned to whoever is signed in.
// Both of these can be reached from a notification tap, and a notification
// outlives the assignment it was sent for -- an order reassigned to someone
// else while the first worker's phone still shows the old alert would
// otherwise let that tap take it over, or hand it back, out from under the
// worker now holding it.
function orderIsMine(q){
  return !!(q && myStaff && q.assignedWorkerId === myStaff.id);
}

function acceptOrderAssignment(orderId){
  const q = data.savedQuotes.find(x=>x.id===orderId);
  if(!orderIsMine(q)){ toast('That order has already been passed to someone else'); return; }
  if(!q || q.pickingStatus!=='awaiting_accept') return;
  // One pick at a time.
  //
  // renderWorkerView shows a single active order -- mine.find(... ===
  // 'in_progress') -- so accepting a second while one was still open left
  // it in_progress and displayed nowhere: gone from the pending list
  // because it is no longer awaiting_accept, and not the card on screen
  // because find() returns the other one. The order sat blocked on a
  // worker who could not see it, while the admin's board went on showing
  // it as being prepared by them.
  //
  // Same stranding the finish back-out already guards against ("both lists
  // skipped it"), reached from the other end. The app's model is one open
  // pick anyway -- the hero says "Now picking" in the singular, and
  // autoAssignNextOrder only hands over the next order once this one is
  // finished.
  const open = myWorkerOrders().find(x=>x.pickingStatus==='in_progress');
  if(open){
    toast(`Finish ${open.client.name || 'the order you have open'} first — you can only pick one order at a time`, 5000);
    return;
  }
  /* Nothing can be picked that has not arrived. This was reachable and
     wrong in the most wasteful way: a worker accepted the pick, walked
     the shelves for goods still in a supplier's shop, and recorded a
     short pick against a delivery that had simply not happened. The
     admin's board then read the order as picked and short. */
  if(goodsBlockPreparing(q)){
    const left = orderIncomingLines(q).length;
    toast(`${left} item${left===1?'':'s'} on this order ${left===1?'has':'have'} not arrived yet — it cannot be picked until they are in`, 5000);
    return;
  }
  q.pickingStatus = 'in_progress';
  q.workerAcceptedAt = Date.now();
  q.pickCursor = 0;
  (q.items||[]).forEach(it=>{ if(!it.pickStatus) it.pickStatus='pending'; });
  saveData();
  renderWorkerView();
}

/* ---- The pickers' queue, on the phone ------------------------------
   An order entering Preparing used to be on nobody's screen until an admin
   put it on somebody through a pop-up. Now it is on every worker's, as the
   queue: the next free picker takes the top one, from here. The desk never
   has to choose. */
function renderWorkerQueue(queue, hasActive){
  const wrap = document.getElementById('wv_queueWrap');
  if(!wrap) return;
  if(!queue.length){ wrap.innerHTML = ''; return; }
  const shown = queue.slice(0, 5);
  const rows = shown.map((q, i)=>{
    const count = (q.items||[]).length;
    const since = q.stageEnteredAt ? savedAgoLabel(new Date(q.stageEnteredAt).toISOString()) : '';
    return `<div class="wv-qrow"><span class="wv-qrow-i">${i+1}</span><span class="wv-qrow-n">${esc(q.client.name || 'Unnamed client')}</span><span class="wv-qrow-m">${count} item${count===1?'':'s'}${since ? ' · in the queue ' + esc(since) : ''}</span></div>`;
  }).join('');
  const more = queue.length > shown.length ? `<p class="wv-qmore">and ${queue.length - shown.length} more behind them</p>` : '';
  // One pick at a time is the rule (acceptOrderAssignment), so with a pick
  // open the queue is news, not a button.
  const take = hasActive ? '' : `<button type="button" class="btn btn-accent wv-take-btn" id="wv_take_btn">Take the next one</button>`;
  wrap.innerHTML = `<div class="wv-sec"><span class="wv-sec-t">Next to pick</span><span class="wv-sec-n">${queue.length} waiting</span></div>${rows}${more}${take}`;
  const btn = document.getElementById('wv_take_btn');
  if(btn) btn.addEventListener('click', ()=> takeNextOrder());
}

/* Take the top of the queue: assigned and accepted in ONE write, because
   the person tapping is the person taking it -- handing it to themselves
   as "awaiting accept" and then accepting would be two taps, two saves,
   and a push notification to their own pocket in between. */
function takeNextOrder(){
  if(!myStaff){ toast('This login is not linked to a staff profile yet'); return false; }
  const open = myWorkerOrders().find(q=> q.pickingStatus === 'in_progress');
  if(open){
    toast(`Finish ${open.client.name || 'the order you have open'} first — one order at a time`, 5000);
    return false;
  }
  const next = workerPickQueue()[0];
  if(!next){ toast('Nothing is waiting to be picked'); renderWorkerView(); return false; }
  const now = Date.now();
  next.assignedWorkerId = myStaff.id;
  next.pickingAssignedAt = now;
  next.workerAcceptedAt = now;
  next.pickingStatus = 'in_progress';
  next.pickCursor = 0;
  (next.items||[]).forEach(it=>{ if(!it.pickStatus) it.pickStatus = 'pending'; });
  saveData();
  refreshAdminOrderBoardIfOpen();
  renderWorkerView();
  return true;
}

/* ---- Packed, waiting to go -----------------------------------------
   The picker's own packed orders, each with the one question left --
   who is carrying it -- and the tap that answers it. */
const WV_LOAD_CLS = { form:'wv-load', field:'wv-load-f', label:'wv-load-l', input:'wv-load-v', select:'wv-load-v',
  staffField:'wv-load-staff', hiredField:'wv-load-hired', phoneField:'wv-load-phone' };
function renderWorkerPacked(packed){
  const wrap = document.getElementById('wv_packedWrap');
  if(!wrap) return;
  if(!packed.length){ wrap.innerHTML = ''; return; }
  // What was typed and not yet sent survives the redraw (the poll redraws
  // this screen once a minute).
  const drafts = carrierDraftsFrom(wrap);
  wrap.innerHTML = `<div class="wv-sec"><span class="wv-sec-t">Packed, waiting to go</span><span class="wv-sec-n">${packed.length}</span></div>` + packed.map(q=>{
    const name = q.client.name || 'Unnamed client';
    const count = (q.items||[]).length;
    const ago = q.pickingDoneAt ? savedAgoLabel(new Date(q.pickingDoneAt).toISOString()) : '';
    const where = q.deliveryAddress ? ' · to ' + q.deliveryAddress : '';
    return `<div class="wv-packed" data-id="${q.id}">
      <div class="wv-pending-top">
        <div class="wv-avatar">${esc((name.trim().charAt(0) || '?').toUpperCase())}</div>
        <div class="wv-pending-text">
          <div class="wv-pending-name">${esc(name)}</div>
          <div class="wv-pending-meta">${count} item${count===1?'':'s'}${ago ? ' · packed ' + esc(ago) : ''}${esc(where)}</div>
        </div>
      </div>
      ${carrierFormHTML(q, WV_LOAD_CLS, drafts.get(q.id))}
      <button type="button" class="btn btn-accent wv-load-btn" data-load-go="${q.id}">Loaded, it has gone</button>
    </div>`;
  }).join('');
  wrap.querySelectorAll('[data-car="kind"]').forEach(sel=> sel.addEventListener('change', ()=> syncCarrierForm(sel.closest('[data-load]'))));
  wrap.querySelectorAll('[data-load-go]').forEach(b=> b.addEventListener('click', ()=>{
    const car = readCarrierForm(b.closest('.wv-packed').querySelector('[data-load]'));
    car.by = myStaff ? myStaff.name : '';
    loadOrder(Number(b.dataset.loadGo), car);
  }));
}

/* ---- Who is carrying it --------------------------------------------
   One template for both apps -- the picker's packed card and the desk's
   open row -- so the two can never ask different questions. `cls` is the
   skin: the worker app's own classes on the phone, the layer's field
   classes on the console. */
const CARRIER_KINDS = {
  hired:  'Hired transport',
  staff:  'One of ours',
  client: 'The client’s own person',
  agent:  'The agent, collecting it',
};
function carrierKindsFor(q){
  return Object.keys(CARRIER_KINDS).filter(k=> k !== 'agent' || (q && q.deliveryMode === 'agent_pickup'));
}
/* ONE LIST, AND IT NAMES THE PEOPLE. It used to ask for a kind first --
   hired transport, one of ours, the client's own -- and only then, in a
   second box that appeared underneath, which of ours. Nobody found the
   second box: the shop has a handful of staff and the obvious thing is to
   pick the person. So the people are IN this list, by name, above the
   ways an order goes out with somebody who is not ours.

   A person's value is 'staff:<id>'; everything else is its own key from
   CARRIER_KINDS. Nothing is chosen for you unless the order answers the
   question itself (an agent collecting their own), because "who took it"
   is a fact about the world and the app has no business guessing it. */
function carrierFormHTML(q, cls, draft){
  const d = draft || {};
  const kinds = carrierKindsFor(q);
  const people = (data.staff||[]).filter(st=> staffEligibleForRole(st, 'delivery') && !st.unavailable);
  const auto = q.deliveryMode === 'agent_pickup' ? 'agent' : '';
  const chosen = d.kind === 'staff' && d.staffId ? 'staff:' + d.staffId
    : (kinds.includes(d.kind) ? d.kind : auto);
  const kind = chosen.indexOf('staff:') === 0 ? 'staff' : chosen;
  const v = (x)=> esc(x == null ? '' : x);
  const opt = (val, label)=> `<option value="${v(val)}"${val === chosen ? ' selected' : ''}>${esc(label)}</option>`;
  const roleWord = (st)=> st.role === 'delivery' ? 'delivery' : 'worker';
  const list = [
    `<option value=""${chosen ? '' : ' selected'}>Choose who…</option>`,
    people.length ? `<optgroup label="Ours">${people.map(st=> opt('staff:' + st.id, st.name + ' · ' + roleWord(st))).join('')}</optgroup>` : '',
    // 'staff' is not offered as a category here: the people it stood for
    // are named above it, and a category beside the names it covers is the
    // second box all over again.
    `<optgroup label="${people.length ? 'Somebody else' : 'Nobody of ours is on the staff list'}">${kinds.filter(k=> k !== 'staff').map(k=> opt(k, CARRIER_KINDS[k])).join('')}</optgroup>`,
  ].join('');
  // The console's field puts its control in a bordered box (.ow-f-in);
  // the phone's control is its own box. `cls.wrap` is that difference.
  const box = (inner)=> cls.wrap ? `<span class="${cls.wrap}">${inner}</span>` : inner;
  /* A field holding a SELECT is a div, not a label.
     A label forwards a click to the control it wraps -- which is what
     makes clicking the caption focus a text box, and is exactly wrong
     for a dropdown: the click opens the native list, the label forwards
     a second activation to the same select, and the list shuts again
     before a finger can reach an option. Mouse only, every browser, and
     it reads as a dropdown that refuses to be used. The caption is
     already a span, so nothing else about the field changes. */
  const field = (label, inner, extra, on)=>{
    const tag = inner.indexOf('<select') >= 0 ? 'div' : 'label';
    return `<${tag} class="${cls.field}${extra ? ' ' + extra : ''}"${on === false ? ' style="display:none"' : ''}><span class="${cls.label}">${label}</span>${box(inner)}</${tag}>`;
  };
  // Only what the answer still leaves open. One of ours needs nothing more
  // -- their name and number are already on their staff card.
  const asks = carrierAsks(kind);
  return `<div class="${cls.form}" data-load="${q.id}">
    ${field('Who is carrying it', `<select class="${cls.select}" data-car="kind">${list}</select>`)}
    ${field(kind === 'client' ? 'Their name' : 'Driver or company', `<input class="${cls.input}" data-car="name" value="${v(d.name)}" placeholder="Kasule" autocomplete="off">`, cls.hiredField, asks.name)}
    ${field('Vehicle', `<input class="${cls.input}" data-car="what" value="${v(d.what)}" placeholder="Fuso UAX 123K" autocomplete="off">`, cls.hiredField, asks.what)}
    ${field('Phone', `<input class="${cls.input}" data-car="phone" value="${v(d.phone)}" inputmode="tel" placeholder="07…" autocomplete="off">`, cls.phoneField, asks.phone)}
  </div>`;
}
/* What is still unanswered once the list has been answered. One place,
   so the render and the change handler cannot disagree about it. */
function carrierAsks(kind){
  return { name: kind === 'hired' || kind === 'client',
    what: kind === 'hired',
    phone: kind === 'hired' || kind === 'client' };
}
/* The list decides which of the rest are asked. Shown and hidden with
   style rather than the hidden attribute: a field's own display rule
   would outrank the attribute. */
function syncCarrierForm(root){
  if(!root) return;
  const kindEl = root.querySelector('[data-car="kind"]');
  const val = kindEl ? kindEl.value : '';
  const kind = val.indexOf('staff:') === 0 ? 'staff' : val;
  const asks = carrierAsks(kind);
  ['name','what','phone'].forEach(k=>{
    const el = root.querySelector(`[data-car="${k}"]`);
    const label = el && el.closest('label');
    if(label) label.style.display = asks[k] ? '' : 'none';
  });
  const nameEl = root.querySelector('[data-car="name"]');
  const nl = nameEl && nameEl.closest('label') && nameEl.closest('label').firstElementChild;
  if(nl) nl.textContent = kind === 'client' ? 'Their name' : 'Driver or company';
}
function readCarrierForm(root){
  const get = (k)=>{ const el = root && root.querySelector(`[data-car="${k}"]`); return el ? el.value : ''; };
  const val = get('kind');
  const isStaff = val.indexOf('staff:') === 0;
  return { kind: isStaff ? 'staff' : val, staffId: isStaff ? val.slice(6) : '',
    name: get('name'), what: get('what'), phone: get('phone') };
}
function carrierDraftsFrom(root){
  const m = new Map();
  if(!root || !root.querySelectorAll) return m;
  root.querySelectorAll('[data-load]').forEach(f=> m.set(Number(f.dataset.load), readCarrierForm(f)));
  return m;
}

/* LOADED, IT HAS GONE. Out for delivery begins when something is out --
   not when the pick ends, which is what the app used to say while the
   goods sat on the floor. So this is its own moment, with its own tap,
   and it carries who is carrying it: hired transport by name and phone,
   one of ours by staff id, the client's own person, or the agent. The
   record is the same shape from either app.

   The status move goes through the admin's setSavedQuoteStatus where it
   exists -- the one place a status changes on the console, which logs
   the move and says where it went -- and is written directly in the
   worker app, whose save only ever moves preparing -> pending_delivery
   (WORKER_STATUS_MOVES). An order already out keeps its stage and only
   has its carrier corrected. */
function loadOrder(orderId, carrier){
  const q = data.savedQuotes.find(x=> x.id === orderId);
  if(!q) return false;
  const alreadyOut = q.status === 'pending_delivery';
  if(q.status !== 'preparing' && !alreadyOut){
    toast('This order has already moved on — refresh to see where it is now', 5000);
    return false;
  }
  const c = carrier || {};
  const kind = carrierKindsFor(q).includes(c.kind) ? c.kind : null;
  if(!kind){ toast('Choose who is carrying it first'); return false; }
  const name = String(c.name || '').trim(), what = String(c.what || '').trim(), phone = String(c.phone || '').trim();
  let assignee;
  let fromCard = '';
  if(kind === 'staff'){
    const st = (data.staff||[]).find(x=> String(x.id) === String(c.staffId) && staffEligibleForRole(x, 'delivery'));
    if(!st){ toast('Choose who is carrying it'); return false; }
    assignee = st.id;
    // Their number is already on their staff card, so the row's tel: link
    // works without anybody retyping it.
    fromCard = st.phone || '';
  } else if(kind === 'hired'){
    if(!name){ toast('Name the transport — the driver or the company'); return false; }
    assignee = '__carrier__';
  } else if(kind === 'agent'){
    assignee = '__agent__';
  } else {
    assignee = '__client__';
  }
  const now = Date.now();
  q.carrier = { kind, name: kind === 'staff' ? (name || staffName(assignee)) : name, what, phone: phone || fromCard, at: now,
    by: String(c.by || (typeof myStaff !== 'undefined' && myStaff ? myStaff.name : '') || '') };
  q.assignedDeliveryId = assignee;
  if(alreadyOut){
    saveData();
    refreshAdminOrderBoardIfOpen();
  } else {
    // Loading it IS the claim that it is picked and packed -- from the desk
    // it may never have had a picker at all.
    q.pickingStatus = 'done';
    if(!q.pickingDoneAt) q.pickingDoneAt = now;
    if(typeof setSavedQuoteStatus === 'function'){
      setSavedQuoteStatus(q.id, 'pending_delivery');
    } else {
      q.status = 'pending_delivery';
      q.stageEnteredAt = now;
      saveData();
    }
  }
  if(typeof document !== 'undefined' && document.getElementById('wv_packedWrap')) renderWorkerView();
  return true;
}

// renderSavedQuotes() only exists in the admin app's Order Tracking board --
// guarded so the same function works from the standalone worker app too,
// where there's no such board to refresh.
function refreshAdminOrderBoardIfOpen(){
  if(typeof renderSavedQuotes === 'function' && document.getElementById('tab-quote-saved') && document.getElementById('tab-quote-saved').style.display!=='none') renderSavedQuotes();
}

function denyOrderAssignment(orderId){
  const q = data.savedQuotes.find(x=>x.id===orderId);
  if(!orderIsMine(q)){ toast('That order has already been passed to someone else'); return; }
  q.assignedWorkerId = null;
  q.pickingStatus = null;
  saveData();
  renderWorkerView();
  refreshAdminOrderBoardIfOpen();
  toast('Order declined — it\'s back in the unassigned pool');
}

// Throws away a pick in progress: the ticks, the cursor, and the timestamps
// that go with them. Deliberately leaves assignedWorkerId alone -- whether the
// order stays with that worker or goes back in the pool is the caller's call,
// and the two backward steps across Being Prepared want different answers.
function resetPickingProgress(q){
  if(!q) return;
  q.pickingStatus = null;
  q.pickCursor = 0;
  q.pickingAssignedAt = null;
  q.workerAcceptedAt = null;
  // The admin's decision about a shortfall belongs to the pick that reported
  // it. Left behind, a fresh pick that comes up short again would arrive
  // already settled -- and settled in favour of billing the full quantity,
  // which is the one outcome that must never happen by default.
  q.pickShortfallAckAt = null;
  // And the pack: a re-pick means the goods are not packed any more.
  q.pickingDoneAt = null;
  // acceptOrderAssignment fills a missing pickStatus back in as 'pending'.
  (q.items||[]).forEach(it=>{ it.pickStatus = null; it.pickedQty = null; });
}

/* ---- What a pick actually resolved to --------------------------------
   A picker at the shelf finding fewer than the order asks for is a normal
   event in a hardware shop, not an error. Two item states count as
   ANSWERED:

     'done'    the full ordered quantity was found
     'short'   a number was recorded and it was less -- 0 included, meaning
               nothing on the shelf at all

   Everything gates on "answered" rather than "done". An order with a
   genuine shortfall still has to be finishable: leaving it unanswered kept
   "Mark as finished" hidden, so the order stayed in_progress on that worker
   -- and since 0f31c2c made one open pick the rule, they could not accept
   any other order either. The only way out was an admin stepping the order
   back to Draft, and nothing told them it was needed.

   pickedQty is the field that carries the number. It was written from the
   first version of this screen and read by nothing until now, so these are
   deliberately defensive about what may be sitting in rows saved since. */
const PICK_ANSWERED = ['done','short'];
function itemPickAnswered(it){ return !!it && PICK_ANSWERED.indexOf(it.pickStatus) > -1; }
function itemOrderedQty(it){ return Math.max(0, Number(it && it.qty) || 0); }
// What came off the shelf, or null while the item is still unanswered.
//
// A 'done' item is the full quantity BY DEFINITION rather than by whatever
// pickedQty happens to hold. Every order picked before this field was read
// carries ticks with nothing behind them -- resetPickingProgress nulls
// pickedQty and acceptOrderAssignment does not refill it -- and reading
// those as zero would report a shop-wide shortfall that never happened.
function itemPickedQty(it){
  if(!itemPickAnswered(it)) return null;
  if(it.pickStatus==='done') return itemOrderedQty(it);
  const n = Number(it.pickedQty);
  if(!isFinite(n) || n<0) return 0;
  return Math.min(itemOrderedQty(it), n);
}
// Every line that came up short, carrying both numbers. The worker's finish
// button, the admin's board card and the invoice gate all report from this
// one shape, so none of them can arrive at a different answer about the
// same order.
function pickShortfallLines(q){
  return ((q && q.items)||[]).map((it, idx)=>({
    it, idx, ordered: itemOrderedQty(it), picked: itemPickedQty(it)
  })).filter(row=> row.picked!=null && row.picked < row.ordered);
}
// A shortfall nobody has decided about yet.
//
// Deciding is the admin's, not the picker's: either the order is amended to
// what actually left the shop, or they record that the full quantity went
// out anyway (topped up off another shelf, a miscount corrected at the
// counter). Until one of those happens the order must not be invoiced,
// because the invoice total and the stock deduction are both built from
// qty -- so billing it as it stands charges the customer for goods that
// never left the shop, and takes stock the shelf never had.
function orderHasPickShortfall(q){
  if(!q || q.pickShortfallAckAt) return false;
  return pickShortfallLines(q).length > 0;
}

/* ---------------- Where an order's goods are ----------------

   Both apps have to agree about this, which is why it lives here. The
   admin board decides whether an order may be prepared at all; the
   worker app decides whether to offer the pick and where to send
   somebody for it. Two copies of that rule would eventually disagree,
   and the way it would show is a worker sent across town for goods
   already sitting on the shelf behind them. */
function orderLineIsBoughtIn(it){
  return !!(it && it.supplierId && it.supplierId !== '__stock__');
}
function quoteLineReceived(it){
  return !!(it && it.receivedAt && Number(it.receivedQty) > 0);
}
// Whose goods are on our own shelf: quoted from stock, or bought in and
// since come through the door.
function quoteLineComesOffShelf(it){
  return !!it && (it.supplierId === '__stock__' || quoteLineReceived(it));
}
// Still out at a supplier, and so still to be collected.
function orderIncomingLines(q){
  return (((q && q.items) || [])).filter(it=> orderLineIsBoughtIn(it) && !quoteLineReceived(it));
}
function orderAwaitsGoods(q){ return orderIncomingLines(q).length > 0; }

/* How much of what the CUSTOMER is owed did not turn up.

   Measured against it.qty and deliberately not against the pack-rounded
   purchase: a one-dozen line filled from a six-dozen carton that came
   back with three is not short at all -- the customer's dozen is there,
   and the shelf simply got less surplus than planned. Judging it by the
   carton would have called a perfectly filled order short on every
   pack-forced line in the shop.

   quoteLineReceived answers "did anything arrive", which is a different
   question and was standing in for this one. Four dozen arriving against
   an order for ten read as a line fully in: the board said "All items in
   -- ready to prepare", the gate opened, and the picker was sent to a
   shelf holding four. Nothing anywhere named the missing six. */
function quoteLineShortfall(it){
  if(!orderLineIsBoughtIn(it) || !quoteLineReceived(it)) return 0;
  return Math.max(0, (Number(it.qty) || 0) - (Number(it.receivedQty) || 0));
}
function orderShortLines(q){
  return (((q && q.items) || [])).filter(it=> quoteLineShortfall(it) > 0);
}

/* The other side of the same subtraction: what of the delivery is NOT
   this customer's.

   A supplier who sells nothing smaller than a carton turns an order for
   one dozen into a purchase of six, and all six go on the shelf when
   they are checked in. Five of them are the shop's. The picker,
   standing in front of an open carton with a card that says "1 Dozen",
   has no way to tell that from a delivery of six they are meant to hand
   over -- and handing over the carton gives away five dozen the shop
   paid for.

   Counted from what actually arrived rather than worked out from the
   pack size, for the same reason the shortfall is: index.html's
   quoteLineSurplus answers the planning question before anything has
   turned up, and this answers what is really on the shelf now.
   A short delivery has no surplus and a surplus is never short, so the
   two can never both have something to say. */
function quoteLineShelfShare(it){
  if(!quoteLineReceived(it)) return 0;
  return Math.max(0, (Number(it.receivedQty) || 0) - (Number(it.qty) || 0));
}
// How far along the collecting is, for a card that has to say so at a
// glance. Counts LINES rather than units: "3 of 5 items in" is what
// decides whether anyone can start picking. `short` is counted apart
// from `received` rather than deducted from it, because a short line HAS
// arrived -- there is simply less of it than was ordered, and that is a
// thing to say out loud rather than a reason to keep waiting.
function orderGoodsProgress(q){
  const bought = (((q && q.items) || [])).filter(orderLineIsBoughtIn);
  return { received: bought.filter(quoteLineReceived).length, total: bought.length,
    short: bought.filter(it=> quoteLineShortfall(it) > 0).length };
}
/* The gate. An order cannot be picked while any of it is still in
   somebody else's shop -- the picker would be sent for goods that are
   not there, and a short pick would be recorded against a delivery that
   simply had not happened yet.

   Draft is exempt: nothing is being picked there, and an order still
   being written should not be blocked by goods nobody has gone for. */
function goodsBlockPreparing(q){
  return !!q && q.status !== 'draft' && orderAwaitsGoods(q);
}

/* ---------------- Collection trips ----------------

   Somebody going to a supplier to fetch goods. Per SUPPLIER rather than
   per order, because that is the shape of the real thing: one journey to
   Shafik covers lines from three different orders and is settled with one
   payment. Per order would have sent the same worker to the same shop
   three times.

   The lifecycle, and who moves it:

     open       the admin made it from the buying list
     assigned   the admin gave it to a worker
     collecting the worker accepted it on their device
     collected  the worker is back, and has said what they got
     confirmed  the ADMIN checked it in -- and only this puts goods on
                the shelf

   That last line is the whole safety boundary. The worker app saves from
   a snapshot that can be hours old, which is why it may write so little
   of an order (WORKER_OWNED_KEYS); letting it write stock and supplier
   debt would be a much larger trust than it has today. So a worker
   reports what came back, and confirming it is a deliberate act by
   somebody looking at the goods. */
const TRIP_STATUS_ORDER = ['open','assigned','collecting','collected','confirmed'];
const TRIP_STATUS_LABELS = {
  open:'To send', assigned:'Sent', collecting:'Out collecting',
  collected:'Back — to check in', confirmed:'Checked in',
};
function tripIsLive(t){ return !!t && !t.voided && t.status !== 'confirmed'; }
function tripLines(t){ return ((t && t.lines) || []); }
// What a worker is holding when they get back, or null while they are
// still out -- the same "answered vs not" shape a pick uses.
function tripLineGot(l){
  const n = Number(l && l.gotQty);
  return (l && l.gotQty != null && isFinite(n) && n >= 0) ? n : null;
}
function tripAllAnswered(t){
  const lines = tripLines(t);
  return lines.length > 0 && lines.every(l=> tripLineGot(l) != null);
}
// Lines that came back short of what the trip was sent for. Both numbers,
// like a short pick, because the two together are what somebody has to
// decide about.
function tripShortLines(t){
  return tripLines(t)
    .map((l, idx)=>({ l, idx, sent: Number(l.qty)||0, got: tripLineGot(l) }))
    .filter(r=> r.got != null && r.got < r.sent);
}
function tripsForWorker(workerId){
  return ((typeof data !== 'undefined' && data.collectionTrips) || [])
    .filter(t=> tripIsLive(t) && String(t.assignedWorkerId) === String(workerId));
}
// Every trip a line is already on, so the buying list never sends two
// people for the same carton.
function tripsCoveringLine(orderId, lineId){
  return ((typeof data !== 'undefined' && data.collectionTrips) || [])
    .filter(t=> tripIsLive(t) && tripLines(t).some(l=>
      String(l.orderId) === String(orderId) && String(l.lineId) === String(lineId)));
}
function lineIsOnATrip(orderId, lineId){ return tripsCoveringLine(orderId, lineId).length > 0; }

/* The worker's half of a trip. Three acts and no more: take it, say what
   came back, hand it in. None of them touches stock -- that is checking
   in, and it happens in the admin app where somebody is looking at the
   goods. */
function acceptCollectionTrip(tripId){
  const t = (data.collectionTrips||[]).find(x=> x.id === tripId);
  if(!t || t.status !== 'assigned') return false;
  if(String(t.assignedWorkerId) !== String(myStaff && myStaff.id)){
    toast('That trip has been passed to somebody else');
    return false;
  }
  t.status = 'collecting';
  t.acceptedAt = Date.now() && new Date().toISOString();
  saveData();
  return true;
}
// What came back for one line. Left null it means "not answered yet",
// which is what keeps a half-filled trip from being handed in.
function setTripLineGot(tripId, idx, qty, price){
  const t = (data.collectionTrips||[]).find(x=> x.id === tripId);
  const l = t && tripLines(t)[idx];
  if(!l) return false;
  const n = Number(qty);
  if(!isFinite(n) || n < 0) return false;
  l.gotQty = n;
  /* Blank first, then Number. Number('') is 0, so testing the number
     alone recorded a price nobody typed as a price of nothing -- and the
     lot would have been shelved at zero cost, poisoning every margin
     figure downstream. Blank means unsaid, and unsaid falls back to what
     the trip expected to pay. */
  const blank = price == null || String(price).trim() === '';
  const p = Number(price);
  l.gotPrice = (!blank && isFinite(p) && p >= 0) ? p
    : (l.expectedPrice == null ? null : Number(l.expectedPrice));
  saveData();
  return true;
}
/* Handing it in. Every line has to have been answered first -- a trip
   handed in half-answered would be checked in by somebody in the shop
   who has no way of knowing whether the blank lines mean "none came" or
   "nobody said". Zero is a real answer here and says the first. */
function finishCollectionTrip(tripId){
  const t = (data.collectionTrips||[]).find(x=> x.id === tripId);
  if(!t || t.status !== 'collecting') return false;
  if(!tripAllAnswered(t)){
    const left = tripLines(t).filter(l=> tripLineGot(l) == null).length;
    toast(`Say what came back for ${left} more line${left===1?'':'s'} first — 0 is an answer`, 5000);
    return false;
  }
  t.status = 'collected';
  t.collectedAt = new Date().toISOString();
  saveData();
  toast('Handed in — the shop will check it in');
  return true;
}

function timeOfDayGreeting(){
  const h = new Date().getHours();
  if(h < 12) return 'Good morning';
  if(h < 17) return 'Good afternoon';
  return 'Good evening';
}

// "Where to get it" reuses the item's existing supplierId, exactly as the
// Purchase Invoices / stock-deduction logic elsewhere already treats it:
// '__stock__' or unset means the shop's own shelf stock, anything else is a
// real supplier row to source it from.
function pickItemSourceLabel(it){
  /* Once the goods have been collected they are HERE, so this says so.
     It used to read the line's supplier and nothing else, and went on
     directing the picker to Shafik's shop in Katwe for a carton standing
     on our own shelf -- a different job, in a different part of town,
     for goods already paid for and counted in. */
  if(quoteLineComesOffShelf(it)) return 'Shop';
  if(!it.supplierId) return 'Shop';
  const sup = (data.suppliers||[]).find(s=>s.id===it.supplierId);
  if(!sup) return it.supplierName || 'Supplier';
  // The worker is standing in that part of town looking for a door:
  // "Ntinda · Shop B12" is directions, "Ntinda" alone is a search.
  const place = [sup.location, sup.shopNo ? 'Shop ' + sup.shopNo : ''].filter(Boolean).join(' · ');
  return place ? `${sup.name} — ${place}` : sup.name;
}

// Same combo-values-joined format used everywhere else a variant is shown
// (productVariantLabel() in index.html, agent-catalog's variantLabel) --
// without this a worker sees only the base product name and has to guess
// which variant (color, size, ...) the order actually needs.
function pickItemVariantLabel(it, product){
  if(it.variantIdx==null || it.variantIdx==='' || !product || !Array.isArray(product.variants)) return '';
  const v = product.variants[it.variantIdx];
  return v ? Object.values(v.combo||{}).join(' / ') : '';
}

const ICON_CHECK_SMALL = '<svg class="icon" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';
/* Its own copy rather than the host's: index.html has an ICON_WARN and
   worker.html does not, so reaching for the global would have drawn on
   the admin's screen and thrown on the phone -- which is the one of the
   two where a picker is actually standing at a shelf. */
const ICON_WARN_SMALL = '<svg class="icon" viewBox="0 0 24 24"><path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>';
// A carton with a minus on it: fewer in the box than the order asks for.
// Deliberately not a warning triangle -- the admin board already uses one of
// those for a shortfall needing a decision, and this is the picker simply
// recording what is on the shelf, which is not yet a problem.
const ICON_SHORT_PICK = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/><path d="M9 12h6"/></svg>';

// scrollIntoView({inline:'center'}) doesn't reliably land a card dead-center
// once scroll-snap-type is in play -- it's snap-aware, not purely geometric,
// and can settle a card off-center by however much the gap between cards
// happens to throw its snap-point math off. A direct scrollLeft computed
// from the card's own offsetLeft/offsetWidth is exact and immune to that.
function centerCarouselCard(carousel, card, smooth){
  if(!card) return;
  const target = card.offsetLeft - (carousel.clientWidth - card.offsetWidth) / 2;
  if(smooth) carousel.scrollTo({left: target, behavior: 'smooth'});
  else carousel.scrollLeft = target;
}

// Swipeable carousel: every item renders once as a horizontally
// scroll-snapped card; swiping is native browser scrolling (no gesture
// library), and only the centered card is "live" -- tapping its photo
// toggles picked/not-picked (a green tick overlay is the only status
// shown, no label buttons), tapping a peeking side card just brings it
// to center instead of acting on it.
function renderWorkerPickStepper(q){
  const wrap = document.getElementById('wv_activeWrap');
  if(!q){ wrap.innerHTML=''; return; }
  const items = q.items||[];
  if(!items.length){
    // Still renders the finish wrap. Returning without one was what stranded
    // a picker on an order with nothing to pick: the message went up, no
    // button could ever follow it, and since one open pick became the rule
    // they could not take on anything else either -- stuck until an admin
    // stepped the order back. There is nothing to carousel through here, so
    // the wrap is written directly rather than as part of the card template.
    wrap.innerHTML = `<div class="wv-card"><div class="wv-card-sub">No items on this order.</div></div><div id="wv_finishWrap"></div>`;
    renderWorkerFinishButton(q);
    return;
  }
  const cursor = Math.min(Math.max(q.pickCursor||0, 0), items.length-1);

  const cardsHTML = items.map((it, i)=>{
    const product = (data.products||[]).find(p=>p.id===it.productId);
    const answered = itemPickAnswered(it);
    const picked = itemPickedQty(it);
    const isShort = answered && picked < itemOrderedQty(it);
    const isDone = answered && !isShort;
    const qty = it.qty!=null ? it.qty : '';
    /* The line's OWN unit. it.qty is always in base units -- ipComputeQty
       multiplies a pack entry out by packQty before the line is written,
       so choosing "2 cartons" of something sold by the dozen stores 12,
       not 2 -- and pairing that number with packUnit printed "12 Ctn"
       for twelve dozen. A picker reading that pulls twelve cartons: six
       times the order, which is exactly the mistake this card is built
       to prevent.

       The buying list has always shown it.unit for the same number, so
       the two screens disagreed about what a line was; this is the one
       that was wrong. */
    const unit = it.unit || it.packUnit || '';
    // Which leaves nothing for "Pack" to mean here: the number is a count
    // of units in every case, whether or not the supplier sells them in
    // packs. Pack size is a purchasing fact and belongs on the buying
    // list, not on the card of somebody counting goods off a shelf.
    const qtyLabel = 'Quantity';
    const variant = pickItemVariantLabel(it, product);
    // The variant's own photo, not the product's. Every other caller of
    // ipStageThumbHTML passes the index; this one did not, so a picker
    // deciding between the brass hinge and the chrome one got the same
    // generic photo on both cards. This is the screen where that matters
    // most -- a full-bleed photo carousel, built for someone identifying
    // goods on a shelf, where the photo is the largest thing on the card.
    // resolveProductImage falls back to the product's own photo when a
    // variant has none of its own.
    const photo = ipStageThumbHTML(product||{}, it.variantIdx);
    // The PRODUCT's name, not the line's stored one. Both writers of an
    // order line bake the variant into productName -- the admin's quote
    // builder via productVariantLabel(), and agent-submit-order the same
    // way -- because every surface in the admin prints that string and
    // none of them resolve the variant. This card is the exception: it
    // resolves the variant itself, one line down. Printing the stored name
    // as well gave every variable item its variant twice:
    //
    //     Cabinet Hinge — Brass
    //     Brass
    //
    // Falls back to the stored name, which is all there is once a product
    // has been deleted out from under an order still on the board.
    //
    // ...and also whenever the variant cannot be resolved but the line says
    // it has one. Both writers bake the variant into productName, so that
    // string always carries it; product.name never does. Splitting them
    // means the card only says the variant if the variants column reached
    // it, and this app is fed by two different hosts: the standalone one
    // selected 'id, name, image' and so showed a brass hinge as plain
    // "Cabinet Hinge", with the variant line empty and nothing else naming
    // it. Saying it twice is untidy; not saying it at all sends someone to
    // the wrong shelf, so this leans that way when it cannot tell.
    const canNameVariant = it.variantIdx==null || it.variantIdx==='' || !!variant;
    const heading = (!canNameVariant && it.productName)
      ? it.productName
      : ((product && product.name) || it.productName || 'Item');
    // The badge carries all three states. A short pick reads as the two
    // numbers rather than a word -- "3 of 5" is what the picker has to
    // check against the bags in their hand, and it is the same figure the
    // admin's board and the invoice gate will report later.
    const badgeClass = isShort ? 'short' : (isDone ? 'done' : 'pending');
    const badgeLabel = isShort ? `${picked} of ${itemOrderedQty(it)}`
      : (isDone ? ICON_CHECK_SMALL+'Picked' : 'Pick');
    return `<div class="wv-carousel-card ${i===cursor?'focused':''}" data-idx="${i}">
      <div class="wv-carousel-card-inner" data-idx="${i}">
        <div class="wv-carousel-photo">${photo}</div>
        <button type="button" class="wv-carousel-badge ${badgeClass}">${badgeLabel}</button>
        <div class="wv-carousel-body">
          <div class="wv-carousel-name">${esc(heading)}</div>
          ${variant ? `<div class="wv-carousel-variant">${esc(variant)}</div>` : ''}
          <div class="wv-carousel-qty-label">${esc(qtyLabel)}</div>
          <div class="wv-carousel-qty">${esc(qty)}${unit ? ` <span class="u">${esc(unit)}</span>` : ''}</div>
        </div>
        ${/* Said before they start looking. The delivery came up short,
              so the shelf has never held the full quantity above -- and
              without this the picker hunts for goods that were never
              delivered and then records the gap as their own failure to
              find them, which is a different fact about a different
              person. */
          quoteLineShortfall(it) > 0
            ? `<div class="wv-carousel-owed">${ICON_WARN_SMALL}Only ${esc(String(it.receivedQty))} arrived — ${esc(String(quoteLineShortfall(it)))} short</div>`
            : /* The pack the shop could not buy less than. Says the
                 whole delivery first, because that is what is standing
                 in front of them, and then how much of it is not going
                 out -- an open carton of six against a card reading
                 "1 Dozen" is otherwise indistinguishable from a
                 delivery meant to be handed over whole. Only ever one
                 of these two lines: a short delivery has no surplus. */
              quoteLineShelfShare(it) > 0
                ? `<div class="wv-carousel-kept">${esc(String(it.receivedQty))}${unit ? ' ' + esc(unit) : ''} came in — ${esc(String(quoteLineShelfShare(it)))} ${quoteLineShelfShare(it)===1 ? 'stays' : 'stay'} on the shelf</div>`
                : ''}
        <div class="wv-carousel-source"><div class="wv-carousel-source-label">Pick From:</div><div class="wv-carousel-source-value">${esc(pickItemSourceLabel(it))}</div></div>
        <button type="button" class="wv-carousel-short" data-act="short" aria-label="${isShort ? 'Change the number found' : 'Record that you could not find them all'}" title="${isShort ? 'Change the number found' : 'Couldn’t find them all?'}">${ICON_SHORT_PICK}</button>
      </div>
    </div>`;
  }).join('');

  const dotsHTML = `<div class="wv-carousel-dots">${items.map((_,i)=>`<span class="wv-carousel-dot ${i===cursor?'focused':''}"></span>`).join('')}</div>`;

  wrap.innerHTML = `
    <div class="wv-carousel" id="wv_carousel">${cardsHTML}</div>
    ${dotsHTML}
    <div id="wv_finishWrap"></div>
  `;

  const carousel = document.getElementById('wv_carousel');
  // One listener on the card, but only the two controls on it do anything.
  //
  // The whole focused card used to be the toggle -- a tap anywhere on the
  // photo, the name, the quantity or the supplier marked the line picked.
  // That was survivable with two states. With three it is not: a recorded
  // shortfall is a number the picker chose and the admin will be asked to
  // settle, and a stray tap on the photo cleared it. The next tap marked
  // the line fully picked, so a card that had said "3 of 5" now claimed all
  // five, silently, on the way to an invoice built from it.
  //
  // So the badge marks a line picked, the corner control sets the number,
  // and the rest of the card is something to look at while doing it. An
  // unfocused card is still a target to bring into view -- that is
  // navigation, not a decision, and it changes nothing.
  //
  // Both controls are matched with closest() rather than against the
  // element itself, or a tap landing on the icon inside a button misses it.
  carousel.querySelectorAll('.wv-carousel-card-inner').forEach(inner=>{
    inner.addEventListener('click', (e)=>{
      const card = inner.closest('.wv-carousel-card');
      const idx = Number(inner.dataset.idx);
      if(!card.classList.contains('focused')){ centerCarouselCard(carousel, card, true); return; }
      if(e.target.closest('[data-act="short"]')) promptPickedQty(q.id, idx);
      else if(e.target.closest('.wv-carousel-badge')) toggleItemPickedAt(q.id, idx);
    });
  });
  // Update focus once scrolling actually settles, not continuously while
  // it's still moving -- toggling the focused class mid-scroll is what
  // made the carousel feel like it was shaking as you swiped.
  if('onscrollend' in window){
    carousel.addEventListener('scrollend', ()=>updateCarouselFocus(carousel, q));
  } else {
    let scrollTimer = null;
    carousel.addEventListener('scroll', ()=>{
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(()=>updateCarouselFocus(carousel, q), 150);
    });
  }
  // Land on the previously-focused card without animating (right after a
  // toggle re-render, or when reopening the app).
  centerCarouselCard(carousel, carousel.children[cursor], false);

  renderWorkerFinishButton(q);
}

function updateCarouselFocus(carousel, q){
  const mid = carousel.scrollLeft + carousel.clientWidth/2;
  let closest = 0, closestDist = Infinity;
  [...carousel.children].forEach((card, i)=>{
    const dist = Math.abs((card.offsetLeft + card.offsetWidth/2) - mid);
    if(dist < closestDist){ closestDist = dist; closest = i; }
  });
  [...carousel.children].forEach((card, i)=>card.classList.toggle('focused', i===closest));
  document.querySelectorAll('.wv-carousel-dot').forEach((dot, i)=>dot.classList.toggle('focused', i===closest));
  q.pickCursor = closest;
}

// The one-tap path, for the case that needs no thought: everything the
// order asked for was on the shelf. Tapping an already-answered card --
// short as well as done -- puts it back to unanswered, so a number entered
// by mistake is undone the same way a tick always was.
function toggleItemPickedAt(orderId, idx){
  const q = data.savedQuotes.find(x=>x.id===orderId);
  if(!q) return;
  const it = (q.items||[])[idx];
  if(!it) return;
  // A recorded shortfall is not a state to toggle out of. It is a number
  // the picker went and got -- three taps through a sheet -- and the one
  // the admin will be asked to settle against the invoice and the stock.
  // Toggling treated it as merely "answered", so the badge cleared it and a
  // second press claimed the full quantity.
  //
  // The badge on a short line opens the sheet instead, which is also what
  // it reads as: it says "3 of 5", so pressing it to change the 3 is the
  // obvious meaning. Guarded here rather than only at the tap, so no other
  // caller can discard one by accident either.
  if(it.pickStatus==='short'){ promptPickedQty(orderId, idx); return; }
  if(itemPickAnswered(it)){ it.pickStatus='pending'; it.pickedQty=null; }
  else { it.pickStatus='done'; it.pickedQty=itemOrderedQty(it); }
  q.pickCursor = idx;
  saveData();
  renderWorkerView(); // a deliberate tap, not mid-scroll -- safe to fully re-render
}

// Records what was actually found. Clamped to the ordered quantity at the
// point of writing rather than trusted from the caller: this is the number
// the invoice and the stock deduction are about to be reconciled against,
// and a picked count above what was ordered would have the shop billing for
// goods nobody asked for. Reaching the full quantity is plain 'done' -- the
// same state the badge tap produces -- so an item corrected back up to its
// full count leaves no trace of a shortfall for the admin to settle.
function setItemPickedQty(orderId, idx, picked){
  const q = data.savedQuotes.find(x=>x.id===orderId);
  if(!q) return;
  const it = (q.items||[])[idx];
  if(!it) return;
  const ordered = itemOrderedQty(it);
  const n = Math.min(ordered, Math.max(0, Math.floor(Number(picked)||0)));
  it.pickedQty = n;
  it.pickStatus = n>=ordered ? 'done' : 'short';
  q.pickCursor = idx;
  saveData();
  renderWorkerView();
}

// "Three of the five bags are on the shelf."
//
// Deliberately a stepper rather than a text input: this is a phone held in
// one hand in a warehouse, and the quantities are small. A number field
// would raise the keyboard over the very number it is asking about, and
// nothing here needs typing that two taps cannot do.
function promptPickedQty(orderId, idx){
  const q = data.savedQuotes.find(x=>x.id===orderId);
  if(!q) return;
  const it = (q.items||[])[idx];
  if(!it) return;
  const product = (data.products||[]).find(p=>p.id===it.productId);
  const name = (product && product.name) || it.productName || 'this item';
  const ordered = itemOrderedQty(it);
  const unit = it.packUnit || it.unit || '';
  const start = itemPickedQty(it);
  // Opens on the full quantity for an unanswered item -- the number they
  // are about to reduce -- and on whatever was recorded when re-opened.
  let n = start==null ? ordered : start;

  const el = document.createElement('div');
  // Carries the same class the background refresh watches for: this is a
  // decision in the middle of a flow, and re-rendering underneath it would
  // replace the card it is asking about. The second class is only for its
  // own styling.
  el.className = 'wv-assign-overlay wv-qty-overlay';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(15,20,26,0.6);display:flex;align-items:center;justify-content:center;z-index:400;padding:20px;';
  el.innerHTML = `
    <div class="wv-qty-sheet">
      <div class="wv-qty-title">How many did you find?</div>
      <div class="wv-qty-sub">${esc(name)} — ${ordered}${unit ? ` ${esc(unit)}` : ''} ordered</div>
      <div class="wv-qty-stepper">
        <button type="button" class="wv-qty-step" data-step="-1" aria-label="One fewer">−</button>
        <div class="wv-qty-value" id="wvQtyValue">0</div>
        <button type="button" class="wv-qty-step" data-step="1" aria-label="One more">+</button>
      </div>
      <button type="button" class="wv-qty-none" id="wvQtyNone">None — nothing on the shelf</button>
      <div class="wv-qty-actions">
        <button type="button" class="btn btn-ghost" id="wvQtyCancel">Cancel</button>
        <button type="button" class="btn btn-accent" id="wvQtySave">Save</button>
      </div>
    </div>`;

  const valueEl = el.querySelector('#wvQtyValue');
  const paint = ()=>{
    valueEl.textContent = String(n);
    el.querySelectorAll('.wv-qty-step').forEach(btn=>{
      const step = Number(btn.dataset.step);
      btn.disabled = (step<0 && n<=0) || (step>0 && n>=ordered);
    });
  };
  el.querySelectorAll('.wv-qty-step').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      n = Math.min(ordered, Math.max(0, n + Number(btn.dataset.step)));
      paint();
    });
  });
  el.querySelector('#wvQtyNone').addEventListener('click', ()=>{ n = 0; paint(); });
  const close = ()=>{ if(el.parentNode) document.body.removeChild(el); };
  el.querySelector('#wvQtyCancel').addEventListener('click', close);
  el.querySelector('#wvQtySave').addEventListener('click', ()=>{
    close();
    setItemPickedQty(orderId, idx, n);
  });
  // Backing out by tapping the backdrop leaves the item exactly as it was,
  // same as Cancel -- nothing is recorded until Save.
  el.addEventListener('mousedown', (e)=>{ if(e.target===el) close(); });
  paint();
  document.body.appendChild(el);
}

function renderWorkerFinishButton(q){
  const el = document.getElementById('wv_finishWrap');
  if(!el) return;
  const items = q.items||[];
  // Every item ANSWERED, not every item found. Gating on all-done was what
  // left a picker holding an order they could not complete and could not
  // put down: the shortfall is recorded on the order and settled by the
  // admin before it can be invoiced, which is where that decision belongs.
  //
  // No `items.length > 0`. An order with no lines answers vacuously, and
  // requiring one meant an empty order could be accepted and then never
  // finished -- the stepper says "No items on this order", no button ever
  // appeared, and since one open pick became the rule the worker could not
  // take on anything else either. Stuck on an order with nothing to pick,
  // needing an admin to step it back.
  //
  // finishPreparingOrder's own guard has always allowed it -- `items.length
  // && items.some(...)` short-circuits on an empty array -- so the function
  // would complete such an order the moment anything called it. This is the
  // button agreeing with the function it calls.
  const allAnswered = items.every(itemPickAnswered);
  const shortCount = pickShortfallLines(q).length;
  // Named on the button, because finishing an order that is going out
  // incomplete should not look identical to finishing one that is not.
  const label = shortCount
    ? `Finish — ${shortCount} item${shortCount===1?'':'s'} Short`
    : 'Mark as finished';
  el.innerHTML = allAnswered ? `<button type="button" class="btn btn-accent wv-mark-btn${shortCount?' is-short':''}" id="wv_finish_btn" style="margin-top:6px;">${label}</button>` : '';
  if(allAnswered) document.getElementById('wv_finish_btn').addEventListener('click', ()=>finishPreparingOrder(q.id));
}

// Workers can also be picked as the delivery person for an order (many
// shops don't have dedicated riders spare for every order) -- dedicated
// delivery personnel aren't assumed to also prepare/pack, though.
const STAFF_ROLE_LABELS = {worker:'Worker', delivery:'Delivery personnel'};
function staffEligibleForRole(s, role){
  if(role==='delivery') return s.role==='delivery' || s.role==='worker';
  return s.role===role;
}
// Resolves a staff id to a display name -- falls back gracefully if the
// staff member was since deleted, so an order's assignment history still
// shows something sane instead of breaking.
function staffName(id){
  if(!id) return '';
  const s = (data.staff||[]).find(x=>x.id===id);
  return s ? s.name : '(removed staff)';
}

function savedAgoLabel(iso){
  if(!iso) return '';
  const then = new Date(iso).getTime();
  if(isNaN(then)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - then)/1000));
  if(diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec/60);
  if(diffMin < 60) return `${diffMin} minute${diffMin===1?'':'s'} ago`;
  const diffHr = Math.floor(diffMin/60);
  if(diffHr < 24) return `${diffHr} hour${diffHr===1?'':'s'} ago`;
  const diffDay = Math.floor(diffHr/24);
  return `${diffDay} day${diffDay===1?'':'s'} ago`;
}

// Orders a staff member is currently on, in either capacity: an order
// they're assigned to prep sits in Being Prepared, one they're assigned
// to deliver sits in Pending Delivery -- checked independently of their
// primary role since a worker can be doing either. Mirrors the same
// per-step visibility rule the order cards themselves use.
//
// Voided counts as not being on it. Cancelling an order sets the flag and
// nothing else -- the status and the assignment both stay -- so without
// this a cancelled order went on reporting the person as busy: "Preparing
// for Moses — since 3 hours ago", to an admin picking someone for a
// delivery and on the Staff tab, while that worker's own screen showed
// them nothing to do. Every other reader of "is this order still live"
// (myWorkerOrders, autoAssignNextOrder) already excludes voided.
function staffActiveOrders(s){
  const live = data.savedQuotes.filter(q=>!q.voided && !quoteAgedOffBoard(q));
  // Packed is not picking: the goods are on the floor waiting for the
  // transport, and the picker is free for the next order the moment they
  // tap finish (which is also when autoAssignNextOrder hands them one).
  const asWorker = live
    .filter(q=>q.assignedWorkerId===s.id && q.status==='preparing' && q.pickingStatus!=='done')
    .map(q=>({order:q, capacity:'worker'}));
  const asDelivery = live
    .filter(q=>q.assignedDeliveryId===s.id && q.status==='pending_delivery')
    .map(q=>({order:q, capacity:'delivery'}));
  return [...asWorker, ...asDelivery];
}

// staffEligibleForRole above is what the Loaded form (carrierFormHTML)
// reads to list who of ours can carry an order; STAFF_ROLE_LABELS is the
// Staff tab's.

// An agent's own payment term gates whether their draft order can even
// start being prepared -- "pay before we prepare" (set per-agent in the
// admin app's Sales Agents tab) only means something if something
// actually checks it before letting the order move. Non-agent orders
// (originAgentId unset) are never gated. Needs data.agents, which both
// the admin app and the worker apps now load (a plain worker/delivery
// session can read it read-only -- see 0013_agents_readable_by_shop_members.sql).
function agentPaymentBlocksPreparing(q){
  if(!q.originAgentId) return false;
  const agent = (data.agents||[]).find(a=>a.id===q.originAgentId);
  return !!(agent && agent.paymentTerm==='prepay' && q.agentPaymentStatus!=='paid');
}

// A worker says the order is picked and packed. That is the whole of
// what they are reporting, and it is all this does.
//
// It used to move the order to Pending Delivery as well, which said
// "out for delivery" of goods still sitting on the floor -- hired
// transport arrives later than the picker finishes. Packed is now its
// own state (pickingStatus 'done', still in Preparing, stamped with
// pickingDoneAt), and the order leaves when somebody taps "Loaded, it has
// gone" with the carrier's name -- see loadOrder. The picker is free the
// moment they finish: staffActiveOrders drops a packed order, and the
// next one in the queue is handed to them here.
async function finishPreparingOrder(orderId){
  const q = data.savedQuotes.find(x=>x.id===orderId);
  if(!q) return;
  // This app's copy of an order can be behind -- the poll skips a hidden
  // app, the quiet period after a touch, and any refresh that failed.
  // Without this, finishing a pick on an order an admin had since moved on
  // (loaded, delivered) would mark a pick done on an order that is out of
  // the building -- a write driven entirely by a stale screen.
  if(q.status !== 'preparing' && q.status !== 'draft'){
    toast('This order has already moved on — refresh to see where it is now', 5000);
    return;
  }
  const items = q.items||[];
  if(items.length && items.some(row=>!itemPickAnswered(row))) return; // guard: button is hidden otherwise
  // One write, and no await anywhere before it, for the reason recorded in
  // test/worker-finish-refresh.test.js: a background refresh replaces
  // `data`, and a field set after an await lands in a discarded copy.
  q.pickingStatus = 'done';
  q.pickingDoneAt = Date.now();
  const workerId = q.assignedWorkerId;
  await saveData();
  if(workerId) autoAssignNextOrder(workerId);
  refreshAdminOrderBoardIfOpen();
  renderWorkerView();
}

// Opportunistic hand-over: when a worker finishes an order, the top of the
// pickers' queue is put in front of them (as awaiting accept, so their
// phone asks). The queue is workerPickQueue -- the one rule -- so what is
// handed here is exactly what "Take the next one" would have taken, and
// never a draft: an order in Taken is still waiting on its suppliers.
function autoAssignNextOrder(workerId){
  const staff = data.staff.find(s=>s.id===workerId);
  if(!staff || staff.unavailable) return null;
  const next = workerPickQueue()[0];
  if(!next) return null;
  next.assignedWorkerId = workerId;
  next.pickingStatus = 'awaiting_accept';
  next.pickCursor = 0;
  next.pickingAssignedAt = Date.now();
  saveData(); // saveData()'s upsert is what the notify-worker webhook fires on
  refreshAdminOrderBoardIfOpen();
  return next;
}

// True only inside the installed Android APK (Capacitor's native bridge
// injects `window.Capacitor` into WebView pages loaded from the app's own
// local origin) -- false for a plain browser tab, which has no native push
// channel at all now that Web Push has been retired in favor of native FCM
// (browser-based delivery couldn't reliably foreground the installed app,
// and every worker install is the APK now).
function isNativeApp(){
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

async function enableWorkerPushNotifications(){
  if(!myStaff){ toast('No staff profile linked to this login yet'); return; }
  if(!isNativeApp()){ toast('Notifications require the installed app'); return; }
  return enableNativePush();
}
document.getElementById('wv_enablePushBtn').addEventListener('click', enableWorkerPushNotifications);

// Native (installed APK) push: permission + registration go through the
// plugin's own Android-native prompts, not the web Notification API. The
// actual FCM token doesn't come back from register() itself -- it arrives
// asynchronously via the 'registration' listener set up once in
// registerNativePushListeners(), called from worker.html's boot().
async function enableNativePush(){
  const { PushNotifications } = window.Capacitor.Plugins;
  try{
    let perm = await PushNotifications.checkPermissions();
    if(perm.receive!=='granted') perm = await PushNotifications.requestPermissions();
    if(perm.receive!=='granted'){ toast('Notifications permission was not granted'); return; }
    await PushNotifications.register();
  }catch(err){
    toast(`Could not enable notifications: ${err.message||err}`);
  }
}
function registerNativePushListeners(){
  const { PushNotifications } = window.Capacitor.Plugins;
  PushNotifications.addListener('registration', async (token)=>{
    // boot() also calls this silently on every native launch (once already
    // subscribed) to keep the stored token current after a reinstall --
    // only toast on a genuine first-time opt-in, not that silent refresh.
    const wasAlreadySubscribed = hasPushSubscription;
    // Kept so signing out can remove this device's row and no other.
    myPushToken = token.value;
    const { error } = await sb.from('push_subscriptions').upsert({
      shop_id: currentShopId, staff_id: myStaff.id, user_id: currentUser.id,
      fcm_token: token.value
    }, { onConflict: 'fcm_token' });
    if(error){ toast(`Could not enable notifications: ${error.message}`); return; }
    hasPushSubscription = true;
    const wrap = document.getElementById('wv_enablePushWrap');
    if(wrap) wrap.style.display = 'none';
    if(!wasAlreadySubscribed) toast('Notifications enabled');
  });
  PushNotifications.addListener('registrationError', (err)=>{
    toast(`Could not enable notifications: ${(err && err.error) || err}`);
  });
  // Native delivers the tap straight into this listener with the order id
  // already attached -- delivered straight from the OS, no cold-start URL
  // round-trip needed (that was only ever a Web Push workaround, for a
  // clients.openWindow() call that can't postMessage into a page that
  // doesn't exist yet).
  PushNotifications.addListener('pushNotificationActionPerformed', (action)=>{
    const orderId = action.notification && action.notification.data && action.notification.data.orderId;
    if(orderId) routeNotificationAction(orderId, action.actionId);
  });
}

async function routeNotificationAction(orderId, action){
  orderId = Number(orderId);
  if(!orderId) return;
  // goToTab() only exists in the admin app (multiple tabs); the
  // standalone worker app has nothing else to switch away from.
  if(typeof goToTab === 'function') goToTab('worker');
  // A tap can arrive while the app was merely backgrounded (not killed),
  // so the in-memory order list may still be whatever it was before this
  // push -- refreshing first means accept/deny always finds the order,
  // and a plain tap (no action button attached to the notification, the
  // only real case right now) still lands on an up-to-date screen instead
  // of showing nothing new until some other refresh happens to occur.
  if(typeof loadWorkerData === 'function' && currentShopId){
    try{
      // Built before either is assigned, for the same reason as everywhere
      // else: addDiffOps derives its deletes from lastSynced, so leaving
      // `data` fresh and `lastSynced` stale is a delete instruction, not a
      // stale render. This catch only logs, so a throw in between would
      // have left exactly that state and carried on.
      const fresh = await loadWorkerData(currentShopId);
      const freshSynced = { savedQuotes: keyRowsById(buildWorkerSyncRows(fresh, currentShopId).savedQuotes, 'id') };
      data = fresh;
      lastSynced = freshSynced;
      if(currentUser) myStaff = data.staff.find(s=>s.userId===currentUser.id) || myStaff;
    }catch(err){
      console.error('Failed to refresh after notification tap:', err);
    }
  }
  if(action==='accept') acceptOrderAssignment(orderId);
  else if(action==='deny') denyOrderAssignment(orderId);
  else renderWorkerView();
}
