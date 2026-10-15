// agent-nudge: the agent app's notifications (see 0103_agent_push.sql,
// 0110_agent_native_push.sql and ../README.md for the one-time setup).
//
// Two actions:
//
//   { action: "config" }  -> { publicKey }. The VAPID public key the browser
//                            app subscribes with. Public by design.
//   { action: "test" }    -> signed in: one notification now to the caller's
//                            own phones, with why any did not go.
//   { action: "run" }     -> called on a schedule (hourly is right). For
//                            every agent with notifications on, works out
//                            what is worth a tap RIGHT NOW and sends the
//                            best of it. Needs the x-cron-secret header.
//                            { dryRun: true } returns the plan unsent.
//
// A notification reaches into someone's pocket uninvited, so every one
// names a person, an amount or a day -- never "you have a new update" --
// and speaks in one of four voices:
//
//   celebrate  -- a goal smashed, a best week, a new client, a streak
//   remind     -- the morning plan, a client due, the evening wrap-up
//   inform     -- a price drop worked out on a client's usual order, a new
//                 bonus, a customer asking, a shop pin, a bonus ending
//   have fun   -- the playful tone, rationed by the daily cap
//
// What is worth a nudge, most urgent first:
//   morning / wrap -- at the agent's hour, once a day each (prio -2)
//   win / goal 100 -- celebrations, the moment they happen         (-1)
//   request  -- someone asked on their catalogue page, not answered  (0)
//   pin      -- the shop has just pinned an item into every feed     (1)
//   due      -- a client's own buying rhythm says they are due now    (2)
//   price    -- an item they sell got cheaper for them               (2)
//   bonus_new-- the shop just put something they sell on promotion   (2)
//   rank     -- within one good sale of the next place up            (3)
//   goal     -- a quarter, half, three quarters of the monthly goal  (3)
//   bonus    -- a bonus on an item in their cluster ends soon        (4)
//
// The rules that keep it worth having:
//   a cap       -- at most NUDGE_DAILY_CAP a day per agent
//   once        -- each moment is sent once (agent_push_log has a unique
//                  key on it), however many times this runs
//   their say   -- agent_notify_prefs: each kind on or off, the hour of the
//                  morning plan, playful or straight to the point
//   paused      -- a paused or retired agent gets nothing
//
// Delivery: a browser gets Web Push (VAPID); the Android app FCM; the
// iPhone app APNs. Each is skipped, not failed, while its keys are unset.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:owner@omni-ware.app";
const AGENT_NUDGE_SECRET = Deno.env.get("AGENT_NUDGE_SECRET") || "";
// The same Firebase project as the worker app (notify-worker).
const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") || "";
// iPhone: an APNs auth key (.p8) from the Apple Developer account.
const APNS_KEY_P8 = Deno.env.get("APNS_KEY_P8") || "";
const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID") || "";
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID") || "";
const APNS_BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") || "com.omniware.agent";
const APNS_SANDBOX = (Deno.env.get("APNS_SANDBOX") || "") === "1";

const NUDGE_DAILY_CAP = 3;
const WRAP_HOUR = 19;
const KAMPALA_OFFSET_H = 3;
const DAY = 86400000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Everything on but the evening wrap-up, until the agent says otherwise.
const DEFAULT_KINDS: any = { morning: true, win: true, price: true, bonus: true, goal: true, due: true, wrap: false };

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
// What an order is worth to the agent the way their own app counts it:
// the margin as soon as it is ordered, the shop's bonus once it completes.
function earnedOf(o: any): number {
  let margin = 0, bonus = 0;
  for (const it of (o.payload && o.payload.items) || []) {
    if (linePriced(it)) margin += (Number(it.agentSellPrice) - (Number(it.sellPrice) || 0)) * (Number(it.qty) || 0);
    bonus += Number(it.bonusCommission) || 0;
  }
  return margin + (o.status === "completed" ? bonus : 0);
}
// Which order took the month's total over each quarter of the goal, in
// the order they happened.
function goalCrossings(monthOrders: any[], target: number): any {
  const at: any = {};
  let sum = 0;
  for (const o of [...monthOrders].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    sum += earnedOf(o);
    for (const m of [25, 50, 75, 100]) if (!at[m] && sum >= target * m / 100) at[m] = { order: o, sum };
  }
  return at;
}
function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}
function sumEarned(list: any[]): number {
  let s = 0;
  for (const o of list) s += earnedOf(o);
  return s;
}
// The two ways a message can talk: playful (the default) or straight to
// the point, as the agent chose in the app.
function voice(playful: boolean, fun: string, plain: string): string {
  return playful ? fun : plain;
}
function fmt(n: number): string {
  return Math.round(Number(n) || 0).toLocaleString("en-UG");
}
function first(name: string): string {
  return String(name || "").trim().split(/\s+/)[0] || "A customer";
}
// "Junior", "Junior and Ken", "Junior, Ken and 2 more".
function namesList(names: string[]): string {
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}
function unitWord(unit: string, qty: number): string {
  const u = String(unit || "").trim();
  if (!u) return "";
  return qty === 1 || u.length <= 2 || /s$/.test(u) ? u : `${u}s`;
}
// Monday of the Kampala week a date (YYYY-MM-DD) falls in.
function weekOf(date: string): string {
  const ms = Date.parse(date + "T00:00:00Z");
  const dow = (new Date(ms).getUTCDay() + 6) % 7;
  return new Date(ms - dow * DAY).toISOString().slice(0, 10);
}
function daysInMonth(date: string): number {
  const d = new Date(date + "T00:00:00Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}
function wants(prefs: any, kind: string): boolean {
  const k = kind === "bonus_new" || kind === "pin" ? "bonus" : kind === "rank" ? "win" : kind;
  // A customer waiting on an answer is never switched off.
  if (k === "request") return true;
  const set = (prefs && prefs.kinds) || {};
  return k in set ? !!set[k] : !!DEFAULT_KINDS[k];
}

type Nudge = { kind: string; ref: string; title: string; body: string; prio: number; open: string; image: string };

/* Everything worth a nudge for ONE agent, from rows already read. Pure,
   so the choice of what to send can be checked without a database. */
function nudgesFor(agentId: string, ctx: any, nowMs: number): Nudge[] {
  const out: Nudge[] = [];
  const today = kampalaDate(nowMs);
  const hour = kampalaHour(nowMs);
  const prefs = (ctx.prefs && ctx.prefs.get(agentId)) || null;
  const playful = !prefs || prefs.tone !== "straight";
  const me = (ctx.agentNames && ctx.agentNames.get(agentId)) ? first(ctx.agentNames.get(agentId)) : "";
  const productName = (id: string) => (ctx.products.get(id) || id);
  const add = (n: any) => out.push({ open: "today", image: "", ...n });

  // Someone asked, on this agent's catalogue page, in the last two days.
  for (const q of ctx.inquiries || []) {
    if (q.agent_id !== agentId || q.handled_at) continue;
    if (nowMs - Date.parse(q.created_at) > 2 * DAY) continue;
    const what = q.message ? String(q.message).slice(0, 90) : (q.product_id ? productName(q.product_id) : "Asked you to get in touch");
    add({ kind: "request", ref: String(q.id), prio: 0,
      title: `${first(q.customer_name)} asked you`, body: what });
  }

  // The shop pinned something in the last two days, still live.
  for (const p of ctx.pins || []) {
    if (nowMs - Date.parse(p.created_at) > 2 * DAY) continue;
    if (p.ends_on && p.ends_on < today) continue;
    add({ kind: "pin", ref: String(p.id), prio: 1,
      title: `From the shop: ${productName(p.product_id)}`, body: p.note || "Pinned to the top of your feed" });
  }

  // This agent's own orders, and each client's rhythm: visits are days,
  // so two orders on one day are one visit.
  const mine = (ctx.orders || []).filter((o: any) => o.agent_id === agentId && o.date);
  const byClient: Map<any, any> = new Map();
  for (const o of mine) {
    const cid = o.payload && o.payload.agentClientId;
    if (cid == null) continue;
    const k = String(cid);
    if (!byClient.has(k)) byClient.set(k, { days: new Map() });
    const c = byClient.get(k);
    c.days.set(String(o.date), (c.days.get(String(o.date)) || 0) + orderEarnings((o.payload && o.payload.items) || []));
  }
  const todayMs = Date.parse(today + "T00:00:00Z");
  const rhythm: any[] = [];
  for (const [cid, c] of byClient) {
    const ds = [...c.days.keys()].sort();
    if (ds.length < 2) continue;
    const ms = ds.map((d: string) => Date.parse(d + "T00:00:00Z"));
    const gap = (ms[ms.length - 1] - ms[0]) / (ms.length - 1) / DAY;
    const since = (todayMs - ms[ms.length - 1]) / DAY;
    const name = ctx.clients.get(`${agentId}|${cid}`);
    if (!(gap >= 2) || !name) continue;
    const earn = [...c.days.values()].reduce((s, v) => s + v, 0) / ds.length;
    rhythm.push({ cid, name, gap, since, earn, last: ds[ds.length - 1] });
  }
  // A client whose own rhythm says they are due -- the day it tips over
  // and the day after, never a week late.
  const dueNow = rhythm.filter((r) => r.since >= r.gap && r.since < r.gap + 2).sort((a, b) => b.earn - a.earn);
  for (const r of dueNow) {
    add({ kind: "due", ref: `${r.cid}:${r.last}`, prio: 2, open: `client:${r.cid}`,
      title: `${r.name} is due`,
      body: voice(playful, `Buys about every ${Math.round(r.gap)} days, and it has been ${Math.round(r.since)}. Their usual earns you about ${fmt(r.earn)}.`,
        `Buys about every ${Math.round(r.gap)} days. It has been ${Math.round(r.since)}. Open their order?`) });
  }

  // The month so far, against the goal.
  const month = today.slice(0, 7);
  const dim = daysInMonth(today), dayOfMonth = Number(today.slice(8, 10)), daysLeft = dim - dayOfMonth;
  const earned = sumEarned(mine.filter((o: any) => String(o.date).startsWith(month)));
  const target = Number(ctx.goals && ctx.goals.get(agentId)) || 0;
  const monthName = MONTHS[Number(month.slice(5, 7)) - 1];

  // The morning plan, at the hour the agent chose.
  const morningHour = prefs && Number(prefs.morning_hour) ? Number(prefs.morning_hour) : 8;
  if (hour === morningHour) {
    if (dueNow.length) {
      const sum = dueNow.reduce((s, r) => s + r.earn, 0);
      const names = namesList(dueNow.map((r) => first(r.name)));
      add({ kind: "morning", ref: today, prio: -2, open: dueNow.length === 1 ? `client:${dueNow[0].cid}` : "today",
        title: voice(playful, me ? `Morning, ${me}` : "Good morning", `Today: ${dueNow.length} client${dueNow.length === 1 ? "" : "s"} due`),
        body: voice(playful, `${names} ${dueNow.length === 1 ? "is" : "are"} due today. ${dueNow.length === 1 ? "That is" : "Together,"} about ${fmt(sum)} for you.`,
          `${names}: about ${fmt(sum)} for you.`) });
    } else if (target > 0 && earned < target && daysLeft > 0) {
      add({ kind: "morning", ref: today, prio: -2, open: "goal",
        title: voice(playful, me ? `Morning, ${me}` : "Good morning", `Goal: ${Math.floor(earned / target * 100)}% with ${daysLeft} days left`),
        body: voice(playful, `${fmt(earned)} of ${fmt(target)} so far, ${daysLeft} days to go. One good order today moves it.`,
          `${fmt(target - earned)} to go this month.`) });
    }
  }

  // The evening wrap-up: today in one line, and who comes round tomorrow.
  if (hour === WRAP_HOUR) {
    const todays = mine.filter((o: any) => String(o.date) === today);
    const made = sumEarned(todays);
    // Due tomorrow and not already today -- today's are in the morning plan.
    const tomorrow = rhythm.filter((r) => r.since + 1 >= r.gap && r.since < r.gap).length;
    if (todays.length || tomorrow) {
      const comes = tomorrow ? `Tomorrow ${tomorrow} client${tomorrow === 1 ? "" : "s"} come${tomorrow === 1 ? "s" : ""} round.` : "Tomorrow is wide open.";
      add({ kind: "wrap", ref: today, prio: -2,
        title: voice(playful, "Today in one line", `Today: ${todays.length} order${todays.length === 1 ? "" : "s"}, +${fmt(made)}`),
        body: todays.length
          ? voice(playful, `${todays.length} order${todays.length === 1 ? "" : "s"}, +${fmt(made)}. ${comes}`, comes)
          : voice(playful, `A quiet one. ${comes} Rest up.`, comes) });
    }
  }

  // Celebrations. A client's very first order, the day it lands.
  const clientCount = Number(ctx.clientCounts && ctx.clientCounts.get(agentId)) || 0;
  for (const [cid, c] of byClient) {
    const ds = [...c.days.keys()].sort();
    if (ds.length !== 1 || (todayMs - Date.parse(ds[0] + "T00:00:00Z")) / DAY > 1) continue;
    const name = ctx.clients.get(`${agentId}|${cid}`);
    if (!name) continue;
    add({ kind: "win", ref: `client:${cid}`, prio: -1, open: `client:${cid}`,
      title: voice(playful, clientCount ? `${first(name)} is client number ${clientCount}` : `${first(name)} just ordered`, `First order from ${name}`),
      body: voice(playful, "Their first order just went through. Make them a regular.", clientCount ? `Client number ${clientCount}.` : "Their first with you.") });
  }
  // A best week: this week beats every one of the eight before it.
  const weeks: Map<string, any> = new Map();
  for (const o of mine) {
    const w = weekOf(String(o.date));
    const x = weeks.get(w) || { earn: 0, n: 0 };
    x.earn += earnedOf(o); x.n += 1;
    weeks.set(w, x);
  }
  const thisWeek = weekOf(today);
  const now = weeks.get(thisWeek);
  let prevBest = 0;
  for (let i = 1; i <= 8; i++) {
    const w = new Date(Date.parse(thisWeek + "T00:00:00Z") - i * 7 * DAY).toISOString().slice(0, 10);
    prevBest = Math.max(prevBest, (weeks.get(w) || { earn: 0 }).earn);
  }
  if (now && now.n >= 2 && prevBest > 0 && now.earn > prevBest) {
    add({ kind: "win", ref: `week:${thisWeek}`, prio: -1,
      title: voice(playful, "Your best week yet", `Best week yet: ${fmt(now.earn)}`),
      body: voice(playful, `${fmt(now.earn)} since Monday. Your old record just moved to second place.`, `Previous best: ${fmt(prevBest)}.`) });
  }
  // A streak: every week sold in, up to last week, celebrated at 4, 8, 12...
  let streak = 0;
  for (let i = 1; i <= 16; i++) {
    const w = new Date(Date.parse(thisWeek + "T00:00:00Z") - i * 7 * DAY).toISOString().slice(0, 10);
    if (!weeks.get(w)) break;
    streak++;
  }
  if (streak >= 4 && streak % 4 === 0) {
    const since = new Date(Date.parse(thisWeek + "T00:00:00Z") - streak * 7 * DAY);
    add({ kind: "win", ref: `streak:${thisWeek}:${streak}`, prio: -1,
      title: voice(playful, `${streak} weeks in a row`, `${streak}-week selling streak`),
      body: voice(playful, `You have sold every week since ${since.getUTCDate()} ${MONTHS[since.getUTCMonth()]}. Keep it going this week.`,
        `Every week since ${since.getUTCDate()} ${MONTHS[since.getUTCMonth()]}.`) });
  }

  // The goal: the highest of a quarter, half, three quarters or all of it
  // that has been crossed, once each -- named after the order that did it,
  // and ahead of everything but the morning plan: it is what they are
  // working for.
  if (target > 0) {
    const pct = earned / target * 100;
    const m = [100, 75, 50, 25].find((x) => pct >= x);
    const crossed = goalCrossings(mine.filter((o: any) => String(o.date).startsWith(month)), target);
    const left = Math.max(0, target - earned);
    const perDay = daysLeft > 0 ? Math.ceil(left / daysLeft) : 0;
    const projected = earned + (earned / Math.max(1, dayOfMonth)) * daysLeft;
    const pace = projected >= target ? "You are on pace." : `${fmt(perDay)} a day gets you there.`;
    if (m) {
      const by = crossed[m] && crossed[m].order;
      const cid = by && by.payload && by.payload.agentClientId;
      const who = cid != null ? ctx.clients.get(`${agentId}|${cid}`) : "";
      const did = who ? `${possessive(first(who))} order ${m === 100 ? "did it" : "took you over"}. ` : "";
      const head: any = { 25: "A quarter of the way", 50: "Halfway to your goal", 75: "Three quarters done" };
      add({ kind: "goal", ref: `${month}:${m}`, prio: -1, open: "goal",
        title: m === 100 ? voice(playful, me ? `Goal smashed, ${me}` : "Goal smashed", `Goal reached for ${monthName}`) : voice(playful, me ? `${head[m]}, ${me}` : head[m], `${m}% of your ${monthName} goal`),
        body: m === 100
          ? voice(playful, `${did}${fmt(earned)} for ${monthName}${daysLeft > 0 ? `, with ${daysLeft} day${daysLeft === 1 ? "" : "s"} to spare` : ""}. Fancy raising the bar?`, `${fmt(earned)} of ${fmt(target)}.`)
          : voice(playful, `${did}${fmt(left)} to go, ${daysLeft} days left. ${pace}`, `${fmt(earned)} of ${fmt(target)}. ${pace}`) });
    }

    // How close: once a month when one client's usual would finish it or
    // it is nine-tenths done, and once more in the last three days. Never
    // the day a milestone was crossed -- that one has said enough.
    const lastStep = [75, 50, 25].find((x) => crossed[x]);
    const steppedToday = lastStep && String(crossed[lastStep].order.date) === today;
    if (left > 0 && !steppedToday) {
      const finisher = rhythm.filter((r) => r.earn >= left && r.since >= r.gap - 3 && r.since < r.gap + 7)
        .sort((a, b) => (a.gap - a.since) - (b.gap - b.since))[0];
      if (finisher) {
        const inDays = Math.ceil(finisher.gap - finisher.since);
        add({ kind: "goal", ref: `${month}:near`, prio: 0, open: `client:${finisher.cid}`,
          title: voice(playful, `${first(finisher.name)} could finish your goal`, `${fmt(left)} from your goal`),
          body: voice(playful, `${fmt(left)} to go, and ${possessive(first(finisher.name))} usual earns you about ${fmt(finisher.earn)}. ${inDays > 0 ? `Due in ${inDays} day${inDays === 1 ? "" : "s"}.` : "They are due now."}`,
            `${finisher.name}'s usual: about ${fmt(finisher.earn)}.`) });
      } else if (pct >= 90) {
        add({ kind: "goal", ref: `${month}:near`, prio: 0, open: "goal",
          title: voice(playful, me ? `So close, ${me}` : "So close", `${fmt(left)} from your goal`),
          body: voice(playful, `Just ${fmt(left)} to go to ${fmt(target)}. One good order does it.`, `${Math.floor(pct)}% of ${fmt(target)}.`) });
      }
      if (daysLeft >= 1 && daysLeft <= 3 && pct >= 60) {
        add({ kind: "goal", ref: `${month}:last`, prio: 0, open: "goal",
          title: voice(playful, `${daysLeft} day${daysLeft === 1 ? "" : "s"} left${me ? `, ${me}` : ""}`, `${daysLeft} day${daysLeft === 1 ? "" : "s"} left: ${fmt(left)} to go`),
          body: voice(playful, `${fmt(left)} between you and ${fmt(target)}. ${fmt(perDay)} a day gets you there.`, `${fmt(perDay)} a day reaches ${fmt(target)}.`) });
      }
    }
  }

  // What each client usually takes of an item: their latest line of it.
  const usual: Map<string, any> = new Map();
  for (const o of [...mine].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    const cid = o.payload && o.payload.agentClientId;
    const name = cid == null ? "" : ctx.clients.get(`${agentId}|${cid}`) || "";
    for (const it of (o.payload && o.payload.items) || []) {
      const key = `${it.productId}::${it.variantIdx == null ? "" : it.variantIdx}`;
      const qty = Number(it.qty) || 0;
      if (!name || !(qty > 0)) { if (!usual.has(key)) usual.set(key, null); continue; }
      const cur = usual.get(key);
      const byWho = (cur && cur.byWho) || new Map();
      byWho.set(name, qty);
      let best: any = null;
      for (const [who, q] of byWho) if (!best || q > best.qty) best = { who, qty: q };
      usual.set(key, { byWho, who: best.who, qty: best.qty, price: Number(it.sellPrice) || 0 });
    }
  }

  // A price drop on something this agent sells, worked out on the client
  // who takes the most of it. The biggest one only -- one tap, one item.
  const drops: any[] = [];
  for (const [key, u] of usual) {
    const p = ctx.prices && ctx.prices.get(key);
    if (!p || !(p.prev > 0) || !(p.today > 0)) continue;
    const drop = p.prev - p.today;
    if (!(drop > 0) || drop / p.prev < 0.005) continue;
    const [pid, v] = key.split("::");
    drops.push({ key, pid, v, drop, p, u, saving: u ? drop * u.qty : drop });
  }
  drops.sort((a, b) => b.saving - a.saving);
  for (const d of drops.slice(0, 1)) {
    const name = productName(d.pid);
    const unit = d.p.unit || "";
    const a = unit ? `a ${unit}` : "each";
    const on = d.u ? `${first(d.u.who)}'s usual ${fmt(d.u.qty)}${unit ? " " + unitWord(unit, d.u.qty) : ""}` : "";
    add({ kind: "price", ref: `${d.key}:${today}`, prio: 2, open: `item:${d.pid}:${d.v}`, image: (ctx.images && ctx.images.get(d.pid)) || "",
      title: voice(playful, `${name} just got cheaper${me ? `, ${me}` : ""}`, `Price drop: ${name}`),
      body: d.u
        ? voice(playful, `You pay ${fmt(d.p.today)} ${a}, down ${fmt(d.drop)}. On ${on}, that is +${fmt(d.saving)} for you.`,
          `Now ${fmt(d.p.today)} ${a} (was ${fmt(d.p.prev)}). +${fmt(d.saving)} on ${on}.`)
        : voice(playful, `You pay ${fmt(d.p.today)} ${a}, down ${fmt(d.drop)}.`, `Now ${fmt(d.p.today)} ${a} (was ${fmt(d.p.prev)}).`) });
  }

  // Promotions: every new one reaches every agent -- with what it would
  // add to a real client's usual when they have one -- and one in their
  // cluster about to end.
  const clusterKeys = new Set((ctx.clusters || []).filter((c: any) => c.agent_id === agentId)
    .map((c: any) => `${c.product_id}::${c.variant_idx || ""}`));
  for (const p of ctx.promos || []) {
    if (!p.active || !p.created_at || nowMs - Date.parse(p.created_at) > 2 * DAY) continue;
    if (p.starts_at && p.starts_at > today) continue;
    if (p.ends_at && p.ends_at < today) continue;
    const key = `${p.product_id}::${p.variant_idx || ""}`;
    const u = usual.get(key);
    const mine = clusterKeys.has(key) || u !== undefined;
    const bonus = p.bonus_type === "fixed" ? `+${fmt(p.bonus_value)}` : `+${p.bonus_value}%`;
    const until = p.ends_at ? `Until ${WEEKDAYS[new Date(p.ends_at + "T00:00:00Z").getUTCDay()]}` : "While it lasts";
    const extra = u ? (p.bonus_type === "fixed" ? Number(p.bonus_value) * u.qty : Number(p.bonus_value) / 100 * u.price * u.qty) : 0;
    add({ kind: "bonus_new", ref: String(p.id), prio: mine ? 2 : 3, open: `item:${p.product_id}:${p.variant_idx || ""}`, image: (ctx.images && ctx.images.get(p.product_id)) || "",
      title: voice(playful, `New bonus: ${bonus} on ${productName(p.product_id)}`, `${bonus} bonus on ${productName(p.product_id)}`),
      body: u && extra > 0
        ? voice(playful, `${until}. ${first(u.who)} took ${fmt(u.qty)} last time: at that, ${fmt(extra)} extra.`, `${until}. ${fmt(extra)} on ${first(u.who)}'s usual.`)
        : clusterKeys.has(key) ? `${until}. It is in your cluster.`
        : voice(playful, `${until}. ${bonus} on every one you sell. First client to hear about it wins.`, `${until}. ${bonus} on every one you sell.`) });
  }

  // Within one good sale of the next place up this month.
  const board: any[] = ctx.board;
  const i = board.findIndex((r) => r.id === agentId);
  if (i > 0) {
    const meRow = board[i], above = board[i - 1];
    const gap = above.amount - meRow.amount;
    const typical = meRow.orders ? meRow.amount / meRow.orders : 0;
    if (gap > 0 && typical > 0 && gap <= typical * 1.5) {
      add({ kind: "rank", ref: `${month}:${i}`, prio: 3,
        title: `${fmt(gap)} from #${i}`, body: voice(playful, `One good sale and #${i} is yours.`, `One good sale moves you up the board this month.`) });
    }
  }

  // A bonus on something in their cluster ends within two days.
  for (const p of ctx.promos || []) {
    if (!p.active || !p.ends_at) continue;
    const left = Math.round((Date.parse(p.ends_at + "T00:00:00Z") - todayMs) / DAY);
    if (left < 0 || left > 2) continue;
    if (!clusterKeys.has(`${p.product_id}::${p.variant_idx || ""}`)) continue;
    const bonus = p.bonus_type === "fixed" ? `+${fmt(p.bonus_value)}` : `+${p.bonus_value}%`;
    add({ kind: "bonus", ref: `${p.id}:${p.ends_at}`, prio: 4, open: `item:${p.product_id}:${p.variant_idx || ""}`,
      title: `${bonus} bonus ends ${left === 0 ? "today" : left === 1 ? "tomorrow" : "in 2 days"}`,
      body: `${productName(p.product_id)} is in your cluster.` });
  }

  return out.filter((n) => wants(prefs, n.kind)).sort((a, b) => a.prio - b.prio);
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

/* Yesterday's price against today's, per item, from the daily snapshots
   agent-catalog keeps (0110). "Yesterday" is the latest earlier day there
   is one for, so a day nobody opened the app is simply skipped. */
function priceMoves(rows: any[], today: string): Map<string, any> {
  const byKey: Map<string, any> = new Map();
  for (const r of rows || []) {
    const key = `${r.product_id}::${r.variant_key || ""}`;
    const x = byKey.get(key) || { today: 0, prev: 0, prevOn: "", unit: r.unit || "" };
    if (r.taken_on === today) { x.today = Number(r.price) || 0; x.unit = r.unit || x.unit; }
    else if (r.taken_on < today && r.taken_on > x.prevOn) { x.prev = Number(r.price) || 0; x.prevOn = r.taken_on; }
    byKey.set(key, x);
  }
  return byKey;
}

/* ---------------- Delivery ---------------- */
function base64Url(bytes: Uint8Array | string): string {
  const bin = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pemBody(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
}

// Android, through FCM's HTTP v1 API -- the same service account as the
// worker app's notify-worker.
let fcmCache: any = null;
async function fcmAccess(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (fcmCache && fcmCache.exp > now + 60) return fcmCache.token;
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now,
  }))}`;
  const key = await crypto.subtle.importKey("pkcs8", pemBody(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${base64Url(new Uint8Array(sig))}` }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`FCM auth failed: ${JSON.stringify(data)}`);
  fcmCache = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return fcmCache.token;
}
async function sendFcm(sa: any, token: string, n: Nudge): Promise<number> {
  const access = await fcmAccess(sa);
  const resp = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
    body: JSON.stringify({ message: {
      token,
      notification: { title: n.title, body: n.body, ...(n.image ? { image: n.image } : {}) },
      data: { kind: n.kind, open: n.open },
      android: { priority: "high", notification: { channel_id: "ow_agent", icon: "ic_stat_ow", color: "#B23A26", tag: `${n.kind}:${n.ref}` } },
    } }),
  });
  if (resp.ok) return 200;
  const err = await resp.json().catch(() => ({}));
  const status = err && err.error && err.error.status;
  return status === "UNREGISTERED" || status === "NOT_FOUND" || resp.status === 404 ? 410 : resp.status;
}

// iPhone, straight to APNs with a token-based (.p8) key: an ES256 JWT,
// good for up to an hour, reused across sends.
let apnsCache: any = null;
async function apnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (apnsCache && apnsCache.iat > now - 3000) return apnsCache.jwt;
  const unsigned = `${base64Url(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }))}.${base64Url(JSON.stringify({ iss: APNS_TEAM_ID, iat: now }))}`;
  const key = await crypto.subtle.importKey("pkcs8", pemBody(APNS_KEY_P8), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  apnsCache = { jwt: `${unsigned}.${base64Url(new Uint8Array(sig))}`, iat: now };
  return apnsCache.jwt;
}
async function sendApns(token: string, n: Nudge): Promise<number> {
  const host = APNS_SANDBOX ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const resp = await fetch(`${host}/3/device/${token}`, {
    method: "POST",
    headers: { authorization: `bearer ${await apnsJwt()}`, "apns-topic": APNS_BUNDLE_ID, "apns-push-type": "alert",
      "apns-priority": "10", "apns-collapse-id": `${n.kind}:${n.ref}`.slice(0, 64) },
    body: JSON.stringify({ aps: { alert: { title: n.title, body: n.body }, sound: "default" }, kind: n.kind, open: n.open }),
  });
  if (resp.ok) return 200;
  return resp.status === 410 || resp.status === 400 ? 410 : resp.status;
}

async function deliver(admin: any, s: any, n: Nudge, sa: any): Promise<boolean> {
  return (await deliverWhy(admin, s, n, sa)).ok;
}
// The same, saying why not -- the test button shows it to the agent.
async function deliverWhy(admin: any, s: any, n: Nudge, sa: any): Promise<{ ok: boolean; why: string }> {
  try {
    let code = 0;
    if (s.platform === "android") {
      if (!sa) return { ok: false, why: "no_firebase_key" };
      if (!s.push_token) return { ok: false, why: "no_token" };
      code = await sendFcm(sa, s.push_token, n);
    } else if (s.platform === "ios") {
      if (!(APNS_KEY_P8 && APNS_KEY_ID && APNS_TEAM_ID)) return { ok: false, why: "no_apns_key" };
      if (!s.push_token) return { ok: false, why: "no_token" };
      code = await sendApns(s.push_token, n);
    } else {
      if (!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)) return { ok: false, why: "no_vapid_key" };
      if (!s.endpoint) return { ok: false, why: "no_token" };
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
        JSON.stringify({ title: n.title, body: n.body, kind: n.kind, open: n.open, url: `/agent.html?open=${encodeURIComponent(n.open || "today")}` }),
        { TTL: 6 * 3600 },
      );
      return { ok: true, why: "" };
    }
    if (code === 410) await admin.from("agent_push_subscriptions").delete().eq("id", s.id);
    if (code !== 200) console.error("agent-nudge: send failed", { agent: s.agent_id, platform: s.platform, code });
    return { ok: code === 200, why: code === 200 ? "" : code === 410 ? "token_expired" : `refused_${code}` };
  } catch (e: any) {
    const code = e && e.statusCode;
    console.error("agent-nudge: send failed", { agent: s.agent_id, platform: s.platform, code, e: String(e && e.message || e) });
    if (code === 404 || code === 410) await admin.from("agent_push_subscriptions").delete().eq("id", s.id);
    return { ok: false, why: code === 404 || code === 410 ? "token_expired" : `error_${code || "send"}` };
  }
}

async function runShop(admin: any, shopId: string, subs: any[], nowMs: number, dryRun: boolean, sa: any) {
  const since60 = new Date(nowMs - 60 * DAY).toISOString();
  const since120d = new Date(nowMs - 120 * DAY).toISOString().slice(0, 10);
  const today = kampalaDate(nowMs);
  const since8d = new Date(Date.parse(today + "T00:00:00Z") - 8 * DAY).toISOString().slice(0, 10);
  const [agentsR, clientsR, ordersR, inqR, pinsR, promosR, clustersR, logR, productsR, goalsR, prefsR, pricesR] = await Promise.all([
    admin.from("agents").select("id, name, unavailable, retired_at").eq("shop_id", shopId),
    admin.from("agent_clients").select("id, agent_id, name").eq("shop_id", shopId),
    admin.from("saved_quotes").select("date, status, agent_id, payload").eq("shop_id", shopId).eq("voided", false)
      .not("agent_id", "is", null).gte("date", since120d),
    admin.from("catalogue_inquiries").select("id, agent_id, product_id, customer_name, message, handled_at, created_at")
      .eq("shop_id", shopId).gte("created_at", new Date(nowMs - 2 * DAY).toISOString()),
    admin.from("agent_feed_pins").select("id, product_id, note, ends_on, created_at").eq("shop_id", shopId)
      .gte("created_at", new Date(nowMs - 2 * DAY).toISOString()),
    admin.from("agent_promotions").select("id, product_id, variant_idx, bonus_type, bonus_value, active, starts_at, ends_at, created_at").eq("shop_id", shopId),
    admin.from("agent_clusters").select("agent_id, product_id, variant_idx").eq("shop_id", shopId),
    admin.from("agent_push_log").select("agent_id, kind, ref, sent_at").eq("shop_id", shopId).gte("sent_at", since60),
    admin.from("products").select("id, name, image").eq("shop_id", shopId),
    admin.from("agent_goals").select("agent_id, monthly_target").eq("shop_id", shopId),
    admin.from("agent_notify_prefs").select("agent_id, kinds, morning_hour, tone").eq("shop_id", shopId),
    admin.from("agent_price_snapshots").select("product_id, variant_key, price, unit, taken_on").eq("shop_id", shopId).gte("taken_on", since8d),
  ]);
  const failed = [agentsR, clientsR, ordersR, inqR, pinsR, promosR, clustersR, logR, productsR, goalsR, prefsR, pricesR].find((r) => r.error);
  if (failed) return { shopId, error: failed.error.message };

  const agents = (agentsR.data || []).filter((a: any) => !a.unavailable && !a.retired_at);
  const clientCounts: Map<any, number> = new Map();
  for (const c of clientsR.data || []) clientCounts.set(c.agent_id, (clientCounts.get(c.agent_id) || 0) + 1);
  const ctx = {
    inquiries: inqR.data || [], pins: pinsR.data || [], promos: promosR.data || [],
    clusters: clustersR.data || [], orders: ordersR.data || [],
    products: new Map((productsR.data || []).map((p: any) => [p.id, p.name])),
    images: new Map((productsR.data || []).filter((p: any) => /^https:\/\//.test(String(p.image || ""))).map((p: any) => [p.id, p.image])),
    clients: new Map((clientsR.data || []).map((c: any) => [`${c.agent_id}|${c.id}`, c.name])),
    agentNames: new Map(agents.map((a: any) => [a.id, a.name])),
    clientCounts,
    goals: new Map((goalsR.data || []).map((g: any) => [g.agent_id, Number(g.monthly_target) || 0])),
    prefs: new Map((prefsR.data || []).map((p: any) => [p.agent_id, p])),
    prices: priceMoves(pricesR.data || [], today),
    board: monthBoard(ordersR.data || [], agents, today.slice(0, 7)),
  };
  const plan: any[] = [];
  for (const a of agents) {
    const mySubs = subs.filter((s) => s.agent_id === a.id);
    if (!mySubs.length) continue;
    const myLog = (logR.data || []).filter((l: any) => l.agent_id === a.id);
    const sentKeys = new Set<string>(myLog.map((l: any) => `${l.kind}|${l.ref}`));
    const sentToday = myLog.filter((l: any) => kampalaDate(Date.parse(l.sent_at)) === today).length;
    const send = pickToSend(nudgesFor(a.id, ctx, nowMs), sentKeys, sentToday, NUDGE_DAILY_CAP);
    for (const n of send) {
      if (dryRun) { plan.push({ agent: a.id, ...n }); continue; }
      let delivered = 0;
      for (const s of mySubs) if (await deliver(admin, s, n, sa)) delivered++;
      if (delivered) {
        await admin.from("agent_push_log").insert({ shop_id: shopId, agent_id: a.id, kind: n.kind, ref: n.ref,
          title: n.title, body: n.body });
      }
      plan.push({ agent: a.id, kind: n.kind, delivered });
    }
  }
  return { shopId, plan };
}

/* "Send me a test": one notification, now, to every phone of the agent
   who asked -- signed in, so it can only ever buzz their own phones. Not
   logged and not counted, and it says per phone why
   one did not go, so a silence can be told apart from a fault. */
async function testSend(req: Request) {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: who } = await admin.auth.getUser(jwt);
  const user = who && who.user;
  if (!user) return json({ ok: false, why: "signed_out" }, 401);
  const { data: subs, error } = await admin.from("agent_push_subscriptions")
    .select("id, shop_id, agent_id, platform, push_token, endpoint, p256dh, auth_key").eq("user_id", user.id);
  if (error) return json({ ok: false, why: "db", detail: error.message }, 500);
  if (!subs || !subs.length) return json({ ok: false, why: "not_registered", phones: [] });
  const { data: ag } = await admin.from("agents").select("name").eq("user_id", user.id).limit(1);
  const me = ag && ag[0] && ag[0].name ? first(ag[0].name) : "";
  let sa: any = null;
  if (FIREBASE_SERVICE_ACCOUNT_JSON) { try { sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON); } catch (_e) { /* reported as no key */ } }
  const n: Nudge = { kind: "test", ref: String(Date.now()), prio: 0, open: "today", image: "",
    title: me ? `It works, ${me}` : "It works",
    body: "This is how your wins, your clients' days and the prices that move your money will reach you." };
  const phones = [];
  for (const s of subs) phones.push({ platform: s.platform || "web", ...(await deliverWhy(admin, s, n, sa)) });
  return json({ ok: phones.some((p) => p.ok), phones });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const body = await req.json().catch(() => ({}));

  if (body.action === "config") {
    return json({ ok: true, publicKey: VAPID_PUBLIC_KEY || null });
  }

  if (body.action === "test") return testSend(req);
  if (body.action !== "run") return json({ error: "Unknown action" }, 400);
  // Closed unless the secret is set: an open endpoint here could make
  // every agent's phone buzz on demand.
  if (!AGENT_NUDGE_SECRET) return json({ error: "AGENT_NUDGE_SECRET is not set" }, 503);
  if ((req.headers.get("x-cron-secret") || "") !== AGENT_NUDGE_SECRET) return json({ error: "Bad or missing x-cron-secret" }, 401);

  let sa: any = null;
  if (FIREBASE_SERVICE_ACCOUNT_JSON) {
    try { sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON); } catch (_e) { console.error("agent-nudge: FIREBASE_SERVICE_ACCOUNT_JSON is not JSON"); }
  }
  const canSend = (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) || sa || (APNS_KEY_P8 && APNS_KEY_ID && APNS_TEAM_ID);
  if (!canSend && !body.dryRun) return json({ ok: true, skipped: "no push keys configured (VAPID, Firebase or APNs)" });

  const nowMs = Date.now();

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: subs, error } = await admin.from("agent_push_subscriptions")
    .select("id, shop_id, agent_id, platform, push_token, endpoint, p256dh, auth_key");
  if (error) return json({ error: error.message, stage: "subscriptions" }, 500);
  const shops = [...new Set((subs || []).map((s: any) => s.shop_id))];
  const results = [];
  for (const shopId of shops) {
    results.push(await runShop(admin, shopId, (subs || []).filter((s: any) => s.shop_id === shopId), nowMs, !!body.dryRun, sa));
  }
  return json({ ok: true, shops: results.length, results });
});
