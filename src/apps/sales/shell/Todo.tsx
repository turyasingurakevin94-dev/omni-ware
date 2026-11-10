/*
 * A tab's stand-in screen until its builder replaces it: the tab's name,
 * the boards it will draw, and a way back. Delete the use of it in your
 * tab's index.tsx once the real screen is in.
 */
import type { JSX } from 'preact';
import { nav, stack } from './nav.ts';

export function Todo(p: { title: string; boards: string }): JSX.Element {
  return (
    <main class="ow-todo">
      <b>{p.title}</b>
      <span>Built next, to the canvas</span>
      <code>{p.boards}</code>
      {stack.value.length > 1 && <button type="button" onClick={() => nav.back()}>Back</button>}
    </main>
  );
}
