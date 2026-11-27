import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { compareTarballs, unpackTarball } from './packed-contents.mjs';
import { buildTarball } from './test-tarballs.mjs';

const pkg = (fields) =>
  JSON.stringify({ name: 'x', version: '1.0.0', ...fields }, null, 2);

async function workspace(t) {
  const directory = await mkdtemp(join(tmpdir(), 'packed-contents-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const compare = async (published, local) =>
    compareTarballs({
      publishedBytes: await readFile(published),
      localTarball: local,
      directory: await mkdtemp(join(directory, 'work-')),
    });
  return { directory, compare };
}

test('accepts a change in the root devDependencies alone', async (t) => {
  const { directory, compare } = await workspace(t);
  const published = await buildTarball(directory, 'a', {
    files: { 'package.json': pkg({ devDependencies: { vite: '5' } }), 'index.js': 'a' },
  });
  const local = await buildTarball(directory, 'b', {
    files: { 'package.json': pkg({ devDependencies: { vite: '6' } }), 'index.js': 'a' },
  });
  assert.deepEqual(await compare(published, local), {
    status: 'devDependencies',
    files: [],
    tarOnly: false,
  });
});

test('accepts devDependencies added or removed', async (t) => {
  const { directory, compare } = await workspace(t);
  const without = await buildTarball(directory, 'a', {
    files: { 'package.json': pkg({}) },
  });
  const withDev = await buildTarball(directory, 'b', {
    files: { 'package.json': pkg({ devDependencies: { vite: '6' } }) },
  });
  assert.equal((await compare(without, withDev)).status, 'devDependencies');
  assert.equal((await compare(withDev, without)).status, 'devDependencies');
});

test('does not accept devDependencies next to an execute bit change', async (t) => {
  const { directory, compare } = await workspace(t);
  const published = await buildTarball(directory, 'a', {
    files: { 'package.json': pkg({ devDependencies: { v: '1' } }), 'bin.js': 'a' },
  });
  const local = await buildTarball(directory, 'b', {
    files: {
      'package.json': pkg({ devDependencies: { v: '2' } }),
      'bin.js': { content: 'a', mode: 0o755 },
    },
  });
  assert.deepEqual(await compare(published, local), {
    status: 'drift',
    files: [{ path: 'bin.js', change: 'modified' }],
    tarOnly: false,
  });
});

test('does not accept devDependencies next to an added empty directory', async (t) => {
  const { directory, compare } = await workspace(t);
  const published = await buildTarball(directory, 'a', {
    files: { 'package.json': pkg({ devDependencies: { v: '1' } }) },
  });
  const local = await buildTarball(directory, 'b', {
    files: { 'package.json': pkg({ devDependencies: { v: '2' } }) },
    dirs: ['empty'],
  });
  assert.deepEqual(await compare(published, local), {
    status: 'drift',
    files: [{ path: 'empty/', change: 'added' }],
    tarOnly: false,
  });
});

test('reports a formatting difference alone as drift', async (t) => {
  const { directory, compare } = await workspace(t);
  const fields = { dependencies: { a: '1' }, devDependencies: { v: '1' } };
  const published = await buildTarball(directory, 'a', {
    files: { 'package.json': JSON.stringify({ name: 'x', ...fields }, null, 2) },
  });
  const local = await buildTarball(directory, 'b', {
    files: { 'package.json': JSON.stringify({ name: 'x', ...fields }) },
  });
  assert.deepEqual(await compare(published, local), {
    status: 'drift',
    files: [{ path: 'package.json', change: 'modified' }],
    tarOnly: false,
  });
});

test('reports devDependencies that are not objects as drift', async (t) => {
  const { directory, compare } = await workspace(t);
  const published = await buildTarball(directory, 'a', {
    files: { 'package.json': '[1]' },
  });
  const local = await buildTarball(directory, 'b', {
    files: { 'package.json': '[2]' },
  });
  assert.equal((await compare(published, local)).status, 'drift');
});

test('gives a nested package.json no devDependencies rule', async (t) => {
  const { directory, compare } = await workspace(t);
  const published = await buildTarball(directory, 'a', {
    files: {
      'package.json': pkg({}),
      'dist/package.json': pkg({ devDependencies: { v: '1' } }),
    },
  });
  const local = await buildTarball(directory, 'b', {
    files: {
      'package.json': pkg({}),
      'dist/package.json': pkg({ devDependencies: { v: '2' } }),
    },
  });
  assert.deepEqual(await compare(published, local), {
    status: 'drift',
    files: [{ path: 'dist/package.json', change: 'modified' }],
    tarOnly: false,
  });
});

test('reports a tar-only difference when no file differs', async (t) => {
  const { directory, compare } = await workspace(t);
  const published = await buildTarball(directory, 'a', {
    files: { 'index.js': 'a' },
  });
  const local = await buildTarball(directory, 'b', {
    files: { 'index.js': 'a' },
    time: new Date('2026-02-02T00:00:00Z'),
  });
  assert.deepEqual(await compare(published, local), {
    status: 'drift',
    files: [],
    tarOnly: true,
  });
});

test('rejects a top-level entry beside package/', async (t) => {
  const { directory } = await workspace(t);
  for (const outside of [{ 'extra/file.txt': 'x' }, { 'extra.txt': 'x' }]) {
    const file = await buildTarball(directory, 'a', {
      files: { 'index.js': 'a' },
      outside,
    });
    await assert.rejects(
      unpackTarball(file, join(directory, 'out')),
      /only the directory package\/, found: extra/,
    );
    await rm(join(directory, 'out'), { recursive: true, force: true });
  }
});

test('rejects a tarball without package/', async (t) => {
  const { directory } = await workspace(t);
  await mkdir(join(directory, 'src/other'), { recursive: true });
  await writeFile(join(directory, 'src/other/file.txt'), 'x');
  const file = join(directory, 'no-package.tgz');
  execFileSync('tar', ['-czf', file, '-C', join(directory, 'src'), 'other']);
  await assert.rejects(
    unpackTarball(file, join(directory, 'out')),
    /only the directory package\/, found: other/,
  );
});

test('rejects a symbolic link by name and never reads its target', async (t) => {
  const { directory } = await workspace(t);
  const file = await buildTarball(directory, 'a', {
    files: { 'index.js': 'a' },
    links: { 'dangling-link': '/nonexistent/target-that-must-not-be-read' },
  });
  await assert.rejects(
    unpackTarball(file, join(directory, 'out')),
    (error) =>
      /not a regular file or a directory: dangling-link/.test(error.message) &&
      !/ENOENT/.test(error.message),
  );
});
