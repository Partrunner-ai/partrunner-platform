/**
 * Build-time emitter (run via `tsx src/emit.ts`). Generates, from tokens.ts:
 *   styles/crystal.css        — default theme CSS variables (:root + .dark)
 *   styles/crystal-light.css  — light-only adoption contract (no dark override)
 *   styles/fonts.css          — self-hosted approved Barlow + Bebas Neue faces
 *   styles/nexus.css          — deprecated pre-2.0 theme (removed in 3.0)
 *   styles/nexus-light.css    — deprecated light-only variant of the above
 *   styles/tailwind.css       — Tailwind v4 `@theme` mapping (utility generation)
 *
 * Output is git-ignored and regenerated on build; it ships in the published
 * tarball via package.json `files`.
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { classify } from './classify';
import { CHANNEL_KEYS, THEMES, TOKEN_KEYS, toChannels, type Theme } from './tokens';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(pkgRoot, 'styles');
const fontOutDir = join(outDir, 'fonts');

const LATIN_UNICODE_RANGE =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,' +
  'U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,' +
  'U+2212,U+2215,U+FEFF,U+FFFD';

const FONT_FILES = [
  { family: 'Barlow', packageName: 'barlow', file: 'barlow-latin-400-normal.woff2', weight: 400 },
  { family: 'Barlow', packageName: 'barlow', file: 'barlow-latin-500-normal.woff2', weight: 500 },
  { family: 'Barlow', packageName: 'barlow', file: 'barlow-latin-600-normal.woff2', weight: 600 },
  { family: 'Barlow', packageName: 'barlow', file: 'barlow-latin-700-normal.woff2', weight: 700 },
  {
    family: 'Bebas Neue',
    packageName: 'bebas-neue',
    file: 'bebas-neue-latin-400-normal.woff2',
    weight: 400,
  },
] as const;

function declarations(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `  --pr-${k}: ${v};`)
    .join('\n');
}

/**
 * One scrollbar treatment for the whole product, emitted with the theme rather than with the
 * components.
 *
 * `scrollbar-width` and `scrollbar-color` are INHERITED, so declaring them once on `:root` reaches
 * every scroll container — the page, a dialog body, a table, a menu, and anything a consumer
 * builds — without enumerating selectors the package cannot know about.
 *
 * It lives here and not in `ui.css` because that sheet holds a contract: every selector is scoped
 * to `.pr-`, so the primitives never style a consumer's own markup. A page-wide scrollbar is the
 * opposite of scoped by definition, which makes it a theme concern. `styles.test.ts` enforces that
 * boundary and fails if this drifts back.
 *
 * `::-webkit-scrollbar` covers Safari and Chromium builds predating `scrollbar-color`. The two are
 * mutually exclusive in practice: a browser honouring the standard pair ignores the pseudo-elements.
 *
 * A consumer wanting the OS scrollbar back sets `scrollbar-width: auto` on its own root.
 */
function scrollbarCss(): string {
  return [
    ':root {',
    '  scrollbar-width: thin;',
    '  scrollbar-color: var(--pr-scrollbar-thumb) transparent;',
    '}',
    '',
    '::-webkit-scrollbar {',
    '  width: 8px;',
    '  height: 8px;',
    '}',
    '',
    '::-webkit-scrollbar-track {',
    '  background: transparent;',
    '}',
    '',
    '::-webkit-scrollbar-thumb {',
    '  background: var(--pr-scrollbar-thumb);',
    '  border-radius: 999px;',
    '}',
    '',
    '::-webkit-scrollbar-thumb:hover {',
    '  background: var(--pr-scrollbar-thumb-hover);',
    '}',
    '',
    '/* Where a horizontal and a vertical bar meet; otherwise an opaque grey block. */',
    '::-webkit-scrollbar-corner {',
    '  background: transparent;',
    '}',
    '',
  ].join('\n');
}

function themeCss(name: string, theme: Theme): string {
  const rootVars = { ...theme.fixed, ...theme.light };
  return [
    `/* @partrunner-ai/tokens — ${name} theme. GENERATED from src/tokens.ts — do not edit. */`,
    `:root {\n${declarations(rootVars)}\n}`,
    `.dark {\n${declarations(theme.dark)}\n}`,
    scrollbarCss(),
  ].join('\n\n');
}

function lightThemeCss(name: string, theme: Theme): string {
  const rootVars = { ...theme.fixed, ...theme.light };
  return [
    `/* @partrunner-ai/tokens — ${name} light theme. GENERATED from src/tokens.ts — do not edit. */`,
    `:root {\n${declarations(rootVars)}\n}`,
    scrollbarCss(),
  ].join('\n\n');
}

function fontsCss(): string {
  return [
    '/* @partrunner-ai/tokens — approved self-hosted brand fonts. GENERATED — do not edit. */',
    ...FONT_FILES.map(
      ({ family, file, weight }) => `@font-face {
  font-family: '${family}';
  font-style: normal;
  font-display: swap;
  font-weight: ${weight};
  src: url('./fonts/${file}') format('woff2');
  unicode-range: ${LATIN_UNICODE_RANGE};
}`,
    ),
    '',
  ].join('\n\n');
}

/**
 * Channels companion, for Tailwind v3 consumers.
 *
 * Same tokens, stated as `R G B` so `rgb(var(--pr-ch-x) / <alpha-value>)` works.
 * A v3 app imports the theme file AND this one; v4 apps ignore it entirely.
 */
function channelsCss(name: string, theme: Theme): string {
  const declare = (vars: Record<string, string>) =>
    CHANNEL_KEYS.filter((key) => vars[key] !== undefined)
      .map((key) => `  --pr-ch-${key}: ${toChannels(vars[key]!)};`)
      .join('\n');

  return [
    `/* @partrunner-ai/tokens — ${name} channels. GENERATED from src/tokens.ts — do not edit. */`,
    '/* Import alongside the theme file. Only for Tailwind v3, which needs bare',
    '   channels to express opacity as rgb(var(--x) / <alpha-value>). */',
    `:root {\n${declare({ ...theme.fixed, ...theme.light })}\n}`,
    `.dark {\n${declare(theme.dark)}\n}`,
    '',
  ].join('\n\n');
}

function tailwindV4Css(): string {
  const lines: string[] = [];
  for (const key of TOKEN_KEYS) {
    const cssVar = `var(--pr-${key})`;
    const { kind, name } = classify(key);
    if (kind === 'color') lines.push(`  --color-${name}: ${cssVar};`);
    else if (kind === 'radius') lines.push(`  --radius-${name}: ${cssVar};`);
    else if (kind === 'shadow') lines.push(`  --shadow-${name}: ${cssVar};`);
    else if (kind === 'font') lines.push(`  --font-${name}: ${cssVar};`);
    else if (kind === 'gradient') lines.push(`  --background-image-${name}: ${cssVar};`);
    else if (kind === 'tracking') lines.push(`  --tracking-${name}: ${cssVar};`);
  }
  return [
    '/* @partrunner-ai/tokens — Tailwind v4 @theme. GENERATED — do not edit. */',
    "/* Import alongside a theme file (crystal.css or nexus.css) that defines the --pr-* vars. */",
    `@theme {\n${lines.join('\n')}\n}`,
    '',
  ].join('\n\n');
}

mkdirSync(outDir, { recursive: true });
mkdirSync(fontOutDir, { recursive: true });
writeFileSync(join(outDir, 'crystal.css'), themeCss('crystal', THEMES.crystal));
writeFileSync(join(outDir, 'crystal-light.css'), lightThemeCss('crystal', THEMES.crystal));
writeFileSync(join(outDir, 'fonts.css'), fontsCss());
writeFileSync(join(outDir, 'nexus.css'), themeCss('nexus', THEMES.nexus));
writeFileSync(join(outDir, 'nexus-light.css'), lightThemeCss('nexus', THEMES.nexus));
writeFileSync(join(outDir, 'tailwind.css'), tailwindV4Css());
writeFileSync(join(outDir, 'crystal-channels.css'), channelsCss('crystal', THEMES.crystal));
writeFileSync(join(outDir, 'nexus-channels.css'), channelsCss('nexus', THEMES.nexus));

for (const { packageName, file } of FONT_FILES) {
  copyFileSync(
    join(pkgRoot, 'node_modules', '@fontsource', packageName, 'files', file),
    join(fontOutDir, file),
  );
}
copyFileSync(
  join(pkgRoot, 'node_modules', '@fontsource', 'barlow', 'LICENSE'),
  join(fontOutDir, 'LICENSE-Barlow.txt'),
);
copyFileSync(
  join(pkgRoot, 'node_modules', '@fontsource', 'bebas-neue', 'LICENSE'),
  join(fontOutDir, 'LICENSE-Bebas-Neue.txt'),
);

console.info(
  '@partrunner-ai/tokens: emitted fonts.css, crystal.css, crystal-light.css, nexus.css, ' +
    `nexus-light.css, tailwind.css, crystal-channels.css, nexus-channels.css → ${outDir}`,
);
