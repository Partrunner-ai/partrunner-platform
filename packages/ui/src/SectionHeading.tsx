import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

export type SectionHeadingLevel = 2 | 3;

export interface SectionHeadingProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Small uppercase label above the title. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Muted line under the title. */
  description?: ReactNode;
  /** Controls aligned to the end edge. */
  actions?: ReactNode;
  /** The heading element for `title`: `<h2>` by default, `<h3>` for a nested section. */
  headingLevel?: SectionHeadingLevel;
}

/**
 * A titled section inside a page — the step below `PageHeader`. The root is a
 * `<header>`; `headingLevel` only changes the title element so the document
 * outline stays honest.
 */
export const SectionHeading = forwardRef<HTMLElement, SectionHeadingProps>(
  function SectionHeading(
    { eyebrow, title, description, actions, headingLevel = 2, className, ...rest },
    ref,
  ) {
    const Heading = headingLevel === 3 ? 'h3' : 'h2';
    return (
      <header
        ref={ref}
        {...rest}
        data-slot="section-heading"
        className={['pr-section-heading', className].filter(Boolean).join(' ')}
      >
        <div className="pr-section-heading__text">
          {eyebrow != null && eyebrow !== false ? (
            <p className="pr-section-heading__eyebrow">{eyebrow}</p>
          ) : null}
          <Heading className="pr-section-heading__title">{title}</Heading>
          {description != null ? (
            <p className="pr-section-heading__description">{description}</p>
          ) : null}
        </div>
        {actions != null ? <div className="pr-section-heading__actions">{actions}</div> : null}
      </header>
    );
  },
);
