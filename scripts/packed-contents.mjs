import { Buffer } from 'node:buffer';
import { TextDecoder } from 'node:util';
import { gunzipSync } from 'node:zlib';

/**
 * The one rule for comparing a published tarball with a rebuilt one.
 *
 * The rebuilt tarball is ours. The published one is not, and tools read a
 * hand-made tarball in different ways. So the decision never reads the
 * published tarball as a tar archive and never unpacks anything. It compares
 * bytes.
 *
 * The gunzipped tar streams must be equal byte for byte, except inside one
 * entry: `package/package.json` of the rebuilt stream. There only three things
 * may differ:
 * - the size field of the header;
 * - the checksum field of the header;
 * - the content, and only its top-level `devDependencies` field.
 *
 * The size and checksum fields must have the shape the rebuilt header has. The
 * padding after the content must be zero. Everything before the entry and
 * everything after it must be equal, so the entry list, the entry order, the
 * other headers and the end of the archive are the same.
 *
 * The root `package.json` of both streams must be in one canonical format:
 * `JSON.stringify` with two spaces, with or without a final newline. The
 * published bytes must be exactly what that format gives for the parsed
 * published object. Then the two objects must be equal without
 * `devDependencies`, and their `devDependencies` must differ.
 *
 * The result is `identical`, `devDependencies` or `drift`. Anything else is
 * `drift`, also a rebuilt stream that the walk below does not understand.
 *
 * The only thing not compared when `devDependencies` differ: the position of
 * the `devDependencies` key inside `package.json`.
 */
const BLOCK = 512;
const NAME = [0, 100];
const SIZE = [124, 136];
const CHECKSUM = [148, 156];
const TYPE = 156;
const PREFIX = [345, 500];
const ROOT_PATH = 'package/package.json';
// How much longer than the rebuilt stream a gunzipped published stream may be.
const EXTRA_OUTPUT = 1024 * 1024;

const SERIALIZERS = [
  (value) => `${JSON.stringify(value, null, 2)}\n`,
  (value) => JSON.stringify(value, null, 2),
];

const isZero = (bytes) => bytes.every((byte) => byte === 0);

const headerChecksum = (header) =>
  header.reduce(
    (sum, byte, index) =>
      sum + (index >= CHECKSUM[0] && index < CHECKSUM[1] ? 0x20 : byte),
    0,
  );

const cString = (bytes) => {
  const end = bytes.indexOf(0);
  return bytes.subarray(0, end === -1 ? bytes.length : end).toString('latin1');
};

/** The count of leading octal digits of a header field, and the bytes after. */
function splitField(field) {
  const digits = /^[0-7]*/.exec(field.toString('latin1'))[0].length;
  return { digits, tail: field.subarray(digits) };
}

const fieldValue = (field, digits) =>
  parseInt(field.toString('latin1').slice(0, digits), 8);

/** The field a writer with the shape `format` writes for `value`, or null. */
function encodeField(value, format) {
  if (!Number.isSafeInteger(value) || format.digits === 0) return null;
  const digits = value.toString(8).padStart(format.digits, '0');
  if (digits.length !== format.digits) return null;
  return Buffer.concat([Buffer.from(digits, 'latin1'), format.tail]);
}

/**
 * The shape of a rebuilt field, or null when the field is not exactly what its
 * own shape gives back for its own number.
 */
function fieldShape(field) {
  const format = splitField(field);
  const value = fieldValue(field, format.digits);
  return encodeField(value, format)?.equals(field) ? format : null;
}

/**
 * Walk the rebuilt stream. Returns the offset and size of its one
 * `package/package.json` entry, or null when the stream is not plain: a bad
 * checksum or size field, an entry type other than a file or a directory, no
 * end of archive, or a root entry that is missing, twice there, or not a plain
 * file.
 */
function findRoot(tar) {
  const roots = [];
  for (let offset = 0; ; ) {
    if (offset + BLOCK > tar.length) return null;
    const header = tar.subarray(offset, offset + BLOCK);
    if (isZero(header)) break;
    const checksum = header.subarray(CHECKSUM[0], CHECKSUM[1]);
    const { digits } = splitField(checksum);
    if (digits === 0 || fieldValue(checksum, digits) !== headerChecksum(header)) {
      return null;
    }
    const type = header[TYPE];
    if (type !== 0 && type !== 0x30 && type !== 0x35) return null;
    const sizeField = header.subarray(SIZE[0], SIZE[1]).toString('latin1');
    if (!/^[0-7]+[\0 ]*$/.test(sizeField)) return null;
    const size = parseInt(sizeField, 8);
    const name = cString(header.subarray(NAME[0], NAME[1]));
    const prefix = cString(header.subarray(PREFIX[0], PREFIX[1]));
    if ((prefix ? `${prefix}/${name}` : name) === ROOT_PATH) {
      roots.push({
        offset,
        size,
        plain: name === ROOT_PATH && !prefix && type !== 0x35,
      });
    }
    offset += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
    if (offset > tar.length) return null;
  }
  return roots.length === 1 && roots[0].plain ? roots[0] : null;
}

const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/** The parsed top-level object of strict UTF-8 JSON bytes, or null. */
function parseObject(bytes) {
  try {
    const value = JSON.parse(decoder.decode(bytes));
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

/** Whether two root `package.json` contents differ only in `devDependencies`. */
function onlyDevDependenciesDiffer(publishedBytes, localBytes) {
  const published = parseObject(publishedBytes);
  const local = parseObject(localBytes);
  if (published === null || local === null) return false;
  const serialize = SERIALIZERS.find((candidate) =>
    Buffer.from(candidate(local)).equals(localBytes),
  );
  if (serialize === undefined) return false;
  if (!Buffer.from(serialize(published)).equals(publishedBytes)) return false;
  const publishedDev = JSON.stringify(published.devDependencies);
  const localDev = JSON.stringify(local.devDependencies);
  delete published.devDependencies;
  delete local.devDependencies;
  return (
    publishedDev !== localDev &&
    JSON.stringify(published) === JSON.stringify(local)
  );
}

const withoutVariableFields = (header) => {
  const copy = Buffer.from(header);
  copy.fill(0, SIZE[0], SIZE[1]);
  copy.fill(0, CHECKSUM[0], CHECKSUM[1]);
  return copy;
};

/**
 * Compare two gunzipped tar streams (Buffers). Returns `identical`,
 * `devDependencies` or `drift`. Pure: it reads no file and starts no process.
 */
export function compareTarStreams(published, local) {
  if (published.equals(local)) return 'identical';
  const root = findRoot(local);
  if (root === null) return 'drift';
  const at = root.offset;
  if (published.length < at + BLOCK) return 'drift';
  if (!published.subarray(0, at).equals(local.subarray(0, at))) return 'drift';

  const publishedHeader = published.subarray(at, at + BLOCK);
  const localHeader = local.subarray(at, at + BLOCK);
  if (
    !withoutVariableFields(publishedHeader).equals(
      withoutVariableFields(localHeader),
    )
  ) {
    return 'drift';
  }

  const sizeShape = fieldShape(localHeader.subarray(SIZE[0], SIZE[1]));
  const checksumShape = fieldShape(
    localHeader.subarray(CHECKSUM[0], CHECKSUM[1]),
  );
  if (sizeShape === null || checksumShape === null) return 'drift';
  const sizeField = publishedHeader.subarray(SIZE[0], SIZE[1]);
  const publishedSize = fieldValue(sizeField, splitField(sizeField).digits);
  if (!encodeField(publishedSize, sizeShape)?.equals(sizeField)) return 'drift';
  const expectedChecksum = encodeField(
    headerChecksum(publishedHeader),
    checksumShape,
  );
  if (
    !expectedChecksum?.equals(publishedHeader.subarray(CHECKSUM[0], CHECKSUM[1]))
  ) {
    return 'drift';
  }

  const contentStart = at + BLOCK;
  const blocks = (size) => Math.ceil(size / BLOCK) * BLOCK;
  const publishedEnd = contentStart + blocks(publishedSize);
  const localEnd = contentStart + blocks(root.size);
  if (publishedEnd > published.length) return 'drift';
  if (!isZero(published.subarray(contentStart + publishedSize, publishedEnd))) {
    return 'drift';
  }
  if (!published.subarray(publishedEnd).equals(local.subarray(localEnd))) {
    return 'drift';
  }
  return onlyDevDependenciesDiffer(
    published.subarray(contentStart, contentStart + publishedSize),
    local.subarray(contentStart, contentStart + root.size),
  )
    ? 'devDependencies'
    : 'drift';
}

/**
 * Gunzip two tarballs and compare their tar streams. The gzip header records
 * the packing OS, so the compressed bytes are not compared. Throws when the
 * published stream is far longer than the rebuilt one.
 */
export function compareTarballBytes(publishedBytes, localBytes) {
  const local = gunzipSync(localBytes);
  const published = gunzipSync(publishedBytes, {
    maxOutputLength: local.length + EXTRA_OUTPUT,
  });
  return compareTarStreams(published, local);
}
