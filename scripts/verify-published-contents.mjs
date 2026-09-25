import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { isChangesetFile, readReleaseInputs } from './release-plan.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'https://registry.npmjs.org';

/** Package names listed in a Changeset's frontmatter. */
export function changesetPackageNames(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!match) return [];
  return match[1]
    .split(/\r?\n/)
    .map((line) => /^\s*['"]?([^'":]+)['"]?\s*:/.exec(line)?.[1]?.trim())
    .filter(Boolean);
}

export async function readPendingChangesetPackages(root = ROOT) {
  const directory = join(root, '.changeset');
  const names = new Set();
  for (const file of (await readdir(directory)).filter(isChangesetFile)) {
    for (const name of changesetPackageNames(
      await readFile(join(directory, file), 'utf8'),
    )) {
      names.add(name);
    }
  }
  return names;
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
 * A published version is immutable, so its contents may only change together
 * with a pending Changeset that will give the package a new version.
 */
export function decideCheck(packageInfo, { published, pendingPackages }) {
  if (!published) return 'unpublished';
  if (pendingPackages.has(packageInfo.name)) return 'pending-changeset';
  return 'compare';
}

export function formatDriftError(drifted) {
  const lines = drifted.flatMap(({ name, version, files }) => [
    `${name}@${version} is already published, but its packed contents changed:`,
    ...files.map(({ path, change }) => `  ${change}: ${path}`),
  ]);
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

async function fetchPublishedMetadata(packageInfo, fetchImpl) {
  const escapedName = packageInfo.name.replace('/', '%2f');
  const response = await fetchImpl(
    `${REGISTRY}/${escapedName}/${encodeURIComponent(packageInfo.version)}`,
    { headers: { accept: 'application/json' } },
  );
  if (response.status === 404) return null;
  if (response.status !== 200) {
    throw new Error(
      `npm registry returned ${response.status} for ${packageInfo.name}@${packageInfo.version}`,
    );
  }
  return response.json();
}

async function downloadTarball(url, destination, fetchImpl) {
  const response = await fetchImpl(url);
  if (response.status !== 200) {
    throw new Error(`npm registry returned ${response.status} for ${url}`);
  }
  await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
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
  const { filename } = JSON.parse(output.slice(output.indexOf('{')));
  return isAbsolute(filename) ? filename : join(destination, filename);
}

export async function verifyPublishedContents({
  root = ROOT,
  fetchImpl = globalThis.fetch,
  log = console.log,
} = {}) {
  const { packages } = await readReleaseInputs(root);
  const pendingPackages = await readPendingChangesetPackages(root);
  const workDirectory = await mkdtemp(join(tmpdir(), 'partrunner-published-'));
  const drifted = [];
  try {
    for (const packageInfo of packages) {
      const metadata = await fetchPublishedMetadata(packageInfo, fetchImpl);
      const decision = decideCheck(packageInfo, {
        published: metadata !== null,
        pendingPackages,
      });
      const label = `${packageInfo.name}@${packageInfo.version}`;
      if (decision === 'unpublished') {
        log(`${label}: not published yet; nothing to compare`);
        continue;
      }
      if (decision === 'pending-changeset') {
        log(`${label}: a pending Changeset will version it; skipped`);
        continue;
      }

      const slug = packageInfo.name.replace('/', '-');
      const packageDirectory = join(workDirectory, slug);
      await mkdir(packageDirectory, { recursive: true });
      const publishedTarball = join(packageDirectory, 'published.tgz');
      await downloadTarball(metadata.dist.tarball, publishedTarball, fetchImpl);
      const files = diffFileHashes(
        await unpack(publishedTarball, join(packageDirectory, 'published')),
        await unpack(
          packLocal(join(root, packageInfo.directory), packageDirectory),
          join(packageDirectory, 'local'),
        ),
      );
      if (files.length === 0) {
        log(`${label}: matches the published tarball`);
      } else {
        drifted.push({ ...packageInfo, files });
      }
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
    console.error(error.message);
    process.exitCode = 1;
  }
}
