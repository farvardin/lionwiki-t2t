#!/usr/bin/env python3
"""Regenerate the Writhdeck plugin assets from the writhdeck-web sources.

Usage:
    python3 sync-assets.py [path-to-writhdeck-web]

Default writhdeck-web path: ~/src/writerdeck/writhdeck-web

Produces, next to this script:
  - writhdeck.js   (assembled JS bundle, == build.py --script)
  - style.css      (== build.py --style)
  - body.html      (writhdeck <body> DOM, == build.py --body, base64 logos stripped)

writhdeck-web stays the single source of truth: never edit these three files by
hand — re-run this script instead. The plugin-specific glue (wiki-backend.js,
wiki.css, wkp_Writhdeck.php) is hand-written and not touched here.
"""
import os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SRC = os.path.expanduser('~/src/writerdeck/writhdeck-web')
SRC = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
BUILD = os.path.join(SRC, 'build.py')

if not os.path.isfile(BUILD):
    sys.exit(f'writhdeck-web build.py not found at {BUILD!r} — pass the path as arg.')

def build(*flags):
    return subprocess.run([sys.executable, BUILD, *flags],
                          capture_output=True, text=True, check=True).stdout

with open(os.path.join(HERE, 'writhdeck.js'), 'w', encoding='utf-8') as f:
    f.write(build('--script'))
with open(os.path.join(HERE, 'style.css'), 'w', encoding='utf-8') as f:
    f.write(build('--style'))

# Body DOM — strip the inline base64 logos (heavy, unused chrome) so the markup
# injected into every edit page stays small.
body = build('--body')
body = re.sub(r'src="data:image/png;base64,[^"]*"', 'src="templates/favicon.png"', body)
with open(os.path.join(HERE, 'body.html'), 'w', encoding='utf-8') as f:
    f.write(body.strip() + '\n')

print('Synced writhdeck.js, style.css and body.html from', SRC)
