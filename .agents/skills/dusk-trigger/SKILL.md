---
name: dusk-trigger
description: Detect true physical dusk and twilight using TinyDuino live illuminance rather than clock-based estimates.
user-invocable: true
metadata:
  allowed-tools: tinyduino_ambient_level
  execution:
    type: tools
    tools:
      - name: tinyduino_ambient_level
        input: {}
---

# Dusk Detection & Evening Trigger

Detects true physical sunset and twilight transitions based on real-time photoresistor telemetry, eliminating clock drift and cloud cover discrepancies.

## Transition Criteria

- **Daylight**: Lux > 100 lx, Brightness > 40%.
- **Twilight / Approaching Dusk**: Lux between 30 and 100 lx.
- **True Dusk**: Lux falls below 30 lx (Raw ADC < 200 in standard KY-018 divider) for at least two consecutive readings.
- **Night**: Lux < 5 lx (Raw ADC < 80).

## Instructions for Agent

1. Query `tinyduino_ambient_level` to get live illuminance and category.
2. Determine if the environment has crossed the true dusk threshold (≤ 30 lx).
3. Report whether evening lighting scenes should be activated.
