import { forwardRef, useId, useState, type HTMLAttributes, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export type DisclosureVariant = 'plain' | 'card';
export type DisclosureHeadingLevel = 2 | 3 | 4;

export interface DisclosureProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** The header text. It is the accessible name of the button and of the panel. */
  title: ReactNode;
  /** A quiet line under the title. */
  description?: ReactNode;
  /** Non-interactive content at the end of the header, such as a `Badge` or a count. */
  trailing?: ReactNode;
  /** Initial state when uncontrolled. */
  defaultOpen?: boolean;
  /** Controlled state. Pair it with `onOpenChange`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** `plain`: header row and content, with a hairline between stacked ones. `card`: the bordered surface of `Card`. */
  variant?: DisclosureVariant;
  /** Level of the heading that wraps the button. Defaults to 3. */
  headingLevel?: DisclosureHeadingLevel;
  children?: ReactNode;
}

/**
 * A section that opens and closes. The whole header row is one button with
 * `aria-expanded` and `aria-controls`; the panel is a labelled region that stays
 * in the DOM as `hidden` while closed. Use it instead of a raw `<details>`.
 */
export const Disclosure = forwardRef<HTMLDivElement, DisclosureProps>(function Disclosure(
  {
    title,
    description,
    trailing,
    defaultOpen = false,
    open: openProp,
    onOpenChange,
    variant = 'plain',
    headingLevel = 3,
    className,
    children,
    ...rest
  },
  ref,
) {
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : innerOpen;
  const baseId = useId();
  const buttonId = `${baseId}-trigger`;
  const panelId = `${baseId}-panel`;
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';

  function toggle() {
    const next = !open;
    if (!controlled) setInnerOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div
      ref={ref}
      {...rest}
      data-slot="disclosure"
      data-state={open ? 'open' : 'closed'}
      className={['pr-disclosure', `pr-disclosure--${variant}`, className].filter(Boolean).join(' ')}
    >
      <Heading className="pr-disclosure__heading">
        <button
          type="button"
          id={buttonId}
          className="pr-disclosure__trigger"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
        >
          <ChevronRight size={18} aria-hidden className="pr-disclosure__chevron" />
          <span className="pr-disclosure__text">
            <span className="pr-disclosure__title">{title}</span>
            {description != null ? (
              <span className="pr-disclosure__description">{description}</span>
            ) : null}
          </span>
          {trailing != null ? <span className="pr-disclosure__trailing">{trailing}</span> : null}
        </button>
      </Heading>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className="pr-disclosure__panel"
      >
        {children}
      </div>
    </div>
  );
});
