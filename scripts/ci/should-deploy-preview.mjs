// Vercel Ignored Build Step for preview deployments (repository-controlled).
//
// Exits 0 to skip the preview build, 1 to build. It answers one narrow
// question: does the range between the previously deployed commit and this
// commit touch *only* curated docs/instruction Markdown?
//
// It never guesses. Production deployments, missing or malformed Vercel
// metadata, an unavailable or non-ancestor previous commit, an empty range, a
// git failure and any internal error all fall back to building. The preview
// project layout must be known: this file is invoked from a `vercel.json` that
// already exists in the repository.

import { execFileSync } from "node:child_process";
import { classifyDocsOnly, isSha, ZERO_SHA } from "./docs-only.mjs";

export function previewDecision(env = process.env, runGit = defaultRunGit) {
  if (env.VERCEL_ENV !== "preview") {
    return { skip: false, reason: `not a preview deployment (VERCEL_ENV=${env.VERCEL_ENV ?? "unset"})` };
  }
  const previous = env.VERCEL_GIT_PREVIOUS_SHA;
  const current = env.VERCEL_GIT_COMMIT_SHA;
  if (!isSha(previous) || previous === ZERO_SHA || !isSha(current)) {
    return { skip: false, reason: "previous or current deployment SHA unavailable" };
  }
  try {
    runGit(["merge-base", "--is-ancestor", previous, current]);
  } catch {
    return { skip: false, reason: "previous deployment is not an ancestor of this commit" };
  }
  let paths;
  try {
    paths = runGit(["diff", "--name-only", "--no-renames", "-z", previous, current]).split("\0").filter(Boolean);
  } catch {
    return { skip: false, reason: "cannot diff against the previous deployment" };
  }
  if (paths.length === 0) return { skip: false, reason: "no changed paths in the preview range" };
  const classification = classifyDocsOnly(paths);
  return { skip: classification.docsOnly, reason: classification.reason };
}

function defaultRunGit(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  let decision;
  try {
    decision = previewDecision(process.env);
  } catch (error) {
    decision = { skip: false, reason: `preview decision failed: ${error.message}` };
  }
  console.error(`preview ${decision.skip ? "skip" : "build"}: ${decision.reason}`);
  process.exit(decision.skip ? 0 : 1);
}
