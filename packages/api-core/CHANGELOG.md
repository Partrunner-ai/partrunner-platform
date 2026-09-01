# @partrunner-ai/api-core

## 1.1.2

### Patch Changes

- Republish API Core after the dependency sweep changed the packaged
  `@vercel/node` development dependency without changing the package version.
  There is no runtime source change; this patch realigns the verified artifact
  with the npm registry ledger so later releases can pass the fail-closed
  integrity preflight.

## 1.1.1

### Patch Changes

- Accept any valid lower snake-case Nexus role code in feature-flag targeting instead of a fixed role catalog.

## 1.1.0

### Minor Changes

- Add provider-neutral feature flag decision and targeting parse contracts while preserving the existing boolean evaluator.

## 1.0.2

### Patch Changes

- Fail closed when an enabled Nexus feature flag contains malformed targeting.

## 1.0.1

### Patch Changes

- Publish the first routine npm release through Trusted Publishing with registry provenance.
