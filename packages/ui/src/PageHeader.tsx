import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

export interface PageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Small uppercase label rendered above the title, in a soft chip. */
  eyebrow?: ReactNode;
  /** The page title. Rendered as an `<h1>` with display tracking. */
  title: ReactNode;
  /** Muted line rendered under the title. */
  subtitle?: ReactNode;
  /** Action area aligned to the end edge (buttons, filters, etc). */
  actions?: ReactNode;
}

/**
 * Standard page header: eyebrow chip, display-tracked title, optional
 * subtitle and an end-aligned action row. Stacks on small screens and
 * spreads title/actions on `640px` and wider.
 *
 * Both consuming apps carried near-identical copies of this component
 * (nexus-portal `design-system/components`, sube-tu-factura
 * `src/components/ui`); this is the package-owned version with the audited
 * token colours — text colours come from `--pr-fg`/`--pr-fg-muted` rather
 * than fixed brand greys, so the header stays legible on any themed surface.
 */
export const PageHeader = forwardRef<HTMLElement, PageHeaderProps>(
  function PageHeader({ eyebrow, title, subtitle, actions, className, ...rest }, ref) {
    return (
      <header
        ref={ref}
        {...rest}
        className={['pr-page-header', className].filter(Boolean).join(' ')}
      >
        <div className="pr-page-header__text">
          {eyebrow != null && eyebrow !== false ? (
            <span className="pr-page-header__eyebrow">{eyebrow}</span>
          ) : null}
          <h1 className="pr-page-header__title">{title}</h1>
          {subtitle != null ? (
            <p className="pr-page-header__subtitle">{subtitle}</p>
          ) : null}
        </div>
        {actions != null ? (
          <div className="pr-page-header__actions">{actions}</div>
        ) : null}
      </header>
    );
  },
);
