import { Buffer } from 'node:buffer';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const field = (value, length) => {
  const bytes = Buffer.alloc(length);
  bytes.write(value);
  return bytes;
};

const octal = (value, length) =>
  Buffer.from(`${value.toString(8).padStart(length - 1, '0')}\0`);

/** The header block of one entry, written the way `pnpm pack` writes it. */
export function tarHeader({
  path,
  type = '0',
  size = 0,
  linkname = '',
  mode = 0o644,
  mtime = 0,
  uid = 0,
  prefix = '',
  magic = 'ustar\0',
}) {
  const header = Buffer.alloc(512);
  field(path, 100).copy(header, 0);
  octal(mode, 8).copy(header, 100);
  octal(uid, 8).copy(header, 108);
  octal(0, 8).copy(header, 116);
  Buffer.from(`${size.toString(8).padStart(11, '0')} `).copy(header, 124);
  octal(mtime, 12).copy(header, 136);
  header.fill(0x20, 148, 156);
  header.write(type, 156);
  field(linkname, 100).copy(header, 157);
  header.write(magic, 257, 6, 'latin1');
  header.write('00', 263);
  field(prefix, 155).copy(header, 345);
  const sum = header.reduce((total, byte) => total + byte, 0);
  header.write(`${sum.toString(8).padStart(6, '0')} \0`, 148);
  return header;
}

/**
 * Tar blocks written by hand, so the same bytes come out on macOS and Linux.
 * Each entry is `{ path, type, content, linkname, mode, mtime, uid, prefix,
 * magic }`. `type` is a tar type flag: '0' file (default), '5' directory, '1'
 * hard link, '2' symbolic link, '6' FIFO. `content` is text or a Buffer. A path
 * is written as given. Only a path of up to 100 bytes fits.
 */
export function tarBlocks(entries) {
  return Buffer.concat(
    entries.flatMap(({ content = '', ...entry }) => {
      const data = Buffer.from(content);
      return [
        tarHeader({ ...entry, size: data.length }),
        data,
        Buffer.alloc((512 - (data.length % 512)) % 512),
      ];
    }),
  );
}

/** A whole tar stream: the entries and the end-of-archive blocks. */
export const tarStream = (entries) =>
  Buffer.concat([tarBlocks(entries), Buffer.alloc(1024)]);

/** A gzipped tar stream written to `<directory>/<name>.tgz`. */
export async function buildRawTarball(directory, name, entries) {
  const file = join(directory, `${name}.tgz`);
  await writeFile(file, gzipSync(tarStream(entries)));
  return file;
}

const FIXED_MTIME = Date.parse('2026-01-01T00:00:00Z') / 1000;

/**
 * Build a small tarball of the shape `pnpm pack` writes, for tests.
 * - `files`: path inside `package/` to text, or to `{ content, mode }`;
 * - `dirs`: empty directories inside `package/`;
 * - `links`: path inside `package/` to a symbolic link target;
 * - `outside`: path beside `package/` to text (a top-level entry);
 * - `mtime`: the modification time of every entry, in seconds.
 */
export function buildTarball(
  directory,
  name,
  { files = {}, dirs = [], links = {}, outside = {}, mtime = FIXED_MTIME } = {},
) {
  const entries = [
    { path: 'package/', type: '5', mode: 0o755 },
    ...dirs.map((path) => ({ path: `package/${path}/`, type: '5', mode: 0o755 })),
    ...Object.entries(files).map(([path, value]) => {
      const { content, mode = 0o644 } =
        typeof value === 'string' ? { content: value } : value;
      return { path: `package/${path}`, content, mode };
    }),
    ...Object.entries(links).map(([path, linkname]) => ({
      path: `package/${path}`,
      type: '2',
      linkname,
    })),
    ...Object.entries(outside).map(([path, content]) => ({ path, content })),
  ].map((entry) => ({ mtime, ...entry }));
  return buildRawTarball(directory, name, entries);
}
