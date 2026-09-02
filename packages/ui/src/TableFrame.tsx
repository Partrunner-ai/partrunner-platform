import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from './Badge';
import { Card, CardContent, CardHeader, type CardProps } from './Card';

export interface TableFrameProps extends Omit<CardProps, 'title' | 'padding' | 'asChild'> {
  /** The list's name. The header renders only when a title, description or actions exist. */
  title?: ReactNode;
  description?: ReactNode;
  /** Row count, as a badge beside the title. Shown only with a title. */
  count?: number;
  /** Accessible name for the count badge, e.g. `(n) => \`${n} filas\``. */
  countLabel?: (count: number) => string;
  /** Muted 16px icon before the title. */
  icon?: LucideIcon;
  /** End-aligned controls that act on the data: export, import, a link. */
  actions?: ReactNode;
  /** Pinned under the body — a `Pagination`, or a summary line. */
  footer?: ReactNode;
}

/**
 * The card a table lives in: a strict assembly of `Card`, `CardHeader` (title,
 * count, actions) and a bleeding `CardContent`, plus a footer slot. The frame
 * clips its corners without becoming a scroll container, so a pinned header
 * inside a capped table keeps working. Any `Table` inside it drops its own
 * surface, so the frame is the only border around the rows.
 */
export const TableFrame = forwardRef<HTMLDivElement, TableFrameProps>(function TableFrame(
  {
    title,
    description,
    count,
    countLabel,
    icon: Icon,
    actions,
    footer,
    shadow = true,
    className,
    children,
    ...rest
  },
  ref,
) {
  const hasHeader = title != null || description != null || actions != null;
  const showCount = title != null && typeof count === 'number';
  const heading = hasHeader ? (
    <span className="pr-table-frame__title">
      {Icon ? <Icon size={16} aria-hidden className="pr-table-frame__icon" /> : null}
      {title != null ? <span className="pr-table-frame__title-text">{title}</span> : null}
      {showCount ? (
        <Badge
          tone="neutral"
          size="sm"
          className="pr-table-frame__count"
          role={countLabel ? 'img' : undefined}
          aria-label={countLabel ? countLabel(count) : undefined}
        >
          {count}
        </Badge>
      ) : null}
    </span>
  ) : null;

  return (
    <Card
      ref={ref}
      padding="md"
      shadow={shadow}
      {...rest}
      data-slot="table-frame"
      className={['pr-table-frame', className].filter(Boolean).join(' ')}
    >
      {hasHeader ? (
        <CardHeader
          className="pr-table-frame__header"
          title={title != null || Icon || showCount ? heading : undefined}
          description={description}
          actions={actions}
        />
      ) : null}
      <CardContent bleed className="pr-table-frame__body">
        {children}
      </CardContent>
      {footer != null ? <div className="pr-table-frame__footer">{footer}</div> : null}
    </Card>
  );
});

export interface TableSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  rows?: number;
  columns?: number;
  /** Announced once, e.g. "Cargando tabla". Required: a silent wait says nothing. */
  label: string;
}

/**
 * Placeholder rows for a compound `Table` that is loading — the same shape the
 * data-driven `Table loading` paints, with the `Spinner` announcement contract.
 */
export const TableSkeleton = forwardRef<HTMLDivElement, TableSkeletonProps>(function TableSkeleton(
  { rows = 6, columns = 5, label, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      aria-busy="true"
      {...rest}
      data-slot="table-skeleton"
      className={['pr-table-skeleton', className].filter(Boolean).join(' ')}
    >
      <span className="pr-visually-hidden">{label}</span>
      <div className="pr-table__skeleton" aria-hidden>
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="pr-table__skeleton-row">
            {Array.from({ length: columns }, (_, column) => (
              <div key={column} className="pr-table__skeleton-cell" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});
