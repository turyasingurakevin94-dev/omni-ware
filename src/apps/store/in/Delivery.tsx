/*
 * A supplier's delivery (route `in/delivery { trip }`; IN10–IN15): the same blind check-in, titled
 * with the supplier, counted in stacks of ten, the torn ones set apart for Ruth (never on the shelf),
 * a photo of their delivery note for Esther, then one slide.
 *
 *   count    IN10 (stacks of 10, the loose ones on a stepper) · IN11 some torn
 *   sending  IN14 the shelf going from 120 to 220 · kept IN15 · done IN12
 *
 * Rules: core/store/checkin.ts (one check-in rule); the write: W14 checkIn.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { isDataError } from '../../../core/datasource.ts';
import { lineDone, payload, toCount, tripOf, type CheckLine, type Draft } from '../../../core/store/checkin.ts';
import type { YardBooks } from '../../../core/store/types.ts';
import { clock } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { BagArt, ItemArt } from '../../../ui/ItemArt.tsx';
import { Stepper } from '../../../ui/Stepper.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, notDone, now } from '../shell/store.ts';
import { LineRow, OpenLine } from './CheckLines.tsx';
import { openNotOnList } from './NotOnList.tsx';
import { byRole, Card, Done, DoneWho, faceOf, first, FlowCard, GroupHead, HeadPill, InBar, InDock, NavyChip, Screen, Sees, Steps, TripHead, Updating } from './parts.tsx';
import { takePhoto, type Photo } from './photo.ts';

type Phase = 'count' | 'sending' | 'kept' | 'failed' | 'done';

const NOTE = (
  <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
    <rect x="10" y="6" width="28" height="36" rx="2" fill="#FFFFFF" transform="rotate(-6 24 24)" />
    <path d="M15 14h16M15 19h12M15 24h16M15 29h9" stroke="#C9C4BA" stroke-width="2" stroke-linecap="round" transform="rotate(-6 24 24)" />
    <path d="M26 33c2-3 5 2 8-1" fill="none" stroke="#1A5A8A" stroke-width="1.6" stroke-linecap="round" transform="rotate(-6 24 24)" />
  </svg>
);

/** The aisle's letter: its place in the yard's aisle order (A Roofing … L Sanitary). */
export const letterOf = (b: YardBooks, aisle: string | null): string => (aisle && b.aisles.includes(aisle) ? String.fromCharCode(65 + b.aisles.indexOf(aisle)) : '?');

export function Delivery(p: { trip: string }): JSX.Element {
  const b = books.value as YardBooks, t = b ? tripOf(b, p.trip) : null;
  const [draft, setDraft] = useState<Draft>({ counts: {}, whys: {} });
  const [torn, setTorn] = useState<number | null>(null), [photo, setPhoto] = useState<Photo | null>(null);
  const [phase, setPhase] = useState<Phase>('count'), [sentAt, setSentAt] = useState(0);
  if (!b || !t) return <Screen head={<TripHead lead={null} name="Delivery" sub="" onClose={() => nav.home()} />}><p class="in-gone-p">That delivery is gone.</p></Screen>;
  const moses = byRole(b, 'sourcing'), esther = byRole(b, 'accounts'), ruth = byRole(b, 'manager');
  const supplier = t.stops[0].supplierName, short = supplier.split(' ')[0], lines = toCount(t), l = lines[0] as CheckLine | undefined;
  const item = l ? b.items.find((i) => i.key === l.key) : undefined, aisle = item ? item.category : null, letter = letterOf(b, aisle);
  const n = l ? draft.counts[l.id] : undefined, tornN = torn || 0, good = n != null ? n - tornN : 0;
  const counted = lines.every((x) => draft.counts[x.id] != null);
  const done = lines.every((x) => lineDone(x, draft)) || (counted && tornN > 0);

  if (phase === 'done' && l) {
    const sees = `${n} ${l.unit}`;
    return (
      <Done title="Checked in"
        who={<DoneWho lead={<span aria-hidden="true" class="in-truck sm"><Icon name="truck" size={18} stroke={2} /></span>} name={supplier} sub={`${sees} · ${clock(sentAt)}`} />}
        chips={<><NavyChip tone="mint" face={faceOf(moses)}>{`${first(moses ? moses.name : 'Sourcing')} told`}</NavyChip>{photo && <NavyChip tone="glass" face={faceOf(esther)}>{`${first(esther ? esther.name : 'Accounts')} has the note`}</NavyChip>}</>}>
        <FlowCard head="Where it went" pics={Array.from({ length: 5 }, (_, i) => <span key={i} class="in-bagpic"><BagArt size={26} /></span>)} n={`+${good}`} mint
          to={<span class="in-to white"><span>{letter}</span>{aisle}</span>} label={`${good} ${l.unit}s to the shelf, aisle ${letter}`}
          note={`On the shelf now · ${b.people.filter((x) => x.role === 'sales').slice(0, 2).map((x) => first(x.name)).join(' and ')} can sell it`} />
        <Steps steps={[
          { lead: 'check', state: 'done', title: 'On the shelf', sub: `${clock(sentAt)} · aisle ${letter} · ${first(moses ? moses.name : 'Sourcing')} told` },
          ...(tornN ? [{ lead: ruth ? ruth.initials : 'RN', state: 'now' as const, title: `${first(ruth ? ruth.name : 'Ruth')} decides the ${tornN} torn`, sub: 'set aside · never on the shelf' }] : []),
          { lead: esther ? esther.initials : 'EA', state: tornN ? 'next' : 'now', title: `${first(esther ? esther.name : 'Accounts')} checks the note`, sub: `against ${short}'s bill · no money here` },
        ]} />
      </Done>
    );
  }

  const send = async () => {
    if (!l) return;
    const d: Draft = tornN ? { counts: { [l.id]: good }, whys: { [l.id]: 'Torn · set aside' } } : draft;
    setPhase('sending');
    notDone.value = null;
    try {
      const r = await act('checkIn', payload(t, d));
      if (r.kept) { setPhase('kept'); return; }
      setSentAt(now.value);
      setPhase('done');
    } catch (e) { setPhase(isDataError(e) && e.kind === 'clash' ? 'count' : 'failed'); }
  };
  const locked = phase === 'sending' || phase === 'kept';
  const came = l && n != null ? `Came in · ${n} ${l.unit}${tornN ? ` · ${tornN} torn` : ''}` : 'Came in';
  const second = phase === 'kept' ? <Updating at={clock(b.at)} />
    : tornN ? <Sees face={faceOf(ruth)} who={first(ruth ? ruth.name : 'Ruth')} what={`${tornN} torn`} />
      : <Sees face={faceOf(esther)} who={first(esther ? esther.name : 'Accounts')} what="the delivery note" />;
  const due = t.stops[0].dueAt;
  const move = phase === 'sending' ? { kind: 'slide' as const, props: { label: 'Sending…', onCommit: () => undefined, state: 'sending' as const } }
    : phase === 'kept' ? { kind: 'wait' as const, label: 'Waiting to send' }
      : done ? { kind: 'slide' as const, props: { label: `Slide to check in · ${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`, onCommit: send } }
        : { kind: 'wait' as const, label: 'Count it first' };
  const head = (
    <TripHead lead={<span aria-hidden="true" class="in-truck"><Icon name="truck" size={22} stroke={2} /></span>} name={supplier}
      sub={`at the yard ${clock(t.stops[0].collectedAt ?? now.value)} · ${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`}
      onScan={() => { if (!locked) nav.push('shelf/scan', { then: 'checkin' }); }} onClose={() => nav.back()} closeLabel="Close: back to Coming in"
      chips={<>
        <HeadPill face={faceOf(moses)}>{`From ${first(moses ? moses.name : 'Sourcing')} · Sourcing`}</HeadPill><span class="in-flex" />
        <button type="button" class="in-extra" disabled={locked} onClick={() => openNotOnList(t.id)}><span><Icon name="plus" size={13} stroke={2.6} />Not on the list</span></button>
      </>} />
  );
  const foot = (
    <div class="in-foot">
      <InBar kept={phase === 'kept'} what="counts" retry={phase === 'failed' ? () => { void send(); } : undefined} />
      <InDock ring={{ done: lines.filter((x) => draft.counts[x.id] != null).length, of: lines.length, amber: tornN ? 1 : 0 }}
        lines={<><Sees face={faceOf(moses)} who={first(moses ? moses.name : 'Sourcing')} what={phase === 'kept' ? `Coming${due ? ` · ${clock(due)}` : ''}` : came} />{second}</>} move={move} />
    </div>
  );
  const counting = phase === 'count' || phase === 'failed';
  return (
    <Screen head={head} foot={foot} back="Back to Coming in">
      <GroupHead icon="rack" title="The shelf" right={<span class="mono">{`${lines.length} ${lines.length === 1 ? 'line' : 'lines'} · refill`}</span>} />
      {l && !counting && <Card><LineRow l={l} count={n} sub={`${n} ${l.unit} counted`} /></Card>}
      {l && counting && torn == null && (
        <OpenLine l={l} nth={1} of={1} count={n} why={draft.whys[l.id]} ruth={faceOf(ruth)} ruthName={first(ruth ? ruth.name : 'Ruth')} denisName={short}
          onCount={(v) => setDraft({ counts: { [l.id]: v }, whys: {} })} onWhy={(w) => setDraft({ counts: { ...draft.counts }, whys: { [l.id]: w } })}
          aside={n != null ? <button type="button" class="in-anytorn" aria-label="Some torn? Set them apart" onClick={() => setTorn(1)}><Icon name="damaged" size={16} stroke={2} />Torn?</button> : null} />
      )}
      {l && counting && torn != null && n != null && (
        <div class="in-card open-amber">
          <div class="in-open-h">
            <ItemArt name={l.name} size={56} radius={14} torn />
            <div class="in-open-t"><span>{l.name}</span><span class="in-open-s warn">{`${n} came · any torn?`}</span></div>
            <button type="button" class="in-pill t-plain mono in-cnt dk" aria-label="Count again" onClick={() => setTorn(null)}>{`${n} ${l.unit}`}</button>
          </div>
          <div class="in-torn" role="img" aria-label={`${good} good ${l.unit}s, ${tornN} torn`}>
            <span class="in-torn-bar"><i style={{ flex: good }} />{tornN > 0 && <i class="r" style={{ flex: Math.max(tornN, n / 12) }} />}</span>
            <span class="in-torn-w"><span><b class="mono">{good}</b>{` good · aisle ${letter}`}</span><span class="r"><b class="mono">{tornN}</b> torn · set aside</span></span>
          </div>
          <div class="in-torn-row">
            <span aria-hidden="true" class="in-torn-bags">{Array.from({ length: Math.min(tornN, 6) }, (_, i) => <BagArt key={i} size={26} torn />)}</span>
            <span class="in-flex in-torn-l">{`Torn ${l.unit}s`}</span>
            <Stepper value={tornN} unit="" what={`torn ${l.unit}s`} max={n} onChange={setTorn} />
          </div>
          <span class="in-by"><Avatar {...faceOf(ruth)} size={20} />{`${first(ruth ? ruth.name : 'Ruth')} decides the ${tornN} torn · never on the shelf`}</span>
        </div>
      )}
      <button type="button" class="in-note" disabled={locked} onClick={async () => setPhoto(await takePhoto(now.value))}>
        <span aria-hidden="true" class="in-note-pic">{photo && photo.url ? <img src={photo.url} alt="" width={48} height={48} /> : NOTE}</span>
        <span class="in-line-t"><span>Their delivery note</span><span>{photo ? `photo taken ${clock(photo.at)} · ${first(esther ? esther.name : 'Accounts')} gets it` : `take a photo · ${first(esther ? esther.name : 'Accounts')} gets it`}</span></span>
        {photo ? <span role="img" aria-label="Photo taken" class="in-mark ok"><Icon name="check" size={12} stroke={3.2} /></span> : <span class="nl-cam"><Icon name="camera" size={18} stroke={2} /></span>}
      </button>
      {counting ? (
        <button type="button" class="in-aisle-row" onClick={() => nav.push('shelf/aisle', { aisle: aisle || '' })}>
          <span aria-hidden="true" class="in-letter">{letter}</span>
          <span class="in-line-t"><span>{`Stack it in aisle ${letter} · ${aisle || 'No aisle yet'}`}</span><span>{tornN ? `${good} good · ${tornN} torn set aside` : `beside the ${l ? l.unit : ''}s already there`}</span></span>
          <span aria-hidden="true" class="ci-chev"><Icon name="chevron-right" size={14} stroke={2.2} /></span>
        </button>
      ) : item && l && (
        <div class="in-card in-card16 in-shelfbar" role="img" aria-label={`Aisle ${letter}, ${(aisle || '').toLowerCase()}: the shelf goes from ${item.books} to ${item.books + good} ${l.unit}s`}>
          <div class="in-shelfbar-h">
            <span aria-hidden="true" class="in-letter s">{letter}</span><span class="t">{`Aisle ${letter} · ${aisle}`}</span>
            <span class="mono was">{item.books}</span><Icon name="arrow-right" size={14} stroke={2.2} /><span class="mono now">{item.books + good}</span><span class="u">{l.unit}</span>
          </div>
          <span class="in-torn-bar"><i class="g" style={{ flex: item.books }} /><i style={{ flex: good }} /></span>
          <span class="in-shelfbar-w"><span>on the shelf</span><span>{`+${good} from ${short}`}</span></span>
        </div>
      )}
    </Screen>
  );
}
