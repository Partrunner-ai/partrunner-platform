---
'@partrunner-ai/ui': minor
---

Add a `./server` entry re-exporting `Card` (and `Slot`, which it depends on)
without the `"use client"` directive.

The main entry hoists `"use client"` onto the whole bundle because some
components in it need client hooks; `Card` and `Slot` don't, but they rode
along. Rendered from a Server Component, that forces them through Next's
RSC/Flight client-component boundary, where a confirmed Next.js bug can
silently drop one `asChild` (`Slot`-rendered) instance from a list — the exact
symptom nexus-portal worked around locally (PMO 143c1bdd). Importing `Card`
from `@partrunner-ai/ui/server` instead avoids the boundary crossing entirely,
which reproducibly eliminates the drop.

Existing imports from `@partrunner-ai/ui` are unaffected — this is additive.
