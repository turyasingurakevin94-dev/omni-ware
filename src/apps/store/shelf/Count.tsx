/*
 * shelf/count { key } · a spot count, blind (SH10 default, SH19 a key pressed, SH11 sending, SH12 sent, SH13 Ruth
 * asked: count it again, SH15 a count already waiting, SH17 not done, SH18 kept, SH25 someone else just did this).
 *
 * The books never show: a card per unit you can see, the keypad, what Ruth gets in the books' unit. One count
 * waits per item: counting it again replaces the one with Ruth when it is sent (DATA-01; W20, W20a).
 * shelf/count { aisle } is the aisle count (AisleCount.tsx, SH14).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { clock } from '../../../core/time.ts';
import { countLine, countsOf, inLineUnit, levelsOf, recountOf, spotName, spotPlace, waitingFor } from '../../../core/store/counts.ts';
import { aislesOf, letterOf, onShelf } from '../../../core/store/shelf.ts';
import type { ShelfItem, StockCount, YardBooks } from '../../../core/store/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { nav, type Params } from '../shell/nav.ts';
import { books, flush, now, online } from '../shell/store.ts';
import { AisleCount } from './AisleCount.tsx';
import { BlindRow, Levels, Pad, Seen, typed } from './count-parts.tsx';
import { person } from './Item.tsx';
import { GroupHead, ItemHead, ItemSheet, KeptCard, NoSignal, NotSaved, Nums, Over, SendButton, SentMoment, shortName, UndoPill } from './parts.tsx';
import { useSend } from './send.ts';

const first = (n: string) => n.split(' ')[0];
const ago = (at: number, n: number) => (n - at < 3600e3 ? 'just now' : clock(at));

/** The 9:21 count with Ruth: Count it again (it replaces it) or leave it. */
function Waiting(p: { b: YardBooks; it: ShelfItem; c: StockCount; onAgain: () => void }): JSX.Element {
  const b = p.b, mine = p.c.countedBy === b.me.userId, who = b.people.find((x) => x.userId === p.c.countedBy) || b.me, ruth = person(b, 'manager', 'Ruth Nakato');
  return (
    <Over top={300} eyebrow={p.it.name} title="A count is already waiting" onClose={() => nav.back()}
      foot={<><SendButton label="Count it again" icon="tally" onClick={p.onAgain} /><button type="button" class="sh-ghost" onClick={() => nav.back()}>{`Leave it with ${first(ruth.name)}`}</button></>}>
      <div class="sh-wait-card">
        <div class="sh-wait-r">
          <Avatar initials={who.initials} tint={who.tint} size={38} font={13} />
          <span><span>{mine ? 'Your count' : `${first(p.c.countedByName)}'s count`} · <span class="mono">{clock(p.c.createdAt)}</span></span><span>{levelsOf(p.it).length > 1 ? 'blind · cartons and loose' : 'blind'}</span></span>
          <span class="sh-chip ruth"><span aria-hidden="true" class="sh-chip-face">{ruth.initials}</span>{`With ${first(ruth.name)}`}</span>
        </div>
        <div role="img" aria-label={`Sent ${clock(p.c.createdAt)}, ${first(ruth.name)} is looking now, then the shelf takes it`} class="sh-track">
          <span aria-hidden="true" class="sh-track-l" /><span aria-hidden="true" class="sh-track-l done" />
          <span class="sh-track-s done"><span><Icon name="check" size={14} stroke={2.6} /></span><span>Sent</span><span class="mono">{clock(p.c.createdAt)}</span></span>
          <span class="sh-track-s now"><span><Icon name="clock" size={14} stroke={2.2} /></span><span>{`${first(ruth.name)} looks`}</span><span>now</span></span>
          <span class="sh-track-s next"><span><Icon name="tally" size={13} stroke={2} /></span><span>Shelf</span><span /></span>
        </div>
      </div>
      <div role="img" aria-label={`The new count replaces the ${clock(p.c.createdAt)} count`} class="sh-vs small">
        <span><s class="mono">{`${clock(p.c.createdAt)} count`}</s><span class="sh-vs-t"><span /><span>goes away</span></span></span>
        <span aria-hidden="true"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
        <span><span class="sh-vs-t"><span>New count</span><span>{`${first(ruth.name)} sees only this`}</span></span></span>
      </div>
    </Over>
  );
}

function Spot(p: { b: YardBooks; it: ShelfItem }): JSX.Element {
  const { b, it } = p, at = now.value, L = levelsOf(it), ruth = person(b, 'manager', 'Ruth Nakato'), joseph = b.people.find((x) => x.role === 'owner');
  const [values, setValues] = useState<(number | null)[]>(L.map(() => null)), [active, setActive] = useState(0);
  const waiting = waitingFor(b, spotPlace(it)), asked = recountOf(b, it.key);
  const [again, setAgain] = useState(false), [sentAt, setSentAt] = useState(at);
  const s = useSend();
  const aisle = aislesOf(b, at).find((a) => a.name === it.category);
  const total = inLineUnit(L, values), any = values.some((v) => v != null), busy = s.phase === 'held' || s.phase === 'kept';
  const lines = () => [countLine(it, total, onShelf(b, it.key))];
  const send = (old: StockCount | null) => {
    setSentAt(now.peek());
    const c = { aisle: spotName(it), lines: lines(), missing: [] };
    if (old) s.go(`Count of ${shortName(it.name)}`, 'replaceCount', [old.id, c]);
    else s.go(`Count of ${shortName(it.name)}`, 'sendCount', [c]);
  };
  if (s.phase === 'sent') {
    return (
      <SentMoment title={`Sent to ${first(ruth.name)}`} who={ruth} what={`${total} ${it.unit} · ${clock(sentAt)}`} end="Back to Today" onEnd={() => nav.home()} onClose={() => nav.home()}
        steps={[
          { icon: 'send', title: `Sent to ${first(ruth.name)}`, sub: `${clock(sentAt)} · ${shortName(it.name)} · blind` },
          { icon: 'clock', title: `${first(ruth.name)} checks it against the shelf`, sub: 'now · she accepts it or asks again' },
          { icon: 'tally', title: 'The shelf takes your count', sub: 'a push tells you either way' },
        ]}
        hears={[[ruth, 'gets a push', true], ...(joseph ? [[joseph, 'in the log only', false] as [typeof joseph, string, boolean]] : [])]} />
    );
  }
  // Someone else's count reached Ruth as this one went (SH25): send mine instead, or keep theirs.
  const clash = s.phase === 'clash' ? waiting : null;
  const key = (k: Parameters<typeof typed>[1]) => setValues(values.map((v, i) => (i === active ? typed(v, k) : v)));
  const sub = `${letterOf(b, it.category) || '?'} · ${it.category || 'No aisle yet'} · count what you see`;
  const other = clash ? b.people.find((x) => x.userId === clash.countedBy) : null;
  return (
    <>
      <ItemSheet back={() => nav.back()} backLabel="Back to the item" body="count" head={<ItemHead it={it} sub={sub} onClose={() => nav.tab('shelf')}><BlindRow ruth={ruth} /></ItemHead>}>
        {!online.value ? <NoSignal saved={clock(b.at)} onRetry={() => { void flush(); }} />
          : clash && other ? (
            <div role="status" class="sh-asked someone">
              <span class="sh-asked-f"><Avatar initials={other.initials} tint={other.tint} size={38} font={13} /><span aria-hidden="true"><Icon name="undo" size={11} stroke={2.6} /></span></span>
              <span class="sh-asked-t"><span>Someone else just did this</span><span>{`${first(other.name)} sent a count of this item · ${ago(clash.createdAt, at)}`}</span></span>
            </div>
          ) : asked && !any ? (
            <div role="status" class="sh-asked again">
              <span class="sh-asked-f"><Avatar initials={ruth.initials} tint={ruth.tint} size={38} font={13} /><span aria-hidden="true"><Icon name="undo" size={11} stroke={2.6} /></span></span>
              <span class="sh-asked-t"><span>{`${first(ruth.name)} asked: count it again`}</span><span>{ago(asked.decidedAt || at, at)} · replaces your <span class="mono">{clock(asked.createdAt)}</span> count</span></span>
            </div>
          ) : s.phase !== 'failed' && aisle && aisle.days != null ? (
            <div class="sh-last"><span aria-hidden="true"><Icon name="clock" size={17} stroke={2} /></span><span>{`Aisle ${aisle.letter} last counted `}<b class="mono">{aisle.days}</b>{` ${aisle.days === 1 ? 'day' : 'days'} ago`}</span></div>
          ) : null}
        <Levels it={it} levels={L} values={values} active={active} onPick={(i) => !busy && setActive(i)} caret={!busy && !clash && any} />
        {clash && other ? (
          <>
            <div role="img" aria-label={`${first(other.name)}'s count is with Ruth. Yours would replace it.`} class="sh-vs">
              <span><Avatar initials={other.initials} tint={other.tint} size={26} font={11} /><span class="sh-vs-t"><span>{`${first(other.name)}'s`}</span><span>{`with ${first(ruth.name)}`}</span></span></span>
              <span aria-hidden="true"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
              <span><Avatar initials={b.me.initials} tint="t4" size={26} font={11} /><span class="sh-vs-t"><span>Yours</span><span>would replace it</span></span></span>
            </div>
            <SendButton label="Send mine instead" onClick={() => send(clash)} />
            <button type="button" class="sh-ghost" onClick={() => nav.back()}>{`Keep ${first(other.name)}'s`}</button>
            <GroupHead dot="#5F6980" title="Counts of this item" meta={String(countsOf(b, it.key).filter((c) => c.createdAt > at - 864e5).length + 1)} />
            <div class="sh-card">
              {countsOf(b, it.key).filter((c) => c.createdAt > at - 864e5).map((c) => {
                const who = b.people.find((x) => x.userId === c.countedBy) || b.me, mine = c.countedBy === b.me.userId;
                return (
                  <div key={c.id} class="sh-mv">
                    <span aria-hidden="true" class="sh-mv-i" style={{ background: c.status === 'sent' ? '#E3EEFB' : '#F1EEE8', color: c.status === 'sent' ? '#1A5A8A' : '#5F6980' }}><Icon name="tally" size={16} stroke={2} /></span>
                    <span class="sh-mv-t"><span>{mine ? `Your ${clock(c.createdAt)} count` : `${first(c.countedByName)}'s count · with ${first(ruth.name)}`}</span><span class="mono">{c.status === 'replaced' ? `replaced by ${first(other.name)}'s` : `${ago(c.createdAt, at)} · blind`}</span></span>
                    {c.status === 'replaced' ? <span class="sh-mv-gone">gone</span> : <Avatar initials={who.initials} tint={who.tint} size={24} font={11} />}
                  </div>
                );
              })}
              <div class="sh-mv">
                <span aria-hidden="true" class="sh-mv-i" style={{ background: '#F1EEE8', color: '#5F6980' }}><Icon name="tally" size={16} stroke={2} /></span>
                <span class="sh-mv-t"><span>Your count now</span><span class="mono">{`not sent · ${L.map((l, i) => `${values[i] || 0} ${l.unit}`).join(' + ')}`}</span></span>
                <Avatar initials={b.me.initials} tint="t4" size={24} font={11} />
              </div>
            </div>
          </>
        ) : (
          <>
            <Seen levels={L} values={values} unit={it.unit} />
            <Pad onKey={key} off={busy} plusLabel={`Add one ${L[active].unit === 'ctn' ? 'carton' : L[active].unit}`} />
            {s.phase === 'held' && <UndoPill />}
            {s.phase === 'kept' ? <KeptCard to={first(ruth.name)} onRemove={s.remove} />
              : s.phase === 'failed' ? <NotSaved sub={<>Your <Nums text={`${total}`} /> {it.unit} is kept on this phone · tell Kevin · code <span class="mono">{s.code}</span></>} onRetry={s.retry} onClose={s.reset} />
              : <SendButton label={any ? `Send to ${first(ruth.name)} · ${total} ${it.unit}` : `Send to ${first(ruth.name)}`} state={s.phase === 'held' ? 'sending' : any ? 'idle' : 'disabled'}
                onClick={() => send(again || (waiting && waiting.status === 'sent') ? waiting : null)} />}
          </>
        )}
      </ItemSheet>
      {waiting && !again && !asked && s.phase === 'idle' && !clash && <Waiting b={b} it={it} c={waiting} onAgain={() => setAgain(true)} />}
    </>
  );
}

export function Count(p: { params: Params }): JSX.Element {
  const b = books.value;
  if (!b) return <main class="sh-wait" aria-busy="true" />;
  if (p.params.aisle != null && !p.params.key) return <AisleCount aisle={String(p.params.aisle)} />;
  const it = b.items.find((x) => x.key === String(p.params.key));
  if (!it) return <main class="sh-wait"><p class="sh-gone">That item is not on the list any more.</p></main>;
  return <Spot b={b} it={it} />;
}
