/*
 * This phone's pushes (spec 06 §6a "Phones register"): Capacitor PushNotifications gives the phone's
 * token and push_subscriptions keeps it, as sales.html:4887 phonePush and store.html:2647 enablePush do.
 * Turning them off deletes this phone's row and unregisters it, so nothing more arrives here.
 */
import type { PushState } from '../datasource.ts';
import type { Session } from '../types.ts';
import type { Row, Sb } from './client.ts';
import { ok } from './write.ts';

const KEY = 'ow-push-token';

function plugin(): Row | null {
  const C = (globalThis as Row).Capacitor;
  return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.PushNotifications ? C.Plugins.PushNotifications : null;
}

/** sales.html:4883 pushInstalled: an install before build 2 has no Firebase, and asking it for a token closes the app. */
async function installed(): Promise<boolean> {
  try { const A = (globalThis as Row).Capacitor.Plugins.App; const i = A && await A.getInfo(); return !!i && Number(i.build) >= 2; } catch (_e) { return false; }
}

const saved = (): string | null => { try { return localStorage.getItem(KEY); } catch (_e) { return null; } };
const keep = (t: string | null) => { try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch (_e) { /* kept for this visit only */ } };

export async function pushState(): Promise<PushState> {
  const P = plugin();
  if (!P) return { on: false, why: 'not-app' };
  try { const p = await P.checkPermissions(); if (p.receive === 'denied') return { on: false, why: 'denied' }; } catch (_e) { /* asked again on turning on */ }
  return saved() ? { on: true, why: null } : { on: false, why: null };
}

/** The token from the phone: register, then wait for its 'registration' (or 'registrationError'). */
async function token(P: Row): Promise<string> {
  return new Promise((resolve, reject) => {
    const hs: Row[] = [];
    const done = (f: () => void) => { hs.forEach((h) => { Promise.resolve(h).then((x: Row) => x && x.remove && x.remove()).catch(() => {}); }); f(); };
    hs.push(P.addListener('registration', (t: Row) => done(() => resolve(String(t.value)))));
    hs.push(P.addListener('registrationError', () => done(() => reject(new Error('no-play')))));
    Promise.resolve(P.register()).catch(() => done(() => reject(new Error('no-play'))));
  });
}

export async function pushOn(sb: Sb, s: Session): Promise<PushState> {
  const P = plugin();
  if (!P) return { on: false, why: 'not-app' };
  if (!(await installed())) return { on: false, why: 'old-app' };
  let perm = await P.checkPermissions();
  if (perm.receive !== 'granted') perm = await P.requestPermissions();
  if (perm.receive !== 'granted') return { on: false, why: 'denied' };
  let t: string;
  try { t = await token(P); } catch (_e) { return { on: false, why: 'no-play' }; }
  const st = await ok<Row | null>(sb.from('staff').select('id').eq('shop_id', s.shopId).eq('user_id', s.userId).maybeSingle());
  await ok(sb.from('push_subscriptions').upsert({ shop_id: s.shopId, staff_id: st ? st.id : null, user_id: s.userId, fcm_token: t }, { onConflict: 'fcm_token' }));
  keep(t);
  return { on: true, why: null };
}

export async function pushOff(sb: Sb, s: Session): Promise<PushState> {
  const t = saved(), P = plugin();
  if (t) await ok(sb.from('push_subscriptions').delete().eq('shop_id', s.shopId).eq('fcm_token', t));
  keep(null);
  if (P) { try { await P.unregister(); } catch (_e) { /* the row is gone: nothing is sent to it */ } }
  return { on: false, why: P ? null : 'not-app' };
}
