# PartRunner adaptive light/dark image identity contract

Status: canonical package foundation. Consuming-app activation is gated on that app first passing the light-mode contract.

This contract extends the approved product identity into dark interfaces without changing the identity itself. Yellow `#FDD238`, Barlow, Bebas Neue, component geometry, accessible state semantics, and package ownership remain constant. Only semantic surface, copy, border, shadow, and status-token values adapt.

## One adaptive import

Theme-ready apps load the complete package bundle once:

```ts
import '@partrunner-ai/ui/theme.css';
import '@partrunner-ai/shell/shell.css'; // staff shell consumers only
```

`theme.css` physically contains, in order:

1. self-hosted Barlow and Bebas Neue font faces;
2. fixed identity tokens and default light semantic tokens;
3. `.dark` semantic-token overrides;
4. every shared primitive style.

The bundle contains no nested `@import` and works in Tailwind v3, Tailwind v4, or without Tailwind. Light is the default. Adding `.dark` to `<html>` changes every shared primitive, owned portal, and shell surface through the same semantic variables.

`light.css` remains a fixed-light compatibility entry. An app imports exactly one of these two complete UI bundles.

The package namespace does not change by mode: `--pr-*` and `--pr-ch-*` are
reserved for `@partrunner-ai` packages. Consumers may alias from them but may
not declare local light or dark values under those prefixes. See the canonical
[`token namespace contract`](token-namespace-contract.md).

## Theme state

The canonical Shell control owns document-class application and persistence:

```tsx
import { ThemeToggle } from '@partrunner-ai/shell';

<ThemeToggle allowSystem />
```

An app with server-owned staff preferences may control the same component with `theme`, `onThemeChange`, and `applyToDocument`. Do not pass theme props to individual UI components.

Server-rendered hosts must seed the root class from the saved preference before first paint. Static hosts should apply the saved `pr-theme` value, or the system preference when selected, before the application bundle executes. This small host bootstrap owns timing only; it must not duplicate palette values or component CSS.

## Canonical surfaces

| Semantic role | Light | Dark | Required use |
|---|---:|---:|---|
| Page background | `#FAFBFD` | `#0E0E10` | App and shell content background |
| Surface | `#FFFFFF` | `#161618` | Fields, default cards, catalog sections |
| Elevated | `#FFFFFF` | `#1E1E22` | Dialogs, menus, raised cards |
| Foreground | `#1A1A1A` | `#F5F5F4` | Primary interface copy |
| Border | `#E5E7EE` | `#2A2A2E` | Containment without decorative outlines |
| Brand rail/action | `#FDD238` | `#FDD238` | Fixed identity yellow with black copy |

Semantic danger, success, warning, info, and tone pairs must use the package tokens because their foreground values adapt for contrast. A dark theme is not a black filter over light UI, and the yellow sidebar is not darkened.

## Prohibited app repair

An adopting app must not:

- define local dark values for `--pr-*` tokens;
- add `dark` or `theme` props to shared primitives;
- target `.pr-*` internals with CSS, Tailwind arbitrary variants, or CSS Modules;
- recolor the canonical yellow rail or primary action;
- maintain separate light and dark copies of a component;
- import `light.css` and `theme.css` together;
- activate dark mode before the app's light audit has no unexplained visual forks.

If a primitive is incomplete in dark mode, fix its semantic package seam and add catalog evidence here before changing a consumer.

## Release and adoption gate

The adaptive package release must prove:

- `theme.css` survives a real Tailwind v3 consumer build with every public selector and dark tokens;
- the complete component catalog renders expected page, surface, elevated, foreground, border, and brand values;
- form controls, validation, disabled states, Dialog portals, menus, and the canonical Shell remain readable and interactive;
- narrow viewport renders have no document-level horizontal overflow;
- `ThemeToggle` changes the entire showcase through one document class;
- the package tarball contains `theme.css`, `light.css`, every WOFF2 asset, and both font licenses;
- computed browser assertions cover the dark catalog; optional captures are
  written to ignored `test-results/` artifacts for local review.

After publication, each app proceeds light first and dark second. Dark activation is complete only with critical-route screenshots, interaction checks, no app-owned package repairs, and an explicit audit of any remaining local primitive.
