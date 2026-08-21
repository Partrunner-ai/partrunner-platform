/**
 * Build the physical one-import stylesheets exposed by @partrunner-ai/ui.
 *
 * Several supported Tailwind v3 consumers use postcss-import, whose resolver
 * does not honor CSS subpath exports consistently. Physical bundles leave
 * consumers with no import ordering or resolver contract to learn.
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const stylesDir = join(pkgRoot, 'styles');
const tokenStylesDir = join(pkgRoot, 'node_modules', '@partrunner-ai', 'tokens', 'styles');

const fonts = readFileSync(join(tokenStylesDir, 'fonts.css'), 'utf8');
const lightTheme = readFileSync(join(tokenStylesDir, 'crystal-light.css'), 'utf8');
const adaptiveTheme = readFileSync(join(tokenStylesDir, 'crystal.css'), 'utf8');
const components = readFileSync(join(stylesDir, 'ui.css'), 'utf8');

mkdirSync(join(stylesDir, 'fonts'), { recursive: true });
cpSync(join(tokenStylesDir, 'fonts'), join(stylesDir, 'fonts'), { recursive: true });

function writeBundle(fileName, description, theme) {
  writeFileSync(
    join(stylesDir, fileName),
    `${[
      `/* @partrunner-ai/ui — GENERATED ${description}. Do not edit. */`,
      '/* Approved fonts + tokens + every component rule, in that order. */',
      fonts.trimEnd(),
      theme.trimEnd(),
      components.trimEnd(),
    ].join('\n\n')}\n`,
  );
}

writeBundle('light.css', 'canonical light-mode bundle', lightTheme);
writeBundle('theme.css', 'adaptive light/dark bundle', adaptiveTheme);

console.info(
  '@partrunner-ai/ui: bundled styles/light.css and styles/theme.css with self-hosted brand fonts',
);
