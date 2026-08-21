import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Tones come straight from the scale. The six named ones are the same palette
 * the app launcher tiles use (`--pr-tone-*`), so a badge and a tile for the same
 * thing agree without either app picking a hex.
 */
export type BadgeTone =
  | 'neutral'
  | 'yellow'
  | 'blue'
  | 'amber'
  | 'purple'
  | 'green'
  | 'rose'
  | 'danger'
  | 'success'
  | 'warning'
  | 'info';

export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Solid reads as a status you must act on; the default tint is informational. */
  solid?: boolean;
  /**
   * Transparent, with the tone carried by the border and the text. For a badge on
   * an already-tinted surface, where a second fill reads as two overlapping chips.
   */
  outline?: boolean;
  /**
   * A leading dot in the tone's own colour. Reads as live status — "connected",
   * "3 pending" — rather than as a label.
   */
  dot?: boolean;
  size?: BadgeSize;
  icon?: LucideIcon;
  children?: ReactNode;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  {
    tone = 'neutral',
    solid = false,
    outline = false,
    dot = false,
    size = 'md',
    icon: Icon,
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    'pr-badge',
    `pr-badge--${tone}`,
    `pr-badge--${size}`,
    solid ? 'pr-badge--solid' : null,
    // `solid` wins: a filled badge has no border to carry the tone.
    outline && !solid ? 'pr-badge--outline' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span ref={ref} className={classes} {...rest}>
      {dot && <span className="pr-badge__dot" aria-hidden />}
      {Icon && <Icon size={size === 'xs' ? 10 : 12} aria-hidden />}
      {children}
    </span>
  );
});
