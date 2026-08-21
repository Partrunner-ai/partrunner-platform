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

Package code is licensed under MIT. Bundled Barlow and Bebas Neue font files
are licensed under the SIL Open Font License 1.1 included in `styles/fonts`.
See `TRADEMARKS.md` for trademark terms.
