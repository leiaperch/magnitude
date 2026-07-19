/* MAGNITUDE — the ages town, generated in three.js.
 *
 * No external models: every building, roof, stall, tree and townsperson is
 * assembled here from boxes, wedges and cones, in one coherent low-poly style,
 * and driven by the per-era spec in ages.json (wall material, storeys, roof and
 * window kind, skyline landmarks, street props, crowd). One era becomes two
 * merged meshes — a lit solid and an unlit "glow" for windows, neon and lamps —
 * so a whole century is two draw calls.
 *
 * Local convention for every generator: the piece is built at the origin with
 * its front facing +Z and its feet on y = 0. The caller places and turns it
 * through the builder's matrix stack, so the same house serves both terraces.
 */

import * as THREE from '../../vendor/three.module.js';

/* ------------------------------------------------------------------ palette */
const _lin = new Map();
function C(hex) {
  let v = _lin.get(hex);
  if (!v) { const c = new THREE.Color(hex); v = [c.r, c.g, c.b]; _lin.set(hex, v); }
  return v;
}
/* small deterministic shade jitter so a terrace never reads as one flat wall */
function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, Math.max(0, c.r * k)); c.g = Math.min(1, Math.max(0, c.g * k)); c.b = Math.min(1, Math.max(0, c.b * k));
  return [c.r, c.g, c.b];
}

const WALL = {
  wood:     ['#8a6a44', '#7a5c3a', '#946f45'],
  timber:   ['#ece3d0', '#e6dcc2', '#f0ead9'],   // plaster panels, dark frame added on top
  stone:    ['#cfc6b0', '#c6bca4', '#d6cdb8'],
  brick:    ['#a5533a', '#9c4a34', '#ad5c40'],
  render:   ['#d9b98c', '#cf9e78', '#e0c69c', '#c9a6b0', '#b7c3c9'],
  concrete: ['#bdb9ad', '#b3afa4', '#c6c2b6'],
};
const FRAME = { wood: '#5c4127', timber: '#5a3f28', stone: '#a99e83', brick: '#7d3d2b', render: '#b89a72', concrete: '#9d998e' };
const ROOF = {
  thatch: '#b39a5c', tile: '#b1553b', slate: '#4b5560', flat: '#8b887f', solar: '#1b2740',
};
const GLASS = { lead: '#9fb8c4', sash: '#bcd0d8', picture: '#8fb4c8', shutter: '#2a241f', hole: '#241f1a' };
const WARM = '#ffcf8a', NEONS = ['#ff5db1', '#43e0ff', '#b98cff', '#ffd23f', '#4dff9e'];

/* ------------------------------------------------------------------ builder */
class Builder {
  constructor() {
    this.solid = { pos: [], nor: [], col: [] };
    this.glow = { pos: [], nor: [], col: [] };
    this.m = new THREE.Matrix4();
    this.stack = [];
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._c = new THREE.Vector3();
    this._n = new THREE.Vector3(); this._u = new THREE.Vector3(); this._v = new THREE.Vector3();
  }
  push(mat) { this.stack.push(this.m.clone()); this.m.multiply(mat); }
  pop() { this.m.copy(this.stack.pop()); }
  at(x, y, z, ry = 0, s = 1) {                       // convenience: translate+rotateY+scale
    const mm = new THREE.Matrix4().makeTranslation(x, y, z);
    if (ry) mm.multiply(new THREE.Matrix4().makeRotationY(ry));
    if (s !== 1) mm.multiply(new THREE.Matrix4().makeScale(s, s, s));
    this.push(mm);
  }
  tri(ax, ay, az, bx, by, bz, cx, cy, cz, color, glow) {
    const t = glow ? this.glow : this.solid;
    this._a.set(ax, ay, az).applyMatrix4(this.m);
    this._b.set(bx, by, bz).applyMatrix4(this.m);
    this._c.set(cx, cy, cz).applyMatrix4(this.m);
    this._u.subVectors(this._b, this._a); this._v.subVectors(this._c, this._a);
    this._n.crossVectors(this._u, this._v).normalize();
    const P = t.pos, N = t.nor, L = t.col;
    P.push(this._a.x, this._a.y, this._a.z, this._b.x, this._b.y, this._b.z, this._c.x, this._c.y, this._c.z);
    for (let i = 0; i < 3; i++) N.push(this._n.x, this._n.y, this._n.z);
    for (let i = 0; i < 3; i++) L.push(color[0], color[1], color[2]);
  }
  quad(a, b, c, d, color, glow) { this.tri(...a, ...b, ...c, color, glow); this.tri(...a, ...c, ...d, color, glow); }

  /* axis-aligned box, feet on baseY */
  box(cx, baseY, cz, w, h, d, color, glow) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = baseY, y1 = baseY + h, z0 = cz - d / 2, z1 = cz + d / 2;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color, glow); // +Z
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color, glow); // -Z
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color, glow); // +X
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color, glow); // -X
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], color, glow); // top
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color, glow); // bottom
  }
  /* gable roof: triangular prism, ridge running along X, feet on baseY */
  gable(cx, baseY, cz, w, h, d, color, glow) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, yr = baseY + h, ax = cx;
    this.quad([x0, baseY, z1], [x1, baseY, z1], [x1, yr, cz], [x0, yr, cz], color, glow);   // +Z slope
    this.quad([x1, baseY, z0], [x0, baseY, z0], [x0, yr, cz], [x1, yr, cz], color, glow);   // -Z slope
    this.tri(x0, baseY, z0, x0, baseY, z1, x0, yr, cz, color, glow);                        // gable -X
    this.tri(x1, baseY, z1, x1, baseY, z0, x1, yr, cz, color, glow);                        // gable +X
  }
  /* gable roof turned so the triangular end faces the street (+Z), ridge along Z */
  gableZ(cx, baseY, cz, w, h, d, color, glow) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, yr = baseY + h;
    this.quad([x1, baseY, z0], [x1, baseY, z1], [cx, yr, z1], [cx, yr, z0], color, glow);   // +X slope
    this.quad([x0, baseY, z1], [x0, baseY, z0], [cx, yr, z0], [cx, yr, z1], color, glow);   // -X slope
    this.tri(x0, baseY, z1, x1, baseY, z1, cx, yr, z1, color, glow);                        // +Z gable face
    this.tri(x1, baseY, z0, x0, baseY, z0, cx, yr, z0, color, glow);                        // -Z gable face
  }
  /* four-sided pyramid roof, feet on baseY */
  pyramid(cx, baseY, cz, w, h, d, color, glow) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, ay = baseY + h;
    this.tri(x0, baseY, z1, x1, baseY, z1, cx, ay, cz, color, glow);
    this.tri(x1, baseY, z0, x0, baseY, z0, cx, ay, cz, color, glow);
    this.tri(x1, baseY, z1, x1, baseY, z0, cx, ay, cz, color, glow);
    this.tri(x0, baseY, z0, x0, baseY, z1, cx, ay, cz, color, glow);
  }
  cyl(cx, baseY, cz, r, h, sides, color, glow, r2) {
    const rt = r2 == null ? r : r2;
    for (let i = 0; i < sides; i++) {
      const a0 = i / sides * Math.PI * 2, a1 = (i + 1) / sides * Math.PI * 2;
      const x0 = cx + Math.cos(a0) * r, z0 = cz + Math.sin(a0) * r, x1 = cx + Math.cos(a1) * r, z1 = cz + Math.sin(a1) * r;
      const xt0 = cx + Math.cos(a0) * rt, zt0 = cz + Math.sin(a0) * rt, xt1 = cx + Math.cos(a1) * rt, zt1 = cz + Math.sin(a1) * rt;
      this.quad([x0, baseY, z0], [x1, baseY, z1], [xt1, baseY + h, zt1], [xt0, baseY + h, zt0], color, glow);
      this.tri(cx, baseY + h, cz, xt0, baseY + h, zt0, xt1, baseY + h, zt1, color, glow);   // top cap
    }
  }
  cone(cx, baseY, cz, r, h, sides, color, glow) {
    for (let i = 0; i < sides; i++) {
      const a0 = i / sides * Math.PI * 2, a1 = (i + 1) / sides * Math.PI * 2;
      this.tri(cx + Math.cos(a0) * r, baseY, cz + Math.sin(a0) * r, cx + Math.cos(a1) * r, baseY, cz + Math.sin(a1) * r, cx, baseY + h, cz, color, glow);
    }
  }
  /* low-poly leafy blob (octahedron, squashed) for tree crowns */
  blob(cx, cy, cz, r, color, glow) {
    const p = [[0, r, 0], [0, -r, 0], [r, 0, 0], [-r, 0, 0], [0, 0, r], [0, 0, -r]];
    const f = [[0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]];
    for (const [i, j, k] of f) this.tri(cx + p[i][0], cy + p[i][1], cz + p[i][2], cx + p[j][0], cy + p[j][1], cz + p[j][2], cx + p[k][0], cy + p[k][1], cz + p[k][2], color, glow);
  }

  finish() {
    const g = new THREE.Group();
    const mk = (t, mat) => {
      if (!t.pos.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(t.nor, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(t.col, 3));
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = mat.userData.cast; m.receiveShadow = mat.userData.cast;
      g.add(m);
    };
    const solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide });
    solidMat.userData.cast = true;
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    glowMat.userData.cast = false;
    mk(this.solid, solidMat);
    mk(this.glow, glowMat);
    return g;
  }
}

/* --------------------------------------------------------------- buildings */
/* one terraced house, front facing +Z, feet on 0. width w, spec = era.house.
 * variant {gable, ds} lets the caller step the roofline and heights so a run of
 * houses reads as a street, not one long wall. */
function house(B, w, spec, rng, night, variant) {
  variant = variant || {};
  const mat = spec.material;
  const storeys = Math.max(1, (spec.storeys || 2) + (variant.ds || 0));
  const floorH = (mat === 'wood' ? 1.25 : 1.45) + rng() * 0.08;
  const depth = 3.0 + rng() * 0.4;
  const wallHex = WALL[mat][(rng() * WALL[mat].length) | 0];
  const frameHex = FRAME[mat];
  const roofKind = spec.roof, roofHex = ROOF[roofKind] || ROOF.tile;
  const jetty = mat === 'timber' || mat === 'wood';
  const gableToStreet = variant.gable && roofKind !== 'flat' && roofKind !== 'solar';

  /* body, storey by storey — timber houses oversail (jetty) toward the street */
  let y = 0;
  for (let s = 0; s < storeys; s++) {
    const grow = jetty ? s * 0.18 : 0;
    const ww = w - 0.05 + grow, dd = depth + grow, fz = (depth / 2) + grow / 2;
    B.box(0, y, grow / 2, ww, floorH, dd, shade(wallHex, 0.97 + rng() * 0.06));
    if (jetty && s > 0) B.box(0, y - 0.05, fz, ww, 0.09, 0.1, C(frameHex));   // jetty beam shadow line
    facade(B, ww, floorH, fz, y, s, storeys, spec, mat, frameHex, rng, night);
    y += floorH;
  }
  const bodyH = y, front = depth / 2 + (jetty ? (storeys - 1) * 0.18 / 2 : 0);
  const rw = w + 0.5 + (jetty ? (storeys - 1) * 0.18 : 0), rd = depth + 0.5 + (jetty ? (storeys - 1) * 0.18 : 0);

  if (roofKind === 'flat' || roofKind === 'solar') {
    B.box(0, bodyH, 0, w + 0.05, 0.12, depth + 0.05, shade(roofHex, 1));
    B.box(0, bodyH, front - 0.05, w + 0.05, 0.4, 0.12, shade(wallHex, 0.88));      // front parapet
    B.box(0, bodyH, -depth / 2 + 0.05, w + 0.05, 0.4, 0.12, shade(wallHex, 0.82));
    if (roofKind === 'solar') for (let i = -1; i <= 1; i++) { B.box(i * (w / 3), bodyH + 0.12, -0.3, w / 3.4, 0.05, depth * 0.5, C('#0d1830')); B.box(i * (w / 3), bodyH + 0.17, -0.3, w / 3.6, 0.02, depth * 0.46, C('#2bd6ff'), true); }
    if (spec.trees) for (let i = 0; i < 3; i++) B.blob((rng() - 0.5) * w, bodyH + 0.5, (rng() - 0.5) * depth, 0.42, C('#5f8f4b'));
  } else {
    const rh = (roofKind === 'thatch' ? 1.5 : 1.05) + storeys * 0.05;
    const eave = shade(roofHex, 0.62);
    if (gableToStreet) {
      B.box(0, bodyH - 0.12, front - 0.05, rw, 0.16, 0.14, eave);                  // eave fascia over the gable
      B.gableZ(0, bodyH, 0, rw, rh, rd, shade(roofHex, 0.97 + rng() * 0.06));
      gableTrim(B, w, bodyH, front, rh, mat, frameHex, wallHex, spec, night, rng); // framed/rendered gable end
    } else {
      B.box(0, bodyH - 0.12, front - 0.05, rw, 0.16, 0.16, eave);                  // eave shadow line, street side
      B.gable(0, bodyH, 0, rw, rh, rd, shade(roofHex, 0.97 + rng() * 0.06));
      if (roofKind === 'thatch') B.gable(0, bodyH + 0.02, 0, rw * 0.66, rh * 0.7, rd, shade(roofHex, 0.88));
      if (storeys >= 3 && (roofKind === 'tile' || roofKind === 'slate') && rng() > 0.45) { // dormer
        const dx = (rng() - 0.5) * w * 0.5;
        B.box(dx, bodyH + 0.25, front - 0.35, 0.6, 0.55, 0.5, shade(wallHex, 1.03));
        B.box(dx, bodyH + 0.5, front - 0.15, 0.42, 0.34, 0.06, night > 0.05 ? C(WARM) : C('#bcd0d8'), night > 0.05);
        B.gable(dx, bodyH + 0.8, front - 0.35, 0.74, 0.34, 0.55, shade(roofHex, 1));
      }
    }
    const cxp = (rng() - 0.5) * w * 0.5;                                            // chimney
    B.box(cxp, bodyH + rh * 0.35, -0.35, 0.32, 1.1, 0.32, C(mat === 'wood' || mat === 'timber' ? '#7a5c3a' : '#8a4a34'));
    B.box(cxp, bodyH + rh * 0.35 + 1.1, -0.35, 0.4, 0.13, 0.4, C('#4a2c20'));
  }

  if (spec.sign) {
    const sx = w / 2 - 0.15;
    B.box(sx, floorH * 0.85, front + 0.03, 0.05, 0.05, 0.45, C('#4a3826'));
    B.box(sx, floorH * 0.5, front + 0.26, 0.05, 0.34, 0.4, shade(['#3d5a4a', '#5a3d3d', '#3d4a5a', '#6a5a2a'][(rng() * 4) | 0], 1));
  }
  if (spec.neon) {
    B.box(w / 2 - 0.12, floorH * 1.3, front + 0.05, 0.1, floorH * (storeys - 1.4), 0.06, C(NEONS[(rng() * NEONS.length) | 0]), true);
    B.box(0, floorH - 0.15, front + 0.05, w * 0.72, 0.14, 0.06, C(NEONS[(rng() * NEONS.length) | 0]), true);
  }
}

/* the front of one storey: framing, windows, ground-floor door */
function facade(B, w, h, front, y, s, storeys, spec, mat, frameHex, rng, night) {
  const win = spec.window;
  const lit = night > 0.04 && (win === 'picture' || rng() < 0.45);
  const glassHex = win === 'hole' ? '#221d18' : win === 'shutter' ? '#3a2f26' : win === 'picture' ? '#7fa8c4' : '#aecbd4';
  const gcol = lit ? C(WARM) : C(glassHex);
  const fz = front + 0.02;

  if (mat === 'timber' || mat === 'wood') {                    // half-timber: thick dark frame + braces
    const t = 0.14, fh = C(frameHex);
    B.box(0, y, fz, w, t, 0.07, fh); B.box(0, y + h - t, fz, w, t, 0.07, fh);        // sill + head
    for (const px of [-w / 2 + t / 2, 0, w / 2 - t / 2]) B.box(px, y, fz, t, h, 0.07, fh);  // posts
    if (mat === 'timber') { brace(B, -w / 4, y, h, w / 2, fz, fh); brace(B, w / 4, y, h, -w / 2, fz, fh); B.box(0, y + h / 2, fz, w, 0.1, 0.06, fh); }
  } else if (mat === 'stone' || mat === 'brick') {             // quoins + string course
    for (const px of [-w / 2 + 0.12, w / 2 - 0.12]) B.box(px, y, front + 0.005, 0.22, h, 0.05, C(mat === 'brick' ? '#d8cdb4' : '#ded5c0'));
    if (s > 0) B.box(0, y, front + 0.02, w, 0.12, 0.06, C(mat === 'brick' ? '#cdbf9f' : '#d0c7b2'));
  }

  const n = w > 2.7 ? 3 : 2, gap = w / n;
  const big = win === 'picture';
  const winW = gap * (big ? 0.66 : 0.46), winH = Math.min(big ? 0.95 : 0.78, h * 0.52);
  for (let i = 0; i < n; i++) {
    const px = -w / 2 + gap * (i + 0.5);
    if (s === 0 && i === (n >> 1)) {                            // door
      B.box(px, y, front + 0.02, 0.56, Math.min(1.05, h * 0.72), 0.06, C(mat === 'render' || mat === 'concrete' ? '#3a4652' : '#43301e'));
      B.box(px, y + Math.min(1.05, h * 0.72), front + 0.02, 0.66, 0.1, 0.07, C(frameHex));
      continue;
    }
    const wy = y + h * 0.3;
    B.box(px, wy - 0.06, front + 0.04, winW + 0.16, 0.08, 0.05, C('#efe9dc'));      // sill
    B.box(px, wy + winH, front + 0.04, winW + 0.16, 0.09, 0.05, C('#efe9dc'));      // lintel
    B.box(px, wy, front + 0.05, winW, winH, 0.05, gcol, lit);                       // glass
    if (win === 'lead' || win === 'sash' || win === 'shutter') {                    // muntins
      B.box(px, wy + winH / 2, front + 0.07, winW, 0.045, 0.03, C('#eee7d8'));
      B.box(px, wy, front + 0.07, 0.045, winH, 0.03, C('#eee7d8'));
    }
    if (win === 'shutter') for (const sx of [-winW / 2 - 0.09, winW / 2 + 0.09]) B.box(px + sx, wy, front + 0.03, 0.14, winH, 0.05, C('#6b4f34'));
  }
}
function brace(B, x, y, h, run, fz, col) {                     // a diagonal timber, corner to corner of a panel
  const steps = 5;
  for (let i = 0; i < steps; i++) B.box(x + run * (i / steps) * 0.5, y + h * (i / steps), fz, 0.14, h / steps + 0.06, 0.06, col);
}
/* the triangular street-facing gable: plaster/framed infill so it isn't a blank slab */
function gableTrim(B, w, bodyH, front, rh, mat, frameHex, wallHex, spec, night, rng) {
  B.tri(-w / 2, bodyH, front - 0.02, w / 2, bodyH, front - 0.02, 0, bodyH + rh, front - 0.02, shade(wallHex, 1.02)); // infill
  if (mat === 'timber' || mat === 'wood') {
    B.box(0, bodyH, front, 0.12, rh * 0.92, 0.06, C(frameHex));                     // king post
    B.box(-w / 4, bodyH + rh * 0.3, front, w / 2, 0.1, 0.06, C(frameHex));          // collar tie
  }
  const wy = bodyH + rh * 0.18, ww = w * 0.24;                                      // attic window
  B.box(0, wy, front + 0.03, ww + 0.12, 0.07, 0.05, C('#efe9dc'));
  B.box(0, wy, front + 0.04, ww, 0.42, 0.05, night > 0.04 ? C(WARM) : C('#aecbd4'), night > 0.04);
}

/* --------------------------------------------------------------- landmarks */
function landmark(B, kind, night) {
  switch (kind) {
    case 'motte': B.cone(0, 0, 0, 3.4, 2.2, 10, C('#6f8a4e')); B.box(0, 2.0, 0, 1.6, 2.4, 1.6, C('#7a5c3a')); B.pyramid(0, 4.4, 0, 1.9, 1.2, 1.9, C('#8a6a44')); break;
    case 'palisade': for (let i = -3; i <= 3; i++) B.box(i * 0.6, 0, 3.4, 0.4, 2.0 + (i % 2) * 0.2, 0.4, C('#6b4f34')); break;
    case 'keep': keep(B, false); break;
    case 'keep-ruin': keep(B, true); break;
    case 'church': cathedral(B, 'small', night); break;
    case 'cathedral-build': cathedral(B, 'build', night); break;
    case 'cathedral': cathedral(B, 'full', night); break;
    case 'cathedral-scarred': cathedral(B, 'scarred', night); break;
    case 'cathedral-spire': cathedral(B, 'spire', night); break;
    case 'townhall': B.box(0, 0, 0, 5, 3.6, 3.2, C('#cfc6b0')); B.gable(0, 3.6, 0, 5.4, 1.2, 3.6, C('#8a5040')); B.box(0, 0, 1.6, 2, 5.2, 0.6, C('#c6bca4')); B.pyramid(0, 5.2, 1.6, 1.2, 1.0, 1.2, C('#5a6a4a')); break;
    case 'windmill': B.cyl(0, 0, 0, 1.5, 5.2, 8, C('#cfc6b0'), false, 0.9); B.cone(0, 5.2, 0, 1.1, 0.9, 8, C('#5a4030')); windmillSails(B); break;
    case 'chimney': B.cyl(0, 0, 0, 0.9, 8.5, 10, C('#8a4a34'), false, 0.6); B.cyl(0, 8.5, 0, 0.62, 0.4, 10, C('#6a3626')); break;
    case 'gasometer': B.cyl(0, 0, 0, 3, 3.6, 14, C('#4a5560')); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; B.box(Math.cos(a) * 3, 0, Math.sin(a) * 3, 0.14, 4.2, 0.14, C('#39424c')); } break;
    case 'crane': B.box(0, 0, 0, 0.6, 6, 0.6, C('#7a6a3a')); B.box(1.6, 5.4, 0, 4.4, 0.5, 0.5, C('#8a7a44')); B.box(-0.8, 5.4, 0, 1.6, 0.5, 0.5, C('#8a7a44')); break;
    case 'station': B.box(0, 0, 0, 6.5, 3, 4, C('#a5533a')); B.cyl(0, 3, 0, 3.2, 0, 12, C('#6a7580')); B.box(0, 3, 2.0, 6.5, 2.6, 0.2, C('#3a4048')); halfVault(B, 0, 3, 0, 3.25, 2.4, 4, C('#6a7580')); break;
    case 'megatower': megatower(B, night); break;
    case 'holotower': B.box(0, 0, 0, 2.4, 11, 2.4, C('#2a3550')); for (let i = 1; i < 9; i++) B.box(0, i * 1.3, 1.21, 2.0, 0.5, 0.06, C(NEONS[i % NEONS.length]), true); B.cone(0, 11, 0, 1.2, 2.2, 6, C('#3a4560')); break;
    case 'skybridge': B.box(-2.4, 0, 0, 2.4, 13, 2.4, C('#26324c')); B.box(2.4, 0, 0.6, 2.6, 15, 2.6, C('#2a3550')); glowGrid(B, -2.4, 13, 1.21, 2.0, 12, night); glowGrid(B, 2.4, 15, 1.31, 2.2, 14, night); B.box(0, 8.5, 0.3, 3, 0.7, 0.7, C('#3a4560'), night > 0.1); break;
    default: break;
  }
}
function keep(B, ruin) {
  const h = ruin ? 3.0 : 5.2;
  B.box(0, 0, 0, 3.6, h, 3.6, C('#c2b9a2'));
  if (ruin) { B.box(1.2, h, 0, 1.0, 1.4, 3.6, C('#b6ad96')); B.box(-1.4, h - 0.6, -1, 0.8, 0.8, 1, C('#b6ad96')); }
  else B.box(0, h, 0, 3.8, 0.5, 3.8, C('#b6ad96'));
  const turrets = ruin ? [[1.8, 1.8]] : [[1.8, 1.8], [-1.8, 1.8], [1.8, -1.8], [-1.8, -1.8]];
  for (const [tx, tz] of turrets) { B.cyl(tx, 0, tz, 0.7, h + (ruin ? -1 : 0.8), 8, C('#cbc2ab')); if (!ruin) B.cone(tx, h + 0.8, tz, 0.85, 1.2, 8, C('#6a5545')); }
}
function cathedral(B, variant, night) {
  const scar = variant === 'scarred';
  const stone = scar ? '#b3aa94' : '#d2c9b3';
  B.box(0, 0, 1, 4, 4.2, 6, C(stone));                    // nave
  B.gable(0, 4.2, 1, 4.4, 1.4, 6.2, C(scar ? '#5a5550' : '#7a8590'));
  B.box(0, 0, -2.3, 5.6, 3.4, 1.6, C(stone));             // transept
  const towerH = variant === 'build' ? 4.5 : 6.5;
  for (const tx of [-1.5, 1.5]) {
    B.box(tx, 0, 4.0, 1.5, towerH, 1.5, C(stone));
    if (variant === 'build' && tx > 0) scaffold(B, tx, towerH, 4.0);
    else if (variant === 'spire' && tx > 0) B.cone(tx, towerH, 4.0, 1.0, 3.2, 6, C('#5a6570'));
    else B.box(tx, towerH, 4.0, 1.7, 0.4, 1.7, C(stone));
  }
  if (variant === 'spire' || variant === 'full') B.cone(0, 4.2, 1, 0.7, 2.4, 6, C('#6a7580'));  // crossing fleche
  B.box(0, 1.4, 5.0, 1.2, 1.6, 0.2, night > 0.05 ? C(WARM) : C('#7a95b0'), night > 0.05); // rose window
  if (variant === 'build') B.box(2.6, 0, 4, 0.4, 5.5, 0.4, C('#8a7a44'));                        // build crane mast
}
function scaffold(B, x, h, z) { for (let i = 0; i <= 3; i++) B.box(x, i * (h / 3), z + 0.85, 1.7, 0.08, 0.08, C('#9a854a')); for (const sx of [-0.8, 0.8]) B.box(x + sx, 0, z + 0.85, 0.08, h, 0.08, C('#9a854a')); }
function windmillSails(B) { B.at(0, 4.6, 1.1); for (let k = 0; k < 4; k++) { B.push(new THREE.Matrix4().makeRotationZ(k * Math.PI / 2)); B.box(0, 1.4, 0, 0.18, 2.8, 0.1, C('#6b4f34')); B.box(0.35, 1.4, 0.02, 0.5, 2.4, 0.04, C('#d8d2c2')); B.pop(); } B.pop(); }
function halfVault(B, cx, baseY, cz, r, h, d, color) { const seg = 8; for (let i = 0; i < seg; i++) { const a0 = Math.PI * i / seg, a1 = Math.PI * (i + 1) / seg; const y0 = baseY + Math.sin(a0) * h, x0 = cx - Math.cos(a0) * r, y1 = baseY + Math.sin(a1) * h, x1 = cx - Math.cos(a1) * r; B.quad([x0, y0, cz - d / 2], [x1, y1, cz - d / 2], [x1, y1, cz + d / 2], [x0, y0, cz + d / 2], color); } }
function megatower(B, night) {
  let y = 0, w = 3;
  for (let s = 0; s < 4; s++) { B.box(0, y, 0, w, 3.4, w, C(s % 2 ? '#3a4762' : '#31405c')); glowGrid(B, 0, y, w / 2 + 0.01, w - 0.4, 10, night); y += 3.4; w -= 0.5; }
  B.box(0, y, 0, 0.3, 2.5, 0.3, C('#5a6580')); B.box(0, y + 2.5, 0, 0.1, 0.6, 0.1, C('#ff5db1'), true);
}
function glowGrid(B, cx, baseY, fz, w, rows, night) {
  const lit = night > 0.02, col = lit ? C('#ffe0a0') : C('#7fa0b8');
  const cols = 4, cw = w / cols;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if ((r * 7 + c * 3) % 3 !== 0) B.box(cx - w / 2 + cw * (c + 0.5), baseY + 0.35 + r * 0.32, fz, cw * 0.66, 0.2, 0.04, lit ? (Math.random() < 0.5 ? col : C('#8fb4c8')) : col, lit);
}

/* ------------------------------------------------------------------- props */
function prop(B, kind, rng, night) {
  switch (kind) {
    case 'well': B.cyl(0, 0, 0, 0.6, 0.7, 10, C('#9a9184')); B.cyl(0, 0.7, 0, 0.5, 0.15, 10, C('#7a7264')); for (const sx of [-0.55, 0.55]) B.box(sx, 0.7, 0, 0.14, 1.4, 0.14, C('#6b4f34')); B.gable(0, 2.1, 0, 1.5, 0.5, 0.9, C('#8a5040')); B.box(0, 1.4, 0, 0.3, 0.3, 0.3, C('#4a3826')); break;
    case 'barrel': B.cyl(0, 0, 0, 0.32, 0.62, 8, C('#7a5c3a'), false, 0.28); B.cyl(0, 0, 0, 0.34, 0.1, 8, C('#4a3826'), false, 0.34); B.cyl(0, 0.5, 0, 0.34, 0.1, 8, C('#4a3826'), false, 0.3); break;
    case 'crate': B.box(0, 0, 0, 0.6, 0.6, 0.6, C('#8a6a44')); for (const e of [-0.28, 0.28]) { B.box(e, 0.3, 0.31, 0.05, 0.6, 0.03, C('#6b4f34')); B.box(e, 0.3, -0.31, 0.05, 0.6, 0.03, C('#6b4f34')); } break;
    case 'hay': B.cyl(0, 0, 0, 0.4, 0.7, 8, C('#c8a94e')); break;
    case 'crop':
    case 'produce': for (let i = 0; i < 4; i++) B.box((rng() - .5) * .5, 0, (rng() - .5) * .5, .16, .16, .16, C(['#c94a3a', '#e0902a', '#4a7a2a', '#d8c23a'][(rng() * 4) | 0])); break;
    case 'bench': B.box(0, 0.35, 0, 1.3, 0.1, 0.4, C('#7a5c3a')); B.box(0, 0.55, -0.15, 1.3, 0.4, 0.08, C('#7a5c3a')); for (const sx of [-0.55, 0.55]) B.box(sx, 0, 0, 0.1, 0.35, 0.36, C('#5a4030')); break;
    case 'tree': tree(B, rng, false); break;
    case 'neon-tree': tree(B, rng, true); break;
    case 'cross': B.box(0, 0, 0, 1.6, 0.3, 1.6, C('#b6ad96')); B.box(0, 0.3, 0, 1.1, 0.3, 1.1, C('#c2b9a2')); B.cyl(0, 0.6, 0, 0.16, 2.0, 8, C('#cbc2ab')); B.box(0, 2.6, 0, 0.7, 0.5, 0.5, C('#b6ad96')); break;
    case 'fountain': B.cyl(0, 0, 0, 1.4, 0.5, 12, C('#b6ad96'), false, 1.25); B.cyl(0, 0.1, 0, 1.15, 0.25, 12, night > .1 ? C('#2a4a66') : C('#6fa8c8'), night > .1); B.cyl(0, 0.5, 0, 0.3, 1.0, 10, C('#c2b9a2')); B.cyl(0, 1.5, 0, 0.7, 0.2, 10, C('#b6ad96'), false, 0.6); B.cone(0, 1.7, 0, 0.2, 0.5, 8, C('#cbc2ab')); break;
    case 'stall': stall(B, rng); break;
    case 'cart': cart(B, false, false); break;
    case 'loadcart': cart(B, true, false); break;
    case 'carriage': cart(B, false, true); break;
    case 'horse': animal(B, '#6b4f34', 1); break;
    case 'pig': animal(B, '#d69a9a', 0.6); break;
    case 'dog': animal(B, '#8a6a44', 0.5); break;
    case 'lamp-oil': case 'lamp-gas': lamp(B, night, WARM); break;
    case 'lamp-electric': lamp(B, night, '#fff2d0'); break;
    case 'neon-post': lamp(B, 1, NEONS[(rng() * NEONS.length) | 0]); break;
    case 'tram': tram(B, false, night); break;
    case 'car': car(B, rng, night); break;
    case 'bike': bike(B); break;
    case 'scooter': bike(B); break;
    case 'phone-box': B.box(0, 0, 0, 0.7, 2.2, 0.7, C('#b0231f')); B.box(0, 0.6, 0.31, 0.5, 1.3, 0.06, night > .05 ? C(WARM) : C('#8fb4c8'), night > .05); B.pyramid(0, 2.2, 0, 0.8, 0.25, 0.8, C('#8a1a17')); break;
    case 'traffic-light': B.box(0, 0, 0, 0.16, 2.4, 0.16, C('#39424c')); B.box(0, 2.0, 0.12, 0.24, 0.6, 0.16, C('#20262c')); B.box(0, 2.15, 0.22, 0.12, 0.12, 0.05, C('#33dd55'), true); break;
    case 'planter': B.box(0, 0, 0, 1.0, 0.4, 0.5, C('#9a9184')); for (let i = 0; i < 3; i++) B.blob(-0.3 + i * 0.3, 0.55, 0, 0.22, C('#5f8f4b')); break;
    case 'holo-sign': B.box(0, 0, 0, 0.1, 2.2, 0.1, C('#39424c')); B.box(0, 2.4, 0, 1.0, 0.9, 0.05, C(NEONS[(rng() * NEONS.length) | 0]), true); break;
    case 'drone': B.at((rng() - .5) * 4, 3 + rng() * 2, (rng() - .5) * 3); B.box(0, 0, 0, 0.4, 0.14, 0.4, C('#26324c')); for (const [dx, dz] of [[.3, .3], [-.3, .3], [.3, -.3], [-.3, -.3]]) { B.box(dx, 0.05, dz, 0.22, 0.03, 0.22, C('#39424c')); B.box(dx, 0.02, dz, 0.05, 0.05, 0.05, C('#43e0ff'), true); } B.pop(); break;
    default: break;
  }
}
function tree(B, rng, neon) {
  B.cyl(0, 0, 0, 0.16, 1.1 + rng() * 0.4, 6, C(neon ? '#1a2436' : '#6b4f34'), false, 0.13);
  const gy = 1.3 + rng() * 0.3;
  const green = neon ? C(['#43e0ff', '#4dff9e', '#b98cff'][(rng() * 3) | 0]) : shade(['#5f8f4b', '#6d9a54', '#57853f'][(rng() * 3) | 0], 0.95 + rng() * 0.1);
  B.blob(0, gy, 0, 0.7 + rng() * 0.2, green, neon);
  B.blob((rng() - .5) * .6, gy + 0.4, (rng() - .5) * .6, 0.5, green, neon);
  B.blob((rng() - .5) * .6, gy - 0.1, (rng() - .5) * .6, 0.55, green, neon);
}
function stall(B, rng) {
  for (const [sx, sz] of [[-0.7, -0.5], [0.7, -0.5], [-0.7, 0.5], [0.7, 0.5]]) B.box(sx, 0, sz, 0.09, 1.5, 0.09, C('#6b4f34'));
  B.box(0, 0.75, 0.5, 1.6, 0.12, 0.55, C('#8a6a44'));                        // counter
  const a = ['#b23a3a', '#c9c9c9'], b = ['#e0e0e0', '#3a6ab2'];
  const two = rng() < 0.5 ? ['#b23a3a', '#e8e4d8'] : ['#3a6ab2', '#e8e4d8'];
  for (let i = -2; i <= 1; i++) B.gable(i * 0.42 + 0.21, 1.5, 0, 0.44, 0.35, 1.5, C(two[(i + 2) % 2]));  // striped awning
  for (let i = 0; i < 3; i++) B.box(-0.5 + i * 0.5, 0.87, 0.5, 0.16, 0.16, 0.16, C(['#c94a3a', '#e0902a', '#4a7a2a'][i]));
}
function cart(B, loaded, cab) {
  B.box(0, 0.4, 0, 1.4, 0.25, 0.8, C('#7a5c3a'));
  for (const [wx, wz] of [[0.5, 0.45], [0.5, -0.45], [-0.5, 0.45], [-0.5, -0.45]]) B.cyl(wx, 0, wz, 0.3, 0.12, 8, C('#4a3826'));
  B.box(0.9, 0.3, 0, 0.9, 0.08, 0.12, C('#6b4f34'));                         // shaft
  if (loaded) for (let i = 0; i < 3; i++) B.box(-0.4 + i * 0.4, 0.55, 0, 0.34, 0.34, 0.6, C('#8a6a44'));
  if (cab) { B.box(0, 0.55, 0, 0.9, 0.9, 0.75, C('#3a2f4a')); B.box(0, 0.9, 0.38, 0.5, 0.4, 0.05, C('#8fb4c8')); }
}
function animal(B, hex, s) {
  B.at(0, 0, 0, 0, s);
  B.box(0, 0.55, 0, 1.0, 0.5, 0.4, C(hex));
  B.box(0.55, 0.7, 0, 0.3, 0.5, 0.32, C(hex));                               // neck+head
  B.box(0.72, 0.85, 0, 0.34, 0.28, 0.28, C(hex));
  for (const [lx, lz] of [[0.35, 0.15], [0.35, -0.15], [-0.35, 0.15], [-0.35, -0.15]]) B.box(lx, 0, lz, 0.12, 0.55, 0.12, C(hex));
  B.pop();
}
function lamp(B, night, hex) {
  B.cyl(0, 0, 0, 0.1, 2.6, 8, C('#3a3f46'), false, 0.08);
  B.box(0, 2.6, 0, 0.34, 0.34, 0.34, C('#2a2e33'));
  B.box(0, 2.66, 0, 0.24, 0.24, 0.24, night > 0.02 ? C(hex) : C('#c9c2a8'), night > 0.02);
}
function tram(B, modern, night) {
  const body = modern ? '#c23a3a' : '#3a6a4a';
  B.box(0, 0.4, 0, 3.2, 1.4, 1.1, C(body));
  B.box(0, 0.1, 0, 3.0, 0.3, 1.15, C('#2a2e33'));
  for (let i = -2; i <= 2; i++) B.box(i * 0.6, 1.0, 0.56, 0.42, 0.5, 0.04, night > .05 ? C(WARM) : C('#bcd0d8'), night > .05);
  for (const wx of [1.1, -1.1]) B.cyl(wx, 0, 0.4, 0.22, 0.1, 8, C('#20242a')), B.cyl(wx, 0, -0.4, 0.22, 0.1, 8, C('#20242a'));
  B.box(0, 1.8, 0, 0.06, 0.7, 0.06, C('#39424c'));
}
function car(B, rng, night) {
  const hex = ['#3a6ab2', '#b23a3a', '#e8e4d8', '#39424c', '#3a8a6a'][(rng() * 5) | 0];
  B.box(0, 0.28, 0, 2.0, 0.5, 0.9, C(hex));
  B.box(0.05, 0.72, 0, 1.1, 0.42, 0.82, shade(hex, 1.05));
  B.box(0.05, 0.78, 0, 1.05, 0.3, 0.86, night > .05 ? C('#1a2230') : C('#8fb4c8'));
  for (const [wx, wz] of [[0.7, 0.46], [0.7, -0.46], [-0.7, 0.46], [-0.7, -0.46]]) B.cyl(wx, 0, wz, 0.24, 0.14, 8, C('#20242a'));
  B.box(1.02, 0.3, 0.3, 0.06, 0.14, 0.14, night > .05 ? C('#fff2c0') : C('#d8d2c2'), night > .05);
  B.box(1.02, 0.3, -0.3, 0.06, 0.14, 0.14, night > .05 ? C('#fff2c0') : C('#d8d2c2'), night > .05);
}
function bike(B) { for (const wx of [0.4, -0.4]) B.cyl(wx, 0, 0, 0.28, 0.06, 8, C('#20242a')); B.box(0, 0.5, 0, 0.7, 0.08, 0.08, C('#8a2a2a')); B.box(-0.4, 0.5, 0, 0.08, 0.5, 0.08, C('#8a2a2a')); B.box(0.4, 0.6, 0, 0.08, 0.5, 0.08, C('#8a2a2a')); }

/* --------------------------------------------------------------- townsfolk */
const CLOTH = ['#3f4a5a', '#6b3a3a', '#4a5a3a', '#5a4a6b', '#2f3136', '#7a6a4a', '#8a4a3a', '#3a5a6a'];
function person(B, rng) {
  const c = C(CLOTH[(rng() * CLOTH.length) | 0]);
  B.box(0, 0, 0, 0.34, 0.5, 0.24, c);              // legs/coat
  B.box(0, 0.5, 0, 0.4, 0.42, 0.26, shade(CLOTH[(rng() * CLOTH.length) | 0], 1));
  B.box(0, 0.92, 0, 0.24, 0.24, 0.22, C('#e8bd96')); // head
  if (rng() < 0.3) B.box(0, 1.1, 0, 0.3, 0.12, 0.28, C('#4a3826')); // hat
}

/* ---------------------------------------------------------------- assembly */
/* the plaza: two terraces meet at the back-left, the square opens to camera */
const BACK = -7.0, LEFTX = -7.0;

export function buildEra(era) {
  const B = new Builder();
  const rng = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)((era.year * 2654435761) >>> 0);
  const night = era.night || 0;
  const spec = era.house;

  /* paving inset under the square, a touch darker than the shared ground */
  B.box(0.5, 0.01, 1.5, 17, 0.02, 15, shade(era.ground === 'asphalt' ? '#4a4a4e' : era.ground === 'setts' || era.ground === 'cobble' ? '#8f8a7e' : '#9a8f76', 1));

  /* skyline landmarks, set well back and spread across the horizon */
  const marks = era.skyline || [];
  const slots = [[-6, -15], [2, -16.5], [8.5, -14]];
  marks.forEach((k, i) => { const [x, z] = slots[i % slots.length]; B.at(x, 0, z, 0.2 * (i - 1)); landmark(B, k, night); B.pop(); });

  /* how often a house turns its gable to the street: common in the timber town,
   * rare once roofs go flat. And how much its height may step. */
  const gableProb = spec.roof === 'thatch' || spec.roof === 'tile' ? 0.55 : spec.roof === 'slate' ? 0.3 : 0.05;
  const variant = () => ({ gable: rng() < gableProb, ds: [-1, 0, 0, 0, 1][(rng() * 5) | 0] });

  /* back terrace: a continuous run of houses facing the camera. In 1950 one lot
   * is a gap where a bomb fell — left as low rubble, not a house. */
  let x = -8.4;
  while (x < 8.5) {
    const w = 2.2 + rng() * 0.9;
    if (spec.gap && rng() < 0.14) { B.at(x + w / 2, 0.02, BACK); for (let r = 0; r < 4; r++) B.box((rng() - .5) * w, 0, (rng() - .5) * 2, 0.4 + rng() * 0.3, 0.3 + rng() * 0.4, 0.4, shade('#8a8378', 0.9 + rng() * 0.2)); B.pop(); }
    else { B.at(x + w / 2, 0, BACK); house(B, w, spec, rng, night, variant()); B.pop(); }
    x += w + 0.06;
  }
  /* left terrace: same, turned to face +X */
  let z = -4.0;
  while (z < 7.5) { const w = 2.2 + rng() * 0.9; B.at(LEFTX, 0, z + w / 2, Math.PI / 2); house(B, w, spec, rng, night, variant()); B.pop(); z += w + 0.06; }

  /* the market / street, read straight from the era's prop list */
  const street = era.street || [];
  const stalls = street.filter(s => s === 'stall').length;
  let si = 0;
  /* stalls in two tidy rows down a central aisle */
  const stallSpots = [];
  for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) stallSpots.push([-3.6 + i * 2.1, -0.6 + r * 2.2, r ? Math.PI : 0]);
  /* centrepiece + everything else along lanes and edges */
  const laneNear = 5.6, edgeRight = 6.6;
  let lampT = -3.5, treeT = 0, benchT = 0, animT = 0, vehT = -2.6, propMisc = [];
  for (const k of street) {
    if (k === 'stall') { const sp = stallSpots[si % stallSpots.length]; si++; B.at(sp[0], 0, sp[1], sp[2]); prop(B, 'stall', rng, night); B.pop(); }
    else if (k === 'cross' || k === 'fountain') { B.at(1.5, 0, 3.6); prop(B, k, rng, night); B.pop(); }
    else if (k === 'well') { B.at(-3.5, 0, 4.4); prop(B, k, rng, night); B.pop(); }
    else if (k.startsWith('lamp') || k === 'neon-post' || k === 'traffic-light' || k === 'phone-box' || k === 'holo-sign') { B.at(edgeRight, 0, lampT); prop(B, k, rng, night); B.pop(); lampT += 2.6; }
    else if (k === 'tree' || k === 'neon-tree') { B.at(-4.5 + treeT * 2.7, 0, laneNear); prop(B, k, rng, night); B.pop(); treeT++; }
    else if (k === 'bench' || k === 'planter') { B.at(-4.2 + benchT * 3.2, 0, laneNear + 0.7, Math.PI); prop(B, k, rng, night); B.pop(); benchT++; }
    else if (k === 'tram' || k === 'car' || k === 'carriage' || k === 'cart' || k === 'loadcart' || k === 'bike' || k === 'scooter') { B.at(vehT, 0, 6.4, Math.PI / 2); prop(B, k === 'carriage' ? 'carriage' : k, rng, night); B.pop(); vehT += k === 'tram' ? 4 : 2.4; }
    else if (k === 'horse' || k === 'pig' || k === 'dog') { B.at(-2 + animT * 1.4, 0, 2.4 + animT * 0.4, -Math.PI / 3); prop(B, k, rng, night); B.pop(); animT++; }
    else if (k === 'drone') { prop(B, 'drone', rng, night); }
    else { B.at(-5 + (propMisc.length % 6) * 0.8, 0, 3.2 + (rng() - 0.5), rng() * 6); prop(B, k, rng, night); B.pop(); propMisc.push(k); }
  }

  /* crowd: small knots at the stalls and along the near edge */
  const crowd = Math.min(era.crowd || 6, 20);
  for (let i = 0; i < crowd; i++) {
    let px, pz;
    if (i < stalls * 1.5 && stallSpots.length) { const sp = stallSpots[i % stallSpots.length]; px = sp[0] + (rng() - 0.5) * 1.2; pz = sp[1] + (sp[2] ? -1 : 1) * (0.8 + rng() * 0.4); }
    else { px = -4.5 + rng() * 9; pz = 4.4 + rng() * 2.2; }
    B.at(px, 0, pz, rng() * Math.PI * 2); person(B, rng); B.pop();
  }

  /* chimney smoke: soft grey blobs drifting off the roofline */
  for (let i = 0; i < (era.smoke || 0); i++) { const sx = -5 + rng() * 11; B.blob(sx, 6 + rng() * 2, BACK, 0.5 + rng() * 0.4, shade('#c9cdd2', 0.9 + rng() * 0.2)); }

  return B.finish();
}
