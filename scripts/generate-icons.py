#!/usr/bin/env python3
"""Regenerate Paisa's app icons.

The icons in public/icons/ and src/app/favicon.ico are produced by this
script — a teal gradient tile with a white rupee sign. Re-run it after
changing the brand colours, then commit the result:

    pip install pillow
    python3 scripts/generate-icons.py

Outputs:
    public/icons/icon-{192,512}.png           square, rounded, transparent corners
    public/icons/icon-maskable-{192,512}.png  full bleed, glyph in the 80% safe zone
    public/icons/apple-touch-icon.png         180px, opaque (iOS masks it itself)
    public/icons/favicon-32.png
    src/app/favicon.ico                        16/32/48
"""

from __future__ import annotations

import argparse
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
ICONS = ROOT / "public" / "icons"

# Any bold font with U+20B9 works; DejaVu ships with most Linux distros, and
# --font covers everywhere it does not.
DEFAULT_FONT_CANDIDATES = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
)
RUPEE = "\u20b9"

TOP = (13, 134, 128)  # brighter teal
BOTTOM = (0, 86, 84)  # deep teal — matches --primary in globals.css


def gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(size - 1, 1)
        draw.line(
            [(0, y), (size, y)],
            fill=tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)),
        )
    return img


def resolve_font(explicit: str | None) -> str:
    """The font to draw with, or a clear message about what to pass."""
    candidates = [explicit] if explicit else list(DEFAULT_FONT_CANDIDATES)
    for candidate in candidates:
        if candidate and pathlib.Path(candidate).is_file():
            return candidate

    looked_in = "\n  ".join(c for c in candidates if c)
    sys.exit(
        "No usable font found. Pass one with --font /path/to/Bold.ttf "
        f"(it needs the rupee sign, U+20B9).\nLooked in:\n  {looked_in}"
    )


def fit_font(font_path: str, target: float) -> ImageFont.FreeTypeFont:
    """Largest size whose rupee glyph fits a `target`-pixel box.

    Glyph extent scales linearly with font size, so one measurement gives the
    size directly; a second pass absorbs hinting rounding. No loop to not
    converge.
    """
    probe_size = 100
    probe = ImageFont.truetype(font_path, probe_size)
    left, top, right, bottom = probe.getbbox(RUPEE)
    extent = max(right - left, bottom - top)
    if extent <= 0:
        sys.exit(f"{font_path} has no glyph for the rupee sign (U+20B9).")

    size = max(1, int(probe_size * target / extent))
    font = ImageFont.truetype(font_path, size)
    left, top, right, bottom = font.getbbox(RUPEE)
    while size > 1 and max(right - left, bottom - top) > target:
        size -= 1
        font = ImageFont.truetype(font_path, size)
        left, top, right, bottom = font.getbbox(RUPEE)

    return font


def glyph_layer(size: int, glyph_ratio: float, font_path: str) -> Image.Image:
    """White rupee sign centred on a transparent layer."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    font = fit_font(font_path, size * glyph_ratio)
    left, top, right, bottom = font.getbbox(RUPEE)
    x = (size - (right - left)) / 2 - left
    y = (size - (bottom - top)) / 2 - top
    draw.text((x, y), RUPEE, font=font, fill=(255, 255, 255, 255))
    return layer


def rounded(img: Image.Image, radius_ratio: float) -> Image.Image:
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255
    )
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def make(
    size: int, *, radius_ratio: float, glyph_ratio: float, font_path: str
) -> Image.Image:
    base = gradient(size).convert("RGBA")
    base.alpha_composite(glyph_layer(size, glyph_ratio, font_path))
    return rounded(base, radius_ratio) if radius_ratio else base


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--font",
        help="bold TTF to draw the rupee sign with (default: a system DejaVu/Arial)",
    )
    font_path = resolve_font(parser.parse_args().font)

    ICONS.mkdir(parents=True, exist_ok=True)
    tile = lambda size, radius, glyph: make(  # noqa: E731
        size, radius_ratio=radius, glyph_ratio=glyph, font_path=font_path
    )

    tile(192, 0.22, 0.56).save(ICONS / "icon-192.png")
    tile(512, 0.22, 0.56).save(ICONS / "icon-512.png")

    # Maskable: Android crops to its own shape, so stay inside the safe zone.
    tile(192, 0, 0.42).save(ICONS / "icon-maskable-192.png")
    tile(512, 0, 0.42).save(ICONS / "icon-maskable-512.png")

    tile(180, 0, 0.52).convert("RGB").save(ICONS / "apple-touch-icon.png")

    favicon = tile(512, 0.22, 0.62)
    favicon.save(
        ROOT / "src" / "app" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
    )
    favicon.resize((32, 32), Image.LANCZOS).save(ICONS / "favicon-32.png")

    print("icons written to", ICONS)


if __name__ == "__main__":
    main()
