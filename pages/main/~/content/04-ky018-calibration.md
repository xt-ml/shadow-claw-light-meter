---
title: "KY-018 Calibration & Sensor Physics"
created: "2026-11-03T11:50:00Z"
updated: "2026-11-03T11:50:00Z"
slug: "ky018-calibration"
---

## KY-018 Photoresistor Calibration & Sensor Physics

Cadmium Sulfide (CdS) photoresistors exhibit a non-linear resistance curve governed by photoconductivity in semiconductor crystals. When photons strike the material, valence electrons absorb energy and jump into the conduction band, significantly reducing resistance.

```text
Log(Resistance) [kΩ]
  ▲
  │   \
100│    \
  │      \
 10│       \
  │         \
  1│          \
  └───┬────┬────┬──► Log(Illuminance) [Lux]
     1    10   100  1000
```

---

### Photoconductive Characteristic Equations

The resistance `R_LDR` of a standard 5528 CdS photoresistor as a function of illuminance `E` (in lux) is modeled by:

```text
R_LDR = R_0 × ( E_0 / E )^γ
```

where:

- `R_0 ≈ 10 kΩ` at reference illuminance `E_0 = 10 lux`
- `γ ≈ 0.7 to 0.8` is the sensitivity index (slope of the logarithmic response).

---

### Voltage Divider Transfer Function

In the KY-018 module arranged on the [TinyShield Proto Board (`ASD2009 Rev 1`)](https://tinycircuits.com/products/proto-board-tinyshield?variant=14984618887) with a 10 kΩ pull-down resistor:

```text
V_A0 = VCC × [ 10 kΩ / (R_LDR + 10 kΩ) ]
     = 3.3 V × [ 10,000 / (R_LDR + 10,000) ]
```

The 10-bit ATmega328P analog-to-digital converter converts `V_A0` into an integer reading `ADC ∈ [0, 1023]`:

```text
ADC = 1023 × ( V_A0 / VCC )
    = 1023 × [ 10,000 / (R_LDR + 10,000) ]
```

Solving for `R_LDR`:

```text
R_LDR = 10,000 × [ (1023 - ADC) / ADC ]  (in Ω)
```

---

### Illuminance (Lux) Estimation Formula

By substituting `R_LDR` into the photoconductive power-law equation (`γ ≈ 0.74`, `1/γ ≈ 1.35`, reference `E_0 ≈ 150 lx` at `R_LDR = 10 kΩ`):

```text
E_lux ≈ 150 × ( 10 kΩ / R_LDR )^1.35
      = 150 × [ ADC / (1023 - ADC) ]^1.35
```

#### Empirical Verification Points (Hardware Measurements)

| Lighting Scenario       | Typical Raw ADC | Signal Voltage | LDR Resistance | Est. Illuminance | Percent |
| :---------------------- | :-------------: | :------------: | :------------: | :--------------: | :-----: |
| Direct Flashlight / Sun |     **882**     |   **2.85 V**   |   **1.6 kΩ**   |   **~1780 lx**   | **86%** |
| Midpoint Reference      |     **512**     |   **1.65 V**   |  **10.0 kΩ**   |   **~150 lx**    | **50%** |
| Ambient Living Room     |     **350**     |   **1.13 V**   |  **19.2 kΩ**   |    **~62 lx**    | **34%** |
| Indoor Ambient Desk     |     **103**     |   **0.33 V**   |  **89.3 kΩ**   |    **~8 lx**     | **10%** |
| Pitch Dark (Covered)    |     **15**      |   **0.05 V**   |  **672.0 kΩ**  |    **~1 lx**     | **1%**  |

---

### Polarity Modes

The workbench supports two calibration polarities:

1. **KY-018 Divider (`high_adc_bright`) — Standard**: High ADC corresponds to high illumination.

   ```text
   Brightness % = 100 × ( ADC / 1023 )
   ```

2. **Inverted Pull-Up (`low_adc_bright`)**: Used when wiring an external module with a pull-up resistor to VCC and LDR to Ground.

   ```text
   Brightness % = 100 × [ 1.0 - ( ADC / 1023 ) ]
   ```

---

⬅️ [Previous: BLE112 BGAPI Protocol](/main/ble112-bgapi/) | ➡️ [Next: Field Diagnostics & Architecture Audit](/main/field-diagnostics/)
