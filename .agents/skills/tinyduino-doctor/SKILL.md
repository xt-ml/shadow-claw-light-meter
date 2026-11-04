---
name: tinyduino-doctor
description: Automated troubleshooting doctor diagnosing Web Bluetooth connection failures, BlueZ GATT errors, and CCCD timing.
user-invocable: true
metadata:
  allowed-tools: tinyduino_get_connection_status
  execution:
    type: tools
    tools:
      - name: tinyduino_get_connection_status
        input: {}
---

# TinyDuino Hardware Doctor

Diagnoses and guides recovery for common hardware, firmware, and Web Bluetooth communication faults.

## Common Issues & Diagnosed Solutions

### 1. GATT Error Unknown / BlueZ Error 133

- **Symptoms**: `Write failed: GATT Error Unknown` immediately upon connecting.
- **Root Cause**: BlueZ Bluetooth daemon requires a 300ms settling delay after subscribing to CCCD indications (Handle 20) before accepting write requests on Handle 17.
- **Remedy**: Ensure `300ms` settling timer is active. If BlueZ cached an invalid GATT attribute table, cycle Bluetooth or reconnect via "Disconnect" -> "Connect Web Bluetooth".

### 2. Light Readings Inverted

- **Symptoms**: Shining a flashlight causes the graph to drop to 0% rather than 100%.
- **Root Cause**: The physical KY-018 module on the TinyShield Proto Board uses a pull-down configuration (+VCC ➔ LDR ➔ A0 ➔ 10kΩ ➔ GND) where high light pulls A0 high toward 3.3V (standard `high_adc_bright`). If an external module is wired in pull-up mode (+VCC ➔ 10kΩ ➔ A0 ➔ LDR ➔ GND), high light pulls A0 to Ground (low ADC).
- **Remedy**: Use the standard KY-018 high-ADC-bright polarity (`Brightness % = 100 × ADC / 1023`). If using a pull-up module, select "Inverted Pull-Up (Low A0 = Bright)" in the divider polarity selector.

### 3. Missing WebMCP Tools in DevTools

- **Symptoms**: Tools show "In Progress" or do not complete when clicked in Chrome DevTools.
- **Root Cause**: Declarative forms without explicit promise resolution in `modelContext.registerTool`.
- **Remedy**: Ensure `document.modelContext.registerTool` imperative registrations are active with async `execute()` handlers.

## Instructions for Agent

1. Query current state via `tinyduino_get_status`.
2. Inspect packet counters and error logs.
3. If communication is stalled, suggest disconnecting and reconnecting with CCCD settling delay, or switching to "Simulate Hardware" for offline testing.
