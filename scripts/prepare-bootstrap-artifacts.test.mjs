import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveArtifactOutput } from './prepare-bootstrap-artifacts.mjs';

test('restricts retained bootstrap output to the ignored artifact root', () => {
  assert.match(
    resolveArtifactOutput('.artifacts/candidate'),
    /[\\/]\.artifacts[\\/]candidate$/,
  );
  assert.throws(
    () => resolveArtifactOutput('../outside'),
    /inside \.artifacts|repository-relative/,
  );
  assert.throws(
    () => resolveArtifactOutput('/tmp/outside'),
    /repository-relative/,
  );
});
