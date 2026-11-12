/*
 * D-13 + D-14 The check-in differs (DecideStock p3 + "success"): line by line, the runner's
 * (Denis) against the Store's count (Musa), the line that differs highlighted with its supplier
 * and cost; the runner's note, which closes with the check-in. Take the check-in (a tap) books
 * the Store's count; Nudge Denis opens the nudge sheet.
 */
import type { JSX } from 'preact';
import { money, signed } from '../../../../core/money.ts';
import { checkin, type CheckinRow } from '../../../../core/manager/decide-stock.ts';
import type { CheckinAsk } from '../../../../core/manager/types.ts';
import { ANSWER, askWord, hm } from '../../../../core/manager/words.ts';
import { firstWord } from '../../../../core/names.ts';
import { Avatar } from '../../../../ui/Avatar.tsx';
import { Icon } from '../../../../ui/icons.tsx';
import { nav } from '../../shell/nav.ts';
import type { Kind } from '../kit.ts';
import './stock.css';

function Line(p: { r: CheckinRow }): JSX.Element {
  const r = p.r, d = r.diff !== 0;
  return (
    <div class={'mg-sk-tl' + (d ? ' diff' : '')}>
      <span class="mg-sk-tl-h"><b>{r.name}</b>
        <span><span class="mg-mono">{`${r.brought} · ${r.counted}`}</span>
          {d ? <span class="mg-mono mg-sk-tl-d">{`${signed(r.diff)} · ${signed(r.value)}`}</span> : <span class="ok"><Icon name="check" size={15} stroke={2.4} /></span>}</span></span>
      <span class="mg-sk-tl-bars" aria-hidden="true"><i /><i class="m" style={{ width: `${r.brought ? Math.min(100, (r.counted / r.brought) * 100) : 100}%` }} /></span>
      {d && <span class="mg-mono mg-sk-tl-s">{`${r.place} · ${money(r.cost)} each`}</span>}
    </div>
  );
}

export const kind: Kind<CheckinAsk> = (c) => {
  const a = c.a, k = checkin(a);
  const runner = a.runnerId ? c.b.team.find((p) => p.id === a.runnerId) || null : null;
  const rn = runner ? firstWord(runner.name) : 'the runner', sn = c.asker ? firstWord(c.asker.name) : 'the Store';
  const label = `${ANSWER.takeCheckin} · ${signed(k.total)}`;
  return {
    title: `${sn}'s ${askWord('checkin')}`,
    chip: { text: `${k.differ} of ${k.rows.length} lines ${k.differ === 1 ? 'differs' : 'differ'}`, tone: 'amber' },
    evidence: (
      <>
        <div class="mg-card">
          <div class="mg-card-h"><b class="mg-sk-h">Line by line</b>
            <span class="mg-sk-key"><span><i />{rn}</span><span><i class="g" />{sn}</span></span></div>
          {k.rows.map((r, i) => <Line key={i} r={r} />)}
        </div>
        {a.note && (
          <div class="mg-card mg-sk-note">
            <span class="mg-sk-note-h">{runner && <Avatar initials={runner.initials} tint={runner.tint === 'me' ? 'n' : runner.tint} size={24} />}<b>{`${rn}'s note`}</b><span class="mg-mono mg-soft">{hm(a.note.at)}</span></span>
            <span class="mg-sk-note-q">{`“${a.note.text}”`}</span>
            <span class="mg-sk-note-f"><Icon name="check" size={13} stroke={2} />Closes with the check-in</span>
          </div>
        )}
      </>
    ),
    dock: {
      told: [a.askerId || '', a.runnerId || ''],
      word: `${firstWord(c.b.me.name)} took ${sn}'s check-in`,
      primary: { tap: { label, on: () => c.tap(label, 'takeCheckin', [a.tripId, a.note ? a.note.handoffId : null]) } },
      secondary: runner ? { label: `Nudge ${rn}`, on: () => nav.push('team/nudge', { staff: runner.id }) } : null,
    },
  };
};
