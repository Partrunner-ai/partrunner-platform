// Generate styles/theme.css by inlining the default theme from
// @partrunner-ai/tokens (single source of truth). Inlined (not @import'd) so the
// shell's shipped CSS stays self-contained — consumers need no CSS-import
// resolution and no runtime dependency on the tokens package. To reskin, a
// consumer imports @partrunner-ai/tokens/nexus.css AFTER the shell styles.
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const src = require.resolve('@partrunner-ai/tokens/crystal.css');
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'styles', 'theme.css');

mkdirSync(dirname(out), { recursive: true });
copyFileSync(src, out);
// eslint-disable-next-line no-console
console.info('@partrunner-ai/shell: synced styles/theme.css from @partrunner-ai/tokens/crystal.css');
