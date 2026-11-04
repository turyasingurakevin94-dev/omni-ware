/*
 * The Chats head (P03 in the Chats tab's measures: gap 14): the title and your chats, the team
 * pill (who is on) and the New chat pen, then the one picture, the wait line: everyone waiting
 * for a reply, placed by how long, with the late half from 30 m. Then the search.
 */
import type { JSX } from 'preact';
import { Avatar, type Face } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { ClearButton, Search } from '../../../ui/Search.tsx';
import { Tap } from '../../../ui/util.tsx';
import type { WaitMark } from './model.ts';

export interface PillFace { face: Face; me: boolean; away: boolean }

export interface ListHeadProps {
  count: number | null;
  team: PillFace[];
  onTeam: () => void;
  onNew: () => void;
  /** null while the chats load (shimmer), else the wait line. */
  wait: { marks: WaitMark[]; oldest: number; words: string } | null;
  q: string;
  onQ: (v: string) => void;
}

export function ListHead(p: ListHeadProps): JSX.Element {
  const on = p.team.filter((x) => !x.away).length, w = p.wait;
  return (
    <header class="ch-head">
      <div class="ch-head-top">
        <h1>Chats{!!p.count && <span class="mono">{p.count}</span>}</h1>
        <Tap on={p.onTeam} label={`The team: ${on} on now`} class="ch-teampill">
          <span>{p.team.map((x, i) => (
            <span key={i} class={'ch-pf' + (x.away ? ' away' : '')}>
              <Avatar {...x.face} size={26} font={11} style={x.me ? { background: "#2F3D66" } : undefined} /><i />
            </span>
          ))}</span>
          <span><b class="mono">{on}</b> on</span>
        </Tap>
        <Tap on={p.onNew} label="New chat" class="ch-pen"><Icon name="pen" size={20} stroke={2} /></Tap>
      </div>
      <div class="ch-stat">
        {!w ? (
          <span class="ch-stat-n load"><span aria-hidden="true" class="ow-shim navy" style={{ display: 'block', width: '30px', height: '26px' }} /><span>waiting for a reply</span></span>
        ) : (
          <div class="ch-stat-row">
            <span class="ch-stat-n"><span class={'mono' + (w.marks.length ? '' : ' none')}>{w.marks.length}</span><span>{w.words}</span></span>
            {!!w.marks.length && <span class="ch-oldest"><Icon name="clock" size={13} stroke={2.4} />oldest <b class="mono">{`${w.oldest} m`}</b></span>}
          </div>
        )}
        {w && w.marks.length ? (
          <div role="img" aria-label={'Waiting: ' + w.marks.map((m) => `${m.title} ${m.mins} minutes`).join(', ')} class="ch-wl">
            <div class="ch-wl-t">
              <i aria-hidden="true" /><i aria-hidden="true" class="late" />
              {w.marks.map((m) => (
                <span key={m.key} class="ch-wl-m" style={{ left: `calc(${m.pct.toFixed(1)}% + ${m.offset}px)` }}>
                  {m.face ? <Avatar {...m.face} size={26} font={11} /> : <span class="ch-wl-ph"><Icon name="phone" size={13} stroke={2.2} /></span>}
                </span>
              ))}
            </div>
            <div aria-hidden="true" class="ch-wl-l"><span>now</span><span>30 m · late</span><span class="mono">1 h</span></div>
          </div>
        ) : <div aria-hidden="true" class="ch-wl-t"><i class={w ? undefined : 'shim'} /></div>}
      </div>
      <div class={'ch-q' + (p.q ? ' on' : '')}>
        <Search tone="navy" placeholder="Name, phone or what they said" label="Find a chat" value={p.q} onInput={p.onQ} />
        {/* CH08: a typed search clears in one tap (the shared navy field draws no clear of its own). */}
        {p.q && <ClearButton navy disc={26} class="ch-q-x" label="Clear the search" on={() => p.onQ('')} />}
      </div>
    </header>
  );
}
