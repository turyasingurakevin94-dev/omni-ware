/*
 * The parts gallery: next/sales.html?demo&parts=main draws the shared parts
 * board (Main.dc.html, 1600 × 1600) and &parts=main2 the Sales-only one
 * (Main2.dc.html, 1600 × 1000), each from src/ui's parts, laid out as the
 * board lays them out. tools/parity/run.cjs sets the one beside the other.
 */
import type { JSX } from 'preact';
import { Column1, Column2 } from './MainLeft.tsx';
import { Column3, Column4 } from './MainRight.tsx';

export function MainBoard(): JSX.Element {
  return (
    <div class="g-board">
      <Column1 />
      <Column2 />
      <Column3 />
      <Column4 />
    </div>
  );
}
