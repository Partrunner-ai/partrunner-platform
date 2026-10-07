---
'@partrunner-ai/api-core': minor
---

`./observability`: DOM interaction breadcrumbs (`ui.click`, `ui.input`, …) keep only the element path before the first `[`; the SDK appends `aria-label`, `title`, `alt` and `name` values without escaping, so nothing after it can be trusted. Console breadcrumbs are removed from every outgoing event (browser and server): their text and arguments are free-form. License-plate keys (`placa`, `plate`, `licensePlate`, `matricula`) are redacted like other identity keys. Adds `stripDomAttributeValues` and `DROPPED_BREADCRUMB_CATEGORIES`; existing signatures are unchanged.
