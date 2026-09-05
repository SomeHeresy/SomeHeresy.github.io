#!/usr/bin/env python3
"""Convert the site's photography to WebP at a sensible display width.

The site ships photographs that were saved as PNG straight from a phone or a
screen capture, which is how a single bench photo reached 3 MB. WebP at a
1600 px cap is visually indistinguishable at the sizes this site actually
renders images and costs roughly a tenth of the bytes.

It also renders the Open Graph share cards into assets/social/. Those stay
JPEG at 1200x630: link crawlers are far less consistent about WebP than
browsers are, and a share card that fails to render costs more than the bytes
it saves.

This is a maintenance tool, not a build step. It writes .webp files next to
the originals; the originals stay in the repo as the archival copies, and the
HTML points at the .webp. Run it after adding new photography:

    python tools/optimize_images.py            # convert anything new
    python tools/optimize_images.py --force    # redo everything
    python tools/optimize_images.py --check    # exit 1 if a .webp is missing

Screenshots of simulation output (sim main.png, sim circuit.png) are already
small and keep their crisp PNG edges, so anything under the size floor is
skipped rather than re-encoded.
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

# Long edge, in pixels. The widest an image is ever displayed is the full-bleed
# case-study hero at ~1400 CSS px; 1600 leaves room for a 2x crop without
# shipping a 4000 px phone photo.
MAX_EDGE = 1600
QUALITY = 82
# Below this, re-encoding buys nothing and can cost sharpness on diagrams.
SIZE_FLOOR = 120 * 1024

SOURCE_SUFFIXES = {".png", ".jpg", ".jpeg"}

# Open Graph share cards. 1200x630 is the size every consumer crops toward.
SOCIAL_DIR = ASSETS / "social"
SOCIAL_SIZE = (1200, 630)
SOCIAL_MATTE = (233, 234, 228)  # --bg, so a letterboxed card still looks designed.
SOCIAL_CARDS = {
    "home": "portfolio-social-preview.png",
    "electromagnetic-accelerator": "coilgun/version3/v3 main setup.PNG",
    "american-rocketry-challenge": "ARC Project/rocket body.png",
    "arduino-sensor-control": "arduino/full-setup.jpg",
}


def social_card(source: Path, target: Path) -> None:
    """Cover-crop a landscape source; letterbox a portrait one onto the site's
    background rather than slicing a tall subject in half."""
    with Image.open(source) as image:
        image = image.convert("RGB")
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
            inner = image.copy()
            inner.thumbnail((SOCIAL_SIZE[0], SOCIAL_SIZE[1] - 40), Image.LANCZOS)
            card.paste(
                inner,
                ((SOCIAL_SIZE[0] - inner.width) // 2, (SOCIAL_SIZE[1] - inner.height) // 2),
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
        social_card(ASSETS / relative, target)
        print(
            f"  ok    {target.relative_to(ROOT).as_posix()}  "
            f"{target.stat().st_size / 1024:.0f} KB"
        )


def sources() -> list[Path]:
    """Site photography only. The share-card sources and their rendered output
    are handled by build_social(); a .webp of either would go unreferenced."""
    skip = {ASSETS / relative for relative in SOCIAL_CARDS.values()}
    found = [
        path
        for path in sorted(ASSETS.rglob("*"))
        if path.is_file()
        and path.suffix.lower() in SOURCE_SUFFIXES
        and SOCIAL_DIR not in path.parents
        and path not in skip
    ]
    return [path for path in found if path.stat().st_size >= SIZE_FLOOR]


def convert(path: Path, force: bool) -> tuple[Path, int, int] | None:
    target = path.with_suffix(".webp")
    if target.exists() and not force:
        return None

    with Image.open(path) as image:
        image = image.convert("RGB")
        if max(image.size) > MAX_EDGE:
            image.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
        image.save(target, "WEBP", quality=QUALITY, method=6)

    return target, path.stat().st_size, target.stat().st_size


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="re-encode existing .webp files")
    parser.add_argument("--check", action="store_true", help="report missing .webp files and exit non-zero")
    args = parser.parse_args()

    candidates = sources()
    if not candidates:
        print("No source images above the size floor.")
        return 0

    if args.check:
        missing = [
            p.with_suffix(".webp") for p in candidates if not p.with_suffix(".webp").exists()
        ]
        missing += [
            SOCIAL_DIR / f"{slug}.jpg"
            for slug in SOCIAL_CARDS
            if not (SOCIAL_DIR / f"{slug}.jpg").exists()
        ]
        for path in missing:
            print(f"missing: {path.relative_to(ROOT).as_posix()}")
        if missing:
            print(f"\n{len(missing)} image(s) missing. Run: python tools/optimize_images.py")
            return 1
        print(
            f"All {len(candidates)} image(s) converted; "
            f"all {len(SOCIAL_CARDS)} share card(s) built."
        )
        return 0

    before = after = 0
    converted = 0
    for path in candidates:
        result = convert(path, args.force)
        if result is None:
            print(f"  skip  {path.relative_to(ROOT).as_posix()} (already converted)")
            continue
        target, src_bytes, out_bytes = result
        before += src_bytes
        after += out_bytes
        converted += 1
        print(
            f"  ok    {target.relative_to(ROOT).as_posix()}  "
            f"{src_bytes / 1024:.0f} KB -> {out_bytes / 1024:.0f} KB  "
            f"({100 - out_bytes / src_bytes * 100:.0f}% smaller)"
        )

    if converted:
        print(
            f"\n{converted} image(s): {before / 1024 / 1024:.1f} MB -> {after / 1024 / 1024:.1f} MB "
            f"({100 - after / before * 100:.0f}% smaller)"
        )

    build_social(args.force)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
