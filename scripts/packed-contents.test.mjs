import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';

import { compareTarballBytes, compareTarStreams } from './packed-contents.mjs';
import { tarBlocks, tarStream } from './test-tarballs.mjs';

const pretty = (value) => `${JSON.stringify(value, null, 2)}\n`;
const manifest = (fields = {}) => ({
  name: 'x',
  version: '1.0.0',
  dependencies: { a: '^1.0.0' },
  ...fields,
});
const pkg = (fields, format = pretty) => format(manifest(fields));
const dev = (version) => ({ devDependencies: { vite: version } });

const ROOT = 'package/package.json';

/**
 * The entries of a small package tarball. The root `package.json` is entry
 * `1 + before.length`; `mid` goes between `index.js` and `README.md`.
 */
const layout = ({ root, before = [], mid = [], after = [], swap = false }) => {
  const files = [
    { path: 'package/index.js', content: 'a' },
    ...mid,
    { path: 'package/README.md', content: '# readme\n' },
  ];
  return [
    { path: 'package/', type: '5', mode: 0o755 },
    ...before,
    { path: ROOT, content: root },
    ...(swap ? files.reverse() : files),
    ...after,
  ];
};

const blocks = (length) => Math.ceil(length / 512) * 512;
const offsetOf = (entries, index) =>
  entries
    .slice(0, index)
    .reduce((total, { content = '' }) => total + 512 + blocks(Buffer.byteLength(content)), 0);

const restamp = (header) => {
  header.fill(0x20, 148, 156);
  const sum = header.reduce((total, byte) => total + byte, 0);
  header.write(`${sum.toString(8).padStart(6, '0')} \0`, 148);
};

/** A copy of `stream` with the header at `at` changed by `edit`. */
const tamper = (stream, at, edit, { stamp = true } = {}) => {
  const copy = Buffer.from(stream);
  const header = copy.subarray(at, at + 512);
  edit(header);
  if (stamp) restamp(header);
  return copy;
};

const local = layout({ root: pkg(dev('^5.0.0')) });
const localStream = tarStream(local);
const publishedRoot = (root) => tarStream(layout({ root }));
const published = publishedRoot(pkg(dev('^6.0.0')));
const verdict = (candidate, base = localStream) => compareTarStreams(candidate, base);
const ROOT_AT = offsetOf(local, 1);

test('accepts a change in devDependencies alone: changed, added, removed', () => {
  assert.equal(verdict(published), 'devDependencies');
  const without = tarStream(layout({ root: pkg({}) }));
  assert.equal(verdict(published, without), 'devDependencies');
  assert.equal(verdict(without, localStream), 'devDependencies');
});

test('accepts a root package.json without a final newline', () => {
  const plain = (value) => JSON.stringify(value, null, 2);
  const base = tarStream(layout({ root: pkg(dev('^5.0.0'), plain) }));
  assert.equal(
    compareTarStreams(publishedRoot(pkg(dev('^6.0.0'), plain)), base),
    'devDependencies',
  );
});

test('accepts devDependencies in another position inside package.json', () => {
  const moved = pretty({ devDependencies: { vite: '^6.0.0' }, ...manifest() });
  assert.equal(verdict(publishedRoot(moved)), 'devDependencies');
});

test('accepts a change that moves every later block', () => {
  const many = Object.fromEntries(
    Array.from({ length: 40 }, (_, index) => [`tool-${index}`, '^1.0.0']),
  );
  const big = publishedRoot(pkg({ devDependencies: many }));
  assert.ok(big.length > localStream.length);
  assert.equal(verdict(big), 'devDependencies');
  assert.equal(verdict(localStream, big), 'devDependencies');
});

test('reports equal streams as identical', () => {
  assert.equal(verdict(Buffer.from(localStream)), 'identical');
});

test('reports a different other field as drift, also next to devDependencies', () => {
  assert.equal(verdict(publishedRoot(pkg({ ...dev('^6.0.0'), version: '1.0.1' }))), 'drift');
  assert.equal(
    verdict(publishedRoot(pkg({ ...dev('^6.0.0'), dependencies: { a: '^2.0.0' } }))),
    'drift',
  );
});

test('reports other formatting as drift even when devDependencies are equal', () => {
  const compact = pkg(dev('^5.0.0'), JSON.stringify);
  assert.equal(verdict(publishedRoot(compact)), 'drift');
  assert.equal(verdict(publishedRoot(pkg(dev('^5.0.0')).trimEnd())), 'drift');
  assert.equal(verdict(publishedRoot(pkg(dev('^6.0.0'), (v) => JSON.stringify(v, null, 4)))), 'drift');
});

test('reports a duplicate key in the published package.json as drift', () => {
  const text = pkg(dev('^6.0.0')).replace('  "name": "x",\n', '  "name": "x",\n  "name": "x",\n');
  assert.notEqual(text, pkg(dev('^6.0.0')));
  assert.equal(verdict(publishedRoot(text)), 'drift');
});

test('reports a byte order mark as drift', () => {
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const text = Buffer.concat([bom, Buffer.from(pkg(dev('^6.0.0')))]);
  assert.equal(verdict(publishedRoot(text)), 'drift');
});

test('reports invalid UTF-8 as drift', () => {
  const bytes = Buffer.from(pkg(dev('^6.0.0')));
  bytes[bytes.indexOf('"x"') + 1] = 0xff;
  assert.equal(verdict(publishedRoot(bytes)), 'drift');
});

test('reports a different other file as drift', () => {
  const entries = layout({ root: pkg(dev('^6.0.0')) });
  entries[2] = { path: 'package/index.js', content: 'b' };
  assert.equal(verdict(tarStream(entries)), 'drift');
});

test('reports a byte that differs in another header as drift', () => {
  for (const [index, edit] of [
    [0, (header) => header.write('0000700', 100)],
    [2, (header) => header.write('00000000001\0', 136)],
    [3, (header) => header.write('0000001\0', 108)],
  ]) {
    assert.equal(verdict(tamper(published, offsetOf(local, index), edit)), 'drift', `entry ${index}`);
  }
});

test('reports a root header that differs outside size and checksum as drift', () => {
  for (const edit of [
    (header) => header.write('0000755\0', 100),
    (header) => header.write('00000000001\0', 136),
    (header) => header.write('\0', 156),
    (header) => header.write('x', 157),
    (header) => header.write('0000001\0', 108),
  ]) {
    assert.equal(verdict(tamper(published, ROOT_AT, edit)), 'drift');
  }
});

test('reports a size field in another shape as drift', () => {
  const size = published.subarray(ROOT_AT + 124, ROOT_AT + 136).toString('latin1');
  assert.match(size, /^\d{11} $/);
  for (const other of [`${size.slice(0, 11)}\0`, `${size.slice(1, 11)}  `, `${size.slice(0, 11)}0`]) {
    assert.equal(verdict(tamper(published, ROOT_AT, (header) => header.write(other, 124, 'latin1'))), 'drift');
  }
});

test('reports a wrong checksum as drift', () => {
  const wrong = tamper(published, ROOT_AT, (header) => header.write('0000001 \0', 148), { stamp: false });
  assert.equal(verdict(wrong), 'drift');
});

test('reports a checksum field in another shape as drift', () => {
  const sum = (header) => header.reduce((total, byte, index) => total + (index >= 148 && index < 156 ? 0x20 : byte), 0);
  for (const shape of [
    (value) => value.toString(8).padStart(8, '0'),
    (value) => `${value.toString(8).padStart(6, '0')}\0 `,
    (value) => `${value.toString(8).padStart(6, '0')}\0\0`,
    (value) => `${value.toString(8).padStart(7, '0')}\0`,
  ]) {
    const changed = tamper(
      published,
      ROOT_AT,
      (header) => header.write(shape(sum(header)), 148, 'latin1'),
      { stamp: false },
    );
    assert.equal(verdict(changed), 'drift');
  }
});

test('reports non-zero padding after the content as drift', () => {
  const copy = Buffer.from(published);
  const size = Buffer.byteLength(pkg(dev('^6.0.0')));
  assert.ok(size % 512 !== 0);
  copy[ROOT_AT + 512 + size] = 1;
  assert.equal(verdict(copy), 'drift');
});

test('reports an extra entry before or after the root entry as drift', () => {
  const extra = { path: 'package/extra.js', content: 'x' };
  assert.equal(verdict(tarStream(layout({ root: pkg(dev('^6.0.0')), before: [extra] }))), 'drift');
  assert.equal(verdict(tarStream(layout({ root: pkg(dev('^6.0.0')), after: [extra] }))), 'drift');
});

test('reports an entry hidden after the end of the archive as drift', () => {
  const hidden = tarBlocks([{ path: 'package/dist/hidden.js', content: 'evil' }]);
  assert.equal(verdict(Buffer.concat([published, hidden, Buffer.alloc(1024)])), 'drift');
  assert.equal(verdict(Buffer.concat([published, Buffer.alloc(512, 1)])), 'drift');
});

test('reports a different entry order as drift', () => {
  assert.equal(verdict(tarStream(layout({ root: pkg(dev('^6.0.0')), swap: true }))), 'drift');
});

test('reports a nested package.json that differs as drift', () => {
  const nested = (version) => ({ path: 'package/dist/package.json', content: pkg(dev(version)) });
  const base = tarStream(layout({ root: pkg(dev('^5.0.0')), after: [nested('1')] }));
  assert.equal(verdict(tarStream(layout({ root: pkg(dev('^6.0.0')), after: [nested('2')] })), base), 'drift');
  assert.equal(verdict(tarStream(layout({ root: pkg(dev('^5.0.0')), after: [nested('2')] })), base), 'drift');
  assert.equal(verdict(tarStream(layout({ root: pkg(dev('^6.0.0')), after: [nested('1')] })), base), 'devDependencies');
});

test('reports drift when the local stream is not plain', () => {
  const cases = {
    'two root entries': { after: [{ path: ROOT, content: pkg({}) }] },
    'a PAX header': { before: [{ path: 'PaxHeader/x', type: 'x', content: '20 mtime=1700000000\n' }] },
    'a GNU long name header': { before: [{ path: 'long', type: 'L', content: 'package/long\0' }] },
    'a symbolic link': { after: [{ path: 'package/l', type: '2', linkname: 'x' }] },
  };
  for (const [name, options] of Object.entries(cases)) {
    const build = (version) => tarStream(layout({ root: pkg(dev(version)), ...options }));
    assert.equal(verdict(build('^6.0.0'), build('^5.0.0')), 'drift', name);
  }
  const noRoot = tarStream(layout({ root: '' }).filter(({ path }) => path !== ROOT));
  assert.equal(verdict(published, noRoot), 'drift');
});

test('reports drift when the local stream has a bad header or no end', () => {
  const badSum = tamper(localStream, ROOT_AT, (header) => header.write('0000001 \0', 148), { stamp: false });
  assert.equal(verdict(published, badSum), 'drift');
  // A bad checksum on an entry before the root entry, in both streams.
  const edit = (header) => header.write('0000001 \0', 148);
  const badFirst = tamper(localStream, 0, edit, { stamp: false });
  const badFirstPublished = tamper(published, 0, edit, { stamp: false });
  assert.equal(verdict(badFirstPublished, badFirst), 'drift');
  const badSize = tamper(localStream, ROOT_AT, (header) => header.write('0000000012x ', 124, 'latin1'));
  assert.equal(verdict(published, badSize), 'drift');
  assert.equal(verdict(published, localStream.subarray(0, localStream.length - 1024)), 'drift');
});

test('reports drift when the local package.json is not in a canonical format', () => {
  const compact = (version) => tarStream(layout({ root: pkg(dev(version), JSON.stringify) }));
  assert.equal(verdict(compact('^6.0.0'), compact('^5.0.0')), 'drift');
  const tabs = (version) => tarStream(layout({ root: pkg(dev(version), (v) => JSON.stringify(v, null, '\t')) }));
  assert.equal(verdict(tabs('^6.0.0'), tabs('^5.0.0')), 'drift');
});

test('reports drift when package.json is not an object', () => {
  const array = (text) => tarStream(layout({ root: text }));
  assert.equal(verdict(array('[2]'), array('[1]')), 'drift');
  assert.equal(verdict(array('{"devDependencies": 2,'), array('{"devDependencies": 1,')), 'drift');
});

test('reports the five hand-made carrier shapes as drift', () => {
  const evil = tarBlocks([{ path: 'package/dist/index.js', content: 'EVIL' }]);
  const root = pkg(dev('^6.0.0'));
  const shapes = {
    'a carrier with an alias path and a linkname': {
      mid: [{ path: 'package/./README.md', linkname: 'x', content: evil }],
    },
    'a carrier with an 8 digit checksum': {
      mid: [{ path: 'package/./README.md', content: evil }],
      edit: (header) =>
        header.write(
          header.reduce((total, byte, index) => total + (index >= 148 && index < 156 ? 0x20 : byte), 0).toString(8).padStart(8, '0'),
          148,
          'latin1',
        ),
    },
    'a directory entry with a body that holds a hard link': {
      mid: [
        {
          path: 'package/dist/',
          type: '5',
          mode: 0o755,
          content: tarBlocks([{ path: 'package/dist/l', type: '1', linkname: 'package/index.js' }]),
        },
      ],
    },
    'an empty name with a prefix': {
      mid: [{ path: '', prefix: 'package/dist', type: '5', mode: 0o755 }],
    },
    'a prefix without the ustar magic': {
      mid: [{ path: 'package/./README.md', magic: '\0\0\0\0\0\0', prefix: 'package/dist/x', content: 'EVIL' }],
    },
  };
  for (const [name, { mid, edit }] of Object.entries(shapes)) {
    const entries = layout({ root, mid });
    let stream = tarStream(entries);
    if (edit) stream = tamper(stream, offsetOf(entries, 3), edit, { stamp: false });
    assert.equal(verdict(stream), 'drift', name);
  }
});

test('compares tar streams, not compressed bytes', () => {
  const again = gzipSync(localStream, { level: 1 });
  assert.equal(compareTarballBytes(again, gzipSync(localStream, { level: 9 })), 'identical');
  assert.equal(compareTarballBytes(gzipSync(published), gzipSync(localStream)), 'devDependencies');
});

test('throws when the published stream is far longer than the local one', () => {
  const bomb = gzipSync(Buffer.concat([published, Buffer.alloc(2 * 1024 * 1024)]));
  assert.throws(() => compareTarballBytes(bomb, gzipSync(localStream)), RangeError);
  const fine = gzipSync(Buffer.concat([published, Buffer.alloc(512 * 1024)]));
  assert.equal(compareTarballBytes(fine, gzipSync(localStream)), 'drift');
});
