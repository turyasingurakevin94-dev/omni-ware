/*
 * Unpack a packed order still in the yard (store-agent AD02 the sheet, AD05 unpacked, AD06 not saved;
 * routes `pack/order { id, unpack: 1 }`, opened from PK06's bay tile of another order). Behind the sheet,
 * the order on its bay: Packed, how long on the bay, who packed it, what the salesperson sees, the bays,
 * the lines. The sheet: Bay 2 → To pack, "Your ticks stay", Brian sees Packing again after Unpack,
 * Keep it packed / Unpack (navy, not the slide: it is undoable). Unpack is W5 (pack.ts canUnpack), held
 * 10 s with Undo ("Unpacked · bay 2 free"); not saved: the sheet again, "#0530 is still packed on bay 2",
 * Try again. AD05 lists it under To pack now as the board draws it (spec §3 Q23 asks To pack or Packing).
 */
import type { JSX } from 'preact';
import { signal, type Signal } from '@preact/signals';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { counted, firstWord, orderNo } from '../../../core/names.ts';
import { bayCount, bayMap } from '../../../core/store/bays.ts';
import { personFace, shortName, whoIs } from '../../../core/store/faces.ts';
import { trackTimes } from '../../../core/store/load.ts';
import { packLines, progress, whereOf } from '../../../core/store/pack.ts';
import type { YardBooks, YardOrder } from '../../../core/store/types.ts';
import { moneyHeld, ordersAt } from '../../../core/store/yard.ts';
import { clock, dayLabel, dayOf, daysApart, weekday } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { Track } from '../../../ui/Track.tsx';
import { cx } from '../../../ui/util.tsx';
import { backTo, nav } from '../shell/nav.ts';
import { books, hold, me, notDone, now } from '../shell/store.ts';
import { StateHead } from './head.tsx';
import { FromTo, LinesCard } from './lists.tsx';
import { NotDoneCard } from './parts.tsx';
import './unpack.css';

type Ask = 'ask' | 'failed';
const onBayFor = (o: YardOrder, n: number): string => counted(Math.max(1, daysApart(dayOf(o.pickingDoneAt ?? n), dayOf(n))), 'day');
/** "29 Sep" another day, "10:05" today, for the track's stops. */
const stopAt = (t: number | null, n: number): string | undefined => (t == null ? undefined : dayOf(t) === dayOf(n) ? clock(t) : dayLabel(t).split(' ').slice(1).join(' '));

/** The lines, ticked, with the day they were packed ("Thu"). */
function Ticks(p: { b: YardBooks; o: YardOrder; title: string }): JSX.Element {
  const ls = packLines(p.o), pr = progress(p.o), day = p.o.pickingDoneAt != null ? weekday(p.o.pickingDoneAt) : '';
  return (
    <LinesCard b={p.b} title={p.title} bar={ls.map((l) => (l.pickStatus ? 'on' : ''))} count={`${pr.done} of ${pr.of}`}
      rows={ls.map((l) => ({ l, qty: l.pickedQty ?? l.qty, end: <span class="pk-list-k"><span class="mono ad-day">{day}</span><span role="img" aria-label="Ticked" class="pk-tick"><Icon name="check" size={13} stroke={3} /></span></span> }))} />
  );
}

/** AD02's sheet: what Unpack does, then Keep it packed / Unpack; AD06 when it did not save. */
function UnpackSheet(p: { o: YardOrder; st: Signal<Ask>; onKeep: () => void; onUnpack: () => void }): JSX.Element {
  const b = books.value;
  if (!b) return <></>;
  const o = p.o, n = now.value, t = whoIs(b, o.takenBy), tn = t ? firstWord(t.name) : 'Sales', failed = p.st.value === 'failed';
  return (
    <div class="ow-lsheet ad">
      <span aria-hidden="true" class="ow-grab" />
      <div class="ow-lsheet-h ad-h">
        <div class="ow-lsheet-ht"><span class="ow-lsheet-eye">{`Bay ${o.bay} · ${orderNo(o.id)} · in the yard`}</span><h2>{`Unpack ${orderNo(o.id)}`}</h2></div>
        <button type="button" class="ow-x-tile" aria-label="Close" onClick={p.onKeep}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      <div class="ow-lsheet-b ad-b">
        <FromTo label={`Bay ${o.bay} gets free, ${orderNo(o.id)} goes back to To pack`} fromTone="warn" toTone="info"
          from={<><b>Bay <span class="mono">{o.bay}</span></b><span class="ad-ft-s">{`${orderNo(o.id)} · ${onBayFor(o, n)}`}</span></>}
          to={<><Icon name="orders" size={18} stroke={2} /><span>To pack</span></>} />
        <Ticks b={b} o={o} title="Your ticks stay" />
        <div class="ad-after">
          <span class="ad-after-k">After Unpack<br /><span>Undo for 10 s</span></span>
          <span class="ad-flex" />
          {t && <Avatar {...personFace(t)} size={24} font={11} class="ad-after-f" />}
          <span class="ad-after-t">{`${tn} sees:`}<br />Packing again</span>
        </div>
        {failed ? (
          <NotDoneCard what={`${orderNo(o.id)} is still packed on bay ${o.bay}`} onRetry={() => { notDone.value = null; p.st.value = 'ask'; p.onUnpack(); }}
            onClose={() => { notDone.value = null; p.st.value = 'ask'; }} />
        ) : (
          <div class="ad-dock">
            <button type="button" class="ad-keep" onClick={p.onKeep}>Keep it packed</button>
            <button type="button" class="ad-go" onClick={p.onUnpack}><Icon name="return" size={18} stroke={2.2} />Unpack</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Behind the sheet (AD02): the order on its bay, Packed, its bays and its lines. */
function OnBay(p: { b: YardBooks; o: YardOrder; onAsk: () => void }): JSX.Element {
  const { b, o } = p, n = now.value, t = whoIs(b, o.takenBy), tn = t ? firstWord(t.name) : 'Sales', packer = whoIs(b, o.assignedWorkerId);
  const map = bayMap(b), tiles: JSX.Element[] = [];
  for (let i = 1; i <= Math.min(bayCount(b), 12); i++) {
    const x = map.get(i), mine = x && x.id === o.id, inner = <>{`Bay ${i}`}<span class="mono">{x ? orderNo(x.id) : 'free'}</span></>;
    tiles.push(mine ? <button key={i} type="button" class="ad-bay mine" aria-label={`Unpack ${orderNo(o.id)}`} onClick={p.onAsk}>{inner}</button>
      : <span key={i} class={cx('ad-bay', x ? 'taken' : 'free')}>{inner}</span>);
  }
  const held = moneyHeld(o) ? ' · not paid yet' : '';
  return (
    <FullSheet onBack={() => nav.back()} backLabel={backTo.value} pad="14px 16px 16px"
      head={(
        <StateHead b={b} o={o} sub={`${orderNo(o.id)} · ${tn} · bay ${o.bay}`} word="Packed" tail={`${onBayFor(o, n)} on bay ${o.bay}${held}`} tailTone="amber" onClose={() => nav.to('today')}
          who={packer && <><Avatar {...personFace(packer)} size={24} style={{ boxShadow: '0 0 0 2px #16203C' }} /><span class="pk-from-w">{`Packed ${o.pickingDoneAt != null ? dayLabel(o.pickingDoneAt) : ''} · ${firstWord(packer.name)}`}</span></>}
          sees={`${tn} sees: Packed`} tone="mint" />
      )}>
      <div class="ad-bays">{tiles}</div>
      <Ticks b={b} o={o} title="Packed" />
    </FullSheet>
  );
}

/** AD05: unpacked, the bay free, the ticks kept, Brian told, what is to pack now; Back to Today. */
function Unpacked(p: { b: YardBooks; o: YardOrder; bay: number | null }): JSX.Element {
  const { b, o } = p, n = now.value, t = whoIs(b, o.takenBy), tn = t ? firstWord(t.name) : 'Sales', tt = trackTimes(o);
  const list = [...ordersAt(b, 'to-pack', me.value, n).filter((x) => x.id !== o.id), o];
  const word = (x: YardOrder): string => (x.id === o.id ? 'ticks kept' : whereOf(x, b).pickup ? 'they collect' : whereOf(x, b).to.split(/[ ,]/)[0]);
  return (
    <FullSheet onBack={() => nav.replace('pack')} backLabel="Back to To pack" pad="14px 16px 16px"
      head={(
        <StateHead b={b} o={o} sub={`${orderNo(o.id)} · ${tn}${moneyHeld(o) ? ' · not paid yet' : ''}`} word="Packing" tail="unpacked · your ticks stay" onClose={() => nav.replace('pack')} who={null} sees="" tone="glass">
          <Track stage="packing" sub="" times={{ checking: stopAt(tt.checking, n), buying: stopAt(tt.buying, n) }} skipped={tt.skipped.filter((s) => s === 'buying')} />
        </StateHead>
      )}>
      <FromTo label={`Bay ${p.bay ?? ''} is free, ${orderNo(o.id)} is back in To pack`} fromTone="dash" toTone="info"
        from={<><b>Bay <span class="mono">{p.bay ?? '—'}</span></b><span class="good">free now</span></>}
        to={<><Icon name="orders" size={18} stroke={2} /><span>To pack</span></>} />
      <Ticks b={b} o={o} title="Your ticks stay" />
      {t && <div class="pk-told"><Avatar {...personFace(t)} size={26} /><span>{`${tn} sees: `}<b>Packing again</b></span><span class="pk-tag"><Icon name="bell" size={13} stroke={2.4} />push</span></div>}
      <div class="pk-card ad-now">
        <div class="ad-now-h"><span>To pack now</span><span class="mono">{list.length}</span></div>
        {list.map((x) => (
          <button key={x.id} type="button" class="ad-now-r" onClick={() => nav.replace('pack')}>
            <span class="mono">{orderNo(x.id)}</span><span>{`${shortName(x)} · ${word(x)}`}</span>
            <b>{x.id === o.id ? 'ready' : `${progress(x).done} of ${progress(x).of}`}</b>
          </button>
        ))}
      </div>
      <button type="button" class="pk-btn navy ad-home" onClick={() => nav.home()}>Back to Today</button>
    </FullSheet>
  );
}

/** pack/order { id, unpack }: the order on its bay with the Unpack sheet; then AD05, or AD06 if it did not save. */
export function Unpack(p: { o: YardOrder }): JSX.Element {
  const b = books.value, o = p.o;
  const st = useMemo(() => signal<Ask>('ask'), []);
  const [done, setDone] = useState<number | null | false>(false);
  const live = useRef(true);
  const was = useRef(o);
  if (done === false) was.current = o;
  // Not saved, the sheet stands taller for its Not done card (AD06: 252, AD02: 292).
  // Any way the sheet goes but Unpack (its Close, Keep it packed, the dim head, a pull down, the phone's Back) is
  // Keep it packed: back to the order below (PK06), so the bare page under the sheet is never left open (F9).
  const quiet = useRef(false);
  const ask = (): void => sheet.open(() => <UnpackSheet o={was.current} st={st} onKeep={keep} onUnpack={go} />, {
    label: `Unpack ${orderNo(o.id)}`, top: st.value === 'failed' ? 252 : 292,
    onClose: () => { if (quiet.current) quiet.current = false; else window.setTimeout(() => nav.back(), 0); },
  });
  function keep(): void { sheet.close(); }
  function go(): void {
    const bay = was.current.bay;
    quiet.current = true;
    sheet.close();
    setDone(bay);
    hold(`Unpacked · bay ${bay} free`, 'unpack', [o.id], () => { setDone(false); ask(); }, {
      then: (_r, e) => { if (e && live.current) { st.value = 'failed'; setDone(false); ask(); } },
    });
  }
  useEffect(() => { ask(); return () => { live.current = false; quiet.current = true; sheet.close(); }; }, []);
  if (!b) return <FullSheet onBack={() => nav.back()} backLabel={backTo.value} head={<div class="ow-shead" />} />;
  return done !== false ? <Unpacked b={b} o={o} bay={done} /> : <OnBay b={b} o={was.current} onAsk={ask} />;
}
