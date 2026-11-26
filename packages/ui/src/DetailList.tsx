import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

export type DetailListColumns = 1 | 2 | 3 | 4;
export type DetailListLayout = 'stacked' | 'inline';
export type DetailListDensity = 'comfortable' | 'compact';

export interface DetailListProps extends HTMLAttributes<HTMLDListElement> {
  /** Most columns on a wide container. Narrow widths collapse to one. Defaults to 2. */
  columns?: DetailListColumns;
  /**
   * `stacked` puts the label above the value. `inline` puts them on one row with a
   * hairline between rows, for narrow side panels. Ignores `columns`.
   */
  layout?: DetailListLayout;
  density?: DetailListDensity;
}

/**
 * The label/value facts of one record, as a `<dl>`. Label 12px muted, value
 * 14px; long values wrap. Put `DetailItem` children inside.
 */
export const DetailList = forwardRef<HTMLDListElement, DetailListProps>(function DetailList(
  { columns = 2, layout = 'stacked', density = 'comfortable', className, ...rest },
  ref,
) {
  return (
    <dl
      ref={ref}
      {...rest}
      data-slot="detail-list"
      className={[
        'pr-detail-list',
        `pr-detail-list--${layout}`,
        `pr-detail-list--cols-${columns}`,
        density === 'compact' ? 'pr-detail-list--compact' : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
});

export interface DetailItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  label: ReactNode;
  /** The value. Null, undefined, `''` and `false` show `emptyText` instead. */
  children?: ReactNode;
  /** How many columns the item takes in a `stacked` list. */
  span?: 1 | 2 | 'full';
  /** Tabular figures; right-aligned in an `inline` list. */
  numeric?: boolean;
  /** Shown muted when there is no value. Defaults to an em dash. */
  emptyText?: string;
}

/** One fact inside a `DetailList`: a `<div>` that groups a `<dt>` and a `<dd>`. */
export const DetailItem = forwardRef<HTMLDivElement, DetailItemProps>(function DetailItem(
  { label, children, span = 1, numeric = false, emptyText = '—', className, ...rest },
  ref,
) {
  const empty = children == null || children === '' || children === false;
  return (
    <div
      ref={ref}
      {...rest}
      data-slot="detail-item"
      className={[
        'pr-detail-item',
        span !== 1 ? `pr-detail-item--span-${span}` : null,
        numeric ? 'pr-detail-item--numeric' : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <dt className="pr-detail-item__label">{label}</dt>
      <dd className={['pr-detail-item__value', empty ? 'pr-detail-item__value--empty' : null].filter(Boolean).join(' ')}>
        {empty ? emptyText : children}
      </dd>
    </div>
  );
});
