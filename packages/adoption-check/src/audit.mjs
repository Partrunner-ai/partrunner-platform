/**
 * @partrunner-ai/adoption-check — the design-system adoption gates.
 *
 * A gate failing is not "less adopted" — it is a FORK: the app has started
 * redefining something the packages own, and from then on the two drift
 * silently because nothing errors. These are the six gates sales encoded in
 * `tests/theme-adoption.test.mjs`, productized fleet-wide, plus the gates the
 * 2.0 migration added (deprecated hex, duplicated fonts, duplicated Tailwind
 * palettes, exact pins).
 *
 * Pure Node, no dependencies. `auditApp(rootDir, options)` returns findings;
 * the CLI turns them into a report and an exit code.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

/** Directories never worth scanning. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '.vercel',
  'dist',
  'build',
  'out',
  'coverage',
  'test-results',
  '.artifacts',
  'vendor',
]);

const SOURCE_EXTS = new Set(['.css', '.scss', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.html']);

/** Hex the identity retired; nothing may paint them, ever. */
const DEPRECATED_HEX = ['#ffc107', '#ffd840', '#14142b'];

/**
 * The official palette. Apps must reach these THROUGH tokens; restating the hex
 * is the seed of every divergent vendored copy this gate exists to prevent.
 *
 * Only hex a `--pr-*` token actually provides belong here: policing a value the
 * contract offers no alternative for (charcoal #2d2d2d, gray-paper #f0f2f7,
 * bg-soft #f4f6fb) would leave apps no compliant move.
 */
const PALETTE_HEX = [
  '#fdd238',
  '#ffe573',
  '#f0bc00',
  '#ecb800',
  '#f5c420',
  '#d69e00',
  '#fff6d1',
  '#fffbeb',
  '#1a1a1a',
  '#e5e7ee',
  '#fafbfd',
];

const BRAND_FONT_PATTERN = /barlow|bebas[\s_+-]?neue/i;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') && entry !== '.partrunner') continue;
    const full = join(dir, entry);
    let info;
    try {
      info = statSync(full);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(full, files);
    } else if (SOURCE_EXTS.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

/** Comments explain the rules; they are not violations of them. */
function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^([ \t]*)\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '));
}

function findLines(source, regex, mapper) {
  const findings = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(regex);
    if (match) findings.push(mapper(i + 1, match, lines[i]));
  }
  return findings;
}

function loadConfig(rootDir) {
  const configPath = join(rootDir, '.partrunner', 'adoption.json');
  if (!existsSync(configPath)) return {};
  return JSON.parse(readFileSync(configPath, 'utf8'));
}

/**
 * @param {string} rootDir absolute path of the consuming app
 * @param {{allowNexusCompat?: boolean, minUiMajor?: number}} [options]
 * @returns {{findings: Array<{gate: string, file: string, line: number, message: string}>, scanned: number}}
 */
export function auditApp(rootDir, options = {}) {
  const config = { ...loadConfig(rootDir), ...options };
  const allowFiles = new Set(config.allowFiles ?? []);
  const findings = [];
  const push = (gate, file, line, message) => {
    const rel = relative(rootDir, file);
    if (allowFiles.has(rel)) return;
    findings.push({ gate, file: rel, line, message });
  };

  const files = walk(rootDir);
  const packageJsonPath = join(rootDir, 'package.json');
  const pkg = existsSync(packageJsonPath)
    ? JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    : {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const usesPackages = Object.keys(deps).some((name) => name.startsWith('@partrunner-ai/'));

  let themeBundleImports = 0;

  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    const source = withoutComments(raw);
    const ext = extname(file);

    // Gate 1 — the --pr-* namespace belongs to the packages.
    if (ext === '.css' || ext === '.scss') {
      // Start-of-line or after `{`/`;` — never after `(`, so `var(--pr-x)`
      // reads (allowed) while `--pr-x:` declares (forbidden).
      for (const f of findLines(
        source,
        /(?:^|[{;])\s*(--pr-(?:ch-)?[a-z0-9-]+)\s*:/i,
        (line, match) => ({ line, name: match[1] }),
      )) {
        push('namespace', file, f.line, `declares ${f.name} — the --pr-* namespace is package-owned; alias it instead (--app-x: var(${f.name}))`);
      }
    } else {
      for (const f of findLines(
        source,
        /setProperty\(\s*['"`](--pr-[a-z0-9-]+)|['"`](--pr-[a-z0-9-]+)['"`]\s*:/i,
        (line, match) => ({ line, name: match[1] ?? match[2] }),
      )) {
        push('namespace', file, f.line, `sets ${f.name} from code — the --pr-* namespace is package-owned`);
      }
    }

    // Gate 2 — one complete bundle, no compat mixes.
    const bundleHits = source.match(/@partrunner-ai\/ui\/(?:theme|light)\.css/g) ?? [];
    themeBundleImports += bundleHits.length;
    if (/@partrunner-ai\/shell\/styles\.css/.test(source)) {
      push('bundle', file, 1, 'imports the legacy shell/styles.css bundle (repeats its own theme); use shell/shell.css beside a ui bundle');
    }
    if (!config.allowNexusCompat && /@partrunner-ai\/tokens\/nexus(?:-light)?\.css/.test(source)) {
      push('bundle', file, 1, 'imports the deprecated nexus theme; Crystal v2 is the default — drop the import (or set allowNexusCompat during a staged migration)');
    }

    // Gate 3 — no restated palette.
    const lower = source.toLowerCase();
    for (const hex of DEPRECATED_HEX) {
      if (lower.includes(hex)) {
        const line = lower.split('\n').findIndex((l) => l.includes(hex)) + 1;
        push('palette', file, line, `uses retired brand hex ${hex} — deprecated by the identity, no token maps to it`);
      }
    }
    for (const hex of PALETTE_HEX) {
      if (lower.includes(hex)) {
        const line = lower.split('\n').findIndex((l) => l.includes(hex)) + 1;
        push('palette', file, line, `restates official palette hex ${hex} — read it through its --pr-* token`);
      }
    }

    // Gate 4 — the bundles self-host the brand fonts.
    if (/fonts\.googleapis\.com[^\n]*(?:barlow|bebas|inter)/i.test(source)) {
      const line = findLines(source, /fonts\.googleapis\.com/i, (l) => ({ line: l }))[0]?.line ?? 1;
      push('fonts', file, line, 'loads brand/UI fonts from Google Fonts — the ui bundles self-host Barlow and Bebas Neue');
    }
    if (/next\/font\/google/.test(source) && BRAND_FONT_PATTERN.test(source)) {
      push('fonts', file, 1, 'loads Barlow/Bebas via next/font — the ui bundles already self-host them');
    }

    // Gate 6 — no repairing package internals.
    if (ext === '.css' || ext === '.scss') {
      for (const f of findLines(
        source,
        /^(?![ \t]*@)[^{}]*\.pr-[a-z][^{}]*\{/,
        (line, _m, text) => ({ line, text: text.trim().slice(0, 60) }),
      )) {
        push('internals', file, f.line, `styles a package internal (${f.text}…) — apps compose primitives, they do not repair them`);
      }
    }

    // Gate 8 — Tailwind connected, not duplicated.
    if (/tailwind\.config\.(?:js|ts|cjs|mjs)$/.test(file)) {
      const declaresPalette = /partrunner\s*:\s*\{|['"`]crystal(?:-[a-z]+)?['"`]\s*:/.test(source);
      const usesPreset = /@partrunner-ai\/tokens/.test(source);
      if (declaresPalette) {
        push('tailwind', file, 1, usesPreset
          ? 'declares its own partrunner/crystal palette beside the tokens preset — delete the copy, the preset provides the utilities'
          : 'declares its own partrunner/crystal palette — use the preset from @partrunner-ai/tokens');
      }
    }
  }

  // Gate 2 (count) — exactly one bundle across the app.
  if (usesPackages && deps['@partrunner-ai/ui']) {
    if (themeBundleImports === 0) {
      push('bundle', packageJsonPath, 1, 'no ui theme bundle import found — import exactly one of @partrunner-ai/ui/theme.css or light.css');
    } else if (themeBundleImports > 1) {
      push('bundle', packageJsonPath, 1, `${themeBundleImports} ui theme bundle imports found — exactly one of theme.css | light.css`);
    }
  }

  // Gate 5 — compatible ranges, not exact pins.
  for (const [name, range] of Object.entries(deps)) {
    if (!name.startsWith('@partrunner-ai/')) continue;
    if (!/^(\^|~|workspace:|file:)/.test(range)) {
      push('versions', packageJsonPath, 1, `${name} pinned to "${range}" — use a compatible range (^) so fleet releases reach the app`);
    }
  }

  // Gate 7 — 2.0 floor.
  const uiRange = deps['@partrunner-ai/ui'];
  if (uiRange && !uiRange.startsWith('file:') && !uiRange.startsWith('workspace:')) {
    const major = Number.parseInt(uiRange.replace(/^[^0-9]*/, ''), 10);
    const floor = config.minUiMajor ?? 2;
    if (Number.isFinite(major) && major < floor) {
      push('versions', packageJsonPath, 1, `@partrunner-ai/ui ${uiRange} is below the ${floor}.0 adoption floor`);
    }
  }

  return { findings, scanned: files.length };
}
