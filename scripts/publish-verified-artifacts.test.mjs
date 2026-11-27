import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  PUBLISH_ORDER,
  publishVerifiedArtifacts,
  readVerifiedManifest,
  verifyPublisherEnvironment,
  verifyExistingVersion,
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
    assert.equal(manifest.packages.length, 6);

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
  assert.equal(lookupCount, 6);
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

const { Response } = globalThis;
const environment = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'Partrunner-ai/partrunner-platform',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_SHA: source.commit,
  PARTRUNNER_RELEASE_ENABLED: 'true',
  ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.test/oidc',
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fixture-token',
};
const TARBALL_URL = 'https://registry.npmjs.org/@partrunner-ai/tokens/-/tokens-1.0.0.tgz';
const integrityOf = (bytes) =>
  `sha512-${createHash('sha512').update(bytes).digest('base64')}`;

async function tarballFixture(t, files) {
  const directory = await mkdtemp(join(tmpdir(), 'partrunner-existing-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const make = async (name, contents) => {
    await mkdir(join(directory, name, 'package'), { recursive: true });
    for (const [path, text] of Object.entries(contents)) {
      await writeFile(join(directory, name, 'package', path), text);
    }
    execFileSync('tar', ['-czf', join(directory, `${name}.tgz`), '-C', join(directory, name), 'package']);
    return readFile(join(directory, `${name}.tgz`));
  };
  const published = await make('published', files.published);
  const retained = await make('retained', files.retained);
  return {
    directory,
    published,
    packageInfo: {
      name: '@partrunner-ai/tokens',
      version: '1.0.0',
      filename: 'retained.tgz',
      integrity: integrityOf(retained),
    },
  };
}

const manifest = (name) => JSON.stringify({ name, version: '1.0.0', dependencies: { a: '^1.0.0' } });
const withDev = (dev, extra = {}) =>
  JSON.stringify({ name: '@partrunner-ai/tokens', version: '1.0.0', devDependencies: dev, ...extra });

test('accepts an existing version that differs only in devDependencies', async (t) => {
  const { directory, published, packageInfo } = await tarballFixture(t, {
    published: { 'package.json': withDev({ vite: '^5.0.0' }), 'index.js': 'a' },
    retained: { 'package.json': withDev({ vite: '^6.0.0' }), 'index.js': 'a' },
  });
  const lines = [];
  const metadata = { dist: { tarball: TARBALL_URL, integrity: integrityOf(published) } };
  await verifyExistingVersion(directory, packageInfo, metadata, {
    fetchImpl: async () => new Response(published),
    log: (line) => lines.push(line),
  });
  assert.match(lines[0], /differs from the retained tarball only in devDependencies/);
});

test('rejects an existing version that differs in dependencies or another file', async (t) => {
  for (const retained of [
    { 'package.json': withDev({ vite: '^6.0.0' }, { dependencies: { a: '1' } }), 'index.js': 'a' },
    { 'package.json': withDev({ vite: '^5.0.0' }), 'index.js': 'b' },
    { 'package.json': '{"devDependencies": 2,', 'index.js': 'a' },
  ]) {
    const { directory, published, packageInfo } = await tarballFixture(t, {
      published: { 'package.json': withDev({ vite: '^5.0.0' }), 'index.js': 'a' },
      retained,
    });
    const metadata = { dist: { tarball: TARBALL_URL, integrity: integrityOf(published) } };
    await assert.rejects(
      verifyExistingVersion(directory, packageInfo, metadata, {
        fetchImpl: async () => new Response(published),
        log: () => {},
      }),
      /registry integrity does not match/,
    );
  }
});

test('rejects a tarball download that does not match dist.integrity', async (t) => {
  const { directory, published, packageInfo } = await tarballFixture(t, {
    published: { 'package.json': withDev({ vite: '^5.0.0' }) },
    retained: { 'package.json': withDev({ vite: '^6.0.0' }) },
  });
  const metadata = { dist: { tarball: TARBALL_URL, integrity: integrityOf(published) } };
  await assert.rejects(
    verifyExistingVersion(directory, packageInfo, metadata, {
      fetchImpl: async () => new Response('tampered'),
      log: () => {},
    }),
    /download does not match its registry integrity/,
  );
});

test('rejects a tarball URL on another host without fetching it', async (t) => {
  const { directory, published, packageInfo } = await tarballFixture(t, {
    published: { 'package.json': withDev({ vite: '^5.0.0' }) },
    retained: { 'package.json': withDev({ vite: '^6.0.0' }) },
  });
  for (const tarball of [
    'https://evil.example/tokens-1.0.0.tgz',
    'https://registry.npmjs.org.evil.example/tokens-1.0.0.tgz',
    'http://registry.npmjs.org/tokens-1.0.0.tgz',
  ]) {
    await assert.rejects(
      verifyExistingVersion(
        directory,
        packageInfo,
        { dist: { tarball, integrity: integrityOf(published) } },
        { fetchImpl: async () => assert.fail('must not fetch'), log: () => {} },
      ),
      /tarball URL is not on/,
    );
  }
});

test('publishes nothing when a later existing version fails the preflight', async (t) => {
  const { directory, published, packageInfo } = await tarballFixture(t, {
    published: { 'package.json': manifest('x'), 'index.js': 'a' },
    retained: { 'package.json': manifest('x'), 'index.js': 'b' },
  });
  const packages = PUBLISH_ORDER.map((name, index) => ({
    ...packageInfo,
    name,
    filename: index === 1 ? 'retained.tgz' : `missing-${index}.tgz`,
    integrity: index === 1 ? packageInfo.integrity : `sha512-${index}`,
  }));
  let publishCount = 0;
  await assert.rejects(
    publishVerifiedArtifacts(directory, {
      environment,
      readManifest: async () => ({ source, packages }),
      readNpmVersion: () => '11.15.0',
      fetchImpl: async () => new Response(published),
      lookup: async (info) =>
        info.name === PUBLISH_ORDER[1]
          ? { dist: { tarball: TARBALL_URL, integrity: integrityOf(published) } }
          : null,
      log: () => {},
      publish: () => {
        publishCount += 1;
      },
    }),
    /registry integrity does not match/,
  );
  assert.equal(publishCount, 0);
});

test('continues to publish after a devDependencies-only existing version', async (t) => {
  const { directory, published, packageInfo } = await tarballFixture(t, {
    published: { 'package.json': withDev({ vite: '^5.0.0' }) },
    retained: { 'package.json': withDev({ vite: '^6.0.0' }) },
  });
  const packages = PUBLISH_ORDER.map((name, index) => ({
    ...packageInfo,
    name,
    filename: index === 1 ? 'retained.tgz' : `package-${index}.tgz`,
    integrity: index === 1 ? packageInfo.integrity : `sha512-${index}`,
  }));
  const done = [];
  await publishVerifiedArtifacts(directory, {
    environment,
    readManifest: async () => ({ source, packages }),
    readNpmVersion: () => '11.15.0',
    fetchImpl: async () => new Response(published),
    lookup: async (info) =>
      info.name === PUBLISH_ORDER[1]
        ? { dist: { tarball: TARBALL_URL, integrity: integrityOf(published) } }
        : null,
    waitForPublished: async (info) => ({ dist: { integrity: info.integrity } }),
    log: () => {},
    publish: (tarball) => done.push(tarball.split('/').at(-1)),
  });
  assert.equal(done.length, 5);
  assert.ok(!done.includes('retained.tgz'));
});
