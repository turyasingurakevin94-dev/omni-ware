/*
 * All decided (route `decide/done`, Today p4): the navy head with the tick, "0 waiting · 09:59",
 * the answers coloured by who asked, Today's answers (what Ruth decided and what the app did by
 * itself), and Back to Today, the one end button of every flow.
 */
import type { ComponentChildren, JSX } from 'preact';
import type { Done as DoneLine, Person } from '../../../core/manager/types.ts';
import { firstWord } from '../../../core/names.ts';
import { hm as clock } from '../../../core/manager/words.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { nav } from '../shell/nav.ts';
import { books, now } from '../shell/store.ts';
import './done.css';

/** `strip`: the last answer's Undo strip, while it waits its 10 s (Decide shows All decided under it). */
export function Done(p: { strip?: ComponentChildren; params?: unknown }): JSX.Element | null {
  const b = books.value;
  if (!b) return null;
  const mine = b.done.filter((d) => !d.auto && d.at >= now.value - 12 * 3600e3);
  const told = new Set(b.done.flatMap((d) => d.told)).size;
  const who = new Map<string, number>();
  mine.forEach((d) => { const id = d.told[0]; if (id) who.set(id, (who.get(id) || 0) + 1); });
  const people = [...who.entries()].map(([id, n]) => ({ p: b.team.find((x) => x.id === id), n })).filter((x): x is { p: Person; n: number } => !!x.p);
  const total = people.reduce((s, x) => s + x.n, 0) || 1;
  const span = mine.length ? `${clock(Math.min(...mine.map((d) => d.at)))}–${clock(Math.max(...mine.map((d) => d.at)))}` : '';
  return (
    <div class="mg-d mg-done" role="dialog" aria-label="All decided">
      <header class="mg-done-head">
        <div class="mg-done-top">
          <span class="mg-done-tick"><Icon name="check" size={28} stroke={2.6} /></span>
          <span><h1>All decided</h1><b class="mono">{`0 waiting · ${clock(now.value)}`}</b></span>
        </div>
        {mine.length > 0 && (
          <>
            <div class="mg-done-row"><span>{`${mine.length} ANSWERED · WHO ASKED`}</span><b class="mono">{span}</b></div>
            <div class="mg-done-bar" aria-hidden="true">{people.map((x) => <i key={x.p.id} style={{ flex: x.n / total, background: barTint(x.p) }} />)}</div>
            <div class="mg-done-legend">{people.map((x) => <span key={x.p.id}><i style={{ background: barTint(x.p) }} />{`${firstWord(x.p.name)} ${x.n}`}</span>)}</div>
          </>
        )}
      </header>
      <div class="mg-d-body">
        {p.strip}
        <div class="mg-done-h"><b>Today's answers</b><span><Icon name="bell" size={14} stroke={2} /><span class="mono">{`${told} told`}</span></span></div>
        <ul class="mg-done-list">{b.done.map((d, i) => <Line key={i} d={d} team={b.team} />)}</ul>
      </div>
      <footer class="mg-done-foot"><button type="button" class="mg-done-back" onClick={() => nav.home()}>Back to Today</button></footer>
    </div>
  );
}

function barTint(p: Person): string {
  return ({ t0: '#7FB2E0', t1: '#D59BC6', t2: '#6CC4B9', t3: '#9AA0EE', t4: '#AEB7C6', t5: '#F5B26B', t6: '#6FDCB0', n: '#C9C4BA', me: '#fff' } as Record<string, string>)[p.tint] || '#C9C4BA';
}

function Line(p: { d: DoneLine; team: Person[] }): JSX.Element {
  const faces = p.d.told.map((id) => p.team.find((x) => x.id === id)).filter((x): x is Person => !!x).slice(0, 3);
  return (
    <li class={'mg-done-li' + (p.d.auto ? ' auto' : '')}>
      <span class="mono t">{clock(p.d.at)}</span>
      <span class="ic"><Icon name={p.d.auto ? 'receipt' : 'check'} size={16} stroke={2.2} /></span>
      <span class="w"><b>{p.d.word}</b><span class="mono">{p.d.sub}</span></span>
      <span class="f">{faces.map((x) => <Avatar key={x.id} initials={x.initials} tint={x.tint === 'me' ? 'n' : x.tint} size={24} />)}</span>
    </li>
  );
}
