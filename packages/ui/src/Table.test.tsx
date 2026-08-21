import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DataTable,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  type TableColumn,
} from './Table';

interface Row extends Record<string, unknown> {
  id: string;
  name: string;
  total: number;
}

const rows: Row[] = [
  { id: 'a', name: 'Ana', total: 10 },
  { id: 'b', name: 'Beto', total: 20 },
];

const columns: TableColumn<Row>[] = [
  { key: 'name', header: 'Nombre' },
  { key: 'total', header: 'Total', align: 'end' },
];

describe('Table', () => {
  it('reads a cell out of the row when the column has no render', () => {
    render(<Table columns={columns} rows={rows} />);
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
  });

  it('names its columns as headers, so a screen reader can say which cell is which', () => {
    render(<Table columns={columns} rows={rows} />);
    const th = screen.getByText('Nombre').closest('th');
    expect(th?.getAttribute('scope')).toBe('col');
  });

  it('shows the empty state instead of an empty table body', () => {
    render(<Table columns={columns} rows={[]} empty="Sin facturas" />);
    expect(screen.getByText('Sin facturas')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('lets the error win over the empty state — an empty list and a failed one are different', () => {
    render(<Table columns={columns} rows={[]} empty="Sin facturas" error={<p>Falló la carga</p>} />);
    expect(screen.getByText('Falló la carga')).toBeTruthy();
    expect(screen.queryByText('Sin facturas')).toBeNull();
  });

  it('announces itself while loading rather than going silent', () => {
    const { container } = render(<Table columns={columns} rows={[]} loading />);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  describe('a clickable row', () => {
    it('opens on click', async () => {
      const onRowClick = vi.fn();
      render(<Table columns={columns} rows={rows} onRowClick={onRowClick} />);
      await userEvent.click(screen.getByText('Ana'));
      expect(onRowClick).toHaveBeenCalledWith(rows[0]);
    });

    it('leaves clicks on a control inside it alone', async () => {
      // The reason this component is worth having: a delete button in the last
      // column must not also open the row.
      const onRowClick = vi.fn();
      const onDelete = vi.fn();
      render(
        <Table
          columns={[
            ...columns,
            {
              key: 'actions',
              header: 'Acciones',
              render: () => (
                <button type="button" onClick={onDelete}>
                  Borrar
                </button>
              ),
            },
          ]}
          rows={rows}
          onRowClick={onRowClick}
        />,
      );
      await userEvent.click(screen.getAllByRole('button', { name: 'Borrar' })[0]!);
      expect(onDelete).toHaveBeenCalled();
      expect(onRowClick).not.toHaveBeenCalled();
    });

    it('opens on Enter and Space, because a row you can focus you can activate', async () => {
      const onRowClick = vi.fn();
      render(<Table columns={columns} rows={rows} onRowClick={onRowClick} />);
      const row = screen.getByText('Ana').closest('tr')!;
      row.focus();
      await userEvent.keyboard('{Enter}');
      await userEvent.keyboard(' ');
      expect(onRowClick).toHaveBeenCalledTimes(2);
    });

    it('ignores Enter pressed inside a field in the row', async () => {
      const onRowClick = vi.fn();
      render(
        <Table
          columns={[
            {
              key: 'name',
              header: 'Nombre',
              render: () => <input aria-label="Editar nombre" />,
            },
          ]}
          rows={rows}
          onRowClick={onRowClick}
        />,
      );
      await userEvent.click(screen.getAllByLabelText('Editar nombre')[0]!);
      await userEvent.keyboard('{Enter}');
      expect(onRowClick).not.toHaveBeenCalled();
    });

    it('is reachable by keyboard and says what it opens', () => {
      render(
        <Table
          columns={columns}
          rows={rows}
          onRowClick={() => {}}
          getRowAriaLabel={(row) => `Abrir ${row.name}`}
        />,
      );
      const row = screen.getByText('Ana').closest('tr')!;
      expect(row.getAttribute('tabindex')).toBe('0');
      expect(row.getAttribute('aria-label')).toBe('Abrir Ana');
    });

    it('reports focus and pointer preview without taking activation away from the row', () => {
      const onRowClick = vi.fn();
      const onRowFocus = vi.fn();
      const onRowMouseEnter = vi.fn();
      render(
        <Table
          columns={columns}
          rows={rows}
          onRowClick={onRowClick}
          onRowFocus={onRowFocus}
          onRowMouseEnter={onRowMouseEnter}
        />,
      );
      const row = screen.getByText('Ana').closest('tr')!;

      fireEvent.focus(row);
      fireEvent.mouseEnter(row);
      fireEvent.click(row);

      expect(onRowFocus).toHaveBeenCalledWith(rows[0], 0);
      expect(onRowMouseEnter).toHaveBeenCalledWith(rows[0], 0);
      expect(onRowClick).toHaveBeenCalledWith(rows[0]);
    });
  });

  it('does not make a row focusable when there is nothing to open', () => {
    render(<Table columns={columns} rows={rows} />);
    expect(screen.getByText('Ana').closest('tr')!.getAttribute('tabindex')).toBeNull();
  });

  it('keys rows by identity when asked, so sorting does not shuffle the DOM', () => {
    const { container, rerender } = render(
      <Table columns={columns} rows={rows} getRowKey={(row) => row.id} />,
    );
    const first = container.querySelectorAll('tbody tr')[0];
    rerender(<Table columns={columns} rows={[...rows].reverse()} getRowKey={(row) => row.id} />);
    // Ana's row element is reused rather than repainted as Beto.
    expect(container.querySelectorAll('tbody tr')[1]).toBe(first);
  });

  describe('the horizontal scroll region', () => {
    it('is focusable and named even when the first column is not sticky', () => {
      render(<Table columns={columns} rows={rows} label="Facturas" />);
      const region = screen.getByRole('region', { name: 'Facturas' });
      expect(region.getAttribute('tabindex')).toBe('0');
    });

    it('keeps stickiness as a separate layout choice', () => {
      const { container } = render(<Table columns={columns} rows={rows} stickyFirstColumn />);
      expect(container.querySelector('.pr-table--sticky-first')).toBeTruthy();
    });
  });

  describe('a pinned header over a capped body', () => {
    // The alternative this replaces is a header <table> next to a body <table> in a
    // scroll box. It misaligns by the scrollbar width the moment rows overflow,
    // because only the body loses that width — invisible until there is enough data,
    // and invisible anywhere overlay scrollbars hide the gap.
    it('keeps the header in the same table as the body, so they cannot drift', () => {
      const { container } = render(<Table columns={columns} rows={rows} maxHeight={400} />);

      // One table. This is the whole fix: two tables is what breaks.
      expect(container.querySelectorAll('table')).toHaveLength(1);
      const table = container.querySelector('table')!;
      expect(table.querySelector('thead')).toBeTruthy();
      expect(table.querySelector('tbody')).toBeTruthy();
    });

    it('caps the scroll region rather than the table', () => {
      // The cap belongs to the scroll container; on the table it would clip instead
      // of scroll, and the header would leave with the rows.
      const { container } = render(<Table columns={columns} rows={rows} maxHeight={400} />);
      const region = container.querySelector<HTMLElement>('.pr-table__scroll')!;
      expect(region.classList.contains('pr-table__scroll--capped')).toBe(true);
      expect(region.style.maxHeight).toBe('400px');
      expect(container.querySelector<HTMLElement>('table')!.style.maxHeight).toBe('');
    });

    it('takes a CSS length as given', () => {
      const { container } = render(<Table columns={columns} rows={rows} maxHeight="60vh" />);
      expect(container.querySelector<HTMLElement>('.pr-table__scroll')!.style.maxHeight).toBe(
        '60vh',
      );
    });

    it('changes nothing when the height is not capped', () => {
      const { container } = render(<Table columns={columns} rows={rows} />);
      expect(container.querySelector('.pr-table__scroll--capped')).toBeNull();
      expect(container.querySelector('.pr-table--sticky-header')).toBeNull();
      expect(container.querySelector<HTMLElement>('.pr-table__scroll')!.style.maxHeight).toBe('');
    });

    it('composes with a sticky first column', () => {
      const { container } = render(
        <Table columns={columns} rows={rows} maxHeight={300} stickyFirstColumn />,
      );
      const table = container.querySelector('table')!;
      expect(table.classList.contains('pr-table--sticky-header')).toBe(true);
      expect(table.classList.contains('pr-table--sticky-first')).toBe(true);
    });
  });

  it('drops its own surface when bare, for a table already inside a Card', () => {
    const { container } = render(<Table columns={columns} rows={rows} bare />);
    expect(container.querySelector('.pr-table__shell--bare')).toBeTruthy();
  });
});

describe('the compound semantic Table interface', () => {
  it('preserves native semantics, attributes, classes, and refs', () => {
    const tableRef = createRef<HTMLTableElement>();
    const headerRef = createRef<HTMLTableSectionElement>();
    const bodyRef = createRef<HTMLTableSectionElement>();
    const footerRef = createRef<HTMLTableSectionElement>();
    const rowRef = createRef<HTMLTableRowElement>();
    const headRef = createRef<HTMLTableCellElement>();
    const cellRef = createRef<HTMLTableCellElement>();
    const captionRef = createRef<HTMLTableCaptionElement>();

    const { container } = render(
      <Table
        ref={tableRef}
        aria-label="Permisos"
        scrollLabel="Tabla de permisos"
        density="compact"
        className="consumer-table"
        containerClassName="consumer-scroll"
      >
        <TableCaption ref={captionRef} className="consumer-caption">
          Acceso por equipo
        </TableCaption>
        <TableHeader ref={headerRef} className="consumer-header">
          <TableRow ref={rowRef} style={{ opacity: 0.5 }} data-dragging>
            <TableHead ref={headRef} colSpan={2} className="consumer-head">
              Equipo
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody ref={bodyRef}>
          <TableRow>
            <TableCell ref={cellRef} rowSpan={2} className="consumer-cell">
              Operaciones
            </TableCell>
            <TableCell>Editar</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Consultar</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter ref={footerRef}>
          <TableRow>
            <TableCell colSpan={2}>2 permisos</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );

    expect(screen.getByRole('region', { name: 'Tabla de permisos' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Permisos' })).toBe(tableRef.current);
    expect(tableRef.current?.className).toContain('pr-table--compact');
    expect(tableRef.current?.className).toContain('consumer-table');
    expect(container.querySelector('.consumer-scroll')).toBeTruthy();
    expect(headerRef.current?.tagName).toBe('THEAD');
    expect(bodyRef.current?.tagName).toBe('TBODY');
    expect(footerRef.current?.tagName).toBe('TFOOT');
    expect(rowRef.current?.tagName).toBe('TR');
    expect(rowRef.current?.style.opacity).toBe('0.5');
    expect(rowRef.current?.hasAttribute('data-dragging')).toBe(true);
    expect(headRef.current?.scope).toBe('col');
    expect(headRef.current?.colSpan).toBe(2);
    expect(cellRef.current?.rowSpan).toBe(2);
    expect(captionRef.current?.tagName).toBe('CAPTION');
  });

  it('lets apps opt out of the overflow region without losing the native table', () => {
    render(
      <Table overflow={false} aria-label="Tabla simple">
        <TableBody>
          <TableRow>
            <TableCell>Contenido</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getByRole('table', { name: 'Tabla simple' })).toBeTruthy();
  });

  it('makes only actionable rows focusable and keyboard-activatable', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onNestedClick = vi.fn();

    render(
      <Table aria-label="Rutas">
        <TableBody>
          <TableRow aria-label="Abrir ruta Ana" onClick={onRowClick}>
            <TableCell>Ana</TableCell>
            <TableCell>
              <button type="button" onClick={onNestedClick}>Eliminar</button>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Beto</TableCell>
            <TableCell>Solo lectura</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const interactiveRow = screen.getByRole('row', { name: 'Abrir ruta Ana' });
    const staticRow = screen.getByText('Beto').closest('tr')!;
    expect(interactiveRow.getAttribute('tabindex')).toBe('0');
    expect(interactiveRow.className).toContain('pr-table__row--clickable');
    expect(staticRow.getAttribute('tabindex')).toBeNull();
    expect(staticRow.className).not.toContain('pr-table__row--clickable');

    interactiveRow.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onRowClick).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onNestedClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('does not activate an aria-disabled interactive row', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <Table>
        <TableBody>
          <TableRow aria-label="Ruta bloqueada" aria-disabled onClick={onRowClick}>
            <TableCell>Bloqueada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const row = screen.getByRole('row', { name: 'Ruta bloqueada' });
    await user.click(row);
    row.focus();
    await user.keyboard('{Enter}');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('keeps the data-driven renderer available under its explicit name', () => {
    render(<DataTable columns={columns} rows={rows} />);
    expect(screen.getByText('Ana')).toBeTruthy();
  });
});

describe('the row type', () => {
  it('accepts rows typed as an interface', () => {
    // TypeScript does not give interfaces the implicit index signature it gives
    // object type aliases, so row types remain unconstrained.
    interface Driver {
      id: string;
      rfc: string;
    }
    const drivers: Driver[] = [{ id: '1', rfc: 'XAXX010101000' }];
    render(
      <Table<Driver>
        columns={[
          { key: 'rfc', header: 'RFC' },
          { key: 'id', header: 'ID', render: (row) => row.id.toUpperCase() },
        ]}
        rows={drivers}
        getRowKey={(row) => row.id}
      />,
    );
    expect(screen.getByText('XAXX010101000')).toBeTruthy();
  });
});

describe('density', () => {
  it('is compact for a table nested under a summary', () => {
    const { container } = render(<Table columns={columns} rows={rows} density="compact" />);
    expect(container.querySelector('.pr-table--compact')).toBeTruthy();
  });

  it('is not compact by default', () => {
    const { container } = render(<Table columns={columns} rows={rows} />);
    expect(container.querySelector('.pr-table--compact')).toBeNull();
  });
});

describe('alignment aliases', () => {
  it('accepts familiar left and right names without changing the semantic classes', () => {
    const { container } = render(
      <Table
        columns={[
          { key: 'name', header: 'Nombre', align: 'left' },
          { key: 'total', header: 'Total', align: 'right' },
        ]}
        rows={rows}
      />,
    );
    const headers = container.querySelectorAll('th');
    const cells = container.querySelectorAll('tbody td');

    expect(headers[0]!.className).toContain('pr-table__cell--start');
    expect(headers[1]!.className).toContain('pr-table__cell--end');
    expect(cells[0]!.className).toContain('pr-table__cell--start');
    expect(cells[1]!.className).toContain('pr-table__cell--end');
  });
});

describe('getRowClassName', () => {
  it('marks a row that is still listed but no longer live', () => {
    // Every table greys out its revoked or expired rows; without this they all
    // need their own <tr>.
    const { container } = render(
      <Table
        columns={columns}
        rows={rows}
        getRowClassName={row => (row.name === 'Beto' ? 'is-revoked' : undefined)}
      />,
    );
    const trs = container.querySelectorAll('tbody tr');
    expect(trs[0]!.className).not.toContain('is-revoked');
    expect(trs[1]!.className).toContain('is-revoked');
    // still a table row, not a replacement for the base class
    expect(trs[1]!.className).toContain('pr-table__row');
  });
})
