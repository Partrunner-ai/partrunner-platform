---
'@partrunner-ai/ui': patch
---

`RichSelect` and `MultiSelect` search now match every word of the query, in any order, and ignore
repeated spaces. Before, the whole query had to appear as one contiguous substring of the item's
`textValue` (`RichSelect`) or `searchText ?? label` (`MultiSelect`), so a driver stored as
`GERMAN  ALEJANDRO CERVANTES GARCIA` (double space) was hidden when typed with a single space, and
`GERMAN CERVANTES` hid anyone with a middle name. Apps that search on the server per word (the
place-unit driver picker) had the server return the row and the client filter drop it.
`MultiSelect` search also ignores accents now, like `RichSelect` already did.

Every query that matched before still matches; only queries that skip, reorder, re-space or
un-accent words now match more items. The first match is still the active option after typing.
