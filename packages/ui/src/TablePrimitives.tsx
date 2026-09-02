import {
  forwardRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react';
import type { TableDensity } from './Table';

function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"], [role="link"]';

export interface TableRootProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Wraps the table in a named, keyboard-reachable horizontal scroll region. */
  overflow?: boolean;
  /** Accessible name for the overflow region. Falls back to the table name. */
  scrollLabel?: string;
  /** Consumer layout classes for the overflow region, without targeting internals. */
  containerClassName?: string;
  density?: TableDensity;
  stickyFirstColumn?: boolean;
  /**
   * Caps the height and pins the header row while the body scrolls under it.
   * A number is pixels; a string is used as-is.
   *
   * The alternative — a header `<table>` beside a body `<table>` in a scroll box —
   * misaligns by the scrollbar width as soon as the rows overflow, because only the
   * body loses that width. One table cannot drift from itself.
   */
  maxHeight?: number | string;
  /** Drops the surrounding surface, for a table already inside a Card or a `TableFrame`. */
  bare?: boolean;
}

/** @internal Native compound-table root used by the backwards-compatible Table dispatcher. */
export const TableRoot = forwardRef<HTMLTableElement, TableRootProps>(function TableRoot(
  {
    overflow = true,
    scrollLabel,
    containerClassName,
    density = 'default',
    stickyFirstColumn = false,
    maxHeight,
    bare = false,
    className,
    children,
    'aria-label': ariaLabel,
    ...props
  },
  ref,
) {
  const table = (
    <table
      {...props}
      ref={ref}
      aria-label={ariaLabel}
      data-slot="table"
      className={classes(
        'pr-table',
        'pr-table--compound',
        density === 'compact' && 'pr-table--compact',
        stickyFirstColumn && 'pr-table--sticky-first',
        maxHeight !== undefined && 'pr-table--sticky-header',
        className,
      )}
    >
      {children}
    </table>
  );

  if (!overflow) return table;

  return (
    <div
      data-slot="table-container"
      role="region"
      aria-label={scrollLabel ?? ariaLabel ?? 'Tabla de resultados'}
      tabIndex={0}
      className={classes(
        'pr-table__scroll',
        'pr-table__scroll--compound',
        bare && 'pr-table__scroll--bare',
        maxHeight !== undefined && 'pr-table__scroll--capped',
        containerClassName,
      )}
      style={
        maxHeight !== undefined
          ? { maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }
          : undefined
      }
    >
      {table}
    </div>
  );
});

export type TableHeaderProps = HTMLAttributes<HTMLTableSectionElement>;

export const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  function TableHeader({ className, ...props }, ref) {
    return (
      <thead
        {...props}
        ref={ref}
        data-slot="table-header"
        className={classes('pr-table__header', className)}
      />
    );
  },
);

export type TableBodyProps = HTMLAttributes<HTMLTableSectionElement>;

export const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(
  function TableBody({ className, ...props }, ref) {
    return (
      <tbody
        {...props}
        ref={ref}
        data-slot="table-body"
        className={classes('pr-table__body', className)}
      />
    );
  },
);

export type TableFooterProps = HTMLAttributes<HTMLTableSectionElement>;

export const TableFooter = forwardRef<HTMLTableSectionElement, TableFooterProps>(
  function TableFooter({ className, ...props }, ref) {
    return (
      <tfoot
        {...props}
        ref={ref}
        data-slot="table-footer"
        className={classes('pr-table__footer', className)}
      />
    );
  },
);

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Adds package-owned focus and hover treatment even when activation is delegated. */
  interactive?: boolean;
}

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(function TableRow(
  {
    interactive = false,
    className,
    tabIndex,
    onClick,
    onKeyDown,
    'aria-disabled': ariaDisabled,
    ...props
  },
  ref,
) {
  const isInteractive = interactive || Boolean(onClick);
  const disabled = ariaDisabled === true || ariaDisabled === 'true';

  const handleClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (disabled) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target !== event.currentTarget &&
      target.closest(INTERACTIVE)
    ) {
      return;
    }
    onClick?.(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled || event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.currentTarget.click();
  };

  return (
    <tr
      {...props}
      ref={ref}
      aria-disabled={ariaDisabled}
      data-slot="table-row"
      tabIndex={isInteractive ? (tabIndex ?? 0) : tabIndex}
      className={classes('pr-table__row', isInteractive && 'pr-table__row--clickable', className)}
      onClick={isInteractive ? handleClick : onClick}
      onKeyDown={isInteractive ? handleKeyDown : onKeyDown}
    />
  );
});

export type TableHeadProps = ThHTMLAttributes<HTMLTableCellElement>;

export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(function TableHead(
  { className, scope = 'col', ...props },
  ref,
) {
  return (
    <th
      {...props}
      ref={ref}
      scope={scope}
      data-slot="table-head"
      className={classes('pr-table__th', className)}
    />
  );
});

export type TableCellProps = TdHTMLAttributes<HTMLTableCellElement>;

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(function TableCell(
  { className, ...props },
  ref,
) {
  return (
    <td
      {...props}
      ref={ref}
      data-slot="table-cell"
      className={classes('pr-table__td', className)}
    />
  );
});

export type TableCaptionProps = HTMLAttributes<HTMLTableCaptionElement>;

export const TableCaption = forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  function TableCaption({ className, ...props }, ref) {
    return (
      <caption
        {...props}
        ref={ref}
        data-slot="table-caption"
        className={classes('pr-table__caption', className)}
      />
    );
  },
);
