/*
 * shelf/aisle { aisle } · SH04 an aisle, SH05 no aisle yet ({ aisle: '' }).
 *
 *   an aisle     its letter and name, what it holds; how long since it was counted (a dash a day, 14 to the next),
 *                who counted and who accepted; All · Packed · To report; the items, the fullest first, 4 then 30 more;
 *                the shelf labels; Scan · Count aisle A
 *   no aisle     the items without a letter yet (or the ghost of one), the last given an aisle, Scan a label
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { clock, weekday } from '../../../core/time.ts';
import { AISLE_FRESH_DAYS, countDue, daysSince } from '../../../core/store/counts.ts';
import { aisleItems, aislesOf, letterOf, noAisle, onShelf, orderIn, packedFor } from '../../../core/store/shelf.ts';
import type { ShelfItem, YardBooks } from '../../../core/store/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { AISLE, AisleIcon, aisleKey, Icon } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx, Tap } from '../../../ui/util.tsx';
import { nav, type Params } from '../shell/nav.ts';
import { books, now } from '../shell/store.ts';
import { foundFor } from './found.ts';
import { glyphOf, ItemPic } from './glyphs.tsx';
import { person } from './Item.tsx';
import { ItemSheet } from './parts.tsx';
import { Chip } from './rows.tsx';
import './aisle.css';

type Show = 'all' | 'packed' | 'report';
const PLURAL: Record<string, string> = { sheet: 'sheets', ridge: 'ridges', nail: 'nails', tin: 'tins', barrow: 'barrows', tyre: 'tyres', screw: 'screws', bundle: 'bundles', ctn: 'cartons', carton: 'cartons', bag: 'bags' };

/** "bundles, sheets, ridges": what the aisle holds, from its items' packs and pictures. */
function holds(items: ShelfItem[]): string {
  const w: string[] = [];
  items.forEach((it) => { if (it.packQty > 1 && it.packUnit && PLURAL[it.packUnit]) w.push(PLURAL[it.packUnit]); });
  items.forEach((it) => { const g = glyphOf(it.name); if (g && PLURAL[g]) w.push(PLURAL[g]); });
  return [...new Set(w)].slice(0, 3).join(', ');
}

function Row(p: { b: YardBooks; it: ShelfItem; at: number }): JSX.Element {
  const { b, it, at } = p, due = countDue(it, b, at), shelf = onShelf(b, it.key), pk = packedFor(b, it.key), oi = orderIn(b, it.key), found = foundFor(it.key);
  const pkn = pk.reduce((s, x) => s + x.qty, 0);
  const line = pkn ? `+${pkn} packed${pk.some((x) => x.order.pickingStatus === 'done') && pk.length === 1 ? ` · #${String(pk[0].order.id).padStart(4, '0')}` : ''}`
    : oi.length && !shelf ? `for #${String(oi[0].order.id).padStart(4, '0')}${oi[0].due ? ` · ~${clock(oi[0].due)}` : ''}`
    : it.packQty > 1 && it.packUnit ? `${it.packUnit} of ${it.packQty}` : '';
  return (
    <Tap on={() => nav.push('shelf/item', { key: it.key })} class="sh-irow" label={it.name}>
      <ItemPic it={it} size={40} radius={12} />
      <span class="sh-irow-t">
        <span>{it.name}</span>
        <span class="sh-irow-s">
          {due ? <Chip tone="due"><Icon name="blind" size={13} stroke={2} />Count due</Chip> : oi.length && !shelf ? <Chip tone="in">Order in</Chip> : <Chip tone="shelf"><span class="mono">{shelf}</span> on shelf</Chip>}
          {line && <span>{line}</span>}
        </span>
      </span>
      {found ? <span class="sh-al-found"><Icon name="warning" size={13} stroke={2.2} />{`${found.qty} ${found.note}`}</span> : <span aria-hidden="true" class="sh-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>}
    </Tap>
  );
}

function OneAisle(p: { b: YardBooks; name: string }): JSX.Element {
  const { b } = p, at = now.value, a = aislesOf(b, at).find((x) => x.name === p.name);
  const [show, setShow] = useState<Show>('all'), [more, setMore] = useState(0);
  if (!a) return <main class="sh-wait"><p class="sh-gone">No such aisle.</p></main>;
  const all = aisleItems(b, a.name), ink = AISLE[aisleKey(a.name)];
  const packed = all.filter((it) => packedFor(b, it.key).length), report = all.filter((it) => foundFor(it.key));
  const list = show === 'packed' ? packed : show === 'report' ? report : all, page = 4 + more * 30;
  const days = a.days ?? 0, left = Math.max(0, AISLE_FRESH_DAYS - days);
  const last = b.counts.filter((c) => c.place === `aisle:${a.name.toLowerCase()}` && c.status === 'accepted').sort((x, y) => (y.decidedAt || 0) - (x.decidedAt || 0))[0];
  const who = last ? b.people.find((x) => x.userId === last.countedBy) : null, ruth = person(b, 'manager', 'Ruth Nakato');
  const head = (
    <div class="sh-head">
      <span aria-hidden="true" class="sh-grab" />
      <div class="sh-head-row">
        <span aria-hidden="true" class="sh-al-l" style={{ background: `linear-gradient(145deg, ${ink.soft} 0%, #FFFFFF 150%)` }}><b class="mono" style={{ color: ink.ink }}>{a.letter}</b></span>
        <div class="sh-head-t"><span class="sh-al-t"><AisleIcon aisle={a.name} size={18} color="#FFFFFF" />{a.name}</span><span><span class="mono">{a.items.length}</span>{` items${holds(a.items) ? ' · ' + holds(a.items) : ''}`}</span></div>
        <button type="button" class="sh-x" aria-label="Close" onClick={() => nav.back()}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      <div class="sh-al-fresh">
        <span class="sh-al-n"><span class="mono">{days}</span><span>{`${days === 1 ? 'day' : 'days'} since counted · `}{a.due ? 'due now' : <>due in <span class="mono">{left}</span></>}</span></span>
        <span role="img" aria-label={`Counted ${days} days ago, due every ${AISLE_FRESH_DAYS} days`} class="sh-al-dash">{Array.from({ length: AISLE_FRESH_DAYS }, (_, i) => <span key={i} class={cx(i < days && (a.due ? 'over' : 'on'))} />)}</span>
        {last && who && (
          <div class="sh-al-who">
            <span><Avatar initials={who.initials} tint={who.tint} size={26} font={11} /><Avatar initials={ruth.initials} tint={ruth.tint} size={26} font={11} /></span>
            <span>{`${who.name.split(' ')[0]} counted ${daysSince(last.createdAt, at) === 0 ? 'today' : weekday(last.createdAt)} · ${ruth.name.split(' ')[0]} accepted `}<span class="mono">{clock(last.decidedAt as number)}</span></span>
          </div>
        )}
      </div>
    </div>
  );
  return (
    <ItemSheet back={() => nav.back()} backLabel="Back to Shelf" head={head} body="count">
      <div role="group" aria-label="Show" class="sh-fchips">
        <button type="button" aria-pressed={show === 'all'} class={cx('sh-fchip', show === 'all' && 'on')} onClick={() => setShow('all')}>All<b class="mono">{all.length}</b></button>
        {packed.length > 0 && <button type="button" aria-pressed={show === 'packed'} class={cx('sh-fchip', show === 'packed' && 'on')} onClick={() => setShow('packed')}><span aria-hidden="true" class="sh-dot" style={{ background: '#8DA2D6' }} />Packed<b class="mono">{packed.length}</b></button>}
        {report.length > 0 && <button type="button" aria-pressed={show === 'report'} class={cx('sh-fchip', show === 'report' && 'on')} onClick={() => setShow('report')}><span aria-hidden="true" class="sh-dot" style={{ background: '#95530C' }} />To report<b class="mono">{report.length}</b></button>}
      </div>
      <div class="sh-al-list">
        {list.slice(0, page).map((it) => <Row key={it.key} b={b} it={it} at={at} />)}
        {list.length > page && <button type="button" class="sh-al-more" onClick={() => setMore(more + 1)}>Show 30 more <Icon name="chevron-down" size={16} stroke={2.2} /></button>}
      </div>
      <div class="sh-al-labels">
        <span aria-hidden="true"><Icon name="scan" size={20} stroke={2} /></span>
        <span><span>Shelf labels</span><span><span class="mono">{a.items.length}</span> of <span class="mono">{a.items.length}</span> have one</span></span>
        <button type="button" onClick={() => toast.show('Shelf labels print from the office for now', { kind: 'warn' })}>Print again</button>
      </div>
      <div class="sh-al-foot">
        <Tap on={() => nav.push('shelf/scan')} class="sh-al-scan" label={`Scan a label in aisle ${a.letter}`}><Icon name="scan" size={22} stroke={2} /></Tap>
        <button type="button" class="sh-al-count" onClick={() => nav.push('shelf/count', { aisle: a.name })}><Icon name="tally" size={18} stroke={2} />{`Count aisle ${a.letter}`}</button>
      </div>
    </ItemSheet>
  );
}

/** Items with no aisle yet (DATA-05), and the last one given an aisle today (SH05). */
function NoAisle(p: { b: YardBooks }): JSX.Element {
  const { b } = p, at = now.value, waiting = noAisle(b), moses = person(b, 'sourcing', 'Moses Lubega');
  const given = b.items.filter((x) => x.listedAt != null && daysSince(x.listedAt, at) === 0 && x.category).sort((x, y) => (y.listedAt || 0) - (x.listedAt || 0))[0];
  const tiles = given ? [given.category as string, ...b.aisles.filter((x) => x !== given.category)] : b.aisles;
  const near = [tiles[0], b.aisles[0], b.aisles[2]].filter((x, i, l) => x && l.indexOf(x) === i).slice(0, 3);
  const head = (
    <div class="sh-head">
      <span aria-hidden="true" class="sh-grab" />
      <div class="sh-head-row">
        <span aria-hidden="true" class="sh-al-q"><b class="mono">?</b></span>
        <div class="sh-head-t"><span class="sh-al-t">No aisle yet</span><span><span class="mono">{waiting.length}</span>{` items · ${moses.name.split(' ')[0]} gives each an aisle`}</span></div>
        <button type="button" class="sh-x" aria-label="Close" onClick={() => nav.back()}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
    </div>
  );
  return (
    <ItemSheet back={() => nav.back()} backLabel="Back to Shelf" head={head} body="noaisle">
      {waiting.length ? (
        <div class="sh-al-list">{waiting.map((it) => <Row key={it.key} b={b} it={it} at={at} />)}</div>
      ) : (
        <>
          <div aria-hidden="true" class="sh-al-ghost">
            <div><span>New items</span><span>wait here for an aisle</span></div>
            {[0, 1, 2].map((i) => <div key={i} class="sh-al-ghost-r"><span /><span><span /><span /></span><span /></div>)}
          </div>
          <div class="sh-rp-none"><span>Every item has an aisle</span><span>A new item waits here without a letter</span></div>
        </>
      )}
      <button type="button" class="sh-send sh-al-scanb" onClick={() => nav.push('shelf/scan')}><Icon name="scan" size={18} stroke={2} />Scan a label</button>
      {given && (
        <div class="sh-al-given">
          <span role="img" aria-label="Done"><Icon name="check" size={15} stroke={3} /></span>
          <span><span>{given.name}</span><span>{`${moses.name.split(' ')[0]} gave it aisle ${letterOf(b, given.category)} · `}<span class="mono">{clock(given.listedAt as number)}</span></span></span>
          <span class="mono" style={{ background: AISLE[aisleKey(given.category || '')].soft, color: AISLE[aisleKey(given.category || '')].ink }}>{letterOf(b, given.category)}</span>
        </div>
      )}
      <div class="sh-open-h">Or open an aisle</div>
      <div class="sh-al-tiles">
        {near.map((n) => (
          <Tap key={n} on={() => nav.replace('shelf/aisle', { aisle: n })} class="sh-al-tile" label={`Aisle ${letterOf(b, n)}, ${n}`}>
            <span><ItemSquare aisle={n} size={28} radius={9} icon={18} /><b class="mono">{letterOf(b, n)}</b></span>
            <span><span>{n}</span> <span class="mono">{b.items.filter((x) => x.category === n).length}</span></span>
          </Tap>
        ))}
      </div>
    </ItemSheet>
  );
}

export function Aisle(p: { params: Params }): JSX.Element {
  const b = books.value;
  if (!b) return <main class="sh-wait" aria-busy="true" />;
  return p.params.aisle ? <OneAisle b={b} name={String(p.params.aisle)} /> : <NoAisle b={b} />;
}
