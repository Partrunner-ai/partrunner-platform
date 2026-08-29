# @partrunner-ai/ui

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
