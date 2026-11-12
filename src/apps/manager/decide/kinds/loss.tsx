/*
 * D-16 Damaged · Lost · Stolen (DecideStock p1 + "disabled", "sending", "offline"): the photo, the
 * shelf before → after with its bag tiles, a switch per report (on), what comes off at cost and
 * "In the owner's log · at cost". The slide writes off the reports switched on; Kept on the shelf
 * (a tap) keeps them all. Nothing switched: "Pick what to write off"; no signal: the slide waits.
 */
import type { JSX } from 'preact';
import { money, signed } from '../../../../core/money.ts';
import { lossOff, lossSplit, shelfAfter, units } from '../../../../core/manager/decide-stock.ts';
import type { LossAsk, LossReport } from '../../../../core/manager/types.ts';
import { ANSWER, askWord } from '../../../../core/manager/words.ts';
import { Icon } from '../../../../ui/icons.tsx';
import { ItemArt } from '../../../../ui/ItemArt.tsx';
import { online } from '../../shell/store.ts';
import type { Kind } from '../kit.ts';
import './stock.css';

const TILES = 54;

/** The photo, or (no picture yet, as in the demo) the board's stand-in: two bags and the time it was taken. */
function Photo(p: { r: LossReport; who: string }): JSX.Element {
  const url = p.r.photo && /^(https?:|data:|blob:)/.test(p.r.photo) ? p.r.photo : null;
  const at = url ? null : p.r.photo;
  return (
    <span class="mg-sk-photo" role="img" aria-label={`${p.who}'s photo of the ${p.r.qty} ${askWord('loss', undefined, p.r.why).toLowerCase()} ${units(p.r.qty, p.r.unit)}`}>
      {url ? <img src={url} alt="" /> : (
        <>
          <i class="b1" /><i class="b2" />
          <svg width="132" height="150" viewBox="0 0 132 150" aria-hidden="true"><path d="M30 60l12 10-6 12 14 8" fill="none" stroke="#8A7F6C" stroke-width="2" stroke-linecap="round" /><path d="M78 70l10 8-8 10 10 10" fill="none" stroke="#8A7F6C" stroke-width="2" stroke-linecap="round" /><ellipse cx="66" cy="130" rx="44" ry="7" fill="#A89C88" /></svg>
        </>
      )}
      {at && <span class="mg-sk-photo-t"><Icon name="camera" size={12} stroke={2} /><span class="mg-mono">{at}</span></span>}
    </span>
  );
}

function Shelf(p: { r: LossReport; on: boolean }): JSX.Element {
  const s = shelfAfter(p.r, p.on), n = Math.min(s.now, TILES);
  const off = s.now ? Math.max(p.on && p.r.qty ? 1 : 0, Math.round(((s.now - s.after) / s.now) * n)) : 0;
  return (
    <span class="mg-sk-shelf">
      <span class="mg-sk-k">On the shelf</span>
      <span class="mg-sk-to"><b class="mg-mono">{s.now}</b><span>→</span><b class="mg-mono">{s.after}</b><span class="u">{units(s.now, p.r.unit)}</span></span>
      <span class="mg-sk-tiles" role="img" aria-label={`${s.now} ${units(s.now, p.r.unit)} on the shelf, ${s.now - s.after} come off`}>
        {Array.from({ length: n }, (_, i) => <i key={i} class={i >= n - off ? 'off' : ''} />)}
      </span>
      <span class="mg-sk-legend"><span><i /><b class="mg-mono">{s.after}</b> stay</span>{s.now > s.after && <span><i class="off" /><b class="mg-mono">{s.now - s.after}</b> off</span>}</span>
    </span>
  );
}

export const kind: Kind<LossAsk> = (c) => {
  const rs = c.a.reports, all = rs.map((r) => r.id);
  const [on, setOn] = c.pick<string[]>('on', all);
  const off = lossOff(rs, on), [ids, keep] = lossSplit(rs, on);
  const who = c.asker ? c.asker.name.split(' ')[0] : '';
  const first = rs[0];
  const why = first ? askWord('loss', undefined, first.why) : askWord('loss');
  const unitsOff = units(off.qty, off.unit);
  const word = `${ANSWER.writtenOff} · ${money(off.total)}`;
  const nothing = !ids.length;
  return {
    title: rs.length === 1 && first ? `${why} · ${first.name}` : why,
    chip: first ? { text: `${first.note || why} · ${rs.reduce((s, r) => s + r.qty, 0)} ${units(first.qty, first.unit)}`, tone: 'amber' } : null,
    evidence: (
      <>
        {rs.map((r) => (
          <div key={r.id} class="mg-sk-stack">
            <div class="mg-card mg-sk-pc"><Photo r={r} who={who} /><Shelf r={r} on={on.includes(r.id)} /></div>
            <div class="mg-sk-rep">
              <ItemArt name={r.name} size={38} />
              <span class="mg-sk-rep-t"><b>{r.name} · <span class="mg-mono">{r.qty}</span></b><span class="mg-mono">{`${askWord('loss', undefined, r.why)} · ${r.qty} × ${money(r.cost)}`}</span></span>
              <b class="mg-mono mg-sk-rep-v">{on.includes(r.id) ? signed(-r.qty * r.cost) : '0'}</b>
              <button type="button" class="mg-sk-sw" role="switch" aria-checked={on.includes(r.id)} aria-label={`Write off ${r.name}, ${r.qty} ${units(r.qty, r.unit)}`}
                onClick={() => setOn(on.includes(r.id) ? on.filter((x) => x !== r.id) : [...on, r.id])}><i /></button>
            </div>
          </div>
        ))}
        <span class="mg-sk-log"><Icon name="note" size={14} stroke={2} />In the owner's log · at cost</span>
      </>
    ),
    dock: {
      told: [c.a.askerId || ''],
      word: ANSWER.writtenOff,
      total: { v: off.total, sub: nothing ? 'nothing picked' : `${off.qty} ${unitsOff} at cost` },
      primary: {
        slide: {
          label: word,
          on: () => c.slide(word, 'writeOff', [ids, keep]),
          disabled: nothing ? 'Pick what to write off' : !online.value ? 'Write off needs signal' : undefined,
        },
      },
      secondary: { label: ANSWER.keptShelf, on: () => c.tap(ANSWER.keptShelf, 'keepOnShelf', [all]) },
    },
  };
};
