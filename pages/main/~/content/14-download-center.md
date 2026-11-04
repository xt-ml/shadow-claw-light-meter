---
title: "Download Center (Firmware & Source)"
created: "2026-11-03T11:50:00Z"
updated: "2026-11-03T20:10:00Z"
slug: "download-center"
---

## Download & Source Center

Direct access to raw source files, firmware sketches, Wokwi hardware simulation models, and build scripts for the TinyDuino LightMeter from the official [xt-ml/shadow-claw-light-meter](https://github.com/xt-ml/shadow-claw-light-meter) repository.

---

### 1. Arduino Firmware Sketches

| File                              | Description                                                                                        | Source & Download                                                                                                                                                                                                                                                                 |
| :-------------------------------- | :------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`shadow-claw-light-meter.ino`** | Production firmware with 4x oversampled ADC, non-blocking telemetry stream, and BGAPI GATT parser. | [View Source](https://github.com/xt-ml/shadow-claw-light-meter/blob/main/firmware/shadow-claw-light-meter/shadow-claw-light-meter.ino) · [Raw](https://raw.githubusercontent.com/xt-ml/shadow-claw-light-meter/main/firmware/shadow-claw-light-meter/shadow-claw-light-meter.ino) |

---

### 2. Wokwi Hardware Simulation Assets

| File                   | Description                                                                                       | Source & Download                                                                                                           |
| :--------------------- | :------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------- |
| **`diagram.json`**     | Wokwi breadboard schematic defining ATmega328P, BLE112 custom chip, potentiometer, and LEDs.      | [View Source](https://github.com/xt-ml/shadow-claw-light-meter/blob/main/firmware/shadow-claw-light-meter/diagram.json)     |
| **`wokwi.toml`**       | Simulation configuration file mapping ELF firmware and compiling the custom C chip.               | [View Source](https://github.com/xt-ml/shadow-claw-light-meter/blob/main/firmware/shadow-claw-light-meter/wokwi.toml)       |
| **`ble112.chip.c`**    | Custom C-chip emulation source implementing Bluegiga BLE112 boot events and GATT packet handling. | [View Source](https://github.com/xt-ml/shadow-claw-light-meter/blob/main/firmware/shadow-claw-light-meter/ble112.chip.c)    |
| **`ble112.chip.json`** | Pinout and metadata definition for the Wokwi BLE112 custom chip.                                  | [View Source](https://github.com/xt-ml/shadow-claw-light-meter/blob/main/firmware/shadow-claw-light-meter/ble112.chip.json) |

---

### 3. Tooling & Core Scripts

| File                       | Description                                                                                             | Source & Download                                                                                                                                                                                                                |
| :------------------------- | :------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`upload.sh`**            | Compilation and upload shell script targeting `arduino:avr:pro:cpu=8MHzatmega328` with BGLib submodule. | [View in `bin/`](https://github.com/xt-ml/shadow-claw-light-meter/blob/main/bin/upload.sh)                                                                                                                                       |
| **`tool-manifest.mjs`**    | Authoritative manifest defining all 13 declarative WebMCP tools.                                        | [View in `bin/`](https://github.com/xt-ml/shadow-claw-light-meter/blob/main/bin/tool-manifest.mjs)                                                                                                                               |
| **`tinyduino.js`**         | Pure ESM computation engine containing sensor math, BGAPI parsing, and simulator state.                 | [View in `.agents/scripts/`](https://github.com/xt-ml/shadow-claw-light-meter/blob/main/.agents/scripts/tinyduino.js) · [Raw](https://raw.githubusercontent.com/xt-ml/shadow-claw-light-meter/main/.agents/scripts/tinyduino.js) |
| **`tinyduino-ble.js`**     | Web Bluetooth GATT transport, queue manager, and CCCD settle timer.                                     | [View in `.agents/scripts/`](https://github.com/xt-ml/shadow-claw-light-meter/blob/main/.agents/scripts/tinyduino-ble.js)                                                                                                        |
| **`tinyduino-element.js`** | Custom web component `<tinyduino-control-panel>` rendering live dials, gauges, and controls.            | [View in `.agents/scripts/`](https://github.com/xt-ml/shadow-claw-light-meter/blob/main/.agents/scripts/tinyduino-element.js)                                                                                                    |
| **`tinyduino-adapter.js`** | BroadcastChannel worker bridge and Chrome WebMCP tool registrar.                                        | [View in `.agents/scripts/`](https://github.com/xt-ml/shadow-claw-light-meter/blob/main/.agents/scripts/tinyduino-adapter.js)                                                                                                    |

---

⬅️ [Previous: Troubleshooting](/main/troubleshooting/) | 🏠 [Back to Portal](/main/) | ☀️ [Open Workbench](/main/tinyduino/)
