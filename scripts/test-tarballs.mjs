import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, readdir, symlink, utimes, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * `tar -czf` for tests. COPYFILE_DISABLE keeps bsdtar on macOS from adding
 * AppleDouble `._` entries for extended attributes.
 */
export function packDirectory(file, source, names) {
  execFileSync('tar', ['-czf', file, '-C', source, ...names], {
    env: { ...process.env, COPYFILE_DISABLE: '1' },
  });
}

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
  packDirectory(file, source, names);
  return file;
}

const field = (value, length) => {
  const bytes = Buffer.alloc(length);
  bytes.write(value);
  return bytes;
};

const octal = (value, length) =>
  Buffer.from(`${value.toString(8).padStart(length - 1, '0')}\0`);

/**
 * Write a gzipped tar stream by hand, so the same bytes come out on macOS and
 * Linux. Each entry is `{ path, type, content, linkname, mode }`. `type` is a
 * tar type flag: '0' file (default), '5' directory, '1' hard link, '2' symbolic
 * link, '6' FIFO. A path is written as given, so `..` and absolute paths work.
 * Only a path of up to 100 bytes fits.
 */
export async function buildRawTarball(directory, name, entries) {
  const blocks = [];
  for (const entry of entries) {
    const { path, type = '0', content = '', linkname = '', mode = 0o644 } = entry;
    const data = Buffer.from(content);
    const header = Buffer.alloc(512);
    field(path, 100).copy(header, 0);
    octal(mode, 8).copy(header, 100);
    octal(0, 8).copy(header, 108);
    octal(0, 8).copy(header, 116);
    octal(data.length, 12).copy(header, 124);
    octal(0, 12).copy(header, 136);
    header.fill(0x20, 148, 156);
    header.write(type, 156);
    field(linkname, 100).copy(header, 157);
    header.write('ustar\0', 257);
    header.write('00', 263);
    const sum = header.reduce((total, byte) => total + byte, 0);
    octal(sum, 7).copy(header, 148);
    header[155] = 0x20;
    blocks.push(header, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  const file = join(directory, `${name}.tgz`);
  await writeFile(file, gzipSync(Buffer.concat(blocks)));
  return file;
}
