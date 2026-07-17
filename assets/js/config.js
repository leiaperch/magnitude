/* MAGNITUDE — the three axes, and the constants they share. */

export const PX_PER_DECADE = 900;

/* Space and time are logarithmic: `min`/`max` are exponents, and scrolling one
 * decade always costs the same pixels. Ages is not — it is a flat run of
 * 50-year slices, so it measures itself in slices instead. */
export const AXES = {
  e: { kind: 'log', unit: 'm', min: -16.5, max: 26.9 },
  t: { kind: 'log', unit: 's', min: -12.7, max: 17.70 },
  a: { kind: 'slices', pxPerSlice: 820 },
};

for (const k of ['e', 't']) {
  const ax = AXES[k];
  ax.span = ax.max - ax.min;
  ax.trackH = Math.round(ax.span * PX_PER_DECADE);
}

export const MODE_ORDER = ['e', 't', 'a'];
export const nextMode = m => MODE_ORDER[(MODE_ORDER.indexOf(m) + 1) % MODE_ORDER.length];

export const MODE_LABEL = {
  e: { en: 'Meters', fr: 'Mètres' },
  t: { en: 'Years', fr: 'Années' },
  a: { en: 'Ages', fr: 'Âges' },
};
export const MODE_HINT = {
  e: { en: 'Back to space', fr: 'Revenir à l’espace' },
  t: { en: 'Scroll forward from the Big Bang', fr: 'Défiler depuis le Big Bang' },
  a: { en: 'Scroll back through the ages of people', fr: 'Remonter les âges humains' },
};

/* Scene bands must mirror the shader's. [name, subtitle, lo, hi, accent, ramp] */
export const SCENES = {
  e: [
    ['Quantum foam', 'virtual pairs, borrowed time', -17.0, -14.8, '#b48cff', 0.7],
    ['The nucleus', 'quarks and glue', -15.6, -13.6, '#ff9a5c', 0.7],
    ['The atom', 'mostly nothing', -13.8, -9.6, '#6ee7ff', 0.7],
    ['The helix', 'a two-meter molecule', -9.6, -7.6, '#59e6a8', 0.7],
    ['The cell', 'machinery in honey', -7.6, -4.6, '#a8e063', 0.7],
    ['The screen', 'three lamps pretending to be white', -4.8, -2.4, '#7fd3ff', 0.7],
    ['The visible', 'the human meter', -2.4, 1.6, '#ffd9a0', 0.7],
    ['The city', 'rooftops, hedgerows, one river', 1.4, 5.6, '#dfc47c', 0.7],
    ['The planet', 'a wet rock, well lit', 4.8, 8.4, '#6fb7ff', 0.7],
    ['The system', 'one star, some leftovers', 8.4, 14.2, '#ffd166', 0.7],
    ['The neighborhood', 'stars, and the space between', 14.2, 19.4, '#cdd8ff', 0.7],
    ['The galaxy', 'dust lanes and pink nurseries', 19.4, 23.2, '#b7c6ff', 0.7],
    ['The cosmic web', 'filaments of everything', 23.2, 26.9, '#ff7a6e', 0.7],
  ],
  t: [
    ['Quark-gluon plasma', 'matter, not yet', -13.6, -4.0, '#ffb37a', 0.7],
    ['Nucleosynthesis', 'the first three minutes', -4.6, 2.6, '#ff9a5c', 0.7],
    ['The glow', 'an opaque fog, cooling', -5.0, 13.2, '#ff7a4d', 0.7],
    ['The dark ages', 'nothing shines yet', 13.0, 15.7, '#5b6b9e', 0.5],
    ['First stars', 'reionization', 15.4, 16.75, '#9fc0ff', 0.35],
    ['Young galaxies', 'structure assembles', 16.55, 17.30, '#b7c6ff', 0.2],
    ['A disk of dust', 'the Sun ignites', 17.20, 17.50, '#ffd166', 0.08],
    ['The Earth', 'life, almost immediately', 17.42, 17.62, '#6fb7ff', 0.05],
    ['Now', 'the latest moment there has been', 17.55, 17.80, '#ffd9a0', 0.035],
  ],
};
export const SCENES_FR = {
  e: [
    ['Écume quantique', 'paires virtuelles, temps emprunté'],
    ['Le noyau', 'des quarks et de la colle'],
    ['L’atome', 'du vide, surtout'],
    ['L’hélice', 'une molécule de deux mètres'],
    ['La cellule', 'de la machinerie dans du miel'],
    ['L’écran', 'trois lampes qui jouent au blanc'],
    ['Le visible', 'le mètre humain'],
    ['La ville', 'des toits, des haies, une rivière'],
    ['La planète', 'un caillou mouillé, bien éclairé'],
    ['Le système', 'une étoile et quelques restes'],
    ['Le voisinage', 'des étoiles, et l’espace entre'],
    ['La galaxie', 'poussières et pouponnières roses'],
    ['La toile cosmique', 'les filaments de tout'],
  ],
  t: [
    ['Plasma quark-gluon', 'la matière, pas encore'],
    ['Nucléosynthèse', 'les trois premières minutes'],
    ['La lueur', 'un brouillard opaque qui refroidit'],
    ['Les âges sombres', 'rien ne brille encore'],
    ['Premières étoiles', 'la réionisation'],
    ['Jeunes galaxies', 'les structures s’assemblent'],
    ['Un disque de poussière', 'le Soleil s’allume'],
    ['La Terre', 'la vie, presque aussitôt'],
    ['Maintenant', 'l’instant le plus tardif qui ait existé'],
  ],
};

export const weightOf = (e, lo, hi, r = 0.7) =>
  (e < lo || e > hi) ? 0 : Math.min(1, (e - lo) / r) * Math.min(1, (hi - e) / r);

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
