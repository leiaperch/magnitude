/* MAGNITUDE — the drone.
 *
 * Pitch is your position on whichever axis is running: small and early scales
 * ring high, cosmic ones rumble. Built lazily, because an AudioContext may not
 * exist until a click has happened.
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class Drone {
  constructor() {
    this.on = false;
    this.ctx = null;
  }

  build() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const voice = (type, detune) => {
      const o = ctx.createOscillator();
      o.type = type; o.detune.value = detune;
      const g = ctx.createGain(); g.gain.value = 0.05;
      o.connect(g); g.connect(master); o.start();
      return o;
    };
    const o1 = voice('sine', 0), o2 = voice('sine', 9), o3 = voice('triangle', -1205);

    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.Q.value = 2.5;
    const ng = ctx.createGain(); ng.gain.value = 0.028;
    noise.connect(nf); nf.connect(ng); ng.connect(master); noise.start();

    Object.assign(this, { ctx, master, o1, o2, o3, nf });
  }

  async toggle() {
    if (!this.ctx) this.build();
    await this.ctx.resume();
    this.on = !this.on;
    this.master.gain.setTargetAtTime(this.on ? 0.5 : 0, this.ctx.currentTime, 0.4);
    return this.on;
  }

  pitch(v, axis) { return 55 * Math.pow(2, (axis.max - v) / axis.span * 5.2); }

  follow(v, axis) {
    if (!this.on) return;
    const f = this.pitch(v, axis), now = this.ctx.currentTime;
    this.o1.frequency.setTargetAtTime(f, now, 0.15);
    this.o2.frequency.setTargetAtTime(f * 1.5, now, 0.2);
    this.o3.frequency.setTargetAtTime(f * 4, now, 0.25);
    this.nf.frequency.setTargetAtTime(clamp(f * 6, 80, 9000), now, 0.3);
  }

  /* a soft bell every time you cross a whole decade — or a whole slice */
  ping(v, axis) {
    if (!this.on) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = clamp(this.pitch(v, axis) * 4, 60, 4000);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(ctx.currentTime + 0.55);
  }
}
