import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'https://registry.npmjs.org';
const REQUIRED_NPM_VERSION = '11.15.0';
export const PUBLISH_ORDER = [
  '@partrunner-ai/adoption-check',
  '@partrunner-ai/app-registry',
  '@partrunner-ai/tokens',
  '@partrunner-ai/api-core',
  '@partrunner-ai/seamless',
  '@partrunner-ai/shell',
  '@partrunner-ai/ui',
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: options.stdio ?? 'pipe',
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n')
      .trim();
    throw new Error(
      `${command} ${args.join(' ')} failed${detail ? `:\n${detail}` : ''}`,
    );
  }
  return result.stdout;
}

export function verifyPublisherEnvironment(
  environment,
  npmVersion,
  sourceCommit,
) {
  assert.equal(
    environment.GITHUB_ACTIONS,
    'true',
    'Publishing is restricted to GitHub Actions',
  );
  assert.equal(
    environment.GITHUB_REPOSITORY,
    'Partrunner-ai/partrunner-platform',
    'Publishing is restricted to the public repository',
  );
  assert.equal(
    environment.GITHUB_REF,
    'refs/heads/main',
    'Publishing is restricted to main',
  );
  assert.equal(
    environment.GITHUB_SHA,
    sourceCommit,
    'Workflow SHA must match the retained artifact source',
  );
  assert.equal(
    environment.PARTRUNNER_RELEASE_ENABLED,
    'true',
    'Publishing requires the explicit release variable',
  );
  assert(
    environment.ACTIONS_ID_TOKEN_REQUEST_URL &&
      environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
    'Publishing requires a GitHub OIDC token request',
  );
  assert.equal(
    environment.NODE_AUTH_TOKEN,
    undefined,
    'NODE_AUTH_TOKEN must not be present during OIDC publishing',
  );
  assert.equal(
    environment.NPM_TOKEN,
    undefined,
    'NPM_TOKEN must not be present during OIDC publishing',
  );
  assert.equal(
    npmVersion,
    REQUIRED_NPM_VERSION,
    `Publishing requires npm ${REQUIRED_NPM_VERSION}`,
  );
}

function registryUrl(packageInfo) {
  return `${REGISTRY}/${packageInfo.name.replace('/', '%2f')}/${encodeURIComponent(packageInfo.version)}`;
}

export function verifyRegistryIntegrity(packageInfo, metadata) {
  assert.equal(
    metadata?.dist?.integrity,
    packageInfo.integrity,
    `${packageInfo.name}@${packageInfo.version} registry integrity does not match the retained tarball`,
  );
}

async function registryVersion(packageInfo, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(registryUrl(packageInfo), {
    headers: { accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (response.status !== 200) {
    throw new Error(
      `npm registry returned ${response.status} for ${packageInfo.name}@${packageInfo.version}`,
    );
  }
  return response.json();
}

async function waitForRegistry(packageInfo, fetchImpl) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const metadata = await registryVersion(packageInfo, fetchImpl);
    if (metadata) return metadata;
    await delay(5000);
  }
  throw new Error(
    `${packageInfo.name}@${packageInfo.version} did not appear on npm after publication`,
  );
}

export async function readVerifiedManifest(
  directory,
  {
    gitCommit = () => run('git', ['rev-parse', 'HEAD']).trim(),
    gitTree = () => run('git', ['rev-parse', 'HEAD^{tree}']).trim(),
    gitStatus = () =>
      run('git', [
        'status',
        '--porcelain=v1',
        '--untracked-files=all',
      ]).trim(),
  } = {},
) {
  assert.equal(
    gitStatus(),
    '',
    'Publishing requires a clean committed worktree',
  );
  const manifest = JSON.parse(
    await readFile(join(directory, 'manifest.json'), 'utf8'),
  );
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.source?.commit, gitCommit());
  assert.equal(manifest.source?.tree, gitTree());
  assert.deepEqual(
    [...manifest.packages].map((packageInfo) => packageInfo.name).sort(),
    [...PUBLISH_ORDER].sort(),
  );

  for (const packageInfo of manifest.packages) {
    assert.equal(
      basename(packageInfo.filename),
      packageInfo.filename,
      'Artifact filename must not contain a path',
    );
    const bytes = await readFile(join(directory, packageInfo.filename));
    assert.equal(bytes.byteLength, packageInfo.bytes);
    assert.equal(
      `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
      packageInfo.integrity,
      `${packageInfo.name} retained artifact digest is invalid`,
    );
  }
  return manifest;
}

export async function publishVerifiedArtifacts(
  directory,
  {
    environment = process.env,
    fetchImpl = globalThis.fetch,
    readManifest = readVerifiedManifest,
    readNpmVersion = () => run('npm', ['--version']).trim(),
    lookup = (packageInfo) =>
      registryVersion(packageInfo, fetchImpl),
    waitForPublished = (packageInfo) =>
      waitForRegistry(packageInfo, fetchImpl),
    log = console.log,
    publish = (tarball) =>
      run(
        'npm',
        [
          'publish',
          tarball,
          '--access',
          'public',
          '--registry',
          REGISTRY,
        ],
        { env: environment, stdio: 'inherit' },
      ),
  } = {},
) {
  const manifest = await readManifest(directory);
  const npmVersion = readNpmVersion();
  verifyPublisherEnvironment(
    environment,
    npmVersion,
    manifest.source.commit,
  );
  const packages = new Map(
    manifest.packages.map((packageInfo) => [
      packageInfo.name,
      packageInfo,
    ]),
  );
  const missing = [];

  for (const name of PUBLISH_ORDER) {
    const packageInfo = packages.get(name);
    const existing = await lookup(packageInfo);
    if (existing) {
      verifyRegistryIntegrity(packageInfo, existing);
      log(
        `Preflight verified existing ${packageInfo.name}@${packageInfo.version}`,
      );
      continue;
    }
    missing.push(packageInfo);
  }

  for (const packageInfo of missing) {
    publish(join(directory, packageInfo.filename));
    const published = await waitForPublished(packageInfo);
    verifyRegistryIntegrity(packageInfo, published);
    log(`Published ${packageInfo.name}@${packageInfo.version}`);
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  const directory = resolve(ROOT, process.argv[2] ?? '.artifacts/release');
  await publishVerifiedArtifacts(directory);
}
