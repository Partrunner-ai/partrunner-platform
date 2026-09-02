import { forwardRef, type HTMLAttributes } from 'react';

export type StatTileGridColumns = 2 | 3 | 4 | 5 | 6;

export interface StatTileGridProps extends HTMLAttributes<HTMLDivElement> {
  /** Columns from 1024px up. One column under 640px, two under 1024px. */
  columns?: StatTileGridColumns;
}

/** The row of KPI tiles: `StatTile` children on one responsive grid. */
export const StatTileGrid = forwardRef<HTMLDivElement, StatTileGridProps>(function StatTileGrid(
  { columns = 4, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      {...rest}
      data-slot="stat-tile-grid"
      className={['pr-stat-grid', `pr-stat-grid--cols-${columns}`, className]
        .filter(Boolean)
        .join(' ')}
    />
  );
});
