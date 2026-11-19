---
'@partrunner-ai/shell': minor
---

Preload the target app on hover. In the app grid, «Mis apps» and the Nexus link, a mouse or pen hover (or keyboard focus) of about 100 ms on a link to another app opens a connection to that app and prefetches the page the click will open (the start page, or the last page used in that app), so the click can land on a warm answer. It runs once per target per page, never on touch, never with `saveData`, and never for the current app. In-app links are unchanged.
