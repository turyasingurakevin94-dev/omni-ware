/*
 * The parts gallery's own file, next/sales-parts.js (tools/build-app.js),
 * loaded by the page only on ?demo&parts=main|main2, so the page never
 * carries it. It draws one board into #app (main, main2), or the parts
 * that act, live (try).
 */
import { render } from 'preact';
import '../tokens.css';
import { MainBoard } from './Main.tsx';
import { Main2Board } from './Main2.tsx';
import { TryBoard } from './Try.tsx';

const which = new URLSearchParams(location.search).get('parts');
if (which !== 'try') document.body.style.background = '#F4F2EE';
render(which === 'main2' ? <Main2Board /> : which === 'try' ? <TryBoard /> : <MainBoard />, document.getElementById('app') as HTMLElement);
