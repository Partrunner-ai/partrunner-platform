---
'@partrunner-ai/ui': minor
---

Add the list and page composition set, and the "one job, one component" decision table
(`docs/crystal-guide.md` § 5b, mirrored in the package README) so an agent never chooses
between two components for one job. Styling is package-owned plain CSS over `--pr-*` tokens;
every new control keeps the 40px interaction floor.

New runtime exports: `Page`, `SectionHeading`, `StatTileGrid`, `SearchField`, `ToolbarGroup`,
`ToolbarSpacer`, `FilterChip`, `FilterChipRow`, `SegmentedControl` (radiogroup, roving focus,
40px options flush with the toolbar row), `TableFrame` (a strict assembly of `Card`, `CardHeader`
and a bleeding `CardContent` with a count badge and a footer slot), `TableSkeleton`,
`DateRangeFilter` (preset-first date window over the package `Calendar`; presets and controlled
values that fail the range invariant or the limits render disabled and are never committed),
`EMPTY_DATE_RANGE`, `isSameDateRange`, `isValidDateRange`, `formatDateRange`, `StatusDot`,
`IconTile`, `Avatar`, `avatarInitials`, `toneFromString`, `TINT_TONES`.

New type exports: `PageProps`, `PageWidth`, `SectionHeadingProps`, `SectionHeadingLevel`,
`StatTileGridProps`, `StatTileGridColumns`, `SearchFieldProps`, `ToolbarGroupProps`,
`ToolbarSpacerProps`, `FilterChipProps`, `FilterChipRowProps`, `SegmentedControlProps`,
`SegmentedControlSize`, `SegmentedOption`, `TableFrameProps`, `TableSkeletonProps`,
`DateRangeFilterProps`, `DateRangeFilterLabels`, `DateRangeFilterSize`, `DateRangePreset`,
`DateRange`, `StatusDotProps`, `StatusDotSize`, `IconTileProps`, `IconTileSize`, `AvatarProps`,
`AvatarSize`, `TintTone`.

Additive changes to existing components, defaults unchanged: the compound `Table` accepts
`bare` (`TableRootProps.bare`, class `.pr-table__scroll--bare`), `Popover` accepts
`minimumSpace`, and a `PageHeader` rendered directly inside `Page` drops its bottom margin so
the page's 24px gap is the only rhythm.
