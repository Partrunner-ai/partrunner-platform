# @partrunner-ai/ui

Accessible React primitives and package-owned CSS for PartRunner applications.

## Install

```bash
pnpm add @partrunner-ai/ui react react-dom lucide-react
```

Import one complete visual foundation:

```ts
import '@partrunner-ai/ui/theme.css';
```

Use `light.css` when a consuming application is intentionally fixed to light
mode. `styles.css` is a lower-level compatibility entry for hosts that supply
their own token foundation.

```tsx
import {
  Button,
  Dialog,
  Input,
  Table,
} from '@partrunner-ai/ui';
```

The package works with React 18 and 19 and does not require a Tailwind runtime.
Styles use semantic `--pr-*` tokens.

## Server-safe entry (`@partrunner-ai/ui/server`)

The main entry ships as a single `"use client"` bundle, because some
components in it need client hooks. Rendered from a Server Component, that
forces even hook-free components — `Card` among them — through Next's
RSC/Flight client-component boundary, where a confirmed Next.js bug can
silently drop one `asChild` (`Slot`-rendered) list item. Import `Card` (and
`Slot`, if composing directly) from `@partrunner-ai/ui/server` instead when it
renders inside a Server Component, especially in a list:

```tsx
import { Card } from '@partrunner-ai/ui/server';

// Server Component — no "use client" boundary, no RSC/Flight round-trip for Card.
export default async function CatalogIndex() {
  return items.map((item) => (
    <Card key={item.slug} asChild>
      <Link href={item.href}>{item.label}</Link>
    </Card>
  ));
}
```

This entry only re-exports components with no client-only hooks. Everything
else stays on the main entry.

## One job, one component

Do not choose between two components for one job. The short form of the table
in [`docs/crystal-guide.md` § 5b](../../docs/crystal-guide.md) — the guide has the
full table, the ordered tie-breaks and the list page recipe:

| Job | Component |
| --- | --- |
| Page container | `Page` |
| Page title block | `PageHeader` |
| Section title inside a page | `SectionHeading` |
| KPI row | `StatTile` in `StatTileGrid` |
| Routes | `NavigationTabs` |
| Panels with their own content | `Tabs` |
| Same data, other subset or view | `SegmentedControl` |
| Filter on one field, ≤7 values, with counts | `FilterChip` in `FilterChipRow` |
| Any other filter | `MultiSelect variant="filter"` |
| Date window of a list | `DateRangeFilter` |
| Date field in a form | `DatePicker` |
| Row of list controls | `Toolbar` + `SearchField`, `ToolbarGroup`, `ToolbarSpacer` |
| Table on a page | `TableFrame` around `Table` (+ `Pagination` in `footer`) |
| Loading compound table | `TableSkeleton` |
| Nothing to show | `EmptyState` |
| Status label | `Badge tone` |
| Tone dot beside text | `StatusDot` |
| Person by initials | `Avatar` |
| Icon in a tinted chip | `IconTile` |
| Stable entity colour | `toneFromString(seed)` |

Package code is licensed under MIT. Bundled Barlow and Bebas Neue font files
are licensed under the SIL Open Font License 1.1 included in `styles/fonts`.
See `TRADEMARKS.md` for trademark terms.
