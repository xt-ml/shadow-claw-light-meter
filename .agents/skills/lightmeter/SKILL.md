---
name: lightmeter
description: Read live ambient illuminance from the TinyDuino KY-018 sensor, classify lighting conditions, and display metrics.
user-invocable: true
metadata:
  allowed-tools: tinyduino_read_light
  execution:
    type: tools
    tools:
      - name: tinyduino_read_light
        input: {}
---

# LightMeter Sensory Skill

Takes an immediate high-precision analog measurement from the KY-018 photoresistor on Analog Pin A0 over Web Bluetooth GATT.

## Capabilities

1. **Illuminance Measurement**: Queries raw 10-bit ADC value (0–1023), calculates signal voltage (3.3V reference), computes brightness percentage, and estimates lux.
2. **Environmental Classification**:
   - `direct_sun` (≥ 80% / > 800 lx): Direct sunlight or intense flashlight beam.
   - `daylight` (50–79% / 200–800 lx): Bright ambient indoor daylight or well-lit studio.
   - `indoor` (25–49% / 50–200 lx): Standard office or living space illumination.
   - `dark_indoor` (10–24% / 10–50 lx): Dim ambient lighting or evening twilight.
   - `night` (< 10% / < 10 lx): Pitch dark or night conditions.
3. **Interactive Surface**: Offers to embed the live visualizer using `tinyduino_render_surface`.

## Instructions for Agent

1. Check connection state using `tinyduino_get_status`.
2. If disconnected, inform user to click "Connect Web Bluetooth" or "Simulate Hardware" on `/pages/main/tinyduino.html`.
3. Call `tinyduino_read_light` to trigger a hardware sampling burst.
4. Report raw ADC, signal voltage, estimated lux, and environmental classification in clean markdown.
