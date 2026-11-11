/*
 * shelf/scan { then? } · SH40 scan a shelf label.
 *
 * The camera with its four corners; a label read shows the item under it: the shelf (blind when a count is due),
 * damage found and not reported, and Report · Open · Count. Scan the next label to keep going.
 * Labels carry "OW1:<item key>" (store.html:5806 shelf labels). The phone reads them with the browser's
 * BarcodeDetector where it has one; the demo reads FACTS' label A-014, Iron sheet G28.
 */
import { personFace } from '../../../core/store/faces.ts';
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { clock } from '../../../core/time.ts';
import { letterOf } from '../../../core/store/shelf.ts';
import type { ShelfItem, YardBooks } from '../../../core/store/types.ts';
import { Icon } from '../../../ui/icons.tsx';
import { toast } from '../../../ui/toast.tsx';
import { nav, type Params } from '../shell/nav.ts';
import { books, isDemo, now } from '../shell/store.ts';
import { foundFor } from './found.ts';
import { Glyph, ItemPic } from './glyphs.tsx';
import { itemState, StateChips } from './rows.tsx';
import './scan.css';

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global { interface Window { BarcodeDetector?: new (o: { formats: string[] }) => Detector } }

/** "A-014": the aisle letter and the item's place in its aisle. */
const labelOf = (b: YardBooks, it: ShelfItem): string => `${letterOf(b, it.category) || '?'}-${String(b.items.filter((x) => x.category === it.category).indexOf(it) + 1).padStart(3, '0')}`;

/** The label drawn where the camera would be (the demo's stand-in for the camera). */
function Label(p: { b: YardBooks; it: ShelfItem }): JSX.Element {
  const bars = '1121231211221312112213121122131211221321'.split('').map(Number);
  return (
    <div aria-hidden="true" class="sh-sc-label">
      <span><b class="mono">{letterOf(p.b, p.it.category)}</b><span class="mono">{labelOf(p.b, p.it)}</span></span>
      <span class="sh-sc-bars">{bars.map((w, i) => <span key={i} style={{ width: `${w}px`, background: i % 2 ? 'transparent' : '#1C2233' }} />)}</span>
      <span>{p.it.name}</span>
    </div>
  );
}

export function Scan(_p: { params: Params }): JSX.Element {
  const b = books.value, at = now.value, video = useRef<HTMLVideoElement>(null);
  const [key, setKey] = useState<string | null>(null), [torch, setTorch] = useState(false);
  useEffect(() => {
    if (isDemo) { const t = window.setTimeout(() => setKey('p-is28'), 300); return () => clearTimeout(t); }
    let stream: MediaStream | null = null, stop = false;
    const D = window.BarcodeDetector;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } }).then((s) => {
      stream = s;
      if (!video.current) return;
      video.current.srcObject = s; void video.current.play();
      if (!D) return;
      const d = new D({ formats: ['code_39', 'code_128', 'qr_code'] });
      const tick = () => { if (stop || !video.current) return; d.detect(video.current).then((r) => { const v = r[0] && r[0].rawValue; if (v) setKey(v.replace(/^OW1:/, '')); }).catch(() => undefined).finally(() => window.setTimeout(tick, 400)); };
      tick();
    }).catch(() => toast.show('The camera is off · let the app use it', { kind: 'warn' }));
    return () => { stop = true; if (stream) stream.getTracks().forEach((t) => t.stop()); };
  }, []);
  if (!b) return <main class="sh-wait" aria-busy="true" />;
  const it = key ? b.items.find((x) => x.key === key) || null : null, found = it ? foundFor(it.key) : null;
  const acts: [string, JSX.Element, () => void][] = it ? [
    ['Report', <Icon name="warning" size={18} stroke={2} />, () => nav.push('shelf/report', { key: it.key })],
    ['Open', <Icon name="list" size={18} stroke={2} />, () => nav.push('shelf/item', { key: it.key })],
    ['Count', <Icon name="tally" size={18} stroke={2} />, () => nav.push('shelf/count', { key: it.key })],
  ] : [];
  if (it && !found) acts.unshift(acts.splice(2, 1)[0]);
  return (
    <div class="sh-sc">
      <div aria-hidden="true" class="sh-sc-bg" /><div aria-hidden="true" class="sh-sc-rows" />
      {!isDemo && <video ref={video} class="sh-sc-video" muted playsInline />}
      <div class="sh-sc-frame">
        <span class="c tl" /><span class="c tr" /><span class="c bl" /><span class="c br" />
        {isDemo && it && <div class="sh-sc-in"><Label b={b} it={it} /></div>}
        <span aria-hidden="true" class="sh-sc-line" />
      </div>
      <div class="sh-sc-top">
        <button type="button" aria-label="Close the scanner" onClick={() => nav.back()}><Icon name="close" size={16} stroke={2.2} /></button>
        <span>Scan a shelf label</span>
        <button type="button" aria-label="Torch" aria-pressed={torch} onClick={() => setTorch(!torch)}><Glyph g="torch" size={18} stroke={2} /></button>
      </div>
      <div class="sh-sc-hint">Hold the label inside the corners</div>
      {it && (
        <div class="sh-sc-card">
          <span aria-hidden="true" class="sh-sc-grab" />
          <div class="sh-sc-it">
            <span class="sh-sc-pic"><ItemPic it={it} size={48} radius={14} /><span aria-hidden="true"><Icon name="check" size={12} stroke={3} /></span></span>
            <span><span>{it.name}</span><span><StateChips b={b} it={it} s={itemState(b, it, at)} ruth={personFace(b.people.find((x) => x.role === 'manager'))} /><span>{`${letterOf(b, it.category) || '?'} · ${it.category || 'No aisle yet'}`}</span></span></span>
          </div>
          {found && (
            <button type="button" class="sh-sc-found" onClick={() => nav.push('shelf/report', { key: it.key })}>
              <Icon name="warning" size={18} stroke={2} /><span>{`${found.qty} ${it.unit} ${found.note} found `}<span class="mono">{clock(found.at)}</span> · not reported</span><Icon name="chevron-right" size={16} stroke={2.2} />
            </button>
          )}
          <div class="sh-sc-acts">{acts.map(([w, i, on], n) => <button key={w} type="button" class={n === 0 ? 'navy' : ''} onClick={on}>{i}{w}</button>)}</div>
          <span class="sh-sc-next">Scan the next label to keep going</span>
        </div>
      )}
    </div>
  );
}
