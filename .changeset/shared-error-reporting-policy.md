---
'@partrunner-ai/api-core': minor
---

Add the browser-safe `./observability` entry: the shared error-reporting privacy policy. `createErrorReportingOptions` returns Sentry-compatible options with `app` and `surface` tags and a `beforeSend` scrubber that redacts tokens, RFC, CURP, CLABE, emails, amounts and token-route secrets before an event leaves the app. Add `configureErrorReporter` to `./vercel`: `withHandler` reports a thrown error before it writes the 500 envelope, bounded to 2 seconds.
