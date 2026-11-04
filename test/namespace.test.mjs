import test from "node:test";
import assert from "node:assert/strict";
import { checkNamespaceIsolation } from "../bin/check-namespace.mjs";

test("Namespace isolation: verifies scoped naming conventions and zero conflicts", () => {
  const result = checkNamespaceIsolation();
  assert.equal(
    result.ok,
    true,
    `Namespace check failed with issues: ${result.issues.join("; ")}`,
  );
  assert.ok(result.report.tools.length > 0);
  assert.ok(result.report.elements.length > 0);
  assert.ok(result.report.channels.length > 0);
  assert.equal(result.report.namingViolations.length, 0);
  assert.equal(result.report.pinnedPageConflict, false);
});
