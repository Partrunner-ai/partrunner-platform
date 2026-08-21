# @partrunner-ai/tokens

PartRunner design tokens for plain CSS, Tailwind v3, and Tailwind v4.

## Install

```bash
pnpm add @partrunner-ai/tokens
```

## Entries

- `crystal.css` — Partrunner Crystal v2, the official adaptive theme (default)
- `crystal-light.css` — Crystal v2 fixed light theme
- `fonts.css` — self-hosted Barlow and Bebas Neue faces
- `tailwind.css` — Tailwind v4 token mapping
- package root — token values and Tailwind v3 preset
- channel exports (`crystal-channels.css`, `nexus-channels.css`) — Tailwind v3 opacity support
- `nexus.css` / `nexus-light.css` — the pre-2.0 theme, deprecated; removed in 3.0

```ts
import { THEMES, preset } from '@partrunner-ai/tokens';
import '@partrunner-ai/tokens/crystal.css';
```

Tokens use the `--pr-*` namespace. Changing what an existing token means is a
breaking change.

Package code is licensed under MIT. Bundled Barlow and Bebas Neue font files
are licensed under the SIL Open Font License 1.1 included in `styles/fonts`.
See `TRADEMARKS.md` for trademark terms.
