// Stitches src/ back into a page. Shared by build.mjs and dev-server.mjs.
//
// The JS files are not ES modules: they are consecutive slices of one closure,
// concatenated in filename order inside a single IIFE, so every top-level name
// is shared between them. The number prefix sets the order.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SRC = path.join(ROOT, 'src');

const read = f => fs.readFileSync(f, 'utf8');
const list = dir => fs.readdirSync(path.join(SRC, dir)).filter(f => /\.(css|js)$/.test(f)).sort().map(f => `${dir}/${f}`);

export const cssFiles = () => list('css');
export const jsFiles = () => list('js');

const APP_HEAD = "'use strict';\n(function(){\n";
const APP_TAIL = '})();\n\n';

/** The whole game script, exactly as the published page carries it. */
export function appJs() {
  return APP_HEAD + jsFiles().map(f => read(path.join(SRC, f))).join('') + APP_TAIL;
}

/** Line-for-line source map from appJs() back to src/js/*.js. */
export function appJsMap() {
  const files = jsFiles();
  const segs = [];
  const head = APP_HEAD.split('\n').length - 1;
  for (let i = 0; i < head; i++) segs.push('');
  let prevFile = 0, prevLine = 0;
  files.forEach((f, fi) => {
    const n = read(path.join(SRC, f)).split('\n').length - 1;
    for (let line = 0; line < n; line++) {
      segs.push(vlq(0) + vlq(fi - prevFile) + vlq(line - prevLine) + vlq(0));
      prevFile = fi; prevLine = line;
    }
  });
  return JSON.stringify({ version: 3, file: 'app.js', sourceRoot: '/src/', sources: files, mappings: segs.join(';') });
}

function vlq(n) {
  let v = n < 0 ? (-n << 1) | 1 : n << 1, s = '';
  do { let d = v & 31; v >>>= 5; if (v) d |= 32; s += 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[d]; } while (v);
  return s;
}

/**
 * The page.
 *  - dev: false → one self-contained file (what gets published)
 *  - dev: true  → links CSS/JS from the dev server
 */
export function page({ dev = false } = {}) {
  const tpl = read(path.join(SRC, 'index.html'));
  const styles = dev
    ? cssFiles().map(f => `<link rel="stylesheet" href="/src/${f}">`).join('\n') + '\n'
    : '<style>\n' + cssFiles().map(f => read(path.join(SRC, f))).join('') + '</style>\n';
  const app = dev ? '<script src="/app.js"></script>\n' : '<script>\n' + appJs() + '</script>\n';
  if (!/<!-- @styles -->\r?\n/.test(tpl) || !/<!-- @app -->\r?\n/.test(tpl)) throw new Error('src/index.html is missing the <!-- @styles --> or <!-- @app --> marker');
  return tpl.replace(/<!-- @styles -->\r?\n/, () => styles).replace(/<!-- @app -->\r?\n/, () => app);
}
