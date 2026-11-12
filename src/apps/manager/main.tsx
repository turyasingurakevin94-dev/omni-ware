/*
 * The Manager app (docs/spec/04-screens-manager.md, the canvas "Manager — Agent language",
 * docs/canvas/manager/). Built by tools/build-app.js into next/manager.html; ?demo opens the
 * sample day (src/core/manager/demo).
 */
import { render } from 'preact';
import '../../ui/tokens.css';
import '../sales/app.css';
import './shell/manager.css';
import { watchKeyboard } from '../../ui/keyboard.ts';
import { App } from './shell/App.tsx';
import './shell/screens.ts';
import { start } from './shell/store.ts';
import { managerSupabase } from '../../core/manager/supabase.ts';

render(<App />, document.getElementById('app') as HTMLElement);
watchKeyboard();
void start(async () => managerSupabase());
