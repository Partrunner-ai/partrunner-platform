import assert from 'node:assert/strict';
import { appendFile, readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'https://registry.npmjs.org';
const PACKAGE_DIRECTORIES = [
  'packages/adoption-check',
  'packages/api-core',
  'packages/app-registry',
  'packages/seamless',
  'packages/shell',
  'packages/tokens',
  'packages/ui',
];
export const APPROVED_INITIAL_RELEASES = Object.freeze({
  '@partrunner-ai/api-core': '1.0.0',
  '@partrunner-ai/app-registry': '1.3.0',
  '@partrunner-ai/seamless': '1.0.0',
  '@partrunner-ai/shell': '2.0.0',
  '@partrunner-ai/tokens': '2.0.0',
  '@partrunner-ai/ui': '2.0.0',
});
const INITIAL_RELEASE_LIMITATIONS = [
  'Public registry checks cannot detect restricted packages or unpublished historical versions.',
  'Authenticated organization inventory and provider-authoritative version history are required before publishing.',
];

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function isChangesetFile(file) {
  return (
    file.endsWith('.md') &&
    file !== 'README.md' &&
    !file.startsWith('.')
  );
}

export async function readReleaseInputs(root = ROOT) {
  const packages = await Promise.all(
    PACKAGE_DIRECTORIES.map(async (directory) => {
      const manifest = await readJson(join(root, directory, 'package.json'));
      return {
        directory,
        name: manifest.name,
        version: manifest.version,
      };
    }),
  );
  const changesets = (await readdir(join(root, '.changeset')))
    .filter(isChangesetFile)
    .sort();
  return { packages, changesets };
}

export async function inspectPublishedVersions(
  packages,
  fetchImpl = globalThis.fetch,
) {
  assert.equal(typeof fetchImpl, 'function', 'A fetch implementation is required');
  const results = [];
  for (const packageInfo of packages) {
    const escapedName = packageInfo.name.replace('/', '%2f');
    const response = await fetchImpl(
      `${REGISTRY}/${escapedName}/${encodeURIComponent(packageInfo.version)}`,
      { headers: { accept: 'application/json' } },
    );
    if (response.status === 200) {
      results.push({ ...packageInfo, published: true });
      continue;
    }
    if (response.status === 404) {
      results.push({ ...packageInfo, published: false });
      continue;
    }
    throw new Error(
      `npm registry returned ${response.status} for ${packageInfo.name}@${packageInfo.version}`,
    );
  }
  return results;
}

export async function inspectPublicPackageNamespaces(
  packages,
  fetchImpl = globalThis.fetch,
) {
  assert.equal(typeof fetchImpl, 'function', 'A fetch implementation is required');
  const results = [];
  for (const packageInfo of packages) {
    const escapedName = packageInfo.name.replace('/', '%2f');
    const response = await fetchImpl(`${REGISTRY}/${escapedName}`, {
      headers: { accept: 'application/json' },
    });
    if (response.status === 404) {
      results.push({
        ...packageInfo,
        publicRegistryEmpty: true,
        publiclyVisibleVersions: 0,
      });
      continue;
    }
    if (response.status !== 200) {
      throw new Error(
        `npm registry returned ${response.status} for ${packageInfo.name}`,
      );
    }

    const packument = await response.json();
    if (
      !packument ||
      typeof packument !== 'object' ||
      !packument.versions ||
      typeof packument.versions !== 'object' ||
      Array.isArray(packument.versions)
    ) {
      throw new Error(
        `npm registry returned a malformed packument for ${packageInfo.name}`,
      );
    }
    const publiclyVisibleVersions = Object.keys(packument.versions).length;
    results.push({
      ...packageInfo,
      publicRegistryEmpty: publiclyVisibleVersions === 0,
      publiclyVisibleVersions,
    });
  }
  return results;
}

export function assertApprovedInitialRelease(packages) {
  const actual = packages
    .map((packageInfo) => `${packageInfo.name}@${packageInfo.version}`)
    .sort();
  const approved = Object.entries(APPROVED_INITIAL_RELEASES)
    .map(([name, version]) => `${name}@${version}`)
    .sort();
  if (
    actual.length !== approved.length ||
    actual.some((packageVersion, index) => packageVersion !== approved[index])
  ) {
    throw new Error(
      `Initial npm release matrix mismatch: expected ${approved.join(', ')}; ` +
        `received ${actual.join(', ')}`,
    );
  }
}

export function assertInitialReleasePreflight(packages, namespaces) {
  assertApprovedInitialRelease(packages);
  assertApprovedInitialRelease(namespaces);
  const publishedCurrentVersions = packages
    .filter((packageInfo) => packageInfo.published)
    .map((packageInfo) => `${packageInfo.name}@${packageInfo.version}`);
  const publiclyVisiblePackages = namespaces
    .filter((packageInfo) => !packageInfo.publicRegistryEmpty)
    .map(
      (packageInfo) =>
        `${packageInfo.name} (${packageInfo.publiclyVisibleVersions} visible version(s))`,
    );

  if (
    publishedCurrentVersions.length > 0 ||
    publiclyVisiblePackages.length > 0
  ) {
    const details = [
      publishedCurrentVersions.length > 0
        ? `current versions already published: ${publishedCurrentVersions.join(', ')}`
        : null,
      publiclyVisiblePackages.length > 0
        ? `packages already visible in the public registry: ${publiclyVisiblePackages.join(', ')}`
        : null,
    ].filter(Boolean);
    throw new Error(`Initial npm release preflight failed: ${details.join('; ')}`);
  }
}

export function decideReleaseMode(changesets, packages) {
  const unpublished = packages.filter((packageInfo) => !packageInfo.published);
  if (changesets.length > 0 && unpublished.length > 0) {
    throw new Error(
      `Release state is ambiguous: ${changesets.length} Changeset(s) exist while ` +
        `${unpublished.length} current package version(s) remain unpublished`,
    );
  }
  if (changesets.length > 0) return 'version';
  if (unpublished.length > 0) return 'publish';
  return 'none';
}

async function writeGitHubOutputs(path, plan) {
  if (!path) return;
  const unpublished = plan.packages
    .filter((packageInfo) => !packageInfo.published)
    .map((packageInfo) => `${packageInfo.name}@${packageInfo.version}`);
  await appendFile(
    path,
    [
      `mode=${plan.mode}`,
      `has_changesets=${String(plan.changesets.length > 0)}`,
      `has_unpublished=${String(unpublished.length > 0)}`,
      `unpublished=${JSON.stringify(unpublished)}`,
      '',
    ].join('\n'),
  );
}

export async function createReleasePlan({
  root = ROOT,
  fetchImpl = globalThis.fetch,
  githubOutput = process.env.GITHUB_OUTPUT,
  initialReleasePreflight = false,
} = {}) {
  const inputs = await readReleaseInputs(root);
  const packages = await inspectPublishedVersions(inputs.packages, fetchImpl);
  const publicNamespaces = initialReleasePreflight
    ? await inspectPublicPackageNamespaces(inputs.packages, fetchImpl)
    : null;
  if (publicNamespaces) {
    assertInitialReleasePreflight(packages, publicNamespaces);
  }
  const plan = {
    mode: decideReleaseMode(inputs.changesets, packages),
    changesets: inputs.changesets,
    packages,
    ...(publicNamespaces
      ? {
          publicNamespaces,
          limitations: INITIAL_RELEASE_LIMITATIONS,
        }
      : {}),
  };
  await writeGitHubOutputs(githubOutput, plan);
  return plan;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  const args = process.argv.slice(2);
  const unknownArgs = args.filter(
    (arg) => arg !== '--initial-release-preflight',
  );
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown argument(s): ${unknownArgs.join(', ')}`);
  }
  const plan = await createReleasePlan({
    initialReleasePreflight: args.includes('--initial-release-preflight'),
  });
  console.log(JSON.stringify(plan, null, 2));
}
