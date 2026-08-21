# PartRunner brand assets — canonical set

The corrected brand raster set. **The historical exports were mislabeled** — in
`workofger/sube-tu-factura` and the archived `official-design-system`, the
`-black` files hold white pixels and vice versa. The copies here are named by
their REAL color; when auditing an app's `public/brand/`, verify pixel color
against these bytes, not the filename it copied.

Not published to npm (apps vendor what they need into `public/`); the shell's
sidebar mark ships separately as an inline SVG (`packages/shell/src/BrandMark.tsx`).

## Files

| File | Contents | Use on |
|---|---|---|
| `logo-full-bicolor.png` | black + yellow wordmark | white / cream backgrounds (default) |
| `logo-full-black.png` | all-black wordmark | yellow `#FDD238` backgrounds |
| `logo-full-color.png` | all-yellow wordmark | dark / charcoal backgrounds |
| `logo-full-white.png` | all-white wordmark | dark backgrounds (monochrome contexts) |
| `icon-color.png` | yellow "R" isotype | favicon, footer, small marks (~24–32px) |
| `icon-black.png` | black isotype | on yellow |
| `icon-white.png` | white isotype | on dark |

Full logos are 1153×135 (~8.6:1); isotypes 340×320 (~1.06:1).

## Contrast rules (non-negotiable)

- On yellow `#FDD238` → `logo-full-black` / `icon-black`.
- On white/cream → `logo-full-bicolor` (default).
- On dark → `logo-full-color` (preferred) or `logo-full-white` / `icon-white`.
- **Never** the white logo on yellow, never the yellow logo on white, never
  stretched: always `object-contain` + `w-auto` + a `max-w`.

Meta defaults: `theme-color: #FDD238`; favicon = `icon-color.png`.
