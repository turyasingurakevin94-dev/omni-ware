/*
 * shelf/report { key, why? } · SH20 (default), SH21 sent, SH23 nothing on the shelf, SH26 not sent yet, SH27 not done.
 *
 * One item, one reason (Damaged · Lost · Stolen), how many in the unit you see (a switch never multiplies it, Pre 3;
 * never past the shelf), a photo, a word for Ruth; navy "Send to Ruth" with Undo 10 s (report.ts; W17). Ruth decides:
 * write it off or keep it. Nothing on the shelf: no report, "Count it now" (DATA-03). Found while packing: the strip
 * goes back to that order, and so does the end ("Back to packing #0552").
 */
import { orderFace, personFace } from '../../../core/store/faces.ts';
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { orderNo } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import { aislesOf, letterOf, onShelf } from '../../../core/store/shelf.ts';
import { asPieces, canReport, lossOf, reportMax, REASONS, type Why } from '../../../core/store/report.ts';
import type { ShelfItem, YardBooks } from '../../../core/store/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { cx, Tap } from '../../../ui/util.tsx';
import { nav, type Params } from '../shell/nav.ts';
import { books, flush, isDemo, now, online } from '../shell/store.ts';
import { foundDone, foundFor } from './found.ts';
import { Glyph, ItemPic } from './glyphs.tsx';
import { person } from './Item.tsx';
import { ItemHead, ItemSheet, KeptCard, nameRest, NoSignal, NotSaved, SendButton, SentMoment, shortName, UndoPill } from './parts.tsx';
import { itemState, StateChips } from './rows.tsx';
import { useSend } from './send.ts';
import './report.css';

const first = (n: string) => n.split(' ')[0];

function photoPick(set: (b: Blob) => void): void {
  const el = document.createElement('input');
  el.type = 'file'; el.accept = 'image/*'; el.setAttribute('capture', 'environment');
  el.onchange = () => { if (el.files && el.files[0]) set(el.files[0]); };
  el.click();
}

/** Nothing on the shelf (SH23): the form waits, count it first; what it may be instead. */
function Empty(p: { b: YardBooks; it: ShelfItem; at: number }): JSX.Element {
  const { b, it, at } = p, aisle = aislesOf(b, at).find((a) => a.name === it.category);
  const came = b.orders.find((o) => o.status === 'preparing' && o.lines.some((l) => l.key === it.key && l.receivedQty));
  const sib = b.items.find((x) => x.key !== it.key && x.category === it.category && x.name.split(/[ ,]/)[0] === it.name.split(/[ ,]/)[0] && onShelf(b, x.key) > 0);
  return (
    <>
      <div aria-hidden="true" class="sh-rp-ghost">
        <div><span>Report a loss</span><span>opens when the shelf has some</span></div>
        <div class="sh-rp-ghost-t">{REASONS.map((r) => <span key={r.why}><Glyph g={r.why} size={22} stroke={1.8} />{r.word}</span>)}</div>
        <span class="sh-rp-ghost-f" />
      </div>
      <div class="sh-rp-none"><span>Nothing on the shelf to report</span><span>If the shelf is wrong, count it first</span></div>
      <SendButton label="Count it now" icon="tally" onClick={() => nav.replace('shelf/count', { key: it.key })} />
      {aisle && aisle.days != null && <div class="sh-rp-note"><Icon name="tally" size={16} stroke={2} /><span>{`Aisle ${aisle.letter} last counted `}<span class="mono">{aisle.days}</span>{` ${aisle.days === 1 ? 'day' : 'days'} ago`}</span></div>}
      {came && (
        <Tap on={() => nav.push('pack/order', { id: came.id })} class="sh-rp-alt" label={`Pack ${orderNo(came.id)} short`}>
          <Avatar {...orderFace(came, b)} size={34} font={12} />
          <span><span>{`One of ${orderNo(came.id)}'s ${(came.lines.find((l) => l.key === it.key) || { receivedQty: 0 }).receivedQty} damaged?`}</span><span>pack it short · Ruth settles</span></span>
          <span aria-hidden="true" class="sh-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
        </Tap>
      )}
      {sib && (
        <Tap on={() => nav.replace('shelf/report', { key: sib.key })} class="sh-rp-alt" label={`Report ${sib.name} instead`}>
          <ItemPic it={sib} size={36} radius={10} />
          <span><span>{`${sib.name}?`}</span><span class="sh-rp-alt-s"><StateChips b={b} it={sib} s={itemState(b, sib, at)} ruth={personFace(b.people.find((x) => x.role === 'manager'))} /><span>report this one</span></span></span>
          <span aria-hidden="true" class="sh-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
        </Tap>
      )}
    </>
  );
}

function Form(p: { b: YardBooks; it: ShelfItem; why: Why | null; found: ReturnType<typeof foundFor> }): JSX.Element {
  const { b, it } = p, at = now.value, shelf = onShelf(b, it.key), found = p.found, ruth = person(b, 'manager', 'Ruth Nakato'), joseph = b.people.find((x) => x.role === 'owner');
  const per = it.packQty > 1 ? it.packQty : 1;
  const [why, setWhy] = useState<Why>(p.why || (found ? found.why : 'damaged')), [pieces, setPieces] = useState(Math.min(reportMax(shelf), found ? found.qty : 1)), [inPack, setInPack] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(isDemo && found ? new Blob(['demo'], { type: 'image/jpeg' }) : null), [photoAt] = useState(at);
  const [note, setNote] = useState(found ? found.note : ''), [noting, setNoting] = useState(false);
  const s = useSend(), order = found && found.orderId ? b.orders.find((o) => o.id === found.orderId && o.status === 'preparing') : null;
  const off = s.phase !== 'idle';
  useEffect(() => { if (s.phase === 'kept') foundDone(it.key); }, [s.phase]);
  const set = (n: number) => setPieces(Math.max(1, Math.min(reportMax(shelf), n)));
  const shown = inPack ? Math.floor(pieces / per) : pieces;
  if (s.phase === 'sent') {
    const back = order ? `Back to packing ${orderNo(order.id)}` : 'Back to Today';
    return (
      <SentMoment title={`Sent to ${first(ruth.name)}`} who={ruth} what={`${pieces} ${it.unit} · ${note || why}`} end={back} onEnd={() => (order ? nav.replace('pack/order', { id: order.id }) : nav.home())} onClose={() => nav.home()}
        steps={[
          { icon: 'send', title: `Sent to ${first(ruth.name)}`, sub: `${clock(at)} · ${shortName(it.name)}${photo ? ' · photo' : ''}` },
          { icon: 'clock', title: `${first(ruth.name)} decides`, sub: 'now · write it off or keep it', on: () => nav.replace('shelf/item', { key: it.key }) },
          { icon: 'orders', title: 'The shelf moves', sub: `${shelf} → ${shelf - pieces} if she writes it off` },
        ]}
        hears={[[ruth, 'gets a push', true], ...(joseph ? [[joseph, 'in the log only', false] as [typeof joseph, string, boolean]] : [])]} />
    );
  }
  const send = () => { s.go(`Report of ${shortName(it.name)}`, 'reportLoss', [lossOf(it, asPieces(pieces, 1), why, photo, note)]); };
  return (
    <>
      {!online.value && <NoSignal saved={clock(b.at)} onRetry={() => { void flush(); }} />}
      <div class={cx('sh-rp-form', (s.phase === 'kept' || s.phase === 'failed' || s.phase === 'held') && 'dim')}>
        <span class="sh-rp-h">What happened</span>
        <div role="group" aria-label="What happened" class="sh-rp-why">
          {REASONS.map((r) => (
            <button key={r.why} type="button" aria-pressed={why === r.why} disabled={off} class={cx(why === r.why && 'on')} onClick={() => setWhy(r.why)}>
              {why === r.why && <span aria-hidden="true" class="sh-rp-tick"><Icon name="check" size={12} stroke={3} /></span>}
              <span aria-hidden="true" class={cx('sh-rp-i', why === r.why && r.why)}><Glyph g={r.why} size={22} stroke={1.8} /></span>
              <span>{r.word}</span><span>{r.sub}</span>
            </button>
          ))}
        </div>
        <span class="sh-rp-h">How many</span>
        <div class="sh-rp-n">
          <div class="sh-rp-step">
            <button type="button" aria-label="Fewer" disabled={off} onClick={() => set(pieces - (inPack ? per : 1))}><Icon name="minus" size={18} stroke={2.2} /></button>
            <span class="mono">{shown}<span>{inPack ? it.packUnit : it.unit}</span>{inPack && pieces % per ? <span>{` + ${pieces % per} ${it.unit}`}</span> : null}</span>
            <button type="button" aria-label="More" disabled={off} onClick={() => set(pieces + (inPack ? per : 1))}><Icon name="plus" size={18} stroke={2.2} /></button>
          </div>
          {per > 1 && (
            <div role="radiogroup" aria-label="Unit" class="sh-rp-unit">
              <button type="button" role="radio" aria-checked={!inPack} class={cx(!inPack && 'on')} onClick={() => setInPack(false)}>{it.unit}</button>
              <button type="button" role="radio" aria-checked={inPack} class={cx(inPack && 'on')} onClick={() => setInPack(true)}>{it.packUnit}</button>
            </div>
          )}
        </div>
        <div class="sh-rp-photo">
          <span role="img" aria-label={photo ? 'The photo' : 'No photo yet'} class={cx('sh-rp-pic', !photo && 'none')}>{photo ? <svg viewBox="0 0 104 78" width="104" height="78" aria-hidden="true"><path d="M0 30 Q26 18 52 30 T104 30 M0 46 Q26 34 52 46 T104 46 M0 62 Q26 50 52 62 T104 62" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3" /></svg> : <Icon name="camera" size={24} stroke={1.8} />}</span>
          <span><span>{photo ? 'Photo taken' : 'Take a photo'}</span><span>{photo ? <>{`${first(ruth.name)} sees it · `}<span class="mono">{clock(photoAt)}</span></> : `${first(ruth.name)} sees it`}</span></span>
          <button type="button" disabled={off} onClick={() => photoPick(setPhoto)}><Icon name="camera" size={16} stroke={2} />{photo ? 'Retake' : 'Take'}</button>
        </div>
        {why === 'damaged' && <div class="sh-rp-note"><Glyph g="carton" size={16} /><span>{`Set the ${pieces} aside, away from the good ${per > 1 ? `${it.packUnit}s` : 'ones'}`}</span></div>}
        <div class="sh-rp-ruth"><Avatar initials={ruth.initials} tint={ruth.tint} size={24} font={11} /><span>{`${first(ruth.name)} decides: write it off or keep it · Undo for `}<span class="mono">10</span> s</span></div>
        {s.phase === 'idle' && (noting
          ? <textarea class="sh-rp-word" aria-label={`A word for ${first(ruth.name)}`} value={note} autoFocus onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} />
          : <button type="button" class="sh-rp-add" onClick={() => setNoting(true)}><Icon name="note" size={18} stroke={2} />{`Add a word for ${first(ruth.name)}`}</button>)}
      </div>
      {s.phase === 'held' && <UndoPill />}
      {s.phase === 'kept' ? <KeptCard to={first(ruth.name)} onRemove={s.remove} />
        : s.phase === 'failed' ? <NotSaved sub={<>Kept on this phone · tell Kevin · code <span class="mono">{s.code}</span></>} onRetry={s.retry} onClose={s.reset} />
        : <SendButton label={`Send to ${first(ruth.name)} · ${pieces} ${it.unit}`} state={s.phase === 'held' ? 'sending' : 'idle'} onClick={send} />}
    </>
  );
}

export function Report(p: { params: Params }): JSX.Element {
  const b = books.value, it = b ? b.items.find((x) => x.key === String(p.params.key)) : null;
  // The note it was found by stays on this screen once the report is kept (SH26).
  const [first0] = useState(() => foundFor(String(p.params.key)));
  if (!b || !it) return <main class="sh-wait" aria-busy="true" />;
  const at = now.value, shelf = onShelf(b, it.key), found = first0, letter = letterOf(b, it.category) || '?';
  const foundO = found && found.orderId ? b.orders.find((x) => x.id === found.orderId) : undefined;
  const came = b.orders.find((o) => o.status === 'preparing' && o.lines.some((l) => l.key === it.key && l.receivedQty));
  const rest = nameRest(it.name);
  const head = (
    <ItemHead it={it} title={`Report · ${shortName(it.name)}`} sub={canReport(shelf) ? `${letter} · ${it.category} · ${shelf} on shelf` : `${rest ? rest + ' · ' : ''}${letter} · ${it.category}`} onClose={() => nav.back()}>
      {canReport(shelf) ? (found && found.orderId ? (
        <Tap on={() => nav.push('pack/order', { id: found.orderId as number })} class="sh-rp-from" label={`Found while packing ${orderNo(found.orderId)}`}>
          {foundO && <Avatar {...orderFace(foundO, b)} size={30} font={11} />}<span>Found <span class="mono">{clock(found.at)}</span>{` · packing ${orderNo(found.orderId)}`}</span><span aria-hidden="true"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
        </Tap>
      ) : null) : (
        <div class="sh-rp-zero">
          <span><span class="mono">0</span><span>{`${it.unit} on shelf`}</span></span>
          {came && <span class="sh-rp-in"><Avatar {...orderFace(came, b)} size={24} font={11} />Order in · <span class="mono">{(came.lines.find((l) => l.key === it.key) || { receivedQty: 0 }).receivedQty}</span>{` came for ${orderNo(came.id)}`}</span>}
        </div>
      )}
    </ItemHead>
  );
  return (
    <ItemSheet back={() => nav.back()} backLabel="Back to the item" head={head} body={canReport(shelf) ? 'report' : 'noaisle'}>
      {canReport(shelf) ? <Form b={b} it={it} why={(p.params.why as Why) || null} found={found} /> : <Empty b={b} it={it} at={at} />}
    </ItemSheet>
  );
}
