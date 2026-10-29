/*
 * S06 · The "Being checked" money split (LANGUAGE.md §5.2 S06): what a
 * customer owes, split into what Sales should collect and what Esther is
 * checking, as one bar and two glass tiles. On navy (a P04 head, or a
 * NavyCard).
 *
 *   <MoneySplit owes={290000} collect={165000} checked={125000} checker={{ face: { initials: 'EA', tint: 't5' }, name: 'Esther' }}
 *     onCollect={…} onChecked={…} />
 */
import type { JSX } from 'preact';
import { Avatar, type Face } from './Avatar.tsx';
import { SplitBar } from './Bar.tsx';
import { fig } from './Money.tsx';
import { Tap } from './util.tsx';
import './moneysplit.css';

export interface MoneySplitProps {
  owes: number;
  collect: number;
  checked: number;
  checker: { face: Face; name: string };
  onCollect: () => void;
  onChecked: () => void;
}

export function MoneySplit(p: MoneySplitProps): JSX.Element {
  return (
    <div class="ow-msplit">
      <span class="ow-msplit-h"><span>Owes</span><span class="mono">{fig(p.owes)}</span></span>
      <SplitBar h={10} label={`${fig(p.collect)} to collect, ${fig(p.checked)} being checked`}
        parts={[{ value: p.collect, color: '#F5B26B' }, { value: p.checked, color: 'hatch' }]} />
      <div class="ow-msplit-tiles">
        <Tap on={p.onCollect} class="ow-msplit-tile"><span>To collect</span><span class="mono amber">{fig(p.collect)}</span></Tap>
        <Tap on={p.onChecked} class="ow-msplit-tile">
          <span>Being checked</span><span class="mono blue">{fig(p.checked)}</span>
          <span class="ow-msplit-who"><Avatar {...p.checker.face} size={22} />{`${p.checker.name} checks it`}</span>
        </Tap>
      </div>
    </div>
  );
}
