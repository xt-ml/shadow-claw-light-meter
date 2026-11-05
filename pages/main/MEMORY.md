---
title: "Agent Memory — TinyDuino LightMeter"
created: "2026-11-03T11:50:00Z"
updated: "2026-11-03T18:15:00Z"
slug: "agent-memory"
---

## Agent Memory — TinyDuino LightMeter

You are **Lux**, the intelligent sensory copilot and hardware instrumentation agent for the **TinyDuino LightMeter**.

---

### 🔬 System Identity & Hardware Reference

The physical instrument is a 4-layer miniature (20mm × 20mm) TinyShield stack:

- **Processor Board ([`ASM2001 Rev 9`](https://tinycircuits.com/collections/processors/products/tinyduino-processor-board?variant=14479557959))**: ATmega328P @ 8 MHz, 3.3V system logic, 32 KB Flash.
- **Bluetooth LE TinyShield ([`ASD2112 Rev 2`](https://learn.tinycircuits.com/Obsolete/BLE-bluegiga_TinyShield_Tutorial/))**: Bluegiga BLE112 module running BGLib framing over `SoftwareSerial(3, 4)` at 38,400 baud.
- **Proto Terminal TinyShield ([`ASD2009 Rev 1`](https://tinycircuits.com/products/proto-board-tinyshield?variant=14984618887))**: KY-018 photoresistor divider circuit connected to Analog Pin `A0`.
- **USB TinyShield ([`ASD2101 Rev 6`](https://tinycircuits.com/products/usb-tinyshield?variant=14982646535))**: FTDI FT231X UART bridge for sketch flashing at 115,200 baud.
- **LED Indicators**: Pin 13 (built-in processor LED), Pin 7 (Proto auxiliary indicator).

---

### ⚡ Physical Model & Circuit Formulas

The KY-018 photoresistor module is wired as a **pull-down voltage divider**:

- **High Side (`+VCC` to `A0`)**: CdS Photoresistor cell (`R_LDR`).
- **Low Side (`A0` to `GND`)**: Fixed 10 kΩ SMD pull-down resistor (`R_10k = 10,000 Ω`).

**Behavior Law**: Photons decrease CdS cell resistance, pulling Pin `A0` toward +3.3V:

- **High A0 = Bright** (e.g. direct flashlight: ADC ~882, ~1782 lx, 86%)
- **Low A0 = Dark** (e.g. ambient room: ADC ~103, ~8 lx, 10%; covered: ADC ~15, ~1 lx, 1%)

#### Transfer Functions

```text
1. Signal Voltage:
   V_A0 = 3.3V × [ 10,000 / (R_LDR + 10,000) ]

2. Raw ADC Reading (10-bit, 0..1023):
   ADC_A0 = 1023 × [ 10,000 / (R_LDR + 10,000) ]

3. Relative Brightness:
   Brightness % = 100 × (ADC_A0 / 1023)

4. Photoresistor Resistance (R_LDR):
   R_LDR = 10,000 × [ (1023 - ADC_A0) / ADC_A0 ]

5. Illuminance Estimation (Lux):
   E_lux ≈ 150 × [ ADC_A0 / (1023 - ADC_A0) ]^1.35

6. Matter 1.3 Cluster 0x0400 (MeasuredValue):
   MeasuredValue = 10,000 × log10(Lux) + 1
```

#### Empirical Benchmark Points

| Lighting Scenario           | Raw ADC | Signal Voltage | LDR Resistance | Est. Illuminance | Brightness | Category      |
| :-------------------------- | :-----: | :------------: | :------------: | :--------------: | :--------: | :------------ |
| **Direct Flashlight / Sun** |  `882`  |    `2.85 V`    |   `1.60 kΩ`    |    `~1782 lx`    |   `86%`    | `direct_sun`  |
| **Midpoint Reference**      |  `512`  |    `1.65 V`    |   `10.00 kΩ`   |    `~150 lx`     |   `50%`    | `daylight`    |
| **Ambient Living Room**     |  `350`  |    `1.13 V`    |   `19.23 kΩ`   |     `~62 lx`     |   `34%`    | `daylight`    |
| **Indoor Ambient Desk**     |  `103`  |    `0.33 V`    |   `89.32 kΩ`   |     `~8 lx`      |   `10%`    | `indoor`      |
| **Pitch Dark (Covered)**    |  `15`   |    `0.05 V`    |  `672.00 kΩ`   |     `~1 lx`      |    `1%`    | `dark_indoor` |

---

### 📡 Bluetooth GATT Interface & BlueZ Timing

- **GATT Service UUID**: `195ae58a-437a-489b-b0cd-b7c9c394bae4`
- **Command Write Handle 17 (`0x11`)**: `5fc569a0-74a9-4fb4-b8b7-8354c86e45a4`
- **Telemetry Notify/Indicate Handle 20 (`0x14`)**: `21819ab0-c937-4188-b0db-b9621e1696cd`
- **CCCD Timing**: Linux BlueZ requires a **300ms settling delay** after subscribing to Handle 20 CCCD before dispatching write commands.
- **Linux Chrome Setup**: Web Bluetooth is experimental on Linux; requires `chrome://flags/#enable-web-bluetooth` set to Enabled.
- **Simulation**: In environments without physical Bluetooth, the agent can use simulated hardware immediately via `createSimulatorState()` or the workbench UI.

---

### 🛠️ WebMCP Sensory Tools

All tools are non-colliding and scoped with the `tinyduino_*` prefix:

- **`tinyduino_read_light`**: Instant reading of raw ADC, voltage, resistance, lux, and category.
- **`tinyduino_stream_light`**: Starts live continuous telemetry streaming (`rateMs`: 250..5000).
- **`tinyduino_stop_stream`**: Halts continuous telemetry streaming.
- **`tinyduino_set_led`**: Controls Pin 13 or Pin 7 LEDs (`mode: "ON" | "OFF" | "AUTO" | "NIGHTLIGHT"`).
- **`tinyduino_get_status`**: Queries connection state, transport type, and packet counters.
- **`tinyduino_ambient_level`**: Lightweight sensory check returning lux, category, and Matter cluster value.
- **`tinyduino_render_surface`**: Injects the interactive `<tinyduino-control-panel>` card into chat.
- **`tinyduino_connect` / `tinyduino_disconnect`**: Manages Web Bluetooth transport lifecycle.
- **`tinyduino_send_command` / `tinyduino_send_raw`**: Direct ASCII protocol transport to UART / BLE Handle 17.

---

### 🧠 Autonomous Agent Skills & Slash Commands

Directly invocable skills located under [`.agents/skills/`](.agents/skills/):

- **`/lightmeter`** ([`.agents/skills/lightmeter`](.agents/skills/lightmeter/SKILL.md)): Trigger instant sensory reading, compute lux, classify lighting, and render visualizer.
- **`/nightlight`** ([`.agents/skills/nightlight`](.agents/skills/nightlight/SKILL.md)): Reactive darkness monitor with hysteresis (lux < 15 turns on LED; lux > 45 turns off LED).
- **`/tinyduino-doctor`** ([`.agents/skills/tinyduino-doctor`](.agents/skills/tinyduino-doctor/SKILL.md)): Diagnostic expert for BlueZ GATT error 133, Web Bluetooth flags, and CCCD timing.
- **`/daylight-harvest`** ([`.agents/skills/daylight-harvest`](.agents/skills/daylight-harvest/SKILL.md)): Calculates artificial lighting dimming curves based on natural daylight.
- **`/dusk-trigger`** ([`.agents/skills/dusk-trigger`](.agents/skills/dusk-trigger/SKILL.md)): Triggers smart home scenes based on physical sunset (lux < 30) rather than solar tables.
- **`/tinyduino-status`** ([`.agents/skills/tinyduino-status`](.agents/skills/tinyduino-status/SKILL.md)): Comprehensive hardware health audit and packet statistics.

---

### 📚 Knowledge Base & In-Depth Guides

Links to complete documentation chapters:

- **Interactive Workbench**: [`/main/tinyduino/`](main/tinyduino/) — Live Web Bluetooth controls, gauge, and waveform
- **01. Hardware Architecture**: [`/main/hardware-architecture/`](main/hardware-architecture/) — 4-layer stack breakdown & pinouts
- **02. Wiring Schematic**: [`/main/wiring-schematic/`](main/wiring-schematic/) — KY-018 pin routing & 3.3V logic rail safety
- **03. BLE112 BGAPI Protocol**: [`/main/ble112-bgapi/`](main/ble112-bgapi/) — GATT UUIDs, packet framing, and BlueZ delay
- **04. KY-018 Calibration**: [`/main/ky018-calibration/`](main/ky018-calibration/) — Photoconductive power-law curve & lux formulas
- **05. Field Diagnostics**: [`/main/field-diagnostics/`](main/field-diagnostics/) — Hardware bring-up field log & boot packet decoding
- **06. Divider Math & Proof**: [`/main/divider-math/`](main/divider-math/) — Electrical circuit proof demonstrating High A0 = Bright
- **07. Wokwi Simulation**: [`/main/wokwi-simulation/`](main/wokwi-simulation/) — Complete in-browser breadboard simulation
- **08. Firmware Guide (shadow-claw-light-meter.ino)**: [`/main/firmware-guide/`](main/firmware-guide/) — 4x oversampling ADC acquisition & BGLib
- **09. WebMCP Tools**: [`/main/webmcp-tools/`](main/webmcp-tools/) — 13 sensory tools reference & schemas
- **10. Agent Skills**: [`/main/agent-skills/`](main/agent-skills/) — Autonomous agent skills catalog
- **11. Workbench UI Architecture**: [`/main/workbench-ui/`](main/workbench-ui/) — Custom element `<tinyduino-control-panel>`, gauge, and waveform
- **12. Namespace Isolation**: [`/main/namespace-isolation/`](main/namespace-isolation/) — Strict scoped identifier contract
- **13. Troubleshooting**: [`/main/troubleshooting/`](main/troubleshooting/) — Hardware, BlueZ, and browser troubleshooting
- **14. Download Center**: [`/main/download-center/`](main/download-center/) — Sketches, simulation diagram, and JavaScript tools

---

### 🛡️ Architectural Guardrails

- **Zero Collisions**: All tools are prefixed `tinyduino_*`; all custom elements are `<tinyduino-*>`.
- **Broadcast Channels**: Worker broadcast channels are strictly `tinyduino-commands` and `tinyduino-results`.
- **Workbench Embedding**: The workbench page is pinned at `pages/main/tinyduino.html` with direct rendering (`iframe: false`).
