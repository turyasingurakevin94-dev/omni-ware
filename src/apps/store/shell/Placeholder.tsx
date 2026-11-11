/*
 * A route's stand-in until its area builds it: the route id, its boards and its
 * params, and a way back. A stage route stands in inside its StageSheet. An area
 * replaces it by exporting a screen for the id from its own index.tsx.
 */
import type { JSX } from 'preact';
import { nav, stack, type Params, type ScreenDef } from './nav.ts';
import { ROUTES, type Route } from './routes.ts';
import { StageSheet } from './StageSheet.tsx';

const TITLE: Record<string, string> = { pack: 'To pack', in: 'Coming in', 'out/load': 'To load', 'out/road': 'On the road' };

function Body(p: { r: Route; params: Params }): JSX.Element {
  const shown = Object.entries(p.params).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${v}`).join(' · ');
  return (
    <div class="ow-todo" data-route={p.r.id}>
      <b>{p.r.id}</b>
      <span>{`Built next by the ${p.r.area} area, to the canvas`}</span>
      <code>{p.r.boards.join(' · ')}</code>
      {shown && <code>{shown}</code>}
      {p.r.kind !== 'stage' && stack.value.length > 1 && <button type="button" onClick={() => nav.back()}>Back</button>}
    </div>
  );
}

export function placeholder(r: Route): ScreenDef {
  if (r.kind === 'stage') return { view: ({ params }) => <StageSheet id={r.id} title={TITLE[r.id] || r.id}><Body r={r} params={params} /></StageSheet> };
  return { view: ({ params }) => <main class="st-ph"><Body r={r} params={params} /></main> };
}

/** A placeholder for every route id: the areas' own screens go over these (screens.ts). */
export function placeholders(): Record<string, ScreenDef> {
  return Object.fromEntries(ROUTES.map((r) => [r.id, placeholder(r)]));
}
