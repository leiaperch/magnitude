/* MAGNITUDE — the ages diorama.
 *
 * One town square, drawn flat, and redrawn from scratch for every 50-year slice.
 * Nothing here is a picture: each era is a parameter set (assets/data/ages.json)
 * turned into SVG shapes. Same viewpoint for a thousand years — only the town moves.
 */

const W = 1600, H = 900;
const GROUND = 640;          // where every facade stands
const GAP = [610, 990];      // the opening in the row that lets the skyline through

const INK = '#2b241f';

const WALL = {
  wood: '#8a6a44', timber: '#e9dfca', stone: '#cfc6b2',
  brick: '#a4543f', render: '#dcd3c2', concrete: '#b8b6ae',
};
const ROOF = {
  thatch: '#b9995c', tile: '#a8493a', slate: '#59616a',
  flat: '#8d8b84', solar: '#8d8b84',
};

/* A tiny deterministic generator: the same year always draws the same town. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const esc = n => Math.round(n * 10) / 10;
const rect = (x, y, w, h, fill, extra = '') =>
  `<rect x="${esc(x)}" y="${esc(y)}" width="${esc(w)}" height="${esc(h)}" fill="${fill}"${extra}/>`;
const poly = (pts, fill, extra = '') =>
  `<polygon points="${pts.map(p => `${esc(p[0])},${esc(p[1])}`).join(' ')}" fill="${fill}"${extra}/>`;
const circle = (cx, cy, r, fill, extra = '') =>
  `<circle cx="${esc(cx)}" cy="${esc(cy)}" r="${esc(r)}" fill="${fill}"${extra}/>`;

/* ---------------------------------------------------------------- sky & land */
function sky(era) {
  return `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#sky-${era.year})" stroke="none"/>`;
}
function hills(era) {
  const g = rng(era.year * 7);
  const pts = [[-20, 620]];
  for (let x = -20; x <= W + 20; x += 90) pts.push([x, 470 + Math.sin(x * 0.004 + g() * 2) * 34 + g() * 26]);
  pts.push([W + 20, 620]);
  return poly(pts, era.hill) + rect(-20, 600, W + 40, 60, era.hill, ' stroke="none"');
}

/* ------------------------------------------------------------------ skyline */
function motte(x) {
  return poly([[x - 110, 600], [x - 60, 505], [x + 60, 505], [x + 110, 600]], '#7f8f57') +
    rect(x - 34, 400, 68, 110, '#8a6a44') +
    poly([[x - 46, 400], [x, 344], [x + 46, 400]], '#b9995c') +
    rect(x - 10, 440, 20, 30, '#4b3a26');
}
function palisade(x) {
  let s = '';
  for (let i = -8; i <= 8; i++) s += poly([[x + i * 22 - 8, 600], [x + i * 22 - 8, 548], [x + i * 22, 534], [x + i * 22 + 8, 548], [x + i * 22 + 8, 600]], '#7a5c3c');
  return s;
}
function keep(x) {
  let s = rect(x - 62, 380, 124, 220, '#c3bcaa');
  for (const t of [-62, 30]) s += rect(x + t, 344, 32, 40, '#c3bcaa');
  for (let i = 0; i < 5; i++) s += rect(x - 62 + i * 26, 344, 13, 14, '#a49d8c', ' stroke="none"');
  s += rect(x - 12, 520, 24, 80, '#5b4a34');
  return s;
}
function church(x) {
  return rect(x - 80, 470, 160, 130, '#cfc6b2') +
    poly([[x - 88, 470], [x, 418], [x + 88, 470]], '#8f4638') +
    rect(x + 34, 380, 40, 90, '#cfc6b2') +
    poly([[x + 28, 380], [x + 54, 330], [x + 80, 380]], '#8f4638');
}
function cathedralBody(x, spireTop) {
  let s = rect(x - 96, 440, 192, 160, '#d6cdb9');
  s += poly([[x - 104, 440], [x, 392], [x + 104, 440]], '#8f4638');
  for (const t of [-96, 60]) {
    s += rect(x + t, spireTop + 40, 36, 400 - (spireTop + 40) + 200, '#d6cdb9');
    s += poly([[x + t - 6, spireTop + 40], [x + t + 18, spireTop], [x + t + 42, spireTop + 40]], '#7c5a49');
  }
  s += circle(x, 490, 22, '#9fb6c8');
  s += rect(x - 14, 540, 28, 60, '#5b4a34');
  return s;
}
const cathedral = x => cathedralBody(x, 250);
function cathedralBuild(x) {
  /* the same church, half-built, wrapped in scaffolding */
  let s = rect(x - 96, 470, 192, 130, '#d6cdb9');
  s += rect(x - 96, 330, 36, 270, '#d6cdb9');
  s += rect(x + 60, 430, 36, 170, '#cec5b1');
  s += `<g stroke="${INK}" stroke-width="2" fill="none">`;
  for (let i = 0; i < 4; i++) s += `<line x1="${x + 54}" y1="${420 + i * 45}" x2="${x + 104}" y2="${420 + i * 45}"/>`;
  s += `<line x1="${x + 54}" y1="410" x2="${x + 54}" y2="600"/><line x1="${x + 104}" y1="410" x2="${x + 104}" y2="600"/>`;
  s += '</g>';
  s += poly([[x + 40, 330], [x + 118, 330], [x + 118, 342], [x + 40, 342]], '#8a6a44');
  return s;
}
function chimney(x) {
  return poly([[x - 17, 600], [x - 12, 300], [x + 12, 300], [x + 17, 600]], '#8d4a38') +
    rect(x - 15, 300, 30, 14, '#6f3a2c');
}
function tower(x, solar) {
  let s = rect(x - 46, 230, 92, 370, '#aeb4b8');
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 3; c++)
      s += rect(x - 36 + c * 26, 250 + r * 38, 17, 24, r % 3 === 1 && c === 1 ? '#f0d98a' : '#7f8f9c', ' stroke="none"');
  if (solar) s += rect(x - 46, 216, 92, 14, '#3d5a8a');
  return s;
}
function crane(x) {
  return `<g stroke="${INK}" stroke-width="3" fill="none">` +
    `<line x1="${x}" y1="600" x2="${x}" y2="300"/>` +
    `<line x1="${x - 70}" y1="310" x2="${x + 120}" y2="310"/>` +
    `<line x1="${x + 90}" y1="310" x2="${x + 90}" y2="360"/>` +
    `<line x1="${x}" y1="300" x2="${x - 70}" y2="310"/><line x1="${x}" y1="300" x2="${x + 120}" y2="310"/>` +
    '</g>' + rect(x + 80, 360, 20, 20, '#c8a13c');
}

const SKYLINE = { motte, palisade, keep, church, cathedral, 'cathedral-build': cathedralBuild, chimney, crane,
  tower: x => tower(x, false), 'tower-solar': x => tower(x, true) };

function skyline(era) {
  const xs = { 1: [800], 2: [700, 900], 3: [660, 830, 960] }[era.skyline.length] || [800];
  return era.skyline.map((k, i) => (SKYLINE[k] || (() => ''))(xs[i])).join('');
}

/* ------------------------------------------------------------------ facades */
function windows(x, w, top, era, g) {
  const kind = era.house.window;
  const n = Math.max(1, Math.round(w / 62));
  const pad = (w - n * 30) / (n + 1);
  let s = '';
  for (let r = 0; r < era.house.storeys; r++) {
    const y = top + 30 + r * 78;
    for (let i = 0; i < n; i++) {
      const wx = x + pad + i * (30 + pad), ww = kind === 'picture' ? 30 + pad * 0.6 : 30;
      if (kind === 'hole') { s += rect(wx, y, ww, 26, '#3b2f24'); continue; }
      const lit = g() > 0.62;
      s += rect(wx, y, ww, kind === 'picture' ? 40 : 34, lit ? '#f2dd9a' : '#9fb2bd');
      if (kind === 'lead') s += `<g stroke="${INK}" stroke-width="1.5"><line x1="${esc(wx + ww / 2)}" y1="${y}" x2="${esc(wx + ww / 2)}" y2="${y + 34}"/><line x1="${esc(wx)}" y1="${y + 17}" x2="${esc(wx + ww)}" y2="${y + 17}"/></g>`;
      if (kind === 'sash') s += `<line x1="${esc(wx)}" y1="${y + 17}" x2="${esc(wx + ww)}" y2="${y + 17}" stroke="${INK}" stroke-width="1.5"/>`;
      if (kind === 'shutter') s += rect(wx - 7, y, 7, 34, '#6f5334') + rect(wx + ww, y, 7, 34, '#6f5334');
    }
  }
  return s;
}
function facade(x, w, era, g) {
  const h = 70 + era.house.storeys * 78;
  const top = GROUND - h;
  const mat = era.house.material;
  let s = '';

  /* timber upper storeys jetty out over the street, as they really did */
  const jetty = mat === 'timber' ? 14 : 0;
  s += rect(x - jetty, top, w + jetty * 2, h, WALL[mat] || '#ccc');

  if (mat === 'timber') {
    s += `<g stroke="#5d4224" stroke-width="7" fill="none" stroke-linecap="round">`;
    for (let r = 0; r < era.house.storeys; r++) {
      const y = top + r * 78;
      s += `<line x1="${esc(x - jetty)}" y1="${esc(y + 78)}" x2="${esc(x + w + jetty)}" y2="${esc(y + 78)}"/>`;
      s += `<line x1="${esc(x - jetty + 6)}" y1="${esc(y + 78)}" x2="${esc(x + w / 2)}" y2="${esc(y + 8)}"/>`;
      s += `<line x1="${esc(x + w + jetty - 6)}" y1="${esc(y + 78)}" x2="${esc(x + w / 2)}" y2="${esc(y + 8)}"/>`;
    }
    s += '</g>';
  }
  if (mat === 'brick') {
    s += `<g stroke="#8e4433" stroke-width="1.2" opacity="0.55">`;
    for (let y = top + 10; y < GROUND; y += 11) s += `<line x1="${esc(x)}" y1="${esc(y)}" x2="${esc(x + w)}" y2="${esc(y)}"/>`;
    s += '</g>';
  }
  if (mat === 'stone') {
    s += `<g stroke="#b0a794" stroke-width="1.4">`;
    for (let y = top + 18; y < GROUND; y += 22) s += `<line x1="${esc(x)}" y1="${esc(y)}" x2="${esc(x + w)}" y2="${esc(y)}"/>`;
    s += '</g>';
  }

  /* roof */
  const r = era.house.roof;
  if (r === 'flat') s += rect(x - 6, top - 14, w + 12, 14, ROOF.flat);
  else if (r === 'solar') {
    s += rect(x - 6, top - 14, w + 12, 14, ROOF.flat);
    for (let i = 0; i < Math.floor(w / 46); i++) s += rect(x + 8 + i * 46, top - 26, 34, 12, '#3d5a8a');
  } else {
    const pitch = r === 'thatch' ? 78 : r === 'tile' ? 58 : 40;
    s += poly([[x - jetty - 12, top], [x + w / 2, top - pitch], [x + w + jetty + 12, top]], ROOF[r]);
    if (r === 'thatch') s += poly([[x - jetty - 12, top], [x + w / 2, top - pitch], [x + w + jetty + 12, top]], 'none', ` stroke="#8f7440" stroke-width="2"`);
  }

  s += windows(x, w, top, era, g);

  /* door, and a hanging sign once trade needs advertising */
  const dx = x + w / 2 - 17;
  s += rect(dx, GROUND - 62, 34, 62, '#6b4c30');
  if (era.house.sign && g() > 0.45) {
    s += `<line x1="${esc(x + w - 18)}" y1="${esc(GROUND - 96)}" x2="${esc(x + w - 18)}" y2="${esc(GROUND - 130)}" stroke="${INK}" stroke-width="3"/>`;
    s += rect(x + w - 44, GROUND - 96, 52, 26, ['#c8a13c', '#7a8f5a', '#9c5340'][Math.floor(g() * 3)]);
  }
  /* a chimney, once there is anything worth heating */
  if (era.smoke > 0 && r !== 'flat' && r !== 'solar') s += rect(x + w - 26, top - 46, 16, 46, mat === 'brick' ? '#8d4a38' : '#a09482');
  return s;
}
function row(x0, x1, era, g) {
  let s = '', x = x0;
  while (x < x1 - 40) {
    const w = Math.min(x1 - x, 108 + Math.floor(g() * 74));
    /* a bomb site in 1950: the row has a hole in it */
    if (!(era.house.gap && x > x0 + 120 && x < x0 + 260)) s += facade(x, w, era, g);
    else s += rect(x, GROUND - 40, w, 40, '#9a9184') + rect(x + 10, GROUND - 62, 22, 22, '#b3aa9c');
    x += w + 4;
  }
  return s;
}

/* ------------------------------------------------------------------- street */
function ground(era, g) {
  const base = { mud: '#8a7355', cobble: '#9a988f', setts: '#8f8d86', asphalt: '#55565a' }[era.ground];
  let s = rect(-20, GROUND, W + 40, H - GROUND + 20, base, ' stroke="none"');
  s += `<line x1="-20" y1="${GROUND}" x2="${W + 20}" y2="${GROUND}" stroke="${INK}" stroke-width="2.5"/>`;
  if (era.ground === 'mud') {
    for (let i = 0; i < 9; i++) s += `<ellipse cx="${esc(g() * W)}" cy="${esc(GROUND + 40 + g() * 200)}" rx="${esc(24 + g() * 40)}" ry="${esc(7 + g() * 8)}" fill="#6f5b42" stroke="none"/>`;
  } else if (era.ground === 'cobble') {
    for (let i = 0; i < 150; i++) s += `<ellipse cx="${esc(g() * W)}" cy="${esc(GROUND + 14 + g() * 230)}" rx="7" ry="5" fill="#87857d" stroke="none"/>`;
  } else if (era.ground === 'setts') {
    s += `<g stroke="#7d7b75" stroke-width="1.6">`;
    for (let y = GROUND + 18; y < H; y += 26) s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
    for (let i = 0; i < 40; i++) s += `<line x1="${esc(g() * W)}" y1="${esc(GROUND + 18 + Math.floor(g() * 9) * 26)}" x2="${esc(g() * W)}" y2="${esc(GROUND + 44 + Math.floor(g() * 9) * 26)}"/>`;
    s += '</g>';
  } else {
    s += `<line x1="0" y1="${GROUND + 130}" x2="${W}" y2="${GROUND + 130}" stroke="#e6e2d4" stroke-width="6" stroke-dasharray="60 46"/>`;
  }
  return s;
}

/* -------------------------------------------------------------------- props */
const P = {
  barrel: (x, y) => rect(x, y - 44, 40, 44, '#8a6a44') + `<g stroke="#5d4224" stroke-width="3"><line x1="${x}" y1="${y - 32}" x2="${x + 40}" y2="${y - 32}"/><line x1="${x}" y1="${y - 14}" x2="${x + 40}" y2="${y - 14}"/></g>`,
  pig: (x, y) => `<ellipse cx="${x + 22}" cy="${y - 16}" rx="24" ry="14" fill="#d8a79c"/>` + circle(x + 46, y - 22, 9, '#d8a79c') + `<g stroke="${INK}" stroke-width="2.5"><line x1="${x + 10}" y1="${y - 6}" x2="${x + 10}" y2="${y}"/><line x1="${x + 32}" y1="${y - 6}" x2="${x + 32}" y2="${y}"/></g>`,
  stall: (x, y, g) => {
    const a = ['#c9534a', '#3f7f6d', '#c8a13c', '#5b6fa8'][Math.floor(g() * 4)];
    let s = rect(x, y - 46, 130, 46, '#9c7a4e');
    s += `<g stroke="${INK}" stroke-width="2.5"><line x1="${x + 6}" y1="${y - 46}" x2="${x + 6}" y2="${y - 128}"/><line x1="${x + 124}" y1="${y - 46}" x2="${x + 124}" y2="${y - 128}"/></g>`;
    for (let i = 0; i < 5; i++) s += rect(x - 6 + i * 29, y - 140, 29, 22, i % 2 ? a : '#efe6d2');
    s += poly([[x - 6, y - 118], [x + 139, y - 118], [x + 139, y - 108], [x - 6, y - 108]], a);
    for (let i = 0; i < 6; i++) s += circle(x + 16 + (i % 3) * 22, y - 54 - Math.floor(i / 3) * 16, 9, ['#b8443a', '#7d9c46', '#c8973c'][i % 3]);
    return s;
  },
  cart: (x, y) => rect(x, y - 52, 96, 34, '#9c7a4e') + circle(x + 20, y - 12, 17, '#7a5c3c') + circle(x + 78, y - 12, 17, '#7a5c3c'),
  carriage: (x, y) => rect(x + 46, y - 84, 84, 56, '#4a4d55') + rect(x + 62, y - 74, 26, 24, '#c9d6de') +
    circle(x + 60, y - 16, 16, '#3d3f45') + circle(x + 118, y - 16, 20, '#3d3f45') +
    `<ellipse cx="${x - 6}" cy="${y - 52}" rx="42" ry="22" fill="#8a5f3c"/>` + circle(x - 44, y - 66, 13, '#8a5f3c') +
    `<g stroke="${INK}" stroke-width="3"><line x1="${x - 22}" y1="${y - 32}" x2="${x - 24}" y2="${y}"/><line x1="${x + 10}" y1="${y - 32}" x2="${x + 12}" y2="${y}"/><line x1="${x + 22}" y1="${y - 58}" x2="${x + 48}" y2="${y - 62}"/></g>`,
  tram: (x, y) => rect(x, y - 108, 210, 86, '#8b5a3c') + rect(x + 12, y - 96, 56, 40, '#c9d6de') + rect(x + 82, y - 96, 56, 40, '#c9d6de') + rect(x + 152, y - 96, 44, 40, '#c9d6de') +
    circle(x + 40, y - 12, 14, '#3d3f45') + circle(x + 170, y - 12, 14, '#3d3f45') +
    `<line x1="${x + 105}" y1="${y - 108}" x2="${x + 150}" y2="${y - 176}" stroke="${INK}" stroke-width="3"/>`,
  car: (x, y, g) => {
    const c = ['#3f6f9c', '#9c4038', '#d8d3c6', '#4a6b4a'][Math.floor(g() * 4)];
    return `<path d="M ${x} ${y - 26} q 4 -32 44 -34 l 22 -26 q 40 -4 62 26 l 34 6 q 24 6 22 28 z" fill="${c}"/>` +
      rect(x + 52, y - 78, 40, 26, '#c9d6de') + circle(x + 40, y - 12, 15, '#2f3136') + circle(x + 142, y - 12, 15, '#2f3136');
  },
  bike: (x, y) => `<g fill="none" stroke="${INK}" stroke-width="3.5"><circle cx="${x + 16}" cy="${y - 16}" r="16"/><circle cx="${x + 74}" cy="${y - 16}" r="16"/><path d="M ${x + 16} ${y - 16} l 20 -30 h 26 l 12 30 M ${x + 36} ${y - 46} h 26"/></g>`,
  'lamp-oil': (x, y) => rect(x + 5, y - 96, 8, 96, '#4a4238') + rect(x - 4, y - 122, 26, 26, '#e8d79a') + poly([[x - 8, y - 122], [x + 9, y - 138], [x + 26, y - 122]], '#4a4238'),
  'lamp-gas': (x, y) => rect(x + 5, y - 128, 8, 128, '#3e4a44') + rect(x - 5, y - 158, 28, 30, '#f2e3a4') + poly([[x - 9, y - 158], [x + 9, y - 176], [x + 27, y - 158]], '#3e4a44'),
  'lamp-electric': (x, y) => `<path d="M ${x + 6} ${y} v -160 q 0 -22 30 -22" fill="none" stroke="#5a5f63" stroke-width="7"/>` + `<ellipse cx="${x + 40}" cy="${y - 178}" rx="17" ry="9" fill="#f5eab4"/>`,
};

function street(era, g) {
  const slots = [110, 330, 1120, 1360, 560];
  let s = '';
  era.street.forEach((k, i) => {
    const fn = P[k];
    if (!fn) return;
    const x = slots[i % slots.length] + (g() - 0.5) * 60;
    s += fn(x, GROUND + 150 + (i % 2) * 40, g);
  });
  return s;
}

/* ------------------------------------------------------------------- people */
const SKIN = ['#e8bd96', '#c98d63', '#8d5a3b', '#f0d3b0', '#6f4630'];
function person(x, y, s, era, g) {
  const pal = era.year < 1500 ? ['#7a5c3c', '#5b6b4a', '#8a4a3c', '#4a5a6b', '#6b5a7a']
    : era.year < 1850 ? ['#3f4a5a', '#6b3a3a', '#4a5a3a', '#5a4a6b', '#7a6a4a']
      : ['#2f3136', '#3f6f9c', '#9c4038', '#4a4a4a', '#6b6b6b'];
  const c = pal[Math.floor(g() * pal.length)];
  const skin = SKIN[Math.floor(g() * SKIN.length)];
  const h = 118 * s;
  return `<g transform="translate(${esc(x)} ${esc(y)}) scale(${esc(s)})">` +
    `<path d="M -17 0 q 0 -56 17 -56 q 17 0 17 56 z" fill="${c}"/>` +
    rect(-13, -76, 26, 24, c) +
    circle(0, -88, 12, skin) +
    (era.year < 1700 && g() > 0.5 ? poly([[-13, -94], [13, -94], [10, -104], [-10, -104]], '#8a7455') : '') +
    '</g>';
}
function crowd(era, g) {
  let s = '';
  for (let i = 0; i < era.crowd; i++) {
    const depth = g();
    const x = 60 + g() * (W - 120);
    const y = GROUND + 60 + depth * 210;
    s += person(x, y, 0.7 + depth * 0.75, era, g);
  }
  return s;
}

/* -------------------------------------------------------------------- smoke */
function smoke(era, g) {
  if (!era.smoke) return '';
  let s = '';
  for (let i = 0; i < era.smoke; i++) {
    const x = 200 + g() * 1200, y = 300 + g() * 60;
    for (let k = 0; k < 4; k++)
      s += circle(x + k * 16 + g() * 12, y - k * 34, 16 + k * 7, '#cfc9bd', ` opacity="${esc(0.5 - k * 0.09)}" stroke="none"`);
  }
  return s;
}

/* --------------------------------------------------------------------- draw */
export function drawEra(era) {
  const g = rng(era.year);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<defs><linearGradient id="sky-${era.year}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${era.sky[0]}"/><stop offset="1" stop-color="${era.sky[1]}"/>` +
    `</linearGradient></defs>` +
    `<g stroke="${INK}" stroke-width="2.5" stroke-linejoin="round">` +
    sky(era) + hills(era) + skyline(era) + smoke(era, g) +
    row(-30, GAP[0], era, g) + row(GAP[1], W + 30, era, g) +
    ground(era, g) + street(era, g) + crowd(era, g) +
    '</g></svg>';
}
