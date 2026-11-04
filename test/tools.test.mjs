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

    // Must use literal channel strings
    assert.ok(parsed.execution.code.includes('"tinyduino-commands"'));
    assert.ok(parsed.execution.code.includes('"tinyduino-results"'));
  }
});
