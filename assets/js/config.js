/* MAGNITUDE — the three axes, and the constants they share. */

export const PX_PER_DECADE = 900;
export const PX_PER_HOUR = 340;

/* Space is logarithmic: `min`/`max` are exponents, scrolling one decade always
 * costs the same pixels. Time is now a clock — one day at the beach, from
 * midnight to midnight, measured in hours. Ages is a flat run of 50-year slices. */
export const AXES = {
  e: { kind: 'log', unit: 'm', min: -16.5, max: 26.9 },
  t: { kind: 'clock', unit: 'h', min: 0, max: 24 },
  a: { kind: 'slices', pxPerSlice: 820 },
};

{
  const e = AXES.e; e.span = e.max - e.min; e.trackH = Math.round(e.span * PX_PER_DECADE);
  const t = AXES.t; t.span = t.max - t.min; t.trackH = Math.round(t.span * PX_PER_HOUR);
}

export const MODE_ORDER = ['e', 't', 'a'];
export const nextMode = m => MODE_ORDER[(MODE_ORDER.indexOf(m) + 1) % MODE_ORDER.length];

export const MODE_LABEL = {
  e: { en: 'Meters', fr: 'Mètres' },
  t: { en: 'Hour', fr: 'Heure' },
  a: { en: 'Ages', fr: 'Âges' },
};
export const MODE_HINT = {
  e: { en: 'Back to space', fr: 'Revenir à l’espace' },
  t: { en: 'A day at the beach, hour by hour', fr: 'Une journée à la plage, heure par heure' },
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
    ['Deep night', 'the tide breathes in the dark', 0.0, 4.5, '#4a5ba0', 1.4],
    ['Dawn', 'the sky bruises to rose', 4.0, 7.0, '#ff9a6a', 1.2],
    ['Morning', 'cool light, long shadows', 6.5, 11.0, '#7fc8ff', 1.4],
    ['High noon', 'the sun stands still', 10.5, 14.0, '#ffe08a', 1.4],
    ['Afternoon', 'warm and slow', 13.5, 17.0, '#ffcf8a', 1.4],
    ['Golden hour', 'the light turns to honey', 16.5, 18.5, '#ffab4a', 1.0],
    ['Sunset', 'the sea swallows the sun', 18.0, 19.8, '#ff5a3a', 0.9],
    ['Dusk', 'the first stars, the last colour', 19.5, 21.5, '#a06ac0', 1.1],
    ['Nightfall', 'salt, and a sky full of stars', 21.0, 24.0, '#4a5ba0', 1.3],
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
    ['Nuit profonde', 'la marée respire dans le noir'],
    ['Aube', 'le ciel se teinte de rose'],
    ['Matinée', 'lumière fraîche, ombres longues'],
    ['Plein midi', 'le soleil s’arrête'],
    ['Après-midi', 'chaud et lent'],
    ['Heure dorée', 'la lumière devient miel'],
    ['Coucher', 'la mer avale le soleil'],
    ['Crépuscule', 'les premières étoiles, la dernière couleur'],
    ['Tombée de la nuit', 'du sel, et un ciel plein d’étoiles'],
  ],
};

export const weightOf = (e, lo, hi, r = 0.7) =>
  (e < lo || e > hi) ? 0 : Math.min(1, (e - lo) / r) * Math.min(1, (hi - e) / r);

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
