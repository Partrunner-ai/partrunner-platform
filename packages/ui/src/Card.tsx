import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { Slot } from './Slot';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

/**
 * The same tone vocabulary `Badge` and the launcher tiles use, over the shared
 * `--pr-tone-*` pairs — so a tinted card, the badge inside it and the tile that
 * links to it all land on the same colour.
 *
 * `neutral` is the default surface, which is why it is not a class.
 */
export type CardTone = 'neutral' | 'yellow' | 'blue' | 'amber' | 'purple' | 'green' | 'rose';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  /** Sits on `elevated` instead of `surface` — for popovers and menus. */
  raised?: boolean;
  /**
   * A resting shadow under the card, without changing its surface.
   *
   * Different from `raised`, which lifts the card onto `elevated` for a popover.
   * This is a softer way to separate cards from the page while they remain on
   * the same semantic surface.
   */
  shadow?: boolean;
  /** Hover and focus affordances for a whole-card link or button. */
  interactive?: boolean;
  /**
   * Uses a translucent, blurred surface derived from the active theme. This is
   * the package-owned Crystal-style surface; it never assumes a light backdrop.
   */
  glass?: boolean;
  tone?: CardTone;
  /**
   * Keeps a hue-matched outline around a toned card. The existing borderless
   * tone remains the default for backwards compatibility.
   */
  toneBorder?: boolean;
  /**
   * Washes the tone across the surface instead of tinting it flat. Only means
   * anything with a `tone` — a gradient from the surface to itself is the surface.
   */
  gradient?: boolean;
  /**
   * Render the child instead of a `<div>`, keeping the styling — for a card that
   * is itself a link. Same contract as `Button`.
   */
  asChild?: boolean;
}

/**
 * The surface everything else sits on.
 *
 * `raised` is the reason `elevated` had to become a real token: on a dark theme
 * a shadow reads as nothing, so a raised card can only be distinguished by being
 * lighter than the one beneath it.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    padding = 'md',
    raised = false,
    interactive = false,
    glass = false,
    tone = 'neutral',
    toneBorder = false,
    gradient = false,
    asChild = false,
    shadow = false,
    className,
    ...rest
  },
  ref,
) {
  const classes = [
    'pr-card',
    /* `none` emits no class at all rather than `padding: 0`. Asserting zero wins
       against a padding utility the app passes in `className` — same specificity,
       and this stylesheet loads later — which silently flattens a card that was
       only trying to set its own spacing. Absence composes; zero fights. */
    padding === 'none' ? null : `pr-card--pad-${padding}`,
    raised ? 'pr-card--raised' : null,
    shadow && !raised ? 'pr-card--shadow' : null,
    interactive ? 'pr-card--interactive' : null,
    tone !== 'neutral' ? `pr-card--${tone}` : null,
    toneBorder && tone !== 'neutral' ? 'pr-card--tone-border' : null,
    glass ? 'pr-card--glass' : null,
    gradient && !glass ? 'pr-card--gradient' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const Comp = asChild ? Slot : 'div';
  return <Comp ref={ref} className={classes} {...rest} />;
});

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  /** Right-aligned slot for actions. */
  actions?: ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(function CardHeader(
  { title, description, actions, className, children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={['pr-card__header', className].filter(Boolean).join(' ')} {...rest}>
      <div className="pr-card__heading">
        {title && <h3 className="pr-card__title">{title}</h3>}
        {description && <p className="pr-card__description">{description}</p>}
        {children}
      </div>
      {actions && <div className="pr-card__actions">{actions}</div>}
    </div>
  );
});

/*
 * `CardHeader` accepts a concise title/description form and a composable child
 * form. `CardTitle` and `CardDescription` render the same package classes, so
 * both spellings produce equivalent markup.
 */

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(function CardTitle(
  { className, ...rest },
  ref,
) {
  return <h3 ref={ref} className={['pr-card__title', className].filter(Boolean).join(' ')} {...rest} />;
});

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  function CardDescription({ className, ...rest }, ref) {
    return (
      <p ref={ref} className={['pr-card__description', className].filter(Boolean).join(' ')} {...rest} />
    );
  },
);

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Runs the body to the card's edges while the header keeps its padding.
   *
   * For a body that is its own bounded surface — a table, a chart, an image — where
   * the card's inset reads as a gap around a thing that should meet the border, but
   * the title above it still needs breathing room.
   *
   * `padding="none"` on the `Card` cannot express this: the padding lives on the card,
   * so removing it takes the header's inset with it and the title ends up flush
   * against the edge. This cancels the card's padding for the body alone, reading the
   * amount from `--pr-card-pad` so it stays correct at every padding size.
   */
  bleed?: boolean;
}

/**
 * The body below a header. It carries no padding of its own — the `Card` owns
 * that — only the separation from whatever sits above it.
 */
export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(function CardContent(
  { className, bleed = false, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={['pr-card__content', bleed ? 'pr-card__content--bleed' : null, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
});
