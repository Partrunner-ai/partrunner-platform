import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';

import {
  assertSafeTarEntries,
  compareTarballs,
  hashTree,
  removeTree,
  unpackTarball,
} from './packed-contents.mjs';
import { buildRawTarball, buildTarball, packDirectory } from './test-tarballs.mjs';

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
      /unsafe path: extra/,
    );
    await rm(join(directory, 'out'), { recursive: true, force: true });
  }
});

test('rejects a tarball without package/', async (t) => {
  const { directory } = await workspace(t);
  await mkdir(join(directory, 'src/other'), { recursive: true });
  await writeFile(join(directory, 'src/other/file.txt'), 'x');
  const file = join(directory, 'no-package.tgz');
  packDirectory(file, join(directory, 'src'), ['other']);
  await assert.rejects(
    unpackTarball(file, join(directory, 'out')),
    /unsafe path: other/,
  );
});

test('names the top-level entries in sorted order after the unpack', async (t) => {
  const { directory } = await workspace(t);
  await mkdir(join(directory, 'out/zeta'), { recursive: true });
  await mkdir(join(directory, 'out/alpha'), { recursive: true });
  // A tarball cannot reach this barrier, so unpack an empty one into a
  // destination that already holds two directories.
  const empty = await buildRawTarball(directory, 'empty', []);
  await assert.rejects(
    unpackTarball(empty, join(directory, 'out')),
    /found: alpha, zeta/,
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
      /symbolic link.*: package\/dangling-link/.test(error.message) &&
      !/ENOENT/.test(error.message),
  );
});

test('hashTree still rejects a link in an unpacked tree', async (t) => {
  const { directory } = await workspace(t);
  await mkdir(join(directory, 'tree'));
  await symlink('/nonexistent', join(directory, 'tree/link'));
  await assert.rejects(
    hashTree(join(directory, 'tree')),
    /not a regular file or a directory: link/,
  );
});

const rawFile = (path, content, extra = {}) => ({ path, content, ...extra });
const rawPackage = [
  { path: 'package/', type: '5', mode: 0o755 },
  rawFile('package/package.json', '{"name":"x"}'),
];

test('rejects a hard link, names it, and unpacks nothing', async (t) => {
  const { directory } = await workspace(t);
  const file = await buildRawTarball(directory, 'a', [
    ...rawPackage,
    { path: 'package/dist/', type: '5', mode: 0o755 },
    rawFile('package/dist/a.js', 'a'),
    rawFile('package/dist/b.js', 'other'),
    { path: 'package/dist/b.js', type: '1', linkname: 'package/dist/a.js' },
  ]);
  const out = join(directory, 'out');
  await assert.rejects(
    unpackTarball(file, out),
    /hard link.*: package\/dist\/b\.js/,
  );
  await assert.rejects(readFile(join(out, 'package/package.json')), /ENOENT/);
});

test('rejects each kind of bad entry and names it', async (t) => {
  const { directory } = await workspace(t);
  const cases = [
    [{ path: 'package/s', type: '2', linkname: 'x' }, /symbolic link.*package\/s/],
    [{ path: 'package/f', type: '6' }, /FIFO.*package\/f/],
    [{ path: 'package/c', type: '3' }, /character device.*package\/c/],
    [{ path: 'package/d', type: '4' }, /block device.*package\/d/],
    [rawFile('/etc/passwd', 'x'), /unsafe path: \/etc\/passwd/],
    [rawFile('package/../evil.js', 'x'), /unsafe path: package\/\.\.\/evil\.js/],
    [rawFile('package/a/../b.js', 'x'), /unsafe path: package\/a\/\.\.\/b\.js/],
    [rawFile('other/file.js', 'x'), /unsafe path: other\/file\.js/],
    [rawFile('packages/file.js', 'x'), /unsafe path: packages\/file\.js/],
  ];
  for (const [entry, pattern] of cases) {
    const file = await buildRawTarball(directory, 'bad', [...rawPackage, entry]);
    await assert.rejects(unpackTarball(file, join(directory, 'out')), pattern);
    await assert.rejects(readFile(join(directory, 'out/package/package.json')));
  }
});

test('rejects two entries with the same path', async (t) => {
  const { directory } = await workspace(t);
  const file = await buildRawTarball(directory, 'dup', [
    ...rawPackage,
    rawFile('package/a.js', '1'),
    rawFile('./package/a.js', '2'),
  ]);
  await assert.rejects(
    unpackTarball(file, join(directory, 'out')),
    /same path: \.\/package\/a\.js/,
  );
  const dir = await buildRawTarball(directory, 'dupdir', [
    ...rawPackage,
    { path: 'package/', type: '5' },
  ]);
  await assert.rejects(unpackTarball(dir, join(directory, 'out')), /same path/);
});

test('accepts a valid tarball with a space and a long path', async (t) => {
  const { directory } = await workspace(t);
  const file = await buildTarball(directory, 'ok', {
    files: { 'my file.js': 'a', 'package.json': '{}', [`${'d'.repeat(60)}/${'e'.repeat(60)}.js`]: 'b' },
    dirs: ['empty dir'],
  });
  const tar = gunzipSync(await readFile(file));
  assert.doesNotThrow(() => assertSafeTarEntries(tar));
});

test('rejects a tarball cut short', () => {
  assert.throws(() => assertSafeTarEntries(Buffer.alloc(100, 1)), /truncated|malformed/);
});

test('rejects a root package.json that is a symbolic link and never reads it', async (t) => {
  const { directory } = await workspace(t);
  const secret = join(directory, 'secret.json');
  await writeFile(secret, '{"devDependencies":{"leak":"1"}}');
  const file = await buildTarball(directory, 'link', {
    links: { 'package.json': secret },
  });
  await assert.rejects(
    unpackTarball(file, join(directory, 'out')),
    (error) =>
      /symbolic link.*package\/package\.json/.test(error.message) &&
      !error.message.includes('leak'),
  );
});

test('a hard link next to a devDependencies change is not accepted', async (t) => {
  const { directory, compare } = await workspace(t);
  const local = await buildRawTarball(directory, 'local', [
    ...rawPackage.slice(0, 1),
    rawFile('package/package.json', pkg({ devDependencies: { v: '2' } })),
    rawFile('package/a.js', 'a'),
    rawFile('package/b.js', 'a'),
  ]);
  const published = await buildRawTarball(directory, 'published', [
    ...rawPackage.slice(0, 1),
    rawFile('package/package.json', pkg({ devDependencies: { v: '1' } })),
    rawFile('package/a.js', 'a'),
    rawFile('package/b.js', 'other'),
    { path: 'package/b.js', type: '1', linkname: 'package/a.js' },
  ]);
  await assert.rejects(compare(published, local), /hard link.*package\/b\.js/);
});

test('cleans up a tree with a read-only directory, and never throws', async (t) => {
  const { directory } = await workspace(t);
  const file = await buildTarball(directory, 'ro', {
    files: { 'sub/file.js': 'a', 'package.json': '{}' },
  });
  const out = join(directory, 'out');
  await unpackTarball(file, out);
  await chmod(join(out, 'package/sub'), 0o555);
  await removeTree(out);
  await assert.rejects(readFile(join(out, 'package/package.json')), /ENOENT/);
  await assert.doesNotReject(removeTree(join(directory, 'never-existed')));
});

const pax = (key, value) => {
  let length = key.length + value.length + 3;
  while (`${length} ${key}=${value}\n`.length !== length) length += 1;
  return `${length} ${key}=${value}\n`;
};

async function rejectsRaw(t, entries, pattern, options) {
  const { directory } = await workspace(t);
  const file = await buildRawTarball(directory, 'strict', entries, options);
  await assert.rejects(unpackTarball(file, join(directory, 'out')), pattern);
  await assert.rejects(readFile(join(directory, 'out/package/package.json')));
}

test('rejects a header with a bad checksum', async (t) => {
  await rejectsRaw(
    t,
    [...rawPackage, rawFile('package/a.js', 'a', { checksum: '0000001' })],
    /bad checksum/,
  );
});

test('rejects a size field that is not plain octal', async (t) => {
  for (const sizeField of ['18', '1x', '-1', '']) {
    await rejectsRaw(
      t,
      [...rawPackage, rawFile('package/a.js', 'a', { sizeField })],
      /malformed tar header/,
    );
  }
});

test('rejects data after the end of the archive', async (t) => {
  await rejectsRaw(t, rawPackage, /data after the end of the archive/, {
    trailer: 'x',
  });
});

test('rejects two sources for one path, repeated name headers, and a lone one', async (t) => {
  const long = (path) => ({ path: 'long', type: 'L', content: `${path}\0` });
  const px = (path) => ({ path: 'pax', type: 'x', content: pax('path', path) });
  const file = rawFile('package/a.js', 'a');
  await rejectsRaw(t, [...rawPackage, long('package/b.js'), px('package/c.js'), file], /both a GNU long name and a PAX path|two name headers/);
  await rejectsRaw(t, [...rawPackage, long('package/b.js'), long('package/c.js'), file], /two name headers/);
  await rejectsRaw(t, [...rawPackage, px('package/b.js'), px('package/c.js'), file], /two name headers/);
  await rejectsRaw(t, [...rawPackage, long('package/b.js')], /no entry after it/);
  await rejectsRaw(t, [...rawPackage, px('package/b.js')], /no entry after it/);
});

test('rejects a PAX record without an equals sign', async (t) => {
  await rejectsRaw(
    t,
    [
      ...rawPackage,
      { path: 'pax', type: 'x', content: '9 nokeyv\n' },
      rawFile('package/a.js', 'a'),
    ],
    /malformed PAX header/,
  );
});

test('accepts a PAX path and a GNU long name over 100 characters', async (t) => {
  const { directory } = await workspace(t);
  const longPath = `package/${'d'.repeat(60)}/${'e'.repeat(60)}.js`;
  const withPax = await buildRawTarball(directory, 'pax', [
    ...rawPackage,
    { path: 'pax', type: 'x', content: pax('path', longPath) },
    rawFile('package/short.js', 'a'),
  ]);
  const withLong = await buildRawTarball(directory, 'gnu', [
    ...rawPackage,
    { path: 'long', type: 'L', content: `${longPath}\0` },
    rawFile('package/short.js', 'a'),
  ]);
  for (const file of [withPax, withLong]) {
    assert.doesNotThrow(() => assertSafeTarEntries(gunzipSync(readFileSync(file))));
  }
});
