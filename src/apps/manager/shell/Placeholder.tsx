/*
 * A route's stand-in until its area builds it to the canvas: the id, its boards, and a way back.
 */
import type { JSX } from 'preact';
import type { ScreenDef } from '../../../ui/stack.ts';
import { nav, stack } from './nav.ts';
import type { Route } from './routes.ts';

export function placeholder(r: Route): ScreenDef {
  return {
    view: ({ params }): JSX.Element => {
      const shown = Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${v}`).join(' · ');
      return (
        <main class="mg-ph">
          <div class="ow-todo" data-route={r.id}>
            <b>{r.id}</b>
            <span>{`Built next by the ${r.area} area, to the canvas`}</span>
            <code>{r.boards}</code>
            {shown && <code>{shown}</code>}
            {stack.value.length > 1 && <button type="button" onClick={() => nav.back()}>Back</button>}
          </div>
        </main>
      );
    },
  };
}
