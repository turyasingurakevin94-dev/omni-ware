/*
 * Today's cards (board Today, phones 2 and 4).
 *
 *   <NextTrip/>     Next move: the trip the app proposes, its stops in route order with their cash, what is
 *                   held off it (Ruth decides · Asked; one chip per item and state), and who in Sales sees Found. No button: the red + is the way in.
 *   <AllClear/>     Nothing waits on you. After the hand-in: the orders the Store counts in (Packing shows
 *                   only after the count), and the shorts Sales was told of.
 *   <WaitingOn/>    Waiting on others: Ruth and the suppliers asked, faces and names (opens Replies).
 */
import type { JSX } from 'preact';
import { WORD, handIn, lineRefs, tripPlan } from '../../../core/buyer/rules.ts';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { orderNo } from '../../../core/names.ts';
import { TINTS } from '../../../core/names.ts';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { nav } from '../shell/nav.ts';
import { Chip, Dot, Sees } from './Rows.tsx';
import { firstName, hm, sellersOf, shortItem, type Waiter } from './rules.ts';
import './cards.css';

export function NextTrip(p: { b: BuyerBooks }): JSX.Element {
  const { b } = p, plan = tripPlan(b);
  const sup = (id: string) => b.suppliers.find((s) => s.id === id);
  const ruth = b.team.find((m) => m.role === 'manager');
  const found = lineRefs(b).filter((r) => r.state === 'found').map((r) => r.order);
  const who = sellersOf(b, [...new Set(found)]);
  const n = plan.stops.length;
  // One chip per item and state: "Iron sheet · Asked" once, though two orders wait on it.
  const held = plan.held.filter((r, i, all) => all.findIndex((x) => shortItem(x.line.name) === shortItem(r.line.name) && x.state === r.state) === i);
  return (
    <div class="ow-b-today-next" role="group" aria-label={`Next move: trip, ${n} stop${n === 1 ? '' : 's'}, cash ${fig(plan.cash)}. The red plus starts it.`}>
      <div class="ow-b-today-next-h">
        <span aria-hidden="true" class="ow-b-today-next-ic"><Icon name="truck" size={22} stroke={2} /></span>
        <div class="ow-b-today-next-t"><span>NEXT MOVE</span><span>{`Trip · ${n} stop${n === 1 ? '' : 's'}`}</span></div>
        <div class="ow-b-today-next-cash"><span>Cash</span><span class="mono">{fig(plan.cash)}</span></div>
      </div>
      <div class="ow-b-today-next-stops">
        {plan.stops.map((s, i) => (
          <div key={s.supplierId} class="ow-b-today-next-stop">
            <span aria-hidden="true" />
            <span><b class="mono">{i + 1}</b>{` ${sup(s.supplierId)?.place || ''}`}</span>
            <span class="mono">{fig(s.planned)}</span>
          </div>
        ))}
      </div>
      {held.length > 0 && (
        <div class="ow-b-today-next-held">
          <span>Held</span>
          {held.map((r) => r.state === 'priceup'
            ? <span key={`${r.order.id}-${r.line.key}`} class="ow-b-today-chip warn face"><Dot m={ruth} />{`${shortItem(r.line.name)} · ${ruth ? firstName(ruth) : 'Manager'} decides`}</span>
            : <span key={`${r.order.id}-${r.line.key}`} class="ow-b-today-chip neutral">{`${shortItem(r.line.name)} · ${WORD[r.state]}`}</span>)}
        </div>
      )}
      <Sees who={who} class="ow-b-today-next-sees"><Chip tone="good">{WORD.found}</Chip></Sees>
    </div>
  );
}

export function AllClear(p: { b: BuyerBooks }): JSX.Element {
  const { b } = p, t = b.trip && b.trip.state === 'in' ? b.trip : null;
  const h = t ? handIn(t, b) : null;
  const store = b.team.find((m) => m.role === 'store');
  const counting = h ? h.orders : [];
  const short = h && h.shorts[0];
  const shortWho = short ? b.team.find((m) => m.id === short.order.sellerId) : undefined;
  const st = store ? TINTS[store.tint] || TINTS.t4 : TINTS.t4;
  return (
    <div class="ow-b-today-clear">
      <div class="ow-b-today-clear-h">
        <span aria-hidden="true" class="ow-b-today-clear-ic"><Icon name="check" size={20} stroke={2.4} /></span>
        <div class="ow-b-today-clear-t">
          <span class="ow-b-today-clear-big">Nothing waits on you</span>
          {t && t.handedInAt != null && <span class="ow-b-today-clear-sub">Handed in · <span class="mono">{hm(t.handedInAt)}</span>{store ? ` · ${firstName(store)} counts it in` : ''}</span>}
        </div>
      </div>
      {counting.map((o) => (
        <div key={o.id} class="ow-b-today-clear-row">
          <Dot m={b.team.find((m) => m.id === o.sellerId)} />
          <span class="ow-b-today-clear-o"><span class="mono">{orderNo(o.id)}</span>{` · ${o.client}`}</span>
          {store && <i class="ow-b-today-clear-face" aria-label={`${firstName(store)} counts it in`} style={{ background: st.bg, color: st.fg }}>{store.initials}</i>}
          <span class="ow-b-today-clear-pack">Packing</span>
        </div>
      ))}
      {short && shortWho && (
        <Sees who={[shortWho]} class="ow-b-today-clear-sees">
          <Chip tone="warn" icon="bell">Short · got <span class="mono">{short.got}</span> of <span class="mono">{short.line.qty}</span></Chip>
          <span class="mono ow-b-today-clear-no">{orderNo(short.order.id)}</span>
        </Sees>
      )}
    </div>
  );
}

export function WaitingOn(p: { list: Waiter[] }): JSX.Element {
  const l = p.list;
  return (
    <button type="button" class="ow-b-today-wait" aria-label={`Waiting on others: ${l.length}. Open Replies.`} onClick={() => nav.push('replies')}>
      <span aria-hidden="true" class="ow-b-today-wait-faces">
        {l.slice(0, 3).map((w) => {
          const t = w.person ? TINTS[w.person.tint] || TINTS.t4 : null;
          return <i key={w.key} class={w.person ? 'p' : 's'} style={t ? { background: t.bg, color: t.fg } : undefined}>{w.initials}</i>;
        })}
      </span>
      <span class="ow-b-today-wait-t"><b>Waiting on others · <span class="mono">{l.length}</span></b><span>{l.map((w) => w.name).join(' · ')}</span></span>
      <Icon name="chevron-right" size={18} stroke={2.2} />
    </button>
  );
}
