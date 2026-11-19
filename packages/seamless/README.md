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

### Transition timing

- `SeamlessExitProvider.navigateTo` shows the overlay and navigates after the
  overlay has had one paint (two animation frames). It has no fixed wait. The old
  page stays on screen until the next one commits. After a bfcache return
  (`pageshow` with `persisted`) the overlay is cleared.
- `SeamlessSplash` measures `minDurationMs` (default 360) from navigation start,
  so a page that already took longer hides the splash at mount. The fade is
  0.2 s. `prefers-reduced-motion` stops the logo pulse. A bfcache return shows
  the splash again for `minDurationMs`.

## Page-ready timing

`@partrunner-ai/seamless/timing` is framework-free DOM code. It does not touch
`window` at import time.

```ts
import { navStartFor, watchPageReady } from '@partrunner-ai/seamless/timing';

const cancel = watchPageReady({
  nav: 'soft', // 'hard' for a full document load
  currentApp: 'supply',
  startAt: navStartFor('soft'),
  onReady: (sample) => report(sample), // { nav, readyMs, timedOut, ttfbMs?, fcpMs?, lcpMs?, fromApp? }
});
```

The content is settled when nothing busy is visible (`[aria-busy="true"]`,
`[data-slot="skeleton"]`, `[data-pr-loading]`, or the visible seamless splash)
and neither the DOM nor the resource list changed for `quietMs` (default 600).
Telemetry, Sentry, ingest and analytics requests do not count. A hidden page
cancels with no sample. `timeoutMs` (default 30000) gives a sample with
`timedOut: true`. `fromApp` is the app sub of `document.referrer` when it is
another app under the app-registry base domain (hard loads only).
`navStartFor('soft')` returns the time of the last same-origin link click within
2 s, else now.

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
