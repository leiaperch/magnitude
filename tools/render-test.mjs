/* Draws every era and checks the SVG that comes out, plus the readout
 * formatters. Both modules are pure, so this runs without a browser:
 *   node tools/render-test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { drawEra } from '../assets/js/modes/diorama.js';
import * as F from '../assets/js/format.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ages = JSON.parse(readFileSync(join(root, 'assets/data/ages.json'), 'utf8'));
const bad = [];

for (const era of ages.eras) {
  const svg = drawEra(era);
  const tag = `era ${era.year}`;
  if (/NaN|undefined|Infinity/.test(svg)) bad.push(`${tag}: produced NaN/undefined`);
  if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) bad.push(`${tag}: not a single svg root`);
  const open = (svg.match(/<g[ >]/g) || []).length, close = (svg.match(/<\/g>/g) || []).length;
  if (open !== close) bad.push(`${tag}: ${open} <g> vs ${close} </g>`);
  if (svg.length < 4000) bad.push(`${tag}: suspiciously empty (${svg.length} chars)`);
  for (const m of svg.matchAll(/fill="([^"]+)"/g)) {
    const v = m[1];
    if (!/^(#[0-9a-f]{3,8}|none|url\(#[\w-]+\))$/i.test(v)) bad.push(`${tag}: odd fill ${v}`);
  }
  // the drawing must be deterministic: same era, same picture
  if (drawEra(era) !== svg) bad.push(`${tag}: not deterministic`);
}

/* the seam relies on both neighbours existing for every step */
for (let i = 0; i < ages.eras.length - 1; i++) {
  if (ages.eras[i + 1].year - ages.eras[i].year !== ages.step) {
    bad.push(`step ${ages.eras[i].year}->${ages.eras[i + 1].year} is not ${ages.step} years`);
  }
}

/* formatters: spot-check the values the HUD leans on */
const eq = (got, want, what) => { if (got !== want) bad.push(`${what}: "${got}" != "${want}"`); };
eq(F.prettyMeters(0, 'en'), '≈ 1.00 meters', 'prettyMeters(0)');
eq(F.prettyMeters(-14.9, 'fr'), '≈ 1,26 femtomètres', 'prettyMeters(-14.9) fr');
eq(F.prettyLightTime(Math.log10(1.496e11), 'en'), '8.32 min', 'light across 1 AU');
eq(F.humanYears(676, 'fr'), '676 ans', 'humanYears fr');
eq(F.humanYears(1, 'fr'), '1 an', 'humanYears singular fr');
eq(F.generations(1000, 'en'), '≈ 40 generations before you', 'generations');
eq(F.calendarYear(-500, 'fr'), 'en 501 av. J.-C.', 'calendarYear BC');
eq(F.supNum(-16), '⁻¹⁶', 'supNum');
eq(F.tempStr(17.70, 'en'), '2.7 K', 'CMB measured today');
if (!/1[0-9]\.?.*K/.test(F.tempStr(-12.7, 'en'))) bad.push(`plasma should be blisteringly hot, got ${F.tempStr(-12.7, 'en')}`);

const total = ages.eras.reduce((n, e) => n + drawEra(e).length, 0);
console.log(`${ages.eras.length} eras drawn, ${(total / 1024).toFixed(0)} KB of SVG — ${bad.length} problem(s)`);
for (const b of bad) console.log('  X ' + b);
process.exit(bad.length ? 1 : 0);
