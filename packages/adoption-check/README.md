# @partrunner-ai/adoption-check

The design-system adoption gates, fleet-wide. Verifies a consuming app
integrates the PartRunner packages the canonical way and has not forked the
visual contract. A gate failing is a fork, not "less adopted": the app started
redefining something the packages own, and the two drift silently from there.

## Gates

| Gate | What it catches |
|---|---|
| `namespace` | app-declared `--pr-*` / `--pr-ch-*` variables (the namespace is package-owned) |
| `bundle` | zero or multiple theme bundles; legacy `shell/styles.css`; deprecated `nexus.css` (unless `--allow-nexus-compat`) |
| `palette` | retired hex (`#FFC107`, `#FFD840`, `#14142B`) and restated official palette hex |
| `fonts` | Google Fonts / `next/font` loads of Barlow, Bebas Neue, or Inter (the bundles self-host) |
| `internals` | app CSS targeting `.pr-*` package internals |
| `versions` | exact pins of `@partrunner-ai/*`; `ui` below the 2.0 adoption floor |
| `tailwind` | duplicated `partrunner.*` / `crystal-*` Tailwind palettes beside (or instead of) the tokens preset |

## Usage

```bash
pr-adoption-check [dir] [--allow-nexus-compat] [--min-ui-major N]
# or fleet-wide from this repo:
node scripts/adoption-audit.mjs ../fds ../solicitudes ../sales
```

Per-app config in `.partrunner/adoption.json`:

```json
{ "allowFiles": ["emails/branded.css"], "allowNexusCompat": false }
```

`allowFiles` exempts files with a legitimate reason to restate brand values
(HTML emails, OG images). Keep the list short and reviewed.

## Status

Private workspace package for now. Wave-1 apps consume it as a packed tarball
devDependency; publishing to npm requires registering it in the release gates
(`scripts/verify-package-artifacts.mjs`, `scripts/release-plan.mjs`) and is
tracked as a follow-up.
