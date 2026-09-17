import assert from "node:assert/strict";
import test from "node:test";
import { previewDecision } from "./should-deploy-preview.mjs";
import { ZERO_SHA } from "./docs-only.mjs";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);

function gitStub({ diff, diffThrows = false, mergeBaseThrows = false } = {}) {
  return (args) => {
    if (args[0] === "merge-base") {
      if (mergeBaseThrows) throw new Error("not an ancestor");
      return "";
    }
    if (args[0] === "diff") {
      if (diffThrows) throw new Error("diff failed");
      return `${(diff ?? []).join("\0")}${diff && diff.length ? "\0" : ""}`;
    }
    throw new Error(`unexpected git call: ${args.join(" ")}`);
  };
}

test("never skips production or non-preview deployments", () => {
  assert.equal(previewDecision({ VERCEL_ENV: "production" }).skip, false);
  assert.equal(previewDecision({ VERCEL_ENV: "development" }).skip, false);
  assert.equal(previewDecision({}).skip, false);
});

test("never skips without a valid previous deployment SHA", () => {
  for (const env of [
    { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_SHA: SHA_A },
    { VERCEL_ENV: "preview", VERCEL_GIT_PREVIOUS_SHA: ZERO_SHA, VERCEL_GIT_COMMIT_SHA: SHA_A },
    { VERCEL_ENV: "preview", VERCEL_GIT_PREVIOUS_SHA: "nope", VERCEL_GIT_COMMIT_SHA: SHA_A },
    { VERCEL_ENV: "preview", VERCEL_GIT_PREVIOUS_SHA: SHA_A, VERCEL_GIT_COMMIT_SHA: "nope" },
  ]) {
    assert.equal(previewDecision(env, gitStub()).skip, false, JSON.stringify(env));
  }
});

test("never skips when the previous deployment is not an ancestor", () => {
  const decision = previewDecision(
    { VERCEL_ENV: "preview", VERCEL_GIT_PREVIOUS_SHA: SHA_A, VERCEL_GIT_COMMIT_SHA: SHA_B },
    gitStub({ mergeBaseThrows: true }),
  );
  assert.equal(decision.skip, false);
});

test("never skips when the range cannot be diffed or is empty", () => {
  const base = { VERCEL_ENV: "preview", VERCEL_GIT_PREVIOUS_SHA: SHA_A, VERCEL_GIT_COMMIT_SHA: SHA_B };
  assert.equal(previewDecision(base, gitStub({ diffThrows: true })).skip, false);
  assert.equal(previewDecision(base, gitStub({ diff: [] })).skip, false);
});

test("skips only when every changed path is curated docs", () => {
  const base = { VERCEL_ENV: "preview", VERCEL_GIT_PREVIOUS_SHA: SHA_A, VERCEL_GIT_COMMIT_SHA: SHA_B };
  assert.equal(previewDecision(base, gitStub({ diff: ["AGENTS.md", "docs/guide.md"] })).skip, true);
  assert.equal(previewDecision(base, gitStub({ diff: ["docs/guide.md", "src/app.ts"] })).skip, false);
  assert.equal(previewDecision(base, gitStub({ diff: ["package.json"] })).skip, false);
});
