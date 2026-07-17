/* MAGNITUDE — the WebGL renderer for the two logarithmic modes.
 *
 * Scene renders into an HDR target, its highlights are extracted at quarter
 * resolution, blurred twice, and composited back with the filmic finish.
 * Every step degrades: no float targets → 8-bit; no targets at all → the scene
 * shader does its own finish and draws straight to the screen.
 */

import { clamp } from './config.js';

const SRC = {
  vert: 'assets/glsl/quad.vert',
  scene: 'assets/glsl/scene.frag',
  bright: 'assets/glsl/bright.frag',
  blur: 'assets/glsl/blur.frag',
  composite: 'assets/glsl/composite.frag',
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    this.ok = false;
    this.post = null;
  }

  async load() {
    if (!this.gl) return false;
    const src = {};
    await Promise.all(Object.entries(SRC).map(async ([k, url]) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      src[k] = await r.text();
    }));
    this.vertSrc = src.vert;

    this.prog = this.build(src.scene);
    if (!this.prog) return false;
    this.u = {};
    for (const n of ['uRes', 'uTime', 'uE', 'uPointer', 'uPing', 'uFinal', 'uMode']) {
      this.u[n] = this.gl.getUniformLocation(this.prog, n);
    }
    this.ok = true;

    const gl = this.gl;
    const pB = this.build(src.bright), pL = this.build(src.blur), pC = this.build(src.composite);
    const float = gl.getExtension('EXT_color_buffer_float');
    if (pB && pL && pC) {
      this.post = {
        enabled: false, wq: 0, hq: 0,
        ifmt: float ? gl.RGBA16F : gl.RGBA8,
        type: float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
        sceneTex: null, sceneFbo: null, texA: null, fboA: null, texB: null, fboB: null,
        bright: { p: pB, uInvDst: gl.getUniformLocation(pB, 'uInvDst'), uSrcTexel: gl.getUniformLocation(pB, 'uSrcTexel'), uTex: gl.getUniformLocation(pB, 'uTex') },
        blur: { p: pL, uInvDst: gl.getUniformLocation(pL, 'uInvDst'), uDir: gl.getUniformLocation(pL, 'uDir'), uTex: gl.getUniformLocation(pL, 'uTex') },
        comp: { p: pC, uSceneT: gl.getUniformLocation(pC, 'uSceneT'), uBloomT: gl.getUniformLocation(pC, 'uBloomT'), uInvDst: gl.getUniformLocation(pC, 'uInvDst'), uRes2: gl.getUniformLocation(pC, 'uRes2'), uT2: gl.getUniformLocation(pC, 'uT2') },
      };
    }
    return true;
  }

  build(fragSrc) {
    const gl = this.gl;
    const mk = (type, s) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, s);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(sh)); return null; }
      return sh;
    };
    const vs = mk(gl.VERTEX_SHADER, this.vertSrc), fs = mk(gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    const ok = gl.getProgramParameter(p, gl.LINK_STATUS);
    if (!ok) console.error(gl.getProgramInfoLog(p));
    gl.deleteShader(vs); gl.deleteShader(fs);   // the linked program keeps what it needs
    return ok ? p : null;
  }

  makeTex(w, h) {
    const gl = this.gl, tx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.post.ifmt, w, h, 0, gl.RGBA, this.post.type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tx;
  }
  makeFbo(tx) {
    const gl = this.gl, fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ok ? fb : null;
  }
  alloc(w, h) {
    const p = this.post;
    if (!p) return;
    const gl = this.gl;
    for (const k of ['sceneTex', 'texA', 'texB']) if (p[k]) gl.deleteTexture(p[k]);
    for (const k of ['sceneFbo', 'fboA', 'fboB']) if (p[k]) gl.deleteFramebuffer(p[k]);
    p.wq = Math.max(1, Math.round(w / 4));
    p.hq = Math.max(1, Math.round(h / 4));
    p.sceneTex = this.makeTex(w, h); p.sceneFbo = this.makeFbo(p.sceneTex);
    p.texA = this.makeTex(p.wq, p.hq); p.fboA = this.makeFbo(p.texA);
    p.texB = this.makeTex(p.wq, p.hq); p.fboB = this.makeFbo(p.texB);
    p.enabled = !!(p.sceneFbo && p.fboA && p.fboB);
    if (!p.enabled && p.ifmt !== gl.RGBA8) {      // float target not renderable here: retry 8-bit
      p.ifmt = gl.RGBA8; p.type = gl.UNSIGNED_BYTE;
      this.alloc(w, h);
    }
  }

  fit() {
    // cap the backing store near 2K: keeps the heaviest scenes at 60fps on 4K screens
    const dpr = Math.min(clamp(devicePixelRatio || 1, 1, 1.5), 2048 / Math.max(innerWidth, 1));
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
      this.alloc(w, h);
    }
  }

  render({ time, e, mode, pointer, ping }) {
    if (!this.ok) return;
    const gl = this.gl;
    this.fit();
    const W = this.canvas.width, H = this.canvas.height;
    const p = this.post, usePost = p && p.enabled;

    gl.bindFramebuffer(gl.FRAMEBUFFER, usePost ? p.sceneFbo : null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.prog);
    gl.uniform2f(this.u.uRes, W, H);
    gl.uniform1f(this.u.uTime, time);
    gl.uniform1f(this.u.uE, e);
    gl.uniform1f(this.u.uFinal, usePost ? 0 : 1);
    gl.uniform1f(this.u.uMode, mode);
    gl.uniform2f(this.u.uPointer, pointer.x, pointer.y);
    gl.uniform4f(this.u.uPing, ping.x, ping.y, ping.t, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!usePost) return;

    gl.useProgram(p.bright.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, p.fboA);
    gl.viewport(0, 0, p.wq, p.hq);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, p.sceneTex);
    gl.uniform1i(p.bright.uTex, 0);
    gl.uniform2f(p.bright.uInvDst, 1 / p.wq, 1 / p.hq);
    gl.uniform2f(p.bright.uSrcTexel, 1 / W, 1 / H);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.useProgram(p.blur.p);
    gl.uniform1i(p.blur.uTex, 0);
    gl.uniform2f(p.blur.uInvDst, 1 / p.wq, 1 / p.hq);
    for (const s of [1, 2]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, p.fboB);
      gl.bindTexture(gl.TEXTURE_2D, p.texA);
      gl.uniform2f(p.blur.uDir, s / p.wq, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, p.fboA);
      gl.bindTexture(gl.TEXTURE_2D, p.texB);
      gl.uniform2f(p.blur.uDir, 0, s / p.hq);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    gl.useProgram(p.comp.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, p.sceneTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, p.texA);
    gl.uniform1i(p.comp.uSceneT, 0);
    gl.uniform1i(p.comp.uBloomT, 1);
    gl.uniform2f(p.comp.uInvDst, 1 / W, 1 / H);
    gl.uniform2f(p.comp.uRes2, W, H);
    gl.uniform1f(p.comp.uT2, time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }
}
