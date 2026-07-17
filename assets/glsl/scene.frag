#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uE; uniform float uFinal; uniform float uMode;
uniform vec2 uPointer; uniform vec4 uPing;
out vec4 O;

#define PI 3.14159265

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float hash1(float n) { return fract(sin(n) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
const mat2 M2 = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = M2 * p; a *= 0.5; }
  return v;
}
float ridge(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * (1.0 - abs(2.0 * noise(p) - 1.0)); p = M2 * p; a *= 0.5; }
  return v;
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float wband(float e, float lo, float hi) {
  if (e < lo || e > hi) return 0.0;
  return min(1.0, (e - lo) / 0.7) * min(1.0, (hi - e) / 0.7);
}
float wbandR(float e, float lo, float hi, float r) {
  if (e < lo || e > hi) return 0.0;
  return min(1.0, (e - lo) / r) * min(1.0, (hi - e) / r);
}
/* local zoom: content drawn at its own scale keeps shrinking as gE grows.
   gE tracks uE in space mode; time mode sets it per reused scene. */
float gE = 0.0;
float zoomFor(float eCenter) { return pow(10.0, clamp(gE - eCenter, -2.2, 2.2)); }

float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
/* round stars with soft halos; scans 3x3 neighbor cells so no glow is ever
   clipped into a square. The brightest get diffraction spikes. */
vec3 starLayer(vec2 p, float thresh, float t) {
  vec3 col = vec3(0.0);
  vec2 base = floor(p);
  vec2 fp = fract(p);
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec2 id = base + o;
    float h = hash(id);
    if (h < thresh) continue;
    vec2 pos = o + 0.5 + (vec2(hash(id + 1.0), hash(id + 2.0)) - 0.5) * 0.8;
    vec2 q = fp - pos;
    float d2 = dot(q, q);
    float tw = 0.75 + 0.25 * sin(t * (1.0 + h * 3.0) + h * 40.0);
    vec3 tint = mix(vec3(0.62, 0.74, 1.0), vec3(1.0, 0.78, 0.55), step(0.72, hash(id + 5.0)));
    float b = (h - thresh) / (1.0 - thresh);
    col += tint * tw * b * 0.0009 / (d2 + 0.0009);
    if (h > 0.996) {
      float sp = exp(-abs(q.x) * 30.0) * exp(-abs(q.y) * 200.0)
               + exp(-abs(q.y) * 30.0) * exp(-abs(q.x) * 200.0);
      col += tint * sp * 0.5 * tw;
    }
  }
  return col;
}

/* ---------- 0 quantum foam — the vacuum, boiling: an interference field
   with a chromatic uncertainty fringe, flux filaments, and virtual pairs
   that are born together, drift apart, and annihilate in a flash ---------- */
vec3 scFoam(vec2 uv, float t) {
  vec2 p = uv * zoomFor(-16.0) * 3.0;

  /* seething interference field, sampled slightly apart per channel */
  vec2 w = vec2(fbm(p * 2.0 + t * 0.5), fbm(p * 2.0 - t * 0.4 + 7.0));
  float fR = fbm(p * 3.0 + w * 1.6 + vec2(0.05, 0.0) + t * 0.3);
  float fG = fbm(p * 3.0 + w * 1.6 + t * 0.3);
  float fB = fbm(p * 3.0 + w * 1.6 - vec2(0.05, 0.0) + t * 0.3);
  vec3 boil = vec3(fR * fR, fG * fG, fB * fB);
  vec3 col = boil * vec3(0.55, 0.22, 0.95) * 1.1;
  col += boil.g * vec3(0.05, 0.10, 0.30);

  /* flux filaments threading the field */
  col += vec3(0.55, 0.30, 1.0) * pow(ridge(p * 2.2 + w + t * 0.2), 6.0) * 0.9;

  /* virtual particle-antiparticle pairs (3x3 scan: nothing clips square) */
  vec2 g = p * 2.2;
  vec2 base = floor(g);
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec2 id = base + o;
    float h = hash(id);
    if (h < 0.45) continue;
    float ph = fract(t * (0.22 + 0.30 * h) + h * 7.0);          // lifecycle
    float sep = 0.10 + 0.26 * sin(ph * PI);
    vec2 ctr = o + 0.5 + (vec2(hash(id + 1.0), hash(id + 2.0)) - 0.5) * 0.55;
    float ang = hash(id + 3.0) * 6.28318 + t * 0.15;
    vec2 ax = vec2(cos(ang), sin(ang)) * sep;
    vec2 q = fract(g) - ctr;
    float vis = smoothstep(0.0, 0.10, ph) * smoothstep(1.0, 0.90, ph);
    float d1 = dot(q - ax, q - ax), d2 = dot(q + ax, q + ax);
    col += (vec3(0.65, 0.75, 1.0) * (0.0007 / (d1 + 0.0007))
          + vec3(1.0, 0.55, 0.85) * (0.0007 / (d2 + 0.0007))) * vis * 0.8;
    col += vec3(0.5, 0.35, 0.9) * exp(-sdSeg(q, -ax, ax) * 55.0) * vis * 0.22;
    float flash = exp(-dot(q, q) * 60.0) * smoothstep(0.86, 0.965, ph) * (1.0 - smoothstep(0.965, 1.0, ph));
    col += vec3(0.95, 0.85, 1.0) * flash * 1.6;                 // annihilation
  }
  return col;
}
/* ---------- 1 nucleus — shaded nucleons packed in a gluon field ---------- */
vec3 scNucleus(vec2 uv, float t) {
  vec2 p = uv * zoomFor(-14.6) * 2.4;
  vec3 col = vec3(0.0);
  float glow = 0.0;
  float bestD = 1e9; vec2 bestC = vec2(0.0); float bestI = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 c = 0.55 * vec2(sin(fi * 2.4 + t * 0.6 + sin(t * 0.9 + fi)),
                         cos(fi * 1.7 - t * 0.5)) * (0.4 + 0.35 * hash1(fi));
    float d = length(p - c);
    glow += 0.010 / (d * d + 0.02);
    if (d < bestD) { bestD = d; bestC = c; bestI = fi; }
  }
  float RN = 0.26;
  if (bestD < RN) {
    vec2 q = (p - bestC) / RN;
    float z = sqrt(max(1.0 - dot(q, q), 0.0));
    vec3 n = vec3(q, z);
    vec3 L = normalize(vec3(-0.5, 0.6, 0.7));
    float dif = clamp(dot(n, L), 0.0, 1.0);
    float spec = pow(clamp(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 30.0);
    vec3 base = mix(vec3(0.82, 0.28, 0.11), vec3(0.72, 0.74, 0.78), step(0.5, mod(bestI, 2.0)));
    float flick = 0.85 + 0.30 * fbm(q * 3.0 + t * 1.5 + bestI);
    col = base * (dif * 0.9 + 0.08) * flick + spec * vec3(1.0, 0.9, 0.8) * 0.45;
    col += vec3(1.0, 0.5, 0.2) * pow(1.0 - z, 2.0) * 0.30;      // rim bleeding into the field
  }
  col += vec3(1.0, 0.45, 0.15) * glow * 0.26 * (0.75 + 0.25 * sin(t * 3.0));
  col += vec3(0.85, 0.45, 0.9) * pow(fbm(p * 5.0 + t * 1.2), 6.0) * glow * 0.8;   // gluon shimmer
  return col;
}
/* ---------- 2 atom ---------- */
vec3 scAtom(vec2 uv, float t) {
  vec2 p = uv * zoomFor(-10.3) * 1.5;
  float r = length(p);
  float th = atan(p.y, p.x);
  float orb = exp(-r * 2.1) * (0.45 + 0.55 * pow(abs(cos(th * 2.0 + t * 0.12)), 2.0));
  orb += exp(-abs(r - 0.85) * 5.0) * 0.30 * (0.6 + 0.4 * sin(th * 6.0 - t * 0.4));
  vec3 col = vec3(0.12, 0.55, 0.75) * orb * 0.85;
  col += vec3(0.9, 0.95, 1.0) * exp(-r * 60.0) * 1.4;                      // the nucleus, a point
  float spark = step(0.9965, hash(floor(vec2(th * 20.0, r * 30.0) + t * 3.0)));
  col += spark * vec3(0.5, 0.9, 1.0) * exp(-r * 1.5) * 0.8;
  return col;
}
/* ---------- 3 helix — B-DNA: asymmetric grooves, base pairs, depth ---------- */
vec3 scHelix(vec2 uv, float t) {
  vec2 p = rot(0.5) * uv * zoomFor(-8.7) * 2.0;
  float ph = p.x * 4.6 + t * 0.25;
  vec3 col = vec3(0.0);
  /* out-of-focus solvent behind */
  col += vec3(0.015, 0.045, 0.035) * fbm(p * 2.0 + t * 0.05);
  col += vec3(0.05, 0.13, 0.10) * pow(noise(p * 5.0 + vec2(t * 0.1, 3.0)), 10.0) * 3.0;

  float amp = 0.40;
  const float GAP = 2.1;                          // B-DNA strand offset: 2.1 rad, not pi
  float y1 = sin(ph) * amp,       z1 = cos(ph);
  float y2 = sin(ph + GAP) * amp, z2 = cos(ph + GAP);

  /* base pairs: one rung per 1/10.5 turn, two-tone (purine/pyrimidine) */
  float spacing = 6.28318 / 10.5;
  float k = floor(ph / spacing + 0.5);
  float phk = k * spacing;
  float dx = abs(ph - phk) / 4.6;
  float ya = sin(phk) * amp, yb = sin(phk + GAP) * amp;
  float lo = min(ya, yb), hi = max(ya, yb);
  float inRung = step(lo, p.y) * step(p.y, hi);
  float rz = (cos(phk) + cos(phk + GAP)) * 0.5;
  float rung = smoothstep(0.016, 0.007, dx) * inRung;
  float hf = step((lo + hi) * 0.5, p.y);
  vec3 baseA = mix(vec3(0.95, 0.62, 0.20), vec3(0.30, 0.72, 0.95), step(0.5, hash1(k)));
  vec3 baseB = mix(vec3(0.85, 0.32, 0.42), vec3(0.42, 0.88, 0.52), step(0.5, hash1(k + 31.0)));
  col += mix(baseA, baseB, hf) * rung * (0.40 + 0.30 * rz);
  /* phosphate beads where each rung meets its strand */
  col += vec3(0.25, 0.9, 0.65) * exp(-length(vec2(dx, p.y - ya)) * 90.0) * (0.55 + 0.45 * cos(phk));
  col += vec3(0.20, 0.75, 0.85) * exp(-length(vec2(dx, p.y - yb)) * 90.0) * (0.55 + 0.45 * cos(phk + GAP));

  /* the two backbones, drawn back-to-front so crossings occlude correctly */
  float w1 = 0.030 + 0.013 * z1;
  float s1 = smoothstep(w1, w1 * 0.25, abs(p.y - y1));
  float w2 = 0.030 + 0.013 * z2;
  float s2 = smoothstep(w2, w2 * 0.25, abs(p.y - y2));
  vec3 c1 = vec3(0.20, 0.85, 0.60) * (0.55 + 0.45 * z1);
  vec3 c2 = vec3(0.16, 0.70, 0.80) * (0.55 + 0.45 * z2);
  if (z1 < z2) { col = mix(col, c1, s1); col = mix(col, c2, s2); }
  else         { col = mix(col, c2, s2); col = mix(col, c1, s1); }

  col *= exp(-abs(p.y) * 0.55);                    // depth-of-field falloff
  return col * 0.85;
}
/* ---------- 4 cell — fluorescence micrograph: membrane, nucleus with
   chromatin and nucleolus, mitochondria as orange rods, cytoskeleton ---------- */
vec3 scCell(vec2 uv, float t) {
  vec2 p = uv * zoomFor(-6.0) * 1.5;
  float r = length(p);
  vec2 dir = normalize(p + 1e-4);

  /* irregular, slowly breathing outline */
  float R = 0.80 + 0.14 * fbm(dir * 2.3 + t * 0.10) - 0.05 * fbm(dir * 5.0 - t * 0.06);
  float dEdge = r - R;
  float inside = smoothstep(0.015, -0.03, dEdge);

  vec3 col = vec3(0.004, 0.006, 0.010);                           // dark-field background
  col += vec3(0.018, 0.03, 0.024) * fbm(p * 1.2 + 7.0) * (1.0 - inside);  // blurred neighbors

  /* membrane stain: bright uneven rim with a soft halo */
  float mem = exp(-abs(dEdge) * 60.0) * (0.7 + 0.5 * fbm(dir * 6.0 + 1.0));
  col += vec3(0.25, 0.95, 0.55) * mem * 0.8;
  col += vec3(0.10, 0.50, 0.30) * exp(-abs(dEdge) * 14.0) * 0.30;

  /* cytoplasm: endoplasmic granularity, denser toward the membrane */
  float er = fbm(p * 9.0 + vec2(t * 0.05, 0.0));
  col += inside * vec3(0.05, 0.20, 0.15) * (0.35 + 0.65 * er) * smoothstep(-0.7, 0.0, dEdge);
  /* cytoskeleton filaments */
  col += inside * vec3(0.10, 0.36, 0.27) * pow(ridge(p * 3.5 + 5.0), 6.0) * 0.4;

  /* nucleus: offset oval, envelope, chromatin, one bright nucleolus */
  vec2 np = rot(0.4) * ((p - vec2(0.16, -0.08)) * vec2(1.0, 1.25));
  float nr = length(np);
  float NR = 0.30 + 0.03 * fbm(normalize(np + 1e-4) * 3.0 + 2.0);
  float nIn = smoothstep(0.01, -0.02, nr - NR);
  float chrom = fbm(np * 12.0 + 4.0);
  col = mix(col, vec3(0.15, 0.20, 0.62) * (0.35 + 0.75 * chrom), nIn * inside * 0.92);
  col += vec3(0.30, 0.40, 1.0) * exp(-abs(nr - NR) * 70.0) * inside * 0.5;
  col += vec3(0.50, 0.55, 1.0) * pow(exp(-length(np - vec2(0.08, 0.05)) * 24.0), 2.0) * inside * 0.8;

  /* mitochondria: orange rods scattered through the cytoplasm */
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    vec2 c = vec2(sin(fi * 2.4 + 1.7), cos(fi * 1.9 + 4.2)) * (0.30 + 0.28 * hash1(fi + 8.0));
    float ang = hash1(fi + 3.0) * 6.28318 + t * 0.04;
    vec2 ax = vec2(cos(ang), sin(ang)) * (0.055 + 0.03 * hash1(fi));
    float dm = sdSeg(p, c - ax, c + ax);
    float body = smoothstep(0.030, 0.012, dm);
    col = mix(col, vec3(1.0, 0.55, 0.15) * (0.65 + 0.35 * noise(p * 40.0 + fi)), body * inside * (1.0 - nIn));
    col += vec3(1.0, 0.50, 0.10) * exp(-dm * 30.0) * 0.10 * inside * (1.0 - nIn);
  }

  /* vesicles drifting in the cytosol */
  col += inside * (1.0 - nIn) * vec3(0.45, 0.85, 0.65)
       * pow(noise(p * 16.0 + vec2(9.0, t * 0.1)), 12.0) * 2.5;
  return col;
}
/* ---------- 5 subpixels ---------- */
vec3 scScreen(vec2 uv, float t) {
  float z = zoomFor(-3.6);
  vec2 p = uv * z * 9.0;
  vec2 cell = floor(p);
  vec2 f = fract(p);
  float img = 0.35 + 0.65 * fbm(cell * 0.18 + t * 0.05);
  float lane = floor(f.x * 3.0);
  vec2 bp = vec2(fract(f.x * 3.0) - 0.5, f.y - 0.5);
  vec2 dr = max(abs(bp) - vec2(0.15, 0.28), 0.0);        // capsule-shaped emitters, not squares
  float d = length(dr);
  float bar = smoothstep(0.10, 0.015, d);
  float glow = 0.010 / (d * d + 0.016);
  vec3 rgb = lane < 0.5 ? vec3(1.0, 0.08, 0.05) : (lane < 1.5 ? vec3(0.05, 1.0, 0.15) : vec3(0.1, 0.25, 1.0));
  vec3 col = rgb * (bar + glow * 0.45) * img;
  col *= 0.9 + 0.1 * sin(uv.y * uRes.y * 1.6);           // faint scanline
  return col * 0.9;
}
/* ---------- 6 human — the DOM's scale; shader just breathes ---------- */
vec3 scHuman(vec2 uv, float t) {
  float r = length(uv * vec2(0.8, 1.0));
  float breathe = 0.5 + 0.5 * sin(t * 0.5);
  vec3 col = vec3(0.10, 0.075, 0.05) * exp(-r * 1.6) * (0.8 + 0.2 * breathe);
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    vec2 c = vec2(sin(fi * 1.7 + t * 0.05) * 0.9, fract(hash1(fi) + t * 0.008) * 2.0 - 1.0);
    col += vec3(0.5, 0.42, 0.3) * 0.0011 / (dot(uv - c, uv - c) + 0.002);
  }
  return col;
}
/* ---------- 7 city — daylight satellite imagery, the atlas look ----------
   A real terrain: elevation field with hillshading, a carved river valley,
   forests climbing the slopes, drier fields on the plateaus. On the plain,
   an urban fabric of perimeter blocks — rowhouses aligned along the
   streets with ridged two-slope roofs and inner courtyards — detached
   houses at the edge, cast shadows, traffic, then clouds and haze. */
float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = M2 * p; a *= 0.5; }
  return v;
}
float mea3(float x) { return (fbm3(vec2(x * 0.35, 3.1)) - 0.5) * 2.2; }
float terraAt(vec2 p, float meander) {
  float rd = p.y - meander;
  return fbm3(p * 0.5 + 41.0) - 0.38 * exp(-rd * rd * 5.0);   // the river carves its valley
}
/* Elevation, its gradient, and the river's meander in one pass. The meander only
   depends on x, so the point and its y-neighbour share it, and callers get it back
   instead of evaluating it a fourth time: seven fbm3 per pixel down to five. */
float terraG(vec2 p, out vec2 grad, out float meander) {
  meander = mea3(p.x);
  float e0 = terraAt(p, meander);
  grad = vec2(terraAt(p + vec2(0.05, 0.0), mea3(p.x + 0.05)) - e0,
              terraAt(p + vec2(0.0, 0.05), meander) - e0);
  return e0;
}
float roadGrid(vec2 q, float spacing, float width) {
  vec2 g = abs(fract(q / spacing) - 0.5) * spacing;
  float d = min(g.x, g.y);
  float aa = fwidth(d) + 1e-4;
  return smoothstep(width + aa, width - aa, d);
}
/* built mass at q — used twice: at the shading point and offset for cast shadows */
float urbanMass(vec2 q, float rowMix) {
  vec2 cid = floor(q / 0.17);
  vec2 inn = fract(q / 0.17);
  vec2 m0 = 0.12 + 0.10 * vec2(hash(cid + 2.0), hash(cid + 5.0));
  float det = step(m0.x, inn.x) * step(inn.x, 1.0 - m0.x * 0.6)
            * step(m0.y, inn.y) * step(inn.y, 1.0 - m0.y);
  float b = min(min(inn.x, 1.0 - inn.x), min(inn.y, 1.0 - inn.y));
  float depth = 0.16 + 0.10 * hash(cid + 21.0);
  float nearY = step(min(inn.y, 1.0 - inn.y), min(inn.x, 1.0 - inn.x));
  float tang = mix(inn.y, inn.x, nearY);
  float houseN = 5.0 + floor(4.0 * hash(cid + 3.0));
  float hh = hash(cid * 3.1 + floor(tang * houseN) + nearY * 7.0);
  float row = step(0.045, b) * step(b, 0.045 + depth) * step(0.10, hh);
  float mass = mix(det * step(0.10, hash(cid + 9.0)), row, rowMix);
  float park = step(0.93, hash(cid + 13.0));
  return mass * (1.0 - park) * step(0.06, hash(cid + 9.0));
}
vec3 scCity(vec2 uv, float t) {
  vec2 p = rot(0.25) * uv * zoomFor(3.9) * 2.6;

  /* terrain: elevation, slope, hillshade */
  vec2 grad; float meander;
  float el = terraG(p, grad, meander);
  vec3 tn = normalize(vec3(-grad.x * 7.0, -grad.y * 7.0, 1.0));
  float hillshade = clamp(dot(tn, normalize(vec3(-0.5, 0.55, 0.75))), 0.0, 1.0);
  float elN = smoothstep(0.05, 0.75, el);
  float slope = length(grad) * 20.0;

  /* countryside: lush valley floor, drier plateaus, pasture on the slopes */
  vec2 fscale = vec2(2.6, 4.2);
  float fh = hash(floor(p * fscale + vec2(0.0, 17.0)));
  vec3 field = mix(vec3(0.34, 0.41, 0.20), vec3(0.58, 0.53, 0.33), fh);
  field = mix(field, vec3(0.44, 0.30, 0.19), step(0.82, fh));            // ploughed earth
  field = mix(field, vec3(0.52, 0.50, 0.30), elN * 0.55);                // dry uplands
  float pasture = smoothstep(0.35, 0.8, slope);
  field = mix(field, vec3(0.38, 0.46, 0.24), pasture * 0.8);             // slopes: open grass
  field *= 0.90 + 0.10 * noise(p * 34.0);
  vec2 fg = abs(fract(p * fscale) - 0.5);
  field *= 1.0 - smoothstep(0.455, 0.5, max(fg.x, fg.y)) * 0.5 * (1.0 - pasture * 0.7);
  float forest = smoothstep(0.58, 0.72, fbm(p * 0.7 + 23.0) + elN * 0.18 + slope * 0.22);
  vec3 col = mix(field, vec3(0.12, 0.19, 0.10) * (0.8 + 0.4 * noise(p * 26.0)), forest);

  /* relief shading over the open land */
  col *= 0.55 + 0.60 * hillshade;

  /* the river in its valley, with its dark tree line */
  float rd = abs(p.y - meander);
  col = mix(col, vec3(0.10, 0.18, 0.085), smoothstep(0.15, 0.055, rd) * 0.75);
  float river = smoothstep(0.05, 0.032, rd);
  col = mix(col, vec3(0.12, 0.18, 0.17) * (0.8 + 0.3 * hillshade), river);

  /* highway skirting the town */
  float hwd = abs(p.x * 0.62 + p.y * 0.45 - 0.85 - (fbm3(vec2(p.y * 0.3, 8.0)) - 0.5) * 1.1);
  float hwm = smoothstep(0.030, 0.016, hwd);

  /* urban mask: the town stays on the plain, dense near the river bend */
  vec2 pc = p - vec2(0.35, -0.15);
  float urb = smoothstep(0.15, 0.42, exp(-dot(pc, pc) * 0.5) * (0.45 + 0.55 * fbm3(p * 1.1 + 3.0)));
  urb *= smoothstep(0.85, 0.45, elN + slope * 0.4);
  float core = exp(-dot(pc, pc) * 2.6) * smoothstep(0.7, 0.3, elN);
  float rowMix = smoothstep(0.20, 0.65, core * 1.5 + urb * 0.2);

  /* street network bent by the terrain */
  vec2 q = p + (vec2(fbm3(p * 0.9 + 4.0), fbm3(p * 0.9 + 9.0)) - 0.5) * 0.55
             + grad * 2.2;
  float av = roadGrid(q, 0.85, 0.014);
  float st = roadGrid(q, 0.17, 0.005);

  /* the block, evaluated at this point: perimeter rows or detached parcels */
  vec2 cid = floor(q / 0.17);
  vec2 inn = fract(q / 0.17);
  vec2 m0 = 0.12 + 0.10 * vec2(hash(cid + 2.0), hash(cid + 5.0));
  float det = step(m0.x, inn.x) * step(inn.x, 1.0 - m0.x * 0.6)
            * step(m0.y, inn.y) * step(inn.y, 1.0 - m0.y);
  float b = min(min(inn.x, 1.0 - inn.x), min(inn.y, 1.0 - inn.y));
  float depth = 0.16 + 0.10 * hash(cid + 21.0);
  float nearY = step(min(inn.y, 1.0 - inn.y), min(inn.x, 1.0 - inn.x));
  float tang = mix(inn.y, inn.x, nearY);
  float houseN = 5.0 + floor(4.0 * hash(cid + 3.0));
  float houseId = floor(tang * houseN);
  float hh = hash(cid * 3.1 + houseId + nearY * 7.0);
  float row = step(0.045, b) * step(b, 0.045 + depth) * step(0.10, hh);
  float blockOk = step(0.06, hash(cid + 9.0));
  float park = step(0.93, hash(cid + 13.0));
  float mass = mix(det * step(0.10, hash(cid + 9.0)), row, rowMix) * (1.0 - park) * blockOk;

  /* roof colors: terracotta rows in the core, slate/pale at the edge */
  float ph = hash(cid * 1.7 + houseId + 11.0);
  vec3 roof = mix(vec3(0.50, 0.485, 0.46), vec3(0.60, 0.335, 0.22), smoothstep(0.15, 0.55, core) * step(0.15, ph));
  roof = mix(roof, vec3(0.74, 0.74, 0.72), step(0.90, ph) * (1.0 - smoothstep(0.1, 0.5, core)));
  roof *= 0.82 + 0.36 * hh;
  /* two-slope ridged roofs on the rows: street-side pitch catches the sun */
  float dSlope = clamp((b - 0.045) / depth, 0.0, 1.0);
  float ridged = mix(1.0, mix(1.12, 0.80, step(0.5, dSlope)), rowMix * row);
  ridged *= 1.0 - 0.18 * smoothstep(0.06, 0.0, abs(dSlope - 0.5)) * rowMix * row;   // ridge line
  roof *= ridged;
  /* detached houses keep the simple lit/shaded edge */
  float edgeSh = smoothstep(0.10, 0.0, inn.x - m0.x) + smoothstep(0.10, 0.0, (1.0 - m0.y) - inn.y);
  roof *= 1.0 - 0.30 * clamp(edgeSh, 0.0, 1.0) * (1.0 - rowMix);

  /* courtyards inside the blocks, gardens around detached houses */
  vec3 court = mix(vec3(0.40, 0.39, 0.36), vec3(0.24, 0.33, 0.17), step(0.5, hash(cid + 27.0)));
  court *= 0.85 + 0.3 * noise(q * 70.0);
  vec3 garden = mix(vec3(0.27, 0.36, 0.18), vec3(0.42, 0.41, 0.38), 0.4 + 0.4 * noise(q * 55.0));
  vec3 lot = mix(garden, court, rowMix * step(0.045 + depth, b));
  lot = mix(lot, vec3(0.19, 0.29, 0.14), park);

  vec3 fab = mix(lot, roof, mass);
  float massS = urbanMass(q + vec2(0.030, -0.030), rowMix);   // sun from the south-west
  fab *= 1.0 - massS * (1.0 - mass) * 0.32;                   // cast shadows on ground
  fab = mix(fab, vec3(0.49, 0.49, 0.475), st);
  fab = mix(fab, vec3(0.56, 0.56, 0.545), av);
  float traf = av * pow(noise(q * 60.0 + vec2(t * 0.9, 0.0)), 10.0) * 6.0 * smoothstep(3.4, 2.4, uE);
  fab += vec3(0.85) * traf;
  fab *= 0.86 + 0.22 * hillshade;                             // gentle relief over the town

  col = mix(col, fab, urb * (1.0 - river));
  col = mix(col, vec3(0.57, 0.57, 0.555) * (0.8 + 0.3 * hillshade), hwm * (1.0 - urb * 0.35));

  /* altitude: cumulus with offset shadows, then blue haze */
  float alt = smoothstep(3.4, 5.5, uE);
  float clN = fbm(p * 0.35 + vec2(t * 0.015, 0.0) + 31.0);
  float clS = fbm((p + vec2(0.4, -0.34)) * 0.35 + vec2(t * 0.015, 0.0) + 31.0);
  col *= 1.0 - smoothstep(0.60, 0.78, clS) * alt * 0.35;
  col = mix(col, vec3(0.94, 0.95, 0.965), smoothstep(0.60, 0.78, clN) * alt);
  col = mix(col, vec3(0.60, 0.68, 0.79), smoothstep(2.8, 5.6, uE) * 0.42);
  return col * 0.92;
}
/* ---------- 8 planet ---------- */
vec3 scPlanet(vec2 uv, float t) {
  vec2 p = uv * zoomFor(6.9) * 1.35;
  float r = length(p);
  vec3 col = vec3(0.0);
  if (r < 1.0) {
    vec3 n = vec3(p, sqrt(1.0 - r * r));
    vec3 L = normalize(vec3(-0.55, 0.35, 0.75));
    float diff = clamp(dot(n, L), 0.0, 1.0);
    vec2 sph = vec2(atan(n.x, n.z) + t * 0.02, asin(n.y));
    /* domain-warped coastlines: peninsulas, archipelagos, fjords */
    vec2 wsph = sph + 0.35 * vec2(fbm(sph * 3.1 + 13.0) - 0.5, fbm(sph * 3.1 + 27.0) - 0.5);
    float land = fbm(wsph * 2.6 + 7.0);
    float isLand = smoothstep(0.52, 0.55, land);
    float shelf = smoothstep(0.42, 0.52, land) * (1.0 - isLand);         // shallow seas
    vec3 ocean = mix(vec3(0.035, 0.12, 0.30), vec3(0.10, 0.34, 0.44), shelf);
    vec3 ground = mix(vec3(0.10, 0.22, 0.08), vec3(0.36, 0.31, 0.18), fbm(wsph * 6.0));
    ground = mix(ground, vec3(0.55, 0.47, 0.31), smoothstep(0.62, 0.76, land));  // arid interiors
    vec3 surf = mix(ocean, ground, isLand);
    float ice = smoothstep(1.02, 1.24, abs(sph.y));
    surf = mix(surf, vec3(0.82, 0.88, 0.94), ice * 0.9);
    float cloud = smoothstep(0.52, 0.74, fbm(sph * 3.4 + vec2(t * 0.045, 0.0)) * 0.85
                                       + fbm(sph * 7.0 - vec2(t * 0.03, 0.0)) * 0.35);
    vec2 coff = vec2(0.05, -0.04);
    float cloudSh = smoothstep(0.52, 0.74, fbm((sph + coff) * 3.4 + vec2(t * 0.045, 0.0)) * 0.85
                                         + fbm((sph + coff) * 7.0 - vec2(t * 0.03, 0.0)) * 0.35);
    surf *= 1.0 - cloudSh * 0.30 * (1.0 - cloud);                        // clouds shade the ground
    surf = mix(surf, vec3(0.93), cloud * 0.9);
    float spec = pow(clamp(dot(reflect(-L, n), vec3(0, 0, 1)), 0.0, 1.0), 24.0) * (1.0 - isLand) * (1.0 - cloud) * (1.0 - ice);
    float twilight = smoothstep(-0.04, 0.28, diff);
    col = surf * (diff * 1.1 + 0.015) * twilight + spec * vec3(0.9);
    col += vec3(0.25, 0.5, 1.0) * pow(1.0 - n.z, 3.0) * (diff + 0.12) * 0.4;   // in-disk atmosphere
    float night = smoothstep(0.06, -0.14, diff);
    float cities = pow(noise(sph * 42.0), 9.0) * 2.6 * isLand * (1.0 - cloud) * (1.0 - ice);
    col += night * cities * vec3(1.0, 0.72, 0.38);
  }
  float rim = exp(-abs(r - 1.0) * 14.0);
  col += vec3(0.25, 0.5, 1.0) * rim * (r > 1.0 ? 0.8 : 0.4);
  return col;
}
/* ---------- 9 solar system — eight planets in true colors on log-spaced
   orbits with Kepler speeds, asteroid and Kuiper belts, zodiacal dust ---------- */
vec3 scSystem(vec2 uv, float t) {
  vec2 p = uv * zoomFor(11.3) * 1.15;
  float r = length(p);
  vec3 col = vec3(0.0);
  col += starLayer(uv * 40.0 + 7.0, 0.965, t) * 0.35;          // fixed stars, far behind

  /* the Sun: white-gold core, boiling corona, radial streamers, a soft lens spike */
  col += vec3(1.0, 0.85, 0.55) * 0.016 / (r * r + 0.003);
  col += vec3(1.0, 0.55, 0.20) * fbm(p * 9.0 + t * 0.4) * exp(-r * 10.0) * 1.1;
  float ang0 = atan(p.y, p.x);
  col += vec3(1.0, 0.80, 0.50) * pow(noise(vec2(cos(ang0), sin(ang0)) * 3.0 + 3.0), 3.0) * exp(-r * 5.0) * 0.6;
  col += vec3(0.9, 0.85, 0.8) * exp(-abs(p.y) * 60.0) * exp(-abs(p.x) * 3.0) * 0.22;

  vec2 pe = p * vec2(1.0, 1.45);                               // ecliptic tilt
  float re = length(pe);

  vec3 pcols[8];
  pcols[0] = vec3(0.55, 0.52, 0.48);   // Mercury
  pcols[1] = vec3(0.95, 0.88, 0.70);   // Venus
  pcols[2] = vec3(0.35, 0.55, 0.95);   // Earth
  pcols[3] = vec3(0.90, 0.45, 0.25);   // Mars
  pcols[4] = vec3(0.85, 0.72, 0.55);   // Jupiter
  pcols[5] = vec3(0.92, 0.83, 0.60);   // Saturn
  pcols[6] = vec3(0.60, 0.85, 0.90);   // Uranus
  pcols[7] = vec3(0.35, 0.50, 0.95);   // Neptune
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float R = 0.085 * pow(1.62, fi);                           // Titius-Bode-ish spacing
    col += vec3(0.4, 0.5, 0.7) * exp(-abs(re - R) * 300.0) * 0.055;   // ghost of an orbit
    float ang = t * 0.16 * pow(1.62, -1.5 * fi) + fi * 2.4;    // Kepler: slower out there
    vec2 pl = vec2(cos(ang), sin(ang) / 1.45) * R;
    float d2 = dot(p - pl, p - pl);
    float sz = (i == 4 || i == 5) ? 0.00030 : 0.00016;         // the giants read bigger
    col += pcols[i] * sz / (d2 + sz * 0.9);
    if (i == 5) {                                              // Saturn's rings, hinted
      vec2 q = (p - pl) * vec2(1.0, 2.2);
      col += vec3(0.9, 0.85, 0.70) * exp(-abs(length(q) - 0.012) * 480.0) * 0.35;
    }
  }

  /* asteroid belt between Mars and Jupiter; Kuiper belt past Neptune */
  float beltR = 0.085 * pow(1.62, 3.55);
  col += vec3(0.60, 0.55, 0.50) * exp(-pow((re - beltR) * 26.0, 2.0)) * pow(noise(p * 90.0 + t * 0.05), 6.0) * 3.0;
  float kuiR = 0.085 * pow(1.62, 7.8);
  col += vec3(0.50, 0.55, 0.70) * exp(-pow((re - kuiR) * 10.0, 2.0)) * pow(noise(p * 70.0 + 3.0), 8.0) * 2.0;

  /* zodiacal light: a lens of dust in the ecliptic plane */
  col += vec3(0.45, 0.40, 0.35) * exp(-abs(pe.y) * 6.0) * exp(-re * 1.6) * 0.11;
  return col;
}
/* ---------- 10 stellar neighborhood ---------- */
vec3 scStars(vec2 uv, float t) {
  vec3 col = vec3(0.0);
  vec2 mw = rot(-0.55) * uv;                                 // the Milky Way band, edge-on
  float band = fbm(mw * vec2(1.3, 3.6) + 2.0) * exp(-abs(mw.y) * 2.6);
  col += vec3(0.14, 0.13, 0.20) * band * 1.5;
  col += vec3(0.05, 0.02, 0.01) * fbm(mw * vec2(2.6, 7.0) + 9.0) * exp(-abs(mw.y) * 3.4);
  col += vec3(0.035, 0.025, 0.06) * fbm(uv * 2.4 + 3.0);
  for (int L = 0; L < 3; L++) {
    float fl = float(L);
    vec2 p = uv * zoomFor(16.5) * (20.0 + fl * 30.0) + uPointer * (0.4 + fl * 0.5) + fl * 17.0;
    col += starLayer(p, 0.93, t) * (0.5 + fl * 0.3);
  }
  return col;
}
/* ---------- 11 galaxy — the Hubble look: clumpy arms, dark dust lanes,
   pink HII nurseries, blue young clusters, a warm Sersic bulge ---------- */
vec3 scGalaxy(vec2 uv, float t) {
  vec2 p0 = rot(0.4) * (uv * zoomFor(21.0));
  vec2 p = p0 * vec2(1.0, 1.9) * 1.25;                        // inclination
  float r = length(p) + 1e-4;
  float th = atan(p.y, p.x);
  float sw = th - log(r) * 4.6 + t * 0.02;                    // spiral coordinate
  vec2 swp = vec2(cos(2.0 * sw), sin(2.0 * sw));              // periodic → no seam
  float armRaw = 0.5 + 0.5 * cos(2.0 * sw);
  float clump = fbm(swp * 1.8 + vec2(r * 5.0, 0.0) + 5.0);
  float arm = pow(armRaw, 2.0) * (0.35 + 0.95 * clump);
  float disk = exp(-r * 1.9);

  /* older yellow population inside, young blue outside */
  vec3 dcol = mix(vec3(0.95, 0.85, 0.65), vec3(0.55, 0.65, 1.0), smoothstep(0.15, 0.75, r));
  vec3 col = dcol * (arm * 1.5 + 0.16) * disk;

  /* dust lanes in silhouette along the arms' inner edges */
  float dust = ridge(swp * 1.4 + vec2(0.0, r * 8.0) + 11.0);
  float dustM = smoothstep(0.70, 0.94, dust) * smoothstep(0.05, 0.3, r) * disk;
  col = mix(col, col * vec3(0.35, 0.22, 0.16), dustM * smoothstep(0.2, 0.8, armRaw));

  /* HII star nurseries: pink knots strung along the arms */
  float hii = pow(noise(swp * 3.0 + vec2(r * 14.0, 0.0) + 3.0), 9.0) * 5.0;
  col += vec3(1.0, 0.35, 0.55) * hii * arm * disk * 1.6;
  /* OB associations: hot blue clusters on the outer arms */
  float ob = pow(noise(swp * 4.0 + vec2(r * 18.0, 0.0) + 8.0), 11.0) * 6.0;
  col += vec3(0.55, 0.70, 1.0) * ob * arm * disk * smoothstep(0.25, 0.7, r);

  /* bulge + faint stellar halo */
  float rb = length(p * vec2(1.0, 1.15));
  col += vec3(1.0, 0.85, 0.60) * exp(-pow(rb * 4.2, 0.75)) * 1.1;
  col += vec3(0.50, 0.50, 0.65) * exp(-r * 0.9) * 0.05;

  /* resolved star grain in the disk, then our own foreground stars */
  col += vec3(0.85, 0.9, 1.0) * pow(noise(p * 26.0 + 4.0), 10.0) * 6.0 * arm * disk * 1.5;
  col += starLayer(p0 * 30.0, 0.988, t) * 0.9;
  return col * 0.85;
}
/* ---------- 12 cosmic web — two depth layers of filaments, bright
   superclusters at the nodes, individual galaxies riding the strands ---------- */
vec3 scWeb(vec2 uv, float t) {
  vec3 col = vec3(0.0);
  float redshift = smoothstep(24.2, 26.8, uE);
  vec3 cold = vec3(0.40, 0.45, 0.85), hot = vec3(0.90, 0.30, 0.20);
  for (int L = 0; L < 2; L++) {
    float fl = float(L);
    vec2 p = uv * zoomFor(25.1) * (2.1 + fl * 1.4) + fl * 13.0 + uPointer * 0.03 * (1.0 + fl * 1.5);
    float wgt = 1.0 - fl * 0.55;
    float f1 = ridge(p * 1.6 + t * 0.008);
    float fil = smoothstep(0.78, 0.99, f1);
    col += mix(cold, hot, redshift) * fil * 0.55 * wgt;
    float nodes = smoothstep(0.88, 1.0, f1) * smoothstep(0.83, 1.0, ridge(p * 0.8 + 5.0));
    col += mix(vec3(0.95, 0.90, 0.80), vec3(1.0, 0.5, 0.35), redshift) * nodes * 0.9 * wgt;
    float gx = pow(noise(p * 34.0 + 9.0), 14.0) * 5.0;
    col += mix(vec3(0.90, 0.85, 0.75), vec3(1.0, 0.6, 0.45), redshift) * gx * smoothstep(0.5, 0.9, f1) * wgt;
  }
  col *= 1.0 - smoothstep(26.2, 26.85, uE) * 0.92;                   // fade at the horizon
  return col;
}

/* ---------- time-mode epochs (uE is log10 seconds after the Big Bang) ---------- */
vec3 scPlasma(vec2 uv, float t, float e) {
  float cool = smoothstep(-12.5, -4.5, e);
  vec2 p = uv * 2.4;
  vec2 w = vec2(fbm(p * 2.2 + t * 0.9), fbm(p * 2.2 - t * 0.8 + 5.0));
  float f = fbm(p * 3.5 + w * 1.8 + t * 0.6);
  vec3 hot = mix(vec3(1.0, 0.95, 0.88), vec3(1.0, 0.55, 0.22), cool);
  vec3 col = hot * (0.22 + f * f * 1.5);
  col += vec3(1.0, 0.8, 0.9) * pow(ridge(p * 2.5 + w + t * 0.5), 7.0) * (1.0 - cool * 0.5);
  col += vec3(0.9, 0.95, 1.0) * pow(noise(p * 14.0 + t * 2.0), 9.0) * 2.0;
  return col * (1.0 - cool * 0.3);
}
vec3 scCMB(vec2 uv, float t, float e) {
  float prog = smoothstep(-4.0, 13.0, e);                   // blackbody fog, cooling
  vec3 bb = mix(vec3(1.0, 0.88, 0.66), vec3(0.72, 0.24, 0.08), prog);
  vec2 p = uv * 2.0;
  float fog = fbm(p * 2.0 + t * 0.06) * 0.55 + fbm(p * 5.0 - t * 0.04) * 0.3;
  float lift = smoothstep(12.5, 13.15, e);                  // recombination: the fog clears
  vec3 col = bb * (0.30 + fog) * (1.0 - lift * 0.94);
  float aniso = fbm(uv * 3.2 + 17.0) - 0.5;                 // ...revealing the CMB map
  col += lift * mix(vec3(0.11, 0.15, 0.40), vec3(0.62, 0.27, 0.13), smoothstep(-0.16, 0.16, aniso)) * 0.75;
  return col;
}
vec3 scDarkAges(vec2 uv, float t) {
  vec3 col = vec3(0.008, 0.010, 0.020) * (0.5 + fbm(uv * 2.0 + t * 0.01));
  col += vec3(0.045, 0.04, 0.08) * fbm(uv * 1.2 + 31.0) * 0.5;
  return col;
}
vec3 scFirstStars(vec2 uv, float t) {
  vec3 col = vec3(0.010, 0.012, 0.026);
  col += vec3(0.10, 0.08, 0.20) * fbm(uv * 2.6 + t * 0.02) * 0.6;
  col += starLayer(uv * 20.0 + 3.0, 0.985, t) * vec3(0.75, 0.85, 1.25) * 1.5;
  col += vec3(0.22, 0.32, 0.65) * pow(noise(uv * 4.0 + 9.0), 6.0) * 1.4;   // reionized bubbles
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  uv += uPointer * vec2(0.018, -0.018);
  float t = uTime;
  float e = uE;
  gE = uE;

  vec3 col = vec3(0.008, 0.010, 0.020);

  float w;
  if (uMode < 0.5) {
  w = wband(e, -17.0, -14.8); if (w > 0.002) col += w * scFoam(uv, t);
  w = wband(e, -15.6, -13.6); if (w > 0.002) col += w * scNucleus(uv, t);
  w = wband(e, -13.8,  -9.6); if (w > 0.002) col += w * scAtom(uv, t);
  w = wband(e,  -9.6,  -7.6); if (w > 0.002) col += w * scHelix(uv, t);
  w = wband(e,  -7.6,  -4.6); if (w > 0.002) col += w * scCell(uv, t);
  w = wband(e,  -4.8,  -2.4); if (w > 0.002) col += w * scScreen(uv, t);
  w = wband(e,  -2.4,   1.6); if (w > 0.002) col += w * scHuman(uv, t);
  w = wband(e,   1.4,   5.6); if (w > 0.002) col += w * scCity(uv, t);
  w = wband(e,   4.8,   8.4); if (w > 0.002) col += w * scPlanet(uv, t);
  w = wband(e,   8.4,  14.2); if (w > 0.002) col += w * scSystem(uv, t);
  w = wband(e,  14.2,  19.4); if (w > 0.002) col += w * scStars(uv, t);
  w = wband(e,  19.4,  23.2); if (w > 0.002) col += w * scGalaxy(uv, t);
  w = wband(e,  23.2,  26.9); if (w > 0.002) col += w * scWeb(uv, t);
  } else {
  w = wbandR(e, -13.6,  -4.0, 0.7);   if (w > 0.002) col += w * scPlasma(uv, t, e);
  w = wbandR(e,  -4.6,   2.6, 0.7);   if (w > 0.002) { gE = mix(-15.3, -13.9, (e + 4.6) / 7.2); col += w * scNucleus(uv, t); }
  w = wbandR(e,  -5.0,  13.2, 0.7);   if (w > 0.002) col += w * scCMB(uv, t, e);
  w = wbandR(e,  13.0,  15.7, 0.5);   if (w > 0.002) col += w * scDarkAges(uv, t);
  w = wbandR(e,  15.4,  16.75, 0.35); if (w > 0.002) col += w * scFirstStars(uv, t);
  w = wbandR(e,  16.55, 17.30, 0.2);  if (w > 0.002) { gE = mix(20.3, 21.6, (e - 16.55) / 0.75); col += w * scGalaxy(uv, t); }
  w = wbandR(e,  17.20, 17.50, 0.08); if (w > 0.002) { gE = mix(10.4, 12.0, (e - 17.20) / 0.30); col += w * scSystem(uv, t); }
  w = wbandR(e,  17.42, 17.62, 0.05); if (w > 0.002) { gE = mix(6.2, 7.2, (e - 17.42) / 0.20); col += w * scPlanet(uv, t); }
  w = wbandR(e,  17.55, 17.80, 0.035); if (w > 0.002) { gE = uE; col += w * scHuman(uv, t); }
  }

  // sonar ping on click
  float age = t - uPing.z;
  if (age < 2.0 && age > 0.0) {
    vec2 pc = (uPing.xy * uRes / uRes.y) - 0.5 * uRes / uRes.y;
    float d = length(uv - uPointer * vec2(0.018, -0.018) - pc);
    float ring = exp(-abs(d - age * 0.55) * 26.0) * exp(-age * 2.0);
    col += vec3(0.9, 0.95, 1.0) * ring * 0.5;
  }

  col = max(col, 0.0);
  /* when the bloom pipeline is active the filmic finish moves to the
     composite pass; uFinal=1 keeps it here as a no-post fallback */
  if (uFinal > 0.5) {
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, 1.14);
    col = col / (1.0 + col * 0.42);
    col = pow(col, vec3(0.90));
    col *= 1.0 - 0.4 * dot(uv, uv);
    col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) * 0.02;
  }
  O = vec4(col, 1.0);
}
