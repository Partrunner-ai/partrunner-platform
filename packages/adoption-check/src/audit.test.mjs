import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { auditApp } from './audit.mjs';

function makeApp(files) {
  const root = mkdtempSync(join(tmpdir(), 'adoption-'));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

const CLEAN_APP = {
  'package.json': JSON.stringify({
    dependencies: {
      '@partrunner-ai/ui': '^2.0.0',
      '@partrunner-ai/shell': '^2.0.0',
    },
  }),
  'app/layout.tsx': [
    "import '@partrunner-ai/ui/theme.css';",
    "import '@partrunner-ai/shell/shell.css';",
    'export default function Layout() { return null; }',
  ].join('\n'),
  'app/globals.css': [
    ':root {',
    '  /* aliases read the package tokens; #FDD238 in a comment is fine */',
    '  --app-canvas: var(--pr-bg);',
    '  --app-accent: var(--pr-accent);',
    '}',
  ].join('\n'),
};

test('a canonical app passes every gate', () => {
  const root = makeApp(CLEAN_APP);
  const { findings } = auditApp(root);
  assert.deepEqual(findings, []);
  rmSync(root, { recursive: true, force: true });
});

test('declaring a package variable trips the namespace gate', () => {
  const root = makeApp({
    ...CLEAN_APP,
    'app/globals.css': ':root { --pr-accent: #123456; }',
  });
  const { findings } = auditApp(root);
  assert.ok(findings.some((f) => f.gate === 'namespace' && f.file === 'app/globals.css'));
  rmSync(root, { recursive: true, force: true });
});

test('restating the official palette or a retired hex trips the palette gate', () => {
  const root = makeApp({
    ...CLEAN_APP,
    'app/theme.css': '.hero { background: #FDD238; color: #14142B; }',
  });
  const { findings } = auditApp(root);
  const palette = findings.filter((f) => f.gate === 'palette');
  assert.ok(palette.some((f) => f.message.includes('#fdd238')));
  assert.ok(palette.some((f) => f.message.includes('#14142b') && f.message.includes('retired')));
  rmSync(root, { recursive: true, force: true });
});

test('zero or two theme bundles trips the bundle gate; nexus needs the compat flag', () => {
  const none = makeApp({ ...CLEAN_APP, 'app/layout.tsx': 'export default 1;' });
  assert.ok(auditApp(none).findings.some((f) => f.gate === 'bundle'));
  rmSync(none, { recursive: true, force: true });

  const both = makeApp({
    ...CLEAN_APP,
    'app/extra.css': "@import '@partrunner-ai/ui/light.css';",
  });
  assert.ok(auditApp(both).findings.some((f) => f.gate === 'bundle'));
  rmSync(both, { recursive: true, force: true });

  const nexus = makeApp({
    ...CLEAN_APP,
    'app/compat.css': "@import '@partrunner-ai/tokens/nexus.css';",
  });
  assert.ok(auditApp(nexus).findings.some((f) => f.gate === 'bundle'));
  assert.equal(
    auditApp(nexus, { allowNexusCompat: true }).findings.filter((f) => f.gate === 'bundle').length,
    0,
  );
  rmSync(nexus, { recursive: true, force: true });
});

test('duplicated brand fonts trip the fonts gate', () => {
  const root = makeApp({
    ...CLEAN_APP,
    'app/head.html':
      '<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400" rel="stylesheet">',
  });
  assert.ok(auditApp(root).findings.some((f) => f.gate === 'fonts'));
  rmSync(root, { recursive: true, force: true });
});

test('styling package internals trips the internals gate', () => {
  const root = makeApp({
    ...CLEAN_APP,
    'app/repair.css': '.pr-btn--primary { border-radius: 2px; }',
  });
  assert.ok(auditApp(root).findings.some((f) => f.gate === 'internals'));
  rmSync(root, { recursive: true, force: true });
});

test('exact pins and pre-2.0 ranges trip the versions gate', () => {
  const pinned = makeApp({
    ...CLEAN_APP,
    'package.json': JSON.stringify({
      dependencies: { '@partrunner-ai/ui': '1.19.5' },
    }),
  });
  const findings = auditApp(pinned).findings.filter((f) => f.gate === 'versions');
  assert.ok(findings.some((f) => f.message.includes('pinned')));
  assert.ok(findings.some((f) => f.message.includes('adoption floor')));
  rmSync(pinned, { recursive: true, force: true });
});

test('a duplicated Tailwind palette trips the tailwind gate', () => {
  const root = makeApp({
    ...CLEAN_APP,
    'tailwind.config.js':
      "import { channelsPreset } from '@partrunner-ai/tokens';\n" +
      "export default { presets: [channelsPreset], theme: { extend: { colors: { partrunner: { yellow: 'x' } } } } };",
  });
  assert.ok(auditApp(root).findings.some((f) => f.gate === 'tailwind'));
  rmSync(root, { recursive: true, force: true });
});

test('the allowFiles config exempts a named file, nothing else', () => {
  const root = makeApp({
    ...CLEAN_APP,
    '.partrunner/adoption.json': JSON.stringify({ allowFiles: ['emails/branded.css'] }),
    'emails/branded.css': '.mail { background: #FDD238; }',
    'app/stray.css': '.x { color: #1A1A1A; }',
  });
  const { findings } = auditApp(root);
  assert.equal(findings.filter((f) => f.file === 'emails/branded.css').length, 0);
  assert.ok(findings.some((f) => f.file === 'app/stray.css'));
  rmSync(root, { recursive: true, force: true });
});
