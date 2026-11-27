import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, relative } from 'node:path';
import { gunzipSync } from 'node:zlib';

/**
 * The one rule for comparing a published tarball with a rebuilt one.
 *
 * First the tar entries of both tarballs are read from the tar headers, before
 * anything is unpacked. Every entry must be a regular file or a directory,
 * under `package/`, with no `..` segment, no backslash and no second entry of
 * the same path. Any other entry (a hard link, a symbolic link, a FIFO, a
 * device) is an error that names the entry. Nothing is unpacked in that case.
 *
 * Then both tarballs are unpacked and compared entry by entry. The unpacked
 * tree must hold only the directory `package/`, and only regular files and
 * directories; this is a second barrier. A link is never read. A file is
 * compared by its bytes and by whether any execute bit is set. A directory,
 * empty or not, is an entry too.
 *
 * Under the rule, the root `package/package.json` is compared without its
 * top-level `devDependencies` field, because consumers never install it. The
 * status is `devDependencies` only when the two tarballs differ in nothing but
 * that field of that file. Anything else is `drift`.
 *
 * Not compared when `devDependencies` really differ:
 * - the formatting of the root `package.json`. It is compared as parsed JSON,
 *   and an invalid UTF-8 byte is read as U+FFFD. A formatting difference alone
 *   is `drift`. A `package.json` that does not parse is compared by its raw
 *   bytes;
 * - permission bits other than the execute bit. npm sets file modes on install
 *   and keeps only the execute bit;
 * - the modification time and the owner of an entry;
 * - the order of tar entries.
 */
const ROOT_PACKAGE_JSON = 'package.json';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const BLOCK = 512;
const text = (block, start, length) => {
  const field = block.subarray(start, start + length);
  const end = field.indexOf(0);
  return field.subarray(0, end === -1 ? length : end).toString('utf8');
};

/**
 * An octal header field, or null when it is not plain: after removal of leading
 * spaces and trailing NUL and space bytes, only the digits 0-7 may remain. An
 * empty field is 0 only when `emptyIsZero`.
 */
function octalField(header, start, length, emptyIsZero = false) {
  const value = header
    .subarray(start, start + length)
    .toString('latin1')
    .replace(/[\0 ]+$/, '')
    .replace(/^ +/, '');
  if (value === '') return emptyIsZero ? 0 : null;
  return /^[0-7]+$/.test(value) ? parseInt(value, 8) : null;
}

/** Records of a PAX header: `<length> <key>=<value>\n`. */
function parsePax(data) {
  const records = new Map();
  let offset = 0;
  while (offset < data.length) {
    const space = data.indexOf(0x20, offset);
    const length = Number(data.subarray(offset, space).toString('utf8'));
    if (space === -1 || !Number.isInteger(length) || length <= space - offset + 1) {
      throw new Error('Tarball has a malformed PAX header');
    }
    const record = data.subarray(space + 1, offset + length - 1).toString('utf8');
    const equals = record.indexOf('=');
    if (equals === -1) throw new Error('Tarball has a malformed PAX header');
    records.set(record.slice(0, equals), record.slice(equals + 1));
    offset += length;
  }
  return records;
}

const TYPE_NAMES = {
  1: 'a hard link',
  2: 'a symbolic link',
  3: 'a character device',
  4: 'a block device',
  6: 'a FIFO',
};

/**
 * Check the entries of a tar stream (gunzipped bytes) from the tar headers,
 * without unpacking. Throws an error that names the first bad entry. Every
 * entry must be a regular file or a directory, under `package/`, with no `..`
 * segment, no backslash, and a path that no other entry has. Reading the
 * headers does not depend on how `tar -tv` prints an entry on one platform or
 * another. A PAX (`x`) or GNU long name (`L`) header gives the path of the next
 * entry; any other header kind is an error. The reader is strict: a bad header
 * checksum, a size field that is not plain octal, a second name header for one
 * entry, or any byte after the end of the archive is an error, so it never sees
 * another list of entries than `tar` does.
 */
export function assertSafeTarEntries(tar, label = 'Tarball') {
  const seen = new Set();
  let longName = null;
  let pax = null;
  let offset = 0;
  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK);
    if (header.every((byte) => byte === 0)) {
      if (longName !== null || pax !== null) {
        throw new Error(`${label} has a long name or PAX header with no entry after it`);
      }
      if (tar.subarray(offset).some((byte) => byte !== 0)) {
        throw new Error(`${label} has data after the end of the archive`);
      }
      return;
    }
    const sum = header.reduce(
      (total, byte, index) => total + (index >= 148 && index < 156 ? 0x20 : byte),
      0,
    );
    const stored = octalField(header, 148, 8);
    if (stored === null || stored !== sum) {
      throw new Error(`${label} has a tar header with a bad checksum`);
    }
    const type = String.fromCharCode(header[156] || 0x30);
    const size = octalField(header, 124, 12, type === '5');
    if (size === null) throw new Error(`${label} has a malformed tar header`);
    const dataEnd = offset + BLOCK + size;
    if (dataEnd > tar.length) throw new Error(`${label} is truncated`);
    const data = tar.subarray(offset + BLOCK, dataEnd);
    offset += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
    if (type === 'L') {
      if (longName !== null || pax !== null) {
        throw new Error(`${label} has two name headers for one entry`);
      }
      longName = text(data, 0, data.length);
      continue;
    }
    if (type === 'x') {
      if (longName !== null || pax !== null) {
        throw new Error(`${label} has two name headers for one entry`);
      }
      pax = parsePax(data);
      continue;
    }
    if (longName !== null && pax?.has('path')) {
      throw new Error(`${label} has both a GNU long name and a PAX path for one entry`);
    }
    let path = longName ?? pax?.get('path');
    if (path === undefined || path === null) {
      const prefix = text(header, 345, 155);
      const name = text(header, 0, 100);
      const ustar = text(header, 257, 5) === 'ustar';
      path = ustar && prefix ? `${prefix}/${name}` : name;
    }
    const override = pax;
    longName = null;
    pax = null;
    if (type !== '0' && type !== '5') {
      const kind = TYPE_NAMES[type] ?? `an entry of type ${JSON.stringify(type)}`;
      throw new Error(`${label} has ${kind}, not a regular file or a directory: ${path}`);
    }
    if (override?.has('size')) {
      throw new Error(`${label} has an entry with a PAX size override: ${path}`);
    }
    const normal = path.replace(/^(?:\.\/)+/, '').replace(/\/+$/, '');
    const segments = normal.split('/');
    if (
      (normal !== 'package' && !normal.startsWith('package/')) ||
      segments.includes('..') ||
      segments.includes('') ||
      path.includes('\\')
    ) {
      throw new Error(`${label} has an entry with an unsafe path: ${path}`);
    }
    if (seen.has(normal)) {
      throw new Error(`${label} has two entries with the same path: ${path}`);
    }
    seen.add(normal);
  }
  if (longName !== null || pax !== null) {
    throw new Error(`${label} has a long name or PAX header with no entry after it`);
  }
  if (offset < tar.length) throw new Error(`${label} is truncated`);
}

/**
 * Remove a directory tree, also when it holds a directory without owner
 * permissions. Never throws: a failed cleanup must not replace the result or
 * the error of the work it follows.
 */
export async function removeTree(directory) {
  const restore = async (path) => {
    let info;
    try {
      info = await lstat(path);
    } catch {
      return;
    }
    if (!info.isDirectory()) return;
    await chmod(path, 0o700).catch(() => {});
    for (const name of await readdir(path).catch(() => [])) {
      await restore(join(path, name));
    }
  };
  try {
    await restore(directory);
    await rm(directory, { recursive: true, force: true });
  } catch {
    // The temp directory stays; the caller's result is what counts.
  }
}

/** The hash of a root `package.json` with `devDependencies` removed. */
export function packageJsonHash(bytes) {
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    return sha256(bytes);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return sha256(bytes);
  }
  delete parsed.devDependencies;
  return sha256(JSON.stringify(parsed));
}

/**
 * Hashes of an unpacked tree, by path relative to `base`. A file maps to
 * `<sha256>:x` (an execute bit is set) or `<sha256>:-`. A directory maps to
 * `dir`, under its path with a trailing `/`. Throws on any other entry type.
 */
export async function hashTree(
  directory,
  { ignoreDevDependencies = false, base = directory, hashes = new Map() } = {},
) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const name = relative(base, path).split('\\').join('/');
    if (entry.isDirectory()) {
      hashes.set(`${name}/`, 'dir');
      await hashTree(path, { ignoreDevDependencies, base, hashes });
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(
        `Tarball entry is not a regular file or a directory: ${name}`,
      );
    }
    const bytes = await readFile(path);
    const executable = (await lstat(path)).mode & 0o111 ? 'x' : '-';
    const hash =
      ignoreDevDependencies && name === ROOT_PACKAGE_JSON
        ? packageJsonHash(bytes)
        : sha256(bytes);
    hashes.set(name, `${hash}:${executable}`);
  }
  return hashes;
}

/** Paths whose value differs, or that exist on only one side. */
export function diffFileHashes(published, local) {
  const paths = new Set([...published.keys(), ...local.keys()]);
  return [...paths]
    .filter((path) => published.get(path) !== local.get(path))
    .sort()
    .map((path) => ({
      path,
      change: !published.has(path)
        ? 'added'
        : !local.has(path)
          ? 'removed'
          : 'modified',
    }));
}

/**
 * Unpack a tarball. Return both hash maps (exact and under the rule) and the
 * bytes of the root `package.json` (null when there is none). Throws on a bad
 * tar entry before the unpack, and when the unpacked tree holds anything but the
 * directory `package`.
 */
export async function unpackTarball(tarball, destination) {
  assertSafeTarEntries(gunzipSync(await readFile(tarball)), tarball);
  await mkdir(destination, { recursive: true });
  execFileSync('tar', ['-xzf', tarball, '-C', destination], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const top = await readdir(destination, { withFileTypes: true });
  if (top.length !== 1 || top[0].name !== 'package' || !top[0].isDirectory()) {
    throw new Error(
      `Tarball must hold only the directory package/, found: ${
        top
          .map(({ name }) => name)
          .sort()
          .join(', ') || 'nothing'
      }`,
    );
  }
  const root = join(destination, 'package');
  // hashTree throws on a non-regular entry, so it runs before the read below.
  const exact = await hashTree(root);
  const ruled = await hashTree(root, { ignoreDevDependencies: true });
  let rootPackageJson = null;
  try {
    rootPackageJson = await readFile(join(root, ROOT_PACKAGE_JSON));
  } catch {
    // A missing root file shows in the hash maps.
  }
  return { exact, ruled, rootPackageJson };
}

/**
 * The gzip header records the packing OS, so compressed bytes differ between
 * macOS and Linux. The tar stream inside is deterministic.
 */
export function tarStreamHash(bytes) {
  return sha256(gunzipSync(bytes));
}

const parseObject = (bytes) => {
  try {
    const parsed = JSON.parse(Buffer.from(bytes).toString('utf8'));
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
};

/** True when both files parse to objects and their `devDependencies` differ. */
function devDependenciesDiffer(publishedBytes, localBytes) {
  if (publishedBytes === null || localBytes === null) return false;
  const published = parseObject(publishedBytes);
  const local = parseObject(localBytes);
  if (published === null || local === null) return false;
  return (
    JSON.stringify(published.devDependencies) !==
    JSON.stringify(local.devDependencies)
  );
}

/**
 * Compare two tarballs under the rule. `status` is:
 * - `identical`: the tar streams are equal;
 * - `devDependencies`: the tarballs differ in nothing but the top-level
 *   `devDependencies` field of the root `package.json`;
 * - `drift`: anything else. `files` lists the differing paths, and `tarOnly`
 *   is true when no file differs but the tar entry metadata does.
 */
export async function compareTarballs({
  publishedBytes,
  localTarball,
  directory,
}) {
  if (tarStreamHash(publishedBytes) === tarStreamHash(await readFile(localTarball))) {
    return { status: 'identical', files: [], tarOnly: false };
  }
  const publishedTarball = join(directory, 'published.tgz');
  await writeFile(publishedTarball, publishedBytes);
  const published = await unpackTarball(publishedTarball, join(directory, 'published'));
  const local = await unpackTarball(localTarball, join(directory, 'local'));
  const files = diffFileHashes(published.ruled, local.ruled);
  if (files.length > 0) return { status: 'drift', files, tarOnly: false };
  const exact = diffFileHashes(published.exact, local.exact);
  if (exact.length === 0) return { status: 'drift', files: [], tarOnly: true };
  if (
    exact.length === 1 &&
    exact[0].path === ROOT_PACKAGE_JSON &&
    devDependenciesDiffer(published.rootPackageJson, local.rootPackageJson)
  ) {
    return { status: 'devDependencies', files: [], tarOnly: false };
  }
  return {
    status: 'drift',
    files: [{ path: ROOT_PACKAGE_JSON, change: 'modified' }],
    tarOnly: false,
  };
}
