---
title: "Field Diagnostics & Architecture Audit"
created: "2026-11-03T11:50:00Z"
updated: "2026-11-03T15:45:00Z"
slug: "field-diagnostics"
---

## Hardware Bring-Up & Field Diagnostics

This chapter documents the chronological bring-up of the **TinyDuino (`ASM2001`)** processor and the **Bluegiga BLE112 (`ASD2112 Rev 2`)** shield, analyzing the architectural hurdles encountered when connecting a classic Bluetooth Smart module to modern Web Bluetooth.

---

### 1. Hardware Verification & Boot Sign of Life

We assembled the physical stack:

1. [TinyDuino Processor Board (`ASM2001 Rev 9`)](https://tinycircuits.com/collections/processors/products/tinyduino-processor-board?variant=14479557959) (ATmega328P @ 3.3V, 8 MHz)
2. [USB TinyShield (`ASD2101 Rev 6`)](https://tinycircuits.com/products/usb-tinyshield?variant=14982646535) (FTDI FT231X UART)
3. [Bluetooth Low Energy TinyShield (`ASD2112 Rev 2`)](https://learn.tinycircuits.com/Obsolete/BLE-bluegiga_TinyShield_Tutorial/) (Bluegiga BLE112)
4. [Proto Board TinyShield (`ASD2009 Rev 1`)](https://tinycircuits.com/products/proto-board-tinyshield?variant=14984618887)

In the initial hardware bring-up test, we configured `SoftwareSerial bleSerialPort(3, 4)` at 38,400 baud and sent 4-byte `system_hello` packets (`00 00 00 01`) to wake the BLE112. The module responded with a 16-byte boot frame:

```text
Raw Hex Data: 80 0C 00 00 01 00 01 00 01 00 47 00 03 00 01 01
```

Decoding confirmed that the hardware level shifters, clocks, and ATmega328P communication were operational:

- `80`: Event packet
- `0C`: 12-byte payload length
- `00 00`: System class, `system_boot` event
- Firmware version: `1.1.1`, build `0x0047` (71), protocol `0x01`, hardware `0x01`.

---

### 2. The GATT Architecture & Profile Discovery

Over the air, Web Bluetooth does not communicate via raw UART streams. Instead, Chrome reads and writes GATT characteristics hosted inside the BLE112 module's internal GATT table (`gatt.xml`):

1. **Host-to-Arduino (Write)**: Chrome writes to Characteristic Handle `17` (`c_rx_data`). The BLE112 encapsulates the bytes into a BGAPI `ble_evt_attributes_value` frame and sends it over `SoftwareSerial(3, 4)` to the ATmega328P.
2. **Arduino-to-Host (Notify)**: The ATmega328P issues `ble_cmd_attributes_write(20, ...)` over UART to Characteristic Handle `20` (`c_tx_data`), which triggers a Bluetooth GATT notification in Chrome.

#### Service UUID Differences

Documentation often references the Cable Replacement profile (`713d0000-...`), but the pre-flashed firmware on the TinyShield utilizes Jeff Rowberg's **BGLib Data Transceiver**:

- Service: `195ae58a-437a-489b-b0cd-b7c9c394bae4`
- RX Handle 17: `5fc569a0-74a9-4fa4-b8b7-8354c86e45a4`
- TX Handle 20: `21819ab0-c937-4188-b0db-b9621e1696cd`

The workbench implements auto-discovery covering both UUID sets.

---

### 3. Why the BLE112 Doesn't Advertise Automatically

A key discovery during initial tests was that clicking **Connect Web Bluetooth** reported:

> _"No compatible devices found."_

Unlike basic transparent BLE bridges (e.g. HM-10), the Bluegiga BLE112 powers up into `BLE_STATE_STANDBY` with its radio off. It will never transmit advertising beacons until the host ATmega328P sends the BGAPI command:

```c
ble_cmd_gap_set_mode(BGLIB_GAP_GENERAL_DISCOVERABLE, BGLIB_GAP_UNDIRECTED_CONNECTABLE);
```

---

### 4. USB Serial "Break Received" Handling

When connecting Chrome's Web Serial monitor to `/dev/ttyUSB0`, the FTDI chip toggles `DTR` to reset the processor, generating a serial break signal on the line. Standard `ReadableStream.pipeTo` pipelines crash when encountering this break condition. The workbench uses a resilient reader loop that absorbs break signals and seamlessly reconnects once the Optiboot bootloader yields control to the sketch.

---

⬅️ [Previous: KY-018 Calibration](/main/ky018-calibration/) | ➡️ [Next: Voltage Divider Derivation & Math Proof](/main/divider-math/)
