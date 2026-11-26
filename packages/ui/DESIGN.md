# Design manual for agents

How to build a PartRunner screen with `@partrunner-ai/ui`. Read this file before you write or
change a screen. In an app it is at `node_modules/@partrunner-ai/ui/DESIGN.md`.

This file describes the package version it ships with. If a component named here is not exported
by the version the app has installed, upgrade the package first. Do not build a local copy.

The visual language (palette, radii, shadows, type faces) is in `docs/crystal-guide.md` of the
platform repository. You do not need it to build a screen: the components already apply it.

## The rule

A screen is a **recipe** filled with **package components**. You do not write CSS for a screen.
If you write a class for colour or type, a `style`, a `<table>`, or a colour value, stop: a
component does that job.

## 1. Work method

Do these five steps in order. Do not start with code.

1. **Write the job in one sentence.** "A Finance analyst finds the fleets with an unpaid charge and
   makes a payment plan for one." The sentence names the person, the thing they look for, and the
   one action that matters most. That action is the screen's primary action.
2. **Pick one recipe** from section 2. If none fits, pick the nearest and change the least.
3. **Copy the recipe's full example** from `recipes/` in this package and fill it from the
   component table in section 3. Use the app's existing data and text.
4. **Write every state** from section 5: loading, empty, error, no permission.
5. **Look at the screen.** Run it, take a screenshot at 1440 px and at 390 px, and answer the
   checklist in section 8. Fix each "no". A screen you did not look at is not finished.

When you change an existing screen: keep its content, its flow and its words. Change the
structure only where a rule in this manual is broken.

## 2. Recipes

Each recipe has a full example that compiles, with all four states, in this package:

| Recipe | Use it when | Full example |
|---|---|---|
| List page | the person finds records, then acts on one | `recipes/list-page.md` |
| Inbox | the person works through many records, one open at a time | `recipes/inbox.md` |
| Record page | the person reads one record and acts on it | `recipes/record-page.md` |
| Form | the person creates or changes one record | `recipes/form.md` |
| Work queue | the person makes the same decision on many records | `recipes/work-queue.md` |

The skeletons below show the structure only. Take prop details from the full example.
`recipes/states.md` shows the four states of section 5 on one region.
`Page` spaces its direct children. Inside any other container use `Stack` for the gaps.

### 2.1 List page

```tsx
<Page>
  <PageHeader title="Colocadas" actions={<Button variant="primary">Nueva colocada</Button>} />
  <StatTileGrid columns={4}>…</StatTileGrid>            {/* optional, at most 4 tiles */}
  <FilterChipRow aria-label="Estado">…</FilterChipRow>  {/* optional, one field, ≤ 7 values */}
  <Toolbar>
    <SearchField aria-label="Buscar" placeholder="Buscar conductor o placa" />
    <DateRangeFilter aria-label="Ventana de fechas" value={range} onChange={setRange}
      presets={DATE_PRESETS} labels={DATE_LABELS} locale="es-MX" size="sm" />
    <MultiSelect variant="filter" aria-label="Filtrar por proyecto" placeholder="Proyecto"
      options={PROJECTS} value={projects} onChange={setProjects} />
  </Toolbar>
  <TableFrame title="Colocadas" count={total}
    footer={<Pagination aria-label="Paginación" page={page} pageSize={25} totalItems={total}
      onPageChange={setPage}
      labels={{ previous: 'Página anterior', next: 'Página siguiente',
        summary: ({ start, end, totalItems }) => `${start}–${end} de ${totalItems}` }} />}>
    <Table<Placement> bare label="Colocadas" rows={rows} getRowKey={(row) => row.id}
      loading={loading} empty={<EmptyState title="Sin colocadas en esta ventana" />}
      columns={[
        { key: 'driver', header: 'Conductor' },
        { key: 'date', header: 'Fecha', render: (row) => formatDate(row.date), hideOnMobile: true },
        { key: 'rate', header: 'Tarifa semanal', numeric: true, render: (row) => formatMoney(row.rate) },
        { key: 'status', header: 'Estado', render: (row) => <Badge tone={TONE[row.status]}>{LABEL[row.status]}</Badge> },
      ]} />
  </TableFrame>
</Page>
```

`Pagination`, `DateRangeFilter` and `MultiSelect` have English default labels: always pass the
Spanish ones. On a phone a table keeps 2 or 3 columns: set `hideOnMobile` on the rest.

### 2.2 Inbox

Use it for conversations, cases, tickets and document review. The list stays visible while the
person reads one record.

```tsx
<Page width="wide">
  <PageHeader title="Bandeja" />
  <Toolbar>
    <FilterChipRow aria-label="Vista">
      <FilterChip active={view === 'reply'} count={counts.reply} onClick={() => setView('reply')}>
        Esperan respuesta</FilterChip>
      <FilterChip active={view === 'overdue'} count={counts.overdue} tone="danger" dot
        onClick={() => setView('overdue')}>Vencidas</FilterChip>
      …
    </FilterChipRow>
    <ToolbarSpacer />
    <MultiSelect variant="filter" aria-label="Atiende" placeholder="Atiende"
      options={PEOPLE} value={people} onChange={setPeople} />
  </Toolbar>
  <SplitView
    listLabel="Flotas"
    listHeader={<SearchField aria-label="Buscar flota" placeholder="Buscar flota" />}
    list={
      <ItemList aria-label="Flotas">
        {fleets.map((fleet) => (
          <ItemRow key={fleet.id} selected={fleet.id === openId}
            tone={fleet.urgency ?? undefined} unread={fleet.nextStep === 'reply'}
            leading={<Avatar name={fleet.name} tone={toneFromString(fleet.id)} decorative />}
            title={fleet.name}
            trailing={fleet.urgency ? <Badge tone={fleet.urgency}>{fleet.signal}</Badge> : null}
            description={<><strong>{fleet.lastSpeaker}:</strong> {fleet.lastMessage}</>}
            meta={fleet.lastSeen}
            footer="2 aclaraciones · 1 chat · Atiende Ana Ruiz"
            href={`/bandeja?f=${fleet.id}`} LinkComponent={Link} />   {/* or onClick */}
        ))}
      </ItemList>
    }
    detailLabel="Conversación"
    detailOpen={openId != null}
    onBack={() => router.push('/bandeja')}
    detail={
      fleet == null
        ? <EmptyState icon={Inbox} title="Elige una flota" description="Aquí ves todo lo que tiene abierto." />
        : <Stack>
            <SectionHeading title={fleet.name} description={fleet.rfc}
              actions={<Button variant="secondary">Marcar resuelta</Button>} />
            <Tabs defaultValue="chat">
              <TabsList>
                <TabsTrigger value="chat">Conversación</TabsTrigger>
                <TabsTrigger value="cases">Aclaraciones</TabsTrigger>
                <TabsTrigger value="profile">Perfil</TabsTrigger>
              </TabsList>
              <TabsContent value="chat">…</TabsContent>
              <TabsContent value="cases">…</TabsContent>
              <TabsContent value="profile"><DetailList layout="inline">…</DetailList></TabsContent>
            </Tabs>
          </Stack>
    }
  />
</Page>
```

- When the open record is in the URL, the row is a link: `href` and the router's `LinkComponent`.
  Use `onClick` only when the selection is local state.
- An inbox for work is a ticket desk. Each row answers four questions: who (the `Avatar` and the
  title), what was said last and by whom (the description starts with the speaker: «Flota:»,
  «FDS:», «Dalia:»), how long it waits (a `Badge` with a tone in `trailing`), and what is open
  and who has it (the `footer`).
- Give each record one next step: ours to reply, ours to work, or theirs. Sort in that order.
  Urgency colour (`tone` on the row and on the badge) shows only when the next step is ours. A
  record that waits for the other side stays quiet.
- Filters go in a `Toolbar` above the `SplitView`: quick views with counts as `FilterChip`s,
  people and reasons as `MultiSelect variant="filter"`. The list heading shows the count
  («5 de 63 flotas»).
- In a conversation, every message shows who speaks: an `Avatar` and the name once for each
  group of messages. A person and a bot never look the same: use a different bubble tint and
  name. An event in the thread («Aclaración abierta») is a centred line with a `Badge` and a
  link, not a message bubble.
- More than 20 rows need a `SearchField` in `listHeader`.
- Items inside the detail pane are not cards (the pane already has a border). Use
  `SectionHeading`, `DetailList`, `Disclosure` and `Separator`.
- Chat bubbles and the message composer have no package component yet. They are the one place
  where app CSS is allowed: `--pr-*` tokens only, no `font-size`, no colour values.

### 2.3 Record page

```tsx
<Page>
  <PageHeader title={fleet.name} subtitle={`${fleet.rfc} · ${fleet.city}`}
    actions={<><Button variant="secondary">Editar datos</Button>
               <Button variant="primary">Crear plan de pago</Button></>} />
  {held ? <Notice tone="warning" title="Pago de la semana 47 retenido"
    actions={<Button variant="secondary" size="sm">Ver pagos</Button>}>
    Falta la constancia de situación fiscal vigente.</Notice> : null}
  <Card>
    <SectionHeading title="Datos generales" />
    <DetailList columns={3}>
      <DetailItem label="RFC">{fleet.rfc}</DetailItem>
      <DetailItem label="Régimen fiscal">{fleet.regime}</DetailItem>
      <DetailItem label="Saldo a cargo" numeric>{formatMoney(fleet.balance)}</DetailItem>
    </DetailList>
  </Card>
  <Tabs defaultValue="routes">…</Tabs>   {/* related lists: each panel is a TableFrame */}
</Page>
```

A record shown as a card in a list of cards (a payment plan, a case) has this order inside one
`Card`: `SectionHeading` (title, one `Badge` for the state) → `DetailList` → a `Table bare` if
the record has lines → one row of actions at the bottom (one primary, the rest in a
`DropdownMenu`). A `Table bare` inside a `Card` is not a nested box.

### 2.4 Form

- Up to 6 fields and no navigation away: `Dialog` (`size="md"`), actions in `footer`.
- A record edited beside its list: a `Sheet` on the right (`SheetRoot`, `SheetContent`).
- More than 6 fields or several sections: a page with `Page width="narrow"`.

```tsx
<Dialog open={open} onClose={close} title="Nuevo plan de pago"
  description="Define cuánto y en cuántas semanas se cobra el saldo."
  footer={<><Button variant="secondary" onClick={close}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={save}>Crear plan</Button></>}>
  <Stack>
    {failed ? <ValidationSummary errors={[
      { fieldId: 'plan-amount', label: 'Monto total', message: 'Escribe el monto total.' },
    ]} /> : null}
    <FormField label="Monto total" required error={errors.amount} controlId="plan-amount" fullWidth>
      <Input inputMode="decimal" value={amount} onChange={…} />
    </FormField>
    <FormField label="Primer cobro" hint="El cobro se hace cada semana." controlId="plan-start">
      <DatePicker … />
    </FormField>
  </Stack>
</Dialog>
```

One column. Labels above the fields. `FormField` wraps exactly one control and gives it the id
and the ARIA attributes. Each `ValidationSummary` error names the `fieldId` of its control, so
its link moves the focus there. Show the summary only after a failed submit. The primary button
says the result ("Crear plan"), not "Aceptar". A destructive action uses `ConfirmDialog
destructive`.

### 2.5 Work queue

Use it for approvals and reviews. It is a list page where each row has its action.

```tsx
<Page>
  <PageHeader title="Saldos a cargo" subtitle="8 saldos por revisar · $121,450.00 en total"
    actions={<SegmentedControl aria-label="Vista" value={view} onChange={setView}
      options={[{ value: 'review', label: 'Por revisar' }, { value: 'plans', label: 'Planes' }]} />} />
  <TableFrame title="Por revisar" count={rows.length}>
    <Table<Balance> bare label="Saldos por revisar" rows={rows} getRowKey={(row) => row.id}
      columns={[
        { key: 'fleet', header: 'Flota' },
        { key: 'amount', header: 'Saldo a cargo', numeric: true, render: (row) => formatMoney(row.amount) },
        { key: 'status', header: 'Estado', hideOnMobile: true,
          render: (row) => <Badge tone={TONE[row.status]}>{LABEL[row.status]}</Badge> },
        { key: 'actions', header: 'Acciones', align: 'end', render: (row) => (
          <ToolbarGroup>
            <Button size="sm" variant="secondary" onClick={() => plan(row)}>Crear plan</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton size="sm" variant="ghost" label={`Más acciones para ${row.fleet}`}
                  icon={<MoreHorizontal size={16} aria-hidden />} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => open(row)}>Ver ficha de la flota</DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => waive(row)}>Condonar saldo</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ToolbarGroup>
        ) },
      ]} />
  </TableFrame>
</Page>
```

A row shows at most one button. The other actions go in a `DropdownMenu` on an `IconButton`.
At most 7 columns; move the rest to the record page or a `Sheet`.

## 3. One job, one component

Do not choose between two components for one job. If a job is not in the table, see section 9.

| Job on the screen | Use | Not this |
|---|---|---|
| Page container: width and outer spacing | `Page` (the app shell already gives the `<main>`) | `max-w-*`, padding utilities, a second `<main>` |
| Page title block | `PageHeader` | a local header component, a hero card |
| Titled section inside a page | `SectionHeading` | `PageHeader` twice |
| Gap between your own blocks | `Stack` (`gap`: `xs` 4, `sm` 8, `md` 12, `lg` 16 or `xl` 24 px) | margin utilities, a flex `div` with a class |
| KPI figures in a row | `StatTile` in `StatTileGrid` | `Card` with a big number |
| Move between **routes** | `NavigationTabs` (`currentPath`, `items`, the router's `LinkComponent`) | `Tabs`, buttons with `role="tab"` |
| **Parts of one record** or one section, each with its own content | `Tabs` | `SegmentedControl` |
| **Which list or view** the page shows (Todas / Mías, Por revisar / Planes, lista / tablero) | `SegmentedControl` | two `Button`s with `aria-pressed` |
| Filter on one field, ≤ 7 values, with counts | `FilterChip` in `FilterChipRow` | `Badge` as a button |
| Any other filter | `MultiSelect variant="filter"` | one select per filter |
| Date window of a list | `DateRangeFilter` | two date inputs |
| Date field in a form | `DatePicker` | `DateRangeFilter` |
| Row of controls above a list | `Toolbar` + `SearchField`, `ToolbarGroup`, `ToolbarSpacer` | a flex `div` |
| Table on a page | `TableFrame` around `Table` (+ `Pagination` in `footer`) | `<table>` with class constants |
| List beside the open record (inbox, cases) | `SplitView` | a hand-made two-column grid |
| Rows of the list in a `SplitView` or a side panel | `ItemList` + `ItemRow` | `<button>` rows with local CSS |
| Facts of one record: label and value | `DetailList` + `DetailItem` | `<dl>`, a two-column `div` grid, a two-column table |
| Content that opens and closes | `Disclosure` | `<details>`, a button with `aria-expanded` |
| Message about the page or a section (hold, warning, result) | `Notice tone` | a coloured `div`, red text, a toned `Card` |
| Confirm a risky action | `ConfirmDialog` | `window.confirm`, a local modal |
| Form field with label, hint, error | `FormField` around one control | a `<label>` and a `<p>` |
| Short form or a decision | `Dialog` | a local `Modal` |
| Edit beside the page content | `Sheet` (`SheetRoot`, `SheetContent`) | a second page |
| Nothing to show | `EmptyState` | a `<p>` |
| Loading a table | `Table loading`, or `TableSkeleton` with the compound table | "Cargando…" text |
| Loading a page | `PageSkeleton variant` | a centred spinner |
| Status or category label | `Badge tone` | a span with colour classes |
| Tone dot beside text | `StatusDot` | `Badge dot` with no text |
| Person by initials | `Avatar` | an initials span |
| Internal comments on one record | `CommentThread` | a list of cards and a textarea |
| Link in a sentence or beside a title | `Button variant="link"` (`asChild` around the router link) | a bare `<a>` |
| Icon in a tinted chip | `IconTile` | a hand-tinted span |
| Stable colour for an entity | `toneFromString(seed)` | a hex value |

### Ordered tie-breaks

Run them top to bottom and stop at the first match.

1. Does the option change the URL path? → `NavigationTabs`.
2. Is it a part of one open record or one section (Conversación / Perfil)? → `Tabs`.
3. Does it change which list or which view of the data the page shows? → `SegmentedControl`.
4. Is it a filter? One field, ≤ 7 values, counts shown → `FilterChip`. A date window →
   `DateRangeFilter`. Anything else → `MultiSelect variant="filter"`.
5. Is it a table? Uniform records → `Table columns rows` with `loading` / `empty` / `error`.
   Custom rows → compound `Table`, `TableSkeleton`, `EmptyState`. Both go in `TableFrame`.

A page has at most two levels of navigation, and they never look the same. The first level is
`NavigationTabs`. The second level is a `SegmentedControl` or `FilterChip`s. `Tabs` belong to a
record, below its heading.

Status-to-tone maps stay in the app as data (`{ pending: 'warning' }`) and feed `Badge tone`.
Do not store class names in a map.

### Props that surprise

- `IconButton icon` is an element (`<MoreHorizontal size={16} aria-hidden />`). `EmptyState icon`
  is a component (`icon={Inbox}`).
- The data-driven `Table` needs its row type: `<Table<Row> … getRowKey={(row) => row.id} />`.
  Its `label` names the table for a screen reader.
- `TableFrame count` shows a number; `countLabel={(count) => `${count} planes`}` changes its text.
- `SegmentedControl` is as wide as its options. Pass `fullWidth` only inside a narrow panel.
- `ItemRow tone` marks urgency with an accent bar on the start edge; pair it with a `Badge`, so
  colour is never the only signal. `ItemRow footer` is the third line; it takes text, not
  buttons.
- Numbers: `numeric` on a table column, on `TableCell` / `TableHead`, and on `DetailItem`
  aligns to the end edge with tabular figures.

## 4. Hierarchy and density

A good screen shows what matters first and makes the rest quiet. Use these limits.

| Rule | Limit |
|---|---|
| Page chrome above the first row of content (header, tabs, filters) | at most 25 % of a 1440 × 900 window |
| `PageHeader` | a title; a `subtitle` only for the record's key fact; no `eyebrow` that repeats the menu or the tabs; no explanation paragraph |
| `Button variant="primary"` | one in each view (a dialog is its own view) |
| Visible buttons in one row, card or toolbar | 2; the rest in a `DropdownMenu` |
| Text levels in one region | 3: title, body, meta |
| Tones other than neutral in one region | 2; a tone means a state, never decoration |
| Table columns | 7 |
| `StatTile`s | 4 |
| Nested bordered boxes (a card in a card) | 0; use `SectionHeading` and `Separator` inside one card |

- **Colour is a signal.** `danger` = blocked or lost money. `warning` = needs action soon.
  `success` = done. `info` = neutral news. If more than about 1 row in 5 has a tone, the rule that
  sets the tone is wrong.
- **Numbers** align to the end edge (`numeric`) and use one format in the whole app, from the
  app's shared helper: money `$12,400.00` (`es-MX`, MXN), dates `24 nov 2026`, a time of the
  same year `24 nov, 13:20`, relative time only for the last 7 days (`hace 3 h`).
- **Text does not get cut inside a card.** One line of `ItemRow description` may truncate. A
  paragraph wraps. A long field goes to its own `DetailItem span="full"`.
- **Group, do not run on.** Three or more facts are a `DetailList`, not a sentence with labels
  ("Motivo… Responsable… Estatus…").
- **Spacing** comes from the components and from `Stack`. Layout-only utility classes of the
  app are allowed for what `Stack` cannot do: a grid of columns, `hidden` at a breakpoint,
  `sr-only`. Classes for colour, type, radius, shadow or an arbitrary value are not.

## 5. States

Each data region has four states. Write all four before you call the screen finished.

| State | Show | Never |
|---|---|---|
| Loading | `Table loading` / `TableSkeleton` / `PageSkeleton` / `Skeleton` in the shape of the content | a text line, a layout that jumps |
| Empty | `EmptyState` with a title that says why, and the action that fills it | an empty table with headers only |
| Error | `Notice tone="danger"` with what failed, and a "Reintentar" `Button` in `actions` | red text, a raw error code |
| No permission | `EmptyState` in place of the content: the title says who can use it ("Solo Finanzas puede ver esta sección"), the description says how to get access. Hide the tabs, filters and actions the person cannot use | an error style; controls that do nothing |

A saved change answers at once: the button shows `loading`, then the row changes. A result that
the person must read is a `Notice tone="success"` near the place of the action.

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

- `<table>`, `<details>`, `<dialog>`, `<dl>`, `role="tablist"`, `role="tab"`, `aria-pressed`
  toggles and `aria-expanded` buttons written by hand.
- A `style={…}` prop, or a new CSS rule for the colour, type or spacing of a screen.
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

To get the screenshots, render the screen in the app's browser tests with mocked data for each
state, at 1440 × 900 and 390 × 844. Never point a test at a backend that can write or send.
Open each image and look at it: alignment, even spacing, cut text, too many accents.

Put the two main screenshots in the pull request. A reviewer checks them against this list.

## 9. When a component is missing

First check the installed version: the component may exist in a newer release. Upgrade, then use
it.

If no release has it, do not build it in the app. Open an issue or a pull request in
`partrunner-platform` when the pattern is presentation only and at least two screens need it.
Until it is released, compose the nearest package components and mark the place with
`// TODO(ui): <component name>`.
