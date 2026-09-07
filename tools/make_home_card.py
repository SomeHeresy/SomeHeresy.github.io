#!/usr/bin/env python3
"""
Home share card - redraws assets/portfolio-social-preview.png.

That PNG is the source optimize_images.py crops into assets/social/home.jpg,
which is what Open Graph consumers (LinkedIn, Slack, iMessage) show for the
site root. This script regenerates it in the site's own field-notes identity
instead of hand-editing an image: paper ground, ink nameplate, rust accent,
hairline rules, mono meta lines.

    python tools/make_home_card.py
    python tools/optimize_images.py      # rebuilds social/home.jpg from it

Drawn at 2x and downsampled, which is cheaper than fighting PIL's aliasing.
Only dependency is Pillow, already required by optimize_images.py.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "assets" / "portfolio-social-preview.png"

# Design tokens, copied from field-notes.css so the card cannot drift from the site.
BG = (233, 234, 228)          # --bg
INK = (32, 35, 31)            # --ink
MUTED = (82, 89, 80)          # --muted
RUST = (167, 53, 18)          # --mint (the site's accent, despite the name)
LINE = (195, 199, 187)        # --line
LINE_STRONG = (146, 153, 138)  # --line-strong

SCALE = 2
W, H = 1200 * SCALE, 630 * SCALE
PAD = 74 * SCALE

FONTS = Path("C:/Windows/Fonts")
# The site asks for Arial Narrow first and falls back to Arial. Arial Narrow is not
# installed here, so the nameplate is drawn in Arial Bold and squeezed horizontally
# to about the same width - closer to the real page than plain Arial would be.
DISPLAY = FONTS / "arialbd.ttf"
# --mono is Cascadia Code, then Courier New. Courier New is the one that exists.
MONO = FONTS / "cour.ttf"
NARROW = 0.80


def mono(size):
    return ImageFont.truetype(str(MONO), size * SCALE)


def condensed(text, size, fill):
    """Render text in Arial Bold, then squash it horizontally into Arial Narrow's
    proportions. Drawing wide and scaling down also hides most of the aliasing.

    Every returned layer is the same height with the baseline on the same row, so
    words pasted at one y line up. Cropping each glyph to its own bbox instead
    would drop a period to the cap height of whatever sits beside it."""
    px = size * SCALE
    font = ImageFont.truetype(str(DISPLAY), px)
    layer = Image.new("RGBA", (int(font.getlength(text)) + 4 * px, 2 * px), (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((px, int(px * 1.4)), text, font=font, fill=fill, anchor="ls")

    # trim horizontally only -- the full height is what carries the shared baseline
    ink = layer.getbbox()
    layer = layer.crop((ink[0], 0, ink[2], layer.height))
    return layer.resize((round(layer.width * NARROW), layer.height), Image.LANCZOS)


def build():
    card = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(card)

    meta = mono(14)
    top_y = PAD

    # --- top meta row, mirroring .hero-index on the site ---
    draw.text((PAD, top_y), "Portfolio / 2026", font=meta, fill=MUTED)
    right = "Computer Science & Engineering  ·  UC Irvine"
    draw.text((W - PAD - draw.textlength(right, font=meta), top_y), right,
              font=meta, fill=MUTED)

    rule_y = top_y + 44 * SCALE
    draw.line([(PAD, rule_y), (W - PAD, rule_y)], fill=LINE_STRONG, width=SCALE)

    # --- bottom meta row, mirroring .hero-foot ---
    foot_rule = H - PAD - 46 * SCALE
    draw.line([(PAD, foot_rule), (W - PAD, foot_rule)], fill=LINE, width=SCALE)

    foot_y = foot_rule + 18 * SCALE
    draw.text((PAD, foot_y), "Electromagnetism / Embedded systems / Simulation",
              font=meta, fill=MUTED)
    site = "someheresy.github.io"
    draw.text((W - PAD - draw.textlength(site, font=meta), foot_y), site,
              font=meta, fill=INK)

    # --- nameplate: CALVIN left, YANG. right, pushed apart like the hero ---
    calvin = condensed("CALVIN", 128, INK)
    yang = condensed("YANG", 128, INK)
    period = condensed(".", 128, RUST)

    # centred in the space the two rules leave, so the card has no dead half
    name_y = rule_y + (foot_rule - rule_y - calvin.height) // 2 - 6 * SCALE
    card.paste(calvin, (PAD, name_y), calvin)
    tail_w = yang.width + period.width
    card.paste(yang, (W - PAD - tail_w, name_y), yang)
    card.paste(period, (W - PAD - period.width, name_y), period)

    # --- brand mark: the skewed rust stripes from .brand-mark in the nav ---
    # sits on the nameplate's baseline row, tucked under CALVIN
    mark_y = name_y + int(128 * SCALE * 1.4) + 30 * SCALE
    for i in range(7):
        x = PAD + i * 10 * SCALE
        draw.polygon([(x, mark_y + 22 * SCALE), (x + 4 * SCALE, mark_y + 22 * SCALE),
                      (x + 4 * SCALE + 11 * SCALE, mark_y), (x + 11 * SCALE, mark_y)],
                     fill=RUST)

    card = card.resize((W // SCALE, H // SCALE), Image.LANCZOS)
    card.save(TARGET, "PNG", optimize=True)
    print(f"wrote {TARGET.relative_to(ROOT).as_posix()}  {card.size[0]}x{card.size[1]}")


if __name__ == "__main__":
    build()
