import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  classifyDocsOnly,
  decideChange,
  isDocsOnlyPath,
  projectDetectorFlags,
  resolveChangeSet,
  ZERO_SHA,
} from './docs-only.mjs';

test('accepts only curated docs and instruction Markdown', () => {
  for (const path of [
    'AGENTS.md',
    'CLAUDE.md',
    'CONTEXT.md',
    'README.md',
    'docs/guide.md',
    'docs/runbooks/deep/nested.md',
  ]) {
    assert.equal(isDocsOnlyPath(path), true, path);
  }
  for (const path of [
    'docs/guide.mdx',
    'docs/guide.md.bak',
    'src/readme.md',
    'docs/nested/readme.txt',
    'docs/../src/app.ts',
    '/AGENTS.md',
    'docs',
    '',
  ]) {
    assert.equal(isDocsOnlyPath(path), false, path);
  }
});

test('classifies an all-docs change as docs-only', () => {
  const result = classifyDocsOnly(['AGENTS.md', 'docs/guide.md']);
  assert.equal(result.docsOnly, true);
});

test('rejects mixed, deleted, renamed and unknown changes', () => {
  assert.equal(classifyDocsOnly(['docs/guide.md', 'src/app.ts']).docsOnly, false);
  assert.equal(classifyDocsOnly(['docs/removed.md', 'src/removed.ts']).docsOnly, false);
  // A rename out of code keeps the old path because --no-renames is used.
  assert.equal(classifyDocsOnly(['src/app.ts', 'docs/app.md']).docsOnly, false);
  assert.equal(classifyDocsOnly(['Dockerfile']).docsOnly, false);
  assert.equal(classifyDocsOnly(['.env.example']).docsOnly, false);
  assert.equal(classifyDocsOnly([]).docsOnly, false);
});

test('existing CI filters override the docs allowlist', () => {
  const result = classifyDocsOnly(['docs/development.md'], {
    coupledPatterns: ['docs/development.md', 'src/**'],
  });
  assert.equal(result.docsOnly, false);
  assert.deepEqual(result.unsafe, ['docs/development.md']);
});

function fixtureRepo(t) {
  const dir = mkdtempSync(join(tmpdir(), 'docs-only-fixture-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = (...args) =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  run('init');
  run('config', 'user.name', 'CI fixture');
  run('config', 'user.email', 'ci@example.invalid');
  const commit = message => {
    run('add', '-A');
    run('commit', '-m', message);
    return run('rev-parse', 'HEAD');
  };
  const write = (path, contents) => {
    const target = join(dir, path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, contents);
  };
  return { dir, run, commit, write, branch: run('branch', '--show-current') };
}

test('pull requests compare against the merge base, not the base tip', t => {
  const repo = fixtureRepo(t);
  repo.write('src/app.ts', 'export const app = 1;\n');
  const base = repo.commit('base');
  repo.run('checkout', '-b', 'feature');
  repo.write('docs/guide.md', '# guide\n');
  const head = repo.commit('docs only');
  repo.run('checkout', repo.branch);
  repo.write('src/app.ts', 'export const app = 2;\n');
  repo.commit('base branch drift');

  const change = resolveChangeSet({
    cwd: repo.dir,
    eventName: 'pull_request',
    prBaseSha: base,
    prHeadSha: head,
  });
  assert.equal(change.fullVerification, false);
  assert.deepEqual(change.paths, ['docs/guide.md']);
  assert.equal(classifyDocsOnly(change.paths).docsOnly, true);
});

test('push events compare the pushed range', t => {
  const repo = fixtureRepo(t);
  repo.write('src/app.ts', 'export const app = 1;\n');
  const before = repo.commit('base');
  repo.write('docs/guide.md', '# guide\n');
  const head = repo.commit('docs only');

  const change = resolveChangeSet({
    cwd: repo.dir,
    eventName: 'push',
    pushBefore: before,
    pushHead: head,
  });
  assert.equal(change.fullVerification, false);
  assert.deepEqual(change.paths, ['docs/guide.md']);
});

test('push events never compare all drift against the default branch', t => {
  const repo = fixtureRepo(t);
  repo.write('src/app.ts', 'export const app = 1;\n');
  repo.run('branch', '-M', 'staging');
  const before = repo.commit('base');
  repo.write('docs/guide.md', '# guide\n');
  const head = repo.commit('docs only');

  const change = resolveChangeSet({
    cwd: repo.dir,
    eventName: 'push',
    pushBefore: before,
    pushHead: head,
  });
  assert.deepEqual(change.paths, ['docs/guide.md']);
  assert.equal(classifyDocsOnly(change.paths).docsOnly, true);
});

test('first pushes, force pushes and manual events fall back to full verification', t => {
  const repo = fixtureRepo(t);
  repo.write('src/app.ts', 'export const app = 1;\n');
  repo.commit('base');
  repo.write('docs/guide.md', '# guide\n');
  const head = repo.commit('docs only');

  for (const input of [
    { eventName: 'push', pushBefore: ZERO_SHA, pushHead: head },
    { eventName: 'push', pushBefore: undefined, pushHead: head },
    { eventName: 'push', pushBefore: 'not-a-sha', pushHead: head },
    { eventName: 'push', pushBefore: head, pushHead: head },
    { eventName: 'push', pushBefore: head, pushHead: undefined },
    { eventName: 'push', pushBefore: head, pushHead: 'not-a-sha' },
    { eventName: 'push', pushHead: head },
    { eventName: 'workflow_dispatch', pushHead: head },
    { eventName: 'schedule' },
  ]) {
    const change = resolveChangeSet({ cwd: repo.dir, ...input });
    assert.equal(change.fullVerification, true, JSON.stringify(input));
    assert.equal(classifyDocsOnly(change.paths).docsOnly, false);
  }
});

test('a non-ancestor push base is ambiguous and fails closed', t => {
  const repo = fixtureRepo(t);
  repo.write('src/app.ts', 'export const app = 1;\n');
  repo.commit('base');
  repo.write('docs/guide.md', '# guide\n');
  const head = repo.commit('docs only');
  repo.run('checkout', '-b', 'other');
  repo.write('src/other.ts', 'export const other = 1;\n');
  const otherHead = repo.commit('other');
  repo.run('checkout', '-');

  const change = resolveChangeSet({
    cwd: repo.dir,
    eventName: 'push',
    pushBefore: otherHead,
    pushHead: head,
  });
  assert.equal(change.fullVerification, true);
  assert.equal(otherHead === head, false);
});

test('malformed pull request metadata fails closed', () => {
  const change = resolveChangeSet({
    eventName: 'pull_request',
    prBaseSha: '0000000',
    prHeadSha: undefined,
  });
  assert.equal(change.fullVerification, true);
});

test('dorny metadata is projected onto the expected boolean keys', () => {
  const projected = projectDetectorFlags(
    {
      changes: '["app"]',
      app: 'true',
      app_count: '3',
      tooling: 'false',
      tooling_count: '0',
      worker: 'false',
      worker_count: '0',
    },
    ['app', 'tooling', 'worker']
  );
  assert.deepEqual(projected, { app: 'true', tooling: 'false', worker: 'false' });
});

test('a missing or malformed expected detector key fails the job', () => {
  assert.throws(
    () => projectDetectorFlags({ app: 'true', app_count: '1' }, ['app', 'tooling']),
    /tooling must be exactly true or false/
  );
  for (const value of [undefined, '', 'TRUE', true, 'yes']) {
    assert.throws(() =>
      projectDetectorFlags({ app: value, changes: '["app"]' }, ['app'])
    );
  }
  assert.throws(() => projectDetectorFlags(null, ['app']));
  assert.throws(() => projectDetectorFlags({ app: 'true' }, []));
});

test('decideChange keeps docs-only only when no existing filter claims the change', t => {
  const repo = fixtureRepo(t);
  repo.write('src/app.ts', 'export const app = 1;\n');
  repo.write('docs/guide.md', '# guide\n');
  const before = repo.commit('base');
  repo.write('docs/guide.md', '# guide v2\n');
  const head = repo.commit('docs only');

  const clean = decideChange({
    cwd: repo.dir,
    eventName: 'push',
    pushBefore: before,
    pushHead: head,
    detectorFlags: { changes: '["app"]', app: 'false', app_count: '0', tooling: 'false', tooling_count: '0' },
    expectedFlags: ['app', 'tooling'],
  });
  assert.equal(clean.docsOnly, true);
  assert.deepEqual(clean.flags, { app: 'false', tooling: 'false' });

  const coupled = decideChange({
    cwd: repo.dir,
    eventName: 'push',
    pushBefore: before,
    pushHead: head,
    detectorFlags: { app: 'false', tooling: 'true' },
    expectedFlags: ['app', 'tooling'],
  });
  assert.equal(coupled.docsOnly, false);
});

test('an unmatched non-docs path forces every registered job', t => {
  const repo = fixtureRepo(t);
  repo.write('src/app.ts', 'export const app = 1;\n');
  const before = repo.commit('base');
  repo.write('unknown.config.xyz', 'value\n');
  const head = repo.commit('unknown');

  const decision = decideChange({
    cwd: repo.dir,
    eventName: 'push',
    pushBefore: before,
    pushHead: head,
    detectorFlags: { app: 'false', tooling: 'false' },
    expectedFlags: ['app', 'tooling'],
  });
  assert.equal(decision.docsOnly, false);
  assert.deepEqual(decision.flags, { app: 'true', tooling: 'true' });
  assert.match(decision.reason, /matched no registered filter/);
});

test('an instruction-only change skips the app jobs; mixed code never does', t => {
  const repo = fixtureRepo(t);
  repo.write('src/app.ts', 'export const app = 1;\n');
  const before = repo.commit('base');
  repo.write('AGENTS.md', '# instructions\n');
  const docsHead = repo.commit('instructions only');
  const flags = { app: 'false', tooling: 'false', worker: 'false' };

  const instructionOnly = decideChange({
    cwd: repo.dir,
    eventName: 'pull_request',
    prBaseSha: before,
    prHeadSha: docsHead,
    detectorFlags: flags,
    expectedFlags: ['app', 'tooling', 'worker'],
  });
  assert.equal(instructionOnly.docsOnly, true);
  assert.deepEqual(instructionOnly.flags, flags);

  repo.write('src/app.ts', 'export const app = 2;\n');
  const mixedHead = repo.commit('docs plus code');
  const mixed = decideChange({
    cwd: repo.dir,
    eventName: 'pull_request',
    prBaseSha: before,
    prHeadSha: mixedHead,
    detectorFlags: { app: 'true', tooling: 'false', worker: 'false' },
    expectedFlags: ['app', 'tooling', 'worker'],
  });
  assert.equal(mixed.docsOnly, false);
  assert.equal(mixed.flags.app, 'true');
});

test('decideChange forces every detector flag true when the range is unbounded', t => {
  const repo = fixtureRepo(t);
  repo.write('src/app.ts', 'export const app = 1;\n');
  repo.commit('base');
  repo.write('docs/guide.md', '# guide\n');
  const head = repo.commit('docs only');
  const decision = decideChange({
    cwd: repo.dir,
    eventName: 'push',
    pushBefore: ZERO_SHA,
    pushHead: head,
    detectorFlags: { app: 'false', tooling: 'false', worker: 'false' },
    expectedFlags: ['app', 'tooling', 'worker'],
  });
  assert.equal(decision.fullVerification, true);
  assert.equal(decision.docsOnly, false);
  assert.deepEqual(decision.flags, { app: 'true', tooling: 'true', worker: 'true' });
});

test('decideChange rejects malformed detector flags', () => {
  assert.throws(() =>
    decideChange({
      eventName: 'schedule',
      detectorFlags: { app: 'maybe' },
      expectedFlags: ['app'],
    })
  );
});

test('root instruction Markdown is not claimed by any code or tooling filter', () => {
  const workflowsDir = join(process.cwd(), '.github/workflows');
  const workflows = readdirSync(workflowsDir).filter(name => name.endsWith('.yml') || name.endsWith('.yaml'));
  for (const workflow of workflows) {
    const text = readFileSync(join(workflowsDir, workflow), 'utf8');
    for (const path of ['AGENTS.md', 'CLAUDE.md', 'CONTEXT.md']) {
      assert.ok(
        !text.includes(`- '${path}'`),
        `${workflow} must not pin ${path} to a code/tooling filter now that the docs-only validator covers it`
      );
    }
  }
});
