// node docs/canvas/cross-app/tools/build.cjs  → writes the round's boards next to this folder.
const fs = require('fs'), path = require('path');
const out = path.join(__dirname, '..');
for (const m of fs.readdirSync(__dirname).filter((f) => /^b-.*\.cjs$/.test(f))) {
  const boards = require(path.join(__dirname, m));
  for (const [name, html] of Object.entries(boards)) { fs.writeFileSync(path.join(out, name), html); console.log(name, html.length); }
}
