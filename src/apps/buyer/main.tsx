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
import { startNative } from './shell/native.ts';
import { start } from './shell/store.ts';

render(<App />, document.getElementById('app') as HTMLElement);
// Inside the phone app: Back, the bars, the live update and the pushes (shell/native.ts). Nothing in a browser.
startNative();
watchKeyboard();
void start();
