import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../", import.meta.url));
const source = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");

function assertTestPaths(text, exists = (path) => existsSync(resolve(root, path))) {
  const paths = [...text.matchAll(/\b((?:scripts|tests)\/[\w/.-]+\.test\.mjs)\b/g)].map((match) => match[1]);
  for (const path of paths) assert.ok(exists(path), `workflow references missing test: ${path}`);
}

test("literal workflow test paths exist", () => assertTestPaths(source));
test("missing literal workflow tests are rejected", () => {
  assert.throws(() => assertTestPaths("node --test scripts/ci/missing.test.mjs", () => false), /missing test/);
});

// Platform has no separate protected aggregate. Its protected build must run
// even when the validation dependency fails, then explicitly reject that state.
if (/^  docs-only:/m.test(source) && /^  build:/m.test(source)) {
  const workflow = JSON.parse(
    execFileSync("python3", ["-c", "import json,sys,yaml; print(json.dumps(yaml.safe_load(sys.stdin.read())))"], {
      input: source,
      encoding: "utf8",
    }),
  );
  const build = workflow.jobs.build;
  const guard = build.steps[0];
  test("protected build always runs and requires docs/policy validation", () => {
    assert.equal(build.needs, "docs-only");
    assert.equal(build.if, "${{ always() }}");
    assert.equal(guard.env.DOCS_RESULT, "${{ needs.docs-only.result }}");
    assert.equal(typeof guard.run, "string");
  });
  for (const state of ["success", "failure", "cancelled", "skipped", "", "unknown"]) {
    test(`protected build validation guard: ${state || "missing"}`, () => {
      const result = spawnSync("bash", ["-c", guard.run], {
        cwd: root,
        env: { ...process.env, DOCS_RESULT: state },
        encoding: "utf8",
      });
      assert.equal(result.status === 0, state === "success", result.stderr);
    });
  }
}
