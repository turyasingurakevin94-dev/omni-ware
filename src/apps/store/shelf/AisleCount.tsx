/*
 * shelf/count { aisle } · SH14 the aisle count, blind.
 *
 * The aisle in the order it stands: counted (with what Ruth gets, a pen to change it), can't find (Ruth sees it,
 * Found it), the one being counted (a box per unit you see, Can't find), the rest to go (30 at a time; an item
 * whose count waits with Ruth says this count replaces it). Keep for later keeps it on this phone; Send to Ruth
 * opens when every item is counted or not found (a partial count rides what could not be found apart, Pre 1).
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { aislePlace, aisleName, countLine, inLineUnit, levelsOf, spotPlace, waitingFor, type Level } from '../../../core/store/counts.ts';
import { aislesOf, onShelf } from '../../../core/store/shelf.ts';
import type { ShelfItem, YardBooks } from '../../../core/store/types.ts';
import { Icon } from '../../../ui/icons.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx, Tap } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { books, isDemo, now } from '../shell/store.ts';
import { ItemPic } from './glyphs.tsx';
import { person } from './Item.tsx';
import { KeptCard, NotSaved, SentMoment, UndoPill, unitWord } from './parts.tsx';
import { useSend } from './send.ts';
import './aislecount.css';

type Got = (number | null)[] | 'missing';
const KEEP = (a: string) => `ow-store-aislecount:${a}`;

function load(a: string): Record<string, Got> {
  if (isDemo) return {};
  try { return JSON.parse(localStorage.getItem(KEEP(a)) || '{}') as Record<string, Got>; } catch (_e) { return {}; }
}

/** A number box with − and +: type it, or step it. */
function Box(p: { value: number | null; unit: string; label: string; onChange: (n: number | null) => void }): JSX.Element {
  return (
    <div class="sh-box">
      <button type="button" aria-label={`Fewer ${p.label}`} onClick={() => p.onChange(Math.max(0, (p.value || 0) - 1))}><Icon name="minus" size={18} stroke={2.2} /></button>
      <label><input inputMode="numeric" aria-label={`How many ${p.label}`} value={p.value == null ? '' : String(p.value)} placeholder="–"
        onInput={(e) => { const v = (e.target as HTMLInputElement).value.replace(/\D/g, ''); p.onChange(v ? Number(v) : null); }} /><span>{p.unit}</span></label>
      <button type="button" aria-label={`More ${p.label}`} onClick={() => p.onChange((p.value || 0) + 1)}><Icon name="plus" size={18} stroke={2.2} /></button>
    </div>
  );
}

const shown = (L: Level[], v: (number | null)[], unit: string) => (L.length > 1 ? `${L.map((l, i) => `${v[i] || 0} ${l.unit}`).join(' + ')} → ${inLineUnit(L, v)} ${unit}` : `${v[0] || 0} ${unit}`);

export function AisleCount(p: { aisle: string }): JSX.Element {
  const b = books.value as YardBooks, at = now.value, a = aislesOf(b, at).find((x) => x.name === p.aisle);
  const [got, setGot] = useState<Record<string, Got>>(() => load(p.aisle)), [cur, setCur] = useState<string | null>(null), [page, setPage] = useState(1);
  const s = useSend(), ruth = person(b, 'manager', 'Ruth Nakato');
  useEffect(() => { if (!isDemo) try { localStorage.setItem(KEEP(p.aisle), JSON.stringify(got)); } catch (_e) { /* kept for this visit */ } }, [got]);
  if (!a) return <main class="sh-wait"><p class="sh-gone">No such aisle.</p></main>;
  const items = a.items, done = items.filter((it) => Array.isArray(got[it.key])), missing = items.filter((it) => got[it.key] === 'missing');
  const left = items.filter((it) => !got[it.key] || (!Array.isArray(got[it.key]) && got[it.key] !== 'missing'));
  const touched = (k: string) => Array.isArray(got[k]) && (got[k] as (number | null)[]).some((v) => v != null);
  const current = cur ? items.find((x) => x.key === cur) || null : left[0] || null;
  const counted = done.filter((it) => it.key !== (current && current.key) || false).filter((it) => touched(it.key));
  const toGo = left.filter((it) => it !== current);
  const n = { counted: counted.length, missing: missing.length, left: items.length - counted.length - missing.length };
  const open = (it: ShelfItem) => { if (current && !touched(current.key) && got[current.key] !== 'missing') { const g = { ...got }; delete g[current.key]; setGot(g); } setCur(it.key); };
  const setV = (it: ShelfItem, i: number, v: number | null) => { const L = levelsOf(it), old = Array.isArray(got[it.key]) ? got[it.key] as (number | null)[] : L.map(() => null); setGot({ ...got, [it.key]: old.map((x, j) => (j === i ? v : x)) }); setCur(it.key); };
  const send = () => {
    const lines = counted.map((it) => countLine(it, inLineUnit(levelsOf(it), got[it.key] as (number | null)[]), onShelf(b, it.key)));
    const miss = missing.map((it) => ({ key: it.key, productId: it.productId, variantIdx: it.variantIdx, name: it.name }));
    const old = waitingFor(b, aislePlace(a.letter, a.name)), c = { aisle: aisleName(a.letter, a.name), lines, missing: miss };
    if (old) s.go(`Count of aisle ${a.letter}`, 'replaceCount', [old.id, c]); else s.go(`Count of aisle ${a.letter}`, 'sendCount', [c]);
  };
  if (s.phase === 'sent') {
    return (
      <SentMoment title={`Sent to ${ruth.name.split(' ')[0]}`} who={ruth} what={`aisle ${a.letter} · ${counted.length} items`} end="Back to Today" onEnd={() => nav.home()} onClose={() => nav.home()}
        steps={[{ icon: 'send', title: `Sent to ${ruth.name.split(' ')[0]}`, sub: `aisle ${a.letter} · blind` }, { icon: 'clock', title: `${ruth.name.split(' ')[0]} checks it against the shelf`, sub: 'now · she accepts it or asks again' }, { icon: 'tally', title: 'The shelf takes your count', sub: 'a push tells you either way' }]}
        hears={[[ruth, 'gets a push', true]]} />
    );
  }
  const ready = n.left === 0 && counted.length > 0;
  return (
    <div class="sh-full">
      <Tap on={() => nav.back()} label="Back to Shelf" class="sh-full-back" />
      <div class="sh-full-sheet">
        <div class="sh-head">
          <span aria-hidden="true" class="sh-grab" />
          <div class="sh-head-row">
            <span aria-hidden="true" class="sh-ac-l"><b class="mono">{a.letter}</b></span>
            <div class="sh-head-t"><span class="sh-ac-t">{`Count aisle ${a.letter}`}</span><span>{a.name} · <span class="mono">{items.length}</span> items · blind</span></div>
            <button type="button" class="sh-x" aria-label="Close" onClick={() => nav.tab('shelf')}><Icon name="close" size={16} stroke={2.2} /></button>
          </div>
          <div role="img" aria-label={`${n.counted} counted, ${n.missing} can't find, ${n.left} to go`} class="sh-ac-tiles">
            <span class="ok"><b class="mono">{n.counted}</b><span>counted</span></span>
            <span class="miss"><b class="mono">{n.missing}</b><span>can't find</span></span>
            <span><b class="mono">{n.left}</b><span>to go</span></span>
          </div>
          <span role="img" aria-label={`${n.counted + n.missing} of ${items.length} done`} class="sh-ac-bar"><span style={{ width: `${(n.counted / items.length) * 100}%` }} /><span class="m" style={{ width: `${(n.missing / items.length) * 100}%` }} /></span>
        </div>
        <div class="sh-body sh-ac-body">
          {(counted.length > 0 || missing.length > 0) && (
            <div class="sh-ac-done">
              {[...counted, ...missing].map((it) => got[it.key] === 'missing' ? (
                <div key={it.key} class="sh-ac-row">
                  <span role="img" aria-label="Can't find" class="sh-ac-x"><Icon name="close" size={13} stroke={3} /></span>
                  <span class="sh-ac-rt"><span>{it.name}</span><span class="miss">{`can't find · ${ruth.name.split(' ')[0]} sees it`}</span></span>
                  <button type="button" class="sh-ac-found" onClick={() => { const g = { ...got }; delete g[it.key]; setGot(g); setCur(it.key); }}>Found it</button>
                </div>
              ) : (
                <div key={it.key} class="sh-ac-row">
                  <span role="img" aria-label="Counted" class="sh-ac-ok"><Icon name="check" size={13} stroke={3} /></span>
                  <span class="sh-ac-rt"><span>{it.name}</span><span class="mono">{shown(levelsOf(it), got[it.key] as (number | null)[], it.unit)}</span></span>
                  <button type="button" class="sh-ac-pen" aria-label={`Change the count of ${it.name}`} onClick={() => setCur(it.key)}><Icon name="pen" size={18} stroke={2} /></button>
                </div>
              ))}
            </div>
          )}
          {current && (
            <div class="sh-ac-cur">
              <div class="sh-ac-cur-h"><ItemPic it={current} size={40} radius={12} /><span><span>{current.name}</span><span>{`count the ${unitWord(levelsOf(current)[0].unit, 2)} you see`}</span></span></div>
              <div class="sh-ac-cur-a">
                <div class="sh-ac-boxes">{levelsOf(current).map((l, i) => <Box key={i} value={Array.isArray(got[current.key]) ? (got[current.key] as (number | null)[])[i] : null} unit={l.unit} label={`${unitWord(l.unit, 2)} of ${current.name}`} onChange={(v) => setV(current, i, v)} />)}</div>
                <button type="button" class="sh-ac-cant" onClick={() => { setGot({ ...got, [current.key]: 'missing' }); setCur(null); }}>Can't find</button>
              </div>
            </div>
          )}
          {toGo.length > 0 && (
            <div class="sh-ac-rest">
              {toGo.slice(0, page === 1 ? 1 : 1 + (page - 1) * 30).map((it) => {
                const w = waitingFor(b, spotPlace(it));
                return (
                  <Tap key={it.key} on={() => open(it)} class="sh-ac-next" label={`Count ${it.name}`}>
                    <span aria-hidden="true" class="sh-ac-ring" />
                    <span class="sh-ac-rt"><span>{it.name}</span>{w && <span class="sh-ac-w"><span class="sh-chip ruth"><span aria-hidden="true" class="sh-chip-face">{ruth.initials}</span>{`With ${ruth.name.split(' ')[0]}`}</span><span>this count replaces it</span></span>}</span>
                  </Tap>
                );
              })}
              {toGo.length > (page === 1 ? 1 : 1 + (page - 1) * 30) && <button type="button" class="sh-ac-more" onClick={() => setPage(page + 1)}>Show 30 more <Icon name="chevron-down" size={16} stroke={2.2} /></button>}
            </div>
          )}
        </div>
        <div class="sh-ac-dock">
          {s.phase === 'held' && <UndoPill />}
          {s.phase === 'kept' ? <KeptCard to={ruth.name.split(' ')[0]} onRemove={s.remove} />
            : s.phase === 'failed' ? <NotSaved sub={<>Your count is kept on this phone · tell Kevin · code <span class="mono">{s.code}</span></>} onRetry={s.retry} onClose={s.reset} />
            : (
              <div class="sh-ac-acts">
                <button type="button" class="sh-ac-keep" onClick={() => { toast.show('Kept for later', { sub: `aisle ${a.letter} · on this phone` }); nav.back(); }}>Keep for later</button>
                <button type="button" class={cx('sh-ac-send', !ready && 'off')} disabled={!ready || s.phase === 'held'} aria-disabled={!ready} onClick={send}><Icon name="send" size={18} stroke={2} />{s.phase === 'held' ? 'Sending…' : `Send to ${ruth.name.split(' ')[0]}`}</button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
