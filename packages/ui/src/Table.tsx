import {
  forwardRef,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react';
import { EmptyState, Spinner } from './Feedback';
import { TableRoot, type TableRootProps } from './TablePrimitives';

export {
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  type TableBodyProps,
  type TableCaptionProps,
  type TableCellProps,
  type TableFooterProps,
  type TableHeadProps,
  type TableHeaderProps,
  type TableRootProps,
  type TableRowProps,
} from './TablePrimitives';

/** `left` and `right` are aliases for the logical `start` and `end` values. */
export type TableAlign = 'start' | 'left' | 'center' | 'end' | 'right';

/**
 * `compact` is for a table nested inside a card that is itself a row of something
 * else — a breakdown under a summary. The apps have both kinds and they are not the
 * same component with different data: a nested table at page-level padding pushes
 * the card it sits in off the screen. It is also the migration-friendly choice for
 * existing dense tables that use compact type and short rows.
 */
export type TableDensity = 'default' | 'compact';

export interface TableColumn<T> {
  /** Identity of the column, and the fallback for reading the cell out of the row. */
  key: string;
  header: ReactNode;
  /** Without this the cell renders `row[key]` as text. */
  render?: (row: T, index: number) => ReactNode;
  align?: TableAlign;
  className?: string;
  headerClassName?: string;
  /**
   * Hidden below `sm`. A table with twelve columns is unreadable on a phone long
   * before it is incomplete, so the way out is dropping columns, not shrinking type.
   */
  hideOnMobile?: boolean;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  /**
   * Stable identity per row. Defaults to the index, which is fine for a static
   * list and wrong the moment rows are sorted or filtered — React reuses the DOM
   * for the wrong row and any focus or open menu inside it follows.
   */
  getRowKey?: (row: T, index: number) => string | number;
  onRowClick?: (row: T) => void;
  /** Reports the row receiving focus so a companion preview can follow it. */
  onRowFocus?: (row: T, index: number) => void;
  /** Reports pointer preview separately from row activation. */
  onRowMouseEnter?: (row: T, index: number) => void;
  /**
   * Extra classes on the row, derived from the row.
   *
   * This is for rows that are still there but no longer live — a revoked link, an
   * expired invoice — which every table greys out in its own way. Not a styling
   * escape hatch: if a whole table needs different rows, that is `className`.
   */
  getRowClassName?: (row: T, index: number) => string | undefined;
  /**
   * What a row announces to a screen reader. Only used with `onRowClick`, because
   * a row that does nothing has nothing to announce.
   */
  getRowAriaLabel?: (row: T) => string;
  /** Replaces the whole table with a skeleton of the same shape. */
  loading?: boolean;
  /** Shown instead of the table when `rows` is empty. A string becomes the title. */
  empty?: ReactNode;
  /** Shown instead of the table, and takes precedence over `empty`. */
  error?: ReactNode;
  /**
   * Pins the first column while the rest scrolls, below `sm` only. For a table
   * whose first column is the thing you are reading across from.
   */
  stickyFirstColumn?: boolean;
  /**
   * Caps the table's height and pins the header row while the body scrolls under it.
   * Accepts a CSS length; a number is treated as pixels.
   *
   * Use this instead of splitting the header and body into two `<table>` elements,
   * which is the usual way to get a sticky header and is subtly broken: the body
   * table sits in the scroll container and the header table does not, so once the
   * rows overflow, the scrollbar takes width from the body alone and the columns
   * drift apart by exactly that much. It looks fine until there is enough data to
   * scroll, and looks fine anywhere overlay scrollbars hide the gap — so it tends to
   * ship. One table cannot drift from itself.
   */
  maxHeight?: number | string;
  /** Announced on the scroll region, and the hint shown above a sticky table. */
  label?: string;
  className?: string;
  /** Drops the surrounding surface, for a table already inside a Card. */
  bare?: boolean;
  density?: TableDensity;
}

/** Explicit name for the existing data-driven interface. `TableProps` remains supported. */
export type DataTableProps<T> = TableProps<T>;

const ALIGN: Record<TableAlign, string> = {
  start: 'pr-table__cell--start',
  left: 'pr-table__cell--start',
  center: 'pr-table__cell--center',
  end: 'pr-table__cell--end',
  right: 'pr-table__cell--end',
};

/**
 * Interactive things inside a row own their own clicks.
 *
 * Without this guard, activating an interactive control can also trigger the
 * containing row.
 */
const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"], [role="link"]';

/**
 * `T` is deliberately unconstrained.
 *
 * The obvious constraint is `T extends Record<string, unknown>`, but that makes
 * the component unusable for most interface-shaped rows because TypeScript
 * does not give an `interface` the implicit index
 * signature it gives an object type alias. An interface-shaped row array is not
 * assignable to `Record<string, unknown>[]`.
 *
 * The untyped key lookup therefore stays inside this implementation.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  onRowFocus,
  onRowMouseEnter,
  getRowClassName,
  getRowAriaLabel,
  loading = false,
  empty = 'Sin datos',
  error,
  stickyFirstColumn = false,
  maxHeight,
  label = 'Tabla de resultados',
  className,
  bare = false,
  density = 'default',
}: TableProps<T>) {
  const shell = ['pr-table__shell', bare ? 'pr-table__shell--bare' : null, className]
    .filter(Boolean)
    .join(' ');

  if (loading) {
    return (
      <div className={shell} aria-busy>
        <Spinner className="pr-table__loading-spinner" label={`Cargando ${label.toLowerCase()}`} />
        <div className="pr-table__skeleton" aria-hidden>
          {Array.from({ length: 6 }).map((_, row) => (
            <div key={row} className="pr-table__skeleton-row">
              {columns.map((col) => (
                <div key={col.key} className="pr-table__skeleton-cell" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className={shell}>{error}</div>;
  }

  if (!rows.length) {
    return (
      <div className={shell}>
        {typeof empty === 'string' ? <EmptyState title={empty} /> : empty}
      </div>
    );
  }

  const sticky = stickyFirstColumn ? ' pr-table--sticky-first' : '';
  const dense = density === 'compact' ? ' pr-table--compact' : '';

  return (
    <div className={shell}>
      {stickyFirstColumn ? (
        <p className="pr-table__hint" aria-hidden>
          Desliza para ver más columnas
        </p>
      ) : null}
      {/* A scroll container is only reachable by keyboard if it is focusable, and
          only explicable if it is named — otherwise the columns past the edge exist
          for mouse users alone. */}
      <div
        className={'pr-table__scroll' + (maxHeight !== undefined ? ' pr-table__scroll--capped' : '')}
        role="region"
        aria-label={label}
        tabIndex={0}
        style={
          maxHeight !== undefined
            ? { maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }
            : undefined
        }
      >
        <table
          className={
            'pr-table' + sticky + dense + (maxHeight !== undefined ? ' pr-table--sticky-header' : '')
          }
        >
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={[
                    'pr-table__th',
                    ALIGN[col.align ?? 'start'],
                    col.hideOnMobile ? 'pr-table__cell--desktop' : null,
                    col.headerClassName,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={getRowKey ? getRowKey(row, i) : i}
                className={[
                  'pr-table__row',
                  onRowClick ? 'pr-table__row--clickable' : null,
                  getRowClassName?.(row, i),
                ]
                  .filter(Boolean)
                  .join(' ')}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick ? getRowAriaLabel?.(row) : undefined}
                onFocus={onRowFocus ? () => onRowFocus(row, i) : undefined}
                onMouseEnter={onRowMouseEnter ? () => onRowMouseEnter(row, i) : undefined}
                onClick={
                  onRowClick
                    ? (event) => {
                        const target = event.target;
                        if (target instanceof Element && target.closest(INTERACTIVE)) return;
                        onRowClick(row);
                      }
                    : undefined
                }
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        // Only the row itself — Enter inside a field in the row
                        // means submit, not open.
                        if (event.target !== event.currentTarget) return;
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        onRowClick(row);
                      }
                    : undefined
                }
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      'pr-table__td',
                      ALIGN[col.align ?? 'start'],
                      col.hideOnMobile ? 'pr-table__cell--desktop' : null,
                      col.className,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {col.render
                      ? col.render(row, i)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function isDataTableProps(
  props: TableRootProps | TableProps<unknown>,
): props is TableProps<unknown> {
  return 'columns' in props && 'rows' in props;
}

interface TableComponent {
  <T>(props: TableProps<T>): ReactElement | null;
  (props: TableRootProps & RefAttributes<HTMLTableElement>): ReactElement | null;
  displayName?: string;
}

const TableDispatcher = forwardRef<
  HTMLTableElement,
  TableRootProps | TableProps<unknown>
>(function Table(props, ref) {
  if (isDataTableProps(props)) return <DataTable {...props} />;
  return <TableRoot {...props} ref={ref} />;
});

/**
 * One compatible table seam with two depths:
 *
 * - `columns` + `rows` keeps the data-driven interface for straightforward data.
 * - native children unlock the compound semantic primitives for TanStack, spans,
 *   skeleton rows, drag-and-drop, and app-owned cells.
 */
export const Table = TableDispatcher as TableComponent;
Table.displayName = 'Table';
