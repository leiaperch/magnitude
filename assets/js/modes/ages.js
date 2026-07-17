/* MAGNITUDE — the ages mode.
 *
 * Not a zoom: a flip-book. One town square, one slice every 50 years, and the
 * scroll sits *between* two slices — the later era wipes in from the right, so
 * mid-step you are looking at two centuries of the same street side by side.
 */

import { drawEra } from './diorama.js';
import { AXES, clamp } from '../config.js';

export class Ages {
  constructor(root) {
    this.root = root;
    this.eras = [];
    this.step = 50;
    this.index = -1;
    this.ready = false;
  }

  async load() {
    const data = await fetch('assets/data/ages.json').then(r => r.json());
    this.eras = data.eras;
    this.step = data.step;
    this.svg = this.eras.map(() => null);          // drawn once, then kept
    this.root.innerHTML =
      '<div class="slice past" aria-hidden="true"></div>' +
      '<div class="slice future" aria-hidden="true"></div>' +
      '<div class="seam" aria-hidden="true"><b class="y-past"></b><b class="y-future"></b></div>';
    this.past = this.root.querySelector('.past');
    this.future = this.root.querySelector('.future');
    this.seam = this.root.querySelector('.seam');
    this.yPast = this.root.querySelector('.y-past');
    this.yFuture = this.root.querySelector('.y-future');
    this.ready = true;
    return this;
  }

  get trackH() { return (this.eras.length - 1) * AXES.a.pxPerSlice; }
  get span() { return this.eras.length - 1; }

  markup(i) {
    if (!this.svg[i]) this.svg[i] = drawEra(this.eras[i]);
    return this.svg[i];
  }

  /* progress: 0..1 across the whole track. Returns the era now being read. */
  update(progress) {
    if (!this.ready) return null;
    const f = clamp(progress, 0, 1) * this.span;
    const i = Math.min(Math.floor(f), this.span - 1);
    const u = this.span === 0 ? 1 : f - i;

    if (i !== this.index) {
      this.index = i;
      this.past.innerHTML = this.markup(i);
      this.future.innerHTML = this.markup(i + 1);
      this.yPast.textContent = this.eras[i].year;
      this.yFuture.textContent = this.eras[i + 1].year;
    }
    /* the later era owns the right-hand u of the frame: left is always older */
    this.future.style.clipPath = `inset(0 0 0 ${((1 - u) * 100).toFixed(2)}%)`;
    this.seam.style.left = `${((1 - u) * 100).toFixed(2)}%`;
    this.seam.style.opacity = u > 0.015 && u < 0.985 ? '1' : '0';

    return { era: this.eras[u < 0.5 ? i : i + 1], i, u };
  }

  show(on) { this.root.hidden = !on; }
}
