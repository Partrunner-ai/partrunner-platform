---
'@partrunner-ai/shell': minor
---

Preconnect to the target app on hover. In the app grid, «Mis apps» and the Nexus link, a mouse or pen hover (or keyboard focus) of about 100 ms on a link to another app opens a connection (DNS, TCP, TLS) to that app, so the click starts faster. It runs once per origin per page, never on touch, never with `saveData`, and never for the current app. It fetches no document. In-app links are unchanged.
