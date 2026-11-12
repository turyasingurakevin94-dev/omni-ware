/*
 * shelf/ask · SH30 We need more, SH31 Sent to Denis.
 *
 * Over the item: what is on the shelf (a block a tin, dashed for what you ask), how soon (Running low · We're
 * out, prefilled), about how many (prefilled, a guess: Denis decides), what Denis will answer, navy "Send to
 * Denis" with Undo 10 s (restock.ts; W16). Then the Sent screen: on the restock list · comes on a trip.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { clock } from '../../../core/time.ts';
import { letterOf, onShelf, weekOut } from '../../../core/store/shelf.ts';
import { restockGuess, restockOf, restockUnit, restockWhen, shortFor } from '../../../core/store/restock.ts';
import type { ShelfItem, YardBooks } from '../../../core/store/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Duo, Icon, phHourglass } from '../../../ui/icons.tsx';
import { Stepper } from '../../../ui/Stepper.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav, type Params } from '../shell/nav.ts';
import { books, now } from '../shell/store.ts';
import { ItemPic } from './glyphs.tsx';
import { ItemView, person } from './Item.tsx';
import { KeptCard, NotSaved, Over, SendButton, SentMoment, shortName, UndoPill } from './parts.tsx';
import { useSend } from './send.ts';
import './ask.css';

function AskSheet(p: { b: YardBooks; it: ShelfItem; at: number }): JSX.Element {
  const { b, it, at } = p, shelf = onShelf(b, it.key), short = shortFor(b, it.key, shelf), unit = restockUnit(it);
  const [when, setWhen] = useState<'out' | 'low'>(restockWhen(short, shelf)), [qty, setQty] = useState(restockGuess(weekOut(b, it.key, at), shelf));
  const s = useSend(), denis = person(b, 'buyer', 'Denis Okello'), ruth = person(b, 'manager', 'Ruth Nakato'), sentAt = useState(at)[0];
  if (s.phase === 'sent') {
    return (
      <SentMoment title={`Sent to ${denis.name.split(' ')[0]}`} who={denis} what={`${shortName(it.name)} · ${qty} ${unit}`} end="Back to Today" onEnd={() => nav.home()} onClose={() => nav.home()}
        steps={[
          { icon: 'send', title: `Sent to ${denis.name.split(' ')[0]}`, sub: `${clock(sentAt)} · ${when === 'out' ? 'we’re out' : 'running low'} · about ${qty} ${unit}` },
          { icon: 'cart', title: 'On the restock list · next trip', sub: 'now · his answer comes back', on: () => nav.replace('shelf/item', { key: it.key }) },
          { icon: 'arrow-down', title: 'It comes in on a trip', sub: 'you check it in when it’s back at the yard' },
        ]}
        hears={[[denis, 'gets a push', true], [ruth, 'sees the list', false]]} />
    );
  }
  const busy = s.phase === 'held';
  const room = Math.min(24, Math.max(12, shelf + qty));
  return (
    <Over top={250} eyebrow={`${it.name} · aisle ${letterOf(b, it.category) || '?'}`} title="We need more" onClose={() => nav.back()}
      foot={
        <>
          {s.phase === 'idle' && <div class="sh-ask-ans"><Avatar initials={denis.initials} tint={denis.tint} size={26} font={11} /><span>{`${denis.name.split(' ')[0]} answers: “On the restock list · next trip”`}</span></div>}
          {busy && <UndoPill />}
          {s.phase === 'kept' ? <KeptCard to={denis.name.split(' ')[0]} onRemove={s.remove} />
            : s.phase === 'failed' ? <NotSaved sub={<>Kept on this phone · tell Kevin · code <span class="mono">{s.code}</span></>} onRetry={s.retry} onClose={s.reset} />
            : <SendButton label={`Send to ${denis.name.split(' ')[0]}`} state={busy ? 'sending' : 'idle'} onClick={() => s.go('We need more', 'restock', [restockOf(it, qty, when, short)])} />}
        </>
      }>
      <div class="sh-ask-shelf">
        <div class="sh-ask-r"><ItemPic it={it} size={36} radius={10} /><span><span class="mono">{shelf}</span><span>{`${it.unit} on shelf`}</span></span>{when === 'low' && <span class="sh-chip low">Low</span>}</div>
        <span role="img" aria-label={`${shelf} on the shelf, room for ${room}`} class="sh-ask-blocks">
          {Array.from({ length: room }, (_, i) => <span key={i} class={i < shelf ? 'on' : ''} />)}
        </span>
        <span class="sh-ask-l"><span>on the shelf</span><span>you ask for <span class="mono">{qty}</span> more</span></span>
      </div>
      <div role="radiogroup" aria-label="How soon" class="sh-ask-when">
        {([['low', 'Running low', 'the next trip is fine'], ['out', 'We’re out', 'orders are waiting']] as const).map(([k, w, sub]) => (
          <button key={k} type="button" role="radio" aria-checked={when === k} disabled={busy} class={cx('sh-ask-opt', when === k && 'on')} onClick={() => setWhen(k)}>
            <span aria-hidden="true" class={k}>{k === 'low' ? <Duo i={phHourglass} size={20} /> : <Icon name="warning" size={19} stroke={2} />}</span>
            <span><span>{w}</span><span>{sub}</span></span>
            <span aria-hidden="true" class="sh-ask-dot">{when === k && <Icon name="check" size={13} stroke={3} />}</span>
          </button>
        ))}
      </div>
      <div class="sh-ask-n">
        <span><span>About how many</span><span>{`a guess is fine · ${denis.name.split(' ')[0]} decides`}</span></span>
        <Stepper value={qty} unit={unit} min={1} what={unit} onChange={(n) => !busy && setQty(n)} />
      </div>
    </Over>
  );
}

export function Ask(p: { params: Params }): JSX.Element {
  const b = books.value, it = b ? b.items.find((x) => x.key === String(p.params.key)) : null;
  if (!b || !it) return <main class="sh-wait" aria-busy="true" />;
  return <><ItemView it={it} bare /><AskSheet b={b} it={it} at={now.value} /></>;
}
