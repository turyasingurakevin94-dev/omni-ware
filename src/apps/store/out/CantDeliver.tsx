/*
 * Can't deliver · bring it back (out/cant-deliver { id }; OU24). One reason (Closed · Nobody there ·
 * Refused · Wrong place), what comes back and to which aisle, who sees it after the slide (Ruth and the
 * salesperson), and the red slide: W27 cantDeliver writes comingBack {why, at, by} on the order (0182);
 * it stays On the road as "Coming back" until it is checked in at the gate as a return.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { firstWord, orderNo, plural } from '../../../core/names.ts';
import { aisleLetter, aisleOf, CANT_WHY, lineQty, offTheTruck } from '../../../core/store/door.ts';
import { orderFace, yardFace, shortName } from '../../../core/store/faces.ts';
import { trackTimes } from '../../../core/store/load.ts';
import { clock, weekday, dayOf } from '../../../core/time.ts';
import { FullSheet, SheetHead } from '../../../ui/FullSheet.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { Track } from '../../../ui/Track.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, now } from '../shell/store.ts';
import { OIcon, type OIconName } from './icons.tsx';
import { AfterSlide, FlowBar, SheetDock, manager, seller } from './parts.tsx';
import { notDone as wordIt } from '../../../core/store/errors.ts';

const ICON: (OIconName | 'pin')[] = ['door', 'person-x', 'x-circle', 'pin'];

export function CantDeliver(p: { id: number }): JSX.Element {
  const b = books.value, n = now.value;
  const o = b ? b.orders.find((x) => x.id === p.id) || null : null;
  const [why, setWhy] = useState<string | null>(null);
  const [state, setState] = useState<'ready' | 'sending' | 'kept' | 'failed'>('ready');
  const [code, setCode] = useState('');
  if (!b || !o) return <main class="st-ph" />;
  const lines = offTheTruck(o), r = manager(b), g = seller(b, o), t = trackTimes(o);
  const day = (ms: number | null) => (ms == null ? undefined : dayOf(ms) === dayOf(n) ? clock(ms) : weekday(ms));
  const send = async () => {
    if (!why) return;
    setState('sending');
    try {
      const res = await act('cantDeliver', o.id, why);
      if (res.kept) { setState('kept'); return; }
      toast.show(`Coming back · ${orderNo(o.id)}`, { kind: 'ok' });
      nav.back();
    } catch (e) { setCode(wordIt(e, 'cantDeliver').code); setState('failed'); }
  };
  const driver = o.carrier ? o.carrier.name : '';
  const place = (o.deliverTo || '').split(',')[0].trim();
  const head = (
    <>
      <SheetHead face={orderFace(o, b)} name={o.client.name} sub={`${orderNo(o.id)} · ${g ? `${firstWord(g.name)}’s order` : 'the order'}`} subMono phone={o.client.phone}
        onClose={() => nav.back()} style={{ padding: '10px 20px 18px', gap: '14px' }}>
        <Track stage="road" word="Coming back" sub={`${driver} · at ${place}`} waits
          times={{ checking: day(t.checking), road: o.carrier && o.carrier.at != null ? clock(o.carrier.at) : undefined }} />
      </SheetHead>
      {state === 'kept' && <FlowBar kind="offline" onRetry={() => { void send(); }} />}
      {state === 'failed' && <FlowBar kind="failed" code={code} onRetry={() => { void send(); }} />}
    </>
  );
  const foot = (
    <SheetDock hint={{ icon: 'store', text: 'Check it in at the gate', iconTone: 'mint' }}>
      {state === 'sending' ? <Slide label="" onCommit={() => undefined} state="sending" />
        : state === 'kept' ? <Slide label="Not sent yet" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Not sent yet' }} />
          : why ? <Slide label="Slide to bring it back" onCommit={send} onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />
            : <Slide label="Pick why first" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Pick why first' }} />}
    </SheetDock>
  );
  const sees = [r, g].filter(Boolean);
  return (
    <FullSheet onBack={() => nav.back()} backLabel="Back to the door" head={head} foot={foot} pad="12px 16px 14px" gap={8}>
      <div role="radiogroup" aria-label="Why" class="cd-tiles">
        {CANT_WHY.map((w, i) => {
          const ic = ICON[i];
          return (
            <button key={w} type="button" role="radio" aria-checked={why === w} class={cx('cd-tile', why === w && 'on')} onClick={() => setWhy(w)}>
              {why === w && <span aria-hidden="true" class="np-tick"><Icon name="check" size={11} stroke={3.2} /></span>}
              <span class="np-ic" style={why === w ? { color: '#16203C' } : undefined}>{ic === 'pin' ? <Icon name="pin" size={20} stroke={1.9} /> : <OIcon name={ic} size={20} stroke={1.9} />}</span>
              <span class="np-w">{w}</span>
            </button>
          );
        })}
      </div>
      <div class="cd-back">
        <div class="cd-back-h"><span>What comes back</span><span class="cd-all"><Icon name="return" size={12} stroke={2.6} />{`all ${lines.length} ${plural(lines.length, 'line')}`}</span></div>
        {lines.map((l) => (
          <div key={l.idx} class="cd-line">
            <ItemSquare aisle={aisleOf(b, l.key) || 'Tools'} size={34} radius={9} icon={20} />
            <span class="gt-line-t"><span>{l.name}</span><span class="mono">{lineQty(l)} <span class="rn-u">{`${l.unit}${aisleLetter(b, l.key) ? ` · to aisle ${aisleLetter(b, l.key)}` : ''}`}</span></span></span>
            <span role="img" aria-label="Coming back" class="cd-ret"><Icon name="return" size={13} stroke={2.6} /></span>
          </div>
        ))}
      </div>
      <AfterSlide faces={sees.map((x) => yardFace(b, x))}
        who={sees.map((x) => firstWord(x!.name)).join(' and ')} what={`Coming back · ${shortName(o)} ${why ? why.toLowerCase() : '…'}`} />
    </FullSheet>
  );
}
