# @partrunner-ai/ui

## 2.2.0

### Minor Changes

- Add the list and page composition set, and the "one job, one component" decision table
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

## 2.1.0

### Minor Changes

- Add the shared page-chrome components both staff apps carried as forks: `PageHeader`
  (eyebrow chip, display-tracked title, subtitle, end-aligned actions), `StatTile`
  (KPI tile with tone wash, icon chip, and trend chip), `Toolbar` (glass filter
  surface), `IconButton` (accessible icon-only button with a 44px touch-target
  contract), and `ConfirmDialog` (standard confirm flow over `Dialog`, Spanish
  labels by default, `destructive` and `loading` modes). Styling is package-owned
  plain CSS over `--pr-*` tokens; no Tailwind required.

## 2.0.1

### Patch Changes

- Publish the first routine npm release through Trusted Publishing with registry provenance.
- Updated dependencies:
  - @partrunner-ai/tokens@2.0.1

## 2.0.0

### Major Changes

- Partrunner Crystal v2 is the official design system and the default theme.

  The `crystal` theme becomes canonical: `theme.css`/`light.css` bundles and the
  shell's inline theme now ship Crystal v2 surfaces, radii (10/14/22px), the
  crystal easing, the gradient sidebar, and the brand-sweep primary button with
  its glow. Typography stays on the approved pair (Bebas Neue display, Barlow
  body). The semantic contract gains the Crystal v2 expressive layer — accent
  family (`accent-hover/deep/tint/tint-faint`), five-step slate shadow scale,
  brand glows, glass surfaces, page/card gradients, noise texture, display
  tracking, `radius-card`/`radius-xl` — plus new primitives extracted from the
  onboarding prototype: `Stepper`, `ProgressDots`, `OtpInput`, `ProgressRing`,
  `ProgressBar`, `CopyField`, and `AmbientBackground`.

  BREAKING: default visuals change on upgrade (see `docs/migration-2.0.md` for
  the full token table). Crystal's `accent-strong` moves `#ecb800 → #f0bc00`;
  the sidebar's deep stop moves to the new `sidebar-bg-strong`. The pre-2.0
  `nexus` theme is deprecated to a compatibility export (`nexus.css`), removed
  in 3.0.

### Patch Changes

- Updated dependencies:
  - @partrunner-ai/tokens@2.0.0
