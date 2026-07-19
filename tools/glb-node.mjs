/* A tiny headless glTF/GLB reader for the snapshot renderer.
 *
 * The browser loads Kenney models with the real GLTFLoader; this exists only so
 * the offline snapshot can see the same models — it parses a GLB into a
 * BufferGeometry and decodes the external colormap PNG into a DataTexture, using
 * nothing but Node's zlib. Kenney models are one mesh, one shared palette.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { inflateSync } from 'node:zlib';
import * as THREE from '../assets/vendor/three.module.js';

/* ------------------------------------------------------------- PNG decode */
function decodePNG(buf) {
  let p = 8;
  let w = 0, h = 0, bit = 8, ctype = 6, palette = null, trns = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8); p += 8;
    const d = buf.subarray(p, p + len); p += len + 4;
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bit = d[8]; ctype = d[9]; }
    else if (type === 'PLTE') palette = d;
    else if (type === 'tRNS') trns = d;
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const chan = ctype === 6 ? 4 : ctype === 2 ? 3 : ctype === 0 ? 1 : 1;   // 3=palette→1
  const bpp = Math.max(1, chan * bit / 8);
  const stride = w * bpp;
  const un = Buffer.alloc(h * stride);
  const paeth = (a, b, c) => { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  let sp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[sp++];
    for (let i = 0; i < stride; i++) {
      const x = raw[sp++];
      const a = i >= bpp ? un[y * stride + i - bpp] : 0;
      const b = y > 0 ? un[(y - 1) * stride + i] : 0;
      const c = (y > 0 && i >= bpp) ? un[(y - 1) * stride + i - bpp] : 0;
      let v = x;
      if (f === 1) v = x + a; else if (f === 2) v = x + b;
      else if (f === 3) v = x + ((a + b) >> 1); else if (f === 4) v = x + paeth(a, b, c);
      un[y * stride + i] = v & 255;
    }
  }
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, bl, al = 255;
    if (ctype === 3) { const idx = un[i]; r = palette[idx * 3]; g = palette[idx * 3 + 1]; bl = palette[idx * 3 + 2]; if (trns && idx < trns.length) al = trns[idx]; }
    else if (ctype === 2) { r = un[i * 3]; g = un[i * 3 + 1]; bl = un[i * 3 + 2]; }
    else if (ctype === 0) { r = g = bl = un[i]; }
    else { r = un[i * 4]; g = un[i * 4 + 1]; bl = un[i * 4 + 2]; al = un[i * 4 + 3]; }
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = bl; out[i * 4 + 3] = al;
  }
  return { width: w, height: h, data: out };
}

const texCache = new Map();
function loadTexture(pngPath) {
  if (texCache.has(pngPath)) return texCache.get(pngPath);
  const img = decodePNG(readFileSync(pngPath));
  const tex = new THREE.DataTexture(img.data, img.width, img.height, THREE.RGBAFormat);
  tex.flipY = true;                          // glTF UVs assume a flipped image
  tex.needsUpdate = true;
  texCache.set(pngPath, tex);
  return tex;
}

/* ------------------------------------------------------------- GLB parse */
const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

const glbCache = new Map();
export function loadGLB(path) {
  if (glbCache.has(path)) return glbCache.get(path);
  const buf = readFileSync(path);
  const len = buf.readUInt32LE(8);
  let off = 12, json = null, bin = null;
  while (off < len) {
    const clen = buf.readUInt32LE(off), ctype = buf.readUInt32LE(off + 4); off += 8;
    if (ctype === 0x4E4F534A) json = JSON.parse(buf.toString('utf8', off, off + clen));
    else if (ctype === 0x004E4942) bin = buf.subarray(off, off + clen);
    off += clen;
  }
  const accessor = i => {
    const a = json.accessors[i], bv = json.bufferViews[a.bufferView];
    const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const T = CT[a.componentType], comps = NUM[a.type];
    return new T(bin.buffer, bin.byteOffset + base, a.count * comps);
  };
  const prim = json.meshes[0].primitives[0];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(accessor(prim.attributes.POSITION)), 3));
  if (prim.attributes.NORMAL) geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(accessor(prim.attributes.NORMAL)), 3));
  if (prim.attributes.TEXCOORD_0) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(accessor(prim.attributes.TEXCOORD_0)), 2));
  if (prim.indices != null) geo.setIndex(new THREE.BufferAttribute(new Uint32Array(accessor(prim.indices)), 1));

  let tex = null;
  const img = json.images && json.images[0];
  if (img && img.uri) tex = loadTexture(join(dirname(path), decodeURIComponent(img.uri)));
  const out = { geometry: geo, texture: tex };
  glbCache.set(path, out);
  return out;
}
