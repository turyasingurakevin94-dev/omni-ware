/*
 * The Store app (docs/spec/04-screens-store.md, the canvas "Store — in the agent app's
 * language", docs/canvas/store-agent/). Built by tools/build-app.js into next/store.html;
 * ?demo opens the sample day (src/core/store/demo). store.html stays the live app until
 * this one is switched (docs/rebuild.md).
 */
import { render } from 'preact';
import '../../ui/tokens.css';
import '../sales/app.css';
import './shell/store.css';
import { watchKeyboard } from '../../ui/keyboard.ts';
import { App } from './shell/App.tsx';
import './shell/screens.ts';
import { preloadAreas } from './shell/areas.ts';
import { start } from './shell/store.ts';

render(<App />, document.getElementById('app') as HTMLElement);
watchKeyboard();
void start();
// Pack, Goods in, Shelf and Out, quietly after the first paint (shell/areas.ts).
requestAnimationFrame(() => setTimeout(() => { void preloadAreas(); }, 0));
