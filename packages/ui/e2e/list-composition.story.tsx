import { useState } from 'react';
import { Boxes, Truck, Users } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  DateRangeFilter,
  Dialog,
  FilterChip,
  FilterChipRow,
  Page,
  PageHeader,
  Pagination,
  SearchField,
  SegmentedControl,
  StatTile,
  StatTileGrid,
  StatusDot,
  Table,
  TableBody,
  TableCell,
  TableFrame,
  TableHead,
  TableHeader,
  TableRow,
  Toolbar,
  ToolbarSpacer,
  type BadgeTone,
  type DateRange,
  type DateRangePreset,
} from '@partrunner-ai/ui';

type Status = 'all' | 'pending' | 'placed' | 'closed';
type View = 'all' | 'mine';

const PRESETS: DateRangePreset[] = [
  { id: '7d', label: 'Últimos 7 días', range: { from: '2026-08-26', to: '2026-09-02' } },
  { id: '30d', label: 'Últimos 30 días', range: { from: '2026-08-03', to: '2026-09-02' } },
];
const LABELS = {
  allTime: 'Todo el tiempo',
  custom: 'Personalizado',
  from: 'Desde',
  to: 'Hasta',
  apply: 'Aplicar',
  clear: 'Limpiar',
  dialog: 'Filtrar por fechas',
};
const ROWS: Array<{
  id: number;
  driver: string;
  project: string;
  status: Exclude<Status, 'all'>;
  label: string;
  tone: BadgeTone;
  mine: boolean;
}> = [
  { id: 1, driver: 'Daniela Ramírez', project: 'Mercado Libre', status: 'placed', label: 'Colocada', tone: 'success', mine: true },
  { id: 2, driver: 'José Luis Garza', project: 'Coppel', status: 'pending', label: 'Pendiente', tone: 'warning', mine: false },
  { id: 3, driver: 'Ricardo Peña', project: 'Walmart', status: 'placed', label: 'Colocada', tone: 'success', mine: true },
  { id: 4, driver: 'Mariana López', project: 'Home Depot', status: 'closed', label: 'Cerrada', tone: 'neutral', mine: false },
];
const CHIPS: Array<{ value: Status; label: string; tone: BadgeTone }> = [
  { value: 'all', label: 'Todos', tone: 'neutral' },
  { value: 'pending', label: 'Pendiente', tone: 'warning' },
  { value: 'placed', label: 'Colocada', tone: 'success' },
  { value: 'closed', label: 'Cerrada', tone: 'neutral' },
];

export function ListCompositionStory({
  mode = 'light',
  initialRange = { from: '', to: '' },
}: {
  mode?: 'light' | 'dark';
  initialRange?: DateRange;
}) {
  const [view, setView] = useState<View>('all');
  const [viewChanges, setViewChanges] = useState(0);
  const [status, setStatus] = useState<Status>('all');
  const [range, setRange] = useState<DateRange>(initialRange);
  const [page, setPage] = useState(1);
  const rows = ROWS.filter(
    (row) => (view === 'all' || row.mine) && (status === 'all' || row.status === status),
  );

  return (
    <main
      className={mode === 'dark' ? 'dark' : undefined}
      data-testid="list-composition-story"
      style={{ minHeight: '100vh', background: 'var(--pr-bg)', color: 'var(--pr-fg)' }}
    >
      <Page>
        <PageHeader
          eyebrow="Supply"
          title="Colocadas"
          actions={
            <SegmentedControl<View>
              aria-label="Vista"
              value={view}
              onChange={(next) => {
                setViewChanges((count) => count + 1);
                setView(next);
              }}
              options={[
                { value: 'all', label: 'Todas', count: ROWS.length },
                { value: 'mine', label: 'Mis', count: ROWS.filter((row) => row.mine).length },
              ]}
            />
          }
        />
        <StatTileGrid columns={3}>
          <StatTile label="Colocadas" value={128} icon={Truck} tone="blue" />
          <StatTile label="Pendientes" value={12} icon={Boxes} tone="amber" />
          <StatTile label="Nuevas" value={9} icon={Users} tone="green" />
        </StatTileGrid>
        <FilterChipRow aria-label="Estado">
          {CHIPS.map((chip) => (
            <FilterChip
              key={chip.value}
              active={status === chip.value}
              dot={chip.value !== 'all'}
              tone={chip.tone}
              count={
                chip.value === 'all'
                  ? ROWS.length
                  : ROWS.filter((row) => row.status === chip.value).length
              }
              onClick={() => setStatus(chip.value)}
            >
              {chip.label}
            </FilterChip>
          ))}
        </FilterChipRow>
        <Toolbar>
          <SearchField aria-label="Buscar" placeholder="Buscar conductor" />
          <DateRangeFilter
            aria-label="Fechas"
            value={range}
            onChange={setRange}
            presets={PRESETS}
            labels={LABELS}
            locale="es-MX"
          />
          <ToolbarSpacer />
          <Button size="sm" variant="ghost">
            Limpiar filtros
          </Button>
        </Toolbar>
        <TableFrame
          title={view === 'mine' ? 'Mis colocadas' : 'Todas las colocadas'}
          count={rows.length}
          countLabel={(count) => `${count} filas`}
          actions={
            <Button size="sm" variant="secondary">
              Exportar CSV
            </Button>
          }
          footer={
            <Pagination
              page={page}
              pageSize={20}
              totalItems={128}
              onPageChange={setPage}
              aria-label="Colocadas pages"
            />
          }
        >
          <Table aria-label="Colocadas" scrollLabel="Colocadas table" bare>
            <TableHeader>
              <TableRow>
                <TableHead>Conductor</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={row.driver} size="sm" decorative />
                      {row.driver}
                    </span>
                  </TableCell>
                  <TableCell>{row.project}</TableCell>
                  <TableCell>
                    <Badge tone={row.tone} dot>
                      {row.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableFrame>
        <StatusDot tone="success" label="Activo" />
      </Page>
      <output data-testid="list-state" hidden>
        {JSON.stringify({ view, viewChanges, status, range, page })}
      </output>
    </main>
  );
}

/** The date pill inside a package Dialog: the popover must escape the dialog body. */
export function ListFilterInDialogStory() {
  const [range, setRange] = useState<DateRange>({ from: '', to: '' });
  return (
    <Dialog open onClose={() => {}} title="Filtrar colocadas" description="Elige la ventana.">
      <DateRangeFilter
        aria-label="Fechas"
        value={range}
        onChange={setRange}
        presets={PRESETS}
        labels={LABELS}
        locale="es-MX"
      />
      <output data-testid="dialog-range" hidden>
        {JSON.stringify(range)}
      </output>
    </Dialog>
  );
}
