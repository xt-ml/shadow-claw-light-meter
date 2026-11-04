/**
 * .agents/scripts/tinyduino.js
 *
 * Core pure logic for TinyDuino + BLE112 + KY-018 LightMeter.
 * Decoupled ESM module with zero DOM or Web Bluetooth dependencies.
 */

export const DEFAULT_KY018_CONFIG = Object.freeze({
  vcc: 3.3,
  rPullup: 10000,
  adcMax: 1023,
  polarity: "high_adc_bright",
});

/**
 * Parses ASCII telemetry lines sent by TinyDuino firmware (shadow-claw-light-meter.ino).
 * @param {string} text
 * @returns {{ rawAdc: number, encoder: number|null, format: string } | null}
 */
export function parseA0Telemetry(text) {
  if (typeof text !== "string") return null;
  const line = text.trim();
  if (!line) return null;

  // 1. "LIGHT:547"
  const mLight = line.match(/^LIGHT:(\d+)/i);
  if (mLight) {
    return { rawAdc: parseInt(mLight[1], 10), encoder: null, format: "LIGHT" };
  }

  // 2. "A0:103 ENC:0" or "A0:103"
  const mA0 = line.match(/^A0:(\d+)(?:\s+ENC:(-?\d+))?/i);
  if (mA0) {
    return {
      rawAdc: parseInt(mA0[1], 10),
      encoder: mA0[2] !== undefined ? parseInt(mA0[2], 10) : null,
      format: "A0_ENC",
    };
  }

  // 3. "ACK:READ_A0 250"
  const mAck = line.match(/^ACK:READ_A0\s+(\d+)/i);
  if (mAck) {
    return { rawAdc: parseInt(mAck[1], 10), encoder: null, format: "ACK_READ" };
  }

  // 4. Standalone ADC integer: "103"
  const mNum = line.match(/^\b(\d{1,4})\b$/);
  if (mNum) {
    const val = parseInt(mNum[1], 10);
    if (val <= 1023) {
      return { rawAdc: val, encoder: null, format: "RAW_NUMBER" };
    }
  }

  return null;
}

/**
 * Computes physical voltage, percentage, lux, and category from raw ADC reading.
 * Uses the KY-018 voltage divider physical model derived from live hardware bring-up:
 *   High Side (+3.3V to S): CdS Photoresistor (R_LDR)
 *   Low Side (S to GND): Fixed 10kΩ pull-down resistor
 *
 *   V_A0 = V_CC * 10kΩ / (R_LDR + 10kΩ)
 *   ADC = 1023 * 10kΩ / (R_LDR + 10kΩ)
 *   R_LDR = 10kΩ * (1023 - effAdc) / effAdc
 *   Lux ≈ 150 * (10kΩ / R_LDR)^1.35 = 150 * (effAdc / (1023 - effAdc))^1.35
 *
 * @param {object} opts
 * @param {number} opts.rawAdc
 * @param {"high_adc_bright"|"low_adc_bright"|"direct"|"inverted"} [opts.polarity]
 * @param {number} [opts.vcc]
 * @param {number} [opts.rPullup]
 * @param {number} [opts.adcMax]
 */
export function computeLightPhysics({
  rawAdc,
  polarity = "high_adc_bright",
  vcc = 3.3,
  rPullup = 10000,
  adcMax = 1023,
}) {
  const clampedAdc = Math.max(0, Math.min(adcMax, Number(rawAdc) || 0));
  const voltage = (clampedAdc / adcMax) * vcc;

  const isInverted = polarity === "low_adc_bright" || polarity === "inverted";
  const effAdc = isInverted ? adcMax - clampedAdc : clampedAdc;

  // LDR resistance in kΩ
  let ldrKohm;
  let lux;
  if (effAdc <= 0) {
    ldrKohm = Infinity;
    lux = 0;
  } else if (effAdc >= adcMax) {
    ldrKohm = 0;
    lux = 5000;
  } else {
    ldrKohm = (rPullup / 1000) * ((adcMax - effAdc) / effAdc);
    const rawLux = Math.round(150 * Math.pow(10 / ldrKohm, 1.35));
    lux = Math.max(0, Math.min(9999, rawLux));
  }

  const percent = Math.max(
    0,
    Math.min(100, Math.round((effAdc / adcMax) * 100)),
  );

  let category;
  if (percent >= 80) {
    category = "direct_sun";
  } else if (percent >= 50) {
    category = "daylight";
  } else if (percent >= 25) {
    category = "indoor";
  } else if (percent >= 10) {
    category = "dark_indoor";
  } else {
    category = "night";
  }

  return {
    rawAdc: clampedAdc,
    voltage,
    percent,
    lux,
    ldrKohm: Number.isFinite(ldrKohm)
      ? Number(ldrKohm.toFixed(ldrKohm < 10 ? 2 : 1))
      : Infinity,
    category,
    polarity: isInverted ? "low_adc_bright" : "high_adc_bright",
  };
}

/**
 * Scales lux to Matter 0x0400 cluster MeasuredValue (10000 * log10(lux) + 1).
 * Clamped to 1..65534. Returns 0 if lux <= 0.
 * @param {number} lux
 * @returns {number}
 */
export function matterIlluminance(lux) {
  if (typeof lux !== "number" || lux <= 0 || isNaN(lux)) {
    return 0;
  }
  const scaled = Math.round(10000 * Math.log10(lux)) + 1;
  return Math.max(1, Math.min(65534, scaled));
}

/**
 * Decodes Bluegiga BGAPI binary packet headers and payload.
 * @param {Uint8Array} bytes
 */
export function parseBgapiPacket(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 4) {
    return null;
  }
  const isEvent = (bytes[0] & 0x80) !== 0;
  const payloadLen = ((bytes[0] & 0x07) << 8) | bytes[1];
  const classId = bytes[2];
  const methodId = bytes[3];

  let handle = null;
  let connection = null;
  let data = new Uint8Array(0);

  // Class 4 = Attribute Client, Method 5 = Attribute Value (Notification/Indication)
  if (classId === 4 && methodId === 5 && bytes.length >= 8) {
    connection = bytes[4];
    handle = bytes[6] | (bytes[7] << 8);
    data = bytes.slice(8);
  } else if (bytes.length > 4) {
    data = bytes.slice(4);
  }

  return {
    isEvent,
    payloadLen,
    classId,
    methodId,
    connection,
    handle,
    data,
  };
}

/**
 * Formats a command string to send to TinyDuino via handle 17.
 * @param {string} name
 * @param {object} [params]
 * @returns {string}
 */
export function formatTinyduinoCommand(name, params = {}) {
  switch (name) {
    case "read_light":
      return "LIGHT\n";
    case "get_status":
      return "STATUS\n";
    case "set_led": {
      const state = String(params.state || "AUTO").toUpperCase();
      if (state === "ON") return "LED_ON\n";
      if (state === "OFF") return "LED_OFF\n";
      return "LED_AUTO\n";
    }
    case "stream_light": {
      const rateMs = Math.max(50, Math.min(5000, Number(params.rateMs) || 500));
      return `RATE:${rateMs}\nSTREAM_ON\n`;
    }
    case "stop_stream":
      return "STREAM_OFF\n";
    case "ping":
      return "PING\n";
    case "reset_encoder":
      return "ENC_RESET\n";
    default:
      return `${name}\n`;
  }
}

/**
 * Creates in-memory state for simulator and offline testing.
 * @param {object} [options]
 */
export function createSimulatorState(options = {}) {
  let adc = options.initialAdc !== undefined ? options.initialAdc : 512;
  let encoder = 0;
  let ledState = "AUTO";
  let streaming = false;
  let streamInterval = 500;

  return {
    getAdc: () => adc,
    setAdc: (val) => {
      adc = Math.max(0, Math.min(1023, Math.round(val)));
    },
    getEncoder: () => encoder,
    setEncoder: (val) => {
      encoder = val;
    },
    getLedState: () => ledState,
    isStreaming: () => streaming,
    handleCommand: (cmdText) => {
      const clean = String(cmdText).trim().toUpperCase();
      if (clean === "LIGHT") {
        return `LIGHT:${adc}\n`;
      }
      if (clean === "STATUS") {
        return `STATUS LED:${ledState} A0:${adc} ENC:${encoder} STRM:${streaming ? 1 : 0}\n`;
      }
      if (clean === "LED_ON") {
        ledState = "ON";
        return "ACK:LED ON\n";
      }
      if (clean === "LED_OFF") {
        ledState = "OFF";
        return "ACK:LED OFF\n";
      }
      if (clean === "LED_AUTO") {
        ledState = "AUTO";
        return "ACK:LED AUTO\n";
      }
      if (clean === "STREAM_ON") {
        streaming = true;
        return "ACK:STREAM_ON\n";
      }
      if (clean === "STREAM_OFF") {
        streaming = false;
        return "ACK:STREAM_OFF\n";
      }
      if (clean.startsWith("RATE:")) {
        streamInterval = parseInt(clean.slice(5), 10) || 500;
        return `ACK:RATE ${streamInterval}\n`;
      }
      if (clean === "PING") {
        return "PONG\n";
      }
      if (clean === "ENC_RESET") {
        encoder = 0;
        return "ACK:ENC_RESET\n";
      }
      return `ACK:${clean}\n`;
    },
  };
}
