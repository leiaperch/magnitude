/* MAGNITUDE — a headless look at the ages diorama.
 *
 * Builds an era's real Three.js scene and rasterises it through the exact same
 * orthographic camera the page uses, with flat Lambert shading, into a PNG.
 * No browser, no native GL: it is a tiny software renderer plus Node's own zlib.
 * The point is a feedback loop — so the town can be looked at, not guessed at.
 *
 *   node tools/snapshot.mjs 1300 1900 2050      # eras, or "all"
 *   -> tools/snapshots/ages-1300.png ...
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';
import * as THREE from '../assets/vendor/three.module.js';
import { buildEra } from '../assets/js/modes/town3d.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const W = 900, H = Math.round(W * 9 / 16);

/* camera, identical to ages.js */
const ELEV = 20 * Math.PI / 180, DIST = 100;
const TARGET = new THREE.Vector3(4.5, 1.5, 4.5);
const VIEW_W = 32, VIEW_H = 19;
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
cam.position.copy(TARGET).add(new THREE.Vector3(1, Math.SQRT2 * Math.tan(ELEV), 1).normalize().multiplyScalar(DIST));
cam.lookAt(TARGET);
{
  const a = W / H;
  let vw = VIEW_W, vh = VIEW_W / a;
  if (vh < VIEW_H) { vh = VIEW_H; vw = VIEW_H * a; }
  cam.left = -vw / 2; cam.right = vw / 2; cam.top = vh / 2; cam.bottom = -vh / 2;
}
cam.updateMatrixWorld(true);
cam.updateProjectionMatrix();
const VP = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);

/* light, matching ages.js: one sun, a hemisphere fill, and a day→night dim */
const SUN = new THREE.Vector3(-24, 34, 16).normalize();
const SKY_H = new THREE.Color(0xdfeaf0);

/* the per-triangle light term: sun (directional, warm→cool at night) plus a
 * hemisphere fill. Returned per channel so a per-pixel texel can modulate it. */
function lightOf(nx, ny, nz, hill, night) {
  const sunI = 1.5 - night * 1.32, hemiI = 0.7 - night * 0.38;
  const sc = new THREE.Color(0xfff2dd).lerp(new THREE.Color(0x9fb4e0), night);
  const s = Math.max(0, nx * SUN.x + ny * SUN.y + nz * SUN.z) * sunI;
  const hw = 0.5 * (ny + 1);
  const hi = [hill.r, hill.g, hill.b], sk = [SKY_H.r, SKY_H.g, SKY_H.b], scc = [sc.r, sc.g, sc.b];
  return [0, 1, 2].map(k => s * scc[k] + (hi[k] + (sk[k] - hi[k]) * hw) * hemiI);
}
const GAMMA = 1 / 2.2;

function render(era) {
  const built = buildEra(era);
  built.group.updateMatrixWorld(true);
  const hill = new THREE.Color(era.hill);
  const night = era.night || 0;
  const NOEM = new THREE.Color(0, 0, 0);

  const buf = new Uint8Array(W * H * 3);
  const zb = new Float32Array(W * H).fill(Infinity);

  /* sky gradient behind everything */
  const top = new THREE.Color(era.sky[0]), bot = new THREE.Color(era.sky[1]);
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const r = (top.r + (bot.r - top.r) * t) * 255;
    const g = (top.g + (bot.g - top.g) * t) * 255;
    const b = (top.b + (bot.b - top.b) * t) * 255;
    for (let x = 0; x < W; x++) { const i = (y * W + x) * 3; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; }
  }

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const wa = new THREE.Vector3(), wb = new THREE.Vector3(), wc = new THREE.Vector3();
  let tris = 0;

  built.group.traverse(m => {
    if (!m.isMesh || !m.geometry.attributes.position) return;
    const pos = m.geometry.attributes.position;
    const uv = m.geometry.attributes.uv;
    const idx = m.geometry.index;
    const col = m.material.color || new THREE.Color(0xffffff);
    const em = m.material.emissive || NOEM;
    const map = m.material.map || null;
    const tex = map ? { d: map.image.data, w: map.image.width, h: map.image.height, rx: map.repeat.x, ry: map.repeat.y } : null;
    const count = idx ? idx.count : pos.count;
    for (let t = 0; t < count; t += 3) {
      const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
      wa.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld);
      wb.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld);
      wc.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
      const ux = wb.x - wa.x, uy = wb.y - wa.y, uz = wb.z - wa.z;
      const vx = wc.x - wa.x, vy = wc.y - wa.y, vz = wc.z - wa.z;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const light = lightOf(nx, ny, nz, hill, night);
      const uvs = uv ? [uv.getX(i0), uv.getY(i0), uv.getX(i1), uv.getY(i1), uv.getX(i2), uv.getY(i2)] : null;

      a.copy(wa).applyMatrix4(VP); b.copy(wb).applyMatrix4(VP); c.copy(wc).applyMatrix4(VP);
      raster(buf, zb, a, b, c, col, em, light, tex, uvs);
      tris++;
    }
  });

  built.dispose();
  return { buf, tris };
}

/* screen-space triangle fill with a z-buffer, texture and flat light */
function raster(buf, zb, A, B, C, col, em, light, tex, uvs) {
  const sx = v => (v.x * 0.5 + 0.5) * W, sy = v => (1 - (v.y * 0.5 + 0.5)) * H;
  const ax = sx(A), ay = sy(A), bx = sx(B), by = sy(B), cx = sx(C), cy = sy(C);
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-6) return;
  const inv = 1 / area;
  const cr = col.r, cg = col.g, cb = col.b, er = em.r, eg = em.g, eb = em.b;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * inv;
      const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * inv;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * A.z + w1 * B.z + w2 * C.z;
      const k = y * W + x;
      if (z >= zb[k]) continue;
      zb[k] = z;
      let tr = 1, tg = 1, tb = 1;
      if (tex) {                                        // nearest-sample the tiled map
        let uu = (w0 * uvs[0] + w1 * uvs[2] + w2 * uvs[4]) * tex.rx;
        let vv = (w0 * uvs[1] + w1 * uvs[3] + w2 * uvs[5]) * tex.ry;
        uu -= Math.floor(uu); vv -= Math.floor(vv);
        const tx = Math.min(tex.w - 1, uu * tex.w | 0), ty = Math.min(tex.h - 1, (1 - vv) * tex.h | 0);
        const ti = (ty * tex.w + tx) * 4;
        tr = tex.d[ti] / 255; tg = tex.d[ti + 1] / 255; tb = tex.d[ti + 2] / 255;
      }
      const i = k * 3;
      buf[i] = 255 * Math.pow(Math.min(1, cr * tr * light[0] + er), GAMMA);
      buf[i + 1] = 255 * Math.pow(Math.min(1, cg * tg * light[1] + eg), GAMMA);
      buf[i + 2] = 255 * Math.pow(Math.min(1, cb * tb * light[2] + eb), GAMMA);
    }
  }
}

/* minimal RGB PNG via Node zlib */
function png(buf) {
  const stride = W * 3 + 1;
  const raw = Buffer.alloc(stride * H);
  for (let y = 0; y < H; y++) {
    raw[y * stride] = 0;                                        // filter: none
    buf.copy(raw, y * stride + 1, y * W * 3, y * W * 3 + W * 3);
  }
  const crc = (b) => { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cr]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;   // 8-bit RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------------ */
const ages = JSON.parse(readFileSync(join(root, 'assets/data/ages.json'), 'utf8'));
let want = process.argv.slice(2);
if (want.length === 0) want = ['1000', '1300', '1500', '1900', '2050'];
if (want[0] === 'all') want = ages.eras.map(e => String(e.year));

mkdirSync(join(root, 'tools/snapshots'), { recursive: true });
for (const y of want) {
  const era = ages.eras.find(e => String(e.year) === y);
  if (!era) { console.log('  ? no era ' + y); continue; }
  const { buf, tris } = render(era);
  const out = join(root, 'tools/snapshots', `ages-${y}.png`);
  writeFileSync(out, png(Buffer.from(buf.buffer)));
  console.log(`  ${y}: ${tris} triangles -> tools/snapshots/ages-${y}.png`);
}
