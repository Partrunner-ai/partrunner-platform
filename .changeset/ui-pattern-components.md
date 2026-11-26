---
'@partrunner-ai/ui': minor
---

Add `Notice`, `DetailList`, `ItemList`, `SplitView`, `Stack` (a flex container with a fixed gap scale) and `Disclosure` (an accessible section that opens and closes). `TableCell` and `TableHead` take `align` and `numeric`, and the data-driven `TableColumn` takes `numeric`. Ship the design manual for agents (`DESIGN.md`) and its recipe examples (`recipes/*.md`) in the package. `ItemRow` takes `tone` (a start-edge accent bar for urgency; pair it with a `Badge`) and `footer` (a third line of meta text that can start with a `Badge`).

Two visual fixes: `SegmentedControl` now hugs its content by default (use `fullWidth` to stretch it), and `ValidationSummary` is more compact, with one tight line per error.
