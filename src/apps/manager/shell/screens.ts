/*
 * Every screen of the Manager app, by route id (routes.ts). Each area's index.tsx exports its
 * screens; an id no area exports yet draws its placeholder (the id, its boards, a way back).
 */
import { screens as decide } from '../decide/index.tsx';
import { screens as money } from '../money/index.tsx';
import { screens as orders } from '../orders/index.tsx';
import { screens as team } from '../team/index.tsx';
import { screens as today } from '../today/index.tsx';
import { register } from './nav.ts';
import { placeholder } from './Placeholder.tsx';
import { route } from './routes.ts';
import { shellScreens } from './shell-screens.tsx';

register({ ...shellScreens, ...today, ...decide, ...orders, ...money, ...team }, (id) => {
  const r = route(id);
  return r ? placeholder(r) : undefined;
});
