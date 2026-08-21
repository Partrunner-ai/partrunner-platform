# PartRunner token namespace contract

Status: canonical for package and consuming-app adoption.

The complete `--pr-*` CSS custom-property namespace belongs to the
`@partrunner-ai` packages. This includes token names that do not exist yet and
the Tailwind v3 channel companion under `--pr-ch-*`. A package minor may add a
new semantic token, so an app-local name that happens not to collide today is
still a future cascade failure.

## Allowed consumer usage

Apps may:

- read package tokens from component, layout, or visualization CSS;
- map framework aliases to package tokens;
- map an app-prefixed compatibility alias to a package token;
- define genuinely app-specific tokens under an app-owned prefix.

```css
@theme {
  --color-card: var(--pr-surface);
  --color-card-foreground: var(--pr-surface-fg);
}

:root {
  --sol-route-risk: var(--pr-tone-amber-bg);
}
```

The dependency direction is package token to consumer alias. This lets the
package rotate light/dark values while the app keeps framework or domain names.

## Prohibited consumer usage

Apps must not:

- declare or reassign any `--pr-*` or `--pr-ch-*` variable;
- invent a "safe" package-looking suffix such as `--pr-card-legacy`;
- copy a package token block into app CSS;
- make a package token point back to an app token;
- use import order or selector specificity to win against package variables.

```css
/* Invalid: both names occupy the package namespace. */
:root {
  --pr-card: #ffffff;
  --pr-card-legacy: rgba(255, 255, 255, 0.85);
}
```

The rule covers light blocks, `.dark` blocks, scoped theme roots, inline styles,
and generated CSS. A local declaration can split light and dark behavior even
when the values look equivalent in one mode.

## App-owned prefixes

Use a stable product prefix for domain-only variables, for example
`--supply-*`, `--sol-*`, `--sales-*`, or `--stf-*`. Do not use a shared generic
prefix such as `--app-*` across repositories.

When migrating an existing local `--pr-*` variable:

1. If it means the same thing as a package token, replace its reads with that
   package token or a framework alias that points to it.
2. If it is genuinely product-specific, rename the declaration and every read
   to the app-owned prefix.
3. Remove the old declaration rather than keeping a reverse alias.
4. Verify both `light.css` and `theme.css`; a light-only screenshot cannot prove
   that the cascade is safe.

```css
/* Before: local package-namespace collision. */
:root { --pr-card: #ffffff; }

/* After, shared meaning: use the package surface directly. */
@theme { --color-card: var(--pr-surface); }

/* After, product-only meaning: own the name explicitly. */
:root { --stf-crystal-card: rgba(255, 255, 255, 0.85); }
```

## Enforcement boundary

The package owns the contract and published values; each consumer owns removal
of its legacy declarations during adoption. Reviewers should reject new local
`--pr-*` declarations. The light-mode adoption audit records existing collisions
and their migration, then the dark-mode audit verifies that no mode-specific
override reintroduces them. This review boundary keeps enforcement visible
without adding a cross-repository CI scanner to every development loop.

