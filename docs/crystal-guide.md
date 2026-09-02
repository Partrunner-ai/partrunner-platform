# Partrunner Crystal v2 — working guide

Status: canonical since 2.0. Crystal v2 is the official PartRunner design
system and the package default theme. This guide is the working vocabulary for
building product UI with `@partrunner-ai/tokens`, `@partrunner-ai/ui`, and
`@partrunner-ai/shell`; the normative rules live in
[`brand-light-mode-contract.md`](brand-light-mode-contract.md) and
[`brand-dark-mode-contract.md`](brand-dark-mode-contract.md).

Provenance: the archived `official-design-system` repository (Crystal v2 spec)
plus the field-proven refinements of the `onboarding-flotilleros` prototype.
Two deliberate divergences from the original spec, both ratified:

- **Typography stays on the approved brand pair** — Bebas Neue display, Barlow
  body — not Crystal v2's Inter.
- **Light-surface status colors use the 600 family** (`#059669` success,
  `#d97706` warning): the spec's 500 family failed the 3:1 contrast floor.

## 1. Adoption

```ts
// Exactly one theme bundle:
import '@partrunner-ai/ui/theme.css';   // adaptive light/dark (recommended)
// import '@partrunner-ai/ui/light.css'; // light only

// Staff shell consumers additionally:
import '@partrunner-ai/shell/shell.css';
```

The pre-2.0 look survives one cycle as `@partrunner-ai/tokens/nexus.css`
(deprecated, removed in 3.0). Import it after the bundles to keep the old skin
while migrating.

## 2. Core palette

The semantic contract owns the names; never restate the hex in app code.

| Token | Value | Use |
|---|---|---|
| `--pr-accent` | `#fdd238` | The brand yellow. CTAs, brand fills. Never behind long text |
| `--pr-accent-hover` | `#f5c420` | hover step of flat accent fills |
| `--pr-accent-deep` | `#d69e00` | decorative icon/border accent only — 2.40:1 on white, so never text or links on light surfaces |
| `--pr-accent-tint` / `-tint-faint` | `#fff6d1` / `#fffbeb` | callouts, soft highlights |
| `--pr-accent-soft` / `--pr-accent-strong` | `#ffe573` / `#f0bc00` | gradient stops |
| `--pr-accent-ink` | `#1a1a1a` | ink on accent fills |
| `--pr-fg` / `-muted` / `-faint` | `#1a1a1a` / `#4b5563` / `#6b7280` | the three text levels (all AA) |
| `--pr-bg` / `--pr-surface` / `--pr-elevated` | `#fafbfd` / `#ffffff` / `#ffffff` | page / card / popover |
| `--pr-border` / `-strong` | `#e5e7ee` / `#d1d5db` | lines |
| `--pr-danger/success/warning/info` | `#ef4444` / `#059669` / `#d97706` / `#3b82f6` | status |
| `--pr-tone-{yellow,blue,amber,purple,green,rose}-{bg,fg,border}` | rgba pairs | tinted chips/cards |

Dark values rotate automatically under `.dark`; the accent family and sidebar
are fixed brand and do not rotate.

**Deprecated — never use:** `#FFC107`, `#FFD840`, `#14142B`.

## 3. The crystal signature

| Concern | Tokens |
|---|---|
| Radii | `--pr-radius-sm` 10px (chips) · `--pr-radius-md` 14px (**buttons, inputs**) · `--pr-radius-card` 18px (**cards**) · `--pr-radius-lg` 22px (tiles, sections) · `--pr-radius-xl` 28px (heroes, modals) |
| Shadows | `--pr-shadow-xs…xl`, slate-tinted (`rgba(15,23,42,…)`), **never pure black**. Semantic aliases `--pr-shadow-card` / `--pr-shadow-elevated` are what primitives consume |
| Brand glow | The CTA's own elevation is `--pr-shadow-accent` / `-lg` (glow + inset highlight), baked into `Button primary`. The bare glows `--pr-glow-accent-sm/-/-lg` dress other brand fills — done wizard steps, featured brand tiles. Brand fills only — never on neutral surfaces |
| Gradients | `--pr-accent-gradient` (135° CTA sweep) · `--pr-accent-soft-gradient` · sidebar sweep lives in `--pr-sidebar-bg` · `--pr-surface-gradient` · `--pr-noise`. The app-facing card tints are `--pr-card-{yellow,amber,blue,purple,green,rose}-gradient`; the `Card` primitive's `gradient` prop paints an equivalent theme-aware mix from the tone pairs |
| Glass | `--pr-glass-bg` (.85) / `-strong` (.95) / `-soft` (.6), `--pr-glass-border{,-active}`, `--pr-shadow-inner-glass`. `--pr-glass-blur` (24px) is the FLOATING-CHROME amount; in-page glass cards blur at half (what `Card glass` ships). Glass without backdrop blur is wrong |
| Motion | one easing: `--pr-ease` = `cubic-bezier(0.22,1,0.36,1)`; interactive transitions 160ms, entrances ~200ms, progress fills 500ms; respect reduced motion |
| Tracking | `--pr-tracking-display` −0.022em (h1–h3) · `--pr-tracking-display-tighter` −0.028em (hero) |

Tailwind consumers get these as utilities from the preset / `@theme` export:
`rounded-pr-card`, `shadow-pr-md`, `shadow-pr-glow-accent`, `ease` via
arbitrary value, `bg-pr-accent-gradient`, `tracking-pr-display`.

## 4. Typography

- **Bebas Neue** for display at `24px+` (`--pr-font-title`); **Barlow** for
  everything else (`--pr-font-body`). Both self-hosted by the theme bundles —
  do not add Google Fonts links or `next/font` for them.
- Package `FormField` labels are 12.5px/650, sentence case — do not restyle them.
  The uppercase micro-label (`11px semibold` tracking `0.12em`; eyebrows
  `0.18em`) is the APP-side pattern for stat-tile labels and section overlines.
- Numbers in tables and tiles: `tabular-nums`; identifiers: `--pr-font-mono`.
- Inputs hold `16px` under 640px (iOS anti-zoom); do not force them smaller.

## 5. Build with primitives, not recipes

The prototype proved that component classes go unused once primitives exist;
reach for `@partrunner-ai/ui` first:

- Surfaces: `Card` (`glass`, `tone`, `gradient`, `interactive`), `Dialog`,
  `Sheet`, `Popover`.
- Actions: `Button` — `primary` is the official CTA (brand sweep + glow); max
  **one** per view. `secondary`, `ghost`, `danger` for the rest.
- Forms: `FormField` + `Input`/`Textarea`/`Select`/`Combobox`/`DatePicker`,
  `Checkbox`, `Switch`, `ChoiceGroup`, `FileDropzone`, `OtpInput`.
- Progress & flow: `Stepper` / `ProgressDots`, `ProgressRing`, `ProgressBar`,
  `Skeleton`, `Spinner`.
- Data: `Table`/`DataTable`, `Badge`, `Pagination`, `Tabs`, `NavigationTabs`.
- Feedback & utility: `EmptyState` (never bare text), `AlertDialog`, `Tooltip`,
  `CopyField`, `AmbientBackground`, `Separator`.

Apps compose and position; they do not restyle package internals
([`token-namespace-contract.md`](token-namespace-contract.md)).

## 5b. One job, one component

An agent building a screen must not choose between two components for one job.
The table names the component for each job; the ordered questions below settle
the rest. If a job is missing, add the component to this package (when at least
two apps need it and it is presentation only) — never a local composition in an
app.

| Job on the screen | Use | Not this |
|---|---|---|
| The page container: width and outer rhythm | `Page` | ad-hoc `max-w-*` and padding utilities |
| The page title block (eyebrow, h1, subtitle, actions) | `PageHeader` | a second title component, `CardHeader` |
| A titled section inside a page (h2/h3, description, actions) | `SectionHeading` | `PageHeader` twice, `CardHeader` outside a card |
| KPI figures in a row | `StatTile` inside `StatTileGrid` | `Card` with a big number |
| Move between **routes** | `NavigationTabs` | `Tabs`, `SegmentedControl` |
| Switch between **independently labelled panels** (Detalle / Comentarios / Actividad) | `Tabs` | `SegmentedControl` |
| Change the **representation or subset of the same dataset** (Todas/Mis, lista/tablero, día/semana) | `SegmentedControl` | `Tabs`, a `Button` group |
| Filter on **one field with at most 7 values, always visible, with counts** (statuses) | `FilterChip` in `FilterChipRow` | `Badge` as a button, `Tabs` |
| Filter on **any other field** | `MultiSelect variant="filter"` | one `RichSelect` per filter |
| The date **window** of a list (presets first) | `DateRangeFilter` | two `Input type="date"`, `DatePicker mode="range"` |
| A date **field** in a form | `DatePicker` | `DateRangeFilter` |
| The row of controls that narrows a list | `Toolbar` with `SearchField`, `ToolbarGroup`, `ToolbarSpacer` | `Card`, a bare flex div |
| A table on a page: title, row count, actions, pager | `TableFrame` around `Table` | `Card` + a hand-rolled header |
| The table, when rows are uniform records | `Table` with `columns` and `rows` (`loading`, `empty`, `error`) | raw `<table>` with class constants |
| The table, when cells need custom markup | `Table` with `TableHeader/TableBody/TableRow/TableHead/TableCell`; `TableSkeleton` while loading, `EmptyState` when empty | raw `<table>` with class constants |
| Page through rows | `Pagination` in `TableFrame footer` | a custom pager bar |
| Nothing to show | `EmptyState` as the frame body | text |
| A status or category label | `Badge tone` | custom spans |
| A tone dot beside visible text in a menu item, option or legend | `StatusDot` | `Badge dot` with no text |
| A person by initials | `Avatar` | an initials span |
| An icon in a tinted chip | `IconTile` | a hand-tinted span |
| A stable colour for an entity (client, project, person) | `toneFromString(seed)` → `TintTone` | picking a hex |

`DataTable` is a compatibility alias of `Table`, not a choice.

### Ordered tie-breaks

Run them top to bottom and stop at the first match.

1. Does the option change the URL? → `NavigationTabs`.
2. Does each option show its own content, not the same rows? → `Tabs`.
3. Same dataset, different subset, representation or granularity? → `SegmentedControl`.
4. Is it a filter? One field, at most 7 values, counts shown, always visible → `FilterChip`.
   A date window → `DateRangeFilter`. Anything else → `MultiSelect variant="filter"`.
5. Is it a table? Uniform records → `Table columns/rows` with its `loading`/`empty`/`error`.
   Custom cells → compound `Table`, `TableSkeleton` while loading, `EmptyState` when empty.
   Either goes inside `TableFrame`; the pager goes in `footer`.

### List page recipe

```tsx
<Page>
  <PageHeader
    eyebrow="Supply"
    title="Colocadas"
    actions={<SegmentedControl aria-label="Vista" value={view} onChange={setView} options={VIEWS} />}
  />
  <StatTileGrid columns={3}>
    <StatTile label="Colocadas" value={128} icon={Truck} tone="blue" />
    …
  </StatTileGrid>
  <FilterChipRow aria-label="Estado">
    <FilterChip active={status === 'all'} count={128} onClick={() => setStatus('all')}>Todos</FilterChip>
    <FilterChip active={status === 'pending'} dot tone="warning" count={12} onClick={…}>Pendiente</FilterChip>
  </FilterChipRow>
  <Toolbar>
    <SearchField aria-label="Buscar" placeholder="Buscar conductor o placa" />
    <DateRangeFilter aria-label="Fechas" value={range} onChange={setRange} presets={presets} labels={labels} />
    <MultiSelect variant="filter" aria-label="Origen" placeholder="Origen" options={origins} value={origin} onChange={setOrigin} />
    <ToolbarSpacer />
    <SegmentedControl aria-label="Presentación" value={layout} onChange={setLayout} options={LAYOUTS} />
  </Toolbar>
  <TableFrame
    title="Todas las colocadas"
    count={rows.length}
    countLabel={(n) => `${n} filas`}
    actions={<Button size="sm" variant="secondary">Exportar CSV</Button>}
    footer={<Pagination page={page} pageSize={20} totalItems={total} onPageChange={setPage} />}
  >
    {loading ? (
      <TableSkeleton rows={6} columns={4} label="Cargando tabla" />
    ) : rows.length === 0 ? (
      <EmptyState title="Sin colocadas en esta ventana" />
    ) : (
      <Table aria-label="Colocadas" bare>
        <TableHeader>…</TableHeader>
        <TableBody>…</TableBody>
      </Table>
    )}
  </TableFrame>
</Page>
```

The presets are computed by the app (`mexicoCityDaysAgo(7)`, …); the package owns
no date logic. Status→tone maps stay in the app too: `Badge tone`, `StatusDot`
and `FilterChip tone` take the result.

## 6. Layout rhythm

Page padding `p-4 sm:p-6 lg:p-8` · admin width `max-w-7xl mx-auto` · forms
`max-w-4xl` (`max-w-lg` single-column) · between sections `mb-6` · fields
`space-y-4` · button rows `gap-2` · tile grids `gap-3 sm:gap-4`. The shell owns
sidebar geometry (`--pr-nav-width` 256px, rail 72px).

Two shells, not one: staff/back-office apps use the package shell (yellow
gradient sidebar); public/portal surfaces may pair a neutral chrome with a
bottom nav on mobile — never recolor the staff rail.

## 7. Do / Don't

- DON'T `bg-yellow-400` or any raw yellow → DO `--pr-accent` / the sweep.
- DON'T repaint the CTA (`Button variant="primary"` ships the official one).
- DON'T pure-black shadows or `shadow-md` → DO the `--pr-shadow-*` scale.
- DON'T generic `rounded-lg` on cards → DO `--pr-radius-card` (18px).
- DON'T more than one glowing CTA per view.
- DON'T browser-blue focus rings → the package focus ring is the yellow one.
- DON'T declare or override any `--pr-*` variable in app code.
- DON'T glass (`bg-white/85`) without backdrop blur.
- DON'T hardcode hex that a token already names.

## 8. Legacy translation (pre-2.0 and vendored copies)

| Legacy | 2.0 |
|---|---|
| `crystal.css` vendored copies (`--pr-yellow`, `--color-primary`, …) | `@partrunner-ai/ui/theme.css` (`--pr-accent`, semantic contract) |
| `--pr-yellow-dark` / `--pr-yellow-accent` / `--pr-yellow-light` / `--pr-yellow-50` | `--pr-accent-hover` / `--pr-accent-deep` / `--pr-accent-tint` / `--pr-accent-tint-faint` |
| `--pr-gradient-yellow` / `--pr-gradient-sidebar` | `--pr-accent-gradient` / `--pr-sidebar-bg` |
| `--pr-glow-yellow*` | `--pr-glow-accent*` |
| `--pr-radius` (14px) / `--pr-radius-md` (18px) | `--pr-radius-md` / `--pr-radius-card` |
| `--pr-ease-crystal` | `--pr-ease` |
| `rounded-crystal*`, `shadow-crystal*` preset classes | `rounded-pr-*`, `shadow-pr-*` from the package preset |
| `.btn-primary`, `.crystal-card`, `.chip` recipe classes | `Button`, `Card`, `Badge` primitives |
