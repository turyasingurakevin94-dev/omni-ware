/*
 * LOCAL PART (for the lead to fold into src/ui WhoPill as a `still` prop): the who pill that cannot
 * be changed, a plain box with no up/down arrows and no link. KC13 draws it while the sale is on
 * its way (the customer cannot change mid-send); KC11 while it waits for the Manager.
 *
 *   <StillWho face={{ initials: 'WI', tint: 't4' }} name="Counter sale" sub="Walk-in · waiting for Ruth" dot="var(--warn)" />
 */
import type { JSX } from 'preact';
import { Avatar, type Face } from '../../../ui/Avatar.tsx';
import '../../../ui/topbar.css';

export function StillWho(p: { face: Face; name: string; sub: string; dot: string }): JSX.Element {
  return (
    <div class="ow-who">
      <Avatar {...p.face} size={38} />
      <span class="ow-who-t">
        <span class="ow-who-n">{p.name}</span>
        <span class="ow-who-s"><span aria-hidden="true" class="ow-who-dot" style={{ background: p.dot }} />{p.sub}</span>
      </span>
    </div>
  );
}
