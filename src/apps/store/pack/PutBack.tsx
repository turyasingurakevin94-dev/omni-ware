/*
 * Cancelled · put it back (store-agent PK10; PK22 not saved; routes `pack/put-back { id }`).
 * The order was cancelled while still in the yard: what was picked goes back to the shelf, line
 * by line (tick each), from its bay to its aisles; then the red slide. Only lines already picked go
 * back; with none, "Stop packing · nothing was picked yet". The put-back is stamped once on
 * the order by the server (W7, 0183 `{putBack:{lines}}`); then the order leaves the yard's lists.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { firstWord, orderNo } from '../../../core/names.ts';
import { bayFor } from '../../../core/store/bays.ts';
import { personFace, whoIs } from '../../../core/store/faces.ts';
import { aisleOf, putBack } from '../../../core/store/pack.ts';
import type { YardBooks, YardOrder } from '../../../core/store/types.ts';
import { clock } from '../../../core/time.ts';
import { Avatar, FaceStack } from '../../../ui/Avatar.tsx';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { StatusPill } from '../../../ui/Pill.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { backTo, nav } from '../shell/nav.ts';
import { act, books, notDone } from '../shell/store.ts';
import { StateHead } from './head.tsx';
import { FromTo, LinesCard } from './lists.tsx';
import { NotDoneCard, PushCard } from './parts.tsx';

function Body(p: { b: YardBooks; o: YardOrder }): JSX.Element {
  const { b, o } = p, back = putBack(o), [ticked, setTicked] = useState<number[]>([]), [state, setState] = useState<'ready' | 'sending' | 'failed'>('ready');
  const t = whoIs(b, o.takenBy), tn = t ? firstWord(t.name) : 'Sales';
  const by = b.people.find((x) => x.name === o.cancelledByName) || b.people.find((x) => x.role === 'manager') || null;
  const bn = by ? firstWord(by.name) : 'Ruth', at = o.cancelledAt != null ? clock(o.cancelledAt) : '';
  const bay = o.bay ?? (o.pickingStatus === 'done' ? bayFor(o, b) : null);
  const letters = [...new Set(back.map((x) => aisleOf(b, x.line)?.letter).filter((x): x is string => !!x))];
  const all = back.length > 0 && back.every((x) => ticked.includes(x.line.idx));
  const tick = (i: number) => setTicked((k) => (k.includes(i) ? k.filter((x) => x !== i) : [...k, i]));
  const done = async () => {
    setState('sending');
    try {
      await act('putBack', o.id);
      notDone.value = null;
      toast.show(`Put back · ${orderNo(o.id)}`);
      nav.home();
    } catch (_e) { setState('failed'); }
  };
  const faces = [by, t].filter((x): x is NonNullable<typeof x> => !!x).map(personFace);
  return (
    <FullSheet onBack={() => nav.back()} backLabel={backTo.value} pad="14px 16px 16px"
      head={(
        <StateHead b={b} o={o} sub={`${orderNo(o.id)} · ${tn}${bay != null ? ` · bay ${bay}` : ''}`} word="Cancelled" tail={`put it back${bay != null ? ` · bay ${bay}` : ''}`} tailTone="rose" onClose={() => nav.home()}
          who={by && <><Avatar {...personFace(by)} size={24} style={{ boxShadow: '0 0 0 2px #16203C' }} /><span class="pk-from-w">{`${bn} cancelled it${at ? ' · ' + at : ''}`}</span></>}
          sees={`${tn} sees: Cancelled`} tone="rose" />
      )}>
      {state !== 'failed' && by && <PushCard face={personFace(by)} title={`Cancelled · put it back · ${orderNo(o.id)}`} sub={`${bn}${at ? ' · ' + at : ''}`} on={() => nav.home()} label="Back to Today" />}
      {back.length ? (
        <>
          <FromTo label={`From ${bay != null ? 'bay ' + bay : 'the yard'} back to the shelf: aisles ${letters.join(' and ')}`} fromTone="warn" toTone="good"
            from={<><span class="pk-ft-eye">FROM</span><b>{bay != null ? <>Bay <span class="mono">{bay}</span></> : 'The yard'}</b></>}
            to={<><span class="pk-ft-eye">TO THE SHELF</span><span class="pk-ft-l">{letters.map((x) => <span key={x}>{x}</span>)}</span></>} />
          <LinesCard b={b} title="Put back" bar={back.map((x) => (ticked.includes(x.line.idx) ? 'on' : ''))} count={`${ticked.length} of ${back.length}`}
            rows={back.map((x) => ({
              l: x.line, qty: x.qty,
              end: <button type="button" class="pk-box" aria-pressed={ticked.includes(x.line.idx)} aria-label={`${x.line.name}: on the shelf`} disabled={state === 'sending'} onClick={() => tick(x.line.idx)}>
                <span>{ticked.includes(x.line.idx) && <Icon name="check" size={15} stroke={3} />}</span></button>,
            }))} />
        </>
      ) : <div class="pk-card pk-stop"><Icon name="close" size={18} stroke={2.4} /><span><b>Stop packing</b><span>nothing was picked yet</span></span></div>}
      <div class="pk-told card"><FaceStack faces={faces} size={26} ground="#FFFFFF" /><span>{`${faces.length > 1 ? `${bn} and ${tn}` : bn} see: `}<b>Put back</b></span><span class="pk-tag"><Icon name="bell" size={13} stroke={2.4} />push</span></div>
      {state !== 'failed' && (
        <div class="pk-red-on"><span>Shows red on</span><StatusPill tone="bad" style={{ height: '26px' }}>Today</StatusPill>{bay != null && <StatusPill tone="bad" style={{ height: '26px' }}>{`Bay ${bay}`}</StatusPill>}</div>
      )}
      {state === 'failed'
        ? <NotDoneCard what={`Put back ${orderNo(o.id)} · your ticks are kept`} onRetry={() => { notDone.value = null; void done(); }} onClose={() => { setState('ready'); notDone.value = null; }} />
        : (
          <div class={'pk-slide ' + (all || !back.length ? 'go' : 'wait')}>
            <Slide label={!back.length ? 'Slide to stop packing' : all ? `Slide to put back · ${back.length} line${back.length === 1 ? '' : 's'}` : `Tick each line · ${ticked.length} of ${back.length}`}
              state={state === 'sending' ? 'sending' : all || !back.length ? 'ready' : 'blocked'} onCommit={done}
              onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />
          </div>
        )}
    </FullSheet>
  );
}

export function PutBack(p: { id: number }): JSX.Element {
  const b = books.value, o = b ? b.orders.find((x) => x.id === p.id) : null;
  if (!b || !o) return <FullSheet onBack={() => nav.back()} backLabel={backTo.value} head={<div class="ow-shead" />} />;
  return <Body b={b} o={o} />;
}
