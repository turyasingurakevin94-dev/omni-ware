/*
 * Trip · Hand in (TripHandIn.dc.html): what came against the plan, per
 * order; what was paid and the cash back to Accounts (rules.handIn). One
 * slide hands it in: the goods to the Store to count in, the cash back to
 * Esther. While it goes, each person to tell is ticked off.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { handIn } from '../../../core/buyer/rules.ts';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { counted, firstWord } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Dock } from '../../../ui/Dock.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { Slide, type SlideProps } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, now, online } from '../shell/store.ts';
import { byRole, liveStops, memberOf, ordersCame } from './model.ts';
import { NavyHero, OrderChip } from './parts.tsx';
import { Told } from './Told.tsx';
import './handin.css';
import './plan.css';

const hint = () => toast.show('Slide the red button across', { kind: 'warn' });

export function HandIn(p: { b: BuyerBooks }): JSX.Element {
  const b = p.b, t = b.trip;
  const [sending, setSending] = useState(false);
  const musa = byRole(b, 'store'), esther = byRole(b, 'accounts');
  if (!t || t.state === 'planned' || t.state === 'in') return <NoTrip b={b} />;
  const h = handIn(t, b), stops = liveStops(t), left = stops.filter((s) => !s.done).length;
  const came = ordersCame(b, t), lines = came.reduce((x, o) => x + o.rows.length, 0);

  const go = async () => {
    setSending(true);
    try {
      const r = await act('handIn');
      nav.replace('trip/done', { kept: r.kept });
    } catch (e) {
      setSending(false);
      toast.show('Not handed in', { kind: 'error', sub: String((e as Error).message || e), retry: () => { void go(); } });
    }
  };
  const slide: SlideProps = left > 0
    ? { label: `${counted(left, 'stop')} to go`, onCommit: () => undefined, lock: { icon: 'lock', label: `${counted(left, 'stop')} to go` } }
    : { label: 'Hand in', onCommit: go, onHint: hint };

  return (
    <main class="ow-b-trip">
      <NavyHero title="Hand in" at={3} text={`Back · ${clock(now.value)}`} onClose={() => nav.back()} closeOff={sending}
        pill={b.me && <Avatar initials={b.me.initials} tint="me" onNavy size={40} />}
        eyebrow={`Cash back to ${firstWord(esther?.name || 'Accounts')}`} amount={h.back}
        pct={t.cash.amount ? (h.paid / t.cash.amount) * 100 : 0} foot={`${fig(h.paid)} paid of ${fig(t.cash.amount)}`} />
      <div class="ow-b-trip-body">
        {!online.value && <Notice kind="offline">No signal · it saves on this phone</Notice>}
        {sending ? (
          <>
            <h2 class="ow-b-hi-h">Telling</h2>
            <Told b={b} back={h.back} orders={came.length} shorts={h.shorts} live />
          </>
        ) : came.map((o) => (
          <div key={o.order.id} class="ow-b-hi-card">
            <div class="ow-b-hi-top">
              <OrderChip who={memberOf(b, o.order.sellerId)} id={o.order.id} />
              <b>{o.order.client}</b>
              <span class="ow-b-hi-amt"><span class="mono">{fig(o.came)}</span><small class="mono">{o.came === o.planned ? 'as planned' : `of ${fig(o.planned)}`}</small></span>
            </div>
            {o.rows.map((r) => {
              const g = r.line.got ?? 0, short = g < r.line.qty;
              return (
                <div key={r.line.key} class="ow-b-hi-line">
                  <span>{r.line.name}</span>
                  <span class="ow-b-hi-bar" aria-hidden="true"><i class={cx(short && 'short')} style={{ width: `${r.line.qty ? (g / r.line.qty) * 100 : 0}%` }} /></span>
                  <span class={cx('mono', short && 'short')} aria-label={`got ${g} of ${r.line.qty}`}>{`${g}/${r.line.qty}`}</span>
                </div>
              );
            })}
            {h.shorts.filter((s) => s.order.id === o.order.id).map((s) => (
              <span key={s.line.key} class="ow-b-hi-sees"><Icon name="bell" size={14} stroke={2} />{`${firstWord(memberOf(b, s.order.sellerId)?.name || 'Sales')} sees: Short · got ${s.got} of ${s.line.qty}`}</span>
            ))}
          </div>
        ))}
      </div>
      <Dock words="Paid" total={h.paid} sub={{ text: `${counted(lines, 'line')} · ${h.shorts.length} short`, tone: 'mint' }}>
        <Slide {...slide} />
        {left === 0 && musa && <div class="ow-b-hi-then"><Avatar initials={musa.initials} tint={musa.tint} size={28} />{`Then ${firstWord(musa.name)} counts it in`}</div>}
      </Dock>
    </main>
  );
}

/** No trip out: nothing to hand in; the way back is to plan one. */
function NoTrip(p: { b: BuyerBooks }): JSX.Element {
  const esther = byRole(p.b, 'accounts');
  return (
    <main class="ow-b-trip">
      <header class="ow-b-trip-head">
        <button type="button" class="ow-b-trip-x" aria-label="Close" onClick={() => nav.back()}><Icon name="close" size={20} stroke={2} /></button>
        <div class="ow-b-trip-ht"><h1>Hand in</h1></div>
      </header>
      <div class="ow-b-trip-body">
        <div class="ow-b-plan-none"><span><Icon name="basket" size={24} stroke={1.8} /></span><b>Nothing to hand in</b><span class="mono">0 stops</span></div>
      </div>
      <Dock face={esther ? <Avatar initials={esther.initials} tint={esther.tint} size={36} /> : null} words={firstWord(esther?.name || 'Accounts')} total={null}>
        <Slide label="No trip out" onCommit={() => undefined} state="empty" />
      </Dock>
    </main>
  );
}

/** trip/handin: the same screen, opened by its id. */
export function HandInScreen(): JSX.Element {
  const b = books.value;
  return b ? <HandIn b={b} /> : <main class="ow-b-trip" aria-busy="true" />;
}
