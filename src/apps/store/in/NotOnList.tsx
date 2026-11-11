/*
 * Not on the list (IN04, IN16; routes §4 `openNotOnList(trip)`): something came off the truck that
 * the trip did not list. Find it (or scan it), how many, why it is on the truck, then a navy
 * "Ask Ruth": she keeps it on the shelf or sends it back (IM-17). Not one of ours: a new item for
 * Sourcing, with a photo. The write: W15 notOnList.
 */
import { firstWord } from '../../../core/names.ts';
import { personFace } from '../../../core/store/faces.ts';
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { EXTRA_WHY } from '../../../core/store/checkin.ts';
import type { ShelfItem, YardBooks } from '../../../core/store/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { ItemArt } from '../../../ui/ItemArt.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, now } from '../shell/store.ts';
import { byRole } from './parts.tsx';
import { takePhoto, type Photo } from './photo.ts';
import './notonlist.css';

/** The best matches first: every word found, the name starting with the first word ahead. */
export function findItems(items: ShelfItem[], q: string): ShelfItem[] {
  const w = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!w.length) return [];
  return items.filter((i) => w.every((x) => i.name.toLowerCase().includes(x)))
    .sort((a, b) => Number(b.name.toLowerCase().startsWith(w[0])) - Number(a.name.toLowerCase().startsWith(w[0]))).slice(0, 3);
}

function Sheet(p: { tripId: string }): JSX.Element {
  const b = books.value as YardBooks, tr = b.trips.find((t) => t.id === p.tripId);
  const runner = b.people.find((x) => tr && x.id === tr.runnerId) || null, ruth = byRole(b, 'manager'), moses = byRole(b, 'sourcing');
  const [q, setQ] = useState(''), [pick, setPick] = useState<ShelfItem | null>(null), [qty, setQty] = useState<number | null>(null);
  const [why, setWhy] = useState<string | null>(null), [photo, setPhoto] = useState<Photo | null>(null), [busy, setBusy] = useState(false), [fresh, setFresh] = useState(false);
  const found = pick ? [pick] : findItems(b.items, q), unit = pick ? pick.unit : 'pc';
  const letter = (c: string | null) => (c ? String.fromCharCode(65 + Math.max(0, b.aisles.indexOf(c))) : '');
  const supplier = tr ? tr.supplierName.split(' ')[0] : 'the supplier';
  const ok = (!!pick || (fresh && q.trim().length > 1 && !!photo)) && qty != null && !!why && !busy;
  const ask = async () => {
    if (!ok || !tr) return;
    setBusy(true);
    try {
      await act('notOnList', {
        tripId: tr.id, supplierId: tr.supplierId, key: pick ? pick.key : null, productId: pick ? pick.productId : null, variantIdx: pick ? pick.variantIdx : null,
        name: pick ? pick.name : q.trim(), qty, unit, why, newItem: !pick, photo: photo ? photo.blob : null,
      });
      sheet.close();
      toast.show(`Asked ${firstWord(ruth ? ruth.name : 'Ruth')} · ${(pick ? pick.name : q).split(' ').slice(0, 2).join(' ').toLowerCase()}`, { kind: 'ok' });
    } catch (_e) { setBusy(false); }
  };
  return (
    <LightSheet eyebrow={`${firstWord(runner ? runner.name : 'The')}'s trip · back at the yard`} title="Not on the list" titleSize={21} onClose={() => sheet.close()} pad="12px 16px 20px" gap={10}
      foot={
        <button type="button" class={cx('in-navybtn', busy && 'sending')} disabled={!ok && !busy} aria-busy={busy} onClick={() => { void ask(); }}>
          {busy ? <><span aria-hidden="true" class="in-spin" />Sending…</> : <><Icon name="send" size={18} stroke={2} />{`Ask ${firstWord(ruth ? ruth.name : 'Ruth')}`}</>}
        </button>
      }>
      <fieldset class="nl" disabled={busy}>
        <div class="nl-find">
          <label class="nl-q">
            <Icon name="search" size={20} stroke={2} />
            <input type="search" value={q} aria-label="What is it? Type its name" placeholder="What is it?" onInput={(e) => { setQ((e.target as HTMLInputElement).value); setPick(null); setFresh(false); }} />
          </label>
          <button type="button" class="nl-scan" aria-label="Scan its label" onClick={() => { sheet.close(); nav.push('shelf/scan', { then: 'checkin' }); }}><Icon name="scan-line" size={20} stroke={2} /></button>
        </div>
        {!fresh && found.map((i) => (
          <div key={i.key} class={cx('nl-item', pick && 'on')}>
            <button type="button" class="nl-item-b" aria-pressed={!!pick} onClick={() => setPick(pick ? null : i)}>
              <ItemArt name={i.name} aisle={i.category} size={52} radius={14} />
              <span class="nl-item-t"><span>{i.name}</span><span>{`${i.category || 'No aisle yet'}${i.category ? ` · aisle ${letter(i.category)}` : ''} · one of ours`}</span></span>
            </button>
            {pick && <button type="button" class="nl-cam" aria-label={`Add a photo for ${firstWord(ruth ? ruth.name : 'Ruth')}`} onClick={async () => setPhoto(await takePhoto(now.value))}><Icon name={photo ? 'check' : 'camera'} size={18} stroke={2} /></button>}
          </div>
        ))}
        {(q.trim() || fresh) && (
          <button type="button" class={cx('nl-new', fresh && 'on')} onClick={async () => { setFresh(true); setPick(null); if (!photo) setPhoto(await takePhoto(now.value)); }}>
            <span aria-hidden="true"><Icon name="spark" size={15} stroke={2} /></span>
            <span class="t">Not one of ours? <span>{fresh ? `${q.trim()} · new item${photo ? ' · photo' : ''}` : `New item · ${firstWord(moses ? moses.name : 'Sourcing')}`}</span></span>
            <Icon name="chevron-right" size={14} stroke={2.4} />
          </button>
        )}
        <h3>How many came off?</h3>
        <div class="in-tiles" role="group" aria-label={`How many ${unit}s`}>
          {[1, 2, 3, 4].map((v) => (
            <button key={v} type="button" class={cx('in-tile', qty === v && 'on')} aria-label={`${v} ${unit}`} aria-pressed={qty === v ? 'true' : undefined} onClick={() => setQty(v)}>
              <span class="mono">{v}</span><span>{unit}</span>
            </button>
          ))}
          <button type="button" class={cx('in-tile other', qty != null && qty > 4 && 'on')} onClick={() => setQty((qty || 4) + 1)}><Icon name="plus" size={16} stroke={2.4} /><span>{qty != null && qty > 4 ? String(qty) : 'Other'}</span></button>
        </div>
        <div class="nl-gap" />
        <h3>Why is it on the truck?</h3>
        <div class="in-why wrap" role="group" aria-label="Why">
          {EXTRA_WHY.map((w) => <button key={w} type="button" class="in-chip" aria-pressed={why === w} onClick={() => setWhy(w)}>{w}</button>)}
        </div>
        <div class="nl-gap" />
        <div class="nl-fork" role="img" aria-label={`${firstWord(ruth ? ruth.name : 'Ruth')} decides: keep it on the shelf, or send it back to ${tr ? tr.supplierName : 'the supplier'}`}>
          <span class="nl-fork-who"><Avatar {...personFace(ruth)} size={32} /><span>{firstWord(ruth ? ruth.name : 'Ruth')}</span></span>
          <svg width="22" height="44" viewBox="0 0 22 44" fill="none" stroke="#C9C4BA" stroke-width="1.6" aria-hidden="true"><path d="M2 22h6c4 0 6-3 6-8V8h6M8 22c4 0 6 3 6 8v6h6" /></svg>
          <span class="nl-fork-ways">
            <span><span class="k"><Icon name="rack" size={13} stroke={2} /></span>Keep it · the shelf</span>
            <span><span class="s"><Icon name="return" size={13} stroke={2} /></span>{`Send it back · ${supplier}`}</span>
          </span>
        </div>
      </fieldset>
    </LightSheet>
  );
}

/** Open the sheet for a trip (any stop's id: the extra is asked against it). */
export function openNotOnList(tripId: string): void {
  sheet.open(() => <Sheet tripId={tripId} />, { label: 'Not on the list', top: 112 });
}
