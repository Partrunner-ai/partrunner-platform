/**
 * Fleet-wide adoption audit — the entry `sales/tests/theme-adoption.test.mjs`
 * names. Thin wrapper over @partrunner-ai/adoption-check so the gates have one
 * implementation whether they run here, in an app's CI, or by hand. It imports
 * the built workspace package, so run `pnpm build` first:
 *
 *   node scripts/adoption-audit.mjs <app-dir> [<app-dir>…] [--allow-nexus-compat]
 */
import { resolve } from 'node:path';
import process from 'node:process';
import { auditApp } from '@partrunner-ai/adoption-check';

const args = process.argv.slice(2);
const dirs = args.filter((a) => !a.startsWith('--'));
if (dirs.length === 0) {
  console.error('usage: node scripts/adoption-audit.mjs <app-dir> [<app-dir>…] [--allow-nexus-compat]');
  process.exit(2);
}
const options = { allowNexusCompat: args.includes('--allow-nexus-compat') };

let failed = false;
for (const dir of dirs) {
  const root = resolve(dir);
  const { findings, scanned } = auditApp(root, options);
  if (findings.length === 0) {
    console.log(`✓ ${root} — ${scanned} files, all gates pass`);
    continue;
  }
  failed = true;
  console.error(`✗ ${root} — ${findings.length} finding(s):`);
  for (const { gate, file, line, message } of findings) {
    console.error(`  [${gate}] ${file}:${line} — ${message}`);
  }
}
process.exit(failed ? 1 : 0);
