---
name: interpret-light-reading
description: "Interpret a TinyDuino and KY-018 light-meter ADC reading using user-supplied dark and bright references; explain relative light level without claiming lux."
user-invocable: true
argument-hint: "[adc, dark reference, bright reference]"
metadata:
  allowed-tools: interpret_light_reading
---

# Interpret a Light Reading

Use the `interpret_light_reading` tool for a KY-018 reading and its calibration references. Ask for the missing values rather than inventing them. Include `adcMax` when the firmware does not use the default 10-bit range of 0–1023.

Explain the returned percentage as a relative position between the supplied dark and bright references. The sensor divider may read higher or lower in brighter conditions, so use references measured on the actual device; the tool supports either direction. Never present this result as lux or compare it as an absolute illuminance measurement across uncalibrated devices.

For repeatable observations, keep the sensor position and angle fixed, note the light source and time, and take multiple readings. A single KY-018 sample cannot establish flicker, exposure safety, or a person's visual comfort.
