# MAGNITUDE

**Three journeys in one scrollbar.** → [leiaperch.github.io/magnitude](https://leiaperch.github.io/magnitude/)

Same page, same scrollbar, three different axes — switch with the button top right.

| Mode | Axis | What you see |
|---|---|---|
| **Meters** | log₁₀ metres, 10⁻¹⁶ → 10²⁷ | A continuous zoom from inside a proton to the edge of the observable universe. 13 shader scenes. |
| **Years** | log₁₀ seconds since the Big Bang | The plasma, recombination, the dark ages, the first stars, the Sun. |
| **Ages** | 50-year slices, 1000 → 2050 | One town square, redrawn every fifty years. The camera never moves; only the town does. |

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

No frameworks, no libraries, no build step — just modules the browser loads itself.

```
index.html            markup shell only; all copy comes from assets/data
assets/css/           base · cards · hud · ages
assets/js/
  main.js             entry (ES module, so deferred by default): the only mutable state
  config.js           the three axes, scene bands, mode wiring
  format.js           every number the readout shows (pure)
  gl.js               WebGL2 renderer + multipass HDR bloom
  audio.js            the drone
  modes/ages.js       slice controller — which two eras, and the seam between them
  modes/diorama.js    draws one era as SVG from its parameters (pure)
assets/glsl/          scene.frag + the bloom pipeline, loaded at runtime
assets/data/          eras, cards, landmarks and UI copy — bilingual JSON
tools/                the checks below
```

Nothing in the ages mode is a picture. Each era is a list of parameters — what
the roofs are made of, what stands on the hill, what moves in the street — turned
into SVG on the fly, from a seed, so the same year always draws the same town.

## Checks

Both run without a browser and are worth running before pushing:

```bash
python tools/check.py        # imports, fetches, DOM slots, and the vocabulary the diorama can draw
node tools/render-test.mjs   # draws all 22 eras, then spot-checks the readout formatters
```

## Run

It uses ES modules and `fetch`, so it needs a server rather than `file://`:

```bash
python -m http.server 8000
```
