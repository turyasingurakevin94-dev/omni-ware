/*
 * The Sales app (docs/spec/04-screens-sales.md). Built by tools/build-app.js
 * into next/sales.html. ?demo opens the sample shop (src/core/demo/README.md).
 */
import { render } from 'preact';
import '../../ui/tokens.css';
import './app.css';
import { App } from './shell/App.tsx';
import { start } from './shell/store.ts';

render(<App />, document.getElementById('app') as HTMLElement);
void start();
