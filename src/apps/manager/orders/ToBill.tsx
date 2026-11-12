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
import type { WriteName } from '../../../core/manager/source.ts';
import type { Ask, ManagerBooks, MOrder } from '../../../core/manager/types.ts';
import { BILL_AFTER_MS, billsIn, inWords } from '../../../core/manager/watch.ts';
import { AFTER_WORDS, ANSWER, askWord, heldWord, hm } from '../../../core/manager/words.ts';
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
import { act, books, now, online, waiting } from '../shell/store.ts';
import { Strip } from './Strip.tsx';
import { useInPlace, useKept } from './useAnswer.ts';
import { Empty, H2, Ring, Spinner, Told } from './Bits.tsx';
import './orders.css';

function CantRow(p: { a: Ask; o: MOrder; b: ManagerBooks; keep: () => void }): JSX.Element {
  const { a, o, b } = p;
  const spot = useInPlace(true);
  const say = (label: string, kind: WriteName, args: unknown[]) => { p.keep(); spot.go(`${label} · ${orderNo(o.id)}`, kind, args, a.key); };
  const seller = b.team.find((x) => x.id === o.sellerId) || null;
  const safe = safePrice(b, a);
  const open = () => nav.push('decide', { id: a.key });
  const noCost = !!safe && safe.price == null;
  const why = a.kind === 'bill' ? heldWord(a.code, o.total) : askWord(a.kind, a.kind === 'price' ? a.mode : undefined);
  const who = seller ? firstWord(seller.name) : '';
  const by = buyer(b);
  let btn: JSX.Element;
  if (a.kind === 'bill' && a.code === 'OWSML') {
    btn = <button type="button" class="mg-orders-btn navy" onClick={() => say(`${AFTER_WORDS.invoiced} · ${money(o.total)}`, 'billSmall', [o.id])}>{ANSWER.billIt}</button>;
  } else if (safe && safe.price != null && (a.kind === 'price' || a.kind === 'counter')) {
    const price = safe.price;
    btn = <button type="button" class="mg-orders-btn navy" onClick={() => say(`${safe.say} · ${money(price)}`, 'price', [o.id, a.idx, price, safe.word])}>{`${safe.say} · ${money(price)}`}</button>;
  } else if (noCost) {
    btn = <button type="button" class="mg-orders-btn off" aria-disabled="true" onClick={open}><Icon name="lock" size={16} stroke={2} />Set price</button>;
  } else {
    btn = <button type="button" class="mg-orders-btn navy" onClick={open}><Icon name="chevron-right" size={16} stroke={2.2} />Open</button>;
  }
  const told = a.kind === 'bill' ? AFTER_WORDS.invoiced : safe ? safe.say : '';
  if (spot.st !== 'idle') {
    return (
      <div class="mg-orders-done">
        <div class="mg-orders-row">
          {seller && <Avatar initials={seller.initials} tint={seller.tint} size={36} font={13} />}
          <div class="mid"><span class="cu">{o.customerName}</span><span class="mono s">{[orderNo(o.id), who].filter(Boolean).join(' · ')}</span></div>
        </div>
        {spot.st === 'sending' ? <span class="mg-orders-waits"><Spinner dark />Sending…</span> : <Strip spot={spot} what={`${told} · ${orderNo(o.id)}`} />}
        {seller && told && (spot.st === 'held' || spot.st === 'done') && <Told card face={seller} who={`${who} sees`} word={told} />}
      </div>
    );
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

function TwinCard(p: { keep: MOrder; drop: MOrder; hold: () => void }): JSX.Element {
  const { keep, drop } = p;
  const spot = useInPlace(true);
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
        <div class="mg-orders-locked"><Slide label="Billed first · ask for a void" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Billed first · ask for a void', quiet: true }} /></div>
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
  const both = () => { p.hold(); spot.go(`${ANSWER.bothReal} · ${orderNo(keep.id)} & ${orderNo(drop.id)}`, 'bothReal', [keep.id, drop.id]); };
  if (spot.st !== 'idle' && spot.st !== 'sending') {
    return (
      <div class="mg-orders-twin">
        <div class="h"><IconTile tone="neutral" icon="copy" size={36} iconSize={18} /><div class="mid"><span class="t">{`${who} · ${money(drop.total)}`}</span><span class="mono s">{pair}</span></div></div>
        <Strip spot={spot} what={`${ANSWER.bothReal} · ${pair}`} />
      </div>
    );
  }
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
          <button type="button" class="mg-orders-btn out h44" aria-disabled={spot.st === 'sending' ? 'true' : undefined} onClick={() => { if (spot.st === 'idle') both(); }}>{ANSWER.bothReal}</button>
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
  const x = b ? toBill(b, waiting.value) : null;
  const cant = useKept(x ? x.cant.map((c) => ({ key: c.a.key, v: c })) : []);
  const tw = useKept(x ? x.twins.map((w) => ({ key: `${w.keep.id}:${w.drop.id}`, v: w })) : []);
  if (!b || !x) return null;
  const t = now.value;
  const count = x.cant.length + x.twins.length + x.itself.length;
  const sum = x.itselfSum + x.waitSum;
  return (
    <main class="mg-orders">
      <PageHead title="To bill" count={count} onBack={() => nav.back()}>
        <div class="mg-orders-billhead">
          <span class="fig"><span class="mono">{money(sum)}</span><span class="u">UGX</span></span>
          <div class="split" aria-hidden="true"><i class="a" style={{ width: `${sum ? (x.itselfSum / sum) * 100 : 0}%` }} /><i class="b" /></div>
          <div class="leg"><span class="a">Bills itself · <span class="mono">{money(x.itselfSum)}</span></span><span>Wait on you · <span class="mono">{money(x.waitSum)}</span></span></div>
        </div>
      </PageHead>
      <div class="mg-orders-body">
        {!count && !cant.rows.length && !tw.rows.length && <Empty />}
        {cant.rows.length > 0 && <H2 title="Can't bill itself" count={x.cant.length} />}
        {cant.rows.map((r) => <CantRow key={r.key} a={r.v.a} o={r.v.o} b={b} keep={() => cant.keep(r.key, r.v)} />)}
        {tw.rows.length > 0 && <H2 title="Taken twice?" count={x.twins.length} />}
        {tw.rows.map((r) => <TwinCard key={r.key} keep={r.v.keep} drop={r.v.drop} hold={() => tw.keep(r.key, r.v)} />)}
        {x.itself.length > 0 && <H2 title="Bills itself" count={x.itself.length} right="24 h after delivery" />}
        {x.itself.map((o) => <ItselfRow key={o.id} o={o} t={t} />)}
      </div>
    </main>
  );
}
