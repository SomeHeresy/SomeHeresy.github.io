#!/usr/bin/env python3
"""Convert the site's photography to WebP at two display sizes.

Photographs arrive as PNG/JPEG straight from a phone or a screen capture,
which is how a single bench photo reached 3 MB. For every source image this
writes two WebP files next to it:

    name.webp       long edge capped at 1600 px (desktop, 2x displays)
    name-800.webp   long edge capped at 800 px  (phones, card thumbnails)

The HTML references both through srcset, so a phone downloads the small one.
The originals stay in the repo as the archival copies.

It also renders the Open Graph share cards into assets/social/. Those stay
JPEG at 1200x630: link crawlers are far less consistent about WebP than
browsers are, and a share card that fails to render costs more than the bytes
it saves.

This is a maintenance tool, not a build step. Run it after adding photography:

    python tools/optimize_images.py            # convert anything new
    python tools/optimize_images.py --force    # redo everything
    python tools/optimize_images.py --check    # exit 1 if any output is missing

Screen captures under the size floor (the simulation plots) are already small
and keep their crisp PNG edges, so they are skipped rather than re-encoded.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - dependency hint
    sys.exit("This tool needs Pillow. Install it with: pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

# Long edges, in pixels. The widest an image is ever displayed is the case-study
# hero at ~1300 CSS px; 1600 covers that and a 2x card. 800 covers phones.
MAX_EDGE = 1600
SMALL_EDGE = 800
QUALITY = 82
# Below this, re-encoding buys nothing and can cost sharpness on diagrams.
SIZE_FLOOR = 120 * 1024

SOURCE_SUFFIXES = {".png", ".jpg", ".jpeg"}

# Rotated copies, written straight to WebP. The rocket was photographed from
# above lying on its box, so turning it 90 degrees loses nothing and lets the
# whole vehicle fill a landscape frame instead of a thin slice of it.
# output name (under assets/, no suffix) -> (source, degrees counter-clockwise)
ROTATED = {
    "arc/rocket-body-landscape": ("arc/rocket-body.png", 90),
}

# Open Graph share cards. 1200x630 is the size every consumer crops toward.
# Values are paths under assets/, or a ROTATED name.
SOCIAL_DIR = ASSETS / "social"
SOCIAL_SIZE = (1200, 630)
SOCIAL_MATTE = (241, 240, 234)  # --bg (paper), so a letterboxed card still looks designed.
SOCIAL_CARDS = {
    "home": "portfolio-social-preview.png",
    "electromagnetic-accelerator": "coilgun/version3/v3-main-setup.png",
    "american-rocketry-challenge": "arc/rocket-body-landscape",
    "arduino-sensor-control": "arduino/full-setup.jpg",
    "coilgun-simulator": "coilgun-simulator/velocity-vs-start-position.png",
}


def load(relative: str) -> Image.Image:
    """Open an image by its path under assets/, or by a ROTATED name."""
    if relative in ROTATED:
        source, degrees = ROTATED[relative]
        with Image.open(ASSETS / source) as image:
            return image.convert("RGB").rotate(degrees, expand=True)
    with Image.open(ASSETS / relative) as image:
        return image.convert("RGB")


def social_card(relative: str, target: Path) -> None:
    """Cover-crop a landscape source; letterbox a portrait one onto the site's
    background rather than slicing a tall subject in half."""
    image = load(relative)
    want = SOCIAL_SIZE[0] / SOCIAL_SIZE[1]
    have = image.width / image.height

    if have >= want * 0.75:
        scale = max(SOCIAL_SIZE[0] / image.width, SOCIAL_SIZE[1] / image.height)
        resized = image.resize(
            (round(image.width * scale), round(image.height * scale)), Image.LANCZOS
        )
        left = (resized.width - SOCIAL_SIZE[0]) // 2
        top = (resized.height - SOCIAL_SIZE[1]) // 2
        card = resized.crop((left, top, left + SOCIAL_SIZE[0], top + SOCIAL_SIZE[1]))
    else:
        card = Image.new("RGB", SOCIAL_SIZE, SOCIAL_MATTE)
        image.thumbnail((SOCIAL_SIZE[0], SOCIAL_SIZE[1] - 40), Image.LANCZOS)
        card.paste(
            image, ((SOCIAL_SIZE[0] - image.width) // 2, (SOCIAL_SIZE[1] - image.height) // 2)
        )

    target.parent.mkdir(parents=True, exist_ok=True)
    card.save(target, "JPEG", quality=86, optimize=True, progressive=True)


def build_social(force: bool) -> None:
    print("\nShare cards (assets/social/):")
    for slug, relative in SOCIAL_CARDS.items():
        target = SOCIAL_DIR / f"{slug}.jpg"
        if target.exists() and not force:
            print(f"  skip  {target.relative_to(ROOT).as_posix()} (already built)")
            continue
        social_card(relative, target)
        print(
            f"  ok    {target.relative_to(ROOT).as_posix()}  "
            f"{target.stat().st_size / 1024:.0f} KB"
        )


def sources() -> list[str]:
    """Every photograph above the size floor, as paths under assets/, plus the
    ROTATED copies. Share-card sources are included: the pages use their WebP
    versions too. The home card source is only ever a share card."""
    home_card = ASSETS / SOCIAL_CARDS["home"]
    photos = [
        path.relative_to(ASSETS).as_posix()
        for path in sorted(ASSETS.rglob("*"))
        if path.is_file()
        and path.suffix.lower() in SOURCE_SUFFIXES
        and SOCIAL_DIR not in path.parents
        and path != home_card
        and path.stat().st_size >= SIZE_FLOOR
    ]
    return photos + list(ROTATED)


def outputs(relative: str) -> list[tuple[Path, int]]:
    """(target, long-edge cap) for each WebP a source should have. The small
    copy is skipped when the image is already no larger than it."""
    stem = ASSETS / (relative if relative in ROTATED else str(Path(relative).with_suffix("")))
    image = load(relative)
    wanted = [(stem.with_name(stem.name + ".webp"), MAX_EDGE)]
    if max(image.size) > SMALL_EDGE:
        wanted.append((stem.with_name(f"{stem.name}-{SMALL_EDGE}.webp"), SMALL_EDGE))
    return wanted


def convert(relative: str, force: bool) -> list[tuple[Path, int]]:
    written = []
    for target, edge in outputs(relative):
        if target.exists() and not force:
            continue
        image = load(relative)
        if max(image.size) > edge:
            image.thumbnail((edge, edge), Image.LANCZOS)
        image.save(target, "WEBP", quality=QUALITY, method=6)
        written.append((target, target.stat().st_size))
    return written


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="re-encode existing .webp files")
    parser.add_argument("--check", action="store_true", help="report missing outputs and exit non-zero")
    args = parser.parse_args()

    candidates = sources()

    if args.check:
        missing = [t for rel in candidates for t, _ in outputs(rel) if not t.exists()]
        missing += [
            SOCIAL_DIR / f"{slug}.jpg"
            for slug in SOCIAL_CARDS
            if not (SOCIAL_DIR / f"{slug}.jpg").exists()
        ]
        for path in missing:
            print(f"missing: {path.relative_to(ROOT).as_posix()}")
        if missing:
            print(f"\n{len(missing)} file(s) missing. Run: python tools/optimize_images.py")
            return 1
        print(
            f"All {len(candidates)} photo(s) converted; "
            f"all {len(SOCIAL_CARDS)} share card(s) built."
        )
        return 0

    for relative in candidates:
        written = convert(relative, args.force)
        if not written:
            print(f"  skip  {relative} (already converted)")
            continue
        sizes = ", ".join(f"{t.name} {b / 1024:.0f} KB" for t, b in written)
        print(f"  ok    {relative} -> {sizes}")

    build_social(args.force)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
