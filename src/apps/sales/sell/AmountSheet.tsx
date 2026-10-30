/*
 * Any other amount on the order (a charge, the delivery fee), on the S03
 * keypad in the same light sheet as SL18: the field, the keypad, one navy
 * "Use 25,000". Drawn from SL18's parts; no board of its own yet.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Keypad } from '../../../ui/Keypad.tsx';
import { fig } from '../../../ui/Money.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { Frame } from './Frame.tsx';
import './price.css';

export function AmountSheet(p: { title: string; eyebrow?: string; value: number; onUse: (n: number) => void }): JSX.Element {
  const [typed, setTyped] = useState<string | null>(null);
  const v = typed == null ? p.value : Number(typed || 0);
  return (
    <Frame title={p.title} eyebrow={p.eyebrow} onClose={sheet.close} pad="10px 16px 20px" gap={10}
      foot={<button type="button" class="sl-btn navy" disabled={!(v > 0)} onClick={() => { p.onUse(v); sheet.close(); }}>Use <span class="mono">{fig(v)}</span></button>}>
      <div class="sl-pf"><span class="sl-pf-t"><span>Amount</span><span class="mono">{fig(v)}<span aria-hidden="true" class="sl-caret" /></span></span></div>
      <Keypad value={typed == null ? '' : typed} onChange={setTyped} />
    </Frame>
  );
}
