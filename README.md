# Calvin Yang — Engineering Portfolio

Personal portfolio site for **Calvin Yang**, a Computer Science & Engineering student at UC Irvine working in embedded systems, electronics, firmware, CAD, and electromagnetic simulation.

**Live site → [someheresy.github.io](https://someheresy.github.io/)**

[![Live](https://img.shields.io/badge/live-someheresy.github.io-9ee5d1)](https://someheresy.github.io/)
![Built with](https://img.shields.io/badge/built%20with-HTML%20%C2%B7%20CSS%20%C2%B7%20JS-edba72)
![Dependencies](https://img.shields.io/badge/dependencies-none-b6a9ed)

---

## About

This is a hand-written static site — no framework, no build step, no package manager, and no third-party runtime dependencies. Everything ships as it is committed.

The site documents three engineering projects in depth, each with its own case-study page covering the problem, the approach, the evidence, and in one case the failures. It also renders my full résumé inline so visitors can read it without downloading anything.

---

## Highlights

**Multistage coilgun hero animation.** A Canvas 2D simulation of a three-stage coilgun charging and firing. The magnetic field lines are real streamlines, integrated at layout time from a two-monopole model of a finite solenoid — which is why the field reads as dense through the bore and looping outside it. Each coil's field visibly builds and collapses with its current, and the projectile exits at ~16 m/s, matching the measured result from the physical build. Playback runs at roughly 1/20 speed, since a real shot is over in milliseconds. Pointer movement drives parallax and thickens the field around the nearest coil.

**Interactive wiring schematic.** The Arduino case study uses a hand-drawn SVG schematic rather than a stock photo: 5 V and ground rails, labelled pin assignments, junction dots, and a wire hop where two nets cross without connecting. Hovering a component isolates the nets it sits on and dims the rest.

**Inline résumé.** The résumé is rendered as semantic HTML at full size and readable on any screen. The PDF download is a secondary, optional action rather than a prerequisite.

**On-page video.** Project videos play in place using a facade pattern — cards ship as thumbnails and the player iframe is only created on click, so six videos cost six images at page load instead of six embedded players.

**Calibrated type scale.** A single 16-step scale spans 12 px to 88 px across every page. Small steps move linearly, where a single pixel is perceptible; display steps move geometrically at roughly 1.2×.

---

## Project case studies

| Project | Period | Tools | Outcome | Source |
|---|---|---|---|---|
| [Electromagnetic Accelerator](https://someheresy.github.io/projects/electromagnetic-accelerator.html) | 2022 – present | ANSYS Maxwell 2D, Fusion 360, Arduino, 3D printing | ~16 m/s with a 54.63 g projectile | [Stage control](https://github.com/SomeHeresy/Electromagnetic-Accelerator) |
| [American Rocketry Challenge](https://someheresy.github.io/projects/american-rocketry-challenge.html) | Nov 2025 – Mar 2026 | OpenRocket | 23.2% simulation accuracy gain, official score 139.8 | — |
| [Arduino Sensor & Control System](https://someheresy.github.io/projects/arduino-sensor-control.html) | Jun – Jul 2026 | Arduino Uno R3, C/C++, I²C | Two sensor inputs on a 50 ms OLED refresh | [Firmware](https://github.com/SomeHeresy/2026-summer-projects/tree/main/Arduino/Advanced) |

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
├── portfolio.js        # Shared script — navigation, scroll reveal,
│                       # video embeds, schematic interaction
├── projects/           # Case-study pages
│   ├── electromagnetic-accelerator.html
│   ├── american-rocketry-challenge.html
│   └── arduino-sensor-control.html
├── assets/             # Project photography and simulation captures
├── resume/             # Résumé PDF
└── .nojekyll           # Opt out of Jekyll processing on GitHub Pages
```

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

Then open `http://localhost:8000`. In VS Code, the **Live Server** extension works too — right-click `index.html` and choose *Open with Live Server*.

> **Do not open `index.html` directly from the file system.** A `file://` page has no HTTP origin, so YouTube refuses to load the embedded project videos and the player reports a configuration error (error 153). Everything else renders, which makes the cause easy to misdiagnose. Always serve over HTTP.

---

## Deployment

The repository is a GitHub Pages user site, published from the root of the `main` branch. Any push to `main` redeploys automatically.

`.nojekyll` disables the default Jekyll build step. Without it, GitHub Pages would silently drop any directory whose name begins with an underscore and would try to interpret `{{ … }}` and `{% … %}` as Liquid template syntax. Since this site is hand-written and needs no preprocessing, opting out removes a class of confusing build failures.

---

## Accessibility and performance

- Honours `prefers-reduced-motion` — the hero animation renders a single static frame with no animation loop, and transitions are disabled site-wide
- Skip link, semantic landmarks, visible focus states, and descriptive `aria-label` text on canvas and SVG graphics
- Hero animation adapts quality to the device, pauses when off-screen or backgrounded, and caps device pixel ratio
- Diagrams pan horizontally on small screens rather than shrinking to an unreadable size
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
