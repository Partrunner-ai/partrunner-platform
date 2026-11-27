# @partrunner-ai/ui

## 2.7.0

### Minor Changes

- Add the `@partrunner-ai/ui/server` entry for Next Server Components.
  
  The main entry is one `"use client"` bundle, so from a Server Component every part is a
  Client Component and its props cross the RSC boundary. A component function prop such as
  `icon={Truck}` on `StatTile` or `EmptyState` cannot cross it, and Next can drop one
  `Card asChild` from a list on the Flight path.
  
  The new entry has no `"use client"` directive and exports only parts with no hooks:
  `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Slot`,
  `StatTileGrid`, and server variants of `StatTile` and `EmptyState`. In the server
  variants `icon` is an element (`icon={<Truck />}`). They share one markup function with
  the client components, so the HTML and the classes are the same.
  
  Existing imports from `@partrunner-ai/ui` do not change. Builds on #34.

### Patch Changes

- Make every toast 440 px wide (it was 356 px), so a typical error with an action button wraps in two lines, not four. The action stays beside the text. On a screen narrower than 472 px the toast keeps a 16 px gutter on each side.
  
  A line break in a toast title or description (for example `"No pude crear la factura:\n<detalle>"`) now shows as a line break instead of collapsing into a space.

## 2.6.0

### Minor Changes

- Add `Toaster` and `toast` for the result of an action the person just did. Mount one `Toaster` in the app root; call `toast.success`, `toast.info`, `toast.warning`, `toast.error`, `toast.loading`, `toast.promise` and `toast.dismiss`. Each toast takes `description`, one `action` (for example «Reintentar» or «Deshacer»), `id`, `duration` and `onClose`. Toasts show at the bottom right, at most 3 at once, in package tokens for light and dark mode. Success and info close after 5 s, warning after 8 s, an error stays until the person closes it and is announced as an alert, and a toast with an action stays so a keyboard user can reach it. The package wraps `sonner` as a regular dependency, so apps import everything from `@partrunner-ai/ui` and do not install or import `sonner`.
  
  Add `useConfirm`, a promise-based `ConfirmDialog` for an event handler that used to call `window.confirm`: `const { confirm, dialog } = useConfirm()`, render `dialog` once, and `await confirm({ title, description, confirmLabel, destructive })` resolves `true` or `false`. It needs no provider. Apps can delete their local confirm helpers.
  
  Add `density="ledger"` to `Table` and `TableRoot` for a full-page operational table (36 px rows, 13 px text, a 32 px header, stripes on even rows, and an accent bar on the selected row), and `isRowSelected` to the data-driven `Table`, which marks a row with `data-state="selected"`.
  
  `Skeleton` takes `groupClassName` (classes for the group when `lines` > 1; `className` stays on each bar), and a single `Skeleton` that gets a `role`, `aria-label` or `aria-labelledby` is no longer `aria-hidden`.
  
  `DESIGN.md` has a new section «Feedback: choose one channel» (FormField, Notice, toast, ConfirmDialog) and a new recipe, `recipes/feedback.md`.
  
  Migration for an app that uses `sonner` directly: replace `import { toast, Toaster } from 'sonner'` with `@partrunner-ai/ui`, mount the package `Toaster` once in place of the app one (remove `richColors` and `position`), use `toast.info` in place of `toast.message` and plain `toast()`, and move a `cancel` button into `action` or into a `ConfirmDialog`. No `--pr-*` variable changes meaning.

## 2.5.3

### Patch Changes

- Fix `FilterChip`: a pressed chip under the pointer no longer paints its label
  and count in the same ink as its background. The hover rule now keeps the
  inverted colors of the pressed state.

## 2.5.2

### Patch Changes

- The loading placeholder (`Skeleton`, `PageSkeleton` and the table loading rows) is easier to see. Its fill was the border colour, about 1.2:1 against the surface. It is now a translucent mix of the text colour: 17% in the light theme and 14% in the dark theme, which gives 1.42:1 to 1.51:1 on the page, card and elevated surfaces. Under `prefers-reduced-motion` the fixed opacity is 0.9 (it was 0.7), so the fill still holds at least 1.36:1. Size, shape and pulse do not change. An app does not need local CSS for the fill. An app's own one-class fill on the skeleton still wins in both themes.

## 2.5.1

### Patch Changes

- `ItemList density="compact"` rows are denser, for a dense work queue: a three-line row is 59 px (it was 68 to 72 px), with fixed line heights of 18 px (title), 16 px (description) and 15 px (meta and footer), a row padding of 5 px (block), 14 px (start) and 12 px (end), and a 10 px gap. The avatar aligns to the top of a three-line row. Short compact rows (one or two lines) stay vertically centred. A footer that starts with a `Badge` grows to the badge height: a three-line row with a `sm` badge is 62 px (a `md` badge: 64 px). A browser test pins these heights (add 1 px for the divider). The unread dot is now the accent darkened toward the text colour, so it has at least 3:1 contrast on the row (it was 1.4:1 in the light theme). `comfortable` does not change. A `<strong>` in the row description is semibold and uses the full text colour, so «**Flota:** text» marks who spoke last. Every `ItemRow` part carries a `data-slot` (`item-row-leading`, `item-row-title`, `item-row-meta`, `item-row-description`, `item-row-footer`, `item-row-trailing`, `item-row-dot`) for tests. An app does not need local CSS for the row parts.

## 2.5.0

### Minor Changes

- Add `Notice`, `DetailList`, `ItemList`, `SplitView`, `Stack` (a flex container with a fixed gap scale) and `Disclosure` (an accessible section that opens and closes). `TableCell` and `TableHead` take `align` and `numeric`, and the data-driven `TableColumn` takes `numeric`. Ship the design manual for agents (`DESIGN.md`) and its recipe examples (`recipes/*.md`) in the package. `ItemRow` takes `tone` (a start-edge accent bar for urgency; pair it with a `Badge`) and `footer` (a third line of meta text that can start with a `Badge`), and `unreadLabel` (hidden text for a screen reader on an unread row; it defaults to `No leído`). `TableCell` and `TableHead` still pass the native `align="justify"` and `align="char"` through as the attribute.
  
  Two visual fixes: `SegmentedControl` now hugs its content by default (use `fullWidth` to stretch it), and `ValidationSummary` is more compact, with one tight line per error.
  
  Migration: a `SegmentedControl` that relied on stretching to the full width of its container now needs the `fullWidth` prop. `ValidationSummary` is shorter (less padding, one tight line per error); no code change is necessary. `align="left"`, `"center"` and `"right"` on `TableCell` and `TableHead` are now a class and no longer a DOM `align` attribute (`left` and `right` use the same classes as `start` and `end`, which set `text-align: left` and `right`, so the look is the same; `right` also gives tabular figures).

## 2.4.4

### Patch Changes

- Pin the new `@partrunner-ai/shell` patch («Pendientes» tray buttons and counter colors). No change to the ui components.

## 2.4.3

### Patch Changes

- Pin the new `@partrunner-ai/shell` minor («Pendientes» tray and pending counts). No change to the ui components.

## 2.4.2

### Patch Changes

- Pin the new `@partrunner-ai/shell` minor (preconnect to the target app on hover). No change to the ui components.

## 2.4.1

### Patch Changes

- Pin the new `@partrunner-ai/shell` minor (stable sidebar on first paint). No change to the ui components.

## 2.4.0

### Minor Changes

- Add `PageSkeleton`, a full-page loading placeholder with `table`, `dashboard`, `detail`, `cards` and `chat` variants. It is one busy status region (`aria-busy`, `data-pr-loading`) with a hidden label, fades in after a short delay and stops all motion under `prefers-reduced-motion`.

## 2.3.3

### Patch Changes

- Republish with the new `@partrunner-ai/shell` version pinned in `package.json` (a development dependency). No runtime change.

## 2.3.2

### Patch Changes

- Republish with the new `@partrunner-ai/shell` version pinned in `package.json` (a development dependency). No runtime change.

## 2.3.1

### Patch Changes

- Republish UI with its packed shell development dependency resolved to the shell
  release that restores the header theme toggle. UI runtime code and styles are
  unchanged.

## 2.3.0

### Minor Changes

- Add `CommentThread`, a chat-style thread of internal comments: bubbles, quoted
  replies, reactions, image and file attachments, `@mentions` with suggestions and
  AI-agent messages that stream in (`pending` → `streaming` → `sent`). It is
  controlled and transport-free: the app passes `messages` and callbacks
  (`onSend`, `onEdit`, `onDelete`, `onReact`, `onSearchMentions`, `onUpload`,
  `onFollowChange`, `onLoadOlder`) and serves files through `attachmentHref`.
  
  Bodies are plain text with `<@u:UUID>` / `<@a:handle>` mention tokens.
  `parseCommentBody`, `serializeCommentDraft`, `commentDraftFromBody`,
  `commentPlainText`, `activeMentionQuery` and `mergeCommentMessages` convert
  between stored bodies, drafts and polling deltas; `prepareCommentFile` shrinks
  large photos in the browser before upload. Styles ship in `ui.css` under
  `.pr-comments*`.

## 2.2.5

### Patch Changes

- Republish UI with its packed shell development dependency resolved to the
  shell release that adds the bell sounds. UI runtime code and styles are
  unchanged; the shell version bump only changes UI package metadata, and the
  release integrity checks reject a published version whose rebuilt tarball no
  longer matches.

## 2.2.4

### Patch Changes

- `RichSelect` and `MultiSelect` search now match every word of the query, in any order, and ignore
  repeated spaces. Before, the whole query had to appear as one contiguous substring of the item's
  `textValue` (`RichSelect`) or `searchText ?? label` (`MultiSelect`), so a driver stored as
  `GERMAN  ALEJANDRO CERVANTES GARCIA` (double space) was hidden when typed with a single space, and
  `GERMAN CERVANTES` hid anyone with a middle name. Apps that search on the server per word (the
  place-unit driver picker) had the server return the row and the client filter drop it.
  `MultiSelect` search also ignores accents now, like `RichSelect` already did.
  
  Every query that matched before still matches; only queries that skip, reorder, re-space or
  un-accent words now match more items. The first match is still the active option after typing.

## 2.2.3

### Patch Changes

- Keep the muted sidebar ink AA-legible over the darkest sidebar stop: crystal
  sidebar-fg-muted moves rgba(26,26,26,0.6)->0.7 (3.68:1 -> 4.77:1 over #ecb800)
  and nexus rgba(0,0,0,0.55)->0.6 (4.32:1 -> 5.10:1 over #fdd238). Found by the
  dark-catalog accessibility audit; a new tokens test holds the contract. ui
  republishes only to rebundle theme.css/light.css with the corrected value.
- Updated dependencies:
  - @partrunner-ai/tokens@2.0.2

## 2.2.2

### Patch Changes

- Republish so the registry matches the retained artifact ledger. Rebuilding
  ui@2.2.1 at current main no longer reproduces its registry bytes, so the
  fail-closed publish preflight rejects it and blocks the pending shell 2.2.0
  release. No source change.

## 2.2.1

### Patch Changes

- Republish UI with its packed shell development dependency resolved to 2.1.0. The shell version bump changes UI package metadata even though its runtime code and styles are unchanged. This patch gives the updated artifact a new version while preserving the release integrity checks for already-published versions.

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
