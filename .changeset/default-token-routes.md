---
'@partrunner-ai/api-core': minor
---

Mask the STF public token links in every app by default. `DEFAULT_TOKEN_ROUTE_PREFIXES`
(`/conductor`, `/afiliacion`) now applies wherever token routes apply: `sanitizePath`,
`sanitizeUrl`, `stripUrlSecrets`, `scrubText`, the event, span and breadcrumb scrubbers,
`createErrorReportingOptions` and `dynamicSamplingContextScrubber`. An app's
`tokenRoutePrefixes` add to the defaults, and each prefix counts once. An app that already passes
the two prefixes gets the same output as before.

Set `includeDefaultTokenRoutes: false` to leave the defaults out. `resolveTokenRoutePrefixes`
returns the prefixes that apply. When two prefixes match one path (for example `/conductor` and
`/conductor/perfil`), each one masks its own next segment.

Behaviour change: calls with no options (`sanitizePath`, `sanitizeUrl`, `stripUrlSecrets`,
`scrubText`, `scrubEvent`) and configs with `tokenRoutePrefixes: []` now mask `/conductor/<x>` and
`/afiliacion/<x>`; before, an empty or missing list meant "no token routes". This can change
grouping keys or analytics for a consumer that uses `sanitizePath` outside Sentry. Set
`includeDefaultTokenRoutes: false` to keep the old behaviour. A path segment whose decoded value
holds a slash (`/conductor%2F<token>`) is now masked whole.
