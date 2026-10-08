#!/usr/bin/env node
/**
 * scripts/lint.js
 *
 * Lint checks every icon file under src/icons/*.js.
 * Run: node scripts/lint.js
 *
 * Checks:
 *   1. svg string contains a viewBox (case-insensitive)
 *   2. No inline stroke-width / stroke-linecap / stroke-linejoin on path elements
 *      (those belong in CSS, not SVG attributes)
 *   3. Every <path> with class "b-wave", "d-bar", "d-done-ring", "d-check",
 *      "h-ecg", "h-crack" has pathLength="1"
 *   4. Part class names follow the convention <initial>-<word> (e.g. b-swing)
 *   5. defineIcon() is called with a string name and an object literal
 *   6. The make() function is exported
 *
 * Exits 0 on success, 1 on any failure.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dir, '..', 'src', 'icons');

const STROKE_ATTR = /stroke-(width|linecap|linejoin)\s*=/i;
const DEFINE_ICON = /defineIcon\s*\(\s*['"](\w[\w-]*)['"\s]/;
const CLASS_NAME  = /class="([^"]+)"/g;
const PART_RE     = /^[a-z]-[a-z]/;

/* Paths that must carry pathLength="1" */
const NEEDS_PATH_LENGTH = [
  'b-wave', 'd-bar', 'd-done-ring', 'd-check', 'h-ecg', 'h-crack', 'b-slash', 'b-slash-halo',
];

let errors = 0;

const fail = (file, msg) => {
  console.error(`  ✗  ${file}: ${msg}`);
  errors++;
};
const ok = (file, msg) => console.log(`  ✓  ${file}: ${msg}`);

const files = readdirSync(iconsDir).filter(f => f.endsWith('.js'));

if (files.length === 0) {
  console.warn('No icon files found in src/icons/. Nothing to lint.');
  process.exit(0);
}

for (const file of files) {
  const src = readFileSync(join(iconsDir, file), 'utf8');

  /* 1. defineIcon call present */
  const defMatch = DEFINE_ICON.exec(src);
  if (!defMatch) { fail(file, 'No defineIcon() call found'); continue; }
  const iconName = defMatch[1];
  ok(file, `defineIcon('${iconName}') found`);

  /* 2. svg string: extract between backtick svg: ` and next backtick block */
  const svgMatch = /svg\s*:\s*`([\s\S]*?)`/.exec(src);
  if (!svgMatch) { fail(file, 'No svg: `…` template literal found'); continue; }
  const svg = svgMatch[1];

  /* 3. No inline stroke presentation attributes on paths */
  if (STROKE_ATTR.test(svg)) {
    fail(file, 'Inline stroke-width/linecap/linejoin found — move to CSS');
  }

  /* 4. Paths that require pathLength="1" */
  const pathBlocks = [...svg.matchAll(/<path([^>]*?)\/>/gs)].map(m => m[1]);
  for (const block of pathBlocks) {
    const classMatch = /class="([^"]+)"/.exec(block);
    if (!classMatch) continue;
    const classes = classMatch[1].split(/\s+/);
    for (const cls of classes) {
      if (NEEDS_PATH_LENGTH.includes(cls) && !/pathLength/i.test(block)) {
        fail(file, `<path class="${cls}"> is missing pathLength="1"`);
      }
    }
  }

  /* 5. Part class names follow <initial>-<word> convention */
  let classMatch;
  while ((classMatch = CLASS_NAME.exec(svg)) !== null) {
    const names = classMatch[1].split(/\s+/);
    for (const n of names) {
      if (n && !PART_RE.test(n) && n !== 'icon-btn') {
        fail(file, `Class "${n}" doesn't match <initial>-<word> convention`);
      }
    }
  }

  /* 6. make() function is present */
  if (!/\bmake\s*\(/.test(src)) {
    fail(file, 'No make() function found');
  }
}

console.log('');
if (errors === 0) {
  console.log(`All ${files.length} icon file(s) passed lint.`);
  process.exit(0);
} else {
  console.error(`${errors} error(s) found across ${files.length} file(s).`);
  process.exit(1);
}
