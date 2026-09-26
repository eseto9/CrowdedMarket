// node tools/build.mjs
//   → dist/crowded-market.html  the whole game in one file
//   → docs/index.html           the same page for GitHub Pages
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, page } from './assemble.mjs';

const html = page();
const write = (rel, text) => {
  const out = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
  console.log(`built ${rel} (${(Buffer.byteLength(text) / 1024).toFixed(1)} KB)`);
};

write('dist/crowded-market.html', html);
write('docs/index.html', html);
// plain files only: tell GitHub Pages not to run them through Jekyll
fs.writeFileSync(path.join(ROOT, 'docs', '.nojekyll'), '');
