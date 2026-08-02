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

// Diffs `rows` (keyed by `idField`) against lastSynced[collectionKey] and
// pushes at most one upsert op and one delete op onto `ops` for whatever
// actually changed. Each op carries its own commit(), so lastSynced only
// advances for the parts of the write that actually succeeded -- a part
// that fails gets re-diffed (and retried) on the next save call.
function addDiffOps(ops, collectionKey, tableName, idField, shopId, rows){
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

function ensureAuthOverlay(){
  let el = document.getElementById('authOverlay');
  if(el) return el;
  el = document.createElement('div');
  el.id = 'authOverlay';
  el.style.cssText = 'position:fixed;inset:0;background:#111;color:#eee;display:flex;align-items:center;justify-content:center;z-index:99999;font-family:sans-serif;';
  document.body.appendChild(el);
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

function showLoginScreen(){
  return new Promise((resolve)=>{
    const el = ensureAuthOverlay();
    el.innerHTML = `
      <div style="background:#1c1c1c;padding:32px;border-radius:12px;width:320px;max-width:90vw;">
        <h2 style="margin:0 0 16px;font-size:18px;">Sign in</h2>
        <input id="auth_email" type="email" placeholder="Email" style="width:100%;padding:10px;margin-bottom:8px;border-radius:6px;border:1px solid #444;background:#111;color:#eee;box-sizing:border-box;">
        <input id="auth_password" type="password" placeholder="Password" style="width:100%;padding:10px;margin-bottom:12px;border-radius:6px;border:1px solid #444;background:#111;color:#eee;box-sizing:border-box;">
        <div id="auth_status" style="font-size:13px;margin-bottom:8px;min-height:16px;"></div>
        <button id="auth_signin_btn" style="width:100%;padding:10px;margin-bottom:8px;border-radius:6px;border:none;background:#2F7FBF;color:#fff;cursor:pointer;">Sign in</button>
        <button id="auth_signup_btn" style="width:100%;padding:10px;margin-bottom:8px;border-radius:6px;border:1px solid #444;background:transparent;color:#eee;cursor:pointer;">Create account</button>
        <button id="auth_forgot_btn" type="button" style="width:100%;padding:6px;border:none;background:transparent;color:#8ab4e0;cursor:pointer;font-size:13px;">Forgot password?</button>
      </div>`;
    const statusEl = el.querySelector('#auth_status');
    const setStatus = (msg, kind)=>{
      statusEl.textContent = msg;
      statusEl.style.color = kind==='ok' ? '#3A9A5C' : kind==='busy' ? '#aaa' : '#f66';
    };
    const doAuth = async (mode)=>{
      const email = el.querySelector('#auth_email').value.trim();
      const password = el.querySelector('#auth_password').value;
      if(!email || !password){ setStatus('Enter an email and password', 'err'); return; }
      const signinBtn = el.querySelector('#auth_signin_btn');
      const signupBtn = el.querySelector('#auth_signup_btn');
      signinBtn.disabled = true; signupBtn.disabled = true;
      setStatus(mode==='signup' ? 'Creating account…' : 'Signing in…', 'busy');
      const { error } = mode==='signup'
        ? await sb.auth.signUp({email, password})
        : await sb.auth.signInWithPassword({email, password});
      if(error){
        signinBtn.disabled = false; signupBtn.disabled = false;
        setStatus(error.message, 'err');
        return;
      }
      // Confirm there's a real, server-validated user before declaring
      // success -- a signUp() on a project with email confirmation ON
      // returns no error but also no usable session yet.
      const user = await getAuthedUser();
      signinBtn.disabled = false; signupBtn.disabled = false;
      if(!user){
        setStatus('Check your email to confirm your account, then sign in.', 'err');
        return;
      }
      setStatus('Signed in — loading your shop…', 'ok');
      resolve();
    };
    el.querySelector('#auth_signin_btn').addEventListener('click', ()=>doAuth('signin'));
    el.querySelector('#auth_signup_btn').addEventListener('click', ()=>doAuth('signup'));
    el.querySelector('#auth_forgot_btn').addEventListener('click', async ()=>{
      const email = (el.querySelector('#auth_email').value||'').trim();
      if(!email){ setStatus('Enter your email above first, then tap "Forgot password?"', 'err'); return; }
      setStatus('Sending reset link…', 'busy');
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      setStatus(error ? error.message : 'Check your email for a password reset link.', error ? 'err' : 'ok');
    });
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
// So the second attempt reuses the first one's shop instead of stranding
// another. Matched on name: adopting a shop the user called something else
// would silently rename what they asked for. An orphan under a different
// name is left alone.
async function adoptHalfCreatedShop(name){
  // Only reached from showCreateShopScreen, which only runs when this user
  // has no shop_members rows at all -- so every shop they created is one
  // they are not a member of.
  const { data: mine, error } = await sb.from('shops').select('id, name').eq('created_by', currentUser.id);
  if(error || !Array.isArray(mine)) return null;
  return mine.find(s=>s.name === name) || null;
}

function showCreateShopScreen(){
  return new Promise((resolve)=>{
    const el = ensureAuthOverlay();
    el.innerHTML = `
      <div style="background:#1c1c1c;padding:32px;border-radius:12px;width:320px;max-width:90vw;color:#eee;font-family:sans-serif;">
        <h2 style="margin:0 0 8px;font-size:18px;">Create your shop</h2>
        <p style="margin:0 0 16px;font-size:13px;color:#aaa;">You're not a member of any shop yet. Create one to get started.</p>
        <input id="shop_name" type="text" placeholder="Shop name" style="width:100%;padding:10px;margin-bottom:12px;border-radius:6px;border:1px solid #444;background:#111;color:#eee;box-sizing:border-box;">
        <div id="shop_error" style="color:#f66;font-size:13px;margin-bottom:8px;min-height:16px;"></div>
        <button id="shop_create_btn" style="width:100%;padding:10px;border-radius:6px;border:none;background:#2F7FBF;color:#fff;cursor:pointer;">Create shop</button>
      </div>`;
    const errEl = el.querySelector('#shop_error');
    const btn = el.querySelector('#shop_create_btn');
    btn.addEventListener('click', async ()=>{
      errEl.textContent = '';
      const name = el.querySelector('#shop_name').value.trim();
      if(!name){ errEl.textContent = 'Enter a shop name'; return; }
      // Creating a shop is two writes that cannot be made atomic from the
      // client, and a half-finished one cannot be cleaned up afterwards, so
      // a second click must not start a second attempt.
      btn.disabled = true;
      const fail = (msg)=>{ btn.disabled = false; errEl.textContent = msg; };
      try{
        let shop = await adoptHalfCreatedShop(name);
        if(!shop){
          const { data: created, error: shopErr } = await sb.from('shops').insert({name, created_by: currentUser.id}).select().single();
          if(shopErr){ fail(shopErr.message); return; }
          shop = created;
        }
        const { error: memberErr } = await sb.from('shop_members').insert({shop_id: shop.id, user_id: currentUser.id, role: 'owner'});
        if(memberErr){ fail(memberErr.message); return; }
        currentShopId = shop.id;
        data = (typeof seedData === 'function') ? seedData() : { savedQuotes: [] };
        await saveData();
        resolve(shop.id);
      }catch(e){
        // saveData() and the lookup above can both throw. Without this the
        // promise never settles: the overlay stays up, the button stays
        // dead, and boot() never reaches its own error handler.
        fail((e && e.message) || String(e));
      }
    });
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

  if(!memberships.length){
    currentShopId = await showCreateShopScreen();
    currentMemberRole = 'owner';
  } else if(memberships.length === 1){
    currentShopId = memberships[0].shop_id;
    currentMemberRole = memberships[0].role;
  } else {
    currentShopId = await showShopPicker(memberships);
    currentMemberRole = (memberships.find(m=>m.shop_id===currentShopId)||{}).role || null;
  }
  hideAuthOverlay();
}

async function signOutAndReload(){
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

function renderWorkerView(){
  if(!myStaff){
    document.getElementById('wv_pendingWrap').innerHTML = `<div class="empty">This login isn't linked to a staff profile yet. Ask an admin to send you a login invite from the Staff tab.</div>`;
    document.getElementById('wv_activeWrap').innerHTML = '';
    return;
  }
  const greetingEl = document.getElementById('wv_greeting');
  if(greetingEl) greetingEl.textContent = `${timeOfDayGreeting()}, ${(myStaff.name||'').split(' ')[0] || 'there'}`;
  document.getElementById('wv_enablePushWrap').style.display = (isNativeApp() && !hasPushSubscription) ? '' : 'none';
  const mine = myWorkerOrders();
  const pending = mine.filter(q=>q.pickingStatus==='awaiting_accept');
  const active = mine.find(q=>q.pickingStatus==='in_progress');
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
          <p class="wv-hero-progress-label">${answered} of ${items.length} picked${shortCount ? ` · ${shortCount} short` : ''}</p>
          <div class="wv-hero-track"><div class="wv-hero-fill" style="width:${pct}%;"></div></div>
        </div>`;
    }
  }
  renderWorkerPendingList(pending, !!active);
  renderWorkerPickStepper(active);
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

function renderWorkerPendingList(pending, hasActive){
  const wrap = document.getElementById('wv_pendingWrap');
  if(!pending.length){
    // With a pick open the carousel fills the screen and an empty pending
    // list needs no comment. With nothing open it left the page blank below
    // the title, which reads as a screen that failed to load rather than a
    // shop with no work waiting -- and this app loads once and never
    // refreshes itself, so a worker had no way to tell the two apart or any
    // reason to think waiting would help.
    wrap.innerHTML = hasActive ? '' : `<div class="empty">Nothing to pick right now. New orders appear here as soon as they're assigned to you.</div>`;
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
  q.pickingStatus = 'in_progress';
  q.workerAcceptedAt = Date.now();
  q.pickCursor = 0;
  (q.items||[]).forEach(it=>{ if(!it.pickStatus) it.pickStatus='pending'; });
  saveData();
  renderWorkerView();
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
  if(!it.supplierId || it.supplierId==='__stock__') return 'Shop';
  const sup = (data.suppliers||[]).find(s=>s.id===it.supplierId);
  if(!sup) return it.supplierName || 'Supplier';
  return sup.location ? `${sup.name} — ${sup.location}` : sup.name;
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
    wrap.innerHTML = `<div class="wv-card"><div class="wv-card-sub">No items on this order.</div></div>`;
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
    const unit = it.packUnit || it.unit || '';
    // The label followed the fallback above, not the outcome: an item with
    // no packUnit falls back to its base unit and was still announced as
    // "Pack", so a card read "Pack / 3 pc" for something that is not sold
    // in packs at all.
    const qtyLabel = it.packUnit ? 'Pack' : 'Quantity';
    const variant = pickItemVariantLabel(it, product);
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
    // The badge carries all three states. A short pick reads as the two
    // numbers rather than a word -- "3 of 5" is what the picker has to
    // check against the bags in their hand, and it is the same figure the
    // admin's board and the invoice gate will report later.
    const badgeClass = isShort ? 'short' : (isDone ? 'done' : 'pending');
    const badgeLabel = isShort ? `${picked} of ${itemOrderedQty(it)}`
      : (isDone ? ICON_CHECK_SMALL+'Picked' : 'Pick');
    return `<div class="wv-carousel-card ${i===cursor?'focused':''}" data-idx="${i}">
      <div class="wv-carousel-card-inner" data-idx="${i}">
        <div class="wv-carousel-photo">${ipStageThumbHTML(product||{})}</div>
        <button type="button" class="wv-carousel-badge ${badgeClass}">${badgeLabel}</button>
        <div class="wv-carousel-body">
          <div class="wv-carousel-name">${esc((product && product.name) || it.productName || 'Item')}</div>
          ${variant ? `<div class="wv-carousel-variant">${esc(variant)}</div>` : ''}
          <div class="wv-carousel-qty-label">${esc(qtyLabel)}</div>
          <div class="wv-carousel-qty">${esc(qty)}${unit ? ` <span class="u">${esc(unit)}</span>` : ''}</div>
        </div>
        <div class="wv-carousel-source"><div class="wv-carousel-source-label">Pick From:</div><div class="wv-carousel-source-value">${esc(pickItemSourceLabel(it))}</div></div>
        <button type="button" class="wv-carousel-short" data-act="short">${isShort ? 'Change the number found' : 'Couldn’t find them all?'}</button>
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
  // A single listener on the whole card (photo + badge + name/qty/source)
  // -- tapping the "Pick"/"Picked" badge button (or anywhere else on a
  // focused card) toggles it; the badge button click bubbles up here
  // rather than needing its own separate handler.
  //
  // The short-pick control is the one part of the card that must NOT be
  // swallowed by that gesture, so it is claimed by data-act before the
  // toggle. Checked with closest() rather than against the button itself,
  // or a tap that lands on something inside it falls through to the toggle
  // and records a full pick -- the exact claim it exists to avoid making.
  carousel.querySelectorAll('.wv-carousel-card-inner').forEach(inner=>{
    inner.addEventListener('click', (e)=>{
      const card = inner.closest('.wv-carousel-card');
      const idx = Number(inner.dataset.idx);
      if(!card.classList.contains('focused')){ centerCarouselCard(carousel, card, true); return; }
      if(e.target.closest('[data-act="short"]')) promptPickedQty(q.id, idx);
      else toggleItemPickedAt(q.id, idx);
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
  const allAnswered = items.length>0 && items.every(itemPickAnswered);
  const shortCount = pickShortfallLines(q).length;
  // Named on the button, because finishing an order that is going out
  // incomplete should not look identical to finishing one that is not.
  const label = shortCount
    ? `Finish — ${shortCount} item${shortCount===1?'':'s'} short`
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
function staffActiveOrders(s){
  const asWorker = data.savedQuotes
    .filter(q=>q.assignedWorkerId===s.id && q.status==='preparing' && !quoteAgedOffBoard(q))
    .map(q=>({order:q, capacity:'worker'}));
  const asDelivery = data.savedQuotes
    .filter(q=>q.assignedDeliveryId===s.id && q.status==='pending_delivery' && !quoteAgedOffBoard(q))
    .map(q=>({order:q, capacity:'delivery'}));
  return [...asWorker, ...asDelivery];
}

// A minimal, DOM-independent version of the admin board's assign-staff
// modal -- built at call time instead of relying on markup that only
// exists in the admin app (#assignStaffModal), so it works the same in
// the standalone worker app. Resolves the picked staff id, or null if
// there's nobody eligible or the worker backs out (tapping the backdrop),
// in which case the order simply stays in Being Prepared and an admin can
// still assign delivery from Order Tracking as always.
function promptAssignDelivery(orderId){
  return new Promise((resolve)=>{
    const candidates = (data.staff||[]).filter(s=>staffEligibleForRole(s, 'delivery') && !s.unavailable);
    if(!candidates.length){
      toast(`Add a ${STAFF_ROLE_LABELS.delivery} in the Staff tab first`);
      resolve(null);
      return;
    }
    const q = data.savedQuotes.find(x=>x.id===orderId);
    const el = document.createElement('div');
    // Classed so the background refresh can see it and hold off -- this is a
    // decision mid-flow, and re-rendering underneath it would replace the
    // order it's asking about.
    el.className = 'wv-assign-overlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(15,20,26,0.6);display:flex;align-items:center;justify-content:center;z-index:400;padding:20px;';
    el.innerHTML = `
      <div style="background:var(--panel);border-radius:14px;padding:20px;width:340px;max-width:100%;max-height:80vh;overflow-y:auto;">
        <div style="font-weight:700;font-size:16px;margin-bottom:4px;">Who's delivering this?</div>
        <div style="color:var(--ink-soft);font-size:13px;margin-bottom:14px;">Choose who's taking "${esc(q ? (q.client.name||'this order') : 'this order')}" out for delivery.</div>
        <div id="wvAssignList" style="display:flex;flex-direction:column;gap:8px;"></div>
      </div>`;
    // Explicit display:block on each row -- the shared .btn class does
    // `all:unset` (needed so it doesn't inherit default <button> chrome),
    // which also resets display to its initial value (inline) unless a
    // flex/grid parent blockifies it for free. These rows have neither, so
    // width:100% would otherwise be silently ignored and every candidate's
    // name would run together instead of stacking -- exactly what caused
    // the reported overlap.
    el.querySelector('#wvAssignList').innerHTML = candidates.map(s=>{
      const activeOrders = staffActiveOrders(s);
      const busy = activeOrders.length>0;
      const statusLine = busy
        ? activeOrders.map(({order:o, capacity})=>`${capacity==='worker'?'Preparing':'Delivering'} for ${esc(o.client.name||'Unnamed client')} — since ${esc(savedAgoLabel(o.stageEnteredAt))}`).join('<br>')
        : 'Idle';
      return `
        <button type="button" class="btn btn-ghost" style="display:block;width:100%;text-align:left;padding:10px 12px;" data-id="${esc(s.id)}">
          <div style="font-weight:700;">${esc(s.name)}${s.phone ? ` <span style="font-weight:400;color:var(--ink-soft);">— ${esc(s.phone)}</span>` : ''}</div>
          <div style="font-size:12px;margin-top:2px;color:${busy?'var(--accent-ink)':'var(--good)'};">${statusLine}</div>
        </button>`;
    }).join('');
    const finish = (id)=>{ document.body.removeChild(el); resolve(id); };
    el.querySelectorAll('button[data-id]').forEach(btn=>{
      btn.addEventListener('click', ()=>finish(btn.dataset.id));
    });
    el.addEventListener('mousedown', (e)=>{ if(e.target===el) finish(null); });
    document.body.appendChild(el);
  });
}

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

// Mirrors the admin board's own step-forward pipeline (preparing ->
// pending_delivery requires picking a delivery person first) instead of
// just forcing the status forward -- skipping that gate meant orders a
// worker finished never got a delivery person assigned, and never got a
// second chance to since the status had already moved past it. An agent
// order set to pick up themselves skips that picker entirely -- there's
// no shop delivery staff to assign -- using the same '__agent__' sentinel
// the admin board's own stepSavedQuoteStatus() uses for the same case.
async function finishPreparingOrder(orderId){
  const q = data.savedQuotes.find(x=>x.id===orderId);
  if(!q) return;
  // This app loads once and never refreshes on its own, so its copy of an
  // order can be hours behind. Without this, finishing a pick on an order
  // an admin had since moved on (delivered, completed) would drag it back
  // to pending_delivery -- a status regression driven entirely by a stale
  // screen, and invisible to whoever had already moved it.
  if(q.status !== 'preparing' && q.status !== 'draft'){
    toast('This order has already moved on — refresh to see where it is now', 5000);
    return;
  }
  const items = q.items||[];
  if(items.length && items.some(row=>!itemPickAnswered(row))) return; // guard: button is hidden otherwise
  q.pickingStatus = 'done';
  // Awaited: this function saves twice, and a save now re-reads the row
  // before writing it. Left unawaited the two overlap, and whichever upsert
  // lands last wins -- so the first save's older snapshot could land after
  // the second's and quietly undo the status move below.
  await saveData(); // persist the finished pick state even if delivery assignment below is skipped or cancelled

  let deliveryStaffId;
  if(q.deliveryMode==='agent_pickup'){
    deliveryStaffId = '__agent__';
  } else {
    deliveryStaffId = await promptAssignDelivery(orderId);
    if(!deliveryStaffId){
      // Backing out has to leave the order somewhere this app can still
      // show it. 'done' is neither awaiting_accept nor in_progress, so both
      // lists skipped it -- the worker was left staring at an empty screen
      // while still holding an order that was blocked on them, with no way
      // back to it.
      q.pickingStatus = 'in_progress';
      await saveData();
      renderWorkerView();
      return;
    }
  }

  q.assignedDeliveryId = deliveryStaffId;
  q.status = 'pending_delivery';
  q.stageEnteredAt = Date.now();
  const workerId = q.assignedWorkerId;
  await saveData();
  if(workerId) autoAssignNextOrder(workerId);
  refreshAdminOrderBoardIfOpen();
  renderWorkerView();
}

// Opportunistic auto-assign: whenever a worker finishes an order they may
// already have others assigned to them (being handed an order has never been
// exclusive -- only accepting one is), so this just hands them the unassigned
// order that has been waiting longest and still needs preparation, if one
// exists -- skipping any agent order
// that's still waiting on its required prepayment, since that one isn't
// actually ready to be worked on yet.
function autoAssignNextOrder(workerId){
  const staff = data.staff.find(s=>s.id===workerId);
  if(!staff || staff.unavailable) return;
  // How long the order has actually been waiting, which is not savedAt --
  // that is rewritten on every save, so this sorted by least-recently-edited
  // and an order went to the back of the queue each time anyone touched it.
  // A five-hour-old order with a corrected line lost its place to one taken
  // an hour ago, and one being repeatedly amended could keep losing it.
  // stageEnteredAt is the field the board's own overdue warning treats as
  // "waiting since", and re-saving a quote deliberately does not reset it.
  const waitingSince = (q)=> q.stageEnteredAt || new Date(q.savedAt||0).getTime() || 0;
  const next = data.savedQuotes
    .filter(q=>!q.voided && !q.assignedWorkerId && !quoteAgedOffBoard(q) && (q.status==='draft' || q.status==='preparing') && !agentPaymentBlocksPreparing(q))
    .sort((a,b)=> waitingSince(a) - waitingSince(b))[0];
  if(!next) return;
  next.assignedWorkerId = workerId;
  next.pickingStatus = 'awaiting_accept';
  next.pickCursor = 0;
  next.pickingAssignedAt = Date.now();
  if(next.status==='draft'){ next.status = 'preparing'; next.stageEnteredAt = Date.now(); }
  saveData(); // saveData()'s upsert is what the notify-worker webhook fires on
  refreshAdminOrderBoardIfOpen();
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
