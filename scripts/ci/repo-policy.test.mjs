import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const policyPath = join(process.cwd(), '.partrunner/repo-policy.yml');
const validator = join(process.cwd(), 'scripts/ci/validate-repo-policy.py');

function runValidator(content, name = 'fixture.yml') {
  const dir = mkdtempSync(join(tmpdir(), 'repo-policy-'));
  const file = join(dir, name);
  writeFileSync(file, content);
  try {
    execFileSync('python3', [validator, file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { exitCode: 0, stderr: '' };
  } catch (error) {
    return { exitCode: error.status ?? 1, stderr: String(error.stderr ?? '') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the repository manifest parses under PyYAML SafeLoader', () => {
  const result = runValidator(readFileSync(policyPath, 'utf8'));
  assert.equal(result.exitCode, 0, result.stderr);
});

test('malformed YAML is rejected', () => {
  const result = runValidator('review: [unclosed\n');
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /not valid YAML/);
});

test('duplicate mapping keys are rejected instead of overwritten', () => {
  const valid = readFileSync(policyPath, 'utf8');
  const result = runValidator(`${valid}\nversion: 1\n`);
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /duplicate key/);
});

test('an invalid review requirement is rejected', () => {
  const valid = readFileSync(policyPath, 'utf8');
  const result = runValidator(valid.replace(/requirement: \w+/, 'requirement: maybe'));
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /review\.human\.requirement/);
});

test('an invalid merge method is rejected', () => {
  const valid = readFileSync(policyPath, 'utf8');
  const result = runValidator(valid.replace(/feature_merge: \w+/, 'feature_merge: octopus'));
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /feature_merge/);
});

test('a merge method listed as never is rejected', () => {
  const valid = readFileSync(policyPath, 'utf8');
  const result = runValidator(valid.replace(/feature_merge: \w+/, 'feature_merge: rebase'));
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /feature_merge/);
});

test('a missing schema section is rejected', () => {
  const result = runValidator(`version: 1
repository:
  name: Partrunner-ai/fixture
  integration_branch: main
  production_branch: main
context:
  file: CONTEXT.md
  instructions: AGENTS.md
pull_requests:
  feature_base: main
  feature_merge: squash
deployment:
  kind: package_registry
database_changes: []
`);
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /review/);
});

test('a non-mapping document is rejected', () => {
  const result = runValidator('- not\n- a\n- mapping\n');
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /mapping/);
});
