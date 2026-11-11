/*
 * To pack with nothing to pack (store-agent PK14, P24): a ghost of the rows to come with the
 * box floating over it, one line of words, then what the yard can do instead: check in the trip
 * on its way, To load, At the gate, and the next order to pack once its goods are in.
 */
import type { JSX } from 'preact';
import { firstWord, orderNo } from '../../../core/names.ts';
import { roundsOf } from '../../../core/store/keys.ts';
import { destinationOf, ordersAt } from '../../../core/store/yard.ts';
import { clock } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { StatusPill } from '../../../ui/Pill.tsx';
import { Tap } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { books, me, now } from '../shell/store.ts';
import type { Sheet } from './sheet-data.ts';

export function ToPackEmpty(p: { s: Sheet }): JSX.Element {
  const b = books.value, s = p.s;
  if (!b) return <></>;
  const round = roundsOf(b.trips.filter((t) => !t.voided && !t.yardCheckedAt && t.runnerId !== '__supplier__'))[0];
  const runner = round ? b.people.find((x) => x.id === round[0].runnerId) : null;
  const due = round ? round.map((t) => t.dueAt).find((x) => x != null) : null;
  const packed = ordersAt(b, 'packed', me.value, now.value), ready = ordersAt(b, 'ready', me.value, now.value);
  const next = s.waiting[0];
  const firstTo = packed[0] ? destinationOf(packed[0], b.customers) : null;
  return (
    <>
      <div aria-hidden="true" class="pk-card pk-ghost">
        {[1, 0.7, 0.4].map((op) => <div key={op} style={{ opacity: op }}><span /><span><i /><i /></span><span /></div>)}
        <span class="pk-ghost-fade" />
        <span class="pk-ghost-box"><Icon name="orders" size={38} stroke={1.8} /></span>
      </div>
      <div class="pk-empty-t"><b>Nothing to pack</b><span>New orders from Sales land here, with a push</span></div>
      {round && runner && (
        <Tap on={() => nav.push('in/checkin', { trip: round[0].id })} class="pk-navy-go">
          <Icon name="came-in" size={18} stroke={2} style={{ color: '#6FDCB0' }} />{`Check in ${firstWord(runner.name)}’s trip${due != null ? ' · ' : ''}`}{due != null && <span class="mono">{`~${clock(due)}`}</span>}
        </Tap>
      )}
      {(packed.length > 0 || ready.length > 0) && (
        <div class="pk-two">
          {packed.length > 0 && (
            <Tap on={() => nav.replace('out/load')} class="pk-two-t">
              <Icon name="layers" size={20} stroke={1.9} style={{ color: '#1A5A8A' }} />
              <span><b>To load <span class="mono">{packed.length}</span></b><span>{`→ ${String(firstTo || '').split(/[ ,]/)[0]}`}</span></span>
            </Tap>
          )}
          {ready.length > 0 && (
            <Tap on={() => nav.push('out/gate', { id: ready[0].id })} class="pk-two-t good">
              <Icon name="store" size={20} stroke={1.9} />
              <span><b>At the gate <span class="mono">{ready.length}</span></b><span>{`${orderNo(ready[0].id)} · ready`}</span></span>
            </Tap>
          )}
        </div>
      )}
      {next && (
        <div class="pk-card pk-next">
          {s.buyer && <Avatar {...s.buyer.face} size={28} />}
          <span>Next to pack: <b>{`${orderNo(next.id)} ${firstWord(next.client.name)}`}</b> after the trip</span>
          <StatusPill tone="info" icon="cart">Buying</StatusPill>
        </div>
      )}
    </>
  );
}
