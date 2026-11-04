---
title: "About the Light Meter"
created: "1970-01-01T00:00:00Z"
updated: "1970-01-01T00:00:00Z"
slug: "about"
---

## About the Light Meter

This project documents a small relative-light sensing workbench built around a TinyDuino, BLE112, and KY-018 photoresistor module, with ShadowClaw providing agent-facing interpretation tools and skills.

The KY-018 reports a divider voltage through the microcontroller's ADC. Its response depends on the module, resistor, supply, ADC, and sensor geometry, so it is useful for repeatable comparisons after calibration—not as a stand-alone lux meter.

The BLE112 is the transport, not a guaranteed serial interface: the firmware must define a GATT service and characteristic. This project specifies a small `LIGHT,<adc>,<adcMax>,<timestamp>` handoff convention but does not assume device-specific firmware or UUIDs.

➡️ [Build, wire, and calibrate the workbench](/main/workbench/)

---

⬅️ [Home](/main/) | ➡️ [Workbench](/main/workbench/)
