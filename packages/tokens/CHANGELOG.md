# @partrunner-ai/tokens

## 2.0.2

### Patch Changes

- Keep the muted sidebar ink AA-legible over the darkest sidebar stop: crystal
  sidebar-fg-muted moves rgba(26,26,26,0.6)->0.7 (3.68:1 -> 4.77:1 over #ecb800)
  and nexus rgba(0,0,0,0.55)->0.6 (4.32:1 -> 5.10:1 over #fdd238). Found by the
  dark-catalog accessibility audit; a new tokens test holds the contract. ui
  republishes only to rebundle theme.css/light.css with the corrected value.

## 2.0.1

### Patch Changes

- Publish the first routine npm release through Trusted Publishing with registry provenance.

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
