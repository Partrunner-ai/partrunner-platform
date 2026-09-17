// Conservative docs/instruction-only change classifier.
//
// This module answers one question for CI: may the current change skip the
// application verification jobs because *every* path it touches is curated
// documentation or instruction Markdown?
//
// Design constraints (see the repository AGENTS guide and docs/ci-qa.md):
//   - Only an explicit allowlist qualifies. "No path filter matched" is not
//     evidence that a change is safe.
//   - A path that an existing CI filter already claims (code, tooling,
//     migrations, workflow, ...) is never docs-only, even if it also lives
//     under docs/. That keeps the lane additive: it can never reduce the
//     verification the repository already performs.
//   - Anything ambiguous - first push, zero/absent/non-ancestor base SHA,
//     manual event, unreadable history, malformed detector output - falls back
//     to full verification. It never guesses.
//   - Repository policy YAML is validated structurally; a policy change itself
//     always takes the full-verification path.

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

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
    const head = isSha(pushHead) ? pushHead : 'HEAD';
    if (!isSha(pushBefore) || pushBefore === ZERO_SHA) {
      return fallback('push base SHA missing or zero (first push)');
    }
    try {
      git(cwd, ['merge-base', '--is-ancestor', pushBefore, head]);
    } catch {
      return fallback('push base is not an ancestor (force push or shallow history)');
    }
    try {
      const paths = changedPaths(cwd, pushBefore, head);
      if (paths.length === 0) return fallback('push range is empty');
      return {
        paths,
        fullVerification: false,
        reason: `push range ${pushBefore}..${head}`,
      };
    } catch {
      return fallback('push diff failed');
    }
  }

  return fallback(`event '${eventName ?? 'unknown'}' cannot be bounded`);
}

function stripComment(line) {
  let out = '';
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      out += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '#' && (i === 0 || line[i - 1] === ' ')) break;
    out += ch;
  }
  return out.replace(/\s+$/, '');
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function indentOf(line) {
  return line.match(/^ */)[0].length;
}

function findSection(lines, name, baseIndent) {
  const index = lines.findIndex(raw => {
    const line = stripComment(raw);
    const match = line.match(/^\s*([A-Za-z_][\w-]*):/);
    return Boolean(match) && indentOf(line) === baseIndent && match[1] === name;
  });
  if (index === -1) return null;
  const body = [];
  for (let i = index + 1; i < lines.length; i++) {
    const line = stripComment(lines[i]);
    if (line.trim() === '') continue;
    if (indentOf(line) <= baseIndent) break;
    body.push(line);
  }
  if (body.length === 0) return { body, indent: null };
  return { body, indent: indentOf(body[0]) };
}

function scalarIn(section, key) {
  if (!section || section.indent === null) return null;
  for (const line of section.body) {
    if (indentOf(line) !== section.indent) continue;
    const match = line.match(new RegExp(`^\\s*([A-Za-z_][\\w-]*):\\s*(.+)$`));
    if (match && match[1] === key) return unquote(match[2]);
  }
  return null;
}

/**
 * Structural validation of `.partrunner/repo-policy.yml`. This deliberately
 * reads only the schema keys and invariants the delivery flow depends on; it
 * fails closed when they are missing or inconsistent. Repository-policy changes
 * are never classified as docs-only regardless of the result.
 */
export function validateRepoPolicy(text) {
  const errors = [];
  const lines = String(text ?? '').split('\n');
  const clean = lines.map(stripComment);

  const version = clean.find(line => /^version:/.test(line));
  if (!version || unquote(version.replace(/^version:/, '')) !== '1') {
    errors.push('version must be 1');
  }

  const repository = findSection(lines, 'repository', 0);
  const name = scalarIn(repository, 'name');
  const integration = scalarIn(repository, 'integration_branch');
  const production = scalarIn(repository, 'production_branch');
  if (!name || !/^Partrunner-ai\/[a-z0-9-]+$/.test(name)) {
    errors.push('repository.name must be an owner/repo slug');
  }
  for (const branch of [integration, production]) {
    if (branch !== 'staging' && branch !== 'main') {
      errors.push('repository branches must be staging or main');
      break;
    }
  }

  const context = findSection(lines, 'context', 0);
  for (const key of ['file', 'instructions']) {
    const value = scalarIn(context, key);
    if (!value || !value.endsWith('.md')) errors.push(`context.${key} must be a Markdown path`);
  }

  const pullRequests = findSection(lines, 'pull_requests', 0);
  const featureBase = scalarIn(pullRequests, 'feature_base');
  if (!featureBase) {
    errors.push('pull_requests.feature_base is required');
  } else if (featureBase !== integration) {
    errors.push('pull_requests.feature_base must match repository.integration_branch');
  }
  if (integration && production && integration !== production) {
    const section = findSection(pullRequests.body, 'promotion', pullRequests.indent);
    if (!section || !scalarIn(section, 'source') || !scalarIn(section, 'target')) {
      errors.push('pull_requests.promotion.source/target required when branches differ');
    }
  }

  if (findSection(lines, 'deployment', 0) === null) errors.push('deployment section is required');
  if (findSection(lines, 'review', 0) === null) errors.push('review section is required');
  if (findSection(lines, 'database_changes', 0) === null) {
    errors.push('database_changes section is required');
  }

  return {
    ok: errors.length === 0,
    errors,
    policy: { name, integration, production, featureBase },
  };
}

export function assertDetectorFlags(flags) {
  if (flags === null || typeof flags !== 'object' || Array.isArray(flags)) {
    throw new Error('path detector output must be a JSON object');
  }
  for (const [name, value] of Object.entries(flags)) {
    if (!['true', 'false'].includes(value)) {
      throw new Error(`path detector output ${name} must be exactly true or false`);
    }
  }
}

/**
 * Combine the bounded change set with the repository's existing path detector.
 * A change is docs-only only if every changed path is on the curated allowlist
 * *and* no existing filter claims any of them. When full verification is
 * required, every detector flag is forced true.
 */
export function decideChange({
  cwd = process.cwd(),
  eventName,
  prBaseSha,
  prHeadSha,
  pushBefore,
  pushHead,
  detectorFlags = null,
  coupledPatterns = [],
} = {}) {
  const changeSet = resolveChangeSet({ cwd, eventName, prBaseSha, prHeadSha, pushBefore, pushHead });
  const classification = changeSet.fullVerification
    ? { docsOnly: false, reason: `full verification: ${changeSet.reason}` }
    : classifyDocsOnly(changeSet.paths, { coupledPatterns });

  let flags = null;
  let docsOnly = classification.docsOnly;
  if (detectorFlags !== null) {
    assertDetectorFlags(detectorFlags);
    flags = {};
    for (const [name, value] of Object.entries(detectorFlags)) {
      flags[name] = changeSet.fullVerification ? 'true' : value;
    }
    if (Object.values(flags).some(value => value === 'true')) docsOnly = false;
  }

  return {
    docsOnly,
    fullVerification: changeSet.fullVerification,
    reason: classification.reason,
    flags,
  };
}

function writeOutputs(pairs, env = process.env) {
  const lines = Object.entries(pairs).map(([key, value]) => `${key}=${value}`);
  if (env.GITHUB_OUTPUT) {
    appendFileSync(env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  } else {
    console.log(lines.join('\n'));
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode !== '--flags') {
    throw new Error(`unsupported mode: ${mode ?? '(none)'}; expected --flags`);
  }

  const policyPath = process.env.REPO_POLICY_PATH ?? '.partrunner/repo-policy.yml';
  let policyText;
  try {
    policyText = readFileSync(policyPath, 'utf8');
  } catch {
    throw new Error(`cannot read repository policy at ${policyPath}`);
  }
  const policy = validateRepoPolicy(policyText);
  if (!policy.ok) {
    throw new Error(`invalid repository policy: ${policy.errors.join('; ')}`);
  }

  const changeSet = {
    eventName: process.env.EVENT_NAME,
    prBaseSha: process.env.PR_BASE_SHA,
    prHeadSha: process.env.PR_HEAD_SHA,
    pushBefore: process.env.PUSH_BEFORE,
    pushHead: process.env.PUSH_HEAD,
  };
  const rawFlags = process.env.CI_PATH_FLAGS;
  const detectorFlags = rawFlags === undefined || rawFlags === '' ? null : JSON.parse(rawFlags);

  const decision = decideChange({
    cwd: process.cwd(),
    ...changeSet,
    detectorFlags,
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
  main().catch(error => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
