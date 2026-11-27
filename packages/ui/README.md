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

## Server Components (`@partrunner-ai/ui/server`)

The main entry is one `"use client"` bundle. A Next Server Component that renders
`StatTile` or `EmptyState` with `icon={Truck}`, or a list of `Card asChild`, must
import those parts from `@partrunner-ai/ui/server` instead. That entry has no
directive, renders on the server, and gives the same markup and classes. There,
`icon` is an element (`icon={<Truck />}`):

```tsx
import { Truck } from 'lucide-react';
import { StatTile, StatTileGrid } from '@partrunner-ai/ui/server';

<StatTileGrid columns={4}>
  <StatTile label="Colocadas del mes" value={42} icon={<Truck />} />
</StatTileGrid>;
```

It exports `Card` (and its parts), `Slot`, `StatTile`, `StatTileGrid` and
`EmptyState`. The rules are in section 10 of `DESIGN.md`.

## Build a screen

Read [`DESIGN.md`](./DESIGN.md) before you write or change a screen. It ships in this package
(`node_modules/@partrunner-ai/ui/DESIGN.md`) and holds:

- the work method: job sentence → recipe → components → states → screenshot and checklist;
- five page recipes: list, inbox, record, form, work queue. Each one has a full example with
  all four states in [`recipes/`](./recipes) (`node_modules/@partrunner-ai/ui/recipes/*.md`);
- the job → component table and the ordered tie-breaks — one job, one component;
- limits for hierarchy and density, the four states of a data region, and text rules;
- the list of things an app must not hand-build.

The recipe examples are generated from the recipe screens of the component catalogue
(`pnpm preview:components`, view «Recetas»). After a change to a recipe screen, run
`pnpm --filter @partrunner-ai/ui recipes`. `pnpm test` fails when the files are out of date.

To make an app's agents read it, add this line to the app's `AGENTS.md`:

```md
- Before you write or change a screen, read `node_modules/@partrunner-ai/ui/DESIGN.md` and follow it.
```

Package code is licensed under MIT. Bundled Barlow and Bebas Neue font files
are licensed under the SIL Open Font License 1.1 included in `styles/fonts`.
See `TRADEMARKS.md` for trademark terms.
