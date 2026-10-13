#!/usr/bin/env python3
"""Unduh Fredoka + Nunito (subset latin) ke public/fonts dan tulis src/app/fonts.css lokal.

CSP app membatasi style-src/font-src ke 'self', jadi Google Fonts CDN tidak bisa dipakai.
Font harus di-host sendiri.
"""
import re, urllib.request, pathlib

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
ROOT = pathlib.Path('/root/.hermes/projects/filemerge')
FONTDIR = ROOT / 'public' / 'fonts'
FONTDIR.mkdir(parents=True, exist_ok=True)

FAMILIES = {
    'Fredoka': 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&display=swap',
    'Nunito':  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;700&display=swap',
}
# hanya subset latin (dan latin-ext kalau ada), cukup untuk Bahasa Indonesia
KEEP = {'latin', 'latin-ext'}


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return data if binary else data.decode('utf-8')


blocks = []
for name, css_url in FAMILIES.items():
    css = fetch(css_url)
    # pisahkan @font-face beserta komentar subset di atasnya
    parts = re.split(r'/\*\s*([a-z0-9\-\[\]]+)\s*\*/', css)
    # parts: [pre, subset, block, subset, block, ...]
    for i in range(1, len(parts) - 1, 2):
        subset = parts[i].strip()
        block = parts[i + 1]
        if subset not in KEEP:
            continue
        body = re.search(r'@font-face\s*\{(.*?)\}', block, re.S)
        if not body:
            continue
        body = body.group(1)
        b = dict(re.findall(r'([a-zA-Z-]+)\s*:\s*([^;]+);', body))
        url = re.search(r'url\((https://[^)]+\.woff2)\)', body)
        if not url:
            continue
        wght = b.get('font-weight', '400')
        style = b.get('font-style', 'normal')
        url = url.group(1)
        fname = f"{name.lower()}-{wght}-{subset}.woff2"
        dest = FONTDIR / fname
        if not dest.exists():
            dest.write_bytes(fetch(url, binary=True))
        blocks.append({
            'family': name, 'weight': wght, 'style': style,
            'subset': subset, 'file': fname,
            'range': b.get('unicode-range', '').strip(),
            'size': dest.stat().st_size,
        })
        print(f"  {fname:34s} {dest.stat().st_size:7,d} bytes  [{subset}]")

# tulis CSS lokal
lines = [
    '/* Font di-host sendiri (CSP tidak mengizinkan CDN font eksternal).',
    ' * Dihasilkan oleh scripts/fetch-fonts.py, jangan diedit manual.',
    ' * Sumber: Google Fonts (Fredoka 500/600, Nunito 400/700), subset latin. */',
    '',
]
for f in blocks:
    lines += [
        '@font-face {',
        f"  font-family: '{f['family']}';",
        f"  font-style: {f['style']};",
        f"  font-weight: {f['weight']};",
        '  font-display: swap;',
        f"  src: url('/fonts/{f['file']}') format('woff2');",
    ]
    if f['range']:
        lines.append(f"  unicode-range: {f['range']};")
    lines += ['}', '']

out = ROOT / 'src' / 'app' / 'fonts.css'
out.write_text('\n'.join(lines), encoding='utf-8')
print(f"\nditulis: {out} ({len(blocks)} @font-face, {len(lines)} baris)")
