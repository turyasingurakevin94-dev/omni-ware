/*
 * Team p4 (route `team/nudge` { staff, order? }, a sheet): nudge someone, or give their job to
 * someone else. Nudge · Give it to; About (their orders that do not wait on the Manager, the stuck
 * one first, then "Call me when you can"); what they get, the push as their phone shows it, in words
 * the app writes (core/manager/nudge.ts; Change to say it another way); the dock "Nudge Denis".
 * Give it to is off, with its reason, when nobody else does the job ("only Denis buys").
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { aboutOrder, CALL_ME, nudgeTitle } from '../../../core/manager/nudge.ts';
import { aboutOf, holdsNow, onlyWord, orderLine, overLimit, peerOf } from '../../../core/manager/team.ts';
import { limitsOf } from '../../../core/manager/watch.ts';
import { ROLE } from '../../../core/manager/words.ts';
import { firstWord, orderNo } from '../../../core/names.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { SectionHead } from '../../../ui/SectionHead.tsx';
import type { Params } from '../../../ui/stack.ts';
import { books, now } from '../shell/store.ts';
import { tapMove } from './Move.tsx';
import { CloseX, DockMove, Sees, TeamSheet } from './Sheet.tsx';
import './nudge.css';

export function Nudge(p: { params: Params }): JSX.Element | null {
  const b = books.value, t = now.value;
  const x = b ? b.team.find((y) => y.id === p.params.staff) : null;
  const asked = p.params.order != null ? Number(p.params.order) : null;
  const [mode, setMode] = useState<'nudge' | 'give'>('nudge');
  const [pick, setPick] = useState<number | 'call' | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  if (!b || !x) return null;
  const name = firstWord(x.name), peer = peerOf(b, x), peerName = peer ? firstWord(peer.name) : '';
  const giving = mode === 'give' && !!peer;
  // A nudge is about what they can move (not what waits on the Manager); a give, about anything they hold.
  let orders = giving ? holdsNow(b, x) : aboutOf(b, x, t);
  const one = asked != null ? b.orders.find((o) => o.id === asked) : null;
  if (one && !orders.includes(one)) orders = [one, ...orders];
  const chosen: number | 'call' = pick ?? (one ? one.id : orders[0] ? orders[0].id : 'call');
  const about = giving && chosen === 'call' ? (orders[0] ? orders[0].id : 'call') : chosen;
  const o = about === 'call' ? null : b.orders.find((y) => y.id === about) || null;
  const auto = o ? aboutOrder(o, t, limitsOf(b.shop)) : CALL_ME;
  const words = edit ?? auto, title = nudgeTitle(b.me);
  const late = overLimit(b, x.id, t) > 0;
  const nid = 'nudge:' + x.id, gid = 'give:' + (o ? o.id : 'none');
  const choose = (v: number | 'call') => { setPick(v); setEdit(null); };
  const opts: { v: number | 'call'; t: JSX.Element; sub: string; late: boolean }[] = [
    ...orders.map((y) => { const l = orderLine(b, y, t); return { v: y.id, t: <><span class="mg-mono">{orderNo(y.id)}</span> {y.customerName}</>, sub: l.text, late: l.late }; }),
    ...(giving ? [] : [{ v: 'call' as const, t: <>Call me when you can</>, sub: 'just a word', late: false }]),
  ];
  return (
    <TeamSheet label={`${mode === 'give' ? 'Give a job' : 'Nudge'}: ${x.name}`} head={(
      <>
        <div class="mg-ts-who">
          <Avatar initials={x.initials} tint={x.tint} size={52} font={16} ring={late ? '0 0 0 3px #16203C, 0 0 0 5px #F5B26B' : undefined} />
          <span class="mg-ts-name"><b>{x.name}</b><span class="mg-ts-role">{`${ROLE[x.role]} · ${x.holds}`}</span></span>
          <CloseX />
        </div>
        <div class="mg-tn-seg-box">
          <div class="mg-tn-seg" role="radiogroup" aria-label="Nudge or give it to someone">
            <button type="button" role="radio" aria-checked={mode === 'nudge'} onClick={() => setMode('nudge')}><Icon name="send" size={16} stroke={2} />Nudge</button>
            <button type="button" role="radio" aria-checked={mode === 'give'} aria-disabled={peer ? undefined : 'true'} class={peer ? '' : 'off'}
              onClick={() => { if (peer) setMode('give'); }}><Icon name="swap" size={16} stroke={2} />Give it to</button>
          </div>
          {!peer && <span class="mg-tn-why">{onlyWord(x)}</span>}
        </div>
      </>
    )} dock={giving ? (
      <>
        <Sees who={peerName} word={o ? orderNo(o.id) : ''} />
        <DockMove id={gid} icon="swap" word={`Give it to ${peerName}`} done="Given" off={o ? undefined : `${name} holds nothing`}
          on={() => { if (o && peer) tapMove(gid, `Given to ${peerName}`, 'giveTo', [o.id, peer.id]); }} />
      </>
    ) : (
      <>
        <Sees who={name} word={title} />
        <DockMove id={nid} icon="send" word={`Nudge ${name}`} done="Nudged" off={x.userId ? (words.trim() ? undefined : 'Write the words') : `${name} has no phone`}
          on={() => tapMove(nid, `Nudged ${name}`, 'nudge', [x.id, o ? o.id : null, words.trim()])} />
      </>
    )}>
      <SectionHead title="About" meta={String(opts.length)} />
      <div class="mg-tn-list" role="radiogroup" aria-label="About">
        {opts.map((y) => (
          <button key={String(y.v)} type="button" role="radio" aria-checked={about === y.v} onClick={() => choose(y.v)}>
            <span class="r" aria-hidden="true" />
            <span class="t"><b>{y.t}</b><span class={'mg-mono' + (y.late ? ' late' : '')}>{y.sub}</span></span>
          </button>
        ))}
      </div>
      {!giving && (
        <>
          <div class="mg-tn-gets">
            <h2>{`${name} gets`}</h2>
            <button type="button" aria-label="Change the words" aria-pressed={edit != null} onClick={() => setEdit(edit == null ? words : null)}><Icon name="pen" size={16} stroke={2} />Change</button>
          </div>
          <div class="mg-tn-phone">
            <div class="mg-tn-push">
              <span class="h"><span class="ic" aria-hidden="true"><Icon name="bell" size={11} stroke={2.4} /></span>{`${ROLE[x.role]} · now`}</span>
              <b>{title}</b>
              {edit == null ? <span class="w">{words}</span>
                : <textarea class="mg-tn-edit" aria-label={`What ${name} gets`} value={edit} onInput={(e) => setEdit((e.target as HTMLTextAreaElement).value)} />}
              {o && <span class="open">{`Open ${orderNo(o.id)}`}</span>}
            </div>
          </div>
        </>
      )}
    </TeamSheet>
  );
}
