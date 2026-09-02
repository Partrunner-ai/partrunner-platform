import { createRef } from 'react';
import { render } from '@testing-library/react';
import { Truck } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './Table';
import { TableFrame, TableSkeleton } from './TableFrame';

const ROWS = [{ id: 1, name: 'Ana' }];

describe('TableFrame', () => {
  it('assembles a shadowed card with the card header hierarchy', () => {
    const { container, getByRole } = render(
      <TableFrame
        title="Todas las colocadas"
        description="Últimos 30 días"
        count={9}
        icon={Truck}
        actions={<button type="button">Exportar CSV</button>}
      >
        <Table columns={[{ key: 'name', header: 'Nombre' }]} rows={ROWS} />
      </TableFrame>,
    );
    const frame = container.querySelector('.pr-table-frame')!;
    expect(frame.className).toContain('pr-card');
    expect(frame.className).toContain('pr-card--shadow');
    expect(frame.className).toContain('pr-card--pad-md');
    expect(frame.querySelector('.pr-card__header.pr-table-frame__header')).not.toBeNull();
    expect(getByRole('heading', { level: 3, name: 'Todas las colocadas 9' })).toBeDefined();
    expect(frame.querySelector('.pr-card__description')?.textContent).toBe('Últimos 30 días');
    expect(frame.querySelector('.pr-table-frame__icon')).not.toBeNull();
    expect(getByRole('button', { name: 'Exportar CSV' })).toBeDefined();
    expect(frame.querySelector('.pr-card__content--bleed.pr-table-frame__body')).not.toBeNull();
    expect(frame.querySelector('.pr-table-frame__footer')).toBeNull();
  });

  it('names the count badge when a label is given, and shows it only with a title', () => {
    const { getByRole } = render(
      <TableFrame title="Colocadas" count={9} countLabel={(count) => `${count} filas`}>
        <div />
      </TableFrame>,
    );
    const badge = getByRole('img', { name: '9 filas' });
    expect(badge.className).toContain('pr-badge--neutral');
    expect(badge.className).toContain('pr-table-frame__count');

    const noTitle = render(
      <TableFrame count={9} actions={<button type="button">Exportar</button>}>
        <div />
      </TableFrame>,
    );
    expect(noTitle.container.querySelector('.pr-table-frame__count')).toBeNull();
    expect(noTitle.container.querySelector('.pr-card__actions')).not.toBeNull();
  });

  it('renders no header at all when there is nothing to put in it', () => {
    const { container } = render(
      <TableFrame count={3}>
        <div>rows</div>
      </TableFrame>,
    );
    expect(container.querySelector('.pr-card__header')).toBeNull();
    expect(container.querySelector('.pr-table-frame__body')?.textContent).toBe('rows');
  });

  it('pins the footer under the body', () => {
    const { container } = render(
      <TableFrame title="Colocadas" footer={<nav aria-label="Páginas" />}>
        <div />
      </TableFrame>,
    );
    const footer = container.querySelector('.pr-table-frame__footer')!;
    expect(footer.querySelector('nav[aria-label="Páginas"]')).not.toBeNull();
    expect(footer.previousElementSibling?.className).toContain('pr-table-frame__body');
  });

  it('hosts both table forms and forwards ref, class and card props', () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <TableFrame ref={ref} title="Compound" className="extra" raised data-testid="frame">
        <Table aria-label="Colocadas" bare>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Ana</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableFrame>,
    );
    expect(ref.current?.getAttribute('data-testid')).toBe('frame');
    expect(ref.current?.className).toContain('pr-card--raised');
    expect(ref.current?.className).toContain('extra');
    expect(container.querySelector('.pr-table__scroll--bare')).not.toBeNull();
  });
});

describe('TableSkeleton', () => {
  it('announces once and paints the same rows the data-driven table loads with', () => {
    const ref = createRef<HTMLDivElement>();
    const { getByRole, container } = render(
      <TableSkeleton ref={ref} rows={3} columns={4} label="Cargando tabla" className="extra" />,
    );
    const status = getByRole('status');
    expect(status).toBe(ref.current);
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.className).toBe('pr-table-skeleton extra');
    expect(status.querySelector('.pr-visually-hidden')?.textContent).toBe('Cargando tabla');
    const rows = container.querySelectorAll('.pr-table__skeleton-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]?.querySelectorAll('.pr-table__skeleton-cell')).toHaveLength(4);
    expect(container.querySelector('.pr-table__skeleton')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});

describe('the compound table bare option', () => {
  it('drops the scroll region surface without changing the default output', () => {
    const { container: plain } = render(
      <Table aria-label="Plain">
        <TableBody>
          <TableRow>
            <TableCell>1</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const region = plain.querySelector('[data-slot="table-container"]')!;
    expect(region.className).toBe('pr-table__scroll pr-table__scroll--compound');

    const { container: bare } = render(
      <Table aria-label="Bare" bare>
        <TableBody>
          <TableRow>
            <TableCell>1</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(bare.querySelector('[data-slot="table-container"]')?.className).toBe(
      'pr-table__scroll pr-table__scroll--compound pr-table__scroll--bare',
    );
  });
});
