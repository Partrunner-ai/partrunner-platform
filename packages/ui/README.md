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

## Build a screen

Read [`DESIGN.md`](./DESIGN.md) before you write or change a screen. It ships in this package
(`node_modules/@partrunner-ai/ui/DESIGN.md`) and holds:

- the work method: job sentence → recipe → components → states → screenshot and checklist;
- five page recipes: list, inbox, record, form, work queue;
- the job → component table and the ordered tie-breaks — one job, one component;
- limits for hierarchy and density, the four states of a data region, and text rules;
- the list of things an app must not hand-build.

To make an app's agents read it, add this line to the app's `AGENTS.md`:

```md
- Before you write or change a screen, read `node_modules/@partrunner-ai/ui/DESIGN.md` and follow it.
```

Package code is licensed under MIT. Bundled Barlow and Bebas Neue font files
are licensed under the SIL Open Font License 1.1 included in `styles/fonts`.
See `TRADEMARKS.md` for trademark terms.
