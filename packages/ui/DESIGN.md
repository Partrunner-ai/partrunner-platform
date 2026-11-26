# Design manual for agents

How to build a PartRunner screen with `@partrunner-ai/ui`. Read this file before you write or
change a screen. In an app it is at `node_modules/@partrunner-ai/ui/DESIGN.md`.

The visual language (palette, radii, shadows, type faces) is in `docs/crystal-guide.md` of the
platform repository. You do not need it to build a screen: the components already apply it.

## The rule

A screen is a **recipe** filled with **package components**. You do not write CSS for a screen.
If you write a class, a `style`, a `<table>`, or a colour, stop: a component does that job.

## 1. Work method

Do these five steps in order. Do not start with code.

1. **Write the job in one sentence.** "A Finance analyst finds the fleets with an unpaid charge and
   makes a payment plan for one." The sentence names the person, the thing they look for, and the
   one action that matters most. That action is the screen's primary action.
2. **Pick one recipe** from section 2. If none fits, pick the nearest and change the least.
3. **Fill the recipe from the component table** in section 3. Use the app's existing data and text.
4. **Write every state** from section 5: loading, empty, error, no permission.
5. **Look at the screen.** Run it, take a screenshot at 1440 px and at 390 px, and answer the
   checklist in section 8. Fix each "no". A screen you did not look at is not finished.

When you change an existing screen: keep its content, its flow and its words. Change the
structure only where a rule in this manual is broken.

## 2. Recipes

Every recipe starts with `Page` and `PageHeader`. The comments say what goes in each slot.

### 2.1 List page — find records, then act on one

```tsx
<Page>
  <PageHeader title="Colocadas" actions={<Button variant="primary">Nueva colocada</Button>} />
  <StatTileGrid columns={3}>…</StatTileGrid>          {/* optional, at most 4 tiles */}
  <FilterChipRow aria-label="Estado">…</FilterChipRow>  {/* optional, one field, ≤ 7 values */}
  <Toolbar>
    <SearchField aria-label="Buscar" placeholder="Buscar conductor o placa" />
    <DateRangeFilter … />
    <MultiSelect variant="filter" … />
    <ToolbarSpacer />
  </Toolbar>
  <TableFrame title="Todas las colocadas" count={total} footer={<Pagination … />}>
    {loading ? <TableSkeleton rows={6} columns={4} label="Cargando tabla" />
      : rows.length === 0 ? <EmptyState title="Sin colocadas en esta ventana" />
      : <Table aria-label="Colocadas" bare>…</Table>}
  </TableFrame>
</Page>
```

### 2.2 Inbox — work through many records, one open at a time

Use it for conversations, cases, tickets, review of documents. The list stays visible while the
person reads one record.

```tsx
<Page width="wide">
  <PageHeader title="Bandeja" actions={<SegmentedControl aria-label="Vista" … />} />
  <SplitView
    listLabel="Flotas"
    listHeader={<SearchField aria-label="Buscar flota" placeholder="Buscar flota" />}
    list={
      <ItemList aria-label="Flotas">
        {fleets.map((f) => (
          <ItemRow key={f.id} selected={f.id === id} unread={f.unread > 0}
            title={f.name} description={f.lastMessage} meta={f.lastSeen}
            trailing={f.unread > 0 ? <Badge tone="warning">{f.unread}</Badge> : null}
            onClick={() => select(f.id)} />
        ))}
      </ItemList>
    }
    detailLabel="Conversación"
    detailOpen={id != null}
    onBack={() => select(null)}
    detail={
      id == null
        ? <EmptyState title="Elige una flota" description="La conversación se muestra aquí." />
        : <>
            <SectionHeading title={fleet.name} description={fleet.rfc} actions={…} />
            <Tabs defaultValue="hilo">…</Tabs>       {/* panels of the open record */}
          </>
    }
  />
</Page>
```

Rules for the list: sort by what needs attention first. Mark **only** the rows that need
attention (`unread`, one `Badge`). If every row has the same warning, the warning is noise: remove
it and show the fact as `meta` text. More than 20 rows need a `SearchField`.

### 2.3 Record page — read one record and act on it

```tsx
<Page>
  <PageHeader title={fleet.name} subtitle={fleet.rfc}
    actions={<><Button variant="secondary">Editar</Button><Button variant="primary">Pagar</Button></>} />
  <Notice tone="warning" title="Pago retenido">Falta la constancia fiscal.</Notice>  {/* only if true */}
  <Card>
    <SectionHeading title="Datos fiscales" />
    <DetailList columns={3}>
      <DetailItem label="RFC">{fleet.rfc}</DetailItem>
      <DetailItem label="Régimen">{fleet.regime}</DetailItem>
      <DetailItem label="Saldo" numeric>{money(fleet.balance)}</DetailItem>
    </DetailList>
  </Card>
  <Tabs defaultValue="rutas">…</Tabs>   {/* related lists: each panel is a TableFrame */}
</Page>
```

### 2.4 Form — create or change one record

- Up to 6 fields and no navigation away: `Dialog` (`size="md"`), actions in `footer`.
- A record edited beside its list: `Sheet` on the right.
- More than 6 fields or several sections: a page with `Page width="narrow"`.

```tsx
<Dialog open={open} onClose={close} title="Nuevo plan de pago"
  footer={<><Button variant="ghost" onClick={close}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={save}>Crear plan</Button></>}>
  <ValidationSummary errors={errors} />              {/* only after a failed submit */}
  <FormField label="Monto" required error={errors.amount}><Input inputMode="decimal" /></FormField>
  <FormField label="Primera fecha" hint="El cobro se hace cada semana."><DatePicker … /></FormField>
</Dialog>
```

One column. Labels above the fields. The primary button says the result ("Crear plan"), not
"Aceptar". A destructive action uses `ConfirmDialog destructive`.

### 2.5 Work queue — the same decision on many records

Use it for approvals and reviews. It is a list page where each row has its action.

```tsx
<Page>
  <PageHeader title="Saldos a cargo" />
  <NavigationTabs … />                       {/* only if the queues are routes */}
  <TableFrame title="Por revisar" count={rows.length}>
    <Table aria-label="Saldos por revisar" bare>
      …
      <TableCell align="right">
        <Button size="sm" variant="secondary">Crear plan</Button>     {/* ONE visible action */}
        <DropdownMenu>…</DropdownMenu>                                  {/* the other actions */}
      </TableCell>
    </Table>
  </TableFrame>
</Page>
```

A row shows at most one button. The other actions go in a `DropdownMenu` on an `IconButton`
(`MoreHorizontal`). At most 7 columns; move the rest to the record page or a `Sheet`.

## 3. One job, one component

Do not choose between two components for one job. If a job is not in the table, see section 9.

| Job on the screen | Use | Not this |
|---|---|---|
| Page container: width and outer spacing | `Page` | `max-w-*`, padding utilities, a styled `<main>` |
| Page title block | `PageHeader` | a local header component, a hero card |
| Titled section inside a page | `SectionHeading` | `PageHeader` twice |
| KPI figures in a row | `StatTile` in `StatTileGrid` | `Card` with a big number |
| Move between **routes** | `NavigationTabs` | `Tabs`, buttons with `role="tab"` |
| Switch between **panels with their own content** | `Tabs` | `SegmentedControl` |
| **Same data**, other subset or view (Todas/Mis, lista/tablero) | `SegmentedControl` | two `Button`s with `aria-pressed` |
| Filter on one field, ≤ 7 values, with counts | `FilterChip` in `FilterChipRow` | `Badge` as a button |
| Any other filter | `MultiSelect variant="filter"` | one select per filter |
| Date window of a list | `DateRangeFilter` | two date inputs |
| Date field in a form | `DatePicker` | `DateRangeFilter` |
| Row of controls above a list | `Toolbar` + `SearchField`, `ToolbarGroup`, `ToolbarSpacer` | a flex `div` |
| Table on a page | `TableFrame` around `Table` (+ `Pagination` in `footer`) | `<table>` with class constants |
| List beside the open record (inbox, cases) | `SplitView` | a hand-made two-column grid |
| Rows of the list in a `SplitView` or a side panel | `ItemList` + `ItemRow` | `<button>` rows with local CSS |
| Facts of one record: label and value | `DetailList` + `DetailItem` | `<dl>`, a two-column `div` grid, `<details>` |
| Message about the page or a section (hold, warning, result) | `Notice tone` | a coloured `div`, red text |
| Confirm a risky action | `ConfirmDialog` | `window.confirm`, a local modal |
| Form field with label, hint, error | `FormField` around one control | a `<label>` and a `<p>` |
| Short form or a decision | `Dialog` | a local `Modal` |
| Edit beside the page content | `Sheet` | a second page |
| Nothing to show | `EmptyState` | a `<p>` |
| Loading a table | `TableSkeleton` | "Cargando…" text |
| Loading a page | `PageSkeleton variant` | a centred spinner |
| Status or category label | `Badge tone` | a span with colour classes |
| Tone dot beside text | `StatusDot` | `Badge dot` with no text |
| Person by initials | `Avatar` | an initials span |
| Internal comments on one record | `CommentThread` | a list of cards and a textarea |
| Icon in a tinted chip | `IconTile` | a hand-tinted span |
| Stable colour for an entity | `toneFromString(seed)` | a hex value |

### Ordered tie-breaks

Run them top to bottom and stop at the first match.

1. Does the option change the URL? → `NavigationTabs`.
2. Does each option show its own content, not the same rows? → `Tabs`.
3. Same dataset, other subset, representation or granularity? → `SegmentedControl`.
4. Is it a filter? One field, ≤ 7 values, counts shown → `FilterChip`. A date window →
   `DateRangeFilter`. Anything else → `MultiSelect variant="filter"`.
5. Is it a table? Uniform records → `Table columns rows` with `loading` / `empty` / `error`.
   Custom cells → compound `Table`, `TableSkeleton`, `EmptyState`. Both go in `TableFrame`.

Never put two rows of tabs one above the other. The first level is `NavigationTabs`; the second
level is a `SegmentedControl` or `FilterChip`s.

Status-to-tone maps stay in the app as data (`{ pending: 'warning' }`) and feed `Badge tone`.
Do not store class names in a map.

## 4. Hierarchy and density

A good screen shows what matters first and makes the rest quiet. Use these limits.

| Rule | Limit |
|---|---|
| Page chrome above the first row of content (header, tabs, filters) | at most 25 % of a 1440 × 900 window |
| `PageHeader` | a title; a `subtitle` only for the record's key fact; no explanation paragraph |
| `Button variant="primary"` | one in each view (a dialog is its own view) |
| Visible buttons in one row, card or toolbar | 2; the rest in a `DropdownMenu` |
| Text levels in one region | 3: title (650), body (`--pr-fg`), meta (`--pr-fg-muted`) |
| Tones other than neutral in one region | 2; a tone means a state, never decoration |
| Table columns | 7 |
| `StatTile`s | 4 |
| Nested bordered boxes (a card in a card) | 0; use `SectionHeading` and `Separator` inside one card |

- **Colour is a signal.** `danger` = blocked or lost money. `warning` = needs action soon.
  `success` = done. `info` = neutral news. If more than about 1 row in 5 has a tone, the rule that
  sets the tone is wrong.
- **Numbers** align to the end edge in tables (`align="right"`) and use the same format in the
  whole app: money `$12,400.00` (`es-MX`, MXN), dates `24 nov 2026`, relative time only for the
  last 7 days (`hace 3 h`).
- **Text does not get cut inside a card.** One line of `ItemRow description` may truncate. A
  paragraph wraps. A long field goes to its own `DetailItem span="full"`.
- **Group, do not run on.** Three or more facts are a `DetailList`, not a sentence with labels
  ("Motivo… Responsable… Estatus…").
- **Links** are `Button variant="link"` or the app's router link with the package style. Never a
  bare `<a>` with the browser's blue.
- **Spacing** comes from the components. Between your own blocks use only 8, 12, 16 or 24 px.

## 5. States

Each data region has four states. Write all four before you call the screen finished.

| State | Show | Never |
|---|---|---|
| Loading | `TableSkeleton` / `PageSkeleton` / `Skeleton` in the shape of the content | a text line, a layout that jumps |
| Empty | `EmptyState` with a title that says why, and the action that fills it | an empty table with headers only |
| Error | `Notice tone="danger"` with what failed and a "Reintentar" `Button` | red text, a raw error code |
| No permission | the page with an `EmptyState` ("Solo Finanzas puede ver esta sección") in place of the content; hide tabs and actions the person cannot use | an error style; controls that do nothing |

A saved change answers in under 100 ms: the button shows `loading`, then the row changes. A
result that the person must read is a `Notice tone="success"` near the place of the action.

## 6. Text on the screen

- Staff and fleet screens are in Spanish. Sentence case: "Crear plan", not "Crear Plan".
- A button is a verb plus the object: "Crear plan", "Reabrir semana". Not "Aceptar", "OK".
- A title is the name of the thing: "Saldos a cargo". Do not explain the screen under it.
- Help text is one line next to the field or the control it explains. No instruction paragraphs.
- An error says what happened and what to do: "No se guardó el plan. Revisa el monto e intenta
  de nuevo." Do not show codes, table names or stack text.
- One word for one thing in the whole app. Do not mix "flota", "transportista" and "proveedor".

## 7. Do not

Each of these is a defect. Search your diff for them before you finish.

- `<table>`, `<details>`, `<dialog>`, `role="tablist"`, `role="tab"`, `aria-pressed` toggles
  written by hand.
- A `style={…}` prop or a new CSS rule for layout, colour, type or spacing of a screen.
- Tailwind palette or arbitrary-value classes: `text-red-700`, `bg-amber-50`, `text-[13px]`.
- A hex or `rgb()` colour. A `font-size` in app CSS.
- A local copy of a package component: `Modal`, `StatTile`, `PageHeader`, `Toolbar`, `StatusPill`,
  `Field`, `LoadingBlock`.
- Overrides of `.pr-*` classes or `--pr-*` variables.
- A local money or date format that differs from the app's shared helper.

## 8. Checklist — answer with the screenshot open

1. Can a new person say what the screen is for in 3 seconds?
2. Is the most important action the only primary button, and is it visible without scroll?
3. Does the content start in the top quarter of the window?
4. Does each tone mark something that needs attention, and only that?
5. Are there at most three text levels in each region, and no text cut by mistake?
6. Is every block a package component (no rule from section 7 broken)?
7. Do loading, empty, error and no-permission states exist and look right?
8. Does the screen work at 390 px wide (one column, no horizontal scroll except inside a table)?
9. Can you do the main job with the keyboard only, with a visible focus ring?
10. Is each label a real word the team uses, in sentence case?

Put the two screenshots in the pull request. A reviewer checks them against this list.

## 9. When a component is missing

Do not build it in the app. Open an issue or a pull request in `partrunner-platform` when the
pattern is presentation only and at least two screens need it. Until it is released, compose
the nearest package components and mark the place with `// TODO(ui): <component name>`.
