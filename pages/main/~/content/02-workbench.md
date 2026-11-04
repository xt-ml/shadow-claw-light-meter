---
title: "Light Meter Workbench"
created: "2026-11-04T00:00:00Z"
updated: "2026-11-04T00:00:00Z"
slug: "workbench"
---

## Light Meter Workbench

Use this workbench to build a relative-light sensor with a TinyDuino, a BLE112 radio, and a KY-018 photoresistor module. ShadowClaw's [`/interpret-light-reading`](../../.agents/skills/interpret-light-reading/SKILL.md) skill can classify a reading between your own dark and bright references.

### Hardware

| KY-018 module | TinyDuino |
| --- | --- |
| `S` / signal | An analog input such as `A0` |
| `+` / `VCC` | `3V3` |
| `-` / `GND` | `GND` |

Check the labels on your specific module before wiring; pin order is not universal. Power the sensor from the TinyDuino's 3.3 V rail and share ground. Do not let the analog signal exceed the MCU's input voltage. The KY-018 is a photoresistor divider, not a calibrated lux sensor.

Connect the BLE112 to the TinyDuino using the interface supported by your board and BLE112 firmware. A BLE112 does not imply a standard UART-over-BLE service: its GATT service, characteristic UUIDs, and notifications must be configured by the firmware. Do not assume a generic serial UUID will work.

### Firmware-to-agent data

Have the firmware sample the analog input and publish or copy a record in this form:

```text
LIGHT,<adc>,<adcMax>,<timestamp>
```

For example, `LIGHT,417,1023,2026-11-04T00:30:00Z` is a raw sample, not a lux value. Set `adcMax` to the actual ADC maximum selected by the firmware; `1023` is appropriate only for a 10-bit ADC. The app or BLE client can pass the numeric fields to ShadowClaw's `interpret_light_reading` tool. This repository does not assume a particular BLE112 GATT profile or provide device firmware.

### Calibrate and observe

1. Keep the sensor in its final orientation and record a stable dark-condition ADC value as `darkReference`.
2. Record a stable bright-condition value as `brightReference`. These values can be reversed if your divider decreases with more light.
3. Measure a sample under the same setup and run `/interpret-light-reading` with `adc`, `darkReference`, `brightReference`, and (if needed) `adcMax`.
4. Repeat samples with the sensor position, angle, light source, and time noted. Recalibrate if the hardware, divider, or ADC configuration changes.

The reported percentage is clamped to 0–100 between those two references. “Dim,” “moderate,” and “bright” are relative labels for that calibration only; they are not standards or lux estimates. A single reading cannot establish flicker, exposure safety, or visual comfort.

| Time | ADC | ADC max | Dark ref | Bright ref | Setup / notes |
| --- | ---: | ---: | ---: | ---: | --- |
|  |  |  |  |  |  |

➡️ [Hardware and project notes](/main/about/)
