---
title: "Agent Skills & Sensory Automation"
created: "2026-11-03T11:50:00Z"
updated: "2026-11-03T11:50:00Z"
slug: "agent-skills"
---

## Agent Skills & Sensory Automation Workflows

Agent Skills provide autonomous, multi-step capabilities that allow AI agents and user slash commands to observe and interact directly with the physical environment through the TinyDuino LightMeter.

All skills conform to the **Agent Skills** open specification, are discoverable via the standard endpoint `/.well-known/agent-skills/index.json`, and utilize declarative tool execution (`metadata.execution.type: tools`) so that hardware slash commands execute instantly via the worker toolchain without requiring a local or cloud LLM model call.

---

### Skill Catalog & Slash Commands

#### 1. `/lightmeter` — Instant Lightmetering & Classification

- **Directory**: `.agents/skills/lightmeter/SKILL.md`
- **Execution Tool**: `tinyduino_read_light`
- **Description**: Triggers an analog light measurement, calculates voltage and lux, classifies lighting conditions (e.g. `direct_sun`, `daylight`, `indoor`, `dark_indoor`, `night`), and returns the telemetry instantly.

#### 2. `/nightlight` — Reactive Darkness Monitoring

- **Directory**: `.agents/skills/nightlight/SKILL.md`
- **Execution Tool**: `tinyduino_set_led`
- **Description**: Automatically sets LED mode to `AUTO` to monitor darkness with hysteresis. When ambient light drops below 20%, activates LEDs.

#### 3. `/tinyduino-status` — Hardware Diagnostic Inspection

- **Directory**: `.agents/skills/tinyduino-status/SKILL.md`
- **Execution Tool**: `tinyduino_get_status`
- **Description**: Gathers full telemetry (connection mode, packet counts, last ACK string, min/max session readings, encoder position) without mutating state.

#### 4. `/tinyduino-doctor` — Troubleshooting & BlueZ Recovery

- **Directory**: `.agents/skills/tinyduino-doctor/SKILL.md`
- **Execution Tool**: `tinyduino_get_connection_status`
- **Description**: Checks active Web Bluetooth connection mode, device name, and transport state.

#### 5. `/daylight-harvest` — Energy-Saving Lighting Coordinator

- **Directory**: `.agents/skills/daylight-harvest/SKILL.md`
- **Execution Tool**: `tinyduino_ambient_level`
- **Description**: Calculates artificial lighting offsets based on physical natural daylight entering the room.

#### 6. `/dusk-trigger` — Real-World Twilight & Dusk Automation

- **Directory**: `.agents/skills/dusk-trigger/SKILL.md`
- **Execution Tool**: `tinyduino_ambient_level`
- **Description**: Triggers evening smart home lighting scenes based on actual measured illuminance (lux < 30) rather than solar clock estimations.

---

⬅️ [Previous: WebMCP Sensory Tools](main/webmcp-tools/) | ➡️ [Next: Interactive Workbench & Custom Elements](main/workbench-ui/)
