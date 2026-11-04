# Declarative Tools

Declarative tools allow workspace authors to define reusable custom tools using JSON definitions placed under `.agents/tools/<tool-name>.json`.

## Directory Structure

```text
.agents/tools/
├── tinyduino_read_light.json
├── tinyduino_get_status.json
└── tinyduino_set_led.json
```

## Schema Format (ShadowClaw 1.60.0+)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "name": "tinyduino_read_light",
  "description": "Trigger an immediate analogRead(A0) on the TinyDuino KY-018 photoresistor over Web Bluetooth GATT Handle 17.",
  "input_schema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  },
  "annotations": {
    "readOnlyHint": true,
    "consequentialHint": false
  },
  "execution": {
    "type": "javascript",
    "code": "const cmdCh = new BroadcastChannel(\"tinyduino-commands\"); const resCh = new BroadcastChannel(\"tinyduino-results\"); const reqId = \"req_\" + Math.random().toString(36).slice(2); return new Promise((resolve) => { resCh.addEventListener(\"message\", (e) => { if (e.data && e.data.requestId === reqId && !e.data.ack) { cmdCh.close(); resCh.close(); resolve(e.data.result); } }); cmdCh.postMessage({ type: \"tinyduino_read_light\", requestId: reqId, params: input }); });"
  }
}
```

## Fields

- **`name`**: Unique identifier for the tool. Use domain prefixes (e.g. `tinyduino_*`, `matter_*`, `wemo_*`).
- **`description`**: Clear, concise instruction for the AI model describing purpose and output.
- **`input_schema`**: JSON Schema draft-07/2020-12 object defining input properties and constraints.
- **`annotations`**: Optional WebMCP boolean hints:
  - `readOnlyHint`: Indicates the tool does not modify environment state (`true` for reads/status).
  - `consequentialHint`: Indicates the tool has significant consequences (`true` for firmware flashes, irreversible changes).
- **`execution`**: Execution strategy:
  - `type`: `"javascript"`, `"tool"`, or `"bash"`.
  - `code`: Async JavaScript function body receiving `input` (the parsed arguments object) and returning the result.

## BroadcastChannel IPC

For tools communicating between the Web Worker and the main DOM thread (e.g. Web Bluetooth, Web Serial, or Canvas):

1. Use explicit string literals in `new BroadcastChannel("...")` so regex proxies can match them.
2. Send `{ type, requestId, params }`.
3. Handle acknowledgments (`ack: true`) and return results or throw on error.
