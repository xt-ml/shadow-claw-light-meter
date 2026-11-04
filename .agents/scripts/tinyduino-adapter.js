/**
 * .agents/scripts/tinyduino-adapter.js
 *
 * ShadowClaw Page Adapter & WebMCP IPC Bridge.
 * Bridges worker declarative tools to the TinyDuino hardware transport via BroadcastChannel.
 * Also registers imperative tools with Chrome document.modelContext when available.
 */

import { tinyduino } from "./tinyduino-ble.js";
import "./tinyduino-element.js";

let cmdChannel = null;
let resChannel = null;
let initialized = false;

export async function init(container) {
  if (initialized) return;
  initialized = true;

  // 1. Worker BroadcastChannel Bridge
  // Explicit string literals are required for ShadowClaw iframe proxy matching
  cmdChannel = new BroadcastChannel("tinyduino-commands");
  resChannel = new BroadcastChannel("tinyduino-results");

  cmdChannel.addEventListener("message", async (event) => {
    const msg = event.data;
    if (!msg || !msg.requestId || !msg.type) return;

    // Send immediate ACK
    resChannel.postMessage({
      requestId: msg.requestId,
      ack: true,
    });

    try {
      const result = await handleToolDispatch(msg.type, msg.params || {});
      resChannel.postMessage({
        requestId: msg.requestId,
        result,
      });
    } catch (err) {
      resChannel.postMessage({
        requestId: msg.requestId,
        error: err.message || String(err),
      });
    }
  });

  // 2. Native Chrome WebMCP Registration
  registerNativeWebMcp();
}

export function cleanup() {
  if (cmdChannel) {
    cmdChannel.close();
    cmdChannel = null;
  }
  if (resChannel) {
    resChannel.close();
    resChannel = null;
  }
  initialized = false;
}

async function handleToolDispatch(name, params) {
  switch (name) {
    case "tinyduino_read_light":
      return await tinyduino.sendCommand("read_light");

    case "tinyduino_get_status":
      return tinyduino.getState();

    case "tinyduino_set_led":
      return await tinyduino.sendCommand("set_led", { state: params.state });

    case "tinyduino_stream_light":
      return await tinyduino.sendCommand("stream_light", {
        rateMs: params.rateMs,
      });

    case "tinyduino_stop_stream":
      return await tinyduino.sendCommand("stop_stream");

    case "tinyduino_send_command":
      return await tinyduino.sendRawText(
        String(params.command || "").trim() + "\n",
      );

    case "tinyduino_send_raw":
      return await tinyduino.sendRawText(
        String(params.hex || "").trim() + "\n",
      );

    case "tinyduino_connect":
      if (params.simulate) {
        return tinyduino.toggleSimulation(true);
      }
      return await tinyduino.connectBle();

    case "tinyduino_disconnect":
      return await tinyduino.disconnect();

    case "tinyduino_get_connection_status": {
      const s = tinyduino.getState();
      return {
        mode: s.mode,
        deviceName: s.deviceName,
        transportType: s.transportType,
        packetCount: s.packetCount,
      };
    }

    case "tinyduino_read_telemetry": {
      const s = tinyduino.getState();
      return {
        rawA0: s.rawA0,
        voltage: s.voltage,
        percent: s.percent,
        lux: s.lux,
        matterIlluminance: s.matterIlluminance,
        category: s.category,
      };
    }

    case "tinyduino_ambient_level": {
      const s = tinyduino.getState();
      return {
        percent: s.percent,
        lux: s.lux,
        category: s.category,
        matterIlluminance: s.matterIlluminance,
      };
    }

    case "tinyduino_render_surface":
      return {
        ok: true,
        rendered: true,
        element: "<tinyduino-control-panel></tinyduino-control-panel>",
      };

    default:
      throw new Error(`Unknown tinyduino tool: ${name}`);
  }
}

// Native Chrome WebMCP tool registration (document.modelContext)
function registerNativeWebMcp() {
  const modelContext =
    typeof document !== "undefined" && document.modelContext
      ? document.modelContext
      : typeof navigator !== "undefined" && navigator.modelContext
        ? navigator.modelContext
        : null;

  if (!modelContext || typeof modelContext.registerTool !== "function") {
    return;
  }

  const tools = [
    {
      name: "tinyduino_get_status",
      title: "Get TinyDuino & LightMeter Status",
      description:
        "Return the current TinyDuino connection state, raw ADC, voltage, brightness %, and lux.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true, consequentialHint: false },
      execute: async () => tinyduino.getState(),
    },
    {
      name: "tinyduino_read_light",
      title: "Read Hardware LightMeter (Pin A0)",
      description:
        "Trigger an immediate 4x-oversampled analogRead(A0) on the TinyDuino KY-018 photoresistor.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true, consequentialHint: false },
      execute: async () => await tinyduino.sendCommand("read_light"),
    },
    {
      name: "tinyduino_set_led",
      title: "Set TinyDuino LED Mode",
      description: "Set the LED state: ON, OFF, or AUTO.",
      inputSchema: {
        type: "object",
        properties: {
          state: { type: "string", enum: ["ON", "OFF", "AUTO"] },
        },
        required: ["state"],
      },
      annotations: { readOnlyHint: false, consequentialHint: false },
      execute: async (args) =>
        await tinyduino.sendCommand("set_led", { state: args.state }),
    },
    {
      name: "tinyduino_send_command",
      title: "Send ASCII Command to TinyDuino",
      description:
        "Send an arbitrary ASCII command string to TinyDuino over GATT Handle 17.",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string" },
        },
        required: ["command"],
      },
      annotations: { readOnlyHint: false, consequentialHint: false },
      execute: async (args) =>
        await tinyduino.sendRawText(String(args.command).trim() + "\n"),
    },
  ];

  for (const tool of tools) {
    try {
      modelContext.registerTool(tool);
    } catch (_) {}
  }
}

// Auto-initialize when loaded in browser window
if (typeof window !== "undefined") {
  init(document.body);
}
