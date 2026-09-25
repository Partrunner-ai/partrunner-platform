import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { gunzipSync } from 'node:zlib';

import { assembleReleasePlan } from '@changesets/assemble-release-plan';
import { readConfig } from '@changesets/config';
import { readPreState } from '@changesets/pre';
import { readChangesets } from '@changesets/read';
import { getPackages } from '@manypkg/get-packages';

import { readReleaseInputs } from './release-plan.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'https://registry.npmjs.org';
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
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
        ? ['  modified: tar entry metadata (file modes or order)']
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
    'matches its rebuilt tarball, including devDependency-only package.json changes',
    'and CSS a package rebundles from tokens.',
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

async function hashTree(directory, base = directory, hashes = new Map()) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await hashTree(path, base, hashes);
    } else {
      hashes.set(
        relative(base, path).split('\\').join('/'),
        createHash('sha256').update(await readFile(path)).digest('hex'),
      );
    }
  }
  return hashes;
}

async function unpack(tarball, destination) {
  await mkdir(destination, { recursive: true });
  run('tar', ['-xzf', tarball, '-C', destination]);
  return hashTree(join(destination, 'package'));
}

/**
 * The gzip header records the packing OS, so compressed bytes differ between
 * macOS and Linux. The tar stream inside is deterministic.
 */
function tarStreamHash(bytes) {
  return createHash('sha256').update(gunzipSync(bytes)).digest('hex');
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

async function fetchWithRetry(url, options, fetchImpl, retryDelay) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetchImpl(url, options);
      if (response.status < 500 || attempt === 3) return response;
    } catch (error) {
      if (attempt === 3) {
        throw new Error(`npm registry request failed for ${url}`, {
          cause: error,
        });
      }
    }
    await delay(retryDelay);
  }
}

async function fetchPublishedMetadata(packageInfo, fetchImpl, retryDelay) {
  const escapedName = packageInfo.name.replace('/', '%2f');
  const response = await fetchWithRetry(
    `${REGISTRY}/${escapedName}/${encodeURIComponent(packageInfo.version)}`,
    { headers: { accept: 'application/json' } },
    fetchImpl,
    retryDelay,
  );
  if (response.status === 404) return null;
  if (response.status !== 200) {
    throw new Error(
      `npm registry returned ${response.status} for ${packageInfo.name}@${packageInfo.version}`,
    );
  }
  return response.json();
}

async function downloadTarball(url, fetchImpl, retryDelay) {
  const response = await fetchWithRetry(url, {}, fetchImpl, retryDelay);
  if (response.status !== 200) {
    throw new Error(`npm registry returned ${response.status} for ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
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
} = {}) {
  const packages = await readPackages();
  const { versioned, rewritten } = await readPlan();
  const workDirectory = await mkdtemp(join(tmpdir(), 'partrunner-published-'));
  const drifted = [];
  try {
    for (const packageInfo of packages) {
      const metadata = await fetchPublishedMetadata(
        packageInfo,
        fetchImpl,
        retryDelay,
      );
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
        fetchImpl,
        retryDelay,
      );
      assertIntegrity(publishedBytes, metadata);
      const localTarball = pack(join(root, packageInfo.directory), packageDirectory);
      const rewrittenBy = rewritten.get(packageInfo.name) ?? [];
      if (tarStreamHash(publishedBytes) === tarStreamHash(await readFile(localTarball))) {
        if (rewrittenBy.length === 0) {
          log(`${label}: matches the published tarball`);
        } else {
          drifted.push({ ...packageInfo, rewrittenBy });
        }
        continue;
      }

      const publishedTarball = join(packageDirectory, 'published.tgz');
      await writeFile(publishedTarball, publishedBytes);
      const files = diffFileHashes(
        await unpack(publishedTarball, join(packageDirectory, 'published')),
        await unpack(localTarball, join(packageDirectory, 'local')),
      );
      drifted.push({
        ...packageInfo,
        files,
        tarOnly: files.length === 0,
        rewrittenBy,
      });
    }
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
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
