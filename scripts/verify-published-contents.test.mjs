import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  decideCheck,
  describeError,
  diffFileHashes,
  formatDriftError,
  predictVersioning,
  verifyPublishedContents,
} from './verify-published-contents.mjs';

const { Response } = globalThis;

const example = { name: '@partrunner-ai/example', version: '1.0.0' };

const workspace = (name, fields = {}) => ({
  packageJson: { name, version: '1.0.0', ...fields },
});

test('versions only real bumps and flags dependents whose pins change', () => {
  const { versioned, rewritten } = predictVersioning(
    [
      { name: '@partrunner-ai/tokens', type: 'patch' },
      { name: '@partrunner-ai/ui', type: 'patch' },
      { name: '@partrunner-ai/shell', type: 'none' },
    ],
    [
      workspace('@partrunner-ai/tokens'),
      workspace('@partrunner-ai/ui', {
        dependencies: { '@partrunner-ai/tokens': 'workspace:*' },
      }),
      workspace('@partrunner-ai/shell', {
        devDependencies: { '@partrunner-ai/tokens': 'workspace:*' },
      }),
      workspace('@partrunner-ai/seamless', {
        dependencies: { '@partrunner-ai/tokens': '^2.0.0' },
      }),
    ],
  );
  assert.deepEqual([...versioned], ['@partrunner-ai/tokens', '@partrunner-ai/ui']);
  assert.deepEqual([...rewritten], [
    ['@partrunner-ai/shell', ['@partrunner-ai/tokens']],
  ]);
});

test('compares only published versions that keep their version', () => {
  const versioned = new Set(['@partrunner-ai/other']);
  assert.equal(decideCheck(example, { published: false, versioned }), 'unpublished');
  assert.equal(
    decideCheck(example, { published: true, versioned: new Set([example.name]) }),
    'versioned',
  );
  assert.equal(decideCheck(example, { published: true, versioned }), 'compare');
});

test('reports added, removed, and modified files in path order', () => {
  const published = new Map([
    ['package.json', 'a'],
    ['dist/index.js', 'b'],
    ['dist/old.js', 'c'],
  ]);
  const local = new Map([
    ['package.json', 'changed'],
    ['dist/index.js', 'b'],
    ['dist/new.js', 'd'],
  ]);
  assert.deepEqual(diffFileHashes(published, local), [
    { path: 'dist/new.js', change: 'added' },
    { path: 'dist/old.js', change: 'removed' },
    { path: 'package.json', change: 'modified' },
  ]);
  assert.deepEqual(diffFileHashes(published, new Map(published)), []);
});

test('names every drifted package and the fix', () => {
  const message = formatDriftError([
    { ...example, files: [{ path: 'package.json', change: 'modified' }] },
    { ...example, name: '@partrunner-ai/shell', rewrittenBy: ['@partrunner-ai/tokens'] },
  ]);
  assert.match(message, /@partrunner-ai\/example@1\.0\.0 is already published, but its packed contents changed/);
  assert.match(message, /modified: package\.json/);
  assert.match(message, /shell@1\.0\.0 is already published, but its packed contents will change/);
  assert.match(message, /package\.json will pin new versions of @partrunner-ai\/tokens/);
  assert.match(message, /Add a Changeset for '@partrunner-ai\/example', '@partrunner-ai\/shell'/);
});

test('includes the cause of a failed request', () => {
  const error = new Error('npm registry request failed', {
    cause: new Error('getaddrinfo ENOTFOUND registry.npmjs.org'),
  });
  assert.match(describeError(error), /caused by: getaddrinfo ENOTFOUND/);
});

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'published-contents-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const tarball = async (name, files) => {
    const source = join(directory, name);
    await mkdir(join(source, 'package'), { recursive: true });
    for (const [path, contents] of Object.entries(files)) {
      await writeFile(join(source, 'package', path), contents);
    }
    const file = join(directory, `${name}.tgz`);
    execFileSync('tar', ['-czf', file, '-C', source, 'package']);
    return file;
  };
  return { directory, tarball };
}

function registry(published) {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    const entry = published.find(({ metadataUrl }) => metadataUrl === url);
    if (entry) return Response.json(entry.metadata);
    const download = published.find(({ metadata }) => metadata.dist.tarball === url);
    if (download) return new Response(download.bytes);
    return new Response('not found', { status: 404 });
  };
  return { fetchImpl, requests };
}

async function publishedEntry(file) {
  const bytes = await readFile(file);
  return {
    metadataUrl: `https://registry.npmjs.org/@partrunner-ai%2fexample/1.0.0`,
    bytes,
    metadata: {
      ...example,
      dist: {
        tarball: 'https://registry.example/example-1.0.0.tgz',
        integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
      },
    },
  };
}

const quiet = () => {};
const inputs = (versioning = {}) => ({
  readPackages: async () => [{ ...example, directory: 'packages/example' }],
  readPlan: async () => ({
    versioned: new Set(),
    rewritten: new Map(),
    ...versioning,
  }),
  log: quiet,
  retryDelay: 0,
});

test('passes when the packed files match npm', async (t) => {
  const { tarball } = await fixture(t);
  const file = await tarball('published', { 'package.json': '{}', 'index.js': 'a' });
  const { fetchImpl } = registry([await publishedEntry(file)]);
  await verifyPublishedContents({ ...inputs(), fetchImpl, pack: () => file });
});

test('fails with the changed files when a published version drifts', async (t) => {
  const { tarball } = await fixture(t);
  const published = await tarball('published', { 'package.json': '{}', 'index.js': 'a' });
  const local = await tarball('local', { 'package.json': '{"x":1}', 'index.js': 'a' });
  const { fetchImpl } = registry([await publishedEntry(published)]);
  await assert.rejects(
    verifyPublishedContents({ ...inputs(), fetchImpl, pack: () => local }),
    /modified: package\.json/,
  );
});

test('fails when a dependency pin will change on version', async (t) => {
  const { tarball } = await fixture(t);
  const file = await tarball('published', { 'package.json': '{}' });
  const { fetchImpl } = registry([await publishedEntry(file)]);
  await assert.rejects(
    verifyPublishedContents({
      ...inputs({ rewritten: new Map([[example.name, ['@partrunner-ai/tokens']]]) }),
      fetchImpl,
      pack: () => file,
    }),
    /will pin new versions of @partrunner-ai\/tokens/,
  );
});

test('skips unpublished and versioned packages without packing', async () => {
  const pack = () => assert.fail('must not pack');
  await verifyPublishedContents({
    ...inputs(),
    fetchImpl: async () => new Response('not found', { status: 404 }),
    pack,
  });
  const { fetchImpl } = registry([
    { metadataUrl: 'https://registry.npmjs.org/@partrunner-ai%2fexample/1.0.0', metadata: { dist: {} } },
  ]);
  await verifyPublishedContents({
    ...inputs({ versioned: new Set([example.name]) }),
    fetchImpl,
    pack,
  });
});

test('fails closed on registry errors after retrying', async () => {
  let calls = 0;
  await assert.rejects(
    verifyPublishedContents({
      ...inputs(),
      fetchImpl: async () => {
        calls += 1;
        return new Response('unavailable', { status: 503 });
      },
    }),
    /npm registry returned 503/,
  );
  assert.equal(calls, 3);
  await assert.rejects(
    verifyPublishedContents({
      ...inputs(),
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    }),
    (error) => /request failed/.test(error.message) && /fetch failed/.test(describeError(error)),
  );
});

test('rejects a download that does not match its registry integrity', async (t) => {
  const { tarball } = await fixture(t);
  const file = await tarball('published', { 'package.json': '{}' });
  const entry = await publishedEntry(file);
  entry.metadata.dist.integrity = 'sha512-wrong';
  const { fetchImpl } = registry([entry]);
  await assert.rejects(
    verifyPublishedContents({ ...inputs(), fetchImpl, pack: () => file }),
    /does not match its registry integrity/,
  );
});
