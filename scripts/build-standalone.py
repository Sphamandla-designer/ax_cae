"""Bundle the production build into one self-contained HTML file that works offline.

Run after `vite build` (see `npm run build:standalone`). Inlines the JS bundle and CSS from dist/ and
embeds the AX-Channels brand fonts, Archivo and JetBrains Mono (Latin subsets), as base64. If the font cannot be downloaded, the
Google Fonts link is kept and the page falls back to system fonts offline.
Usage: python3 scripts/build-standalone.py [output.html]
"""
import base64, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'CAE-V3-standalone.html'
FONT_CSS = 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'


def fetch(url):
    return subprocess.run(['curl', '-sSfL', '-A', UA, url], check=True, capture_output=True).stdout


def embedded_font_css():
    css = fetch(FONT_CSS).decode()
    blocks = re.findall(r'/\* (latin(?:-ext)?) \*/\s*(@font-face \{.*?\})', css, flags=re.S)
    out = []
    for _, block in blocks:
        url = re.search(r'url\((https://[^)]+)\)', block).group(1)
        data = base64.b64encode(fetch(url)).decode()
        out.append(block.replace(url, 'data:font/woff2;base64,' + data))
    if not out:
        raise RuntimeError('no latin font faces found')
    return '\n'.join(out)


html = (DIST / 'index.html').read_text(encoding='utf-8')

for href in re.findall(r'<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>', html):
    css = (DIST / href.lstrip('/')).read_text(encoding='utf-8')
    html = re.sub(r'<link rel="stylesheet"[^>]*href="' + re.escape(href) + r'"[^>]*>', lambda _: '<style>' + css + '</style>', html)

for src in re.findall(r'<script type="module"[^>]*src="([^"]+)"[^>]*></script>', html):
    js = (DIST / src.lstrip('/')).read_text(encoding='utf-8').replace('</script', '<\\/script')
    html = re.sub(r'<script type="module"[^>]*src="' + re.escape(src) + r'"[^>]*></script>', lambda _: '', html)
    # Inline module scripts run deferred anyway; place it after #root so it also reads as ordered.
    html = html.replace('</body>', '<script type="module">' + js + '</script>\n</body>')

try:
    font_css = embedded_font_css()
    html = re.sub(r'\s*<link rel="preconnect"[^>]*>', '', html)
    html = re.sub(r'\s*<link\s+href="https://fonts\.googleapis\.com[^>]*>', '', html, flags=re.S)
    html = html.replace('</head>', '<style>' + font_css + '</style>\n</head>')
    font_note = 'font embedded'
except Exception as e:  # offline build: keep the Google Fonts link
    font_note = 'font NOT embedded (' + str(e) + ')'

OUT.write_text(html, encoding='utf-8')
print(f'{OUT} — {OUT.stat().st_size / 1024:.0f} kB, {font_note}')
