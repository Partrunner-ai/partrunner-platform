# PartRunner light-mode image identity contract

Status: canonical for light-mode adoption. The adaptive package contract is documented separately in [`brand-dark-mode-contract.md`](brand-dark-mode-contract.md).

This contract translates the approved `Identidad de imagen` manual into product UI rules. The manual remains the authority for logo artwork and marketing compositions; this document defines how those rules apply to reusable software components.

Since 2.0 the official visual system is **Partrunner Crystal v2** (the `crystal` theme, the package default): Crystal surfaces, radii, shadows, glass, and the brand gradient sweep, combined with the manual's typography (Bebas Neue display, Barlow body) — a ratified hybrid that supersedes both the pre-2.0 `nexus` look and Crystal v2's original Inter. See [`crystal-guide.md`](crystal-guide.md) for the working vocabulary.

## Required foundation

| Concern | Required rule |
|---|---|
| Brand colors | Yellow `#FDD238`, black `#000000`, and white `#FFFFFF` are exact values. Do not tint, replace, or reinterpret the primary yellow. |
| Primary action | The Crystal v2 brand sweep (`--pr-accent-gradient`: `#FFE573 → #FDD238 → #F0BC00`) over the flat `#FDD238` fallback, with the brand glow (`--pr-shadow-accent`) as its elevation. Ink stays black-derived. Every stop lives inside the approved yellow family; no foreign hues, no ad-hoc gradients. |
| Interface copy | Barlow. Body copy is at least `14px`; controls should remain readable at their supported density. |
| Display copy | Bebas Neue at `24px` or larger. Compact card, dialog, table, and control headings stay in Barlow. |
| Status colors | Semantic red, green, blue, amber, and purple may communicate operational state. They never replace the brand yellow for identity or primary actions. |
| Surfaces | Light mode uses white and neutral surfaces with black-derived borders and copy. Neutral shadows are slate-tinted (the `--pr-shadow-xs`…`xl` scale), never pure black. The branded glow tokens (`--pr-glow-accent*`) are reserved for brand fills — the primary action, done wizard steps — and never decorate neutral surfaces. |
| Motion | Motion explains state. Interactive press feedback uses a restrained `0.96` scale unless `static` is explicitly requested. Reduced-motion preferences must be respected. |
| Ownership | Components own their appearance and states. An app may position a component but must not repair its internal typography, spacing, borders, colors, or stacking with consumer CSS. |

Micro labels such as badge copy, table column labels, and overlines may be smaller than body copy when they are short, non-paragraph text and maintain sufficient contrast. They must not be used for instructions, errors, or essential descriptions.

## Canonical light-mode import

Apps adopting shared primitives should load one complete stylesheet:

```ts
import '@partrunner-ai/ui/light.css';
```

That physical bundle contains, in order:

1. self-hosted Barlow and Bebas Neue font faces;
2. canonical light-mode semantic tokens;
3. all shared primitive styles.

The file contains no nested `@import`, does not depend on Tailwind processing, and can be used by Tailwind v3, Tailwind v4, or an app without Tailwind. `@partrunner-ai/ui/styles.css` remains a lower-level compatibility entry for apps that deliberately provide their own approved tokens and fonts.

The canonical staff shell additionally loads:

```ts
import '@partrunner-ai/shell/shell.css';
```

Do not import `@partrunner-ai/shell/styles.css` together with `@partrunner-ai/ui/light.css`; that legacy shell bundle repeats its own theme. The light UI bundle should own tokens and fonts, while `shell.css` supplies only shell layout and component styles.

## Token namespace ownership

The full `--pr-*` and `--pr-ch-*` namespace is reserved for
`@partrunner-ai` packages, including suffixes the package has not added yet.
Consumers may read those variables and map app or framework aliases to them,
but must not define or override package-looking variables. Product-only values
use an app-owned prefix. The migration rules and valid alias direction are
defined in [`token-namespace-contract.md`](token-namespace-contract.md).

## Prohibited app-level repair

An adopting app must not:

- copy `.pr-*` rules into global CSS;
- declare or reassign `--pr-*` or `--pr-ch-*` variables;
- target package internals with Tailwind arbitrary selectors or CSS overrides;
- recreate an existing shared component with local colors, radii, shadows, or typography;
- repaint the primary action with an unofficial gradient or glow (the official
  treatment ships in the package; apps do not restate or vary it);
- substitute Inter, system UI, or another typeface for package-owned UI;
- remove package CSS through bundler tree-shaking;
- activate dark mode in an app before that app's light-mode adoption gate passes.

App-owned layout wrappers, product-specific data visualization, and domain composition remain valid. If a shared primitive cannot satisfy a legitimate product need without internal overrides, that is a package gap to fix here first.

## Plug-in form contract

Native fields may use their `label`, `hint`, and `error` convenience props. Composite controls use `FormField`, which owns the control ID, accessible name, required and invalid semantics, and help/error descriptions without app CSS or manual ARIA wiring:

```tsx
<FormField label="Flotilla" hint="Busca por nombre o RFC" required>
  <Combobox options={flotillas} />
</FormField>
```

Help text is replaced by the active error, disabled state propagates to the wrapped control, and caller-provided `aria-describedby` references are preserved. Interactive form targets must remain at least `40px` in both dimensions. Apps may compose fields into their own layout but must not restyle package internals.

Selection controls preserve native browser inputs and form submission while the package owns the visible target, focus, disabled, required, mixed, hint, and error states:

```tsx
<Checkbox
  label="Confirmar evidencia"
  description="Incluye una fotografía legible."
  checked={confirmed}
  onChange={(event) => setConfirmed(event.currentTarget.checked)}
/>

<Switch
  label="Asignación automática"
  checked={autoAssign}
  onChange={(event) => setAutoAssign(event.currentTarget.checked)}
/>
```

Use `CheckboxGroup` and `RadioGroup` for related controlled choices. They own the `fieldset`, legend, group description, invalid state, and per-option native input. A required checkbox group intentionally does not mark every checkbox as HTML-required; schema or form validation decides whether the group has enough selections and supplies `error`.

After an unsuccessful submit, render one `ValidationSummary` from the same validation result. Each item links to a stable field ID. Set `focusOnMount` only when the failed submit should move focus to the summary; it is off by default so an initial render never steals focus.

```tsx
<ValidationSummary
  focusOnMount
  errors={issues.map((issue) => ({
    fieldId: issue.fieldId,
    label: issue.label,
    message: issue.message,
  }))}
/>
```

## Logo assets

The Shell includes the PartRunner isotype as package-owned SVG geometry so it
does not require a runtime asset request. The artwork is available under MIT;
trademark use remains subject to `TRADEMARKS.md`.

## Release gate

A package release is eligible for adoption only when all of the following pass:

- unit, type, lint, and build checks;
- Tailwind v3 consumer compilation for every public visual selector;
- browser-rendered light catalog checks for fonts, exact colors, stacking, and overflow;
- package tarball inspection proving CSS and font assets are published;
- a changeset and migration note for any visual contract change;
- no unresolved need for consumer CSS repair in the selected pilot app.

The package's adaptive bundle may be built and audited independently. Dark
mode becomes active in a consuming app only after that app passes this
light-mode gate; each adopting app must pass both phases.
