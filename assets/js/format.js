/* MAGNITUDE — every number the readout shows.
 * Pure functions: they take the language, they never read global state. */

const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
export const supNum = n => String(n).split('').map(c => SUP[c] || c).join('');

const dec = (lang, s) => lang === 'fr' ? String(s).replace('.', ',') : String(s);
const loc = lang => lang === 'fr' ? 'fr-FR' : 'en';

const PREFIXES = [
  [-30, 'quectometers', 'quectomètres'], [-27, 'rontometers', 'rontomètres'],
  [-24, 'yoctometers', 'yoctomètres'], [-21, 'zeptometers', 'zeptomètres'],
  [-18, 'attometers', 'attomètres'], [-15, 'femtometers', 'femtomètres'],
  [-12, 'picometers', 'picomètres'], [-9, 'nanometers', 'nanomètres'],
  [-6, 'micrometers', 'micromètres'], [-3, 'millimeters', 'millimètres'],
  [0, 'meters', 'mètres'], [3, 'kilometers', 'kilomètres'],
  [6, 'megameters', 'mégamètres'], [9, 'gigameters', 'gigamètres'],
  [12, 'terameters', 'téramètres'], [15, 'petameters', 'pétamètres'],
  [18, 'exameters', 'examètres'], [21, 'zettameters', 'zettamètres'],
  [24, 'yottameters', 'yottamètres'], [27, 'ronnameters', 'ronnamètres'],
];

export function prettyMeters(e, lang) {
  let p = PREFIXES[0];
  for (const cand of PREFIXES) if (cand[0] <= e) p = cand;
  const v = Math.pow(10, e - p[0]);
  const num = dec(lang, v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
  return `≈ ${num} ${lang === 'fr' ? p[2] : p[1]}`;
}

const YEAR = 3.156e7;
export function humanizeSeconds(t, lang) {
  const fr = lang === 'fr';
  if (t < 1e-15) { const ex = Math.floor(Math.log10(t)); return dec(lang, (t / Math.pow(10, ex)).toFixed(1)) + '×10' + supNum(ex) + ' s'; }
  if (t < 1e-6) return dec(lang, (t * 1e9).toPrecision(3)) + ' ns';
  if (t < 1e-3) return dec(lang, (t * 1e6).toPrecision(3)) + ' µs';
  if (t < 1) return dec(lang, (t * 1e3).toPrecision(3)) + ' ms';
  if (t < 60) return dec(lang, t.toPrecision(3)) + ' s';
  if (t < 3600) return dec(lang, (t / 60).toPrecision(3)) + ' min';
  if (t < 86400) return dec(lang, (t / 3600).toPrecision(3)) + (fr ? ' heures' : ' hours');
  if (t < YEAR) return dec(lang, (t / 86400).toPrecision(3)) + (fr ? ' jours' : ' days');
  if (t < 1e6 * YEAR) return Math.round(t / YEAR).toLocaleString(loc(lang)) + (fr ? ' ans' : ' years');
  if (t < 1e9 * YEAR) return dec(lang, (t / YEAR / 1e6).toPrecision(3)) + (fr ? ' millions d’années' : ' million years');
  return dec(lang, (t / YEAR / 1e9).toPrecision(3)) + (fr ? ' milliards d’années' : ' billion years');
}

export const prettyLightTime = (e, lang) => humanizeSeconds(Math.pow(10, e) / 299792458, lang);

/* The universe's temperature: log-log through the radiation era (T ∝ t^-1/2)
 * and then the matter era (≈ t^-2/3). */
/* [log10 seconds, log10 kelvin] — anchored on the plasma, on recombination at
 * ~3000 K, and on the microwave background measured today at 2.725 K. */
const TEMP_PTS = [[-12.7, 16.46], [13.08, 3.48], [17.70, 0.4353]];
export function tempStr(e, lang) {
  let a = TEMP_PTS[0], b = TEMP_PTS[1];
  if (e > TEMP_PTS[1][0]) { a = TEMP_PTS[1]; b = TEMP_PTS[2]; }
  const f = Math.min(1, Math.max(0, (e - a[0]) / (b[0] - a[0])));
  const lt = a[1] + (b[1] - a[1]) * f;
  if (lt >= 5) { const ex = Math.floor(lt); return dec(lang, Math.pow(10, lt - ex).toFixed(1)) + '×10' + supNum(ex) + ' K'; }
  const v = Math.pow(10, lt);
  return (v >= 100 ? Math.round(v).toLocaleString(loc(lang)) : dec(lang, v.toFixed(1))) + ' K';
}

export function humanYears(y, lang) {
  const fr = lang === 'fr';
  if (y < 1) { const d = Math.max(1, Math.round(y * 365)); return d + (fr ? (d > 1 ? ' jours' : ' jour') : d > 1 ? ' days' : ' day'); }
  if (y < 10000) { const n = Math.round(y); return n.toLocaleString(loc(lang)) + (fr ? (n > 1 ? ' ans' : ' an') : n > 1 ? ' years' : ' year'); }
  if (y < 1e6) return Math.round(y / 1000).toLocaleString(loc(lang)) + (fr ? ' 000 ans' : ',000 years');
  if (y < 1e9) return dec(lang, (y / 1e6).toPrecision(3)) + (fr ? ' millions d’années' : ' million years');
  return dec(lang, (y / 1e9).toPrecision(3)) + (fr ? ' milliards d’années' : ' billion years');
}

/* A generation is about 25 years — the most human unit this page has. */
export function generations(years, lang) {
  const n = Math.max(1, Math.round(years / 25));
  return '≈ ' + n.toLocaleString(loc(lang)) + (lang === 'fr' ? ' générations avant vous' : ' generations before you');
}

export const calendarYear = (year, lang) => year > 0
  ? (lang === 'fr' ? 'en ' + year : 'in ' + year)
  : (lang === 'fr' ? 'en ' + (1 - year) + ' av. J.-C.' : (1 - year) + ' BC');
