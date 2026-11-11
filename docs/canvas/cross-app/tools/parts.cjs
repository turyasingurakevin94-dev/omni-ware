// The parts every cross-app board uses, copied from docs/canvas/sales-agent/LANGUAGE.md (P01-P29) and the
// Buyer canvas (docs/canvas/buyer). Tokens only from LANGUAGE.md §1; no new colour, radius or shadow.
// A board is a strip of 360 x 800 phones, each with its state written above it.
const T = { navy: '#16203C', navy2: '#243052', ground: '#F7F5F2', panel: '#FFFFFF', tile: '#F1EEE8', line: '#E6E3DD', dash: '#C9C4BA',
  ink: '#1C2233', soft: '#5F6980', faint: '#6B7480', red: '#C93A30', good: '#0F6B43', goodS: '#E4F4EA', warn: '#95530C', warnS: '#FDEEE1',
  warnI: '#7A4A02', bad: '#8E2A22', badS: '#FBE5E2', info: '#1A5A8A', infoS: '#E3EEFB', mint: '#6FDCB0', amberN: '#F5B26B', onN: '#B3BCD2', onN2: '#8D99B5' };
const mono = (s, st = '') => `<b class="m"${st ? ` style="${st}"` : ''}>${s}</b>`;
const svg = (d, size = 18, sw = 2, extra = '') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
const I = {
  tick: '<path d="m5 12.5 4.5 4.5L19 7"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', chev: '<path d="m9 6 6 6-6 6"/>', back: '<path d="m15 6-6 6 6 6"/>',
  offline: '<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4.2-2.5M14.8 10a10 10 0 0 1 4.2 2.5M2 8.8a15 15 0 0 1 4.2-2.6M10.5 5.1A15 15 0 0 1 22 8.8M12 20h.01"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', warn: '<path d="M12 3 2 20h20zM12 10v4M12 17h.01"/>',
  bin: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', retry: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  pause: '<path d="M9 5v14M15 5v14"/>', cart: '<path d="M3 4h2.5l2.2 11h10.6l2-8H6.3"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  check: '<path d="M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M9 14l2 2 4-4"/>', box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  store: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/>', person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  ret: '<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>', phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  hand: '<path d="M7 11V5a1.5 1.5 0 0 1 3 0v5M10 10V4a1.5 1.5 0 0 1 3 0v6M13 10V5a1.5 1.5 0 0 1 3 0v7M16 12V8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L3.5 14a1.5 1.5 0 0 1 2.5-1.7L7 14"/>',
  note: '<path d="M5 4h14v12l-4 4H5zM15 20v-4h4M8 9h8M8 13h5"/>', key: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h.01M11 9h.01M15 9h.01M7 13h10"/>',
};
const ic = (n, size, sw, extra) => svg(I[n], size, sw, extra);

const CSS = `
body{margin:0;background:#E9E6E0}
.strip{display:flex;gap:40px;padding:20px 20px 24px;align-items:flex-start;font-family:Figtree,system-ui,sans-serif}
.cap{width:360px;display:flex;flex-direction:column;gap:10px}
.cap>h3{margin:0;height:48px;font-size:13px;font-weight:700;color:#1C2233;line-height:1.3;display:flex;flex-direction:column;justify-content:flex-end}
.cap>h3 span{font-weight:600;color:#5F6980;font-size:12px}
.ph{width:360px;height:800px;position:relative;overflow:hidden;background:#F7F5F2;color:#1C2233;font-family:Figtree,system-ui,sans-serif;border-radius:4px;box-shadow:0 10px 30px rgba(22,32,60,.18)}
.m{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;font-weight:600}
.body{padding:14px 16px 100px;display:flex;flex-direction:column;gap:10px}
.card{background:#fff;border-radius:16px;box-shadow:0 1px 2px rgba(22,32,60,.05),inset 0 0 0 1px #E6E3DD}
.grp{background:#fff;border-radius:18px;box-shadow:0 1px 2px rgba(22,32,60,.05),inset 0 0 0 1px #E6E3DD;overflow:hidden}
.row{display:flex;align-items:center;gap:12px;min-height:60px;padding:10px 12px}
.grp .row+.row{border-top:1px solid #F1EEE8}
.sq{width:40px;height:40px;flex:none;border-radius:12px;display:flex;align-items:center;justify-content:center}
.tt{font-size:14px;font-weight:700;line-height:1.25}
.sb{font-size:12px;font-weight:600;color:#5F6980;line-height:1.3}
.col{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.sec{display:flex;justify-content:space-between;align-items:center;padding:6px 4px 0;font-size:17px;font-weight:700}
.sec small{font-size:12px;font-weight:600;color:#5F6980}
.pill{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
.btn{height:56px;border:none;border-radius:14px;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;font-family:inherit}
.navy{background:#16203C;color:#fff}.red{background:#C93A30;color:#fff}.ghost{background:#fff;color:#1C2233;box-shadow:inset 0 0 0 1px #E6E3DD;height:52px;font-size:15px}
.pressed.navy{background:#243052}.pressed.red{background:#A82D24}.off{opacity:.45;box-shadow:none}
.spin{width:16px;height:16px;border-radius:999px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;display:inline-block}
.spin.dk{border-color:#C9C4BA;border-top-color:transparent;width:14px;height:14px}
.scrim{position:absolute;inset:0;background:rgba(12,19,38,.72)}
.sheet{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:26px 26px 0 0;display:flex;flex-direction:column;box-shadow:0 -8px 30px rgba(0,0,0,.35)}
.grab{align-self:center;width:40px;height:5px;margin-top:10px;border-radius:999px;background:#C9C4BA}
.shd{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px 4px}
.shd h2{margin:0;font-size:22px;font-weight:700;letter-spacing:-.01em}
.eye{font-size:11px;font-weight:700;letter-spacing:.08em;color:#6B7480;text-transform:uppercase}
.xbtn{width:44px;height:44px;flex:none;border-radius:999px;background:#F1EEE8;display:flex;align-items:center;justify-content:center}
.shb{padding:12px 16px 20px;display:flex;flex-direction:column;gap:10px;flex:1}
.notice{display:flex;align-items:center;gap:10px;min-height:44px;padding:10px 16px;font-size:13px;font-weight:600;line-height:1.35}
.toast{position:absolute;top:14px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 18px 8px 8px;border-radius:24px;background:#16203C;color:#fff;font-size:14px;font-weight:600;box-shadow:0 10px 28px rgba(22,32,60,.25);white-space:nowrap;z-index:5}
.disc{width:28px;height:28px;flex:none;border-radius:999px;display:flex;align-items:center;justify-content:center}
.head{background:radial-gradient(120% 90% at 100% 0%,#243A6B 0%,#16203C 60%);color:#fff;border-radius:0 0 28px 28px;padding:14px 16px 18px;display:flex;flex-direction:column;gap:12px;box-shadow:0 10px 30px rgba(22,32,60,.18)}
.hb{width:44px;height:44px;border-radius:999px;background:rgba(255,255,255,.10);display:flex;align-items:center;justify-content:center;flex:none}
.tabbar{position:absolute;left:0;right:0;bottom:0;height:84px;background:#fff;border-top:1px solid #E6E3DD;display:grid;grid-template-columns:1fr 1fr 96px 1fr 1fr;align-items:start;padding:8px 8px 0;box-sizing:border-box}
.tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;height:52px;color:#6B7480;font-size:12px;font-weight:600}
.tab.on{color:#1C2233;font-weight:700}
.plusb{justify-self:center;margin-top:-26px;width:64px;height:64px;box-sizing:border-box;border-radius:999px;background:#C93A30;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(201,58,48,.35);border:4px solid #F7F5F2}
.shim{display:block;height:11px;border-radius:6px;background:linear-gradient(90deg,#EDEAE4 0%,#F7F5F2 40%,#EDEAE4 80%);background-size:300% 100%}
.shimn{display:block;border-radius:6px;background:linear-gradient(90deg,rgba(255,255,255,.06) 0%,rgba(255,255,255,.14) 40%,rgba(255,255,255,.06) 80%);background-size:300% 100%}
.dock{position:absolute;left:0;right:0;bottom:0;background:#16203C;border-radius:26px 26px 0 0;padding:16px 16px 22px;display:flex;flex-direction:column;gap:14px;box-shadow:0 -8px 24px rgba(22,32,60,.18);color:#fff}
.slide{position:relative;height:60px;border-radius:999px;background:rgba(255,255,255,.08);display:flex;align-items:center;padding:5px;box-sizing:border-box;width:100%}
.knob{width:50px;height:50px;flex:none;border-radius:999px;background:#C93A30;display:flex;align-items:center;justify-content:center}
.slide .lb{position:absolute;left:0;right:0;text-align:center;font-size:16px;font-weight:700;padding:0 60px}
.ring{box-shadow:0 0 0 3px #C93A30}
.anno{position:absolute;right:8px;width:26px;height:26px;border-radius:999px;background:#C93A30;color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px #fff;z-index:9}
.note{border-radius:14px;padding:10px 12px;font-size:12px;font-weight:600;line-height:1.4}
.desk{width:1280px;height:800px;position:relative;overflow:hidden;background:#F7F5F2;color:#1C2233;font-family:Figtree,system-ui,sans-serif;border-radius:4px;box-shadow:0 10px 30px rgba(22,32,60,.18)}
`;

const HEAD = (title, w, h) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<!-- {"$preview":{"width":${w},"height":${h}}} -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;display=swap" rel="stylesheet">
<style>${CSS}</style>
</helmet>
`;

/** A board: phones side by side, each with its state named above it. */
function board(title, phones) {
  const w = phones.reduce((s, p) => s + (p.wide ? 1280 : 360) + 40, 0) + 0;
  const h = 800 + 20 + 58 + 24;
  return HEAD(title, w, h) + `<div class="strip">\n` + phones.map((p) => `<div class="cap"${p.wide ? ' style="width:1280px"' : ''}><h3>${p.state}${p.sub ? `<span>${p.sub}</span>` : ''}</h3>\n<div class="${p.wide ? 'desk' : 'ph'}">${p.html}</div></div>`).join('\n') + `\n</div>\n</x-dc>\n</body>\n</html>\n`;
}

const pill = (txt, tone = 'neutral', icon) => {
  const c = { good: [T.goodS, T.good], warn: [T.warnS, T.warnI], bad: [T.badS, T.bad], info: [T.infoS, T.info], neutral: [T.tile, T.soft], dark: [T.navy, '#fff'] }[tone];
  return `<span class="pill" style="background:${c[0]};color:${c[1]}">${icon ? ic(icon, 12, 2.6) : ''}${txt}</span>`;
};
const sq = (icon, bg, fg) => `<span class="sq" style="background:${bg};color:${fg}">${ic(icon, 20, 2)}</span>`;
const row = (left, title, sub, right = '') => `<div class="row">${left}<span class="col"><span class="tt">${title}</span>${sub ? `<span class="sb">${sub}</span>` : ''}</span>${right}</div>`;
const chev = `<span style="display:flex;color:#9AA1AE">${ic('chev', 16, 2.2)}</span>`;
const toast = (txt, kind = 'ok') => kind === 'ok'
  ? `<div class="toast" role="status"><span class="disc" style="background:${T.mint};color:${T.navy}">${ic('tick', 15, 3)}</span>${txt}</div>`
  : `<div class="toast" role="status" style="background:${T.warnS};color:${T.warnI};box-shadow:0 10px 28px rgba(22,32,60,.15),inset 0 0 0 1px #F3D3B0;font-weight:700"><span class="disc" style="background:${T.warn};color:#fff">!</span>${txt}</div>`;
const tabbar = (on = 'Today') => `<nav class="tabbar" aria-label="Main">${['Today', 'Chats'].map((t) => `<span class="tab${on === t ? ' on' : ''}">${ic(t === 'Today' ? 'clock' : 'note', 24, 1.8)}${t}</span>`).join('')}<span class="plusb">${ic('plus', 28, 2.4)}</span>${['Orders', 'Customers'].map((t) => `<span class="tab${on === t ? ' on' : ''}">${ic(t === 'Orders' ? 'box' : 'person', 24, 1.8)}${t}</span>`).join('')}</nav>`;
const xbtn = `<span class="xbtn">${ic('x', 16, 2.2)}</span>`;
const sheet = (top, eyebrow, title, body) => `<div class="scrim"></div><div class="sheet" style="top:${top}px"><span class="grab"></span><div class="shd"><span style="display:flex;flex-direction:column;gap:4px">${eyebrow ? `<span class="eye">${eyebrow}</span>` : ''}<h2>${title}</h2></span>${xbtn}</div><div class="shb">${body}</div></div>`;
/** A compact navy head of a pushed screen (P04): back, title, sub. */
const pushHead = (title, sub, right = '') => `<header class="head" style="padding:12px 16px 16px"><div style="display:flex;align-items:center;gap:10px"><span class="hb">${ic('back', 18, 2.2)}</span><span class="col"><span style="font-size:17px;font-weight:700">${title}</span><span style="font-size:12px;font-weight:600;color:${T.onN}">${sub}</span></span>${right}</div></header>`;
const anno = (n, top) => `<span class="anno" style="top:${top}px">${n}</span>`;

/** The same app on a laptop: one column (manager.html 520 px, Sales/Buyer 480 px), centred on the warm ground. */
const desk = (inner, w = 480, label = '') => `<div style="position:absolute;inset:0;background:#EDEAE4"></div><div style="position:absolute;top:0;bottom:0;left:${(1280 - w) / 2}px;width:${w}px;background:#F7F5F2;overflow:hidden;box-shadow:0 0 0 1px #E6E3DD">${inner}</div>${label ? `<div style="position:absolute;left:24px;top:24px;width:${(1280 - w) / 2 - 48}px;font-size:13px;font-weight:600;color:#5F6980;line-height:1.5">${label}</div>` : ''}`;
module.exports = { desk, T, I, ic, svg, mono, board, pill, sq, row, chev, toast, tabbar, sheet, pushHead, xbtn, anno };
