---
title: "Troubleshooting & Diagnostics"
created: "2026-11-03T11:50:00Z"
updated: "2026-11-03T11:50:00Z"
slug: "troubleshooting"
---

## Troubleshooting & Hardware Diagnostics

This reference compiles solutions to common hardware, firmware, and Web Bluetooth connection issues encountered during development.

---

### 1. Linux BlueZ GATT Error 133 / "GATT Operation Failed"

#### Symptom

```text
GATT write error (GATT operation failed for unknown reason.) — refreshing BlueZ GATT session…
Write failed: GATT Error Unknown. Click Disconnect, then Connect Web Bluetooth.
```

#### Cause

In Linux distributions running the BlueZ Bluetooth daemon, issuing a GATT write immediately following `startNotifications()` aborts because BlueZ is negotiating the Client Characteristic Configuration Descriptor (CCCD `0x2902`) and connection interval with the kernel.

#### Solution

1. The transport enforces a **300ms settling delay** after subscribing to notifications before sending the initial `LIGHT` read command.
2. If BlueZ has cached an invalid attribute handle, click **Disconnect**, toggle Bluetooth in system settings (`bluetoothctl power off && bluetoothctl power on`), and click **Connect Web Bluetooth**.

---

### 2. "No Compatible Devices Found" in Web Bluetooth Chooser

#### Symptom

Clicking **Connect Web Bluetooth** opens the Chrome device chooser, but the TinyDuino does not appear.

#### Cause

The Bluegiga BLE112 powers up in standby mode with its transmitter off. It does not broadcast BLE advertisements until the ATmega328P sends the BGAPI GAP discoverable command.

#### Solution

1. Verify that `shadow-claw-light-meter.ino` is compiled and flashed.
2. Ensure the USB cable provides sufficient power (at least 3.3V).
3. Verify the [Bluetooth Low Energy TinyShield (`ASD2112 Rev 2`)](https://learn.tinycircuits.com/Obsolete/BLE-bluegiga_TinyShield_Tutorial/) is seated firmly on the [TinyShield bus](https://tinycircuits.com/pages/tinyduino-overview#tinyshield-compatibility).

---

### 3. Web Serial "Break Received" Error

#### Symptom

```text
[ERR] USB Serial error: Break received
```

#### Cause

Opening `/dev/ttyUSB0` pulses the FTDI `DTR` line, resetting the ATmega328P and triggering a brief break condition on the serial line.

#### Solution

The transport uses an asynchronous reader loop (`port.readable.getReader()`) that catches and suppresses the break exception, resuming reading once Optiboot yields control to the sketch.

---

### 4. WebMCP Tools Showing "In Progress" in Chrome DevTools

#### Symptom

Clicking "Run Tool" on `tinyduino_send_command` in Chrome DevTools Application > WebMCP shows status "In Progress" indefinitely.

#### Cause

Declarative form elements with `toolautosubmit` may hang if the submit event handler does not provide a resolving Promise to `event.respondWith()`.

#### Solution

The adapter registers imperative tools directly with `document.modelContext.registerTool({ name, inputSchema, execute })` returning explicit asynchronous results that complete immediately.

---

### 5. Web Bluetooth Blocked in Sandboxed Iframes

#### Symptom

```text
SecurityError: navigator.bluetooth.requestDevice() is blocked in an iframe without appropriate permissions.
```

#### Cause

By default, ShadowClaw renders HTML pages in sandboxed null-origin iframes where Bluetooth and Serial APIs are restricted.

#### Solution

`tinyduino.html` specifies `iframe: false` in its YAML frontmatter and is included in `pages.directPages` in `shadow-claw.config.json` to render directly on the top-level window.

---

⬅️ [Previous: Namespace Isolation](/main/namespace-isolation/) | ➡️ [Next: Download Center](/main/download-center/)
