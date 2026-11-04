---
name: tinyduino-status
description: Comprehensive hardware diagnostic inspecting connection state, packet counts, last ACK, and sensor telemetry.
user-invocable: true
metadata:
  allowed-tools: tinyduino_get_status
  execution:
    type: tools
    tools:
      - name: tinyduino_get_status
        input: {}
---

# TinyDuino Hardware Status Diagnostic

Inspects the live operating state of the TinyDuino processor, BLE112 shield, and KY-018 sensor without mutating hardware configuration.

## Telemetry Metrics

- **Connection State**: `connected`, `connecting`, `disconnected`, or `simulated`.
- **Packet Counters**: Total TX/RX packets exchanged over GATT Handle 17 and Handle 20.
- **Sensor Telemetry**:
  - Raw ADC reading (Pin A0)
  - Voltage (3.3V reference)
  - Estimated Illuminance (lux)
  - Session Min / Max ADC readings
- **Auxiliary Hardware**:
  - Quadrature encoder position
  - Onboard LED mode (`ON`, `OFF`, `AUTO`)
  - Last received ACK response

## Instructions for Agent

1. Invoke `tinyduino_get_status`.
2. Format results into a clear diagnostic table or bullet list.
3. Highlight any anomalies (e.g. 0 packets received, ADC stuck at extreme rails 0 or 1023).
