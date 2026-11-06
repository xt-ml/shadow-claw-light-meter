import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOLS } from "../bin/tool-manifest.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TOOLS_DIR = resolve(ROOT, ".agents/tools");

test("Tools: all 13 tools defined in manifest exist on disk and match schema", () => {
  assert.equal(TOOLS.length, 13);

  for (const tool of TOOLS) {
    const file = resolve(TOOLS_DIR, `${tool.name}.json`);
    assert.ok(existsSync(file), `Tool file ${tool.name}.json must exist`);

    const parsed = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(parsed.name, tool.name);
    assert.ok(parsed.name.startsWith("tinyduino_"));
    assert.ok(parsed.description && parsed.description.length > 10);
    assert.equal(parsed.input_schema.type, "object");
    assert.equal(typeof parsed.annotations.readOnlyHint, "boolean");
    assert.equal(typeof parsed.annotations.consequentialHint, "boolean");
    assert.equal(parsed.execution.type, "javascript");
    assert.doesNotMatch(
      parsed.execution.code,
      /\b(?:const|let|var)\s+input\b/,
      `${tool.name} must not declare ShadowClaw's injected input`,
    );
    assert.doesNotThrow(
      () =>
        new Function(
          `return async (data, $PIPE_DATA) => { let input; ${parsed.execution.code}\n};`,
        ),
      `${tool.name} must compile with the older ShadowClaw input binding`,
    );

    // Must use literal channel strings
    assert.ok(parsed.execution.code.includes('"tinyduino-commands"'));
    assert.ok(parsed.execution.code.includes('"tinyduino-results"'));
  }
});

test("WebMCP adapter: registerNativeWebMcp handles Duplicate tool name InvalidStateError cleanly without unhandled rejection", async () => {
  if (typeof globalThis.HTMLElement === "undefined") {
    globalThis.HTMLElement = class {};
  }
  if (typeof globalThis.customElements === "undefined") {
    globalThis.customElements = { define: () => {}, get: () => undefined };
  }

  const { registerNativeWebMcp } =
    await import("../.agents/scripts/tinyduino-adapter.js");

  assert.equal(typeof registerNativeWebMcp, "function");

  let unhandledCount = 0;
  const onUnhandled = () => {
    unhandledCount++;
  };
  process.on("unhandledRejection", onUnhandled);

  try {
    // 1. Test Promise rejection with InvalidStateError DOMException
    globalThis.document = {
      modelContext: {
        registerTool: () =>
          Promise.reject(
            new DOMException("Duplicate tool name", "InvalidStateError"),
          ),
      },
    };

    await registerNativeWebMcp();

    // 2. Test synchronous throw with InvalidStateError DOMException
    globalThis.document = {
      modelContext: {
        registerTool: () => {
          throw new DOMException("Duplicate tool name", "InvalidStateError");
        },
      },
    };

    await registerNativeWebMcp();

    // 3. Test navigator.modelContext fallback
    delete globalThis.document;
    const origNavigator = globalThis.navigator;
    try {
      Object.defineProperty(globalThis.navigator, "modelContext", {
        value: {
          registerTool: () =>
            Promise.reject(
              new DOMException("Duplicate tool name", "InvalidStateError"),
            ),
        },
        configurable: true,
      });

      await registerNativeWebMcp();
    } finally {
      delete globalThis.navigator.modelContext;
    }

    assert.equal(
      unhandledCount,
      0,
      "Must not trigger unhandled promise rejections on duplicate tools",
    );
  } finally {
    process.off("unhandledRejection", onUnhandled);
    delete globalThis.document;
    delete globalThis.navigator;
  }
});
