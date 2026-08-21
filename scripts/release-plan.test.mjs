import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  APPROVED_INITIAL_RELEASES,
  assertApprovedInitialRelease,
  assertInitialReleasePreflight,
  decideReleaseMode,
  inspectPublicPackageNamespaces,
  inspectPublishedVersions,
  isChangesetFile,
} from './release-plan.mjs';

const packages = [
  {
    directory: 'packages/example',
    name: '@partrunner-ai/example',
    version: '1.0.0',
  },
];

test('chooses one fail-closed release mode', () => {
  assert.equal(
    decideReleaseMode(['feature.md'], [
      { ...packages[0], published: true },
    ]),
    'version',
  );
  assert.equal(
    decideReleaseMode([], [{ ...packages[0], published: false }]),
    'publish',
  );
  assert.equal(
    decideReleaseMode([], [{ ...packages[0], published: true }]),
    'none',
  );
  assert.throws(
    () =>
      decideReleaseMode(['feature.md'], [
        { ...packages[0], published: false },
      ]),
    /state is ambiguous/,
  );
});

test('matches Changesets Markdown discovery rules', () => {
  assert.equal(isChangesetFile('feature.md'), true);
  assert.equal(isChangesetFile('README.md'), false);
  assert.equal(isChangesetFile('.hidden.md'), false);
  assert.equal(isChangesetFile('config.json'), false);
});

test('treats only an exact npm 404 as unpublished', async () => {
  const unpublished = await inspectPublishedVersions(
    packages,
    async () => ({ status: 404 }),
  );
  assert.equal(unpublished[0].published, false);

  const published = await inspectPublishedVersions(
    packages,
    async () => ({ status: 200 }),
  );
  assert.equal(published[0].published, true);

  await assert.rejects(
    inspectPublishedVersions(packages, async () => ({ status: 503 })),
    /returned 503/,
  );
});

test('reports only currently visible public registry state', async () => {
  const absent = await inspectPublicPackageNamespaces(
    packages,
    async () => ({ status: 404 }),
  );
  assert.deepEqual(absent[0], {
    ...packages[0],
    publicRegistryEmpty: true,
    publiclyVisibleVersions: 0,
  });

  const versionless = await inspectPublicPackageNamespaces(
    packages,
    async () => ({
      status: 200,
      json: async () => ({ versions: {} }),
    }),
  );
  assert.equal(versionless[0].publicRegistryEmpty, true);
  assert.equal(versionless[0].publiclyVisibleVersions, 0);

  const occupied = await inspectPublicPackageNamespaces(packages, async () => ({
    status: 200,
    json: async () => ({ versions: { '0.9.0': {} } }),
  }));
  assert.equal(occupied[0].publicRegistryEmpty, false);
  assert.equal(occupied[0].publiclyVisibleVersions, 1);

  await assert.rejects(
    inspectPublicPackageNamespaces(packages, async () => ({
      status: 200,
      json: async () => ({ name: '@partrunner-ai/example' }),
    })),
    /malformed packument/,
  );
  await assert.rejects(
    inspectPublicPackageNamespaces(packages, async () => ({ status: 503 })),
    /returned 503/,
  );
});

test('requires the exact approved initial package and version matrix', () => {
  const approved = Object.entries(APPROVED_INITIAL_RELEASES).map(
    ([name, version]) => ({ name, version, published: false }),
  );
  assert.doesNotThrow(() => assertApprovedInitialRelease(approved));
  assert.throws(
    () =>
      assertApprovedInitialRelease(
        approved.map((packageInfo) =>
          packageInfo.name === '@partrunner-ai/ui'
            ? { ...packageInfo, version: '9.9.9' }
            : packageInfo,
        ),
      ),
    /matrix mismatch/,
  );
  assert.throws(
    () => assertApprovedInitialRelease(approved.slice(1)),
    /matrix mismatch/,
  );
});

test('fails the initial release preflight for a public package', () => {
  const unpublished = Object.entries(APPROVED_INITIAL_RELEASES).map(
    ([name, version]) => ({ name, version, published: false }),
  );
  const empty = unpublished.map((packageInfo) => ({
    ...packageInfo,
    publicRegistryEmpty: true,
    publiclyVisibleVersions: 0,
  }));
  assert.doesNotThrow(() =>
    assertInitialReleasePreflight(unpublished, empty),
  );

  assert.throws(
    () =>
      assertInitialReleasePreflight(
        unpublished.map((packageInfo, index) => ({
          ...packageInfo,
          published: index === 0,
        })),
        empty,
      ),
    /current versions already published/,
  );
  assert.throws(
    () =>
      assertInitialReleasePreflight(
        unpublished,
        empty.map((packageInfo, index) =>
          index === 0
            ? {
                ...packageInfo,
                publicRegistryEmpty: false,
                publiclyVisibleVersions: 1,
              }
            : packageInfo,
        ),
      ),
    /already visible in the public registry/,
  );
});
