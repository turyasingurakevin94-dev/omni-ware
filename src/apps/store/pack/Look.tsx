/*
 * Look only (store-agent PK09 the copy #0557, PK17 Okello's #0556; routes `pack/look { id }`).
 * Nothing to do here: the copy Ruth is cancelling ("Don't pack", with the one to pack instead),
 * or an order someone else is packing (whose, since when, how far, what Grace sees). Looking
 * never takes an order (spec §4.2).
 */
import type { JSX } from 'preact';
import { firstWord, orderNo } from '../../../core/names.ts';
import { customerFace, personFace, whoIs } from '../../../core/store/faces.ts';
import { isAnswered, packLines, progress, whereOf } from '../../../core/store/pack.ts';
import type { YardBooks, YardOrder } from '../../../core/store/types.ts';
import { clock, dayOf } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { Track } from '../../../ui/Track.tsx';
import { me, now, books } from '../shell/store.ts';
import { StateHead } from './head.tsx';
import { LinesCard } from './lists.tsx';
import { PushCard, WhereCard, toSheet } from './parts.tsx';
import { rowFor } from './sheet-data.ts';
import { PackRow } from './ToPack.tsx';
import { bayFor } from '../../../core/store/bays.ts';
import { Glyph } from './glyphs.tsx';

const placed = (o: YardOrder, n: number) => {
  const t = o.createdAt ?? o.savedAt ?? n;
  return `${dayOf(t) === dayOf(n) ? 'today ' : ''}${clock(t)}`;
};

function Copy(p: { b: YardBooks; o: YardOrder }): JSX.Element {
  const { b, o } = p, of = b.orders.find((x) => x.id === o.copyOf) || null, t = whoIs(b, o.takenBy), tn = t ? firstWord(t.name) : 'Sales';
  const ruth = b.people.find((x) => x.role === 'manager'), push = b.alerts.find((a) => a.kind === 'order.copy' && Number(a.data.orderId) === o.id);
  const from = push ? whoIs(b, push.fromId) : ruth;
  return (
    <FullSheet onBack={toSheet} backLabel="Back to To pack" pad="14px 16px 16px"
      head={(
        <StateHead b={b} o={o} sub={`${orderNo(o.id)} · ${tn} · ${placed(o, now.value)}`} word="Look only" tail={`the copy of ${orderNo(o.copyOf as number)}`} tailTone="rose" onClose={toSheet}
          who={ruth && <><Avatar {...personFace(ruth)} size={24} style={{ boxShadow: '0 0 0 2px #16203C' }} /><span class="pk-from-w">{`${firstWord(ruth.name)} cancels it`}</span></>}
          sees={`${tn} sees: Packing · copy`} tone="rose" />
      )}>
      {push && from && <PushCard face={personFace(from)} title={push.text} sub={`${firstWord(from.name)} · ${clock(push.at)} · push to the yard`} on={toSheet} label={push.text} />}
      <div role="img" aria-label={`${orderNo(o.id)} has the same lines as ${orderNo(o.copyOf as number)}`} class="pk-card pk-same">
        <span class="good"><b class="mono">{orderNo(o.copyOf as number)}</b><span>pack this one</span></span>
        <span class="pk-same-eq">=</span>
        <span class="bad"><b class="mono">{orderNo(o.id)}</b><span>the copy · don’t</span></span>
      </div>
      <LinesCard b={b} title={`What ${orderNo(o.id)} asks`} chip={<span class="pk-list-c"><Glyph name="copy" size={13} stroke={2.2} />{`same as ${orderNo(o.copyOf as number)}`}</span>}
        rows={o.lines.map((l) => ({ l, end: <span role="img" aria-label="Look only" class="pk-lock"><Icon name="lock" size={14} stroke={2.2} /></span> }))} />
      {of && (
        <div class="pk-instead">
          <span>Pack this one</span>
          <div class="pk-card pk-rows"><PackRow r={rowFor('pack', of, b, me.value, now.value)} first /></div>
        </div>
      )}
    </FullSheet>
  );
}

function Theirs(p: { b: YardBooks; o: YardOrder }): JSX.Element {
  const { b, o } = p, who = whoIs(b, o.assignedWorkerId), wn = who ? firstWord(who.name) : 'Someone', t = whoIs(b, o.takenBy), tn = t ? firstWord(t.name) : 'Sales';
  const ls = packLines(o), pr = progress(o), w = whereOf(o, b), c = customerFace(o, b);
  const took = o.workerAcceptedAt ?? o.pickingAssignedAt;
  const bought = o.lines.some((l) => l.supplierId && l.supplierId !== '__stock__');
  const bay = bayFor(o, b);
  return (
    <FullSheet onBack={toSheet} backLabel="Back to To pack" pad="14px 16px 16px"
      head={(
        <StateHead b={b} o={o} sub={`${orderNo(o.id)} · ${tn} · ${placed(o, now.value)}`} word="Packing" tail={`${wn}${took != null ? ' · since ' + clock(took) : ''}`} onClose={toSheet} who={null} sees="" tone="glass">
          <Track stage="packing" sub="" skipped={bought ? [] : ['checking', 'buying']} times={{ checking: clock(o.createdAt ?? now.value) }} />
        </StateHead>
      )}>
      <div class="pk-card pk-whose">
        {who && <Avatar {...personFace(who)} size={40} />}
        <span><b>{`${wn}’s`}</b><span>{`${who && who.role === 'store' ? 'he' : 'they'} took it at `}<span class="mono">{took != null ? clock(took) : ''}</span></span></span>
        <span class="pk-tag" style={{ height: '26px', fontSize: '12px' }}><Glyph name="eye" size={14} stroke={2.4} />Look only</span>
      </div>
      <LinesCard b={b} title={`What ${firstWord(c.name)} gets`} bar={ls.map((l) => (l.pickStatus === 'done' ? 'on' : 'amber'))} count={`${pr.done} of ${pr.of}`}
        rows={ls.map((l) => ({
          l, end: isAnswered(l)
            ? <span class="pk-list-k"><span role="img" aria-label="Packed" class="pk-tick"><Icon name="check" size={13} stroke={3} /></span></span>
            : <span class="pk-packing">packing<span aria-hidden="true" class="pk-ring" /></span>,
        }))} />
      {t && <div class="pk-told"><Avatar {...personFace(t)} size={28} /><span>{`${tn} sees: `}<b>{`Packing · ${wn}`}</b></span><Icon name={w.pickup ? 'store' : 'truck'} size={16} stroke={2} style={{ color: '#5F6980' }} /></div>}
      <WhereCard where={w} name={o.client.name} sub={w.pickup ? `packed → Ready to collect${bay != null ? `, bay ${bay}` : ''}` : undefined} />
      <button type="button" class="pk-btn navy" style={{ marginTop: 'auto' }} onClick={toSheet}>Back to To pack</button>
    </FullSheet>
  );
}

export function Look(p: { id: number }): JSX.Element {
  const b = books.value, o = b ? b.orders.find((x) => x.id === p.id) : null;
  if (!b || !o) return <FullSheet onBack={toSheet} backLabel="Back to To pack" head={<div class="ow-shead" />} />;
  if (o.copyOf != null) return <Copy b={b} o={o} />;
  return <Theirs b={b} o={o} />;
}
