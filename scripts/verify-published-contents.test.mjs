import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  changesetPackageNames,
  decideCheck,
  diffFileHashes,
  formatDriftError,
} from './verify-published-contents.mjs';

const example = { name: '@partrunner-ai/example', version: '1.0.0' };

test('reads package names from Changeset frontmatter, quoted or not', () => {
  assert.deepEqual(
    changesetPackageNames(
      [
        '---',
        "'@partrunner-ai/tokens': patch",
        '"@partrunner-ai/ui": patch',
        '@partrunner-ai/shell: minor',
        '---',
        '',
        "Body text with 'quotes': and colons is ignored.",
      ].join('\n'),
    ),
    ['@partrunner-ai/tokens', '@partrunner-ai/ui', '@partrunner-ai/shell'],
  );
  assert.deepEqual(changesetPackageNames('No frontmatter: here'), []);
});

test('compares only published versions without a pending Changeset', () => {
  const pendingPackages = new Set(['@partrunner-ai/other']);
  assert.equal(
    decideCheck(example, { published: false, pendingPackages }),
    'unpublished',
  );
  assert.equal(
    decideCheck(example, {
      published: true,
      pendingPackages: new Set([example.name]),
    }),
    'pending-changeset',
  );
  assert.equal(
    decideCheck(example, { published: true, pendingPackages }),
    'compare',
  );
});

test('reports added, removed, and modified files in path order', () => {
  const published = new Map([
    ['package.json', 'a'],
    ['dist/index.js', 'b'],
    ['dist/old.js', 'c'],
  ]);
  const local = new Map([
    ['package.json', 'changed'],
    ['dist/index.js', 'b'],
    ['dist/new.js', 'd'],
  ]);
  assert.deepEqual(diffFileHashes(published, local), [
    { path: 'dist/new.js', change: 'added' },
    { path: 'dist/old.js', change: 'removed' },
    { path: 'package.json', change: 'modified' },
  ]);
  assert.deepEqual(diffFileHashes(published, new Map(published)), []);
});

test('names every drifted package and the fix', () => {
  const message = formatDriftError([
    { ...example, files: [{ path: 'package.json', change: 'modified' }] },
  ]);
  assert.match(message, /@partrunner-ai\/example@1\.0\.0 is already published/);
  assert.match(message, /modified: package\.json/);
  assert.match(message, /Add a Changeset for '@partrunner-ai\/example'/);
});
