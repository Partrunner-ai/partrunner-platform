import {
  forwardRef,
  type ComponentType,
  type HTMLAttributes,
  type LiHTMLAttributes,
  type MouseEventHandler,
  type ReactNode,
} from 'react';

export type ItemRowTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type ItemListDensity = 'comfortable' | 'compact';

export interface ItemListProps extends HTMLAttributes<HTMLUListElement> {
  density?: ItemListDensity;
  /** A hairline between rows. Defaults to true. */
  divided?: boolean;
}

/**
 * A vertical list of selectable records — the master list of an inbox. Put
 * `ItemRow` children inside. Name it with `aria-label`.
 */
export const ItemList = forwardRef<HTMLUListElement, ItemListProps>(function ItemList(
  { density = 'comfortable', divided = true, className, ...rest },
  ref,
) {
  return (
    <ul
      ref={ref}
      {...rest}
      data-slot="item-list"
      className={[
        'pr-item-list',
        density === 'compact' ? 'pr-item-list--compact' : null,
        divided ? 'pr-item-list--divided' : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
});

export interface ItemRowLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
  'aria-current'?: 'true';
  'data-slot'?: string;
  onClick?: MouseEventHandler<HTMLElement>;
}

export type ItemRowLinkComponent = ComponentType<ItemRowLinkProps>;

export interface ItemRowProps extends Omit<LiHTMLAttributes<HTMLLIElement>, 'title' | 'onClick'> {
  title: ReactNode;
  /** One line with an ellipsis by default. */
  description?: ReactNode;
  descriptionLines?: 1 | 2;
  /** Small muted text at the end of the title line, such as a time. */
  meta?: ReactNode;
  /** Before the text: an `Avatar` or an icon. */
  leading?: ReactNode;
  /** After the text: a `Badge` or a count. Keep it non-interactive; the row is one control. */
  trailing?: ReactNode;
  /** Marks the open record: `aria-current`, a soft tint and a start-edge accent. */
  selected?: boolean;
  /**
   * A 3 px accent bar on the start edge, in the tone colour. Colour is never the
   * only signal: pair it with a `Badge` or text that says the same thing.
   */
  tone?: ItemRowTone;
  /**
   * A third line under the description, in the meta text style. One line with an
   * ellipsis. It sits inside the row's one interactive element, so it must not
   * hold links, buttons or other interactive children.
   */
  footer?: ReactNode;
  /** Bolder title and a small dot. */
  unread?: boolean;
  disabled?: boolean;
  /** Renders the row as a link. Without it the row is a button. */
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  /** Router-aware link used when `href` is set. Defaults to a native anchor. */
  LinkComponent?: ItemRowLinkComponent;
}

const DefaultLink: ItemRowLinkComponent = ({ href, children, ...props }) => (
  <a href={href} {...props}>
    {children}
  </a>
);

/**
 * One record in an `ItemList`. The `<li>` holds exactly one interactive
 * element: an `<a>` with `href`, otherwise a `<button type="button">`.
 */
export const ItemRow = forwardRef<HTMLLIElement, ItemRowProps>(function ItemRow(
  {
    title,
    description,
    descriptionLines = 1,
    meta,
    leading,
    trailing,
    tone,
    footer,
    selected = false,
    unread = false,
    disabled = false,
    href,
    onClick,
    LinkComponent = DefaultLink,
    className,
    ...rest
  },
  ref,
) {
  const content = (
    <>
      {leading != null ? <span className="pr-item-row__leading">{leading}</span> : null}
      <span className="pr-item-row__body">
        <span className="pr-item-row__top">
          {unread ? <span className="pr-item-row__dot" aria-hidden /> : null}
          <span className="pr-item-row__title">{title}</span>
          {meta != null ? <span className="pr-item-row__meta">{meta}</span> : null}
        </span>
        {description != null ? (
          <span
            className={[
              'pr-item-row__description',
              descriptionLines === 2 ? 'pr-item-row__description--2' : null,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {description}
          </span>
        ) : null}
        {footer != null ? <span className="pr-item-row__footer">{footer}</span> : null}
      </span>
      {trailing != null ? <span className="pr-item-row__trailing">{trailing}</span> : null}
    </>
  );
  const mainClass = 'pr-item-row__main';
  const current = selected ? ('true' as const) : undefined;
  let control: ReactNode;
  if (href != null && !disabled) {
    control = (
      <LinkComponent
        href={href}
        className={mainClass}
        aria-current={current}
        data-slot="item-row-main"
        {...(onClick ? { onClick } : {})}
      >
        {content}
      </LinkComponent>
    );
  } else if (href != null) {
    control = (
      <a className={mainClass} aria-disabled="true" aria-current={current} data-slot="item-row-main">
        {content}
      </a>
    );
  } else {
    control = (
      <button
        type="button"
        className={mainClass}
        aria-current={current}
        disabled={disabled}
        onClick={onClick}
        data-slot="item-row-main"
      >
        {content}
      </button>
    );
  }
  return (
    <li
      ref={ref}
      {...rest}
      data-slot="item-row"
      data-selected={selected ? '' : undefined}
      data-tone={tone}
      data-unread={unread ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      className={['pr-item-row', className].filter(Boolean).join(' ')}
    >
      {control}
    </li>
  );
});
