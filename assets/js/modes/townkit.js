/* MAGNITUDE — the ages town, composed from Kenney models.
 *
 * Environment-agnostic: `buildEra(era, ctx)` places model instances through a
 * `ctx.place(name, x, z, opts)` the caller supplies — GLTFLoader-backed in the
 * browser, the headless GLB reader in the snapshot. Same composition both ways.
 *
 * Placement is deliberate, never scattered: buildings terrace along two edges,
 * the market runs in tidy rows down a central aisle, furniture sits on lines,
 * trees on a grid, and people gather in small knots at the stalls and benches —
 * with the middle of the square left open.
 *
 * World: +X right-ish, +Z toward the camera, +Y up. The rows meet in an L at
 * the back-left; the square opens toward the camera.
 */

export const MANIFEST = [
  'castle/tower-square-base', 'castle/tower-square-mid-windows', 'castle/tower-square-top-roof-high',
  'castle/wall', 'castle/gate', 'castle/flag',
  'modular/building-sample-house-a', 'modular/building-sample-house-b', 'modular/building-sample-house-c',
  'modular/building-sample-tower-a', 'modular/building-sample-tower-b',
  'commercial/building-a', 'commercial/building-b', 'commercial/building-c', 'commercial/building-d',
  'commercial/building-e', 'commercial/building-f', 'commercial/building-g', 'commercial/building-h',
  'commercial/building-skyscraper-a', 'commercial/building-skyscraper-b', 'commercial/building-skyscraper-c',
  'commercial/detail-parasol-a', 'commercial/detail-parasol-b',
  'industrial/chimney-large', 'industrial/building-c', 'industrial/building-h',
  'survival/tree', 'survival/tree-tall', 'forest/tree', 'survival/barrel', 'survival/box',
  'survival/tent-canvas', 'survival/campfire-pit',
  'graveyard/lightpost-single', 'graveyard/lightpost-double', 'graveyard/bench', 'graveyard/iron-fence-border',
  'graveyard/cross-column',
  'prototype/animal-horse', 'prototype/animal-dog', 'prototype/vehicle', 'prototype/vehicle-convertible',
  'train/train-tram-classic', 'train/train-tram-modern',
  'food/apple', 'food/orange', 'food/cabbage', 'food/carrot', 'food/bread', 'food/loaf-round',
  'food/pumpkin-basic', 'food/cheese', 'food/corn',
];

const PRODUCE = ['food/apple', 'food/orange', 'food/cabbage', 'food/carrot', 'food/bread', 'food/loaf-round', 'food/pumpkin-basic', 'food/cheese', 'food/corn'];

function era_style(year) {
  if (year < 1200) return { kind: 'castle', houses: ['modular/building-sample-house-a', 'modular/building-sample-house-b'], hs: 2.1, castle: 'stone' };
  if (year < 1500) return { kind: 'medieval', houses: ['modular/building-sample-house-a', 'modular/building-sample-house-b', 'modular/building-sample-house-c'], hs: 2.2, castle: year < 1450 ? 'stone' : 'ruin', market: true };
  if (year < 1800) return { kind: 'town', houses: ['modular/building-sample-house-a', 'modular/building-sample-house-b', 'modular/building-sample-house-c', 'modular/building-sample-tower-a'], hs: 2.3, market: true };
  if (year < 1950) return { kind: 'industrial', houses: ['commercial/building-c', 'commercial/building-h', 'industrial/building-c', 'industrial/building-h', 'modular/building-sample-house-c'], hs: 2.4, chimney: true, market: true };
  if (year < 2030) return { kind: 'modern', houses: ['commercial/building-a', 'commercial/building-b', 'commercial/building-d', 'commercial/building-e', 'commercial/building-f', 'commercial/building-g'], hs: 2.5, cafe: true };
  return { kind: 'future', houses: ['commercial/building-skyscraper-a', 'commercial/building-skyscraper-b', 'commercial/building-skyscraper-c', 'commercial/building-a', 'commercial/building-e'], hs: 2.7, cafe: true, eco: true };
}

/* the plaza edges: buildings sit just outside these, furniture just inside */
const BACK = -6.2, LEFT = -6.2, FRONT = 6.8, RIGHT = 6.8;

export function buildEra(era, ctx) {
  const { place } = ctx;
  const rng = ctx.rng;
  const pick = a => a[Math.floor(rng() * a.length)];
  const st = era_style(era.year);

  /* ---- civic backdrop, aligned behind the rows ---- */
  if (st.kind === 'castle' || st.kind === 'medieval') {
    const ruin = st.castle === 'ruin';
    const towers = ruin ? [[-8.6, -9]] : [[-9.2, -9.2], [-6.8, -10.4]];
    for (const [tx, tz] of towers) {
      place('castle/tower-square-base', tx, tz, { s: 2.7 });
      if (!ruin) { place('castle/tower-square-mid-windows', tx, tz, { s: 2.7, y: 2.7 * 0.62 }); place('castle/tower-square-top-roof-high', tx, tz, { s: 2.7, y: 2.7 * 1.2 }); place('castle/flag', tx, tz, { s: 2.7, y: 2.7 * 1.85 }); }
    }
    if (!ruin) place('castle/gate', -8, -8, { s: 2.4 });
  } else {
    for (let i = 0; i < 3; i++) place(pick(st.houses), -9.4 + i * 2.4, -9.2, { s: st.hs * 1.15 });
    if (st.chimney) place('industrial/chimney-large', -8.8, -10.6, { s: 2.4 });
  }

  /* ---- the two terraced building rows (regular, flush) ---- */
  const step = 1.95;
  for (let i = 0, x = -6.4; x < 7.4; i++, x += step) place(pick(st.houses), x, BACK, { s: st.hs });
  for (let i = 0, z = -4.4; z < 7.4; i++, z += step) place(pick(st.houses), LEFT, z, { s: st.hs, rot: -Math.PI / 2 });

  /* rooftop gardens for the eco future, aligned along the parapet */
  if (st.eco) for (let i = 0; i < 6; i++) place('forest/tree', -5 + i * 2.2, BACK + 0.2, { s: 1.0, y: st.hs * 1.2 });

  /* ---- the square, laid out on purpose ---- */
  if (st.market) market(ctx, st, pick, rng, era);
  if (st.cafe) cafe(ctx, pick);

  /* Trees are lined up clear of the market: a neat front row, plus two flanking
   * the centrepiece. Without a market the plaza gets a formal quincunx instead. */
  const TREE = (st.kind === 'modern' || st.kind === 'future') ? 'forest/tree' : 'survival/tree';
  if (st.market) {
    for (const tx of [-4.2, -1.4, 1.4, 4.2]) place(TREE, tx, 5.8, { s: 1.9 });
  } else {
    for (const [tx, tz] of [[-2.6, 4.6], [2.6, 4.6], [-2.6, 1.4], [2.6, 1.4]]) place(TREE, tx, tz, { s: 1.9 });
  }

  /* one clear centrepiece in front of the market, flanked by trees */
  if (era.year < 1650) { place('graveyard/cross-column', 0, 4.3, { s: 2.3 }); place(TREE, -2, 4.3, { s: 1.7 }); place(TREE, 2, 4.3, { s: 1.7 }); }

  /* furniture on lines: lightposts evenly on the two open edges, a clean
   * railing run, benches squared to the square */
  if (era.year >= 1650) {
    const lamp = era.year >= 1900 ? 'graveyard/lightpost-double' : 'graveyard/lightpost-single';
    for (let t = -4; t <= 6; t += 2.5) { place(lamp, RIGHT, t, { s: 1.5, rot: -Math.PI / 2 }); place(lamp, t, FRONT, { s: 1.5 }); }
    for (let i = 0; i < 8; i++) place('graveyard/iron-fence-border', RIGHT + 0.1, -4.5 + i * 1.5, { s: 1.4 });
    for (let i = 0; i < 8; i++) place('graveyard/iron-fence-border', -4.5 + i * 1.5, FRONT + 0.1, { s: 1.4, rot: Math.PI / 2 });
  } else {
    for (let t = -3; t <= 5; t += 2.6) place('survival/campfire-pit', RIGHT - 0.3, t, { s: 1.2 });
  }
  /* benches squared to the square, along the open edges */
  place('graveyard/bench', -4.6, 5.6, { s: 1.3, rot: Math.PI / 2 });
  place('graveyard/bench', 5.4, 3.0, { s: 1.3, rot: -Math.PI / 2 });
  if (!st.market) place('graveyard/bench', 0, 5.6, { s: 1.3 });

  /* one clear traffic lane along the near edge */
  if (era.year < 1900) { place('prototype/animal-horse', -3.2, FRONT - 0.2, { s: 2.0, rot: Math.PI / 2 }); place('prototype/animal-dog', -1.6, FRONT - 0.4, { s: 1.4, rot: Math.PI / 2 }); }
  if (era.year >= 1850 && era.year < 1950) place('train/train-tram-classic', 2.5, FRONT + 1.6, { s: 1.6, rot: Math.PI / 2 });
  if (era.year >= 1950 && era.year < 2030) { place('prototype/vehicle', 1.5, FRONT + 1.5, { s: 2.2, rot: Math.PI / 2 }); place('prototype/vehicle-convertible', 4.5, FRONT + 1.5, { s: 2.2, rot: Math.PI / 2 }); }
  if (era.year >= 2030) place('train/train-tram-modern', 2.5, FRONT + 1.6, { s: 1.6, rot: Math.PI / 2 });

  /* people gather where there is something to do, not uniformly */
  crowds(ctx, era, st);
}

/* two tidy rows of stalls down a central aisle, each heaped in a neat grid */
function market(ctx, st, pick, rng) {
  const { place } = ctx;
  const rows = [{ z: -0.4 }, { z: 1.9 }];
  for (const row of rows) {
    for (let i = 0; i < 4; i++) {
      const sx = -3.6 + i * 2.1, sz = row.z;
      place('survival/tent-canvas', sx, sz, { s: 1.5 });
      /* produce in a tidy 3×2 grid on the trestle */
      for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) place(pick(PRODUCE), sx - 0.4 + a * 0.4, sz - 0.2 + b * 0.4, { s: 1.0, y: 0.36 });
      place('survival/barrel', sx + 0.9, sz, { s: 1.2 });
    }
  }
}

/* café tables in a neat row against the shopfronts */
function cafe(ctx, pick) {
  const { place } = ctx;
  for (let i = 0; i < 5; i++) {
    const px = -4.4 + i * 2.2;
    place(pick(['commercial/detail-parasol-a', 'commercial/detail-parasol-b']), px, BACK + 1.4, { s: 2.0 });
    place('graveyard/bench', px, BACK + 2.0, { s: 1.0 });
  }
}

/* small knots of people at the stalls, café and benches — centre left open */
function crowds(ctx, era, st) {
  const { person } = ctx;
  if (!person) return;
  const rng = ctx.rng;
  const knot = (x, z, n) => { for (let k = 0; k < n; k++) person(x + (rng() - 0.5) * 0.7, z + (rng() - 0.5) * 0.7, era); };
  if (st.market) for (let i = 0; i < 4; i++) knot(-3.6 + i * 2.1, 0.75, 2);            // browsing the aisle
  if (st.cafe) for (let i = 0; i < 5; i++) knot(-4.4 + i * 2.2, BACK + 2.0, 1);        // at the tables
  knot(1.5, 6, 3);                                                                     // a group near the front
  for (let i = 0; i < 3; i++) person(-3 + i * 2.6, 6.4, era);                          // a few crossing the near edge
}
