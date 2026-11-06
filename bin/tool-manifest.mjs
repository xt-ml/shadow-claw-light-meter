/**
 * bin/tool-manifest.mjs
 *
 * Authoritative single source of truth for the 13 TinyDuino WebMCP declarative tools.
 */

function makeBroadcastCode(toolName) {
  return `
let toolParams = {};
try {
  const raw = typeof $PIPE_DATA !== "undefined" && $PIPE_DATA ? $PIPE_DATA : (typeof data !== "undefined" ? data : "{}");
  toolParams = typeof raw === "string" ? JSON.parse(raw) : (raw || {});
} catch (_) {}

const cmdCh = new BroadcastChannel("tinyduino-commands");
const resCh = new BroadcastChannel("tinyduino-results");
const reqId = "req_" + Math.random().toString(36).slice(2);

const timeout = new Promise((_, reject) =>
  setTimeout(() => {
    cmdCh.close();
    resCh.close();
    reject(new Error("Timeout awaiting TinyDuino response for ${toolName}. Ensure workbench is open at /pages/main/tinyduino.html."));
  }, 5000)
);

const reply = new Promise((resolve, reject) => {
  const handler = (e) => {
    if (e.data && e.data.requestId === reqId) {
      if (e.data.ack) return;
      resCh.removeEventListener("message", handler);
      cmdCh.close();
      resCh.close();
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.result);
    }
  };
  resCh.addEventListener("message", handler);
  cmdCh.postMessage({ type: "${toolName}", requestId: reqId, params: toolParams || {} });
});

return await Promise.race([reply, timeout]);
`.trim();
}

export const TOOLS = [
  {
    name: "tinyduino_read_light",
    description:
      "Trigger an immediate analogRead(A0) on the TinyDuino KY-018 photoresistor over Web Bluetooth GATT Handle 17, and return the live LightMeter metrics (raw A0, voltage, brightness %, and estimated lux).",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      consequentialHint: false,
    },
    execution: {
      type: "javascript",
      code: makeBroadcastCode("tinyduino_read_light"),
    },
  },
  {
    name: "tinyduino_get_status",
    description:
      "Return current TinyDuino connection state, LightMeter A0 telemetry, auxiliary sensor values, and recent samples without transmitting a new BLE packet.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      consequentialHint: false,
    },
    execution: {
      type: "javascript",
      code: makeBroadcastCode("tinyduino_get_status"),
    },
  },
  {
    name: "tinyduino_set_led",
    description:
      "Control the TinyDuino onboard LED (Pin 13) and ASD2009 Proto Board LEDs. Modes: ON (force ON), OFF (force OFF), or AUTO (automatic BLE state blink).",
    input_schema: {
      type: "object",
      properties: {
        state: {
          type: "string",
          enum: ["ON", "OFF", "AUTO"],
          description: "Target LED mode: ON, OFF, or AUTO.",
        },
      },
      required: ["state"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      consequentialHint: false,
    },
    execution: {
      type: "javascript",
      code: makeBroadcastCode("tinyduino_set_led"),
    },
  },
  {
    name: "tinyduino_stream_light",
    description:
      "Start continuous A0 LightMeter telemetry streaming from TinyDuino and optionally set sampling interval in ms (250, 500, 1000).",
    input_schema: {
      type: "object",
      properties: {
        rateMs: {
          type: "number",
          enum: [250, 500, 1000],
          description: "Telemetry stream interval in milliseconds.",
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      consequentialHint: false,
    },
    execution: {
      type: "javascript",
      code: makeBroadcastCode("tinyduino_stream_light"),
    },
  },
  {
    name: "tinyduino_stop_stream",
    description:
      "Stop continuous A0 LightMeter telemetry streaming from the TinyDuino.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      consequentialHint: false,
    },
    execution: {
      type: "javascript",
      code: makeBroadcastCode("tinyduino_stop_stream"),
    },
  },
  {
    name: "tinyduino_send_command",
    description:
      "Send an arbitrary ASCII command string (e.g. LIGHT, STATUS, LED_ON, RATE:500, PING) to TinyDuino over GATT Handle 17.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "ASCII command string.",
        },
      },
      required: ["command"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      consequentialHint: false,
    },
    execution: {
      type: "javascript",
      code: makeBroadcastCode("tinyduino_send_command"),
    },
  },
  {
    name: "tinyduino_send_raw",
    description:
      "Send raw hexadecimal bytes (e.g. '80 0c 00 00' or '01') to TinyDuino over GATT Handle 17.",
    input_schema: {
      type: "object",
      properties: {
        hex: {
          type: "string",
          description: "Hexadecimal byte string separated by spaces or colons.",
        },
      },
      required: ["hex"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      consequentialHint: false,
    },
    execution: {
      type: "javascript",
      code: makeBroadcastCode("tinyduino_send_raw"),
    },
  },
  {
    name: "tinyduino_connect",
    description:
      "Trigger Web Bluetooth connection dialog or activate simulated hardware.",
    input_schema: {
      type: "object",
      properties: {
        simulate: {
          type: "boolean",
          description:
            "Set true to activate internal simulation instead of hardware Web Bluetooth.",
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      consequentialHint: false,
    },
    execution: {
      type: "javascript",
      code: makeBroadcastCode("tinyduino_connect"),
    },
  },
  {
    name: "tinyduino_disconnect",
    description:
      "Disconnect from TinyDuino Web Bluetooth GATT server or deactivate simulation.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      consequentialHint: false,
    },
    execution: {
      type: "javascript",
      code: makeBroadcastCode("tinyduino_disconnect"),
    },
  },
  {
    name: "tinyduino_get_connection_status",
    description:
      "Inspect the current transport mode (connected, disconnected, simulated), device name, and packet counters.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      consequentialHint: false,
    },
    execution: {
      type: "javascript",
      code: makeBroadcastCode("tinyduino_get_connection_status"),
    },
  },
  {
    name: "tinyduino_read_telemetry",
    description:
      "Return snapshot of raw ADC, voltage, brightness %, estimated lux, and lighting category.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      consequentialHint: false,
    },
    execution: {
      type: "javascript",
      code: makeBroadcastCode("tinyduino_read_telemetry"),
    },
  },
  {
    name: "tinyduino_render_surface",
    description:
      "Render or embed the interactive TinyDuino LightMeter control panel inside an agent chat or UI surface.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      consequentialHint: false,
    },
    execution: {
      type: "javascript",
      code: makeBroadcastCode("tinyduino_render_surface"),
    },
  },
  {
    name: "tinyduino_ambient_level",
    description:
      "Lightweight sensory check returning current ambient light level, lux, category, and Matter 0x0400 cluster MeasuredValue for smart home automation.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      consequentialHint: false,
    },
    execution: {
      type: "javascript",
      code: makeBroadcastCode("tinyduino_ambient_level"),
    },
  },
];
