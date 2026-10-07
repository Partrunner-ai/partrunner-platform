# @partrunner-ai/api-core

Framework-agnostic Node backend primitives shared by PartRunner applications.

## Install

```bash
pnpm add @partrunner-ai/api-core @supabase/supabase-js
```

Install Vercel's request types when using the `./vercel` adapter:

```bash
pnpm add @vercel/node
```

## Entries

```ts
import {
  configureNexusClient,
  logger,
  rpcOn,
  tbl,
} from '@partrunner-ai/api-core';

import {
  extractBearerOrCookie,
  signJwt,
  verifyJwt,
} from '@partrunner-ai/api-core/auth';

import {
  applyRateLimit,
  withApiKeyAuth,
  withHandler,
} from '@partrunner-ai/api-core/vercel';

import {
  getCurrentIsoWeekCdmx,
  shiftIsoWeek,
} from '@partrunner-ai/api-core/week';
```

The root entry is server-only because it can create a service-role database
client. The `./vercel` entry is for Vercel's Node request/response types.

## Feature flag decisions

Use `evaluateFlagDecision` when a host already owns the Nexus row loader and
cache. The function owns only pure row semantics: archive and master-switch
state, strict targeting, actor matching, variant, payload, and row-level
reasons.

```ts
import { evaluateFlagDecision } from '@partrunner-ai/api-core/feature-flags';

const decision = evaluateFlagDecision(
  { value_bool: row.value_bool, value_json: row.value_json, archived_at: row.archived_at },
  {
    flotilleroId: actor.flotilleroId,
    flotilleroRfc: actor.flotilleroRfc,
    email: actor.email,
    roles: actor.roles,
  },
);
```

The host still owns missing keys, invalid host context, provider failures,
database access, cache policy, and exposure events. `evaluateFlag` remains the
compatible boolean API for existing callers. `parseTargetingResult` exposes
the same strict parser to admin forms and import checks. The `./feature-flags`
entry is browser-safe and has no database, logger, or environment imports.

## Error reporting

`./observability` is the shared privacy policy for error tracking. Every app
sends crashes, exceptions and traces to Sentry through these options, so one
filter decides what leaves every app. The entry is browser-safe, has no SDK
dependency, and fits `@sentry/react`, `@sentry/nextjs` and `@sentry/node` 10.

```ts
import * as Sentry from '@sentry/react';
import { createErrorReportingOptions } from '@partrunner-ai/api-core/observability';

Sentry.init({
  ...createErrorReportingOptions({
    app: 'sube-tu-factura', // app registry id
    surface: 'fleet', // fleet | backoffice | client
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_VERCEL_ENV,
    release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA,
    tokenRoutePrefixes: ['/conductor', '/afiliacion'],
    surfaceForPath: path => (path.startsWith('/admin') ? 'backoffice' : undefined),
  }),
  integrations: [Sentry.browserTracingIntegration()],
});
Sentry.setUser({ id: session.userId }); // id only: the scrubber drops everything else
```

What the options guarantee:

- `sendDefaultPii: false`, and the SDK stays disabled without a DSN.
- Every event and transaction gets the `app` and `surface` tags. An explicit
  `surface` tag wins; otherwise `surfaceForPath` classifies the raw page or
  route path; otherwise the configured default applies.
- `scrubEvent` runs on every error and transaction:
  - It pattern-redacts JWTs, bearer values, emails, CURP, RFC, IP addresses, amounts, phones, CLABE
    and 10+ digit runs.
  - It sanitises URLs and paths inside text. URLs lose their query and hash, IP-literal hosts
    become `[ip]`, ids become `[id]`, and token-route secrets become `[token]`.
  - Key rules apply whatever the value type. Credential and raw-request keys (`token`, `session`,
    `cookie`, `authorization`, `apiKey`, `body`, `query`) are dropped. Money and identity keys
    (`amount`, `rfc`, `curp`, `clabe`, `phone`, `email`, `name` variants, `address`, `ip`)
    become `[redacted]`. Numbers with 10+ digits become `[redacted]` unless the key names a time.
    Keys that are data themselves are masked.
  - The request keeps its method, URL and allowlisted headers, with scrubbed values. The user
    keeps only `id`.
  - It scrubs tags set by app code, fingerprints, mechanism data, breadcrumbs (message, category,
    data), `extra`, spans and every context field by field. `response` keeps only its status code
    and body size. Unknown top-level fields such as `server_name` are scrubbed too.
  - It keeps exception types, stack frames, trace ids, version strings, debug ids and other SDK
    metadata, so grouping, source maps and runtime facts still work. It drops frame local
    variables. Frame file names lose only their query, IP host and token-route secret.
- `beforeSendSpan` and `beforeSendLog` scrub streamed spans and logs the same way.
- Shared noise (`ResizeObserver`, aborted requests, browser extensions) is
  ignored. Network failures stay visible.
- The entry contains no lookbehind regex, so it parses on iOS Safari before 16.4.

Vercel Node functions built on `withHandler` report the exceptions that the
500 envelope hides through `configureErrorReporter`. The reporter runs before
the 500 is written, because Vercel can freeze a function once its response
ends, and it may delay that response by at most 2 seconds:

```ts
import * as Sentry from '@sentry/node';
import { configureErrorReporter } from '@partrunner-ai/api-core/vercel';

configureErrorReporter(async ({ err, ctx }) => {
  Sentry.captureException(err, { tags: { handler: ctx } });
  await Sentry.flush(1500);
});
```

Set a custom transaction name only from a sanitised path (`sanitizeUrl`): the
SDK copies it into the trace header before `beforeSend` runs.

The app still owns SDK initialisation, integrations, source-map upload, user
identity, and any business context it adds. `redactSensitiveText`,
`sanitizeUrl` and `sanitizePath` are exported for apps that need the same rules
elsewhere, such as analytics `before_send` hooks.

## Security boundaries

- API keys are accepted only through `X-API-Key`.
- `withHandler` requires an explicit exact-origin allowlist.
- Rate limiting should run before API-key lookup.
- Each JWT caller supplies its own secret and audience policy.
- Password hashing requires the host to install `bcryptjs`.
- Exported Nexus schema and table identifiers are public runtime contracts;
  credentials and tenant data never belong in this package.

```ts
const report = withApiKeyAuth(async (_req, res) => {
  res.status(200).json({ success: true });
}, 'export');

export default withHandler(
  {
    ctx: 'api/reports',
    methods: ['GET'],
    allowedOrigins: ['https://app.example.com'],
  },
  async (req, res) => {
    if (!applyRateLimit(req, res)) return;
    return report(req, res);
  },
);
```

## Compatibility

The package targets Node runtimes and exposes both ESM and CommonJS builds.
`@supabase/supabase-js` is a peer dependency so the host owns the client
version.

Licensed under MIT. See `TRADEMARKS.md` for trademark terms.
