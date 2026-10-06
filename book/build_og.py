#!/usr/bin/env python3
"""Generate per-chapter social images (docs/assets/og/<slug>.jpg, 1200x628).

Reuses the artwork on the right half of docs/assets/og-mind-of-agents.png and
paints the chapter number and title over the left half.
Requires Pillow and the macOS system fonts used below.
"""
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent / "docs"
BASE = ROOT / "assets" / "og-mind-of-agents.png"
OUT = ROOT / "assets" / "og"
FONT = "/System/Library/Fonts/HelveticaNeue.ttc"
TEAL, WHITE, MUTED = (110, 231, 207), (245, 245, 241), (160, 176, 204)
PANEL_W, FEATHER, PAD = 800, 90, 84

def font(size, bold=False):
    return ImageFont.truetype(FONT, size, index=1 if bold else 0)

def spaced(draw, xy, text, fnt, fill, tracking=5):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking

def wrap(draw, text, fnt, width):
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=fnt) <= width:
            line = trial
        else:
            lines.append(line)
            line = word
    return lines + [line]

def render(slug, label, title):
    img = Image.open(BASE).convert("RGB")
    bg = img.getpixel((20, 20))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, PANEL_W, img.height], fill=bg)
    for i in range(FEATHER):  # feather the seam into the artwork
        a = i / FEATHER
        x = PANEL_W + i
        for y in range(img.height):
            px = img.getpixel((x, y))
            img.putpixel((x, y), tuple(int(bg[c] * (1 - a) + px[c] * a) for c in range(3)))
    d = ImageDraw.Draw(img)
    spaced(d, (PAD, 150), label.upper(), font(30, True), TEAL)
    size = 112
    while True:
        f = font(size, True)
        lines = wrap(d, title, f, PANEL_W - PAD - 40)
        if len(lines) <= 4 and all(d.textlength(l, font=f) <= PANEL_W - PAD - 20 for l in lines):
            break
        size -= 6
    y = 230
    for line in lines:
        d.text((PAD, y), line, font=f, fill=WHITE)
        y += int(size * 1.08)
    spaced(d, (PAD, img.height - 120), "MIND OF AGENTS", font(28, True), MUTED)
    OUT.mkdir(parents=True, exist_ok=True)
    img.resize((1200, 628), Image.LANCZOS).save(OUT / f"{slug}.jpg", quality=86, optimize=True, progressive=True)

PARTS = {1: "Part I", 2: "Part I", 3: "Part I", 4: "Part II", 5: "Part II", 6: "Part II",
         7: "Part II", 8: "Part II", 9: "Part III", 10: "Part III", 11: "Part III", 12: "Part III"}

def main():
    html = (ROOT / "read" / "index.html").read_text()
    pat = re.compile(r'<a class="chapter-row[^"]*" href="([a-z-]+)/"><span class="num">(\d\d)</span><div><h3>([^<]+)</h3>')
    found = [(s, int(n), t) for s, n, t in pat.findall(html) if n != "00"]
    assert len(found) == 12, found
    for slug, n, title in found:
        render(slug, f"{PARTS[n]} / Chapter {n:02d}", title.replace("&amp;", "&"))
        print(slug)

if __name__ == "__main__":
    main()
