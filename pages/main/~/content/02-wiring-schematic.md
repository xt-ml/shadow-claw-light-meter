---
title: "KY-018 Wiring & Pin Routing"
created: "2026-11-03T11:50:00Z"
updated: "2026-11-03T11:50:00Z"
slug: "wiring-schematic"
---

## KY-018 Photoresistor Wiring & Pin Routing

The LightMeter sensor is built using a **KY-018 Light Sensor Module** from the 24-in-1 Sensor Kit. The module integrates a Cadmium Sulfide (CdS) photoresistor and a 10 kΩ ($103$) surface-mount resistor arranged in a pull-down voltage divider:

```
       +3.3V (VCC)
           │
           ▼
     ┌───────────┐
     │  KY-018   │
     │    LDR    │ (Resistance drops in light)
     │ (Photo-R) │
     └─────┬─────┘
           ├───────────────────► Analog Pin A0 (ADC Input)
     ┌─────┴─────┐
     │  KY-018   │
     │10k Pulldown
     │  Resistor │
     └─────┬─────┘
           │
           ▼
       GND (0V)
```

---

### Physical Wiring Table

The KY-018 module connects to the **[TinyShield Proto Board (`ASD2009 Rev 1`)](https://tinycircuits.com/products/proto-board-tinyshield?variant=14984618887)** via flexible jumper leads:

| KY-018 Pin | Label on Breakout | TinyShield Pin | Function                           |
| :--------: | :---------------: | :------------: | :--------------------------------- |
| **Pin 1**  |        `-`        |   **`GND`**    | System Ground (0 V)                |
| **Pin 2**  |   `+` (Middle)    |   **`VCC`**    | Regulated +3.3 V Logic Rail        |
| **Pin 3**  |   `S` (Signal)    |    **`A0`**    | ATmega328P 10-Bit ADC Analog Input |

> [!IMPORTANT]
> **Why Power with 3.3V Instead of 5V?**
> The TinyDuino processor runs at 3.3 V. Powering the voltage divider from the 3.3 V `VCC` rail guarantees that the analog voltage delivered to Pin `A0` never exceeds the ATmega328P's internal ADC reference (`V_REF = VCC`). If powered from 5V, exposure to high light could feed 5V directly into the analog pin, violating the absolute maximum ratings (`VCC + 0.5 V`) and damaging the chip.

---

### Electrical Characteristics

- **Dark Resistance (`R_dark`)**: Approximately 100 kΩ to 2 MΩ in complete darkness.
- **Light Resistance (`R_light`)**: Approximately 1 kΩ to 4 kΩ under direct flashlight beam (> 1000 lux).
- **Divider Transfer Function**:

  ```text
  V_out = VCC × [ 10,000 / (R_LDR + 10,000) ]
  ADC_A0 = 1023 × [ 10,000 / (R_LDR + 10,000) ]
  ```

- In the KY-018 divider orientation on TinyDuino, bright light reduces `R_LDR`, pulling Pin `A0` high toward +3.3 V (high ADC reading 800–1023). Dark conditions cause `R_LDR` to dominate, dropping Pin `A0` toward Ground (0–150). High A0 = Bright, Low A0 = Dark.

---

⬅️ [Previous: Hardware Architecture](/main/hardware-architecture/) | ➡️ [Next: BLE112 BGAPI Protocol](/main/ble112-bgapi/)
