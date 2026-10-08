---
'@partrunner-ai/api-core': minor
---

Cut every scrubbed string at the first DOM attribute selector that the Sentry SDK writes
(`[aria-label=`, `[title=`, `[alt=`, `[name=`, `[type=`, `[placeholder=`). Browser tracing puts
these selectors, with unescaped labels, into INP interaction span names and the `lcp.element` and
`cls.source.N` attributes, not only into click breadcrumbs. The text keeps the element path:
`div.board > button.ticket-card[…]`.
