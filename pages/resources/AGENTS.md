# AGENTS.md — TinyDuino LightMeter

> Guidance for AI agents working on the TinyDuino LightMeter site, tools, and agentic skills.

## Project Snapshot

Hardware light meter workbench, Web Bluetooth / BGAPI telemetry engine, declarative WebMCP sensory tools, and autonomous skills for:

- **Processor**: [TinyDuino Processor Board (`ASM2001 Rev 9`)](https://tinycircuits.com/collections/processors/products/tinyduino-processor-board?variant=14479557959) (ATmega328P @ 8MHz, 3.3V)
- **Wireless Shield**: [Bluetooth Low Energy TinyShield (`ASD2112 Rev 2`)](https://learn.tinycircuits.com/Obsolete/BLE-bluegiga_TinyShield_Tutorial/) (Bluegiga BLE112 Bluetooth Smart Module)
- **Prototyping Shield**: [TinyShield Proto Board (`ASD2009 Rev 1`)](https://tinycircuits.com/products/proto-board-tinyshield?variant=14984618887)
- **USB Programmer**: [USB TinyShield (`ASD2101 Rev 6`)](https://tinycircuits.com/products/usb-tinyshield?variant=14982646535)
- **Sensor**: KY-018 Photoresistor (LDR) analog module wired to A0
- **Indicator**: Onboard LED (Pin 13) and Proto Shield LED (Pin 7)

## Subsystem Architecture & Best Practices

1. **Direct-Rendered Pinned Workbench (`tinyduino.html`)**:
   - Web Bluetooth (`navigator.bluetooth`) and Web Serial (`navigator.serial`) require top-level execution contexts with user gestures.
   - `tinyduino.html` specifies `iframe: false` in frontmatter and is listed in `pages.directPages` in `shadow-claw.config.json`.
   - The Bluetooth connection and GATT queue live in `globalThis.__tinyduino` singleton to survive page transitions.
   - CCCD subscription includes a mandatory 300ms settling delay before initial characteristic read/write, avoiding BlueZ GATT error 133 / unknown error.

2. **Namespace Isolation & Architecture Guardrails**:
   - Strictly enforce scoped namespace isolation:
     - Tools prefix: `tinyduino_*`
     - Custom Elements prefix: `tinyduino-*`
     - Broadcast Channels: `tinyduino-commands`, `tinyduino-results`
     - Pinned workbench: `pages/main/tinyduino.html` (portal at `pages/main/index.html`)
   - Verified by `npm run check:compat` (`bin/check-namespace.mjs`).

3. **Pure Logic & Transports Separation**:
   - Core math and packet decoding in `.agents/scripts/tinyduino.js` (zero DOM / BLE dependencies, 100% unit tested).
   - Transports, queueing, and UI elements in `.agents/scripts/tinyduino-ble.js` and `.agents/scripts/tinyduino-element.js`.
   - Worker-to-main messaging via `BroadcastChannel` with explicit string literals.

4. **Declarative Tools & WebMCP**:
   - Single source of truth is `bin/tool-manifest.mjs`.
   - Generated into `.agents/tools/*.json` via `npm run build:tools` (`bin/generate-tools.mjs`).
   - Includes WebMCP boolean annotations (`readOnlyHint: true`, `consequentialHint: false`).

5. **Agent Skills**:
   - Defined in `.agents/skills/<name>/SKILL.md`.
   - Agent skills discovery index generated at `.well-known/agent-skills/index.json`.

## Commands

```bash
npm test                  # Run node:test unit suites
npm run check             # Run compatibility and tool manifest checks
npm run build:tools       # Regenerate .agents/tools/*.json
npm run skills:index      # Regenerate .well-known/agent-skills/index.json
npm run compile:firmware  # Verify Arduino compilation with BGLib submodule
npx shadow-claw dev       # Launch local preview server
npx shadow-claw build     # Production build to dist/public
```
