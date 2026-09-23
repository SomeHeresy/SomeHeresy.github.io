#!/usr/bin/env python3
"""
Page chrome - keeps the shared parts of every page in step.

Every HTML page repeats the same <head> tags, header, and footer, and each
case study carries its project number and a "next project" link. Copying
those by hand is how the pages drifted apart before. This script makes
tools/site.json the single source and rewrites the marked blocks:

    <!-- BUILD:head -->        meta tags, fonts, stylesheet, head script
    <!-- BUILD:header -->      skip link, scroll progress, site header
    <!-- BUILD:footer -->      title-block footer and deferred scripts
    <!-- BUILD:kicker -->      case studies: back link, "Project 02 / 04"
    <!-- BUILD:next -->        case studies: link to the next project

Everything between a marker and its /BUILD: partner is replaced; everything
outside the markers is left exactly as written. It also regenerates
sitemap.xml, and stamps each CSS/JS URL with a short content hash so a
browser never pairs new HTML with a stale stylesheet.

    python tools/build_pages.py            # rewrite pages + sitemap
    python tools/build_pages.py --check    # exit 1 if anything is stale

Like the other tools, this is maintenance, not a build step: the committed
HTML is what GitHub Pages serves.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = json.loads((ROOT / "tools" / "site.json").read_text(encoding="utf-8"))

ASSETS = {
    "css": "css/site.css",
    "head": "js/head.js",
    "site": "js/site.js",
}
FONT_PRELOADS = [
    "fonts/unbounded-800.woff2",
    "fonts/geist-variable.woff2",
    "fonts/martian-mono-400.woff2",
]

BLOCK = re.compile(
    r"(?P<indent>[ \t]*)<!-- BUILD:(?P<name>[\w-]+) -->.*?<!-- /BUILD:(?P=name) -->",
    re.S,
)

def esc(text: str) -> str:
    """Escape for text and double-quoted attributes. Apostrophes stay as-is."""
    return html.escape(text, quote=False).replace('"', "&quot;")


def asset_hash(relative: str) -> str:
    # Hash with LF line endings so a Windows checkout (core.autocrlf) and the
    # Linux CI runner agree on the same file.
    data = (ROOT / relative).read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha1(data).hexdigest()[:8]


def versioned(base: str, relative: str) -> str:
    return f"{base}{relative}?v={asset_hash(relative)}"


def external(href: str, text: str, cls: str = "") -> str:
    """A link that leaves the site: opens in a new tab and says so."""
    attr = f' class="{cls}"' if cls else ""
    return (
        f'<a{attr} href="{esc(href)}" target="_blank" rel="noopener noreferrer">{text}'
        f' <span class="ext" aria-hidden="true">↗</span>'
        f'<span class="sr-only"> (opens in a new tab)</span></a>'
    )


# --------------------------------------------------------------------------
# Pages
# --------------------------------------------------------------------------

def pages() -> list[dict]:
    """Every page the script manages, with what the renderers need to know."""
    site = SITE["site"]
    projects = SITE["projects"]
    total = 1 + len(projects)
    out = []

    home = dict(SITE["pages"]["index.html"])
    home.update(path="index.html", base="", home="#top", sheet=f"1 / {total}")
    out.append(home)

    for i, project in enumerate(projects):
        page = dict(project)
        page.update(
            path=f"projects/{project['slug']}.html",
            base="../",
            home="../",
            type="article",
            title=f"{project['title']} | {site['name']}",
            short_title=project["title"],
            og_title=f"{project['title']} | {site['name']}",
            number=f"{i + 1:02d}",
            total=f"{len(projects):02d}",
            next=projects[(i + 1) % len(projects)],
            next_number=f"{(i + 1) % len(projects) + 1:02d}",
            sheet=f"{i + 2} / {total}",
        )
        out.append(page)

    missing = dict(SITE["pages"]["404.html"])
    # GitHub Pages serves 404.html at whatever depth was requested,
    # so every path on it is absolute.
    missing.update(path="404.html", base="/", home="/", sheet="—")
    out.append(missing)
    return out


# --------------------------------------------------------------------------
# Renderers
# --------------------------------------------------------------------------

def render_head(page: dict) -> str:
    site = SITE["site"]
    base = page["base"]
    url = site["url"] + ("" if page["path"] == "index.html" else page["path"])
    colors = site["theme_colors"]
    lines = [
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        f"<title>{esc(page['title'])}</title>",
        f'<meta name="description" content="{esc(page["description"])}">',
    ]
    if page.get("noindex"):
        lines.append('<meta name="robots" content="noindex">')
    lines += [
        '<meta name="color-scheme" content="light dark">',
        f'<meta name="theme-color" content="{colors["light"]}" media="(prefers-color-scheme: light)">',
        f'<meta name="theme-color" content="{colors["dark"]}" media="(prefers-color-scheme: dark)">',
    ]
    if not page.get("noindex"):
        lines += [
            f'<link rel="canonical" href="{esc(url)}">',
            f'<meta property="og:type" content="{page.get("type", "website")}">',
            f'<meta property="og:site_name" content="{esc(site["name"])}">',
            f'<meta property="og:title" content="{esc(page["og_title"])}">',
            f'<meta property="og:description" content="{esc(page["og_description"])}">',
            f'<meta property="og:url" content="{esc(url)}">',
            f'<meta property="og:image" content="{esc(site["url"] + page["image"])}">',
            '<meta property="og:image:width" content="1200">',
            '<meta property="og:image:height" content="630">',
            f'<meta property="og:image:alt" content="{esc(page["image_alt"])}">',
            '<meta name="twitter:card" content="summary_large_image">',
        ]
    lines += [
        f'<link rel="icon" href="{base}favicon.svg" type="image/svg+xml">',
        f'<link rel="apple-touch-icon" href="{base}apple-touch-icon.png">',
    ]
    lines += [
        f'<link rel="preload" href="{base}{font}" as="font" type="font/woff2" crossorigin>'
        for font in FONT_PRELOADS
    ]
    lines += [
        f'<link rel="stylesheet" href="{versioned(base, ASSETS["css"])}">',
        f'<script src="{versioned(base, ASSETS["head"])}"></script>',
    ]
    if page.get("person_schema"):
        person = site["person"]
        schema = {
            "@context": "https://schema.org",
            "@type": "Person",
            "name": site["name"],
            "url": site["url"],
            "image": site["url"] + page["image"],
            "email": "mailto:" + site["email"],
            "jobTitle": person["jobTitle"],
            "description": person["description"],
            "affiliation": {"@type": "CollegeOrUniversity", "name": person["affiliation"]},
            "knowsAbout": person["knowsAbout"],
            "sameAs": person["sameAs"],
        }
        body = json.dumps(schema, indent=2, ensure_ascii=False)
        lines.append('<script type="application/ld+json">\n' + body + "\n</script>")
    return "\n".join(lines)


# Three skewed field lines; same geometry as favicon.svg and the touch icon.
BRAND_MARK = (
    '<svg class="brand__mark" viewBox="4 1 24 30" aria-hidden="true" focusable="false">'
    '<g fill="currentColor"><polygon points="7,11 11,9.22 11,27.22 7,29"/>'
    '<polygon points="14,7.89 18,6.11 18,24.11 14,25.89"/>'
    '<polygon points="21,4.77 25,3 25,21 21,22.77"/></g></svg>'
)
ICON_MOON = (
    '<svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" '
    'stroke="currentColor" stroke-width="1.6"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>'
)
ICON_SUN = (
    '<svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" '
    'stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4.2"/>'
    '<path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6'
    'M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>'
)


def render_header(page: dict) -> str:
    site = SITE["site"]
    nav_base = "" if page["path"] == "index.html" else page["home"]
    links = "\n".join(
        f'        <li><a class="nav__link" href="{nav_base}#{item["id"]}">{esc(item["label"])}</a></li>'
        for item in site["nav"]
    )
    return f"""<a class="skip-link" href="#main">Skip to content</a>
<div class="progress" aria-hidden="true"></div>
<header class="site-header">
  <div class="wrap site-header__inner">
    <a class="brand" href="{page['home']}" aria-label="{esc(site['name'])}, home">{BRAND_MARK}<span class="brand__name">{esc(site['name'])}</span></a>
    <nav class="nav" id="site-nav" aria-label="Primary">
      <ul class="nav__list">
{links}
      </ul>
    </nav>
    <button class="icon-btn theme-toggle" type="button" data-theme-toggle aria-label="Switch theme">{ICON_MOON}{ICON_SUN}</button>
    <button class="icon-btn menu-btn" type="button" data-menu-toggle aria-expanded="false" aria-controls="site-nav"><span data-menu-label>Menu</span></button>
  </div>
</header>"""


def render_footer(page: dict) -> str:
    site = SITE["site"]
    base = page["base"]
    repo = site["repo"]
    repo_text = repo.replace("https://", "")
    scripts = [f'<script src="{versioned(base, ASSETS["site"])}" defer></script>']
    scripts += [
        f'<script src="{versioned(base, script)}" defer></script>'
        for script in page.get("scripts", [])
    ]
    return f"""<footer class="site-footer">
  <div class="wrap">
    <dl class="title-block">
      <div><dt>Title</dt><dd>{esc(page['short_title'])}</dd></div>
      <div><dt>Drawn by</dt><dd>{esc(site['name'])}</dd></div>
      <div><dt>Sheet</dt><dd>{page['sheet']}</dd></div>
      <div><dt>Rev</dt><dd>{esc(site['revision'])}</dd></div>
      <div class="title-block__wide"><dt>Source</dt><dd>{external(repo, esc(repo_text))}</dd></div>
    </dl>
    <p class="site-footer__note label">© <span data-year>2026</span> {esc(site['name'])} · {esc(site['location'])}</p>
  </div>
</footer>
""" + "\n".join(scripts)


def render_kicker(page: dict) -> str:
    return f"""<div class="crumbs label">
  <a href="../#work"><span aria-hidden="true">←</span> All projects</a>
  <span>Project {page['number']} / {page['total']}</span>
</div>
<p class="label label--accent cs-kicker">{esc(page['category'])}</p>"""


def render_next(page: dict) -> str:
    nxt = page["next"]
    return f"""<a class="next-project" href="{nxt['slug']}.html">
  <span>
    <span class="label">Next · Project {page['next_number']}</span>
    <span class="next-project__title">{esc(nxt['title'])}</span>
  </span>
  <span class="next-project__arrow" aria-hidden="true">→</span>
</a>"""


RENDERERS = {
    "head": render_head,
    "header": render_header,
    "footer": render_footer,
    "kicker": render_kicker,
    "next": render_next,
}


def render_sitemap() -> str:
    site = SITE["site"]
    urls = [site["url"]] + [f"{site['url']}projects/{p['slug']}.html" for p in SITE["projects"]]
    body = "\n".join(f"  <url><loc>{esc(u)}</loc></url>" for u in urls)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body}\n</urlset>\n"
    )


# --------------------------------------------------------------------------
# Splicing
# --------------------------------------------------------------------------

def rebuild(text: str, page: dict, path: Path) -> str:
    def replace(match: re.Match) -> str:
        name, indent = match["name"], match["indent"]
        if name not in RENDERERS:
            sys.exit(f"error: unknown block BUILD:{name} in {path.relative_to(ROOT)}")
        rendered = RENDERERS[name](page)
        body = "\n".join((indent + line) if line else line for line in rendered.split("\n"))
        return f"{indent}<!-- BUILD:{name} -->\n{body}\n{indent}<!-- /BUILD:{name} -->"

    return BLOCK.sub(replace, text)


def main() -> int:
    ap = argparse.ArgumentParser(description="Rewrite the generated blocks in every page.")
    ap.add_argument("--check", action="store_true", help="exit 1 if a page or the sitemap is stale")
    args = ap.parse_args()

    stale = []
    targets = [(ROOT / page["path"], page) for page in pages()]
    for path, page in targets:
        current = path.read_text(encoding="utf-8")
        updated = rebuild(current, page, path)
        if current != updated:
            stale.append(path)
            if not args.check:
                with open(path, "w", encoding="utf-8", newline="\n") as fh:
                    fh.write(updated)

    sitemap = ROOT / "sitemap.xml"
    wanted = render_sitemap()
    if not sitemap.exists() or sitemap.read_text(encoding="utf-8") != wanted:
        stale.append(sitemap)
        if not args.check:
            with open(sitemap, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(wanted)

    names = ", ".join(p.relative_to(ROOT).as_posix() for p in stale)
    if args.check:
        if stale:
            print(f"out of date: {names} - run: python tools/build_pages.py")
            return 1
        print(f"all {len(targets)} pages and the sitemap are up to date")
        return 0
    print(f"updated: {names}" if stale else "everything already up to date")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
