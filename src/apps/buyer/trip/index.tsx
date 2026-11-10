/* The trip tab's screens (stand-ins until built to the canvas). */
import type { JSX } from 'preact';
import type { ScreenDef } from '../shell/nav.ts';

const Todo = ({ params }: { params: Record<string, unknown> }): JSX.Element => (
  <main class="ow-todo"><b>trip</b><code>{JSON.stringify(params)}</code></main>
);

export const screens: Record<string, ScreenDef> = { 'trip': { view: Todo } };
