import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';

export type SpinnerSize = 'sm' | 'md' | 'lg';

/**
 * `muted` is the standalone spinner sitting on a surface. `inherit` takes the colour
 * of whatever contains it — for a spinner inside a coloured control, or one an app
 * needs to tint.
 */
export type SpinnerTone = 'muted' | 'inherit';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
  /**
   * Announced to assistive tech. A spinner with no accessible name is a
   * silent wait — the screen stops responding and nothing says why.
   */
  label?: string;
  /**
   * Where the colour comes from. Defaults to `muted`.
   *
   * `inherit` emits no colour rule at all rather than setting `color: currentColor`,
   * which matters because package CSS is unlayered: a declaration here — even
   * `currentColor` — outranks a Tailwind `text-*` utility in `@layer utilities`, so a
   * consumer could not tint the spinner. Absence composes; a value fights.
   *
   * This preserves caller-owned colour utilities instead of silently replacing
   * them with the muted default.
   */
  tone?: SpinnerTone;
}

const SPINNER_PX: Record<SpinnerSize, number> = { sm: 14, md: 18, lg: 28 };

export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { size = 'md', label = 'Cargando', tone = 'muted', className, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={['pr-spinner', tone === 'muted' ? 'pr-spinner--muted' : null, className]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="polite"
      {...rest}
    >
      <Loader2 className="pr-spinner__icon" size={SPINNER_PX[size]} aria-hidden />
      <span className="pr-visually-hidden">{label}</span>
    </span>
  );
});

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** The way out — usually the action that would create the missing thing. */
  action?: ReactNode;
}

/**
 * Nobody owns this today and three apps inline it, which is why the copy and
 * spacing drift between screens that are all saying "there is nothing here".
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  { icon: Icon, title, description, action, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={['pr-empty', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {Icon && (
        <span className="pr-empty__icon" aria-hidden>
          <Icon size={22} />
        </span>
      )}
      <p className="pr-empty__title">{title}</p>
      {description && <p className="pr-empty__description">{description}</p>}
      {children}
      {action && <div className="pr-empty__action">{action}</div>}
    </div>
  );
});
