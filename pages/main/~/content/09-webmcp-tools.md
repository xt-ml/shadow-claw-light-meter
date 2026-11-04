---
title: "Declarative WebMCP Sensory Tools"
created: "2026-11-03T11:50:00Z"
updated: "2026-11-03T11:50:00Z"
slug: "webmcp-tools"
---

## Declarative WebMCP Sensory Tools

The TinyDuino LightMeter exposes 13 declarative tools located in `.agents/tools/*.json` and defined in `bin/tool-manifest.mjs`. These tools allow AI agents and browser automation runtimes to control hardware and read physical illuminance.

---

### Tool Catalog

| Tool Name                         | Annotations | Description                                                                                                 |
| :-------------------------------- | :---------: | :---------------------------------------------------------------------------------------------------------- |
| `tinyduino_read_light`            |  Read-Only  | Triggers 4x-oversampled A0 analog read over GATT Handle 17 and returns live lux, voltage, and brightness %. |
| `tinyduino_get_status`            |  Read-Only  | Retrieves current connection state, recent samples, and telemetry without transmitting a packet.            |
| `tinyduino_set_led`               |  Mutating   | Controls LED mode: `ON`, `OFF`, or `AUTO` (connection blink).                                               |
| `tinyduino_stream_light`          |  Mutating   | Starts continuous telemetry streaming at 250ms, 500ms, or 1000ms intervals.                                 |
| `tinyduino_stop_stream`           |  Mutating   | Halts continuous telemetry streaming.                                                                       |
| `tinyduino_send_command`          |  Mutating   | Sends arbitrary ASCII text command string to GATT Handle 17.                                                |
| `tinyduino_send_raw`              |  Mutating   | Sends raw hexadecimal bytes to GATT Handle 17.                                                              |
| `tinyduino_connect`               |  Mutating   | Launches Web Bluetooth chooser or starts offline hardware simulation.                                       |
| `tinyduino_disconnect`            |  Mutating   | Closes GATT connection or terminates simulation.                                                            |
| `tinyduino_get_connection_status` |  Read-Only  | Returns connection mode (`connected`, `simulated`, `disconnected`) and packet stats.                        |
| `tinyduino_read_telemetry`        |  Read-Only  | Structured snapshot of raw ADC, signal voltage, lux, and category.                                          |
| `tinyduino_render_surface`        |  Read-Only  | Embeds the interactive `<tinyduino-control-panel>` component into chat.                                     |
| `tinyduino_ambient_level`         |  Read-Only  | Lightweight sensory check returning lux, category, and Matter 0x0400 cluster values.                        |

---

### Tool Schemas & Examples

#### `tinyduino_read_light`

```json
{
  "name": "tinyduino_read_light",
  "input_schema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  },
  "annotations": {
    "readOnlyHint": true,
    "consequentialHint": false
  }
}
```

**Example Response**:

```json
{
  "ok": true,
  "command": "LIGHT",
  "reply": "LIGHT:103",
  "rawA0": 103,
  "voltage": 0.33,
  "percent": 90,
  "lux": 1094,
  "category": "direct_sun"
}
```

#### `tinyduino_ambient_level`

Returns the standardized environmental illuminance formatted for smart home automations:

```json
{
  "percent": 90,
  "lux": 1094,
  "category": "direct_sun",
  "matterIlluminance": 30391
}
```

---

⬅️ [Previous: Firmware Guide](/main/firmware-guide/) | ➡️ [Next: Agent Skills](/main/agent-skills/)
