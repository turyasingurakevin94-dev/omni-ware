/*
 * Waits for the goods (store-agent PK21; routes `pack/order` for an order in Buying). Nothing to
 * pack yet: the first line still out, who is bringing it and when, the others, and the way in
 * (Check-in opens it, then it moves to To pack by itself). The Pack button is grey (NAV-04).
 */
import type { JSX } from 'preact';
import { firstWord, orderNo } from '../../../core/names.ts';
import { personFace, whoIs } from '../../../core/store/faces.ts';
import { lineAwaited } from '../../../core/store/yard.ts';
import type { Trip, YardBooks, YardLine, YardOrder } from '../../../core/store/types.ts';
import { clock, dayOf } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { AISLE, Duo, Icon, aisleKey } from '../../../ui/icons.tsx';
import { StatusPill } from '../../../ui/Pill.tsx';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { Tap } from '../../../ui/util.tsx';
import { aisleOf } from '../../../core/store/pack.ts';
import { nav } from '../shell/nav.ts';
import { books, now } from '../shell/store.ts';
import { StateHead } from './head.tsx';
import { toSheet } from './parts.tsx';
import { Glyph } from './glyphs.tsx';

/** The trip a line rides on, and whether it is bought yet. */
function tripOf(b: YardBooks, o: YardOrder, l: YardLine): { t: Trip; got: boolean } | null {
  for (const t of b.trips) {
    if (t.voided) continue;
    const x = t.lines.find((y) => y.orderId === o.id && y.productId === l.productId);
    if (x) return { t, got: x.gotQty != null && x.gotQty > 0 };
  }
  return null;
}

export function Waits(p: { o: YardOrder }): JSX.Element {
  const b = books.value as YardBooks, o = p.o;
  const out = o.lines.filter(lineAwaited), first = out[0] || o.lines[0];
  const trips = out.map((l) => tripOf(b, o, l)), firstTrip = trips[0];
  const runner = firstTrip ? whoIs(b, firstTrip.t.runnerId) : null, rn = runner ? firstWord(runner.name) : '';
  const due = trips.map((x) => x && x.t.dueAt).find((x) => x != null) ?? null;
  const bought = trips.filter((x) => x && x.got).length;
  const t = whoIs(b, o.takenBy), tn = t ? firstWord(t.name) : 'Sales';
  const placed = o.createdAt ?? o.savedAt ?? now.value;
  const a = aisleOf(b, first), k = AISLE[aisleKey(a ? a.name : first.name)];
  const say = (x: { t: Trip; got: boolean } | null) => x ? (x.got ? `Bought${x.t.collectedAt != null ? ' ' + clock(x.t.collectedAt) : ''} · ${x.t.supplierName.split(' ')[0]} · on ${rn}’s truck` : `${rn} is looking · ${x.t.supplierName}`) : 'Not bought yet';
  return (
    <FullSheet onBack={toSheet} backLabel="Back to To pack" pad="14px 16px 16px"
      head={(
        <StateHead b={b} o={o} sub={`${orderNo(o.id)} · ${tn} · ${dayOf(placed) === dayOf(now.value) ? 'today ' : ''}${clock(placed)}`} word="Buying"
          tail={`${bought} of ${out.length} bought${rn ? ' · ' + rn : ''}`} onClose={toSheet} sees={`${tn} sees: Buying`} tone="glass"
          who={runner && <><Avatar {...personFace(runner)} size={24} style={{ boxShadow: '0 0 0 2px #16203C' }} /><span class="pk-from-w">{`${rn}’s trip`}{due != null && <> · back ~<span class="mono">{clock(due)}</span></>}</span></>} />
      )}>
      <div class="pk-card pk-line">
        <div class="pk-line-h">
          <span role="img" aria-label="Not in the yard yet" class="pk-aisle" style={{ background: 'var(--tile)', color: 'var(--ink-soft)' }}><Icon name="truck" size={22} stroke={2} /></span>
          <span class="pk-line-e"><span>{`Line ${o.lines.indexOf(first) + 1} of ${o.lines.length} · not here yet`}</span>
            <span class="pk-came info"><Icon name="cart" size={14} stroke={2.2} />{say(firstTrip)}</span></span>
        </div>
        <Tap on={() => nav.push('shelf/item', { key: first.key })} label={`${first.name}: open the item`} class="pk-pic" style={{ height: '132px' }}>
          <span style={{ opacity: 0.55, display: 'flex' }}><Duo i={k.i} size={84} color={k.ink} /></span>
          <span class="mono pk-pic-x">{`×${first.qty}`}</span>
          <span class="pk-pic-w"><Icon name="hourglass" size={13} stroke={2.2} />Waits for the goods</span>
        </Tap>
        <div class="pk-line-f"><span class="pk-line-n">{first.name}</span><span class="pk-line-q soft"><span class="mono">{first.qty}</span><span>{first.unit}</span></span></div>
      </div>
      {out.slice(1).map((l, i) => {
        const a2 = aisleOf(b, l), k2 = AISLE[aisleKey(a2 ? a2.name : l.name)], x = trips[i + 1];
        return (
          <div key={l.idx} class="pk-card pk-drop">
            <span aria-hidden="true" class="pk-drop-i" style={{ background: `linear-gradient(145deg, ${k2.soft} 0%, #FFFFFF 150%)` }}><Duo i={k2.i} size={18} color={k2.ink} /></span>
            <span class="pk-drop-t"><b class="pk-drop-b">{`${l.name} · `}<span class="mono">{l.qty}</span>{` ${l.unit}`}</b><span>{say(x)}</span></span>
            <StatusPill tone="info" icon="cart">{x && x.got ? 'Bought' : 'Buying'}</StatusPill>
          </div>
        );
      })}
      <Tap on={() => (firstTrip ? nav.push('in/checkin', { trip: firstTrip.t.id }) : nav.push('in'))} class="pk-card pk-where pk-go">
        <span aria-hidden="true" class="pk-where-i pickup"><Glyph name="came-in" size={20} stroke={1.9} /></span>
        <span class="pk-where-t"><b>Check-in opens it</b><span>then it moves to To pack by itself</span></span>
        <span class="pk-chev"><Icon name="chevron-right" size={14} stroke={2.4} /></span>
      </Tap>
      <div class="pk-dock one"><button type="button" class="pk-btn grey" disabled><Icon name="hourglass" size={18} stroke={2.2} />Waits for the goods</button></div>
    </FullSheet>
  );
}
