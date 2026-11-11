/*
 * The Store's stage sheet (store-agent PK01, IN01, OU01, OU20; routes §1): the agent's
 * "Packing 7" sheet over Today. A full sheet (P04: the 40 px strip above is Today under the
 * scrim, and is the way back) whose navy head holds the grabber, the title and its count,
 * one line under it, Close, and the rail Coming in · To pack · To load · On the road ·
 * Delivered with this sheet's stage lit. A rail stop opens its own sheet in this one's place.
 *
 *   <StageSheet id="pack" title="To pack" count={1} sub="#0556 waiting 39 m · 1 packing" chips={…}>…rows…</StageSheet>
 *
 * The area builders fill `sub`, `chips` (PK01's For you · To pack · Packing now … chips) and the body.
 */
import type { ComponentChildren, JSX } from 'preact';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from './nav.ts';
import { RAIL } from './routes.ts';
import './stagesheet.css';

export interface StageSheetProps {
  /** This sheet's route id ('pack', 'in', 'out/load', 'out/road'). */
  id: string;
  title: string;
  count?: number | null;
  sub?: ComponentChildren;
  /** Under the rail: the sheet's filter chips. */
  chips?: ComponentChildren;
  children?: ComponentChildren;
}

export function StageSheet(p: StageSheetProps): JSX.Element {
  const at = RAIL.findIndex((r) => r.id === p.id);
  const head = (
    <div class="st-stage-head">
      <span aria-hidden="true" class="ow-shead-grab" />
      <div class="st-stage-row">
        <span class="st-stage-t">
          <h1>{p.title}{p.count != null && <span class="mono">{p.count}</span>}</h1>
          {p.sub && <span class="st-stage-sub mono">{p.sub}</span>}
        </span>
        <button type="button" class="ow-shead-x" aria-label="Close: back to Today" onClick={() => nav.home()}><Icon name="close" size={20} stroke={2.2} /></button>
      </div>
      <nav class="st-stage-rail" aria-label={`Yard stages: ${p.title} of ${RAIL.map((r) => r.word).join(', ')}`}>
        <span aria-hidden="true" class="st-stage-line" />
        {at >= 0 && <span aria-hidden="true" class="st-stage-lit" style={{ left: `calc(${at * 20}% + 2px)` }} />}
        {RAIL.map((r, i) => (
          <button key={r.word} type="button" class={cx('st-stage-stop', i === at && 'on')} aria-current={i === at ? 'step' : undefined} disabled={!r.id}
            onClick={() => { if (r.id && i !== at) nav.replace(r.id); }}>
            <span class="st-stage-dot"><Icon name={r.icon} size={i === at ? 16 : 14} stroke={2} /></span>
            <span class="st-stage-w">{r.word}</span>
          </button>
        ))}
      </nav>
      {p.chips && <div class="st-stage-chips">{p.chips}</div>}
    </div>
  );
  return <FullSheet onBack={() => nav.back()} backLabel="Back to Today" head={head}>{p.children}</FullSheet>;
}
