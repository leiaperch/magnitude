/* MAGNITUDE — entry point.
 *
 * Holds the only mutable state on the page (language, mode, eased position) and
 * hands it to the pieces that draw: the shader for the two logarithmic axes, the
 * SVG diorama for the ages. Everything it imports is pure or self-contained.
 */

import { AXES, nextMode, MODE_LABEL, MODE_HINT, SCENES, SCENES_FR, weightOf, clamp, lerp } from './config.js';
import * as F from './format.js';
import { Renderer } from './gl.js';
import { Ages } from './modes/ages.js';
import { Drone } from './audio.js';

const $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const el = {
  body: document.body,
  stage: $('#stage'), agesRoot: $('#ages'), track: $('#track'), intro: $('#intro'),
  hud: $('#hud'), wordmark: $('#wordmark'), sceneName: $('#scene-name'), sceneSub: $('#scene-sub'),
  roExp: $('#ro-exp'), roPretty: $('#ro-pretty'), roLight: $('#ro-light'), roLightLabel: $('#ro-light-label'),
  roObj: $('#ro-obj'), ruler: $('#ruler'), cursor: $('#cursor'),
  goto: $('#goto'), gotoTitle: $('#goto-title'), gotoList: $('#goto-list'),
  human: $('#human'), outro: $('#outro'),
  mode: $('#mode'), lang: $('#lang'), voyage: $('#voyage'), sound: $('#sound'),
};

const state = {
  lang: (navigator.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en',
  mode: 'e',
  target: 0, shown: 0,
  hudShown: NaN, scene: -1, decade: null,
  cruising: false,
};

const renderer = new Renderer(el.stage);
const ages = new Ages(el.agesRoot);
const drone = new Drone();
let UI = {}, CARDS = {}, LANDMARKS = {};

/* The three axes answer the same questions, so the rest of the page never has
 * to know which one is running. For ages, position is a slice index. */
function axis() {
  if (state.mode !== 'a') return AXES[state.mode];
  return { kind: 'slices', min: 0, max: ages.span, span: ages.span, trackH: ages.trackH, unit: '' };
}

/* ------------------------------------------------------------------ readouts */
function scaleLine(v) {
  const fr = state.lang === 'fr';
  const table = LANDMARKS.e;
  let best = table[0];
  for (const o of table) { if (o[0] <= v + 0.12) best = o; else break; }
  const name = fr ? best[2] : best[1];
  const ratio = Math.pow(10, v - best[0]);
  const frame = fr ? 'ce cadre' : 'this frame';
  if (ratio < 0.95) return `${frame} ≈ ${name} ÷ ${Math.round(1 / ratio)}`;
  if (ratio < 1.35) return `${frame} ≈ ${name}`;
  const n = ratio < 10 ? (fr ? ratio.toFixed(1).replace('.', ',') : ratio.toFixed(1)) : String(Math.round(ratio));
  return `${frame} ≈ ${n} × ${name}`;
}
function epochLine(v) {
  const fr = state.lang === 'fr';
  let best = LANDMARKS.t[0];
  for (const o of LANDMARKS.t) { if (o[0] <= v + 0.05) best = o; else break; }
  return (fr ? 'époque : ' : 'epoch: ') + (fr ? best[2] : best[1]);
}

function readouts(v) {
  const L = state.lang;
  if (state.mode === 'a') {
    const slice = ages.update(ages.span ? v / ages.span : 0);
    if (!slice) return;
    const year = slice.era.year;
    const ago = 2026 - year;
    el.roExp.textContent = year;
    el.roPretty.textContent = ago > 0
      ? (L === 'fr' ? 'il y a ' + F.humanYears(ago, L) : F.humanYears(ago, L) + ' ago')
      : (L === 'fr' ? 'dans ' + F.humanYears(-ago, L) : 'in ' + F.humanYears(-ago, L));
    el.roLight.textContent = ago > 0 ? F.generations(ago, L) : (L === 'fr' ? 'pas encore né' : 'not born yet');
    el.roObj.textContent = (L === 'fr' ? 'tranche : ' : 'slice: ') + (L === 'fr' ? slice.era.fr.name : slice.era.en.name);
    return;
  }
  const sign = v < 0 ? '−' : '+';
  el.roExp.innerHTML = `10<sup>${sign}${Math.abs(v).toFixed(1)}</sup> ${axis().unit}`;
  if (state.mode === 't') {
    el.roPretty.textContent = '≈ ' + F.humanizeSeconds(Math.pow(10, v), L) + (L === 'fr' ? ' après le Big Bang' : ' after the Big Bang');
    el.roLight.textContent = F.tempStr(v, L);
    el.roObj.textContent = epochLine(v);
  } else {
    el.roPretty.textContent = F.prettyMeters(v, L);
    el.roLight.textContent = F.prettyLightTime(v, L);
    el.roObj.textContent = scaleLine(v);
  }
}

function sceneFor(v) {
  if (state.mode === 'a') {
    const i = clamp(Math.round(v), 0, ages.eras.length - 1);
    const e = ages.eras[i];
    return [state.lang === 'fr' ? e.fr.name : e.en.name,
            state.lang === 'fr' ? e.fr.note : e.en.note,
            '#dfc47c', i];
  }
  const SC = SCENES[state.mode], SF = SCENES_FR[state.mode];
  let best = -1, bi = 0;
  SC.forEach((s, i) => { const w = weightOf(v, s[2], s[3], s[5]); if (w > best) { best = w; bi = i; } });
  return [state.lang === 'fr' ? SF[bi][0] : SC[bi][0],
          state.lang === 'fr' ? SF[bi][1] : SC[bi][1],
          SC[bi][4], bi];
}

function invalidateHUD() { state.scene = -1; state.hudShown = NaN; }

function updateHUD() {
  const ax = axis();
  el.hud.classList.toggle('on', scrollY > innerHeight * 0.5 && state.target < ax.max - (state.mode === 'a' ? 0.02 : 0.35));

  const v = state.shown;
  const dec = Math.floor(v);
  if (state.decade !== null && dec !== state.decade) drone.ping(v, ax);
  state.decade = dec;

  // the eased position settles and then sits still: past that, every string
  // below would be recomputed to exactly what it already says.
  if (Math.abs(v - state.hudShown) < 0.0005) return;
  state.hudShown = v;

  readouts(v);
  el.cursor.style.left = ((v - ax.min) / ax.span * 100) + '%';

  const [name, sub, accent, idx] = sceneFor(v);
  if (idx !== state.scene) {
    state.scene = idx;
    el.sceneName.textContent = name;
    el.sceneSub.textContent = sub;
    document.documentElement.style.setProperty('--accent', accent);
  }

  /* This beat is a fixed overlay, so it must never share the screen with the
   * intro. In the log modes its band sits decades into the track; ages had it
   * on slice 0 — which is exactly where the intro still is. */
  el.human.style.opacity = (
    state.mode === 't' ? weightOf(v, 17.55, 17.80, 0.035) :
    state.mode === 'a' ? weightOf(v, 0.4, 2.0, 0.5) :
                         weightOf(v, -2.4, 1.6)).toFixed(3);
}

/* --------------------------------------------------------------------- text */
function fillUI() {
  const t = UI[state.mode][state.lang];
  el.intro.querySelector('.over').textContent = t.over;
  el.intro.querySelector('.sub').innerHTML = t.sub;
  el.intro.querySelector('.rules').innerHTML =
    t.rules.map(([k, val]) => `<span>${k} <b>${val}</b></span>`).join('');
  el.intro.querySelector('.cue').textContent = t.cue;
  el.wordmark.innerHTML = t.wordmark;
  el.roLightLabel.textContent = t.lightLabel;
  el.human.querySelector('.halo').textContent = t.humanHalo;
  el.human.querySelector('.body').textContent = t.humanBody;
  el.human.querySelector('.fn').textContent = t.humanFn;
  el.outro.querySelector('h2').innerHTML = t.outroH2;
  el.outro.querySelector('.big-num').textContent = t.outroBig;
  el.outro.querySelector('.lede').innerHTML = t.outroLede;
  el.outro.querySelector('.stats').innerHTML = t.outroStats;
  el.outro.querySelector('.fine').innerHTML = t.fine;

  const nm = nextMode(state.mode);
  el.mode.textContent = MODE_LABEL[nm][state.lang];
  el.mode.title = MODE_HINT[nm][state.lang];
  el.lang.textContent = state.lang === 'fr' ? 'EN' : 'FR';
  el.lang.title = state.lang === 'fr' ? 'Read in English' : 'Lire en français';
  el.voyage.title = state.lang === 'fr' ? 'Traversée automatique' : 'Hands-free cruise';
  el.voyage.textContent = state.cruising ? 'Voyage ■' : 'Voyage ▸';
  el.sound.textContent = (state.lang === 'fr' ? 'Son ' : 'Sound ') + (drone.on ? '●' : '○');
  document.documentElement.lang = state.lang;
  document.title = state.lang === 'fr'
    ? 'MAGNITUDE · L’univers dans une barre de défilement'
    : 'MAGNITUDE — The Universe in One Scrollbar';
}

/* -------------------------------------------------------------------- cards */
function buildCards() {
  el.track.innerHTML = '';
  const ax = axis();
  el.track.style.height = ax.trackH + 'px';
  if (state.mode === 'a') return;              // the ages narrate themselves, slice by slice
  const wide = innerWidth > 760;
  const SC = SCENES[state.mode];
  for (const c of CARDS[state.mode]) {
    const t = c[state.lang];
    const node = document.createElement('article');
    node.className = 'card';
    node.innerHTML = `<div class="tag"><span>${t.title}</span><span class="m">${t.meas}</span></div><p>${t.body}</p>`;
    node.style.top = Math.round(((c.at - ax.min) / ax.span) * ax.trackH - 60) + 'px';
    if (wide) {
      node.style[c.side === 'l' ? 'left' : 'right'] = 'clamp(24px, 9vw, 140px)';
    } else {
      node.style.left = '50%'; node.style.translate = '-50% 0';
    }
    let best = 0, accent = SC[0][4];
    SC.forEach(s => { const w = weightOf(c.at, s[2], s[3], s[5]); if (w > best) { best = w; accent = s[4]; } });
    node.style.setProperty('--c', accent);
    el.track.appendChild(node);
  }
}

/* -------------------------------------------------------------------- ruler */
function buildRuler() {
  el.ruler.querySelectorAll('.tick').forEach(t => t.remove());
  const ax = axis();
  if (state.mode === 'a') {
    ages.eras.forEach((era, i) => {
      const t = document.createElement('div');
      const major = i % 4 === 0 || i === ages.span;
      t.className = major ? 'tick major' : 'tick';
      t.style.left = (i / ax.span * 100) + '%';
      if (major) t.innerHTML = `<span>${era.year}</span>`;
      el.ruler.appendChild(t);
    });
    return;
  }
  const step = 5;
  for (let d = Math.ceil(ax.min); d <= Math.floor(ax.max); d++) {
    const t = document.createElement('div');
    const major = d % step === 0;
    t.className = major ? 'tick major' : 'tick';
    t.style.left = ((d - ax.min) / ax.span * 100) + '%';
    if (major) t.innerHTML = `<span>10${F.supNum(d)}</span>`;
    el.ruler.appendChild(t);
  }
}

/* --------------------------------------------------------------- navigation */
const introH = () => el.intro.offsetHeight;
const toY = v => introH() + ((v - axis().min) / axis().span) * axis().trackH;

function goTo(v) {
  el.goto.hidden = true;
  scrollTo({ top: Math.round(toY(v)), behavior: reduced ? 'auto' : 'smooth' });
}
function buildGoto() {
  el.gotoList.innerHTML = '';
  const fr = state.lang === 'fr';
  const rows = state.mode === 'a'
    ? ages.eras.map((e, i) => [i, fr ? e.fr.name : e.en.name, String(e.year)])
    : LANDMARKS[state.mode].map(o => [o[0], fr ? o[2] : o[1], '10' + F.supNum(Math.round(o[0])) + ' ' + axis().unit]);
  for (const [at, name, meta] of rows) {
    const b = document.createElement('button');
    b.innerHTML = `<span></span><small></small>`;
    b.firstChild.textContent = name;
    b.lastChild.textContent = meta;
    b.addEventListener('click', () => goTo(clamp(at + (state.mode === 'e' ? 0.35 : state.mode === 't' ? 0.02 : 0), axis().min, axis().max)));
    el.gotoList.appendChild(b);
  }
  el.gotoTitle.textContent =
    state.mode === 't' ? (fr ? 'Aller au moment de…' : 'Go to the moment of…') :
    state.mode === 'a' ? (fr ? 'Aller à l’année…' : 'Go to the year…') :
                         (fr ? 'Aller à l’échelle de…' : 'Go to the scale of…');
}

let hashTimer = 0;
function updateHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    history.replaceState(null, '', `#m=${state.mode}&v=${state.shown.toFixed(2)}`);
  }, 300);
}

function readScroll() {
  const ax = axis();
  const y = scrollY - introH();
  state.target = ax.min + clamp(y / ax.trackH, 0, 1) * ax.span;
}

/* -------------------------------------------------------------------- modes */
function applyLang(l) {
  state.lang = l;
  fillUI();
  buildCards();
  buildGoto();
  if (state.mode === 'a') ages.index = -1;      // force the slice labels to re-read
  invalidateHUD();
}
function applyMode(m) {
  state.mode = m;
  el.body.dataset.mode = m;
  const ax = axis();
  buildCards();
  buildRuler();
  buildGoto();
  fillUI();
  scrollTo({ top: 0, behavior: 'instant' });
  state.target = state.shown = ax.min;
  state.decade = null;
  ages.show(m === 'a');
  ages.index = -1;
  invalidateHUD();
  history.replaceState(null, '', `#m=${m}`);
}

/* ------------------------------------------------------------- pointer & GL */
const pointer = { x: 0, y: 0 };
const smooth = { x: 0, y: 0 };
const ping = { x: 0, y: 0, t: -100 };

addEventListener('pointermove', e => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = (e.clientY / innerHeight) * 2 - 1;
}, { passive: true });

addEventListener('pointerdown', e => {
  if (e.target.closest('button, a, .card')) return;
  ping.x = e.clientX / innerWidth;
  ping.y = 1 - e.clientY / innerHeight;
  ping.t = performance.now() / 1000;
});

/* --------------------------------------------------------------------- loop */
let last = 0;
function frame(now) {
  const t = reduced ? 20 : now / 1000;
  if (state.cruising) {
    const dt = Math.min((now - last) / 1000, 0.05);
    scrollBy(0, dt * (state.mode === 'a' ? 190 : 290));
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) setCruise(false);
    readScroll();
  }
  last = now;
  state.shown = lerp(state.shown, state.target, state.mode === 'a' ? 0.2 : 0.14);
  smooth.x = lerp(smooth.x, pointer.x, 0.05);
  smooth.y = lerp(smooth.y, pointer.y, 0.05);

  updateHUD();
  drone.follow(state.shown, axis());
  if (!document.hidden) {
    if (state.mode === 'a') ages.render(t);
    else renderer.render({ time: t, e: state.shown, mode: state.mode === 't' ? 1 : 0, pointer: smooth, ping });
  }
  requestAnimationFrame(frame);
}

function setCruise(on) {
  state.cruising = on;
  el.voyage.setAttribute('aria-pressed', String(on));
  el.voyage.textContent = on ? 'Voyage ■' : 'Voyage ▸';
}

/* --------------------------------------------------------------------- boot */
async function boot() {
  const [ui, space, time, landmarks] = await Promise.all([
    fetch('assets/data/ui.json').then(r => r.json()),
    fetch('assets/data/space.cards.json').then(r => r.json()),
    fetch('assets/data/time.cards.json').then(r => r.json()),
    fetch('assets/data/landmarks.json').then(r => r.json()),
    ages.load(),
  ]);
  UI = ui; CARDS = { e: space, t: time }; LANDMARKS = landmarks;

  const glOK = await renderer.load().catch(err => { console.error(err); return false; });
  if (!glOK) el.human.querySelector('.fn').textContent =
    'WebGL2 unavailable — the journey still reads, it just cannot be seen';

  el.mode.addEventListener('click', () => applyMode(nextMode(state.mode)));
  el.lang.addEventListener('click', () => applyLang(state.lang === 'fr' ? 'en' : 'fr'));
  el.voyage.addEventListener('click', () => setCruise(!state.cruising));
  el.sound.addEventListener('click', async () => {
    await drone.toggle();
    el.sound.setAttribute('aria-pressed', String(drone.on));
    el.sound.textContent = (state.lang === 'fr' ? 'Son ' : 'Sound ') + (drone.on ? '●' : '○');
  });
  el.roObj.addEventListener('click', e => { e.stopPropagation(); el.goto.hidden = !el.goto.hidden; });
  document.addEventListener('click', e => { if (!e.target.closest('#goto')) el.goto.hidden = true; });
  addEventListener('keydown', e => { if (e.key === 'Escape') el.goto.hidden = true; });
  addEventListener('scroll', () => { readScroll(); updateHash(); }, { passive: true });
  addEventListener('resize', () => { buildCards(); readScroll(); ages.resize(); });
  for (const ev of ['wheel', 'touchmove', 'keydown']) {
    addEventListener(ev, () => { if (state.cruising) setCruise(false); }, { passive: true });
  }
  if (reduced) el.voyage.hidden = true;

  const hm = location.hash.match(/m=([eta])/);
  applyMode(hm ? hm[1] : 'e');
  const hv = location.hash.match(/v=(-?\d+(?:\.\d+)?)/);
  if (hv) {
    const target = clamp(parseFloat(hv[1]), axis().min, axis().max);
    scrollTo({ top: Math.round(toY(target)), behavior: 'instant' });
    readScroll();
    state.shown = state.target;
  }
  requestAnimationFrame(frame);
}

boot();
