'use strict';

function indentContinuation(summary) {
  const [firstLine, ...remainingLines] = summary
    .split('\n')
    .map((line) => line.trimEnd());
  return [
    `- ${firstLine}`,
    ...remainingLines.map((line) => `  ${line}`),
  ].join('\n');
}

async function getReleaseLine(changeset) {
  return indentContinuation(changeset.summary);
}

async function getDependencyReleaseLine(_changesets, dependenciesUpdated) {
  if (dependenciesUpdated.length === 0) return '';
  return [
    '- Updated dependencies:',
    ...dependenciesUpdated.map(
      (dependency) => `  - ${dependency.name}@${dependency.newVersion}`,
    ),
  ].join('\n');
}

module.exports = {
  getReleaseLine,
  getDependencyReleaseLine,
};
