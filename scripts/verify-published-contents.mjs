import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { clearTimeout, setTimeout } from 'node:timers';
import { setTimeout as delay } from 'node:timers/promises';

import { assembleReleasePlan } from '@changesets/assemble-release-plan';
import { readConfig } from '@changesets/config';
import { readPreState } from '@changesets/pre';
import { readChangesets } from '@changesets/read';
import { getPackages } from '@manypkg/get-packages';

import { compareTarballBytes } from './packed-contents.mjs';
import { readReleaseInputs } from './release-plan.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'https://registry.npmjs.org';
// `devDependencies` is not listed: at version time `pnpm pack` also writes exact
// versions in place of `workspace:` ranges there, so the packed
// `devDependencies` do change. packed-contents.mjs accepts that difference, so
// such an entry does not count as a rewrite.
const DEPENDENCY_FIELDS = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
];

/**
 * What `changeset version` will do with the pending Changesets. `versioned`
 * holds every package that gets a new version, including dependents that
 * Changesets bumps on its own. `rewritten` maps each package that keeps its
 * version to the versioned workspace packages it names: `pnpm pack` writes
 * their exact versions into its package.json, so that file still changes.
 */
export function predictVersioning(releases, workspacePackages) {
  const versioned = new Set(
    releases
      .filter(({ type }) => type !== 'none')
      .map(({ name }) => name),
  );
  const rewritten = new Map();
  for (const { packageJson } of workspacePackages) {
    if (versioned.has(packageJson.name)) continue;
    const names = DEPENDENCY_FIELDS.flatMap((field) =>
      Object.entries(packageJson[field] ?? {})
        .filter(
          ([name, range]) =>
            versioned.has(name) && String(range).startsWith('workspace:'),
        )
        .map(([name]) => name),
    );
    if (names.length > 0) {
      rewritten.set(packageJson.name, [...new Set(names)].sort());
    }
  }
  return { versioned, rewritten };
}

export async function readVersioning(root = ROOT) {
  const packages = await getPackages(root);
  const { config, errors } = await readConfig(root, packages);
  if (errors) {
    throw new Error(`Changesets config is invalid:\n- ${errors.join('\n- ')}`);
  }
  const plan = assembleReleasePlan(
    await readChangesets(root),
    packages,
    config,
    await readPreState(root),
  );
  return predictVersioning(plan.releases, packages.packages);
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
 * A published version is immutable, so its contents may only change when
 * `changeset version` will give the package a new version.
 */
export function decideCheck(packageInfo, { published, versioned }) {
  if (!published) return 'unpublished';
  if (versioned.has(packageInfo.name)) return 'versioned';
  return 'compare';
}

export function formatDriftError(drifted) {
  const lines = drifted.flatMap(
    ({ name, version, files = [], tarOnly = false, rewrittenBy = [] }) => [
      `${name}@${version} is already published, but its packed contents ${
        files.length > 0 || tarOnly ? 'changed' : 'will change'
      }:`,
      ...files.map(({ path, change }) => `  ${change}: ${path}`),
      ...(tarOnly
        ? ['  modified: tar entry metadata (modification time, owner, permission bits) or entry order']
        : []),
      ...(rewrittenBy.length > 0
        ? [
            `  package.json will pin new versions of ${rewrittenBy.join(', ')}`,
          ]
        : []),
    ],
  );
  const names = drifted.map(({ name }) => `'${name}'`).join(', ');
  return [
    ...lines,
    '',
    `Add a Changeset for ${names}.`,
    'The publish preflight rejects any release while a published version no longer',
    'matches its rebuilt tarball, such as a changed dependency range or CSS a',
    'package rebundles from tokens. A change to devDependencies alone is allowed.',
  ].join('\n');
}

export function describeError(error) {
  const messages = [];
  for (let current = error; current; current = current.cause) {
    messages.push(current.message ?? String(current));
  }
  return messages.join('\ncaused by: ');
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options,
  });
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

/**
 * Hashes of an unpacked tree, by path relative to `base`. A file maps to
 * `<sha256>:x` (an execute bit is set) or `<sha256>:-`. A directory maps to
 * `dir`, under its path with a trailing `/`. Throws on any other entry type, so
 * a link is never read.
 */
export async function hashTree(directory, base = directory, hashes = new Map()) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const name = relative(base, path).split('\\').join('/');
    if (entry.isDirectory()) {
      hashes.set(`${name}/`, 'dir');
      await hashTree(path, base, hashes);
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(
        `Tarball entry is not a regular file or a directory: ${name}`,
      );
    }
    const hash = createHash('sha256').update(await readFile(path)).digest('hex');
    const executable = (await lstat(path)).mode & 0o111 ? 'x' : '-';
    hashes.set(name, `${hash}:${executable}`);
  }
  return hashes;
}

async function unpack(tarball, destination) {
  await mkdir(destination, { recursive: true });
  run('tar', ['-xzf', tarball, '-C', destination]);
  return hashTree(join(destination, 'package'));
}

/**
 * The report for a person, built after the decision is `drift`. It unpacks
 * both tarballs with the system `tar` and lists the files that differ. It never
 * decides anything. `tarOnly` is true when no file differs.
 */
async function reportDrift(publishedBytes, localTarball, directory) {
  const publishedTarball = join(directory, 'published.tgz');
  await writeFile(publishedTarball, publishedBytes);
  const files = diffFileHashes(
    await unpack(publishedTarball, join(directory, 'published')),
    await unpack(localTarball, join(directory, 'local')),
  );
  return { files, tarOnly: files.length === 0 };
}

function assertIntegrity(bytes, metadata) {
  const expected = metadata.dist?.integrity;
  const actual = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  if (expected !== actual) {
    throw new Error(
      `${metadata.name}@${metadata.version} download does not match its registry integrity`,
    );
  }
}

const REQUEST_ATTEMPTS = 3;

/** A registry answer that retrying will not change, such as 403. */
class RegistryStatusError extends Error {}

/** A registry answer worth another attempt: 429 or 5xx. */
class RetryableStatusError extends Error {}

/**
 * Each attempt has its own timeout, and `read` consumes the body inside the
 * attempt, so a stalled connection or a body cut off part-way is retried. The
 * timer is a normal ref'd timeout, cleared once the body is read, so it fires
 * even when nothing else keeps the event loop alive.
 */
async function registryRequest(url, headers, registry, read) {
  const { fetchImpl, retryDelay, timeout } = registry;
  for (let attempt = 1; ; attempt += 1) {
    const controller = new globalThis.AbortController();
    const timer = setTimeout(
      () =>
        controller.abort(
          new globalThis.DOMException(
            `npm registry request timed out after ${timeout} ms`,
            'TimeoutError',
          ),
        ),
      timeout,
    );
    try {
      const response = await fetchImpl(url, {
        headers,
        signal: controller.signal,
      });
      if (response.status === 429 || response.status >= 500) {
        await response.body?.cancel().catch(() => {});
        throw new RetryableStatusError(
          `npm registry returned ${response.status} for ${url}`,
        );
      }
      return await read(response);
    } catch (error) {
      if (error instanceof RegistryStatusError) throw error;
      if (attempt === REQUEST_ATTEMPTS) {
        if (error instanceof RetryableStatusError) throw error;
        throw new Error(`npm registry request failed for ${url}`, {
          cause: error,
        });
      }
    } finally {
      clearTimeout(timer);
    }
    await delay(retryDelay);
  }
}

function fetchPublishedMetadata(packageInfo, registry) {
  const escapedName = packageInfo.name.replace('/', '%2f');
  return registryRequest(
    `${REGISTRY}/${escapedName}/${encodeURIComponent(packageInfo.version)}`,
    { accept: 'application/json' },
    registry,
    async (response) => {
      if (response.status === 404) return null;
      if (response.status !== 200) {
        throw new RegistryStatusError(
          `npm registry returned ${response.status} for ${packageInfo.name}@${packageInfo.version}`,
        );
      }
      return response.json();
    },
  );
}

function downloadTarball(url, registry) {
  return registryRequest(url, {}, registry, async (response) => {
    if (response.status !== 200) {
      throw new RegistryStatusError(
        `npm registry returned ${response.status} for ${url}`,
      );
    }
    return new Uint8Array(await response.arrayBuffer());
  });
}

function packLocal(directory, destination) {
  const output = run('pnpm', [
    '--dir',
    directory,
    'pack',
    '--pack-destination',
    destination,
    '--json',
  ]);
  const start = output.indexOf('{');
  if (start === -1) throw new Error(`pnpm pack did not return JSON:\n${output}`);
  const { filename } = JSON.parse(output.slice(start));
  return isAbsolute(filename) ? filename : join(destination, filename);
}

export async function verifyPublishedContents({
  root = ROOT,
  fetchImpl = globalThis.fetch,
  log = console.log,
  readPackages = async () => (await readReleaseInputs(root)).packages,
  readPlan = () => readVersioning(root),
  pack = packLocal,
  retryDelay = 2000,
  timeout = 30_000,
} = {}) {
  const registry = { fetchImpl, retryDelay, timeout };
  const packages = await readPackages();
  const { versioned, rewritten } = await readPlan();
  const workDirectory = await mkdtemp(join(tmpdir(), 'partrunner-published-'));
  const drifted = [];
  try {
    for (const packageInfo of packages) {
      const metadata = await fetchPublishedMetadata(packageInfo, registry);
      const decision = decideCheck(packageInfo, {
        published: metadata !== null,
        versioned,
      });
      const label = `${packageInfo.name}@${packageInfo.version}`;
      if (decision === 'unpublished') {
        log(`${label}: not published yet; nothing to compare`);
        continue;
      }
      if (decision === 'versioned') {
        log(`${label}: pending Changesets give it a new version; skipped`);
        continue;
      }

      const slug = packageInfo.name.replace('/', '-');
      const packageDirectory = join(workDirectory, slug);
      await mkdir(packageDirectory, { recursive: true });
      const publishedBytes = await downloadTarball(
        metadata.dist.tarball,
        registry,
      );
      assertIntegrity(publishedBytes, metadata);
      const localTarball = pack(join(root, packageInfo.directory), packageDirectory);
      const rewrittenBy = rewritten.get(packageInfo.name) ?? [];
      let status;
      let report = { files: [], tarOnly: false };
      try {
        try {
          status = compareTarballBytes(publishedBytes, await readFile(localTarball));
        } catch (error) {
          // The published stream is over the gunzip limit: it is far longer
          // than the rebuilt one, so it differs. Report it as drift.
          if (error?.code !== 'ERR_BUFFER_TOO_LARGE') throw error;
          status = 'drift';
        }
        if (status === 'drift') {
          report = await reportDrift(publishedBytes, localTarball, packageDirectory);
        }
      } catch (error) {
        throw new Error(`${label} could not be compared`, { cause: error });
      }
      if (rewrittenBy.length === 0) {
        if (status === 'identical') {
          log(`${label}: matches the published tarball`);
          continue;
        }
        if (status === 'devDependencies') {
          log(`${label}: matches the published tarball apart from devDependencies`);
          continue;
        }
      }
      drifted.push({ ...packageInfo, ...report, rewrittenBy });
    }
  } finally {
    await removeTree(workDirectory);
  }
  if (drifted.length > 0) throw new Error(formatDriftError(drifted));
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  try {
    await verifyPublishedContents();
  } catch (error) {
    console.error(describeError(error));
    process.exitCode = 1;
  }
}
