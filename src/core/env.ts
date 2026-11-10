/*
 * Which Supabase project a page talks to (store.html:852-857, sales.html:3579-3585):
 * the phone apps and the live hosts use the real books; every other host
 * (a preview, a Claude session's own server, localhost) uses staging, so a
 * new app is tried away from the real books (spec 07 §1, §5).
 */
export interface Env {
  name: 'production' | 'staging';
  url: string;
  anon: string;
}

export const PRODUCTION: Env = { name: 'production', url: 'https://hgywjaifdmgrcnwxstxg.supabase.co', anon: 'sb_publishable_KsUIBYzuZRdoPsqP4T2ULw__AsCEhzV' };
export const STAGING: Env = { name: 'staging', url: 'https://lmmyzhqdxixjnkkkgnnu.supabase.co', anon: 'sb_publishable_K7A4jZC6RSgFtyiSfV2P_w_oh8crHa5' };
export const PRODUCTION_HOSTS = ['omni-ware.vercel.app', 'omni-ware-preview.turyasingurakevin94.workers.dev'];

/** The project for this page: the phone app (Capacitor) and the live hosts get production. */
export function envFor(host: string, inPhoneApp: boolean): Env {
  if (inPhoneApp) return PRODUCTION;
  return PRODUCTION_HOSTS.indexOf(String(host || '').toLowerCase()) === -1 ? STAGING : PRODUCTION;
}

/** Sales keeps its own sign-in (sales.html:3590, SAL-002): another app's login never swaps the person under it. */
export const AUTH_KEY = 'ow-sales-auth';
