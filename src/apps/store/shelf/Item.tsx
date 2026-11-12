/*
 * shelf/item · SH03 (default), SH16 Ruth accepted your count, SH22 Ruth wrote it off, SH24 Ruth kept it,
 * SH32 Denis answered the ask.
 *
 *   the head      the item, "412 pc on shelf" (the figure Sales sees, "Sales sees 412"), a block per bundle or
 *                 carton, what is packed apart; due for a count: "Count due" and no figure (blind)
 *   the news      what Ruth or Denis just decided, or damage found and not reported yet (Report)
 *   Packed        the orders it left the shelf for, still in the yard
 *   What moved    four weeks (shelf.ts moved)
 *   the acts      Count · Report · We need more
 */
import { orderFace } from '../../../core/store/faces.ts';
import type { ComponentChildren, JSX } from 'preact';
import { orderNo } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import { countDue, recountOf } from '../../../core/store/counts.ts';
import { aislesOf, lastDecided, letterOf, lookOf, moved, onShelf, packedFor } from '../../../core/store/shelf.ts';
import { askedFor } from '../../../core/store/restock.ts';
import type { ShelfItem, YardBooks, YardPerson } from '../../../core/store/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { cx, Tap } from '../../../ui/util.tsx';
import { backTo, nav, type Params } from '../shell/nav.ts';
import { books, now } from '../shell/store.ts';
import { foundFor } from './found.ts';
import { GroupHead, ItemHead, ItemSheet, Moved, Nums, ShelfActs, soldBy } from './parts.tsx';
import './item.css';

const RECENT = 2 * 3600e3;
export const person = (b: YardBooks, role: string, fallback: string): YardPerson =>
  b.people.find((p) => p.role === role) || { id: role, userId: null, name: fallback, initials: fallback.slice(0, 2).toUpperCase(), tint: 't4', role: 'store', away: false, phone: '' };

/** What was just decided about this item (the news card), or null. */
function news(b: YardBooks, it: ShelfItem, at: number) {
  const c = lastDecided(b, it.key);
  if (c && c.count.status === 'accepted' && c.count.countedBy === b.me.userId && c.count.decidedAt != null && at - c.count.decidedAt < RECENT) return { kind: 'count' as const, old: c.line.system, line: c.line };
  const r = b.reports.filter((x) => x.key === it.key && x.decidedAt != null && at - x.decidedAt < RECENT).sort((x, y) => (y.decidedAt || 0) - (x.decidedAt || 0))[0];
  if (r) return { kind: r.status === 'written_off' ? 'off' as const : 'kept' as const, r };
  const a = askedFor(b, it.key);
  if (a && a.status === 'accepted' && a.decidedAt != null && at - a.decidedAt < RECENT) return { kind: 'ask' as const, a };
  return null;
}

/** The head's picture: the figure, Sales sees it (or Low), the blocks, the legend. */
function Picture(p: { b: YardBooks; it: ShelfItem; at: number; n: ReturnType<typeof news> }): JSX.Element {
  const { b, it, at, n } = p, shelf = onShelf(b, it.key), due = countDue(it, b, at) || !!recountOf(b, it.key);
  const grace = person(b, 'sales', 'Grace Akello'), packed = n && n.kind === 'count' ? [] : packedFor(b, it.key), pk = packed.reduce((s, x) => s + x.qty, 0);
  const low = lookOf(b, it, at) === 'low', ask = n && n.kind === 'ask' ? Number(n.a.payload.qty) || 0 : 0;
  const old = n && n.kind === 'count' ? n.old : n && n.kind === 'off' ? shelf + n.r.qty : null;
  if (due) {
    return <div class="sh-pict"><div class="sh-pict-r"><span class="sh-pict-n"><span class="sh-pict-due"><Icon name="blind" size={20} stroke={2} />Count due</span><span>no figure until it is counted</span></span></div></div>;
  }
  const per = it.packQty > 1 ? it.packQty : 1, full = Math.floor(shelf / per), part = (shelf % per) / per;
  // Just written off (SH22): the pieces gone, red, above what is left in the last bundle.
  const offPart = n && n.kind === 'off' && per > 1 ? Math.min(n.r.qty / per, 1 - part) : 0;
  const blocks = per > 1 || shelf + ask + (old && old > shelf ? old - shelf : 0) <= 24;
  const label = per > 1 ? `${shelf} pieces on the shelf: ${full} ${it.packUnit}s of ${per} and ${shelf % per} loose.${pk ? ` ${pk} more packed for order ${packed.map((x) => x.order.id).join(', ')}.` : ''}`
    : `${shelf} ${it.unit} on the shelf${old != null ? `; the shelf had ${old}` : ''}${ask ? `, about ${ask} more on the next trip` : ''}`;
  return (
    <div role="img" aria-label={label} class="sh-pict">
      <div class={cx('sh-pict-r', low && 'low')}>
        <span class="sh-pict-n">{old != null && <s class="mono">{old}</s>}<span class="mono">{shelf}</span><span>{`${it.unit} on shelf`}</span></span>
        {low ? <span class="sh-pict-low">Low</span>
          : <span class="sh-pict-sales"><Avatar initials={grace.initials} tint="me" size={22} font={11} />Sales sees <b class="mono">{shelf}</b></span>}
      </div>
      {blocks && (
        <span aria-hidden="true" class={cx('sh-blocks', ask > 0 && 'big')}>
          {Array.from({ length: per > 1 ? full : shelf }, (_, i) => <span key={i} class="f" />)}
          {per > 1 && (part > 0 || offPart > 0) && <span class="part"><span style={{ height: `${Math.round(part * 100)}%` }} />{offPart > 0 && <span class="off" style={{ bottom: `${Math.round(part * 100)}%`, height: `${Math.round(offPart * 100)}%` }} />}</span>}
          {old != null && old > shelf && per === 1 && Array.from({ length: old - shelf }, (_, i) => <span key={'g' + i} class="gone" />)}
          {Array.from({ length: per === 1 ? ask : 0 }, (_, i) => <span key={'a' + i} class="come" />)}
          {pk > 0 && <><span class="gap" />{Array.from({ length: Math.ceil(pk / per) }, (_, i) => <span key={'p' + i} class="pk" />)}</>}
        </span>
      )}
      <span class="sh-legend">
        {per > 1 ? <span><i class="w" />{`${it.packUnit}s of ${per} · `}<b class="mono">{`${full} + ${shelf % per}`}</b></span>
          : <span>{ask ? 'on the shelf' : `one block = one ${it.unit === 'ctn' ? 'carton' : it.unit}`}</span>}
        {pk > 0 && <span><i class="b" />{`packed for ${packed.map((x) => orderNo(x.order.id)).join(', ')} · `}<b class="mono">{pk}</b></span>}
        {old != null && old > shelf && per === 1 && <span class="red">{`${old - shelf} not found`}</span>}
        {ask > 0 && <span class="mint">{`about ${ask} on the next trip`}</span>}
      </span>
    </div>
  );
}

function Banner(p: { tone: 'good' | 'info'; who: YardPerson; title: string; sub: ComponentChildren }): JSX.Element {
  return (
    <div role="status" class={cx('sh-news', p.tone)}>
      <span class="sh-news-f"><Avatar initials={p.who.initials} tint={p.who.tint} size={38} font={13} /><span aria-hidden="true"><Icon name="check" size={11} stroke={3} /></span></span>
      <span class="sh-news-t"><span>{p.title}</span><span>{p.sub}</span></span>
    </div>
  );
}

/** The item's sheet; `bare` draws only the head (the screen under We need more, SH30). */
export function ItemView(p: { it: ShelfItem; bare?: boolean }): JSX.Element {
  const b = books.value as YardBooks, at = now.value, it = p.it, n = news(b, it, at), ruth = person(b, 'manager', 'Ruth Nakato');
  const found = foundFor(it.key), packed = n && n.kind === 'count' ? [] : packedFor(b, it.key), shelf = onShelf(b, it.key);
  const sub = `${letterOf(b, it.category) || '?'} · ${it.category || 'No aisle yet'} · ${soldBy(it)}`;
  const close = () => nav.to('shelf'), back = () => nav.back();
  const aisle = aislesOf(b, at).find((a) => a.name === it.category);
  // The rest of the aisle: every other item in it, as the aisle count takes them all (SH16: 132 − this one).
  const rest = aisle && aisle.due ? aisle.items.filter((x) => x.key !== it.key).length : 0;
  const head = <ItemHead it={it} sub={sub} onClose={close}><Picture b={b} it={it} at={at} n={n} /></ItemHead>;
  if (p.bare) return <ItemSheet back={back} backLabel={backTo.value} head={<ItemHead it={it} sub={sub} onClose={close} />} body="count">{null}</ItemSheet>;
  const joseph = b.people.find((x) => x.role === 'owner'), grace = person(b, 'sales', 'Grace Akello'), denis = person(b, 'buyer', 'Denis Okello');
  return (
    <ItemSheet back={back} backLabel={backTo.value} head={head}>
      {n && n.kind === 'count' && <Banner tone="good" who={ruth} title={`${ruth.name.split(' ')[0]} accepted your count`} sub={<>just now · the shelf takes your <Nums text={`${n.line.counted} ${it.unit}`} /></>} />}
      {n && n.kind === 'off' && <Banner tone="good" who={ruth} title={`${ruth.name.split(' ')[0]} wrote off ${n.r.qty} ${it.unit} · ${n.r.note || n.r.why}`} sub={<>just now · the shelf moved <Nums text={`${shelf + n.r.qty} → ${shelf}`} /></>} />}
      {n && n.kind === 'kept' && <Banner tone="info" who={ruth} title={`${ruth.name.split(' ')[0]} kept the ${n.r.qty} on the shelf`} sub={<>just now · the shelf stays <Nums text={String(shelf)} /> · put them back</>} />}
      {n && n.kind === 'ask' && (
        <>
          <Banner tone="info" who={denis} title={`${denis.name.split(' ')[0]}: ${String(n.a.payload.answer || 'On the restock list')}`} sub={<>just now · your ask of <Nums text={clock(n.a.createdAt)} /> · about {`${n.a.payload.qty} ${n.a.payload.unit}`}</>} />
          <div class="sh-info"><span aria-hidden="true"><Icon name="truck" size={20} stroke={1.9} /></span><span><span>You check it in when it's back at the yard</span><span>the trip after this one · Coming in shows it</span></span></div>
        </>
      )}
      {found && (
        <Tap on={() => nav.push('shelf/report', { key: it.key })} class="sh-found" label={`${found.qty} ${it.unit} ${found.note} · not reported. Report`}>
          <span aria-hidden="true"><Icon name="warning" size={19} stroke={2} /></span>
          <span><span>{`${found.qty} ${it.unit} ${found.note} · not reported`}</span><span>found <span class="mono">{clock(found.at)}</span>{found.orderId ? ` · packing ${orderNo(found.orderId)}` : ''}</span></span>
          <span class="sh-found-b">Report</span>
        </Tap>
      )}
      {packed.length > 0 && (
        <>
          <div class="sh-gap2" />
          <GroupHead dot="#8DA2D6" title="Packed · left the shelf" />
          <div class="sh-card">
            {packed.map((x) => {
              const log = b.log.find((r) => r.key === it.key && r.note.includes(orderNo(x.order.id)));
              const when = log ? clock(log.at) : x.order.pickingDoneAt ? clock(x.order.pickingDoneAt) : '';
              return (
                <Tap key={x.order.id} on={() => nav.push(x.order.pickingStatus === 'done' ? 'out/load' : 'pack/order', x.order.pickingStatus === 'done' ? {} : { id: x.order.id })} class="sh-pk" label={`${x.order.client.name}, ${orderNo(x.order.id)}`}>
                  <Avatar {...orderFace(x.order, b)} size={34} font={12} />
                  <span class="sh-pk-t"><span>{x.order.client.name}</span><span class="mono">{[orderNo(x.order.id), when, x.bay ? `bay ${x.bay}` : ''].filter(Boolean).join(' · ')}</span></span>
                  <span class="sh-pk-q mono">{`${x.qty} ${it.unit}`}</span>
                  <span aria-hidden="true" class="sh-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
                </Tap>
              );
            })}
          </div>
        </>
      )}
      <div class="sh-gap2" />
      <GroupHead dot="#5F6980" title="What moved" meta="4 weeks" />
      <Moved rows={moved(b, it.key, at)} now={at} ruth={ruth.name.split(' ')[0]} max={n && n.kind === 'ask' ? 3 : 4} />
      {n && n.kind === 'count' && joseph && <div class="sh-line"><Avatar initials={joseph.initials} tint={joseph.tint} size={22} font={11} />{`${joseph.name.split(' ')[0]} sees it in the log`}</div>}
      {n && n.kind === 'count' && aisle && rest > 0 && (
        <Tap on={() => nav.push('shelf/count', { aisle: aisle.name })} class="sh-rest" label={`Rest of aisle ${aisle.letter}: count`}>
          <span aria-hidden="true"><Icon name="clock" size={18} stroke={2} /></span>
          <span><span>{`Rest of aisle ${aisle.letter}`}</span><span><span class="mono">{rest}</span> items · count due</span></span>
          <span class="sh-found-b">Count</span>
        </Tap>
      )}
      {lookOf(b, it, at) === 'low' && <div class="sh-line"><Avatar initials={grace.initials} tint="me" size={22} font={11} />Sales sees <b class="mono">{`${shelf} on shelf`}</b> · Order in for more</div>}
      <div class="sh-acts"><ShelfActs onCount={() => nav.push('shelf/count', { key: it.key })} onReport={() => nav.push('shelf/report', { key: it.key })} onMore={() => nav.push('shelf/ask', { key: it.key })} /></div>
    </ItemSheet>
  );
}

export function Item(p: { params: Params }): JSX.Element {
  const b = books.value, it = b ? b.items.find((x) => x.key === String(p.params.key)) : null;
  if (!b) return <main class="sh-wait" aria-busy="true" />;
  if (!it) return <main class="sh-wait"><p class="sh-gone">That item is not on the list any more.</p></main>;
  return <ItemView it={it} />;
}
