/* Builds every era's town as real geometry and checks it, plus the readout
 * formatters. Three.js builds a scene graph happily without a GL context, so
 * this runs without a browser:
 *   node tools/render-test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as THREE from '../assets/vendor/three.module.js';
import { buildEra, PALETTE } from '../assets/js/modes/town3d.js';
import * as F from '../assets/js/format.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ages = JSON.parse(readFileSync(join(root, 'assets/data/ages.json'), 'utf8'));
const bad = [];
const box = new THREE.Box3();
let meshes = 0, worst = 0, worstYear = 0, slowest = 0;

for (const era of ages.eras) {
  const tag = `era ${era.year}`;
  const t0 = Date.now();
  const built = buildEra(era);
  const ms = Date.now() - t0;
  slowest = Math.max(slowest, ms);
  meshes += built.meshes;
  if (built.meshes > worst) { worst = built.meshes; worstYear = era.year; }

  box.setFromObject(built.group);
  if (!isFinite(box.min.y) || !isFinite(box.max.y)) bad.push(`${tag}: bounds are not finite`);
  else {
    if (box.min.y < -0.6) bad.push(`${tag}: geometry sinks to y=${box.min.y.toFixed(2)}`);
    if (box.max.y > 24) bad.push(`${tag}: something reaches y=${box.max.y.toFixed(1)} — taller than the frame`);
  }

  /* the town must stand where the camera is pointed */
  if (box.max.x < 0 || box.min.x > 16) bad.push(`${tag}: town has drifted off in x`);

  /* nothing may share a material's opacity: each smoke puff fades alone */
  const smokeMats = new Set();
  built.group.traverse(o => {
    if (o.isMesh && o.material && o.material.transparent) {
      if (smokeMats.has(o.material)) bad.push(`${tag}: two puffs share one material`);
      smokeMats.add(o.material);
    }
  });

  /* animation must move things, and never to NaN */
  const walker = built.group.children.find(o => o.isGroup);
  const before = walker ? walker.position.clone() : null;
  for (let i = 0; i < 40; i++) built.tick(i * 0.1);
  built.group.traverse(o => {
    if (!isFinite(o.position.x) || !isFinite(o.position.y) || !isFinite(o.position.z)) bad.push(`${tag}: NaN position after tick`);
  });
  if (before && walker.position.equals(before)) bad.push(`${tag}: nothing moved after 40 ticks`);

  if (ms > 120) bad.push(`${tag}: took ${ms}ms to build`);
  built.dispose();
}

/* the seam needs both neighbours to exist for every step */
for (let i = 0; i < ages.eras.length - 1; i++) {
  if (ages.eras[i + 1].year - ages.eras[i].year !== ages.step) {
    bad.push(`step ${ages.eras[i].year}->${ages.eras[i + 1].year} is not ${ages.step} years`);
  }
}
/* every era must name materials the palette actually holds */
for (const e of ages.eras) {
  if (PALETTE.wall[e.house.material] === undefined) bad.push(`era ${e.year}: no wall colour for ${e.house.material}`);
  if (PALETTE.roof[e.house.roof] === undefined) bad.push(`era ${e.year}: no roof colour for ${e.house.roof}`);
  if (PALETTE.ground[e.ground] === undefined) bad.push(`era ${e.year}: no ground colour for ${e.ground}`);
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
if (!/10⁻¹⁶|×10¹⁶/.test(F.tempStr(-12.7, 'en'))) bad.push(`plasma should read in the 10¹⁶ K range, got ${F.tempStr(-12.7, 'en')}`);

console.log(`${ages.eras.length} eras built | meshes avg ${Math.round(meshes / ages.eras.length)}, worst ${worst} (${worstYear}) | slowest build ${slowest}ms`);
console.log(`${bad.length} problem(s)`);
for (const b of bad) console.log('  X ' + b);
process.exit(bad.length ? 1 : 0);
