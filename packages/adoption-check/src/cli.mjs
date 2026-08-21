#!/usr/bin/env node
/**
 * pr-adoption-check [dir] [--allow-nexus-compat] [--min-ui-major N]
 *
 * Runs the adoption gates against a consuming app and reports every fork of
 * the design-system contract with file:line. Exits non-zero on findings, so a
 * CI step fails on the PR that introduces the fork instead of the next audit.
 */
import { resolve } from 'node:path';
import process from 'node:process';
import { auditApp } from './audit.mjs';

const args = process.argv.slice(2);
const dir = resolve(args.find((a) => !a.startsWith('--')) ?? '.');
const options = {
  allowNexusCompat: args.includes('--allow-nexus-compat'),
};
const minIdx = args.indexOf('--min-ui-major');
if (minIdx !== -1) options.minUiMajor = Number(args[minIdx + 1]);

const { findings, scanned } = auditApp(dir, options);

if (findings.length === 0) {
  console.log(`adoption-check: ${scanned} files scanned, all gates pass — no design-system forks.`);
  process.exit(0);
}

const byGate = new Map();
for (const finding of findings) {
  if (!byGate.has(finding.gate)) byGate.set(finding.gate, []);
  byGate.get(finding.gate).push(finding);
}

console.error(`adoption-check: ${findings.length} finding(s) across ${byGate.size} gate(s) in ${dir}\n`);
for (const [gate, list] of byGate) {
  console.error(`■ ${gate}`);
  for (const { file, line, message } of list) {
    console.error(`  ${file}:${line} — ${message}`);
  }
  console.error('');
}
process.exit(1);
