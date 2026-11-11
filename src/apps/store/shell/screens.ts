/*
 * Every screen of the Store app, by route id (routes.ts). A placeholder for each id
 * first, the shell's working sign-in over it, then each area's own screens over those:
 * an area replaces a placeholder by exporting the id from its index.tsx.
 */
import { screens as inArea } from '../in/index.tsx';
import { screens as out } from '../out/index.tsx';
import { screens as pack } from '../pack/index.tsx';
import { screens as shelf } from '../shelf/index.tsx';
import { screens as today } from '../today/index.tsx';
import { register } from './nav.ts';
import { placeholders } from './Placeholder.tsx';
import { SignIn } from './SignIn.tsx';

register({ ...placeholders(), 'shell/sign-in': { view: SignIn }, ...today, ...pack, ...inArea, ...shelf, ...out });
