#!/usr/bin/env python3
"""Render the L3 home-screen icons.

Writes public/favicon.svg, public/icon-192.png and public/icon-512.png so the
installed icon cannot drift away from the mark in the header. Everything comes
from the four constants below, which must match --logo-tile-top, --logo-tile,
--logo-ink in src/styles.css and the <Logo> component.

    pip install pillow && python3 scripts/make-icons.py

Not part of the build: these change about once a year, and the generated PNGs
are committed. Keeping Pillow out of the build means a deploy never depends on
it being installed.

On the two choices here that were made deliberately:

* A sky gradient rather than flat navy. At home-screen size the gradient is
  what stops the tile reading as a placeholder; it is the one place in this
  app where a gradient earns its keep, because an icon is a picture rather
  than part of the interface.
* Sans letters rather than Georgia. Thin serifs disappear at 16px, which is
  the size a browser tab actually renders — the icon has to survive the
  smallest place it appears, not only the largest.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

TILE_TOP = "#5BB0F7"  # sky
TILE_BOTTOM = "#1A6FCC"  # deeper blue, bottom of the gradient
INK = "#ffffff"
TEXT = "L3"

OUT = Path(__file__).resolve().parent.parent / "public"

# A bold grotesk. The first one present wins; the list covers a Linux CI box
# and a Mac.
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]


def font_path() -> str:
    for candidate in FONT_CANDIDATES:
        if Path(candidate).exists():
            return candidate
    raise SystemExit(
        "No bold sans font found. Add one to FONT_CANDIDATES in this script."
    )


def rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def gradient(size: int) -> Image.Image:
    """A top-to-bottom ramp, one row at a time."""
    top, bottom = rgb(TILE_TOP), rgb(TILE_BOTTOM)
    img = Image.new("RGB", (1, size))
    pixels = img.load()
    assert pixels is not None
    for y in range(size):
        t = y / max(1, size - 1)
        pixels[0, y] = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
    return img.resize((size, size), Image.BILINEAR)


def render(size: int) -> Image.Image:
    # 4x supersampling, then one downscale: rounder corners and cleaner glyph
    # edges than anything the rasteriser does at final size.
    scale = 4
    big = size * scale

    # The rounded tile is a mask over the ramp, so the corners stay as clean
    # as the gradient behind them.
    mask = Image.new("L", (big, big), 0)
    # 14/64 of the side, the same radius as the SVG tile.
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, big - 1, big - 1], radius=big * 14 // 64, fill=255
    )
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    img.paste(gradient(big), (0, 0), mask)

    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(font_path(), int(big * 0.46))
    # Measure the actual ink, not the font's nominal box: the two glyphs sit
    # noticeably above centre otherwise.
    left, top, right, bottom = draw.textbbox((0, 0), TEXT, font=font)
    draw.text(
        ((big - (right - left)) / 2 - left, (big - (bottom - top)) / 2 - top),
        TEXT,
        font=font,
        fill=INK,
    )
    return img.resize((size, size), Image.LANCZOS)


svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="l3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{TILE_TOP}"/>
      <stop offset="1" stop-color="{TILE_BOTTOM}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#l3)"/>
  <text x="32" y="33" text-anchor="middle" dominant-baseline="central"
        fill="{INK}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="30" font-weight="700" letter-spacing="-1.2">{TEXT}</text>
</svg>
"""

if __name__ == "__main__":
    (OUT / "favicon.svg").write_text(svg)
    print("wrote public/favicon.svg")
    for px in (192, 512):
        render(px).save(OUT / f"icon-{px}.png")
        print(f"wrote public/icon-{px}.png")
