/**
 * .agents/scripts/tinyduino-ble.js
 *
 * Web Bluetooth GATT, Web Serial, and Simulator Transport for TinyDuino.
 * Manages serialized GATT command queue, 300ms CCCD settle delay, auto-reconnect,
 * and state notifications.
 */

import {
  parseA0Telemetry,
  computeLightPhysics,
  matterIlluminance,
  parseBgapiPacket,
  formatTinyduinoCommand,
  createSimulatorState,
  DEFAULT_KY018_CONFIG,
} from "./tinyduino.js";

export const PROFILES = {
  bglib: {
    name: "BGLib Data Transceiver",
    service: "195ae58a-437a-489b-b0cd-b7c9c394bae4",
    writeChars: [
      "5fc569a0-74a9-4fa4-b8b7-8354c86e45a4", // Handle 17 (0x11) c_rx_data
      "688bf288-0489-41cf-b6c1-d95209082d2e", // c_unack
    ],
    notifyChars: [
      "21819ab0-c937-4188-b0db-b9621e1696cd", // Handle 20 (0x14) c_tx_data
      "5fc569a0-74a9-4fa4-b8b7-8354c86e45a4",
      "688bf288-0489-41cf-b6c1-d95209082d2e",
    ],
  },
  cable: {
    name: "Bluegiga Cable Replacement",
    service: "713d0000-503e-4c75-ba94-3148f18d941e",
    writeChars: ["713d0003-503e-4c75-ba94-3148f18d941e"],
    notifyChars: ["713d0002-503e-4c75-ba94-3148f18d941e"],
  },
};

export const ALL_OPTIONAL_SERVICES = [
  PROFILES.bglib.service,
  PROFILES.cable.service,
  "00001800-0000-1000-8000-00805f9b34fb",
  "0000180a-0000-1000-8000-00805f9b34fb",
];

export class TinyduinoTransport extends EventTarget {
  constructor(options = {}) {
    super();
    this._settleDelayMs =
      options.settleDelayMs !== undefined ? options.settleDelayMs : 300;
    this.device = null;
    this.server = null;
    this.writeChar = null;
    this.notifyChar = null;
    this.serialPort = null;
    this.serialReader = null;
    this.simState = null;
    this.simTimer = null;

    this._userDisconnected = false;
    this._reconnecting = false;
    this._reconnectingPromise = null;
    this._boundOnGattDisconnected = () => this._handleGattDisconnected();
    this._boundOnGattNotification = (e) => this._onGattNotification(e);

    this.mode = "disconnected"; // disconnected | connecting | connected | simulated
    this.transportType = "none"; // none | ble | serial | sim
    this.deviceName = null;
    this.packetCount = 0;
    this.lastAck = "--";
    this.streaming = false;
    this.streamRateMs = 500;
    this.polarity = "high_adc_bright";

    // Telemetry state
    this.rawA0 = null;
    this.voltage = null;
    this.percent = null;
    this.lux = null;
    this.ldrKohm = null;
    this.category = "Waiting A0…";
    this.minA0 = null;
    this.maxA0 = null;
    this.sampleCount = 0;
    this.encoder = 0;
    this.ledMode = "AUTO";
    this.history = []; // last 60 samples: { timestamp, rawA0, percent, lux }

    // Packet log
    this.packetLog = [];

    // Internal GATT command queue
    this._queue = [];
    this._busy = false;
    this._pendingReply = null;

    if (
      typeof window !== "undefined" &&
      typeof window.addEventListener === "function"
    ) {
      window.addEventListener("pagehide", () => {
        if (this.device && this.device.gatt && this.device.gatt.connected) {
          try {
            this.device.gatt.disconnect();
          } catch (_) {}
        }
      });
    }
  }

  getState() {
    return {
      mode: this.mode,
      transportType: this.transportType,
      deviceName: this.deviceName,
      packetCount: this.packetCount,
      lastAck: this.lastAck,
      streaming: this.streaming,
      streamRateMs: this.streamRateMs,
      polarity: this.polarity,
      rawA0: this.rawA0,
      voltage: this.voltage,
      percent: this.percent,
      lux: this.lux,
      ldrKohm: this.ldrKohm,
      matterIlluminance: matterIlluminance(this.lux),
      category: this.category,
      minA0: this.minA0,
      maxA0: this.maxA0,
      sampleCount: this.sampleCount,
      encoder: this.encoder,
      ledMode: this.ledMode,
      history: [...this.history],
    };
  }

  logPacket(direction, text, hex = null) {
    const entry = {
      timestamp: new Date().toLocaleTimeString(),
      direction,
      text,
      hex:
        hex ||
        (text
          ? Array.from(new TextEncoder().encode(text))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join(" ")
          : ""),
    };
    this.packetLog.push(entry);
    if (this.packetLog.length > 200) this.packetLog.shift();
    this.dispatchEvent(new CustomEvent("packet", { detail: entry }));
  }

  _notifyStateChange() {
    this.dispatchEvent(
      new CustomEvent("statechange", { detail: this.getState() }),
    );
  }

  _recordA0(rawVal, enc = null) {
    this.rawA0 = rawVal;
    if (enc !== null) this.encoder = enc;
    if (this.minA0 === null || rawVal < this.minA0) this.minA0 = rawVal;
    if (this.maxA0 === null || rawVal > this.maxA0) this.maxA0 = rawVal;
    this.sampleCount++;

    const phys = computeLightPhysics({
      rawAdc: rawVal,
      polarity: this.polarity,
    });
    this.voltage = phys.voltage;
    this.percent = phys.percent;
    this.lux = phys.lux;
    this.ldrKohm = phys.ldrKohm;
    this.category = phys.category;

    this.history.push({
      timestamp: Date.now(),
      rawA0: rawVal,
      percent: phys.percent,
      lux: phys.lux,
      ldrKohm: phys.ldrKohm,
    });
    if (this.history.length > 60) this.history.shift();

    this._notifyStateChange();
  }

  async _discoverGattChannels(server) {
    let service = null;
    let writeChar = null;
    let notifyChar = null;

    // 1. Try primary service scan if supported (matches blue/index.html)
    if (typeof server.getPrimaryServices === "function") {
      try {
        const services = await server.getPrimaryServices();
        for (const s of services) {
          const sUuid = (s.uuid || "").toLowerCase();
          if (sUuid.startsWith("00001800") || sUuid.startsWith("0000180a")) {
            continue;
          }
          service = s;
          if (typeof s.getCharacteristics === "function") {
            const chars = await s.getCharacteristics();
            for (const c of chars) {
              const cUuid = (c.uuid || "").toLowerCase();
              if (
                PROFILES.bglib.writeChars.includes(cUuid) ||
                PROFILES.cable.writeChars.includes(cUuid)
              ) {
                if (!writeChar) writeChar = c;
              }
              if (
                PROFILES.bglib.notifyChars.includes(cUuid) ||
                PROFILES.cable.notifyChars.includes(cUuid)
              ) {
                if (
                  !notifyChar &&
                  (!c.properties ||
                    c.properties.notify ||
                    c.properties.indicate)
                ) {
                  notifyChar = c;
                }
              }
            }
            for (const c of chars) {
              if (
                !writeChar &&
                c.properties &&
                (c.properties.write || c.properties.writeWithoutResponse)
              ) {
                writeChar = c;
              }
              if (
                !notifyChar &&
                c.properties &&
                (c.properties.notify ||
                  c.properties.indicate ||
                  c.properties.read)
              ) {
                notifyChar = c;
              }
            }
          }
          if (writeChar && notifyChar) break;
        }
      } catch (_) {}
    }

    // 2. Direct UUID lookup fallback
    if (!service && typeof server.getPrimaryService === "function") {
      try {
        service = await server.getPrimaryService(PROFILES.bglib.service);
      } catch (_) {
        service = await server.getPrimaryService(PROFILES.cable.service);
      }
    }

    if (
      service &&
      (!writeChar || !notifyChar) &&
      typeof service.getCharacteristic === "function"
    ) {
      if (!writeChar) {
        for (const charUuid of [
          ...PROFILES.bglib.writeChars,
          ...PROFILES.cable.writeChars,
        ]) {
          try {
            writeChar = await service.getCharacteristic(charUuid);
            if (writeChar) break;
          } catch (_) {}
        }
      }
      if (!notifyChar) {
        for (const charUuid of [
          ...PROFILES.bglib.notifyChars,
          ...PROFILES.cable.notifyChars,
        ]) {
          try {
            notifyChar = await service.getCharacteristic(charUuid);
            if (notifyChar) break;
          } catch (_) {}
        }
      }
    }

    return { service, writeChar, notifyChar };
  }

  async _setupGattSession(server) {
    const { writeChar, notifyChar } = await this._discoverGattChannels(server);

    if (!writeChar || !notifyChar) {
      throw new Error(
        "Required GATT characteristics (write handle 17 / notify handle 20) not found.",
      );
    }

    this.server = server;
    this.writeChar = writeChar;
    this.notifyChar = notifyChar;

    await this.notifyChar.startNotifications();
    if (typeof this.notifyChar.removeEventListener === "function") {
      this.notifyChar.removeEventListener(
        "characteristicvaluechanged",
        this._boundOnGattNotification,
      );
    }
    this.notifyChar.addEventListener(
      "characteristicvaluechanged",
      this._boundOnGattNotification,
    );

    // CRITICAL: 300ms CCCD settling delay before initial write to avoid BlueZ unknown error
    if (this._settleDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this._settleDelayMs));
    }

    this.mode = "connected";
    this.transportType = "ble";
    this._notifyStateChange();
  }

  async _reconnectBle() {
    if (!this.device || !this.device.gatt || this._userDisconnected) {
      return false;
    }
    if (this._reconnectingPromise) {
      return await this._reconnectingPromise;
    }

    this._reconnectingPromise = (async () => {
      this._reconnecting = true;
      try {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            if (this._settleDelayMs > 0) {
              await new Promise((r) =>
                setTimeout(r, Math.min(250, this._settleDelayMs)),
              );
            }
            const freshServer = await this.device.gatt.connect();
            await this._setupGattSession(freshServer);
            this.logPacket(
              "SYS",
              `Connected to ${this.deviceName || "BLE112"} (GATT session active).`,
            );
            return true;
          } catch (_) {}
        }
        return false;
      } finally {
        this._reconnecting = false;
        this._reconnectingPromise = null;
      }
    })();

    return await this._reconnectingPromise;
  }

  async _handleGattDisconnected() {
    if (this._reconnecting) return;

    this.writeChar = null;
    this.notifyChar = null;
    this.server = null;

    if (this._userDisconnected) {
      this._onDisconnected({ clearDevice: true });
      return;
    }

    const wasStreaming = this.streaming;
    const savedRate = this.streamRateMs;
    this.logPacket(
      "SYS",
      "BLE GATT connection interrupted — attempting automatic reconnect…",
    );

    const restored = await this._reconnectBle();
    if (restored) {
      if (wasStreaming) {
        try {
          await this.sendCommand("stream_light", { rateMs: savedRate });
        } catch (_) {}
      }
      return;
    }

    // Keep this.device so a subsequent command click can still reconnect without chooser
    this._onDisconnected({ clearDevice: false });
  }

  // --- Web Bluetooth Connection ---
  async connectBle() {
    if (typeof navigator === "undefined" || !navigator.bluetooth) {
      const isLinux =
        typeof navigator !== "undefined" && /Linux/i.test(navigator.userAgent);
      const isChrome =
        typeof navigator !== "undefined" &&
        /Chrome|Chromium/i.test(navigator.userAgent);
      const hint =
        isLinux && isChrome
          ? " On Linux, Chrome requires enabling chrome://flags/#enable-web-bluetooth."
          : "";
      const err = new Error(
        `Web Bluetooth is not supported or enabled in this browser.${hint}`,
      );
      err.name = "BluetoothUnsupportedError";
      throw err;
    }

    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }

    this._userDisconnected = false;
    this.mode = "connecting";
    this._notifyStateChange();

    try {
      const selectedDevice = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: "BGLib" },
          { namePrefix: "TinyDuino" },
          { namePrefix: "BLE112" },
          { namePrefix: "Bluegiga" },
          { namePrefix: "My Arduino" },
          { services: [PROFILES.bglib.service] },
          { services: [PROFILES.cable.service] },
        ],
        optionalServices: ALL_OPTIONAL_SERVICES,
      });

      if (
        this.device &&
        typeof this.device.removeEventListener === "function"
      ) {
        this.device.removeEventListener(
          "gattserverdisconnected",
          this._boundOnGattDisconnected,
        );
      }

      this.device = selectedDevice;
      this.deviceName = this.device.name || "TinyShield BLE112";

      // If BlueZ still holds a cached connection from before a page reload, clear it first
      if (this.device.gatt && this.device.gatt.connected) {
        this.logPacket("SYS", "Clearing previous BlueZ GATT session…");
        this._reconnecting = true;
        try {
          this.device.gatt.disconnect();
        } catch (_) {}
        if (this._settleDelayMs > 0) {
          await new Promise((r) =>
            setTimeout(r, Math.min(250, this._settleDelayMs)),
          );
        }
        this._reconnecting = false;
      }

      this.device.addEventListener(
        "gattserverdisconnected",
        this._boundOnGattDisconnected,
      );

      const server = await this.device.gatt.connect();
      await this._setupGattSession(server);
      this.logPacket(
        "SYS",
        `Connected to "${this.deviceName}" — requesting initial A0 light reading…`,
      );

      // Read initial light reading
      await this.sendCommand("read_light");
      return this.getState();
    } catch (err) {
      this._onDisconnected({ clearDevice: false });
      throw err;
    }
  }

  _onGattNotification(event) {
    const value = event.target.value;
    const bytes = new Uint8Array(
      value.buffer,
      value.byteOffset,
      value.byteLength,
    );
    this.packetCount++;

    // Unwrap 4-byte BGAPI Attribute Event header if present
    let payloadBytes = bytes;
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x80 &&
      bytes[2] === 0x02 &&
      bytes[1] === bytes.length - 4
    ) {
      payloadBytes = bytes.subarray(4);
    }

    // Decode as ASCII
    const text = new TextDecoder().decode(payloadBytes).trim();
    this.logPacket("RX", text);

    const parsed = parseA0Telemetry(text);
    if (parsed) {
      this._recordA0(parsed.rawAdc, parsed.encoder);
    }

    if (
      text.startsWith("ACK:") ||
      text.startsWith("STATUS") ||
      text.startsWith("PONG")
    ) {
      this.lastAck = text;
      if (text.includes("STREAM_ON")) this.streaming = true;
      if (text.includes("STREAM_OFF")) this.streaming = false;
      if (text.includes("LED ON") || text.includes("LED_ON"))
        this.ledMode = "ON";
      if (text.includes("LED OFF") || text.includes("LED_OFF"))
        this.ledMode = "OFF";
      if (text.includes("LED AUTO") || text.includes("LED_AUTO"))
        this.ledMode = "AUTO";
      if (text.includes("LED_LIGHT") || text.includes("LED:LDR")) {
        this.ledMode = "NIGHTLIGHT";
      }
      this._notifyStateChange();
    }

    if (this._pendingReply) {
      this._pendingReply.resolve(text);
      this._pendingReply = null;
    }
  }

  _onDisconnected({ clearDevice = false } = {}) {
    this.mode = "disconnected";
    this.transportType = "none";
    this.streaming = false;
    this.writeChar = null;
    this.notifyChar = null;
    this.server = null;
    if (clearDevice) {
      this.device = null;
    }
    this._notifyStateChange();
  }

  async disconnect() {
    this._userDisconnected = true;
    this.streaming = false;
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      try {
        this.device.gatt.disconnect();
      } catch (_) {}
    }
    this._onDisconnected({ clearDevice: true });
    return this.getState();
  }

  // --- Hardware Simulation ---
  _restartSimTimer() {
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
    if (this.mode !== "simulated") return;
    this.simTimer = setInterval(() => {
      if (this.mode !== "simulated") return;
      const current = this.simState.getAdc();
      const delta = Math.floor(Math.random() * 15) - 7;
      const nextAdc = Math.max(80, Math.min(950, current + delta));
      this.simState.setAdc(nextAdc);

      if (this.streaming) {
        this._recordA0(nextAdc);
        this.logPacket("RX", `A0:${nextAdc} ENC:${this.encoder}`);
      }
    }, this.streamRateMs);
  }

  toggleSimulation(enable) {
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }

    if (!enable) {
      this._onDisconnected({ clearDevice: false });
      return this.getState();
    }

    this.simState = createSimulatorState({ initialAdc: 547 });
    this.mode = "simulated";
    this.transportType = "sim";
    this.deviceName = "TinyDuino (Simulated Hardware)";
    this._notifyStateChange();

    this._restartSimTimer();
    this.sendCommand("read_light");
    return this.getState();
  }

  // --- Command Execution & Queue ---
  async sendCommand(name, params = {}, timeoutMs = 1500) {
    if (name === "stream_light") {
      const rateMs = Math.max(
        50,
        Math.min(5000, Number(params.rateMs) || this.streamRateMs || 500),
      );
      this.streamRateMs = rateMs;
      const cmdText = formatTinyduinoCommand("stream_light", { rateMs });
      const res = await this.sendRawText(cmdText, timeoutMs);
      this.streaming = true;
      if (this.mode === "simulated") {
        this._restartSimTimer();
      }
      this._notifyStateChange();
      return {
        ...res,
        ...this.getState(),
      };
    }

    if (name === "stop_stream") {
      const cmdText = formatTinyduinoCommand("stop_stream", params);
      const res = await this.sendRawText(cmdText, timeoutMs);
      this.streaming = false;
      this._notifyStateChange();
      return {
        ...res,
        ...this.getState(),
      };
    }

    const cmdText = formatTinyduinoCommand(name, params);
    return await this.sendRawText(cmdText, timeoutMs);
  }

  async sendRawText(cmdText, timeoutMs = 1500) {
    // If BlueZ dropped the BLE link transiently, auto-reconnect the paired device
    if (
      this.mode === "disconnected" &&
      this.device &&
      !this._userDisconnected
    ) {
      await this._reconnectBle();
    }

    if (this.mode === "disconnected") {
      throw new Error(
        "TinyDuino is not connected. Connect Web Bluetooth or activate Simulation first.",
      );
    }

    // Split multi-line commands (such as "RATE:500\nSTREAM_ON\n") into individual
    // packets because shadow-claw-light-meter.ino parses one command per GATT Handle 17 write.
    const commands = String(cmdText)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (commands.length === 0) {
      return { ok: true, command: "", reply: "ACK", ...this.getState() };
    }

    let lastResult = null;
    for (const singleCmd of commands) {
      lastResult = await this._sendSingleCommand(singleCmd, timeoutMs);
    }
    return lastResult;
  }

  async _sendSingleCommand(cleanCmd, timeoutMs = 1500) {
    this.logPacket("TX", cleanCmd);

    const upper = cleanCmd.toUpperCase();
    if (upper.startsWith("RATE:")) {
      const r = parseInt(upper.slice(5), 10);
      if (r >= 50 && r <= 10000) {
        this.streamRateMs = r;
        if (this.mode === "simulated") this._restartSimTimer();
      }
    }

    if (this.mode === "simulated") {
      const reply = this.simState.handleCommand(cleanCmd);
      const cleanReply = reply.trim();
      this.logPacket("RX", cleanReply);
      const parsed = parseA0Telemetry(cleanReply);
      if (parsed) {
        this._recordA0(parsed.rawAdc, parsed.encoder);
      }
      this.lastAck = cleanReply;
      if (upper === "STREAM_ON") this.streaming = true;
      if (upper === "STREAM_OFF") this.streaming = false;
      this._notifyStateChange();
      return {
        ok: true,
        command: cleanCmd,
        reply: cleanReply,
        ...this.getState(),
      };
    }

    if (!this.writeChar && this.device && !this._userDisconnected) {
      await this._reconnectBle();
    }

    if (!this.writeChar) {
      throw new Error("Write characteristic not available.");
    }

    // Serialized execution through queue
    return new Promise((resolve, reject) => {
      this._queue.push({
        cmdText: cleanCmd,
        timeoutMs,
        resolve,
        reject,
      });
      this._processQueue();
    });
  }

  async _performSingleGattWrite(data) {
    if (!this.writeChar) {
      throw new Error("Write characteristic not available.");
    }
    if (
      this.writeChar.properties &&
      this.writeChar.properties.writeWithoutResponse &&
      !this.writeChar.properties.write &&
      typeof this.writeChar.writeValueWithoutResponse === "function"
    ) {
      await this.writeChar.writeValueWithoutResponse(data);
    } else if (typeof this.writeChar.writeValueWithResponse === "function") {
      await this.writeChar.writeValueWithResponse(data);
    } else {
      await this.writeChar.writeValue(data);
    }
  }

  async _processQueue() {
    if (this._busy || this._queue.length === 0) return;
    this._busy = true;

    const item = this._queue.shift();
    const encoder = new TextEncoder();
    const data = encoder.encode(item.cmdText);

    const createWaiter = () => {
      let timer = null;
      const promise = new Promise((resolve) => {
        this._pendingReply = { resolve };
        timer = setTimeout(() => {
          this._pendingReply = null;
          resolve(null); // timed out awaiting notification
        }, item.timeoutMs);
      });
      return { promise, clear: () => timer && clearTimeout(timer) };
    };

    let waiter = createWaiter();

    try {
      try {
        await this._performSingleGattWrite(data);
      } catch (writeErr) {
        waiter.clear();
        this._pendingReply = null;
        // Refresh stale BlueZ GATT session and retry once (matching blue/index.html)
        if (this.device && !this._userDisconnected) {
          this.logPacket(
            "SYS",
            `GATT write error (${writeErr.message}) — refreshing BlueZ GATT session…`,
          );
          const refreshed = await this._reconnectBle();
          if (!refreshed) throw writeErr;
          waiter = createWaiter();
          await this._performSingleGattWrite(data);
        } else {
          throw writeErr;
        }
      }

      const reply = await waiter.promise;
      waiter.clear();

      const upper = item.cmdText.trim().toUpperCase();
      if (upper === "STREAM_ON") this.streaming = true;
      if (upper === "STREAM_OFF") this.streaming = false;
      this._notifyStateChange();

      item.resolve({
        ok: true,
        command: item.cmdText.trim(),
        reply: reply || "ACK",
        ...this.getState(),
      });
    } catch (err) {
      waiter.clear();
      this._pendingReply = null;
      item.reject(err);
    } finally {
      this._busy = false;
      this._processQueue();
    }
  }

  setPolarity(pol) {
    this.polarity =
      pol === "low_adc_bright" || pol === "inverted"
        ? "low_adc_bright"
        : "high_adc_bright";
    if (this.rawA0 !== null) {
      this._recordA0(this.rawA0, this.encoder);
    }
  }
}

// Global Singleton for persistence across ShadowClaw page transitions
if (!globalThis.__tinyduino) {
  globalThis.__tinyduino = new TinyduinoTransport();
}

export const tinyduino = globalThis.__tinyduino;
