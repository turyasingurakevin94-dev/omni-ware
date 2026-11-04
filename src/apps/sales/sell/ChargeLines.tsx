/*
 * SL39 · each charge on the order as its own row under the lines (not the delivery fee, which the dock
 * carries; not the credit charge, money.ts's one line): the charge's own glyph, its name, how it was
 * worked out ("20 bags × 500" when it is the shop's rate a bag), "+10,000", and a 44 px × to take it off.
 * One row a charge: adding Loading again replaces it (model.ts addCharge).
 */
import type { JSX } from 'preact';
import { perLines } from '../../../core/services.ts';
import type { Books, Charge } from '../../../core/types.ts';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { cur, removeCharge } from './model.ts';

/** "20 bags × 500" when the charge is the shop's rate for each one; else nothing. */
function how(b: Books, ch: Charge): JSX.Element | null {
  const x = cur.value, sv = b.settings.services.find((s) => s.label === ch.label && s.per);
  if (!x || !sv || !sv.per) return null;
  const n = perLines(sv, x.lines).reduce((t, l) => t + l.qty, 0);
  if (!(n > 0 && n * sv.value === ch.value)) return null;
  return <span class="mono sl-line-s">{`${n} `}<span class="ow-word">{`${sv.per}${n === 1 ? '' : 's'}`}</span>{` × ${fig(sv.value)}`}</span>;
}

export function ChargeLines(p: { b: Books }): JSX.Element | null {
  const x = cur.value;
  if (!x) return null;
  const rows = x.charges.filter((c) => !/^Delivery/.test(c.label) && c.value > 0);
  if (!rows.length) return null;
  return (
    <>
      {rows.map((ch) => {
        const sub = how(p.b, ch);
        return (
          <div key={ch.id} class="sl-line sl-charge">
            <span aria-hidden="true" class="sl-charge-ic"><Icon name="receipt" size={20} stroke={1.9} /></span>
            <span class="sl-line-t"><span class="sl-line-n">{ch.label}</span>{sub}</span>
            <span class="mono sl-chip">{fig(ch.value, false, true)}</span>
            <button type="button" class="sl-charge-x" aria-label={`Take ${ch.label} off the order`} onClick={() => removeCharge(ch.id)}><Icon name="close" size={16} stroke={2.4} /></button>
          </div>
        );
      })}
    </>
  );
}
