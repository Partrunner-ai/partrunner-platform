---
'@partrunner-ai/api-core': patch
---

`./observability`: DOM interaction breadcrumbs (`ui.click`, `ui.input`, …) keep the element path and attribute names but drop attribute values; the SDK serialises `aria-label`, `title`, `alt` and `name` without escaping, so a selector that does not parse cleanly keeps only the part before the first `[`. Console breadcrumbs are dropped (browser and server): their text and arguments are free-form and carry names and notes no pattern recognises. Adds `stripDomAttributeValues` and `DROPPED_BREADCRUMB_CATEGORIES`.
