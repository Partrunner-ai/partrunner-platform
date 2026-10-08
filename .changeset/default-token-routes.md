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
