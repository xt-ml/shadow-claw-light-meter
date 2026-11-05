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
  await registerNativeWebMcp();
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
    case "tinyduino_read_light": {
      if (tinyduino.getState().mode === "disconnected") {
        tinyduino.toggleSimulation(true);
      }
      await tinyduino.sendCommand("read_light");
      const s = tinyduino.getState();
      const hardwareLabel = s.mode === "simulated" ? "Simulated" : "GATT";
      return `☀️ **LightMeter Reading (${hardwareLabel})**\n- **Illuminance**: ${s.lux} lx (${s.percent}%)\n- **ADC A0**: ${s.rawA0} / 1023 (${s.voltage}V)\n- **LDR Resistance**: ${s.ldrKohm} kΩ\n- **Category**: \`${s.category}\`\n- **Device**: ${s.deviceName}`;
    }

    case "tinyduino_get_status": {
      const s = tinyduino.getState();
      return `📡 **TinyDuino Status**\n- **Mode**: \`${s.mode}\`\n- **Transport**: ${s.transportType}\n- **Device**: ${s.deviceName}\n- **Packets**: ${s.packetCount}\n- **Streaming**: ${s.streaming ? `ON (${s.streamRateMs}ms)` : "OFF"}\n- **Last Telemetry**: ADC ${s.rawA0} (${s.lux} lx, \`${s.category}\`)`;
    }

    case "tinyduino_set_led": {
      if (tinyduino.getState().mode === "disconnected") {
        tinyduino.toggleSimulation(true);
      }
      const stateArg = (params.state || "AUTO").toUpperCase();
      await tinyduino.sendCommand("set_led", { state: stateArg });
      return `💡 LED Mode set to **${stateArg}** on ${tinyduino.getState().deviceName}`;
    }

    case "tinyduino_stream_light": {
      if (tinyduino.getState().mode === "disconnected") {
        tinyduino.toggleSimulation(true);
      }
      const rateMs = params.rateMs || 500;
      await tinyduino.sendCommand("stream_light", { rateMs });
      return `🌊 Started LightMeter telemetry streaming at **${rateMs}ms** interval (${tinyduino.getState().deviceName})`;
    }

    case "tinyduino_stop_stream": {
      await tinyduino.sendCommand("stop_stream");
      return `⏹️ Stopped LightMeter telemetry streaming (${tinyduino.getState().deviceName})`;
    }

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
      return `🩺 **Hardware Connection Status**\n- **Mode**: \`${s.mode}\`\n- **Device**: ${s.deviceName}\n- **Packets**: ${s.packetCount}\n- **Transport**: ${s.transportType}`;
    }

    case "tinyduino_read_telemetry": {
      if (tinyduino.getState().mode === "disconnected") {
        tinyduino.toggleSimulation(true);
      }
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
      if (tinyduino.getState().mode === "disconnected") {
        tinyduino.toggleSimulation(true);
      }
      const s = tinyduino.getState();
      return `🌱 **Ambient Illuminance Level**\n- **Lux**: ${s.lux} lx\n- **Brightness**: ${s.percent}%\n- **Classification**: \`${s.category}\`\n- **Matter Value**: ${s.matterIlluminance}`;
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
export async function registerNativeWebMcp() {
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
      const res = modelContext.registerTool(tool);
      if (res && typeof res.catch === "function") {
        await res.catch(() => {});
      }
    } catch (_) {}
  }
}

// Auto-initialize when loaded in browser window
if (typeof window !== "undefined") {
  init(document.body).catch(() => {});
}
