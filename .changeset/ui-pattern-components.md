---
'@partrunner-ai/ui': minor
---

Add `Notice`, `DetailList`, `ItemList`, `SplitView`, `Stack` (a flex container with a fixed gap scale) and `Disclosure` (an accessible section that opens and closes). `TableCell` and `TableHead` take `align` and `numeric`, and the data-driven `TableColumn` takes `numeric`. Ship the design manual for agents (`DESIGN.md`) and its recipe examples (`recipes/*.md`) in the package. `ItemRow` takes `tone` (a start-edge accent bar for urgency; pair it with a `Badge`) and `footer` (a third line of meta text that can start with a `Badge`), and `unreadLabel` (hidden text for a screen reader on an unread row; it defaults to `No leído`). `TableCell` and `TableHead` still pass the native `align="justify"` and `align="char"` through as the attribute.

Two visual fixes: `SegmentedControl` now hugs its content by default (use `fullWidth` to stretch it), and `ValidationSummary` is more compact, with one tight line per error.

Migration: a `SegmentedControl` that relied on stretching to the full width of its container now needs the `fullWidth` prop. `ValidationSummary` is shorter (less padding, one tight line per error); no code change is necessary. `align="left"`, `"center"` and `"right"` on `TableCell` and `TableHead` are now a class and no longer a DOM `align` attribute (`left` and `right` use the same classes as `start` and `end`, which set `text-align: left` and `right`, so the look is the same; `right` also gives tabular figures).
