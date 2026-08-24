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
