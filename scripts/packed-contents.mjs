import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { gunzipSync } from 'node:zlib';

/**
 * The one rule for comparing a published tarball with a rebuilt one.
 *
 * Both tarballs are unpacked and compared entry by entry. The unpacked tree
 * must hold only the directory `package/`, and only regular files and
 * directories. Any other entry (a symbolic link, a FIFO, a device) is an error;
 * it is never followed or read. A file is compared by its bytes and by whether
 * any execute bit is set. A directory, empty or not, is an entry too.
 *
 * Under the rule, the root `package/package.json` is compared without its
 * top-level `devDependencies` field, because consumers never install it. The
 * status is `devDependencies` only when the two tarballs differ in nothing but
 * that field of that file. Anything else is `drift`.
 *
 * Limits: when `devDependencies` really differ, the rest of the root
 * `package.json` is compared as parsed JSON, so a difference of formatting in
 * the same file is not seen. A formatting difference alone is `drift`. The
 * order of tar entries is not compared. A `package.json` that does not parse is
 * compared by its raw bytes.
 */
const ROOT_PACKAGE_JSON = 'package.json';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

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
 * bytes of the root `package.json` (null when there is none). Throws when the
 * unpacked tree holds anything but the directory `package`.
 */
export async function unpackTarball(tarball, destination) {
  await mkdir(destination, { recursive: true });
  execFileSync('tar', ['-xzf', tarball, '-C', destination], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const top = await readdir(destination, { withFileTypes: true });
  if (top.length !== 1 || top[0].name !== 'package' || !top[0].isDirectory()) {
    throw new Error(
      `Tarball must hold only the directory package/, found: ${
        top.map(({ name }) => name).join(', ') || 'nothing'
      }`,
    );
  }
  const root = join(destination, 'package');
  let rootPackageJson = null;
  try {
    rootPackageJson = await readFile(join(root, ROOT_PACKAGE_JSON));
  } catch {
    // A missing or unreadable root file shows in the hash maps.
  }
  return {
    exact: await hashTree(root),
    ruled: await hashTree(root, { ignoreDevDependencies: true }),
    rootPackageJson,
  };
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
