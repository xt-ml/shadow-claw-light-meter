---
name: nightlight
description: Monitor ambient darkness and control TinyDuino Pin 13 / Pin 7 LEDs as an automatic reactive nightlight.
user-invocable: true
metadata:
  allowed-tools: tinyduino_set_led
  execution:
    type: tools
    tools:
      - name: tinyduino_set_led
        input:
          state: "AUTO"
---

# Nightlight Automation Skill

Configures the TinyDuino and Proto Shield LEDs to act as an automated photosensitive nightlight responding to KY-018 ambient light levels.

## Behavior

- **Trigger Threshold**: When ambient brightness falls below 20% (Raw ADC < 205 in standard KY-018 divider), the nightlight activates by calling `tinyduino_set_led` with `state: "ON"`.
- **Hysteresis & Turn-Off**: When ambient brightness rises above 35% (Raw ADC > 358), the nightlight deactivates (`state: "OFF"` or `"AUTO"`).
- **Manual Overrides**: Allows the user to force the LED `ON`, `OFF`, or return to firmware `AUTO` (BLE connection heartbeat).

## Instructions for Agent

1. Execute `tinyduino_read_light` to read current ambient level.
2. Check if percent < 20%. If dark and LED is not currently ON, invoke `tinyduino_set_led(state: "ON")`.
3. If bright (> 35%) and nightlight was active, invoke `tinyduino_set_led(state: "OFF")`.
4. Summarize the threshold decision and current lighting metrics to the user.
