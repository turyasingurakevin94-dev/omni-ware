/*
 * Ready to collect · Not paid yet (OU13; out/gate { id } for an order the money still holds). It stays at
 * the gate: the Store taps nothing, the pushes went when it reached the gate (Grace takes the money, Ruth
 * may let it go). Call Grace · Call them · Ask Ruth (her face's teal, spec §2a; W11). The slide is locked: "Stays until paid".
 */
import type { JSX } from 'preact';
import { firstWord, orderNo, phoneText } from '../../../core/names.ts';
import { trackTimes } from '../../../core/store/load.ts';
import type { YardBooks, YardOrder } from '../../../core/store/types.ts';
import { clock } from '../../../core/time.ts';
import { ActBar } from '../../../ui/ActTiles.tsx';
import { orderFace, yardFace } from '../../../core/store/faces.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { FullSheet, SheetHead } from '../../../ui/FullSheet.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { Track } from '../../../ui/Track.tsx';
import { backTo, nav } from '../shell/nav.ts';
import { act, now } from '../shell/store.ts';
import { GateLine, GatePic } from './Gate.tsx';
import { manager, NotPaid, seller, SheetDock } from './parts.tsx';

const tel = (p: string) => 'tel:+256' + p.replace(/[^0-9]/g, '').replace(/^0/, '').replace(/^256/, '');

export function NotPaidGate(p: { b: YardBooks; o: YardOrder }): JSX.Element {
  const { b, o } = p, n = now.value, g = seller(b, o), r = manager(b), t = trackTimes(o);
  const told = clock(o.stageEnteredAt ?? n);
  const ask = async () => {
    try { await act('askLetGo', o.id, null); toast.show(`Sent to ${r ? firstWord(r.name) : 'Ruth'}`, { kind: 'ok' }); } catch (_e) { /* the bar says it */ }
  };
  const head = (
    <SheetHead face={orderFace(o, b)} name={o.client.name} sub={`${orderNo(o.id)} · today ${clock(o.createdAt ?? n)}`} subMono phone={o.client.phone}
      onClose={() => nav.to('out/gate')} style={{ padding: '10px 20px 18px', gap: '14px' }}>
      <Track stage="road" word="Ready to collect" sub="Not paid yet · leaves when paid" waits ready skipped={t.skipped}
        times={{ checking: t.checking != null ? clock(t.checking) : undefined }} />
    </SheetHead>
  );
  const foot = (
    <SheetDock hint={{ icon: 'bell', text: 'Opens when paid', iconTone: 'mint' }}>
      <Slide label="Stays until paid" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Stays until paid' }} />
    </SheetDock>
  );
  return (
    <FullSheet onBack={() => nav.back()} backLabel={backTo.value} head={head} foot={foot} pad="14px 16px 14px" gap={14}>
      <div class="gt-card">
        <GatePic since={o.stageEnteredAt ?? n} held />
        <div class="gt-body held">
          {o.lines.filter((l) => !l.dropped).map((_, i) => <GateLine key={i} b={b} o={o} i={i} tail="leaves when paid" pill={<NotPaid />} />)}
        </div>
      </div>
      <div class="gt-told">
        {g && <div><Avatar initials={g.initials} tint="me" size={28} font={11} style={{ letterSpacing: '-.02em' }} /><span><b>{firstWord(g.name)}</b> takes the money · <i>told {told}</i></span></div>}
        {r && <div><Avatar {...yardFace(b, r)} size={28} font={11} style={{ letterSpacing: '-.02em' }} /><span><b>{firstWord(r.name)}</b> may let it go · <i>told {told}</i></span></div>}
      </div>
      <div class="gt-acts">
        <ActBar acts={[
          ...(g ? [{ tone: 'call' as const, icon: 'phone' as const, word: `Call ${firstWord(g.name)}`, sub: 'she takes it', href: tel(g.phone || '0772000101'), label: `Call ${g.name}` }] : []),
          { tone: 'tell', icon: 'phone', word: 'Call them', sub: /walk-?in/i.test(o.client.name) ? 'the walk-in' : o.client.name, href: tel(o.client.phone), label: `Call ${o.client.name}, ${phoneText(o.client.phone)}` },
          ...(r ? [{ tone: 'teal' as const, icon: 'hand-over' as const, word: `Ask ${firstWord(r.name)}`, sub: 'to let it go', on: () => { void ask(); }, label: `Ask ${r.name} to let it go on credit` }] : []),
        ]} />
      </div>
    </FullSheet>
  );
}
