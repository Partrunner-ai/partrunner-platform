---
'@partrunner-ai/api-core': patch
---

`./observability`: DOM interaction breadcrumbs (`ui.click`, `ui.input`, …) keep the element path and attribute names but drop attribute values. The SDK serialises `aria-label`, `title`, `alt` and `name` into those breadcrumbs, and labels often hold names and free text that no pattern recognises. Adds `stripDomAttributeValues`.
