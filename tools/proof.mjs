/* Proof that the Kenney pipeline renders headless: load real GLBs, place a row,
 * rasterise through the ages camera with the colormap sampled. node tools/proof.mjs */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import * as THREE from '../assets/vendor/three.module.js';
import { loadGLB } from './glb-node.mjs';

const W = 900, H = 506;
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
const ELEV = 25 * Math.PI / 180;
const TARGET = new THREE.Vector3(0, 0.4, 0);
cam.position.copy(TARGET).add(new THREE.Vector3(1, Math.SQRT2 * Math.tan(ELEV), 1).normalize().multiplyScalar(100));
cam.lookAt(TARGET);
const VIEW_W = 9, a = W / H, vw = VIEW_W, vh = VIEW_W / a;
cam.left = -vw / 2; cam.right = vw / 2; cam.top = vh / 2; cam.bottom = -vh / 2;
cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
const VP = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
const SUN = new THREE.Vector3(-24, 34, 16).normalize();

const scene = new THREE.Group();
const models = ['castle/tower-square-mid-windows', 'modular/building-sample-house-a', 'commercial/building-c',
  'food/apple', 'survival/tree', 'graveyard/lightpost-single', 'prototype/animal-horse', 'industrial/chimney-large'];
let ox = -3.6;
for (const name of models) {
  const { geometry, texture } = loadGLB(`assets/models/${name}.glb`);
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox, sz = new THREE.Vector3(); bb.getSize(sz);
  const s = 1.3 / Math.max(sz.x, sz.z, 0.6);                 // normalise footprint
  const m = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  m.userData.tex = texture;
  m.scale.setScalar(s);
  m.position.set(ox, -bb.min.y * s, 0);
  scene.add(m);
  ox += 1.15;
}
scene.updateMatrixWorld(true);

const buf = new Uint8Array(W * H * 3).fill(210);
const zb = new Float32Array(W * H).fill(Infinity);
const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
const wa = new THREE.Vector3(), wb = new THREE.Vector3(), wc = new THREE.Vector3();
let tris = 0;
scene.traverse(m => {
  if (!m.isMesh) return;
  const pos = m.geometry.attributes.position, uv = m.geometry.attributes.uv, idx = m.geometry.index;
  const tex = m.userData.tex, td = tex && tex.image.data, tw = tex && tex.image.width, th = tex && tex.image.height;
  const count = idx ? idx.count : pos.count;
  for (let t = 0; t < count; t += 3) {
    const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
    wa.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld);
    wb.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld);
    wc.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
    const ux = wb.x - wa.x, uy = wb.y - wa.y, uz = wb.z - wa.z, vx = wc.x - wa.x, vy = wc.y - wa.y, vz = wc.z - wa.z;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const light = Math.max(0, nx * SUN.x + ny * SUN.y + nz * SUN.z) * 0.9 + 0.5;
    A.copy(wa).applyMatrix4(VP); B.copy(wb).applyMatrix4(VP); C.copy(wc).applyMatrix4(VP);
    const uvs = uv ? [uv.getX(i0), uv.getY(i0), uv.getX(i1), uv.getY(i1), uv.getX(i2), uv.getY(i2)] : null;
    raster(A, B, C, uvs, td, tw, th, light);
    tris++;
  }
});

function raster(A, B, C, uvs, td, tw, th, light) {
  const sx = v => (v.x * 0.5 + 0.5) * W, sy = v => (1 - (v.y * 0.5 + 0.5)) * H;
  const ax = sx(A), ay = sy(A), bx = sx(B), by = sy(B), cx = sx(C), cy = sy(C);
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (Math.abs(area) < 1e-9) return;
  const inv = 1 / area;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * inv;
    const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * inv;
    const w2 = 1 - w0 - w1;
    if (w0 < 0 || w1 < 0 || w2 < 0) continue;
    const z = w0 * A.z + w1 * B.z + w2 * C.z, k = y * W + x;
    if (z >= zb[k]) continue; zb[k] = z;
    let r = 200, g = 200, b = 200;
    if (td && uvs) {
      let uu = w0 * uvs[0] + w1 * uvs[2] + w2 * uvs[4], vv = w0 * uvs[1] + w1 * uvs[3] + w2 * uvs[5];
      uu -= Math.floor(uu); vv -= Math.floor(vv);
      const tx = Math.min(tw - 1, uu * tw | 0), ty = Math.min(th - 1, vv * th | 0), ti = (ty * tw + tx) * 4;
      r = td[ti]; g = td[ti + 1]; b = td[ti + 2];
    }
    const i = k * 3;
    buf[i] = Math.min(255, r * light); buf[i + 1] = Math.min(255, g * light); buf[i + 2] = Math.min(255, b * light);
  }
}

/* PNG */
const stride = W * 3 + 1, raw = Buffer.alloc(stride * H);
for (let y = 0; y < H; y++) { raw[y * stride] = 0; Buffer.from(buf.buffer, y * W * 3, W * 3).copy(raw, y * stride + 1); }
const crc = b => { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
writeFileSync('tools/snapshots/proof.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`${models.length} Kenney models, ${tris} triangles -> tools/snapshots/proof.png`);
