# @partrunner-ai/api-core

## 1.1.2

### Patch Changes

- Republish under the tsup 8.5 / pinned-esbuild toolchain (#11). No source
  change: rebuilding the published versions no longer reproduces their registry
  bytes, so the fail-closed preflight rejects them; a fresh patch realigns the
  registry with the artifact ledger.

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
