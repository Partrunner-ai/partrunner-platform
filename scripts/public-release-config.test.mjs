import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const REGISTRY = 'https://registry.npmjs.org';
const PACKAGES = [
  'api-core',
  'app-registry',
  'seamless',
  'shell',
  'tokens',
  'ui',
];

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

test('all six public manifests target anonymous public npm', async () => {
  for (const packageDirectory of PACKAGES) {
    const manifest = await readJson(
      join(ROOT, 'packages', packageDirectory, 'package.json'),
    );
    assert.equal(
      manifest.publishConfig?.registry,
      REGISTRY,
      manifest.name,
    );
    assert.equal(manifest.publishConfig?.access, 'public', manifest.name);
    assert.match(manifest.version, /^(?:[1-9]\d*)\.\d+\.\d+$/);
    assert.equal(manifest.private, undefined);
  }
});

test('project npm and Changesets configuration contain no auth seam', async () => {
  const npmrc = (await readFile(join(ROOT, '.npmrc'), 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  assert.deepEqual(npmrc, [`registry=${REGISTRY}`]);

  const changesets = await readJson(
    join(ROOT, '.changeset', 'config.json'),
  );
  assert.equal(changesets.access, 'public');
  assert.deepEqual(changesets.privatePackages, {
    version: false,
    tag: false,
  });
  assert.deepEqual(changesets.changelog, [
    '../scripts/changeset-changelog.cjs',
    null,
  ]);
  const formatter = require(
    resolve(ROOT, '.changeset', changesets.changelog[0]),
  );
  assert.equal(typeof formatter.getReleaseLine, 'function');
  assert.equal(typeof formatter.getDependencyReleaseLine, 'function');
});

test('release workflow separates versioning from OIDC publishing', async () => {
  const rootManifest = await readJson(join(ROOT, 'package.json'));
  assert.equal(
    rootManifest.scripts?.release,
    'node scripts/publish-verified-artifacts.mjs .artifacts/release',
  );
  const workflow = await readFile(
    join(ROOT, '.github', 'workflows', 'release.yml'),
    'utf8',
  );
  const ciWorkflow = await readFile(
    join(ROOT, '.github', 'workflows', 'ci.yml'),
    'utf8',
  );
  assert.match(workflow, /^\s{2}plan:\s*$/m);
  assert.match(workflow, /^\s{2}version-required:\s*$/m);
  assert.match(workflow, /^\s{2}publish:\s*$/m);
  assert.equal(
    workflow.match(
      /github\.repository == 'Partrunner-ai\/partrunner-platform'/g,
    )?.length,
    3,
  );
  assert.equal(
    workflow.match(/vars\.NPM_RELEASE_ENABLED == 'true'/g)?.length,
    3,
  );
  assert.equal(workflow.match(/id-token:\s*write/g)?.length, 1);
  assert.equal(workflow.match(/environment:\s*npm/g)?.length, 1);
  assert.doesNotMatch(
    workflow,
    /NODE_AUTH_TOKEN|NPM_TOKEN|packages:\s*write|pull-requests:\s*write|actions:\s*write|statuses:\s*write|npm\.pkg\.github\.com|registry-url:|cache:\s*pnpm|changesets\/action/,
  );
  assert.match(workflow, /node-version:\s*24/g);
  assert.match(workflow, /npm@11\.15\.0/g);
  assert.match(
    workflow,
    /PARTRUNNER_ARTIFACT_OUTPUT_DIR:\s*\.artifacts\/release/,
  );
  assert.match(
    workflow,
    /PARTRUNNER_RELEASE_ENABLED:\s*\$\{\{\s*vars\.NPM_RELEASE_ENABLED\s*\}\}/,
  );
  assert.match(workflow, /Require a human-authored version PR/);
  assert.match(workflow, /pnpm run version/);
  assert.doesNotMatch(workflow, /changeset publish/);

  for (const line of `${workflow}\n${ciWorkflow}`.split(/\r?\n/)) {
    const action = line.match(/uses:\s*[^@\s]+@([^\s#]+)/);
    if (!action) continue;
    assert.match(action[1], /^[0-9a-f]{40}$/);
  }
});
