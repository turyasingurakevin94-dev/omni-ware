/*
 * The Buyer app (docs/spec/04-screens-buyer.md, the canvas "Buyer — Agent
 * language"). Built by tools/build-app.js into next/buyer.html. ?demo opens
 * the sample shop (src/core/buyer/demo).
 */
import { render } from 'preact';
import '../../ui/tokens.css';
import '../sales/app.css';
import { watchKeyboard } from '../../ui/keyboard.ts';
import { App } from './shell/App.tsx';
import './shell/screens.ts';
import { start } from './shell/store.ts';

render(<App />, document.getElementById('app') as HTMLElement);
watchKeyboard();
void start();
