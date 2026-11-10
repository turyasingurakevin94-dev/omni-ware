/* Every screen of the Buyer app, by id (ROUTES: 'today', 'orders/order' …). Each tab gives its own. */
import { screens as orders } from '../orders/index.tsx';
import { screens as replies } from '../replies/index.tsx';
import { screens as suppliers } from '../suppliers/index.tsx';
import { screens as today } from '../today/index.tsx';
import { screens as trip } from '../trip/index.tsx';
import { register } from './nav.ts';

register({ ...today, ...orders, ...replies, ...trip, ...suppliers });
