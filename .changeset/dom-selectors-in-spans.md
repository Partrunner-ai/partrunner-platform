---
'@partrunner-ai/api-core': minor
---

Cut every string that goes through `scrubText` at the first DOM attribute selector that the
Sentry SDK writes (`[aria-label=`, `[type=`, `[name=`, `[title=`, `[alt=`; `[placeholder=` is
defensive). Browser tracing puts these selectors, with unescaped labels, into INP interaction
span names and the `lcp.element` and `cls.source.N` attributes, not only into click
breadcrumbs. The text keeps the element path: `div.board > button.ticket-card[…]`.

Add `dynamicSamplingContextScrubber`, an SDK-free integration that scrubs the transaction name
in the dynamic sampling context. The SDK copies a root span name into the envelope header before
any hook runs, so a standalone INP span could send its label there. Apps add it to
`integrations` next to `browserTracingIntegration()`.
