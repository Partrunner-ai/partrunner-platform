import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Notice,
  Page,
  PageHeader,
  SegmentedControl,
  Table,
  TableFrame,
  TableSkeleton,
  ToolbarGroup,
} from '@partrunner-ai/ui';
import {
  BALANCES,
  BALANCE_STATUS,
  PAYMENT_PLANS,
  formatDate,
  formatMoney,
  type Balance,
  type PaymentPlan,
} from './fixtures';
import { ErrorNotice, ForbiddenState, NoResults, type RecipeProps } from './states';

type Queue = 'review' | 'plans';

/** Recipe 2.5 · Work queue: queue switch, table with one primary row action and a menu. */
export function WorkQueueRecipe({ state, onRetry }: RecipeProps) {
  const [queue, setQueue] = useState<Queue>('review');
  const [balances, setBalances] = useState<Balance[]>(BALANCES);
  const [plans, setPlans] = useState<PaymentPlan[]>(PAYMENT_PLANS);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reviewRows = state === 'empty' ? [] : balances;
  const planRows = state === 'empty' ? [] : plans;
  const total = reviewRows.reduce((sum, row) => sum + row.amount, 0);

  const createPlan = (row: Balance) => {
    setPendingId(row.id);
    window.setTimeout(() => {
      setPendingId(null);
      setBalances((current) => current.filter((item) => item.id !== row.id));
      setPlans((current) => [
        { id: `new-${row.id}`, fleet: row.fleet, weekly: Math.round(row.amount / 8), progress: '0 de 8', next: '2026-12-01', status: 'active' },
        ...current,
      ]);
      setMessage(`Plan creado para ${row.fleet}. El primer cobro es el 1 dic 2026.`);
    }, 700);
  };

  const switcher = (
    <SegmentedControl<Queue>
      aria-label="Cola"
      value={queue}
      onChange={setQueue}
      options={[
        { value: 'review', label: 'Por revisar', count: state === 'loading' ? undefined : reviewRows.length },
        { value: 'plans', label: 'Planes', count: state === 'loading' ? undefined : planRows.length },
      ]}
    />
  );

  const header = (
    <PageHeader
      actions={state === 'forbidden' ? undefined : switcher}
      title="Saldos a cargo"
      subtitle={
        state === 'data' || state === 'error'
          ? `${reviewRows.length} saldos por revisar · ${formatMoney(total)} en total`
          : 'Saldos de flotas que esperan un plan de pago.'
      }
    />
  );

  if (state === 'forbidden') {
    return (
      <Page width="wide">
        {header}
        <ForbiddenState who="Finanzas" />
      </Page>
    );
  }


  if (state === 'loading') {
    return (
      <Page width="wide">
        {header}
          <TableSkeleton rows={7} columns={7} label="Cargando saldos" />
      </Page>
    );
  }

  return (
    <Page width="wide">
      {header}
      {state === 'error' ? <ErrorNotice what="los saldos" onRetry={onRetry} /> : null}
      {message ? (
        <Notice tone="success" title="Listo" onDismiss={() => setMessage(null)} dismissLabel="Cerrar aviso">
          {message}
        </Notice>
      ) : null}

      {queue === 'review' ? (
        <TableFrame title="Por revisar" count={reviewRows.length} countLabel={(count) => `${count} saldos`}>
          <Table
            bare
            label="Saldos por revisar"
            rows={reviewRows}
            getRowKey={rowId}
            empty={
              <NoResults
                title="No hay saldos por revisar"
                description="Cuando una flota quede con saldo a cargo, aparecerá en esta cola."
              />
            }
            columns={[
              { key: 'fleet', header: 'Flota', render: (row: Balance) => row.fleet },
              { key: 'concept', header: 'Concepto', render: (row: Balance) => row.concept, hideOnMobile: true },
              { key: 'week', header: 'Semana', render: (row: Balance) => row.week, hideOnMobile: true },
              { key: 'amount', header: 'Saldo a cargo', align: 'right', render: (row: Balance) => formatMoney(row.amount) },
              { key: 'age', header: 'Antigüedad', align: 'right', render: (row: Balance) => `${row.age} d`, hideOnMobile: true },
              {
                key: 'status',
                header: 'Estado',
                render: (row: Balance) => (
                  <Badge tone={BALANCE_STATUS[row.status].tone}>{BALANCE_STATUS[row.status].label}</Badge>
                ),
                hideOnMobile: true,
              },
              {
                key: 'actions',
                header: 'Acciones',
                align: 'right',
                render: (row: Balance) => (
                  <ToolbarGroup>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={pendingId === row.id}
                      onClick={() => createPlan(row)}
                    >
                      Crear plan
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton label={`Más acciones para ${row.fleet}`} icon={<MoreHorizontal size={16} aria-hidden />} size="sm" variant="ghost" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => undefined}>Ver ficha de la flota</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => undefined}>Marcar en aclaración</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive onSelect={() => undefined}>
                          Condonar saldo
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </ToolbarGroup>
                ),
              },
            ]}
          />
        </TableFrame>
      ) : (
        <TableFrame title="Planes de pago" count={planRows.length} countLabel={(count) => `${count} planes`}>
          <Table
            bare
            label="Planes de pago"
            rows={planRows}
            getRowKey={rowId}
            empty={<NoResults title="Aún no hay planes" description="Crea un plan desde la cola Por revisar." />}
            columns={[
              { key: 'fleet', header: 'Flota', render: (row: PaymentPlan) => row.fleet },
              { key: 'weekly', header: 'Cobro semanal', align: 'right', render: (row: PaymentPlan) => formatMoney(row.weekly) },
              { key: 'progress', header: 'Avance', render: (row: PaymentPlan) => row.progress },
              { key: 'next', header: 'Próximo cobro', render: (row: PaymentPlan) => formatDate(row.next) },
              {
                key: 'status',
                header: 'Estado',
                render: (row: PaymentPlan) => (
                  <Badge tone={row.status === 'late' ? 'danger' : 'success'}>{row.status === 'late' ? 'Atrasado' : 'Al corriente'}</Badge>
                ),
              },
            ]}
          />
        </TableFrame>
      )}
    </Page>
  );
}

function rowId(row: { id: string }): string {
  return row.id;
}
