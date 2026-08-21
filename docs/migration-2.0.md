# Migrating to 2.0 — Crystal v2 becomes the default

2.0 promotes Partrunner Crystal v2 to the official design system and the
package default theme. Installing `@partrunner-ai/tokens@2` /
`@partrunner-ai/ui@2` / `@partrunner-ai/shell@2` changes what the default
bundles look like without any code change on your side. This note lists every
meaning change and the escape hatch.

## What changes on upgrade day

| Token | 1.x default (nexus) | 2.0 default (crystal) |
|---|---|---|
| `--pr-radius-sm` / `-md` / `-lg` | 0.5 / 0.75 / 1 rem | 10 / 14 / 22 px |
| `--pr-radius-nav-item` | 0.625rem | 12px |
| `--pr-ease` | `cubic-bezier(0.16,1,0.3,1)` | `cubic-bezier(0.22,1,0.36,1)` |
| `--pr-sidebar-bg` | flat `#fdd238` | 165° gradient `#ffe573 → #fdd238 → #ecb800` |
| `--pr-sidebar-fg` / `-active-bg` | `#000000` / `#000000` | `#1a1a1a` / `#1a1a1a` |
| `--pr-accent-ink` | `#000000` | `#1a1a1a` |
| `--pr-info` (light) | `#2563eb` | `#3b82f6` |
| `--pr-info-fg` (light) | `#ffffff` | `#1a1612` |
| `--pr-shadow-elevated` (light) | black-tinted | slate-tinted crystal `md` |
| Nav geometry (`--pr-nav-*`) | 244/68px rail, 17px icons | 256/72px rail, 18px icons |
| `Button` primary | flat accent | brand sweep + glow + hover lift |
| `Button` radius | `radius-sm` step | `radius-md` step (14px crystal — buttons share the field radius per the v2 spec) |
| `Card` radius | `radius-md` step | new `radius-card` step (18px crystal; nexus restates 0.75rem, pixel-stable) |
| `Dialog` radius | `radius-lg` step | new `radius-xl` step (28px crystal; nexus restates 1rem, pixel-stable) |
| Package titles | no tracking | `letter-spacing: var(--pr-tracking-display)` on card/dialog/sheet titles |

Theme-swap only — no `--pr-*` name was removed. Every 1.x variable keeps
resolving.

## What is new

- Tokens: `--pr-accent-hover`, `--pr-accent-deep`, `--pr-accent-tint`,
  `--pr-accent-tint-faint`, `--pr-radius-card` (18px), `--pr-radius-xl`,
  `--pr-shadow-xs…xl`, `--pr-shadow-inner-glass`, `--pr-glow-accent{-sm,,-lg}`,
  `--pr-glass-*`, `--pr-surface-gradient`, `--pr-card-*-gradient`,
  `--pr-accent-soft-gradient`, `--pr-noise`, `--pr-tracking-display{,-tighter}`,
  `--pr-sidebar-bg-strong`.
- Primitives: `Stepper`, `ProgressDots`, `OtpInput`, `ProgressRing`,
  `ProgressBar`, `CopyField`, `AmbientBackground`.
- Entries: `@partrunner-ai/tokens/crystal-light.css`.

## Meaning changes inside the crystal skin

If you already imported `crystal.css` explicitly in 1.x:

- `--pr-accent-strong` moved `#ecb800 → #f0bc00` to match the Crystal v2 CTA
  sweep; the sidebar's deep stop moved into the new `--pr-sidebar-bg-strong`.
- The CTA gradient (`--pr-accent-gradient`) now ends at `#f0bc00`.

## Keeping the old look during migration

The pre-2.0 theme survives one cycle as a deprecated compatibility export.
After the theme bundle, import:

```ts
import '@partrunner-ai/ui/theme.css';
import '@partrunner-ai/tokens/nexus.css'; // deprecated — removed in 3.0
```

Plan the removal: nexus gets no new tokens' tuning and disappears in 3.0.

## Checklist for consuming apps

1. Upgrade the three packages together (`tokens`, `ui`, `shell`).
2. Delete any vendored Crystal copies (`crystal.css`, `crystal-tokens.css`,
   hardcoded `partrunner.*` Tailwind palettes) — the package now owns them.
   `docs/crystal-guide.md` §8 maps the legacy names.
3. Remove Google Fonts links / `next/font` loads of Barlow, Bebas Neue, or
   Inter for UI copy; the bundles self-host the approved pair.
4. Re-check screenshots/visual baselines: radii, easing, sidebar, and the
   primary button legitimately changed.
5. If a layout hardcoded `244px`/`68px` for the shell rail, switch it to
   `var(--pr-nav-width)` / `var(--pr-nav-rail-width)`.
