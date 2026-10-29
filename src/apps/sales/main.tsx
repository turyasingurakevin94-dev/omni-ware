/*
 * The Sales app (docs/spec/04-screens-sales.md). Built by tools/build-app.js
 * into next/sales.html. ?demo opens the sample shop (src/core/demo/README.md);
 * ?demo&parts=main|main2 the parts gallery (src/ui/README.md).
 */
import { render } from 'preact';
import '../../ui/tokens.css';
import './app.css';
import { App } from './shell/App.tsx';
import { start } from './shell/store.ts';

// ?demo&parts=main|main2: the parts gallery (src/ui/gallery), its own file beside the page.
const parts = /[?&]demo(&|=|$)/.test(location.search) ? new URLSearchParams(location.search).get('parts') : null;
if (parts) {
  const el = document.createElement('script');
  el.src = location.pathname.replace(/[^/]*$/, '') + 'sales-parts.js';
  document.head.appendChild(el);
} else {
  render(<App />, document.getElementById('app') as HTMLElement);
  void start();
}
