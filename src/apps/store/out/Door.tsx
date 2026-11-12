/*
 * At the door (out/door { id }; OU21 default, OU26 delivering, OU22 delivered, OU23 no photo, OU28 not sent).
 * The camera fills the top; the shutter takes the photo AND marks it Delivered (W10), 10 s with Undo on the
 * end screen. What comes off (all of it, unless a line stays: it comes back as a return checked at the
 * gate, W10a, a phone draft), who receives it. "No photo?" asks one reason, never preselected (OU23, a
 * sheet: openNoPhoto). "Can't deliver" brings it back (out/cant-deliver, OU24).
 *
 * The photo: on a phone with a camera the shutter opens it (an <input capture>, the picture comes back as
 * the proof); in the demo the drawn scene stands for it.
 */
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { firstWord, orderNo } from '../../../core/names.ts';
import { billAt, lineQty, noPhotoWhy, offTheTruck, receiver } from '../../../core/store/door.ts';
import type { DoorProof } from '../../../core/store/source.ts';
import type { YardBooks, YardOrder } from '../../../core/store/types.ts';
import { clock, weekday } from '../../../core/time.ts';
import { orderFace, yardFace, shortName } from '../../../core/store/faces.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { books, isDemo, now } from '../shell/store.ts';
import { useCommit } from './commit.ts';
import { Done } from './Done.tsx';
import { OIcon, type OIconName } from './icons.tsx';
import { AfterSlide, FlowBar, SheetDock, manager, seller } from './parts.tsx';
import './door.css';

/** The drawn scene: the goods at the door (the demo's camera). */
function Scene(): JSX.Element {
  return (
    <svg width="360" height="470" viewBox="0 0 360 470" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
      <path d="M0 360 L360 330 L360 470 L0 470z" fill="#2B3346" />
      <g fill="#7E8AA3" opacity=".85"><rect x="52" y="230" width="180" height="10" rx="2" /><rect x="48" y="242" width="184" height="10" rx="2" /><rect x="44" y="254" width="188" height="10" rx="2" /><rect x="40" y="266" width="192" height="10" rx="2" /><rect x="36" y="278" width="196" height="10" rx="2" /></g>
      <g fill="none" stroke="#9AA6BE" stroke-width="6" stroke-linecap="round" opacity=".9"><path d="M244 280 h70 l-14 34 h-46 z" /><circle cx="276" cy="326" r="12" /><path d="M314 280 l18 -18" /></g>
    </svg>
  );
}
const Corners = (p: { top: boolean }) => (
  <svg width="360" height="470" viewBox="0 0 360 470" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
    <path d={(p.top ? 'M28 80 h36 M28 80 v36 M332 80 h-36 M332 80 v36 ' : '') + 'M28 384 h36 M28 384 v-36 M332 384 h-36 M332 384 v-36'} fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".85" />
  </svg>
);

/** The words "Kato · Ntinda site" for an order at its door. */
const whereWords = (o: YardOrder) => `${shortName(o)} · ${(o.deliverTo || '').split(',')[0].trim()}`;

const NO_ICON: (OIconName | 'person')[] = ['person', 'camera-off', 'moon', 'battery'];

function NoPhoto(p: { b: YardBooks; o: YardOrder; onGo: (why: string) => void }): JSX.Element {
  const [why, setWhy] = useState<string | null>(null);
  const g = seller(p.b, p.o), r = manager(p.b), reasons = noPhotoWhy(p.o);
  const short = why ? why.replace(' no photo', ' no') : '';
  return (
    <LightSheet ground class="np-sheet" eyebrow={`${orderNo(p.o.id)} · ${whereWords(p.o)}`} title="Why no photo?" onClose={sheet.close} pad="14px 16px 14px" gap={10}>
      <div role="radiogroup" aria-label="Why no photo" class="np-grid">
        {reasons.map((w, i) => {
          const ic = NO_ICON[i];
          return (
            <button key={w} type="button" role="radio" aria-checked={why === w} class={cx('np-tile', why === w && 'on')} onClick={() => setWhy(w)}>
              {why === w && <span aria-hidden="true" class="np-tick"><Icon name="check" size={11} stroke={3.2} /></span>}
              <span class="np-ic">{ic === 'person' ? <Icon name="person" size={20} stroke={1.9} /> : <OIcon name={ic} size={20} stroke={1.9} />}</span>
              <span class="np-w">{w}</span>
            </button>
          );
        })}
      </div>
      <AfterSlide faces={[...(g ? [yardFace(p.b, g)] : []), ...(r ? [yardFace(p.b, r)] : [])]}
        who={[g, r].filter(Boolean).map((x) => firstWord(x!.name)).join(' and ')} what={why ? `No photo · ${short}` : 'No photo · pick why'} />
      <button type="button" class="np-after" onClick={sheet.close}><Icon name="camera" size={17} stroke={2} />Take the photo after all</button>
      <div class="np-dock">
        <SheetDock>
          {why ? <Slide label="Slide · Delivered, no photo" onCommit={() => { sheet.close(); p.onGo(why); }} onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />
            : <Slide label="Pick why first" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Pick why first' }} />}
        </SheetDock>
      </div>
    </LightSheet>
  );
}

/** OU23 over the door (routes §4). */
export function openNoPhoto(b: YardBooks, o: YardOrder, onGo: (why: string) => void): void {
  sheet.open(() => <NoPhoto b={b} o={o} onGo={onGo} />, { label: 'No photo', top: 230 });
}

export function Door(p: { id: number }): JSX.Element {
  const b = books.value, n = now.value;
  const o = b ? b.orders.find((x) => x.id === p.id) || null : null;
  const c = useCommit('deliver', p.id);
  const [shot, setShot] = useState<{ at: number; why: string | null } | null>(null);
  const proof = useRef<DoorProof | null>(null);
  const file = useRef<HTMLInputElement>(null);
  if (!b || !o) return <main class="st-ph" />;
  const lines = offTheTruck(o), to = receiver(o), g = seller(b, o), r = manager(b);
  const go = (pf: DoorProof, why: string | null) => {
    proof.current = pf;
    setShot({ at: n, why });
    c.commit(`Delivered ${orderNo(o.id)}`, [o.id, pf], () => setShot(null));
  };
  const shutter = () => {
    if (!isDemo && file.current) { file.current.click(); return; }
    go({ to, photo: new Blob(['demo'], { type: 'image/jpeg' }), kind: 'door' }, null);
  };
  const picked = (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) go({ to, photo: f, kind: 'door' }, null);
  };

  if (c.phase === 'done') {
    const at = shot ? shot.at : n, bill = billAt({ ...o, deliveredAt: at });
    return (
      <Done mark="check" title="Delivered" chip={{ photo: !(shot && shot.why), face: orderFace(o, b), name: whereWords(o), sub: `${orderNo(o.id)} · ${shot && shot.why ? 'no photo' : `photo ${clock(at)}`}` }}
        sees={[...(g ? [{ face: yardFace(b, g), who: firstWord(g.name), what: 'Delivered · at the door' }] : []),
          ...(r ? [{ face: yardFace(b, r), who: firstWord(r.name), what: shot && shot.why ? `Delivered · ${shot.why}` : 'Delivered · photo' }] : [])]}
        next={[
          { icon: 'delivered', title: 'Delivered', sub: `at the door ${clock(at)}${shot && shot.why ? '' : ' · photo kept'}` },
          { icon: 'receipt', title: 'The bill', sub: `goes by itself after 24 h${bill ? ` · ${weekday(bill)} ${clock(bill)}` : ''}` },
          ...(o.carrier ? [{ icon: 'truck' as const, title: o.carrier.name, sub: 'next: back to the yard' }] : []),
        ]}
        undo="Wrong order? Undo it" />
    );
  }

  const taken = c.phase === 'sending' || c.phase === 'kept' || c.phase === 'failed';
  const arrived = clock(n);
  return (
    <main class="dr" data-route="out/door">
      <div role="img" aria-label={`Camera: the goods at ${(o.deliverTo || '').split(',')[0]}`} class="dr-cam">
        <Scene />
        <Corners top={c.phase !== 'kept' && c.phase !== 'failed'} />
      </div>
      <div class="dr-top">
        <span class="dr-who">
          <Avatar {...orderFace(o, b)} size={34} font={12} style={{ letterSpacing: '-.02em' }} />
          <span class="dr-who-t"><span>{`At the door · ${(o.deliverTo || '').split(',')[0].trim()}`}</span><span class="mono">{`${orderNo(o.id)} · arrived ${arrived}`}</span></span>
        </span>
        <button type="button" aria-label="Close the camera" class="dr-x" onClick={() => nav.back()}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      <div class="dr-pane">
        <div class="dr-h"><span>All comes off</span><span class="mono">{`${lines.length} of ${lines.length}`}</span></div>
        <div class="dr-lines">
          {lines.map((l) => (
            <button key={l.idx} type="button" class="dr-line" aria-label={`${l.name}, ${lineQty(l)} ${l.unit}: comes off`}>
              <span class="dr-line-ic"><Icon name="check" size={16} stroke={2.8} /></span>
              <span class="dr-line-t"><span class="mono">{`${lineQty(l)} ${l.unit}`}</span><span>{l.name.split(/ ·|,/)[0]}</span></span>
            </button>
          ))}
        </div>
        <div class="dr-to"><Avatar {...orderFace(o, b)} size={28} font={11} style={{ letterSpacing: '-.02em' }} /><span>{`${to} receives it`}</span></div>
        {c.phase === 'kept' || c.phase === 'failed' ? (
          <div class="dr-end">
            <span class={cx('dr-hint', c.phase === 'kept' && 'amber')}><Icon name={c.phase === 'kept' ? 'clock' : 'check'} size={13} stroke={2.2} />{c.phase === 'kept' ? 'Delivered sends by itself when the signal is back' : 'The photo is kept'}</span>
            <button type="button" class="dr-next" onClick={() => nav.back()}><Icon name="truck" size={17} stroke={2} />Next stop</button>
          </div>
        ) : c.phase === 'sending' ? (
          <div class="dr-end">
            <span aria-label="Delivering, held on this phone" class="dr-shut sending"><span><span class="dr-spin" /></span></span>
            <span class="dr-sw">Delivering…</span>
            <span class="dr-hint"><Icon name="lock" size={13} stroke={2.2} />Photo held on this phone until the shop says yes</span>
          </div>
        ) : (
          <div class="dr-row">
            <button type="button" class="dr-side" onClick={() => openNoPhoto(b, o, (why) => go({ to, photo: null, kind: 'none', note: why }, why))}><OIcon name="camera-off" size={18} stroke={2} />No photo?</button>
            <button type="button" class="dr-shut" aria-label={`Take the photo: marks ${orderNo(o.id)} delivered`} onClick={shutter}>
              <span><span class="dr-red"><Icon name="check" size={26} stroke={2.8} /></span></span>
              <b>Delivered</b>
            </button>
            <button type="button" class="dr-side end" onClick={() => nav.push('out/cant-deliver', { id: o.id })}><Icon name="return" size={18} stroke={2} />Can’t deliver</button>
          </div>
        )}
      </div>
      {taken && <><div aria-hidden="true" class="dr-flash" /><span class="dr-taken"><Icon name="camera" size={14} stroke={2} />{`Photo taken · ${clock(shot ? shot.at : n)}`}</span></>}
      {c.phase === 'kept' && <div class="dr-bar"><FlowBar kind="offline" onRetry={() => { void c.again([o.id, proof.current]); }} /></div>}
      {c.phase === 'failed' && <div class="dr-bar"><FlowBar kind="failed" code={c.code} onRetry={() => { void c.again([o.id, proof.current]); }} /></div>}
      <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={picked} />
    </main>
  );
}
