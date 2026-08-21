# partrunner-platform

Shared packages for PartRunner applications. The monorepo provides design
tokens, accessible UI primitives, application chrome, cross-app navigation and
session adapters, and backend runtime primitives.

Since 2.0 the visual foundation is **Partrunner Crystal v2**, the official
PartRunner design system: Crystal surfaces, radii, shadows, glass, and the
brand gradient sweep, with the approved brand typography (Bebas Neue display,
Barlow body). See [`docs/crystal-guide.md`](docs/crystal-guide.md) for the
working vocabulary and [`docs/migration-2.0.md`](docs/migration-2.0.md) to
upgrade from 1.x.

## Packages

| Package | Purpose |
| --- | --- |
| `@partrunner-ai/tokens` | CSS tokens, fonts, and Tailwind v3/v4 mappings |
| `@partrunner-ai/ui` | Accessible React primitives and complete theme bundles |
| `@partrunner-ai/shell` | Shared header, sidebar, launcher, notifications, and user controls |
| `@partrunner-ai/app-registry` | Canonical application metadata and URL building |
| `@partrunner-ai/seamless` | Browser-safe transitions and server-only cross-app session adapters |
| `@partrunner-ai/api-core` | Backend logging, database, auth, feature, and Vercel primitives |

The showcase application is private to npm but its source is public. It renders
the same component and shell catalogs used by browser tests. Its optional
Vercel deployment is a static review surface with fixture data only.

## Compatibility

- React 18 and 19
- Node 22 or later for repository tooling
- Tailwind v3, Tailwind v4, or no Tailwind runtime
- Framework-free URL and server entries where no UI is required
- React declared as a peer for entries that render UI or expose icon components
- ESM and CommonJS package entries

## Install

```bash
pnpm add @partrunner-ai/ui @partrunner-ai/shell
```

Packages are distributed from the public npm registry. Installation requires
no PartRunner token or scoped registry override.

Import one package-owned visual foundation:

```ts
import '@partrunner-ai/ui/theme.css';
import '@partrunner-ai/shell/shell.css';
```

Use `@partrunner-ai/ui/light.css` instead when an application is intentionally
fixed to light mode.

## Shell composition

The consuming application owns authentication, routing, data loading, and
persistence. The shell receives those capabilities through its host context.

```tsx
import {
  AppShell,
  GlobalHeader,
  StaffShellProvider,
} from '@partrunner-ai/shell';

<StaffShellProvider value={staffShell}>
  <AppShell
    sections={sections}
    currentPath="/"
    globalHeader={<GlobalHeader currentSub="supply" />}
  >
    {children}
  </AppShell>
</StaffShellProvider>;
```

## Server boundaries

Secret-bearing Seamless operations are available only from the server entry:

```ts
import {
  resolveConfig,
  verifyNexusSession,
} from '@partrunner-ai/seamless/server';
```

The Seamless root and React entries are browser-safe.

API Core is server-only. Vercel handlers require an app-owned exact-origin
allowlist, and API keys are accepted only through `X-API-Key`.

## Development

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm packages:check
pnpm typecheck
pnpm lint
pnpm test
pnpm test:browser
```

Run the local catalog with:

```bash
pnpm preview:components
```

## Versioning

Public distribution starts at `1.0.0`. A patch fixes behavior without changing
an interface. A minor adds a token, variant, primitive, or other compatible
capability. A major removes or renames an interface, drops a variant, or changes
what an existing `--pr-*` token means.

Each publishable change includes a Changeset. Consuming applications should use
compatible ranges rather than exact pins unless they intentionally own upgrade
timing.

## Security

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
Do not open a public issue containing credentials or personal data.

## License

Code and included PartRunner artwork are available under the
[MIT License](LICENSE). Barlow and Bebas Neue font files bundled by Tokens and
UI remain under the SIL Open Font License 1.1 included beside those files.
PartRunner trademark use is governed separately by [TRADEMARKS.md](TRADEMARKS.md).
