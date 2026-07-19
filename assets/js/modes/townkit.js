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

const SUBURB = ['suburban/building-type-a', 'suburban/building-type-b', 'suburban/building-type-e', 'suburban/building-type-f', 'suburban/building-type-h', 'suburban/building-type-j', 'suburban/building-type-l', 'suburban/building-type-m', 'suburban/building-type-o', 'suburban/building-type-q', 'suburban/building-type-s'];
const CHARS = 'abcdefghijklmnopqr'.split('').map(c => 'chars/character-' + c);
const STALLS = ['fantasy/stall', 'fantasy/stall-red', 'fantasy/stall-green'];
const NATURE_TREE = ['nature/tree_default', 'nature/tree_detailed', 'nature/tree_default_dark', 'nature/tree_detailed_dark'];
const PRODUCE = ['food/apple', 'food/orange', 'food/cabbage', 'food/carrot', 'food/bread', 'food/loaf-round', 'food/pumpkin-basic', 'food/cheese', 'food/corn'];

export const MANIFEST = [
  'castle/tower-square-base', 'castle/tower-square-mid-windows', 'castle/tower-square-top-roof-high',
  'castle/gate', 'castle/flag',
  'modular/building-sample-house-a', 'modular/building-sample-house-b', 'modular/building-sample-house-c',
  ...SUBURB,
  'commercial/building-skyscraper-a', 'commercial/building-skyscraper-b', 'commercial/building-skyscraper-c',
  'commercial/building-a', 'commercial/detail-parasol-a', 'commercial/detail-parasol-b',
  'industrial/chimney-large', 'industrial/building-c',
  ...NATURE_TREE, 'nature/plant_bushDetailed', 'nature/flower_redA', 'nature/flower_yellowA',
  ...STALLS, 'fantasy/stall-bench', 'fantasy/fountain-round', 'fantasy/fountain-center', 'fantasy/cart', 'fantasy/cart-high', 'fantasy/lantern', 'fantasy/banner-red',
  'survival/barrel', 'survival/box', 'survival/campfire-pit',
  'graveyard/lightpost-single', 'graveyard/lightpost-double', 'graveyard/bench', 'graveyard/iron-fence-border',
  'graveyard/cross-column',
  'prototype/animal-horse', 'prototype/animal-dog', 'prototype/vehicle', 'prototype/vehicle-convertible',
  'train/train-tram-classic', 'train/train-tram-modern',
  ...PRODUCE, ...CHARS,
];

function era_style(year) {
  if (year < 1200) return { kind: 'castle', houses: ['modular/building-sample-house-a', 'modular/building-sample-house-b'], hs: 2.2, castle: 'stone' };
  if (year < 1500) return { kind: 'medieval', houses: ['modular/building-sample-house-a', 'modular/building-sample-house-b', 'modular/building-sample-house-c'], hs: 2.3, castle: year < 1450 ? 'stone' : 'ruin', market: true };
  if (year < 1800) return { kind: 'town', houses: ['modular/building-sample-house-a', 'modular/building-sample-house-b', 'modular/building-sample-house-c', 'suburban/building-type-f'], hs: 2.4, market: true, fountain: true };
  if (year < 1950) return { kind: 'industrial', houses: [...SUBURB.slice(0, 6), 'industrial/building-c'], hs: 2.8, chimney: true, market: true };
  if (year < 2030) return { kind: 'modern', houses: SUBURB, hs: 3.0, cafe: true };
  return { kind: 'future', houses: ['commercial/building-skyscraper-a', 'commercial/building-skyscraper-b', 'commercial/building-skyscraper-c', 'suburban/building-type-f', 'suburban/building-type-m'], hs: 2.7, cafe: true, eco: true };
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

  /* Trees line up clear of the market: a neat front row, or a formal quincunx
   * when the square is open. Real nature-kit trees, scaled to size. */
  const tree = (x, z, s = 2.0) => place(pick(NATURE_TREE), x, z, { s });
  if (st.market) {
    for (const tx of [-4.2, -1.4, 1.4, 4.2]) tree(tx, 5.8);
  } else {
    for (const [tx, tz] of [[-2.6, 4.6], [2.6, 4.6], [-2.6, 1.4], [2.6, 1.4]]) tree(tx, tz);
  }

  /* one clear centrepiece: a market cross early, a stone fountain once the town
   * can afford one, flanked by trees */
  if (era.year < 1650) { place('graveyard/cross-column', 0, 4.3, { s: 2.3 }); tree(-2, 4.3, 1.7); tree(2, 4.3, 1.7); }
  else if (st.fountain || st.cafe) { place('fantasy/fountain-round', 0, 4.3, { s: 1.6 }); place('fantasy/fountain-center', 0, 4.3, { s: 1.6 }); }

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
  crowds(ctx, era, st, pick);
}

/* two tidy rows of proper market stalls down a central aisle */
function market(ctx, st, pick, rng) {
  const { place } = ctx;
  const rows = [{ z: -0.4, rot: 0 }, { z: 2.0, rot: Math.PI }];
  for (const row of rows) {
    for (let i = 0; i < 4; i++) {
      const sx = -3.6 + i * 2.1, sz = row.z;
      place(pick(STALLS), sx, sz, { s: 1.6, rot: row.rot });
      /* a few crates of produce beside each stall */
      for (let k = 0; k < 3; k++) place(pick(PRODUCE), sx - 0.4 + k * 0.4, sz + (row.rot ? -0.75 : 0.75), { s: 1.1, y: 0.0 });
      if (i % 2) place('fantasy/cart', sx + 1.0, sz + (row.rot ? -0.5 : 0.5), { s: 1.3, rot: row.rot });
      else place('survival/barrel', sx + 0.95, sz, { s: 1.2 });
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

/* small knots of real Kenney townsfolk at the stalls, café and edges — the
 * centre of the square is left open */
function crowds(ctx, era, st, pick) {
  const { place } = ctx;
  const rng = ctx.rng;
  const one = (x, z) => place(pick(CHARS), x, z, { s: 0.58, rot: rng() * Math.PI * 2 });
  const knot = (x, z, n) => { for (let k = 0; k < n; k++) one(x + (rng() - 0.5) * 0.7, z + (rng() - 0.5) * 0.7); };
  if (st.market) for (let i = 0; i < 4; i++) knot(-3.6 + i * 2.1, 0.8, 2);             // browsing the aisle
  if (st.cafe) for (let i = 0; i < 5; i++) one(-4.4 + i * 2.2, BACK + 2.0);            // at the tables
  knot(1.5, 6, 3);                                                                     // a group near the front
  for (let i = 0; i < 3; i++) one(-3 + i * 2.6, 6.4);                                  // a few crossing the near edge
}
