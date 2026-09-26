// Loads the simulation, AI and tuning into Node, with no browser.
// In the page these files are slices of one big closure; here they get a closure of their
// own with nothing else in it, so any stray use of the DOM or THREE fails loudly.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/js');
export const SIM_FILES = ['10-tuning.js', '11-sim.js', '12-ai.js'];

/** A fresh copy each call, so a test can change CM_TUNE without touching the others. */
export function loadSim() {
  const src = SIM_FILES.map(f => fs.readFileSync(path.join(JS, f), 'utf8')).join('\n');
  return new Function('"use strict";\n' + src + '\nreturn {CM_TUNE, CMSim, CMAI, CMNav};')();
}
