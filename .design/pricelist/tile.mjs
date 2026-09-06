import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const rows = [[['Now','Now — ships today'],['Main','A · Ledger'],['Band','B · Reversed band']],
              [['PriceFirst','C · Price first'],['Cards','D · Cards'],['Leader','E · Dot leader']]];
const cell = (n,l)=> `<figure><img src="shot-${n}.png"><figcaption>${l}</figcaption></figure>`;
fs.writeFileSync(path.join(here,'.tile.html'), `<body style="margin:0;background:#DDE1E5;font-family:system-ui">
<div style="display:grid;grid-template-columns:repeat(3,600px);gap:26px;padding:26px">
${rows.flat().map(([n,l])=>cell(n,l)).join('')}
</div>
<style>figure{margin:0}img{display:block;width:600px}
figcaption{font-size:20px;font-weight:700;padding:10px 2px;color:#14171B}</style></body>`);
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage({viewport:{width:1904,height:1760}});
await p.goto('file://'+path.join(here,'.tile.html'));
await p.waitForTimeout(600);
await p.screenshot({path:path.join(here,'sheet.png'), fullPage:true});
await b.close(); fs.unlinkSync(path.join(here,'.tile.html'));
console.log('sheet.png');
