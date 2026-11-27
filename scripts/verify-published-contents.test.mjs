import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  decideCheck,
  describeError,
  diffFileHashes,
  formatDriftError,
  hashTree,
  predictVersioning,
  readVersioning,
  removeTree,
  verifyPublishedContents,
} from './verify-published-contents.mjs';
import { buildRawTarball, buildTarball } from './test-tarballs.mjs';

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
      workspace('@partrunner-ai/api-core', {
        peerDependencies: { '@partrunner-ai/tokens': 'workspace:*' },
      }),
    ],
  );
  assert.deepEqual([...versioned], ['@partrunner-ai/tokens', '@partrunner-ai/ui']);
  // The shell devDependency does not count; the api-core peer dependency does.
  assert.deepEqual([...rewritten], [
    ['@partrunner-ai/api-core', ['@partrunner-ai/tokens']],
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
  const tarball = (name, files, modes = {}) =>
    buildTarball(directory, name, {
      files: Object.fromEntries(
        Object.entries(files).map(([path, content]) => [
          path,
          { content, mode: modes[path] ?? 0o644 },
        ]),
      ),
    });
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

test('reports a change in tar entry metadata alone', async (t) => {
  // A different mtime changes the tar stream, but no file and no mode.
  const { directory } = await fixture(t);
  const published = await buildTarball(directory, 'published', { files: { 'bin.js': 'a' } });
  const local = await buildTarball(directory, 'local', {
    files: { 'bin.js': 'a' },
    mtime: Date.parse('2026-02-02T00:00:00Z') / 1000,
  });
  const { fetchImpl } = registry([await publishedEntry(published)]);
  await assert.rejects(
    verifyPublishedContents({ ...inputs(), fetchImpl, pack: () => local }),
    /modified: tar entry metadata/,
  );
});

test('reports an execute bit change as a modified file', async (t) => {
  const { tarball } = await fixture(t);
  const published = await tarball('published', { 'bin.js': 'a' });
  const local = await tarball('local', { 'bin.js': 'a' }, { 'bin.js': 0o755 });
  const { fetchImpl } = registry([await publishedEntry(published)]);
  await assert.rejects(
    verifyPublishedContents({ ...inputs(), fetchImpl, pack: () => local }),
    /modified: bin\.js/,
  );
});

const pkg = (fields) => JSON.stringify({ name: 'x', version: '1.0.0', ...fields }, null, 2);

test('reports drift when the published stream is far longer than the local one', async (t) => {
  const { tarball } = await fixture(t);
  const local = await tarball('local', { 'package.json': pkg({}) });
  // The published tarball has one more large file: over the gunzip limit.
  const published = await tarball('published', {
    'package.json': pkg({}),
    'big.bin': 'a'.repeat(3 * 1024 * 1024),
  });
  const { fetchImpl } = registry([await publishedEntry(published)]);
  const lines = [];
  await assert.rejects(
    verifyPublishedContents({
      ...inputs(),
      log: (line) => lines.push(line),
      fetchImpl,
      pack: () => local,
    }),
    (error) =>
      /removed: big\.bin/.test(error.message) &&
      /Add a Changeset for '@partrunner-ai\/example'/.test(error.message) &&
      !/could not be compared/.test(error.message),
  );
  assert.deepEqual(lines, []);
});

test('hashTree rejects a link in an unpacked tree and never reads it', async (t) => {
  const { directory } = await fixture(t);
  await mkdir(join(directory, 'tree'));
  await symlink('/nonexistent', join(directory, 'tree/link'));
  await assert.rejects(
    hashTree(join(directory, 'tree')),
    /not a regular file or a directory: link/,
  );
});

test('removeTree cleans a tree with a read-only directory and never throws', async (t) => {
  const { directory } = await fixture(t);
  await mkdir(join(directory, 'out/sub'), { recursive: true });
  await writeFile(join(directory, 'out/sub/file.js'), 'a');
  await chmod(join(directory, 'out/sub'), 0o555);
  await removeTree(join(directory, 'out'));
  await assert.rejects(readFile(join(directory, 'out/sub/file.js')), /ENOENT/);
  await assert.doesNotReject(removeTree(join(directory, 'never-existed')));
});

test('passes and says so when only devDependencies differ', async (t) => {
  const { tarball } = await fixture(t);
  const published = await tarball('published', {
    'package.json': pkg({ dependencies: { a: '^1.0.0' }, devDependencies: { vite: '^5.0.0' } }),
    'index.js': 'a',
  });
  const local = await tarball('local', {
    'package.json': pkg({ dependencies: { a: '^1.0.0' }, devDependencies: { vite: '^6.0.0', vitest: '^2.0.0' } }),
    'index.js': 'a',
  });
  const { fetchImpl } = registry([await publishedEntry(published)]);
  const lines = [];
  await verifyPublishedContents({
    ...inputs(),
    log: (line) => lines.push(line),
    fetchImpl,
    pack: () => local,
  });
  assert.deepEqual(lines, [
    '@partrunner-ai/example@1.0.0: matches the published tarball apart from devDependencies',
  ]);
});

test('fails when dependencies differ, even next to a devDependencies change', async (t) => {
  const { tarball } = await fixture(t);
  const published = await tarball('published', {
    'package.json': pkg({ dependencies: { a: '^1.0.0' }, devDependencies: { vite: '^5.0.0' } }),
  });
  const local = await tarball('local', {
    'package.json': pkg({ dependencies: { a: '^2.0.0' }, devDependencies: { vite: '^6.0.0' } }),
  });
  const { fetchImpl } = registry([await publishedEntry(published)]);
  await assert.rejects(
    verifyPublishedContents({ ...inputs(), fetchImpl, pack: () => local }),
    /modified: package\.json/,
  );
});

test('fails when another file differs next to a devDependencies change', async (t) => {
  const { tarball } = await fixture(t);
  const published = await tarball('published', {
    'package.json': pkg({ devDependencies: { vite: '^5.0.0' } }),
    'index.js': 'a',
  });
  const local = await tarball('local', {
    'package.json': pkg({ devDependencies: { vite: '^6.0.0' } }),
    'index.js': 'b',
  });
  const { fetchImpl } = registry([await publishedEntry(published)]);
  await assert.rejects(
    verifyPublishedContents({ ...inputs(), fetchImpl, pack: () => local }),
    (error) => {
      const changed = error.message
        .split('\n')
        .filter((line) => /^ {2}(added|removed|modified): /.test(line));
      // The report lists exact file differences.
      assert.deepEqual(changed, ['  modified: index.js', '  modified: package.json']);
      return true;
    },
  );
});

async function rejectsWith(t, { published, local, pattern, notPattern }) {
  const { directory } = await fixture(t);
  const publishedFile = await buildTarball(directory, 'published', published);
  const localFile = await buildTarball(directory, 'local', local);
  const { fetchImpl } = registry([await publishedEntry(publishedFile)]);
  const lines = [];
  await assert.rejects(
    verifyPublishedContents({
      ...inputs(),
      log: (line) => lines.push(line),
      fetchImpl,
      pack: () => localFile,
    }),
    (error) => {
      assert.match(describeError(error), pattern);
      if (notPattern) assert.doesNotMatch(describeError(error), notPattern);
      return true;
    },
  );
  assert.deepEqual(lines, []);
}

test('fails when devDependencies differ next to an execute bit change', async (t) => {
  await rejectsWith(t, {
    published: {
      files: { 'package.json': pkg({ devDependencies: { v: '1' } }), 'bin.js': 'a' },
    },
    local: {
      files: {
        'package.json': pkg({ devDependencies: { v: '2' } }),
        'bin.js': { content: 'a', mode: 0o755 },
      },
    },
    pattern: /modified: bin\.js/,
  });
});

test('fails when devDependencies differ next to an added empty directory', async (t) => {
  await rejectsWith(t, {
    published: { files: { 'package.json': pkg({ devDependencies: { v: '1' } }) } },
    local: {
      files: { 'package.json': pkg({ devDependencies: { v: '2' } }) },
      dirs: ['empty'],
    },
    pattern: /added: empty\//,
  });
});

test('fails on a top-level entry beside package/', async (t) => {
  await rejectsWith(t, {
    published: { files: { 'package.json': pkg({}) } },
    local: { files: { 'package.json': pkg({}) }, outside: { 'extra/file.txt': 'x' } },
    pattern: /modified: tar entry metadata/,
  });
});

test('fails on a symbolic link and names it', async (t) => {
  await rejectsWith(t, {
    published: { files: { 'package.json': pkg({}) } },
    local: {
      files: { 'package.json': pkg({}) },
      links: { 'dangling-link': '/nonexistent/target' },
    },
    pattern: /could not be compared[\s\S]*not a regular file or a directory: dangling-link/,
    notPattern: /ENOENT/,
  });
});

test('fails on a hard link entry next to a real devDependencies difference', async (t) => {
  const { directory } = await fixture(t);
  const published = await buildRawTarball(directory, 'published', [
    { path: 'package/', type: '5', mode: 0o755 },
    { path: 'package/package.json', content: pkg({ devDependencies: { v: '1' } }) },
    { path: 'package/a.js', content: 'a' },
    { path: 'package/b.js', content: 'other' },
    { path: 'package/b.js', type: '1', linkname: 'package/a.js' },
  ]);
  const local = await buildRawTarball(directory, 'local', [
    { path: 'package/', type: '5', mode: 0o755 },
    { path: 'package/package.json', content: pkg({ devDependencies: { v: '2' } }) },
    { path: 'package/a.js', content: 'a' },
    { path: 'package/b.js', content: 'a' },
  ]);
  const { fetchImpl } = registry([await publishedEntry(published)]);
  await assert.rejects(
    verifyPublishedContents({ ...inputs(), fetchImpl, pack: () => local }),
    /modified: package\.json/,
  );
});

test('reports the drift of a tarball that holds a read-only directory', async (t) => {
  const { directory } = await fixture(t);
  const entries = (content) => [
    { path: 'package/', type: '5', mode: 0o755 },
    { path: 'package/package.json', content: pkg({}) },
    { path: 'package/ro/', type: '5', mode: 0o555 },
    { path: 'package/ro/file.js', content },
  ];
  const published = await buildRawTarball(directory, 'published', entries('a'));
  const local = await buildRawTarball(directory, 'local', entries('b'));
  const { fetchImpl } = registry([await publishedEntry(published)]);
  await assert.rejects(
    verifyPublishedContents({ ...inputs(), fetchImpl, pack: () => local }),
    /modified: ro\/file\.js/,
  );
});

test('fails on a formatting difference alone and does not say devDependencies', async (t) => {
  const fields = { dependencies: { a: '1' }, devDependencies: { v: '1' } };
  await rejectsWith(t, {
    published: { files: { 'package.json': JSON.stringify({ name: 'x', ...fields }, null, 2) } },
    local: { files: { 'package.json': JSON.stringify({ name: 'x', ...fields }) } },
    pattern: /modified: package\.json/,
    notPattern: /apart from devDependencies/,
  });
});

test('gives a nested package.json no devDependencies rule', async (t) => {
  await rejectsWith(t, {
    published: {
      files: {
        'package.json': pkg({}),
        'dist/package.json': pkg({ devDependencies: { v: '1' } }),
      },
    },
    local: {
      files: {
        'package.json': pkg({}),
        'dist/package.json': pkg({ devDependencies: { v: '2' } }),
      },
    },
    pattern: /modified: dist\/package\.json/,
  });
});

test('flags an unversioned package that names a versioned one in dependencies', () => {
  const { rewritten } = predictVersioning(
    [{ name: '@partrunner-ai/tokens', type: 'patch' }],
    [
      workspace('@partrunner-ai/tokens'),
      workspace('@partrunner-ai/shell', {
        dependencies: { '@partrunner-ai/tokens': 'workspace:*' },
      }),
    ],
  );
  assert.deepEqual([...rewritten], [
    ['@partrunner-ai/shell', ['@partrunner-ai/tokens']],
  ]);
});

test('compares a package.json that does not parse by its raw bytes', async (t) => {
  const { tarball } = await fixture(t);
  const published = await tarball('published', { 'package.json': '{"devDependencies": 1,' });
  const local = await tarball('local', { 'package.json': '{"devDependencies": 2,' });
  const { fetchImpl } = registry([await publishedEntry(published)]);
  await assert.rejects(
    verifyPublishedContents({ ...inputs(), fetchImpl, pack: () => local }),
    /modified: package\.json/,
  );
});

test('still fails when a devDependencies-only drift also has a pending pin rewrite', async (t) => {
  const { tarball } = await fixture(t);
  const published = await tarball('published', { 'package.json': pkg({ devDependencies: { v: '1' } }) });
  const local = await tarball('local', { 'package.json': pkg({ devDependencies: { v: '2' } }) });
  const { fetchImpl } = registry([await publishedEntry(published)]);
  await assert.rejects(
    verifyPublishedContents({
      ...inputs({ rewritten: new Map([[example.name, ['@partrunner-ai/tokens']]]) }),
      fetchImpl,
      pack: () => local,
    }),
    /will pin new versions of @partrunner-ai\/tokens/,
  );
});

test('retries a request that times out, then fails closed', async () => {
  let calls = 0;
  const hang = (_url, { signal }) => {
    calls += 1;
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    });
  };
  await assert.rejects(
    verifyPublishedContents({ ...inputs(), fetchImpl: hang, timeout: 5 }),
    (error) =>
      /request failed/.test(error.message) && error.cause?.name === 'TimeoutError',
  );
  assert.equal(calls, 3);
});

test('retries rate limits and bodies cut off part-way', async (t) => {
  const { tarball } = await fixture(t);
  const file = await tarball('published', { 'package.json': '{}' });
  const entry = await publishedEntry(file);
  const { fetchImpl: serve } = registry([entry]);
  const failures = [
    () => new Response('slow down', { status: 429 }),
    () => ({
      status: 200,
      body: null,
      json: async () => {
        throw new TypeError('terminated');
      },
    }),
  ];
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls += 1;
    return failures.shift()?.() ?? serve(url, options);
  };
  await verifyPublishedContents({ ...inputs(), fetchImpl, pack: () => file });
  assert.equal(calls, 4);
});

test('does not retry a registry answer that will not change', async () => {
  let calls = 0;
  await assert.rejects(
    verifyPublishedContents({
      ...inputs(),
      fetchImpl: async () => {
        calls += 1;
        return new Response('forbidden', { status: 403 });
      },
    }),
    /npm registry returned 403/,
  );
  assert.equal(calls, 1);
});

test('predicts versioning from a real Changesets workspace', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'published-contents-workspace-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const writeJson = async (path, value) => {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), JSON.stringify(value));
  };
  await writeJson('package.json', { name: 'root', private: true });
  await writeFile(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n");
  await writeJson('packages/tokens/package.json', { name: 'tokens', version: '1.0.0' });
  await writeJson('packages/ui/package.json', {
    name: 'ui',
    version: '1.0.0',
    dependencies: { tokens: 'workspace:*' },
  });
  await writeJson('packages/shell/package.json', {
    name: 'shell',
    version: '1.0.0',
    devDependencies: { tokens: 'workspace:*' },
  });
  await writeJson('packages/other/package.json', { name: 'other', version: '1.0.0' });
  await writeJson('.changeset/config.json', {
    changelog: false,
    commit: false,
    access: 'public',
    baseBranch: 'main',
    updateInternalDependencies: 'patch',
  });
  await writeFile(
    join(root, '.changeset/tokens.md'),
    "---\n'tokens': patch\n'other': none\n---\n\nChange a token.\n",
  );

  const { versioned, rewritten } = await readVersioning(root);
  assert.deepEqual([...versioned].sort(), ['tokens', 'ui']);
  assert.deepEqual([...rewritten], []);
});

test('uses the same Changesets libraries as the Changesets CLI', () => {
  // The prediction is only exact while it runs the code `changeset version`
  // runs. Update these devDependencies together with @changesets/cli.
  const root = createRequire(import.meta.url);
  const cli = createRequire(root.resolve('@changesets/cli/package.json'));
  for (const name of [
    '@changesets/assemble-release-plan',
    '@changesets/config',
    '@changesets/pre',
    '@changesets/read',
    '@manypkg/get-packages',
  ]) {
    const rootCopy = root.resolve(`${name}/package.json`);
    const cliCopy = cli.resolve(`${name}/package.json`);
    assert.equal(
      rootCopy,
      cliCopy,
      `${name} differs from the copy @changesets/cli uses:\n  root: ${rootCopy}\n  cli:  ${cliCopy}`,
    );
  }
});
