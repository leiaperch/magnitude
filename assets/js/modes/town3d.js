/* MAGNITUDE — one era of the town, as real geometry.
 *
 * Flat-shaded volumes under a single fixed sun, seen down an orthographic
 * camera locked to one axonometric angle for a thousand years. Every mesh
 * reuses one of a handful of shared geometries and is scaled into place, so
 * holding all 22 eras in memory costs meshes, not vertex buffers.
 *
 * World: +X runs right-ish, +Z toward the camera, +Y is up.
 */

import * as THREE from '../../vendor/three.module.js';

/* ---------------------------------------------------------------- shared */
const BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);   // sits on the ground
const SPH = new THREE.SphereGeometry(0.5, 8, 6);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0);
const CONE = new THREE.ConeGeometry(0.5, 1, 7).translate(0, 0.5, 0);
const CAP = new THREE.CapsuleGeometry(0.5, 1, 3, 6).translate(0, 1, 0);

function prism(alongX) {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  if (alongX) g.rotateY(Math.PI / 2);   // ridge runs along X; extrusion becomes +X
  return g;
}
const PRISM_X = prism(true);    // occupies x∈[0,1] y∈[0,1] z∈[-.5,.5]
const PRISM_Z = prism(false);   // occupies x∈[-.5,.5] y∈[0,1] z∈[0,1]
const SHARED = new Set([BOX, SPH, CYL, CONE, CAP, PRISM_X, PRISM_Z]);

export const PALETTE = {
  wall: { wood: 0x8a6a44, timber: 0xded2b8, stone: 0xc2b9a6, brick: 0x9d5140, render: 0xd3c9b6, concrete: 0xadaba3 },
  roof: { thatch: 0xa8894f, tile: 0x9c4436, slate: 0x4f5761, flat: 0x7d7b74, solar: 0x7d7b74 },
  ground: { mud: 0x7d6a4e, cobble: 0x93918a, setts: 0x8b8982, asphalt: 0x4f5054 },
};
const RIDGE = { thatch: 0.95, tile: 0.72, slate: 0.5, flat: 0, solar: 0 };

/* the same year always builds the same town */
function rng(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const countMeshes = o3 => { let n = 0; o3.traverse(o => { if (o.isMesh) n++; }); return n; };

export function buildEra(era) {
  const g = rng(era.year);
  const group = new THREE.Group();

  const mats = [];
  const mk = (color, opts = {}) => {
    const m = new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });
    mats.push(m);
    return m;
  };
  const M = {
    wall: mk(PALETTE.wall[era.house.material]),
    roof: mk(PALETTE.roof[era.house.roof]),
    ground: mk(PALETTE.ground[era.ground]),
    stone: mk(0xb9b0a0), wood: mk(0x7a5c3c), brick: mk(0x8d4a38),
    dark: mk(0x4a443d), metal: mk(0x6e737a), cloth: mk(0xefe6d2),
    glass: mk(0x8fa3b0), leaf: mk(0x4a7a3c),
    lit: mk(0xf6e2a0, { emissive: 0x6a5520 }),
    glow: mk(0xf5eab4, { emissive: 0xb99a3a }),
  };

  const add = (geo, mat, pos, scl, rotY = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos[0], pos[1], pos[2]);
    m.scale.set(scl[0], scl[1], scl[2]);
    if (rotY) m.rotation.y = rotY;
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    return m;
  };

  /* ---------------------------------------------------------------- land */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), M.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  /* the square itself, a shade apart from the land around it */
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), mk(
    new THREE.Color(PALETTE.ground[era.ground]).offsetHSL(0, 0, era.ground === 'asphalt' ? 0.04 : -0.03)));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(5.5, 0.02, 5.5);
  plaza.receiveShadow = true;
  group.add(plaza);

  /* ------------------------------------------------------------ landmarks */
  const lm = (kind, x, z) => {
    switch (kind) {
      case 'motte':
        add(CYL, mk(new THREE.Color(era.hill).offsetHSL(0, 0, 0.04)), [x, 0, z], [7, 1.6, 7]);
        add(BOX, M.wood, [x, 1.6, z], [2.2, 2.6, 2.2]);
        add(PRISM_X, M.roof, [x - 1.3, 4.2, z], [2.6, 1.1, 2.6]);
        break;
      case 'palisade':
        for (let i = 0; i < 11; i++) add(BOX, M.wood, [x - 2 + i * 0.45, 0, z], [0.3, 1.1 + g() * 0.2, 0.3]);
        break;
      case 'keep':
        add(BOX, M.stone, [x, 0, z], [3.8, 4.2, 3.8]);
        for (const [dx, dz] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]])
          add(BOX, M.stone, [x + dx, 0, z + dz], [1.1, 5.1, 1.1]);
        break;
      case 'church':
        add(BOX, M.stone, [x, 0, z], [6.4, 1.9, 3.2]);
        add(PRISM_X, M.roof, [x - 3.2, 1.9, z], [6.4, 1.1, 3.4]);
        add(BOX, M.stone, [x + 3.6, 0, z], [1.8, 3.6, 1.8]);
        add(CONE, M.wood, [x + 3.6, 3.6, z], [2.4, 1.6, 2.4]);
        break;
      case 'cathedral-build': {
        add(BOX, M.stone, [x, 0, z], [7, 2.4, 3.4]);
        add(PRISM_X, M.roof, [x - 3.5, 2.4, z], [7, 1.3, 3.6]);
        add(BOX, M.stone, [x + 3.4, 0, z], [2, 4.6, 2]);
        add(BOX, M.stone, [x - 3.4, 0, z], [2, 3.0, 2]);
        for (let i = 0; i <= 4; i++) add(BOX, M.wood, [x - 3.4, 0.6 + i * 0.75, z + 1.3], [2.6, 0.09, 0.09]);
        for (const dx of [-4.4, -2.4]) add(BOX, M.wood, [x + dx, 0, z + 1.3], [0.09, 4.0, 0.09]);
        break;
      }
      case 'cathedral':
        add(BOX, M.stone, [x, 0, z], [7.4, 2.8, 3.6]);
        add(PRISM_X, M.roof, [x - 3.7, 2.8, z], [7.4, 1.6, 3.8]);
        for (const dx of [-3.4, 3.4]) {
          add(BOX, M.stone, [x + dx, 0, z], [1.9, 5.6, 1.9]);
          add(CONE, mk(0x7c5a49), [x + dx, 5.6, z], [2.5, 2.4, 2.5]);
        }
        add(SPH, M.glass, [x, 2.0, z + 1.85], [1.1, 1.1, 0.3]);
        break;
      case 'chimney':
        add(BOX, M.brick, [x, 0, z], [1.2, 6.6, 1.2]);
        add(BOX, mk(0x6f3a2c), [x, 6.6, z], [1.5, 0.3, 1.5]);
        break;
      case 'crane':
        add(BOX, M.metal, [x, 0, z], [0.35, 6.2, 0.35]);
        add(BOX, M.metal, [x + 0.8, 6.0, z], [7.0, 0.25, 0.25]);
        add(BOX, M.metal, [x + 3.4, 3.9, z], [0.12, 2.1, 0.12]);
        add(BOX, mk(0xc8a13c), [x + 3.4, 3.4, z], [0.7, 0.6, 0.7]);
        break;
      case 'tower':
      case 'tower-solar': {
        add(BOX, mk(0x9aa2a8), [x, 0, z], [3.4, 8.4, 3.4]);
        for (let r = 0; r < 11; r++) for (let i = 0; i < 3; i++) {
          add(BOX, g() > 0.45 ? M.lit : M.glass, [x - 1 + i, 0.6 + r * 0.7, z + 1.72], [0.62, 0.42, 0.06]);
        }
        if (kind === 'tower-solar') add(BOX, mk(0x3d5a8a), [x, 8.4, z], [3.4, 0.12, 3.4]);
        break;
      }
    }
  };
  const spots = { 1: [[-4, -4]], 2: [[-6.5, -2], [-1.5, -6.5]], 3: [[-8, -1], [-4, -4.5], [0.5, -8]] };
  (era.skyline || []).forEach((k, i) => {
    const s = (spots[era.skyline.length] || spots[1])[i];
    lm(k, s[0], s[1]);
  });

  /* ------------------------------------------------------------ buildings */
  function house(x, z, w, d, facing) {
    const h = 0.55 + era.house.storeys * 0.92;
    add(BOX, M.wall, [x + w / 2, 0, z + d / 2], [w, h, d]);

    const flat = era.house.roof === 'flat' || era.house.roof === 'solar';
    if (flat) {
      add(BOX, M.roof, [x + w / 2, h, z + d / 2], [w + 0.12, 0.14, d + 0.12]);
      if (era.house.roof === 'solar')
        for (let i = 0; i < Math.max(1, Math.floor(w / 0.8)); i++)
          add(BOX, mk(0x3d5a8a), [x + 0.4 + i * 0.8, h + 0.14, z + d / 2], [0.6, 0.06, d - 0.5]);
    } else if (facing === 'z') {
      add(PRISM_X, M.roof, [x - 0.08, h, z + d / 2], [w + 0.16, RIDGE[era.house.roof], d + 0.16]);
    } else {
      add(PRISM_Z, M.roof, [x + w / 2, h, z - 0.08], [w + 0.16, RIDGE[era.house.roof], d + 0.16]);
    }

    /* windows and a door go on whichever wall looks at the square */
    const span = facing === 'z' ? w : d;
    const n = Math.max(1, Math.round(span / 0.72));
    const pad = (span - n * 0.34) / (n + 1);
    const face = facing === 'z' ? z + d + 0.03 : x + w + 0.03;
    const put = (u, y, uw, uh, mat) => facing === 'z'
      ? add(BOX, mat, [x + u + uw / 2, y, face], [uw, uh, 0.07])
      : add(BOX, mat, [face, y, z + u + uw / 2], [0.07, uh, uw]);

    const kind = era.house.window;
    for (let r = 0; r < era.house.storeys; r++) {
      const y = 0.42 + r * 0.92;
      if (y + 0.5 > h) break;
      for (let i = 0; i < n; i++) {
        const u = pad + i * (0.34 + pad);
        const uw = kind === 'picture' ? 0.34 + pad * 0.5 : 0.34;
        if (kind === 'hole') { put(u, y, uw, 0.36, M.dark); continue; }
        put(u, y, uw, kind === 'picture' ? 0.56 : 0.46, g() > 0.58 ? M.lit : M.glass);
        if (kind === 'shutter') {
          put(u - 0.11, y, 0.09, 0.46, M.wood);
          put(u + uw + 0.02, y, 0.09, 0.46, M.wood);
        }
      }
    }
    put(span / 2 - 0.17, 0, 0.34, 0.64, M.wood);
    if (era.house.sign && g() > 0.4) put(span - 0.8, 1.05, 0.5, 0.3, mk([0xc8a13c, 0x7a8f5a, 0x9c5340][Math.floor(g() * 3)]));

    /* timber framing, and a chimney once there is anything worth heating */
    if (era.house.material === 'timber')
      for (let r = 0; r < era.house.storeys; r++) put(0, 0.55 + r * 0.92, span, 0.1, M.wood);
    if (era.smoke > 0 && !flat)
      add(BOX, era.house.material === 'brick' ? M.brick : M.stone,
        [x + w * 0.72, h, z + d * 0.3], [0.24, 0.8 + RIDGE[era.house.roof], 0.24]);
    if (era.house.trees && g() > 0.5) {
      const tx = facing === 'z' ? x + w / 2 : x + w + 0.9, tz = facing === 'z' ? z + d + 0.9 : z + d / 2;
      add(CYL, M.wood, [tx, 0, tz], [0.16, 0.7, 0.16]);
      add(SPH, M.leaf, [tx, 1.3, tz], [1.5, 1.6, 1.5]);
    }
  }

  const N = 8;
  for (let i = 0; i < N; i++) {
    const w = 1.35 + g() * 0.5, x = -1.6 + i * 1.85;
    if (era.house.gap && i === 2) add(BOX, mk(0x8f8779), [x + w / 2, 0, -2.35], [w, 0.2, 1.5]);
    else house(x, -3.1, w, 1.5, 'z');
    const d = 1.35 + g() * 0.5, z = -1.6 + i * 1.85;
    house(-3.1, z, 1.5, d, 'x');
  }

  /* ---------------------------------------------------------- what moves */
  const movers = [];
  const smoke = [];

  function propAt(kind, x, z) {
    switch (kind) {
      case 'barrel': add(CYL, M.wood, [x, 0, z], [0.42, 0.55, 0.42]); break;
      case 'pig': add(CAP, mk(0xcf9d92), [x, 0.1, z], [0.22, 0.3, 0.22], Math.PI / 2); break;
      case 'stall': {
        const c = mk([0xb8443a, 0x3f7f6d, 0xc8973c, 0x5b6fa8][Math.floor(g() * 4)]);
        add(BOX, M.wood, [x, 0, z], [1.6, 0.55, 1.1]);
        for (const dx of [-0.7, 0.7]) for (const dz of [-0.45, 0.45]) add(BOX, M.wood, [x + dx, 0.55, z + dz], [0.08, 0.9, 0.08]);
        for (let i = 0; i < 4; i++) add(BOX, i % 2 ? c : M.cloth, [x - 0.6 + i * 0.4, 1.45, z], [0.4, 0.08, 1.5]);
        for (let i = 0; i < 5; i++) add(SPH, mk([0xb8443a, 0x7d9c46, 0xc8973c][i % 3]),
          [x - 0.5 + (i % 3) * 0.45, 0.6, z - 0.2 + Math.floor(i / 3) * 0.4], [0.2, 0.2, 0.2]);
        break;
      }
      case 'cart': {
        add(BOX, M.wood, [x, 0.3, z], [1.3, 0.4, 0.7]);
        for (const dx of [-0.45, 0.45]) for (const dz of [-0.4, 0.4]) add(BOX, M.dark, [x + dx, 0, z + dz], [0.12, 0.3, 0.3]);
        break;
      }
      case 'carriage': case 'tram': case 'car': {
        const m = new THREE.Group();
        if (kind === 'carriage') {
          const b = add(BOX, mk(0x454851), [0, 0.35, 0], [1.5, 0.85, 0.9]);
          const h1 = add(CAP, mk(0x8a5f3c), [-1.3, 0.2, 0], [0.28, 0.3, 0.28]);
          const w1 = add(BOX, M.dark, [0.5, 0, 0.48], [0.12, 0.55, 0.55]);
          const w2 = add(BOX, M.dark, [0.5, 0, -0.48], [0.12, 0.55, 0.55]);
          [b, h1, w1, w2].forEach(o => { group.remove(o); m.add(o); });
        } else if (kind === 'tram') {
          const b = add(BOX, mk(0x8b5a3c), [0, 0.25, 0], [3.2, 1.1, 1.2]);
          const win = add(BOX, M.glass, [0, 0.95, 0.61], [2.6, 0.42, 0.05]);
          const p = add(BOX, M.metal, [0, 1.35, 0], [0.08, 1.1, 0.08]);
          [b, win, p].forEach(o => { group.remove(o); m.add(o); });
        } else {
          const c = [0x3f6f9c, 0x9c4038, 0xd8d3c6, 0x4a6b4a][Math.floor(g() * 4)];
          const b = add(BOX, mk(c), [0, 0.16, 0], [2.0, 0.42, 0.9]);
          const cab = add(BOX, mk(c), [0.1, 0.58, 0], [1.0, 0.34, 0.82]);
          const win = add(BOX, M.glass, [0.1, 0.62, 0.42], [0.9, 0.26, 0.04]);
          const ws = [-0.6, 0.7].flatMap(dx => [0.44, -0.44].map(dz => add(BOX, M.dark, [dx, 0, dz], [0.3, 0.3, 0.14])));
          [b, cab, win, ...ws].forEach(o => { group.remove(o); m.add(o); });
        }
        m.position.set(x, 0, z);
        group.add(m);
        movers.push({ o: m, from: -2, to: 13, t: g(), speed: kind === 'car' ? 0.09 : kind === 'tram' ? 0.05 : 0.035, axis: 'x', z });
        break;
      }
      case 'lamp-oil': case 'lamp-gas': case 'lamp-electric': {
        const tall = kind === 'lamp-electric' ? 2.6 : kind === 'lamp-gas' ? 2.1 : 1.7;
        add(BOX, M.dark, [x, 0, z], [0.14, tall, 0.14]);
        add(SPH, M.glow, [x, tall + 0.1, z], [0.4, 0.4, 0.4]);
        break;
      }
      case 'bike': {
        add(BOX, M.metal, [x, 0.5, z], [0.9, 0.06, 0.06]);
        for (const dx of [-0.4, 0.4]) add(BOX, M.dark, [x + dx, 0, z], [0.62, 0.62, 0.05]);
        break;
      }
    }
  }
  const slots = [[2.4, 1.2], [0.8, 3.6], [5.6, 1.8], [2.0, 6.4], [7.2, 4.4], [4.2, 8.6]];
  (era.street || []).forEach((k, i) => {
    const s = slots[i % slots.length];
    propAt(k, s[0] + (g() - 0.5) * 0.8, s[1] + (g() - 0.5) * 0.8);
  });

  /* people: a body, a head, and somewhere to be going */
  const SKIN = [0xe8bd96, 0xc98d63, 0x8d5a3b, 0xf0d3b0, 0x6f4630];
  const CLOTH = era.year < 1500 ? [0x7a5c3c, 0x5b6b4a, 0x8a4a3c, 0x4a5a6b, 0x6b5a7a]
    : era.year < 1850 ? [0x3f4a5a, 0x6b3a3a, 0x4a5a3a, 0x5a4a6b, 0x7a6a4a]
      : [0x2f3136, 0x3f6f9c, 0x9c4038, 0x4a4a4a, 0x6b6b6b];
  for (let i = 0; i < era.crowd; i++) {
    const p = new THREE.Group();
    /* CAP spans y 0..2 before scaling, so the body tops out at 2*0.38 */
    const body = add(CAP, mk(CLOTH[Math.floor(g() * CLOTH.length)]), [0, 0, 0], [0.28, 0.38, 0.28]);
    const head = add(SPH, mk(SKIN[Math.floor(g() * SKIN.length)]), [0, 0.84, 0], [0.3, 0.32, 0.3]);
    [body, head].forEach(o => { group.remove(o); p.add(o); });
    const x = -0.5 + g() * 10, z = -0.5 + g() * 10;
    p.position.set(x, 0, z);
    group.add(p);
    movers.push({ o: p, from: x, to: x + (g() - 0.5) * 7, t: g(), speed: 0.14 + g() * 0.12, axis: g() > 0.5 ? 'x' : 'z', z, bob: g() * 6 });
  }

  /* chimney smoke — each puff fades on its own, so each needs its own material */
  for (let i = 0; i < era.smoke * 4; i++) {
    const m = add(SPH, mk(0xcfc9bd, { transparent: true, opacity: 0.4, fog: false }), [0, 0, 0], [0.5, 0.5, 0.5]);
    m.castShadow = false; m.receiveShadow = false;
    smoke.push({ o: m, x: -2 + g() * 12, z: -3 + g() * 2, t: g(), speed: 0.25 + g() * 0.2, r: 0.3 + g() * 0.4 });
  }

  /* ------------------------------------------------------------- animate */
  function tick(time) {
    for (const m of movers) {
      m.t = (m.t + m.speed * 0.016 * 0.3) % 1;
      const back = m.t > 0.5;
      const u = back ? 1 - (m.t - 0.5) * 2 : m.t * 2;
      const v = m.from + (m.to - m.from) * u;
      if (m.axis === 'x') { m.o.position.x = v; m.o.rotation.y = back ? Math.PI : 0; }
      else { m.o.position.z = v; m.o.rotation.y = back ? -Math.PI / 2 : Math.PI / 2; }
      if (m.bob !== undefined) m.o.position.y = Math.abs(Math.sin(time * 5 + m.bob)) * 0.06;
    }
    for (const s of smoke) {
      s.t = (s.t + s.speed * 0.008) % 1;
      s.o.position.set(s.x + s.t * 1.6, 5 + s.t * 7, s.z + s.t * 0.9);
      const k = s.r * (0.5 + s.t * 2.4);
      s.o.scale.set(k, k, k);
      s.o.material.opacity = 0.42 * (1 - s.t);
    }
  }

  function dispose() {
    for (const m of mats) m.dispose();
    group.traverse(o => {
      if (o.isMesh && o.geometry && !SHARED.has(o.geometry)) o.geometry.dispose();
    });
  }

  return { group, tick, dispose, meshes: countMeshes(group) };
}
