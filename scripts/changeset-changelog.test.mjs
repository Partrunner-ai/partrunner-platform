import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const formatter = require('./changeset-changelog.cjs');

test('formats release notes without private commit identifiers', async () => {
  const line = await formatter.getReleaseLine({
    summary: 'Add a public capability.\nKeep the continuation readable.',
    commit: '1234567890abcdef',
  });
  assert.equal(
    line,
    '- Add a public capability.\n  Keep the continuation readable.',
  );
  assert.doesNotMatch(line, /1234567/);
});

test('formats dependency updates without Changeset commit links', async () => {
  const line = await formatter.getDependencyReleaseLine(
    [{ commit: 'abcdef1234567890' }],
    [{ name: '@partrunner-ai/tokens', newVersion: '1.6.2' }],
  );
  assert.equal(
    line,
    '- Updated dependencies:\n  - @partrunner-ai/tokens@1.6.2',
  );
  assert.doesNotMatch(line, /abcdef1/);
});
