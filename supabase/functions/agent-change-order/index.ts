// An agent changing their mind about an order they already sent.
//
// Where the order has got to decides what they may do, and it is decided
// HERE rather than trusted from the app:
//
//   - Before the shop has been paid (still a draft, nothing paid), the
//     order is the agent's to change. Editing the items is a resubmission
//     and is priced like one, so it goes through agent-submit-order with
//     `replaceOrderId` -- this function never prices anything. Cancelling
//     is a flag, `agentCancel`, that stops the order where it stands; the
//     shop closes it from its board, so nothing disappears from under
//     somebody who is ringing a supplier about it.
//   - Once it is paid or the shop is working on it, the agent can only
//     ASK: fewer of a line, or none of anything (`agentChange`). The shop
//     agrees or keeps each line from the order's own drawer, and what an
//     agreed line takes off a paid order becomes the agent's credit.
//   - Credit is spent here too (`useCredit`): taken from the orders that
//     carry it, oldest first, and paid onto the order in front of them.
//
// Deployed alone, like every function in this folder, so the helpers it
// needs live in this file.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

// A database without the function (its migration not applied yet), as
// PostgREST and Postgres each say it.
function rpcMissing(err: any): boolean {
  const code = String((err && err.code) || "");
  return code === "PGRST202" || code === "42883" || /could not find the function/i.test(String((err && err.message) || ""));
}

const CANCEL_REASONS = ["Client changed their mind", "Wrong items or quantities", "Taking too long", "Something else"];

// What the order's charges come to (a delivery fee, say) on top of the
// goods -- the shop's own rule: a percent is of the goods, a fixed one is
// whole shillings, nothing at or below zero. Same rule in agent.html,
// check-momo-payment-status, agent-initiate-momo-payment and
// agent-change-order; keep them in step.
function chargesTotal(payload: any, goods: number): number {
  return (Array.isArray(payload && payload.charges) ? payload.charges : []).reduce((s: number, ch: any) => {
    const v = Number(ch && ch.value) || 0;
    if (!(v > 0)) return s;
    return s + (ch.type === "percent" ? Math.round(goods * v / 100) : Math.round(v));
  }, 0);
}

// What the shop is owed for the lines as they stand, and its charges.
function orderShopTotal(payload: any): number {
  const goods = (payload.items || []).reduce((s: number, it: any) => s + (Number(it.sellPrice) || 0) * (Number(it.qty) || 0), 0);
  return goods + chargesTotal(payload, goods);
}

// Still the agent's to change: a draft nobody has paid anything on.
function orderIsOpen(order: any): boolean {
  const p = order.payload || {};
  return order.status === "draft" && !order.voided && !p.agentCancel
    && p.agentPaymentStatus !== "paid" && !(Number(order.amount_paid) > 0);
}

// Why a request cannot be made on this order, or null when it can.
function changeRefusal(order: any, agentId: string, action: string): string | null {
  const p = (order && order.payload) || {};
  if (!order) return "Order not found";
  if (p.originAgentId !== agentId) return "This order does not belong to you";
  if (order.voided) return "This order is already cancelled";
  if (p.agentCancel) return "You already cancelled this order";
  if (action === "cancel") {
    return orderIsOpen(order) ? null : "The shop has started on this order — ask them to change it instead";
  }
  if (action === "ask") {
    if (orderIsOpen(order)) return "This order is not paid yet — change it yourself";
    if (order.status === "completed") return "This order is finished — talk to the shop about a return";
    return null;
  }
  if (action === "withdraw") {
    return p.agentChange && p.agentChange.state === "asked" ? null : "There is no request waiting on this order";
  }
  return "Unknown action";
}

const lineKey = (productId: unknown, variantIdx: unknown) =>
  `${String(productId ?? "")}::${variantIdx === null || variantIdx === undefined ? "" : String(variantIdx)}`;

// The lines of an ask, checked against the order: each one names a line
// that is on it, and asks for fewer of it (none is allowed). `cancel`
// asks for none of every line.
function buildAskLines(items: any[], wanted: any[], cancel: boolean): { lines?: any[]; error?: string } {
  const byKey = new Map(items.map((it) => [lineKey(it.productId, it.variantIdx), it]));
  const asks = cancel
    ? items.map((it) => ({ productId: it.productId, variantIdx: it.variantIdx, to: 0 }))
    : (Array.isArray(wanted) ? wanted : []);
  const lines: any[] = [];
  const seen = new Set();
  for (const a of asks) {
    const key = lineKey(a && a.productId, a && a.variantIdx);
    const it = byKey.get(key);
    if (!it) return { error: "A line in the request is not on this order" };
    if (seen.has(key)) continue;
    seen.add(key);
    const from = Number(it.qty) || 0;
    const to = Number(a.to);
    if (!Number.isFinite(to) || to < 0 || Math.floor(to) !== to) return { error: "Each line needs a whole quantity of 0 or more" };
    if (to >= from) continue; // more is a new order, not a change to this one
    lines.push({
      productId: it.productId, variantIdx: it.variantIdx === undefined ? null : it.variantIdx,
      name: it.productName || "", unit: it.unit || "", from, to,
      sellPrice: Number(it.sellPrice) || 0,
    });
  }
  if (!lines.length) return { error: "Nothing in the request asks for fewer of anything" };
  return { lines };
}

// What is left of the credit an order carries.
function creditLeft(payload: any): number {
  const c = payload && payload.agentCredit;
  if (!c) return 0;
  const used = (Array.isArray(c.used) ? c.used : []).reduce((s, u) => s + (Number(u && u.amount) || 0), 0);
  return Math.max(0, Math.round((Number(c.amount) || 0) - used));
}

// Oldest credit first, until the bill is covered or the credit runs out.
function planCredit(sources: any[], due: number): { from: any; amount: number }[] {
  const plan: { from: any; amount: number }[] = [];
  let left = Math.max(0, Math.round(due));
  sources
    .map((s) => ({ s, left: creditLeft(s.payload), at: String((s.payload.agentCredit || {}).at || "") }))
    .filter((x) => x.left > 0)
    .sort((a, b) => a.at.localeCompare(b.at))
    .forEach((x) => {
      if (left <= 0) return;
      const take = Math.min(x.left, left);
      plan.push({ from: x.s, amount: take });
      left -= take;
    });
  return plan;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const { shopId, orderId, action } = body;
    if (!shopId || orderId == null || !action) return json({ error: "shopId, orderId and action are required" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: agentId, error: agentIdErr } = await callerClient.rpc("current_agent_id", { p_shop_id: shopId });
    if (agentIdErr) return json({ error: agentIdErr.message, stage: "current_agent_id" }, 500);
    if (!agentId) return json({ error: "Not an agent of this shop" }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: order, error: orderErr } = await admin
      .from("saved_quotes").select("id, status, voided, payload, amount_paid")
      .eq("shop_id", shopId).eq("id", orderId).maybeSingle();
    if (orderErr) return json({ error: orderErr.message, stage: "order_lookup" }, 500);
    if (!order) return json({ error: "Order not found" }, 404);
    const payload = order.payload || {};
    if (payload.originAgentId !== agentId) return json({ error: "This order does not belong to you" }, 403);
    const now = new Date().toISOString();

    if (action === "useCredit") {
      if (order.voided || payload.agentCancel) return json({ error: "This order is cancelled" }, 409);
      let due = Math.round(orderShopTotal(payload) - (Number(order.amount_paid) || 0));
      if (!(due > 0)) return json({ error: "Nothing owed on this order" }, 400);
      // The plan is made from what was read, and use_agent_credit (0109)
      // checks it under row locks and writes both sides in one
      // transaction. Two requests that read the same balance used to both
      // spend it -- writing the source first did not stop that, and the
      // rollback put back a stale copy of the whole source order. Now the
      // second one finds the credit gone, reads again and plans from what
      // is really left. Bounded: a credit that keeps moving under us is
      // reported rather than chased.
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: mine, error: mineErr } = await admin
          .from("saved_quotes").select("id, payload")
          .eq("shop_id", shopId).eq("agent_id", agentId);
        if (mineErr) return json({ error: mineErr.message, stage: "credit_lookup" }, 500);
        const plan = planCredit((mine || []).filter((q: any) => String(q.id) !== String(order.id)), due);
        if (!plan.length) return json({ error: "You have no credit to use" }, 409);
        const { data: res, error: rpcErr } = await admin.rpc("use_agent_credit", {
          p_shop_id: shopId, p_agent_id: agentId, p_order_id: order.id,
          p_plan: plan.map((p) => ({ from: p.from.id, amount: p.amount })), p_at: now,
        });
        if (rpcErr) {
          // Refused rather than done the old way: the old way is the one
          // that spent credit twice. Nothing has been written.
          if (rpcMissing(rpcErr)) return json({ error: "Using credit needs database update 0109 — ask the shop", stage: "credit_spend" }, 503);
          return json({ error: rpcErr.message, stage: "credit_spend" }, 500);
        }
        if (res && res.ok) {
          return json({ ok: true, orderId: order.id, credited: res.credited, owed: res.owed, paid: !!res.paid });
        }
        // Something moved between the read and the lock. Re-read the order
        // too: it may have been paid, cancelled or voided meanwhile.
        const { data: fresh, error: freshErr } = await admin
          .from("saved_quotes").select("id, voided, payload, amount_paid")
          .eq("shop_id", shopId).eq("id", order.id).maybeSingle();
        if (freshErr) return json({ error: freshErr.message, stage: "order_lookup" }, 500);
        if (!fresh || fresh.voided || (fresh.payload || {}).agentCancel) return json({ error: "This order is cancelled" }, 409);
        due = Math.round(orderShopTotal(fresh.payload || {}) - (Number(fresh.amount_paid) || 0));
        if (!(due > 0)) return json({ error: "Nothing owed on this order" }, 400);
      }
      return json({ error: "Your credit changed while it was being used — try again", stage: "credit_spend" }, 409);
    }

    const why = changeRefusal(order, agentId, action);
    if (why) return json({ error: why }, 409);

    let nextPayload: any;
    if (action === "cancel") {
      const reason = CANCEL_REASONS.includes(body.reason) ? body.reason : CANCEL_REASONS[3];
      nextPayload = { ...payload, agentCancel: { at: now, reason } };
    } else if (action === "ask") {
      const built = buildAskLines(payload.items || [], body.lines, !!body.cancel);
      if (built.error) return json({ error: built.error }, 400);
      const note = String(body.note || "").trim().slice(0, 400);
      nextPayload = { ...payload, agentChange: { at: now, state: "asked", cancel: !!body.cancel, note, lines: built.lines } };
    } else {
      nextPayload = { ...payload, agentChange: { ...payload.agentChange, state: "withdrawn", decidedAt: now } };
    }
    const { error: updErr } = await admin.from("saved_quotes").update({ payload: nextPayload })
      .eq("shop_id", shopId).eq("id", order.id);
    if (updErr) return json({ error: updErr.message, stage: "update" }, 500);
    return json({ ok: true, orderId: order.id, action });
  } catch (err) {
    console.error("agent-change-order: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err), stage: "uncaught" }, 500);
  }
});
