/* MAGNITUDE — procedural textures for the ages town.
 *
 * Every surface is generated as a raw RGBA buffer and wrapped in a DataTexture,
 * on purpose: DataTexture needs no <canvas>, so the exact same textures build in
 * the browser and in the headless snapshot renderer. No image files, no fetches.
 */
import * as THREE from '../../vendor/three.module.js';

const N = 64;

function rng(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const hexRGB = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const jitter = (c, d, r) => [
  Math.max(0, Math.min(255, c[0] + (r() - 0.5) * d)),
  Math.max(0, Math.min(255, c[1] + (r() - 0.5) * d)),
  Math.max(0, Math.min(255, c[2] + (r() - 0.5) * d)),
];

function make(fill) {
  const data = new Uint8Array(N * N * 4);
  const set = (x, y, rgb) => {
    const i = (y * N + x) * 4;
    data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) fill(x, y, set);
  return data;
}

/* running bond brick or block masonry */
function brick(base, mortar, rows, cols, seed, jit) {
  const b = hexRGB(base), m = hexRGB(mortar), r = rng(seed);
  const rh = N / rows, cw = N / cols, tone = [];
  for (let k = 0; k < rows * cols * 2; k++) tone.push(jitter(b, jit, r));
  return make((x, y, set) => {
    const row = Math.floor(y / rh);
    const off = (row % 2) * cw * 0.5;
    const gx = (x + off) % N;
    const inMortar = (y % rh) < 1.4 || (gx % cw) < 1.4;
    set(x, y, inMortar ? m : tone[(row * cols + Math.floor(gx / cw)) % tone.length]);
  });
}

/* irregular ashlar: like brick but with broken vertical joints */
function ashlar(base, mortar, seed) {
  const b = hexRGB(base), m = hexRGB(mortar), r = rng(seed);
  const rows = 6;
  const jog = []; for (let i = 0; i < rows; i++) jog.push(r());
  const tone = []; for (let k = 0; k < 80; k++) tone.push(jitter(b, 26, r));
  return make((x, y, set) => {
    const rh = N / rows, row = Math.floor(y / rh);
    const cw = N / (3 + (row % 2));
    const gx = (x + jog[row] * N) % N;
    const inMortar = (y % rh) < 1.6 || (gx % cw) < 1.6;
    set(x, y, inMortar ? m : tone[(row * 7 + Math.floor(gx / cw)) % tone.length]);
  });
}

/* overlapping roof tiles: scalloped rows */
function tiles(base, seed) {
  const b = hexRGB(base), r = rng(seed), rows = 9, cols = 11;
  const tone = []; for (let k = 0; k < rows * cols; k++) tone.push(jitter(b, 30, r));
  return make((x, y, set) => {
    const rh = N / rows, row = Math.floor(y / rh);
    const off = (row % 2) * (N / cols) * 0.5;
    const col = Math.floor(((x + off) % N) / (N / cols));
    const inRow = (y % rh);
    const shade = inRow < rh * 0.28 ? 0.7 : 1;            // shadow under each overlap
    const t = tone[(row * cols + col) % tone.length];
    set(x, y, [t[0] * shade, t[1] * shade, t[2] * shade]);
  });
}

/* vertical planks / thatch streaks */
function streaks(base, seed, jit, vertical) {
  const b = hexRGB(base), r = rng(seed);
  const lanes = 14, tone = [];
  for (let k = 0; k < lanes; k++) tone.push(jitter(b, jit, r));
  return make((x, y, set) => {
    const u = vertical ? x : y, v = vertical ? y : x;
    const lane = Math.floor(u / (N / lanes));
    const grain = 1 - 0.12 * ((v + lane * 7) % 5 === 0 ? 1 : 0);
    const seam = (u % (N / lanes)) < 1 ? 0.72 : 1;
    const t = tone[lane % tone.length];
    set(x, y, [t[0] * grain * seam, t[1] * grain * seam, t[2] * grain * seam]);
  });
}

/* rounded cobbles / setts with grout */
function cobbles(base, seed) {
  const b = hexRGB(base), r = rng(seed), cells = 8;
  const cx = [], cy = [], ct = [];
  for (let i = 0; i < cells * cells; i++) {
    cx.push((i % cells + 0.5 + (r() - 0.5) * 0.4) * (N / cells));
    cy.push((Math.floor(i / cells) + 0.5 + (r() - 0.5) * 0.4) * (N / cells));
    ct.push(jitter(b, 34, r));
  }
  return make((x, y, set) => {
    let best = 1e9, bi = 0;
    const gx = Math.floor(x / (N / cells)), gy = Math.floor(y / (N / cells));
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const j = ((gy + oy + cells) % cells) * cells + ((gx + ox + cells) % cells);
      const dx = x - cx[j], dy = y - cy[j], dd = dx * dx + dy * dy;
      if (dd < best) { best = dd; bi = j; }
    }
    const grout = best > (N / cells * 0.42) ** 2;
    const t = ct[bi];
    set(x, y, grout ? [t[0] * 0.5, t[1] * 0.5, t[2] * 0.5] : t);
  });
}

/* fine speckle: render, concrete, asphalt, mud */
function speckle(base, seed, jit, panel) {
  const b = hexRGB(base), r = rng(seed);
  return make((x, y, set) => {
    let t = jitter(b, jit, r);
    if (panel && ((x % 32) < 1 || (y % 32) < 1)) t = [t[0] * 0.82, t[1] * 0.82, t[2] * 0.82];
    set(x, y, t);
  });
}

/* ---- assembled per PALETTE key, memoised, returned as DataTextures ---- */
const RECIPE = {
  'wall.wood': () => streaks(0x8a6a44, 11, 26, true),
  'wall.timber': () => speckle(0xe6dcc4, 12, 16, false),       // plaster infill; the beams are geometry
  'wall.stone': () => ashlar(0xc2b9a6, 0x9a917f, 21),
  'wall.brick': () => brick(0x9d5140, 0x6f4436, 16, 8, 31, 30),
  'wall.render': () => speckle(0xd3c9b6, 41, 12, false),
  'wall.concrete': () => speckle(0xadaba3, 47, 14, true),
  'roof.thatch': () => streaks(0xa8894f, 5, 30, false),
  'roof.tile': () => tiles(0x9c4436, 7),
  'roof.slate': () => brick(0x4f5761, 0x3a4048, 12, 6, 9, 18),
  'roof.flat': () => speckle(0x7d7b74, 3, 10, true),
  'roof.solar': () => speckle(0x7d7b74, 3, 10, true),
  /* ground bases run dark on purpose: an up-facing plane catches the full sun
   * and the whole sky, so a mid-grey cobble would blow out to white */
  'ground.mud': () => speckle(0x4a3d2b, 5, 16, false),
  'ground.cobble': () => cobbles(0x585650, 13),
  'ground.setts': () => brick(0x565550, 0x3c3b37, 10, 8, 17, 12),
  'ground.asphalt': () => speckle(0x33353a, 71, 8, false),
};

const cache = new Map();
export function texture(key) {
  if (!RECIPE[key]) return null;
  if (cache.has(key)) return cache.get(key);
  const tex = new THREE.DataTexture(RECIPE[key](), N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}
