/*
 * To bill (route `orders/bill`, Orders p4): the head "To bill 5" with what is to be billed, split into
 * what bills itself and what waits on you; Can't bill itself (an ask on a delivered order: Only 567 ·
 * Bill it; Price coming · Price set · 42,500, greyed "Set price" with no cost yet; anything else Open);
 * Taken twice? (the app spots it: Open puts the slide "Cancel #0545 · keep #0544" on the card, Both are
 * real; #0545 billed: the slide locked "Billed first · ask for a void"); Bills itself (the 24 h ring,
 * "in 6 h 05 m"). Empty: "Nothing stuck · nothing to bill".
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { buyer, safePrice, toBill } from '../../../core/manager/orders.ts';
import type { Ask, ManagerBooks, MOrder } from '../../../core/manager/types.ts';
import { BILL_AFTER_MS, billsIn, inWords } from '../../../core/manager/watch.ts';
import { ANSWER, askWord, heldWord, hm } from '../../../core/manager/words.ts';
import { money } from '../../../core/money.ts';
import { dayOf, weekday } from '../../../core/time.ts';
import { firstWord, orderNo } from '../../../core/names.ts';
import { IconTile } from '../../../ui/ActRow.tsx';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { NavyCard } from '../../../ui/NavyCard.tsx';
import { PageHead } from '../../../ui/PageHead.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { nav } from '../shell/nav.ts';
import { act, answer, books, now, online, waiting } from '../shell/store.ts';
import { Empty, H2, Ring } from './Bits.tsx';
import './orders.css';

function CantRow(p: { a: Ask; o: MOrder; b: ManagerBooks }): JSX.Element {
  const { a, o, b } = p;
  const seller = b.team.find((x) => x.id === o.sellerId) || null;
  const safe = safePrice(b, a);
  const open = () => nav.push('decide', { id: a.key });
  const noCost = !!safe && safe.price == null;
  const why = a.kind === 'bill' ? heldWord(a.code, o.total) : askWord(a.kind, a.kind === 'price' ? a.mode : undefined);
  const who = seller ? firstWord(seller.name) : '';
  const by = buyer(b);
  let btn: JSX.Element;
  if (a.kind === 'bill' && a.code === 'OWSML') {
    btn = <button type="button" class="mg-orders-btn navy" onClick={() => answer(a.key, `${ANSWER.billIt} · ${money(o.total)} · ${orderNo(o.id)}`, 'billSmall', [o.id])}>{ANSWER.billIt}</button>;
  } else if (safe && safe.price != null && (a.kind === 'price' || a.kind === 'counter')) {
    const price = safe.price;
    btn = <button type="button" class="mg-orders-btn navy" onClick={() => answer(a.key, `${safe.say} · ${money(price)} · ${orderNo(o.id)}`, 'price', [o.id, a.idx, price, safe.word])}>{`${safe.say} · ${money(price)}`}</button>;
  } else if (noCost) {
    btn = <button type="button" class="mg-orders-btn off" aria-disabled="true" onClick={open}><Icon name="lock" size={16} stroke={2} />Set price</button>;
  } else {
    btn = <button type="button" class="mg-orders-btn navy" onClick={open}><Icon name="chevron-right" size={16} stroke={2.2} />Open</button>;
  }
  return (
    <div class="mg-orders-row">
      {seller && <Avatar initials={seller.initials} tint={seller.tint} size={36} font={13} />}
      <div class="mid">
        {noCost ? <div class="nm"><span class="no mono">{orderNo(o.id)}</span><span class="cu">{o.customerName}</span></div> : <span class="cu">{o.customerName}</span>}
        <span class="why">{why}</span>
        <span class="mono s">{noCost ? `no cost yet${by ? ` · ${firstWord(by.name)} buys it` : ''}` : [orderNo(o.id), who, a.kind === 'bill' ? `${o.lines.length} ${o.lines.length === 1 ? 'line' : 'lines'}` : ''].filter(Boolean).join(' · ')}</span>
      </div>
      {btn}
    </div>
  );
}

function TwinCard(p: { keep: MOrder; drop: MOrder; hide: () => void; unhide: () => void }): JSX.Element {
  const { keep, drop } = p;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const who = firstWord(drop.customerName);
  const pair = `${orderNo(keep.id)} = ${orderNo(drop.id)}`;
  if (drop.invoiced) {
    return (
      <div class="mg-orders-twin">
        <div class="h">
          <IconTile tone="neutral" icon="copy" size={36} iconSize={18} />
          <div class="mid"><span class="t">{`Taken twice? · ${who}`}</span><span class="mono s">{`${orderNo(drop.id)} is invoiced · a void now`}</span></div>
        </div>
        <NavyCard><Slide label="Billed first · ask for a void" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Billed first · ask for a void' }} /></NavyCard>
      </div>
    );
  }
  const cancel = async () => {
    setBusy(true);
    try {
      const r = await act('cancelTwin', drop.id, keep.id);
      toast.show(r.kept ? `${ANSWER.cancelled} · ${orderNo(drop.id)} · Waits` : `${ANSWER.cancelled} · ${orderNo(drop.id)} · keep ${orderNo(keep.id)}`, { kind: 'ok' });
    } catch (_e) { /* the bar or a toast says it; the card stays */ } finally { setBusy(false); }
  };
  const both = () => {
    p.hide();
    answer(null, `${ANSWER.bothReal} · ${orderNo(keep.id)} & ${orderNo(drop.id)}`, 'bothReal', [keep.id, drop.id], { undo: p.unhide, then: (_r, e) => { if (e) p.unhide(); } });
  };
  return (
    <div class="mg-orders-twin">
      <div class="h">
        <IconTile tone="warn" icon="copy" size={36} iconSize={18} />
        <div class="mid">
          <span class="t">{`${who} · ${money(drop.total)}`}</span>
          <span class="mono s">{pair}</span>
          {drop.paid > 0 && <span class="mono paid">{`${money(drop.paid)} paid`}</span>}
        </div>
        <div class="btns">
          <button type="button" class="mg-orders-btn navy h44" aria-expanded={open} aria-label={`Open: cancel ${orderNo(drop.id)}, keep ${orderNo(keep.id)} (a slide)`} onClick={() => setOpen(!open)}>
            <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} stroke={2.2} />Open
          </button>
          <button type="button" class="mg-orders-btn out h44" onClick={both}>{ANSWER.bothReal}</button>
        </div>
      </div>
      {open && (
        <NavyCard>
          <Slide label={`Cancel ${orderNo(drop.id)} · keep ${orderNo(keep.id)}`} onCommit={cancel} state={busy ? 'sending' : online.value ? 'ready' : 'offline'}
            offlineLabel="Cancel needs signal" onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />
        </NavyCard>
      )}
    </div>
  );
}

function ItselfRow(p: { o: MOrder; t: number }): JSX.Element {
  const { o, t } = p;
  const left = billsIn(o, t);
  const day = o.deliveredAt != null ? (dayOf(o.deliveredAt) === dayOf(t) ? 'Today' : weekday(o.deliveredAt)) : '';
  return (
    <button type="button" class="mg-orders-itself" onClick={() => nav.push('orders/order', { id: o.id })}>
      <Ring left={left / BILL_AFTER_MS} />
      <span class="mid">
        <span class="nm"><span class="no mono">{orderNo(o.id)}</span><span class="cu">{o.customerName}</span></span>
        <span class="mono s">{[o.deliveredAt != null ? `${day} ${hm(o.deliveredAt)}` : '', o.driver || ''].filter(Boolean).join(' · ')}</span>
      </span>
      <span class="end"><span class="mono tot">{money(o.total)}</span><span class="mono in">{inWords(left)}</span></span>
    </button>
  );
}

export function ToBill(): JSX.Element | null {
  const b = books.value;
  const [hidden, setHidden] = useState<string[]>([]);
  if (!b) return null;
  const t = now.value, x = toBill(b, waiting.value);
  const tw = x.twins.filter((w) => !hidden.includes(`${w.keep.id}:${w.drop.id}`));
  const count = x.cant.length + tw.length + x.itself.length;
  const wait = x.waitSum - x.twins.filter((w) => !tw.includes(w)).reduce((s, w) => s + w.drop.total, 0);
  const sum = x.itselfSum + wait;
  return (
    <main class="mg-orders">
      <PageHead title="To bill" count={count} onBack={() => nav.back()}>
        <div class="mg-orders-billhead">
          <span class="fig"><span class="mono">{money(sum)}</span><span class="u">UGX</span></span>
          <div class="split" aria-hidden="true"><i class="a" style={{ width: `${sum ? (x.itselfSum / sum) * 100 : 0}%` }} /><i class="b" /></div>
          <div class="leg"><span class="a">Bills itself · <span class="mono">{money(x.itselfSum)}</span></span><span>Wait on you · <span class="mono">{money(wait)}</span></span></div>
        </div>
      </PageHead>
      <div class="mg-orders-body">
        {!count && <Empty />}
        {x.cant.length > 0 && <H2 title="Can't bill itself" count={x.cant.length} />}
        {x.cant.map((c) => <CantRow key={c.a.key} a={c.a} o={c.o} b={b} />)}
        {tw.length > 0 && <H2 title="Taken twice?" count={tw.length} />}
        {tw.map((w) => {
          const k = `${w.keep.id}:${w.drop.id}`;
          return <TwinCard key={k} keep={w.keep} drop={w.drop} hide={() => setHidden((h) => [...h, k])} unhide={() => setHidden((h) => h.filter((y) => y !== k))} />;
        })}
        {x.itself.length > 0 && <H2 title="Bills itself" count={x.itself.length} right="24 h after delivery" />}
        {x.itself.map((o) => <ItselfRow key={o.id} o={o} t={t} />)}
      </div>
    </main>
  );
}
