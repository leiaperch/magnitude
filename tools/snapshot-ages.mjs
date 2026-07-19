/* Render any ages era from the shared townkit, headless, through the real
 * ages camera. node tools/snapshot-ages.mjs 1300 1900 2050   (years, or "all")
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import * as THREE from '../assets/vendor/three.module.js';
import { loadGLB } from './glb-node.mjs';
import { buildEra } from '../assets/js/modes/townkit.js';

const W = 1200, H = 675;
const ELEV = 30 * Math.PI / 180;
const TARGET = new THREE.Vector3(0.5, 1.4, 0.5);
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
cam.position.copy(TARGET).add(new THREE.Vector3(1, Math.SQRT2 * Math.tan(ELEV), 1).normalize().multiplyScalar(140));
cam.lookAt(TARGET);
const vw = 24, vh = vw * H / W;
cam.left = -vw / 2; cam.right = vw / 2; cam.top = vh / 2; cam.bottom = -vh / 2;
cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
const VP = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
const SUN = new THREE.Vector3(-22, 34, 18).normalize();

const bbox = new Map();
function makeScene(era) {
  const scene = new THREE.Group();
  const rng = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)((era.year * 2654435761) >>> 0);
  const place = (name, x, z, o = {}) => {
    const { geometry, texture } = loadGLB(`assets/models/${name}.glb`);
    if (!bbox.has(name)) { geometry.computeBoundingBox(); bbox.set(name, geometry.boundingBox.clone()); }
    const bb = bbox.get(name), s = o.s || 1;
    const m = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    m.userData.tex = texture; m.scale.setScalar(s);
    m.position.set(x, (o.y || 0) - bb.min.y * s, z); m.rotation.y = o.rot || 0;
    scene.add(m); return m;
  };
  const CLOTH = [0x3f4a5a, 0x6b3a3a, 0x4a5a3a, 0x5a4a6b, 0x2f3136, 0x7a6a4a];
  const person = (x, z) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.4, 3, 6), new THREE.MeshBasicMaterial({ color: CLOTH[Math.floor(rng() * CLOTH.length)] })); b.position.y = 0.4; g.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe8bd96 })); h.position.y = 0.82; g.add(h);
    g.position.set(x, 0, z); scene.add(g);
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ color: era.night ? 0x2a2e38 : 0xbdb7ab }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  buildEra(era, { place, rng, person });
  scene.updateMatrixWorld(true);
  return scene;
}

function render(scene, era) {
  const buf = new Uint8Array(W * H * 3);
  const top = era.night ? [10, 14, 34] : [176, 190, 205], bot = era.night ? [34, 26, 66] : [224, 224, 218];
  for (let y = 0; y < H; y++) { const t = y / H; for (let x = 0; x < W; x++) { const i = (y * W + x) * 3; buf[i] = top[0] + (bot[0] - top[0]) * t; buf[i + 1] = top[1] + (bot[1] - top[1]) * t; buf[i + 2] = top[2] + (bot[2] - top[2]) * t; } }
  const zb = new Float32Array(W * H).fill(Infinity);
  const P = new THREE.Vector3(), Q = new THREE.Vector3(), R = new THREE.Vector3(), wa = new THREE.Vector3(), wb = new THREE.Vector3(), wc = new THREE.Vector3();
  const night = era.night || 0, amb = 0.5 - night * 0.28, sunI = 0.85 - night * 0.7;
  let tris = 0;
  scene.traverse(m => {
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position, uv = m.geometry.attributes.uv, idx = m.geometry.index;
    const tex = m.userData.tex, td = tex && tex.image.data, tw = tex && tex.image.width, th = tex && tex.image.height, col = m.material.color;
    const count = idx ? idx.count : pos.count;
    for (let t = 0; t < count; t += 3) {
      const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
      wa.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld); wb.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld); wc.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
      const ux = wb.x - wa.x, uy = wb.y - wa.y, uz = wb.z - wa.z, vx = wc.x - wa.x, vy = wc.y - wa.y, vz = wc.z - wa.z;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const light = Math.max(0, nx * SUN.x + ny * SUN.y + nz * SUN.z) * sunI + amb;
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
  writeFileSync(`tools/snapshots/ages-${era.year}.png`, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  return tris;
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

const ages = JSON.parse(readFileSync('assets/data/ages.json', 'utf8'));
let want = process.argv.slice(2);
if (!want.length) want = ['1300', '1850', '2000', '2050'];
if (want[0] === 'all') want = ages.eras.map(e => String(e.year));
for (const y of want) {
  const era = ages.eras.find(e => String(e.year) === y);
  if (!era) { console.log('  ? no era', y); continue; }
  const tris = render(makeScene(era), era);
  console.log(`  ${y}: ${tris} triangles -> tools/snapshots/ages-${y}.png`);
}
