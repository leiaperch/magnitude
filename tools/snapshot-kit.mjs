/* Compose a full era from real Kenney models and render it headless, to design
 * the rebuilt ages diorama against the reference. node tools/snapshot-kit.mjs */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import * as THREE from '../assets/vendor/three.module.js';
import { loadGLB } from './glb-node.mjs';

const W = 1200, H = 675;
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
const ELEV = 30 * Math.PI / 180, TARGET = new THREE.Vector3(0, 1.2, 0);
cam.position.copy(TARGET).add(new THREE.Vector3(1, Math.SQRT2 * Math.tan(ELEV), 1).normalize().multiplyScalar(120));
cam.lookAt(TARGET);
const vw = 20, vh = vw * H / W;
cam.left = -vw / 2; cam.right = vw / 2; cam.top = vh / 2; cam.bottom = -vh / 2;
cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
const VP = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
const SUN = new THREE.Vector3(-22, 34, 18).normalize();

const scene = new THREE.Group();
const bboxCache = new Map();
function place(name, x, z, { rot = 0, s = 1, y = 0 } = {}) {
  const { geometry, texture } = loadGLB(`assets/models/${name}.glb`);
  if (!bboxCache.has(name)) { geometry.computeBoundingBox(); bboxCache.set(name, geometry.boundingBox.clone()); }
  const bb = bboxCache.get(name);
  const m = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  m.userData.tex = texture;
  m.scale.setScalar(s);
  m.position.set(x, y - bb.min.y * s, z);
  m.rotation.y = rot;
  scene.add(m);
  return m;
}

const rand = (seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)(20260719);
const pick = a => a[Math.floor(rand() * a.length)];

/* ---- a modern square (reference image #2) ---- */
const BLD = ['building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'building-f', 'building-g', 'building-h'];
const BS = 2.4;                              // building scale → ~2 wide, ~3 tall
/* back row (faces +z, toward camera) and left row (faces +x) forming an L */
for (let i = 0; i < 7; i++) place(`commercial/${pick(BLD)}`, -6.5 + i * 2.05, -6.2, { rot: 0, s: BS });
for (let i = 0; i < 6; i++) place(`commercial/${pick(BLD)}`, -6.2, -4.4 + i * 2.05, { rot: -Math.PI / 2, s: BS });
place('industrial/chimney-large', -7.6, -8.2, { s: 2.2 });

/* café terraces: parasols + benches out front of the shops */
for (let i = 0; i < 5; i++) { const px = -4 + i * 2.2, pz = -3.6; place(`commercial/detail-parasol-${rand() > 0.5 ? 'a' : 'b'}`, px, pz, { s: 2.0 }); place('graveyard/bench', px + 0.6, pz + 0.5, { s: 1.2, rot: rand() * 6 }); }

/* the plaza: trees, lightposts ringing, benches, planters, a couple of cars */
for (const [tx, tz] of [[-1, 0], [3, -1], [-3, 2], [2, 3], [5, 1]]) place('survival/tree', tx, tz, { s: 1.8 });
for (let t = -5; t <= 6; t += 2.4) { place('graveyard/lightpost-double', 6.5, t, { s: 1.5 }); place('graveyard/lightpost-double', t, 6.5, { s: 1.5, rot: Math.PI / 2 }); }
for (const [bx, bz, r] of [[0, 4, 0], [-4, 4, 0], [4, 4.5, 0.4], [1, -1, 1.2]]) place('graveyard/bench', bx, bz, { s: 1.3, rot: r });
for (let i = 0; i < 8; i++) place('graveyard/iron-fence-border', 6.6, -5 + i * 1.5, { s: 1.4 });
place('prototype/vehicle', 4, 8, { s: 2.2, rot: 0 });
place('prototype/vehicle-convertible', -2, 8.3, { s: 2.2, rot: 0 });

/* simple placeholder people until the character question is settled */
const CLOTH = [0x3f4a5a, 0x6b3a3a, 0x4a5a3a, 0x5a4a6b, 0x2f3136, 0x7a6a4a];
for (let i = 0; i < 22; i++) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.4, 3, 6), new THREE.MeshBasicMaterial({ color: pick(CLOTH) }));
  body.position.y = 0.4; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe8bd96 }));
  head.position.y = 0.82; g.add(head);
  g.position.set(-5 + rand() * 11, -3 + rand() * 10, 0); g.position.z = g.position.y; g.position.y = 0;
  const gx = -5 + rand() * 11, gz = -2 + rand() * 9; g.position.set(gx, 0, gz);
  scene.add(g);
}

/* a ground plane */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0xb8b2a6 }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);

scene.updateMatrixWorld(true);
render();

/* ------------------------------------------------------ raster + png ---- */
function render() {
  const buf = new Uint8Array(W * H * 3);
  const top = [176, 190, 205], bot = [222, 224, 220];
  for (let y = 0; y < H; y++) { const t = y / H; const r = top[0] + (bot[0] - top[0]) * t, g = top[1] + (bot[1] - top[1]) * t, b = top[2] + (bot[2] - top[2]) * t; for (let x = 0; x < W; x++) { const i = (y * W + x) * 3; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; } }
  const zb = new Float32Array(W * H).fill(Infinity);
  const P = new THREE.Vector3(), Q = new THREE.Vector3(), R = new THREE.Vector3(), wa = new THREE.Vector3(), wb = new THREE.Vector3(), wc = new THREE.Vector3();
  let tris = 0;
  scene.traverse(m => {
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position, uv = m.geometry.attributes.uv, idx = m.geometry.index;
    const tex = m.userData.tex, td = tex && tex.image.data, tw = tex && tex.image.width, th = tex && tex.image.height;
    const col = m.material.color;
    const count = idx ? idx.count : pos.count;
    for (let t = 0; t < count; t += 3) {
      const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
      wa.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld); wb.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld); wc.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
      const ux = wb.x - wa.x, uy = wb.y - wa.y, uz = wb.z - wa.z, vx = wc.x - wa.x, vy = wc.y - wa.y, vz = wc.z - wa.z;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const light = Math.max(0, nx * SUN.x + ny * SUN.y + nz * SUN.z) * 0.85 + 0.5;
      P.copy(wa).applyMatrix4(VP); Q.copy(wb).applyMatrix4(VP); R.copy(wc).applyMatrix4(VP);
      const uvs = (td && uv) ? [uv.getX(i0), uv.getY(i0), uv.getX(i1), uv.getY(i1), uv.getX(i2), uv.getY(i2)] : null;
      raster(buf, zb, P, Q, R, uvs, td, tw, th, light, col);
      tris++;
    }
  });
  const stride = W * 3 + 1, raw = Buffer.alloc(stride * H);
  for (let y = 0; y < H; y++) { raw[y * stride] = 0; Buffer.from(buf.buffer, y * W * 3, W * 3).copy(raw, y * stride + 1); }
  const crc = b => { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const dd = Buffer.concat([Buffer.from(ty), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(dd)); return Buffer.concat([l, dd, cr]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  writeFileSync('tools/snapshots/kit-modern.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  console.log(`modern square: ${tris} triangles -> tools/snapshots/kit-modern.png`);
}
function raster(buf, zb, A, B, C, uvs, td, tw, th, light, col) {
  const sx = v => (v.x * 0.5 + 0.5) * W, sy = v => (1 - (v.y * 0.5 + 0.5)) * H;
  const ax = sx(A), ay = sy(A), bx = sx(B), by = sy(B), cx = sx(C), cy = sy(C);
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (Math.abs(area) < 1e-9) return; const inv = 1 / area;
  const cr = col ? col.r * 255 : 200, cg = col ? col.g * 255 : 200, cbl = col ? col.b * 255 : 200;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * inv, w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * inv, w2 = 1 - w0 - w1;
    if (w0 < 0 || w1 < 0 || w2 < 0) continue;
    const z = w0 * A.z + w1 * B.z + w2 * C.z, k = y * W + x; if (z >= zb[k]) continue; zb[k] = z;
    let r = cr, g = cg, b = cbl;
    if (td && uvs) { let uu = w0 * uvs[0] + w1 * uvs[2] + w2 * uvs[4], vv = w0 * uvs[1] + w1 * uvs[3] + w2 * uvs[5]; uu -= Math.floor(uu); vv -= Math.floor(vv); const txp = Math.min(tw - 1, uu * tw | 0), typ = Math.min(th - 1, vv * th | 0), ti = (typ * tw + txp) * 4; r = td[ti]; g = td[ti + 1]; b = td[ti + 2]; }
    const i = k * 3; buf[i] = Math.min(255, r * light); buf[i + 1] = Math.min(255, g * light); buf[i + 2] = Math.min(255, b * light);
  }
}
