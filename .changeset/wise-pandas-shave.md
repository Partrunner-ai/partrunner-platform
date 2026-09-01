---
'@partrunner-ai/app-registry': minor
---

Add Comunidad to the app registry.

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
