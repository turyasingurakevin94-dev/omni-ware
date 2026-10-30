/*
 * A light sheet in the chat boards' measures (P17; local: the shared LightSheet has no place for
 * a chip beside the ×, and its body pads 16): the grabber, the eyebrow and the title, a chip and
 * the ×, then the body (12 16 22, gap 12), the one button last.
 */
import type { ComponentChildren, JSX } from 'preact';
import { Icon } from '../../../ui/icons.tsx';

export function LSheet(p: { title: string; eyebrow?: string; extra?: ComponentChildren; onClose: () => void; ground?: boolean; children: ComponentChildren }): JSX.Element {
  return (
    <div class={'ow-lsheet' + (p.ground ? ' ground' : '')}>
      <button type="button" class="ow-grab" aria-label="Close" onClick={p.onClose} />
      <div class="ow-lsheet-h">
        <div class="ow-lsheet-ht">{p.eyebrow && <span class="ow-lsheet-eye">{p.eyebrow}</span>}<h2>{p.title}</h2></div>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {p.extra}
          <button type="button" class="ow-x-tile" aria-label="Close" onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button>
        </span>
      </div>
      <div class="ls-body">{p.children}</div>
    </div>
  );
}
