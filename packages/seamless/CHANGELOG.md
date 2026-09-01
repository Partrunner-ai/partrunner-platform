# @partrunner-ai/seamless

## 1.0.2

### Patch Changes

- Republish under the tsup 8.5 / pinned-esbuild toolchain (#11). No source
  change: rebuilding the published versions no longer reproduces their registry
  bytes, so the fail-closed preflight rejects them; a fresh patch realigns the
  registry with the artifact ledger.

## 1.0.1

### Patch Changes

- Publish the first routine npm release through Trusted Publishing with registry provenance.
- Updated dependencies:
  - @partrunner-ai/app-registry@1.3.1
