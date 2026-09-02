---
'@partrunner-ai/ui': minor
---

Add the list and page composition set, and the "one job, one component" decision table
(`docs/crystal-guide.md` § 5b, mirrored in the package README) so an agent never chooses
between two components for one job. New exports: `Page`, `SectionHeading`, `StatTileGrid`,
`SegmentedControl` (radiogroup, roving focus, 40px options), `FilterChip` and `FilterChipRow`
(`aria-pressed` toggles with counts and tone dots), `SearchField`, `ToolbarGroup`,
`ToolbarSpacer`, `DateRangeFilter` (preset-first date window over the package `Calendar`, with
`EMPTY_DATE_RANGE`, `isSameDateRange`, `isValidDateRange`, `formatDateRange`), `TableFrame`
(a strict assembly of `Card`, `CardHeader` and a bleeding `CardContent` with a count badge and a
footer slot) and `TableSkeleton`, `StatusDot`, `IconTile`, `Avatar`, and `toneFromString` with
`TintTone`/`TINT_TONES`. Additive changes to existing components: the compound `Table` accepts
`bare`, and `Popover` accepts `minimumSpace`; defaults are unchanged. Styling is package-owned
plain CSS over `--pr-*` tokens; every new control keeps the 40px interaction floor.
