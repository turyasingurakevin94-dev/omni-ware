/*
 * Any other amount on the order (SL32: a charge's own figure; the delivery
 * fee), on the S03 keypad in the same light sheet as SL18: the field with
 * the shop's rate beside it, the keypad, one navy button ("Add 15,000" for
 * a charge, "Use 15,000" for the fee).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Icon } from '../../../ui/icons.tsx';
import { Keypad } from '../../../ui/Keypad.tsx';
import { fig } from '../../../ui/Money.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { Frame } from './Frame.tsx';
import './lines.css';
import './price.css';

export interface AmountProps { title: string; eyebrow?: string; value: number; rate?: number; verb: 'Add' | 'Use'; onUse: (n: number) => void }

export function AmountSheet(p: AmountProps): JSX.Element {
  const [typed, setTyped] = useState<string | null>(null);
  const v = typed == null ? p.value : Number(typed || 0);
  return (
    <Frame title={p.title} eyebrow={p.eyebrow} onClose={sheet.close} pad="10px 16px 20px" gap={10}
      foot={<button type="button" class="sl-btn navy" disabled={!(v > 0)} onClick={() => { p.onUse(v); sheet.close(); }}>{p.verb === 'Add' && <Icon name="plus" size={18} stroke={2.4} />}{`${p.verb} `}<span class="mono">{fig(v)}</span></button>}>
      <div class="sl-pf">
        <span class="sl-pf-t"><span>Amount</span><span class="mono">{fig(v)}<span aria-hidden="true" class="sl-caret" /></span></span>
        {p.rate ? <span class="mono sl-pfield-d sl-rate">{`rate ${fig(p.rate)}`}</span> : null}
      </div>
      <Keypad value={typed == null ? '' : typed} onChange={setTyped} />
    </Frame>
  );
}
