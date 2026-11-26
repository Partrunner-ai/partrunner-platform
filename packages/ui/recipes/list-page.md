# Recipe: List page

The person finds records, then acts on one.

This is the full source of a screen that compiles and is tested. Copy the structure and
the props. Replace the sample data with the data of the app.

- `./fixtures` is sample data and two format helpers (`formatMoney`, `formatDate`). Use the
  app's own data and its shared format helpers.
- `./states` is in `states.md`.
- The `state` prop exists only to show each state in the catalogue. In an app, the state
  comes from the data request.
- The rules are in `../DESIGN.md`.

<!-- Generated from packages/showcase/src/recipes/ListPageRecipe.tsx. Do not edit. -->

```tsx
import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Download, Plus, Truck, Timer } from 'lucide-react';
import {
  Badge,
  Button,
  DateRangeFilter,
  EMPTY_DATE_RANGE,
  FilterChip,
  FilterChipRow,
  MultiSelect,
  Page,
  PageHeader,
  Pagination,
  SearchField,
  Skeleton,
  StatTile,
  StatTileGrid,
  Table,
  TableFrame,
  TableSkeleton,
  Toolbar,
  ToolbarGroup,
  type DateRange,
} from '@partrunner-ai/ui';
import {
  PLACEMENTS,
  PLACEMENT_STATUS,
  PROJECTS,
  formatDate,
  formatMoney,
  type Placement,
  type PlacementStatus,
} from './fixtures';
import { ErrorNotice, ForbiddenState, NoResults, type RecipeProps } from './states';

const PAGE_SIZE = 8;

const DATE_LABELS = {
  allTime: 'Todo el tiempo',
  custom: 'Rango personalizado',
  from: 'Desde',
  to: 'Hasta',
  apply: 'Aplicar',
  clear: 'Limpiar',
  dialog: 'Filtrar por fechas',
};

const DATE_PRESETS = [
  { id: '7d', label: 'Últimos 7 días', range: { from: '2026-11-18', to: '2026-11-24' } },
  { id: 'month', label: 'Este mes', range: { from: '2026-11-01', to: '2026-11-30' } },
];

const PROJECT_OPTIONS = PROJECTS.map((project) => ({ value: project, label: project }));

const COLUMNS = [
  {
    key: 'driver',
    header: 'Conductor',
    render: (row: Placement) => row.driver,
  },
  { key: 'plate', header: 'Placa', render: (row: Placement) => row.plate, hideOnMobile: true },
  { key: 'fleet', header: 'Flota', render: (row: Placement) => row.fleet, hideOnMobile: true },
  { key: 'project', header: 'Proyecto', render: (row: Placement) => row.project, hideOnMobile: true },
  { key: 'date', header: 'Fecha', render: (row: Placement) => formatDate(row.date), hideOnMobile: true },
  {
    key: 'rate',
    header: 'Tarifa semanal',
    align: 'right' as const,
    render: (row: Placement) => formatMoney(row.weeklyRate),
  },
  {
    key: 'status',
    header: 'Estado',
    render: (row: Placement) => (
      <Badge tone={PLACEMENT_STATUS[row.status].tone}>{PLACEMENT_STATUS[row.status].label}</Badge>
    ),
  },
];

/** Recipe 2.1 · List page: header, stat tiles, status chips, toolbar, table, pagination. */
export function ListPageRecipe({ state, onRetry }: RecipeProps) {
  const [status, setStatus] = useState<'all' | PlacementStatus>('all');
  const [query, setQuery] = useState('');
  const [projects, setProjects] = useState<string[]>([]);
  const [range, setRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const [page, setPage] = useState(1);

  const source = useMemo(() => (state === 'empty' ? [] : PLACEMENTS), [state]);

  const counts = useMemo(() => {
    const result = { all: source.length, pending: 0, placed: 0, cancelled: 0 };
    for (const row of source) result[row.status] += 1;
    return result;
  }, [source]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return source.filter((row) => {
      if (status !== 'all' && row.status !== status) return false;
      if (projects.length > 0 && !projects.includes(row.project)) return false;
      if (range.from && row.date < range.from) return false;
      if (range.to && row.date > range.to) return false;
      if (!needle) return true;
      return [row.driver, row.plate, row.fleet].some((value) => value.toLowerCase().includes(needle));
    });
  }, [source, status, projects, range, query]);

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtered = status !== 'all' || query !== '' || projects.length > 0 || range.from !== '';

  const header = (
    <PageHeader
      title="Colocadas"
      subtitle="Conductores asignados a una flota y a un proyecto esta semana."
      actions={
        state === 'forbidden' ? undefined : (
          <Button icon={Plus} disabled={state === 'loading'}>
            Nueva colocada
          </Button>
        )
      }
    />
  );

  if (state === 'forbidden') {
    return (
      <Page width="wide">
        {header}
        <ForbiddenState who="el equipo de Operaciones" />
      </Page>
    );
  }

  if (state === 'loading') {
    return (
      <Page width="wide">
        {header}
        <StatTileGrid columns={4}>
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} shape="block" height={96} />
          ))}
        </StatTileGrid>
        <TableSkeleton rows={8} columns={7} label="Cargando colocadas" />
      </Page>
    );
  }

  return (
    <Page width="wide">
      {header}
      {state === 'error' ? <ErrorNotice what="las colocadas" onRetry={onRetry} /> : null}
      <StatTileGrid columns={4}>
        <StatTile label="Colocadas del mes" value={counts.all} icon={Truck} tone="neutral" hint="24 nov 2026" />
        <StatTile label="Confirmadas" value={counts.placed} icon={CheckCircle2} tone="green" />
        <StatTile label="Pendientes" value={counts.pending} icon={Clock} tone="amber" hint="Esperan confirmación" />
        <StatTile label="Tiempo promedio" value={counts.all === 0 ? '—' : '2.4 días'} icon={Timer} tone="neutral" hint="De solicitud a colocada" />
      </StatTileGrid>

      <FilterChipRow aria-label="Filtrar por estado">
        <FilterChip active={status === 'all'} count={counts.all} onClick={() => { setStatus('all'); setPage(1); }}>
          Todas
        </FilterChip>
        {(Object.keys(PLACEMENT_STATUS) as PlacementStatus[]).map((key) => (
          <FilterChip
            key={key}
            active={status === key}
            count={counts[key]}
            onClick={() => { setStatus(key); setPage(1); }}
          >
            {PLACEMENT_STATUS[key].label}
          </FilterChip>
        ))}
      </FilterChipRow>

      <Toolbar aria-label="Filtros de colocadas">
        <ToolbarGroup>
          <SearchField
            aria-label="Buscar colocada"
            placeholder="Buscar conductor o placa"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
          />
        </ToolbarGroup>
        <ToolbarGroup>
          <DateRangeFilter
            aria-label="Ventana de fechas"
            value={range}
            onChange={(next) => { setRange(next); setPage(1); }}
            presets={DATE_PRESETS}
            labels={DATE_LABELS}
            locale="es-MX"
            size="sm"
          />
          <MultiSelect
            variant="filter"
            aria-label="Filtrar por proyecto"
            placeholder="Proyecto"
            clearLabel="Quitar filtro"
            options={PROJECT_OPTIONS}
            value={projects}
            onChange={(next) => { setProjects(next); setPage(1); }}
          />
        </ToolbarGroup>
      </Toolbar>

      <TableFrame
        title="Colocadas"
        count={rows.length}
        countLabel={(count) => `${count} registros`}
        actions={
          <Button size="sm" variant="secondary" icon={Download}>
            Exportar CSV
          </Button>
        }
        footer={
          rows.length > PAGE_SIZE ? (
            <Pagination
              aria-label="Paginación de colocadas"
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={rows.length}
              onPageChange={setPage}
              labels={{
                previous: 'Página anterior',
                next: 'Página siguiente',
                summary: ({ start, end, totalItems }) => `${start}–${end} de ${totalItems}`,
              }}
            />
          ) : undefined
        }
      >
        <Table
          bare
          label="Colocadas"
          columns={COLUMNS}
          rows={pageRows}
          getRowKey={rowId}
          empty={
            filtered ? (
              <NoResults
                title="Ninguna colocada coincide"
                description="Cambia o quita los filtros para ver más registros."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setStatus('all');
                      setQuery('');
                      setProjects([]);
                      setRange(EMPTY_DATE_RANGE);
                    }}
                  >
                    Quitar filtros
                  </Button>
                }
              />
            ) : (
              <NoResults
                title="Aún no hay colocadas"
                description="Cuando asignes un conductor a una flota, aparecerá aquí."
              />
            )
          }
        />
      </TableFrame>
    </Page>
  );
}

function rowId(row: { id: string }): string {
  return row.id;
}
```
