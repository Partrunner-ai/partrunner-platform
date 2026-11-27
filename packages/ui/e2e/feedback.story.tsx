import { useEffect } from 'react';
import { Table, Toaster, toast, type TableColumn } from '../src';

/** One toast of each tone, shown at mount, in a light or a dark page. */
export function ToastTones({ mode = 'light' }: { mode?: 'light' | 'dark' }) {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    toast.success('Pago enviado');
    toast.warning('Se importaron 18 de 20 filas', { description: 'Revisa las 2 filas con error.' });
    toast.error('No se pudo guardar', {
      description: 'Revisa tu conexión e intenta de nuevo.',
      action: { label: 'Reintentar', onClick: () => undefined },
    });
    return () => {
      toast.dismiss();
      document.documentElement.classList.remove('dark');
    };
  }, [mode]);
  return <Toaster />;
}

/** One toast whose title and description contain a line break. */
export function ToastBreaks() {
  useEffect(() => {
    toast.error('No pude crear la factura:\nel SAT no respondió', { description: 'Folio 1042\nIntenta de nuevo.' });
    return () => {
      toast.dismiss();
    };
  }, []);
  return <Toaster />;
}

interface LedgerRow {
  id: string;
  operator: string;
  routes: number;
  amount: string;
}

const LEDGER_ROWS: LedgerRow[] = Array.from({ length: 24 }, (_, index) => ({
  id: `R-${1040 + index}`,
  operator: `Operador ${index + 1}`,
  routes: 10 + index,
  amount: `$${(1250 * (index + 1)).toLocaleString('es-MX')}.00`,
}));

const LEDGER_COLUMNS: TableColumn<LedgerRow>[] = [
  { key: 'id', header: 'Ruta' },
  { key: 'operator', header: 'Operador' },
  { key: 'routes', header: 'Rutas', numeric: true },
  { key: 'amount', header: 'Importe', numeric: true },
];

/** A long ledger with a pinned header and the third row selected. */
export function LedgerTable() {
  return (
    <Table<LedgerRow>
      label="Conciliación por operador"
      density="ledger"
      maxHeight={360}
      columns={LEDGER_COLUMNS}
      rows={LEDGER_ROWS}
      getRowKey={(row) => row.id}
      onRowClick={() => undefined}
      isRowSelected={(_row, index) => index === 2}
    />
  );
}
