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

const CANCEL_REASONS = ["Client changed their mind", "Wrong items or quantities", "Taking too long", "Something else"];

// What the shop is owed for the lines as they stand.
function orderShopTotal(payload: any): number {
  return (payload.items || []).reduce((s: number, it: any) => s + (Number(it.sellPrice) || 0) * (Number(it.qty) || 0), 0);
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
      const due = Math.round(orderShopTotal(payload) - (Number(order.amount_paid) || 0));
      if (!(due > 0)) return json({ error: "Nothing owed on this order" }, 400);
      const { data: mine, error: mineErr } = await admin
        .from("saved_quotes").select("id, payload")
        .eq("shop_id", shopId).eq("agent_id", agentId);
      if (mineErr) return json({ error: mineErr.message, stage: "credit_lookup" }, 500);
      const plan = planCredit((mine || []).filter((q: any) => String(q.id) !== String(order.id)), due);
      if (!plan.length) return json({ error: "You have no credit to use" }, 409);
      // The credit is marked spent on the orders it came from FIRST, so a
      // failure between the two writes can only lose a payment the agent
      // can see is missing, never spend the same credit twice.
      const spent: { from: any; amount: number; prev: any }[] = [];
      for (const p of plan) {
        const prev = p.from.payload.agentCredit;
        const used = (Array.isArray(prev.used) ? prev.used : []).concat([{ to: order.id, amount: p.amount, at: now }]);
        const { error: srcErr } = await admin.from("saved_quotes")
          .update({ payload: { ...p.from.payload, agentCredit: { ...prev, used } } })
          .eq("shop_id", shopId).eq("id", p.from.id);
        if (srcErr) break;
        spent.push({ ...p, prev });
      }
      const total = spent.reduce((s, p) => s + p.amount, 0);
      if (!total) return json({ error: "Could not use your credit — try again", stage: "credit_spend" }, 500);
      const payments = (Array.isArray(payload.payments) ? payload.payments : []).concat(spent.map((p) => ({
        date: now.slice(0, 10), amount: p.amount, note: `Credit from order #${p.from.id}`, creditFrom: p.from.id,
      })));
      const newPaid = (Number(order.amount_paid) || 0) + total;
      const nextPayload: any = { ...payload, payments };
      if (newPaid + 0.5 >= orderShopTotal(payload)) nextPayload.agentPaymentStatus = "paid";
      const { error: updErr } = await admin.from("saved_quotes")
        .update({ amount_paid: newPaid, payload: nextPayload })
        .eq("shop_id", shopId).eq("id", order.id);
      if (updErr) {
        for (const p of spent) {
          await admin.from("saved_quotes").update({ payload: { ...p.from.payload, agentCredit: p.prev } })
            .eq("shop_id", shopId).eq("id", p.from.id);
        }
        return json({ error: updErr.message, stage: "credit_apply" }, 500);
      }
      return json({ ok: true, orderId: order.id, credited: total, owed: Math.max(0, due - total), paid: nextPayload.agentPaymentStatus === "paid" });
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
