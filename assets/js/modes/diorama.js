/* MAGNITUDE — the ages diorama.
 *
 * One town square in flat-shaded fake 3D: an axonometric projection, every
 * volume built from a top face and two side faces, painted back to front.
 * Nothing here is a picture — each era is a parameter set (assets/data/ages.json)
 * turned into boxes. Same viewpoint for a thousand years; only the town moves.
 *
 * World axes:  +x runs down-right, +y runs down-left, +z is up.
 * Larger x+y is nearer the camera, which is what the painter's sort keys on.
 */

const W = 1600, H = 900;
const OX = 800, OY = 526;          // where world (0,0,0) lands
const W2 = 48, H2 = 14, ZH = 42;   // one world unit, in screen pixels
const HORIZON = 430;

const INK = '#241f1c';
const px = n => Math.round(n * 10) / 10;

/* ---------------------------------------------------------------- colour */
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb = a => '#' + a.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const shade = (h, f) => rgb(hex(h).map(v => v * f));
const mixc = (a, b, t) => { const B = hex(b); return rgb(hex(a).map((v, i) => v + (B[i] - v) * t)); };

/* Faces of every volume share one light: top brightest, the y-facing side lit,
 * the x-facing side in shadow. Distance washes all three toward the sky. */
const TOP = 1.18, LIT = 1.0, DARK = 0.68;
function faces(base, depth, sky) {
  const h = Math.min(0.55, Math.max(0, (6 - depth) * 0.075));   // atmospheric haze
  return {
    top: mixc(shade(base, TOP), sky, h * 0.9),
    lit: mixc(shade(base, LIT), sky, h),
    dark: mixc(shade(base, DARK), sky, h * 0.8),
  };
}

/* --------------------------------------------------------------- geometry */
const P = (x, y, z) => [OX + (x - y) * W2, OY + (x + y) * H2 - z * ZH];
const poly = (pts, fill, extra = '') =>
  `<polygon points="${pts.map(p => `${px(p[0])},${px(p[1])}`).join(' ')}" fill="${fill}"${extra}/>`;

/* A deterministic generator: the same year always draws the same town. */
function rng(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* An axonometric box standing at world corner (x,y), w along x, d along y. */
function box(x, y, z, w, d, h, f) {
  const A = P(x, y, z + h), B = P(x + w, y, z + h), C = P(x + w, y + d, z + h), D = P(x, y + d, z + h);
  const b0 = P(x + w, y, z), c0 = P(x + w, y + d, z), d0 = P(x, y + d, z);
  return poly([A, B, C, D], f.top)          // roof / top
    + poly([B, C, c0, b0], f.dark)          // the x-facing side, away from the light
    + poly([D, C, c0, d0], f.lit);          // the y-facing side, lit
}

/* A gable roof. The ridge runs along whichever side is longer, so it always
 * lies with the street rather than across it. */
const alongX = (w, d) => w >= d;
function gable(x, y, z, w, d, rh, f) {
  if (rh <= 0) return '';
  if (alongX(w, d)) {
    const r0 = P(x, y + d / 2, z + rh), r1 = P(x + w, y + d / 2, z + rh);
    const A = P(x, y, z), B = P(x + w, y, z), C = P(x + w, y + d, z), D = P(x, y + d, z);
    return poly([A, B, r1, r0], f.top)        // far slope, mostly hidden
      + poly([D, C, r1, r0], f.lit)           // the slope we look at
      + poly([B, C, r1], f.dark);             // gable end
  }
  const r0 = P(x + w / 2, y, z + rh), r1 = P(x + w / 2, y + d, z + rh);
  const A = P(x, y, z), B = P(x + w, y, z), C = P(x + w, y + d, z), D = P(x, y + d, z);
  return poly([A, D, r1, r0], f.top)
    + poly([B, C, r1, r0], f.dark)
    + poly([D, C, r1], f.lit);
}

/* a soft blob of shade on the ground, offset the way the light falls */
function drop(x, y, w, d) {
  const o = 0.35;
  return poly([P(x - o, y + o, 0), P(x + w - o, y + o, 0), P(x + w - o, y + d + o, 0), P(x - o, y + d + o, 0)],
    'rgb(0 0 0 / .16)', ' stroke="none"');
}

/* ------------------------------------------------------------------- sky */
function sky(era, g) {
  let s = `<rect x="0" y="0" width="${W}" height="${HORIZON + 2}" fill="url(#sky-${era.year})" stroke="none"/>`;
  const far = mixc(era.hill, era.sky[1], 0.62), near = mixc(era.hill, era.sky[1], 0.34);
  for (const [k, col] of [[0, far], [1, near]]) {
    const pts = [[-20, HORIZON + 2]];
    for (let x = -20; x <= W + 20; x += 70) {
      pts.push([x, HORIZON - 18 - k * 26 - Math.sin(x * 0.0032 + k * 2.2) * (18 + k * 12) - g() * 14]);
    }
    pts.push([W + 20, HORIZON + 2]);
    s += poly(pts, col, ' stroke="none"');
  }
  return s;
}

/* ---------------------------------------------------------------- ground */
const GROUNDC = { mud: '#7d6a4e', cobble: '#93918a', setts: '#8b8982', asphalt: '#4f5054' };
function ground(era, g) {
  const col = GROUNDC[era.ground];
  let s = `<rect x="0" y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="${mixc(col, era.sky[1], 0.1)}" stroke="none"/>`;
  /* the plaza itself, a touch different from the land around it */
  s += poly([P(-2, -2, 0), P(15, -2, 0), P(15, 15, 0), P(-2, 15, 0)], col, ' stroke="none"');
  const line = shade(col, 0.9);
  if (era.ground === 'setts' || era.ground === 'cobble') {
    s += `<g stroke="${line}" stroke-width="1.4" fill="none" opacity=".8">`;
    for (let i = -2; i <= 15; i += era.ground === 'setts' ? 1 : 1.6) {
      s += `<line x1="${px(P(i, -2, 0)[0])}" y1="${px(P(i, -2, 0)[1])}" x2="${px(P(i, 15, 0)[0])}" y2="${px(P(i, 15, 0)[1])}"/>`;
      s += `<line x1="${px(P(-2, i, 0)[0])}" y1="${px(P(-2, i, 0)[1])}" x2="${px(P(15, i, 0)[0])}" y2="${px(P(15, i, 0)[1])}"/>`;
    }
    s += '</g>';
  } else if (era.ground === 'mud') {
    for (let i = 0; i < 14; i++) {
      const x = -1 + g() * 15, y = -1 + g() * 15, p = P(x, y, 0);
      s += `<ellipse cx="${px(p[0])}" cy="${px(p[1])}" rx="${px(14 + g() * 26)}" ry="${px(4 + g() * 7)}" fill="${shade(col, 0.82)}" stroke="none"/>`;
    }
  } else {
    const a = P(-2, 6.4, 0), b = P(15, 6.4, 0);
    s += `<line x1="${px(a[0])}" y1="${px(a[1])}" x2="${px(b[0])}" y2="${px(b[1])}" stroke="#e6e2d4" stroke-width="4" stroke-dasharray="26 22"/>`;
  }
  return s;
}

/* -------------------------------------------------------------- landmark */
function landmark(kind, x, y, era, g) {
  const f = c => faces(c, x + y, era.sky[1]);
  const stone = f('#b9b0a0'), wood = f('#7a5c3c'), brick = f('#8d4a38'), glass = f('#9aa6ae');
  let s = '';
  switch (kind) {
    case 'motte':
      s += poly([P(x - 1.6, y - 1.6, 0), P(x + 2.6, y - 1.6, 0), P(x + 2.6, y + 2.6, 0), P(x - 1.6, y + 2.6, 0)], shade(era.hill, 1.05), ' stroke="none"');
      s += box(x, y, 0.5, 1.1, 1.1, 2.6, wood) + gable(x, y, 3.1, 1.1, 1.1, 0.9, f('#a8895a'));
      break;
    case 'palisade':
      for (let i = 0; i < 9; i++) s += box(x + i * 0.42, y, 0, 0.3, 0.3, 1.1 + g() * 0.15, wood);
      break;
    case 'keep':
      s += box(x, y, 0, 1.9, 1.9, 4.2, stone);
      for (const [dx, dy] of [[-0.3, -0.3], [1.7, -0.3], [-0.3, 1.7], [1.7, 1.7]]) s += box(x + dx, y + dy, 0, 0.6, 0.6, 5.0, stone);
      break;
    case 'church':
      s += box(x, y, 0, 3.2, 1.6, 1.9, stone) + gable(x, y, 1.9, 3.2, 1.6, 1.0, f('#8f4638'));
      s += box(x + 2.6, y, 0, 1.0, 1.0, 3.6, stone) + gable(x + 2.6, y, 3.6, 1.0, 1.0, 1.4, f('#7c5a49'));
      break;
    case 'cathedral-build':
      s += box(x, y, 0, 3.4, 1.7, 2.4, stone) + gable(x, y, 2.4, 3.4, 1.7, 1.2, f('#8f4638'));
      s += box(x + 2.7, y, 0, 1.1, 1.1, 4.4, stone);   // one tower up, one still rising
      s += box(x, y - 0.1, 0, 1.1, 1.1, 3.0, stone);
      s += `<g stroke="${INK}" stroke-width="2" fill="none">`;
      for (let i = 0; i <= 4; i++) {
        const a = P(x - 0.2, y - 0.2, 1 + i * 0.8), b = P(x + 1.3, y - 0.2, 1 + i * 0.8);
        s += `<line x1="${px(a[0])}" y1="${px(a[1])}" x2="${px(b[0])}" y2="${px(b[1])}"/>`;
      }
      s += '</g>';
      break;
    case 'cathedral': {
      s += box(x, y, 0, 3.6, 1.8, 2.8, stone) + gable(x, y, 2.8, 3.6, 1.8, 1.5, f('#8f4638'));
      for (const dx of [0, 2.6]) {
        s += box(x + dx, y - 0.05, 0, 1.0, 1.0, 5.4, stone);
        s += poly([P(x + dx, y - 0.05, 5.4), P(x + dx + 1, y - 0.05, 5.4), P(x + dx + 0.5, y + 0.45, 7.6)], shade('#7c5a49', TOP), '');
        s += poly([P(x + dx + 1, y - 0.05, 5.4), P(x + dx + 1, y + 0.95, 5.4), P(x + dx + 0.5, y + 0.45, 7.6)], shade('#7c5a49', DARK), '');
      }
      const r = P(x + 1.8, y, 1.9);
      s += `<circle cx="${px(r[0])}" cy="${px(r[1])}" r="13" fill="${glass.lit}"/>`;
      break;
    }
    case 'chimney':
      s += box(x, y, 0, 0.7, 0.7, 6.4, brick);
      s += box(x - 0.1, y - 0.1, 6.4, 0.9, 0.9, 0.25, f('#6f3a2c'));
      break;
    case 'crane': {
      const a = P(x, y, 0), b = P(x, y, 6.2), c = P(x - 1.4, y - 1.4, 6.0), d = P(x + 2.2, y + 2.2, 6.4);
      s += `<g stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round">` +
        `<line x1="${px(a[0])}" y1="${px(a[1])}" x2="${px(b[0])}" y2="${px(b[1])}"/>` +
        `<line x1="${px(c[0])}" y1="${px(c[1])}" x2="${px(d[0])}" y2="${px(d[1])}"/>` +
        `<line x1="${px(b[0])}" y1="${px(b[1])}" x2="${px(d[0])}" y2="${px(d[1])}"/>` +
        `<line x1="${px(d[0])}" y1="${px(d[1])}" x2="${px(d[0])}" y2="${px(d[1] + 46)}"/></g>`;
      s += box(x + 2.0, y + 2.0, 3.6, 0.5, 0.5, 0.5, f('#c8a13c'));
      break;
    }
    case 'tower':
    case 'tower-solar': {
      const c = f('#9aa2a8');
      s += box(x, y, 0, 1.7, 1.7, 8.2, c);
      for (let r = 0; r < 11; r++) for (let i = 0; i < 3; i++) {
        const lit = g() > 0.5 ? '#f2dd9a' : '#5d7280';
        const u = 0.15 + i * 0.5, v = 0.5 + r * 0.68;
        s += poly([P(x + u, y + 1.7, v), P(x + u + 0.34, y + 1.7, v), P(x + u + 0.34, y + 1.7, v + 0.4), P(x + u, y + 1.7, v + 0.4)], lit, ' stroke="none"');
      }
      if (kind === 'tower-solar') s += box(x, y, 8.2, 1.7, 1.7, 0.12, f('#3d5a8a'));
      break;
    }
  }
  return s;
}

/* ------------------------------------------------------------- buildings */
const WALL = { wood: '#8a6a44', timber: '#ded2b8', stone: '#c2b9a6', brick: '#9d5140', render: '#d3c9b6', concrete: '#adaba3' };
const ROOFC = { thatch: '#a8894f', tile: '#9c4436', slate: '#4f5761', flat: '#7d7b74', solar: '#7d7b74' };
const RIDGE = { thatch: 0.95, tile: 0.72, slate: 0.5, flat: 0, solar: 0 };

/* Windows sit on whichever face looks at the square. */
function openings(x, y, w, d, h, era, side, g, sky) {
  const kind = era.house.window;
  const n = Math.max(1, Math.round((side === 'lit' ? w : d) / 0.55));
  const span = side === 'lit' ? w : d;
  const pad = (span - n * 0.32) / (n + 1);
  const glass = mixc('#8fa3b0', sky, 0.2);
  let s = '';
  const at = (u, v, du, dv) => side === 'lit'
    ? [P(x + u, y + d, v), P(x + u + du, y + d, v), P(x + u + du, y + d, v + dv), P(x + u, y + d, v + dv)]
    : [P(x + w, y + u, v), P(x + w, y + u + du, v), P(x + w, y + u + du, v + dv), P(x + w, y + u, v + dv)];
  const tint = side === 'lit' ? 1 : 0.78;

  for (let r = 0; r < era.house.storeys; r++) {
    const v = 0.42 + r * 0.92;
    if (v + 0.5 > h) break;
    for (let i = 0; i < n; i++) {
      const u = pad + i * (0.32 + pad);
      const wide = kind === 'picture' ? 0.32 + pad * 0.5 : 0.32;
      if (kind === 'hole') { s += poly(at(u, v, wide, 0.36), shade('#33291f', tint), ' stroke="none"'); continue; }
      const lit = g() > 0.6;
      s += poly(at(u, v, wide, kind === 'picture' ? 0.56 : 0.46), shade(lit ? '#f0d894' : glass, tint), ' stroke="none"');
      if (kind === 'shutter') {
        s += poly(at(u - 0.12, v, 0.1, 0.46), shade('#6f5334', tint), ' stroke="none"');
        s += poly(at(u + wide + 0.02, v, 0.1, 0.46), shade('#6f5334', tint), ' stroke="none"');
      }
    }
  }
  /* a door, and a hanging sign once trade needs advertising */
  const dm = span / 2 - 0.16;
  s += poly(at(dm, 0, 0.32, 0.62), shade('#5d4128', tint), ' stroke="none"');
  if (era.house.sign && g() > 0.4) {
    s += poly(at(span - 0.75, 0.95, 0.5, 0.3), shade(['#c8a13c', '#7a8f5a', '#9c5340'][Math.floor(g() * 3)], tint), '');
  }
  return s;
}

function building(x, y, w, d, era, g, side, sky) {
  const mat = era.house.material;
  const h = 0.55 + era.house.storeys * 0.92;
  const f = faces(WALL[mat] || '#c0b8a8', x + y, sky);
  const flat = era.house.roof === 'flat' || era.house.roof === 'solar';
  let s = drop(x, y, w, d) + box(x, y, 0, w, d, h, f);

  /* timber framing reads as a few dark braces on the lit face */
  if (mat === 'timber') {
    const t = shade('#5d4224', 1);
    for (let r = 0; r < era.house.storeys; r++) {
      const v = 0.55 + r * 0.92;
      if (side === 'lit') {
        s += poly([P(x, y + d, v), P(x + w, y + d, v), P(x + w, y + d, v + 0.09), P(x, y + d, v + 0.09)], t, ' stroke="none"');
      } else {
        s += poly([P(x + w, y, v), P(x + w, y + d, v), P(x + w, y + d, v + 0.09), P(x + w, y, v + 0.09)], shade(t, 0.8), ' stroke="none"');
      }
    }
  }
  s += openings(x, y, w, d, h, era, side, g, sky);

  const rf = faces(ROOFC[era.house.roof] || '#8d8b84', x + y, sky);
  if (flat) {
    s += box(x - 0.05, y - 0.05, h, w + 0.1, d + 0.1, 0.12, rf);
    if (era.house.roof === 'solar') {
      for (let i = 0; i < Math.max(1, Math.floor(w / 0.7)); i++) {
        s += box(x + 0.12 + i * 0.66, y + 0.2, h + 0.12, 0.5, d - 0.4, 0.06, faces('#3d5a8a', x + y, sky));
      }
    }
  } else {
    s += gable(x - 0.08, y - 0.08, h, w + 0.16, d + 0.16, RIDGE[era.house.roof], rf);
  }
  /* a chimney, once there is anything worth heating */
  if (era.smoke > 0 && !flat) {
    s += box(x + w * 0.7, y + d * 0.25, h, 0.22, 0.22, 0.75 + RIDGE[era.house.roof],
      faces(mat === 'brick' ? '#8d4a38' : '#9d968a', x + y, sky));
  }
  return s;
}

/* ----------------------------------------------------------------- props */
function prop(kind, x, y, era, g, sky) {
  const f = c => faces(c, x + y, sky);
  switch (kind) {
    case 'barrel': return drop(x, y, 0.4, 0.4) + box(x, y, 0, 0.4, 0.4, 0.55, f('#8a6a44'));
    case 'pig': return drop(x, y, 0.5, 0.3) + box(x, y, 0, 0.5, 0.3, 0.3, f('#cf9d92'));
    case 'stall': {
      const a = ['#b8443a', '#3f7f6d', '#c8973c', '#5b6fa8'][Math.floor(g() * 4)];
      let s = drop(x, y, 1.5, 1.0) + box(x, y, 0, 1.5, 1.0, 0.5, f('#9c7a4e'));
      for (let i = 0; i < 4; i++) s += box(x + i * 0.38, y - 0.15, 1.35, 0.36, 1.3, 0.09, faces(i % 2 ? a : '#efe6d2', x + y, sky));
      for (const dx of [0.05, 1.35]) for (const dy of [0.05, 0.85]) s += box(x + dx, y + dy, 0.5, 0.08, 0.08, 0.9, f('#7a5c3c'));
      for (let i = 0; i < 5; i++) {
        const p = P(x + 0.2 + (i % 3) * 0.45, y + 0.25 + Math.floor(i / 3) * 0.4, 0.5);
        s += `<circle cx="${px(p[0])}" cy="${px(p[1])}" r="7" fill="${['#b8443a', '#7d9c46', '#c8973c'][i % 3]}"/>`;
      }
      return s;
    }
    case 'cart': return drop(x, y, 1.2, 0.6) + box(x, y, 0.16, 1.2, 0.6, 0.4, f('#9c7a4e'))
      + box(x + 0.1, y - 0.06, 0, 0.16, 0.72, 0.34, f('#6b4f33')) + box(x + 0.9, y - 0.06, 0, 0.16, 0.72, 0.34, f('#6b4f33'));
    case 'carriage': return drop(x, y, 2.4, 0.8) + box(x + 1.0, y, 0.28, 1.4, 0.8, 0.75, f('#454851'))
      + box(x + 1.1, y + 0.8, 0.5, 1.2, 0.02, 0.4, faces('#c9d6de', x + y, sky))
      + box(x, y + 0.1, 0.3, 0.9, 0.55, 0.5, f('#8a5f3c'))
      + box(x + 1.1, y - 0.05, 0, 0.14, 0.9, 0.32, f('#2f3136')) + box(x + 2.1, y - 0.05, 0, 0.14, 0.9, 0.32, f('#2f3136'));
    case 'tram': return drop(x, y, 3.0, 1.0) + box(x, y, 0.2, 3.0, 1.0, 1.0, f('#8b5a3c'))
      + box(x + 0.2, y + 1.0, 0.55, 2.6, 0.02, 0.42, faces('#c9d6de', x + y, sky))
      + box(x + 1.4, y + 0.45, 1.2, 0.07, 0.07, 1.1, f('#4a4a4a'));
    case 'car': {
      const c = ['#3f6f9c', '#9c4038', '#d8d3c6', '#4a6b4a'][Math.floor(g() * 4)];
      return drop(x, y, 1.9, 0.85) + box(x, y, 0.1, 1.9, 0.85, 0.38, f(c))
        + box(x + 0.45, y + 0.05, 0.48, 0.95, 0.75, 0.32, f(shade(c, 0.9)))
        + box(x + 0.5, y + 0.8, 0.52, 0.85, 0.02, 0.24, faces('#c9d6de', x + y, sky));
    }
    case 'bike': {
      const a = P(x, y, 0), b = P(x + 0.9, y, 0);
      return `<g fill="none" stroke="${INK}" stroke-width="3"><circle cx="${px(a[0])}" cy="${px(a[1] - 9)}" r="9"/><circle cx="${px(b[0])}" cy="${px(b[1] - 9)}" r="9"/>` +
        `<path d="M ${px(a[0])} ${px(a[1] - 9)} L ${px((a[0] + b[0]) / 2)} ${px(a[1] - 26)} L ${px(b[0])} ${px(b[1] - 9)}"/></g>`;
    }
    case 'lamp-oil': case 'lamp-gas': case 'lamp-electric': {
      const tall = kind === 'lamp-electric' ? 2.4 : kind === 'lamp-gas' ? 2.0 : 1.6;
      const glow = kind === 'lamp-oil' ? '#e8d79a' : kind === 'lamp-gas' ? '#f2e3a4' : '#f5eab4';
      const p = P(x, y, tall);
      return drop(x, y, 0.16, 0.16) + box(x, y, 0, 0.16, 0.16, tall, f('#46443f'))
        + `<circle cx="${px(p[0])}" cy="${px(p[1] - 6)}" r="9" fill="${glow}"/>`;
    }
  }
  return '';
}

/* ---------------------------------------------------------------- people */
const SKIN = ['#e8bd96', '#c98d63', '#8d5a3b', '#f0d3b0', '#6f4630'];
function person(x, y, era, g, sky) {
  const pal = era.year < 1500 ? ['#7a5c3c', '#5b6b4a', '#8a4a3c', '#4a5a6b', '#6b5a7a']
    : era.year < 1850 ? ['#3f4a5a', '#6b3a3a', '#4a5a3a', '#5a4a6b', '#7a6a4a']
      : ['#2f3136', '#3f6f9c', '#9c4038', '#4a4a4a', '#6b6b6b'];
  const c = mixc(pal[Math.floor(g() * pal.length)], sky, Math.min(0.4, Math.max(0, (6 - x - y) * 0.06)));
  const skin = SKIN[Math.floor(g() * SKIN.length)];
  const foot = P(x, y, 0), head = P(x, y, 0.95);
  return `<ellipse cx="${px(foot[0])}" cy="${px(foot[1])}" rx="10" ry="4" fill="rgb(0 0 0 / .18)" stroke="none"/>` +
    `<path d="M ${px(foot[0] - 9)} ${px(foot[1])} q 0 -34 9 -34 q 9 0 9 34 z" fill="${c}"/>` +
    `<circle cx="${px(head[0])}" cy="${px(head[1] + 4)}" r="7.5" fill="${skin}"/>`;
}

/* ---------------------------------------------------------------- smoke */
function smoke(era, g, sky) {
  if (!era.smoke) return '';
  let s = '';
  for (let i = 0; i < era.smoke; i++) {
    const x = 100 + g() * 1400, y = 90 + g() * 150;
    for (let k = 0; k < 5; k++) {
      s += `<circle cx="${px(x + k * 13 + g() * 14)}" cy="${px(y - k * 30)}" r="${px(13 + k * 7)}" fill="${mixc('#cfc9bd', sky, 0.3)}" opacity="${(0.42 - k * 0.07).toFixed(2)}" stroke="none"/>`;
    }
  }
  return s;
}

/* ------------------------------------------------------------------ draw */
export function drawEra(era) {
  const g = rng(era.year);
  const sk = era.sky[1];
  const out = [];
  const add = (depth, svg) => out.push([depth, svg]);

  /* the landmarks stand behind everything, on the far side of the square */
  const spots = { 1: [[-3.2, -3.2]], 2: [[-4.4, -2.2], [-1.6, -4.6]], 3: [[-5.2, -1.6], [-2.6, -3.4], [0.2, -5.6]] };
  const place = spots[era.skyline.length] || spots[1];
  era.skyline.forEach((k, i) => {
    const [lx, ly] = place[i];
    add(lx + ly, landmark(k, lx, ly, era, g));
  });

  /* two rows of houses, opening toward the viewer like a V */
  const nRow = 8;
  for (let i = 0; i < nRow; i++) {
    const w = 1.35 + g() * 0.5;
    const x = -1.6 + i * 1.85;
    if (!(era.house.gap && i === 2)) add(x + w - 2, building(x, -3.1, w, 1.5, era, g, 'lit', sk));
    else add(x + w - 2, drop(x, -3.1, w, 1.5) + box(x, -3.1, 0, w, 1.5, 0.18, faces('#8f8779', x - 3, sk)));
    const d = 1.35 + g() * 0.5;
    const y = -1.6 + i * 1.85;
    add(y + d - 2, building(-3.1, y, 1.5, d, era, g, 'dark', sk));
  }

  /* what stands or moves on the square */
  const slots = [[2.2, 1.0], [0.6, 3.4], [5.4, 1.6], [1.8, 6.2], [7.0, 4.2], [4.0, 8.4]];
  era.street.forEach((k, i) => {
    const [sx, sy] = slots[i % slots.length];
    const x = sx + (g() - 0.5) * 0.7, y = sy + (g() - 0.5) * 0.7;
    add(x + y, prop(k, x, y, era, g, sk));
  });
  for (let i = 0; i < era.crowd; i++) {
    const x = -0.5 + g() * 10, y = -0.5 + g() * 10;
    add(x + y + 0.2, person(x, y, era, g, sk));
  }

  out.sort((a, b) => a[0] - b[0]);   // painter's algorithm: far to near

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<defs><linearGradient id="sky-${era.year}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${era.sky[0]}"/><stop offset="1" stop-color="${era.sky[1]}"/>` +
    `</linearGradient></defs>` +
    `<g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round">` +
    sky(era, g) + ground(era, g) + smoke(era, g, sk) +
    out.map(o => o[1]).join('') +
    '</g></svg>';
}
