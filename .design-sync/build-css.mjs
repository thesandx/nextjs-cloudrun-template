// Compiles tailwind-entry.css with the repo's own @tailwindcss/postcss into
// .cache/mochi.css - the stylesheet the design-sync bundle ships.
// Run from the repo root: node .design-sync/build-css.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const req = createRequire(join(root, 'package.json'));
const twPath = req.resolve('@tailwindcss/postcss');
const postcss = createRequire(twPath)('postcss');
const tailwind = req('@tailwindcss/postcss');

const from = join(here, 'tailwind-entry.css');
const to = join(here, '.cache', 'mochi.css');
const result = await postcss([tailwind({ base: root })]).process(readFileSync(from, 'utf8'), { from, to });
mkdirSync(dirname(to), { recursive: true });
writeFileSync(to, result.css);
console.log(`wrote ${to} (${result.css.length} bytes)`);
