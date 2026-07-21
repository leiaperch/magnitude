/* MAGNITUDE — the ages town, generated in three.js.
 *
 * No external models. The town is a fixed, hand-authored composition — the same
 * lots and the same square every load — and each era only restyles and ages the
 * buildings that already stand there. Geometry is merged per material into a
 * handful of meshes, walls and roofs carry real PBR textures (canvas-generated
 * brick / plaster / stone / timber / tile / slate / thatch, each with a matching
 * normal map), and everything is lit by a sun plus a PMREM sky environment.
 *
 * Local convention for every generator: built at the origin, front facing +Z,
 * feet on y = 0; the caller places and turns it through the matrix stack.
 */

import * as THREE from '../../vendor/three.module.js';

/* ------------------------------------------------------------------ palette */
const _lin = new Map();
function C(hex) {
  let v = _lin.get(hex);
  if (!v) { const c = new THREE.Color(hex); v = [c.r, c.g, c.b]; _lin.set(hex, v); }
  return v;
}
function shade(hex, k) {
  const c = new THREE.Color(hex);
  return [Math.min(1, c.r * k), Math.min(1, c.g * k), Math.min(1, c.b * k)];
}
const WHITE = [1, 1, 1];
const jit = rng => { const k = 0.95 + rng() * 0.1; return [k, k, k]; };   // gentle per-house brightness, not scatter

const ROOF = { thatch: 'thatch', tile: 'tile', slate: 'slate', flat: 'flat', solar: 'flat' };
const WARM = '#ffcf8a', NEONS = ['#ff5db1', '#43e0ff', '#b98cff', '#ffd23f', '#4dff9e'];

/* ---------------------------------------------------------- PBR textures */
/* Each material is a tileable albedo canvas plus a height canvas turned into a
 * normal map by Sobel. Grey vertex colours only nudge brightness, so the map
 * carries the real colour. Built once, shared by every era. */
function canv(size) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }
function noise(x, s, a) { x.globalAlpha = a; for (let i = 0; i < 1200; i++) { const v = 120 + Math.random() * 120 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * s, Math.random() * s, 1.5, 1.5); } x.globalAlpha = 1; }

const TEXDRAW = {
  brick(a, h, s) {
    a.fillStyle = '#8f8578'; a.fillRect(0, 0, s, s); h.fillStyle = '#606060'; h.fillRect(0, 0, s, s);   // mortar
    const rows = 8, bh = s / rows, bw = s / 4;
    const cols = ['#9c4630', '#a5533a', '#8f3f2c', '#ab5c40', '#933f2e'];
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bw / 2;
      for (let c = -1; c < 5; c++) {
        const x = c * bw + off + 2, y = r * bh + 2, w = bw - 3, hh = bh - 3;
        a.fillStyle = cols[(r * 3 + c * 7 + 40) % cols.length]; a.fillRect(x, y, w, hh);
        h.fillStyle = '#d8d8d8'; h.fillRect(x, y, w, hh);
        h.fillStyle = '#f4f4f4'; h.fillRect(x + 1, y + 1, w - 3, hh - 4);
      }
    }
  },
  stone(a, h, s) {
    a.fillStyle = '#b3a98f'; a.fillRect(0, 0, s, s); h.fillStyle = '#585858'; h.fillRect(0, 0, s, s);
    const rows = 4, bh = s / rows;
    const cols = ['#cfc6ac', '#c6bca0', '#d4cbb2', '#bfb69c'];
    for (let r = 0; r < rows; r++) {
      const bw = s / (3 + (r % 2)), off = (r % 2) * bw / 2;
      for (let c = -1; c < 5; c++) {
        const x = c * bw + off + 2, y = r * bh + 2, w = bw - 4, hh = bh - 4;
        a.fillStyle = cols[(r + c + 8) % cols.length]; a.fillRect(x, y, w, hh);
        h.fillStyle = '#e6e6e6'; h.fillRect(x, y, w, hh);
      }
    }
    noise(a, s, 0.05);
  },
  plaster(a, h, s) { a.fillStyle = '#d3c8ac'; a.fillRect(0, 0, s, s); h.fillStyle = '#808080'; h.fillRect(0, 0, s, s); noise(a, s, 0.14); noise(h, s, 0.20); },
  render(a, h, s) { a.fillStyle = '#cbab7c'; a.fillRect(0, 0, s, s); h.fillStyle = '#888'; h.fillRect(0, 0, s, s); noise(a, s, 0.08); },
  concrete(a, h, s) {
    a.fillStyle = '#bdb9ad'; a.fillRect(0, 0, s, s); h.fillStyle = '#808080'; h.fillRect(0, 0, s, s);
    noise(a, s, 0.08); a.strokeStyle = 'rgba(90,90,85,0.4)'; a.lineWidth = 1;
    for (let i = 1; i < 4; i++) { a.beginPath(); a.moveTo(0, i * s / 4); a.lineTo(s, i * s / 4); a.stroke(); }
  },
  wood(a, h, s) {
    a.fillStyle = '#6b4f34'; a.fillRect(0, 0, s, s); h.fillStyle = '#909090'; h.fillRect(0, 0, s, s);
    const planks = 6, pw = s / planks;
    for (let p = 0; p < planks; p++) {
      const g = 90 + (p * 37 % 40);
      a.fillStyle = `rgb(${100 + g % 30},${74 + g % 20},${48 + g % 16})`; a.fillRect(p * pw + 1, 0, pw - 2, s);
      h.fillStyle = '#5a5a5a'; h.fillRect(p * pw, 0, 1.5, s); h.fillStyle = '#c8c8c8'; h.fillRect(p * pw + 2, 0, pw - 4, s);
      a.strokeStyle = 'rgba(50,34,20,0.25)'; a.lineWidth = 1;
      for (let g2 = 0; g2 < 4; g2++) { a.beginPath(); a.moveTo(p * pw + 2 + g2 * pw / 4, 0); a.lineTo(p * pw + 4 + g2 * pw / 4, s); a.stroke(); }
    }
  },
  tile(a, h, s) {
    a.fillStyle = '#8f3f28'; a.fillRect(0, 0, s, s); h.fillStyle = '#606060'; h.fillRect(0, 0, s, s);
    const rows = 7, rh = s / rows, cw = s / 8;
    const cols = ['#b1553b', '#a54c34', '#bd603f', '#9c4630'];
    for (let r = 0; r < rows; r++) for (let c = 0; c < 9; c++) {
      const off = (r % 2) * cw / 2, x = c * cw + off - cw / 2, y = r * rh;
      a.fillStyle = cols[(r + c) % cols.length];
      a.beginPath(); a.moveTo(x, y + rh); a.lineTo(x, y + rh * 0.4); a.arc(x + cw / 2, y + rh * 0.4, cw / 2, Math.PI, 0); a.lineTo(x + cw, y + rh); a.closePath(); a.fill();
      h.fillStyle = '#e8e8e8'; h.beginPath(); h.arc(x + cw / 2, y + rh * 0.55, cw * 0.42, 0, 7); h.fill();
      h.fillStyle = 'rgba(40,40,40,0.6)'; h.fillRect(x, y + rh - 2, cw, 2);
    }
  },
  slate(a, h, s) {
    a.fillStyle = '#3a444e'; a.fillRect(0, 0, s, s); h.fillStyle = '#606060'; h.fillRect(0, 0, s, s);
    const rows = 9, rh = s / rows, cw = s / 6;
    const cols = ['#4b5560', '#434d58', '#525d68', '#3f4952'];
    for (let r = 0; r < rows; r++) for (let c = -1; c < 7; c++) {
      const off = (r % 2) * cw / 2, x = c * cw + off, y = r * rh;
      a.fillStyle = cols[(r * 2 + c) % cols.length]; a.fillRect(x + 1, y, cw - 2, rh * 1.4);
      h.fillStyle = '#cfcfcf'; h.fillRect(x + 1, y, cw - 2, rh * 1.2); h.fillStyle = '#4a4a4a'; h.fillRect(x, y + rh - 1, cw, 2);
    }
  },
  thatch(a, h, s) {
    a.fillStyle = '#a68a4c'; a.fillRect(0, 0, s, s); h.fillStyle = '#808080'; h.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * s, y = Math.random() * s, len = 6 + Math.random() * 10, g = 150 + Math.random() * 80 | 0;
      a.strokeStyle = `rgb(${g},${g - 30},${g - 90})`; a.lineWidth = 1; a.beginPath(); a.moveTo(x, y); a.lineTo(x + (Math.random() - 0.5) * 3, y + len); a.stroke();
      h.strokeStyle = `rgb(${140 + Math.random() * 100 | 0},${140},${140})`; h.beginPath(); h.moveTo(x, y); h.lineTo(x, y + len); h.stroke();
    }
  },
  cobble(a, h, s) {
    a.fillStyle = '#867d6e'; a.fillRect(0, 0, s, s); h.fillStyle = '#404040'; h.fillRect(0, 0, s, s);
    const g = 7, cs = s / g;
    for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) {
      const cx = (i + 0.5) * cs + (Math.random() - 0.5) * cs * 0.3, cy = (j + 0.5) * cs + (Math.random() - 0.5) * cs * 0.3, r = cs * (0.34 + Math.random() * 0.1);
      const v = 150 + Math.random() * 40 | 0; a.fillStyle = `rgb(${v},${v - 8},${v - 22})`; a.beginPath(); a.arc(cx, cy, r, 0, 7); a.fill();
      h.fillStyle = '#d8d8d8'; h.beginPath(); h.arc(cx, cy, r * 0.9, 0, 7); h.fill();
    }
  },
};

function heightToNormal(hc, strength) {
  const s = hc.width, sx = hc.getContext('2d'), src = sx.getImageData(0, 0, s, s).data;
  const out = canv(s), ox = out.getContext('2d'), img = ox.createImageData(s, s), d = img.data;
  const at = (x, y) => src[((y & s - 1) * s + (x & s - 1)) * 4];
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) / 255 * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) / 255 * strength;
    let nx = -dx, ny = -dy, nz = 1, l = Math.hypot(nx, ny, nz);
    const i = (y * s + x) * 4;
    d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (nz / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ox.putImageData(img, 0, 0); return out;
}

/* Build the shared material set (textures, env map). Called once. */
export function makeMaterials(renderer) {
  const S = 256, aniso = renderer.capabilities.getMaxAnisotropy();
  const rough = { brick: .95, stone: .92, plaster: .96, render: .9, concrete: .94, wood: .9, tile: .85, slate: .8, thatch: 1, cobble: .97 };
  const nstr = { brick: 2.2, stone: 1.6, plaster: .5, render: .4, concrete: .6, wood: 1.1, tile: 2.4, slate: 1.4, thatch: 1.3, cobble: 2.6 };
  const mats = {};
  for (const k of Object.keys(TEXDRAW)) {
    const ac = canv(S), hc = canv(S); TEXDRAW[k](ac.getContext('2d'), hc.getContext('2d'), S);
    const map = new THREE.CanvasTexture(ac); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = aniso;
    const nrm = new THREE.CanvasTexture(heightToNormal(hc, nstr[k])); nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping; nrm.anisotropy = aniso;
    mats[k] = new THREE.MeshStandardMaterial({ map, normalMap: nrm, normalScale: new THREE.Vector2(1, 1), roughness: rough[k], metalness: 0, envMapIntensity: 0.45, vertexColors: true, side: THREE.DoubleSide });
  }
  mats.flat = new THREE.MeshStandardMaterial({ color: 0x8b887f, roughness: .9, metalness: 0, vertexColors: true, side: THREE.DoubleSide });
  mats.glass = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .12, metalness: .1, envMapIntensity: 1.1, vertexColors: true, side: THREE.DoubleSide });
  mats.solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  mats.glow = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });

  /* soft sky environment for grounded PBR + glass reflections */
  const ec = canv(128), ex = ec.getContext('2d'), g = ex.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#8fb6d8'); g.addColorStop(0.5, '#dbe7ec'); g.addColorStop(0.52, '#b9b3a6'); g.addColorStop(1, '#6f6a5e');
  ex.fillStyle = g; ex.fillRect(0, 0, 128, 128);
  const skyTex = new THREE.CanvasTexture(ec); skyTex.mapping = THREE.EquirectangularReflectionMapping; skyTex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer); const env = pmrem.fromEquirectangular(skyTex).texture; skyTex.dispose(); pmrem.dispose();
  mats.env = env;

  /* shader injection. The textured walls/roofs get a soft world-height ambient
   * occlusion so they sit into the ground. The 'solid' bucket (people, foliage,
   * flags, smoke, drones) gets that AO plus vertex animation driven by a per-
   * vertex `anim` tag and a uTime uniform; the 'glow' bucket gets a neon shimmer
   * and the drone bob. onBeforeCompile keeps clipping/shadows/tonemapping. */
  for (const k of Object.keys(TEXDRAW)) groundAO(mats[k]);
  solidShader(mats.solid);
  glowShader(mats.glow);
  return mats;
}
const AO_FRAG = '#include <color_fragment>\n diffuseColor.rgb *= mix(0.6, 1.0, clamp(vWY/1.15, 0.0, 1.0));';
/* the vertex GLSL that reads the anim tag and displaces `transformed` */
const ANIM_VS = `
  { float at = anim.x, ph = anim.y;
    if (at > 0.5) {                                                                                                             // static geometry (at==0) is never touched
      if (at < 1.5) { transformed.y += abs(sin(uTime*4.0+ph))*0.05; transformed.x += sin(uTime*2.0+ph)*0.03; }                 // person idle
      else if (at < 2.5) { transformed.x += sin(uTime*3.0 + transformed.y*3.0 + ph)*0.09; transformed.z += cos(uTime*2.6+ph)*0.05; } // flag flutter
      else if (at < 3.5) { float t = fract(uTime*0.09 + ph); transformed.y += t*4.5; transformed.x += t*2.0; transformed.z += t*0.7; } // smoke rise
      else if (at < 4.5) { float f = clamp((transformed.y-0.8)*0.4,0.0,1.0); transformed.x += sin(uTime*1.2+ph+transformed.y)*0.06*f; transformed.z += cos(uTime*1.0+ph)*0.04*f; } // sway
      else if (at < 5.5) { transformed.y += sin(uTime*2.5+ph)*0.14; transformed.x += sin(uTime*0.8+ph)*0.22; transformed.z += cos(uTime*0.7+ph)*0.18; } // drone hover
      else { transformed.y += sin(uTime*5.0 + transformed.x*3.5 + transformed.z*3.5 + ph)*0.045; } // fountain water ripple
    } }`;
function groundAO(mat) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'varying float vWY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWY = (modelMatrix * vec4(transformed,1.0)).y;');
    sh.fragmentShader = 'varying float vWY;\n' + sh.fragmentShader.replace('#include <color_fragment>', AO_FRAG);
  };
  mat.customProgramCacheKey = () => 'groundAO';
}
function solidShader(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = { value: 0 };
    sh.vertexShader = 'attribute vec3 anim;\nuniform float uTime;\nvarying float vWY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + ANIM_VS + '\n vWY = (modelMatrix * vec4(transformed,1.0)).y;');
    sh.fragmentShader = 'varying float vWY;\n' + sh.fragmentShader.replace('#include <color_fragment>', AO_FRAG);
    mat.userData.shader = sh;
  };
  mat.customProgramCacheKey = () => 'solidAnim';
}
function glowShader(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = { value: 0 };
    sh.vertexShader = 'attribute vec3 anim;\nuniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n { float at = anim.x, ph = anim.y; if (at > 4.5 && at < 5.5) { transformed.y += sin(uTime*2.5+ph)*0.14; transformed.x += sin(uTime*0.8+ph)*0.22; transformed.z += cos(uTime*0.7+ph)*0.18; } }');
    sh.fragmentShader = 'uniform float uTime;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= 0.82 + 0.18*sin(uTime*7.0 + gl_FragCoord.x*0.05 + gl_FragCoord.y*0.03);');
    mat.userData.shader = sh;
  };
  mat.customProgramCacheKey = () => 'glowAnim';
}

/* per-material UV density (texture repeats every 1/uvk world units) */
const UVK = { brick: .5, stone: .5, plaster: .35, render: .35, concrete: .3, wood: .5, tile: .8, slate: .8, thatch: .45, flat: .3, glass: .5 };

/* ------------------------------------------------------------------ builder */
class Builder {
  constructor() {
    this.b = new Map();
    this.m = new THREE.Matrix4(); this.stack = [];
    this.animCur = [0, 0, 0];                                    // [type, phase, amp] tagged onto emitted verts
    this._a = new THREE.Vector3(); this._b2 = new THREE.Vector3(); this._c = new THREE.Vector3();
    this._n = new THREE.Vector3(); this._u = new THREE.Vector3(); this._v = new THREE.Vector3();
  }
  bucket(k) { let t = this.b.get(k); if (!t) { t = { pos: [], nor: [], uv: [], col: [], anim: [] }; this.b.set(k, t); } return t; }
  anim(type, phase, amp) { this.animCur = [type, phase, amp || 0]; return this; }   // set; call anim(0,0,0) to clear
  push(mat) { this.stack.push(this.m.clone()); this.m.multiply(mat); }
  pop() { this.m.copy(this.stack.pop()); }
  at(x, y, z, ry = 0, s = 1) {
    const mm = new THREE.Matrix4().makeTranslation(x, y, z);
    if (ry) mm.multiply(new THREE.Matrix4().makeRotationY(ry));
    if (s !== 1) mm.multiply(new THREE.Matrix4().makeScale(s, s, s));
    this.push(mm);
  }
  _t(k, ax, ay, az, bx, by, bz, cx, cy, cz, ua, va, ub, vb, uc, vc, color) {
    const t = this.bucket(k);
    this._a.set(ax, ay, az).applyMatrix4(this.m); this._b2.set(bx, by, bz).applyMatrix4(this.m); this._c.set(cx, cy, cz).applyMatrix4(this.m);
    this._u.subVectors(this._b2, this._a); this._v.subVectors(this._c, this._a); this._n.crossVectors(this._u, this._v).normalize();
    const P = t.pos, N = t.nor, U = t.uv, L = t.col, A = t.anim, m = this.animCur;
    P.push(this._a.x, this._a.y, this._a.z, this._b2.x, this._b2.y, this._b2.z, this._c.x, this._c.y, this._c.z);
    for (let i = 0; i < 3; i++) N.push(this._n.x, this._n.y, this._n.z);
    U.push(ua, va, ub, vb, uc, vc);
    for (let i = 0; i < 3; i++) { L.push(color[0], color[1], color[2]); A.push(m[0], m[1], m[2]); }
  }
  /* untextured (props/people/landmarks): bucket solid or glow, uv unused */
  tri(ax, ay, az, bx, by, bz, cx, cy, cz, color, glow) { this._t(glow ? 'glow' : 'solid', ax, ay, az, bx, by, bz, cx, cy, cz, 0, 0, 0, 0, 0, 0, color); }
  quad(a, b, c, d, color, glow) { this.tri(...a, ...b, ...c, color, glow); this.tri(...a, ...c, ...d, color, glow); }
  qUV(k, a, b, c, d, ta, tb, tc, td, color) { this._t(k, ...a, ...b, ...c, ...ta, ...tb, ...tc, color); this._t(k, ...a, ...c, ...d, ...ta, ...tc, ...td, color); }

  box(cx, baseY, cz, w, h, d, color, glow) {                    // untextured box
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = baseY, y1 = baseY + h, z0 = cz - d / 2, z1 = cz + d / 2;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color, glow);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color, glow);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color, glow);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color, glow);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], color, glow);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color, glow);
  }
  boxT(k, cx, baseY, cz, w, h, d, color) {                      // textured box, UVs from face size
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = baseY, y1 = baseY + h, z0 = cz - d / 2, z1 = cz + d / 2;
    const u = UVK[k] || 0.5, wu = w * u, hu = h * u, du = d * u;
    this.qUV(k, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0], [wu, 0], [wu, hu], [0, hu], color);   // +Z
    this.qUV(k, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0], [wu, 0], [wu, hu], [0, hu], color);   // -Z
    this.qUV(k, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [0, 0], [du, 0], [du, hu], [0, hu], color);   // +X
    this.qUV(k, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [0, 0], [du, 0], [du, hu], [0, hu], color);   // -X
    this.qUV(k, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 0], [wu, 0], [wu, du], [0, du], color);   // top
    this.qUV(k, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, 0], [wu, 0], [wu, du], [0, du], color);   // bottom
  }
  gable(cx, baseY, cz, w, h, d, color, glow) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, yr = baseY + h;
    this.quad([x0, baseY, z1], [x1, baseY, z1], [x1, yr, cz], [x0, yr, cz], color, glow);
    this.quad([x1, baseY, z0], [x0, baseY, z0], [x0, yr, cz], [x1, yr, cz], color, glow);
    this.tri(x0, baseY, z0, x0, baseY, z1, x0, yr, cz, color, glow);
    this.tri(x1, baseY, z1, x1, baseY, z0, x1, yr, cz, color, glow);
  }
  gableT(k, cx, baseY, cz, w, h, d, color) {                    // ridge along X, slopes face ±Z
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, yr = baseY + h;
    const u = UVK[k] || 0.7, sl = Math.hypot(h, d / 2), wu = w * u, su = sl * u;
    this.qUV(k, [x0, baseY, z1], [x1, baseY, z1], [x1, yr, cz], [x0, yr, cz], [0, 0], [wu, 0], [wu, su], [0, su], color);
    this.qUV(k, [x1, baseY, z0], [x0, baseY, z0], [x0, yr, cz], [x1, yr, cz], [0, 0], [wu, 0], [wu, su], [0, su], color);
    this._t(k, x0, baseY, z0, x0, baseY, z1, x0, yr, cz, 0, 0, d * u, 0, d * u / 2, h * u, color);
    this._t(k, x1, baseY, z1, x1, baseY, z0, x1, yr, cz, 0, 0, d * u, 0, d * u / 2, h * u, color);
  }
  gableZT(k, cx, baseY, cz, w, h, d, color) {                   // ridge along Z, gable faces ±Z
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, yr = baseY + h;
    const u = UVK[k] || 0.7, sl = Math.hypot(h, w / 2), du = d * u, su = sl * u;
    this.qUV(k, [x1, baseY, z0], [x1, baseY, z1], [cx, yr, z1], [cx, yr, z0], [0, 0], [du, 0], [du, su], [0, su], color);
    this.qUV(k, [x0, baseY, z1], [x0, baseY, z0], [cx, yr, z0], [cx, yr, z1], [0, 0], [du, 0], [du, su], [0, su], color);
    this._t(k, x0, baseY, z1, x1, baseY, z1, cx, yr, z1, 0, 0, w * u, 0, w * u / 2, h * u, color);
    this._t(k, x1, baseY, z0, x0, baseY, z0, cx, yr, z0, 0, 0, w * u, 0, w * u / 2, h * u, color);
  }
  pyramid(cx, baseY, cz, w, h, d, color, glow) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, ay = baseY + h;
    this.tri(x0, baseY, z1, x1, baseY, z1, cx, ay, cz, color, glow); this.tri(x1, baseY, z0, x0, baseY, z0, cx, ay, cz, color, glow);
    this.tri(x1, baseY, z1, x1, baseY, z0, cx, ay, cz, color, glow); this.tri(x0, baseY, z0, x0, baseY, z1, cx, ay, cz, color, glow);
  }
  cyl(cx, baseY, cz, r, h, sides, color, glow, r2) {
    const rt = r2 == null ? r : r2;
    for (let i = 0; i < sides; i++) {
      const a0 = i / sides * 6.2832, a1 = (i + 1) / sides * 6.2832;
      const x0 = cx + Math.cos(a0) * r, z0 = cz + Math.sin(a0) * r, x1 = cx + Math.cos(a1) * r, z1 = cz + Math.sin(a1) * r;
      const xt0 = cx + Math.cos(a0) * rt, zt0 = cz + Math.sin(a0) * rt, xt1 = cx + Math.cos(a1) * rt, zt1 = cz + Math.sin(a1) * rt;
      this.quad([x0, baseY, z0], [x1, baseY, z1], [xt1, baseY + h, zt1], [xt0, baseY + h, zt0], color, glow);
      this.tri(cx, baseY + h, cz, xt0, baseY + h, zt0, xt1, baseY + h, zt1, color, glow);
    }
  }
  cone(cx, baseY, cz, r, h, sides, color, glow) {
    for (let i = 0; i < sides; i++) { const a0 = i / sides * 6.2832, a1 = (i + 1) / sides * 6.2832; this.tri(cx + Math.cos(a0) * r, baseY, cz + Math.sin(a0) * r, cx + Math.cos(a1) * r, baseY, cz + Math.sin(a1) * r, cx, baseY + h, cz, color, glow); }
  }
  blob(cx, cy, cz, r, color, glow) {
    const p = [[0, r, 0], [0, -r, 0], [r, 0, 0], [-r, 0, 0], [0, 0, r], [0, 0, -r]];
    const f = [[0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]];
    for (const [i, j, k] of f) this.tri(cx + p[i][0], cy + p[i][1], cz + p[i][2], cx + p[j][0], cy + p[j][1], cz + p[j][2], cx + p[k][0], cy + p[k][1], cz + p[k][2], color, glow);
  }
  finish(mats) {
    const g = new THREE.Group();
    for (const [k, t] of this.b) {
      if (!t.pos.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(t.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(t.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(t.col, 3));
      geo.setAttribute('anim', new THREE.Float32BufferAttribute(t.anim, 3));
      const m = new THREE.Mesh(geo, mats[k] || mats.solid);
      m.castShadow = k !== 'glow'; m.receiveShadow = k !== 'glow';
      g.add(m);
    }
    return g;
  }
}

/* --------------------------------------------------------------- buildings */
const SHUTTER = ['#4a6a4a', '#3a5a7a', '#6a4a3a', '#5a6a5a'];
/* One terraced house, front facing +Z, feet on 0. Timber houses get a masonry
 * ground floor (no more white top-to-bottom plaster); commercial eras get a
 * glazed shopfront with an awning; roofs evolve thatch/tile/slate/mansard/green
 * and carry a row of dormers. lot = authored {gable, ds, chimney, dormer,...}. */
function house(B, w, spec, rng, night, lot) {
  const mat = spec.material;
  const storeys = Math.max(1, Math.min(lot.year <= 1150 ? 2 : 99, (spec.storeys || 2) + (lot.ds || 0)));   // village stays low
  const floorH = (mat === 'wood' ? 1.25 : 1.45);
  const depth = lot.depth || 3.0;
  const beam = C('#4a331f');
  const timber = mat === 'timber' || mat === 'wood';
  const roof = spec.roof, shop = !!spec.sign && !(lot.year >= 1500 && lot.year <= 1750);   // the fountain-square eras are formal, not shops
  const tint = jit(rng);
  const gz = lot.gable && (roof === 'thatch' || roof === 'tile');

  let y = 0, growMax = 0;
  for (let s = 0; s < storeys; s++) {
    const sMat = (timber && s === 0) ? 'stone' : mat;             // masonry base under a timber house
    const wallK = sMat === 'timber' ? 'plaster' : sMat;
    const grow = (timber && s > 0) ? s * 0.14 : 0; growMax = Math.max(growMax, grow);
    const ww = w - 0.05 + grow, dd = depth + grow, fz = depth / 2 + grow;   // the widened wall's true front face
    B.boxT(wallK, 0, y, grow / 2, ww, floorH, dd, tint);
    if (timber && s === 1) B.box(0, y - 0.04, fz, ww, 0.1, 0.12, beam);          // jetty beam over the stone base
    if (s === 0) plinth(B, ww, fz, sMat);                                        // a base course grounds the wall
    if (s === 0 && shop) shopfront(B, ww, floorH, fz, spec, rng, night, lot);
    else facade(B, ww, floorH, fz, y, s, storeys, spec, sMat, beam, rng, night, lot.year);
    y += floorH;
  }
  const bodyH = y, front = depth / 2 + growMax;
  const rw = w + 0.5 + growMax, rd = depth + 0.5 + growMax, eave = C('#241a12');
  if ((mat === 'stone' || mat === 'brick' || mat === 'render') && !spec.modern) cornice(B, w, bodyH, front, mat);   // projecting eaves moulding (not on the flat modern block)

  if (roof === 'green') greenRoof(B, w, depth, bodyH, spec, rng);
  else if (roof === 'flat') {
    B.boxT('concrete', 0, bodyH, 0, w + 0.05, 0.12, depth + 0.05, tint);
    if (spec.modern) {
      B.boxT('concrete', 0, bodyH, front - 0.05, w + 0.05, 0.4, 0.12, [0.86, 0.86, 0.84]); B.boxT('concrete', 0, bodyH, -depth / 2 + 0.05, w + 0.05, 0.4, 0.12, [0.86, 0.86, 0.84]);   // concrete parapet
      B.boxT('concrete', 0.35, bodyH + 0.12, -0.3, w * 0.42, 0.85, depth * 0.42, [0.82, 0.82, 0.8]); B.box(-w * 0.28, bodyH + 0.12, 0.2, 0.55, 0.55, 0.55, C('#8a9096'));   // rooftop plant room + lift housing
    } else B.box(0, bodyH, front - 0.05, w + 0.05, 0.4, 0.12, shade('#a8a49a', 0.9));            // front parapet
  }
  else if (roof === 'mansard') mansardRoof(B, w, depth, bodyH, front, rw, rd, tint, mat, night, rng);
  else {
    const rh = (roof === 'thatch' ? 1.5 : 1.05) + storeys * 0.05;
    if (gz) {
      B.box(0, bodyH - 0.12, front - 0.05, rw, 0.16, 0.14, eave);
      B.gableZT(roof, 0, bodyH, 0, rw, rh, rd, tint);
      gableTrim(B, w, bodyH, front, rh, mat, beam, mat === 'timber' ? 'plaster' : mat, night, rng);
    } else {
      B.box(0, bodyH - 0.12, front - 0.05, rw, 0.16, 0.16, eave);
      B.gableT(roof, 0, bodyH, 0, rw, rh, rd, tint);
      if (roof === 'thatch') B.gableT('thatch', 0, bodyH + 0.02, 0, rw * 0.66, rh * 0.7, rd, shade(WHITE, 0.9));
      if (storeys >= 3 && (roof === 'tile' || roof === 'slate')) dormerRow(B, w, bodyH, front, roof, mat, night, rng);
    }
    chimney(B, lot.chimney || 0, bodyH, rh);
  }

  if (spec.living) livingWall(B, w, floorH, storeys, front, rng);
  if (spec.neon) neonFront(B, w, floorH, storeys, bodyH, front, lot);
  if (lot.civic) clockTower(B, w, bodyH, front);
  if (shop && !lot.civic && !spec.neon) hangingSign(B, w, floorH, front, lot);
}
/* neon strips and a glowing hologram board over the old masonry (2100) */
function neonFront(B, w, floorH, storeys, bodyH, front, lot) {
  const fz = front + 0.06, a = C(NEONS[lot.neon % NEONS.length]), b = C(NEONS[(lot.neon + 2) % NEONS.length]);
  B.box(w / 2 - 0.12, floorH * 1.5, fz, 0.1, floorH * (storeys - 1.6), 0.05, a);            // vertical tube
  B.box(0, bodyH - floorH * 0.45, fz, w * 0.72, 0.5, 0.05, b);                              // big sign board
  for (let s = 1; s < storeys; s++) if ((lot.neon + s) % 2) B.box(-w / 2 + 0.12, floorH * s + floorH * 0.5, fz, 0.08, floorH * 0.7, 0.05, C(NEONS[(lot.neon + s) % NEONS.length]));
  B.box(0, bodyH + 0.4, -0.2, 0.06, 0.9, 0.06, C('#2a2e33'), false);                        // rooftop antenna mast
  B.box(0, bodyH + 1.3, -0.2, 0.12, 0.12, 0.12, C('#ff5db1'));                              // antenna light
}
/* a green living wall: planters and climbing vines across the facade (2150) */
function livingWall(B, w, floorH, storeys, front, rng) {
  const fz = front + 0.05, greens = ['#5f8f4b', '#6d9a54', '#4a7a3a', '#7aa03a'];
  for (let s = 0; s < storeys; s++) for (let i = 0; i < 4; i++) B.blob(-w / 2 + 0.3 + i * (w - 0.6) / 3, floorH * (s + 1) - 0.12, fz, 0.2 + rng() * 0.06, C(greens[(s + i) % greens.length]));
  for (const px of [-w / 2 + 0.22, w / 2 - 0.22]) for (let s = 0; s < storeys * 3; s++) B.blob(px, s * 0.5 + 0.4, fz - 0.01, 0.12, C(greens[s % greens.length]));
}
/* a civic clock/bell tower rising above the roofline of the hall */
function clockTower(B, w, bodyH, front) {
  const tw = Math.min(1.3, w * 0.5), ty = bodyH + 0.2, fz = front - 0.7;
  B.boxT('stone', 0, ty, fz, tw, 2.6, tw, WHITE);
  B.box(0, ty + 1.7, fz + tw / 2 + 0.02, tw * 0.62, tw * 0.62, 0.05, C('#efe9d8'));            // clock face
  B.box(0, ty + 1.7, fz + tw / 2 + 0.05, 0.04, tw * 0.42, 0.02, C('#2a2a2a')); B.box(0.02, ty + 1.72, fz + tw / 2 + 0.05, tw * 0.3, 0.04, 0.02, C('#2a2a2a'));  // hands
  B.pyramid(0, ty + 2.6, fz, tw + 0.24, 1.1, tw + 0.24, C('#586a5a'));
  B.cyl(0, ty + 3.7, fz, 0.06, 0.4, 6, C('#c8a23a'), false, 0.04);                             // finial
}

/* a glazed ground-floor shop. Its shade is era-appropriate: a plain timber
 * pentice before the 1650s, the striped canvas awning of 1650-1950, a flat
 * modern canopy after, and none once the future takes over. */
function shopfront(B, w, h, front, spec, rng, night, lot) {
  const y = lot.year, lit = night > 0.02 || rng() < 0.5, fz = front + 0.02;
  B.boxT('stone', 0, 0, front + 0.005, w, 0.34, 0.05, WHITE);                    // stallriser
  const gW = w * 0.52, gH = h * 0.5, gy = 0.36;
  B.qUV('glass', [-gW / 2, gy, fz + 0.03], [gW / 2, gy, fz + 0.03], [gW / 2, gy + gH, fz + 0.03], [-gW / 2, gy + gH, fz + 0.03], [0, 0], [1, 0], [1, 1], [0, 1], lit ? C('#ffdca0') : C('#3a4a52'));
  if (lit) B.box(0, gy + gH / 2, fz + 0.035, gW, gH, 0.02, C('#ffdca0'), true);   // warm interior glow
  for (let m = 1; m < 3; m++) B.box(-gW / 2 + gW * m / 3, gy, fz + 0.06, 0.05, gH, 0.03, C('#efe9dc'));  // shop-window mullions
  B.box(0, gy + gH / 2, fz + 0.06, gW, 0.05, 0.03, C('#efe9dc'));
  B.box(w * 0.34, 0, fz, 0.5, h * 0.72, 0.06, C(y > 1980 ? '#33414c' : '#3a2818'));  // door
  B.box(0, h - 0.19, fz + 0.05, w * 0.92, 0.26, 0.09, C('#33261a'));              // fascia (signboard)
  if (y < 1650) pentice(B, w * 0.9, front, h - 0.22);
  else if (y <= 1950) awning(B, w * 0.86, front, h - 0.24, lot.awn || 0);
  else if (y <= 2050 && !spec.modern) B.box(0, h - 0.32, front + 0.42, w * 0.86, 0.06, 0.85, C(['#3a5a4a', '#4a4a5a', '#5a4a4a'][lot.awn % 3]));  // flat modern canopy (none on the clean modern fronts)
}
/* plain sloped wooden shelter over a medieval/renaissance shopfront */
function pentice(B, w, front, y) {
  const proj = 0.7, n = 6, sw = w / n;
  for (let i = 0; i < n; i++) { const x = -w / 2 + sw * (i + 0.5); B.quad([x - sw / 2, y, front], [x + sw / 2, y, front], [x + sw / 2, y - 0.22, front + proj], [x - sw / 2, y - 0.22, front + proj], shade('#6b4f34', i % 2 ? 1.05 : 0.92)); }
  for (const px of [-w / 2 + 0.1, w / 2 - 0.1]) B.box(px, y - 0.5, front + proj - 0.1, 0.08, 0.5, 0.08, C('#4a3826'));  // props
}
function awning(B, w, front, y, style) {
  const pal = [['#8f4a3e', '#cabfa4'], ['#4a5c68', '#cabfa4'], ['#4f6a4c', '#c7bda2'], ['#9a7c3c', '#cabfa4']][style % 4];   // muted Victorian stripes, warm off-white, not a bright fairground red/blue
  const proj = 0.75, n = 8, sw = w / n;
  for (let i = 0; i < n; i++) { const x = -w / 2 + sw * (i + 0.5); B.quad([x - sw / 2, y, front], [x + sw / 2, y, front], [x + sw / 2, y - 0.28, front + proj], [x - sw / 2, y - 0.28, front + proj], C(pal[i % 2])); }
  for (let i = 0; i < n; i++) { const x = -w / 2 + sw * (i + 0.5); B.quad([x - sw / 2, y - 0.28, front + proj], [x + sw / 2, y - 0.28, front + proj], [x + sw / 2, y - 0.44, front + proj], [x - sw / 2, y - 0.44, front + proj], C(pal[i % 2])); } // valance
}
/* a slightly proud, darker base course under the ground floor */
function plinth(B, w, front, mat) {
  const k = mat === 'timber' || mat === 'wood' ? 'stone' : mat;
  B.boxT(k, 0, 0, front + 0.03, w + 0.08, 0.3, 0.08, [0.8, 0.8, 0.8]);
}
/* a projecting eaves moulding along the top of a masonry front */
function cornice(B, w, bodyH, front, mat) {
  const c = mat === 'brick' ? C('#d6cdb4') : C('#e2dac6');
  B.box(0, bodyH - 0.22, front + 0.06, w + 0.18, 0.14, 0.16, c);
  B.box(0, bodyH - 0.34, front + 0.02, w + 0.1, 0.06, 0.1, c);   // a second, smaller band
}

function facade(B, w, h, front, y, s, storeys, spec, mat, beam, rng, night, year) {
  const win = spec.window;
  const lit = night > 0.04 && rng() < 0.5;
  const glassHex = win === 'hole' ? '#221d18' : win === 'picture' ? '#8fb4c8' : '#c2d6dc';
  const gcol = lit ? C(WARM) : C(glassHex);
  const fz = front + 0.02;
  const masonry = mat === 'stone' || mat === 'brick' || mat === 'render';

  if (spec.modern) {                                                                              // a contemporary curtain-wall storey: a horizontal glazing ribbon between concrete spandrels, mullions, an occasional balcony
    const gw = w - 0.4, bandY = y + h * 0.26, bandH = h * 0.5;
    B.boxT('concrete', 0, y, front + 0.03, w, h * 0.2, 0.06, [0.92, 0.92, 0.9]);                 // concrete spandrel / floor band below
    B.boxT('concrete', 0, y + h - h * 0.22, front + 0.03, w, h * 0.24, 0.06, [0.86, 0.86, 0.84]);   // concrete slab band above
    B.qUV('glass', [-gw / 2, bandY, front + 0.05], [gw / 2, bandY, front + 0.05], [gw / 2, bandY + bandH, front + 0.05], [-gw / 2, bandY + bandH, front + 0.05], [0, 0], [1, 0], [1, 1], [0, 1], lit ? C(WARM) : C('#a8cfe0'));
    if (lit) B.box(0, bandY + bandH / 2, front + 0.055, gw, bandH, 0.02, C(WARM), true);
    const cols = Math.max(3, Math.round(w / 0.8));
    for (let m = 0; m <= cols; m++) B.box(-gw / 2 + gw * m / cols, bandY, front + 0.07, 0.05, bandH, 0.05, C('#ccd0d4'));   // mullions
    const balc = s >= 1 && (s + (w > 2.5 ? 0 : 1)) % 2 === 0;
    if (balc) railing(B, 0, bandY - 0.16, front, w * 0.66);                                         // an occasional balcony
    if (spec.green) {                                                                               // the 2050 retrofit: planted balconies and a vertical garden up a pier
      const greens = ['#5f8f4b', '#6d9a54', '#57853f'];
      if (balc) for (let g = 0; g < 3; g++) B.blob(-w * 0.26 + g * w * 0.26, bandY - 0.02, front + 0.5, 0.16, C(greens[g % 3]));
      for (let g = 0; g < 2; g++) B.blob(-gw / 2 - 0.05, y + h * (0.32 + g * 0.4), front + 0.06, 0.14, C(greens[(s + g) % 3]));
    }
    return;
  }

  if (mat === 'timber' || mat === 'wood') {
    const t = 0.16;
    B.box(0, y, fz, w, t, 0.07, beam); B.box(0, y + h - t, fz, w, t, 0.07, beam);
    const posts = w > 2.6 ? 5 : 4;
    for (let p = 0; p <= posts; p++) B.box(-w / 2 + (w / posts) * p, y, fz, t * 0.85, h, 0.07, beam);
    if (mat === 'timber') { B.box(0, y + h / 2, fz, w, 0.12, 0.06, beam); brace(B, -w / 4, y, h / 2, w / 3, fz, beam); brace(B, w / 4, y + h / 2, h / 2, -w / 3, fz, beam); }
  } else if (masonry) {
    for (const px of [-w / 2 + 0.11, w / 2 - 0.11]) B.boxT('stone', px, y, front + 0.02, 0.2, h, 0.05, WHITE);   // quoins
    if (s >= 1) B.box(0, y - 0.05, front + 0.05, w, 0.12, 0.1, C(mat === 'brick' ? '#cfc6ac' : '#ddd4bf'));       // string course at the floor line
  }

  const n = w > 2.7 ? 3 : 2, gap = w / n, big = win === 'picture';
  const winW = gap * (big ? 0.6 : 0.42), winH = Math.min(big ? 0.9 : 0.82, h * 0.56);
  const shut = spec.shutter || win === 'shutter';
  const balcony = masonry && year >= 1750 && year <= 1950 && s === 1;
  for (let i = 0; i < n; i++) {
    const px = -w / 2 + gap * (i + 0.5);
    if (s === 0 && i === (n >> 1)) {
      B.box(px, y, front + 0.02, 0.56, Math.min(1.05, h * 0.72), 0.06, C(mat === 'render' ? '#33414c' : '#3a2818'));
      B.box(px, y + Math.min(1.05, h * 0.72), front + 0.02, 0.66, 0.1, 0.07, beam);
      continue;
    }
    const wy = y + h * 0.28;
    B.box(px, wy - 0.07, front + 0.03, winW + 0.2, 0.1, 0.06, C('#efe9dc'));                        // moulded sill, proud
    if (masonry && !big) {                                                                         // window head: lintel + keystone
      B.box(px, wy + winH + 0.07, front + 0.03, winW + 0.14, 0.11, 0.06, C(mat === 'brick' ? '#a5533a' : '#ded5c0'));
      B.box(px, wy + winH + 0.09, front + 0.06, 0.16, 0.2, 0.06, C(mat === 'brick' ? '#c96a4a' : '#ece4d0'));
    } else B.box(px, wy + winH, front + 0.03, winW + 0.2, 0.09, 0.06, C('#efe9dc'));
    B.box(px, wy, front + 0.02, winW + 0.05, winH, 0.04, C('#d8d0c0'));                             // reveal (window sits recessed)
    B.qUV('glass', [px - winW / 2, wy, front + 0.06], [px + winW / 2, wy, front + 0.06], [px + winW / 2, wy + winH, front + 0.06], [px - winW / 2, wy + winH, front + 0.06], [0, 0], [1, 0], [1, 1], [0, 1], gcol);
    if (lit) B.box(px, wy + winH / 2, front + 0.065, winW, winH, 0.02, gcol, true);
    if (win === 'sash') {                                                                          // six-over-six glazing bars
      for (let m = 1; m < 3; m++) B.box(px - winW / 2 + winW * m / 3, wy + winH / 2, front + 0.08, 0.035, winH, 0.03, C('#eee7d8'));
      for (let r = 1; r < 3; r++) B.box(px, wy + winH * r / 3, front + 0.08, winW, 0.035, 0.03, C('#eee7d8'));
    } else if (win === 'lead') {
      B.box(px, wy + winH / 2, front + 0.08, winW, 0.04, 0.03, C('#eee7d8')); B.box(px, wy + winH / 2, front + 0.08, 0.04, winH, 0.03, C('#eee7d8'));
    }
    if (shut) for (const sx of [-winW / 2 - 0.1, winW / 2 + 0.1]) B.box(px + sx, wy, front + 0.02, 0.16, winH, 0.05, C(SHUTTER[(i + (px > 0 ? 1 : 0)) % SHUTTER.length]));
    if (balcony) railing(B, px, wy - 0.14, front, winW + 0.28);
    else if (spec.sign && s >= 1 && !big && year < 1750) { B.box(px, wy - 0.13, front + 0.12, winW + 0.1, 0.12, 0.14, C('#5a4030')); for (let f = -1; f <= 1; f++) B.blob(px + f * winW * 0.32, wy - 0.03, front + 0.15, 0.08, C(['#c94a5a', '#d8b83a', '#c96a3a'][(i + f + 1) % 3])); }  // window flower box (early eras)
  }
}
/* a small wrought-iron balcony under a window */
function railing(B, cx, y, front, w) {
  B.box(cx, y, front + 0.24, w, 0.05, 0.42, C('#33373e'));                     // slab
  B.box(cx, y + 0.36, front + 0.44, w, 0.04, 0.04, C('#2a2e33'));              // top rail
  const n = Math.max(5, Math.round(w / 0.16));
  for (let i = 0; i <= n; i++) B.box(cx - w / 2 + w * i / n, y + 0.18, front + 0.44, 0.028, 0.36, 0.028, C('#2a2e33'));
}
function brace(B, x, y, h, run, fz, col) { const steps = 5; for (let i = 0; i < steps; i++) B.box(x + run * (i / steps) * 0.5, y + h * (i / steps), fz, 0.14, h / steps + 0.06, 0.06, col); }
function gableTrim(B, w, bodyH, front, rh, mat, beam, wallK, night, rng) {
  B._t(wallK, -w / 2, bodyH, front - 0.02, w / 2, bodyH, front - 0.02, 0, bodyH + rh, front - 0.02, 0, 0, w * (UVK[wallK] || .4), 0, w * (UVK[wallK] || .4) / 2, rh * (UVK[wallK] || .4), jit(rng));
  if (mat === 'timber' || mat === 'wood') { B.box(0, bodyH, front, 0.12, rh * 0.92, 0.06, beam); B.box(-w / 4, bodyH + rh * 0.3, front, w / 2, 0.1, 0.06, beam); }
  const wy = bodyH + rh * 0.18, ww = w * 0.24;
  B.box(0, wy, front + 0.03, ww + 0.12, 0.07, 0.05, C('#efe9dc'));
  B.box(0, wy, front + 0.04, ww, 0.42, 0.05, night > 0.04 ? C(WARM) : C('#c2d6dc'), night > 0.04);
}
function chimney(B, x, bodyH, rh) {
  B.boxT('brick', x, bodyH + rh * 0.3, -0.35, 0.34, rh + 0.7, 0.34, WHITE);
  B.box(x, bodyH + rh * 0.3 + rh + 0.7, -0.35, 0.42, 0.12, 0.42, C('#2e1c14'));
  for (const px of [-0.08, 0.08]) B.cyl(x + px, bodyH + rh * 0.3 + rh + 0.82, -0.35, 0.055, 0.22, 6, C('#7a3f2c'), false, 0.045);  // pots
}
/* a row of gabled dormers along the front roof slope */
function dormerRow(B, w, bodyH, front, roofK, mat, night, rng, up) {
  up = up || 0.28;
  const n = w > 2.8 ? 3 : 2, gap = w / n, y = bodyH + up, fz = front - 0.5, wk = mat === 'timber' ? 'plaster' : (mat === 'wood' ? 'plaster' : mat);
  for (let i = 0; i < n; i++) {
    const dx = -w / 2 + gap * (i + 0.5), dw = gap * 0.52;
    B.boxT(wk, dx, y, fz, dw, 0.5, 0.42, jit(rng));
    B.box(dx, y + 0.26, fz + 0.2, dw * 0.72, 0.3, 0.05, night > 0.05 ? C(WARM) : C('#c2d6dc'), night > 0.05);
    B.gableT(roofK, dx, y + 0.5, fz, dw + 0.16, 0.28, 0.52, jit(rng));
  }
}
/* mansard: steep slate frustum + a shallow cap + dormers */
function mansardRoof(B, w, d, bodyH, front, rw, rd, tint, mat, night, rng) {
  const mh = 1.35, tw = w * 0.7, td = d * 0.7;
  B.box(0, bodyH - 0.12, front - 0.05, rw, 0.18, 0.16, C('#20262c'));
  frustumT(B, 'slate', 0, bodyH, 0, w + 0.4, d + 0.4, tw, td, mh, tint);
  B.boxT('slate', 0, bodyH + mh, 0, tw + 0.1, 0.12, td + 0.1, tint);
  dormerRow(B, w, bodyH, front, 'slate', mat, night, rng, 0.34);
  chimney(B, (rng() - 0.5) * w * 0.6, bodyH, mh + 0.5);
}
/* a 4-sided textured frustum (truncated pyramid), for mansard slopes */
function frustumT(B, k, cx, by, cz, w, d, w2, d2, h, color) {
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, tx0 = -w2 / 2, tx1 = w2 / 2, tz0 = -d2 / 2, tz1 = d2 / 2;
  const u = UVK[k] || 0.8, sl = Math.hypot(h, (w - w2) / 2), su = sl * u;
  B.qUV(k, [cx + x0, by, cz + z1], [cx + x1, by, cz + z1], [cx + tx1, by + h, cz + tz1], [cx + tx0, by + h, cz + tz1], [0, 0], [w * u, 0], [w2 * u, su], [0, su], color);
  B.qUV(k, [cx + x1, by, cz + z0], [cx + x0, by, cz + z0], [cx + tx0, by + h, cz + tz0], [cx + tx1, by + h, cz + tz0], [0, 0], [w * u, 0], [w2 * u, su], [0, su], color);
  B.qUV(k, [cx + x1, by, cz + z1], [cx + x1, by, cz + z0], [cx + tx1, by + h, cz + tz0], [cx + tx1, by + h, cz + tz1], [0, 0], [d * u, 0], [d2 * u, su], [0, su], color);
  B.qUV(k, [cx + x0, by, cz + z0], [cx + x0, by, cz + z1], [cx + tx0, by + h, cz + tz1], [cx + tx0, by + h, cz + tz0], [0, 0], [d * u, 0], [d2 * u, su], [0, su], color);
}
/* eco roof: solar panels, planters, a small glass rooftop room */
function greenRoof(B, w, d, bodyH, spec, rng) {
  B.boxT('concrete', 0, bodyH, 0, w + 0.05, 0.14, d + 0.05, jit(rng));
  for (const [x, z, sx, sz] of [[0, d / 2 - 0.06, w + 0.05, 0.1], [0, -d / 2 + 0.06, w + 0.05, 0.1], [-w / 2 + 0.06, 0, 0.1, d], [w / 2 - 0.06, 0, 0.1, d]]) B.box(x, bodyH + 0.14, z, sx, 0.36, sz, C('#8a8378'));
  if (spec.solar) for (let i = -1; i <= 1; i++) { B.box(i * w * 0.3, bodyH + 0.14, -d * 0.22, w * 0.25, 0.05, d * 0.42, C('#0e1b34')); B.box(i * w * 0.3, bodyH + 0.19, -d * 0.22, w * 0.23, 0.02, d * 0.38, C('#24406e')); }
  for (let i = 0; i < 3; i++) { const px = -w * 0.32 + i * w * 0.32; B.box(px, bodyH + 0.14, d * 0.26, w * 0.24, 0.2, 0.42, C('#6b4f34')); B.blob(px, bodyH + 0.5, d * 0.26, 0.26, C('#5f8f4b')); B.blob(px + 0.18, bodyH + 0.42, d * 0.26, 0.18, C('#6d9a54')); }
  B.box(w * 0.3, bodyH + 0.14, d * 0.05, w * 0.34, 0.66, d * 0.34, C('#a9c4c8'));   // glass rooftop room
  B.box(w * 0.3, bodyH + 0.8, d * 0.05, w * 0.36, 0.06, d * 0.36, C('#5a4636'));
}
function hangingSign(B, w, floorH, front, lot) {
  const sx = w / 2 - 0.18;
  B.box(sx, floorH * 0.82, front + 0.03, 0.05, 0.05, 0.42, C('#3a2c1c'));
  B.box(sx, floorH * 0.46, front + 0.24, 0.05, 0.32, 0.36, C(['#3d5a4a', '#5a3d3d', '#3d4a5a', '#6a5a2a'][lot.sign || 0]));
}

/* --------------------------------------------------------------- landmarks */
function landmark(B, kind, night) {
  switch (kind) {
    case 'motte': B.cone(0, 0, 0, 3.4, 2.2, 10, C('#6f8a4e')); B.boxT('wood', 0, 2.0, 0, 1.6, 2.4, 1.6, WHITE); B.pyramid(0, 4.4, 0, 1.9, 1.2, 1.9, C('#6b4f34')); break;
    case 'palisade': for (let i = -3; i <= 3; i++) B.box(i * 0.6, 0, 3.4, 0.4, 2.0 + (i % 2) * 0.2, 0.4, C('#6b4f34')); break;
    case 'keep': keep(B, false); break;
    case 'keep-ruin': keep(B, true); break;
    case 'church': cathedral(B, 'small', night); break;
    case 'cathedral-build': cathedral(B, 'build', night); break;
    case 'cathedral': cathedral(B, 'full', night); break;
    case 'cathedral-scarred': cathedral(B, 'scarred', night); break;
    case 'cathedral-spire': cathedral(B, 'spire', night); break;
    case 'townhall': B.boxT('stone', 0, 0, 0, 5, 3.6, 3.2, WHITE); B.gableT('tile', 0, 3.6, 0, 5.4, 1.2, 3.6, WHITE); B.boxT('stone', 0, 0, 1.6, 2, 5.2, 0.6, WHITE); B.pyramid(0, 5.2, 1.6, 1.2, 1.0, 1.2, C('#5a6a4a')); break;
    case 'windmill': B.cyl(0, 0, 0, 1.5, 5.2, 8, C('#cfc6b0'), false, 0.9); B.cone(0, 5.2, 0, 1.1, 0.9, 8, C('#5a4030')); windmillSails(B); break;
    case 'chimney': B.cyl(0, 0, 0, 0.9, 8.5, 10, C('#8a4a34'), false, 0.6); B.cyl(0, 8.5, 0, 0.62, 0.4, 10, C('#6a3626')); break;
    case 'gasometer': B.cyl(0, 0, 0, 3, 3.6, 14, C('#4a5560')); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.2832; B.box(Math.cos(a) * 3, 0, Math.sin(a) * 3, 0.14, 4.2, 0.14, C('#39424c')); } break;
    case 'crane': B.box(0, 0, 0, 0.6, 6, 0.6, C('#7a6a3a')); B.box(1.6, 5.4, 0, 4.4, 0.5, 0.5, C('#8a7a44')); B.box(-0.8, 5.4, 0, 1.6, 0.5, 0.5, C('#8a7a44')); break;
    case 'station': B.boxT('brick', 0, 0, 0, 6.5, 3, 4, WHITE); B.box(0, 3, 2.0, 6.5, 2.6, 0.2, C('#3a4048')); halfVault(B, 0, 3, 0, 3.25, 2.4, 4, C('#6a7580')); break;
    case 'megatower': megatower(B, night); break;
    case 'holotower': B.box(0, 0, 0, 2.4, 11, 2.4, C('#2a3550')); for (let i = 1; i < 9; i++) B.box(0, i * 1.3, 1.21, 2.0, 0.5, 0.06, C(NEONS[i % NEONS.length]), true); B.cone(0, 11, 0, 1.2, 2.2, 6, C('#3a4560')); break;
    case 'skybridge': B.box(-2.4, 0, 0, 2.4, 13, 2.4, C('#26324c')); B.box(2.4, 0, 0.6, 2.6, 15, 2.6, C('#2a3550')); glowGrid(B, -2.4, 13, 1.21, 2.0, 12, night); glowGrid(B, 2.4, 15, 1.31, 2.2, 14, night); B.box(0, 8.5, 0.3, 3, 0.7, 0.7, C('#3a4560'), night > 0.1); break;
    default: break;
  }
}
function keep(B, ruin) {
  const h = ruin ? 3.0 : 5.2;
  B.boxT('stone', 0, 0, 0, 3.6, h, 3.6, WHITE);
  if (ruin) { B.boxT('stone', 1.2, h, 0, 1.0, 1.4, 3.6, shade(WHITE, .9)); B.boxT('stone', -1.4, h - 0.6, -1, 0.8, 0.8, 1, shade(WHITE, .9)); }
  else B.boxT('stone', 0, h, 0, 3.8, 0.5, 3.8, shade(WHITE, .92));
  const turrets = ruin ? [[1.8, 1.8]] : [[1.8, 1.8], [-1.8, 1.8], [1.8, -1.8], [-1.8, -1.8]];
  for (const [tx, tz] of turrets) { B.cyl(tx, 0, tz, 0.7, h + (ruin ? -1 : 0.8), 8, C('#cbc2ab')); if (!ruin) B.cone(tx, h + 0.8, tz, 0.85, 1.2, 8, C('#6a5545')); }
}
/* a proper Gothic cathedral: nave + side aisles + clerestory, flying buttresses,
 * transept, polygonal apse, twin west towers with spires and corner pinnacles,
 * a central flèche and a rose window over the portal. West front faces +z. */
function cathedral(B, variant, night) {
  const scar = variant === 'scarred', small = variant === 'small', build = variant === 'build';
  const S = scar ? shade(WHITE, .85) : WHITE, roof = C('#59666e'), lit = night > 0.05;
  const nW = 3.0, nH = small ? 3.6 : 4.8, L = small ? 5.5 : 8.0, zf = L / 2, zb = -L / 2;

  for (const sx of [-1, 1]) {                                                   // side aisles
    const ax = sx * (nW / 2 + 0.95);
    B.boxT('stone', ax, 0, 0, 1.7, nH * 0.55, L, S);
    B.gableT('slate', ax, nH * 0.55, 0, 2.1, 0.45, L, S);
    for (let z = zb + 1.2; z < zf - 1.0; z += 1.5) pointedWindow(B, ax + sx * 0.86, 0.7, z, 0.42, 1.4, sx, lit);
  }
  B.boxT('stone', 0, 0, 0, nW, nH, L, S);                                       // nave + clerestory
  B.gableT('slate', 0, nH, 0, nW + 0.5, 1.3, L + 0.3, roof);
  if (!small) for (const sx of [-1, 1]) for (let z = zb + 1.5; z < zf - 1.0; z += 1.7) pointedWindow(B, sx * nW / 2 * 0.99, nH * 0.5, z, 0.34, 1.6, sx, lit);
  if (!small) for (const sx of [-1, 1]) for (let z = zb + 1.6; z < zf - 0.5; z += 2.1) {     // flying buttresses + pier pinnacles
    const pierX = sx * (nW / 2 + 2.0);
    B.boxT('stone', pierX, 0, z, 0.34, nH * 0.72, 0.34, S);
    flyer(B, sx * (nW / 2 + 0.1), nH * 0.82, pierX, nH * 0.5, z, S);
    pinnacle(B, pierX, nH * 0.72, z, 0.28, roof);
  }
  if (!small) for (let z = zb + 1.2; z <= zf - 1.2; z += 2.0) for (const sx of [-1, 1]) pinnacle(B, sx * (nW / 2 + 0.05), nH, z, 0.16, roof);
  if (!build) { B.cone(0, nH + 1.3, -0.5, 0.75, 3.4, 6, roof); B.cyl(0, nH + 4.4, -0.5, 0.1, 0.7, 6, C('#c8a23a'), false, 0.05); }   // crossing flèche
  B.boxT('stone', 0, 0, zb + 1.6, nW + 4.2, nH * 0.92, 1.9, S);                 // transept
  B.gableT('slate', 0, nH * 0.92, zb + 1.6, nW + 4.6, 1.1, 2.1, roof);
  for (let i = -2; i <= 2; i++) { const a = i * 0.42; B.boxT('stone', Math.sin(a) * (nW / 2 + 0.3), 0, zb - 0.2 + Math.cos(a) * 0.5, 1.0, nH * 0.82, 0.9, S); }   // apse
  B.cone(0, nH * 0.82, zb - 0.1, nW / 2 + 0.7, 1.4, 8, roof);

  const twH = small ? nH + 1.5 : nH + 3.2;                                      // twin west towers
  for (const tx of [-1, 1]) {
    const txx = tx * (nW / 2 + 0.75);
    B.boxT('stone', txx, 0, zf + 0.4, 1.7, twH, 1.7, S);
    for (const fy of [twH * 0.6, twH * 0.8]) B.box(txx, fy, zf + 1.26, 1.0, 0.7, 0.06, lit ? C(WARM) : C('#3a4652'), lit);   // belfry openings
    if (build && tx > 0) scaffold(B, txx, twH, zf + 0.4);
    else {
      B.cone(txx, twH, zf + 0.4, 1.15, variant === 'spire' ? 3.4 : 2.2, 8, roof);
      for (const [px, pz] of [[0.75, 0.75], [-0.75, 0.75], [0.75, -0.75], [-0.75, -0.75]]) pinnacle(B, txx + px, twH, zf + 0.4 + pz, 0.2, roof);
    }
  }
  B.boxT('stone', 0, 0, zf + 0.3, nW, nH * 0.9, 0.6, S);                        // west gable + rose + portal
  B.gableT('stone', 0, nH * 0.9, zf + 0.3, nW + 0.2, 1.0, 0.6, S);
  roseWindow(B, 0, nH * 0.62, zf + 0.62, 0.8, lit);
  B.box(0, 0, zf + 0.62, 1.0, 1.9, 0.14, C('#3a2c1e'));
  B.gableT('stone', 0, 1.9, zf + 0.55, 1.3, 0.5, 0.4, S);
  if (build) {                                                                  // a timber crane lifting a dressed stone up to the works
    const mx = nW / 2 + 1.9, mh = twH * 0.82, tim = C('#6b4f34');
    B.box(mx, 0, zf, 0.26, mh, 0.26, tim); B.box(mx - 1.2, mh, zf, 2.6, 0.18, 0.18, tim);
    B.box(mx - 2.3, mh - 0.9, zf, 0.08, 1.0, 0.08, C('#4a3826')); B.box(mx - 2.3, mh - 1.2, zf, 0.36, 0.24, 0.36, shade(WHITE, 0.9));
  }
}
function pointedWindow(B, x, y, z, w, h, faceSign, lit) {
  const xx = x + faceSign * 0.02, gcol = lit ? C(WARM) : C('#7a95b0');
  B.box(xx, y, z, 0.05, h, w + 0.1, C('#39424c'));
  B.tri(xx, y + h, z - w / 2, xx, y + h, z + w / 2, xx, y + h + w * 0.7, z, C('#39424c'));
  B.box(xx + faceSign * 0.03, y + 0.1, z, 0.05, h - 0.2, w * 0.7, gcol, lit);
}
function roseWindow(B, x, y, z, r, lit) {
  for (let i = 0; i < 8; i++) { const a0 = i / 8 * 6.283, a1 = (i + 1) / 8 * 6.283; B.tri(x, y, z, x + Math.cos(a0) * r, y + Math.sin(a0) * r, z, x + Math.cos(a1) * r, y + Math.sin(a1) * r, z, C(lit ? (i % 2 ? '#ffcf8a' : '#e0a85a') : (i % 2 ? '#8a9fc0' : '#6a80a0')), lit); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; B.box(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, z + 0.03, 0.05, r, 0.04, C('#cfc6ac')); }
}
function flyer(B, x0, y0, x1, y1, z, col) {
  const steps = 5;
  for (let i = 0; i < steps; i++) { const t = i / steps, xa = x0 + (x1 - x0) * t, ya = y0 - (y0 - y1) * t * t; B.box(xa, ya, z, Math.abs(x1 - x0) / steps + 0.12, 0.16, 0.16, col); }
}
function pinnacle(B, x, y, z, r, col) { B.box(x, y, z, r * 1.6, r * 1.2, r * 1.6, col); B.cone(x, y + r * 1.2, z, r, r * 2.6, 4, col); }
/* the modern glass-and-steel office building that replaces the demolished
 * cathedral on its footprint from 2000 on. A pale steel mass wrapped in a blue
 * curtain wall (the real reflective glass material, so it mirrors the sky and
 * reads unmistakably as glazing), with clear storey slabs, mullions, a glazed
 * ground-floor lobby and a rooftop plant room. Front faces +z, toward the square. */
function modernBlock(B, night, green) {
  const H = 6.4, w = 4.4, d = 3.0, e = 0.04;
  const frame = C('#c4c8ce'), body = C('#7a848e'), glassTint = night > 0.05 ? C('#243642') : C('#a6cfe0');
  B.box(0, 0, 0, w, H, d, body);                                                       // solid mass, pale steel, never hollow
  const floors = 6, fh = H / floors;
  for (let fl = 0; fl < floors; fl++) {                                                // blue glazing on the two camera-facing sides
    const y0 = fl * fh + 0.14, gh = fh - 0.28;
    B.qUV('glass', [-w / 2 + 0.16, y0, d / 2 + e], [w / 2 - 0.16, y0, d / 2 + e], [w / 2 - 0.16, y0 + gh, d / 2 + e], [-w / 2 + 0.16, y0 + gh, d / 2 + e], [0, 0], [1, 0], [1, 1], [0, 1], glassTint);
    B.qUV('glass', [w / 2 + e, y0, d / 2 - 0.16], [w / 2 + e, y0, -d / 2 + 0.16], [w / 2 + e, y0 + gh, -d / 2 + 0.16], [w / 2 + e, y0 + gh, d / 2 - 0.16], [0, 0], [1, 0], [1, 1], [0, 1], glassTint);
  }
  for (let fl = 0; fl <= floors; fl++) { const y = fl * fh; B.box(0, y, d / 2 + 0.05, w, 0.13, 0.08, frame); B.box(w / 2 + 0.05, y, 0, 0.08, 0.13, d, frame); }   // storey slabs
  for (let m = -1; m <= 1; m++) { B.box(m * w / 3, 0, d / 2 + 0.06, 0.09, H, 0.08, frame); B.box(w / 2 + 0.06, 0, m * d / 3, 0.08, H, 0.09, frame); }             // mullions
  for (const [cx, cz] of [[-w / 2, d / 2], [w / 2, d / 2], [w / 2, -d / 2]]) B.box(cx, 0, cz, 0.16, H + 0.06, 0.16, frame);   // corner columns
  B.box(0, H, 0, w + 0.24, 0.34, d + 0.24, frame);                                     // parapet cap
  if (green) {                                                                          // 2050 retrofit: a rooftop garden with solar, and a vertical garden up the front
    for (let i = -1; i <= 1; i++) { B.box(i * w * 0.3, H + 0.34, -d * 0.24, w * 0.24, 0.05, d * 0.4, C('#0e1b34')); B.box(i * w * 0.3, H + 0.39, -d * 0.24, w * 0.22, 0.02, d * 0.36, C('#24406e')); }   // roof solar
    for (let i = 0; i < 3; i++) { const px = -w * 0.3 + i * w * 0.3; B.box(px, H + 0.34, d * 0.28, w * 0.24, 0.18, d * 0.34, C('#5a4636')); B.blob(px, H + 0.66, d * 0.28, 0.26, C('#5f8f4b')); }   // roof planters
    for (let g = 0; g < 8; g++) B.blob(-w / 2 + 0.25, 0.5 + g * (H - 1) / 8, d / 2 + 0.09, 0.2, C(['#5f8f4b', '#6d9a54', '#57853f'][g % 3]));   // vertical garden strip
  } else B.box(0.4, H + 0.34, -0.3, w * 0.48, 1.1, d * 0.5, body);                     // otherwise a plain rooftop plant room
  if (night > 0.05) glowGrid(B, 0, 0.3, d / 2 + 0.05, w - 0.5, 15, night);             // lit floors at night
  B.box(0, 0, d / 2 + 0.08, w * 0.52, fh * 0.85, 0.05, night > 0.05 ? C(WARM) : C('#d4e8f0'), night > 0.05);   // bright glazed ground-floor lobby
}
/* a timber scaffold cage hugging the two camera-facing faces of a tower under
 * construction: standards (verticals), ledgers (horizontals) and a couple of
 * working platforms, in muted timber so it reads as scaffolding, not a frame */
function scaffold(B, x, h, z) {
  const pole = C('#6b4f34'), plank = C('#a5885a'), fz = z + 0.9, rx = x + 0.9, lift = h / 4;
  for (const px of [x - 0.78, x, x + 0.78]) B.box(px, 0, fz, 0.06, h, 0.06, pole);          // front standards
  for (const pz of [z - 0.78, z, z + 0.78]) B.box(rx, 0, pz, 0.06, h, 0.06, pole);          // right standards
  for (let l = 1; l <= 4; l++) {
    const y = l * lift - 0.4;
    B.box(x, y, fz, 1.66, 0.05, 0.05, pole); B.box(rx, y, z, 0.05, 0.05, 1.66, pole);       // ledgers
    if (l % 2 === 0) { B.box(x, y + 0.05, fz - 0.2, 1.66, 0.04, 0.36, plank); B.box(rx - 0.2, y + 0.05, z, 0.36, 0.04, 1.66, plank); }   // working platforms
  }
}
function windmillSails(B) { B.at(0, 4.6, 1.1); for (let k = 0; k < 4; k++) { B.push(new THREE.Matrix4().makeRotationZ(k * Math.PI / 2)); B.box(0, 1.4, 0, 0.18, 2.8, 0.1, C('#6b4f34')); B.box(0.35, 1.4, 0.02, 0.5, 2.4, 0.04, C('#d8d2c2')); B.pop(); } B.pop(); }
function halfVault(B, cx, baseY, cz, r, h, d, color) { const seg = 8; for (let i = 0; i < seg; i++) { const a0 = Math.PI * i / seg, a1 = Math.PI * (i + 1) / seg; const y0 = baseY + Math.sin(a0) * h, x0 = cx - Math.cos(a0) * r, y1 = baseY + Math.sin(a1) * h, x1 = cx - Math.cos(a1) * r; B.quad([x0, y0, cz - d / 2], [x1, y1, cz - d / 2], [x1, y1, cz + d / 2], [x0, y0, cz + d / 2], color); } }
function megatower(B, night) {
  let y = 0, w = 3;
  for (let s = 0; s < 4; s++) { B.box(0, y, 0, w, 3.4, w, C(s % 2 ? '#3a4762' : '#31405c')); glowGrid(B, 0, y, w / 2 + 0.01, w - 0.4, 10, night); y += 3.4; w -= 0.5; }
  B.box(0, y, 0, 0.3, 2.5, 0.3, C('#5a6580')); B.box(0, y + 2.5, 0, 0.1, 0.6, 0.1, C('#ff5db1'), true);
}
function glowGrid(B, cx, baseY, fz, w, rows, night) {
  const lit = night > 0.02, col = lit ? C('#ffe0a0') : C('#7fa0b8'), cols = 4, cw = w / cols;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if ((r * 7 + c * 3) % 3 !== 0) B.box(cx - w / 2 + cw * (c + 0.5), baseY + 0.35 + r * 0.32, fz, cw * 0.66, 0.2, 0.04, lit ? ((r + c) % 2 ? col : C('#8fb4c8')) : col, lit);
}

/* ------------------------------------------------------------------- props */
function prop(B, kind, rng, night) {
  switch (kind) {
    case 'well': B.cyl(0, 0, 0, 0.6, 0.7, 10, C('#9a9184')); B.cyl(0, 0.7, 0, 0.5, 0.15, 10, C('#7a7264')); for (const sx of [-0.55, 0.55]) B.box(sx, 0.7, 0, 0.14, 1.4, 0.14, C('#6b4f34')); B.gableT('tile', 0, 2.1, 0, 1.5, 0.5, 0.9, WHITE); B.box(0, 1.4, 0, 0.3, 0.3, 0.3, C('#4a3826')); break;
    case 'barrel': B.cyl(0, 0, 0, 0.32, 0.62, 8, C('#7a5c3a'), false, 0.28); B.cyl(0, 0, 0, 0.34, 0.1, 8, C('#4a3826'), false, 0.34); B.cyl(0, 0.5, 0, 0.34, 0.1, 8, C('#4a3826'), false, 0.3); break;
    case 'crate': B.boxT('wood', 0, 0, 0, 0.6, 0.6, 0.6, WHITE); break;
    case 'hay': B.cyl(0, 0, 0, 0.4, 0.7, 8, C('#c8a94e')); break;
    case 'crop': case 'produce': for (let i = 0; i < 4; i++) B.box((rng() - .5) * .5, 0, (rng() - .5) * .5, .16, .16, .16, C(['#c94a3a', '#e0902a', '#4a7a2a', '#d8c23a'][(rng() * 4) | 0])); break;
    case 'bench': B.box(0, 0.35, 0, 1.3, 0.1, 0.4, C('#7a5c3a')); B.box(0, 0.55, -0.15, 1.3, 0.4, 0.08, C('#7a5c3a')); for (const sx of [-0.55, 0.55]) B.box(sx, 0, 0, 0.1, 0.35, 0.36, C('#5a4030')); break;
    case 'tree': tree(B, rng, false); break;
    case 'neon-tree': tree(B, rng, true); break;
    case 'cross': B.boxT('stone', 0, 0, 0, 1.6, 0.3, 1.6, WHITE); B.boxT('stone', 0, 0.3, 0, 1.1, 0.3, 1.1, WHITE); B.cyl(0, 0.6, 0, 0.16, 2.0, 8, C('#cbc2ab')); B.box(0, 2.6, 0, 0.7, 0.5, 0.5, C('#c2b9a2')); break;
    case 'fountain': {
      const wcol = night > .1 ? C('#2a4a66') : C('#6fb0cf');
      B.cyl(0, 0, 0, 1.4, 0.5, 12, C('#b6ad96'), false, 1.25);                                   // basin rim
      B.anim(6, 0.0, 0); B.cyl(0, 0.12, 0, 1.15, 0.22, 12, wcol, night > .1); B.anim(0, 0, 0);   // lower water, ripples
      B.cyl(0, 0.5, 0, 0.3, 1.0, 10, C('#c2b9a2'));                                               // central column
      B.cyl(0, 1.5, 0, 0.7, 0.2, 10, C('#b6ad96'), false, 0.6);                                   // upper basin
      B.anim(6, 1.4, 0); B.cyl(0, 1.62, 0, 0.55, 0.13, 10, wcol, night > .1, 0.5); B.cyl(0, 1.7, 0, 0.05, 0.55, 6, C('#9fd0e4'), false, 0.03); B.anim(0, 0, 0);  // upper water + jet
      break;
    }
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
    case 'bike': case 'scooter': bike(B); break;
    case 'phone-box': B.box(0, 0, 0, 0.7, 2.2, 0.7, C('#b0231f')); B.box(0, 0.6, 0.31, 0.5, 1.3, 0.06, night > .05 ? C(WARM) : C('#8fb4c8'), night > .05); B.pyramid(0, 2.2, 0, 0.8, 0.25, 0.8, C('#8a1a17')); break;
    case 'traffic-light': B.box(0, 0, 0, 0.16, 2.4, 0.16, C('#39424c')); B.box(0, 2.0, 0.12, 0.24, 0.6, 0.16, C('#20262c')); B.box(0, 2.15, 0.22, 0.12, 0.12, 0.05, C('#33dd55'), true); break;
    case 'planter': B.box(0, 0, 0, 1.0, 0.4, 0.5, C('#7a6144')); for (let i = 0; i < 3; i++) { B.blob(-0.3 + i * 0.3, 0.55, 0, 0.22, C('#5f8f4b')); B.blob(-0.2 + i * 0.32, 0.62, 0.08, 0.09, C(['#c94a5a', '#d8b83a', '#c96a3a', '#b06ac0'][(rng() * 4) | 0])); } break;
    case 'table': produceTable(B, rng); break;
    case 'crates': for (let i = 0; i < 3; i++) B.boxT('wood', (i - 1) * 0.62, 0, 0, 0.58, 0.58, 0.58, WHITE); B.boxT('wood', -0.3, 0.58, 0, 0.56, 0.56, 0.56, WHITE); B.cyl(0.7, 0, 0.5, 0.32, 0.62, 8, C('#7a5c3a'), false, 0.28); break;
    case 'memorial': B.boxT('stone', 0, 0, 0, 1.4, 0.35, 1.4, WHITE); B.boxT('stone', 0, 0.35, 0, 1.0, 0.35, 1.0, WHITE); B.cyl(0, 0.7, 0, 0.24, 2.4, 8, C('#b6ad96')); B.box(0, 3.1, 0, 0.5, 0.5, 0.4, C('#8a8378')); B.box(0, 3.5, 0, 0.28, 0.5, 0.24, C('#6b5c4a')); break;
    case 'tree-box': B.boxT('wood', 0, 0, 0, 1.1, 0.5, 1.1, WHITE); B.at(0, 0.5, 0); tree(B, rng, false); B.pop(); break;
    case 'firewood': for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) B.box(-0.5 + i * 0.28 + r * 0.14, r * 0.22 + 0.11, 0, 0.25, 0.22, 0.9, C(r % 2 ? '#7a5c3a' : '#8a6a44')); break;
    case 'cafe': cafeSet(B, rng); break;
    case 'farmbed': farmBed(B, rng); break;
    case 'kiosk': B.box(0, 0, 0, 1.2, 1.9, 1.0, C('#2f5a3a')); B.box(0, 0.5, 0.52, 0.9, 1.0, 0.05, C('#cfe0d0')); for (let i = 0; i < 3; i++) B.box(-0.3 + i * 0.3, 0.6, 0.56, 0.22, 0.7, 0.03, C(['#c94a3a', '#3a6ab2', '#d8b83a'][i])); B.box(0, 1.9, 0.2, 1.5, 0.1, 1.4, C('#24402c')); break;
    case 'bus-shelter': for (const sx of [-0.9, 0.9]) B.box(sx, 0, -0.3, 0.08, 2.0, 0.08, C('#3a3f46')); B.box(0, 2.0, -0.1, 2.0, 0.1, 0.7, C('#4a4f56')); B.box(-0.9, 0.4, -0.6, 0.06, 1.5, 0.7, night > .05 ? C('#8fb4c8') : C('#a9c4d0')); B.box(0.3, 0.35, 0, 1.1, 0.1, 0.35, C('#5a5f66')); B.box(0.3, 0.55, -0.15, 1.1, 0.35, 0.06, C('#5a5f66')); break;
    case 'bike-rack': B.box(0, 0.05, 0, 2.2, 0.1, 0.14, C('#8a8f96')); for (let i = 0; i < 4; i++) { B.box(-0.82 + i * 0.55, 0.4, -0.18, 0.05, 0.6, 0.05, C('#6a7078')); B.at(-0.82 + i * 0.55, 0, 0.12, Math.PI / 2); bike(B); B.pop(); } break;   // a tidy bike-share dock: a rail with bikes lined up the same way
    case 'charger': B.box(0, 0, 0, 0.3, 1.2, 0.2, C('#e8e4d8')); B.box(0, 0.8, 0.11, 0.22, 0.3, 0.04, C('#2bd6ff'), true); break;
    case 'canopy': for (const [sx, sz] of [[-1.2, -0.8], [1.2, -0.8], [-1.2, 0.8], [1.2, 0.8]]) B.cyl(sx, 0, sz, 0.08, 2.5, 6, C('#8a8378'), false, 0.07); B.box(0, 2.5, 0, 2.9, 0.12, 2.0, C('#586a4a')); for (let i = -1; i <= 1; i++) { B.box(i * 0.85, 2.62, -0.4, 0.72, 0.04, 1.6, C('#1f3d6b')); } for (let i = 0; i < 6; i++) B.blob(-1.1 + (i % 3) * 1.1, 2.7, 0.4 + ((i / 3) | 0) * 0.5 - 0.6, 0.28, C(['#5f8f4b', '#6d9a54'][(i) % 2])); break;
    case 'bin': B.cyl(0, 0, 0, 0.22, 0.7, 8, C('#3a5a3a')); B.cyl(0, 0.7, 0, 0.24, 0.08, 8, C('#2a4a2a')); break;
    case 'holo-sign': B.box(0, 0, 0, 0.1, 2.2, 0.1, C('#39424c')); B.box(0, 2.4, 0, 1.0, 0.9, 0.05, C(NEONS[(rng() * NEONS.length) | 0]), true); break;
    case 'drone': B.at((rng() - .5) * 4, 3 + rng() * 2, (rng() - .5) * 3); B.anim(5, rng() * 6.283, 0); B.box(0, 0, 0, 0.4, 0.14, 0.4, C('#26324c')); for (const [dx, dz] of [[.3, .3], [-.3, .3], [.3, -.3], [-.3, -.3]]) { B.box(dx, 0.05, dz, 0.22, 0.03, 0.22, C('#39424c')); B.box(dx, 0.02, dz, 0.05, 0.05, 0.05, C('#43e0ff'), true); } B.anim(0, 0, 0); B.pop(); break;
    case 'statue': {                                                                                // civic monument: a bronze figure on a tall stone pedestal
      B.boxT('stone', 0, 0, 0, 1.5, 0.4, 1.5, WHITE); B.boxT('stone', 0, 0.4, 0, 1.0, 1.5, 1.0, WHITE);
      B.box(0, 1.05, 0.51, 0.6, 0.4, 0.05, C('#4a4236'));                                           // inscription plate
      B.boxT('stone', 0, 1.9, 0, 1.25, 0.16, 1.25, shade(WHITE, 0.95));
      const bz = C('#5f7d6a');                                                                      // verdigris bronze
      B.box(0, 2.06, 0, 0.36, 0.7, 0.3, bz); B.box(0, 2.66, 0, 0.44, 0.62, 0.32, bz);
      B.box(0.02, 2.88, 0.24, 0.16, 0.5, 0.16, bz); B.box(0.32, 3.0, 0.05, 0.42, 0.14, 0.14, bz);   // one arm at the side, one raised
      B.blob(0, 3.42, 0, 0.17, bz); break;
    }
    case 'bandstand': {                                                                             // cast-iron Victorian bandstand with a copper ogee roof
      const iron = C('#233a30'), cop = C('#4a6a58');
      B.cyl(0, 0, 0, 1.75, 0.35, 8, C('#b6ad96')); B.cyl(0, 0.35, 0, 1.55, 0.12, 8, C('#8a8168'), false, 1.55);
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832, px = Math.cos(a) * 1.45, pz = Math.sin(a) * 1.45; B.cyl(px, 0.47, pz, 0.06, 1.85, 6, iron); B.box(px, 0.6, pz, 0.16, 0.5, 0.16, iron); }
      B.cone(0, 2.32, 0, 2.05, 1.0, 8, cop); B.cone(0, 3.05, 0, 1.1, 0.7, 8, cop);
      B.cyl(0, 3.6, 0, 0.06, 0.4, 6, C('#c8a23a')); B.blob(0, 4.05, 0, 0.14, C('#c8a23a')); break;
    }
    case 'ad-column': {                                                                             // a Morris advertising column plastered with playbills
      B.cyl(0, 0, 0, 0.16, 0.3, 10, C('#20342a')); B.cyl(0, 0.3, 0, 0.5, 2.1, 14, C('#2f5a3a'));
      const posters = ['#b23a3a', '#c8902a', '#3a5a9a', '#d8c23a', '#7a3a6a'];
      for (let k = 0; k < 5; k++) { B.at(0, 0, 0, k / 5 * 6.2832); B.box(0, 0.7, 0.5, 0.5, 1.3, 0.02, C(posters[k])); B.pop(); }
      B.cone(0, 2.4, 0, 0.6, 0.5, 14, C('#1e4028')); B.blob(0, 2.95, 0, 0.1, C('#1e4028')); break;
    }
    case 'drink-fountain': {                                                                        // a small cast-iron drinking fountain
      const iron = C('#2a3a34'), wcol = night > .1 ? C('#2a4a66') : C('#6fb0cf');
      B.cyl(0, 0, 0, 0.34, 0.2, 8, C('#8a8168')); B.cyl(0, 0.2, 0, 0.2, 0.9, 8, iron); B.cyl(0, 1.1, 0, 0.4, 0.18, 10, iron, false, 0.34);
      B.anim(6, 0.3, 0); B.cyl(0, 1.18, 0, 0.3, 0.05, 10, wcol, night > .1); B.anim(0, 0, 0);
      B.cyl(0, 1.28, 0, 0.1, 0.5, 6, iron); B.blob(0, 1.85, 0, 0.13, iron); break;
    }
    case 'trough': {                                                                                // a stone horse trough
      const wcol = night > .1 ? C('#2a4a66') : C('#6fb0cf');
      B.boxT('stone', 0, 0, 0, 1.9, 0.5, 0.72, WHITE); B.box(0, 0.5, 0, 1.7, 0.04, 0.54, C('#7a7264'));
      B.anim(6, 0.7, 0); B.box(0, 0.44, 0, 1.66, 0.1, 0.5, wcol, night > .1); B.anim(0, 0, 0); break;
    }
    case 'flower-cart': {                                                                           // a flower-seller's barrow
      B.boxT('wood', 0, 0.4, 0, 1.2, 0.24, 0.72, WHITE); for (const wx of [0.45, -0.45]) B.cyl(wx, 0, 0.42, 0.28, 0.1, 8, C('#4a3826'));
      B.box(0.72, 0.32, 0, 0.7, 0.06, 0.1, C('#6b4f34'));
      const fl = ['#c94a5a', '#e0902a', '#d8c23a', '#b06ac0', '#e8e4d8', '#c96a3a', '#4a8a5a'];
      for (let i = 0; i < 10; i++) B.blob(-0.5 + (i % 5) * 0.25, 0.62 + ((i / 5) | 0) * 0.06, -0.18 + ((i / 5) | 0) * 0.34, 0.13, C(fl[i % fl.length])); break;
    }
    case 'chestnut-cart': {                                                                         // a roast-chestnut vendor, coals glowing in the brazier
      B.boxT('wood', 0, 0.42, 0, 1.0, 0.26, 0.66, WHITE); for (const wx of [0.4, -0.4]) B.cyl(wx, 0, 0.38, 0.26, 0.1, 8, C('#4a3826'));
      B.cyl(0, 0.68, 0, 0.3, 0.32, 8, C('#2a2622')); B.cyl(0, 1.0, 0, 0.3, 0.03, 8, C('#3a3630'), false, 0.28);
      B.blob(0, 1.0, 0, 0.24, C('#ff7a2a'), true); B.blob(0.05, 1.12, -0.03, 0.12, C('#ffcf6a'), true);
      B.cyl(0.24, 1.0, 0.18, 0.05, 0.7, 6, C('#20242a'));
      B.anim(3, 1.7, 0); B.blob(0.24, 1.9, 0.18, 0.18, shade('#c9cdd2', 1.0)); B.anim(0, 0, 0); break;
    }
    case 'newsstand': {                                                                             // a Victorian newspaper kiosk with a peaked roof
      B.box(0, 0, 0, 1.2, 1.8, 0.95, C('#22402c')); B.box(0, 0.55, 0.49, 0.92, 0.95, 0.05, C('#d8d2c2'));
      for (let i = 0; i < 3; i++) B.box(-0.3 + i * 0.3, 0.62, 0.53, 0.22, 0.68, 0.03, C(['#b23a3a', '#3a5a9a', '#c8902a'][i]));
      B.box(0, 1.8, 0.15, 1.5, 0.08, 1.3, C('#1a3020')); B.pyramid(0, 1.88, 0.15, 1.4, 0.4, 1.2, C('#16281a')); break;
    }
    case 'sculpture': {                                                                             // abstract steel-and-glass public artwork on a reflecting pool
      const wcol = night > .1 ? C('#22323e') : C('#7fb4c8');
      B.cyl(0, 0, 0, 1.7, 0.16, 16, C('#8a929a'), false, 1.7); B.anim(6, 0.2, 0); B.cyl(0, 0.05, 0, 1.55, 0.08, 16, wcol, night > .1); B.anim(0, 0, 0);
      const steel = C('#b0b6bc'), glass = night > .1 ? C('#2a6a8a') : C('#8fd0e4');
      B.box(0, 0.14, 0, 0.8, 0.4, 0.8, steel);
      B.at(0, 0.5, 0); B.push(new THREE.Matrix4().makeRotationZ(0.18));
      B.box(-0.24, 0, 0, 0.28, 3.4, 0.7, steel); B.box(0.12, 0, 0.02, 0.3, 3.1, 0.66, glass, night > .1); B.box(0.44, 0, 0, 0.24, 2.7, 0.6, steel);
      B.pop(); B.pop(); break;
    }
    case 'glass-pavilion': glassCafe(B, night); break;
    case 'screen-pylon': {                                                                          // a digital advertising pylon with a lit screen
      B.box(0, 0, 0, 0.24, 2.6, 0.18, C('#2a2e33')); B.box(0, 1.4, 0.11, 0.9, 1.2, 0.06, C('#101418'));
      B.box(0, 1.4, 0.15, 0.8, 1.05, 0.03, C(rng() < 0.5 ? '#2ac6e0' : '#e02a8a'), true); break;
    }
    case 'tram-modern': tram(B, true, night); break;
    case 'ring-tree': {                                                                             // a landmark tree with an octagonal timber bench around its base
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832; B.at(Math.cos(a) * 1.35, 0, Math.sin(a) * 1.35, -a); B.box(0, 0.32, 0, 0.62, 0.1, 0.3, C('#7a5c3a')); B.box(0, 0, 0.05, 0.5, 0.32, 0.08, C('#5a4030')); B.pop(); }
      B.cyl(0, 0, 0, 0.26, 1.7, 8, C('#6b4f34'), false, 0.2); B.anim(4, rng() * 6.283, 0);
      B.blob(0, 2.5, 0, 1.25, C('#5f8f4b')); B.blob(-0.75, 3.0, 0.35, 0.85, C('#6d9a54')); B.blob(0.75, 2.8, -0.35, 0.85, C('#57853f')); B.blob(0.2, 3.5, 0, 0.72, C('#6d9a54')); B.anim(0, 0, 0); break;
    }
    case 'solar-pergola': {                                                                         // a shade structure of solar panels on slim posts, with a bench under it
      const post = C('#8a8f96');
      for (const [sx, sz] of [[-1.35, -0.85], [1.35, -0.85], [-1.35, 0.85], [1.35, 0.85]]) B.cyl(sx, 0, sz, 0.08, 2.3, 6, post, false, 0.08);
      B.box(0, 2.3, 0, 3.1, 0.1, 2.1, C('#2a3550'));
      for (let i = -1; i <= 1; i++) B.box(i * 0.95, 2.42, 0, 0.82, 0.04, 1.8, C('#24406e'));
      B.box(0, 0.35, 0, 1.6, 0.1, 0.4, C('#7a5c3a')); B.box(0, 0.55, -0.15, 1.6, 0.4, 0.08, C('#7a5c3a')); for (const sx of [-0.7, 0.7]) B.box(sx, 0, 0, 0.1, 0.35, 0.36, C('#5a4030')); break;
    }
    case 'bollard': B.cyl(0, 0, 0, 0.09, 0.7, 8, C('#3a4046')); B.cyl(0, 0.7, 0, 0.1, 0.06, 8, C('#2ac6e0'), true); break;
    case 'cenotaph': {                                                                              // a war memorial: stepped stone plinth, tall pylon, cross of sacrifice, a wreath
      B.boxT('stone', 0, 0, 0, 1.9, 0.3, 1.9, WHITE); B.boxT('stone', 0, 0.3, 0, 1.45, 0.3, 1.45, WHITE); B.boxT('stone', 0, 0.6, 0, 1.05, 0.28, 1.05, WHITE);
      B.boxT('stone', 0, 0.88, 0, 0.72, 1.5, 0.72, WHITE); B.boxT('stone', 0, 2.38, 0, 0.62, 1.1, 0.62, shade(WHITE, 0.97)); B.boxT('stone', 0, 3.48, 0, 0.7, 0.14, 0.7, shade(WHITE, 0.95));
      const st = C('#cbc2ab'); B.box(0, 3.62, 0, 0.14, 0.8, 0.14, st); B.box(0, 3.98, 0, 0.5, 0.14, 0.14, st);   // cross of sacrifice
      B.box(0, 1.05, 0.53, 0.5, 0.36, 0.04, C('#3a4236'));                                          // bronze dedication plaque
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832; B.blob(Math.cos(a) * 0.22, 1.55 + Math.sin(a) * 0.22, 0.56, 0.07, C(i % 3 ? '#3a6a3a' : '#b22a2a')); } break;   // remembrance wreath
    }
    default: break;
  }
}
/* a drooping string of triangular flags across the square — only the busy
 * market days get it, so the quiet years (plague, war) read bare by contrast */
/* one continuous garland along a whole run: flags every ~0.34 with a cord
 * between each, dipping in regular repeating scallops — no breaks, and cord and
 * flags oriented along the run so it drapes straight, not diagonally */
function bunting(B, x0, z0, x1, z1, y, cols) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), alongX = Math.abs(dx) >= Math.abs(dz);
  const step = 0.34, n = Math.round(len / step), sag = 0.42, period = 2.5;
  let px = 0, pz = 0, py = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + dx * t, z = z0 + dz * t, fy = y - sag * Math.abs(Math.sin(len * t / period * Math.PI));
    if (i > 0) { const mx = (px + x) / 2, mz = (pz + z) / 2, my = (py + fy) / 2; if (alongX) B.box(mx, my, mz, step, 0.025, 0.025, C('#4a3a26')); else B.box(mx, my, mz, 0.025, 0.025, step, C('#4a3a26')); }
    B.anim(2, i * 0.6, 0);
    if (alongX) B.tri(x - 0.1, fy, z, x + 0.1, fy, z, x, fy - 0.24, z, C(cols[i % cols.length]));
    else B.tri(x, fy, z - 0.1, x, fy, z + 0.1, x, fy - 0.24, z, C(cols[i % cols.length]));
    B.anim(0, 0, 0);
    px = x; pz = z; py = fy;
  }
}
/* café terrace: a couple of round tables with a parasol and chairs */
function cafeSet(B, rng) {
  const pal = ['#c94a4a', '#3a7a4a', '#3a6ab2', '#c8902a'][(rng() * 4) | 0];
  for (const [tx, tz] of [[-0.7, 0], [0.7, 0.3]]) {
    B.cyl(tx, 0, tz, 0.06, 0.7, 6, C('#5a5f66'), false, 0.06); B.cyl(tx, 0.7, tz, 0.4, 0.06, 10, C('#e8e4d8'), false, 0.4);
    for (const [dx, dz] of [[0.4, 0], [-0.4, 0], [0, 0.4]]) { B.box(tx + dx, 0, tz + dz, 0.28, 0.42, 0.28, C('#4a4036')); B.box(tx + dx, 0.42, tz + dz + (dz ? -0.13 : 0), 0.28, 0.36, 0.06, C('#4a4036')); }
  }
  B.cyl(0, 0, 0.15, 0.05, 2.2, 6, C('#8a8378'), false, 0.05);                    // parasol pole
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832; B.tri(0, 2.2, 0.15, Math.cos(a) * 1.1, 1.85, 0.15 + Math.sin(a) * 1.1, Math.cos(a + 1.05) * 1.1, 1.85, 0.15 + Math.sin(a + 1.05) * 1.1, C(i % 2 ? pal : '#e8e4d8')); }
}
/* raised urban-farm bed with rows of crops */
function farmBed(B, rng) {
  B.boxT('wood', 0, 0, 0, 1.8, 0.44, 0.9, WHITE);
  B.box(0, 0.44, 0, 1.7, 0.06, 0.8, C('#3a2e22'));                               // soil
  const crops = ['#5f8f4b', '#6d9a54', '#7aa03a', '#4a7a2a'], flow = ['#c94a5a', '#d8b83a', '#c96a3a', '#b06ac0', '#e0902a'];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
    const x = -0.75 + i * 0.3, z = -0.28 + r * 0.28;
    B.blob(x, 0.6, z, 0.12 + rng() * 0.04, C(crops[(r + i) % crops.length]));
    if (rng() < 0.4) B.blob(x, 0.72, z, 0.06, C(flow[(rng() * flow.length) | 0]));
  }
}
/* a trestle produce table piled with colourful goods under a small awning */
function produceTable(B, rng) {
  for (const sx of [-0.7, 0.7]) { B.box(sx, 0, -0.3, 0.08, 0.7, 0.08, C('#5a4030')); B.box(sx, 0, 0.3, 0.08, 0.7, 0.08, C('#5a4030')); }
  B.boxT('wood', 0, 0.7, 0, 1.7, 0.1, 0.8, WHITE);
  const goods = ['#c94a3a', '#e0902a', '#4a7a2a', '#d8c23a', '#8a3a2a', '#c8b048', '#7a9a3a', '#b0402a'];
  for (let i = 0; i < 10; i++) B.blob(-0.75 + (i % 5) * 0.36, 0.86, -0.2 + ((i / 5) | 0) * 0.36, 0.13 + rng() * 0.05, C(goods[(rng() * goods.length) | 0]));
  if (rng() < 0.6) for (let i = 0; i < 4; i++) B.gable(-0.6 + i * 0.42, 1.5, 0, 0.44, 0.3, 1.0, C(rng() < 0.5 ? '#d8d2c2' : (i % 2 ? '#b23a3a' : '#e8e4d8')));
}
function tree(B, rng, neon) {
  B.cyl(0, 0, 0, 0.16, 1.1 + rng() * 0.4, 6, C(neon ? '#1a2436' : '#6b4f34'), false, 0.13);
  const gy = 1.3 + rng() * 0.3, green = neon ? C(['#43e0ff', '#4dff9e', '#b98cff'][(rng() * 3) | 0]) : shade(['#5f8f4b', '#6d9a54', '#57853f'][(rng() * 3) | 0], 0.95 + rng() * 0.1);
  B.anim(4, rng() * 6.283, 0);                                   // crown sways in the wind
  B.blob(0, gy, 0, 0.7 + rng() * 0.2, green, neon); B.blob((rng() - .5) * .6, gy + 0.4, (rng() - .5) * .6, 0.5, green, neon); B.blob((rng() - .5) * .6, gy - 0.1, (rng() - .5) * .6, 0.55, green, neon);
  B.anim(0, 0, 0);
}
function stall(B, rng) {
  for (const [sx, sz] of [[-0.7, -0.5], [0.7, -0.5], [-0.7, 0.5], [0.7, 0.5]]) B.box(sx, 0, sz, 0.09, 1.5, 0.09, C('#6b4f34'));
  B.boxT('wood', 0, 0.75, 0.5, 1.6, 0.12, 0.55, WHITE);
  const two = rng() < 0.5 ? ['#b23a3a', '#e8e4d8'] : ['#3a6ab2', '#e8e4d8'];
  for (let i = -2; i <= 1; i++) B.gable(i * 0.42 + 0.21, 1.5, 0, 0.44, 0.35, 1.5, C(two[(i + 2) % 2]));
  for (let i = 0; i < 3; i++) B.box(-0.5 + i * 0.5, 0.87, 0.5, 0.16, 0.16, 0.16, C(['#c94a3a', '#e0902a', '#4a7a2a'][i]));
}
function cart(B, loaded, cab) {
  B.boxT('wood', 0, 0.4, 0, 1.4, 0.25, 0.8, WHITE);
  for (const [wx, wz] of [[0.5, 0.45], [0.5, -0.45], [-0.5, 0.45], [-0.5, -0.45]]) B.cyl(wx, 0, wz, 0.3, 0.12, 8, C('#4a3826'));
  B.box(0.9, 0.3, 0, 0.9, 0.08, 0.12, C('#6b4f34'));
  if (loaded) for (let i = 0; i < 3; i++) B.boxT('wood', -0.4 + i * 0.4, 0.55, 0, 0.34, 0.34, 0.6, WHITE);
  if (cab) { B.box(0, 0.55, 0, 0.9, 0.9, 0.75, C('#3a2f4a')); B.box(0, 0.9, 0.38, 0.5, 0.4, 0.05, C('#8fb4c8')); }
}
function animal(B, hex, s) {
  B.at(0, 0, 0, 0, s);
  B.box(0, 0.55, 0, 1.0, 0.5, 0.4, C(hex)); B.box(0.55, 0.7, 0, 0.3, 0.5, 0.32, C(hex)); B.box(0.72, 0.85, 0, 0.34, 0.28, 0.28, C(hex));
  for (const [lx, lz] of [[0.35, 0.15], [0.35, -0.15], [-0.35, 0.15], [-0.35, -0.15]]) B.box(lx, 0, lz, 0.12, 0.55, 0.12, C(hex));
  B.pop();
}
function lamp(B, night, hex) { B.cyl(0, 0, 0, 0.1, 2.6, 8, C('#3a3f46'), false, 0.08); B.box(0, 2.6, 0, 0.34, 0.34, 0.34, C('#2a2e33')); B.box(0, 2.66, 0, 0.24, 0.24, 0.24, night > 0.02 ? C(hex) : C('#c9c2a8'), night > 0.02); }
function tram(B, modern, night) {
  for (const rz of [0.5, -0.5]) B.box(0, 0.03, rz, 9, 0.06, 0.07, C('#9aa0a6'));                 // two steel rails along the run
  for (let s = -4; s <= 4; s += 1.2) B.box(s, 0.015, 0, 0.16, 0.05, 1.3, C('#4a4438'));          // sleepers
  B.box(0, 0.4, 0, 3.2, 1.4, 1.1, C(modern ? '#c23a3a' : '#3a6a4a')); B.box(0, 0.1, 0, 3.0, 0.3, 1.15, C('#2a2e33'));
  for (let i = -2; i <= 2; i++) B.box(i * 0.6, 1.0, 0.56, 0.42, 0.5, 0.04, night > .05 ? C(WARM) : C('#bcd0d8'), night > .05);
  for (const wx of [1.1, -1.1]) { B.cyl(wx, 0, 0.4, 0.22, 0.1, 8, C('#20242a')); B.cyl(wx, 0, -0.4, 0.22, 0.1, 8, C('#20242a')); }
  const wy = 3.1;
  B.box(0, wy, 0, 9, 0.035, 0.035, C('#2a2e33'));                                                // overhead contact wire
  B.box(-3.4, 0, -1.5, 0.12, wy + 0.2, 0.12, C('#4a4f56')); B.box(-3.4, wy, -0.75, 0.09, 0.07, 1.6, C('#4a4f56'));   // catenary pole + bracket arm
  if (modern) { B.box(0, 1.78, 0, 0.5, 0.05, 0.06, C('#39424c')); for (const s of [-0.2, 0.2]) B.box(s, 2.42, 0, 0.05, 1.3, 0.05, C('#5a616a')); B.box(0, wy - 0.06, 0, 0.7, 0.05, 0.06, C('#39424c')); }   // pantograph
  else { B.box(0, 2.42, 0, 0.05, 1.3, 0.05, C('#39424c')); B.box(0, wy - 0.06, 0, 0.3, 0.05, 0.06, C('#39424c')); }   // trolley pole
}
/* a small glass café pavilion: glazed box with a flush sign band, warm interior,
 * and a terrace of parasol tables out front (no fabric awning). The terrace is
 * the clear "café" read the bare glass box was missing. */
function glassCafe(B, night) {
  const glassCol = night > .05 ? C('#243a44') : C('#bfe0e8'), frame = C('#b4bac0');
  const gw = 1.9, gh = 2.0, gd = 1.5, e = 0.03;
  B.box(0, 0, 0, gw, gh, gd, frame);
  B.qUV('glass', [-gw / 2 + 0.12, 0.12, gd / 2 + e], [gw / 2 - 0.12, 0.12, gd / 2 + e], [gw / 2 - 0.12, gh - 0.45, gd / 2 + e], [-gw / 2 + 0.12, gh - 0.45, gd / 2 + e], [0, 0], [1, 0], [1, 1], [0, 1], glassCol);
  B.qUV('glass', [gw / 2 + e, 0.12, gd / 2 - 0.12], [gw / 2 + e, 0.12, -gd / 2 + 0.12], [gw / 2 + e, gh - 0.45, -gd / 2 + 0.12], [gw / 2 + e, gh - 0.45, gd / 2 - 0.12], [0, 0], [1, 0], [1, 1], [0, 1], glassCol);
  for (const px of [-gw / 2, 0, gw / 2]) B.box(px, 0, gd / 2, 0.06, gh - 0.35, 0.06, frame);
  B.box(0, gh, 0, gw + 0.3, 0.12, gd + 0.3, frame);
  if (night > .05) B.box(0, 0.9, 0, gw * 0.8, 1.0, gd * 0.8, C(WARM), true);
  B.box(0, gh - 0.32, gd / 2 + 0.055, gw - 0.1, 0.26, 0.04, C('#2f3a44')); B.box(0, gh - 0.32, gd / 2 + 0.075, gw - 0.4, 0.16, 0.02, C('#d8b24a'), true);   // flush sign band, lit lettering strip
  for (const [tx, tz] of [[-1.2, 1.35], [1.2, 1.6]]) {
    B.cyl(tx, 0, tz, 0.05, 0.7, 8, C('#8a8f96'), false, 0.05); B.cyl(tx, 0.7, tz, 0.34, 0.05, 10, C('#e8e4d8'), false, 0.34);
    for (const dx of [0.4, -0.4]) { B.box(tx + dx, 0, tz, 0.2, 0.38, 0.2, C('#4a4f56')); B.box(tx + dx + (dx > 0 ? -0.08 : 0.08), 0.38, tz, 0.05, 0.32, 0.2, C('#4a4f56')); }
    B.cyl(tx, 0, tz, 0.04, 2.05, 6, C('#8a8f96'), false, 0.04);                                    // parasol pole
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832; B.tri(tx, 2.05, tz, tx + Math.cos(a) * 0.8, 1.74, tz + Math.sin(a) * 0.8, tx + Math.cos(a + 1.05) * 0.8, 1.74, tz + Math.sin(a + 1.05) * 0.8, C(i % 2 ? '#4a7a5a' : '#e8e4d8')); }   // parasol
  }
}
function car(B, rng, night) {
  const hex = ['#3a6ab2', '#b23a3a', '#e8e4d8', '#39424c', '#3a8a6a'][(rng() * 5) | 0];
  B.box(0, 0.28, 0, 2.0, 0.5, 0.9, C(hex)); B.box(0.05, 0.72, 0, 1.1, 0.42, 0.82, shade(hex, 1.05)); B.box(0.05, 0.78, 0, 1.05, 0.3, 0.86, night > .05 ? C('#1a2230') : C('#8fb4c8'));
  for (const [wx, wz] of [[0.7, 0.46], [0.7, -0.46], [-0.7, 0.46], [-0.7, -0.46]]) B.cyl(wx, 0, wz, 0.24, 0.14, 8, C('#20242a'));
  for (const sx of [0.3, -0.3]) B.box(1.02, 0.3, sx, 0.06, 0.14, 0.14, night > .05 ? C('#fff2c0') : C('#d8d2c2'), night > .05);
}
function bike(B) { for (const wx of [0.4, -0.4]) B.cyl(wx, 0, 0, 0.28, 0.06, 8, C('#20242a')); B.box(0, 0.5, 0, 0.7, 0.08, 0.08, C('#8a2a2a')); B.box(-0.4, 0.5, 0, 0.08, 0.5, 0.08, C('#8a2a2a')); B.box(0.4, 0.6, 0, 0.08, 0.5, 0.08, C('#8a2a2a')); }

/* a fenced kitchen garden on a lot the town has not built on yet */
function garden(B, w, rng) {
  const fz = 1.5;
  for (let i = 0; i <= 6; i++) B.box(-w / 2 + w * i / 6, 0, fz, 0.05, 0.5, 0.05, C('#6b4f34'));
  B.box(0, 0.26, fz, w, 0.05, 0.05, C('#5a4030'));
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) B.blob(-w / 2 + 0.5 + i * (w - 1) / 3, 0.16, fz - 0.6 - r * 0.6, 0.13, C(['#5f8f4b', '#6d9a54', '#7aa03a'][(r + i) % 3]));
  B.at((rng() - .5) * w * 0.4, 0, -0.6); tree(B, rng, false); B.pop();
}
/* the curated rural scene for the village (to 1150): a covered well at the
 * heart, goods on trestle tables (no covered stalls), fuel and fodder grouped
 * by the track, a cart and livestock, a couple of trees, lots of open ground */
function villageContent(B, era, rng, night) {
  B.at(0.8, 0, 2.6); prop(B, 'well', rng, night); B.pop();
  for (const [x, z, r] of [[-3.0, 3.6, 0.3], [2.8, 3.0, -0.2]]) { B.at(x, 0, z, r); prop(B, 'table', rng, night); B.pop(); }
  B.at(-4.3, 0, 5.2); prop(B, 'firewood', rng, night); B.pop();
  B.at(-3.1, 0, 5.9); prop(B, 'hay', rng, night); B.pop();
  B.at(-2.2, 0, 5.4); prop(B, 'crates', rng, night); B.pop();
  B.at(-3.9, 0, 6.5); prop(B, 'barrel', rng, night); B.pop();
  B.at(3.4, 0, 5.6, Math.PI / 2); prop(B, 'loadcart', rng, night); B.pop();
  B.at(2.2, 0, 6.3, -Math.PI / 3); prop(B, 'horse', rng, night); B.pop();
  B.at(3.9, 0, 6.7); prop(B, 'pig', rng, night); B.pop();
  B.at(1.3, 0, 5.7); prop(B, 'dog', rng, night); B.pop();
  for (const [x, z] of [[-4.6, 2.2], [4.4, 3.8]]) { B.at(x, 0, z); prop(B, 'tree', rng, night); B.pop(); }
}

/* the medieval market (1200 to 1450): two tidy rows of stalls down a clear
 * aisle, the market cross as the focal point in front, every loose good pulled
 * into one zone at the front-left, a cart and a well, trees on the open side */
function marketContent(B, era, rng, night) {
  const xs = [-3.2, -1.1, 1.0, 3.1];
  for (const sx of xs) { B.at(sx, 0, -0.6, 0); prop(B, 'stall', rng, night); B.pop(); }
  for (const sx of xs) { B.at(sx, 0, 1.7, Math.PI); prop(B, 'stall', rng, night); B.pop(); }
  B.at(1.0, 0, 3.5); prop(B, 'cross', rng, night); B.pop();
  for (const [x, z, r] of [[-3.9, 4.2, 0.2], [-3.5, 5.2, -0.2]]) { B.at(x, 0, z, r); prop(B, 'table', rng, night); B.pop(); }
  B.at(-2.5, 0, 4.7); prop(B, 'crates', rng, night); B.pop();
  B.at(-4.5, 0, 5.4); prop(B, 'hay', rng, night); B.pop();
  B.at(-4.4, 0, 4.4); prop(B, 'barrel', rng, night); B.pop();
  B.at(-1.8, 0, 6.5, Math.PI / 2); prop(B, 'loadcart', rng, night); B.pop();
  B.at(-3.8, 0, 2.2); prop(B, 'well', rng, night); B.pop();
  for (const [x, z] of [[4.6, 4.6], [4.4, 2.4], [3.2, 6.2]]) { B.at(x, 0, z); prop(B, 'tree', rng, night); B.pop(); }
}

/* the ornamental fountain square (1500 to 1750): a stone fountain at the heart
 * with animated water, benches ringed to face it, trees in a formal quincunx,
 * lamps and a carriage once the town lights and coaches its streets. No stalls,
 * no bunting, no livestock — a promenade, not a market. */
function fountainSquareContent(B, era, rng, night) {
  const y = era.year;
  B.at(0.5, 0, 2.6); prop(B, 'fountain', rng, night); B.pop();
  B.at(0.5, 0, 5.4, Math.PI); prop(B, 'bench', rng, night); B.pop();
  B.at(0.5, 0, -0.2, 0); prop(B, 'bench', rng, night); B.pop();
  B.at(-2.6, 0, 2.6, Math.PI / 2); prop(B, 'bench', rng, night); B.pop();
  B.at(3.6, 0, 2.6, -Math.PI / 2); prop(B, 'bench', rng, night); B.pop();
  for (const [x, z] of [[-3.6, 5.2], [4.5, 5.2], [-3.6, 0.0], [4.5, 0.0]]) { B.at(x, 0, z); prop(B, 'tree', rng, night); B.pop(); }
  if (y >= 1700) { for (const [x, z] of [[-1.6, 4.2], [2.6, 4.2], [5.6, 2.6], [-4.2, 5.6]]) { B.at(x, 0, z); prop(B, 'lamp-oil', rng, night); B.pop(); } B.at(-4.5, 0, 9.9); prop(B, 'carriage', rng, night); B.pop(); }
}

/* the industrial / Victorian square (1800 to 1900): a civic statue at the heart
 * instead of a fountain, a cast-iron bandstand with its own little audience, a
 * Morris column, street vendors (flowers, roast chestnuts, newspapers), a
 * drinking fountain and a horse trough, gas then electric lamps, a tram from
 * mid-century and cabs out on the road. Busy on purpose, and wrapped in the low
 * industrial haze the fog lays over these years. */
function industrialContent(B, era, rng, night) {
  const y = era.year;
  if (y <= 1800) return georgianContent(B, era, rng, night);                                        // 1800 is still a quiet Georgian square
  /* 1850 / 1900, high Victorian to Edwardian: the bandstand is the clear focus,
   * a monument and a single vendor to the sides, kept deliberately uncluttered */
  const lampK = y >= 1900 ? 'lamp-electric' : 'lamp-gas';
  B.at(0.5, 0, 0.8); prop(B, 'bandstand', rng, night); B.pop();                                     // centrepiece
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832; B.at(0.5 + Math.cos(a) * 2.2, 0, 0.8 + Math.sin(a) * 2.2, rng() * 6.28); person(B, rng); B.pop(); }   // its audience
  B.at(-4.2, 0, 4.4); prop(B, 'statue', rng, night); B.pop();                                       // a monument, off to one side
  B.at(4.3, 0, 2.4); prop(B, y >= 1900 ? 'newsstand' : 'ad-column', rng, night); B.pop();           // a Morris column, a newsstand by 1900
  B.at(2.8, 0, 5.2, 0.4); prop(B, 'chestnut-cart', rng, night); B.pop();                            // a single vendor
  B.at(1.9, 0, 6.0, rng() * 6.28); person(B, rng); B.pop();
  for (const [x, z, r] of [[0.5, 5.2, Math.PI], [-3.4, 0.8, Math.PI / 2], [4.4, 5.2, Math.PI]]) { B.at(x, 0, z, r); prop(B, 'bench', rng, night); B.pop(); }
  for (const [x, z] of [[-4.7, -3.0], [4.7, -2.6], [-4.9, 4.4], [4.6, 0.2]]) { B.at(x, 0, z); prop(B, 'tree', rng, night); B.pop(); }
  for (const [x, z] of [[-2.6, -2.2], [3.0, -1.4], [-3.8, 5.6], [1.4, 6.4]]) { B.at(x, 0, z); prop(B, lampK, rng, night); B.pop(); }
  B.at(0.5, 0, 10.0); prop(B, 'tram', rng, night); B.pop();
  B.at(-4.5, 0, 9.9); prop(B, 'carriage', rng, night); B.pop();
  B.at(5.5, 0, 9.9, Math.PI); prop(B, 'cart', rng, night); B.pop();
  B.at(-1.4, 0, 6.9, -Math.PI / 3); prop(B, 'dog', rng, night); B.pop();
}
/* 1800, the first chimney: still a late-Georgian civic square, formal and sparse.
 * A single statue at the heart, benches ringing it, oil lamps and trees at the
 * corners, a coach and a cart on the road. No bandstand or gaslight yet, so it
 * reads clearly apart from the busy, smoky 1850. */
function georgianContent(B, era, rng, night) {
  B.at(0.5, 0, 1.5); prop(B, 'statue', rng, night); B.pop();                                        // the square's single focus
  for (const [x, z, r] of [[0.5, -2.2, 0], [0.5, 5.2, Math.PI], [-3.2, 1.5, Math.PI / 2], [4.2, 1.5, -Math.PI / 2]]) { B.at(x, 0, z, r); prop(B, 'bench', rng, night); B.pop(); }
  for (const [x, z] of [[-3.6, -2.6], [3.6, -2.6], [-4.2, 5.0], [4.6, 5.0]]) { B.at(x, 0, z); prop(B, 'lamp-oil', rng, night); B.pop(); }
  for (const [x, z] of [[-4.7, -3.2], [4.7, -3.0], [-4.9, 4.2], [4.7, 4.4]]) { B.at(x, 0, z); prop(B, 'tree', rng, night); B.pop(); }
  B.at(-4.5, 0, 9.9); prop(B, 'carriage', rng, night); B.pop();
  B.at(0.6, 0, 10.0, Math.PI); prop(B, 'loadcart', rng, night); B.pop();
  B.at(5.5, 0, 9.9, Math.PI); prop(B, 'cart', rng, night); B.pop();
  B.at(-1.6, 0, 6.6, -Math.PI / 3); prop(B, 'dog', rng, night); B.pop();
}

/* the post-war civic square (1950): a war memorial at the heart in place of the
 * statue, the motor age arriving with cars parked and moving, the first traffic
 * controls, a red phone box, a bus shelter and a newsstand, benches and pavement
 * trees. Sober and thinned out after the war; the bomb gap stays open in the
 * terrace behind, with the reconstruction crane rising over it. */
function civicContent(B, era, rng, night) {
  B.at(0.5, 0, 1.0); prop(B, 'cenotaph', rng, night); B.pop();                                      // centrepiece, central in the plaza's depth
  B.at(-4.5, 0, 9.5, 0.05); prop(B, 'car', rng, night); B.pop();                                    // the motor age: kerbside and moving
  B.at(2.5, 0, 10.2, Math.PI); prop(B, 'car', rng, night); B.pop();
  B.at(9.6, 0, 1.6, Math.PI / 2); prop(B, 'car', rng, night); B.pop();
  B.at(9.6, 0, 5.2, Math.PI / 2); prop(B, 'car', rng, night); B.pop();
  B.at(6.8, 0, 7.4); prop(B, 'traffic-light', rng, night); B.pop();
  B.at(-4.6, 0, 5.0); prop(B, 'phone-box', rng, night); B.pop();
  B.at(-2.6, 0, 6.4, 0.2); prop(B, 'bus-shelter', rng, night); B.pop();
  B.at(3.8, 0, 6.2); prop(B, 'kiosk', rng, night); B.pop();
  B.at(0.5, 0, -2.4, 0); prop(B, 'bench', rng, night); B.pop();                                     // seating spread front to back
  B.at(-3.6, 0, 1.6, Math.PI / 2); prop(B, 'bench', rng, night); B.pop();
  B.at(2.4, 0, 4.6, -Math.PI / 2); prop(B, 'bench', rng, night); B.pop();
  for (const [x, z] of [[-4.4, -3.0], [-4.8, 3.0], [4.6, 3.6], [4.6, -0.4]]) { B.at(x, 0, z); prop(B, 'tree', rng, night); B.pop(); }   // trees to the back corners and sides
  for (const [x, z] of [[-1.8, 3.6], [2.4, 0.0], [-0.6, 5.6]]) { B.at(x, 0, z); prop(B, 'planter', rng, night); B.pop(); }
  for (const [x, z] of [[-2.6, -1.6], [1.4, -1.0], [-1.0, 1.2]]) { B.at(x, 0, z, rng() * 6.28); person(B, rng); B.pop(); }   // strollers deeper in
}

/* the pedestrianised, contemporary square (2000): the classical fountain gives
 * way to a steel-and-glass artwork on a reflecting pool, glass café pavilions,
 * digital screen pylons, a line of LED bollards holding the car-free edge, a
 * bike-share rack, a modern tram out on the road. The cathedral is gone by now,
 * a glass block on its footprint, so the square reads as modernity taking over. */
function plazaContent(B, era, rng, night) {
  B.at(0.5, 0, 1.2); prop(B, 'sculpture', rng, night); B.pop();                                     // one clear focus, on open paving
  B.at(3.6, 0, -3.4); prop(B, 'glass-pavilion', rng, night); B.pop();                               // the café pushed to the back of the square, right under the glass tower
  B.at(-3.8, 0, 2.4); prop(B, 'screen-pylon', rng, night); B.pop();                                 // two screens, well apart
  B.at(2.6, 0, 3.8); prop(B, 'screen-pylon', rng, night); B.pop();
  for (let i = 0; i < 6; i++) { B.at(-4.2 + i * 1.7, 0, 7.4); prop(B, 'bollard', rng, night); B.pop(); }   // LED edge, car-free
  for (let i = 0; i < 3; i++) { B.at(7.2, 0, 0.4 + i * 2.4); prop(B, 'bollard', rng, night); B.pop(); }
  B.at(2.4, 0, 6.2); prop(B, 'kiosk', rng, night); B.pop();                                         // kiosk and bikes kept out of the left corner
  B.at(5.2, 0, 5.2); prop(B, 'bike-rack', rng, night); B.pop();
  for (const [x, z, r] of [[0.5, 5.8, Math.PI], [-4.4, 4.2, Math.PI / 2]]) { B.at(x, 0, z, r); prop(B, 'bench', rng, night); B.pop(); }
  for (const [x, z] of [[-4.7, -2.8], [5.4, 1.0], [-2.4, 6.4]]) { B.at(x, 0, z); prop(B, 'tree-box', rng, night); B.pop(); }   // greenery at the corners, centre kept open
  for (const [x, z] of [[-2.6, 3.6], [1.4, -0.4]]) { B.at(x, 0, z, rng() * 6.28); person(B, rng); B.pop(); }
  B.at(0.5, 0, 10.0); prop(B, 'tram-modern', rng, night); B.pop();                                  // modern transit and a rare car, out on the road
  B.at(10.0, 0, 3.8, Math.PI / 2); prop(B, 'car', rng, night); B.pop();                              // the car over on the right-hand road, away from the tram
}

/* the garden city (2050): the concrete-and-glass town of 2000 retrofitted green.
 * A landmark tree with a ring bench holds the centre, raised vegetable beds are
 * scattered across the quadrants, a solar pergola shades seating on the left, a
 * café terrace sits by the tower on the right, and charging and e-bikes serve the
 * mostly car-free edges. Spread wide and kept open. */
function gardenCityContent(B, era, rng, night) {
  B.at(0.5, 0, 1.0); prop(B, 'ring-tree', rng, night); B.pop();                                     // landmark tree at the heart
  B.at(-3.4, 0, -2.6, 0); prop(B, 'farmbed', rng, night); B.pop();                                  // vegetable beds, one per quadrant
  B.at(2.8, 0, -2.6, Math.PI / 2); prop(B, 'farmbed', rng, night); B.pop();
  B.at(-2.4, 0, 5.4, 0); prop(B, 'farmbed', rng, night); B.pop();
  B.at(-4.0, 0, 2.0, Math.PI / 2); prop(B, 'solar-pergola', rng, night); B.pop();                   // pergola on the left
  B.at(3.9, 0, 2.2); prop(B, 'cafe', rng, night); B.pop();                                          // café terrace by the tower
  B.at(-4.4, 0, 5.8); prop(B, 'bike-rack', rng, night); B.pop();                                    // e-bikes and charging at opposite edges
  B.at(4.6, 0, 5.6); prop(B, 'charger', rng, night); B.pop();
  for (const [x, z, r] of [[0.5, 6.0, Math.PI], [-4.4, -0.4, Math.PI / 2], [4.6, -0.2, -Math.PI / 2]]) { B.at(x, 0, z, r); prop(B, 'bench', rng, night); B.pop(); }
  for (const [x, z] of [[-4.8, -3.4], [4.8, -3.2], [-4.9, 3.8], [4.8, 4.4], [1.6, 6.2]]) { B.at(x, 0, z); prop(B, 'tree', rng, night); B.pop(); }
  for (const [x, z] of [[-2.0, -0.4], [2.0, 0.6], [-1.2, 3.4], [3.0, 4.4]]) { B.at(x, 0, z, rng() * 6.28); person(B, rng); B.pop(); }
  B.at(10.0, 0, 4.0, Math.PI / 2); prop(B, 'car', rng, night); B.pop();                             // a rare EV on the right-hand road
}

/* --------------------------------------------------------------- townsfolk */
const CLOTH = ['#3f4a5a', '#6b3a3a', '#4a5a3a', '#5a4a6b', '#2f3136', '#7a6a4a', '#8a4a3a', '#3a5a6a'];
function person(B, rng) {
  B.anim(1, rng() * 6.283, 0);                                   // idle bob + sway, unique phase
  B.box(0, 0, 0, 0.34, 0.5, 0.24, C(CLOTH[(rng() * CLOTH.length) | 0]));
  B.box(0, 0.5, 0, 0.4, 0.42, 0.26, C(CLOTH[(rng() * CLOTH.length) | 0]));
  B.box(0, 0.92, 0, 0.24, 0.24, 0.22, C('#e8bd96'));
  if (rng() < 0.3) B.box(0, 1.1, 0, 0.3, 0.12, 0.28, C('#4a3826'));
  B.anim(0, 0, 0);
}

/* ---------------------------------------------------------------- the plan */
/* The square is authored once: fixed lots on two terraces meeting at the back
 * left, fixed prop stations. An era only restyles the same buildings. Widths,
 * gables, heights and roles are fixed arrays, so the composition never changes,
 * only ages. A tiny per-lot seeded rng adds grain (shade, window lighting),
 * never position. */
const BACK = -7.0, LEFTX = -7.0;
/* [width, gableToStreet, storeyDelta, dormerX|0, chimneyX, role] along a run.
 * The storey deltas are authored, not random, to give a deliberate, uneven but
 * organised roofline: a couple of tall accents, one civic tower, a few low
 * houses between. role: '' normal, 'tall', 'low', 'civic' (a clock tower). */
/* a 7th field `since` = the year the lot is first built; before it the lot is a
 * garden, so the village is sparse and the town visibly fills in over time. */
const BACK_LOTS = [
  [2.4, 1, 0, 0, 0.5, ''], [2.0, 0, -1, 0, -0.4, 'low'], [2.8, 0, 1, 0.6, 0.6, '', 1250], [2.2, 1, 2, 0, 0, 'tall'],
  [3.0, 0, 0, 0.7, 0.5, 'civic'], [2.2, 1, 0, 0, -0.3, ''], [2.6, 0, 1, 0.6, 0.6, ''], [2.0, 1, -1, 0, 0, 'low', 1200], [2.6, 0, 0, -0.4, 0.4, ''],
];
const LEFT_LOTS = [
  [2.5, 0, 1, 0.5, 0.5, ''], [2.8, 1, 0, 0, -0.4, ''], [2.2, 0, 2, 0, 0.3, 'tall'], [3.0, 1, 0, 0.6, 0.6, ''], [2.4, 0, -1, -0.5, 0, 'low', 1200], [2.4, 1, 1, 0, 0.4, ''],
];
/* fixed prop stations in the plaza */
const STALL_ROWS = [-3.7, -1.85, 0, 1.85, 3.7];
const TREE_SPOTS = [[-4.7, 5.3], [4.9, 4.9], [-1.6, 6.3], [2.3, 6.1]];
const LAMP_SPOTS = [[6.4, -3], [6.4, 0.2], [6.4, 3.4], [3, 6.6], [-1, 6.6]];
const BENCH_SPOTS = [[-4.4, 5.6, Math.PI], [5.6, 2.6, -Math.PI / 2], [0.2, 6.2, Math.PI]];
const VEH_LANE = [[-4.5, 9.9], [0.5, 10.0], [5.5, 9.9]];          // out on the front road
const CAFE_SPOTS = [[-3.3, 4.6], [3.1, 5.2], [-0.4, 5.9], [4.4, 3.4]];
const FARM_SPOTS = [[-3.4, 4.3], [-0.7, 5.4], [2.4, 4.2], [-4.2, 5.9], [1.3, 6.2], [3.6, 5.6], [0.4, 3.4], [-1.9, 6.6]];
const CIVIC_SPOTS = [[4.7, 4.2], [-4.5, 4.6], [2.2, 6.4], [-2.0, 6.6], [5.4, 1.6]];
const CROWD_KNOTS = [[-3.7, 1.0], [-1.85, 1.1], [0, 0.9], [1.85, 1.1], [3.7, 1.0], [1.2, 4.6], [-2.4, 5.2], [3.4, 5.6]];

/* the street around the near edges of the square, from a dirt cart track to a
 * marked asphalt road with a pedestrian crossing and, by 2050, a cycle lane */
function road(B, era) {
  const y = era.year, asphalt = y >= 1950, dirt = y < 1200;
  const rk = asphalt ? 'concrete' : 'cobble';
  const col = dirt ? [0.52, 0.45, 0.34] : asphalt ? [0.34, 0.34, 0.36] : [0.82, 0.78, 0.7];
  const F = 8.4, R = 8.4, W = 3.4, E = 13;
  B.boxT(rk, 0, 0.015, F + W / 2, 2 * E, 0.03, W, col);
  B.boxT(rk, R + W / 2, 0.015, 0, W, 0.03, 2 * E, col);
  if (!dirt) { B.box(0, 0.02, F - 0.08, 2 * E, 0.18, 0.14, C('#b2ac9e')); B.box(R - 0.08, 0.02, 0, 0.14, 0.18, 2 * E, C('#b2ac9e')); }
  if (asphalt) {
    for (let x = -E + 1; x < E; x += 1.7) B.box(x, 0.035, F + W / 2, 0.8, 0.02, 0.12, C('#d8d2c2'));
    for (let z = -E + 1; z < E; z += 1.7) B.box(R + W / 2, 0.035, z, 0.12, 0.02, 0.8, C('#d8d2c2'));
    for (let i = 0; i < 7; i++) B.box(-1.5 + i * 0.5, 0.04, F + W / 2, 0.3, 0.02, W * 0.86, C('#ece7db'));   // crossing
    if (y >= 2050) { B.box(0, 0.03, F + 0.55, 2 * E, 0.02, 0.8, C('#33608f')); B.box(R + 0.55, 0.03, 0, 0.8, 0.02, 2 * E, C('#33608f')); }  // cycle lane
  }
  if (y >= 1700) { for (let x = -E + 1.5; x < E; x += 2.6) B.cyl(x, 0, F - 0.35, 0.09, 0.55, 6, C('#2f333a'), false, 0.07); for (let z = -E + 1.5; z < E; z += 2.6) B.cyl(R - 0.35, 0, z, 0.09, 0.55, 6, C('#2f333a'), false, 0.07); }
}

/* the wider town: a mass of simple rooftops receding into the haze behind the
 * two terraces, styled from the era's own material and roof, so the square never
 * floats — it sits in a city. Deterministic (position hash), and lit at night. */
function backdrop(B, era, churchZone) {
  const spec = era.house, mat = spec.material, roofS = spec.roof, night = era.night || 0;
  const wallK = mat === 'timber' ? 'plaster' : mat;
  const flat = roofS === 'flat' || roofS === 'green' || roofS === 'solar';
  const roofK = roofS === 'thatch' ? 'thatch' : (roofS === 'slate' || roofS === 'mansard') ? 'slate' : 'tile';
  const H = (a, b) => { const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return n - Math.floor(n); };
  const slots = [[-13, -12], [-17, -8], [-8, -17]];
  const near = (x, z) => slots.some(([sx, sz]) => Math.abs(x - sx) < 5.2 && Math.abs(z - sz) < 5.0) || (x > -8.6 && z > -8.6) || (churchZone && Math.abs(x - churchZone[0]) < 4.6 && Math.abs(z - churchZone[1]) < 5.2);   // keep clear of the landmarks, the square, and the church behind the terrace
  const house = (x, z) => {
    const r = H(x, z), r2 = H(x * 1.7 + 3, z * 0.9 - 2);
    const w = 1.9 + r * 1.3, h = 1.4 + r2 * (night > 0.3 ? 5.5 : 1.7), d = 1.9 + r2 * 1.1;   // a calm, low distant town by day (rises and lights up at night)
    const tint = [0.86 + r * 0.14, 0.86 + r * 0.14, 0.86 + r * 0.14];
    B.boxT(wallK, x, 0, z, w, h, d, tint);
    if (flat) { B.box(x, h, z, w + 0.1, 0.18, d + 0.1, [0.68, 0.68, 0.68]); if (roofS === 'green') B.blob(x + (r - .5), h + 0.4, z, 0.34, C('#5f8f4b')); if (roofS === 'solar') B.box(x, h + 0.16, z, w * 0.7, 0.05, d * 0.6, C('#1f3d6b')); }
    else B.gableT(roofK, x, h, z, w + 0.4, 0.6 + r2 * 0.5, d + 0.4, tint);
    if (r2 > 0.55) B.box(x + (r - 0.5) * w * 0.5, h + 0.5, z, 0.2, 0.6, 0.2, C(mat === 'brick' || mat === 'render' ? '#8a4a34' : '#7a5c3a'));
    if (night > 0.3) for (let f = 0; f < 3; f++) if (H(x + f * 3, z) > 0.45) B.box(x - w / 2 + 0.02, 0.6 + f * 0.7, z + (H(x, z + f) - .5) * d, 0.05, 0.3, 0.32, C('#ffdca0'), true);
  };
  for (let row = 0; row < 3; row++) for (let x = -15; x <= 15; x += 3.4) { const z = -9.8 - row * 3.3 + (H(x, row) - 0.5) * 0.6; if (!near(x, z)) house(x + (H(x + 9, row) - 0.5) * 0.6, z); }
  for (let row = 0; row < 2; row++) for (let z = -7; z <= 10; z += 3.4) { const x = -9.8 - row * 3.3 + (H(z, row + 5) - 0.5) * 0.6; if (!near(x, z)) house(x, z + (H(z + 3, row) - 0.5) * 0.6); }
}

export function buildEra(era, mats) {
  const B = new Builder();
  const rng = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)((era.year * 2654435761) >>> 0);
  const night = era.night || 0, spec = era.house;

  road(B, era);
  /* the church stands on the right-hand (back) terrace facing the square, in
   * place of the houses there; any other skyline marks stay in the background.
   * From 2000 the cathedral is gone, demolished, and a modern glass block takes
   * its footprint instead, so the same lots are still cleared for it. */
  const marks = era.skyline || [];
  const churchKind = marks.find(k => k === 'church' || k.startsWith('cathedral'));
  const churchGone = !churchKind && era.year >= 2000;
  const rightBlock = churchKind || (churchGone ? 'modern' : null);
  const CHX = 3.4, CHZ = -9.5;                        // right-hand landmark centre; its front lands on the terrace frontage
  backdrop(B, era, rightBlock ? [CHX, CHZ] : null);   // the wider town behind the square

  const bgSlots = [[-13, -12], [-17, -8], [-8, -17]];
  let bs = 0;
  marks.forEach((k) => { if (k === churchKind) return; const [x, z] = bgSlots[bs % bgSlots.length]; B.at(x, 0, z, 0.14 * (bs - 1), 0.95); bs++; landmark(B, k, night); B.pop(); });

  /* the two terraces, lot by fixed lot; the back run skips the right-hand
   * landmark's footprint (church, or the modern block that replaces it) */
  let sign = 0, neon = 0;
  const place = (lots, atFn) => {
    for (const [w, gb, ds, dm, cm, role, since] of lots) {
      const si = sign++;
      const lot = { gable: !!gb, ds, dormer: dm, chimney: cm, depth: 3.0, sign: si % 4, awn: (si * 5 + 2) % 4, neon: neon++, role: role || '', civic: role === 'civic' && era.year >= 1450, year: era.year };
      if (atFn(w)) { B.pop(); continue; }                                       // this lot is the landmark's footprint
      if (since && era.year < since) garden(B, w, rng);
      else house(B, w, spec, rng, night, lot);
      B.pop();
    }
  };
  let bx = -8.4;
  place(BACK_LOTS, (w) => { const cx = bx + w / 2; bx += w + 0.06; B.at(cx, 0, BACK); return rightBlock && cx > CHX - 3.7 && cx < CHX + 3.7; });
  let lz = -4.2;
  place(LEFT_LOTS, (w) => { B.at(LEFTX, 0, lz + w / 2, Math.PI / 2); lz += w + 0.06; return false; });

  if (churchKind) { B.at(CHX, 0, CHZ, 0, 1.0); landmark(B, churchKind, night); B.pop(); }   // the church, facade to the square
  else if (churchGone) { B.at(CHX, 0, CHZ + 0.4, 0, 1.0); modernBlock(B, night, !!spec.green); B.pop(); }   // a modern glass building on the razed cathedral's footprint, greened in the garden-city era

  /* the square's contents. The village (to 1150) is a curated rural scene; from
   * 1200 the era's prop list fills fixed stations, then a per-phase dressing. */
  const y = era.year;
  if (y <= 1150) { villageContent(B, era, rng, night); return finishEra(B, era, rng, mats); }
  if (y <= 1450) { marketContent(B, era, rng, night); return finishEra(B, era, rng, mats); }
  if (y <= 1750) { fountainSquareContent(B, era, rng, night); return finishEra(B, era, rng, mats); }
  if (y <= 1900) { industrialContent(B, era, rng, night); return finishEra(B, era, rng, mats); }
  if (y <= 1950) { civicContent(B, era, rng, night); return finishEra(B, era, rng, mats); }
  if (y <= 2000) { plazaContent(B, era, rng, night); return finishEra(B, era, rng, mats); }
  if (y <= 2050) { gardenCityContent(B, era, rng, night); return finishEra(B, era, rng, mats); }

  const street = era.street || [];
  let si = 0, ti = 0, li = 0, bi = 0, vi = 0, ci = 0, fi = 0, gi = 0, misc = 0;
  for (const k of street) {
    if (k === 'stall') { const r = si < 5 ? -0.6 : 1.7, sx = STALL_ROWS[si % 5]; B.at(sx, 0, r, si < 5 ? 0 : Math.PI); prop(B, 'stall', rng, night); B.pop(); si++; }
    else if (k === 'cross' || k === 'fountain') { B.at(1.2, 0, 3.5); prop(B, k, rng, night); B.pop(); }
    else if (k === 'well') { B.at(-3.6, 0, 4.6); prop(B, k, rng, night); B.pop(); }
    else if (k.startsWith('lamp') || k === 'neon-post' || k === 'traffic-light' || k === 'phone-box' || k === 'holo-sign') { const [x, z] = LAMP_SPOTS[li % LAMP_SPOTS.length]; B.at(x, 0, z); prop(B, k, rng, night); B.pop(); li++; }
    else if (k === 'tree' || k === 'neon-tree') { const [x, z] = TREE_SPOTS[ti % TREE_SPOTS.length]; B.at(x, 0, z); prop(B, k, rng, night); B.pop(); ti++; }
    else if (k === 'bench' || k === 'planter') { const [x, z, r] = BENCH_SPOTS[bi % BENCH_SPOTS.length]; B.at(x, 0, z, r); prop(B, k, rng, night); B.pop(); bi++; }
    else if (k === 'cafe' || k === 'canopy') { const [x, z] = CAFE_SPOTS[ci % CAFE_SPOTS.length]; B.at(x, 0, z); prop(B, k, rng, night); B.pop(); ci++; }
    else if (k === 'farmbed') { const [x, z] = FARM_SPOTS[fi % FARM_SPOTS.length]; B.at(x, 0, z, (fi % 2) * Math.PI / 2); prop(B, 'farmbed', rng, night); B.pop(); fi++; }
    else if (k === 'kiosk' || k === 'bus-shelter' || k === 'bike-rack' || k === 'charger' || k === 'bin') { const [x, z] = CIVIC_SPOTS[gi % CIVIC_SPOTS.length]; B.at(x, 0, z); prop(B, k, rng, night); B.pop(); gi++; }
    else if (k === 'tram' || k === 'car' || k === 'carriage' || k === 'cart' || k === 'loadcart' || k === 'bike' || k === 'scooter') { const [x, z] = VEH_LANE[vi % VEH_LANE.length]; B.at(x, 0, z); prop(B, k, rng, night); B.pop(); vi++; }
    else if (k === 'horse' || k === 'pig' || k === 'dog') { B.at(-2 + misc * 1.3, 0, 2.6 + misc * 0.3, -Math.PI / 3); prop(B, k, rng, night); B.pop(); misc++; }
    else if (k === 'drone') { prop(B, 'drone', rng, night); }
    else { B.at(-4.6 + (misc % 5) * 1.0, 0, 3.2, 0); prop(B, k, rng, night); B.pop(); misc++; }
  }

  /* dress the middle by era so it never reads as empty paving, and so the square
   * changes job over time instead of being a market for a thousand years */
  if (y <= 1850) {                                                    // the market centuries: busy stalls and carts
    for (const [x, z] of [[-3.3, 4.5], [3.1, 5.3], [-0.5, 5.9]]) { B.at(x, 0, z, (rng() - .5)); prop(B, 'table', rng, night); B.pop(); }
    for (const [x, z] of [[4.8, 4.1], [-4.7, 5.4]]) { B.at(x, 0, z); prop(B, 'crates', rng, night); B.pop(); }
    B.at(4.4, 0, 6.3); prop(B, 'hay', rng, night); B.pop();
    B.at(-2.6, 0, 6.5, Math.PI / 2); prop(B, 'loadcart', rng, night); B.pop();
    B.at(-4.3, 0, 3.9); prop(B, 'tree-box', rng, night); B.pop();
  } else if (y <= 1950) {                                             // civic square: a memorial, seats, greenery
    B.at(3.0, 0, 4.8); prop(B, 'memorial', rng, night); B.pop();
    B.at(-4.3, 0, 3.9); prop(B, 'tree-box', rng, night); B.pop();
    B.at(-3.4, 0, 5.6, Math.PI); prop(B, 'bench', rng, night); B.pop();
    B.at(1.4, 0, 6.2, Math.PI); prop(B, 'bench', rng, night); B.pop();
  } else if (y < 2050) {                                             // pedestrian café plaza
    B.at(-3.4, 0, 4.4); prop(B, 'cafe', rng, night); B.pop();
    B.at(2.8, 0, 5.4); prop(B, 'cafe', rng, night); B.pop();
    B.at(-4.3, 0, 3.9); prop(B, 'tree-box', rng, night); B.pop();
    for (const [x, z] of [[0.4, 6.2], [4.4, 4.2]]) { B.at(x, 0, z); prop(B, 'planter', rng, night); B.pop(); }
  } else if (y <= 2050) {                                             // 2050 eco garden: dense raised beds and cafés
    for (const [x, z] of FARM_SPOTS) { B.at(x, 0, z, (x + z | 0) % 2 ? Math.PI / 2 : 0); prop(B, 'farmbed', rng, night); B.pop(); }
    for (const [x, z] of [[-3.6, 4.2], [3.4, 5.2]]) { B.at(x, 0, z); prop(B, 'cafe', rng, night); B.pop(); }
    B.at(-4.4, 0, 6.0); prop(B, 'charger', rng, night); B.pop();
  } else if (y <= 2100) {                                             // 2100 cyberpunk: holo boards, neon, drones over wet asphalt
    for (const [x, z] of [[-3.4, 4.4], [3.2, 5.2], [0.2, 6.0]]) { B.at(x, 0, z, (rng() - .5)); prop(B, 'holo-sign', rng, night); B.pop(); }
    for (const [x, z] of [[-4.4, 5.6], [4.6, 4.2]]) { B.at(x, 0, z); prop(B, 'neon-tree', rng, night); B.pop(); }
    for (let d = 0; d < 3; d++) prop(B, 'drone', rng, night);
    B.at(-4.2, 0, 3.9); prop(B, 'neon-post', rng, night); B.pop();
  } else {                                                            // 2150 solarpunk: living walls, canopies, water, dense green
    for (const [x, z] of FARM_SPOTS) { B.at(x, 0, z, (x + z | 0) % 2 ? Math.PI / 2 : 0); prop(B, 'farmbed', rng, night); B.pop(); }
    for (const [x, z] of [[-3.4, 4.2], [3.6, 5.4]]) { B.at(x, 0, z); prop(B, 'canopy', rng, night); B.pop(); }
    for (const [x, z] of [[0.4, 6.2], [-4.4, 6.0], [4.6, 3.6]]) { B.at(x, 0, z); prop(B, 'tree-box', rng, night); B.pop(); }
  }

  return finishEra(B, era, rng, mats);
}
/* bunting on busy market days, the crowd in fixed knots, chimney smoke, then
 * merge — shared by the village path and the from-1200 path */
function finishEra(B, era, rng, mats) {
  const y = era.year;
  if (y >= 1200 && y <= 1450 && (era.crowd || 0) >= 11) {                   // only the medieval market flies bunting
    const cols = ['#c94a3a', '#e0b02a', '#3a6ab2', '#e8e4d8', '#3a7a4a'];   // one continuous garland per facade, meeting at the corner
    bunting(B, 5.0, -4.3, -4.3, -4.3, 4.6, cols);
    bunting(B, -4.3, -4.3, -4.3, 5.4, 4.6, cols);
  }
  const crowd = Math.min(era.crowd || 6, 20);
  for (let i = 0; i < crowd; i++) { const [kx, kz] = CROWD_KNOTS[i % CROWD_KNOTS.length]; B.at(kx + (rng() - 0.5) * 1.1, 0, kz + (rng() - 0.5) * 0.9, rng() * 6.28); person(B, rng); B.pop(); }
  for (let i = 0; i < (era.smoke || 0); i++) { B.anim(3, rng() * 6.283, 0); B.blob(-5 + i * 3.5 + (rng() - .5), 6 + rng() * 1.5, BACK, 0.5 + rng() * 0.3, shade('#c9cdd2', 0.9 + rng() * 0.2)); B.anim(0, 0, 0); }
  return B.finish(mats);
}
