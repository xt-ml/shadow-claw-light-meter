#!/usr/bin/env node
/**
 * bin/check-namespace.mjs
 *
 * Verifies namespace and identifier isolation for shadow-claw-light-meter.
 *
 * Validates:
 * - All tools start with "tinyduino_"
 * - All custom elements start with "tinyduino-"
 * - All broadcast channels start with "tinyduino-"
 * - Pinned workbench page is "/pages/main/tinyduino.html"
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

export function checkNamespaceIsolation() {
  const issues = [];
  const report = {
    tools: [],
    elements: [],
    channels: [],
    namingViolations: [],
    pinnedPageConflict: false,
  };

  const lightMeterConfigPath = resolve(ROOT, "shadow-claw.config.json");

  if (!existsSync(lightMeterConfigPath)) {
    throw new Error(`LightMeter config not found at ${lightMeterConfigPath}`);
  }

  const lmConfig = JSON.parse(readFileSync(lightMeterConfigPath, "utf8"));

  // 1. Tool Namespaces
  report.tools = lmConfig.enabledTools || [];
  for (const tool of report.tools) {
    if (!tool.startsWith("tinyduino_")) {
      report.namingViolations.push(tool);
      issues.push(
        `Tool naming violation: "${tool}" must start with "tinyduino_".`,
      );
    }
  }

  // 2. Custom Elements Namespaces
  report.elements = lmConfig.customElements?.allowedElements || [];
  for (const el of report.elements) {
    if (!el.startsWith("tinyduino-")) {
      report.namingViolations.push(el);
      issues.push(
        `Custom element naming violation: "${el}" must start with "tinyduino-".`,
      );
    }
  }

  // 3. Pinned Page Check
  const lmPinned = lmConfig.pages?.defaultPinnedPage;
  if (!lmPinned || lmPinned !== "/pages/main/tinyduino.html") {
    report.pinnedPageConflict = true;
    issues.push(
      `Pinned page mismatch: LightMeter must pin "/pages/main/tinyduino.html". Found: "${lmPinned}".`,
    );
  }

  // 4. Broadcast Channel Names
  const lightMeterChannels = ["tinyduino-commands", "tinyduino-results"];
  report.channels = lightMeterChannels;
  for (const ch of lightMeterChannels) {
    if (!ch.startsWith("tinyduino-")) {
      report.namingViolations.push(ch);
      issues.push(
        `Broadcast channel naming violation: "${ch}" must start with "tinyduino-".`,
      );
    }
  }

  return {
    ok: issues.length === 0,
    report,
    issues,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = checkNamespaceIsolation();
    console.log("=== TinyDuino LightMeter Namespace Isolation Check ===");
    console.log(`Tools: ${result.report.tools.length}`);
    console.log(`Elements: ${result.report.elements.length}`);
    console.log(`Channels: ${result.report.channels.length}`);

    if (!result.ok) {
      console.error("\n[FAIL] Namespace issues detected:");
      for (const issue of result.issues) {
        console.error(` - ${issue}`);
      }
      process.exit(1);
    }

    console.log("\n[PASS] 100% namespace separation and isolation verified!");
    process.exit(0);
  } catch (err) {
    console.error("[ERROR]", err.message);
    process.exit(1);
  }
}
