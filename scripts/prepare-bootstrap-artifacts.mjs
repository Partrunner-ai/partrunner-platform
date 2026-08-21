import assert from 'node:assert/strict';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: options.stdio ?? 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
  return result.stdout ?? '';
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export function resolveArtifactOutput(value) {
  assert(value && !isAbsolute(value), 'Output must be repository-relative');
  const target = resolve(ROOT, value);
  const pathFromRoot = relative(ROOT, target);
  assert(
    pathFromRoot.startsWith('.artifacts/') &&
      !pathFromRoot.includes('\\'),
    'Output must be inside .artifacts/',
  );
  return target;
}

export async function prepareBootstrapArtifacts(
  value = '.artifacts/npm-bootstrap',
) {
  assert.equal(
    run(
      'git',
      ['status', '--porcelain=v1', '--untracked-files=all'],
      { stdio: 'pipe' },
    ).trim(),
    '',
    'Bootstrap artifacts require a clean committed worktree',
  );
  const destination = resolveArtifactOutput(value);
  assert(
    !(await pathExists(destination)),
    'Bootstrap artifact destination already exists',
  );

  const sourceCommit = run('git', ['rev-parse', 'HEAD'], {
    stdio: 'pipe',
  }).trim();
  const sourceTree = run('git', ['rev-parse', 'HEAD^{tree}'], {
    stdio: 'pipe',
  }).trim();
  const temporaryRoot = await mkdtemp(
    join(tmpdir(), 'partrunner-bootstrap-artifacts-'),
  );
  const checkout = join(temporaryRoot, 'source');
  let worktreeAdded = false;

  try {
    run('git', ['worktree', 'add', '--detach', checkout, sourceCommit]);
    worktreeAdded = true;
    run('pnpm', ['install', '--frozen-lockfile'], { cwd: checkout });
    run('pnpm', ['build'], { cwd: checkout });
    run('pnpm', ['packages:check'], {
      cwd: checkout,
      env: {
        ...process.env,
        PARTRUNNER_ARTIFACT_OUTPUT_DIR:
          '.artifacts/npm-bootstrap',
      },
    });

    const retained = join(
      checkout,
      '.artifacts',
      'npm-bootstrap',
    );
    const manifest = JSON.parse(
      await readFile(join(retained, 'manifest.json'), 'utf8'),
    );
    assert.equal(manifest.source?.commit, sourceCommit);
    assert.equal(manifest.source?.tree, sourceTree);
    await mkdir(dirname(destination), { recursive: true });
    await cp(retained, destination, {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    console.log(
      `Prepared bootstrap artifacts in ${relative(ROOT, destination)}`,
    );
  } finally {
    if (worktreeAdded) {
      run('git', ['worktree', 'remove', '--force', checkout]);
    }
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await prepareBootstrapArtifacts(process.argv[2]);
}
