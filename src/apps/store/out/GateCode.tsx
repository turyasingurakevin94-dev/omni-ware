/*
 * The agent's code (out/gate-code { id? }; OU11 matches, OU09 wrong code). An agent collects by a 4-digit
 * code, which is his order number: four boxes, the keypad, what he takes and since when. A match turns the
 * boxes green and opens the slide (W9 hand over, agent); a wrong code turns them red, "Not #0554 · ask Peter
 * to read it again", and locks the slide. The keypad rests once four are typed; ⌫ starts again.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { firstWord, orderNo } from '../../../core/names.ts';
import { atTheGate, codeOf, codeSays, isAgent } from '../../../core/store/gate.ts';
import { clock } from '../../../core/time.ts';
import { orderFace, yardFace } from '../../../core/store/faces.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav, type Params } from '../shell/nav.ts';
import { books, me, now } from '../shell/store.ts';
import { useCommit } from './commit.ts';
import { Done } from './Done.tsx';
import { GateLine } from './Gate.tsx';
import { OIcon } from './icons.tsx';
import { seller, SheetDock } from './parts.tsx';

export function GateCode(p: { params: Params }): JSX.Element {
  const b = books.value, n = now.value;
  const want = p.params.id != null ? Number(p.params.id) : null;
  const o = b ? (want != null ? b.orders.find((x) => x.id === want) : atTheGate(b, me.value, n).find(isAgent)) || null : null;
  const [typed, setTyped] = useState('');
  const c = useCommit('handOver', o ? o.id : 0);
  if (!b || !o) return <main class="st-ph" />;
  const says = codeSays(o, typed), name = firstWord(o.client.name), from = seller(b, o);
  const key = (d: string) => { if (typed.length < 4) setTyped(typed + d); };
  if (c.phase === 'done') {
    return (
      <Done mark="hand-over" title="Handed over" chip={{ face: orderFace(o, b), name: o.client.name, sub: `${orderNo(o.id)} · code ${codeOf(o)}` }}
        sees={[...(from ? [{ face: yardFace(b, from), who: firstWord(from.name), what: 'Delivered · collected' }] : []), { face: orderFace(o, b), who: name, what: 'Delivered · collected' }]}
        next={[{ icon: 'delivered', title: 'Delivered · collected', sub: `${clock(n)} · by his code` }, { icon: 'receipt', title: 'The bill', sub: 'goes by itself after 24 h' }]}
        undo={`Collected ${clock(n)} · ${name}`} />
    );
  }
  const lines = o.lines.filter((l) => !l.dropped);
  const hint = says === 'wrong' || says === 'short' ? { icon: 'lock' as const, text: 'His code = his order number' }
    : { icon: 'bell' as const, text: `${[from ? firstWord(from.name) : null, name].filter(Boolean).join(' and ')} see: Delivered · collected`, iconTone: 'mint' as const };
  return (
    <div class="gc">
      <button type="button" aria-label="Back to the gate" class="gc-scrim" style={{ border: 'none', padding: 0 }} onClick={() => nav.back()} />
      <div role="dialog" aria-label={`${name}'s code`} class="gc-sh">
        <span aria-hidden="true" class="gc-grab" />
        <div class="gc-top">
          <Avatar {...orderFace(o, b)} size={44} font={15} style={{ letterSpacing: '-.02em' }} />
          <div class="gc-top-t"><span>{`${orderNo(o.id)} · agent pickup`}</span><h2>{`${name}'s code`}</h2></div>
          <button type="button" class="gc-x" aria-label="Close" onClick={() => nav.back()}><Icon name="close" size={16} stroke={2.2} /></button>
        </div>
        <div class="gc-body">
          <div role="group" aria-label={`Code ${typed.split('').join(' ') || 'not typed'}`} class="gc-boxes">
            {[0, 1, 2, 3].map((i) => <span key={i} class={cx('gc-box', says === 'match' && 'ok', says === 'wrong' && 'bad')}>{typed[i] || ''}</span>)}
          </div>
          <div class={cx('gc-says', says === 'match' && 'ok', says === 'wrong' && 'bad')} role="status">
            {says === 'match' && <><Icon name="check" size={15} stroke={3} />{`Matches ${orderNo(o.id)} · ${o.client.name}`}</>}
            {says === 'wrong' && <><OIcon name="x-circle" size={15} stroke={2.4} />{`Not ${orderNo(o.id)} · ask ${name} to read it again`}</>}
          </div>
          <div class={cx('gc-keys', says === 'match' && 'rest')}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} type="button" class="gc-key" disabled={typed.length >= 4} onClick={() => key(d)}>{d}</button>)}
            <span />
            <button type="button" class="gc-key" disabled={typed.length >= 4} onClick={() => key('0')}>0</button>
            <button type="button" class="gc-key back" aria-label="Delete" onClick={() => setTyped(says === 'wrong' ? '' : typed.slice(0, -1))}><Icon name="backspace" size={20} stroke={1.9} /></button>
          </div>
          <div class="ou-card">{lines.map((_, i) => <GateLine key={i} b={b} o={o} i={i} tail={`packed ${clock(o.pickingDoneAt ?? n)}`} />)}</div>
          <div class="gc-ready"><Icon name="store" size={16} stroke={2.2} /><span>{`${orderNo(o.id)} · ready since ${clock(o.pickingDoneAt ?? o.stageEnteredAt ?? n)}`}</span><span class="mono">{`${lines.length} line${lines.length === 1 ? '' : 's'}`}</span></div>
        </div>
        <SheetDock hint={c.phase === 'kept' ? { icon: 'clock', text: 'Sends when the signal is back', tone: 'amber' } : hint}>
          {c.phase === 'sending' ? <Slide label="" onCommit={() => undefined} state="sending" sendWord="Handing over…" />
            : c.phase === 'kept' ? <Slide label="Not sent yet" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Not sent yet' }} />
              : says !== 'match' ? <Slide label="Code first" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Code first' }} />
                : <Slide label={`Slide to hand over to ${name}`} onCommit={() => c.commit(`Handed over ${orderNo(o.id)}`, [o.id, o.client.name, true])}
                  onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />}
        </SheetDock>
      </div>
    </div>
  );
}
