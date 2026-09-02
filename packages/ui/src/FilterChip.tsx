import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { BadgeTone } from './Badge';
import { StatusDot } from './StatusDot';

export interface FilterChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> {
  /** The chip is the current filter. Owns `aria-pressed`. */
  active?: boolean;
  /** Rows behind this chip, in tabular figures. */
  count?: number;
  /** Tone of the leading dot. */
  tone?: BadgeTone;
  /** Show a `StatusDot` in `tone` before the label. */
  dot?: boolean;
  icon?: LucideIcon;
  children?: ReactNode;
}

/**
 * A one-tap filter over a small enumeration — the row of status chips above a
 * list. Inactive chips are quiet outlines; the active one is ink on the page.
 */
export const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(function FilterChip(
  {
    active = false,
    count,
    tone = 'neutral',
    dot = false,
    icon: Icon,
    type = 'button',
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      type={type}
      aria-pressed={active}
      data-slot="filter-chip"
      data-state={active ? 'active' : 'inactive'}
      className={['pr-filter-chip', className].filter(Boolean).join(' ')}
    >
      {dot ? (
        <StatusDot tone={tone} className="pr-filter-chip__dot" />
      ) : Icon ? (
        <Icon size={14} aria-hidden className="pr-filter-chip__icon" />
      ) : null}
      <span className="pr-filter-chip__label">{children}</span>
      {typeof count === 'number' ? <span className="pr-filter-chip__count">{count}</span> : null}
    </button>
  );
});

export type FilterChipRowProps = HTMLAttributes<HTMLDivElement>;

/** The chips of one filter, as a named group. Pass `aria-label`. */
export const FilterChipRow = forwardRef<HTMLDivElement, FilterChipRowProps>(function FilterChipRow(
  { className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      role="group"
      {...rest}
      data-slot="filter-chip-row"
      className={['pr-filter-chip-row', className].filter(Boolean).join(' ')}
    />
  );
});
