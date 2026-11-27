import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { gunzipSync } from 'node:zlib';

/**
 * The one rule for comparing a published tarball with a rebuilt one. The two
 * may differ only in the top-level `devDependencies` field of the root
 * `package/package.json`, because consumers never install it. Every other file,
 * and every other field of that file, is compared exactly. A `package.json`
 * that does not parse is compared by its raw bytes.
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

/** Hashes of an unpacked tree, by path relative to `base`. */
export async function hashTree(
  directory,
  { ignoreDevDependencies = false, base = directory, hashes = new Map() } = {},
) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await hashTree(path, { ignoreDevDependencies, base, hashes });
      continue;
    }
    const name = relative(base, path).split('\\').join('/');
    const bytes = await readFile(path);
    hashes.set(
      name,
      ignoreDevDependencies && name === ROOT_PACKAGE_JSON
        ? packageJsonHash(bytes)
        : sha256(bytes),
    );
  }
  return hashes;
}

/** Paths whose bytes differ, or that exist on only one side. */
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

/** Unpack a tarball and return both hash maps: exact and under the rule. */
export async function unpackTarball(tarball, destination) {
  await mkdir(destination, { recursive: true });
  execFileSync('tar', ['-xzf', tarball, '-C', destination], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const root = join(destination, 'package');
  return {
    exact: await hashTree(root),
    ruled: await hashTree(root, { ignoreDevDependencies: true }),
  };
}

/**
 * The gzip header records the packing OS, so compressed bytes differ between
 * macOS and Linux. The tar stream inside is deterministic.
 */
export function tarStreamHash(bytes) {
  return sha256(gunzipSync(bytes));
}

/**
 * Compare two tarballs under the rule. `status` is:
 * - `identical`: the tar streams are equal;
 * - `devDependencies`: they differ only in the root `devDependencies` field;
 * - `drift`: anything else. `files` lists the differing paths (under the
 *   rule), and `tarOnly` is true when no file differs but the tar entry
 *   metadata does.
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
  if (exact.length > 0) return { status: 'devDependencies', files: [], tarOnly: false };
  return { status: 'drift', files: [], tarOnly: true };
}
