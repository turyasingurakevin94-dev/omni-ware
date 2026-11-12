/*
 * After the check-in (route `in/checkin`): IN06 Checked in (the navy end screen: where each line
 * went, what waits on Ruth), IN09 someone else checked it in first (Refreshed; yours not sent), and
 * IN13 Ruth's answer to a line not on the list (keep it on the shelf, or send it back).
 */
import { orderFace, personFace } from '../../../core/store/faces.ts';
import { Fragment, type JSX } from 'preact';
import { orderNo, firstWord } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import { draftOf, groupsOf, toCount, type CheckTrip, type Draft, type outcome } from '../../../core/store/checkin.ts';
import type { StoreAsk, YardBooks, YardPerson } from '../../../core/store/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { ItemArt } from '../../../ui/ItemArt.tsx';
import { nav } from '../shell/nav.ts';
import { books } from '../shell/store.ts';
import { GoneRow, LineRow } from './CheckLines.tsx';
import { sellerOf, tellsOf } from './Checkin.tsx';
import { BackToToday, byLogin, byRole, Card, Done, DoneWho, GroupHead, HeadPill, NavyChip, Pill, Screen, Sees, TripHead } from './parts.tsx';

export interface Sent { t: CheckTrip; draft: Draft; out: ReturnType<typeof outcome>; at: number; denis: YardPerson | null; ruth: YardPerson | null }

/** IN06: Checked in, where it went; Undo while the check-in waits its 10 s. */
export function CheckedIn(p: { sent: Sent; undo?: () => void }): JSX.Element {
  const b = books.value as YardBooks, { t, out } = p.sent, denis = firstWord(p.sent.denis ? p.sent.denis.name : 'The Buyer');
  const ruthName = firstWord(p.sent.ruth ? p.sent.ruth.name : 'Ruth'), n = toCount(t).length;
  return (
    <Done title="Checked in" undo={p.undo}
      who={<DoneWho lead={<Avatar {...personFace(p.sent.denis)} size={30} />} name={`${denis}'s trip`} sub={`${n} ${n === 1 ? 'line' : 'lines'} · ${clock(p.sent.at)}`} />}
      chips={<>
        {out.differs.length > 0 && <NavyChip tone="amber" face={personFace(p.sent.ruth)}>{`Sent to ${ruthName} · ${out.differs.length} differs`}</NavyChip>}
        <NavyChip tone="mint" face={personFace(p.sent.denis)}>{`${denis} told`}</NavyChip>
      </>}>
      <div class="in-dcard">
        <span class="in-dcard-h">Where it went</span>
        {out.orders.map((o) => {
          const seller = sellerOf(b, [o.orderId]);
          return (
            <button key={o.orderId} type="button" class="in-drow" onClick={() => (o.allIn ? nav.push('pack/order', { id: o.orderId }) : nav.push('pack'))}>
              <Avatar {...orderFace(o.order || { client: { name: '', phone: '' }, customerId: null }, b)} size={32} />
              <span class="in-line-t">
                <span>{o.allIn ? `${orderNo(o.orderId)} · pack it now` : `${orderNo(o.orderId)} ${o.order ? o.order.client.name : ''}`}</span>
                <span class={o.allIn ? 'mint' : 'amber'}>{o.allIn ? `all in · ${seller} told` : `pack ${o.got} of ${o.want} · ${seller} told`}</span>
              </span>
              <span class="in-dpill"><Icon name="orders" size={12} stroke={2.2} />Packing</span>
            </button>
          );
        })}
        {t.lines.filter((l) => l.notFound).map((l) => (
          <div key={l.id} class="in-drow">
            <span aria-hidden="true" class="in-dx"><Icon name="close" size={14} stroke={2.6} /></span>
            <span class="in-line-t"><span>{`${l.name.split(' · ')[0]} · ${l.asked} ${l.unit}`}</span><span>{`not found · ${tellsOf(b, l)}`}</span></span>
          </div>
        ))}
        {out.differs.map((d) => (
          <button key={d.line.id} type="button" class="in-drow" onClick={() => nav.push('today/with-ruth')}>
            <Avatar {...personFace(p.sent.ruth)} size={32} />
            <span class="in-line-t"><span>{`${ruthName} decides the ${Math.abs(d.diff)} ${d.line.unit}`}</span><span>you get a push when she does</span></span>
            <span class="in-dpill amber"><Icon name="hourglass" size={12} stroke={2.2} />Waiting</span>
          </button>
        ))}
      </div>
    </Done>
  );
}

/** IN09: someone else checked it in; the books are on screen now, this phone's count was not sent. */
export function SomeoneDid(p: { t: CheckTrip; mine: boolean }): JSX.Element {
  const b = books.value as YardBooks, { t } = p, runner = b.people.find((x) => x.id === t.runnerId) || null, denis = firstWord(runner ? runner.name : 'The Buyer');
  const who = byLogin(b, t.checkedBy), byMe = !!who && who.id === b.me.id, d = draftOf(t), n = toCount(t).length;
  const moved = [...new Set(t.lines.map((l) => l.orderId).filter((x): x is number => x != null))].filter((id) => { const o = b.orders.find((x) => x.id === id); return o && o.status === 'preparing'; });
  const seller = sellerOf(b, moved), sellerP = b.people.find((x) => x.role === 'sales' && firstWord(x.name) === seller) || null;
  return (
    <Screen pad="14px 16px 20px" head={
      <TripHead lead={<Avatar {...personFace(runner)} size={44} />} name={`${denis}'s trip`} sub={`checked in ${clock(t.checkedAt as number)} · ${n} ${n === 1 ? 'line' : 'lines'}`}
        onClose={() => nav.to('today')} closeLabel="Close: back to Today" chips={<HeadPill face={personFace(runner)}>{`From ${denis} · Buyer`}</HeadPill>} />}>
      {p.mine && !byMe && <div role="status" class="in-someone"><Icon name="undo" size={18} stroke={2} /><span class="in-flex">Someone else just did this · Refreshed</span></div>}
      <div class="in-who">
        <Avatar {...personFace(who)} size={40} />
        <span class="in-who-t"><span>{byMe ? 'You checked it in' : `${firstWord(who ? who.name : 'Someone')} checked it in`}</span><span class="mono">{`${clock(t.checkedAt as number)}${p.mine && !byMe ? ' · yours not sent' : ''}`}</span></span>
        <Pill tone="good" icon="check" size={11} stroke={3.2}>Checked in</Pill>
      </div>
      {groupsOf(t, b.orders).map((g) => (
        <Fragment key={String(g.orderId)}>
          <GroupHead face={g.order ? orderFace(g.order, b) : undefined} icon={g.order ? undefined : 'rack'} title={g.order ? `${orderNo(g.order.id)} ${g.order.client.name}` : 'The shelf'}
            right={g.order && g.order.status === 'preparing' ? <Pill tone="info" icon="orders">Packing</Pill> : undefined} />
          <Card>
            {g.lines.map((l) => (l.notFound ? <GoneRow key={l.id} l={l} tells={tellsOf(b, l)} />
              : <LineRow key={l.id} l={l} count={d.counts[l.id]} who={personFace(who)} label={`Checked in by ${firstWord(who ? who.name : 'someone')}`}
                sub={`${d.counts[l.id]} ${l.unit}${(l.yard ?? l.expected) !== l.expected && !t.stops.some((s) => s.differenceAcceptedAt) ? ` · with ${firstWord((byRole(b, 'manager') || { name: 'Ruth' }).name)}` : ''}`} />))}
          </Card>
        </Fragment>
      ))}
      {moved.length > 0 && (
        <div class="in-card in-card16 in-told">
          <span class="in-told-h">Already told</span>
          <Sees light face={personFace(sellerP)} who={seller} what={`${moved.map(orderNo).join(' · ')} → Packing`} />
        </div>
      )}
      <BackToToday />
    </Screen>
  );
}

/** IN13: Ruth answered a line not on the list. */
export function Answered(p: { t: CheckTrip; ask: StoreAsk }): JSX.Element {
  const b = books.value as YardBooks, a = p.ask, x = a.payload as Record<string, unknown>;
  const runner = b.people.find((q) => q.id === p.t.runnerId) || null, denis = firstWord(runner ? runner.name : 'The Buyer');
  const ruth = byRole(b, 'manager'), ruthName = firstWord(ruth ? ruth.name : 'Ruth'), esther = byRole(b, 'accounts');
  const name = String(x.name || ''), qty = Number(x.qty || 0), unit = String(x.unit || ''), keep = a.status === 'accepted';
  const it = b.items.find((i) => i.key === x.key), aisle = it && it.category ? it.category : '', letter = aisle ? String.fromCharCode(65 + Math.max(0, b.aisles.indexOf(aisle))) : '';
  const stop = p.t.stops.find((s) => s.id === a.ref) || p.t.stops[p.t.stops.length - 1], supplier = stop.supplierName.split(' ')[0];
  const at = a.decidedAt ? clock(a.decidedAt) : '';
  return (
    <Screen pad="14px 16px 20px" gap={12} head={
      <TripHead lead={<Avatar {...personFace(runner)} size={44} />} name={`${denis}'s trip · not on the list`} sub={`${ruthName} answered ${at}`} onClose={() => nav.home()}
        chips={<HeadPill face={personFace(ruth)}>{`From ${ruthName} · Manager`}</HeadPill>} />}>
      <Card>
        <div class="in-line">
          <ItemArt name={name} size={40} />
          <span class="in-line-t"><span>{name}</span><span class="mono">{`${qty} ${unit} · ${String(x.why || '').toLowerCase()} · asked ${clock(a.createdAt)}`}</span></span>
        </div>
      </Card>
      <div class="in-card in-card16 in-ans">
        <div class="in-ans-h">
          <Avatar {...personFace(ruth)} size={40} />
          <span class="in-who-t"><span>{`${ruthName}: ${keep ? 'keep it' : 'send it back'}`}</span><span class="mono">{`${at} · ${denis} told`}</span></span>
          <Pill tone="good" icon="check" size={11} stroke={3.2}>Decided</Pill>
        </div>
        <div class="in-ans-flow" role="img" aria-label={keep ? `${qty} ${unit} of ${name.toLowerCase()} goes to the shelf, aisle ${letter}` : `${qty} ${unit} goes back to ${stop.supplierName}`}>
          <ItemArt name={name} size={44} />
          <span class="mono in-ans-n">{qty}<span>{` ${unit}`}</span></span>
          <span class="in-ans-arrow"><i /><Icon name="chevron-right" size={14} stroke={2.4} /></span>
          {keep ? <span class="in-aisle"><span>{letter}</span>{aisle}</span> : <span class="in-aisle">{stop.supplierName}</span>}
        </div>
      </div>
      <div class="in-choice">
        <div class={keep ? 'on' : ''}><Icon name="rack" size={20} stroke={2} /><span>Keep it · the shelf</span><span>{keep ? `${ruthName} chose this` : 'not chosen'}</span></div>
        <div class={keep ? '' : 'on'}><Icon name="return" size={20} stroke={2} /><span>{`Send it back · ${supplier}`}</span><span>{keep ? 'not chosen' : `${ruthName} chose this`}</span></div>
      </div>
      {keep && (
        <div class="in-card in-card16 in-shelfto" role="img" aria-label={`Plus ${qty} ${unit} on the shelf, aisle ${letter} ${aisle}`}>
          <span aria-hidden="true" class="in-letter">{letter}</span>
          <span class="in-line-t"><span>{`On the shelf · aisle ${letter} · ${aisle}`}</span><span>{`put it with the ${name.replace(/\s*\d.*$/, '').toLowerCase()}`}</span></span>
          <span class="mono in-plus">{`+${qty}`}</span>
        </div>
      )}
      <div class="in-card in-card16 in-told">
        <span class="in-told-h">Told</span>
        <Sees light face={personFace(runner)} who={denis} what={keep ? 'Kept · on the shelf' : 'Sent back'} />
        {keep && <Sees light face={personFace(esther)} who={firstWord(esther ? esther.name : 'Accounts')} what={`pays ${supplier} for it`} />}
      </div>
      <BackToToday />
    </Screen>
  );
}
