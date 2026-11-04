/*
 * One order as its screen draws it (OR05–OR09, OR12, OR13, OR22): the track's words, the money
 * tiles, the check list's marks, the Tell tile's sub. Read from the order's state only, so each
 * stage of #0552's life comes out as its board draws it.
 */
import { goodsTotal, lineTotal, orderOwes, orderTotal } from '../../../core/money.ts';
import { firstWord, orderNo, STAGES } from '../../../core/names.ts';
import { clock, dayLabel, dayOf, daysApart, weekday, when } from '../../../core/time.ts';
import type { BillAsk, Books, Line, Ms, Order, Stage } from '../../../core/types.ts';
import type { Tile } from './local-Parts.tsx';
import { twinOf } from '../../../core/orders.ts';
import { backLines, byRole, dropped, faceOfMember, kept, member, openAsk, shortItem, shortName, waitsRuth } from './data.ts';
import type { CHead, CLine, Mark } from './local-CheckList.tsx';

const GREEN = '#0F6B43', AMBER = '#F5B26B';

/** When a stage happened, as the rail says it: "9:14" today, "Fri" this week, "Aug" before. */
export function railTime(at: Ms, now: Ms): string {
  if (dayOf(at) === dayOf(now)) return clock(at);
  if (daysApart(dayOf(at), dayOf(now)) < 7) return weekday(at);
  return dayLabel(at).split(' ')[2];
}

/** The Manager's price that the customer has not been told yet. */
export const untold = (l: Line): boolean => !!l.priceReview && l.priceReview.state === 'changed' && !(l.priceToldAt && l.priceToldAt >= l.priceReview.at);
/** A price Ruth set in this stage, told to nobody yet: Tell it from the order itself (OR13). */
export function freshPrice(o: Order): Line | null {
  if (o.stage === 'checking' || o.lines.some(waitsRuth)) return null;
  return o.lines.find((l) => untold(l) && (l.priceReview as { at: number }).at >= o.stageAt) || null;
}

const aisleOf = (b: Books, l: Line): string => b.items.find((i) => i.id === l.itemId)?.aisle || '';
const ruthName = (b: Books): string => firstWord(byRole(b, 'manager')?.name || 'Manager');

export interface OrderView {
  sub: string;
  waits: boolean;
  times: Partial<Record<Stage, string>>;
  skipped: Stage[];
  tiles: Tile[];
  head: CHead;
  lines: CLine[];
  tellSub: string;
  returnAsk: BillAsk | null;
  /** An owing bill with money on it: its money is the question (OR24's order). */
  bill: boolean;
}

export function orderView(b: Books, o: Order, now: Ms): OrderView {
  const who = shortName(b, o), ruth = byRole(b, 'manager'), rn = ruthName(b);
  const holder = member(b, o.holderId), hn = holder ? firstWord(holder.name) : '';
  const waiting = o.lines.filter(waitsRuth), fresh = freshPrice(o), ret = openAsk(b, o, 'credit');
  const vn = firstWord(member(b, o.voidedBy)?.name || rn), vAt = o.voidedAt ? (dayOf(o.voidedAt) === dayOf(now) ? `today ${clock(o.voidedAt)}` : when(o.voidedAt, now)) : '';
  const logAt = (s: Stage) => o.stageLog.find((x) => x.stage === s)?.at;
  // Skipped: an order that started past Checking (all on our shelf), or a live one that went past a stage the log lacks
  // (OR31: Checking → Packing, Buying skipped). A delivered order's missing stage takes the next one's time.
  const missing = STAGES.slice(0, STAGES.indexOf(o.stage)).filter((s) => logAt(s) == null);
  const skipped = o.stage === 'checking' || (logAt('checking') != null && o.stage === 'delivered') ? [] : missing;
  const times: Partial<Record<Stage, string>> = {};
  STAGES.forEach((s) => { const a = logAt(s); if (a != null) times[s] = railTime(a, now); });
  if (o.stage === 'delivered' && o.deliveredAt) times.delivered = railTime(o.deliveredAt, now);
  STAGES.slice(0, STAGES.indexOf(o.stage)).reverse().forEach((s, i, l) => { if (!times[s] && !skipped.includes(s)) times[s] = i ? times[l[i - 1]] : times[o.stage]; });

  let sub = '';
  if (o.stage === 'checking') sub = waiting.length ? `${rn} decides ${waiting.length} price${waiting.length > 1 ? 's' : ''}` : orderOwes(o) > 0 ? 'Not paid yet' : `${rn} · checking`;
  else if (fresh) sub = `${rn} set ${(fresh.price as number).toLocaleString('en-US')} · ${clock((fresh.priceReview as { at: number }).at)}`;
  else if (o.voided) sub = `Voided by ${vn}`;
  else if (o.stage === 'delivered') {
    const at = o.deliveredAt || o.stageAt;
    sub = daysApart(dayOf(at), dayOf(now)) < 7 ? `At the door ${dayOf(at) === dayOf(now) ? clock(at) : `${weekday(at)} ${clock(at)}`}` : `Billed ${dayLabel(o.invoicedAt || at)}`;
  } else if (o.stage === 'road') sub = `${hn} · left ${clock(o.stageAt)}`;
  else sub = skipped.length ? `${hn} · all on our shelf` : `${hn} · since ${clock(o.stageAt)}`;

  // The money tiles.
  const total = orderTotal(o), paid = o.paid, goneLines = dropped(o);
  const left: Tile = { k: `${who} pays`, v: total };
  if (o.stage === 'checking' && o.lines.some((l) => l.price == null && l.state !== 'dropped')) { left.k = 'Priced so far'; if (o.toldTotal) left.note = `told ${o.toldTotal.toLocaleString('en-US')}`; }
  else if (o.stage === 'buying' && goneLines.length) left.note = `${shortItem(goneLines[0].name).split(' ').pop()?.toLowerCase()}s not in it`;
  else if (fresh) left.old = goodsTotal(o.lines.map((l) => (l === fresh ? { ...l, price: (fresh.priceReview as { was: number }).was } : l)));
  else if (o.stage !== 'checking' && o.stage !== 'buying' && !ret) left.note = `${kept(o).length} lines`;
  if (ret) left.k = `${who} paid`;
  const billOwes = o.invoiced && !ret && !o.voided && orderOwes(o) > 0;
  const billDay = o.invoicedAt ? dayLabel(o.invoicedAt) : '';
  if (billOwes || o.voided) { left.k = `Bill ${orderNo(o.id)}`; left.note = billDay; }
  if (o.voided) { left.struck = true; left.pill = 'Void'; }
  let right: Tile;
  if (ret) right = { k: 'Credit asked', v: ret.amount, tone: 'warn', dot: true };
  else if (o.voided) right = { k: 'Owes', v: 0, note: `${vn} voided it${vAt ? ' ' + vAt : ''}` };
  else if (billOwes) { const age = o.invoicedAt ? daysApart(dayOf(o.invoicedAt), dayOf(now)) : 0; right = { k: 'Owes', v: orderOwes(o), tone: 'warn', note: `${age} day${age === 1 ? '' : 's'}` }; }
  else if (paid >= total && total > 0) {
    const ms = [...new Set(o.payments.map((x) => ({ cash: 'cash', momo: 'mobile', bank: 'bank' })[x.method]))];
    right = { k: 'Paid', v: paid, tone: 'good', note: ms.join(' + ') };
  } else right = { k: 'Not paid yet', v: orderOwes(o), tone: 'warn', note: fresh ? undefined : o.stage === 'buying' ? 'before it leaves' : o.stage === 'checking' && waiting.length && !o.toldTotal ? undefined : 'leaves when paid' };

  // The check list.
  const lines: CLine[] = o.lines.map((l) => {
    const base = { aisle: aisleOf(b, l), name: l.name, qty: l.qty, unit: l.unit };
    if (l.state === 'dropped') return { ...base, note: 'not found', gone: true, mark: { k: 'no', label: 'Not found' } as Mark };
    const amount = lineTotal(l), rv = l.priceReview;
    if (ret && o.stage === 'delivered') {
      const n = backLines(o, ret).find((x) => x.line === l)?.n || 0;
      return { ...base, amount, mark: n ? { k: 'back', n, label: `${n} coming back` } : { k: 'ok', label: 'Delivered' } };
    }
    if (o.stage === 'checking') {
      if (waitsRuth(l)) return { ...base, amount: l.price == null ? undefined : amount, word: l.price == null ? { text: 'Price coming', tone: 'warn' } : undefined,
        mark: { k: 'face', face: faceOfMember(ruth || (b.me)), label: l.price == null ? `Price coming: ${rn} decides` : `${rn} decides the price` } };
      if (rv) return { ...base, amount, was: rv.was != null ? Math.round(rv.was * l.qty) : undefined, mark: { k: 'ok', at: clock(rv.at), label: `On the shelf; ${rn} ${rv.price === l.shopPrice ? 'kept' : 'set'} ${rv.price.toLocaleString('en-US')} at ${clock(rv.at)}` } };
      if (l.from === 'supplier') return l.state === 'waiting'
        ? { ...base, amount, mark: { k: 'spin', word: 'Order in', wordTone: 'info', label: 'Order in: the supplier is being asked' } }
        : { ...base, amount, word: { text: 'Order in', tone: 'info' }, mark: { k: 'ok', label: 'Order in: the supplier said yes' } };
      return { ...base, amount, mark: { k: 'ok', label: 'On the shelf' } };
    }
    if (o.stage === 'buying') {
      if (l === fresh && rv) return { ...base, amount, was: rv.was != null ? Math.round(rv.was * l.qty) : undefined, mark: { k: 'ok', at: clock(rv.at), label: `${rn} set ${rv.price.toLocaleString('en-US')} a ${l.unit} at ${clock(rv.at)}` } };
      if (l.state === 'waiting') return { ...base, amount, word: { text: `on the way${l.stateAt ? ' · ' + clock(l.stateAt) : ''}`, tone: 'info' }, mark: { k: 'wait', label: 'On the way' } };
      return { ...base, amount, mark: { k: 'ok', label: l.from === 'shelf' ? 'On the shelf' : 'The supplier said yes' } };
    }
    // Packing and after.
    if (l.state === 'packed' || o.stage !== 'packing') return { ...base, amount, mark: { k: 'ok', at: l.stateAt && o.stage === 'packing' ? clock(l.stateAt) : undefined, label: l.stateAt ? `Packed at ${clock(l.stateAt)}` : 'Packed' } };
    return { ...base, amount, was: l === fresh && rv && rv.was != null ? Math.round(rv.was * l.qty) : undefined, mark: { k: 'spin', word: 'packing', label: 'Packing now' } };
  });
  const live = lines.filter((l) => !l.gone);
  const okN = live.filter((l) => l.mark.k === 'ok').length;
  const head: CHead = { title: `What ${who} ${o.stage === 'delivered' ? 'got' : 'gets'}` };
  if (o.stage === 'checking') { head.bar = lines.map((l) => (l.mark.k === 'ok' ? GREEN : AMBER)); head.summary = `${lines.filter((l) => l.mark.k === 'ok').length} of ${lines.length}`; }
  else if (o.stage === 'packing') { head.bar = live.map((l) => (l.mark.k === 'ok' ? GREEN : AMBER)); head.summary = `${okN} of ${live.length} packed`; }
  else {
    head.pills = [{ k: 'ok', n: okN }];
    if (goneLines.length) head.pills.push({ k: 'no', n: goneLines.length });
    const back = live.filter((l) => l.mark.k === 'back').length;
    if (back) head.pills.push({ k: 'back', n: back });
  }

  // The Tell tile's sub.
  let tellSub = 'it\'s being checked';
  if (o.voided) tellSub = twinOf(b.orders, o, true) ? 'the copy is struck out' : 'it is struck out';
  else if (ret) tellSub = 'about the return';
  else if (billOwes && o.paid > 0) tellSub = 'what is owed';
  else if (o.stage === 'buying' && goneLines.length) tellSub = 'what was found';
  else if (o.stage === 'checking' && o.lines.some(untold)) tellSub = 'a new price';
  else if (waiting.length) tellSub = `${rn} is deciding`;
  else tellSub = { checking: 'it\'s being checked', buying: 'it\'s being bought', packing: 'it\'s packing', road: 'it\'s on the way', delivered: 'it\'s delivered' }[o.stage];

  return { sub, waits: o.stage === 'checking' && (waiting.length > 0 || orderOwes(o) > 0), times, skipped, tiles: [left, right], head, lines, tellSub, returnAsk: ret, bill: billOwes && o.paid > 0 };
}
