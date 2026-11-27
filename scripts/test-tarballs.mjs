import { execFileSync } from 'node:child_process';
import { chmod, mkdir, readdir, symlink, utimes, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const FIXED_TIME = new Date('2026-01-01T00:00:00Z');

/**
 * Build a small real tarball with `tar`, for tests.
 * - `files`: path inside `package/` to text, or to `{ content, mode }`;
 * - `dirs`: empty directories inside `package/`;
 * - `links`: path inside `package/` to a link target (written as is);
 * - `outside`: path beside `package/` to text (a top-level entry).
 */
export async function buildTarball(
  directory,
  name,
  { files = {}, dirs = [], links = {}, outside = {}, time = FIXED_TIME } = {},
) {
  const source = join(directory, `${name}-source`);
  await mkdir(join(source, 'package'), { recursive: true });
  for (const [path, value] of Object.entries(files)) {
    const { content, mode = 0o644 } =
      typeof value === 'string' ? { content: value } : value;
    const target = join(source, 'package', path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    await chmod(target, mode);
    await utimes(target, time, time);
  }
  for (const path of dirs) {
    await mkdir(join(source, 'package', path), { recursive: true });
  }
  for (const [path, target] of Object.entries(links)) {
    await symlink(target, join(source, 'package', path));
  }
  for (const [path, content] of Object.entries(outside)) {
    const target = join(source, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    await utimes(target, time, time);
  }
  const file = join(directory, `${name}.tgz`);
  const names = await readdir(source);
  execFileSync('tar', ['-czf', file, '-C', source, ...names]);
  return file;
}
