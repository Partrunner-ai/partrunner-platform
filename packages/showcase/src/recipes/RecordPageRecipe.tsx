import { Pencil, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DetailItem,
  DetailList,
  Notice,
  Page,
  PageHeader,
  PageSkeleton,
  SectionHeading,
  Table,
  TableFrame,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@partrunner-ai/ui';
import {
  FLEET_CHARGES,
  FLEET_PAYMENTS,
  FLEET_RECORD,
  FLEET_ROUTES,
  formatDate,
  formatMoney,
} from './fixtures';
import { ErrorNotice, ForbiddenState, NoResults, type RecipeProps } from './states';

const ROUTE_COLUMNS = [
  { key: 'route', header: 'Ruta', render: (row: (typeof FLEET_ROUTES)[number]) => row.route },
  { key: 'project', header: 'Proyecto', render: (row: (typeof FLEET_ROUTES)[number]) => row.project, hideOnMobile: true },
  { key: 'date', header: 'Fecha', render: (row: (typeof FLEET_ROUTES)[number]) => formatDate(row.date), hideOnMobile: true },
  { key: 'units', header: 'Unidades', align: 'right' as const, render: (row: (typeof FLEET_ROUTES)[number]) => row.units, hideOnMobile: true },
  { key: 'amount', header: 'Importe', align: 'right' as const, render: (row: (typeof FLEET_ROUTES)[number]) => formatMoney(row.amount) },
  {
    key: 'status',
    header: 'Estado',
    render: (row: (typeof FLEET_ROUTES)[number]) => (
      <Badge tone={row.status === 'done' ? 'success' : 'neutral'}>{row.status === 'done' ? 'Cerrada' : 'En curso'}</Badge>
    ),
  },
];

const CHARGE_COLUMNS = [
  { key: 'concept', header: 'Concepto', render: (row: (typeof FLEET_CHARGES)[number]) => row.concept },
  { key: 'week', header: 'Semana', render: (row: (typeof FLEET_CHARGES)[number]) => row.week, hideOnMobile: true },
  { key: 'date', header: 'Fecha', render: (row: (typeof FLEET_CHARGES)[number]) => formatDate(row.date), hideOnMobile: true },
  { key: 'amount', header: 'Monto', align: 'right' as const, render: (row: (typeof FLEET_CHARGES)[number]) => formatMoney(row.amount) },
  {
    key: 'status',
    header: 'Estado',
    render: (row: (typeof FLEET_CHARGES)[number]) => (
      <Badge tone={row.status === 'applied' ? 'success' : 'warning'}>{row.status === 'applied' ? 'Aplicado' : 'Pendiente'}</Badge>
    ),
  },
];

const PAYMENT_COLUMNS = [
  { key: 'week', header: 'Semana', render: (row: (typeof FLEET_PAYMENTS)[number]) => row.week },
  { key: 'date', header: 'Fecha de pago', render: (row: (typeof FLEET_PAYMENTS)[number]) => formatDate(row.date), hideOnMobile: true },
  { key: 'amount', header: 'Monto', align: 'right' as const, render: (row: (typeof FLEET_PAYMENTS)[number]) => formatMoney(row.amount) },
  {
    key: 'status',
    header: 'Estado',
    render: (row: (typeof FLEET_PAYMENTS)[number]) => (
      <Badge tone={row.status === 'paid' ? 'success' : 'warning'}>{row.status === 'paid' ? 'Pagado' : 'Retenido'}</Badge>
    ),
  },
];

/** Recipe 2.2 · Record page: header, notice, summary card, tabs with tables. */
export function RecordPageRecipe({ state, onRetry }: RecipeProps) {
  const fleet = FLEET_RECORD;

  if (state === 'loading') {
    return (
      <Page width="wide">
        <PageSkeleton variant="detail" label="Cargando flota" />
      </Page>
    );
  }
  if (state === 'forbidden') {
    return (
      <Page width="wide">
        <PageHeader title="Ficha de flota" />
        <ForbiddenState who="Finanzas y Soporte a flotas" />
      </Page>
    );
  }
  if (state === 'empty') {
    return (
      <Page width="wide">
        <PageHeader title="Ficha de flota" />
        <NoResults
          title="No encontramos esta flota"
          description="El enlace puede estar incompleto o la flota ya no existe."
          action={<Button variant="secondary">Ver todas las flotas</Button>}
        />
      </Page>
    );
  }

  return (
    <Page width="wide">
      <PageHeader
        eyebrow="Flotas"
        title={fleet.name}
        subtitle={`${fleet.rfc} · ${fleet.city}`}
        actions={
          <>
            <Button variant="secondary" icon={Pencil}>
              Editar datos
            </Button>
            <Button icon={Plus}>Crear plan de pago</Button>
          </>
        }
      />
      {state === 'error' ? <ErrorNotice what="la ficha de la flota" onRetry={onRetry} /> : null}
      <Notice
        tone="warning"
        title="Pago de la semana 47 retenido"
        actions={
          <Button size="sm" variant="secondary">
            Ver pagos
          </Button>
        }
      >
        Falta la constancia de situación fiscal vigente. Se libera cuando Finanzas la valide.
      </Notice>

      <Card>
        <SectionHeading title="Datos generales" description={fleet.note} />
        <DetailList columns={3}>
          <DetailItem label="RFC">{fleet.rfc}</DetailItem>
          <DetailItem label="Régimen fiscal">{fleet.regime}</DetailItem>
          <DetailItem label="Código postal">{fleet.zip}</DetailItem>
          <DetailItem label="Unidades activas" numeric>
            {fleet.units}
          </DetailItem>
          <DetailItem label="Saldo a cargo" numeric>
            {formatMoney(fleet.balance)}
          </DetailItem>
          <DetailItem label="Cliente desde">{formatDate(fleet.since)}</DetailItem>
          <DetailItem label="CLABE">{fleet.clabe}</DetailItem>
          <DetailItem label="Contacto" span={2}>
            {fleet.contact}
          </DetailItem>
        </DetailList>
      </Card>

      <Tabs defaultValue="routes">
        <TabsList>
          <TabsTrigger value="routes">Rutas</TabsTrigger>
          <TabsTrigger value="charges">Cargos</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
        </TabsList>
        <TabsContent value="routes">
          <TableFrame title="Rutas de la semana" count={FLEET_ROUTES.length} countLabel={(count) => `${count} rutas`}>
            <Table bare label="Rutas" columns={ROUTE_COLUMNS} rows={FLEET_ROUTES} getRowKey={rowId} />
          </TableFrame>
        </TabsContent>
        <TabsContent value="charges">
          <TableFrame title="Cargos y descuentos" count={FLEET_CHARGES.length} countLabel={(count) => `${count} cargos`}>
            <Table bare label="Cargos" columns={CHARGE_COLUMNS} rows={FLEET_CHARGES} getRowKey={rowId} />
          </TableFrame>
        </TabsContent>
        <TabsContent value="payments">
          <TableFrame title="Historial de pagos" count={FLEET_PAYMENTS.length} countLabel={(count) => `${count} pagos`}>
            <Table bare label="Pagos" columns={PAYMENT_COLUMNS} rows={FLEET_PAYMENTS} getRowKey={rowId} />
          </TableFrame>
        </TabsContent>
      </Tabs>
    </Page>
  );
}

function rowId(row: { id: string }): string {
  return row.id;
}
