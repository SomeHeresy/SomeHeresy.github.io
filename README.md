# Calvin Yang — Engineering Portfolio

Personal portfolio site for **Calvin Yang**, a Computer Science & Engineering student at UC Irvine working in embedded systems, electronics, firmware, CAD, and electromagnetic simulation.

**Live site → [someheresy.github.io](https://someheresy.github.io/)**

[![Live](https://img.shields.io/badge/live-someheresy.github.io-9ee5d1)](https://someheresy.github.io/)
![Built with](https://img.shields.io/badge/built%20with-HTML%20%C2%B7%20CSS%20%C2%B7%20JS-edba72)
![Dependencies](https://img.shields.io/badge/dependencies-none-b6a9ed)

---

## About

This is a hand-written static site — no framework, no build step, no package manager, and no third-party runtime dependencies. Everything ships as it is committed.

The site documents three engineering projects in depth, each with its own case-study page, plus the early-stage Python coilgun simulator. It also renders my full résumé inline so visitors can read it without downloading anything.

---

## Highlights

**Engineering field notes.** A cool paper background, copper accents, oversized nameplate, and open project spreads built around actual workbench photography. The visual identity extends to all three case studies, the inline résumé, and mobile layouts. Personal copy draws on Calvin's interests in science fiction, electromagnetism, tennis, and video creation.

**Compact two-stage field animation.** A small visual accent uses Biot–Savart quadrature of circular turns to draw axisymmetric magnetic flux contours and an accelerating projectile. The top-right button starts looping. Clicking again finishes the current run before stopping; clicking while it is finishing resumes looping. There is no autoplay, scrubber, speed selector, probe, or expanded view. Playback suspends off-screen and in background tabs. The dimensionless air-core model is illustrative rather than a prediction of real hardware; the separate Python simulator remains early work.

**Motion and navigation.** Scroll-triggered, staggered reveals, gentle image drift, pointer-responsive project media, click feedback, and coordinated hover states retain the field-notes identity. On supporting browsers, native cross-document view transitions carry the selected project's image and title into its case study (and back). Other browsers get a short fade/slide with ordinary navigation. Modified clicks, downloads, hash navigation, browser history, no-JS reading, keyboard controls and reduced motion are preserved.

**Coilgun simulator progress.** A separate project block identifies the Python prototype as early work as of September 2026. RK4, RC decay validation, and an RLC energy check are implemented; force/motion, timing, CLI, and hardware comparison remain future work. The ~16 m/s result elsewhere on the page belongs to the measured physical hardware.

**Interactive wiring schematic.** The Arduino case study uses a hand-drawn SVG schematic rather than a stock photo: 5 V and ground rails, labelled pin assignments, junction dots, and a wire hop where two nets cross without connecting. Hovering a component isolates the nets it sits on and dims the rest.

**Inline résumé.** The résumé is rendered as semantic HTML at full size and readable on any screen. The PDF download is a secondary, optional action rather than a prerequisite.

**On-page video.** Project videos play in place using a facade pattern — cards ship as thumbnails and the player iframe is only created on click, so six videos cost six images at page load instead of six embedded players.

**Accessible navigation.** The mobile menu supports Escape to close and restores focus. Main content stays visible without JavaScript. Page anchors, case-study links, the PDF, on-page video, and interactive wiring diagrams remain available.

---

## Project case studies

| Project | Period | Tools | Outcome | Source |
|---|---|---|---|---|
| [Electromagnetic Accelerator](https://someheresy.github.io/projects/electromagnetic-accelerator.html) | 2022 – present | ANSYS Maxwell 2D, Fusion 360, Arduino, 3D printing | ~16 m/s with a 54.63 g projectile | [Stage control](https://github.com/SomeHeresy/Electromagnetic-Accelerator) |
| [American Rocketry Challenge](https://someheresy.github.io/projects/american-rocketry-challenge.html) | Nov 2025 – Mar 2026 | OpenRocket | 23.2% simulation accuracy gain, official score 139.8 | — |
| [Arduino Sensor & Control System](https://someheresy.github.io/projects/arduino-sensor-control.html) | Jun – Jul 2026 | Arduino Uno R3, C/C++, I²C | Two sensor inputs on a 100 ms OLED refresh | [Firmware](https://github.com/SomeHeresy/2026-summer-projects/tree/main/Arduino/Advanced) |

The coil gun case study is organised by physical build — V1 (2022, single stage), V2 (two-stage preparation and sensing experiments), V3 (functional two-stage, simulation-informed timing) — with photographs, simulation captures, and video from each.

---

## Tech stack

| Layer | Choice |
|---|---|
| Markup | Semantic HTML5 |
| Styling | Hand-written CSS with custom properties, fluid `clamp()` type, CSS Grid and Flexbox |
| Scripting | Vanilla ES2020+ JavaScript, no libraries |
| Graphics | Canvas 2D for the hero animation, inline SVG for diagrams |
| Hosting | GitHub Pages |

---

## Repository structure

```
.
├── index.html          # Home: hero animation, projects, capabilities,
│                       # experience, inline résumé, about, contact
├── portfolio.css       # Shared stylesheet — design tokens, type scale,
│                       # components, interaction layer
├── field-notes.css     # Visual identity, project spreads, résumé, responsive layout
├── coil-field-model.js # Pure numerical model and flux-contour extraction
├── coil-animation.js   # Compact field visualization and finish-then-stop looping
├── motion.css          # Scroll, hover, click and page transition styles
├── motion.js           # Progressive interaction and scroll observers
├── page-transitions.js # Shared-element page navigation and fallback
├── portfolio.js        # Shared script — navigation, scroll reveal,
│                       # video embeds, schematic interaction
├── 404.html            # Not-found page, in the same visual identity
├── projects/           # Case-study pages
│   ├── electromagnetic-accelerator.html
│   ├── american-rocketry-challenge.html
│   └── arduino-sensor-control.html
├── assets/             # Project photography and simulation captures
│   └── social/         # Generated 1200x630 Open Graph share cards
├── resume/
│   ├── CalvinYangResume.pdf  # Stable path — the site always links here
│   └── resume.json           # Parsed résumé; source for the inline HTML
├── tools/
│   ├── sync_resume.py     # Regenerates the inline résumé from the PDF
│   └── optimize_images.py # Photography -> WebP; builds the share cards
├── favicon.svg         # Brand mark, matching .brand-mark in the nav
├── apple-touch-icon.png
├── robots.txt
├── sitemap.xml
└── .nojekyll           # Opt out of Jekyll processing on GitHub Pages
```

---

## Updating the résumé

The résumé lives on the page twice — as the PDF in `resume/` and as semantic
HTML inside `index.html` — so the two can drift apart. `tools/sync_resume.py`
removes that risk by treating the PDF as the input and the HTML as output:

```bash
python tools/sync_resume.py ~/Downloads/NewResume.pdf
```

That copies the PDF to `resume/CalvinYangResume.pdf` (the stable path every
link on the site points at, so no href ever changes), parses it into
`resume/resume.json`, and rewrites the block in `index.html` between the
`RESUME:AUTO` markers. Read the diff, then commit.

`resume.json` is the editable layer. If the parser mis-reads something — or
the site should word it differently from the PDF, as it does with the contact
line — fix the JSON and re-render without re-importing:

```bash
python tools/sync_resume.py
```

Never hand-edit the HTML between the markers; the next run overwrites it.
`python tools/sync_resume.py --check` exits non-zero when the page has fallen
behind `resume.json`, which makes it usable as a pre-commit or CI check.

The script needs `pypdf` (`pip install pypdf`), and only for the parse step.
It is a maintenance tool, not a build step: the site itself still ships
exactly as committed, with no install and no runtime dependencies.

---

## Images

Photography ships as WebP capped at a 1600 px long edge. The originals stay in
the repo as the archival copies; the HTML points at the `.webp` beside them.
`tools/optimize_images.py` does the conversion and also renders the Open Graph
share cards in `assets/social/`, which stay JPEG at 1200x630 because link
crawlers are much less consistent about WebP than browsers are.

```bash
python tools/optimize_images.py
```

Run it after adding new photography; it skips anything already converted.
`--force` re-encodes everything, and `--check` exits non-zero when a source
image has no `.webp` companion, so it works as a pre-commit or CI check. The
script needs Pillow (`pip install Pillow`); like `sync_resume.py`, it is a
maintenance tool, not a build step.

Simulation screen captures under ~120 KB are left as PNG — they are already
small, and PNG keeps their edges crisp.

---

## Running locally

The site is fully static, so no install or build step is required. It does need to be served over HTTP, though — see the note below.

With Python:

```bash
python -m http.server 8000
```

With Node:

```bash
npx serve .
```

For the Python command, open `http://localhost:8000`; for `npx serve`, use the URL it prints. In VS Code, the **Live Server** extension works too — right-click `index.html` and choose *Open with Live Server*.

> **Do not open `index.html` directly from the file system.** A `file://` page has no HTTP origin, so YouTube refuses to load the embedded project videos and the player reports a configuration error (error 153). Everything else renders, which makes the cause easy to misdiagnose. Always serve over HTTP.

---

## Deployment

The repository is a GitHub Pages user site, published from the root of the `main` branch. Any push to `main` redeploys automatically.

`.nojekyll` disables the default Jekyll build step. Without it, GitHub Pages would silently drop any directory whose name begins with an underscore and would try to interpret `{{ … }}` and `{% … %}` as Liquid template syntax. Since this site is hand-written and needs no preprocessing, opting out removes a class of confusing build failures.

---

## Numerical checks

Run `node tools/test_field_model.cjs` to check field symmetry, approximate axisymmetric divergence, flux-contour tangency, interpolation, stage acceleration, and current cutoff. These checks validate the illustrative model's internal consistency; they do not establish agreement with measured coilgun hardware.

---

## Accessibility and performance

- Honours `prefers-reduced-motion` — the hero animation renders a single static frame with no animation loop, and transitions are disabled site-wide
- Skip link, semantic landmarks, visible focus states, and descriptive `aria-label` text on canvas and SVG graphics
- Field animation starts only after a click, completes its current run when looping is switched off, and suspends off-screen or in a background tab
- Diagrams pan horizontally on small screens rather than shrinking to an unreadable size
- Photography ships as WebP with intrinsic `width`/`height` on every image, so pages do not reflow as photos arrive
- No external fonts, analytics, trackers, or third-party scripts

---

## Contact

- **Email** — [calviny7@uci.edu](mailto:calviny7@uci.edu)
- **LinkedIn** — [linkedin.com/in/calvinyang07](https://www.linkedin.com/in/calvinyang07/)
- **GitHub** — [@SomeHeresy](https://github.com/SomeHeresy)
- **YouTube** — [@SomeHeresyGaming](https://www.youtube.com/@SomeHeresyGaming)

Open to engineering internships, UCI student teams, research opportunities, and projects involving embedded systems, electronics, firmware, or simulation.

---

## Usage

The source is public so others can read how the site is built, and you are welcome to learn from it. Project write-ups, photography, and résumé content are personal to me — please do not republish them as your own.
