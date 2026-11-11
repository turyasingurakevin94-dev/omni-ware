/*
 * Every screen of the Store app, by route id (routes.ts). The shell's and Today's are in the
 * page; Pack, Goods in, Shelf and Out are each their own file (shell/areas.ts), and until one
 * is here its ids draw their loading state and fetch it. An id no area exports draws its
 * placeholder.
 */
import { screens as today } from '../today/index.tsx';
import { areaOf, isLoaded, loadArea } from './areas.ts';
import { loading } from './Loading.tsx';
import { register } from './nav.ts';
import { placeholder } from './Placeholder.tsx';
import { route } from './routes.ts';
import { SignIn } from './SignIn.tsx';

register({ 'shell/sign-in': { view: SignIn }, ...today }, (id) => {
  const r = route(id);
  if (!r) return undefined;
  const a = areaOf(id);
  if (!a || isLoaded(a)) return placeholder(r);
  void loadArea(a).catch(() => undefined);
  return loading(id, a);
});
