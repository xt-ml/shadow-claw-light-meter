---
title: "Voltage Divider Derivation & Math Proof"
created: "2026-11-03T11:50:00Z"
updated: "2026-11-03T15:45:00Z"
slug: "divider-math"
---

## Voltage Divider Derivation & Math Proof

During live flashlight testing of the TinyDuino LightMeter on the **[TinyDuino (`ASM2001 Rev 9`)](https://tinycircuits.com/collections/processors/products/tinyduino-processor-board?variant=14479557959) + [BLE112 (`ASD2112 Rev 2`)](https://learn.tinycircuits.com/Obsolete/BLE-bluegiga_TinyShield_Tutorial/) + [Proto Shield (`ASD2009 Rev 1`)](https://tinycircuits.com/products/proto-board-tinyshield?variant=14984618887)**, an unexpected behavior was observed in early builds: pointing an intense flashlight directly at the sensor caused the UI waveform to drop to 14%, whereas ambient indoor room lighting rendered at 66%.

This chapter provides the formal electrical proof and mathematical derivation documenting the KY-018 circuit topology, resolving the light/dark inversion, and proving that on the TinyDuino Proto Board, **High A0 = Bright** and **Low A0 = Dark**.

---

### 1. The Physical Observation

When connecting Web Bluetooth to `BGLib U1A1P 38.4NF` and running the live LightMeter:

- **In normal indoor ambient light**: Pin `A0` read **`103`** (0.33 V).
- **Under a direct flashlight beam**: Pin `A0` jumped up to **`882`** (2.85 V).

```text
Direct Flashlight ➔ ADC jumps up to 882 (2.85V, 86%, ~1780 lx)
Indoor Ambient    ➔ ADC rests at 103 (0.33V, 10%, ~8 lx)
Pitch Dark        ➔ ADC drops to 15 (0.05V, 1%, ~1 lx)
```

The initial code had inverted the equation (`1.0 - ADC / 1023`), expecting low ADC to mean bright. Consequently, shining a flashlight made the reading drop to 14% and say "it is dark in the room".

---

### 2. Circuit Topology Verification

Tracing the physical PCB (`-`, `+`, `S` with the `103` 10 kΩ SMD resistor) alongside our 103 vs. 882 ADC measurements proves the exact circuit topology:

- **High Side (`+` to `S`)**: CdS Photoresistor (`R_LDR`) connected between `+VCC` (3.3 V) and signal pin `S` (`A0`).
- **Low Side (`S` to `-`)**: Fixed 10 kΩ resistor (`R_fixed = 10 kΩ`) connected between signal pin `S` (`A0`) and `GND`.

---

### 3. Mathematical Derivation

#### Voltage Divider Transfer Function

By Ohm's Law and the resistive voltage divider rule across `R_LDR` (high side) and `R_fixed = 10 kΩ` (low side to ground):

```text
V_A0 = VCC × [ 10 kΩ / (R_LDR + 10 kΩ) ]
     = 3.3 V × [ 10,000 / (R_LDR + 10,000) ]

ADC_A0 = 1023 × (V_A0 / VCC)
       = 1023 × [ 10,000 / (R_LDR + 10,000) ]
```

---

### 4. Solving for Live Photoresistor Resistance (`R_LDR`)

Inverting the ADC transfer equation gives the instantaneous resistance of the CdS cell directly from the raw `A0` reading:

```text
R_LDR = 10,000 × [ (1023 - ADC_A0) / ADC_A0 ]  (in Ω)
```

#### Behavior Analysis

1. **Under Direct Flashlight (`ADC_A0 = 882`, `V_A0 = 2.85 V`)**:
   - Photons drastically reduce CdS resistance:

     ```text
     R_LDR = 10,000 × [ (1023 - 882) / 882 ] ≈ 1,600 Ω (1.60 kΩ)
     ```

   - The low resistance lets +3.3 V pull `A0` high. Brightness is **86%**!

2. **In Ambient Room Light (`ADC_A0 = 103`, `V_A0 = 0.33 V`)**:
   - Moderately high resistance:

     ```text
     R_LDR = 10,000 × [ (1023 - 103) / 103 ] ≈ 89,320 Ω (89.32 kΩ)
     ```

   - The fixed 10 kΩ pull-down holds `A0` near Ground (0.33 V). Brightness is **10%**!

3. **In Complete Darkness (`ADC_A0 = 15`, `V_A0 = 0.05 V`)**:
   - Very high resistance:

     ```text
     R_LDR = 10,000 × [ (1023 - 15) / 15 ] ≈ 672,000 Ω (672 kΩ)
     ```

   - Minimal current flows through the divider. Brightness is **1%**!

---

### 5. Power-Law Illuminance (`Lux`) Approximation

For a standard CdS cell (`γ ≈ 0.74`, `1/γ ≈ 1.35`, reference `E_0 ≈ 150 lx` at `R_LDR = 10 kΩ` where `ADC = 512`):

```text
E_lux ≈ 150 × ( 10 kΩ / R_LDR )^1.35
      = 150 × [ ADC_A0 / (1023 - ADC_A0) ]^1.35
```

| Condition                                | Raw `ADC_A0` | Signal Voltage (`V_A0`) | LDR Resistance (`R_LDR`) | Brightness (%) | Est. Illuminance (`E_lux`) |
| :--------------------------------------- | :----------: | :---------------------: | :----------------------: | :------------: | :------------------------: |
| **Pitch Dark (Covered)**                 |     `15`     |        `0.05 V`         |        `672.0 kΩ`        |      `1%`      |          `~1 lx`           |
| **Indoor Ambient (Measured)**            |    `103`     |        `0.33 V`         |        `89.3 kΩ`         |     `10%`      |          `~8 lx`           |
| **Midpoint Reference (`R_LDR = 10 kΩ`)** |    `512`     |        `1.65 V`         |        `10.0 kΩ`         |     `50%`      |         `~150 lx`          |
| **Direct Flashlight (Measured)**         |    `882`     |        `2.85 V`         |        `1.60 kΩ`         |     `86%`      |         `~1780 lx`         |

---

⬅️ [Previous: Field Diagnostics & Architecture Audit](/main/field-diagnostics/) | ➡️ [Next: Wokwi Simulation](/main/wokwi-simulation/)
