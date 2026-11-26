// Writes `recipes/*.md` from the recipe screens of the showcase.
//
// The recipe screens are real components: the showcase compiles them and the browser
// tests render them. The package cannot ship `.tsx` files, so each screen ships as a
// Markdown file with its source in one code block. The output is tracked in Git.
//
//   node scripts/build-recipes.mjs           write the files
//   node scripts/build-recipes.mjs --check   fail if a tracked file is out of date
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(packageDir, '..', 'showcase', 'src', 'recipes');
const outputDir = join(packageDir, 'recipes');

const RECIPES = [
  {
    file: 'list-page.md',
    source: 'ListPageRecipe.tsx',
    title: 'List page',
    use: 'The person finds records, then acts on one.',
  },
  {
    file: 'inbox.md',
    source: 'InboxRecipe.tsx',
    title: 'Inbox',
    use: 'The person works through many records, with one open at a time.',
  },
  {
    file: 'record-page.md',
    source: 'RecordPageRecipe.tsx',
    title: 'Record page',
    use: 'The person reads one record and acts on it.',
  },
  {
    file: 'form.md',
    source: 'FormRecipe.tsx',
    title: 'Form',
    use: 'The person creates or changes one record.',
  },
  {
    file: 'work-queue.md',
    source: 'WorkQueueRecipe.tsx',
    title: 'Work queue',
    use: 'The person makes the same decision on many records.',
  },
  {
    file: 'states.md',
    source: 'states.tsx',
    title: 'State helpers',
    use: 'The error, no-permission and no-results blocks that the recipes share.',
  },
];

function render({ title, use, source }) {
  const code = readFileSync(join(sourceDir, source), 'utf8').trimEnd();
  return [
    `# Recipe: ${title}`,
    '',
    use,
    '',
    'This is the full source of a screen that compiles and is tested. Copy the structure and',
    'the props. Replace the sample data with the data of the app.',
    '',
    '- `./fixtures` is sample data and two format helpers (`formatMoney`, `formatDate`). Use the',
    "  app's own data and its shared format helpers.",
    '- `./states` is in `states.md`.',
    '- The `state` prop exists only to show each state in the catalogue. In an app, the state',
    '  comes from the data request.',
    '- The rules are in `../DESIGN.md`.',
    '',
    `<!-- Generated from packages/showcase/src/recipes/${source}. Do not edit. -->`,
    '',
    '```tsx',
    code,
    '```',
    '',
  ].join('\n');
}

const check = process.argv.includes('--check');
const stale = [];
const expected = new Set(RECIPES.map((recipe) => recipe.file));

if (!check) mkdirSync(outputDir, { recursive: true });

for (const recipe of RECIPES) {
  const target = join(outputDir, recipe.file);
  const next = render(recipe);
  if (check) {
    let current = null;
    try {
      current = readFileSync(target, 'utf8');
    } catch {
      current = null;
    }
    if (current !== next) stale.push(recipe.file);
  } else {
    writeFileSync(target, next);
  }
}

if (check) {
  let present = [];
  try {
    present = readdirSync(outputDir);
  } catch {
    present = [];
  }
  for (const file of present) {
    if (!expected.has(file)) stale.push(`${file} (not a recipe)`);
  }
  if (stale.length > 0) {
    console.error(
      `recipes/ is out of date: ${stale.join(', ')}. Run "node scripts/build-recipes.mjs" in packages/ui.`,
    );
    process.exit(1);
  }
}
