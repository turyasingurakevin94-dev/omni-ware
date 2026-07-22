// Shared between index.html (the admin app's "Worker view" tab) and
// worker.html (the standalone worker app) -- this is the actual pick &
// pack UI/logic, iterated on heavily, that both apps must stay identical
// on. It expects the HOST page to already have declared these globals
// before this script runs any of its top-level side effects: `sb`,
// `data`, `saveData`, `currentShopId`, `currentUser`, `currentMemberRole`,
// `myStaff`, `hasPushSubscription`, `VAPID_PUBLIC_KEY`,
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

function ipStageThumbHTML(product){
  if(product.image) return `<img class="q-stage-thumb img-zoomable" src="${product.image}" alt="${esc(product.name)}">`;
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
    el.querySelector('#setpw_save_btn').addEventListener('click', async ()=>{
      errEl.textContent = '';
      const pw1 = el.querySelector('#setpw_pw1').value;
      const pw2 = el.querySelector('#setpw_pw2').value;
      if(pw1.length < 6){ errEl.textContent = 'Password must be at least 6 characters'; return; }
      if(pw1 !== pw2){ errEl.textContent = 'Passwords do not match'; return; }
      const { error } = await sb.auth.updateUser({ password: pw1 });
      if(error){ errEl.textContent = error.message; return; }
      resolve();
    });
  });
}

function showShopPicker(memberships){
  return new Promise((resolve)=>{
    const el = ensureAuthOverlay();
    const options = memberships.map(m=>`<option value="${m.shop_id}">${(m.shops && m.shops.name) || m.shop_id}</option>`).join('');
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
  document.getElementById('wv_enablePushWrap').style.display = ('Notification' in window && !hasPushSubscription) ? '' : 'none';
  const mine = myWorkerOrders();
  const pending = mine.filter(q=>q.pickingStatus==='awaiting_accept');
  const active = mine.find(q=>q.pickingStatus==='in_progress');
  // Hide the generic page heading while a worker is actively picking --
  // the client's name already shows above the carousel, and reclaiming
  // that space helps the whole card fit on one screen without scrolling.
  const pageHead = document.getElementById('wv_pageHead');
  if(pageHead) pageHead.style.display = active ? 'none' : '';
  renderWorkerPendingList(pending);
  renderWorkerPickStepper(active);
}

function renderWorkerPendingList(pending){
  const wrap = document.getElementById('wv_pendingWrap');
  if(!pending.length){ wrap.innerHTML=''; return; }
  wrap.innerHTML = pending.map(q=>`
    <div class="wv-card" data-id="${q.id}">
      <div class="wv-card-title">${esc(q.client.name||'Unnamed client')}</div>
      <div class="wv-card-sub">${(q.items||[]).length} item${(q.items||[]).length===1?'':'s'} to prepare</div>
      <div class="wv-actions">
        <button type="button" class="btn btn-accent wv-accept-btn">Accept</button>
        <button type="button" class="btn btn-ghost wv-deny-btn">Deny</button>
      </div>
    </div>`).join('');
  wrap.querySelectorAll('.wv-accept-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>acceptOrderAssignment(Number(btn.closest('[data-id]').dataset.id)));
  });
  wrap.querySelectorAll('.wv-deny-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>denyOrderAssignment(Number(btn.closest('[data-id]').dataset.id)));
  });
}

function acceptOrderAssignment(orderId){
  const q = data.savedQuotes.find(x=>x.id===orderId);
  if(!q || q.pickingStatus!=='awaiting_accept') return;
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
  if(!q) return;
  q.assignedWorkerId = null;
  q.pickingStatus = null;
  saveData();
  renderWorkerView();
  refreshAdminOrderBoardIfOpen();
  toast('Order declined — it\'s back in the unassigned pool');
}

// "Where to get it" reuses the item's existing supplierId, exactly as the
// Purchase Invoices / stock-deduction logic elsewhere already treats it:
// '__stock__' or unset means the shop's own shelf stock, anything else is a
// real supplier row to source it from.
function pickItemSourceLabel(it){
  if(!it.supplierId || it.supplierId==='__stock__') return 'Pick from shop';
  const sup = (data.suppliers||[]).find(s=>s.id===it.supplierId);
  if(!sup) return it.supplierName || 'Supplier';
  return sup.location ? `${sup.name} — ${sup.location}` : sup.name;
}

const ICON_CHECK_SMALL = '<svg class="icon" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';

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
    wrap.innerHTML = `<div class="wv-card"><div class="wv-card-title">${esc(q.client.name||'Unnamed client')}</div><div class="wv-card-sub">No items on this order.</div></div>`;
    return;
  }
  const cursor = Math.min(Math.max(q.pickCursor||0, 0), items.length-1);

  const cardsHTML = items.map((it, i)=>{
    const product = (data.products||[]).find(p=>p.id===it.productId);
    const isDone = it.pickStatus==='done';
    const qty = it.qty!=null ? it.qty : '';
    const unit = it.packUnit || it.unit || '';
    return `<div class="wv-carousel-card ${i===cursor?'focused':''}" data-idx="${i}">
      <div class="wv-carousel-card-inner" data-idx="${i}">
        <div class="wv-carousel-photo">${ipStageThumbHTML(product||{})}</div>
        <button type="button" class="wv-carousel-badge ${isDone?'done':'pending'}">${isDone ? ICON_CHECK_SMALL+'Picked' : 'Pick'}</button>
        <div class="wv-carousel-body">
          <div class="wv-carousel-name">${esc(it.productName||'Item')}</div>
          <div class="wv-carousel-qty-label">Pack</div>
          <div class="wv-carousel-qty">${esc(qty)} ${esc(unit)}</div>
        </div>
        <div class="wv-carousel-source">${esc(pickItemSourceLabel(it))}</div>
      </div>
    </div>`;
  }).join('');

  const dotsHTML = `<div class="wv-carousel-dots">${items.map((_,i)=>`<span class="wv-carousel-dot ${i===cursor?'focused':''}"></span>`).join('')}</div>`;

  wrap.innerHTML = `
    <div class="wv-carousel-title">${esc(q.client.name||'Unnamed client')}</div>
    <div class="wv-carousel" id="wv_carousel">${cardsHTML}</div>
    ${dotsHTML}
    <div id="wv_finishWrap"></div>
  `;

  const carousel = document.getElementById('wv_carousel');
  // A single listener on the whole card (photo + badge + name/qty/source)
  // -- tapping the "Pick"/"Picked" badge button (or anywhere else on a
  // focused card) toggles it; the badge button click bubbles up here
  // rather than needing its own separate handler.
  carousel.querySelectorAll('.wv-carousel-card-inner').forEach(inner=>{
    inner.addEventListener('click', ()=>{
      const card = inner.closest('.wv-carousel-card');
      if(card.classList.contains('focused')) toggleItemPickedAt(q.id, Number(inner.dataset.idx));
      else card.scrollIntoView({inline:'center', block:'nearest', behavior:'smooth'});
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
  carousel.children[cursor]?.scrollIntoView({inline:'center', block:'nearest'});

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

function toggleItemPickedAt(orderId, idx){
  const q = data.savedQuotes.find(x=>x.id===orderId);
  if(!q) return;
  const it = (q.items||[])[idx];
  if(!it) return;
  if(it.pickStatus==='done'){ it.pickStatus='pending'; it.pickedQty=null; }
  else { it.pickStatus='done'; it.pickedQty=it.qty; }
  q.pickCursor = idx;
  saveData();
  renderWorkerView(); // a deliberate tap, not mid-scroll -- safe to fully re-render
}

function renderWorkerFinishButton(q){
  const el = document.getElementById('wv_finishWrap');
  if(!el) return;
  const items = q.items||[];
  const allDone = items.length>0 && items.every(row=>row.pickStatus==='done');
  el.innerHTML = allDone ? `<button type="button" class="btn btn-accent wv-mark-btn" id="wv_finish_btn" style="margin-top:6px;">Mark as finished</button>` : '';
  if(allDone) document.getElementById('wv_finish_btn').addEventListener('click', ()=>finishPreparingOrder(q.id));
}

// Advances the order straight to pending_delivery -- doesn't go through
// the admin board's stepSavedQuoteStatus()/openAssignStaffModal() pipeline
// (that modal's markup only exists in the admin app), so a delivery
// person isn't auto-prompted for here; an admin still assigns one from
// Order Tracking same as always.
function finishPreparingOrder(orderId){
  const q = data.savedQuotes.find(x=>x.id===orderId);
  if(!q) return;
  const items = q.items||[];
  if(items.length && items.some(row=>row.pickStatus!=='done')) return; // guard: button is disabled otherwise
  q.pickingStatus = 'done';
  q.status = 'pending_delivery';
  q.stageEnteredAt = Date.now();
  const workerId = q.assignedWorkerId;
  saveData();
  if(workerId) autoAssignNextOrder(workerId);
  refreshAdminOrderBoardIfOpen();
  renderWorkerView();
}

// Opportunistic, non-exclusive auto-assign: whenever a worker finishes an
// order they may already be holding others (assignment has never enforced
// one-at-a-time), so this just hands them the oldest unassigned order
// still needing preparation, if one exists.
function autoAssignNextOrder(workerId){
  const staff = data.staff.find(s=>s.id===workerId);
  if(!staff || staff.unavailable) return;
  const next = data.savedQuotes
    .filter(q=>!q.voided && !q.assignedWorkerId && !quoteAgedOffBoard(q) && (q.status==='draft' || q.status==='preparing'))
    .sort((a,b)=> new Date(a.savedAt||0) - new Date(b.savedAt||0))[0];
  if(!next) return;
  next.assignedWorkerId = workerId;
  next.pickingStatus = 'awaiting_accept';
  next.pickCursor = 0;
  if(next.status==='draft'){ next.status = 'preparing'; next.stageEnteredAt = Date.now(); }
  saveData(); // saveData()'s upsert is what the notify-worker webhook fires on
  refreshAdminOrderBoardIfOpen();
}

function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}

async function enableWorkerPushNotifications(){
  if(!myStaff){ toast('No staff profile linked to this login yet'); return; }
  if(!('serviceWorker' in navigator) || !('PushManager' in window)){ toast('Push notifications are not supported on this device/browser'); return; }
  try{
    const permission = await Notification.requestPermission();
    if(permission!=='granted'){ toast('Notifications permission was not granted'); return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    const keys = sub.toJSON().keys;
    const { error } = await sb.from('push_subscriptions').upsert({
      shop_id: currentShopId, staff_id: myStaff.id, user_id: currentUser.id,
      endpoint: sub.endpoint, p256dh: keys.p256dh, auth_key: keys.auth
    }, { onConflict: 'endpoint' });
    if(error) throw error;
    hasPushSubscription = true;
    document.getElementById('wv_enablePushWrap').style.display = 'none';
    toast('Notifications enabled');
  }catch(err){
    toast(`Could not enable notifications: ${err.message||err}`);
  }
}
document.getElementById('wv_enablePushBtn').addEventListener('click', enableWorkerPushNotifications);

// Routes a push notification tap: a foreground tab gets a postMessage from
// sw.js, a cold-started tab gets ?orderId=&action= on the URL instead
// (clients.openWindow() can't postMessage into a page that doesn't exist
// yet). Both paths funnel through here once boot() has finished loading.
navigator.serviceWorker && navigator.serviceWorker.addEventListener && navigator.serviceWorker.addEventListener('message', e=>{
  if(e.data && e.data.orderId) routeNotificationAction(e.data.orderId, e.data.action);
});
function routeNotificationAction(orderId, action){
  orderId = Number(orderId);
  if(!orderId) return;
  // goToTab() only exists in the admin app (multiple tabs); the
  // standalone worker app has nothing else to switch away from.
  if(typeof goToTab === 'function') goToTab('worker');
  if(action==='accept') acceptOrderAssignment(orderId);
  else if(action==='deny') denyOrderAssignment(orderId);
}
function handlePendingNotificationRoute(){
  const params = new URLSearchParams(location.search);
  const orderId = params.get('orderId');
  const action = params.get('action');
  if(orderId){
    routeNotificationAction(orderId, action);
    params.delete('orderId'); params.delete('action');
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs?'?'+qs:''));
  }
}
