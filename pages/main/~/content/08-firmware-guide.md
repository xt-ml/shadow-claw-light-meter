---
title: "Firmware Guide (shadow-claw-light-meter.ino & BGLib)"
created: "2026-11-03T11:50:00Z"
updated: "2026-11-03T20:00:00Z"
slug: "firmware-guide"
---

## TinyDuino Firmware Guide (`shadow-claw-light-meter.ino`)

The firmware running on the [TinyDuino Processor Board (`ASM2001 Rev 9`)](https://tinycircuits.com/collections/processors/products/tinyduino-processor-board?variant=14479557959) is located at `firmware/shadow-claw-light-meter/shadow-claw-light-meter.ino`. It coordinates the BLE112 BGAPI state machine, samples the KY-018 photoresistor, manages non-blocking telemetry streaming, and drives status LEDs.

---

### 1. Key Architectural Features

#### 4x Oversampled Analog Reader (`readLightSensor()`)

Analog inputs on the ATmega328P share a single internal 10-bit successive approximation ADC with an internal sample-and-hold capacitor (14 pF). Switching channels or reading high-impedance resistive dividers can introduce analog ghosting and capacitive voltage drop.

```cpp
uint16_t readLightSensor() {
  analogRead(LDR_ANALOG_PIN); // Dummy read to settle S/H capacitor
  delayMicroseconds(50);

  uint32_t sum = 0;
  for (uint8_t i = 0; i < 4; i++) {
    sum += analogRead(LDR_ANALOG_PIN);
    delayMicroseconds(25);
  }
  return (uint16_t)(sum >> 2); // 4x oversampled average
}
```

#### Non-Blocking Telemetry Streaming (`RATE:<ms>`)

To maintain responsive Bluetooth packet handling while streaming live data, `shadow-claw-light-meter.ino` avoids blocking delays (`delay()`):

- Default stream rate: 500ms (2 Hz).
- Supported dynamic rates: 250ms (4 Hz), 500ms (2 Hz), 1000ms (1 Hz), 2000ms (0.5 Hz).
- Stream messages: formatted as `A0:<val>` to fit comfortably within the 20-byte BLE 4.0 ATT MTU limit.

#### Dual Payload Framing Support

To guarantee compatibility with any Web Bluetooth client or proxy:

1. **Direct ASCII GATT Framing**: Standard text commands (e.g. `LIGHT`, `STATUS`, `LED_ON`).
2. **BGAPI-Wrapped Framing**: Handles 4-byte BGAPI framed commands (`[0x00, len, 0x02, 0x00] + payload`).

---

### 2. BGLib Host Library Submodule

The Silicon Labs BGAPI host library is integrated as a git submodule from [jrowberg/bglib](https://github.com/jrowberg/bglib) at `firmware/lib/bglib`:

- `firmware/lib/bglib/Arduino/BGLib.h` / `BGLib.cpp`: Core packet parser and packet generation methods.
- `firmware/lib/bglib/Arduino/BGLibConfig.h`: Buffer sizes and packet class enables.
- `LICENSE.md`: Silicon Labs / Jeff Rowberg MIT License.

To initialize the submodule after cloning:

```bash
git submodule update --init --recursive
```

The upload script (`bin/upload.sh`) automatically checks for and initializes the submodule if it is not yet populated.

---

### 3. Compilation & Flashing (`bin/upload.sh`)

```bash
# Verify compilation without flashing
npm run compile:firmware

# Compile and upload to TinyDuino on /dev/ttyUSB0
./bin/upload.sh /dev/ttyUSB0
```

---

⬅️ [Previous: Wokwi Simulation](/main/wokwi-simulation/) | ➡️ [Next: WebMCP Sensory Tools](/main/webmcp-tools/)
