# MAGNITUDE

**Three journeys in one scrollbar.** → [leiaperch.github.io/magnitude](https://leiaperch.github.io/magnitude/)

Same page, same scrollbar, three different axes — switch with the button top right.

| Mode | Axis | What you see |
|---|---|---|
| **Meters** | log₁₀ metres, 10⁻¹⁶ → 10²⁷ | A continuous zoom from inside a proton to the edge of the observable universe. 13 shader scenes. |
| **Years** | log₁₀ seconds since the Big Bang | The plasma, recombination, the dark ages, the first stars, the Sun. |
| **Ages** | 50-year slices, 1000 → 2050 | One town square in flat-shaded 3D, rebuilt every fifty years. The camera never moves; only the town does. |

The first two are logarithmic and share one fragment shader — every ~900 px of
scroll multiplies the field of view by ten. The third deliberately is not: a log
axis crushes all of human history into six thousandths of a pixel, so the ages
mode drops it for a flat run of slices instead. Scroll sits *between* two slices
and the later era wipes in from the right, so mid-step you see two centuries of
the same street side by side.

Bilingual (FR/EN, auto-detected), a live scale readout, an era/landmark jump
menu, deep links, a hands-free **Voyage** mode, and a generative drone tuned to
your position on whichever axis is running.

## How it is built

No build step and one dependency (three.js, vendored) — just modules the browser
loads itself.

```
index.html            markup shell only; all copy comes from assets/data
assets/css/           base · cards · hud · ages
assets/js/
  main.js             entry (ES module, so deferred by default): the only mutable state
  config.js           the three axes, scene bands, mode wiring
  format.js           every number the readout shows (pure)
  gl.js               WebGL2 renderer + multipass HDR bloom, for the two log modes
  audio.js            the drone
  modes/ages.js       the 3D renderer: camera, sun, sky, and the seam
  modes/town3d.js     builds one era's town as geometry from its parameters
assets/glsl/          scene.frag + the bloom pipeline, loaded at runtime
assets/vendor/        three.js r169, ESM build (MIT)
assets/data/          eras, cards, landmarks and UI copy — bilingual JSON
tools/                the checks below
```

Nothing in the ages mode is a picture. Each era is a list of parameters — what
the roofs are made of, what stands on the skyline, what moves in the street —
built into real geometry from a seed, so the same year always builds the same
town.

The look is flat-shaded volumes under one orthographic camera that never moves:
`MeshLambertMaterial` with `flatShading`, one directional sun with a single
shared shadow map, and fog in the sky's own colour doing the atmospheric work.
Every mesh reuses one of seven shared geometries and is scaled into place, so an
era costs ~280 meshes and about 4ms to build, and holding several in memory
costs objects rather than vertex buffers.

The seam between two eras is not a fade: both towns are in the scene at once and
a clipping plane rides along the camera's right vector, so the older town is
drawn where the plane keeps its left and the later one where it keeps its right.
The sky is the one thing that crossfades — a seam in the air would read as a
mistake rather than as a century passing.

## Checks

Both run without a browser and are worth running before pushing:

```bash
python tools/check.py        # imports, fetches, DOM slots, and the vocabulary town3d can build
node tools/render-test.mjs   # builds all 22 towns, walks their people, checks the readouts
```

`render-test` is the useful one: three.js assembles a scene graph perfectly well
without a GL context, so the geometry, the bounds and the animation can all be
exercised in node. It has already caught a wrong CMB temperature and a mistyped
colour that were invisible on screen.

## Run

It uses ES modules and `fetch`, so it needs a server rather than `file://`:

```bash
python -m http.server 8000
```
