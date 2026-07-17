#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Static wiring check for MAGNITUDE.

The page is split across HTML, CSS, JS modules, GLSL and JSON, so most ways of
breaking it are a name that stops matching across two files. This walks those
seams: imports, fetches, DOM slots, and the vocabulary the town builder can actually
draw. Run it before pushing:  python tools/check.py
"""
import re, io, os, glob, json, sys

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
bad = []


def rd(p):
    return io.open(p, encoding='utf-8').read()


def jd(p):
    return json.load(io.open(p, encoding='utf-8'))


js_files = sorted(glob.glob('assets/js/**/*.js', recursive=True))
html = rd('index.html')
main = rd('assets/js/main.js')

# --- every import resolves, and the named bindings really are exported -------
for f in js_files:
    src = rd(f)
    for m in re.finditer(r"import\s+(?:\*\s+as\s+\w+|\{([^}]*)\}|(\w+))\s+from\s+'([^']+)'", src):
        names, _dflt, spec = m.groups()
        tgt = os.path.normpath(os.path.join(os.path.dirname(f), spec))
        if not os.path.exists(tgt):
            bad.append('%s imports missing module %s' % (f, spec))
            continue
        tsrc = rd(tgt)
        for n in [x.strip().split(' as ')[0].strip() for x in (names or '').split(',') if x.strip()]:
            if not re.search(r'export\s+(?:const|function|class|let)\s+' + re.escape(n) + r'\b', tsrc):
                bad.append('%s: %s does not export %s' % (f, spec, n))

# --- every fetched asset exists ---------------------------------------------
for f in js_files:
    for m in re.finditer(r"fetch\('([^']+)'\)", rd(f)):
        if not os.path.exists(m.group(1)):
            bad.append('%s fetches missing %s' % (f, m.group(1)))
for m in re.finditer(r"'(assets/glsl/[^']+)'", rd('assets/js/gl.js')):
    if not os.path.exists(m.group(1)):
        bad.append('gl.js references missing %s' % m.group(1))

# --- html links + the slots main.js writes into ------------------------------
for m in re.finditer(r'(?:href|src)="(assets/[^"]+)"', html):
    if not os.path.exists(m.group(1)):
        bad.append('index.html links missing %s' % m.group(1))

ids = set(re.findall(r'id="([^"]+)"', html))
for m in re.finditer(r"\$\('#([\w-]+)'\)", main):
    if m.group(1) not in ids:
        bad.append('main.js wants #%s, not in index.html' % m.group(1))

for cls in ['over', 'sub', 'rules', 'cue', 'halo', 'body', 'fn', 'big-num', 'lede', 'stats', 'fine']:
    if 'class="%s"' % cls not in html:
        bad.append('index.html is missing the .%s slot' % cls)

# --- ui.json answers every key fillUI() asks for -----------------------------
fill = main[main.index('function fillUI()'):main.index('function buildCards()')]
need = set(re.findall(r'\bt\.(\w+)', fill))
ui = jd('assets/data/ui.json')
for mode in ['e', 't', 'a']:
    for lang in ['en', 'fr']:
        for k in need - set(ui[mode][lang]):
            bad.append('ui.json %s/%s has no "%s"' % (mode, lang, k))

# --- cards are complete in both languages -----------------------------------
for fn, n in [('space', 18), ('time', 11)]:
    rows = jd('assets/data/%s.cards.json' % fn)
    if len(rows) != n:
        bad.append('%s.cards.json holds %d cards, expected %d' % (fn, len(rows), n))
    for r in rows:
        if r['side'] not in ('l', 'r'):
            bad.append('%s card %s: bad side' % (fn, r['at']))
        for lang in ['en', 'fr']:
            for k in ['title', 'meas', 'body']:
                if not r.get(lang, {}).get(k):
                    bad.append('%s card %s: no %s.%s' % (fn, r['at'], lang, k))

# --- the ages only ask town3d for shapes it can build --------------------
SKYLINE = {'motte', 'palisade', 'keep', 'church', 'cathedral', 'cathedral-build',
           'chimney', 'crane', 'tower', 'tower-solar'}
PROPS = {'barrel', 'pig', 'stall', 'cart', 'carriage', 'tram', 'car', 'bike',
         'lamp-oil', 'lamp-gas', 'lamp-electric'}
WALLS = {'wood', 'timber', 'stone', 'brick', 'render', 'concrete'}
ROOFS = {'thatch', 'tile', 'slate', 'flat', 'solar'}
WINDOWS = {'hole', 'shutter', 'lead', 'sash', 'picture'}
GROUNDS = {'mud', 'cobble', 'setts', 'asphalt'}

town = rd('assets/js/modes/town3d.js')
for name in SKYLINE:
    if not re.search(r"case '%s':" % re.escape(name), town):
        bad.append('town3d.js cannot build skyline "%s"' % name)
for name in PROPS:
    if not re.search(r"case '%s':" % re.escape(name), town):
        bad.append('town3d.js has no prop "%s"' % name)
for name, table in [('wall', WALLS), ('roof', ROOFS), ('ground', GROUNDS)]:
    block = town[town.index('%s: {' % name):]
    block = block[:block.index('}')]
    for k in table:
        if '%s:' % k not in block:
            bad.append('town3d.js PALETTE.%s has no "%s"' % (name, k))

# town3d has no CSS selectors in it, so every 0x… is a colour: catch a typo
for m in re.finditer(r'0x([0-9a-zA-Z]+)', town):
    if not re.fullmatch(r'[0-9a-fA-F]{6}', m.group(1)):
        bad.append('town3d.js: 0x%s is not a six-digit colour' % m.group(1))

ages = jd('assets/data/ages.json')
years = [e['year'] for e in ages['eras']]
if years != list(range(1000, 2051, ages['step'])):
    bad.append('ages years are not a clean %d-year run' % ages['step'])
for e in ages['eras']:
    y = e['year']
    if len(e['skyline']) > 3:
        bad.append('ages %s: only 3 skyline slots are placed' % y)
    for s in e['skyline']:
        if s not in SKYLINE:
            bad.append('ages %s: unknown skyline "%s"' % (y, s))
    for p in e['street']:
        if p not in PROPS:
            bad.append('ages %s: unknown prop "%s"' % (y, p))
    if e['house']['material'] not in WALLS:
        bad.append('ages %s: unknown material' % y)
    if e['house']['roof'] not in ROOFS:
        bad.append('ages %s: unknown roof' % y)
    if e['house']['window'] not in WINDOWS:
        bad.append('ages %s: unknown window' % y)
    if e['ground'] not in GROUNDS:
        bad.append('ages %s: unknown ground' % y)
    for lang in ['en', 'fr']:
        if not e[lang].get('name') or not e[lang].get('note'):
            bad.append('ages %s: missing %s text' % (y, lang))

# --- the shader no longer carries the ages, and modes agree -----------------
frag = rd('assets/glsl/scene.frag')
for gone in ['scAges', 'agesTown']:
    if gone in frag:
        bad.append('scene.frag still holds %s (ages is 3D now)' % gone)
if 'uMode' not in frag:
    bad.append('scene.frag lost its uMode uniform')

print('%d file(s) checked — %d problem(s)' % (len(js_files) + 6, len(bad)))
for x in bad:
    print('  X ' + x)
sys.exit(1 if bad else 0)
