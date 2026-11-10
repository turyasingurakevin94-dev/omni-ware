/*
 * The demo keeps no files: a delivery photo stands as 'photo:<what>' (Order.deliveredPhoto), as a chat photo
 * stands as 'aisle:<Aisle>'. Opened, it is this drawn picture of the goods at the door, as a link the phone opens.
 */
const PICTURE = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960">
<rect width="720" height="960" fill="#D9D2C3"/><rect y="640" width="720" height="320" fill="#A79E8C"/>
<rect x="430" y="180" width="200" height="460" rx="6" fill="#6E4B2E"/><circle cx="600" cy="420" r="9" fill="#E6C27A"/>
<g fill="#8C9BAE" stroke="#5E6B7C" stroke-width="4">
<path d="M60 600 L380 560 L380 600 L60 640 Z"/><path d="M60 570 L380 530 L380 560 L60 600 Z"/><path d="M60 540 L380 500 L380 530 L60 570 Z"/></g>
<g fill="#C0392B" stroke="#7E2318" stroke-width="4"><rect x="120" y="650" width="150" height="70" rx="8"/><rect x="290" y="660" width="120" height="60" rx="8"/></g>
<text x="360" y="880" font-family="sans-serif" font-size="34" fill="#3D4A5C" text-anchor="middle">At the door</text></svg>`;

/** A link to the drawn photo: a blob link where the page can make one, else the picture inline. */
export function demoPhoto(_path: string): string {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof Blob !== 'undefined') return URL.createObjectURL(new Blob([PICTURE], { type: 'image/svg+xml' }));
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(PICTURE);
}
