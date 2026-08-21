# @partrunner-ai/seamless

Cross-app navigation, browser transitions, and server-side Nexus session
verification for PartRunner applications.

## Entries

The root entry is browser-safe:

```ts
import {
  BRAND,
  hasRole,
  nexusHomeUrl,
  nexusLoginUrl,
  safeNextPath,
} from '@partrunner-ai/seamless';
```

React transition helpers are client components:

```tsx
import {
  BackToNexus,
  SeamlessExitProvider,
  SeamlessSplash,
} from '@partrunner-ai/seamless/react';
```

Secret resolution, JWT verification, cookie operations, and SSO exchange are
server-only:

```ts
import {
  clearSessionCookies,
  resolveConfig,
  safeNextUrl,
  verifyNexusSession,
} from '@partrunner-ai/seamless/server';
```

Never import the server entry from a client module or pass its `jwtSecret` to a
Client Component.

Next.js server adapters keep their existing entry:

```ts
import {
  getNexusSession,
  nexusMiddlewareGuard,
} from '@partrunner-ai/seamless/next';
```

## 1.0 migration

Move every secret- or cookie-bearing import from the package root to
`@partrunner-ai/seamless/server`. Root URL, role, brand, and navigation exports
remain browser-safe. The React and Next subpath interfaces are unchanged.

## Compatibility

Core entries work in browser, Node, and edge runtimes. React 18 and 19 are
supported. Next adapters support Next 14 through 16. The `./server` entry uses
the framework-free App Registry URL subpath and does not require React or
Lucide.

Licensed under MIT. See `TRADEMARKS.md` for trademark terms.
