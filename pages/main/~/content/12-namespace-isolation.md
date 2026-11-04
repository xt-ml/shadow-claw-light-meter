---
title: "Namespace Isolation & Guardrails"
created: "2026-11-03T11:50:00Z"
updated: "2026-11-03T19:10:00Z"
slug: "namespace-isolation"
---

## Namespace Isolation & Architecture Guardrails

To ensure reliable multi-runtime deployment and avoid collisions across tools, custom elements, and communication buses, `shadow-claw-light-meter` adheres to a strict namespace isolation contract.

All public identifiers are strictly scoped to the `tinyduino` domain.

---

### Scoped Identifier Matrix

| Domain                 | Scoped Prefix / Identifier Pattern        | LightMeter Scope                    | Collision Isolation |
| :--------------------- | :---------------------------------------- | :---------------------------------- | :-----------------: |
| **Tool Names**         | `tinyduino_*`                             | 13 declarative WebMCP tools         | **Strictly Scoped** |
| **Custom Elements**    | `tinyduino-*`                             | 4 custom elements                   | **Strictly Scoped** |
| **Broadcast Channels** | `tinyduino-commands`, `tinyduino-results` | Dedicated worker messaging channels | **Strictly Scoped** |
| **Workbench Page**     | `/pages/main/tinyduino.html`              | Direct-rendered pinned workbench    | **Strictly Scoped** |

---

### Automated Guardrail (`npm run check:compat`)

Namespace separation is enforced by automated checks and unit tests:

```bash
npm run check:compat
```

The validation ensures that:

1. Every LightMeter tool starts with `tinyduino_`.
2. Every LightMeter custom element starts with `tinyduino-`.
3. BroadcastChannel names adhere strictly to `tinyduino-*`.
4. The pinned workbench route is uniquely named `tinyduino.html`.

If any naming convention violation is introduced, automated testing halts the build immediately.

---

⬅️ [Previous: Interactive Workbench & Custom Elements](/main/workbench-ui/) | ➡️ [Next: Troubleshooting](/main/troubleshooting/)
