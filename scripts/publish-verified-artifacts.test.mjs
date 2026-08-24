import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  PUBLISH_ORDER,
  publishVerifiedArtifacts,
  readVerifiedManifest,
  verifyPublisherEnvironment,
  verifyRegistryIntegrity,
} from './publish-verified-artifacts.mjs';

const source = {
  commit: 'a'.repeat(40),
  tree: 'b'.repeat(40),
};

test('requires the exact guarded OIDC workflow environment', () => {
  const environment = {
    GITHUB_ACTIONS: 'true',
    GITHUB_REPOSITORY: 'Partrunner-ai/partrunner-platform',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_SHA: source.commit,
    PARTRUNNER_RELEASE_ENABLED: 'true',
    ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.test/oidc',
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fixture-token',
  };
  assert.doesNotThrow(() =>
    verifyPublisherEnvironment(environment, '11.15.0', source.commit),
  );
  assert.throws(
    () =>
      verifyPublisherEnvironment(
        { ...environment, NPM_TOKEN: 'forbidden' },
        '11.15.0',
        source.commit,
      ),
    /NPM_TOKEN must not be present/,
  );
  assert.throws(
    () =>
      verifyPublisherEnvironment(environment, '11.14.0', source.commit),
    /requires npm 11\.15\.0/,
  );
});

test('requires registry integrity to match retained bytes', () => {
  const packageInfo = {
    name: '@partrunner-ai/example',
    version: '1.0.0',
    integrity: 'sha512-fixture',
  };
  assert.doesNotThrow(() =>
    verifyRegistryIntegrity(packageInfo, {
      dist: { integrity: 'sha512-fixture' },
    }),
  );
  assert.throws(
    () =>
      verifyRegistryIntegrity(packageInfo, {
        dist: { integrity: 'sha512-other' },
      }),
    /does not match/,
  );
});

test('verifies the retained source ledger and every tarball digest', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'partrunner-publish-test-'));
  try {
    const packages = [];
    for (const [index, name] of PUBLISH_ORDER.entries()) {
      const filename = `package-${index}.tgz`;
      const bytes = Buffer.from(`fixture-${name}`);
      await writeFile(join(directory, filename), bytes);
      packages.push({
        name,
        version: '1.0.0',
        filename,
        bytes: bytes.byteLength,
        integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
      });
    }
    await writeFile(
      join(directory, 'manifest.json'),
      JSON.stringify({ schemaVersion: 1, source, packages }),
    );
    const manifest = await readVerifiedManifest(directory, {
      gitCommit: () => source.commit,
      gitTree: () => source.tree,
      gitStatus: () => '',
    });
    assert.equal(manifest.packages.length, PUBLISH_ORDER.length);

    await writeFile(join(directory, packages[0].filename), 'tampered');
    await assert.rejects(
      readVerifiedManifest(directory, {
        gitCommit: () => source.commit,
        gitTree: () => source.tree,
        gitStatus: () => '',
      }),
      /Expected values to be strictly equal|digest is invalid/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('completes every registry preflight before the first publish', async () => {
  const packages = PUBLISH_ORDER.map((name, index) => ({
    name,
    version: '1.0.0',
    filename: `package-${index}.tgz`,
    bytes: 1,
    integrity: `sha512-${index}`,
  }));
  let lookupCount = 0;
  let publishCount = 0;
  await assert.rejects(
    publishVerifiedArtifacts('/unused', {
      environment: {
        GITHUB_ACTIONS: 'true',
        GITHUB_REPOSITORY: 'Partrunner-ai/partrunner-platform',
        GITHUB_REF: 'refs/heads/main',
        GITHUB_SHA: source.commit,
        PARTRUNNER_RELEASE_ENABLED: 'true',
        ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.test/oidc',
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fixture-token',
      },
      readManifest: async () => ({
        source,
        packages,
      }),
      readNpmVersion: () => '11.15.0',
      lookup: async (packageInfo) => {
        lookupCount += 1;
        if (packageInfo.name === PUBLISH_ORDER.at(-1)) {
          return { dist: { integrity: 'sha512-mismatch' } };
        }
        return null;
      },
      publish: () => {
        publishCount += 1;
      },
    }),
    /does not match/,
  );
  assert.equal(lookupCount, PUBLISH_ORDER.length);
  assert.equal(publishCount, 0);
});

test('publishes missing artifacts in dependency order', async () => {
  const packages = PUBLISH_ORDER.map((name, index) => ({
    name,
    version: '1.0.0',
    filename: `package-${index}.tgz`,
    bytes: 1,
    integrity: `sha512-${index}`,
  }));
  const published = [];
  await publishVerifiedArtifacts('/artifacts', {
    environment: {
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY: 'Partrunner-ai/partrunner-platform',
      GITHUB_REF: 'refs/heads/main',
      GITHUB_SHA: source.commit,
      PARTRUNNER_RELEASE_ENABLED: 'true',
      ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.test/oidc',
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fixture-token',
    },
    readManifest: async () => ({ source, packages }),
    readNpmVersion: () => '11.15.0',
    lookup: async () => null,
    log: () => {},
    publish: (tarball) => published.push(tarball),
    waitForPublished: async (packageInfo) => ({
      dist: { integrity: packageInfo.integrity },
    }),
  });
  assert.deepEqual(
    published.map((path) => path.split('/').at(-1)),
    packages.map((packageInfo) => packageInfo.filename),
  );
});
