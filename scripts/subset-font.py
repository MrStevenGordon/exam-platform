#!/usr/bin/env python3
"""Cuts a TrueType icon font down to the given code points and writes it as woff2.

Called by scripts/build-icon-font.mjs. Needs the fonttools and brotli packages:
    python3 -m pip install fonttools brotli
Usage: subset-font.py <font.ttf> <codepoints.txt (one decimal number per line)> <out.woff2>
"""
import sys
from fontTools import subset

ttf, cp_file, out = sys.argv[1:4]
cps = [int(x) for x in open(cp_file).read().split()]
opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = []        # an icon font has no ligatures or kerning to keep
opts.hinting = False
opts.notdef_outline = True
opts.glyph_names = False
opts.name_IDs = [1, 2]
opts.drop_tables += ['DSIG']
font = subset.load_font(ttf, opts)
s = subset.Subsetter(options=opts)
s.populate(unicodes=cps)
s.subset(font)
subset.save_font(font, out, opts)
print(f'wrote {out} with {len(cps)} icons')
