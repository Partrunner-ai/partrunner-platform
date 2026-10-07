---
'@partrunner-ai/api-core': minor
---

Add the browser-safe `./observability` entry: the shared error-reporting privacy policy. `createErrorReportingOptions` returns Sentry-compatible options with `app` and `surface` tags, scrubbers for events, transactions, spans and breadcrumbs (tokens, RFC, CURP, CLABE, emails, names, amounts, IP addresses and token-route secrets), and Sentry Logs off. The README states the consumer contract for channels the hooks cannot reach. Add `configureErrorReporter` to `./vercel`: `withHandler` reports a thrown error before it writes the 500 envelope, bounded to 2 seconds.
