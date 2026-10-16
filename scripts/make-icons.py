#!/usr/bin/env python3
"""Render the L3 home-screen icons.

Writes public/favicon.svg, public/icon-192.png and public/icon-512.png so the
installed icon cannot drift away from the mark in the header. Everything comes
from the constants below, which must match --logo-tile, --logo-ink and
--logo-accent in src/styles.css and the <Logo> component.

    pip install pillow && python3 scripts/make-icons.py

Not part of the build: these change about once a year, and the generated PNGs
are committed. Keeping Pillow out of the build means a deploy never depends on
it being installed.

On the choices here that were made deliberately:

* A FLAT violet tile. The old sky mark needed a gradient to stop reading as a
  placeholder at home-screen size; violet at this chroma does not, and a flat
  fill survives a launcher resizing it better than a ramp does.
* Cambria's letterforms, by way of Caladea — the metric-compatible open twin,
  which is installable on Linux (fonts-crosextra-caladea) and a Mac. The SVG
  carries them as an OUTLINE rather than a font-family, because favicon.svg is
  fetched as a standalone document where no webfont would load; this script
  draws from the TTF instead, which is why the font has to be present to
  re-run it. The two agree because both come from the same file.
* The mint swash is what the serif stands on. Without it the letters float in
  the middle of the tile.

If the outline in public/favicon.svg and src/ui/Logo.tsx ever needs
regenerating, it is Caladea Bold at 39.2/1000 em, ink centred on x=32 with the
baseline at y=42.4, in a 64x64 box — fontTools' SVGPathPen through a
TransformPen of (s, 0, 0, -s, tx, 42.4).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

TILE = "#7A52A8"  # violet
INK = "#ffffff"
ACCENT = "#5FD9B6"  # mint, the swash under the letters
TEXT = "L3"

# Geometry, all as a fraction of the tile's side, taken from the 64x64 SVG so
# the PNG and the SVG are the same picture.
FONT_RATIO = 39.2 / 64  # cap size
INK_CENTRE_Y = 29.25 / 64  # where the middle of the letters sits
SWASH_Y = 50.4 / 64  # the ends of the swash
SWASH_LIFT = 6.4 / 64  # how far its middle rises above the ends
SWASH_X0, SWASH_X1 = 13.6 / 64, 50.4 / 64
SWASH_WIDTH = 3.6 / 64
RADIUS = 14 / 64

OUT = Path(__file__).resolve().parent.parent / "public"

# Caladea Bold — Cambria's metric-compatible twin. The first one present wins.
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/crosextra/Caladea-Bold.ttf",
    "/usr/share/fonts/caladea/Caladea-Bold.ttf",
    "/Library/Fonts/Caladea-Bold.ttf",
    str(Path.home() / "Library/Fonts/Caladea-Bold.ttf"),
]


def font_path() -> str:
    for candidate in FONT_CANDIDATES:
        if Path(candidate).exists():
            return candidate
    raise SystemExit(
        "Caladea Bold not found. Install it (Debian/Ubuntu: apt install "
        "fonts-crosextra-caladea) or add the path to FONT_CANDIDATES."
    )


def render(size: int) -> Image.Image:
    # 4x supersampling, then one downscale: rounder corners and cleaner glyph
    # edges than anything the rasteriser does at final size.
    scale = 4
    big = size * scale

    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, big - 1, big - 1], radius=round(big * RADIUS), fill=255
    )
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    img.paste(Image.new("RGB", (big, big), TILE), (0, 0), mask)

    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(font_path(), round(big * FONT_RATIO))
    # Measure the actual ink, not the font's nominal box: the two glyphs sit
    # noticeably off centre otherwise.
    left, top, right, bottom = draw.textbbox((0, 0), TEXT, font=font)
    draw.text(
        (
            (big - (right - left)) / 2 - left,
            big * INK_CENTRE_Y - (bottom - top) / 2 - top,
        ),
        TEXT,
        font=font,
        fill=INK,
    )

    # The swash, as a sampled quadratic — Pillow has no curve primitive, and a
    # polyline through 40 points is indistinguishable at 4x.
    x0, x1 = big * SWASH_X0, big * SWASH_X1
    y_end, y_mid = big * SWASH_Y, big * (SWASH_Y - SWASH_LIFT)
    points = []
    for i in range(41):
        t = i / 40
        u = 1 - t
        points.append(
            (
                u * u * x0 + 2 * u * t * ((x0 + x1) / 2) + t * t * x1,
                u * u * y_end + 2 * u * t * y_mid + t * t * y_end,
            )
        )
    draw.line(points, fill=ACCENT, width=round(big * SWASH_WIDTH), joint="curve")

    return img.resize((size, size), Image.LANCZOS)


# The letters as an outline, so the SVG needs no font. See the module docstring
# for how to regenerate it.
L3_PATH = (
    "M15.01 39.81V19.04Q14.38 18.49 12.58 17.86L12.77 16.25H23.71L23.47 17.86"
    "Q22.53 18.06 21.95 18.29Q21.36 18.53 20.77 19.04V39.97H27.63Q28.88 38.09 "
    "29.47 34.99Q30.26 34.87 31.08 34.87Q31.71 34.87 32.37 34.99L31.98 42.4H12.62"
    "L12.77 40.79Q13.4 40.71 14.07 40.42Q14.73 40.13 15.01 39.81ZM33.16 37.3"
    "Q33.16 35.85 34.02 35.05Q34.88 34.25 36.17 34.25Q37.51 34.25 38.88 35.3"
    "Q38.53 36.05 38.53 37.11Q38.53 38.36 39.29 39.15Q40.06 39.93 41.58 39.93"
    "Q44.96 39.93 44.96 35.27Q44.96 32.72 43.33 31.31Q41.7 29.9 38.72 29.9V27.46"
    "Q44.49 26.99 44.49 22.49Q44.49 20.21 43.78 19.13Q43.07 18.06 41.86 18.06"
    "Q40.41 18.06 39.68 19.08Q38.96 20.1 38.96 21.55Q38.96 22.84 39.51 23.86"
    "Q38.41 25.03 36.68 25.03Q35.12 25.03 34.25 24.09Q33.39 23.15 33.39 21.66"
    "Q33.39 19.7 34.74 18.39Q36.1 17.08 38.12 16.45Q40.13 15.82 42.09 15.82"
    "Q44.64 15.82 46.6 16.67Q48.56 17.51 49.66 19.02Q50.76 20.53 50.76 22.49"
    "Q50.76 24.68 49.46 26.25Q48.17 27.82 45.62 28.64Q48.84 29.35 50.13 30.95"
    "Q51.42 32.56 51.42 35.3Q51.42 37.7 49.99 39.38Q48.56 41.07 46.29 41.89"
    "Q44.01 42.71 41.58 42.71Q38.06 42.71 35.61 41.26Q33.16 39.81 33.16 37.3Z"
)

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="14" fill="{TILE}"/>
  <path d="{L3_PATH}" fill="{INK}"/>
  <path d="M13.6 50.4q18.4 -6.4 36.8 0" stroke="{ACCENT}" stroke-width="3.6"
        stroke-linecap="round" fill="none"/>
</svg>
"""

if __name__ == "__main__":
    (OUT / "favicon.svg").write_text(svg)
    print("wrote public/favicon.svg")
    for px in (192, 512):
        render(px).save(OUT / f"icon-{px}.png")
        print(f"wrote public/icon-{px}.png")
