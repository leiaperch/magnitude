/* MAGNITUDE — the ages mode.
 *
 * Not a zoom: a flip-book of one town square, one slice every 50 years, in real
 * 3D. The scroll sits *between* two slices, and the seam is a clipping plane
 * sweeping across the scene — so mid-step you are looking at two centuries of
 * the same square at once, in the same light, from the same fixed camera.
 */

import * as THREE from '../../vendor/three.module.js';
import { buildEra } from './town3d.js';
import { AXES, clamp } from '../config.js';

const ELEV = 20 * Math.PI / 180;   // the angle, and it does not move for 1000 years
const DIST = 100;
const TARGET = new THREE.Vector3(4.5, 1.5, 4.5);
const VIEW_W = 32, VIEW_H = 19;    // world units guaranteed on screen

/* The camera's screen-right vector: the seam plane rides along it, so its
 * position on screen is exactly linear in the plane's constant. */
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();

export class Ages {
  constructor(root) {
    this.root = root;
    this.eras = [];
    this.step = 50;
    this.index = -1;
    this.ready = false;
    this.built = new Map();          // year -> era, kept small
  }

  async load() {
    const data = await fetch('assets/data/ages.json').then(r => r.json());
    this.eras = data.eras;
    this.step = data.step;

    this.root.innerHTML =
      '<canvas class="stage3d"></canvas>' +
      '<div class="seam" aria-hidden="true"><b class="y-past"></b><b class="y-future"></b></div>';
    this.canvas = this.root.querySelector('canvas');
    this.seam = this.root.querySelector('.seam');
    this.yPast = this.root.querySelector('.y-past');
    this.yFuture = this.root.querySelector('.y-future');

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
    const off = new THREE.Vector3(1, Math.SQRT2 * Math.tan(ELEV), 1).normalize().multiplyScalar(DIST);
    this.camera.position.copy(TARGET).add(off);
    this.camera.lookAt(TARGET);

    this.scene = new THREE.Scene();
    this.fog = new THREE.Fog(0x9fc4e0, 100, 145);
    this.scene.fog = this.fog;

    /* one sun and one shadow map, shared by every era there has ever been */
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.1);
    sun.position.copy(TARGET).add(new THREE.Vector3(-24, 34, 16));
    sun.target.position.copy(TARGET);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 110;
    sun.shadow.bias = -0.0015;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun, sun.target);
    this.hemi = new THREE.HemisphereLight(0xdfeaf0, 0x6d8a4e, 1.1);
    this.scene.add(this.hemi);

    /* the sky is one plane behind everything, and the only thing that crossfades
     * rather than wiping: two adjacent skies are near enough that a seam in the
     * air would read as a mistake rather than as a century passing. */
    const bg = new THREE.PlaneGeometry(1, 1);
    bg.setAttribute('color', new THREE.Float32BufferAttribute(new Array(12).fill(1), 3));
    this.backdrop = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false }));
    this.backdrop.renderOrder = -1;
    this.backdrop.position.copy(TARGET).addScaledVector(off.clone().normalize(), -80);
    this.backdrop.quaternion.copy(this.camera.quaternion);
    this.scene.add(this.backdrop);

    /* Distant land: three ridges of low hills ringing the town, deep enough to
     * sit in the fog so they read as haze, not as objects. Shared and tinted
     * per era like the sky, so the seam never has to cut a hillside in half. */
    this.hills = [];
    /* The arc is centred away from the camera and must stay under π: cos+sin
     * only stays negative — i.e. behind the town — across a span of π, and any
     * wider brings the ends round into the foreground. */
    const AWAY = -Math.PI * 0.75;
    for (let ring = 0; ring < 3; ring++) {
      const r = 46 + ring * 15, seg = 40, arc = Math.PI * 0.86;
      const pos = [], col = [];
      for (let i = 0; i <= seg; i++) {
        const a = AWAY - arc / 2 + (i / seg) * arc;
        const rr = r + Math.sin(a * 5 + ring * 2) * 5 + Math.sin(a * 11 + ring) * 2.5;
        const hgt = 6 + Math.sin(a * 7 + ring * 3) * 3.5 + Math.sin(a * 3) * 2 + ring * 2.5;
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        pos.push(x, 0, z, x, hgt, z);
        col.push(1, 1, 1, 1, 1, 1);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const idx = [];
      for (let i = 0; i < seg; i++) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
      mesh.position.set(TARGET.x, 0, TARGET.z);
      mesh.renderOrder = -1 + ring * 0.001;
      this.scene.add(mesh);
      this.hills.push({ mesh, ring });
    }

    this.planePast = new THREE.Plane(RIGHT.clone().negate(), 0);
    this.planeFuture = new THREE.Plane(RIGHT.clone(), 0);

    this.resize();
    this.ready = true;
    return this;
  }

  get trackH() { return (this.eras.length - 1) * AXES.a.pxPerSlice; }
  get span() { return this.eras.length - 1; }

  /* Built eras are cheap (every mesh shares one of seven geometries) but not
   * free, so keep a few around: crossing a boundary twice shouldn't rebuild. */
  era(i) {
    const year = this.eras[i].year;
    let e = this.built.get(year);
    if (!e) {
      e = buildEra(this.eras[i]);
      e.group.visible = false;
      this.scene.add(e.group);
      this.built.set(year, e);
    } else {
      this.built.delete(year);
      this.built.set(year, e);                 // touch: most recent last
    }
    while (this.built.size > 5) {
      const [k, v] = this.built.entries().next().value;
      if (k === year) break;
      this.scene.remove(v.group);
      v.dispose();
      this.built.delete(k);
    }
    return e;
  }

  resize() {
    if (!this.renderer) return;
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    const a = w / h;
    let vw = VIEW_W, vh = VIEW_W / a;
    if (vh < VIEW_H) { vh = VIEW_H; vw = VIEW_H * a; }
    this.halfW = vw / 2;
    const c = this.camera;
    c.left = -vw / 2; c.right = vw / 2; c.top = vh / 2; c.bottom = -vh / 2;
    c.updateProjectionMatrix();
    this.backdrop.scale.set(vw * 1.6, vh * 1.6, 1);
  }

  setSky(a, b, u) {
    const top = new THREE.Color(a.sky[0]).lerp(new THREE.Color(b.sky[0]), u);
    const bot = new THREE.Color(a.sky[1]).lerp(new THREE.Color(b.sky[1]), u);
    const col = this.backdrop.geometry.getAttribute('color');
    for (const [i, c] of [[0, top], [1, top], [2, bot], [3, bot]]) col.setXYZ(i, c.r, c.g, c.b);
    col.needsUpdate = true;
    this.fog.color.copy(bot);
    this.hemi.color.copy(top);
    const hill = new THREE.Color(a.hill).lerp(new THREE.Color(b.hill), u);
    this.hemi.groundColor.copy(hill);

    /* nearer ring = more of its own colour, farther ring = more sky (deeper haze) */
    for (const h of this.hills) {
      const base = hill.clone().lerp(bot, 0.35 + h.ring * 0.22);
      const cc = h.mesh.geometry.getAttribute('color');
      for (let i = 0; i < cc.count; i++) {
        const foot = i % 2 === 0;                 // lower verts a touch darker
        const c = foot ? base.clone().multiplyScalar(0.92) : base;
        cc.setXYZ(i, c.r, c.g, c.b);
      }
      cc.needsUpdate = true;
    }
  }

  /* progress: 0..1 across the whole track. Returns the era now being read. */
  update(progress) {
    if (!this.ready) return null;
    const f = clamp(progress, 0, 1) * this.span;
    const i = Math.min(Math.floor(f), this.span - 1);
    const u = this.span === 0 ? 1 : f - i;

    if (i !== this.index) {
      this.index = i;
      this.past = this.era(i);
      this.future = this.era(i + 1);
      this.yPast.textContent = this.eras[i].year;
      this.yFuture.textContent = this.eras[i + 1].year;
    }
    this.u = u;
    this.setSky(this.eras[i], this.eras[i + 1], u);

    /* left of the seam is always the older town, right of it the later one */
    const c = this.halfW - u * this.halfW * 2;
    this.planePast.constant = c;
    this.planeFuture.constant = -c;
    this.seam.style.left = `${((1 - u) * 100).toFixed(2)}%`;
    this.seam.style.opacity = u > 0.015 && u < 0.985 ? '1' : '0';

    return { era: this.eras[u < 0.5 ? i : i + 1], i, u };
  }

  render(time) {
    if (!this.ready || !this.past) return;
    this.past.tick(time);
    this.future.tick(time);
    const r = this.renderer;
    r.clear();

    /* Every cached era lives in the same scene, so hide all of them and show
     * exactly the two this frame is about. Leaving one visible is invisible
     * while you scroll forwards — the leftover is the era you are heading into
     * anyway — and paints a ghost town the moment you scroll back. */
    for (const e of this.built.values()) e.group.visible = false;

    this.past.group.visible = true;
    r.clippingPlanes = [this.planePast];
    r.render(this.scene, this.camera);
    this.past.group.visible = false;

    this.future.group.visible = true;
    r.clippingPlanes = [this.planeFuture];
    r.render(this.scene, this.camera);
    this.future.group.visible = false;
  }

  show(on) {
    this.root.hidden = !on;
    if (on) this.resize();
  }
}
