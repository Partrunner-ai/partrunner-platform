# @partrunner-ai/app-registry

## 1.5.0

### Minor Changes

- Add the optional `appNav` flag to `AppLink` (set to `false` on Comunidad), `APP_NAV_ORDER` (the order of the apps in the shell's staff navigation), `sortAppNavApps`, and `APP_NAV_APPS`: the apps shown in «Mis apps» and in the «Ir a» app list, sorted by `APP_NAV_ORDER`. `APPS` keeps its order and every entry keeps its data.

## 1.4.1

### Patch Changes

- Republish with updated development tooling: Vitest 4.1.11, and Next 15.5.24
  for seamless's own tests. The published package.json lists devDependencies, so
  the tarball changed; runtime code, dependencies, and peer ranges are unchanged.

## 1.4.0

### Minor Changes

- Add Comunidad to the app registry.

  The internal RRHH portal (`community/`) now lives on the standard PartRunner
  topology with both deployments — `staging.community.partrunner.ai` and
  `community.partrunner.ai` — so it enters the registry as a plain `subdomain`
  app and the environment prefix resolves it. It is deliberately not pinned to
  `www.partrunner.community` via `absoluteUrl`: that would hardcode production
  into the staging launcher.

  Its `sub` is `community`, matching the host. An app hosting the launcher itself
  must pass `currentSub="community"` to highlight the current tile.

  The public job board that the same deploy serves on `careers` gets no tile: it
  is candidate-facing and, by design, cannot reach the portal.

## 1.3.1

### Patch Changes

- Publish the first routine npm release through Trusted Publishing with registry provenance.
