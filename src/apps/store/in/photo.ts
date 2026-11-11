/*
 * A photo for Ruth or Esther (the torn bags, the delivery note, a new item): the phone's camera
 * through a file input (capture="environment"). In the demo there is no camera: a tap gives the
 * sample picture the boards draw (IN10, IN20), so every screen after it can be reached by taps.
 */
import { isDemo } from '../shell/store.ts';

export interface Photo { blob: Blob; url: string | null; demo: boolean; at: number }

export function takePhoto(now: number): Promise<Photo | null> {
  if (isDemo) return Promise.resolve({ blob: new Blob(['demo photo'], { type: 'image/jpeg' }), url: null, demo: true, at: now });
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.setAttribute('capture', 'environment');
    input.onchange = () => {
      const f = input.files && input.files[0];
      resolve(f ? { blob: f, url: URL.createObjectURL(f), demo: false, at: Date.now() } : null);
    };
    input.click();
  });
}
