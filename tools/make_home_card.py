#!/usr/bin/env python3
"""
Home share card - redraws assets/portfolio-social-preview.png.

That PNG is the source optimize_images.py turns into assets/social/home.jpg,
which is what LinkedIn, Slack, iMessage and friends show for the site root.
It is drawn in the site's own identity - the dark "scope" theme, the
nameplate, mono meta lines, the copper dot and the signal-green status LED -
using the same self-hosted fonts the site ships, so it cannot drift from the
page and does not depend on which fonts this computer has installed.

    python tools/make_home_card.py
    python tools/optimize_images.py --force   # or delete social/home.jpg first

Drawn at 2x and downsampled, which is cheaper than fighting PIL's aliasing.
Needs Pillow built with FreeType's WOFF2 support (the standard wheels are).
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "assets" / "portfolio-social-preview.png"
FONTS = ROOT / "fonts"

# Design tokens from css/site.css (dark theme), so the card matches the site.
BG = (11, 12, 11)          # --bg
INK = (236, 237, 230)      # --ink
MUTED = (154, 160, 149)    # --muted
RULE = (38, 42, 37)        # --rule
GRID = (22, 24, 22)        # --grid-line over --bg
ACCENT = (255, 106, 43)    # --accent
SIGNAL = (201, 243, 29)    # --signal

SCALE = 2
W, H = 1200 * SCALE, 630 * SCALE
PAD = 72 * SCALE


def font(name: str, size: int, weight: int | None = None) -> ImageFont.FreeTypeFont:
    face = ImageFont.truetype(str(FONTS / name), size * SCALE)
    if weight is not None:
        face.set_variation_by_axes([weight])
    return face


def mono(size: int) -> ImageFont.FreeTypeFont:
    return font("martian-mono-400.woff2", size)


def text_right(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, face, fill) -> None:
    draw.text((x - draw.textlength(text, font=face), y), text, font=face, fill=fill)


def build() -> None:
    card = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(card)

    # graph-paper grid, as behind the site's hero
    step = 24 * SCALE
    for x in range(0, W, step):
        draw.line([(x, 0), (x, H)], fill=GRID, width=1)
    for y in range(0, H, step):
        draw.line([(0, y), (W, y)], fill=GRID, width=1)

    # top meta row, mirroring .hero__meta
    meta = mono(15)
    top = PAD
    draw.text((PAD, top), "PORTFOLIO / REV 2026.09", font=meta, fill=MUTED)
    text_right(draw, W - PAD, top, "UC IRVINE · COMPUTER SCIENCE & ENGINEERING", meta, MUTED)
    rule_y = top + 40 * SCALE
    draw.line([(PAD, rule_y), (W - PAD, rule_y)], fill=RULE, width=SCALE)

    # nameplate: CALVIN left, YANG. right, spread across the width like the hero.
    # PIL cannot tighten tracking the way the CSS does, so pick the largest size
    # at which both words fit with a clear gap between them.
    calvin, yang = "CALVIN", "YANG"
    size = 160
    while True:
        name = font("unbounded-800.woff2", size)
        widths = [draw.textlength(t, font=name) for t in (calvin, yang, ".")]
        if sum(widths) + 0.35 * size * SCALE <= W - 2 * PAD:
            break
        size -= 2
    name_y = rule_y + 58 * SCALE
    draw.text((PAD - 3 * SCALE, name_y), calvin, font=name, fill=INK)
    draw.text((W - PAD - widths[2] - widths[1], name_y), yang, font=name, fill=INK)
    draw.text((W - PAD - widths[2], name_y), ".", font=name, fill=ACCENT)

    # statement
    lede = font("geist-variable.woff2", 34, weight=600)
    lede_y = name_y + 190 * SCALE
    draw.text((PAD, lede_y), "Embedded systems, electromagnetics, and the", font=lede, fill=INK)
    draw.text((PAD, lede_y + 44 * SCALE), "simulations that explain them.", font=lede, fill=INK)

    # bottom row, mirroring the status LED and footer
    foot_rule = H - PAD - 44 * SCALE
    draw.line([(PAD, foot_rule), (W - PAD, foot_rule)], fill=RULE, width=SCALE)
    foot_y = foot_rule + 18 * SCALE
    led_r = 5 * SCALE
    led_c = (PAD + led_r, foot_y + 9 * SCALE)
    draw.ellipse([led_c[0] - led_r * 2, led_c[1] - led_r * 2, led_c[0] + led_r * 2, led_c[1] + led_r * 2],
                 fill=(40, 52, 16))
    draw.ellipse([led_c[0] - led_r, led_c[1] - led_r, led_c[0] + led_r, led_c[1] + led_r], fill=SIGNAL)
    draw.text((PAD + 26 * SCALE, foot_y), "OPEN TO INTERNSHIPS", font=meta, fill=INK)
    text_right(draw, W - PAD, foot_y, "someheresy.github.io", meta, INK)

    # crop-mark brackets around the content area, like the site's figures
    inset, arm, width = 28 * SCALE, 26 * SCALE, 2 * SCALE
    for cx, cy, dx, dy in [(inset, inset, 1, 1), (W - inset, inset, -1, 1),
                           (inset, H - inset, 1, -1), (W - inset, H - inset, -1, -1)]:
        draw.line([(cx, cy), (cx + dx * arm, cy)], fill=MUTED, width=width)
        draw.line([(cx, cy), (cx, cy + dy * arm)], fill=MUTED, width=width)

    card = card.resize((W // SCALE, H // SCALE), Image.LANCZOS)
    card.save(TARGET, "PNG", optimize=True)
    print(f"wrote {TARGET.relative_to(ROOT).as_posix()}  {card.size[0]}x{card.size[1]}")


if __name__ == "__main__":
    build()
