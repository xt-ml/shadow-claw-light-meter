# AGENTS.md — ShadowClaw Light Meter Workbench

> Guidance for AI agents working on the TinyDuino/BLE112/KY-018 light-meter workbench.

## Project Snapshot

Static site built with [ShadowClaw](https://xt-ml.github.io/shadow-claw/). The workbench documents a relative-light sensor; it does not provide device firmware or claim calibrated lux measurements.

## Layout

- `pages/main/index.html` — home page
- `pages/main/~/content/NN-*.md` — numbered content pages; the filename slug becomes the URL (`/main/<slug>`)
- `pages/main/MEMORY.md`, `pages/main/RESET.md` — agent memory and reset prompt
- `pages/resources/` — files copied to the site root (`robots.txt`, `llms.txt`, `AGENTS.md`, `README.md`, `manifest.json`, `404.html`, `assets/`)
- `pages/resources/routes.json` — maps source files to pretty URLs and drives `sitemap.xml` generation
- `shadow-claw.config.json` — site, branding, and security settings
- `.agents/skills/`, `.agents/tools/`, `.agents/scripts/` — agent skills, declarative tools, and helper scripts
- `.agents/skills/interpret-light-reading/` and `.agents/tools/interpret_light_reading.json` — calibrated relative-reading interpretation

## Conventions

- Add a page by creating the markdown file and adding a matching entry to `pages/resources/routes.json`; `sitemap.xml` is generated from it at build time. Do not hand-edit a sitemap.
- Update `llms.txt` when pages are added, renamed, or removed.
- Treat KY-018 output as raw ADC data; do not describe the relative calibration result as lux.
- BLE112 GATT UUIDs are firmware-defined. Do not invent a serial service or characteristic.
- Files in `pages/resources/` override ShadowClaw's defaults for the same root file.

## Commands

```bash
npx shadow-claw dev --open   # local dev server on http://127.0.0.1:8888
npx shadow-claw build        # build to dist/public
```

## Reference

- [ShadowClaw AGENTS.md](https://xt-ml.github.io/shadow-claw/AGENTS.md)
- [llms.txt](llms.txt)
