// agent-nudge: the agent app's notifications (see 0103_agent_push.sql and
// ../README.md for the one-time VAPID + schedule setup).
//
// Two actions:
//
//   { action: "config" }  -> { publicKey }. The VAPID public key the app
//                            subscribes with. Public by design.
//   { action: "run" }     -> called on a schedule (hourly is right). For
//                            every agent with notifications on, works out
//                            what is worth a tap RIGHT NOW and sends the
//                            best of it. Needs the x-cron-secret header.
//                            { dryRun: true } returns the plan unsent.
//
// What is worth a nudge, most urgent first:
//   request  -- someone asked on their catalogue page, not yet answered
//   pin      -- the shop has just pinned an item into every feed
//   due      -- a client's own buying rhythm says they are due now
//   rank     -- they are within one good sale of the next place up
//   bonus    -- a bonus on an item in their cluster ends within two days
//
// The rules that keep it worth having:
//   quiet hours -- nothing before 07:00 or from 20:00, Kampala time
//   a cap       -- at most NUDGE_DAILY_CAP a day per agent
//   once        -- each moment is sent once (agent_push_log has a unique
//                  key on it), however many times this runs
//   paused      -- a paused or retired agent gets nothing
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:owner@omni-ware.app";
const AGENT_NUDGE_SECRET = Deno.env.get("AGENT_NUDGE_SECRET") || "";

const NUDGE_DAILY_CAP = 3;
const QUIET_FROM = 20, QUIET_TO = 7;          // Kampala hours
const KAMPALA_OFFSET_H = 3;
const DAY = 86400000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS_HEADERS } });
}

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try { webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY); }
  catch (e) { console.error("agent-nudge: VAPID keys did not load", e); }
}

function kampalaHour(nowMs: number): number {
  return new Date(nowMs + KAMPALA_OFFSET_H * 3600000).getUTCHours();
}
function isQuiet(nowMs: number): boolean {
  const h = kampalaHour(nowMs);
  return h >= QUIET_FROM || h < QUIET_TO;
}
function kampalaDate(nowMs: number): string {
  return new Date(nowMs + KAMPALA_OFFSET_H * 3600000).toISOString().slice(0, 10);
}

function linePriced(it: any): boolean {
  return !!it && it.agentSellPrice !== null && it.agentSellPrice !== undefined
    && it.agentSellPrice !== "" && Number.isFinite(Number(it.agentSellPrice));
}
function orderEarnings(items: any[]): number {
  let total = 0;
  for (const it of items || []) {
    if (linePriced(it)) total += (Number(it.agentSellPrice) - (Number(it.sellPrice) || 0)) * (Number(it.qty) || 0);
    total += Number(it.bonusCommission) || 0;
  }
  return total;
}
function fmt(n: number): string {
  return Math.round(Number(n) || 0).toLocaleString("en-UG");
}
function first(name: string): string {
  return String(name || "").trim().split(/\s+/)[0] || "A customer";
}

type Nudge = { kind: string; ref: string; title: string; body: string; prio: number };

/* Everything worth a nudge for ONE agent, from rows already read. Pure,
   so the choice of what to send can be checked without a database. */
function nudgesFor(agentId: string, ctx: any, nowMs: number): Nudge[] {
  const out: Nudge[] = [];
  const today = kampalaDate(nowMs);
  const productName = (id: string) => (ctx.products.get(id) || id);

  // Someone asked, on this agent's catalogue page, in the last two days.
  for (const q of ctx.inquiries || []) {
    if (q.agent_id !== agentId || q.handled_at) continue;
    if (nowMs - Date.parse(q.created_at) > 2 * DAY) continue;
    const what = q.message ? String(q.message).slice(0, 90) : (q.product_id ? productName(q.product_id) : "Asked you to get in touch");
    out.push({ kind: "request", ref: String(q.id), prio: 0,
      title: `${first(q.customer_name)} asked you`, body: what });
  }

  // The shop pinned something in the last two days, still live.
  for (const p of ctx.pins || []) {
    if (nowMs - Date.parse(p.created_at) > 2 * DAY) continue;
    if (p.ends_on && p.ends_on < today) continue;
    out.push({ kind: "pin", ref: String(p.id), prio: 1,
      title: `From the shop: ${productName(p.product_id)}`, body: p.note || "Pinned to the top of your feed" });
  }

  // A client whose own rhythm says they are due -- the day it tips over
  // and the day after, never a week late.
  const mine = (ctx.orders || []).filter((o: any) => o.agent_id === agentId && o.date);
  const byClient: Map<any, any> = new Map();
  for (const o of mine) {
    const cid = o.payload && o.payload.agentClientId;
    if (cid == null) continue;
    const k = String(cid);
    if (!byClient.has(k)) byClient.set(k, []);
    byClient.get(k).push(String(o.date));
  }
  for (const [cid, dates] of byClient) {
    const ds = [...new Set(dates)].sort();
    if (ds.length < 2) continue;
    const ms = ds.map((d) => Date.parse(d + "T00:00:00Z"));
    const gap = (ms[ms.length - 1] - ms[0]) / (ms.length - 1) / DAY;
    const since = (Date.parse(today + "T00:00:00Z") - ms[ms.length - 1]) / DAY;
    if (!(gap >= 2) || since < gap || since >= gap + 2) continue;
    const client = ctx.clients.get(`${agentId}|${cid}`);
    if (!client) continue;
    out.push({ kind: "due", ref: `${cid}:${ds[ds.length - 1]}`, prio: 2,
      title: `${client} is due`, body: `Buys about every ${Math.round(gap)} days -- it has been ${Math.round(since)}. Open their order?` });
  }

  // Within one good sale of the next place up this month.
  const month = today.slice(0, 7);
  const board: any[] = ctx.board;
  const i = board.findIndex((r) => r.id === agentId);
  if (i > 0) {
    const me = board[i], above = board[i - 1];
    const gap = above.amount - me.amount;
    const typical = me.orders ? me.amount / me.orders : 0;
    if (gap > 0 && typical > 0 && gap <= typical * 1.5) {
      out.push({ kind: "rank", ref: `${month}:${i}`, prio: 3,
        title: `${fmt(gap)} from #${i}`, body: `One good sale moves you up the board this month.` });
    }
  }

  // A bonus on something in their cluster ends within two days.
  const clusterKeys = new Set((ctx.clusters || []).filter((c: any) => c.agent_id === agentId)
    .map((c: any) => `${c.product_id}::${c.variant_idx || ""}`));
  for (const p of ctx.promos || []) {
    if (!p.active || !p.ends_at) continue;
    const left = Math.round((Date.parse(p.ends_at + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / DAY);
    if (left < 0 || left > 2) continue;
    if (!clusterKeys.has(`${p.product_id}::${p.variant_idx || ""}`)) continue;
    const bonus = p.bonus_type === "fixed" ? `+${fmt(p.bonus_value)}` : `+${p.bonus_value}%`;
    out.push({ kind: "bonus", ref: `${p.id}:${p.ends_at}`, prio: 4,
      title: `${bonus} bonus ends ${left === 0 ? "today" : left === 1 ? "tomorrow" : "in 2 days"}`,
      body: `${productName(p.product_id)} -- it is in your cluster.` });
  }

  return out.sort((a, b) => a.prio - b.prio);
}

/* What to actually send: not already sent, and no more than the day's
   cap allows after what went out today. */
function pickToSend(cands: Nudge[], sentKeys: Set<string>, sentToday: number, cap: number): Nudge[] {
  const room = Math.max(0, cap - sentToday);
  return cands.filter((n) => !sentKeys.has(`${n.kind}|${n.ref}`)).slice(0, room);
}

function monthBoard(orders: any[], agents: any[], month: string) {
  const totals: Map<any, any> = new Map();
  for (const o of orders || []) {
    if (o.status !== "completed" || !o.agent_id || !String(o.date || "").startsWith(month)) continue;
    const t = totals.get(o.agent_id) || { amount: 0, orders: 0 };
    t.amount += orderEarnings((o.payload && o.payload.items) || []);
    t.orders += 1;
    totals.set(o.agent_id, t);
  }
  return (agents || []).map((a: any) => ({ id: a.id, ...(totals.get(a.id) || { amount: 0, orders: 0 }) }))
    .sort((a, b) => b.amount - a.amount);
}

async function runShop(admin: any, shopId: string, subs: any[], nowMs: number, dryRun: boolean) {
  const since60 = new Date(nowMs - 60 * DAY).toISOString();
  const since120d = new Date(nowMs - 120 * DAY).toISOString().slice(0, 10);
  const [agentsR, clientsR, ordersR, inqR, pinsR, promosR, clustersR, logR, productsR] = await Promise.all([
    admin.from("agents").select("id, name, unavailable, retired_at").eq("shop_id", shopId),
    admin.from("agent_clients").select("id, agent_id, name").eq("shop_id", shopId),
    admin.from("saved_quotes").select("date, status, agent_id, payload").eq("shop_id", shopId).eq("voided", false)
      .not("agent_id", "is", null).gte("date", since120d),
    admin.from("catalogue_inquiries").select("id, agent_id, product_id, customer_name, message, handled_at, created_at")
      .eq("shop_id", shopId).gte("created_at", new Date(nowMs - 2 * DAY).toISOString()),
    admin.from("agent_feed_pins").select("id, product_id, note, ends_on, created_at").eq("shop_id", shopId)
      .gte("created_at", new Date(nowMs - 2 * DAY).toISOString()),
    admin.from("agent_promotions").select("id, product_id, variant_idx, bonus_type, bonus_value, active, ends_at").eq("shop_id", shopId),
    admin.from("agent_clusters").select("agent_id, product_id, variant_idx").eq("shop_id", shopId),
    admin.from("agent_push_log").select("agent_id, kind, ref, sent_at").eq("shop_id", shopId).gte("sent_at", since60),
    admin.from("products").select("id, name").eq("shop_id", shopId),
  ]);
  const failed = [agentsR, clientsR, ordersR, inqR, pinsR, promosR, clustersR, logR, productsR].find((r) => r.error);
  if (failed) return { shopId, error: failed.error.message };

  const agents = (agentsR.data || []).filter((a: any) => !a.unavailable && !a.retired_at);
  const ctx = {
    inquiries: inqR.data || [], pins: pinsR.data || [], promos: promosR.data || [],
    clusters: clustersR.data || [], orders: ordersR.data || [],
    products: new Map((productsR.data || []).map((p: any) => [p.id, p.name])),
    clients: new Map((clientsR.data || []).map((c: any) => [`${c.agent_id}|${c.id}`, c.name])),
    board: monthBoard(ordersR.data || [], agents, kampalaDate(nowMs).slice(0, 7)),
  };
  const today = kampalaDate(nowMs);
  const plan: any[] = [];
  for (const a of agents) {
    const mySubs = subs.filter((s) => s.agent_id === a.id);
    if (!mySubs.length) continue;
    const myLog = (logR.data || []).filter((l: any) => l.agent_id === a.id);
    const sentKeys = new Set(myLog.map((l: any) => `${l.kind}|${l.ref}`));
    const sentToday = myLog.filter((l: any) => kampalaDate(Date.parse(l.sent_at)) === today).length;
    const send = pickToSend(nudgesFor(a.id, ctx, nowMs), sentKeys, sentToday, NUDGE_DAILY_CAP);
    for (const n of send) {
      if (dryRun) { plan.push({ agent: a.id, ...n }); continue; }
      let delivered = 0;
      for (const s of mySubs) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
            JSON.stringify({ title: n.title, body: n.body, kind: n.kind, url: "/agent.html?open=feed" }),
            { TTL: 6 * 3600 },
          );
          delivered++;
        } catch (e: any) {
          const code = e && e.statusCode;
          console.error("agent-nudge: send failed", { agent: a.id, code });
          if (code === 404 || code === 410) await admin.from("agent_push_subscriptions").delete().eq("id", s.id);
        }
      }
      if (delivered) {
        await admin.from("agent_push_log").insert({ shop_id: shopId, agent_id: a.id, kind: n.kind, ref: n.ref,
          title: n.title, body: n.body });
      }
      plan.push({ agent: a.id, kind: n.kind, delivered });
    }
  }
  return { shopId, plan };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const body = await req.json().catch(() => ({}));

  if (body.action === "config") {
    return json({ ok: true, publicKey: VAPID_PUBLIC_KEY || null });
  }

  if (body.action !== "run") return json({ error: "Unknown action" }, 400);
  // Closed unless the secret is set: an open endpoint here could make
  // every agent's phone buzz on demand.
  if (!AGENT_NUDGE_SECRET) return json({ error: "AGENT_NUDGE_SECRET is not set" }, 503);
  if ((req.headers.get("x-cron-secret") || "") !== AGENT_NUDGE_SECRET) return json({ error: "Bad or missing x-cron-secret" }, 401);
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return json({ ok: true, skipped: "VAPID keys not configured" });

  const nowMs = Date.now();
  if (isQuiet(nowMs) && !body.ignoreQuietHours) return json({ ok: true, skipped: "quiet hours" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: subs, error } = await admin.from("agent_push_subscriptions").select("id, shop_id, agent_id, endpoint, p256dh, auth_key");
  if (error) return json({ error: error.message, stage: "subscriptions" }, 500);
  const shops = [...new Set((subs || []).map((s: any) => s.shop_id))];
  const results = [];
  for (const shopId of shops) {
    results.push(await runShop(admin, shopId, (subs || []).filter((s: any) => s.shop_id === shopId), nowMs, !!body.dryRun));
  }
  return json({ ok: true, shops: results.length, results });
});
