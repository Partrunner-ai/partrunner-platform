---
'@partrunner-ai/ui': patch
---

Fix `FilterChip`: a pressed chip under the pointer no longer paints its label
and count in the same ink as its background. The hover rule now keeps the
inverted colors of the pressed state.
