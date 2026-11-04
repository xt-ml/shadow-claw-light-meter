---
name: daylight-harvest
description: Energy-saving daylight harvesting coordinator calculating artificial light offsets based on live TinyDuino lux.
user-invocable: true
metadata:
  allowed-tools: tinyduino_ambient_level
  execution:
    type: tools
    tools:
      - name: tinyduino_ambient_level
        input: {}
---

# Daylight Harvesting Coordinator

Monitors ambient natural illumination from the TinyDuino KY-018 sensor and calculates energy-saving adjustments for smart lighting fixtures.

## Control Logic

1. **Target Working Illuminance**: Standard desk/room target is ~300 to 500 lux.
2. **Daylight Contribution**:
   - If Natural Lux ≥ 500 lx: Full daylight available. Recommend turning off artificial lighting fixtures.
   - If Natural Lux between 150 and 450 lx: Partial daylight. Calculate required dimming percentage to maintain 500 lx target:

     ```text
     Dimming Target = max(10%, min(100%, [ (500 - Natural Lux) / 500 ] × 100))
     ```

   - If Natural Lux < 100 lx: Inadequate natural light. Recommend full artificial illumination (100%).

## Instructions for Agent

1. Query `tinyduino_ambient_level` to get live lux and Matter illuminance scaling.
2. Calculate the optimal fixture brightness offset.
3. If integrated with Matter smart lighting fixtures, suggest adjusting brightness to achieve the target balance.
