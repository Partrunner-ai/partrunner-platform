// Conservative docs/instruction-only change classifier.
//
// This module answers one question for CI: may the current change skip the
// application verification jobs because *every* path it touches is curated
// documentation or instruction Markdown?
//
// Design constraints (see the repository AGENTS guide and docs/ci-qa.md):
//   - Only an explicit allowlist qualifies. "No path filter matched" is not
//     evidence that a change is safe: an unmatched non-docs path forces every
//     registered job instead.
//   - A path that an existing CI filter already claims (code, tooling,
//     migrations, workflow, ...) is never docs-only, even if it also lives
//     under docs/. That keeps the lane additive: it can never reduce the
//     verification the repository already performs.
//   - Anything ambiguous - first push, zero/absent/non-ancestor base SHA,
//     missing/absent push head, manual event, unreadable history, malformed or
//     missing detector output - falls back to full verification. It never
//     guesses.
//   - Repository-policy YAML is validated separately by
//     scripts/ci/validate-repo-policy.py with PyYAML; a policy change is never
//     docs-only.

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

export const ZERO_SHA = '0000000000000000000000000000000000000000';

// Curated allowlist. Keep this list small and explicit.
export const docsOnlyExact = ['AGENTS.md', 'CLAUDE.md', 'CONTEXT.md', 'README.md'];
export const docsOnlyPatterns = [/^docs\/.+\.md$/];

export function isDocsOnlyPath(path) {
  if (typeof path !== 'string' || path.length === 0) return false;
  if (path.startsWith('/') || path.split('/').includes('..')) return false;
  if (docsOnlyExact.includes(path)) return true;
  return docsOnlyPatterns.some(pattern => pattern.test(path));
}

function patternToRegExp(pattern) {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  const globstar = '\u0000';
  return new RegExp(
    `^${escaped.replaceAll('**', globstar).replaceAll('*', '[^/]*').replaceAll(globstar, '.*')}$`
  );
}

/**
 * Classify changed paths. `coupledPatterns` are the globs the repository's
 * existing CI filters already gate on; any match forces full verification.
 */
export function classifyDocsOnly(paths, { coupledPatterns = [] } = {}) {
  if (!Array.isArray(paths) || paths.length === 0) {
    return { docsOnly: false, reason: 'no changed paths resolved', unsafe: [] };
  }
  const coupled = coupledPatterns.map(patternToRegExp);
  const unsafe = paths.filter(
    path => !isDocsOnlyPath(path) || coupled.some(matcher => matcher.test(path))
  );
  if (unsafe.length > 0) {
    return {
      docsOnly: false,
      reason: `non-docs or safety-coupled paths: ${unsafe.slice(0, 5).join(', ')}`,
      unsafe,
    };
  }
  return {
    docsOnly: true,
    reason: 'all changed paths are curated docs/instruction Markdown',
    unsafe: [],
  };
}

export function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function changedPaths(cwd, base, head) {
  // --no-renames preserves the old path of a rename, so "renamed out of code"
  // still shows the code path as a change.
  return git(cwd, ['diff', '--name-only', '--no-renames', '-z', base, head])
    .split('\0')
    .filter(Boolean);
}

/**
 * Resolve the changed paths for the current event, or declare that the range
 * cannot be bounded. Never throws for ambiguous history - it fails closed with
 * `fullVerification: true`.
 */
export function resolveChangeSet({
  cwd = process.cwd(),
  eventName,
  prBaseSha,
  prHeadSha,
  pushBefore,
  pushHead,
} = {}) {
  const fallback = reason => ({ paths: [], fullVerification: true, reason });

  if (eventName === 'pull_request' || eventName === 'pull_request_target') {
    if (!isSha(prBaseSha) || !isSha(prHeadSha)) {
      return fallback('pull request base/head SHA missing or malformed');
    }
    let mergeBase;
    try {
      mergeBase = git(cwd, ['merge-base', prBaseSha, prHeadSha]).trim();
    } catch {
      return fallback('no merge base for the pull request');
    }
    if (!isSha(mergeBase)) return fallback('merge base unavailable');
    try {
      const paths = changedPaths(cwd, mergeBase, prHeadSha);
      if (paths.length === 0) return fallback('pull request has no changed paths');
      return {
        paths,
        fullVerification: false,
        reason: `pull request merge-base ${mergeBase}`,
      };
    } catch {
      return fallback('pull request diff failed');
    }
  }

  if (eventName === 'push') {
    if (!isSha(pushHead)) return fallback('push head SHA missing or malformed');
    if (!isSha(pushBefore) || pushBefore === ZERO_SHA) {
      return fallback('push base SHA missing or zero (first push)');
    }
    try {
      git(cwd, ['merge-base', '--is-ancestor', pushBefore, pushHead]);
    } catch {
      return fallback('push base is not an ancestor (force push or shallow history)');
    }
    try {
      const paths = changedPaths(cwd, pushBefore, pushHead);
      if (paths.length === 0) return fallback('push range is empty');
      return {
        paths,
        fullVerification: false,
        reason: `push range ${pushBefore}..${pushHead}`,
      };
    } catch {
      return fallback('push diff failed');
    }
  }

  return fallback(`event '${eventName ?? 'unknown'}' cannot be bounded`);
}

/**
 * Project the raw path-detector output onto the explicitly expected boolean
 * keys. Real dorny/paths-filter output also carries `changes` and `*_count`
 * metadata; those are ignored. Every expected key must be present and exactly
 * `true` or `false`, so a renamed or missing filter fails the job instead of
 * silently skipping it.
 */
export function projectDetectorFlags(flags, expected) {
  if (flags === null || typeof flags !== 'object' || Array.isArray(flags)) {
    throw new Error('path detector output must be a JSON object');
  }
  if (!Array.isArray(expected) || expected.length === 0) {
    throw new Error('at least one expected path detector flag is required');
  }
  const projected = {};
  for (const name of expected) {
    const value = flags[name];
    if (!['true', 'false'].includes(value)) {
      throw new Error(`path detector output ${name} must be exactly true or false`);
    }
    projected[name] = value;
  }
  return projected;
}

/**
 * Combine the bounded change set with the repository's existing path detector.
 * A change is docs-only only if every changed path is on the curated allowlist
 * *and* no existing filter claims any of them. When full verification is
 * required, or a non-docs change matches no registered filter, every detector
 * flag is forced true.
 */
export function decideChange({
  cwd = process.cwd(),
  eventName,
  prBaseSha,
  prHeadSha,
  pushBefore,
  pushHead,
  detectorFlags = null,
  expectedFlags = null,
  coupledPatterns = [],
} = {}) {
  const changeSet = resolveChangeSet({ cwd, eventName, prBaseSha, prHeadSha, pushBefore, pushHead });
  const classification = changeSet.fullVerification
    ? { docsOnly: false, reason: `full verification: ${changeSet.reason}` }
    : classifyDocsOnly(changeSet.paths, { coupledPatterns });

  let flags = null;
  let docsOnly = classification.docsOnly;
  let reason = classification.reason;
  if (detectorFlags !== null || expectedFlags !== null) {
    if (detectorFlags === null) throw new Error('path detector output is required');
    flags = projectDetectorFlags(detectorFlags, expectedFlags);
    for (const name of Object.keys(flags)) {
      flags[name] = changeSet.fullVerification ? 'true' : flags[name];
    }
    if (Object.values(flags).some(value => value === 'true')) docsOnly = false;
    if (!docsOnly && Object.values(flags).every(value => value === 'false')) {
      // A non-docs change that no filter claims would otherwise skip every job.
      for (const name of Object.keys(flags)) flags[name] = 'true';
      reason = 'non-docs change matched no registered filter; full verification';
    }
  }

  return { docsOnly, fullVerification: changeSet.fullVerification, reason, flags };
}

function writeOutputs(pairs, env = process.env) {
  const lines = Object.entries(pairs).map(([key, value]) => `${key}=${value}`);
  if (env.GITHUB_OUTPUT) {
    appendFileSync(env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  } else {
    console.log(lines.join('\n'));
  }
}

function main() {
  const mode = process.argv[2];
  if (mode !== '--flags') {
    throw new Error(`unsupported mode: ${mode ?? '(none)'}; expected --flags`);
  }

  const rawFlags = process.env.CI_PATH_FLAGS;
  const detectorFlags = rawFlags === undefined || rawFlags === '' ? null : JSON.parse(rawFlags);
  const expectedFlags = (process.env.EXPECTED_FLAGS ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const decision = decideChange({
    cwd: process.cwd(),
    eventName: process.env.EVENT_NAME,
    prBaseSha: process.env.PR_BASE_SHA,
    prHeadSha: process.env.PR_HEAD_SHA,
    pushBefore: process.env.PUSH_BEFORE,
    pushHead: process.env.PUSH_HEAD,
    detectorFlags,
    expectedFlags: expectedFlags.length > 0 ? expectedFlags : null,
    coupledPatterns: (process.env.COUPLED_PATTERNS ?? '')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean),
  });

  const outputs = { docs_only: String(decision.docsOnly) };
  if (decision.flags) Object.assign(outputs, decision.flags);

  console.error(
    `docs-only: docs_only=${decision.docsOnly} full_verification=${decision.fullVerification} (${decision.reason})`
  );
  writeOutputs(outputs);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    main();
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
