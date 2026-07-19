/* MAGNITUDE — the ages town, composed from Kenney models.
 *
 * Environment-agnostic: `buildEra(era, ctx)` places model instances through a
 * `ctx.place(name, x, z, opts)` the caller supplies — GLTFLoader-backed in the
 * browser, the headless GLB reader in the snapshot. Same composition both ways,
 * so the town can still be looked at offline.
 *
 * World: +X right-ish, +Z toward the camera, +Y up. The two building rows meet
 * in an L at the back-left; the square opens toward the camera.
 */

/* Every model any era can ask for — the page preloads exactly these. */
export const MANIFEST = [
  // medieval / castle
  'castle/tower-square-base', 'castle/tower-square-mid-windows', 'castle/tower-square-mid-door',
  'castle/tower-square-top-roof', 'castle/tower-square-top-roof-high', 'castle/tower-hexagon-base',
  'castle/tower-hexagon-mid', 'castle/tower-hexagon-roof', 'castle/wall', 'castle/wall-corner',
  'castle/wall-doorway', 'castle/gate', 'castle/flag', 'castle/flag-banner-long',
  // townhouses
  'modular/building-sample-house-a', 'modular/building-sample-house-b', 'modular/building-sample-house-c',
  'modular/building-sample-tower-a', 'modular/building-sample-tower-b', 'modular/building-sample-tower-c',
  // city
  'commercial/building-a', 'commercial/building-b', 'commercial/building-c', 'commercial/building-d',
  'commercial/building-e', 'commercial/building-f', 'commercial/building-g', 'commercial/building-h',
  'commercial/building-i', 'commercial/building-j', 'commercial/building-k', 'commercial/building-l',
  'commercial/building-skyscraper-a', 'commercial/building-skyscraper-b', 'commercial/building-skyscraper-c',
  'commercial/detail-awning', 'commercial/detail-awning-wide', 'commercial/detail-parasol-a', 'commercial/detail-parasol-b',
  'industrial/chimney-large', 'industrial/chimney-medium', 'industrial/building-c', 'industrial/building-h',
  // props & nature
  'survival/tree', 'survival/tree-tall', 'forest/tree', 'survival/barrel', 'survival/box', 'survival/box-large',
  'survival/chest', 'survival/tent', 'survival/tent-canvas', 'survival/campfire-pit', 'survival/fence',
  'graveyard/lightpost-single', 'graveyard/lightpost-double', 'graveyard/bench', 'graveyard/iron-fence-border',
  'graveyard/cross-column', 'graveyard/hay-bale', 'graveyard/pine',
  'prototype/animal-horse', 'prototype/animal-dog', 'prototype/vehicle', 'prototype/vehicle-convertible',
  'train/train-locomotive-b', 'train/train-tram-classic', 'train/train-tram-modern', 'train/train-electric-subway-a',
  // market produce
  'food/apple', 'food/orange', 'food/cabbage', 'food/carrot', 'food/bread', 'food/loaf-round',
  'food/pumpkin-basic', 'food/fish', 'food/cheese', 'food/corn',
];

const PRODUCE = ['food/apple', 'food/orange', 'food/cabbage', 'food/carrot', 'food/bread', 'food/loaf-round', 'food/pumpkin-basic', 'food/fish', 'food/cheese', 'food/corn'];

/* per-era building palette and flags, by year */
function era_style(year, night) {
  if (year < 1200) return { kind: 'castle', houses: ['modular/building-sample-house-a', 'modular/building-sample-house-b'], hs: 2.0, castle: 'stone' };
  if (year < 1500) return { kind: 'medieval', houses: ['modular/building-sample-house-a', 'modular/building-sample-house-b', 'modular/building-sample-house-c'], hs: 2.2, castle: year < 1450 ? 'stone' : 'ruin' };
  if (year < 1800) return { kind: 'town', houses: ['modular/building-sample-house-a', 'modular/building-sample-house-b', 'modular/building-sample-house-c', 'modular/building-sample-tower-a'], hs: 2.3 };
  if (year < 1950) return { kind: 'industrial', houses: ['commercial/building-c', 'commercial/building-h', 'industrial/building-c', 'industrial/building-h', 'modular/building-sample-house-c'], hs: 2.4, chimney: true };
  if (year < 2030) return { kind: 'modern', houses: ['commercial/building-a', 'commercial/building-b', 'commercial/building-d', 'commercial/building-e', 'commercial/building-f', 'commercial/building-g'], hs: 2.5, cafe: true };
  return { kind: 'future', houses: ['commercial/building-skyscraper-a', 'commercial/building-skyscraper-b', 'commercial/building-skyscraper-c', 'commercial/building-a', 'commercial/building-e'], hs: 2.7, cafe: true, eco: true };
}

export function buildEra(era, ctx) {
  const { place } = ctx;
  const rng = ctx.rng;
  const pick = a => a[Math.floor(rng() * a.length)];
  const st = era_style(era.year, era.night);

  /* -------- the castle / civic backdrop, far behind the rows -------- */
  if (st.kind === 'castle' || st.kind === 'medieval') {
    const ruin = st.castle === 'ruin';
    const towers = ruin ? [[-8.5, -9]] : [[-9, -9], [-7, -10.5], [-10.5, -7.2]];
    for (const [tx, tz] of towers) {
      place('castle/tower-square-base', tx, tz, { s: 2.6 });
      if (!ruin) { place('castle/tower-square-mid-windows', tx, tz, { s: 2.6, y: 2.6 * 0.62 }); place('castle/tower-square-top-roof-high', tx, tz, { s: 2.6, y: 2.6 * 1.2 }); }
    }
    if (!ruin) { place('castle/gate', -6, -9.5, { s: 2.4 }); place('castle/flag', -9, -9, { s: 2.6, y: 2.6 * 1.8 }); }
    for (let i = 0; i < 4; i++) place('castle/wall', -11 + i * 1.4, -8, { s: 2.4 });
  } else {
    /* a couple of tall backdrop blocks behind the town */
    for (let i = 0; i < 3; i++) place(pick(st.houses), -9 + i * 2.2, -9, { s: st.hs * 1.15 });
    if (st.chimney) place('industrial/chimney-large', -8.5, -10.5, { s: 2.4 });
  }

  /* -------------------- the two building rows (an L) -------------------- */
  const rowZ = -6.4, rowX = -6.4;
  let x = -6.6;
  while (x < 7) { const b = pick(st.houses); place(b, x, rowZ, { s: st.hs }); x += 1.9 + rng() * 0.4; }
  let z = -4.4;
  while (z < 7) { const b = pick(st.houses); place(b, rowX, z, { s: st.hs, rot: -Math.PI / 2 }); z += 1.9 + rng() * 0.4; }

  /* rooftop greenery for the eco future */
  if (st.eco) for (let i = 0; i < 6; i++) place('forest/tree', -5 + i * 2.1, rowZ + 0.2, { s: 1.1, y: st.hs * 1.2 });

  /* --------------------------- the square ------------------------------ */
  if (st.kind === 'medieval' || st.kind === 'town' || st.kind === 'industrial') marketRow(ctx, st, pick);
  if (st.cafe) cafeTerrace(ctx, pick, rng);

  /* trees, in the ground or in planters */
  for (const [tx, tz] of [[-1, 0.5], [3.2, -0.6], [-3.4, 2.4], [2.4, 3.6], [5.4, 1.2], [0.4, 5]]) {
    place(st.kind === 'future' || st.kind === 'modern' ? 'forest/tree' : 'survival/tree', tx + (rng() - 0.5), tz + (rng() - 0.5), { s: 1.7 + rng() * 0.4 });
  }

  /* street lamps ring the open square; iron from 1650, a market cross earlier */
  if (era.year >= 1650) {
    const lamp = era.year >= 1900 ? 'graveyard/lightpost-double' : 'graveyard/lightpost-single';
    for (let t = -5; t <= 6.5; t += 2.3) { place(lamp, 6.8, t, { s: 1.5 }); place(lamp, t, 6.8, { s: 1.5, rot: Math.PI / 2 }); }
    for (let i = 0; i < 9; i++) place('graveyard/iron-fence-border', 7, -5 + i * 1.5, { s: 1.4 });
  } else {
    place('graveyard/cross-column', 1.5, 1.5, { s: 2.2 });
    for (let i = 0; i < 4; i++) place('survival/campfire-pit', 6.5, -3 + i * 2.6, { s: 1.3 });
  }
  for (const [bx, bz, r] of [[0, 4.4, 0], [-3.6, 4.4, 0], [4.4, 4.6, 0.4], [1.4, -1.4, 1.2]]) place('graveyard/bench', bx, bz, { s: 1.3, rot: r });

  /* horses and carts in the old town; trams and cars later */
  if (era.year < 1900) { place('prototype/animal-horse', -2, 6.4, { s: 2.0 }); place('prototype/animal-dog', 3, 5, { s: 1.4 }); }
  if (era.year >= 1850 && era.year < 1950) place('train/train-tram-classic', -3, 8.4, { s: 1.6 });
  if (era.year >= 1950 && era.year < 2030) { place('prototype/vehicle', 3.5, 8.3, { s: 2.2 }); place('prototype/vehicle-convertible', -2, 8.6, { s: 2.2 }); }
  if (era.year >= 2030) place('train/train-tram-modern', -3, 8.4, { s: 1.6 });

  /* a scatter of townsfolk (simple figures until the character pack lands) */
  crowd(ctx, era, 16 + Math.floor(rng() * 8));
}

function marketRow(ctx, st, pick) {
  const { place } = ctx, rng = ctx.rng;
  for (let i = 0; i < 5; i++) {
    const sx = -3.5 + i * 1.8, sz = -3 + (i % 2) * 0.6;
    place('survival/tent-canvas', sx, sz, { s: 1.5 });                 // a market stall
    for (let k = 0; k < 5; k++) place(pick(PRODUCE), sx - 0.4 + (k % 3) * 0.4, sz + 0.3 + Math.floor(k / 3) * 0.3, { s: 1.0, y: 0.35 });
    place('survival/barrel', sx + 0.7, sz, { s: 1.2 });
    if (rng() > 0.5) place('graveyard/hay-bale', sx - 0.7, sz + 0.5, { s: 1.1 });
  }
  for (let i = 0; i < 4; i++) place('survival/box', 1.5 + i * 0.5, 2.6, { s: 1.1, rot: rng() * 6 });
}

function cafeTerrace(ctx, pick, rng) {
  const { place } = ctx;
  for (let i = 0; i < 5; i++) {
    const px = -4 + i * 2.2, pz = -3.4;
    place(pick(['commercial/detail-parasol-a', 'commercial/detail-parasol-b']), px, pz, { s: 2.0 });
    place('graveyard/bench', px + 0.6, pz + 0.5, { s: 1.1, rot: rng() * 6 });
  }
}

function crowd(ctx, era, n) {
  const { person } = ctx;
  if (!person) return;
  const rng = ctx.rng;
  for (let i = 0; i < n; i++) person(-5 + rng() * 11, -2 + rng() * 9, era);
  for (let c = 0; c < Math.floor(n / 6); c++) { const cx = 1 + rng() * 8, cz = 1 + rng() * 8; for (let k = 0; k < 3; k++) person(cx + (rng() - 0.5), cz + (rng() - 0.5), era); }
}
