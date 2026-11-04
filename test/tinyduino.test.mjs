import test from "node:test";
import assert from "node:assert/strict";
import {
  parseA0Telemetry,
  computeLightPhysics,
  matterIlluminance,
  parseBgapiPacket,
  formatTinyduinoCommand,
  createSimulatorState,
  DEFAULT_KY018_CONFIG,
} from "../.agents/scripts/tinyduino.js";
import { TinyduinoTransport } from "../.agents/scripts/tinyduino-ble.js";

test("parseA0Telemetry: parses various TinyDuino ASCII response formats", () => {
  assert.deepEqual(parseA0Telemetry("LIGHT:547\r\n"), {
    rawAdc: 547,
    encoder: null,
    format: "LIGHT",
  });
  assert.deepEqual(parseA0Telemetry("A0:103 ENC:0"), {
    rawAdc: 103,
    encoder: 0,
    format: "A0_ENC",
  });
  assert.deepEqual(parseA0Telemetry("A0:882 ENC:42\n"), {
    rawAdc: 882,
    encoder: 42,
    format: "A0_ENC",
  });
  assert.deepEqual(parseA0Telemetry("ACK:READ_A0 250"), {
    rawAdc: 250,
    encoder: null,
    format: "ACK_READ",
  });
  assert.deepEqual(parseA0Telemetry("103"), {
    rawAdc: 103,
    encoder: null,
    format: "RAW_NUMBER",
  });
  assert.deepEqual(parseA0Telemetry("SOMETHING UNRELATED"), null);
});

test("computeLightPhysics: standard KY-018 divider (high ADC = bright, matching firmware)", () => {
  // Direct flashlight: ADC jumps up to 882 (2.85V, R_LDR ≈ 1.60 kΩ)
  const bright = computeLightPhysics({ rawAdc: 882 });
  assert.equal(bright.voltage.toFixed(2), "2.85");
  assert.equal(bright.percent, 86);
  assert.equal(bright.ldrKohm, 1.6);
  assert.equal(bright.lux, 1782);
  assert.equal(bright.category, "direct_sun");

  // Midpoint reference: ADC 512 (1.65V, R_LDR ≈ 10.0 kΩ)
  const mid = computeLightPhysics({ rawAdc: 512 });
  assert.equal(mid.voltage.toFixed(2), "1.65");
  assert.equal(mid.percent, 50);
  assert.equal(mid.ldrKohm, 9.98);
  assert.equal(mid.lux, 150);
  assert.equal(mid.category, "daylight");

  // Ambient indoor room: ADC 103 (0.33V, R_LDR ≈ 89.3 kΩ)
  const ambient = computeLightPhysics({ rawAdc: 103 });
  assert.equal(ambient.voltage.toFixed(2), "0.33");
  assert.equal(ambient.percent, 10);
  assert.equal(ambient.ldrKohm, 89.3);
  assert.equal(ambient.lux, 8);
  assert.equal(ambient.category, "dark_indoor");

  // Pitch dark / covered: ADC 15 (0.05V, R_LDR ≈ 672 kΩ)
  const dark = computeLightPhysics({ rawAdc: 15 });
  assert.equal(dark.voltage.toFixed(2), "0.05");
  assert.equal(dark.percent, 1);
  assert.equal(dark.ldrKohm, 672);
  assert.equal(dark.lux, 1);
  assert.equal(dark.category, "night");
});

test("computeLightPhysics: inverted polarity mode (low ADC = bright)", () => {
  const brightInverted = computeLightPhysics({
    rawAdc: 103,
    polarity: "low_adc_bright",
  });
  assert.equal(brightInverted.percent, 90);
  assert.ok(brightInverted.lux > 800);

  const darkInverted = computeLightPhysics({
    rawAdc: 882,
    polarity: "low_adc_bright",
  });
  assert.equal(darkInverted.percent, 14);
  assert.ok(darkInverted.lux < 30);
});

test("TinyduinoTransport: default polarity is high_adc_bright (flashlight = high brightness)", () => {
  const transport = new TinyduinoTransport();
  assert.equal(transport.polarity, "high_adc_bright");

  transport._recordA0(882);
  assert.equal(transport.percent, 86);
  assert.equal(transport.category, "direct_sun");
  assert.equal(transport.lux, 1782);

  transport._recordA0(103);
  assert.equal(transport.percent, 10);
  assert.equal(transport.category, "dark_indoor");
  assert.equal(transport.lux, 8);

  // Can switch to inverted polarity and re-records
  transport.setPolarity("inverted");
  assert.equal(transport.polarity, "low_adc_bright");
  assert.equal(transport.percent, 90);

  transport.setPolarity("direct");
  assert.equal(transport.polarity, "high_adc_bright");
  assert.equal(transport.percent, 10);
});

test("matterIlluminance: scales lux to Matter 0x0400 cluster MeasuredValue", () => {
  // 0 or negative lux -> 0 (invalid/too dark)
  assert.equal(matterIlluminance(0), 0);
  assert.equal(matterIlluminance(-5), 0);

  // 1 lux -> 10000 * log10(1) + 1 = 1
  assert.equal(matterIlluminance(1), 1);

  // 10 lux -> 10000 * 1 + 1 = 10001
  assert.equal(matterIlluminance(10), 10001);

  // 1000 lux -> 10000 * 3 + 1 = 30001
  assert.equal(matterIlluminance(1000), 30001);

  // Over limit (e.g. 1000000 lux) clamped to 65534
  assert.equal(matterIlluminance(1000000), 60001);
  assert.equal(matterIlluminance(1e9), 65534);
});

test("parseBgapiPacket: decodes Bluegiga BGAPI frames", () => {
  // BGAPI packet: 0x80 0x05 0x04 0x05 (Event, length 5, class 4 [Attribute Client], method 5 [Attribute Value])
  // connection: 0, handle: 20 (0x0014), type: 1 (notify), value: "A0:500"
  const payload = new TextEncoder().encode("A0:500");
  const packet = new Uint8Array(4 + 4 + payload.length);
  packet[0] = 0x80; // Event, MTU 0
  packet[1] = 4 + payload.length; // Length
  packet[2] = 0x04; // Attribute Client
  packet[3] = 0x05; // Attribute Value
  packet[4] = 0x00; // Connection
  packet[5] = 0x01; // Flags / type
  packet[6] = 0x14; // Handle LSB (20)
  packet[7] = 0x00; // Handle MSB
  packet.set(payload, 8);

  const parsed = parseBgapiPacket(packet);
  assert.equal(parsed.isEvent, true);
  assert.equal(parsed.classId, 4);
  assert.equal(parsed.methodId, 5);
  assert.equal(parsed.handle, 20);
  assert.equal(new TextDecoder().decode(parsed.data), "A0:500");
});

test("formatTinyduinoCommand: formats ASCII commands for UART / BLE write handle 17", () => {
  assert.equal(formatTinyduinoCommand("read_light"), "LIGHT\n");
  assert.equal(formatTinyduinoCommand("get_status"), "STATUS\n");
  assert.equal(formatTinyduinoCommand("set_led", { state: "ON" }), "LED_ON\n");
  assert.equal(
    formatTinyduinoCommand("set_led", { state: "OFF" }),
    "LED_OFF\n",
  );
  assert.equal(
    formatTinyduinoCommand("set_led", { state: "AUTO" }),
    "LED_AUTO\n",
  );
  assert.equal(
    formatTinyduinoCommand("stream_light", { rateMs: 250 }),
    "RATE:250\nSTREAM_ON\n",
  );
  assert.equal(formatTinyduinoCommand("stop_stream"), "STREAM_OFF\n");
});

test("createSimulatorState: generates simulated telemetry and state transitions", () => {
  const sim = createSimulatorState({ initialAdc: 512 });
  assert.equal(sim.getAdc(), 512);

  const res1 = sim.handleCommand("LIGHT\n");
  assert.ok(res1.startsWith("LIGHT:512"));

  sim.handleCommand("LED_ON\n");
  assert.equal(sim.getLedState(), "ON");

  sim.setAdc(103);
  const brightRes = sim.handleCommand("LIGHT\n");
  assert.ok(brightRes.startsWith("LIGHT:103"));
});

test("TinyduinoTransport: stream_light sends RATE and STREAM_ON as separate GATT packets and updates streaming state", async () => {
  const transport = new TinyduinoTransport();
  const writtenPackets = [];
  const notifyListeners = [];

  const mockWriteChar = {
    uuid: "5fc569a0-74a9-4fa4-b8b7-8354c86e45a4",
    properties: { write: true, writeWithoutResponse: false },
    writeValueWithResponse: async (data) => {
      const text = new TextDecoder().decode(data).trim();
      writtenPackets.push(text);
      // Simulate shadow-claw-light-meter.ino firmware single-command handler
      let reply = `ECHO:${text}`;
      if (text === "LIGHT") reply = "LIGHT:351 A0:351";
      else if (text.startsWith("RATE:") && !text.includes("\n")) {
        reply = `ACK:${text}`;
      } else if (text === "STREAM_ON") {
        reply = "ACK:STREAM_ON";
      } else if (text === "STREAM_OFF") {
        reply = "ACK:STREAM_OFF";
      }
      const replyBytes = new TextEncoder().encode(reply);
      const view = new DataView(replyBytes.buffer);
      setTimeout(() => {
        for (const fn of notifyListeners) {
          fn({ target: { value: view } });
        }
      }, 5);
    },
  };

  const mockNotifyChar = {
    uuid: "21819ab0-c937-4188-b0db-b9621e1696cd",
    properties: { notify: true },
    startNotifications: async () => {},
    addEventListener: (_evt, fn) => notifyListeners.push(fn),
    removeEventListener: (_evt, fn) => {
      const idx = notifyListeners.indexOf(fn);
      if (idx >= 0) notifyListeners.splice(idx, 1);
    },
  };

  // Simulate connected BLE state
  transport.mode = "connected";
  transport.transportType = "ble";
  transport.writeChar = mockWriteChar;
  transport.notifyChar = mockNotifyChar;
  mockNotifyChar.addEventListener("characteristicvaluechanged", (e) =>
    transport._onGattNotification(e),
  );

  await transport.sendCommand("stream_light", { rateMs: 250 });

  assert.deepEqual(
    writtenPackets,
    ["RATE:250", "STREAM_ON"],
    "stream_light must send RATE:250 and STREAM_ON as two separate GATT writes so shadow-claw-light-meter.ino enables telemetryEnabled",
  );
  assert.equal(transport.getState().streaming, true);
  assert.equal(transport.getState().streamRateMs, 250);

  await transport.sendCommand("stop_stream");
  assert.deepEqual(writtenPackets, ["RATE:250", "STREAM_ON", "STREAM_OFF"]);
  assert.equal(transport.getState().streaming, false);
});

test("TinyduinoTransport: sendCommand('stream_light') while disconnected rejects without flipping streaming to true", async () => {
  const transport = new TinyduinoTransport();
  assert.equal(transport.getState().mode, "disconnected");
  assert.equal(transport.getState().streaming, false);

  await assert.rejects(
    () => transport.sendCommand("stream_light", { rateMs: 500 }),
    /TinyDuino is not connected/,
  );

  assert.equal(
    transport.getState().streaming,
    false,
    "streaming must remain false when starting stream fails",
  );
});

test("TinyduinoTransport: auto-reconnects paired BLE device when BlueZ drops link before stream_light", async () => {
  const transport = new TinyduinoTransport({ settleDelayMs: 5 });
  const writtenPackets = [];
  const notifyListeners = [];
  let gattConnected = true;

  const mockWriteChar = {
    uuid: "5fc569a0-74a9-4fa4-b8b7-8354c86e45a4",
    properties: { write: true },
    writeValueWithResponse: async (data) => {
      const text = new TextDecoder().decode(data).trim();
      writtenPackets.push(text);
      const reply =
        text === "STREAM_ON"
          ? "ACK:STREAM_ON"
          : text.startsWith("RATE:")
            ? `ACK:${text}`
            : "LIGHT:352 A0:352";
      const bytes = new TextEncoder().encode(reply);
      const view = new DataView(bytes.buffer);
      setTimeout(() => {
        for (const fn of notifyListeners) {
          fn({ target: { value: view } });
        }
      }, 2);
    },
  };

  const mockNotifyChar = {
    uuid: "21819ab0-c937-4188-b0db-b9621e1696cd",
    properties: { notify: true },
    startNotifications: async () => {},
    addEventListener: (_evt, fn) => {
      if (!notifyListeners.includes(fn)) notifyListeners.push(fn);
    },
    removeEventListener: (_evt, fn) => {
      const idx = notifyListeners.indexOf(fn);
      if (idx >= 0) notifyListeners.splice(idx, 1);
    },
  };

  const mockService = {
    uuid: "195ae58a-437a-489b-b0cd-b7c9c394bae4",
    getCharacteristic: async (uuid) => {
      if (uuid === mockWriteChar.uuid) return mockWriteChar;
      if (uuid === mockNotifyChar.uuid) return mockNotifyChar;
      throw new Error("Not found");
    },
    getCharacteristics: async () => [mockWriteChar, mockNotifyChar],
  };

  const mockServer = {
    getPrimaryService: async () => mockService,
    getPrimaryServices: async () => [mockService],
  };

  const mockDevice = {
    name: "BGLib U1A1P 38.4NF",
    gatt: {
      get connected() {
        return gattConnected;
      },
      connect: async () => {
        gattConnected = true;
        return mockServer;
      },
      disconnect: () => {
        gattConnected = false;
      },
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  // Simulate an active BLE session where BlueZ transiently drops GATT
  transport.device = mockDevice;
  transport.deviceName = mockDevice.name;
  transport._userDisconnected = false;
  transport.mode = "disconnected"; // BlueZ dropped the link after Read Light Now
  gattConnected = false;

  // Now user clicks Start Live Stream: transport should auto-reconnect mockDevice and start stream!
  await transport.sendCommand("stream_light", { rateMs: 500 });

  assert.equal(transport.getState().mode, "connected");
  assert.equal(transport.getState().streaming, true);
  assert.deepEqual(writtenPackets, ["RATE:500", "STREAM_ON"]);
});
